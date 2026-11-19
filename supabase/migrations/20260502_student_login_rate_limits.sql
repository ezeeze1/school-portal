-- ============================================================================
-- DIVINE ACADEMY SECONDARY SCHOOL PORTAL
-- ADMINISTRATOR-REVIEWED ADDITIVE MIGRATION:
-- PERSISTENT ATOMIC RATE LIMITING FOR STUDENT ADMISSION-NUMBER LOGIN
-- ============================================================================
-- SAFETY GUARANTEES:
--   1. Does NOT modify, drop, or reset any of the 27 existing portal tables.
--   2. Does NOT modify, disable, or weaken any of the 74 existing RLS policies.
--   3. Does NOT touch existing student records, teacher/parent records, or
--      administrator accounts.
--   4. Stores ONLY SHA-256 hashed bucket keys (no plaintext IPs, admission
--      numbers, emails, or passwords).
--   5. Strictly locked down to `service_role` (RLS enabled with zero client
--      policies; all privileges revoked from PUBLIC, anon, and authenticated).
--   6. Every SECURITY DEFINER function runs with a fixed empty search_path
--      (`SET search_path = ''`) and explicitly schema-qualified objects.
--   7. Safe and idempotent to review and execute manually in Supabase SQL Editor.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. RATE-LIMIT STATE TABLE (SERVICE_ROLE ONLY)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.student_login_rate_limits (
  bucket_key text PRIMARY KEY CHECK (pg_catalog.length(pg_catalog.btrim(bucket_key)) BETWEEN 1 AND 128),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  window_expires_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now()
);

CREATE INDEX IF NOT EXISTS idx_student_login_rate_limits_updated_at
  ON public.student_login_rate_limits (updated_at);

-- Enable RLS with NO client policies so anon/authenticated have zero access
ALTER TABLE public.student_login_rate_limits ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.student_login_rate_limits FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.student_login_rate_limits TO service_role;

-- ----------------------------------------------------------------------------
-- 2. ATOMIC CHECK-AND-CONSUME RPC (MULTI-INSTANCE SAFE VIA ROW-LEVEL LOCK)
--    Serializes concurrent requests for the same bucket_key across all
--    Supabase Edge Function isolates using SELECT ... FOR UPDATE.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.consume_student_login_attempt(
  p_bucket_key text,
  p_max_attempts integer,
  p_window_seconds integer
)
RETURNS TABLE (
  out_allowed boolean,
  out_retry_after_seconds integer,
  out_remaining_attempts integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_key text := pg_catalog.btrim(COALESCE(p_bucket_key, ''));
  v_now timestamptz := pg_catalog.now();
  v_count integer;
  v_expires_at timestamptz;
  v_retry integer;
BEGIN
  IF v_key = '' OR pg_catalog.length(v_key) > 128 THEN
    RAISE EXCEPTION 'Invalid rate-limit bucket key.';
  END IF;
  IF p_max_attempts IS NULL OR p_max_attempts < 1 OR p_max_attempts > 10000 THEN
    RAISE EXCEPTION 'Invalid max_attempts value.';
  END IF;
  IF p_window_seconds IS NULL OR p_window_seconds < 1 OR p_window_seconds > 86400 THEN
    RAISE EXCEPTION 'Invalid window_seconds value.';
  END IF;

  -- Atomically ensure row exists and lock it exclusively against concurrent callers
  LOOP
    INSERT INTO public.student_login_rate_limits (
      bucket_key,
      attempt_count,
      window_expires_at,
      updated_at
    )
    VALUES (
      v_key,
      0,
      v_now,
      v_now
    )
    ON CONFLICT (bucket_key) DO NOTHING;

    SELECT rl.attempt_count, rl.window_expires_at
      INTO v_count, v_expires_at
    FROM public.student_login_rate_limits AS rl
    WHERE rl.bucket_key = v_key
    FOR UPDATE;

    EXIT WHEN FOUND;
  END LOOP;

  -- Expired, cleared, or brand-new window: reset counter to 1 and start a fresh window
  IF v_expires_at <= v_now THEN
    UPDATE public.student_login_rate_limits AS rl
    SET attempt_count = 1,
        window_expires_at = v_now + pg_catalog.make_interval(secs => p_window_seconds::double precision),
        updated_at = v_now
    WHERE rl.bucket_key = v_key;

    RETURN QUERY SELECT true, 0, GREATEST(0, p_max_attempts - 1);
    RETURN;
  END IF;

  -- Active window already exhausted: reject with remaining lock duration
  IF v_count >= p_max_attempts THEN
    v_retry := GREATEST(1, pg_catalog.ceil(EXTRACT(EPOCH FROM (v_expires_at - v_now)))::integer);
    RETURN QUERY SELECT false, v_retry, 0;
    RETURN;
  END IF;

  -- Active window still has budget: atomically consume one attempt
  UPDATE public.student_login_rate_limits AS rl
  SET attempt_count = v_count + 1,
      updated_at = v_now
  WHERE rl.bucket_key = v_key;

  RETURN QUERY SELECT true, 0, GREATEST(0, p_max_attempts - (v_count + 1));
END;
$$;

-- ----------------------------------------------------------------------------
-- 3. CLEAR BUCKET ON LEGITIMATE SIGN-IN (ADMISSION NUMBER BUCKET)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.clear_student_login_rate_limit(
  p_bucket_key text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_key text := pg_catalog.btrim(COALESCE(p_bucket_key, ''));
  v_now timestamptz := pg_catalog.now();
BEGIN
  IF v_key = '' OR pg_catalog.length(v_key) > 128 THEN
    RAISE EXCEPTION 'Invalid rate-limit bucket key.';
  END IF;

  UPDATE public.student_login_rate_limits AS rl
  SET attempt_count = 0,
      window_expires_at = v_now,
      updated_at = v_now
  WHERE rl.bucket_key = v_key;
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. RELEASE ONE ATTEMPT ON LEGITIMATE SIGN-IN (SHARED IP BUCKET)
--    Prevents students signing in from a shared school lab / Wi-Fi IP from
--    exhausting the IP rate-limit allowance.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.release_student_login_attempt(
  p_bucket_key text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_key text := pg_catalog.btrim(COALESCE(p_bucket_key, ''));
  v_now timestamptz := pg_catalog.now();
BEGIN
  IF v_key = '' OR pg_catalog.length(v_key) > 128 THEN
    RAISE EXCEPTION 'Invalid rate-limit bucket key.';
  END IF;

  UPDATE public.student_login_rate_limits AS rl
  SET attempt_count = GREATEST(0, rl.attempt_count - 1),
      updated_at = v_now
  WHERE rl.bucket_key = v_key
    AND rl.window_expires_at > v_now;
END;
$$;

-- ----------------------------------------------------------------------------
-- 5. OPTIONAL MAINTENANCE PRUNING RPC (EXPIRED ROWS OLDER THAN N HOURS)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prune_student_login_rate_limits(
  p_older_than_hours integer DEFAULT 24
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_hours integer := GREATEST(1, COALESCE(p_older_than_hours, 24));
  v_now timestamptz := pg_catalog.now();
  v_deleted integer := 0;
BEGIN
  DELETE FROM public.student_login_rate_limits AS rl
  WHERE rl.window_expires_at < v_now
    AND rl.updated_at < v_now - pg_catalog.make_interval(hours => v_hours);

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

-- ----------------------------------------------------------------------------
-- 6. LEAST-PRIVILEGE FUNCTION EXECUTION GRANTS (SERVICE_ROLE ONLY)
-- ----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.consume_student_login_attempt(text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.clear_student_login_rate_limit(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_student_login_attempt(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prune_student_login_rate_limits(integer) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.consume_student_login_attempt(text, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.clear_student_login_rate_limit(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_student_login_attempt(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.prune_student_login_rate_limits(integer) TO service_role;

COMMIT;
