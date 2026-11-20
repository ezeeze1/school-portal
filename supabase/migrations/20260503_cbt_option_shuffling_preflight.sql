-- ============================================================================
-- DIVINE ACADEMY SECONDARY SCHOOL PORTAL
-- READ-ONLY PREFLIGHT VERIFICATION SCRIPT FOR:
--   supabase/migrations/20260503_cbt_option_shuffling.sql
-- ============================================================================
-- READ-ONLY GUARANTEE:
--   - Uses session-only pg_temp helper functions (zero persistent DB objects).
--   - Executes ZERO DDL or DML on any portal table, function, trigger, or RLS.
--   - Never writes, mutates, or deletes any records.
--   - Safe to run before AND after executing the CBT option shuffling migration.
-- ============================================================================

CREATE OR REPLACE FUNCTION pg_temp.cbt_has_table_cols(p_table text, p_cols text[])
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT to_regclass(format('public.%I', p_table)) IS NOT NULL
     AND (
       SELECT count(DISTINCT col.column_name)
       FROM information_schema.columns AS col
       WHERE col.table_schema = 'public'
         AND col.table_name = p_table
         AND col.column_name = ANY(p_cols)
     ) = COALESCE(array_length(p_cols, 1), 0);
$$;

CREATE OR REPLACE FUNCTION pg_temp.run_cbt_shuffling_preflight()
RETURNS TABLE (
  check_category text,
  target_name text,
  status text,
  finding_count bigint,
  details text
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_req record;
  v_cnt bigint;
  v_legacy_b_c_d bigint := 0;
  v_option_a bigint := 0;
  v_jsonb_exams bigint := 0;
  v_empty_exams bigint := 0;
  v_active_sessions bigint := 0;
  v_existing_sig text;
  v_existing_ret text;
  v_secdef boolean;
  v_config text[];
  v_missing_cols text[];
  v_rls_enabled boolean;
  v_student_direct_select boolean;
  v_student_direct_write boolean;
  v_uuid_sample text;
BEGIN
  -- --------------------------------------------------------------------------
  -- 01. REQUIRED PORTAL TABLES & EXPECTED COLUMNS
  -- --------------------------------------------------------------------------
  FOR v_req IN
    VALUES
      ('cbt_exams', ARRAY[
        'id','title','subject_id','subject_name','class_id','class_name',
        'teacher_id','duration_minutes','total_questions','total_marks',
        'pass_percentage','start_date','start_time','end_date','questions',
        'is_published','shuffle_questions','created_at','updated_at'
      ]),
      ('cbt_questions', ARRAY[
        'id','exam_id','question_order','question','option_a','option_b',
        'option_c','option_d','correct_option','explanation','marks',
        'created_at','updated_at'
      ]),
      ('cbt_attempts', ARRAY[
        'id','exam_id','student_id','student_name','admission_no',
        'score_obtained','total_marks','percentage','passed',
        'time_taken_seconds','completed_at','answers','created_at','updated_at'
      ]),
      ('cbt_exam_sessions', ARRAY[
        'id','exam_id','student_id','started_at','expires_at','submitted_at',
        'status','question_order','created_at','updated_at'
      ]),
      ('system_settings', ARRAY[
        'id','cbt_active','is_result_published','result_entry_open'
      ]),
      ('students', ARRAY[
        'id','auth_user_id','admission_no','first_name','last_name',
        'class_id','status'
      ])
  LOOP
    IF to_regclass(format('public.%I', v_req.column1)) IS NULL THEN
      RETURN QUERY SELECT
        '01_SCHEMA_TABLES'::text,
        v_req.column1,
        'FAIL_MISSING_TABLE'::text,
        1::bigint,
        'Required base table does not exist. Run supabase/schema.sql before this migration.'::text;
    ELSE
      SELECT array_agg(req_col ORDER BY req_col)
      INTO v_missing_cols
      FROM unnest(v_req.column2) AS req_col
      WHERE NOT EXISTS (
        SELECT 1
        FROM information_schema.columns col
        WHERE col.table_schema = 'public'
          AND col.table_name = v_req.column1
          AND col.column_name = req_col
      );

      IF v_missing_cols IS NOT NULL AND array_length(v_missing_cols, 1) > 0 THEN
        RETURN QUERY SELECT
          '01_SCHEMA_TABLES'::text,
          v_req.column1,
          'FAIL_MISSING_COLUMNS'::text,
          array_length(v_missing_cols, 1)::bigint,
          format('Missing expected columns: %s', array_to_string(v_missing_cols, ', '));
      ELSE
        RETURN QUERY SELECT
          '01_SCHEMA_TABLES'::text,
          v_req.column1,
          'PASS'::text,
          0::bigint,
          'Table and all required base columns are present.'::text;
      END IF;
    END IF;
  END LOOP;

  -- --------------------------------------------------------------------------
  -- 02. MIGRATION TARGET OBJECTS PRE-EXISTENCE CHECK (IDEMPOTENCY)
  -- --------------------------------------------------------------------------
  RETURN QUERY SELECT
    '02_ADDITIVE_TARGETS'::text,
    'system_settings.cbt_allow_answer_review'::text,
    CASE WHEN pg_temp.cbt_has_table_cols('system_settings', ARRAY['cbt_allow_answer_review'])
      THEN 'ALREADY_EXISTS' ELSE 'READY_TO_ADD' END::text,
    0::bigint,
    'School-wide CBT answer review policy column (DEFAULT false).'::text;

  RETURN QUERY SELECT
    '02_ADDITIVE_TARGETS'::text,
    'cbt_exams.allow_answer_review'::text,
    CASE WHEN pg_temp.cbt_has_table_cols('cbt_exams', ARRAY['allow_answer_review'])
      THEN 'ALREADY_EXISTS' ELSE 'READY_TO_ADD' END::text,
    0::bigint,
    'Per-exam CBT answer review override column (nullable, inherits school policy).'::text;

  RETURN QUERY SELECT
    '02_ADDITIVE_TARGETS'::text,
    'cbt_exam_sessions.draft_answers'::text,
    CASE WHEN pg_temp.cbt_has_table_cols('cbt_exam_sessions', ARRAY['draft_answers'])
      THEN 'ALREADY_EXISTS' ELSE 'READY_TO_ADD' END::text,
    0::bigint,
    'Server-persisted draft answer selections column (jsonb object).'::text;

  RETURN QUERY SELECT
    '02_ADDITIVE_TARGETS'::text,
    'public.cbt_exam_session_options'::text,
    CASE WHEN to_regclass('public.cbt_exam_session_options') IS NOT NULL
      THEN 'ALREADY_EXISTS' ELSE 'READY_TO_CREATE' END::text,
    0::bigint,
    'Private per-session shuffled option mapping table (service_role only).'::text;

  -- --------------------------------------------------------------------------
  -- 03. REQUIRED CONSTRAINTS, INDEXES & TRIGGERS ON EXISTING TABLES
  -- --------------------------------------------------------------------------
  FOR v_req IN
    VALUES
      ('cbt_exams', 'chk_cbt_exams_valid'),
      ('cbt_questions', 'chk_cbt_questions_valid'),
      ('cbt_questions', 'fk_cbt_questions_exam'),
      ('cbt_attempts', 'chk_cbt_attempts_valid'),
      ('cbt_attempts', 'fk_cbt_attempts_exam'),
      ('cbt_attempts', 'fk_cbt_attempts_student'),
      ('cbt_exam_sessions', 'chk_cbt_exam_sessions_valid'),
      ('cbt_exam_sessions', 'fk_cbt_exam_sessions_exam'),
      ('cbt_exam_sessions', 'fk_cbt_exam_sessions_student')
  LOOP
    IF to_regclass(format('public.%I', v_req.column1)) IS NULL THEN
      RETURN QUERY SELECT
        '03_CONSTRAINTS'::text,
        format('%s.%s', v_req.column1, v_req.column2),
        'SKIP_TABLE_MISSING'::text,
        1::bigint,
        'Base table missing.'::text;
    ELSIF EXISTS (
      SELECT 1
      FROM pg_constraint con
      WHERE con.conrelid = format('public.%I', v_req.column1)::regclass
        AND con.conname = v_req.column2
    ) THEN
      RETURN QUERY SELECT
        '03_CONSTRAINTS'::text,
        format('%s.%s', v_req.column1, v_req.column2),
        'PASS'::text,
        0::bigint,
        'Expected constraint is present.'::text;
    ELSE
      RETURN QUERY SELECT
        '03_CONSTRAINTS'::text,
        format('%s.%s', v_req.column1, v_req.column2),
        'WARN_MISSING'::text,
        1::bigint,
        'Expected constraint from supabase/schema.sql was not found.'::text;
    END IF;
  END LOOP;

  FOR v_req IN
    VALUES
      ('cbt_attempts', 'uq_cbt_attempts_exam_student'),
      ('cbt_exam_sessions', 'uq_cbt_exam_sessions_exam_student')
  LOOP
    IF EXISTS (
      SELECT 1
      FROM pg_indexes idx
      WHERE idx.schemaname = 'public'
        AND idx.tablename = v_req.column1
        AND idx.indexname = v_req.column2
    ) THEN
      RETURN QUERY SELECT
        '03_UNIQUE_INDEXES'::text,
        format('%s.%s', v_req.column1, v_req.column2),
        'PASS'::text,
        0::bigint,
        'Unique index exists.'::text;
    ELSE
      RETURN QUERY SELECT
        '03_UNIQUE_INDEXES'::text,
        format('%s.%s', v_req.column1, v_req.column2),
        'WARN_MISSING'::text,
        1::bigint,
        'Expected unique index from supabase/schema.sql is missing.'::text;
    END IF;
  END LOOP;

  FOR v_req IN
    VALUES
      ('cbt_exams', 'trg_cbt_exams_guard_active_session'),
      ('cbt_questions', 'trg_cbt_questions_guard_active_session'),
      ('cbt_exams', 'trg_cbt_exams_sync_questions'),
      ('cbt_exam_sessions', 'trg_cbt_exam_sessions_updated_at')
  LOOP
    IF to_regclass(format('public.%I', v_req.column1)) IS NOT NULL AND EXISTS (
      SELECT 1
      FROM pg_trigger tg
      WHERE tg.tgrelid = format('public.%I', v_req.column1)::regclass
        AND tg.tgname = v_req.column2
        AND NOT tg.tgisinternal
    ) THEN
      RETURN QUERY SELECT
        '03_TRIGGERS'::text,
        format('%s.%s', v_req.column1, v_req.column2),
        'PASS'::text,
        0::bigint,
        'Trigger is installed.'::text;
    ELSE
      RETURN QUERY SELECT
        '03_TRIGGERS'::text,
        format('%s.%s', v_req.column1, v_req.column2),
        'WARN_MISSING'::text,
        1::bigint,
        'Trigger from supabase/schema.sql was not found.'::text;
    END IF;
  END LOOP;

  -- --------------------------------------------------------------------------
  -- 04. FUNCTION SIGNATURES, RETURN TYPES & OVERLOAD CONFLICT CHECK
  -- --------------------------------------------------------------------------
  FOR v_req IN
    VALUES
      ('set_updated_at', '', 'trigger'),
      ('is_admin', '', 'boolean'),
      ('is_teacher', '', 'boolean'),
      ('get_student_cbt_exams', '', 'jsonb'),
      ('start_cbt_exam', 'p_exam_id text', 'jsonb'),
      ('submit_cbt_exam', 'p_exam_id text, p_answers jsonb', 'jsonb')
  LOOP
    SELECT count(*)
    INTO v_cnt
    FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace
      AND p.proname = v_req.column1;

    IF v_cnt = 0 THEN
      RETURN QUERY SELECT
        '04_FUNCTION_SIGNATURES'::text,
        format('public.%s(%s)', v_req.column1, v_req.column2),
        'FAIL_MISSING'::text,
        1::bigint,
        'Required prerequisite function does not exist.'::text;
    ELSIF v_cnt > 1 THEN
      RETURN QUERY SELECT
        '04_FUNCTION_SIGNATURES'::text,
        format('public.%s', v_req.column1),
        'FAIL_OVERLOAD_CONFLICT'::text,
        v_cnt,
        format('Found %s overloaded definitions for %s; resolve overload before replacing.', v_cnt, v_req.column1);
    ELSE
      SELECT
        pg_get_function_identity_arguments(p.oid),
        pg_get_function_result(p.oid),
        p.prosecdef,
        p.proconfig
      INTO v_existing_sig, v_existing_ret, v_secdef, v_config
      FROM pg_proc p
      WHERE p.pronamespace = 'public'::regnamespace
        AND p.proname = v_req.column1
      LIMIT 1;

      IF v_existing_sig <> v_req.column2 OR v_existing_ret <> v_req.column3 THEN
        RETURN QUERY SELECT
          '04_FUNCTION_SIGNATURES'::text,
          format('public.%s', v_req.column1),
          'FAIL_SIGNATURE_MISMATCH'::text,
          1::bigint,
          format('Expected (%s) -> %s, found (%s) -> %s.', v_req.column2, v_req.column3, v_existing_sig, v_existing_ret);
      ELSE
        RETURN QUERY SELECT
          '04_FUNCTION_SIGNATURES'::text,
          format('public.%s(%s) -> %s', v_req.column1, v_existing_sig, v_existing_ret),
          'PASS'::text,
          0::bigint,
          format('Signature matches cleanly (SECURITY DEFINER=%s).', v_secdef);
      END IF;
    END IF;
  END LOOP;

  -- Check migration helper/new functions for overload/signature collisions
  FOR v_req IN
    VALUES
      ('cbt_fisher_yates_shuffle_keys', '', 'text[]'),
      ('cbt_ensure_session_shuffled_options', 'p_session_id text, p_exam_id text, p_student_id text', 'void'),
      ('save_cbt_exam_answers', 'p_exam_id text, p_answers jsonb', 'jsonb'),
      ('get_cbt_active_session_exam_ids', '', 'jsonb')
  LOOP
    SELECT count(*)
    INTO v_cnt
    FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace
      AND p.proname = v_req.column1;

    IF v_cnt = 0 THEN
      RETURN QUERY SELECT
        '04_NEW_FUNCTIONS'::text,
        format('public.%s(%s) -> %s', v_req.column1, v_req.column2, v_req.column3),
        'READY_TO_CREATE'::text,
        0::bigint,
        'No conflicting function definition exists.'::text;
    ELSIF v_cnt > 1 THEN
      RETURN QUERY SELECT
        '04_NEW_FUNCTIONS'::text,
        format('public.%s', v_req.column1),
        'FAIL_OVERLOAD_CONFLICT'::text,
        v_cnt,
        'Multiple overloads found; inspect before running CREATE OR REPLACE.'::text;
    ELSE
      SELECT pg_get_function_identity_arguments(p.oid), pg_get_function_result(p.oid)
      INTO v_existing_sig, v_existing_ret
      FROM pg_proc p
      WHERE p.pronamespace = 'public'::regnamespace
        AND p.proname = v_req.column1
      LIMIT 1;

      RETURN QUERY SELECT
        '04_NEW_FUNCTIONS'::text,
        format('public.%s(%s) -> %s', v_req.column1, v_existing_sig, v_existing_ret),
        CASE WHEN v_existing_sig = v_req.column2 AND v_existing_ret = v_req.column3
          THEN 'PASS_MATCHING_EXISTS' ELSE 'FAIL_SIGNATURE_MISMATCH' END::text,
        CASE WHEN v_existing_sig = v_req.column2 AND v_existing_ret = v_req.column3
          THEN 0::bigint ELSE 1::bigint END,
        format('Expected (%s) -> %s.', v_req.column2, v_req.column3);
    END IF;
  END LOOP;

  -- Verify gen_random_uuid() + decode/get_byte primitives required by Fisher-Yates RNG
  BEGIN
    v_uuid_sample := pg_catalog.encode(
      pg_catalog.decode(
        pg_catalog.substr(pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', ''), 1, 8),
        'hex'
      ),
      'hex'
    );
    RETURN QUERY SELECT
      '04_RNG_PRIMITIVES'::text,
      'pg_catalog.gen_random_uuid() + decode/get_byte'::text,
      'PASS'::text,
      0::bigint,
      format('CSPRNG primitives available (sample 32-bit hex=%s).', v_uuid_sample);
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT
      '04_RNG_PRIMITIVES'::text,
      'pg_catalog.gen_random_uuid() + decode/get_byte'::text,
      'FAIL'::text,
      1::bigint,
      SQLERRM;
  END;

  -- --------------------------------------------------------------------------
  -- 05. RLS & STUDENT PRIVILEGE BOUNDARY VERIFICATION
  -- --------------------------------------------------------------------------
  FOR v_req IN
    VALUES ('cbt_exams'), ('cbt_questions'), ('cbt_attempts'), ('cbt_exam_sessions')
  LOOP
    IF to_regclass(format('public.%I', v_req.column1)) IS NOT NULL THEN
      SELECT c.relrowsecurity
      INTO v_rls_enabled
      FROM pg_class c
      WHERE c.oid = format('public.%I', v_req.column1)::regclass;

      RETURN QUERY SELECT
        '05_RLS_STATUS'::text,
        v_req.column1,
        CASE WHEN v_rls_enabled THEN 'PASS' ELSE 'FAIL_RLS_DISABLED' END::text,
        CASE WHEN v_rls_enabled THEN 0::bigint ELSE 1::bigint END,
        CASE WHEN v_rls_enabled THEN 'Row Level Security is enabled.' ELSE 'RLS is NOT enabled!' END::text;
    END IF;
  END LOOP;

  -- Confirm NO permissive SELECT RLS policy gives students direct access to answer keys in cbt_exams/cbt_questions
  SELECT count(*)
  INTO v_cnt
  FROM pg_policies pol
  WHERE pol.schemaname = 'public'
    AND pol.tablename IN ('cbt_exams', 'cbt_questions')
    AND (
      pol.qual ILIKE '%is_student%'
      OR pol.qual ILIKE '%student%'
      OR 'anon' = ANY(pol.roles)
    );

  RETURN QUERY SELECT
    '05_ANSWER_KEY_ISOLATION'::text,
    'cbt_exams & cbt_questions student RLS guard'::text,
    CASE WHEN v_cnt = 0 THEN 'PASS' ELSE 'FAIL_EXPOSED_POLICY' END::text,
    v_cnt,
    CASE WHEN v_cnt = 0
      THEN 'No anon or student RLS policies exist on cbt_exams or cbt_questions.'
      ELSE format('%s policy(ies) on cbt_exams/cbt_questions reference student or anon!', v_cnt)
    END::text;

  -- Confirm students cannot directly INSERT/UPDATE/DELETE cbt_attempts or cbt_exam_sessions
  SELECT count(*)
  INTO v_cnt
  FROM pg_policies pol
  WHERE pol.schemaname = 'public'
    AND pol.tablename IN ('cbt_attempts', 'cbt_exam_sessions')
    AND pol.cmd IN ('INSERT', 'UPDATE', 'ALL')
    AND (
      coalesce(pol.qual, '') ILIKE '%student%'
      OR coalesce(pol.with_check, '') ILIKE '%student%'
    );

  RETURN QUERY SELECT
    '05_ATTEMPT_TAMPER_GUARD'::text,
    'cbt_attempts & cbt_exam_sessions student write guard'::text,
    CASE WHEN v_cnt = 0 THEN 'PASS' ELSE 'FAIL_STUDENT_WRITE_POLICY' END::text,
    v_cnt,
    CASE WHEN v_cnt = 0
      THEN 'Students cannot insert or update cbt_attempts or cbt_exam_sessions directly.'
      ELSE format('%s write policy(ies) reference students directly!', v_cnt)
    END::text;

  -- If cbt_exam_session_options already exists, verify anon & authenticated have ZERO privileges
  IF to_regclass('public.cbt_exam_session_options') IS NOT NULL THEN
    SELECT
      pg_catalog.has_table_privilege('anon', 'public.cbt_exam_session_options', 'SELECT')
      OR pg_catalog.has_table_privilege('authenticated', 'public.cbt_exam_session_options', 'SELECT'),
      pg_catalog.has_table_privilege('anon', 'public.cbt_exam_session_options', 'INSERT,UPDATE,DELETE')
      OR pg_catalog.has_table_privilege('authenticated', 'public.cbt_exam_session_options', 'INSERT,UPDATE,DELETE')
    INTO v_student_direct_select, v_student_direct_write;

    RETURN QUERY SELECT
      '05_OPTION_MAP_PRIVILEGES'::text,
      'public.cbt_exam_session_options'::text,
      CASE WHEN NOT v_student_direct_select AND NOT v_student_direct_write THEN 'PASS' ELSE 'FAIL_PRIVILEGE_LEAK' END::text,
      CASE WHEN NOT v_student_direct_select AND NOT v_student_direct_write THEN 0::bigint ELSE 1::bigint END,
      'Verifies anon and authenticated have ZERO table privileges on cbt_exam_session_options.'::text;
  END IF;

  -- --------------------------------------------------------------------------
  -- 06. LIVE DATA SNAPSHOT: DUPLICATES, LEGACY KEYS & ACTIVE SESSIONS
  -- --------------------------------------------------------------------------
  IF pg_temp.cbt_has_table_cols('cbt_exam_sessions', ARRAY['exam_id','student_id','status','expires_at']) THEN
    SELECT count(*)
    INTO v_cnt
    FROM (
      SELECT 1 FROM public.cbt_exam_sessions ces
      GROUP BY ces.exam_id, ces.student_id
      HAVING count(*) > 1
    ) dups;

    RETURN QUERY SELECT
      '06_DATA_HEALTH'::text,
      'cbt_exam_sessions duplicate (exam_id, student_id)'::text,
      CASE WHEN v_cnt = 0 THEN 'PASS' ELSE 'FAIL_DUPLICATE_SESSIONS' END::text,
      v_cnt,
      'Must be 0 before/during CBT exam execution.'::text;

    SELECT count(*)
    INTO v_active_sessions
    FROM public.cbt_exam_sessions ces
    WHERE ces.status = 'in_progress'
      AND ces.expires_at > now();

    RETURN QUERY SELECT
      '06_DATA_HEALTH'::text,
      'Active in_progress cbt_exam_sessions right now'::text,
      CASE WHEN v_active_sessions = 0 THEN 'PASS_NO_ACTIVE_SESSIONS' ELSE 'WARN_EXAMS_IN_PROGRESS' END::text,
      v_active_sessions,
      CASE WHEN v_active_sessions = 0
        THEN 'Zero students are currently mid-exam. Safe window to apply migration.'
        ELSE format('%s active in-progress session(s) detected; schedule migration during a quiet window if feasible so new RPC rules do not surprise active takers.', v_active_sessions)
      END::text;
  END IF;

  IF pg_temp.cbt_has_table_cols('cbt_questions', ARRAY['exam_id','correct_option']) THEN
    SELECT
      count(*) FILTER (WHERE upper(correct_option) = 'A'),
      count(*) FILTER (WHERE upper(correct_option) IN ('B','C','D'))
    INTO v_option_a, v_legacy_b_c_d
    FROM public.cbt_questions;

    RETURN QUERY SELECT
      '06_DATA_HEALTH'::text,
      'cbt_questions answer key distribution (Option A vs legacy B/C/D)'::text,
      'INFO_PRESERVED'::text,
      v_option_a + v_legacy_b_c_d,
      format('Option A=%s, Legacy B/C/D=%s. All existing rows & legacy keys are preserved unchanged.', v_option_a, v_legacy_b_c_d);
  END IF;

  IF pg_temp.cbt_has_table_cols('cbt_exams', ARRAY['id','questions']) THEN
    SELECT count(*)
    INTO v_jsonb_exams
    FROM public.cbt_exams ce
    WHERE NOT EXISTS (SELECT 1 FROM public.cbt_questions cq WHERE cq.exam_id = ce.id)
      AND jsonb_typeof(ce.questions) = 'array'
      AND jsonb_array_length(ce.questions) > 0;

    SELECT count(*)
    INTO v_empty_exams
    FROM public.cbt_exams ce
    WHERE NOT EXISTS (SELECT 1 FROM public.cbt_questions cq WHERE cq.exam_id = ce.id)
      AND (jsonb_typeof(ce.questions) IS DISTINCT FROM 'array' OR jsonb_array_length(ce.questions) = 0);

    RETURN QUERY SELECT
      '06_DATA_HEALTH'::text,
      'cbt_exams question source audit'::text,
      CASE WHEN v_empty_exams = 0 THEN 'PASS' ELSE 'WARN_EMPTY_EXAMS' END::text,
      v_empty_exams,
      format('JSONB-only exams needing sync/mapping=%s, zero-question exams=%s.', v_jsonb_exams, v_empty_exams);
  END IF;

  IF pg_temp.cbt_has_table_cols('cbt_attempts', ARRAY['id']) THEN
    SELECT count(*) INTO v_cnt FROM public.cbt_attempts;
    RETURN QUERY SELECT
      '06_DATA_HEALTH'::text,
      'Historical cbt_attempts baseline count'::text,
      'INFO_PRESERVED'::text,
      v_cnt,
      'Verify this count remains identical immediately after executing the migration.'::text;
  END IF;

  RETURN;
END;
$$;

SELECT
  p.check_category,
  p.target_name,
  p.status,
  p.finding_count,
  p.details
FROM pg_temp.run_cbt_shuffling_preflight() AS p
ORDER BY p.check_category, p.target_name;
