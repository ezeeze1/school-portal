-- ============================================================================
-- DIVINE ACADEMY SECONDARY SCHOOL PORTAL
-- ADMINISTRATOR-REVIEWED ADDITIVE MIGRATION (REMEDIATED):
-- AUTOMATIC CBT ANSWER OPTION SHUFFLING (FISHER-YATES), FAIL-CLOSED GRADING,
-- SESSION DRAFT PERSISTENCE & SCHOOL REVIEW POLICY ENFORCEMENT
-- ============================================================================
-- SAFETY GUARANTEES:
--   1. Strictly additive and idempotent. Does NOT drop, truncate, or reset any
--      of the 27 existing portal tables or overwrite unrelated functions.
--   2. Does NOT modify, disable, or weaken any of the 74 existing RLS policies.
--   3. Preserves all existing CBT exams, existing questions (including legacy
--      non-'A' correctOption keys), and all historical cbt_attempts records.
--   4. Stores per-attempt shuffled option orders & opaque option identifiers
--      in a locked-down private table (`public.cbt_exam_session_options`) with
--      RLS enabled, foreign keys, CHECK constraints, updated_at trigger, and
--      ZERO student/anon privileges.
--   5. Fail-closed grading: submit_cbt_exam REQUIRES complete persisted
--      shuffled-option mappings and rejects raw display-slot ('A'..'D') bypass.
--   6. Post-submission answer review & explanations are withheld unless both
--      school policy (`system_settings.cbt_allow_answer_review`) and exam
--      policy (`cbt_exams.allow_answer_review`) permit release.
--   7. Every SECURITY DEFINER function runs with `SET search_path = ''` and
--      explicitly schema-qualified references (`public.`, `auth.`, `pg_catalog.`).
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. ADDITIVE EXAMINATION REVIEW POLICY COLUMNS (FAIL-CLOSED BY DEFAULT)
--    system_settings.cbt_allow_answer_review defaults to FALSE so correct
--    answers & explanations are withheld unless explicitly enabled by admin.
--    Note: public.public_site_settings view is NOT modified (zero anon leak).
-- ----------------------------------------------------------------------------
ALTER TABLE public.system_settings
  ADD COLUMN IF NOT EXISTS cbt_allow_answer_review boolean NOT NULL DEFAULT false;

-- Nullable per-exam override: NULL = inherit school policy, FALSE = withhold
ALTER TABLE public.cbt_exams
  ADD COLUMN IF NOT EXISTS allow_answer_review boolean;

-- ----------------------------------------------------------------------------
-- 2. ADDITIVE SESSION DRAFT ANSWERS COLUMN ON public.cbt_exam_sessions
--    Stores ONLY opaque per-session option IDs selected by the student so
--    page refreshes or temporary network drops preserve selections.
-- ----------------------------------------------------------------------------
ALTER TABLE public.cbt_exam_sessions
  ADD COLUMN IF NOT EXISTS draft_answers jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conrelid = 'public.cbt_exam_sessions'::regclass
      AND conname = 'chk_cbt_exam_sessions_draft_answers_object'
  ) THEN
    ALTER TABLE public.cbt_exam_sessions
      ADD CONSTRAINT chk_cbt_exam_sessions_draft_answers_object
      CHECK (pg_catalog.jsonb_typeof(draft_answers) = 'object');
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 3. PRIVATE PER-ATTEMPT SHUFFLED OPTION MAPPING TABLE
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
  updated_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  CONSTRAINT uq_cbt_session_options_session_question UNIQUE (session_id, question_id)
);

ALTER TABLE public.cbt_exam_session_options
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT pg_catalog.now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conrelid = 'public.cbt_exam_session_options'::regclass
      AND conname = 'fk_cbt_exam_session_options_exam'
  ) THEN
    ALTER TABLE public.cbt_exam_session_options
      ADD CONSTRAINT fk_cbt_exam_session_options_exam
      FOREIGN KEY (exam_id) REFERENCES public.cbt_exams(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conrelid = 'public.cbt_exam_session_options'::regclass
      AND conname = 'fk_cbt_exam_session_options_student'
  ) THEN
    ALTER TABLE public.cbt_exam_session_options
      ADD CONSTRAINT fk_cbt_exam_session_options_student
      FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_catalog.pg_constraint
    WHERE conrelid = 'public.cbt_exam_session_options'::regclass
      AND conname = 'chk_cbt_exam_session_options_valid'
  ) THEN
    ALTER TABLE public.cbt_exam_session_options
      ADD CONSTRAINT chk_cbt_exam_session_options_valid
      CHECK (
        pg_catalog.jsonb_typeof(shuffled_options) = 'array'
        AND pg_catalog.jsonb_array_length(shuffled_options) = 4
        AND pg_catalog.length(pg_catalog.btrim(correct_option_id)) > 0
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_cbt_exam_session_options_session_id
  ON public.cbt_exam_session_options (session_id);

CREATE INDEX IF NOT EXISTS idx_cbt_exam_session_options_exam_student
  ON public.cbt_exam_session_options (exam_id, student_id);

DROP TRIGGER IF EXISTS trg_cbt_exam_session_options_updated_at ON public.cbt_exam_session_options;
CREATE TRIGGER trg_cbt_exam_session_options_updated_at
  BEFORE UPDATE ON public.cbt_exam_session_options
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.cbt_exam_session_options ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.cbt_exam_session_options FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.cbt_exam_session_options TO service_role;

-- ----------------------------------------------------------------------------
-- 4. INTERNAL CSPRNG FISHER-YATES SHUFFLE HELPER FOR 4 OPTIONS (A, B, C, D)
--    Uses 4 random bytes decoded from pg_catalog.gen_random_uuid() (UUIDv4)
--    via pg_catalog.decode + pg_catalog.get_byte for exact unsigned 32-bit
--    integers in [0, 4294967295] with rejection sampling (zero modulo bias).
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
  v_rand_bytes bytea;
  v_rand_u32 bigint;
  v_limit bigint;
  v_tmp text;
BEGIN
  FOR v_i IN REVERSE 4..2 LOOP
    v_limit := 4294967296::bigint - (4294967296::bigint % v_i);
    LOOP
      v_rand_bytes := pg_catalog.decode(
        pg_catalog.substr(
          pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', ''),
          1,
          8
        ),
        'hex'
      );
      v_rand_u32 :=
        (pg_catalog.get_byte(v_rand_bytes, 0)::bigint * 16777216::bigint) +
        (pg_catalog.get_byte(v_rand_bytes, 1)::bigint * 65536::bigint) +
        (pg_catalog.get_byte(v_rand_bytes, 2)::bigint * 256::bigint) +
         pg_catalog.get_byte(v_rand_bytes, 3)::bigint;
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
-- 5. INTERNAL HELPER: GENERATE & PERSIST SHUFFLED OPTIONS ONCE PER SESSION
--    Validates active session ownership before inserting. If rows already
--    exist for (session_id, question_id), they are NEVER regenerated so option
--    order stays identical on navigation, refresh, and session resume.
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
  v_mapped_total integer := 0;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.cbt_exam_sessions ces
    WHERE ces.id = p_session_id
      AND ces.exam_id = p_exam_id
      AND ces.student_id = p_student_id
      AND ces.status = 'in_progress'
  ) THEN
    RAISE EXCEPTION 'Target CBT exam session is missing or no longer in progress.';
  END IF;

  IF EXISTS (SELECT 1 FROM public.cbt_questions cq WHERE cq.exam_id = p_exam_id) THEN
    FOR v_q IN
      SELECT
        cq.id AS qid,
        cq.option_a,
        cq.option_b,
        cq.option_c,
        cq.option_d,
        CASE
          WHEN pg_catalog.upper(pg_catalog.btrim(COALESCE(cq.correct_option, 'A'))) IN ('A', 'B', 'C', 'D')
            THEN pg_catalog.upper(pg_catalog.btrim(cq.correct_option))
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

      IF pg_catalog.length(v_correct_opt_id) = 0 THEN
        RAISE EXCEPTION 'Unable to resolve shuffled correct option mapping for question %.', v_q.qid;
      END IF;

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
          WHEN pg_catalog.upper(pg_catalog.btrim(COALESCE(q.val->>'correctOption', 'A'))) IN ('A', 'B', 'C', 'D')
            THEN pg_catalog.upper(pg_catalog.btrim(COALESCE(q.val->>'correctOption', 'A')))
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

      IF pg_catalog.length(v_correct_opt_id) = 0 THEN
        RAISE EXCEPTION 'Unable to resolve shuffled correct option mapping for question %.', v_q.qid;
      END IF;

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

  SELECT pg_catalog.count(*)::integer INTO v_mapped_total
  FROM public.cbt_exam_session_options ceo
  WHERE ceo.session_id = p_session_id
    AND ceo.exam_id = p_exam_id
    AND ceo.student_id = p_student_id;

  IF v_mapped_total <= 0 THEN
    RAISE EXCEPTION 'This CBT examination currently has no questions configured.';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.cbt_ensure_session_shuffled_options(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cbt_ensure_session_shuffled_options(text, text, text) TO service_role;

-- ----------------------------------------------------------------------------
-- 6. UPDATED start_cbt_exam(p_exam_id text)
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

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('cbt_exam_session'),
    pg_catalog.hashtext(p_exam_id || ':' || v_student.id)
  );

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

  IF COALESCE(v_exam.duration_minutes, 0) <= 0 THEN
    RAISE EXCEPTION 'This CBT examination has an invalid duration configuration.';
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

    IF pg_catalog.jsonb_typeof(v_order) <> 'array' OR pg_catalog.jsonb_array_length(v_order) = 0 THEN
      RAISE EXCEPTION 'This CBT examination currently contains no questions.';
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
      ON ceo.session_id = v_session.id
     AND ceo.exam_id = p_exam_id
     AND ceo.student_id = v_student.id
     AND ceo.question_id = cq.id
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
     AND ceo.exam_id = p_exam_id
     AND ceo.student_id = v_student.id
     AND ceo.question_id = COALESCE(NULLIF(pg_catalog.btrim(q.val->>'id'), ''), p_exam_id || '-q-' || q.ord::text)
    LEFT JOIN LATERAL pg_catalog.jsonb_array_elements_text(v_session.question_order) WITH ORDINALITY AS ord_idx(qid, pos)
      ON ord_idx.qid = COALESCE(NULLIF(pg_catalog.btrim(q.val->>'id'), ''), p_exam_id || '-q-' || q.ord::text);
  END IF;

  IF pg_catalog.jsonb_typeof(v_questions) <> 'array' OR pg_catalog.jsonb_array_length(v_questions) = 0 THEN
    RAISE EXCEPTION 'Unable to prepare examination questions for this session.';
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
-- 7. NEW RPC: save_cbt_exam_answers(p_exam_id text, p_answers jsonb)
--    Persists the student's selected opaque optionIds incrementally on the
--    server while the session is in progress. Strictly rejects raw display-slot
--    strings ('A'..'D'), expired sessions, inactive students, or already
--    submitted exams. Never reveals answer keys.
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
  v_exam public.cbt_exams%ROWTYPE;
  v_session public.cbt_exam_sessions%ROWTYPE;
  v_cbt_active boolean := true;
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

  IF v_student.status <> 'Active' THEN
    RAISE EXCEPTION 'Your student account status (%) is not eligible for CBT examinations.', v_student.status;
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('cbt_exam_session'),
    pg_catalog.hashtext(p_exam_id || ':' || v_student.id)
  );

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

  IF NOT FOUND OR NOT v_exam.is_published OR v_exam.class_id <> v_student.class_id THEN
    RAISE EXCEPTION 'You are not authorized to save answers for this CBT examination.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.cbt_attempts ca
    WHERE ca.exam_id = p_exam_id AND ca.student_id = v_student.id
  ) THEN
    RAISE EXCEPTION 'This CBT examination has already been completed.';
  END IF;

  SELECT * INTO v_session
  FROM public.cbt_exam_sessions ces
  WHERE ces.exam_id = p_exam_id AND ces.student_id = v_student.id
  FOR UPDATE;

  IF NOT FOUND OR v_session.status <> 'in_progress' THEN
    RAISE EXCEPTION 'No active CBT exam session found.';
  END IF;

  IF v_now > v_session.expires_at THEN
    RAISE EXCEPTION 'CBT exam session time has expired.';
  END IF;

  -- Strictly validate every submitted answer against persisted opaque optionIds ONLY
  SELECT COALESCE(pg_catalog.jsonb_object_agg(kv.key, resolved.option_id), '{}'::jsonb)
  INTO v_sanitized
  FROM pg_catalog.jsonb_each_text(v_incoming) AS kv(key, val)
  JOIN public.cbt_exam_session_options ceo
    ON ceo.session_id = v_session.id
   AND ceo.exam_id = p_exam_id
   AND ceo.student_id = v_student.id
   AND ceo.question_id = kv.key
  CROSS JOIN LATERAL (
    SELECT opt->>'optionId' AS option_id
    FROM pg_catalog.jsonb_array_elements(ceo.shuffled_options) AS opt
    WHERE opt->>'optionId' = pg_catalog.btrim(kv.val)
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
-- 8. UPDATED submit_cbt_exam(p_exam_id text, p_answers jsonb)
--    Server-authoritative, FAIL-CLOSED grading:
--      - Requires valid, complete cbt_exam_session_options rows for EVERY
--        question in the exam (no unmapped fallback, no raw slot bypass).
--      - Resolves opaque optionIds against true correct_option (supporting
--        both Option-A questions and legacy 'B'|'C'|'D' answer keys).
--      - Stores canonical answers ('A'|'B'|'C'|'D') in cbt_attempts.answers.
--      - Withholds correct answers & explanations unless school & exam review
--        policies both permit post-submission review.
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
  v_expected_count integer := 0;
  v_mapped_count integer := 0;
  v_missing_correct_slot integer := 0;
  v_school_allow_review boolean := false;
  v_review_permitted boolean := false;
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

  IF v_student.status <> 'Active' THEN
    RAISE EXCEPTION 'Your student account status (%) is not eligible to submit CBT examinations.', v_student.status;
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('cbt_exam_session'),
    pg_catalog.hashtext(p_exam_id || ':' || v_student.id)
  );

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

  -- Determine examination review policy (fail-closed by default; requires school policy = true)
  SELECT COALESCE(ss.cbt_allow_answer_review, false)
  INTO v_school_allow_review
  FROM public.system_settings ss
  WHERE ss.id = 'default'
  LIMIT 1;

  v_review_permitted := COALESCE(v_school_allow_review, false)
    AND COALESCE(v_exam.allow_answer_review, true);

  v_time_taken := GREATEST(
    1,
    LEAST(
      GREATEST(v_exam.duration_minutes, 1) * 60,
      pg_catalog.floor(EXTRACT(EPOCH FROM (v_now - v_session.started_at)))::integer
    )
  );

  -- Combine saved draft answers with final payload (final payload overrides)
  v_effective_answers := COALESCE(v_session.draft_answers, '{}'::jsonb) || v_incoming;

  IF EXISTS (SELECT 1 FROM public.cbt_questions cq WHERE cq.exam_id = p_exam_id) THEN
    -- Fail-closed check: every question must have a valid 4-option session mapping
    SELECT pg_catalog.count(*)::integer
    INTO v_expected_count
    FROM public.cbt_questions cq
    WHERE cq.exam_id = p_exam_id;

    SELECT pg_catalog.count(*)::integer
    INTO v_mapped_count
    FROM public.cbt_questions cq
    JOIN public.cbt_exam_session_options ceo
      ON ceo.session_id = v_session.id
     AND ceo.exam_id = p_exam_id
     AND ceo.student_id = v_student.id
     AND ceo.question_id = cq.id
    WHERE cq.exam_id = p_exam_id
      AND pg_catalog.jsonb_typeof(ceo.shuffled_options) = 'array'
      AND pg_catalog.jsonb_array_length(ceo.shuffled_options) = 4;

    IF v_expected_count = 0 OR v_mapped_count <> v_expected_count THEN
      RAISE EXCEPTION 'Session option mapping is missing or incomplete for this examination. Please reload the examination before submitting.';
    END IF;

    WITH ordered_q AS (
      SELECT
        cq.id,
        cq.question,
        (
          SELECT pg_catalog.jsonb_object_agg(opt->>'slot', opt->>'text')
          FROM pg_catalog.jsonb_array_elements(ceo.shuffled_options) AS opt
        ) AS display_options,
        CASE
          WHEN pg_catalog.upper(pg_catalog.btrim(COALESCE(cq.correct_option, 'A'))) IN ('A', 'B', 'C', 'D')
            THEN pg_catalog.upper(pg_catalog.btrim(cq.correct_option))
          ELSE 'A'
        END AS true_correct_canonical,
        (
          SELECT opt->>'slot'
          FROM pg_catalog.jsonb_array_elements(ceo.shuffled_options) AS opt
          WHERE opt->>'canonicalKey' = CASE
            WHEN pg_catalog.upper(pg_catalog.btrim(COALESCE(cq.correct_option, 'A'))) IN ('A', 'B', 'C', 'D')
              THEN pg_catalog.upper(pg_catalog.btrim(cq.correct_option))
            ELSE 'A'
          END
          LIMIT 1
        ) AS correct_display_slot,
        (
          SELECT opt->>'slot'
          FROM pg_catalog.jsonb_array_elements(ceo.shuffled_options) AS opt
          WHERE opt->>'optionId' = pg_catalog.btrim(COALESCE(v_effective_answers->>cq.id, ''))
          LIMIT 1
        ) AS selected_display_slot,
        (
          SELECT opt->>'canonicalKey'
          FROM pg_catalog.jsonb_array_elements(ceo.shuffled_options) AS opt
          WHERE opt->>'optionId' = pg_catalog.btrim(COALESCE(v_effective_answers->>cq.id, ''))
          LIMIT 1
        ) AS selected_canonical,
        cq.explanation,
        cq.marks,
        COALESCE(ord_idx.pos, cq.question_order::bigint) AS sort_pos
      FROM public.cbt_questions cq
      INNER JOIN public.cbt_exam_session_options ceo
        ON ceo.session_id = v_session.id
       AND ceo.exam_id = p_exam_id
       AND ceo.student_id = v_student.id
       AND ceo.question_id = cq.id
      LEFT JOIN LATERAL pg_catalog.jsonb_array_elements_text(v_session.question_order) WITH ORDINALITY AS ord_idx(qid, pos)
        ON ord_idx.qid = cq.id
      WHERE cq.exam_id = p_exam_id
    )
    SELECT
      pg_catalog.count(*) FILTER (WHERE correct_display_slot IS NULL)::integer,
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
    INTO v_missing_correct_slot, v_score, v_total_marks, v_canonical_answers, v_review
    FROM ordered_q;

    IF v_missing_correct_slot > 0 THEN
      RAISE EXCEPTION 'Session option mapping integrity check failed during grading.';
    END IF;
  ELSE
    -- JSONB exam fallback (pre-sync legacy structure); still strictly REQUIRES cbt_exam_session_options
    SELECT pg_catalog.count(*)::integer
    INTO v_expected_count
    FROM pg_catalog.jsonb_array_elements(
      CASE WHEN pg_catalog.jsonb_typeof(v_exam.questions) = 'array' THEN v_exam.questions ELSE '[]'::jsonb END
    ) WITH ORDINALITY AS q(val, ord);

    SELECT pg_catalog.count(*)::integer
    INTO v_mapped_count
    FROM pg_catalog.jsonb_array_elements(
      CASE WHEN pg_catalog.jsonb_typeof(v_exam.questions) = 'array' THEN v_exam.questions ELSE '[]'::jsonb END
    ) WITH ORDINALITY AS q(val, ord)
    JOIN public.cbt_exam_session_options ceo
      ON ceo.session_id = v_session.id
     AND ceo.exam_id = p_exam_id
     AND ceo.student_id = v_student.id
     AND ceo.question_id = COALESCE(NULLIF(pg_catalog.btrim(q.val->>'id'), ''), p_exam_id || '-q-' || q.ord::text)
    WHERE pg_catalog.jsonb_typeof(ceo.shuffled_options) = 'array'
      AND pg_catalog.jsonb_array_length(ceo.shuffled_options) = 4;

    IF v_expected_count = 0 OR v_mapped_count <> v_expected_count THEN
      RAISE EXCEPTION 'Session option mapping is missing or incomplete for this examination. Please reload the examination before submitting.';
    END IF;

    WITH base_q AS (
      SELECT
        COALESCE(NULLIF(pg_catalog.btrim(q.val->>'id'), ''), p_exam_id || '-q-' || q.ord::text) AS id,
        COALESCE(q.val->>'question', '') AS question,
        CASE
          WHEN pg_catalog.upper(pg_catalog.btrim(COALESCE(q.val->>'correctOption', 'A'))) IN ('A','B','C','D')
            THEN pg_catalog.upper(pg_catalog.btrim(COALESCE(q.val->>'correctOption', 'A')))
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
        (
          SELECT pg_catalog.jsonb_object_agg(opt->>'slot', opt->>'text')
          FROM pg_catalog.jsonb_array_elements(ceo.shuffled_options) AS opt
        ) AS display_options,
        bq.true_correct_canonical,
        (
          SELECT opt->>'slot'
          FROM pg_catalog.jsonb_array_elements(ceo.shuffled_options) AS opt
          WHERE opt->>'canonicalKey' = bq.true_correct_canonical
          LIMIT 1
        ) AS correct_display_slot,
        (
          SELECT opt->>'slot'
          FROM pg_catalog.jsonb_array_elements(ceo.shuffled_options) AS opt
          WHERE opt->>'optionId' = pg_catalog.btrim(COALESCE(v_effective_answers->>bq.id, ''))
          LIMIT 1
        ) AS selected_display_slot,
        (
          SELECT opt->>'canonicalKey'
          FROM pg_catalog.jsonb_array_elements(ceo.shuffled_options) AS opt
          WHERE opt->>'optionId' = pg_catalog.btrim(COALESCE(v_effective_answers->>bq.id, ''))
          LIMIT 1
        ) AS selected_canonical,
        bq.explanation,
        bq.marks,
        bq.sort_pos
      FROM base_q bq
      INNER JOIN public.cbt_exam_session_options ceo
        ON ceo.session_id = v_session.id
       AND ceo.exam_id = p_exam_id
       AND ceo.student_id = v_student.id
       AND ceo.question_id = bq.id
    )
    SELECT
      pg_catalog.count(*) FILTER (WHERE correct_display_slot IS NULL)::integer,
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
    INTO v_missing_correct_slot, v_score, v_total_marks, v_canonical_answers, v_review
    FROM ordered_q;

    IF v_missing_correct_slot > 0 THEN
      RAISE EXCEPTION 'Session option mapping integrity check failed during grading.';
    END IF;
  END IF;

  IF v_total_marks <= 0 THEN
    v_total_marks := GREATEST(v_exam.total_marks, 1);
  END IF;

  v_percentage := LEAST(100, GREATEST(0, pg_catalog.round((v_score / v_total_marks) * 100.0, 2)));
  v_passed := v_percentage >= COALESCE(v_exam.pass_percentage, 50);
  v_attempt_id := 'attmpt-' || pg_catalog.substr(
    pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', ''),
    1,
    16
  );

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

  -- Enforce review policy: withhold correct answers & explanations when disallowed
  IF NOT v_review_permitted THEN
    v_review := '[]'::jsonb;
  END IF;

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
    'review', v_review,
    'reviewPermitted', v_review_permitted,
    'reviewPolicyMessage', CASE
      WHEN v_review_permitted THEN NULL
      ELSE 'Correct answers and explanations are withheld in accordance with the school examination review policy.'
    END
  );
END;
$$;

-- ----------------------------------------------------------------------------
-- 9. TEACHER/ADMIN HELPER: CHECK EXAMS WITH ACTIVE IN-PROGRESS SESSIONS
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
-- 10. LEAST-PRIVILEGE RPC EXECUTION GRANTS
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
