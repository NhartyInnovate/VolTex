-- ==============================================================================
-- TEDxGwarinpa Volunteer Ticket Sales Challenge (VolTex)
-- Hardened Supabase PostgreSQL Schema & Security Policies
-- ==============================================================================

-- 1. Create Enums
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('volunteer', 'admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE referral_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Profiles Table (Private volunteer details, linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    volunteer_team TEXT NOT NULL,
    role user_role NOT NULL DEFAULT 'volunteer',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 3. Referrals Table
CREATE TABLE IF NOT EXISTS public.referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    volunteer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    buyer_name TEXT NOT NULL,
    buyer_name_normalized TEXT GENERATED ALWAYS AS (lower(trim(buyer_name))) STORED,
    ticket_type TEXT NOT NULL,
    ticket_quantity INTEGER NOT NULL DEFAULT 1 CHECK (ticket_quantity > 0 AND ticket_quantity <= 50),
    buyer_identifier TEXT, -- Order reference, Meeteor email, or phone where available
    buyer_identifier_normalized TEXT GENERATED ALWAYS AS (lower(trim(buyer_identifier))) STORED,
    status referral_status NOT NULL DEFAULT 'pending',
    admin_notes TEXT,
    flagged_duplicate BOOLEAN NOT NULL DEFAULT FALSE,
    duplicate_reason TEXT,
    duplicate_source_id UUID REFERENCES public.referrals(id) ON DELETE SET NULL,
    verified_at TIMESTAMPTZ,
    verified_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_referrals_volunteer_id ON public.referrals(volunteer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON public.referrals(status);
CREATE INDEX IF NOT EXISTS idx_referrals_identifier ON public.referrals(buyer_identifier_normalized);
CREATE INDEX IF NOT EXISTS idx_referrals_buyer_name ON public.referrals(buyer_name_normalized);

-- ==============================================================================
-- DATABASE-LEVEL DUPLICATE & DOUBLE-CREDITING SAFEGUARDS
-- ==============================================================================
-- Partial Unique Index: Guarantees that when a reliable purchase identifier is present,
-- it CANNOT be approved more than once, even under concurrent admin approval actions.
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_approved_buyer_identifier 
    ON public.referrals (buyer_identifier_normalized) 
    WHERE status = 'approved' 
      AND buyer_identifier_normalized IS NOT NULL 
      AND buyer_identifier_normalized <> '';

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

-- 4. Audit Log Table (Permanent, Non-Cascading Audit Trail)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    -- CRITICAL FIX: ON DELETE SET NULL prevents purging audit history if a referral is removed
    referral_id UUID REFERENCES public.referrals(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    previous_status referral_status,
    new_status referral_status,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 5. Helper Functions & Triggers

-- Check if current authenticated user is an administrator
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- Trigger: Automated duplicate detection on submission
-- Checks reliable identifiers first, then flags matching buyer names for manual admin review
CREATE OR REPLACE FUNCTION public.check_referral_duplicate()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    matched_by_id UUID;
    matched_by_name UUID;
BEGIN
    -- Check 1: Reliable identifier match (order ref / email / phone)
    IF NEW.buyer_identifier_normalized IS NOT NULL AND NEW.buyer_identifier_normalized <> '' THEN
        SELECT id INTO matched_by_id
        FROM public.referrals
        WHERE buyer_identifier_normalized = NEW.buyer_identifier_normalized
          AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
        LIMIT 1;

        IF matched_by_id IS NOT NULL THEN
            NEW.flagged_duplicate := TRUE;
            NEW.duplicate_reason := 'Purchase identifier matches existing referral claim';
            NEW.duplicate_source_id := matched_by_id;
            RETURN NEW;
        END IF;
    END IF;

    -- Check 2: Buyer name match flag (Meeteor Hub limited match, flagged for manual review only)
    IF NEW.buyer_name_normalized IS NOT NULL AND NEW.buyer_name_normalized <> '' THEN
        SELECT id INTO matched_by_name
        FROM public.referrals
        WHERE buyer_name_normalized = NEW.buyer_name_normalized
          AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
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
    BEFORE INSERT OR UPDATE OF buyer_identifier, buyer_name
    ON public.referrals
    FOR EACH ROW
    EXECUTE FUNCTION public.check_referral_duplicate();

-- Trigger: Automated status change audit logging
CREATE OR REPLACE FUNCTION public.log_referral_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF (OLD.status IS DISTINCT FROM NEW.status) THEN
        INSERT INTO public.audit_logs (
            actor_id,
            referral_id,
            action,
            previous_status,
            new_status,
            notes
        ) VALUES (
            auth.uid(),
            NEW.id,
            'STATUS_CHANGE',
            OLD.status,
            NEW.status,
            NEW.admin_notes
        );
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_referral_status ON public.referrals;
CREATE TRIGGER trg_audit_referral_status
    AFTER UPDATE OF status ON public.referrals
    FOR EACH ROW
    EXECUTE FUNCTION public.log_referral_status_change();

-- Trigger: Secure profile generation upon auth.users signup
-- Ensures volunteers are reliably created with 'volunteer' role without allowing client role tampering
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, phone_number, volunteer_team, role)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', 'Volunteer'),
        COALESCE(NEW.raw_user_meta_data->>'phone_number', ''),
        COALESCE(NEW.raw_user_meta_data->>'volunteer_team', 'General Volunteer Pool'),
        'volunteer' -- Guaranteed role: public registration NEVER grants admin
    );
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- 6. Public Leaderboard View (Exposes only aggregate stats & non-sensitive volunteer info)
CREATE OR REPLACE VIEW public.public_leaderboard AS
SELECT 
    p.id AS volunteer_id,
    p.full_name,
    p.volunteer_team,
    COALESCE(SUM(CASE WHEN r.status = 'approved' THEN r.ticket_quantity ELSE 0 END), 0)::INT AS verified_tickets,
    -- 1 point per 2 verified tickets
    FLOOR(COALESCE(SUM(CASE WHEN r.status = 'approved' THEN r.ticket_quantity ELSE 0 END), 0) / 2)::INT AS points,
    -- Carryover: odd ticket remaining
    (COALESCE(SUM(CASE WHEN r.status = 'approved' THEN r.ticket_quantity ELSE 0 END), 0) % 2)::INT AS carryover_tickets,
    DENSE_RANK() OVER (
        ORDER BY 
            FLOOR(COALESCE(SUM(CASE WHEN r.status = 'approved' THEN r.ticket_quantity ELSE 0 END), 0) / 2) DESC,
            COALESCE(SUM(CASE WHEN r.status = 'approved' THEN r.ticket_quantity ELSE 0 END), 0) DESC,
            p.created_at ASC
    )::INT AS rank
FROM public.profiles p
LEFT JOIN public.referrals r ON p.id = r.volunteer_id
WHERE p.role = 'volunteer'
GROUP BY p.id, p.full_name, p.volunteer_team, p.created_at;

-- Explicitly grant SELECT on leaderboard view to public callers
GRANT SELECT ON public.public_leaderboard TO anon, authenticated;

-- 7. Row Level Security (RLS) Policies

-- Profiles Table Permissions:
-- Prevent direct client insertion; creation is exclusively handled via on_auth_user_created trigger
REVOKE INSERT ON public.profiles FROM authenticated, anon;
-- Prevent volunteers from modifying their own role column
REVOKE UPDATE (role) ON public.profiles FROM authenticated, anon;

-- Volunteers can only view their OWN profile record. Admins can view all profiles.
-- CRITICAL FIX: Eliminates the public phone number leak.
DROP POLICY IF EXISTS "Public can view volunteer basic info for leaderboard" ON public.profiles;
DROP POLICY IF EXISTS "Volunteers can view own profile" ON public.profiles;
CREATE POLICY "Volunteers can view own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id OR public.is_admin());

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Admins have full access to profiles" ON public.profiles;
CREATE POLICY "Admins have full access to profiles"
    ON public.profiles FOR ALL
    USING (public.is_admin());

-- Referrals Table Permissions:
DROP POLICY IF EXISTS "Volunteers can view only their own referrals" ON public.referrals;
CREATE POLICY "Volunteers can view only their own referrals"
    ON public.referrals FOR SELECT
    USING (auth.uid() = volunteer_id OR public.is_admin());

-- CRITICAL FIX: Strict validation preventing volunteers from forging verification metadata or extreme quantities
DROP POLICY IF EXISTS "Volunteers can insert their own pending referrals" ON public.referrals;
CREATE POLICY "Volunteers can insert their own pending referrals"
    ON public.referrals FOR INSERT
    WITH CHECK (
        auth.uid() = volunteer_id 
        AND status = 'pending'
        AND verified_at IS NULL
        AND verified_by IS NULL
        AND admin_notes IS NULL
        AND ticket_quantity > 0 
        AND ticket_quantity <= 50
    );

DROP POLICY IF EXISTS "Only admins can update referrals" ON public.referrals;
CREATE POLICY "Only admins can update referrals"
    ON public.referrals FOR UPDATE
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Only admins can delete referrals" ON public.referrals;
CREATE POLICY "Only admins can delete referrals"
    ON public.referrals FOR DELETE
    USING (public.is_admin());

-- Audit Logs Table Permissions:
-- Make audit logs strictly append-only by revoking UPDATE and DELETE
REVOKE UPDATE, DELETE ON public.audit_logs FROM authenticated, anon;
REVOKE INSERT ON public.audit_logs FROM authenticated, anon; -- Handled strictly by trigger

DROP POLICY IF EXISTS "Only admins can view audit logs" ON public.audit_logs;
CREATE POLICY "Only admins can view audit logs"
    ON public.audit_logs FOR SELECT
    USING (public.is_admin());

-- 8. Protected Admin Bootstrapping Procedure
-- Can only be executed with service_role / superuser privileges from the Supabase SQL editor
CREATE OR REPLACE FUNCTION public.bootstrap_admin(target_email TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    matched_user_id UUID;
BEGIN
    SELECT id INTO matched_user_id
    FROM auth.users
    WHERE email = lower(trim(target_email));

    IF matched_user_id IS NULL THEN
        RAISE EXCEPTION 'Target user email % not found in auth.users. Volunteer must register first.', target_email;
    END IF;

    UPDATE public.profiles
    SET role = 'admin', updated_at = now()
    WHERE id = matched_user_id;

    RETURN format('User %s successfully promoted to administrator.', target_email);
END;
$$;

-- Protect bootstrap function from public execution
REVOKE EXECUTE ON FUNCTION public.bootstrap_admin(TEXT) FROM public, authenticated, anon;
