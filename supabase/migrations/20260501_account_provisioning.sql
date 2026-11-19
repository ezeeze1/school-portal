-- ============================================================================
-- DIVINE ACADEMY SECONDARY SCHOOL PORTAL
-- MINIMAL ADDITIVE MIGRATION: SECURE ACCOUNT PROVISIONING & STATUS TRACKING
-- ============================================================================
-- SAFETY GUARANTEES:
--   1. Does NOT drop, recreate, truncate, or reset any of the 27 existing tables.
--   2. Does NOT drop, disable, or weaken any of the 74 existing RLS policies.
--   3. Safe and idempotent to run on the live Divine Academy Supabase database.
--   4. Review carefully before executing manually in Supabase SQL Editor.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. ADDITIVE PROVISIONING METADATA COLUMNS ON public.user_profiles
--    (No password or secret material is ever stored in this table.)
-- ----------------------------------------------------------------------------
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS account_status text NOT NULL DEFAULT 'active';

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS invited_at timestamptz;

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS activated_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_user_profiles_account_status'
      AND conrelid = 'public.user_profiles'::regclass
  ) THEN
    ALTER TABLE public.user_profiles
      ADD CONSTRAINT chk_user_profiles_account_status
      CHECK (account_status IN ('invitation_pending', 'active', 'disabled'));
  END IF;
END $$;

-- Sync existing rows cleanly without overwriting active admin records
UPDATE public.user_profiles up
SET account_status = CASE WHEN up.is_active THEN 'active' ELSE 'disabled' END,
    activated_at = COALESCE(up.activated_at, CASE WHEN up.is_active THEN up.created_at ELSE NULL END)
WHERE up.account_status IS NULL
   OR (up.is_active = false AND up.account_status <> 'disabled');

-- ----------------------------------------------------------------------------
-- 2. PREVENT DUPLICATE IDENTITIES & MISMATCHED RECORD LINKS
-- ----------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_profiles_role_reference
  ON public.user_profiles (role, reference_id)
  WHERE reference_id IS NOT NULL AND trim(reference_id) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS uq_user_profiles_email_lower
  ON public.user_profiles (lower(email));

-- ----------------------------------------------------------------------------
-- 3. AUTHORITATIVE SERVER-SIDE ACCOUNT STATUS RPC (ADMINISTRATOR ONLY)
--    Reads auth.users confirmation/ban state alongside public.user_profiles.
--    Never exposes password hashes, recovery tokens, or secrets.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_admin_account_statuses()
RETURNS TABLE (
  out_auth_user_id uuid,
  out_role text,
  out_reference_id text,
  out_email text,
  out_is_active boolean,
  out_account_status text,
  out_must_change_password boolean,
  out_email_confirmed_at timestamptz,
  out_invited_at timestamptz,
  out_last_sign_in_at timestamptz,
  out_banned_until timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin() THEN
    RAISE EXCEPTION 'Administrator access required.';
  END IF;

  RETURN QUERY
  SELECT
    up.auth_user_id,
    up.role,
    up.reference_id,
    COALESCE(lower(trim(au.email)), lower(trim(up.email))) AS resolved_email,
    up.is_active,
    CASE
      WHEN NOT up.is_active
        OR (au.banned_until IS NOT NULL AND au.banned_until > now())
        THEN 'disabled'
      WHEN au.id IS NOT NULL
        AND au.email_confirmed_at IS NULL
        AND (au.invited_at IS NOT NULL OR up.account_status = 'invitation_pending')
        THEN 'invitation_pending'
      ELSE 'active'
    END AS derived_status,
    COALESCE(up.must_change_password, false) AS derived_must_change,
    au.email_confirmed_at,
    COALESCE(up.invited_at, au.invited_at) AS derived_invited_at,
    au.last_sign_in_at,
    au.banned_until
  FROM public.user_profiles up
  LEFT JOIN auth.users au ON au.id = up.auth_user_id
  WHERE up.role IN ('student', 'teacher', 'parent');
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. SELF-SERVICE INITIAL PASSWORD SETUP SECURITY STATE RPCs
--    Allows an authenticated user to read their own must_change_password flag
--    and clear it ONLY after updating their Supabase Auth password.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_my_account_security_state()
RETURNS TABLE (
  out_account_status text,
  out_must_change_password boolean,
  out_is_active boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  RETURN QUERY
  SELECT
    up.account_status,
    COALESCE(up.must_change_password, false),
    up.is_active
  FROM public.user_profiles up
  WHERE up.auth_user_id = v_uid
  LIMIT 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_my_password_setup()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  UPDATE public.user_profiles up
  SET must_change_password = false,
      account_status = CASE WHEN up.is_active THEN 'active' ELSE 'disabled' END,
      activated_at = COALESCE(up.activated_at, now()),
      updated_at = now()
  WHERE up.auth_user_id = v_uid
    AND up.is_active = true;

  RETURN FOUND;
END;
$$;

-- ----------------------------------------------------------------------------
-- 5. LEAST-PRIVILEGE FUNCTION EXECUTION GRANTS
-- ----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.get_admin_account_statuses() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_my_account_security_state() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.complete_my_password_setup() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_admin_account_statuses() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_my_account_security_state() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.complete_my_password_setup() TO authenticated, service_role;

COMMIT;
