-- Migration: 20261106000001_serialize_rate_limit_checks.sql
-- Description: Serialize rate-limit checks before recording attempts to prevent concurrent race condition bypasses.
-- Addresses Codex P2 finding on commit c198c8134b6dd20e7a1dec1baa99e12d86b60878.

BEGIN;

-- 1. Updated Rate-Limiting Function with Deterministic Advisory Locking
CREATE OR REPLACE FUNCTION public.check_and_record_rate_limit(
    p_ip_hash VARCHAR(64),
    p_email_hash VARCHAR(64),
    p_action VARCHAR(32),
    p_max_ip INTEGER,
    p_max_email INTEGER,
    p_window INTERVAL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_ip_count INTEGER := 0;
    v_email_count INTEGER := 0;
    v_cutoff TIMESTAMPTZ := now() - p_window;
    v_clean_ip_hash VARCHAR(64);
    v_clean_email_hash VARCHAR(64);
    v_clean_action VARCHAR(32);
    v_ip_lock_key BIGINT := NULL;
    v_email_lock_key BIGINT := NULL;
BEGIN
    v_clean_ip_hash := NULLIF(trim(p_ip_hash), '');
    v_clean_email_hash := NULLIF(trim(p_email_hash), '');
    v_clean_action := COALESCE(NULLIF(trim(p_action), ''), 'default');

    -- Compute 64-bit advisory lock keys using distinct domain prefixes to eliminate cross-namespace collisions
    IF v_clean_ip_hash IS NOT NULL THEN
        v_ip_lock_key := pg_catalog.hashtextextended('rate_limit:ip:' || v_clean_action || ':' || v_clean_ip_hash, 0);
    END IF;

    IF v_clean_email_hash IS NOT NULL THEN
        v_email_lock_key := pg_catalog.hashtextextended('rate_limit:email:' || v_clean_action || ':' || v_clean_email_hash, 0);
    END IF;

    -- Acquire transaction-scoped advisory locks in strict ascending numerical order to prevent deadlocks
    IF v_ip_lock_key IS NOT NULL AND v_email_lock_key IS NOT NULL THEN
        IF v_ip_lock_key < v_email_lock_key THEN
            PERFORM pg_catalog.pg_advisory_xact_lock(v_ip_lock_key);
            PERFORM pg_catalog.pg_advisory_xact_lock(v_email_lock_key);
        ELSIF v_ip_lock_key > v_email_lock_key THEN
            PERFORM pg_catalog.pg_advisory_xact_lock(v_email_lock_key);
            PERFORM pg_catalog.pg_advisory_xact_lock(v_ip_lock_key);
        ELSE
            PERFORM pg_catalog.pg_advisory_xact_lock(v_ip_lock_key);
        END IF;
    ELSIF v_ip_lock_key IS NOT NULL THEN
        PERFORM pg_catalog.pg_advisory_xact_lock(v_ip_lock_key);
    ELSIF v_email_lock_key IS NOT NULL THEN
        PERFORM pg_catalog.pg_advisory_xact_lock(v_email_lock_key);
    END IF;

    -- 1. Check IP rate limit under serialized lock
    IF v_clean_ip_hash IS NOT NULL THEN
        SELECT COUNT(*) INTO v_ip_count
        FROM public.referral_submission_attempts
        WHERE rate_key = v_clean_ip_hash
          AND action_type = v_clean_action
          AND attempted_at >= v_cutoff;

        IF v_ip_count >= p_max_ip THEN
            RETURN jsonb_build_object('allowed', false, 'error', 'IP_RATE_LIMIT_EXCEEDED');
        END IF;
    END IF;

    -- 2. Check Email rate limit under serialized lock
    IF v_clean_email_hash IS NOT NULL THEN
        SELECT COUNT(*) INTO v_email_count
        FROM public.referral_submission_attempts
        WHERE rate_key = v_clean_email_hash
          AND action_type = v_clean_action
          AND attempted_at >= v_cutoff;

        IF v_email_count >= p_max_email THEN
            RETURN jsonb_build_object('allowed', false, 'error', 'EMAIL_RATE_LIMIT_EXCEEDED');
        END IF;
    END IF;

    -- 3. Both limits passed; record attempts under serialized lock
    IF v_clean_ip_hash IS NOT NULL THEN
        INSERT INTO public.referral_submission_attempts (rate_key, action_type, attempted_at)
        VALUES (v_clean_ip_hash, v_clean_action, now());
    END IF;

    IF v_clean_email_hash IS NOT NULL THEN
        INSERT INTO public.referral_submission_attempts (rate_key, action_type, attempted_at)
        VALUES (v_clean_email_hash, v_clean_action, now());
    END IF;

    RETURN jsonb_build_object('allowed', true);
END;
$$;

-- 2. Updated Capture Function ensuring non-null rate key derivation and transactional safety
CREATE OR REPLACE FUNCTION public.capture_buyer_referral(
    p_buyer_name TEXT,
    p_buyer_email TEXT,
    p_referral_code VARCHAR(36),
    p_ticket_quantity INTEGER DEFAULT 1,
    p_buyer_phone TEXT DEFAULT NULL,
    p_source_attribution TEXT DEFAULT NULL,
    p_ip_hash VARCHAR(64) DEFAULT NULL,
    p_email_hash VARCHAR(64) DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_clean_email TEXT;
    v_clean_name TEXT;
    v_clean_code VARCHAR(36);
    v_qty INTEGER;
    v_volunteer_id UUID;
    v_existing_lead RECORD;
    v_lead_id UUID;
    v_rate_res JSONB;
    v_effective_email_hash VARCHAR(64);
BEGIN
    v_clean_email := lower(trim(COALESCE(p_buyer_email, '')));
    v_clean_name := trim(COALESCE(p_buyer_name, ''));
    v_clean_code := UPPER(trim(COALESCE(p_referral_code, '')));
    v_qty := COALESCE(p_ticket_quantity, 1);

    -- 1. Input Validation
    IF v_clean_email = '' OR v_clean_email NOT LIKE '%@%.%' THEN
        RETURN jsonb_build_object('success', false, 'error', 'INVALID_EMAIL');
    END IF;

    IF v_clean_name = '' OR LENGTH(v_clean_name) < 2 THEN
        RETURN jsonb_build_object('success', false, 'error', 'INVALID_NAME');
    END IF;

    IF v_qty < 1 OR v_qty > 50 THEN
        RETURN jsonb_build_object('success', false, 'error', 'INVALID_QUANTITY');
    END IF;

    -- Ensure an effective email rate-limit key even if p_email_hash was omitted
    v_effective_email_hash := COALESCE(
        NULLIF(trim(p_email_hash), ''),
        encode(pg_catalog.sha256(('voltex_email_rl:' || v_clean_email)::bytea), 'hex')
    );

    -- 2. Rolling Rate Limit Check (Serialized via transaction-scoped advisory locks)
    v_rate_res := public.check_and_record_rate_limit(
        p_ip_hash, v_effective_email_hash, 'lead_capture', 10, 5, INTERVAL '1 hour'
    );
    IF NOT (v_rate_res->>'allowed')::BOOLEAN THEN
        RETURN jsonb_build_object('success', false, 'error', v_rate_res->>'error');
    END IF;

    -- 3. Resolve Volunteer
    SELECT id INTO v_volunteer_id
    FROM public.profiles
    WHERE lower(trim(referral_code)) = lower(trim(v_clean_code))
    LIMIT 1;

    IF v_volunteer_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'INVALID_REFERRAL_CODE');
    END IF;

    -- 4. Transactional Advisory Lock on Buyer Email (Synchronizes lead mutations and maintenance)
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('buyer_lead:' || v_clean_email));

    -- 5. JIT Lazy Expiration: Expire overdue pending leads immediately
    UPDATE public.buyer_referrals
    SET status = 'expired',
        updated_at = now()
    WHERE buyer_email_normalized = v_clean_email
      AND status = 'pending_purchase'
      AND expires_at < now();

    -- 6. Evaluate Active Lead
    SELECT * INTO v_existing_lead
    FROM public.buyer_referrals
    WHERE buyer_email_normalized = v_clean_email
      AND status IN ('pending_purchase', 'converted')
    LIMIT 1;

    IF v_existing_lead.id IS NOT NULL THEN
        -- IMMUTABILITY GUARD: If lead is already converted, DO NOT MUTATE ANYTHING
        IF v_existing_lead.status = 'converted' THEN
            RETURN jsonb_build_object(
                'success', true,
                'lead_id', v_existing_lead.id,
                'status', 'already_converted',
                'volunteer_id', v_existing_lead.volunteer_id,
                'referral_code', v_existing_lead.referral_code
            );
        END IF;

        -- Pending purchase lead handling
        IF v_existing_lead.volunteer_id = v_volunteer_id THEN
            -- Same volunteer: refresh expiration and optional contact info
            UPDATE public.buyer_referrals
            SET ticket_quantity = v_qty,
                buyer_name = v_clean_name,
                buyer_phone = COALESCE(p_buyer_phone, buyer_phone),
                source_attribution = COALESCE(p_source_attribution, source_attribution),
                expires_at = now() + INTERVAL '48 hours',
                updated_at = now()
            WHERE id = v_existing_lead.id;

            RETURN jsonb_build_object(
                'success', true,
                'lead_id', v_existing_lead.id,
                'status', 'refreshed',
                'volunteer_id', v_existing_lead.volunteer_id,
                'referral_code', v_existing_lead.referral_code
            );
        ELSE
            -- Different volunteer: Record touch; DO NOT overwrite first-touch attribution
            INSERT INTO public.buyer_referral_touches (
                buyer_referral_id,
                subsequent_volunteer_id,
                referral_code,
                ip_hash,
                source_attribution
            ) VALUES (
                v_existing_lead.id,
                v_volunteer_id,
                v_clean_code,
                p_ip_hash,
                p_source_attribution
            );

            RETURN jsonb_build_object(
                'success', true,
                'lead_id', v_existing_lead.id,
                'status', 'touch_recorded',
                'volunteer_id', v_existing_lead.volunteer_id,
                'referral_code', v_existing_lead.referral_code
            );
        END IF;
    END IF;

    -- 7. Insert NEW Lead (Also applies when prior record is expired)
    INSERT INTO public.buyer_referrals (
        volunteer_id,
        referral_code,
        buyer_name,
        buyer_email,
        buyer_phone,
        ticket_quantity,
        source_attribution,
        ip_hash,
        status,
        expires_at
    ) VALUES (
        v_volunteer_id,
        v_clean_code,
        v_clean_name,
        v_clean_email,
        p_buyer_phone,
        v_qty,
        p_source_attribution,
        p_ip_hash,
        'pending_purchase',
        now() + INTERVAL '48 hours'
    ) RETURNING id INTO v_lead_id;

    RETURN jsonb_build_object(
        'success', true,
        'lead_id', v_lead_id,
        'status', 'created',
        'volunteer_id', v_volunteer_id,
        'referral_code', v_clean_code
    );
END;
$$;

-- 3. Function Permissions
REVOKE EXECUTE ON FUNCTION public.check_and_record_rate_limit FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_and_record_rate_limit TO service_role;

REVOKE EXECUTE ON FUNCTION public.capture_buyer_referral FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.capture_buyer_referral TO service_role;

COMMIT;
