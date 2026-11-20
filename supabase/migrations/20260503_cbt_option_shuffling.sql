-- ============================================================================
-- DIVINE ACADEMY SECONDARY SCHOOL PORTAL
-- ADMINISTRATOR-REVIEWED ADDITIVE MIGRATION:
-- AUTOMATIC CBT ANSWER OPTION SHUFFLING (FISHER-YATES) & SESSION PERSISTENCE
-- ============================================================================
-- SAFETY GUARANTEES:
--   1. Strictly additive and idempotent. Does NOT drop, truncate, or reset any
--      of the 27 existing portal tables.
--   2. Does NOT modify, disable, or weaken any of the 74 existing RLS policies.
--   3. Preserves all existing CBT exams, existing questions (including legacy
--      non-'A' correctOption keys), and all historical cbt_attempts records.
--   4. Stores per-attempt shuffled option orders & opaque option identifiers
--      in a locked-down private table (`public.cbt_exam_session_options`) with
--      RLS enabled and ZERO student privileges, preventing pre-submission
--      answer key inspection via Supabase REST or client state.
--   5. Every SECURITY DEFINER function runs with `SET search_path = ''` and
--      explicitly schema-qualified references (`public.`, `auth.`, `pg_catalog.`).
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. ADDITIVE SESSION DRAFT ANSWERS COLUMN ON public.cbt_exam_sessions
--    Stores ONLY opaque per-session option IDs selected by the student so
--    page refreshes or temporary network drops preserve selections.
-- ----------------------------------------------------------------------------
ALTER TABLE public.cbt_exam_sessions
  ADD COLUMN IF NOT EXISTS draft_answers jsonb NOT NULL DEFAULT '{}'::jsonb;

-- ----------------------------------------------------------------------------
-- 2. PRIVATE PER-ATTEMPT SHUFFLED OPTION MAPPING TABLE
--    Stores Fisher-Yates shuffled display slots ('A','B','C','D'), opaque
--    per-session optionIds, and canonical answer mappings strictly server-side.
--    Students NEVER have direct SELECT/INSERT/UPDATE/DELETE privileges here.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cbt_exam_session_options (
  id text PRIMARY KEY,
  session_id text NOT NULL REFERENCES public.cbt_exam_sessions(id) ON DELETE CASCADE,
  exam_id text NOT NULL,
  student_id text NOT NULL,
  question_id text NOT NULL,
  shuffled_options jsonb NOT NULL,
  correct_option_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT uq_cbt_session_options_session_question UNIQUE (session_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_cbt_exam_session_options_session_id
  ON public.cbt_exam_session_options (session_id);

CREATE INDEX IF NOT EXISTS idx_cbt_exam_session_options_exam_student
  ON public.cbt_exam_session_options (exam_id, student_id);

ALTER TABLE public.cbt_exam_session_options ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.cbt_exam_session_options FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.cbt_exam_session_options TO service_role;

-- ----------------------------------------------------------------------------
-- 3. INTERNAL CSPRNG FISHER-YATES SHUFFLE HELPER FOR 4 OPTIONS (A, B, C, D)
--    Uses pg_catalog.gen_random_uuid() with rejection sampling (zero modulo
--    bias) to perform an unbiased Fisher-Yates permutation on ['A','B','C','D'].
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cbt_fisher_yates_shuffle_keys()
RETURNS text[]
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_slots text[] := ARRAY['A', 'B', 'C', 'D'];
  v_i integer;
  v_j integer;
  v_rand_u32 bigint;
  v_limit bigint;
  v_tmp text;
BEGIN
  FOR v_i IN REVERSE 4..2 LOOP
    v_limit := 4294967296::bigint - (4294967296::bigint % v_i);
    LOOP
      v_rand_u32 := ('x' || pg_catalog.substr(
        pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', ''),
        1,
        8
      ))::bit(32)::bigint;
      EXIT WHEN v_rand_u32 < v_limit;
    END LOOP;

    v_j := 1 + (v_rand_u32 % v_i)::integer;
    IF v_j <> v_i THEN
      v_tmp := v_slots[v_i];
      v_slots[v_i] := v_slots[v_j];
      v_slots[v_j] := v_tmp;
    END IF;
  END LOOP;

  RETURN v_slots;
END;
$$;

REVOKE ALL ON FUNCTION public.cbt_fisher_yates_shuffle_keys() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cbt_fisher_yates_shuffle_keys() TO service_role;

-- ----------------------------------------------------------------------------
-- 4. INTERNAL HELPER: GENERATE & PERSIST SHUFFLED OPTIONS ONCE PER SESSION
--    If rows already exist for (session_id, question_id), they are NEVER
--    regenerated so option order stays identical on navigation, refresh,
--    and session resume.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cbt_ensure_session_shuffled_options(
  p_session_id text,
  p_exam_id text,
  p_student_id text
)
RETURNS void
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_q record;
  v_perm text[];
  v_slots text[] := ARRAY['A', 'B', 'C', 'D'];
  v_idx integer;
  v_slot text;
  v_canon text;
  v_opt_id text;
  v_opt_text text;
  v_shuffled_arr jsonb;
  v_correct_opt_id text;
  v_exam_questions jsonb;
BEGIN
  IF EXISTS (SELECT 1 FROM public.cbt_questions cq WHERE cq.exam_id = p_exam_id) THEN
    FOR v_q IN
      SELECT
        cq.id AS qid,
        cq.option_a,
        cq.option_b,
        cq.option_c,
        cq.option_d,
        CASE
          WHEN pg_catalog.upper(COALESCE(cq.correct_option, 'A')) IN ('A', 'B', 'C', 'D')
            THEN pg_catalog.upper(cq.correct_option)
          ELSE 'A'
        END AS true_correct
      FROM public.cbt_questions cq
      WHERE cq.exam_id = p_exam_id
        AND NOT EXISTS (
          SELECT 1
          FROM public.cbt_exam_session_options ceo
          WHERE ceo.session_id = p_session_id
            AND ceo.question_id = cq.id
        )
      ORDER BY cq.question_order
    LOOP
      v_perm := public.cbt_fisher_yates_shuffle_keys();
      v_shuffled_arr := '[]'::jsonb;
      v_correct_opt_id := '';

      FOR v_idx IN 1..4 LOOP
        v_slot := v_slots[v_idx];
        v_canon := v_perm[v_idx];
        v_opt_id := 'opt_' || pg_catalog.substr(
          pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', ''),
          1,
          16
        );
        v_opt_text := CASE v_canon
          WHEN 'A' THEN COALESCE(v_q.option_a, '')
          WHEN 'B' THEN COALESCE(v_q.option_b, '')
          WHEN 'C' THEN COALESCE(v_q.option_c, '')
          ELSE COALESCE(v_q.option_d, '')
        END;

        IF v_canon = v_q.true_correct THEN
          v_correct_opt_id := v_opt_id;
        END IF;

        v_shuffled_arr := v_shuffled_arr || pg_catalog.jsonb_build_array(
          pg_catalog.jsonb_build_object(
            'slot', v_slot,
            'optionId', v_opt_id,
            'canonicalKey', v_canon,
            'text', v_opt_text
          )
        );
      END LOOP;

      INSERT INTO public.cbt_exam_session_options (
        id, session_id, exam_id, student_id, question_id, shuffled_options, correct_option_id
      )
      VALUES (
        'cbtopts-' || pg_catalog.md5(p_session_id || ':' || v_q.qid),
        p_session_id,
        p_exam_id,
        p_student_id,
        v_q.qid,
        v_shuffled_arr,
        v_correct_opt_id
      )
      ON CONFLICT (session_id, question_id) DO NOTHING;
    END LOOP;
  ELSE
    SELECT ce.questions INTO v_exam_questions
    FROM public.cbt_exams ce
    WHERE ce.id = p_exam_id
    LIMIT 1;

    FOR v_q IN
      SELECT
        COALESCE(NULLIF(pg_catalog.btrim(q.val->>'id'), ''), p_exam_id || '-q-' || q.ord::text) AS qid,
        COALESCE(q.val->'options'->>'A', '') AS option_a,
        COALESCE(q.val->'options'->>'B', '') AS option_b,
        COALESCE(q.val->'options'->>'C', '') AS option_c,
        COALESCE(q.val->'options'->>'D', '') AS option_d,
        CASE
          WHEN pg_catalog.upper(COALESCE(q.val->>'correctOption', 'A')) IN ('A', 'B', 'C', 'D')
            THEN pg_catalog.upper(q.val->>'correctOption')
          ELSE 'A'
        END AS true_correct
      FROM pg_catalog.jsonb_array_elements(
        CASE WHEN pg_catalog.jsonb_typeof(v_exam_questions) = 'array' THEN v_exam_questions ELSE '[]'::jsonb END
      ) WITH ORDINALITY AS q(val, ord)
      WHERE NOT EXISTS (
        SELECT 1
        FROM public.cbt_exam_session_options ceo
        WHERE ceo.session_id = p_session_id
          AND ceo.question_id = COALESCE(NULLIF(pg_catalog.btrim(q.val->>'id'), ''), p_exam_id || '-q-' || q.ord::text)
      )
    LOOP
      v_perm := public.cbt_fisher_yates_shuffle_keys();
      v_shuffled_arr := '[]'::jsonb;
      v_correct_opt_id := '';

      FOR v_idx IN 1..4 LOOP
        v_slot := v_slots[v_idx];
        v_canon := v_perm[v_idx];
        v_opt_id := 'opt_' || pg_catalog.substr(
          pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', ''),
          1,
          16
        );
        v_opt_text := CASE v_canon
          WHEN 'A' THEN COALESCE(v_q.option_a, '')
          WHEN 'B' THEN COALESCE(v_q.option_b, '')
          WHEN 'C' THEN COALESCE(v_q.option_c, '')
          ELSE COALESCE(v_q.option_d, '')
        END;

        IF v_canon = v_q.true_correct THEN
          v_correct_opt_id := v_opt_id;
        END IF;

        v_shuffled_arr := v_shuffled_arr || pg_catalog.jsonb_build_array(
          pg_catalog.jsonb_build_object(
            'slot', v_slot,
            'optionId', v_opt_id,
            'canonicalKey', v_canon,
            'text', v_opt_text
          )
        );
      END LOOP;

      INSERT INTO public.cbt_exam_session_options (
        id, session_id, exam_id, student_id, question_id, shuffled_options, correct_option_id
      )
      VALUES (
        'cbtopts-' || pg_catalog.md5(p_session_id || ':' || v_q.qid),
        p_session_id,
        p_exam_id,
        p_student_id,
        v_q.qid,
        v_shuffled_arr,
        v_correct_opt_id
      )
      ON CONFLICT (session_id, question_id) DO NOTHING;
    END LOOP;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.cbt_ensure_session_shuffled_options(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cbt_ensure_session_shuffled_options(text, text, text) TO service_role;

-- ----------------------------------------------------------------------------
-- 5. UPDATED start_cbt_exam(p_exam_id text)
--    Applies Fisher-Yates option shuffling independently per student attempt,
--    persists opaque option IDs, returns ONLY display text + opaque optionIds
--    (ZERO correctOption, canonicalKey, isCorrect, or explanation), and
--    returns savedAnswers for seamless browser refresh / reconnect resume.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.start_cbt_exam(p_exam_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_student public.students%ROWTYPE;
  v_exam public.cbt_exams%ROWTYPE;
  v_session public.cbt_exam_sessions%ROWTYPE;
  v_cbt_active boolean := true;
  v_local_now timestamp;
  v_start_ts timestamp;
  v_end_ts timestamp;
  v_questions jsonb := '[]'::jsonb;
  v_order jsonb := '[]'::jsonb;
  v_remaining integer;
  v_now timestamptz := pg_catalog.now();
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  SELECT * INTO v_student
  FROM public.students s
  WHERE s.auth_user_id = auth.uid()
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Only enrolled students can start a CBT examination.';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('cbt:' || p_exam_id || ':' || v_student.id));

  IF v_student.status <> 'Active' THEN
    RAISE EXCEPTION 'Your student account status (%) is not eligible for CBT examinations.', v_student.status;
  END IF;

  SELECT COALESCE(ss.cbt_active, true) INTO v_cbt_active
  FROM public.system_settings ss
  WHERE ss.id = 'default'
  LIMIT 1;

  IF NOT v_cbt_active THEN
    RAISE EXCEPTION 'CBT examinations are currently disabled by the school administrator.';
  END IF;

  SELECT * INTO v_exam
  FROM public.cbt_exams ce
  WHERE ce.id = p_exam_id
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CBT examination not found.';
  END IF;

  IF NOT v_exam.is_published THEN
    RAISE EXCEPTION 'This CBT examination is not published.';
  END IF;

  IF v_exam.class_id <> v_student.class_id THEN
    RAISE EXCEPTION 'You are not enrolled in the target class for this CBT examination.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.cbt_attempts ca
    WHERE ca.exam_id = p_exam_id AND ca.student_id = v_student.id
  ) THEN
    RAISE EXCEPTION 'You have already completed this CBT examination (1-attempt limit).';
  END IF;

  -- Validate availability window in Nigeria local time (Africa/Lagos)
  v_local_now := v_now AT TIME ZONE 'Africa/Lagos';
  IF v_exam.start_date ~ '^\d{4}-\d{2}-\d{2}$' THEN
    v_start_ts := (v_exam.start_date || ' ' || COALESCE(NULLIF(pg_catalog.btrim(v_exam.start_time), ''), '00:00'))::timestamp;
    IF v_local_now < v_start_ts THEN
      RAISE EXCEPTION 'This CBT examination has not started yet (scheduled for % %).', v_exam.start_date, COALESCE(v_exam.start_time, '00:00');
    END IF;
  END IF;

  IF v_exam.end_date ~ '^\d{4}-\d{2}-\d{2}$' THEN
    v_end_ts := (v_exam.end_date || ' 23:59:59')::timestamp;
    IF v_local_now > v_end_ts THEN
      RAISE EXCEPTION 'The examination window for this CBT closed on %.', v_exam.end_date;
    END IF;
  END IF;

  -- Fetch or create server-enforced exam session
  SELECT * INTO v_session
  FROM public.cbt_exam_sessions ces
  WHERE ces.exam_id = p_exam_id AND ces.student_id = v_student.id
  FOR UPDATE;

  IF FOUND THEN
    IF v_session.status = 'submitted' THEN
      RAISE EXCEPTION 'This CBT exam session has already been submitted.';
    END IF;
    IF v_session.status = 'expired' OR v_now > v_session.expires_at THEN
      UPDATE public.cbt_exam_sessions
      SET status = 'expired', updated_at = v_now
      WHERE id = v_session.id;
      RAISE EXCEPTION 'Your allocated time for this CBT session has expired.';
    END IF;
  ELSE
    IF EXISTS (SELECT 1 FROM public.cbt_questions cq WHERE cq.exam_id = p_exam_id) THEN
      SELECT COALESCE(
        pg_catalog.jsonb_agg(sub.id ORDER BY CASE WHEN v_exam.shuffle_questions THEN pg_catalog.random() ELSE sub.question_order::double precision END),
        '[]'::jsonb
      )
      INTO v_order
      FROM (
        SELECT cq.id, cq.question_order
        FROM public.cbt_questions cq
        WHERE cq.exam_id = p_exam_id
      ) sub;
    ELSE
      SELECT COALESCE(
        pg_catalog.jsonb_agg(sub.qid ORDER BY CASE WHEN v_exam.shuffle_questions THEN pg_catalog.random() ELSE sub.ord::double precision END),
        '[]'::jsonb
      )
      INTO v_order
      FROM (
        SELECT COALESCE(NULLIF(pg_catalog.btrim(q.val->>'id'), ''), p_exam_id || '-q-' || q.ord::text) AS qid, q.ord
        FROM pg_catalog.jsonb_array_elements(
          CASE WHEN pg_catalog.jsonb_typeof(v_exam.questions) = 'array' THEN v_exam.questions ELSE '[]'::jsonb END
        ) WITH ORDINALITY AS q(val, ord)
      ) sub;
    END IF;

    INSERT INTO public.cbt_exam_sessions (
      id, exam_id, student_id, started_at, expires_at, status, question_order, draft_answers
    )
    VALUES (
      'cbtsess-' || pg_catalog.md5(p_exam_id || ':' || v_student.id),
      p_exam_id,
      v_student.id,
      v_now,
      v_now + pg_catalog.make_interval(mins => v_exam.duration_minutes),
      'in_progress',
      v_order,
      '{}'::jsonb
    )
    RETURNING * INTO v_session;
  END IF;

  -- Generate & persist Fisher-Yates shuffled options once for this session
  PERFORM public.cbt_ensure_session_shuffled_options(v_session.id, p_exam_id, v_student.id);

  -- Build sanitized student payload: display text + opaque optionIds ONLY
  -- NEVER exposes correctOption, canonicalKey, isCorrect, or explanation.
  IF EXISTS (SELECT 1 FROM public.cbt_questions cq WHERE cq.exam_id = p_exam_id) THEN
    SELECT COALESCE(
      pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'id', cq.id,
          'question', cq.question,
          'options', (
            SELECT pg_catalog.jsonb_object_agg(opt->>'slot', opt->>'text')
            FROM pg_catalog.jsonb_array_elements(ceo.shuffled_options) AS opt
          ),
          'optionIds', (
            SELECT pg_catalog.jsonb_object_agg(opt->>'slot', opt->>'optionId')
            FROM pg_catalog.jsonb_array_elements(ceo.shuffled_options) AS opt
          ),
          'marks', cq.marks
        )
        ORDER BY COALESCE(ord_idx.pos, cq.question_order::bigint)
      ),
      '[]'::jsonb
    )
    INTO v_questions
    FROM public.cbt_questions cq
    JOIN public.cbt_exam_session_options ceo
      ON ceo.session_id = v_session.id AND ceo.question_id = cq.id
    LEFT JOIN LATERAL pg_catalog.jsonb_array_elements_text(v_session.question_order) WITH ORDINALITY AS ord_idx(qid, pos)
      ON ord_idx.qid = cq.id
    WHERE cq.exam_id = p_exam_id;
  ELSE
    SELECT COALESCE(
      pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'id', COALESCE(NULLIF(pg_catalog.btrim(q.val->>'id'), ''), p_exam_id || '-q-' || q.ord::text),
          'question', COALESCE(q.val->>'question', ''),
          'options', (
            SELECT pg_catalog.jsonb_object_agg(opt->>'slot', opt->>'text')
            FROM pg_catalog.jsonb_array_elements(ceo.shuffled_options) AS opt
          ),
          'optionIds', (
            SELECT pg_catalog.jsonb_object_agg(opt->>'slot', opt->>'optionId')
            FROM pg_catalog.jsonb_array_elements(ceo.shuffled_options) AS opt
          ),
          'marks', CASE WHEN COALESCE(pg_catalog.btrim(q.val->>'marks'), '') ~ '^\d+(\.\d+)?$' THEN (q.val->>'marks')::numeric ELSE 1 END
        )
        ORDER BY COALESCE(ord_idx.pos, q.ord)
      ),
      '[]'::jsonb
    )
    INTO v_questions
    FROM pg_catalog.jsonb_array_elements(
      CASE WHEN pg_catalog.jsonb_typeof(v_exam.questions) = 'array' THEN v_exam.questions ELSE '[]'::jsonb END
    ) WITH ORDINALITY AS q(val, ord)
    JOIN public.cbt_exam_session_options ceo
      ON ceo.session_id = v_session.id
     AND ceo.question_id = COALESCE(NULLIF(pg_catalog.btrim(q.val->>'id'), ''), p_exam_id || '-q-' || q.ord::text)
    LEFT JOIN LATERAL pg_catalog.jsonb_array_elements_text(v_session.question_order) WITH ORDINALITY AS ord_idx(qid, pos)
      ON ord_idx.qid = COALESCE(NULLIF(pg_catalog.btrim(q.val->>'id'), ''), p_exam_id || '-q-' || q.ord::text);
  END IF;

  v_remaining := GREATEST(0, pg_catalog.floor(EXTRACT(EPOCH FROM (v_session.expires_at - v_now)))::integer);

  RETURN pg_catalog.jsonb_build_object(
    'sessionId', v_session.id,
    'startedAt', v_session.started_at,
    'expiresAt', v_session.expires_at,
    'remainingSeconds', v_remaining,
    'savedAnswers', COALESCE(v_session.draft_answers, '{}'::jsonb),
    'exam', pg_catalog.jsonb_build_object(
      'id', v_exam.id,
      'title', v_exam.title,
      'subjectId', v_exam.subject_id,
      'subjectName', v_exam.subject_name,
      'classId', v_exam.class_id,
      'className', v_exam.class_name,
      'term', v_exam.term,
      'session', v_exam.session,
      'durationMinutes', v_exam.duration_minutes,
      'totalQuestions', pg_catalog.jsonb_array_length(v_questions),
      'totalMarks', v_exam.total_marks,
      'passPercentage', v_exam.pass_percentage,
      'startDate', v_exam.start_date,
      'startTime', v_exam.start_time,
      'endDate', v_exam.end_date,
      'isPublished', v_exam.is_published,
      'shuffleQuestions', v_exam.shuffle_questions,
      'questions', v_questions
    )
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 6. NEW RPC: save_cbt_exam_answers(p_exam_id text, p_answers jsonb)
--    Persists the student's selected opaque optionIds incrementally on the
--    server while the session is in progress. Never reveals answer keys.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.save_cbt_exam_answers(
  p_exam_id text,
  p_answers jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_student public.students%ROWTYPE;
  v_session public.cbt_exam_sessions%ROWTYPE;
  v_incoming jsonb := CASE WHEN pg_catalog.jsonb_typeof(p_answers) = 'object' THEN p_answers ELSE '{}'::jsonb END;
  v_sanitized jsonb := '{}'::jsonb;
  v_merged jsonb := '{}'::jsonb;
  v_now timestamptz := pg_catalog.now();
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  SELECT * INTO v_student
  FROM public.students s
  WHERE s.auth_user_id = auth.uid()
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Only enrolled students can save CBT answers.';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('cbt:' || p_exam_id || ':' || v_student.id));

  SELECT * INTO v_session
  FROM public.cbt_exam_sessions ces
  WHERE ces.exam_id = p_exam_id AND ces.student_id = v_student.id
  FOR UPDATE;

  IF NOT FOUND OR v_session.status <> 'in_progress' THEN
    RAISE EXCEPTION 'No active CBT exam session found.';
  END IF;

  IF v_now > v_session.expires_at + interval '20 seconds' THEN
    RAISE EXCEPTION 'CBT exam session time has expired.';
  END IF;

  -- Validate every submitted answer against this session's persisted opaque optionIds
  SELECT COALESCE(pg_catalog.jsonb_object_agg(kv.key, resolved.option_id), '{}'::jsonb)
  INTO v_sanitized
  FROM pg_catalog.jsonb_each_text(v_incoming) AS kv(key, val)
  JOIN public.cbt_exam_session_options ceo
    ON ceo.session_id = v_session.id
   AND ceo.question_id = kv.key
  CROSS JOIN LATERAL (
    SELECT opt->>'optionId' AS option_id
    FROM pg_catalog.jsonb_array_elements(ceo.shuffled_options) AS opt
    WHERE opt->>'optionId' = pg_catalog.btrim(kv.val)
       OR opt->>'slot' = pg_catalog.upper(pg_catalog.btrim(kv.val))
    LIMIT 1
  ) AS resolved
  WHERE resolved.option_id IS NOT NULL;

  v_merged := COALESCE(v_session.draft_answers, '{}'::jsonb) || v_sanitized;

  UPDATE public.cbt_exam_sessions
  SET draft_answers = v_merged,
      updated_at = v_now
  WHERE id = v_session.id;

  RETURN pg_catalog.jsonb_build_object(
    'ok', true,
    'savedAnswers', v_merged
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 7. UPDATED submit_cbt_exam(p_exam_id text, p_answers jsonb)
--    Server-authoritative grading using opaque optionIds resolved against
--    cbt_exam_session_options and true correct_option in cbt_questions
--    (handling both Option-A questions and legacy non-'A' questions).
--    Stores canonical answers ('A'|'B'|'C'|'D') in cbt_attempts.answers for
--    teacher script compatibility, and returns post-submission review with the
--    exact shuffled option layout the student saw on screen.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_cbt_exam(
  p_exam_id text,
  p_answers jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_student public.students%ROWTYPE;
  v_exam public.cbt_exams%ROWTYPE;
  v_session public.cbt_exam_sessions%ROWTYPE;
  v_incoming jsonb := CASE WHEN pg_catalog.jsonb_typeof(p_answers) = 'object' THEN p_answers ELSE '{}'::jsonb END;
  v_effective_answers jsonb := '{}'::jsonb;
  v_canonical_answers jsonb := '{}'::jsonb;
  v_score numeric(6,2) := 0;
  v_total_marks numeric(6,2) := 0;
  v_percentage numeric(5,2) := 0;
  v_passed boolean := false;
  v_time_taken integer := 1;
  v_now timestamptz := pg_catalog.now();
  v_completed_at text := pg_catalog.to_char(v_now AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_attempt_id text;
  v_review jsonb := '[]'::jsonb;
  v_attempt_row public.cbt_attempts%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  SELECT * INTO v_student
  FROM public.students s
  WHERE s.auth_user_id = auth.uid()
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Only enrolled students can submit CBT examinations.';
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('cbt:' || p_exam_id || ':' || v_student.id));

  SELECT * INTO v_exam
  FROM public.cbt_exams ce
  WHERE ce.id = p_exam_id
  LIMIT 1;

  IF NOT FOUND OR NOT v_exam.is_published OR v_exam.class_id <> v_student.class_id THEN
    RAISE EXCEPTION 'You are not authorized to submit this CBT examination.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.cbt_attempts ca
    WHERE ca.exam_id = p_exam_id AND ca.student_id = v_student.id
  ) THEN
    RAISE EXCEPTION 'A completed attempt already exists for this CBT examination.';
  END IF;

  SELECT * INTO v_session
  FROM public.cbt_exam_sessions ces
  WHERE ces.exam_id = p_exam_id AND ces.student_id = v_student.id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No active CBT exam session found. Start the exam first.';
  END IF;

  IF v_session.status <> 'in_progress' THEN
    RAISE EXCEPTION 'This CBT exam session is no longer active (%).', v_session.status;
  END IF;

  IF v_now > v_session.expires_at + interval '20 seconds' THEN
    UPDATE public.cbt_exam_sessions
    SET status = 'expired', updated_at = v_now
    WHERE id = v_session.id;
    RAISE EXCEPTION 'Exam submission window has expired.';
  END IF;

  v_time_taken := GREATEST(
    1,
    LEAST(
      v_exam.duration_minutes * 60,
      pg_catalog.floor(EXTRACT(EPOCH FROM (v_now - v_session.started_at)))::integer
    )
  );

  -- Combine saved draft answers with final payload (final payload overrides)
  v_effective_answers := COALESCE(v_session.draft_answers, '{}'::jsonb) || v_incoming;

  IF EXISTS (SELECT 1 FROM public.cbt_questions cq WHERE cq.exam_id = p_exam_id) THEN
    WITH ordered_q AS (
      SELECT
        cq.id,
        cq.question,
        CASE
          WHEN ceo.id IS NOT NULL THEN (
            SELECT pg_catalog.jsonb_object_agg(opt->>'slot', opt->>'text')
            FROM pg_catalog.jsonb_array_elements(ceo.shuffled_options) AS opt
          )
          ELSE pg_catalog.jsonb_build_object('A', cq.option_a, 'B', cq.option_b, 'C', cq.option_c, 'D', cq.option_d)
        END AS display_options,
        CASE
          WHEN pg_catalog.upper(COALESCE(cq.correct_option, 'A')) IN ('A', 'B', 'C', 'D')
            THEN pg_catalog.upper(cq.correct_option)
          ELSE 'A'
        END AS true_correct_canonical,
        CASE
          WHEN ceo.id IS NOT NULL THEN COALESCE(
            (
              SELECT opt->>'slot'
              FROM pg_catalog.jsonb_array_elements(ceo.shuffled_options) AS opt
              WHERE opt->>'canonicalKey' = CASE
                WHEN pg_catalog.upper(COALESCE(cq.correct_option, 'A')) IN ('A', 'B', 'C', 'D')
                  THEN pg_catalog.upper(cq.correct_option)
                ELSE 'A'
              END
              LIMIT 1
            ),
            'A'
          )
          ELSE CASE
            WHEN pg_catalog.upper(COALESCE(cq.correct_option, 'A')) IN ('A', 'B', 'C', 'D')
              THEN pg_catalog.upper(cq.correct_option)
            ELSE 'A'
          END
        END AS correct_display_slot,
        CASE
          WHEN ceo.id IS NOT NULL THEN (
            SELECT opt->>'slot'
            FROM pg_catalog.jsonb_array_elements(ceo.shuffled_options) AS opt
            WHERE opt->>'optionId' = pg_catalog.btrim(COALESCE(v_effective_answers->>cq.id, ''))
               OR opt->>'slot' = pg_catalog.upper(pg_catalog.btrim(COALESCE(v_effective_answers->>cq.id, '')))
            LIMIT 1
          )
          ELSE NULLIF(pg_catalog.upper(pg_catalog.btrim(COALESCE(v_effective_answers->>cq.id, ''))), '')
        END AS selected_display_slot,
        CASE
          WHEN ceo.id IS NOT NULL THEN (
            SELECT opt->>'canonicalKey'
            FROM pg_catalog.jsonb_array_elements(ceo.shuffled_options) AS opt
            WHERE opt->>'optionId' = pg_catalog.btrim(COALESCE(v_effective_answers->>cq.id, ''))
               OR opt->>'slot' = pg_catalog.upper(pg_catalog.btrim(COALESCE(v_effective_answers->>cq.id, '')))
            LIMIT 1
          )
          ELSE CASE
            WHEN pg_catalog.upper(pg_catalog.btrim(COALESCE(v_effective_answers->>cq.id, ''))) IN ('A', 'B', 'C', 'D')
              THEN pg_catalog.upper(pg_catalog.btrim(COALESCE(v_effective_answers->>cq.id, '')))
            ELSE NULL
          END
        END AS selected_canonical,
        cq.explanation,
        cq.marks,
        COALESCE(ord_idx.pos, cq.question_order::bigint) AS sort_pos
      FROM public.cbt_questions cq
      LEFT JOIN public.cbt_exam_session_options ceo
        ON ceo.session_id = v_session.id AND ceo.question_id = cq.id
      LEFT JOIN LATERAL pg_catalog.jsonb_array_elements_text(v_session.question_order) WITH ORDINALITY AS ord_idx(qid, pos)
        ON ord_idx.qid = cq.id
      WHERE cq.exam_id = p_exam_id
    )
    SELECT
      COALESCE(pg_catalog.sum(CASE WHEN selected_canonical = true_correct_canonical THEN marks ELSE 0 END), 0),
      COALESCE(pg_catalog.sum(marks), 0),
      COALESCE(
        pg_catalog.jsonb_object_agg(id, selected_canonical) FILTER (WHERE selected_canonical IS NOT NULL),
        '{}'::jsonb
      ),
      COALESCE(
        pg_catalog.jsonb_agg(
          pg_catalog.jsonb_build_object(
            'questionId', id,
            'question', question,
            'options', display_options,
            'selectedOption', selected_display_slot,
            'correctOption', correct_display_slot,
            'explanation', explanation,
            'marks', marks,
            'earnedMarks', CASE WHEN selected_canonical = true_correct_canonical THEN marks ELSE 0 END,
            'isCorrect', COALESCE(selected_canonical = true_correct_canonical, false)
          )
          ORDER BY sort_pos
        ),
        '[]'::jsonb
      )
    INTO v_score, v_total_marks, v_canonical_answers, v_review
    FROM ordered_q;
  ELSE
    WITH base_q AS (
      SELECT
        COALESCE(NULLIF(pg_catalog.btrim(q.val->>'id'), ''), p_exam_id || '-q-' || q.ord::text) AS id,
        COALESCE(q.val->>'question', '') AS question,
        COALESCE(q.val->'options', '{}'::jsonb) AS raw_options,
        CASE
          WHEN pg_catalog.upper(COALESCE(q.val->>'correctOption', 'A')) IN ('A','B','C','D')
            THEN pg_catalog.upper(q.val->>'correctOption')
          ELSE 'A'
        END AS true_correct_canonical,
        q.val->>'explanation' AS explanation,
        CASE WHEN COALESCE(pg_catalog.btrim(q.val->>'marks'), '') ~ '^\d+(\.\d+)?$' THEN (q.val->>'marks')::numeric ELSE 1 END AS marks,
        COALESCE(ord_idx.pos, q.ord) AS sort_pos
      FROM pg_catalog.jsonb_array_elements(
        CASE WHEN pg_catalog.jsonb_typeof(v_exam.questions) = 'array' THEN v_exam.questions ELSE '[]'::jsonb END
      ) WITH ORDINALITY AS q(val, ord)
      LEFT JOIN LATERAL pg_catalog.jsonb_array_elements_text(v_session.question_order) WITH ORDINALITY AS ord_idx(qid, pos)
        ON ord_idx.qid = COALESCE(NULLIF(pg_catalog.btrim(q.val->>'id'), ''), p_exam_id || '-q-' || q.ord::text)
    ),
    ordered_q AS (
      SELECT
        bq.id,
        bq.question,
        CASE
          WHEN ceo.id IS NOT NULL THEN (
            SELECT pg_catalog.jsonb_object_agg(opt->>'slot', opt->>'text')
            FROM pg_catalog.jsonb_array_elements(ceo.shuffled_options) AS opt
          )
          ELSE bq.raw_options
        END AS display_options,
        bq.true_correct_canonical,
        CASE
          WHEN ceo.id IS NOT NULL THEN COALESCE(
            (
              SELECT opt->>'slot'
              FROM pg_catalog.jsonb_array_elements(ceo.shuffled_options) AS opt
              WHERE opt->>'canonicalKey' = bq.true_correct_canonical
              LIMIT 1
            ),
            'A'
          )
          ELSE bq.true_correct_canonical
        END AS correct_display_slot,
        CASE
          WHEN ceo.id IS NOT NULL THEN (
            SELECT opt->>'slot'
            FROM pg_catalog.jsonb_array_elements(ceo.shuffled_options) AS opt
            WHERE opt->>'optionId' = pg_catalog.btrim(COALESCE(v_effective_answers->>bq.id, ''))
               OR opt->>'slot' = pg_catalog.upper(pg_catalog.btrim(COALESCE(v_effective_answers->>bq.id, '')))
            LIMIT 1
          )
          ELSE NULLIF(pg_catalog.upper(pg_catalog.btrim(COALESCE(v_effective_answers->>bq.id, ''))), '')
        END AS selected_display_slot,
        CASE
          WHEN ceo.id IS NOT NULL THEN (
            SELECT opt->>'canonicalKey'
            FROM pg_catalog.jsonb_array_elements(ceo.shuffled_options) AS opt
            WHERE opt->>'optionId' = pg_catalog.btrim(COALESCE(v_effective_answers->>bq.id, ''))
               OR opt->>'slot' = pg_catalog.upper(pg_catalog.btrim(COALESCE(v_effective_answers->>bq.id, '')))
            LIMIT 1
          )
          ELSE CASE
            WHEN pg_catalog.upper(pg_catalog.btrim(COALESCE(v_effective_answers->>bq.id, ''))) IN ('A', 'B', 'C', 'D')
              THEN pg_catalog.upper(pg_catalog.btrim(COALESCE(v_effective_answers->>bq.id, '')))
            ELSE NULL
          END
        END AS selected_canonical,
        bq.explanation,
        bq.marks,
        bq.sort_pos
      FROM base_q bq
      LEFT JOIN public.cbt_exam_session_options ceo
        ON ceo.session_id = v_session.id AND ceo.question_id = bq.id
    )
    SELECT
      COALESCE(pg_catalog.sum(CASE WHEN selected_canonical = true_correct_canonical THEN marks ELSE 0 END), 0),
      COALESCE(pg_catalog.sum(marks), 0),
      COALESCE(
        pg_catalog.jsonb_object_agg(id, selected_canonical) FILTER (WHERE selected_canonical IS NOT NULL),
        '{}'::jsonb
      ),
      COALESCE(
        pg_catalog.jsonb_agg(
          pg_catalog.jsonb_build_object(
            'questionId', id,
            'question', question,
            'options', display_options,
            'selectedOption', selected_display_slot,
            'correctOption', correct_display_slot,
            'explanation', explanation,
            'marks', marks,
            'earnedMarks', CASE WHEN selected_canonical = true_correct_canonical THEN marks ELSE 0 END,
            'isCorrect', COALESCE(selected_canonical = true_correct_canonical, false)
          )
          ORDER BY sort_pos
        ),
        '[]'::jsonb
      )
    INTO v_score, v_total_marks, v_canonical_answers, v_review
    FROM ordered_q;
  END IF;

  IF v_total_marks <= 0 THEN
    v_total_marks := GREATEST(v_exam.total_marks, 1);
  END IF;

  v_percentage := LEAST(100, GREATEST(0, pg_catalog.round((v_score / v_total_marks) * 100.0, 2)));
  v_passed := v_percentage >= COALESCE(v_exam.pass_percentage, 50);
  v_attempt_id := 'attmpt-' || pg_catalog.substr(pg_catalog.md5(p_exam_id || ':' || v_student.id || ':' || v_now::text), 1, 16);

  INSERT INTO public.cbt_attempts (
    id, exam_id, student_id, student_name, admission_no,
    score_obtained, total_marks, percentage, passed,
    time_taken_seconds, completed_at, answers
  )
  VALUES (
    v_attempt_id,
    p_exam_id,
    v_student.id,
    pg_catalog.btrim(v_student.first_name || ' ' || v_student.last_name),
    v_student.admission_no,
    v_score,
    v_total_marks,
    v_percentage,
    v_passed,
    v_time_taken,
    v_completed_at,
    v_canonical_answers
  )
  RETURNING * INTO v_attempt_row;

  UPDATE public.cbt_exam_sessions
  SET status = 'submitted',
      submitted_at = v_now,
      updated_at = v_now
  WHERE id = v_session.id;

  RETURN pg_catalog.jsonb_build_object(
    'attempt', pg_catalog.jsonb_build_object(
      'id', v_attempt_row.id,
      'examId', v_attempt_row.exam_id,
      'studentId', v_attempt_row.student_id,
      'studentName', v_attempt_row.student_name,
      'admissionNo', v_attempt_row.admission_no,
      'scoreObtained', v_attempt_row.score_obtained,
      'totalMarks', v_attempt_row.total_marks,
      'percentage', v_attempt_row.percentage,
      'passed', v_attempt_row.passed,
      'timeTakenSeconds', v_attempt_row.time_taken_seconds,
      'completedAt', v_attempt_row.completed_at,
      'answers', v_attempt_row.answers
    ),
    'review', v_review
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 8. TEACHER/ADMIN HELPER: CHECK EXAMS WITH ACTIVE IN-PROGRESS SESSIONS
--    Lets the Exam Builder show which exams are locked for editing while
--    students are actively taking the exam.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_cbt_active_session_exam_ids()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_result jsonb := '[]'::jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  IF NOT (public.is_admin() OR public.is_teacher()) THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT COALESCE(pg_catalog.jsonb_agg(DISTINCT ces.exam_id), '[]'::jsonb)
  INTO v_result
  FROM public.cbt_exam_sessions ces
  WHERE ces.status = 'in_progress'
    AND ces.expires_at > pg_catalog.now();

  RETURN v_result;
END;
$$;

-- ----------------------------------------------------------------------------
-- 9. LEAST-PRIVILEGE RPC EXECUTION GRANTS
-- ----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.start_cbt_exam(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.save_cbt_exam_answers(text, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.submit_cbt_exam(text, jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_cbt_active_session_exam_ids() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.start_cbt_exam(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.save_cbt_exam_answers(text, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.submit_cbt_exam(text, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_cbt_active_session_exam_ids() TO authenticated, service_role;

COMMIT;
