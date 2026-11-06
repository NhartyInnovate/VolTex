-- ==============================================================================
-- Migration: 20261103000001_pre_purchase_referral_capture.sql
-- Description: Pre-purchase buyer referral capture, visit telemetry, multi-touch
--              tracking, and audited lead-to-claim conversion lifecycle.
-- Operating Standards:
--   - Privileged functions enforce SECURITY DEFINER with empty search_path ('')
--   - Explicit schema qualification for application tables and user-defined functions
--   - Immutability trigger protect_converted_buyer_referral() enforced as SECURITY INVOKER
--   - Strictly isolated from remote execution (offline migration definition)
-- ==============================================================================

-- 1. Add referral_code to public.profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS referral_code VARCHAR(36) UNIQUE;

-- 2. Code Generation Helper (Deterministic, sanitized prefix + random collision-resistant suffix)
CREATE OR REPLACE FUNCTION public.generate_unique_referral_code(p_full_name TEXT)
RETURNS VARCHAR(36)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_prefix TEXT;
    v_code VARCHAR(36);
    v_chars TEXT := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    v_suffix TEXT;
    v_i INTEGER;
    v_attempts INTEGER := 0;
BEGIN
    -- Extract clean alphanumeric token from full name
    v_prefix := pg_catalog.upper(pg_catalog.regexp_replace(COALESCE(p_full_name, 'VOL'), '[^A-Za-z0-9]', '', 'g'));
    IF pg_catalog.length(v_prefix) < 3 THEN
        v_prefix := 'VOL';
    ELSE
        v_prefix := pg_catalog.substr(v_prefix, 1, 6);
    END IF;

    LOOP
        v_attempts := v_attempts + 1;
        v_suffix := '';
        FOR v_i IN 1..4 LOOP
            v_suffix := v_suffix || pg_catalog.substr(v_chars, pg_catalog.floor(pg_catalog.random() * pg_catalog.length(v_chars) + 1)::INTEGER, 1);
        END LOOP;

        v_code := v_prefix || '-' || v_suffix;

        IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE referral_code = v_code) THEN
            RETURN v_code;
        END IF;

        IF v_attempts > 50 THEN
            -- High collision fallback: append additional random characters
            v_code := 'V-' || pg_catalog.substr(pg_catalog.md5(pg_catalog.random()::TEXT), 1, 8);
            IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE referral_code = v_code) THEN
                RETURN v_code;
            END IF;
        END IF;
    END LOOP;
END;
$$;

-- 3. Superuser/Migration Backfill for existing profiles
DO $$
DECLARE
    r RECORD;
    v_code VARCHAR(36);
BEGIN
    FOR r IN SELECT id, full_name FROM public.profiles WHERE referral_code IS NULL ORDER BY created_at ASC LOOP
        v_code := public.generate_unique_referral_code(r.full_name);
        UPDATE public.profiles SET referral_code = v_code WHERE id = r.id;
    END LOOP;
END;
$$;

-- 4. Volunteer Profile Permissions & Immutability Trigger
CREATE OR REPLACE FUNCTION public.protect_profile_referral_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NEW.referral_code IS DISTINCT FROM OLD.referral_code THEN
        IF NOT public.is_admin() THEN
            RAISE EXCEPTION 'referral_code is immutable and cannot be modified by volunteers'
                USING ERRCODE = '42501';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_referral_code ON public.profiles;
CREATE TRIGGER trg_protect_profile_referral_code
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_profile_referral_code();

-- Hardened column grants: Revoke whole-table update; grant only volunteer-editable columns
REVOKE UPDATE ON public.profiles FROM authenticated, anon;
GRANT UPDATE (full_name, phone_number, volunteer_team, updated_at) ON public.profiles TO authenticated;

-- 5. Update Registration Trigger to Auto-Assign referral_code on New Signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_full_name TEXT;
    v_code VARCHAR(36);
BEGIN
    v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', 'Volunteer');
    v_code := public.generate_unique_referral_code(v_full_name);

    INSERT INTO public.profiles (id, full_name, phone_number, volunteer_team, role, referral_code)
    VALUES (
        NEW.id,
        v_full_name,
        COALESCE(NEW.raw_user_meta_data->>'phone_number', ''),
        COALESCE(NEW.raw_user_meta_data->>'volunteer_team', 'Volunteer Management Team'),
        'volunteer',
        v_code
    );
    RETURN NEW;
END;
$$;

-- 6. Rate Limiting Table & Function
CREATE TABLE IF NOT EXISTS public.referral_submission_attempts (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    rate_key VARCHAR(64) NOT NULL,
    action_type VARCHAR(32) NOT NULL,
    attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_lookup 
ON public.referral_submission_attempts (rate_key, action_type, attempted_at DESC);

ALTER TABLE public.referral_submission_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.referral_submission_attempts FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.referral_submission_attempts TO service_role;

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
BEGIN
    IF p_ip_hash IS NOT NULL AND p_ip_hash <> '' THEN
        SELECT COUNT(*) INTO v_ip_count
        FROM public.referral_submission_attempts
        WHERE rate_key = p_ip_hash
          AND action_type = p_action
          AND attempted_at >= v_cutoff;

        IF v_ip_count >= p_max_ip THEN
            RETURN jsonb_build_object('allowed', false, 'error', 'IP_RATE_LIMIT_EXCEEDED');
        END IF;

        INSERT INTO public.referral_submission_attempts (rate_key, action_type, attempted_at)
        VALUES (p_ip_hash, p_action, now());
    END IF;

    IF p_email_hash IS NOT NULL AND p_email_hash <> '' THEN
        SELECT COUNT(*) INTO v_email_count
        FROM public.referral_submission_attempts
        WHERE rate_key = p_email_hash
          AND action_type = p_action
          AND attempted_at >= v_cutoff;

        IF v_email_count >= p_max_email THEN
            RETURN jsonb_build_object('allowed', false, 'error', 'EMAIL_RATE_LIMIT_EXCEEDED');
        END IF;

        INSERT INTO public.referral_submission_attempts (rate_key, action_type, attempted_at)
        VALUES (p_email_hash, p_action, now());
    END IF;

    RETURN jsonb_build_object('allowed', true);
END;
$$;

-- 7. Buyer Referrals Table (First-Touch Pre-Purchase Leads)
CREATE TABLE IF NOT EXISTS public.buyer_referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    volunteer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    referral_code VARCHAR(36) NOT NULL,
    buyer_name TEXT NOT NULL,
    buyer_name_normalized TEXT GENERATED ALWAYS AS (lower(trim(buyer_name))) STORED,
    buyer_email TEXT NOT NULL,
    buyer_email_normalized TEXT GENERATED ALWAYS AS (lower(trim(buyer_email))) STORED,
    buyer_phone TEXT,
    ticket_quantity INTEGER NOT NULL DEFAULT 1 CHECK (ticket_quantity > 0 AND ticket_quantity <= 50),
    source_attribution TEXT,
    status TEXT NOT NULL DEFAULT 'pending_purchase' 
        CHECK (status IN ('pending_purchase', 'converted', 'expired')),
    ip_hash VARCHAR(64),
    conversion_count INTEGER NOT NULL DEFAULT 0 CHECK (conversion_count >= 0),
    first_converted_at TIMESTAMPTZ,
    last_converted_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '48 hours'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_active_buyer_referral_email 
ON public.buyer_referrals (buyer_email_normalized) 
WHERE status IN ('pending_purchase', 'converted');

CREATE INDEX IF NOT EXISTS idx_buyer_referrals_volunteer 
ON public.buyer_referrals (volunteer_id);

CREATE INDEX IF NOT EXISTS idx_buyer_referrals_expiry 
ON public.buyer_referrals (status, expires_at);

ALTER TABLE public.buyer_referrals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.buyer_referrals FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.buyer_referrals TO authenticated;
GRANT ALL ON public.buyer_referrals TO service_role;

CREATE POLICY "Admins read buyer leads"
ON public.buyer_referrals FOR SELECT TO authenticated
USING (public.is_admin());

-- 8. Buyer Referral Touches Table (Multi-Touch Attribution Audit)
CREATE TABLE IF NOT EXISTS public.buyer_referral_touches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    buyer_referral_id UUID NOT NULL REFERENCES public.buyer_referrals(id) ON DELETE CASCADE,
    subsequent_volunteer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    referral_code VARCHAR(36) NOT NULL,
    ip_hash VARCHAR(64),
    source_attribution TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_touches_lead_id 
ON public.buyer_referral_touches (buyer_referral_id);

ALTER TABLE public.buyer_referral_touches ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.buyer_referral_touches FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.buyer_referral_touches TO authenticated;
GRANT ALL ON public.buyer_referral_touches TO service_role;

CREATE POLICY "Admins read touches"
ON public.buyer_referral_touches FOR SELECT TO authenticated
USING (public.is_admin());

-- 9. Lead Claim Conversions Table (Relational Junction between Lead & Approved Claim)
CREATE TABLE IF NOT EXISTS public.lead_claim_conversions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    buyer_referral_id UUID NOT NULL REFERENCES public.buyer_referrals(id) ON DELETE RESTRICT,
    referral_id UUID NOT NULL UNIQUE REFERENCES public.referrals(id) ON DELETE RESTRICT,
    original_claimant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    credited_volunteer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    attribution_resolution TEXT NOT NULL DEFAULT 'match'
        CHECK (attribution_resolution IN ('match', 'award_to_referrer', 'award_to_claimant')),
    email_override_applied BOOLEAN NOT NULL DEFAULT FALSE,
    admin_notes TEXT,
    converted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    converted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conversions_lead 
ON public.lead_claim_conversions (buyer_referral_id);

CREATE INDEX IF NOT EXISTS idx_conversions_claim 
ON public.lead_claim_conversions (referral_id);

ALTER TABLE public.lead_claim_conversions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.lead_claim_conversions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.lead_claim_conversions TO authenticated;
GRANT ALL ON public.lead_claim_conversions TO service_role;

CREATE POLICY "Admins read conversions"
ON public.lead_claim_conversions FOR SELECT TO authenticated
USING (public.is_admin());

-- 10. Converted Lead Immutability Trigger (SECURITY INVOKER)
CREATE OR REPLACE FUNCTION public.protect_converted_buyer_referral()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_actual_conversions BIGINT;
BEGIN
    IF OLD.status = 'converted' OR NEW.status = 'converted' OR NEW.conversion_count > 0 THEN
        -- Check actual conversion rows
        SELECT COUNT(*) INTO v_actual_conversions
        FROM public.lead_claim_conversions
        WHERE buyer_referral_id = NEW.id;

        IF NEW.conversion_count <> v_actual_conversions THEN
            RAISE EXCEPTION 'conversion_count on buyer lead % (%) does not match actual conversions (%)',
                NEW.id, NEW.conversion_count, v_actual_conversions
                USING ERRCODE = '22000';
        END IF;

        IF v_actual_conversions > 0 AND NEW.first_converted_at IS NULL THEN
            RAISE EXCEPTION 'first_converted_at on converted buyer lead % must not be NULL', NEW.id
                USING ERRCODE = '22000';
        END IF;
    END IF;

    IF OLD.status = 'converted' THEN
        -- 1. Status cannot be reverted away from 'converted'
        IF NEW.status IS DISTINCT FROM 'converted' THEN
            RAISE EXCEPTION 'Cannot revert converted buyer lead % to %', OLD.id, NEW.status
                USING ERRCODE = '22000';
        END IF;

        -- 2. Attribution, identity, and contact fields are strictly immutable
        IF NEW.volunteer_id IS DISTINCT FROM OLD.volunteer_id OR
           NEW.referral_code IS DISTINCT FROM OLD.referral_code OR
           NEW.buyer_name IS DISTINCT FROM OLD.buyer_name OR
           NEW.buyer_email IS DISTINCT FROM OLD.buyer_email OR
           NEW.buyer_phone IS DISTINCT FROM OLD.buyer_phone OR
           NEW.source_attribution IS DISTINCT FROM OLD.source_attribution OR
           NEW.ticket_quantity IS DISTINCT FROM OLD.ticket_quantity OR
           NEW.created_at IS DISTINCT FROM OLD.created_at THEN
            RAISE EXCEPTION 'Core attribution and identity fields on converted buyer lead % are immutable', OLD.id
                USING ERRCODE = '22000';
        END IF;

        -- 3. first_converted_at is immutable once established
        IF OLD.first_converted_at IS NOT NULL AND 
           NEW.first_converted_at IS DISTINCT FROM OLD.first_converted_at THEN
            RAISE EXCEPTION 'first_converted_at on converted buyer lead % cannot be altered', OLD.id
                USING ERRCODE = '22000';
        END IF;

        -- 4. Conversion counter can only increment, never decrement
        IF NEW.conversion_count < OLD.conversion_count THEN
            RAISE EXCEPTION 'conversion_count on buyer lead % cannot decrease (current: %, attempted: %)',
                OLD.id, OLD.conversion_count, NEW.conversion_count
                USING ERRCODE = '22000';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_converted_buyer_referral ON public.buyer_referrals;
CREATE TRIGGER trg_protect_converted_buyer_referral
    BEFORE UPDATE ON public.buyer_referrals
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_converted_buyer_referral();

-- 11. Daily Aggregated Link Stats Table
CREATE TABLE IF NOT EXISTS public.referral_link_daily_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    volunteer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    referral_code VARCHAR(36) NOT NULL,
    stat_date DATE NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::DATE,
    raw_requests INTEGER NOT NULL DEFAULT 0 CHECK (raw_requests >= 0),
    tracked_visits INTEGER NOT NULL DEFAULT 0 CHECK (tracked_visits >= 0),
    unique_visitor_days INTEGER NOT NULL DEFAULT 0 CHECK (unique_visitor_days >= 0),
    bot_requests INTEGER NOT NULL DEFAULT 0 CHECK (bot_requests >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_referral_link_daily_stat UNIQUE (referral_code, stat_date)
);

CREATE INDEX IF NOT EXISTS idx_stats_volunteer_date 
ON public.referral_link_daily_stats (volunteer_id, stat_date DESC);

ALTER TABLE public.referral_link_daily_stats ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.referral_link_daily_stats FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.referral_link_daily_stats TO authenticated;
GRANT ALL ON public.referral_link_daily_stats TO service_role;

CREATE POLICY "Volunteers view own link stats"
ON public.referral_link_daily_stats FOR SELECT TO authenticated
USING (auth.uid() = volunteer_id OR public.is_admin());

-- 12. Transient Daily Visitors Table (30-day deduplication window)
CREATE TABLE IF NOT EXISTS public.referral_link_daily_visitors (
    referral_code VARCHAR(36) NOT NULL,
    stat_date DATE NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::DATE,
    visitor_hash VARCHAR(64) NOT NULL,
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_visit_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (referral_code, stat_date, visitor_hash)
);

CREATE INDEX IF NOT EXISTS idx_visitors_stat_date 
ON public.referral_link_daily_visitors (stat_date);

ALTER TABLE public.referral_link_daily_visitors ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.referral_link_daily_visitors FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.referral_link_daily_visitors TO service_role;

-- 13. Raw Link Request Telemetry (Top-of-funnel ingress)
CREATE OR REPLACE FUNCTION public.record_raw_link_request(
    p_referral_code VARCHAR(36),
    p_is_bot BOOLEAN DEFAULT FALSE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_clean_code VARCHAR(36);
    v_profile RECORD;
    v_today_utc DATE := (now() AT TIME ZONE 'UTC')::DATE;
BEGIN
    v_clean_code := UPPER(trim(COALESCE(p_referral_code, '')));

    SELECT id INTO v_profile
    FROM public.profiles
    WHERE lower(trim(referral_code)) = lower(trim(v_clean_code))
    LIMIT 1;

    IF v_profile.id IS NULL THEN
        RETURN;
    END IF;

    INSERT INTO public.referral_link_daily_stats (
        volunteer_id, referral_code, stat_date, raw_requests, bot_requests
    ) VALUES (
        v_profile.id, v_clean_code, v_today_utc,
        1,
        CASE WHEN p_is_bot THEN 1 ELSE 0 END
    )
    ON CONFLICT (referral_code, stat_date) DO UPDATE
    SET raw_requests = public.referral_link_daily_stats.raw_requests + 1,
        bot_requests = public.referral_link_daily_stats.bot_requests + CASE WHEN p_is_bot THEN 1 ELSE 0 END,
        updated_at = now();
END;
$$;

-- 14. Track Landing Page Visit (Client Beacon, 30-min Sliding Window)
CREATE OR REPLACE FUNCTION public.track_landing_page_visit(
    p_referral_code VARCHAR(36),
    p_visitor_hash VARCHAR(64)
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_clean_code VARCHAR(36);
    v_profile RECORD;
    v_today_utc DATE := (now() AT TIME ZONE 'UTC')::DATE;
    v_rows_inserted INTEGER := 0;
    v_rows_updated INTEGER := 0;
    v_rate_limit_passed BOOLEAN := FALSE;
    v_is_new_unique BOOLEAN := FALSE;
BEGIN
    v_clean_code := UPPER(trim(COALESCE(p_referral_code, '')));

    IF p_visitor_hash IS NULL OR p_visitor_hash = '' THEN
        RETURN jsonb_build_object('success', false, 'error', 'MISSING_VISITOR_HASH');
    END IF;

    SELECT id INTO v_profile
    FROM public.profiles
    WHERE lower(trim(referral_code)) = lower(trim(v_clean_code))
    LIMIT 1;

    IF v_profile.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'INVALID_REFERRAL_CODE');
    END IF;

    -- Atomic Insert-on-Conflict
    INSERT INTO public.referral_link_daily_visitors (
        referral_code, stat_date, visitor_hash, first_seen_at, last_visit_at
    ) VALUES (
        v_clean_code, v_today_utc, p_visitor_hash, now(), now()
    )
    ON CONFLICT (referral_code, stat_date, visitor_hash) DO NOTHING;

    GET DIAGNOSTICS v_rows_inserted = ROW_COUNT;

    IF v_rows_inserted = 1 THEN
        v_is_new_unique := TRUE;
        v_rate_limit_passed := TRUE;
    ELSE
        -- Returning visitor: check 30-minute sliding window
        UPDATE public.referral_link_daily_visitors
        SET last_visit_at = now()
        WHERE referral_code = v_clean_code
          AND stat_date = v_today_utc
          AND visitor_hash = p_visitor_hash
          AND last_visit_at < (now() - INTERVAL '30 minutes');

        GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
        v_rate_limit_passed := (v_rows_updated = 1);
    END IF;

    IF v_rate_limit_passed OR v_is_new_unique THEN
        INSERT INTO public.referral_link_daily_stats (
            volunteer_id, referral_code, stat_date,
            tracked_visits,
            unique_visitor_days
        ) VALUES (
            v_profile.id, v_clean_code, v_today_utc,
            CASE WHEN v_rate_limit_passed THEN 1 ELSE 0 END,
            CASE WHEN v_is_new_unique THEN 1 ELSE 0 END
        )
        ON CONFLICT (referral_code, stat_date) DO UPDATE
        SET tracked_visits = public.referral_link_daily_stats.tracked_visits + EXCLUDED.tracked_visits,
            unique_visitor_days = public.referral_link_daily_stats.unique_visitor_days + EXCLUDED.unique_visitor_days,
            updated_at = now();
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'rate_limit_passed', v_rate_limit_passed,
        'new_daily_unique', v_is_new_unique
    );
END;
$$;

-- 15. Capture Buyer Referral (Lead Ingress with Advisory Lock & Multi-Touch Audit)
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

    -- 2. Rolling Rate Limit Check
    v_rate_res := public.check_and_record_rate_limit(
        p_ip_hash, p_email_hash, 'lead_capture', 10, 5, INTERVAL '1 hour'
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

    -- 4. Transactional Advisory Lock on Buyer Email
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

-- 16. Convert Buyer Lead (Admin Workflow Linking Lead to Approved Ticket Claim)
CREATE OR REPLACE FUNCTION public.convert_buyer_lead(
    p_buyer_referral_id UUID,
    p_referral_id UUID,
    p_attribution_resolution TEXT DEFAULT 'match',
    p_force_email_override BOOLEAN DEFAULT FALSE,
    p_admin_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_admin_id UUID := auth.uid();
    v_lead RECORD;
    v_claim RECORD;
    v_credited_id UUID;
    v_conversion_id UUID;
    v_email_mismatch BOOLEAN := FALSE;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Administrative privilege required' USING ERRCODE = '42501';
    END IF;

    -- 1. Input Validation
    IF p_buyer_referral_id IS NULL THEN
        RAISE EXCEPTION 'p_buyer_referral_id cannot be NULL';
    END IF;

    IF p_referral_id IS NULL THEN
        RAISE EXCEPTION 'p_referral_id cannot be NULL';
    END IF;

    IF p_attribution_resolution IS NULL OR p_attribution_resolution NOT IN ('match', 'award_to_referrer', 'award_to_claimant') THEN
        RAISE EXCEPTION 'Invalid p_attribution_resolution: %. Must be match, award_to_referrer, or award_to_claimant.', p_attribution_resolution;
    END IF;

    -- Lock lead row
    SELECT * INTO v_lead
    FROM public.buyer_referrals
    WHERE id = p_buyer_referral_id
    FOR UPDATE;

    IF v_lead.id IS NULL THEN
        RAISE EXCEPTION 'Buyer lead not found: %', p_buyer_referral_id;
    END IF;

    IF v_lead.status = 'expired' THEN
        RAISE EXCEPTION 'Cannot convert an expired lead. Reopen lead before conversion.';
    END IF;

    -- Lock ticket claim row
    SELECT * INTO v_claim
    FROM public.referrals
    WHERE id = p_referral_id
    FOR UPDATE;

    IF v_claim.id IS NULL THEN
        RAISE EXCEPTION 'Ticket claim not found: %', p_referral_id;
    END IF;

    IF v_claim.status <> 'approved' THEN
        RAISE EXCEPTION 'Ticket claim must be approved prior to conversion. Current status: %', v_claim.status;
    END IF;

    IF EXISTS (SELECT 1 FROM public.lead_claim_conversions WHERE referral_id = p_referral_id) THEN
        RAISE EXCEPTION 'Ticket claim % has already been converted against a lead', p_referral_id;
    END IF;

    -- 2. NULL-SAFE EMAIL VERIFICATION
    IF v_claim.buyer_email_normalized IS DISTINCT FROM v_lead.buyer_email_normalized THEN
        v_email_mismatch := TRUE;
        
        IF p_force_email_override IS NOT TRUE THEN
            RAISE EXCEPTION 'Buyer email mismatch: Claim email (%) is distinct from Lead email (%). Pass p_force_email_override=TRUE to override.',
                COALESCE(v_claim.buyer_email_normalized, 'NULL'), v_lead.buyer_email_normalized;
        END IF;

        IF p_admin_notes IS NULL OR trim(p_admin_notes) = '' THEN
            RAISE EXCEPTION 'Admin notes explaining the email mismatch override are strictly mandatory.';
        END IF;

        -- Audit Email Override Event
        INSERT INTO public.audit_logs (
            actor_id,
            referral_id,
            action,
            previous_status,
            new_status,
            notes
        ) VALUES (
            v_admin_id,
            p_referral_id,
            'OVERRIDE_EMAIL_MISMATCH',
            v_claim.status,
            v_claim.status,
            format('OVERRIDE_EMAIL_MISMATCH: Lead %s (email: %s) converted to Claim %s (email: %s, claimant: %s) by Admin %s. Reason: %s',
                p_buyer_referral_id, v_lead.buyer_email_normalized, p_referral_id, 
                COALESCE(v_claim.buyer_email_normalized, 'NULL'), v_claim.volunteer_id, v_admin_id, p_admin_notes)
        );
    END IF;

    -- 3. Resolve Attribution & Volunteer Reassignment
    IF v_lead.volunteer_id = v_claim.volunteer_id THEN
        v_credited_id := v_lead.volunteer_id;
    ELSE
        IF p_attribution_resolution = 'match' THEN
            RAISE EXCEPTION 'Attribution conflict: lead belongs to % but claim is by %. Explicit resolution required.',
                v_lead.volunteer_id, v_claim.volunteer_id;
        ELSIF p_attribution_resolution = 'award_to_referrer' THEN
            v_credited_id := v_lead.volunteer_id;
            
            -- Reassign claim in referrals so dynamic points compute for the referrer
            UPDATE public.referrals
            SET volunteer_id = v_lead.volunteer_id,
                updated_at = now()
            WHERE id = p_referral_id;

            -- Audit Attribution Reassignment
            INSERT INTO public.audit_logs (
                actor_id,
                referral_id,
                action,
                previous_status,
                new_status,
                notes
            ) VALUES (
                v_admin_id,
                p_referral_id,
                'ATTRIBUTION_REASSIGNMENT',
                v_claim.status,
                v_claim.status,
                format('ATTRIBUTION_REASSIGNMENT: Ticket claim %s reassigned from Original Claimant %s to Referrer %s by Admin %s. Lead ID: %s. Reason: %s',
                    p_referral_id, v_claim.volunteer_id, v_lead.volunteer_id, v_admin_id, p_buyer_referral_id, COALESCE(p_admin_notes, 'None'))
            );
        ELSIF p_attribution_resolution = 'award_to_claimant' THEN
            v_credited_id := v_claim.volunteer_id;
        END IF;
    END IF;

    -- 4. Insert Conversion Record
    INSERT INTO public.lead_claim_conversions (
        buyer_referral_id,
        referral_id,
        original_claimant_id,
        credited_volunteer_id,
        attribution_resolution,
        email_override_applied,
        admin_notes,
        converted_by
    ) VALUES (
        p_buyer_referral_id,
        p_referral_id,
        v_claim.volunteer_id,
        v_credited_id,
        p_attribution_resolution,
        v_email_mismatch,
        p_admin_notes,
        v_admin_id
    ) RETURNING id INTO v_conversion_id;

    -- 5. Update Lead Status & Transactional Counters
    UPDATE public.buyer_referrals
    SET status = 'converted',
        conversion_count = conversion_count + 1,
        first_converted_at = COALESCE(first_converted_at, now()),
        last_converted_at = now(),
        updated_at = now()
    WHERE id = p_buyer_referral_id;

    -- 6. Audit Lead Conversion Event
    INSERT INTO public.audit_logs (
        actor_id,
        referral_id,
        action,
        previous_status,
        new_status,
        notes
    ) VALUES (
        v_admin_id,
        p_referral_id,
        'LEAD_CONVERSION',
        v_claim.status,
        v_claim.status,
        format('Lead %s converted. Credited: %s. Resolution: %s. Notes: %s', 
            p_buyer_referral_id, v_credited_id, p_attribution_resolution, COALESCE(p_admin_notes, 'None'))
    );

    RETURN jsonb_build_object(
        'success', true,
        'conversion_id', v_conversion_id,
        'credited_volunteer_id', v_credited_id,
        'conversion_count', v_lead.conversion_count + 1
    );
END;
$$;

-- 17. Reopen Expired Buyer Lead (Administrative Extension)
CREATE OR REPLACE FUNCTION public.reopen_expired_buyer_lead(
    p_buyer_referral_id UUID,
    p_extension_hours INTEGER DEFAULT 48,
    p_admin_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_admin_id UUID := auth.uid();
    v_lead RECORD;
    v_active_conflict UUID;
    v_new_status TEXT;
    v_new_expires TIMESTAMPTZ;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Administrative privilege required' USING ERRCODE = '42501';
    END IF;

    IF p_buyer_referral_id IS NULL THEN
        RAISE EXCEPTION 'p_buyer_referral_id cannot be NULL';
    END IF;

    IF p_extension_hours IS NULL OR p_extension_hours < 1 OR p_extension_hours > 720 THEN
        RAISE EXCEPTION 'Extension hours must be an integer between 1 and 720 (max 30 days).';
    END IF;

    SELECT * INTO v_lead
    FROM public.buyer_referrals
    WHERE id = p_buyer_referral_id
    FOR UPDATE;

    IF v_lead.id IS NULL THEN
        RAISE EXCEPTION 'Buyer lead not found: %', p_buyer_referral_id;
    END IF;

    IF v_lead.status = 'pending_purchase' THEN
        RAISE EXCEPTION 'Lead % is active in pending_purchase status and has not expired.', p_buyer_referral_id;
    END IF;

    IF v_lead.status = 'converted' THEN
        RAISE EXCEPTION 'Lead % is already converted and remains active.', p_buyer_referral_id;
    END IF;

    -- Email Transaction Advisory Lock
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('buyer_lead:' || v_lead.buyer_email_normalized));

    -- Collision Check
    SELECT id INTO v_active_conflict
    FROM public.buyer_referrals
    WHERE buyer_email_normalized = v_lead.buyer_email_normalized
      AND status IN ('pending_purchase', 'converted')
      AND id <> v_lead.id
    LIMIT 1;

    IF v_active_conflict IS NOT NULL THEN
        RAISE EXCEPTION 'Cannot reopen lead %: an active lead (%) already exists for email %.',
            p_buyer_referral_id, v_active_conflict, v_lead.buyer_email_normalized;
    END IF;

    v_new_status := CASE WHEN v_lead.conversion_count > 0 THEN 'converted' ELSE 'pending_purchase' END;
    v_new_expires := now() + (p_extension_hours || ' hours')::INTERVAL;

    UPDATE public.buyer_referrals
    SET status = v_new_status,
        expires_at = v_new_expires,
        updated_at = now()
    WHERE id = p_buyer_referral_id;

    INSERT INTO public.audit_logs (actor_id, action, notes)
    VALUES (
        v_admin_id,
        'REOPEN_EXPIRED_LEAD',
        format('Lead %s reopened to %s until %s. Notes: %s', 
            p_buyer_referral_id, v_new_status, v_new_expires, COALESCE(p_admin_notes, 'None'))
    );

    RETURN jsonb_build_object(
        'success', true,
        'lead_id', p_buyer_referral_id,
        'status', v_new_status,
        'expires_at', v_new_expires
    );
END;
$$;

-- 18. Daily Referral Maintenance (Scheduled Retention and Expiration)
CREATE OR REPLACE FUNCTION public.run_daily_referral_maintenance()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_expired_leads INTEGER := 0;
    v_purged_leads INTEGER := 0;
    v_purged_hashes INTEGER := 0;
    v_purged_attempts INTEGER := 0;
BEGIN
    -- 1. Expire pending leads past their 48-hour window
    UPDATE public.buyer_referrals
    SET status = 'expired',
        updated_at = now()
    WHERE status = 'pending_purchase'
      AND expires_at < now();
    GET DIAGNOSTICS v_expired_leads = ROW_COUNT;

    -- 2. Automatic Retention: Purge unconverted expired leads older than 90 days
    DELETE FROM public.buyer_referrals
    WHERE status = 'expired'
      AND conversion_count = 0
      AND expires_at < (now() - INTERVAL '90 days');
    GET DIAGNOSTICS v_purged_leads = ROW_COUNT;

    IF v_purged_leads > 0 THEN
        INSERT INTO public.audit_logs (actor_id, action, notes)
        VALUES (
            NULL,
            'SCHEDULED_PURGE_EXPIRED_LEADS',
            format('Automated maintenance purged %s unconverted expired leads older than 90 days.', v_purged_leads)
        );
    END IF;

    -- 3. Purge transient visitor deduplication hashes older than 30 days
    DELETE FROM public.referral_link_daily_visitors
    WHERE stat_date < ((now() AT TIME ZONE 'UTC')::DATE - 30);
    GET DIAGNOSTICS v_purged_hashes = ROW_COUNT;

    -- 4. Purge rolling rate limit attempt records older than 48 hours
    DELETE FROM public.referral_submission_attempts
    WHERE attempted_at < (now() - INTERVAL '48 hours');
    GET DIAGNOSTICS v_purged_attempts = ROW_COUNT;

    RETURN jsonb_build_object(
        'success', true,
        'expired_leads', v_expired_leads,
        'purged_unconverted_leads', v_purged_leads,
        'purged_visitor_hashes', v_purged_hashes,
        'purged_rate_limit_attempts', v_purged_attempts
    );
END;
$$;

-- 19. Volunteer Referral Stats RPC (Caller Identity Verified via auth.uid())
CREATE OR REPLACE FUNCTION public.get_volunteer_referral_stats(
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
    all_time_verified_tickets BIGINT,
    all_time_official_points BIGINT,
    filtered_verified_tickets BIGINT,
    filtered_official_points BIGINT,
    total_raw_requests BIGINT,
    total_tracked_visits BIGINT,
    total_unique_visitor_days BIGINT,
    period_leads_captured BIGINT,
    period_leads_converted BIGINT,
    period_lead_approved_claims BIGINT,
    period_lead_verified_tickets BIGINT,
    cohort_leads_captured BIGINT,
    cohort_leads_converted BIGINT,
    cohort_lead_approved_claims BIGINT,
    cohort_lead_verified_tickets BIGINT,
    cohort_conversion_rate NUMERIC(5,2),
    cohort_tickets_per_lead NUMERIC(5,2)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_today_utc DATE := (now() AT TIME ZONE 'UTC')::DATE;
    v_start DATE := COALESCE(p_start_date, v_today_utc - 30);
    v_end DATE := COALESCE(p_end_date, v_today_utc);
    v_multiplier INTEGER;
    
    v_all_tix BIGINT := 0;
    v_all_pts BIGINT := 0;
    v_filt_tix BIGINT := 0;
    v_filt_pts BIGINT := 0;
    
    v_raw BIGINT := 0;
    v_visits BIGINT := 0;
    v_uniques BIGINT := 0;
    
    v_p_leads BIGINT := 0;
    v_p_conv_leads BIGINT := 0;
    v_p_claims BIGINT := 0;
    v_p_lead_tix BIGINT := 0;
    
    v_c_leads BIGINT := 0;
    v_c_conv_leads BIGINT := 0;
    v_c_claims BIGINT := 0;
    v_c_lead_tix BIGINT := 0;
    
    v_c_rate NUMERIC(5,2) := 0.00;
    v_c_tix_rate NUMERIC(5,2) := 0.00;
BEGIN
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
    END IF;

    IF v_start > v_end THEN
        RAISE EXCEPTION 'Invalid date range: start_date (%) cannot be after end_date (%).', v_start, v_end;
    END IF;

    v_multiplier := public.get_active_points_per_ticket();

    -- 1. All-time official metrics (Matches leaderboard 100%)
    SELECT COALESCE(SUM(ticket_quantity), 0)
    INTO v_all_tix
    FROM public.referrals
    WHERE volunteer_id = v_caller_id
      AND status = 'approved';
    v_all_pts := v_all_tix * v_multiplier;

    -- 2. Date-filtered official claim activity
    SELECT COALESCE(SUM(ticket_quantity), 0)
    INTO v_filt_tix
    FROM public.referrals
    WHERE volunteer_id = v_caller_id
      AND status = 'approved'
      AND (created_at AT TIME ZONE 'UTC')::DATE BETWEEN v_start AND v_end;
    v_filt_pts := v_filt_tix * v_multiplier;

    -- 3. Telemetry
    SELECT 
        COALESCE(SUM(raw_requests), 0),
        COALESCE(SUM(tracked_visits), 0),
        COALESCE(SUM(unique_visitor_days), 0)
    INTO v_raw, v_visits, v_uniques
    FROM public.referral_link_daily_stats
    WHERE volunteer_id = v_caller_id
      AND stat_date BETWEEN v_start AND v_end;

    -- 4. Period Conversion Activity
    SELECT COUNT(*)
    INTO v_p_leads
    FROM public.buyer_referrals
    WHERE volunteer_id = v_caller_id
      AND (created_at AT TIME ZONE 'UTC')::DATE BETWEEN v_start AND v_end;

    SELECT 
        COUNT(DISTINCT lcc.buyer_referral_id),
        COUNT(lcc.id),
        COALESCE(SUM(r.ticket_quantity), 0)
    INTO v_p_conv_leads, v_p_claims, v_p_lead_tix
    FROM public.lead_claim_conversions lcc
    JOIN public.referrals r ON r.id = lcc.referral_id
    WHERE lcc.credited_volunteer_id = v_caller_id
      AND r.status = 'approved'
      AND (lcc.converted_at AT TIME ZONE 'UTC')::DATE BETWEEN v_start AND v_end;

    -- 5. Cohort Conversion Metrics (First-Touch Attribution Dimension)
    SELECT COUNT(*)
    INTO v_c_leads
    FROM public.buyer_referrals
    WHERE volunteer_id = v_caller_id
      AND (created_at AT TIME ZONE 'UTC')::DATE BETWEEN v_start AND v_end;

    SELECT 
        COUNT(DISTINCT br.id),
        COUNT(lcc.id),
        COALESCE(SUM(r.ticket_quantity), 0)
    INTO v_c_conv_leads, v_c_claims, v_c_lead_tix
    FROM public.buyer_referrals br
    JOIN public.lead_claim_conversions lcc ON lcc.buyer_referral_id = br.id
    JOIN public.referrals r ON r.id = lcc.referral_id
    WHERE br.volunteer_id = v_caller_id
      AND (br.created_at AT TIME ZONE 'UTC')::DATE BETWEEN v_start AND v_end
      AND r.status = 'approved';

    IF v_c_leads > 0 THEN
        v_c_rate := ROUND((v_c_conv_leads::NUMERIC / v_c_leads::NUMERIC) * 100, 2);
    END IF;

    IF v_c_conv_leads > 0 THEN
        v_c_tix_rate := ROUND((v_c_lead_tix::NUMERIC / v_c_conv_leads::NUMERIC), 2);
    END IF;

    RETURN QUERY SELECT 
        v_all_tix, v_all_pts, v_filt_tix, v_filt_pts,
        v_raw, v_visits, v_uniques,
        v_p_leads, v_p_conv_leads, v_p_claims, v_p_lead_tix,
        v_c_leads, v_c_conv_leads, v_c_claims, v_c_lead_tix,
        v_c_rate, v_c_tix_rate;
END;
$$;

-- 20. Admin Referral Analytics RPC (Administrative Privilege Verified)
CREATE OR REPLACE FUNCTION public.get_admin_referral_analytics(
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
    volunteer_id UUID,
    full_name TEXT,
    referral_code VARCHAR(36),
    total_raw_requests BIGINT,
    total_tracked_visits BIGINT,
    total_unique_visitor_days BIGINT,
    period_leads_captured BIGINT,
    period_credited_conversions BIGINT,
    period_credited_tickets BIGINT,
    cohort_leads_captured BIGINT,
    cohort_leads_converted BIGINT,
    cohort_conversion_rate NUMERIC(5,2),
    cohort_verified_tickets BIGINT,
    all_time_verified_tickets BIGINT,
    all_time_official_points BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_today_utc DATE := (now() AT TIME ZONE 'UTC')::DATE;
    v_start DATE := COALESCE(p_start_date, v_today_utc - 30);
    v_end DATE := COALESCE(p_end_date, v_today_utc);
    v_multiplier INTEGER;
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'Administrative privilege required' USING ERRCODE = '42501';
    END IF;

    IF v_start > v_end THEN
        RAISE EXCEPTION 'Invalid date range: start_date (%) cannot be after end_date (%).', v_start, v_end;
    END IF;

    v_multiplier := public.get_active_points_per_ticket();

    RETURN QUERY
    WITH telemetry AS (
        SELECT 
            s.volunteer_id,
            SUM(s.raw_requests) AS sum_raw,
            SUM(s.tracked_visits) AS sum_visits,
            SUM(s.unique_visitor_days) AS sum_uniques
        FROM public.referral_link_daily_stats s
        WHERE s.stat_date BETWEEN v_start AND v_end
        GROUP BY s.volunteer_id
    ),
    period_leads AS (
        SELECT 
            br.volunteer_id,
            COUNT(br.id) AS count_leads
        FROM public.buyer_referrals br
        WHERE (br.created_at AT TIME ZONE 'UTC')::DATE BETWEEN v_start AND v_end
        GROUP BY br.volunteer_id
    ),
    period_convs AS (
        SELECT 
            lcc.credited_volunteer_id AS volunteer_id,
            COUNT(DISTINCT lcc.buyer_referral_id) AS count_conv_leads,
            SUM(r.ticket_quantity) AS sum_tickets
        FROM public.lead_claim_conversions lcc
        JOIN public.referrals r ON r.id = lcc.referral_id
        WHERE r.status = 'approved'
          AND (lcc.converted_at AT TIME ZONE 'UTC')::DATE BETWEEN v_start AND v_end
        GROUP BY lcc.credited_volunteer_id
    ),
    cohort_data AS (
        SELECT 
            br.volunteer_id,
            COUNT(DISTINCT br.id) AS c_captured,
            COUNT(DISTINCT CASE WHEN r.status = 'approved' THEN br.id END) AS c_converted,
            COALESCE(SUM(CASE WHEN r.status = 'approved' THEN r.ticket_quantity ELSE 0 END), 0) AS c_tickets
        FROM public.buyer_referrals br
        LEFT JOIN public.lead_claim_conversions lcc ON lcc.buyer_referral_id = br.id
        LEFT JOIN public.referrals r ON r.id = lcc.referral_id
        WHERE (br.created_at AT TIME ZONE 'UTC')::DATE BETWEEN v_start AND v_end
        GROUP BY br.volunteer_id
    ),
    all_time_claims AS (
        SELECT 
            r.volunteer_id,
            SUM(r.ticket_quantity) AS sum_all_tickets
        FROM public.referrals r
        WHERE r.status = 'approved'
        GROUP BY r.volunteer_id
    )
    SELECT 
        p.id AS volunteer_id,
        p.full_name,
        p.referral_code,
        COALESCE(t.sum_raw, 0) AS total_raw_requests,
        COALESCE(t.sum_visits, 0) AS total_tracked_visits,
        COALESCE(t.sum_uniques, 0) AS total_unique_visitor_days,
        COALESCE(pl.count_leads, 0) AS period_leads_captured,
        COALESCE(pc.count_conv_leads, 0) AS period_credited_conversions,
        COALESCE(pc.sum_tickets, 0) AS period_credited_tickets,
        COALESCE(cd.c_captured, 0) AS cohort_leads_captured,
        COALESCE(cd.c_converted, 0) AS cohort_leads_converted,
        CASE 
            WHEN COALESCE(cd.c_captured, 0) > 0 
            THEN ROUND((COALESCE(cd.c_converted, 0)::NUMERIC / cd.c_captured::NUMERIC) * 100, 2)
            ELSE 0.00
        END AS cohort_conversion_rate,
        COALESCE(cd.c_tickets, 0) AS cohort_verified_tickets,
        COALESCE(atc.sum_all_tickets, 0) AS all_time_verified_tickets,
        (COALESCE(atc.sum_all_tickets, 0) * v_multiplier)::BIGINT AS all_time_official_points
    FROM public.profiles p
    LEFT JOIN telemetry t ON t.volunteer_id = p.id
    LEFT JOIN period_leads pl ON pl.volunteer_id = p.id
    LEFT JOIN period_convs pc ON pc.volunteer_id = p.id
    LEFT JOIN cohort_data cd ON cd.volunteer_id = p.id
    LEFT JOIN all_time_claims atc ON atc.volunteer_id = p.id
    WHERE p.referral_code IS NOT NULL
    ORDER BY all_time_verified_tickets DESC, cohort_leads_converted DESC;
END;
$$;

-- 21. Function Permissions & Execution Grants
REVOKE EXECUTE ON FUNCTION public.generate_unique_referral_code FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_unique_referral_code TO service_role;

REVOKE EXECUTE ON FUNCTION public.check_and_record_rate_limit FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_and_record_rate_limit TO service_role;

REVOKE EXECUTE ON FUNCTION public.record_raw_link_request FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_raw_link_request TO service_role;

REVOKE EXECUTE ON FUNCTION public.track_landing_page_visit FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.track_landing_page_visit TO service_role;

REVOKE EXECUTE ON FUNCTION public.capture_buyer_referral FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.capture_buyer_referral TO service_role;

REVOKE EXECUTE ON FUNCTION public.run_daily_referral_maintenance FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_daily_referral_maintenance TO service_role;

REVOKE EXECUTE ON FUNCTION public.convert_buyer_lead FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.convert_buyer_lead TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.reopen_expired_buyer_lead FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reopen_expired_buyer_lead TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_volunteer_referral_stats FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_volunteer_referral_stats TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_admin_referral_analytics FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_referral_analytics TO authenticated, service_role;
