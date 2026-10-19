-- ==============================================================================
-- TEDxGwarinpa Volunteer Ticket Sales Challenge (VolTex)
-- Migration: 20261019000002_harden_duplicate_detection.sql
-- ==============================================================================
-- Summary of Fixes & Safe Data-Preservation Strategy:
-- 1. Separates buyer_email and order_reference on public.referrals.
--    - Adds buyer_email (TEXT) with normalized generated column buyer_email_normalized.
--    - Adds order_reference (TEXT) with normalized generated column order_reference_normalized.
--    - Fully preserves existing buyer_identifier column and its data.
-- 2. ORDER REFERENCE OPTIONALITY & SECURITY BOUNDARIES:
--    - order_reference is OPTIONAL at the schema level to permit referrals where an attendee
--      has not yet forwarded an official ticket ID or where tickets were claimed via email.
--    - ARCHITECTURAL LIMITATION: Referrals submitted without an order_reference (order_reference IS NULL)
--      CANNOT be protected by the unique order-reference index. Instead, they rely on
--      the trigger's email and name matching rules for duplicate detection, which flag them
--      for manual admin reconciliation before approval.
-- 3. SAFE DATA-PRESERVING BACKFILL (NO ERASURE, NO OVERWRITING):
--    - Copies email addresses to buyer_email ONLY where buyer_identifier matches a
--      standard email pattern (contains '@', has domain, no spaces) and buyer_email is empty.
--    - Crucially: DOES NOT erase or nullify buyer_identifier. Existing legacy records
--      retain their original buyer_identifier unchanged.
--    - Backfills order_reference ONLY for unambiguous order reference formats
--      (starts with 'MTR-', 'ORD-', or 'TCK-' without spaces or '@').
--    - Leaves ambiguous identifiers unmigrated in order_reference (NULL), allowing
--      safe manual review without corrupting data or triggering false unique collisions.
-- 4. INDEX COMPATIBILITY FIX:
--    - Drops legacy idx_unique_approved_buyer_identifier so multiple referrals
--      sharing a buyer email can both be approved without violating unique constraints.
-- 5. PREFLIGHT DUPLICATE CHECK:
--    - Checks ONLY order_reference_normalized for duplicate values.
-- 6. UNIQUE CONSTRAINT ON ORDER REFERENCES:
--    - Unique partial index on (order_reference_normalized) where non-null.
--    - Matching emails remain strictly an admin review flag (flagged_duplicate = TRUE)
--      and are NEVER subject to any unique constraint.
-- 7. HARDENED TRIGGER FUNCTION check_referral_duplicate():
--    - Rejects duplicates ONLY when a non-empty order_reference matches another claim.
--    - Matching email sets review flag only.
--    - Empty search_path: SET search_path = ''
-- 8. SECURE RPC FUNCTION submit_referral(...):
--    - Explicitly validates buyer name (required, non-empty).
--    - Explicitly validates ticket type against known valid categories.
--    - Explicitly validates quantity (1 to 50).
--    - Specifically catches idx_unique_all_order_reference violations using
--      GET STACKED DIAGNOSTICS constraint_name, and re-raises all other database errors.
--    - Empty search_path: SET search_path = ''
--    - Granted strictly to authenticated users.
-- ==============================================================================

-- 1. Add dedicated columns for buyer_email and order_reference if not existing
ALTER TABLE public.referrals
    ADD COLUMN IF NOT EXISTS buyer_email TEXT,
    ADD COLUMN IF NOT EXISTS order_reference TEXT;

-- ==============================================================================
-- 2. SAFE DATA-PRESERVING BACKFILL STRATEGY
-- ==============================================================================
-- Case A: Legacy buyer_identifier is an email address.
-- Copy to buyer_email ONLY if buyer_email is currently null or empty.
-- PRESERVE buyer_identifier (do NOT nullify).
UPDATE public.referrals
SET buyer_email = pg_catalog.btrim(buyer_identifier)
WHERE (buyer_email IS NULL OR pg_catalog.btrim(buyer_email) = '')
  AND buyer_identifier IS NOT NULL
  AND pg_catalog.btrim(buyer_identifier) LIKE '%@%.%'
  AND pg_catalog.btrim(buyer_identifier) NOT LIKE '% %';

-- Case B: Legacy buyer_identifier is an unambiguous order reference.
-- Only migrate if it explicitly follows known order reference formats
-- (starts with 'MTR-', 'ORD-', or 'TCK-', without '@' or spaces).
-- Ambiguous identifiers (e.g. phone numbers or plain notes) remain NULL in order_reference.
UPDATE public.referrals
SET order_reference = pg_catalog.btrim(buyer_identifier)
WHERE (order_reference IS NULL OR pg_catalog.btrim(order_reference) = '')
  AND buyer_identifier IS NOT NULL
  AND pg_catalog.btrim(buyer_identifier) NOT LIKE '%@%'
  AND pg_catalog.btrim(buyer_identifier) NOT LIKE '% %'
  AND (
      pg_catalog.upper(pg_catalog.btrim(buyer_identifier)) LIKE 'MTR-%'
      OR pg_catalog.upper(pg_catalog.btrim(buyer_identifier)) LIKE 'ORD-%'
      OR pg_catalog.upper(pg_catalog.btrim(buyer_identifier)) LIKE 'TCK-%'
  );

-- 3. Generated normalized columns for high-performance indexing and querying
DO $$ BEGIN
    ALTER TABLE public.referrals
        ADD COLUMN buyer_email_normalized TEXT
        GENERATED ALWAYS AS (pg_catalog.lower(pg_catalog.btrim(buyer_email))) STORED;
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE public.referrals
        ADD COLUMN order_reference_normalized TEXT
        GENERATED ALWAYS AS (pg_catalog.lower(pg_catalog.btrim(order_reference))) STORED;
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

CREATE INDEX IF NOT EXISTS idx_referrals_buyer_email_norm 
    ON public.referrals (buyer_email_normalized);

CREATE INDEX IF NOT EXISTS idx_referrals_order_ref_norm 
    ON public.referrals (order_reference_normalized);

-- ==============================================================================
-- 4. PREFLIGHT DUPLICATE CHECK BEFORE CREATING UNIQUE INDEX
-- ==============================================================================
-- Checks ONLY actual migrated order references (ignoring buyer emails and legacy identifiers).
DO $$
DECLARE
    v_conflicts TEXT;
BEGIN
    SELECT pg_catalog.string_agg(pg_catalog.format('"%s" (%s occurrences)', order_ref, cnt), ', ')
    INTO v_conflicts
    FROM (
        SELECT order_reference_normalized AS order_ref, count(*) AS cnt
        FROM public.referrals
        WHERE order_reference_normalized IS NOT NULL 
          AND order_reference_normalized <> ''
        GROUP BY order_reference_normalized
        HAVING count(*) > 1
    ) sub;

    IF v_conflicts IS NOT NULL THEN
        RAISE EXCEPTION 'PREFLIGHT_CONFLICT: Cannot create unique index. Duplicate order references exist: %. Please inspect conflicting records in public.referrals and resolve them before applying this migration.', v_conflicts;
    END IF;
END $$;

-- ==============================================================================
-- 5. UNIQUE INDEX ON ORDER REFERENCES & SAFEGUARD PREVIOUS INDEX
-- ==============================================================================
-- Drop legacy approved buyer_identifier index so multiple referrals sharing an attendee
-- email or legacy identifier can be approved without constraint violations.
DROP INDEX IF EXISTS public.idx_unique_approved_buyer_identifier;

-- An order reference can only ever be submitted ONCE across the conference (across pending, approved, or rejected).
-- Multiple referrals with NULL order_reference (or matching emails with different order refs) are completely allowed.
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_all_order_reference
    ON public.referrals (order_reference_normalized)
    WHERE order_reference_normalized IS NOT NULL 
      AND order_reference_normalized <> '';

-- ==============================================================================
-- 6. HARDENED DUPLICATE DETECTION TRIGGER FUNCTION
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.check_referral_duplicate()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_norm_order_ref TEXT;
    v_norm_email TEXT;
    v_norm_name TEXT;
    matched_by_ref UUID;
    matched_by_email UUID;
    matched_by_name UUID;
BEGIN
    -- Synchronize backward-compatible buyer_identifier column strictly from order_reference if empty
    IF (NEW.buyer_identifier IS NULL OR pg_catalog.btrim(NEW.buyer_identifier) = '') THEN
        IF NEW.order_reference IS NOT NULL AND pg_catalog.btrim(NEW.order_reference) <> '' THEN
            NEW.buyer_identifier := pg_catalog.btrim(NEW.order_reference);
        END IF;
    END IF;

    -- Compute local normalized values directly from incoming inputs
    v_norm_order_ref := CASE 
        WHEN NEW.order_reference IS NOT NULL AND pg_catalog.btrim(NEW.order_reference) <> '' 
        THEN pg_catalog.lower(pg_catalog.btrim(NEW.order_reference))
        ELSE NULL
    END;

    v_norm_email := CASE 
        WHEN NEW.buyer_email IS NOT NULL AND pg_catalog.btrim(NEW.buyer_email) <> '' 
        THEN pg_catalog.lower(pg_catalog.btrim(NEW.buyer_email))
        ELSE NULL
    END;

    v_norm_name := CASE 
        WHEN NEW.buyer_name IS NOT NULL AND pg_catalog.btrim(NEW.buyer_name) <> '' 
        THEN pg_catalog.lower(pg_catalog.btrim(NEW.buyer_name))
        ELSE NULL
    END;

    -- Check 1: Exact order reference match across ANY existing referral (pending, approved, or rejected)
    -- Rejects duplicate ONLY when an actual non-empty order reference matches another claim
    IF v_norm_order_ref IS NOT NULL THEN
        SELECT id INTO matched_by_ref
        FROM public.referrals
        WHERE order_reference_normalized = v_norm_order_ref
          AND (NEW.id IS NULL OR id <> NEW.id)
        LIMIT 1;

        IF matched_by_ref IS NOT NULL THEN
            -- Reject insertion immediately at database level
            RAISE EXCEPTION 'DUPLICATE_ORDER_REFERENCE: This order reference has already been submitted.'
                USING ERRCODE = '23505', CONSTRAINT = 'idx_unique_all_order_reference';
        END IF;
    END IF;

    -- Check 2: Matching buyer email (flagged for admin review; allows legitimate repeat purchases)
    -- This is strictly a review flag, NEVER a unique constraint.
    IF v_norm_email IS NOT NULL THEN
        SELECT id INTO matched_by_email
        FROM public.referrals
        WHERE buyer_email_normalized = v_norm_email
          AND (NEW.id IS NULL OR id <> NEW.id)
        LIMIT 1;

        IF matched_by_email IS NOT NULL THEN
            NEW.flagged_duplicate := TRUE;
            NEW.duplicate_reason := 'Matching buyer email detected; requires organizer reconciliation';
            NEW.duplicate_source_id := matched_by_email;
            RETURN NEW;
        END IF;
    END IF;

    -- Check 3: Buyer name match flag (flagged for manual review only)
    IF v_norm_name IS NOT NULL THEN
        SELECT id INTO matched_by_name
        FROM public.referrals
        WHERE buyer_name_normalized = v_norm_name
          AND (NEW.id IS NULL OR id <> NEW.id)
        LIMIT 1;

        IF matched_by_name IS NOT NULL THEN
            NEW.flagged_duplicate := TRUE;
            NEW.duplicate_reason := 'Matching buyer name detected; requires organizer reconciliation';
            NEW.duplicate_source_id := matched_by_name;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_referral_duplicate ON public.referrals;
CREATE TRIGGER trg_check_referral_duplicate
    BEFORE INSERT OR UPDATE OF order_reference, buyer_email, buyer_identifier, buyer_name
    ON public.referrals
    FOR EACH ROW
    EXECUTE FUNCTION public.check_referral_duplicate();

REVOKE ALL ON FUNCTION public.check_referral_duplicate() FROM PUBLIC, anon;

-- ==============================================================================
-- 7. SECURE ATOMIC RPC FUNCTION FOR REFERRAL SUBMISSIONS
-- ==============================================================================
-- Empty search_path prevents search_path spoofing.
-- Fully schema-qualified calls to auth.uid(), public.referrals, and pg_catalog functions.
-- Specifically isolates idx_unique_all_order_reference and re-raises all other errors.
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

    -- 2. Validate Ticket Type
    v_clean_ticket_type := CASE 
        WHEN p_ticket_type IS NOT NULL AND pg_catalog.btrim(p_ticket_type) <> '' 
        THEN pg_catalog.btrim(p_ticket_type)
        ELSE NULL
    END;

    IF v_clean_ticket_type IS NULL OR v_clean_ticket_type NOT IN (
        'Standard Delegate',
        'VIP Experience',
        'Student Pass (Discounted)',
        'Executive / Patron'
    ) THEN
        RAISE EXCEPTION 'INVALID_TICKET_TYPE: Ticket type must be a recognized conference category.';
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

-- Security hardening: Revoke default execute from PUBLIC and anon; grant strictly to authenticated
REVOKE ALL ON FUNCTION public.submit_referral(TEXT, TEXT, INTEGER, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_referral(TEXT, TEXT, INTEGER, TEXT, TEXT) TO authenticated;
