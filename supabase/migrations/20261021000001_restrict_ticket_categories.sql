-- ==============================================================================
-- TEDxGwarinpa Volunteer Ticket Sales Challenge (VolTex)
-- Migration: 20261021000001_restrict_ticket_categories.sql
-- ==============================================================================
-- Summary:
-- 1. Updates public.submit_referral(...) to enforce the two official ticket
--    categories: 'Regular Ticket' (₦10,000) and 'VIP Ticket' (₦20,000).
-- 2. Maintains full backward compatibility for existing records in public.referrals.
-- 3. Retains security hardening: SECURITY DEFINER, search_path = '', restricted
--    strictly to authenticated users.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.submit_referral(
    p_buyer_name TEXT,
    p_ticket_type TEXT,
    p_ticket_quantity INTEGER,
    p_order_reference TEXT DEFAULT NULL,
    p_buyer_email TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id UUID;
    v_referral RECORD;
    v_clean_name TEXT;
    v_clean_order_ref TEXT;
    v_clean_buyer_email TEXT;
    v_clean_ticket_type TEXT;
    v_constraint_name TEXT;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'AUTHENTICATION_REQUIRED: User must be signed in to submit a referral.';
    END IF;

    -- 1. Validate Buyer Name
    v_clean_name := CASE
        WHEN p_buyer_name IS NOT NULL AND pg_catalog.btrim(p_buyer_name) <> ''
        THEN pg_catalog.btrim(p_buyer_name)
        ELSE NULL
    END;

    IF v_clean_name IS NULL THEN
        RAISE EXCEPTION 'INVALID_NAME: Buyer name is required.';
    END IF;

    -- 2. Validate Ticket Type (Strictly Regular Ticket and VIP Ticket)
    v_clean_ticket_type := CASE
        WHEN p_ticket_type IS NOT NULL AND pg_catalog.btrim(p_ticket_type) <> ''
        THEN pg_catalog.btrim(p_ticket_type)
        ELSE NULL
    END;

    IF v_clean_ticket_type IS NULL OR v_clean_ticket_type NOT IN (
        'Regular Ticket',
        'VIP Ticket'
    ) THEN
        RAISE EXCEPTION 'INVALID_TICKET_TYPE: Ticket type must be either "Regular Ticket" or "VIP Ticket".';
    END IF;

    -- 3. Validate Quantity Bounds (1 to 50)
    IF p_ticket_quantity IS NULL OR p_ticket_quantity < 1 OR p_ticket_quantity > 50 THEN
        RAISE EXCEPTION 'INVALID_QUANTITY: Ticket quantity must be between 1 and 50.';
    END IF;

    -- Clean optional inputs
    v_clean_order_ref := CASE
        WHEN p_order_reference IS NOT NULL AND pg_catalog.btrim(p_order_reference) <> ''
        THEN pg_catalog.btrim(p_order_reference)
        ELSE NULL
    END;

    v_clean_buyer_email := CASE
        WHEN p_buyer_email IS NOT NULL AND pg_catalog.btrim(p_buyer_email) <> ''
        THEN pg_catalog.btrim(p_buyer_email)
        ELSE NULL
    END;

    -- Insert new referral (protected by check_referral_duplicate trigger & unique index)
    INSERT INTO public.referrals (
        volunteer_id,
        buyer_name,
        ticket_type,
        ticket_quantity,
        order_reference,
        buyer_identifier,
        buyer_email,
        status
    ) VALUES (
        v_user_id,
        v_clean_name,
        v_clean_ticket_type,
        p_ticket_quantity,
        v_clean_order_ref,
        v_clean_order_ref,
        v_clean_buyer_email,
        'pending'
    )
    RETURNING * INTO v_referral;

    RETURN pg_catalog.jsonb_build_object(
        'success', TRUE,
        'referral', pg_catalog.jsonb_build_object(
            'id', v_referral.id,
            'volunteer_id', v_referral.volunteer_id,
            'buyer_name', v_referral.buyer_name,
            'ticket_type', v_referral.ticket_type,
            'ticket_quantity', v_referral.ticket_quantity,
            'order_reference', v_referral.order_reference,
            'buyer_identifier', v_referral.buyer_identifier,
            'buyer_email', v_referral.buyer_email,
            'status', v_referral.status,
            'flagged_duplicate', v_referral.flagged_duplicate,
            'duplicate_reason', v_referral.duplicate_reason,
            'created_at', v_referral.created_at
        )
    );
EXCEPTION
    WHEN unique_violation THEN
        GET STACKED DIAGNOSTICS v_constraint_name = CONSTRAINT_NAME;
        IF v_constraint_name = 'idx_unique_all_order_reference'
           OR SQLERRM LIKE '%DUPLICATE_ORDER_REFERENCE%'
           OR SQLERRM LIKE '%idx_unique_all_order_reference%' THEN
            RETURN pg_catalog.jsonb_build_object(
                'success', FALSE,
                'error_code', 'DUPLICATE_ORDER_REFERENCE',
                'message', 'This order reference has already been submitted by another claim and cannot be credited again.'
            );
        ELSE
            -- Re-raise unexpected unique violation without misreporting
            RAISE;
        END IF;
    WHEN OTHERS THEN
        IF SQLERRM LIKE '%DUPLICATE_ORDER_REFERENCE%' THEN
            RETURN pg_catalog.jsonb_build_object(
                'success', FALSE,
                'error_code', 'DUPLICATE_ORDER_REFERENCE',
                'message', 'This order reference has already been submitted by another claim and cannot be credited again.'
            );
        ELSE
            -- Re-raise unexpected database errors
            RAISE;
        END IF;
END;
$$;

-- Ensure execution permissions
REVOKE ALL ON FUNCTION public.submit_referral(TEXT, TEXT, INTEGER, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_referral(TEXT, TEXT, INTEGER, TEXT, TEXT) TO authenticated;
