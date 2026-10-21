-- ==============================================================================
-- TEDxGwarinpa Volunteer Ticket Sales Challenge (VolTex)
-- Migration: 20261021000003_volunteer_decision_notifications.sql
-- ==============================================================================
-- Summary:
-- 1. Creates public.create_volunteer_decision_notification(p_referral_id UUID)
-- 2. Enforces SECURITY DEFINER with search_path = '' for search-path isolation.
-- 3. Restricts execution: caller must be authenticated and have role = 'admin'.
-- 4. Authoritatively derives points and rank from database functions:
--    - Approval: points = ticket_quantity * public.get_active_points_per_ticket()
--    - Rejection: points = 0
--    - Cumulative points and dense rank from public.get_public_leaderboard()
-- 5. Stable deduplication key: 'referral_decision_' || referral_id || '_' || status
--    with ON CONFLICT (user_id, deduplication_key) DO NOTHING to prevent duplicate alerts.
-- 6. Fully additive: zero modification or deletion of existing records.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.create_volunteer_decision_notification(
    p_referral_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_calling_user_id UUID;
    v_referral RECORD;
    v_status_text TEXT;
    v_active_pts_per_ticket INT;
    v_points_earned INT := 0;
    v_leaderboard RECORD;
    v_title TEXT;
    v_message TEXT;
    v_link TEXT;
    v_dedup_key TEXT;
    v_metadata JSONB;
    v_notification_id UUID;
BEGIN
    -- 1. Verify caller authentication
    v_calling_user_id := auth.uid();
    IF v_calling_user_id IS NULL THEN
        RAISE EXCEPTION 'AUTHENTICATION_REQUIRED: Caller must be signed in.';
    END IF;

    -- 2. Verify caller has administrator permissions
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = v_calling_user_id AND role = 'admin'
    ) THEN
        RAISE EXCEPTION 'FORBIDDEN: Only administrators can dispatch volunteer decision notifications.';
    END IF;

    -- 3. Fetch authoritative referral record
    SELECT
        id,
        volunteer_id,
        buyer_name,
        ticket_type,
        ticket_quantity,
        order_reference,
        status,
        admin_notes,
        created_at
    INTO v_referral
    FROM public.referrals
    WHERE id = p_referral_id;

    IF v_referral.id IS NULL THEN
        RETURN pg_catalog.jsonb_build_object(
            'success', FALSE,
            'message', 'Referral not found.'
        );
    END IF;

    v_status_text := v_referral.status::TEXT;

    -- 4. Guard: Referral must be in a decided state (approved or rejected)
    IF v_status_text NOT IN ('approved', 'rejected') THEN
        RETURN pg_catalog.jsonb_build_object(
            'success', FALSE,
            'message', 'Referral is still pending. Notifications are created only after approval or rejection.'
        );
    END IF;

    -- 5. Fetch authoritative scoring configuration & volunteer cumulative standings
    v_active_pts_per_ticket := public.get_active_points_per_ticket();

    SELECT
        points,
        rank
    INTO v_leaderboard
    FROM public.get_public_leaderboard()
    WHERE volunteer_id = v_referral.volunteer_id;

    -- 6. Construct authoritative notification payload
    v_dedup_key := 'referral_decision_' || v_referral.id::TEXT || '_' || v_status_text;
    v_link := '/dashboard?tab=referrals&id=' || v_referral.id::TEXT;

    IF v_status_text = 'approved' THEN
        v_points_earned := v_referral.ticket_quantity * v_active_pts_per_ticket;
        v_title := 'Referral Claim Approved';
        v_message := 'Your claim for ' || v_referral.ticket_quantity::TEXT || 'x ' || v_referral.ticket_type
                     || ' was verified (+ ' || v_points_earned::TEXT || ' pts).';

        IF v_leaderboard.points IS NOT NULL THEN
            v_message := v_message || ' Total Score: ' || v_leaderboard.points::TEXT || ' pts';
            IF v_leaderboard.rank IS NOT NULL THEN
                v_message := v_message || ' (Rank #' || v_leaderboard.rank::TEXT || ')';
            END IF;
            v_message := v_message || '.';
        END IF;

        v_metadata := pg_catalog.jsonb_build_object(
            'referral_id', v_referral.id,
            'decision', 'approved',
            'ticket_type', v_referral.ticket_type,
            'ticket_quantity', v_referral.ticket_quantity,
            'order_reference', v_referral.order_reference,
            'points_earned', v_points_earned,
            'cumulative_points', COALESCE(v_leaderboard.points, v_points_earned),
            'rank', v_leaderboard.rank,
            'admin_notes', v_referral.admin_notes
        );

        INSERT INTO public.notifications (
            user_id,
            title,
            message,
            type,
            link_url,
            metadata,
            deduplication_key,
            is_read
        ) VALUES (
            v_referral.volunteer_id,
            v_title,
            v_message,
            'referral_approved',
            v_link,
            v_metadata,
            v_dedup_key,
            FALSE
        )
        ON CONFLICT (user_id, deduplication_key) DO NOTHING
        RETURNING id INTO v_notification_id;

    ELSE
        -- Rejection branch
        v_points_earned := 0;
        v_title := 'Referral Claim Declined';
        v_message := 'Your claim for ' || v_referral.ticket_quantity::TEXT || 'x ' || v_referral.ticket_type
                     || ' was declined.';

        IF v_referral.admin_notes IS NOT NULL AND pg_catalog.btrim(v_referral.admin_notes) <> '' THEN
            v_message := v_message || ' Reason: ' || pg_catalog.btrim(v_referral.admin_notes);
        ELSE
            v_message := v_message || ' Reason: Declined: Record does not match Meeteor Hub attendee list';
        END IF;

        v_metadata := pg_catalog.jsonb_build_object(
            'referral_id', v_referral.id,
            'decision', 'rejected',
            'ticket_type', v_referral.ticket_type,
            'ticket_quantity', v_referral.ticket_quantity,
            'order_reference', v_referral.order_reference,
            'points_earned', 0,
            'admin_notes', COALESCE(v_referral.admin_notes, 'Declined: Record does not match Meeteor Hub attendee list')
        );

        INSERT INTO public.notifications (
            user_id,
            title,
            message,
            type,
            link_url,
            metadata,
            deduplication_key,
            is_read
        ) VALUES (
            v_referral.volunteer_id,
            v_title,
            v_message,
            'referral_rejected',
            v_link,
            v_metadata,
            v_dedup_key,
            FALSE
        )
        ON CONFLICT (user_id, deduplication_key) DO NOTHING
        RETURNING id INTO v_notification_id;

    END IF;

    RETURN pg_catalog.jsonb_build_object(
        'success', TRUE,
        'decision', v_status_text,
        'volunteer_id', v_referral.volunteer_id,
        'points_earned', v_points_earned,
        'deduplication_key', v_dedup_key,
        'notification_created', (v_notification_id IS NOT NULL)
    );
END;
$$;

-- Secure the function permissions
REVOKE ALL ON FUNCTION public.create_volunteer_decision_notification(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_volunteer_decision_notification(UUID) TO authenticated;
