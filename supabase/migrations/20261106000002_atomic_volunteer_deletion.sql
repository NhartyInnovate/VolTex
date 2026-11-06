-- ==============================================================================
-- Migration: 20261106000002_atomic_volunteer_deletion.sql
-- Description: Atomic Database-Side Volunteer Account Deletion Operation
--              Addresses Codex P2 & Phase 32/34 findings on partial cleanup
--              and authorization spoofing vulnerabilities.
--              Guarantees all-or-nothing transactional deletion under an
--              exclusive row-level lock (FOR UPDATE), preventing concurrent
--              lead creation while checking all restricted foreign keys.
-- ==============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.admin_delete_volunteer_account(
    p_target_user_id UUID,
    p_calling_admin_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_target_profile RECORD;
    v_buyer_leads_count INTEGER := 0;
    v_touches_count INTEGER := 0;
    v_conversions_count INTEGER := 0;
    v_converted_referrals_count INTEGER := 0;
    v_total_restricted INTEGER := 0;
    v_referral_count INTEGER := 0;
    v_admin_count INTEGER := 0;
    v_caller_is_admin BOOLEAN := FALSE;
    v_has_auth_user BOOLEAN := FALSE;
    v_detail_parts TEXT[] := ARRAY[]::TEXT[];
    v_acting_admin_id UUID;
BEGIN
    -- -------------------------------------------------------------------------
    -- 1. Security & Authorization Check (Phase 35 Hardened)
    -- -------------------------------------------------------------------------
    -- Rule: Never trust a caller-supplied UUID as proof of administrator identity.
    -- Strict Context Evaluation:
    -- A) service_role execution:
    --    Trusted server-side background/API processes using the service role key.
    --    We explicitly verify the PostgreSQL role is 'service_role'.
    --    p_calling_admin_id is accepted strictly for audit logging and self-deletion checks.
    -- B) authenticated execution:
    --    Must have a valid JWT with non-null auth.uid().
    --    If p_calling_admin_id is provided, it MUST strictly match auth.uid() (prevent impersonation).
    --    The profile for auth.uid() MUST exist and have role = 'admin'.
    -- C) All other contexts (anonymous, public, untrusted roles): REJECTED.

    IF current_setting('role', true) = 'service_role' THEN
        v_caller_is_admin := TRUE;
        v_acting_admin_id := p_calling_admin_id;
    ELSIF auth.uid() IS NOT NULL THEN
        -- If caller supplies p_calling_admin_id, enforce strict equality with verified session identity
        IF p_calling_admin_id IS NOT NULL AND p_calling_admin_id <> auth.uid() THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'UNAUTHORIZED',
                'message', 'Spoofing forbidden: caller identity does not match authenticated user.'
            );
        END IF;

        -- Verify that the authenticated session identity actually possesses admin privileges
        SELECT EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'admin'
        ) INTO v_caller_is_admin;
        v_acting_admin_id := auth.uid();
    ELSE
        v_caller_is_admin := FALSE;
    END IF;

    IF NOT v_caller_is_admin THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'UNAUTHORIZED',
            'message', 'Administrator privileges are required to perform this operation.'
        );
    END IF;

    -- -------------------------------------------------------------------------
    -- 2. Input Validation
    -- -------------------------------------------------------------------------
    IF p_target_user_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'INVALID_TARGET_USER',
            'message', 'Missing or invalid target user ID.'
        );
    END IF;

    -- -------------------------------------------------------------------------
    -- 3. Self-Deletion Prevention
    -- -------------------------------------------------------------------------
    -- Block deletion if the verified caller or the acting admin is the target user
    IF (v_acting_admin_id IS NOT NULL AND v_acting_admin_id = p_target_user_id) OR
       (auth.uid() IS NOT NULL AND auth.uid() = p_target_user_id) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'CANNOT_DELETE_SELF',
            'message', 'Operation forbidden: You cannot delete your own administrator account.'
        );
    END IF;

    -- -------------------------------------------------------------------------
    -- 4. Exclusively Lock Target Profile Row
    -- -------------------------------------------------------------------------
    -- In PostgreSQL, foreign-key checks during concurrent inserts (e.g. in
    -- capture_buyer_referral) acquire a FOR KEY SHARE lock on the referenced
    -- parent row in public.profiles.
    -- Acquiring FOR UPDATE here creates a mutual conflict with FOR KEY SHARE,
    -- forcing any concurrent referral capture to wait until this transaction
    -- finishes (commit or rollback).
    SELECT id, role, full_name, volunteer_team, referral_code
    INTO v_target_profile
    FROM public.profiles
    WHERE id = p_target_user_id
    FOR UPDATE;

    SELECT EXISTS (
        SELECT 1 FROM auth.users WHERE id = p_target_user_id
    ) INTO v_has_auth_user;

    IF v_target_profile.id IS NULL AND NOT v_has_auth_user THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'USER_NOT_FOUND',
            'message', 'The target user does not exist.'
        );
    END IF;

    -- -------------------------------------------------------------------------
    -- 5. Last Administrator Guard
    -- -------------------------------------------------------------------------
    IF v_target_profile.role = 'admin' THEN
        SELECT count(*) INTO v_admin_count
        FROM public.profiles
        WHERE role = 'admin';

        IF v_admin_count <= 1 THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'CANNOT_DELETE_LAST_ADMIN',
                'message', 'Operation forbidden: Cannot delete the last remaining administrator account.'
            );
        END IF;
    END IF;

    -- -------------------------------------------------------------------------
    -- 6. Check Restrictive Foreign-Key Relationships
    -- -------------------------------------------------------------------------
    -- Under the FOR UPDATE lock on public.profiles, no new foreign-key child
    -- records can be inserted concurrently.
    -- 6.1 Direct buyer leads (ON DELETE RESTRICT on profiles.id)
    SELECT count(*) INTO v_buyer_leads_count
    FROM public.buyer_referrals
    WHERE volunteer_id = p_target_user_id;

    -- 6.2 Secondary referral touches (ON DELETE RESTRICT on profiles.id)
    SELECT count(*) INTO v_touches_count
    FROM public.buyer_referral_touches
    WHERE subsequent_volunteer_id = p_target_user_id;

    -- 6.3 Conversions credited or claimed (ON DELETE RESTRICT on profiles.id)
    SELECT count(*) INTO v_conversions_count
    FROM public.lead_claim_conversions
    WHERE credited_volunteer_id = p_target_user_id
       OR original_claimant_id = p_target_user_id;

    -- 6.4 Converted claims linked to legacy referrals (ON DELETE RESTRICT on referrals.id)
    SELECT count(*) INTO v_converted_referrals_count
    FROM public.lead_claim_conversions lcc
    JOIN public.referrals r ON r.id = lcc.referral_id
    WHERE r.volunteer_id = p_target_user_id;

    v_total_restricted := v_buyer_leads_count + v_touches_count + v_conversions_count + v_converted_referrals_count;

    IF v_total_restricted > 0 THEN
        IF v_buyer_leads_count > 0 THEN
            v_detail_parts := array_append(v_detail_parts, v_buyer_leads_count || ' active or historical buyer lead(s)');
        END IF;
        IF v_touches_count > 0 THEN
            v_detail_parts := array_append(v_detail_parts, v_touches_count || ' referral touch(es)');
        END IF;
        IF v_conversions_count > 0 THEN
            v_detail_parts := array_append(v_detail_parts, v_conversions_count || ' lead conversion record(s)');
        END IF;
        IF v_converted_referrals_count > 0 THEN
            v_detail_parts := array_append(v_detail_parts, v_converted_referrals_count || ' converted referral claim(s)');
        END IF;

        RETURN jsonb_build_object(
            'success', false,
            'error', 'HAS_DEPENDENT_BUYER_LEADS',
            'buyer_leads_count', v_buyer_leads_count,
            'touches_count', v_touches_count,
            'conversions_count', v_conversions_count,
            'converted_referrals_count', v_converted_referrals_count,
            'message', format('Cannot delete volunteer "%s": this volunteer is associated with %s. All buyer leads and associated attribution must be resolved or reassigned before deleting this account.',
                              COALESCE(v_target_profile.full_name, p_target_user_id::text),
                              array_to_string(v_detail_parts, ' and '))
        );
    END IF;

    -- -------------------------------------------------------------------------
    -- 7. Count Dependent Referrals for Logging
    -- -------------------------------------------------------------------------
    SELECT count(*) INTO v_referral_count
    FROM public.referrals
    WHERE volunteer_id = p_target_user_id;

    -- -------------------------------------------------------------------------
    -- 8. Record Administrative Audit Log Event Inside Transaction
    -- -------------------------------------------------------------------------
    INSERT INTO public.audit_logs (actor_id, action, notes)
    VALUES (
        v_acting_admin_id,
        'ADMIN_USER_DELETED',
        format('Administrator %s deleted user %s (%s). Cascaded %s referral(s).',
               COALESCE(v_acting_admin_id::text, 'system'),
               p_target_user_id::text,
               COALESCE(v_target_profile.role::text, 'volunteer'),
               v_referral_count::text)
    );

    -- -------------------------------------------------------------------------
    -- 9. Atomic Cascading Deletion
    -- -------------------------------------------------------------------------
    -- Deleting auth.users automatically triggers ON DELETE CASCADE in PostgreSQL for:
    --   - public.profiles (via profiles_id_fkey)
    --   - public.referrals (via referrals_volunteer_id_fkey)
    --   - public.notifications (via notifications_user_id_fkey)
    --   - public.referral_link_daily_stats (via referral_link_daily_stats_volunteer_id_fkey)
    -- And triggers ON DELETE SET NULL for:
    --   - public.audit_logs.referral_id
    --   - public.audit_logs.actor_id
    -- This guarantees full audit preservation while ensuring all-or-nothing rollback.
    IF v_has_auth_user THEN
        DELETE FROM auth.users WHERE id = p_target_user_id;
    ELSE
        DELETE FROM public.profiles WHERE id = p_target_user_id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'deleted_referral_count', v_referral_count,
        'target_user_id', p_target_user_id,
        'target_full_name', v_target_profile.full_name,
        'message', format('User %s was deleted successfully. Cascaded %s referral submission(s).',
                          COALESCE(v_target_profile.full_name, p_target_user_id::text),
                          v_referral_count)
    );
END;
$$;

-- Revoke execute from PUBLIC and client roles; grant strictly to service_role
REVOKE EXECUTE ON FUNCTION public.admin_delete_volunteer_account(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_volunteer_account(UUID, UUID) TO service_role;

COMMENT ON FUNCTION public.admin_delete_volunteer_account(UUID, UUID) IS
'Atomic administrator deletion workflow for volunteer accounts. Locks target profile with FOR UPDATE to prevent concurrent lead insertions, validates all restricted foreign keys, and executes cascading deletion in a single PostgreSQL transaction with full audit preservation.';

COMMIT;
