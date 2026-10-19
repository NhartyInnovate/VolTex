-- ==============================================================================
-- TEDxGwarinpa Volunteer Ticket Sales Challenge (VolTex)
-- Migration: 20261019000003_enforce_duplicate_approval_notes.sql
-- ==============================================================================
-- Summary of Safeguard:
-- 1. Database-Level Invariant for Duplicate Referral Approval:
--    - When a referral is flagged as a duplicate (flagged_duplicate = TRUE),
--      it CANNOT be moved to status = 'approved' without a non-empty
--      admin_notes verification rationale of at least 5 characters.
--    - Normal referrals (flagged_duplicate = FALSE) can be approved without notes.
-- 2. Mechanism:
--    - Implements a PostgreSQL CHECK constraint: check_duplicate_approval_notes
--    - Re-evaluates on any INSERT or UPDATE against public.referrals.
--    - Works in tandem with trg_audit_referral_status, guaranteeing that every
--      duplicate-flagged approval has its explanatory note permanently recorded
--      in public.audit_logs.
-- 3. Data-Preservation & Idempotency:
--    - Uses ALTER TABLE public.referrals DROP CONSTRAINT IF EXISTS ...
--      followed by ADD CONSTRAINT ...
--    - Preserves all existing records, test claims, statuses, duplicate flags,
--      and audit logs without modification.
-- ==============================================================================

DO $$
BEGIN
    -- Drop constraint if it already exists to allow safe rerunning
    ALTER TABLE public.referrals
        DROP CONSTRAINT IF EXISTS check_duplicate_approval_notes;

    -- Add the database-level check constraint
    ALTER TABLE public.referrals
        ADD CONSTRAINT check_duplicate_approval_notes
        CHECK (
            status <> 'approved'
            OR flagged_duplicate = FALSE
            OR (
                admin_notes IS NOT NULL 
                AND pg_catalog.length(pg_catalog.btrim(admin_notes)) >= 5
            )
        );
END $$;
