-- ==============================================================================
-- TEDxGwarinpa Volunteer Ticket Sales Challenge (VolTex)
-- Migration: 20261019000001_configurable_scoring_and_leaderboard_fix.sql
-- ==============================================================================
-- Summary of Fixes:
-- 1. Updates handle_new_user() default volunteer team to 'Volunteer Management Team'.
-- 2. Creates public.scoring_settings table for authorized database persistence of
--    the active scoring policy (default: 5 points per verified ticket).
-- 3. Implements RLS on scoring_settings: public/volunteers can SELECT active policy;
--    only admins can INSERT, UPDATE, or DELETE.
-- 4. Replaces public.public_leaderboard view with a SECURITY DEFINER function + view
--    pattern to guarantee safe public reading under PostgreSQL 15+ without exposing
--    underlying table PII (phone numbers, buyer details, or order refs).
-- ==============================================================================

-- 1. Update Profile Generation Trigger: Default team to 'Volunteer Management Team'
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
        COALESCE(NEW.raw_user_meta_data->>'volunteer_team', 'Volunteer Management Team'),
        'volunteer' -- Guaranteed role: public registration NEVER grants admin
    );
    RETURN NEW;
END;
$$;

-- 2. Create Scoring Settings Table (Persistent Admin-Configured Policy)
DO $$ BEGIN
    CREATE TYPE scoring_policy_status AS ENUM ('draft', 'active', 'archived');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS public.scoring_settings (
    id TEXT PRIMARY KEY DEFAULT 'current_policy',
    points_per_ticket INTEGER NOT NULL DEFAULT 5 CHECK (points_per_ticket >= 1 AND points_per_ticket <= 100),
    status scoring_policy_status NOT NULL DEFAULT 'active',
    label TEXT NOT NULL DEFAULT 'Official Scoring Policy (5 Points per Verified Ticket)',
    notes TEXT DEFAULT '5 points awarded strictly upon admin verification of each ticket on Meeteor Hub.',
    updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.scoring_settings ENABLE ROW LEVEL SECURITY;

-- Insert default official policy if not already present
INSERT INTO public.scoring_settings (id, points_per_ticket, status, label, notes)
VALUES (
    'current_policy',
    5,
    'active',
    'Official Scoring Policy (5 Points per Verified Ticket)',
    '5 points awarded strictly upon admin verification of each ticket on Meeteor Hub.'
)
ON CONFLICT (id) DO UPDATE
SET points_per_ticket = EXCLUDED.points_per_ticket,
    status = EXCLUDED.status,
    label = EXCLUDED.label,
    notes = EXCLUDED.notes
WHERE scoring_settings.id = 'current_policy';

-- 3. RLS Policies for Scoring Settings
-- Everyone (anon and authenticated) can read active scoring settings
DROP POLICY IF EXISTS "Anyone can view scoring settings" ON public.scoring_settings;
CREATE POLICY "Anyone can view scoring settings"
    ON public.scoring_settings FOR SELECT
    USING (true);

-- Only verified admins can modify or insert scoring policies
DROP POLICY IF EXISTS "Only admins can modify scoring settings" ON public.scoring_settings;
CREATE POLICY "Only admins can modify scoring settings"
    ON public.scoring_settings FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- Revoke direct permissions from anon on table modifications
REVOKE INSERT, UPDATE, DELETE ON public.scoring_settings FROM anon;

-- 4. Helper function to fetch current points multiplier safely
CREATE OR REPLACE FUNCTION public.get_active_points_per_ticket()
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT COALESCE(
        (SELECT points_per_ticket FROM public.scoring_settings WHERE id = 'current_policy' AND status = 'active' LIMIT 1),
        5
    );
$$;

GRANT EXECUTE ON FUNCTION public.get_active_points_per_ticket() TO anon, authenticated;

-- 5. Safe Leaderboard Function & View (SECURITY DEFINER guarantees public read
-- without exposing private profiles.phone_number or referrals tables)
CREATE OR REPLACE FUNCTION public.get_public_leaderboard()
RETURNS TABLE (
    volunteer_id UUID,
    full_name TEXT,
    volunteer_team TEXT,
    verified_tickets INT,
    points INT,
    carryover_tickets INT,
    rank INT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT 
        p.id AS volunteer_id,
        p.full_name,
        p.volunteer_team,
        COALESCE(SUM(CASE WHEN r.status = 'approved' THEN r.ticket_quantity ELSE 0 END), 0)::INT AS verified_tickets,
        (COALESCE(SUM(CASE WHEN r.status = 'approved' THEN r.ticket_quantity ELSE 0 END), 0) * public.get_active_points_per_ticket())::INT AS points,
        0::INT AS carryover_tickets,
        DENSE_RANK() OVER (
            ORDER BY 
                (COALESCE(SUM(CASE WHEN r.status = 'approved' THEN r.ticket_quantity ELSE 0 END), 0) * public.get_active_points_per_ticket()) DESC,
                COALESCE(SUM(CASE WHEN r.status = 'approved' THEN r.ticket_quantity ELSE 0 END), 0) DESC,
                p.created_at ASC
        )::INT AS rank
    FROM public.profiles p
    LEFT JOIN public.referrals r ON p.id = r.volunteer_id
    WHERE p.role = 'volunteer'
    GROUP BY p.id, p.full_name, p.volunteer_team, p.created_at;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_leaderboard() TO anon, authenticated;

-- Drop existing view first to avoid column type conflicts
DROP VIEW IF EXISTS public.public_leaderboard;

CREATE VIEW public.public_leaderboard
WITH (security_barrier = true)
AS
    SELECT * FROM public.get_public_leaderboard();

-- Explicitly grant SELECT on leaderboard view to public callers
GRANT SELECT ON public.public_leaderboard TO anon, authenticated;
