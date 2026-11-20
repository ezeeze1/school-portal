-- ============================================================================
-- DIVINE ACADEMY SECONDARY SCHOOL PORTAL
-- SINGLE-STATEMENT READ-ONLY VERIFICATION SQL FOR:
--   supabase/migrations/20260503_cbt_option_shuffling.sql
-- ============================================================================
-- WHY THIS FILE IS A SINGLE `WITH ... SELECT` STATEMENT:
--   Supabase SQL Editor's multi-statement handler can return "Success. No rows
--   returned." when DDL statements (like CREATE FUNCTION pg_temp...) precede a
--   SELECT. This standalone single SELECT statement avoids DDL/pg_temp
--   completely, modifies ZERO permanent or temporary database objects, and
--   returns a full PASS / FAIL / WARN report table directly in Supabase.
-- ============================================================================

WITH
required_tables(tbl_name) AS (
  VALUES
    ('cbt_exams'),
    ('cbt_questions'),
    ('cbt_attempts'),
    ('cbt_exam_sessions'),
    ('system_settings'),
    ('students'),
    ('subjects'),
    ('classes'),
    ('teachers')
),
table_checks AS (
  SELECT
    10 AS sort_order,
    '01_REQUIRED_TABLES'::text AS check_category,
    ('public.' || rt.tbl_name)::text AS target_name,
    CASE
      WHEN to_regclass('public.' || rt.tbl_name) IS NOT NULL THEN 'PASS'
      ELSE 'FAIL'
    END::text AS status,
    CASE
      WHEN to_regclass('public.' || rt.tbl_name) IS NOT NULL THEN 0::bigint
      ELSE 1::bigint
    END AS finding_count,
    CASE
      WHEN to_regclass('public.' || rt.tbl_name) IS NOT NULL
        THEN 'Required table exists in public schema.'
      ELSE 'Missing required table. Execute supabase/schema.sql before this migration.'
    END::text AS details
  FROM required_tables rt
),
required_columns(tbl_name, req_cols) AS (
  VALUES
    ('cbt_exam_sessions', ARRAY[
      'id','exam_id','student_id','started_at','expires_at','submitted_at',
      'status','question_order','created_at','updated_at'
    ]),
    ('cbt_exams', ARRAY[
      'id','title','subject_id','subject_name','class_id','class_name',
      'teacher_id','term','session','duration_minutes','total_questions',
      'total_marks','pass_percentage','start_date','start_time','end_date',
      'questions','is_published','shuffle_questions','created_at','updated_at'
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
    ('system_settings', ARRAY[
      'id','cbt_active','is_result_published','result_entry_open'
    ]),
    ('students', ARRAY[
      'id','auth_user_id','admission_no','first_name','last_name',
      'class_id','status'
    ]),
    ('subjects', ARRAY['id']),
    ('classes', ARRAY['id']),
    ('teachers', ARRAY['id'])
),
column_checks AS (
  SELECT
    20 AS sort_order,
    '02_REQUIRED_COLUMNS'::text AS check_category,
    ('public.' || rc.tbl_name)::text AS target_name,
    CASE
      WHEN to_regclass('public.' || rc.tbl_name) IS NULL THEN 'FAIL'
      WHEN missing.missing_list IS NOT NULL THEN 'FAIL'
      ELSE 'PASS'
    END::text AS status,
    CASE
      WHEN to_regclass('public.' || rc.tbl_name) IS NULL THEN array_length(rc.req_cols, 1)::bigint
      ELSE COALESCE(missing.missing_count, 0::bigint)
    END AS finding_count,
    CASE
      WHEN to_regclass('public.' || rc.tbl_name) IS NULL
        THEN 'Table does not exist; cannot verify columns.'
      WHEN missing.missing_list IS NOT NULL
        THEN 'Missing required column(s): ' || missing.missing_list
      ELSE format('All %s required columns exist.', array_length(rc.req_cols, 1))
    END::text AS details
  FROM required_columns rc
  LEFT JOIN LATERAL (
    SELECT
      count(*)::bigint AS missing_count,
      string_agg(col_req, ', ' ORDER BY col_req) AS missing_list
    FROM unnest(rc.req_cols) AS col_req
    WHERE NOT EXISTS (
      SELECT 1
      FROM information_schema.columns c
      WHERE c.table_schema = 'public'
        AND c.table_name = rc.tbl_name
        AND c.column_name = col_req
    )
  ) AS missing ON true
),
rpc_specs(fn_name, expected_args, expected_ret) AS (
  VALUES
    ('start_cbt_exam', 'p_exam_id text', 'jsonb'),
    ('submit_cbt_exam', 'p_exam_id text, p_answers jsonb', 'jsonb'),
    ('get_student_cbt_exams', '', 'jsonb')
),
rpc_checks AS (
  SELECT
    30 AS sort_order,
    '03_RPC_SIGNATURES'::text AS check_category,
    format('public.%s(%s) -> %s', rs.fn_name, rs.expected_args, rs.expected_ret)::text AS target_name,
    CASE
      WHEN stats.fn_count = 1
       AND stats.actual_args = rs.expected_args
       AND stats.actual_ret = rs.expected_ret
        THEN 'PASS'
      ELSE 'FAIL'
    END::text AS status,
    CASE
      WHEN stats.fn_count = 1
       AND stats.actual_args = rs.expected_args
       AND stats.actual_ret = rs.expected_ret
        THEN 0::bigint
      ELSE 1::bigint
    END AS finding_count,
    CASE
      WHEN stats.fn_count = 0
        THEN 'Existing CBT RPC not found; install supabase/schema.sql first.'
      WHEN stats.fn_count > 1
        THEN format('Found %s overloaded definitions for %s; resolve overload before replacing.', stats.fn_count, rs.fn_name)
      WHEN stats.actual_args <> rs.expected_args OR stats.actual_ret <> rs.expected_ret
        THEN format('Signature mismatch: found (%s) -> %s.', stats.actual_args, stats.actual_ret)
      ELSE format('Compatible signature verified (SECURITY DEFINER=%s).', stats.is_secdef)
    END::text AS details
  FROM rpc_specs rs
  LEFT JOIN LATERAL (
    SELECT
      count(*)::bigint AS fn_count,
      max(pg_catalog.pg_get_function_identity_arguments(p.oid)) AS actual_args,
      max(pg_catalog.pg_get_function_result(p.oid)) AS actual_ret,
      bool_and(p.prosecdef) AS is_secdef
    FROM pg_catalog.pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace
      AND p.proname = rs.fn_name
  ) AS stats ON true

  UNION ALL

  SELECT
    31 AS sort_order,
    '03_RPC_SIGNATURES'::text AS check_category,
    'pg_catalog.gen_random_uuid() + decode/get_byte'::text AS target_name,
    CASE
      WHEN pg_catalog.get_byte(
        pg_catalog.decode(
          pg_catalog.substr(pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', ''), 1, 8),
          'hex'
        ),
        0
      ) BETWEEN 0 AND 255 THEN 'PASS'
      ELSE 'FAIL'
    END::text AS status,
    0::bigint AS finding_count,
    'CSPRNG byte extraction primitives for Fisher-Yates shuffle are working.'::text AS details
),
helper_specs(fn_name, expected_args, expected_ret) AS (
  VALUES
    ('set_updated_at', '', 'trigger'),
    ('is_admin', '', 'boolean'),
    ('is_teacher', '', 'boolean'),
    ('is_student_owner', 'target_student_id text', 'boolean'),
    ('student_in_class', 'target_class_id text', 'boolean'),
    ('current_app_role', '', 'text'),
    ('sync_cbt_questions_from_exam', '', 'trigger'),
    ('guard_cbt_exam_active_session', '', 'trigger'),
    ('guard_cbt_question_active_session', '', 'trigger')
),
helper_checks AS (
  SELECT
    40 AS sort_order,
    '04_TRIGGERS_AND_HELPERS'::text AS check_category,
    format('function: public.%s(%s) -> %s', hs.fn_name, hs.expected_args, hs.expected_ret)::text AS target_name,
    CASE
      WHEN stats.fn_count = 1
       AND stats.actual_args = hs.expected_args
       AND stats.actual_ret = hs.expected_ret
        THEN 'PASS'
      ELSE 'FAIL'
    END::text AS status,
    CASE
      WHEN stats.fn_count = 1
       AND stats.actual_args = hs.expected_args
       AND stats.actual_ret = hs.expected_ret
        THEN 0::bigint
      ELSE 1::bigint
    END AS finding_count,
    CASE
      WHEN stats.fn_count = 0
        THEN 'Required helper/trigger function is missing.'
      WHEN stats.fn_count > 1
        THEN format('Found %s overloaded definitions for %s.', stats.fn_count, hs.fn_name)
      WHEN stats.actual_args <> hs.expected_args OR stats.actual_ret <> hs.expected_ret
        THEN format('Expected (%s) -> %s, found (%s) -> %s.', hs.expected_args, hs.expected_ret, stats.actual_args, stats.actual_ret)
      ELSE 'Helper function exists with compatible signature.'
    END::text AS details
  FROM helper_specs hs
  LEFT JOIN LATERAL (
    SELECT
      count(*)::bigint AS fn_count,
      max(pg_catalog.pg_get_function_identity_arguments(p.oid)) AS actual_args,
      max(pg_catalog.pg_get_function_result(p.oid)) AS actual_ret
    FROM pg_catalog.pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace
      AND p.proname = hs.fn_name
  ) AS stats ON true
),
trigger_specs(tbl_name, trg_name) AS (
  VALUES
    ('cbt_exams', 'trg_cbt_exams_guard_active_session'),
    ('cbt_exams', 'trg_cbt_exams_sync_questions'),
    ('cbt_exams', 'trg_cbt_exams_updated_at'),
    ('cbt_questions', 'trg_cbt_questions_guard_active_session'),
    ('cbt_questions', 'trg_cbt_questions_updated_at'),
    ('cbt_attempts', 'trg_cbt_attempts_updated_at'),
    ('cbt_exam_sessions', 'trg_cbt_exam_sessions_updated_at'),
    ('system_settings', 'trg_system_settings_updated_at')
),
trigger_checks AS (
  SELECT
    41 AS sort_order,
    '04_TRIGGERS_AND_HELPERS'::text AS check_category,
    format('trigger: public.%s.%s', ts.tbl_name, ts.trg_name)::text AS target_name,
    CASE
      WHEN to_regclass('public.' || ts.tbl_name) IS NOT NULL AND exists_info.trg_count > 0
        THEN 'PASS'
      ELSE 'FAIL'
    END::text AS status,
    CASE
      WHEN to_regclass('public.' || ts.tbl_name) IS NOT NULL AND exists_info.trg_count > 0
        THEN 0::bigint
      ELSE 1::bigint
    END AS finding_count,
    CASE
      WHEN to_regclass('public.' || ts.tbl_name) IS NULL
        THEN 'Base table missing; trigger cannot be verified.'
      WHEN exists_info.trg_count > 0
        THEN 'Required trigger is installed and active.'
      ELSE 'Expected trigger from supabase/schema.sql was not found.'
    END::text AS details
  FROM trigger_specs ts
  LEFT JOIN LATERAL (
    SELECT count(*)::bigint AS trg_count
    FROM pg_catalog.pg_trigger tg
    WHERE tg.tgrelid = to_regclass('public.' || ts.tbl_name)
      AND tg.tgname = ts.trg_name
      AND NOT tg.tgisinternal
  ) AS exists_info ON true
),
rls_tables(tbl_name) AS (
  VALUES
    ('cbt_exams'),
    ('cbt_questions'),
    ('cbt_attempts'),
    ('cbt_exam_sessions'),
    ('system_settings'),
    ('students')
),
rls_checks AS (
  SELECT
    50 AS sort_order,
    '05_RLS_POLICIES'::text AS check_category,
    ('rls_enabled: public.' || rt.tbl_name)::text AS target_name,
    CASE
      WHEN to_regclass('public.' || rt.tbl_name) IS NOT NULL
       AND COALESCE(cls.relrowsecurity, false)
       AND COALESCE(pol.pol_count, 0) > 0
        THEN 'PASS'
      ELSE 'FAIL'
    END::text AS status,
    CASE
      WHEN to_regclass('public.' || rt.tbl_name) IS NOT NULL
       AND COALESCE(cls.relrowsecurity, false)
       AND COALESCE(pol.pol_count, 0) > 0
        THEN 0::bigint
      ELSE 1::bigint
    END AS finding_count,
    CASE
      WHEN to_regclass('public.' || rt.tbl_name) IS NULL
        THEN 'Table missing; RLS cannot be checked.'
      WHEN NOT COALESCE(cls.relrowsecurity, false)
        THEN 'Row Level Security is DISABLED on this table!'
      WHEN COALESCE(pol.pol_count, 0) = 0
        THEN 'RLS is enabled but 0 policies exist.'
      ELSE format('RLS enabled with %s active policy(ies).', pol.pol_count)
    END::text AS details
  FROM rls_tables rt
  LEFT JOIN pg_catalog.pg_class cls
    ON cls.oid = to_regclass('public.' || rt.tbl_name)
  LEFT JOIN LATERAL (
    SELECT count(*)::bigint AS pol_count
    FROM pg_catalog.pg_policies p
    WHERE p.schemaname = 'public'
      AND p.tablename = rt.tbl_name
  ) AS pol ON true

  UNION ALL

  SELECT
    51 AS sort_order,
    '05_RLS_POLICIES'::text AS check_category,
    'isolation: cbt_exams & cbt_questions student/anon guard'::text AS target_name,
    CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END::text AS status,
    count(*)::bigint AS finding_count,
    CASE
      WHEN count(*) = 0
        THEN 'No anon or student RLS policy exposes answer keys in cbt_exams or cbt_questions.'
      ELSE format('%s policy(ies) on cbt_exams/cbt_questions reference student or anon!', count(*))
    END::text AS details
  FROM pg_catalog.pg_policies p
  WHERE p.schemaname = 'public'
    AND p.tablename IN ('cbt_exams', 'cbt_questions')
    AND (
      'anon' = ANY(p.roles)
      OR COALESCE(p.qual, '') ~* 'student'
      OR COALESCE(p.with_check, '') ~* 'student'
    )

  UNION ALL

  SELECT
    52 AS sort_order,
    '05_RLS_POLICIES'::text AS check_category,
    'write_guard: cbt_attempts & cbt_exam_sessions student write block'::text AS target_name,
    CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END::text AS status,
    count(*)::bigint AS finding_count,
    CASE
      WHEN count(*) = 0
        THEN 'Students have zero direct INSERT/UPDATE/DELETE RLS policies on cbt_attempts or cbt_exam_sessions.'
      ELSE format('%s write policy(ies) on cbt_attempts/cbt_exam_sessions reference student!', count(*))
    END::text AS details
  FROM pg_catalog.pg_policies p
  WHERE p.schemaname = 'public'
    AND p.tablename IN ('cbt_attempts', 'cbt_exam_sessions')
    AND p.cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
    AND (
      COALESCE(p.qual, '') ~* 'student'
      OR COALESCE(p.with_check, '') ~* 'student'
    )
),
new_fn_specs(fn_name, expected_args, expected_ret) AS (
  VALUES
    ('cbt_fisher_yates_shuffle_keys', '', 'text[]'),
    ('cbt_ensure_session_shuffled_options', 'p_session_id text, p_exam_id text, p_student_id text', 'void'),
    ('save_cbt_exam_answers', 'p_exam_id text, p_answers jsonb', 'jsonb'),
    ('get_cbt_active_session_exam_ids', '', 'jsonb')
),
additive_col_specs(tbl_name, col_name, expected_type) AS (
  VALUES
    ('system_settings', 'cbt_allow_answer_review', 'boolean'),
    ('cbt_exams', 'allow_answer_review', 'boolean'),
    ('cbt_exam_sessions', 'draft_answers', 'jsonb')
),
conflict_checks AS (
  SELECT
    60 AS sort_order,
    '06_CONFLICTING_OBJECTS'::text AS check_category,
    'table: public.cbt_exam_session_options'::text AS target_name,
    CASE
      WHEN to_regclass('public.cbt_exam_session_options') IS NULL THEN 'PASS'
      WHEN NOT (
        pg_catalog.has_table_privilege('anon', 'public.cbt_exam_session_options', 'SELECT')
        OR pg_catalog.has_table_privilege('anon', 'public.cbt_exam_session_options', 'INSERT')
        OR pg_catalog.has_table_privilege('anon', 'public.cbt_exam_session_options', 'UPDATE')
        OR pg_catalog.has_table_privilege('anon', 'public.cbt_exam_session_options', 'DELETE')
        OR pg_catalog.has_table_privilege('authenticated', 'public.cbt_exam_session_options', 'SELECT')
        OR pg_catalog.has_table_privilege('authenticated', 'public.cbt_exam_session_options', 'INSERT')
        OR pg_catalog.has_table_privilege('authenticated', 'public.cbt_exam_session_options', 'UPDATE')
        OR pg_catalog.has_table_privilege('authenticated', 'public.cbt_exam_session_options', 'DELETE')
      )
       AND EXISTS (SELECT 1 FROM pg_catalog.pg_class c WHERE c.oid = to_regclass('public.cbt_exam_session_options') AND c.relkind = 'r')
        THEN 'PASS'
      ELSE 'FAIL'
    END::text AS status,
    CASE
      WHEN to_regclass('public.cbt_exam_session_options') IS NULL THEN 0::bigint
      WHEN NOT (
        pg_catalog.has_table_privilege('anon', 'public.cbt_exam_session_options', 'SELECT')
        OR pg_catalog.has_table_privilege('anon', 'public.cbt_exam_session_options', 'INSERT')
        OR pg_catalog.has_table_privilege('anon', 'public.cbt_exam_session_options', 'UPDATE')
        OR pg_catalog.has_table_privilege('anon', 'public.cbt_exam_session_options', 'DELETE')
        OR pg_catalog.has_table_privilege('authenticated', 'public.cbt_exam_session_options', 'SELECT')
        OR pg_catalog.has_table_privilege('authenticated', 'public.cbt_exam_session_options', 'INSERT')
        OR pg_catalog.has_table_privilege('authenticated', 'public.cbt_exam_session_options', 'UPDATE')
        OR pg_catalog.has_table_privilege('authenticated', 'public.cbt_exam_session_options', 'DELETE')
      )
       AND EXISTS (SELECT 1 FROM pg_catalog.pg_class c WHERE c.oid = to_regclass('public.cbt_exam_session_options') AND c.relkind = 'r')
        THEN 0::bigint
      ELSE 1::bigint
    END AS finding_count,
    CASE
      WHEN to_regclass('public.cbt_exam_session_options') IS NULL
        THEN 'No conflicting object exists; ready to create.'
      WHEN (
        pg_catalog.has_table_privilege('anon', 'public.cbt_exam_session_options', 'SELECT')
        OR pg_catalog.has_table_privilege('anon', 'public.cbt_exam_session_options', 'INSERT')
        OR pg_catalog.has_table_privilege('anon', 'public.cbt_exam_session_options', 'UPDATE')
        OR pg_catalog.has_table_privilege('anon', 'public.cbt_exam_session_options', 'DELETE')
        OR pg_catalog.has_table_privilege('authenticated', 'public.cbt_exam_session_options', 'SELECT')
        OR pg_catalog.has_table_privilege('authenticated', 'public.cbt_exam_session_options', 'INSERT')
        OR pg_catalog.has_table_privilege('authenticated', 'public.cbt_exam_session_options', 'UPDATE')
        OR pg_catalog.has_table_privilege('authenticated', 'public.cbt_exam_session_options', 'DELETE')
      )
        THEN 'Existing public.cbt_exam_session_options grants privileges to anon/authenticated!'
      ELSE 'Already exists as a locked-down table (idempotent rerun safe).'
    END::text AS details

  UNION ALL

  SELECT
    61 AS sort_order,
    '06_CONFLICTING_OBJECTS'::text AS check_category,
    format('column: public.%s.%s (%s)', ac.tbl_name, ac.col_name, ac.expected_type)::text AS target_name,
    CASE
      WHEN existing.data_type IS NULL THEN 'PASS'
      WHEN existing.data_type = ac.expected_type THEN 'PASS'
      ELSE 'FAIL'
    END::text AS status,
    CASE
      WHEN existing.data_type IS NULL OR existing.data_type = ac.expected_type THEN 0::bigint
      ELSE 1::bigint
    END AS finding_count,
    CASE
      WHEN existing.data_type IS NULL
        THEN 'No conflicting column exists; ready to add.'
      WHEN existing.data_type = ac.expected_type
        THEN format('Already exists with compatible type (%s).', existing.data_type)
      ELSE format('Conflicting column type found: %s (expected %s).', existing.data_type, ac.expected_type)
    END::text AS details
  FROM additive_col_specs ac
  LEFT JOIN information_schema.columns existing
    ON existing.table_schema = 'public'
   AND existing.table_name = ac.tbl_name
   AND existing.column_name = ac.col_name

  UNION ALL

  SELECT
    62 AS sort_order,
    '06_CONFLICTING_OBJECTS'::text AS check_category,
    format('function: public.%s(%s) -> %s', nf.fn_name, nf.expected_args, nf.expected_ret)::text AS target_name,
    CASE
      WHEN stats.fn_count = 0 THEN 'PASS'
      WHEN stats.fn_count = 1 AND stats.actual_args = nf.expected_args AND stats.actual_ret = nf.expected_ret THEN 'PASS'
      ELSE 'FAIL'
    END::text AS status,
    CASE
      WHEN stats.fn_count = 0 THEN 0::bigint
      WHEN stats.fn_count = 1 AND stats.actual_args = nf.expected_args AND stats.actual_ret = nf.expected_ret THEN 0::bigint
      ELSE 1::bigint
    END AS finding_count,
    CASE
      WHEN stats.fn_count = 0
        THEN 'No conflicting function definition exists; ready to create.'
      WHEN stats.fn_count > 1
        THEN format('Conflict: %s overloaded definitions exist for %s.', stats.fn_count, nf.fn_name)
      WHEN stats.actual_args <> nf.expected_args OR stats.actual_ret <> nf.expected_ret
        THEN format('Conflict: existing signature (%s) -> %s mismatches migration.', stats.actual_args, stats.actual_ret)
      ELSE 'Already exists with identical signature (safe for CREATE OR REPLACE).'
    END::text AS details
  FROM new_fn_specs nf
  LEFT JOIN LATERAL (
    SELECT
      count(*)::bigint AS fn_count,
      max(pg_catalog.pg_get_function_identity_arguments(p.oid)) AS actual_args,
      max(pg_catalog.pg_get_function_result(p.oid)) AS actual_ret
    FROM pg_catalog.pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace
      AND p.proname = nf.fn_name
  ) AS stats ON true

  UNION ALL

  SELECT
    63 AS sort_order,
    '06_CONFLICTING_OBJECTS'::text AS check_category,
    'constraints & indexes: migration object namespace'::text AS target_name,
    CASE WHEN (con_cnt + idx_cnt) = 0 THEN 'PASS' ELSE 'FAIL' END::text AS status,
    (con_cnt + idx_cnt)::bigint AS finding_count,
    CASE
      WHEN (con_cnt + idx_cnt) = 0
        THEN 'No constraint or index name collisions found on unexpected tables.'
      ELSE format('%s constraint collision(s) and %s index collision(s) found.', con_cnt, idx_cnt)
    END::text AS details
  FROM (
    SELECT
      (
        SELECT count(*)::bigint
        FROM pg_catalog.pg_constraint con
        JOIN pg_catalog.pg_namespace ns ON ns.oid = con.connamespace
        WHERE ns.nspname = 'public'
          AND (
            (con.conname = 'chk_cbt_exam_sessions_draft_answers_object' AND con.conrelid IS DISTINCT FROM to_regclass('public.cbt_exam_sessions'))
            OR (
              con.conname IN (
                'uq_cbt_session_options_session_question',
                'fk_cbt_exam_session_options_exam',
                'fk_cbt_exam_session_options_student',
                'chk_cbt_exam_session_options_valid'
              )
              AND (
                to_regclass('public.cbt_exam_session_options') IS NULL
                OR con.conrelid IS DISTINCT FROM to_regclass('public.cbt_exam_session_options')
              )
            )
          )
      ) AS con_cnt,
      (
        SELECT count(*)::bigint
        FROM pg_catalog.pg_indexes idx
        WHERE idx.schemaname = 'public'
          AND idx.indexname IN (
            'idx_cbt_exam_session_options_session_id',
            'idx_cbt_exam_session_options_exam_student',
            'uq_cbt_session_options_session_question'
          )
          AND (
            to_regclass('public.cbt_exam_session_options') IS NULL
            OR idx.tablename <> 'cbt_exam_session_options'
          )
      ) AS idx_cnt
  ) obj_collisions
),
data_checks AS (
  SELECT
    70 AS sort_order,
    '07_DATA_INTEGRITY'::text AS check_category,
    'duplicate: cbt_exam_sessions(exam_id, student_id)'::text AS target_name,
    CASE WHEN cnt IS NULL THEN 'FAIL' WHEN cnt = 0 THEN 'PASS' ELSE 'FAIL' END::text AS status,
    COALESCE(cnt, 1::bigint) AS finding_count,
    CASE
      WHEN cnt IS NULL THEN 'Required table/columns missing; cannot run duplicate check.'
      WHEN cnt = 0 THEN 'Zero duplicate exam sessions found.'
      ELSE format('%s duplicate (exam_id, student_id) group(s) found in cbt_exam_sessions.', cnt)
    END::text AS details
  FROM (
    SELECT CASE
      WHEN to_regclass('public.cbt_exam_sessions') IS NOT NULL
       AND (SELECT count(DISTINCT column_name) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'cbt_exam_sessions' AND column_name IN ('exam_id','student_id')) = 2
      THEN pg_catalog.substring(pg_catalog.query_to_xml('SELECT count(*)::bigint AS cnt FROM (SELECT 1 FROM public.cbt_exam_sessions GROUP BY exam_id, student_id HAVING count(*) > 1) d', false, false, '')::text FROM '<cnt>([0-9]+)</cnt>')::bigint
      ELSE NULL::bigint
    END AS cnt
  ) q

  UNION ALL

  SELECT
    71 AS sort_order,
    '07_DATA_INTEGRITY'::text AS check_category,
    'duplicate: cbt_attempts(exam_id, student_id)'::text AS target_name,
    CASE WHEN cnt IS NULL THEN 'FAIL' WHEN cnt = 0 THEN 'PASS' ELSE 'FAIL' END::text AS status,
    COALESCE(cnt, 1::bigint) AS finding_count,
    CASE
      WHEN cnt IS NULL THEN 'Required table/columns missing; cannot run duplicate check.'
      WHEN cnt = 0 THEN 'Zero duplicate exam attempts found.'
      ELSE format('%s duplicate (exam_id, student_id) group(s) found in cbt_attempts.', cnt)
    END::text AS details
  FROM (
    SELECT CASE
      WHEN to_regclass('public.cbt_attempts') IS NOT NULL
       AND (SELECT count(DISTINCT column_name) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'cbt_attempts' AND column_name IN ('exam_id','student_id')) = 2
      THEN pg_catalog.substring(pg_catalog.query_to_xml('SELECT count(*)::bigint AS cnt FROM (SELECT 1 FROM public.cbt_attempts GROUP BY exam_id, student_id HAVING count(*) > 1) d', false, false, '')::text FROM '<cnt>([0-9]+)</cnt>')::bigint
      ELSE NULL::bigint
    END AS cnt
  ) q

  UNION ALL

  SELECT
    72 AS sort_order,
    '07_DATA_INTEGRITY'::text AS check_category,
    'orphan: cbt_exam_sessions.exam_id -> cbt_exams.id'::text AS target_name,
    CASE WHEN cnt IS NULL THEN 'FAIL' WHEN cnt = 0 THEN 'PASS' ELSE 'FAIL' END::text AS status,
    COALESCE(cnt, 1::bigint) AS finding_count,
    CASE
      WHEN cnt IS NULL THEN 'Required tables/columns missing; cannot check orphans.'
      WHEN cnt = 0 THEN 'Zero orphan exam_id rows in cbt_exam_sessions.'
      ELSE format('%s orphan cbt_exam_sessions.exam_id row(s) found.', cnt)
    END::text AS details
  FROM (
    SELECT CASE
      WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'cbt_exam_sessions' AND column_name = 'exam_id')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'cbt_exams' AND column_name = 'id')
      THEN pg_catalog.substring(pg_catalog.query_to_xml('SELECT count(*)::bigint AS cnt FROM public.cbt_exam_sessions ces LEFT JOIN public.cbt_exams ce ON ce.id = ces.exam_id WHERE ce.id IS NULL', false, false, '')::text FROM '<cnt>([0-9]+)</cnt>')::bigint
      ELSE NULL::bigint
    END AS cnt
  ) q

  UNION ALL

  SELECT
    73 AS sort_order,
    '07_DATA_INTEGRITY'::text AS check_category,
    'orphan: cbt_exam_sessions.student_id -> students.id'::text AS target_name,
    CASE WHEN cnt IS NULL THEN 'FAIL' WHEN cnt = 0 THEN 'PASS' ELSE 'FAIL' END::text AS status,
    COALESCE(cnt, 1::bigint) AS finding_count,
    CASE
      WHEN cnt IS NULL THEN 'Required tables/columns missing; cannot check orphans.'
      WHEN cnt = 0 THEN 'Zero orphan student_id rows in cbt_exam_sessions.'
      ELSE format('%s orphan cbt_exam_sessions.student_id row(s) found.', cnt)
    END::text AS details
  FROM (
    SELECT CASE
      WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'cbt_exam_sessions' AND column_name = 'student_id')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'id')
      THEN pg_catalog.substring(pg_catalog.query_to_xml('SELECT count(*)::bigint AS cnt FROM public.cbt_exam_sessions ces LEFT JOIN public.students s ON s.id = ces.student_id WHERE s.id IS NULL', false, false, '')::text FROM '<cnt>([0-9]+)</cnt>')::bigint
      ELSE NULL::bigint
    END AS cnt
  ) q

  UNION ALL

  SELECT
    74 AS sort_order,
    '07_DATA_INTEGRITY'::text AS check_category,
    'orphan: cbt_questions.exam_id -> cbt_exams.id'::text AS target_name,
    CASE WHEN cnt IS NULL THEN 'FAIL' WHEN cnt = 0 THEN 'PASS' ELSE 'FAIL' END::text AS status,
    COALESCE(cnt, 1::bigint) AS finding_count,
    CASE
      WHEN cnt IS NULL THEN 'Required tables/columns missing; cannot check orphans.'
      WHEN cnt = 0 THEN 'Zero orphan exam_id rows in cbt_questions.'
      ELSE format('%s orphan cbt_questions.exam_id row(s) found.', cnt)
    END::text AS details
  FROM (
    SELECT CASE
      WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'cbt_questions' AND column_name = 'exam_id')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'cbt_exams' AND column_name = 'id')
      THEN pg_catalog.substring(pg_catalog.query_to_xml('SELECT count(*)::bigint AS cnt FROM public.cbt_questions cq LEFT JOIN public.cbt_exams ce ON ce.id = cq.exam_id WHERE ce.id IS NULL', false, false, '')::text FROM '<cnt>([0-9]+)</cnt>')::bigint
      ELSE NULL::bigint
    END AS cnt
  ) q

  UNION ALL

  SELECT
    75 AS sort_order,
    '07_DATA_INTEGRITY'::text AS check_category,
    'orphan: cbt_attempts.(exam_id|student_id)'::text AS target_name,
    CASE WHEN cnt IS NULL THEN 'FAIL' WHEN cnt = 0 THEN 'PASS' ELSE 'FAIL' END::text AS status,
    COALESCE(cnt, 1::bigint) AS finding_count,
    CASE
      WHEN cnt IS NULL THEN 'Required tables/columns missing; cannot check orphans.'
      WHEN cnt = 0 THEN 'Zero orphan exam_id or student_id rows in cbt_attempts.'
      ELSE format('%s orphan cbt_attempts row(s) found.', cnt)
    END::text AS details
  FROM (
    SELECT CASE
      WHEN (SELECT count(DISTINCT column_name) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'cbt_attempts' AND column_name IN ('exam_id','student_id')) = 2
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'cbt_exams' AND column_name = 'id')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'id')
      THEN pg_catalog.substring(pg_catalog.query_to_xml('SELECT count(*)::bigint AS cnt FROM public.cbt_attempts ca LEFT JOIN public.cbt_exams ce ON ce.id = ca.exam_id LEFT JOIN public.students s ON s.id = ca.student_id WHERE ce.id IS NULL OR s.id IS NULL', false, false, '')::text FROM '<cnt>([0-9]+)</cnt>')::bigint
      ELSE NULL::bigint
    END AS cnt
  ) q

  UNION ALL

  SELECT
    76 AS sort_order,
    '07_DATA_INTEGRITY'::text AS check_category,
    'orphan: cbt_exams.(subject_id|class_id|teacher_id)'::text AS target_name,
    CASE WHEN cnt IS NULL THEN 'FAIL' WHEN cnt = 0 THEN 'PASS' ELSE 'FAIL' END::text AS status,
    COALESCE(cnt, 1::bigint) AS finding_count,
    CASE
      WHEN cnt IS NULL THEN 'Required tables/columns missing; cannot check orphans.'
      WHEN cnt = 0 THEN 'Zero orphan subject_id, class_id, or teacher_id rows in cbt_exams.'
      ELSE format('%s orphan foreign reference(s) found in cbt_exams.', cnt)
    END::text AS details
  FROM (
    SELECT CASE
      WHEN (SELECT count(DISTINCT column_name) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'cbt_exams' AND column_name IN ('subject_id','class_id','teacher_id')) = 3
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'subjects' AND column_name = 'id')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'classes' AND column_name = 'id')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'teachers' AND column_name = 'id')
      THEN pg_catalog.substring(pg_catalog.query_to_xml('SELECT count(*)::bigint AS cnt FROM public.cbt_exams ce LEFT JOIN public.subjects sb ON sb.id = ce.subject_id LEFT JOIN public.classes cl ON cl.id = ce.class_id LEFT JOIN public.teachers t ON t.id = ce.teacher_id WHERE sb.id IS NULL OR cl.id IS NULL OR (ce.teacher_id IS NOT NULL AND t.id IS NULL)', false, false, '')::text FROM '<cnt>([0-9]+)</cnt>')::bigint
      ELSE NULL::bigint
    END AS cnt
  ) q

  UNION ALL

  SELECT
    77 AS sort_order,
    '07_DATA_INTEGRITY'::text AS check_category,
    'domain: cbt_exam_sessions status & question_order'::text AS target_name,
    CASE WHEN cnt IS NULL THEN 'FAIL' WHEN cnt = 0 THEN 'PASS' ELSE 'FAIL' END::text AS status,
    COALESCE(cnt, 1::bigint) AS finding_count,
    CASE
      WHEN cnt IS NULL THEN 'Required table/columns missing.'
      WHEN cnt = 0 THEN 'All cbt_exam_sessions rows have valid status and JSONB array question_order.'
      ELSE format('%s invalid cbt_exam_sessions row(s) found.', cnt)
    END::text AS details
  FROM (
    SELECT CASE
      WHEN to_regclass('public.cbt_exam_sessions') IS NOT NULL
       AND (SELECT count(DISTINCT column_name) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'cbt_exam_sessions' AND column_name IN ('status','question_order')) = 2
      THEN pg_catalog.substring(pg_catalog.query_to_xml('SELECT count(*)::bigint AS cnt FROM public.cbt_exam_sessions WHERE status NOT IN (''in_progress'',''submitted'',''expired'') OR jsonb_typeof(question_order) IS DISTINCT FROM ''array''', false, false, '')::text FROM '<cnt>([0-9]+)</cnt>')::bigint
      ELSE NULL::bigint
    END AS cnt
  ) q

  UNION ALL

  SELECT
    78 AS sort_order,
    '07_DATA_INTEGRITY'::text AS check_category,
    'domain: cbt_exams duration_minutes & questions JSONB'::text AS target_name,
    CASE WHEN cnt IS NULL THEN 'FAIL' WHEN cnt = 0 THEN 'PASS' ELSE 'FAIL' END::text AS status,
    COALESCE(cnt, 1::bigint) AS finding_count,
    CASE
      WHEN cnt IS NULL THEN 'Required table/columns missing.'
      WHEN cnt = 0 THEN 'All cbt_exams rows have duration_minutes > 0 and valid JSONB array questions.'
      ELSE format('%s invalid cbt_exams row(s) found.', cnt)
    END::text AS details
  FROM (
    SELECT CASE
      WHEN to_regclass('public.cbt_exams') IS NOT NULL
       AND (SELECT count(DISTINCT column_name) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'cbt_exams' AND column_name IN ('duration_minutes','questions')) = 2
      THEN pg_catalog.substring(pg_catalog.query_to_xml('SELECT count(*)::bigint AS cnt FROM public.cbt_exams WHERE COALESCE(duration_minutes, 0) <= 0 OR jsonb_typeof(questions) IS DISTINCT FROM ''array''', false, false, '')::text FROM '<cnt>([0-9]+)</cnt>')::bigint
      ELSE NULL::bigint
    END AS cnt
  ) q

  UNION ALL

  SELECT
    79 AS sort_order,
    '07_DATA_INTEGRITY'::text AS check_category,
    'config: system_settings default row exists'::text AS target_name,
    CASE WHEN cnt IS NOT NULL AND cnt = 1 THEN 'PASS' ELSE 'FAIL' END::text AS status,
    CASE WHEN cnt IS NOT NULL AND cnt = 1 THEN 0::bigint ELSE 1::bigint END AS finding_count,
    CASE
      WHEN cnt IS NULL THEN 'system_settings table missing.'
      WHEN cnt = 1 THEN 'system_settings row id=''default'' exists.'
      ELSE format('Expected 1 system_settings row id=''default'', found %s.', cnt)
    END::text AS details
  FROM (
    SELECT CASE
      WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'system_settings' AND column_name = 'id')
      THEN pg_catalog.substring(pg_catalog.query_to_xml('SELECT count(*)::bigint AS cnt FROM public.system_settings WHERE id = ''default''', false, false, '')::text FROM '<cnt>([0-9]+)</cnt>')::bigint
      ELSE NULL::bigint
    END AS cnt
  ) q

  UNION ALL

  SELECT
    80 AS sort_order,
    '07_DATA_INTEGRITY'::text AS check_category,
    'window: active in_progress cbt_exam_sessions'::text AS target_name,
    CASE WHEN cnt IS NULL THEN 'FAIL' WHEN cnt = 0 THEN 'PASS' ELSE 'WARN' END::text AS status,
    COALESCE(cnt, 1::bigint) AS finding_count,
    CASE
      WHEN cnt IS NULL THEN 'cbt_exam_sessions table/columns missing.'
      WHEN cnt = 0 THEN 'Zero students are mid-exam right now; safe window to execute migration.'
      ELSE format('%s active in-progress session(s) detected; schedule migration during a quiet window if possible.', cnt)
    END::text AS details
  FROM (
    SELECT CASE
      WHEN to_regclass('public.cbt_exam_sessions') IS NOT NULL
       AND (SELECT count(DISTINCT column_name) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'cbt_exam_sessions' AND column_name IN ('status','expires_at')) = 2
      THEN pg_catalog.substring(pg_catalog.query_to_xml('SELECT count(*)::bigint AS cnt FROM public.cbt_exam_sessions WHERE status = ''in_progress'' AND expires_at > now()', false, false, '')::text FROM '<cnt>([0-9]+)</cnt>')::bigint
      ELSE NULL::bigint
    END AS cnt
  ) q

  UNION ALL

  SELECT
    81 AS sort_order,
    '07_DATA_INTEGRITY'::text AS check_category,
    'quality: cbt_exams with zero questions'::text AS target_name,
    CASE WHEN cnt IS NULL THEN 'FAIL' WHEN cnt = 0 THEN 'PASS' ELSE 'WARN' END::text AS status,
    COALESCE(cnt, 1::bigint) AS finding_count,
    CASE
      WHEN cnt IS NULL THEN 'cbt_exams/cbt_questions table/columns missing.'
      WHEN cnt = 0 THEN 'All existing CBT exams contain at least 1 question.'
      ELSE format('%s exam(s) currently have 0 questions (start_cbt_exam will refuse starting empty exams).', cnt)
    END::text AS details
  FROM (
    SELECT CASE
      WHEN (SELECT count(DISTINCT column_name) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'cbt_exams' AND column_name IN ('id','questions')) = 2
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'cbt_questions' AND column_name = 'exam_id')
      THEN pg_catalog.substring(pg_catalog.query_to_xml('SELECT count(*)::bigint AS cnt FROM public.cbt_exams ce WHERE NOT EXISTS (SELECT 1 FROM public.cbt_questions cq WHERE cq.exam_id = ce.id) AND CASE WHEN jsonb_typeof(ce.questions) = ''array'' THEN jsonb_array_length(ce.questions) = 0 ELSE true END', false, false, '')::text FROM '<cnt>([0-9]+)</cnt>')::bigint
      ELSE NULL::bigint
    END AS cnt
  ) q

  UNION ALL

  SELECT
    82 AS sort_order,
    '07_DATA_INTEGRITY'::text AS check_category,
    'baseline: historical cbt_attempts & cbt_questions'::text AS target_name,
    CASE WHEN att_cnt IS NOT NULL AND q_cnt IS NOT NULL THEN 'PASS' ELSE 'FAIL' END::text AS status,
    COALESCE(att_cnt, 0::bigint) + COALESCE(q_cnt, 0::bigint) AS finding_count,
    CASE
      WHEN att_cnt IS NULL OR q_cnt IS NULL THEN 'cbt_attempts or cbt_questions table/columns missing.'
      ELSE format('Baseline preserved counts: cbt_attempts=%s, cbt_questions=%s (legacy non-A keys=%s).', att_cnt, q_cnt, COALESCE(leg_cnt, 0))
    END::text AS details
  FROM (
    SELECT
      CASE
        WHEN to_regclass('public.cbt_attempts') IS NOT NULL
        THEN pg_catalog.substring(pg_catalog.query_to_xml('SELECT count(*)::bigint AS cnt FROM public.cbt_attempts', false, false, '')::text FROM '<cnt>([0-9]+)</cnt>')::bigint
        ELSE NULL::bigint
      END AS att_cnt,
      CASE
        WHEN to_regclass('public.cbt_questions') IS NOT NULL
        THEN pg_catalog.substring(pg_catalog.query_to_xml('SELECT count(*)::bigint AS cnt FROM public.cbt_questions', false, false, '')::text FROM '<cnt>([0-9]+)</cnt>')::bigint
        ELSE NULL::bigint
      END AS q_cnt,
      CASE
        WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'cbt_questions' AND column_name = 'correct_option')
        THEN pg_catalog.substring(pg_catalog.query_to_xml('SELECT count(*)::bigint AS cnt FROM public.cbt_questions WHERE upper(correct_option) IN (''B'',''C'',''D'')', false, false, '')::text FROM '<cnt>([0-9]+)</cnt>')::bigint
        ELSE NULL::bigint
      END AS leg_cnt
  ) q
),
all_checks AS (
  SELECT * FROM table_checks
  UNION ALL SELECT * FROM column_checks
  UNION ALL SELECT * FROM rpc_checks
  UNION ALL SELECT * FROM helper_checks
  UNION ALL SELECT * FROM trigger_checks
  UNION ALL SELECT * FROM rls_checks
  UNION ALL SELECT * FROM conflict_checks
  UNION ALL SELECT * FROM data_checks
),
summary_row AS (
  SELECT
    0 AS sort_order,
    '00_SUMMARY'::text AS check_category,
    'migration_readiness_verdict'::text AS target_name,
    CASE
      WHEN count(*) FILTER (WHERE status = 'FAIL') > 0 THEN 'FAIL'
      WHEN count(*) FILTER (WHERE status = 'WARN') > 0 THEN 'WARN'
      ELSE 'PASS'
    END::text AS status,
    count(*) FILTER (WHERE status = 'FAIL')::bigint AS finding_count,
    format(
      'Total checks=%s | PASS=%s | WARN=%s | FAIL=%s',
      count(*),
      count(*) FILTER (WHERE status = 'PASS'),
      count(*) FILTER (WHERE status = 'WARN'),
      count(*) FILTER (WHERE status = 'FAIL')
    )::text AS details
  FROM all_checks
)
SELECT
  check_category,
  target_name,
  status,
  finding_count,
  details
FROM (
  SELECT * FROM summary_row
  UNION ALL
  SELECT * FROM all_checks
) final_report
ORDER BY sort_order, check_category, target_name;
