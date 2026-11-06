-- ==============================================================================
-- Migration: 20261102000001_harden_profile_security.sql
-- Description: Standalone security hardening for public.profiles.
--              Closes volunteer profile privilege escalation by revoking
--              table-level mutation privileges from client roles and enforcing
--              defense-in-depth trigger checks on protected columns.
-- Dependencies: Base schema migrations 1 to 7 (PostgreSQL 15+ / 16+ / 17+).
-- Target: Current Production Schema (pre-feature migration, no referral_code).
-- ==============================================================================

BEGIN;

-- 1. Explicitly revoke all table-level modification and access grants from untrusted client roles and PUBLIC
REVOKE ALL ON TABLE public.profiles FROM PUBLIC, anon, authenticated;

-- 2. Grant UPDATE strictly on approved self-editable columns to authenticated users
GRANT UPDATE (full_name, phone_number, volunteer_team, updated_at) 
ON TABLE public.profiles TO authenticated;

-- 3. Ensure SELECT access is explicitly granted to client roles (governed by RLS)
GRANT SELECT ON TABLE public.profiles TO anon, authenticated;

-- 4. Defense-in-depth trigger protecting immutable and administrative profile fields
CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    -- Block non-admin client roles from updating the role column
    IF NEW.role IS DISTINCT FROM OLD.role THEN
        IF COALESCE(auth.role(), '') IN ('authenticated', 'anon') AND NOT public.is_admin() THEN
            RAISE EXCEPTION 'Unauthorized: volunteer role cannot be self-modified'
                USING ERRCODE = '42501';
        END IF;
    END IF;

    -- Block client roles from modifying primary key id
    IF NEW.id IS DISTINCT FROM OLD.id THEN
        IF COALESCE(auth.role(), '') IN ('authenticated', 'anon') THEN
            RAISE EXCEPTION 'Unauthorized: profile id cannot be modified'
                USING ERRCODE = '42501';
        END IF;
    END IF;

    -- Block client roles from modifying creation timestamp
    IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
        IF COALESCE(auth.role(), '') IN ('authenticated', 'anon') THEN
            RAISE EXCEPTION 'Unauthorized: profile created_at cannot be modified'
                USING ERRCODE = '42501';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_fields ON public.profiles;
CREATE TRIGGER trg_protect_profile_fields
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.protect_profile_fields();

-- 5. Harden RLS update policy: explicitly bound to authenticated role
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

COMMIT;
