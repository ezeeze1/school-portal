-- ============================================================================
-- DIVINE ACADEMY SECONDARY SCHOOL PORTAL
-- PRIORITY 3: EMPTY-DB-SAFE READ-ONLY PREFLIGHT & SCHEMA AUDIT SCRIPT
-- ============================================================================
-- RECONSTRUCTED SCRIPT NOTICE:
--   Reconstructed from supabase/schema.sql and supabase/post_migration_verify.sql.
--   Safe to run against a COMPLETELY EMPTY, PARTIALLY MIGRATED, or INSTALLED
--   Supabase PostgreSQL database.
--
-- READ-ONLY GUARANTEE:
--   - Uses session-only pg_temp helper functions (zero persistent DB objects).
--   - Never executes CREATE/ALTER/DROP/TRUNCATE/INSERT/UPDATE/DELETE on user tables.
--   - Never queries a portal table directly unless catalog verification confirms
--     both the table and required columns already exist.
--
-- CHECK COVERAGE:
--   01_DATABASE_STATE          Overall empty / partial / full 27-table readiness
--   02_TABLE_INVENTORY         Existence of all 27 expected portal tables
--   02b_VIEW_INVENTORY         Existence & security_invoker status of 3 views
--   03_MISSING_COLUMN          Expected columns missing from existing tables
--   04_DUPLICATE_KEY           Duplicate values blocking the 20 UNIQUE indexes
--   05_ORPHAN_FK               Orphan FK references & JSONB array references
--   06_JSONB_TYPE              JSONB array vs object structural validation
--   07_VALUE_CONSTRAINT        Date formats, numeric bounds & enum/domain checks
--   08_CONSTRAINT_INVENTORY    Primary keys & all 60 named FK/CHECK constraints
--   09_INDEX_INVENTORY         All 39 unique & performance indexes
--   10_FUNCTION_INVENTORY      All 25 public functions & SECURITY DEFINER hardening
--   11_TRIGGER_INVENTORY       All 33 updated_at, sync & CBT guard triggers
--   12_SECURITY_POLICY_INVENTORY RLS enablement (27 tables) & all 74 RLS policies
-- ============================================================================

CREATE OR REPLACE FUNCTION pg_temp.has_table_cols(p_table text, p_cols text[])
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT to_regclass(format('public.%I', p_table)) IS NOT NULL
     AND (
       SELECT count(DISTINCT column_name)
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = p_table
         AND column_name = ANY(p_cols)
     ) = COALESCE(array_length(p_cols, 1), 0);
$$;

CREATE OR REPLACE FUNCTION pg_temp.run_preflight_checks()
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
  v_expected_tables text[] := ARRAY[
    'user_profiles','academic_sessions','system_settings','teachers','classes',
    'subjects','students','student_result_passcodes','parents','parent_students',
    'teacher_subjects','scores','terminal_results','attendance','cbt_exams',
    'cbt_questions','cbt_attempts','cbt_exam_sessions','assignments',
    'assignment_submissions','study_notes','news_items','gallery_images',
    'online_applications','download_documents','announcements','fee_records'
  ];
  v_existing_count integer := 0;
  v_tbl text;
  v_cnt bigint;
  v_total_expected bigint;
  v_total_present bigint;
  v_rec record;
BEGIN
  -- --------------------------------------------------------------------------
  -- 01. OVERALL DATABASE STATE & EXPECTED 27-TABLE INVENTORY
  -- --------------------------------------------------------------------------
  SELECT count(*) INTO v_existing_count
  FROM pg_tables
  WHERE schemaname = 'public'
    AND tablename = ANY(v_expected_tables);

  IF v_existing_count = 0 THEN
    RETURN QUERY SELECT
      '01_DATABASE_STATE'::text,
      'public_schema'::text,
      'EMPTY_DATABASE_READY'::text,
      0::bigint,
      '0 of 27 expected portal tables exist. Database is empty and ready for fresh execution of supabase/schema.sql.'::text;
  ELSE
    RETURN QUERY SELECT
      '01_DATABASE_STATE'::text,
      'public_schema'::text,
      CASE WHEN v_existing_count = 27 THEN 'ALL_27_TABLES_PRESENT' ELSE 'PARTIAL_SCHEMA_DETECTED' END::text,
      (27 - v_existing_count)::bigint,
      format('%s of 27 expected portal tables currently exist.', v_existing_count);
  END IF;

  -- --------------------------------------------------------------------------
  -- 02. TABLE INVENTORY (ALL 27 PORTAL TABLES)
  -- --------------------------------------------------------------------------
  FOREACH v_tbl IN ARRAY v_expected_tables
  LOOP
    IF to_regclass(format('public.%I', v_tbl)) IS NULL THEN
      RETURN QUERY SELECT
        '02_TABLE_INVENTORY'::text,
        v_tbl,
        'NOT_CREATED_YET'::text,
        0::bigint,
        'Table has not been created yet (will be created by supabase/schema.sql).'::text;
    ELSE
      RETURN QUERY SELECT
        '02_TABLE_INVENTORY'::text,
        v_tbl,
        'EXISTS'::text,
        0::bigint,
        'Table already exists in public schema.'::text;
    END IF;
  END LOOP;

  -- --------------------------------------------------------------------------
  -- 02b. VIEW INVENTORY (3 PORTAL SECURITY VIEWS)
  -- --------------------------------------------------------------------------
  FOR v_rec IN
    WITH expected_views(view_name, expect_invoker) AS (
      VALUES
        ('public_site_settings', false),
        ('students_safe', true),
        ('teachers_safe', true)
    )
    SELECT
      ev.view_name,
      ev.expect_invoker,
      (c.relname IS NOT NULL) AS exists_flag,
      COALESCE('security_invoker=true' = ANY(c.reloptions), false) AS has_invoker
    FROM expected_views ev
    LEFT JOIN pg_class c
      ON c.relnamespace = 'public'::regnamespace
     AND c.relname = ev.view_name
     AND c.relkind = 'v'
    ORDER BY ev.view_name
  LOOP
    IF NOT v_rec.exists_flag THEN
      RETURN QUERY SELECT
        '02b_VIEW_INVENTORY'::text,
        v_rec.view_name,
        'NOT_CREATED_YET'::text,
        CASE WHEN v_existing_count = 27 THEN 1::bigint ELSE 0::bigint END,
        'Security view has not been created yet (will be created by supabase/schema.sql).'::text;
    ELSIF v_rec.expect_invoker AND NOT v_rec.has_invoker THEN
      RETURN QUERY SELECT
        '02b_VIEW_INVENTORY'::text,
        v_rec.view_name,
        'MISSING_SECURITY_INVOKER'::text,
        1::bigint,
        'View exists without security_invoker=true option.'::text;
    ELSE
      RETURN QUERY SELECT
        '02b_VIEW_INVENTORY'::text,
        v_rec.view_name,
        'EXISTS'::text,
        0::bigint,
        CASE
          WHEN v_rec.expect_invoker THEN 'View exists with security_invoker=true.'
          ELSE 'Public view exists.'
        END::text;
    END IF;
  END LOOP;

  -- --------------------------------------------------------------------------
  -- 08. CATALOG CHECK: CONSTRAINTS (PRIMARY KEYS, FOREIGN KEYS & CHECKS)
  -- --------------------------------------------------------------------------
  WITH expected_constraints(tbl, con_name, con_kind) AS (
    VALUES
      -- 35 Foreign Keys
      ('teachers','fk_teachers_auth_user','FK'),
      ('students','fk_students_auth_user','FK'),
      ('parents','fk_parents_auth_user','FK'),
      ('classes','fk_classes_class_teacher','FK'),
      ('teachers','fk_teachers_form_class','FK'),
      ('students','fk_students_class','FK'),
      ('parent_students','fk_parent_students_parent','FK'),
      ('parent_students','fk_parent_students_student','FK'),
      ('teacher_subjects','fk_teacher_subjects_teacher','FK'),
      ('teacher_subjects','fk_teacher_subjects_subject','FK'),
      ('scores','fk_scores_student','FK'),
      ('scores','fk_scores_subject','FK'),
      ('scores','fk_scores_class','FK'),
      ('scores','fk_scores_teacher','FK'),
      ('terminal_results','fk_terminal_results_student','FK'),
      ('terminal_results','fk_terminal_results_class','FK'),
      ('attendance','fk_attendance_student','FK'),
      ('attendance','fk_attendance_class','FK'),
      ('cbt_exams','fk_cbt_exams_subject','FK'),
      ('cbt_exams','fk_cbt_exams_class','FK'),
      ('cbt_exams','fk_cbt_exams_teacher','FK'),
      ('cbt_questions','fk_cbt_questions_exam','FK'),
      ('cbt_attempts','fk_cbt_attempts_exam','FK'),
      ('cbt_attempts','fk_cbt_attempts_student','FK'),
      ('cbt_exam_sessions','fk_cbt_exam_sessions_exam','FK'),
      ('cbt_exam_sessions','fk_cbt_exam_sessions_student','FK'),
      ('assignments','fk_assignments_subject','FK'),
      ('assignments','fk_assignments_class','FK'),
      ('assignments','fk_assignments_teacher','FK'),
      ('assignment_submissions','fk_assignment_submissions_assignment','FK'),
      ('assignment_submissions','fk_assignment_submissions_student','FK'),
      ('study_notes','fk_study_notes_subject','FK'),
      ('study_notes','fk_study_notes_class','FK'),
      ('study_notes','fk_study_notes_teacher','FK'),
      ('fee_records','fk_fee_records_student','FK'),
      -- 25 Domain & JSONB CHECK Constraints
      ('system_settings','chk_system_settings_term','CHECK'),
      ('system_settings','chk_system_settings_sessions_array','CHECK'),
      ('classes','chk_classes_category','CHECK'),
      ('classes','chk_classes_capacity','CHECK'),
      ('classes','chk_classes_arms_array','CHECK'),
      ('subjects','chk_subjects_category','CHECK'),
      ('students','chk_students_gender','CHECK'),
      ('students','chk_students_status','CHECK'),
      ('teachers','chk_teachers_status','CHECK'),
      ('teachers','chk_teachers_json_arrays','CHECK'),
      ('parents','chk_parents_student_ids_array','CHECK'),
      ('scores','chk_scores_ranges','CHECK'),
      ('terminal_results','chk_terminal_results_valid','CHECK'),
      ('attendance','chk_attendance_status','CHECK'),
      ('cbt_exams','chk_cbt_exams_valid','CHECK'),
      ('cbt_questions','chk_cbt_questions_valid','CHECK'),
      ('cbt_attempts','chk_cbt_attempts_valid','CHECK'),
      ('cbt_exam_sessions','chk_cbt_exam_sessions_valid','CHECK'),
      ('assignments','chk_assignments_format','CHECK'),
      ('news_items','chk_news_category','CHECK'),
      ('gallery_images','chk_gallery_category','CHECK'),
      ('online_applications','chk_online_applications_valid','CHECK'),
      ('download_documents','chk_download_documents_valid','CHECK'),
      ('announcements','chk_announcements_targets','CHECK'),
      ('fee_records','chk_fee_records_valid','CHECK')
  ),
  present_cons AS (
    SELECT ec.tbl, ec.con_name, ec.con_kind, (con.oid IS NOT NULL) AS exists_flag
    FROM expected_constraints ec
    JOIN pg_class cls ON cls.relnamespace = 'public'::regnamespace AND cls.relname = ec.tbl AND cls.relkind IN ('r','p')
    LEFT JOIN pg_constraint con ON con.conrelid = cls.oid AND con.conname = ec.con_name
  )
  SELECT
    (SELECT count(*) FROM expected_constraints),
    (SELECT count(*) FROM present_cons WHERE exists_flag)
  INTO v_total_expected, v_total_present;

  IF v_existing_count = 0 THEN
    RETURN QUERY SELECT
      '08_CONSTRAINT_INVENTORY'::text,
      'expected_constraints (60 FK/CHECK + 27 PK)'::text,
      'NOT_CREATED_YET'::text,
      0::bigint,
      '0 of 60 expected FK/CHECK constraints exist (database is empty).'::text;
  ELSE
    SELECT count(*) INTO v_cnt
    FROM pg_class cls
    LEFT JOIN pg_constraint pk ON pk.conrelid = cls.oid AND pk.contype = 'p'
    WHERE cls.relnamespace = 'public'::regnamespace
      AND cls.relkind IN ('r','p')
      AND cls.relname = ANY(v_expected_tables)
      AND pk.oid IS NULL;

    RETURN QUERY SELECT
      '08_CONSTRAINT_INVENTORY'::text,
      'constraint_summary'::text,
      CASE
        WHEN v_existing_count = 27 AND v_total_present = v_total_expected AND v_cnt = 0 THEN 'OK'
        ELSE 'CHECK_DETAILS'
      END::text,
      0::bigint,
      format('%s of %s expected FK/CHECK constraints present across %s existing tables (tables missing PK: %s).', v_total_present, v_total_expected, v_existing_count, v_cnt);

    -- Flag missing Primary Keys on existing expected tables
    FOR v_rec IN
      SELECT cls.relname AS tbl
      FROM pg_class cls
      LEFT JOIN pg_constraint pk ON pk.conrelid = cls.oid AND pk.contype = 'p'
      WHERE cls.relnamespace = 'public'::regnamespace
        AND cls.relkind IN ('r','p')
        AND cls.relname = ANY(v_expected_tables)
        AND pk.oid IS NULL
      ORDER BY cls.relname
    LOOP
      RETURN QUERY SELECT
        '08_CONSTRAINT_INVENTORY'::text,
        format('%s (PRIMARY KEY)', v_rec.tbl),
        'MISSING_PRIMARY_KEY'::text,
        1::bigint,
        'Existing table has no PRIMARY KEY constraint.'::text;
    END LOOP;

    -- Flag missing expected FK / CHECK constraints on existing tables
    FOR v_rec IN
      WITH expected_constraints(tbl, con_name, con_kind) AS (
        VALUES
          ('teachers','fk_teachers_auth_user','FK'),
          ('students','fk_students_auth_user','FK'),
          ('parents','fk_parents_auth_user','FK'),
          ('classes','fk_classes_class_teacher','FK'),
          ('teachers','fk_teachers_form_class','FK'),
          ('students','fk_students_class','FK'),
          ('parent_students','fk_parent_students_parent','FK'),
          ('parent_students','fk_parent_students_student','FK'),
          ('teacher_subjects','fk_teacher_subjects_teacher','FK'),
          ('teacher_subjects','fk_teacher_subjects_subject','FK'),
          ('scores','fk_scores_student','FK'),
          ('scores','fk_scores_subject','FK'),
          ('scores','fk_scores_class','FK'),
          ('scores','fk_scores_teacher','FK'),
          ('terminal_results','fk_terminal_results_student','FK'),
          ('terminal_results','fk_terminal_results_class','FK'),
          ('attendance','fk_attendance_student','FK'),
          ('attendance','fk_attendance_class','FK'),
          ('cbt_exams','fk_cbt_exams_subject','FK'),
          ('cbt_exams','fk_cbt_exams_class','FK'),
          ('cbt_exams','fk_cbt_exams_teacher','FK'),
          ('cbt_questions','fk_cbt_questions_exam','FK'),
          ('cbt_attempts','fk_cbt_attempts_exam','FK'),
          ('cbt_attempts','fk_cbt_attempts_student','FK'),
          ('cbt_exam_sessions','fk_cbt_exam_sessions_exam','FK'),
          ('cbt_exam_sessions','fk_cbt_exam_sessions_student','FK'),
          ('assignments','fk_assignments_subject','FK'),
          ('assignments','fk_assignments_class','FK'),
          ('assignments','fk_assignments_teacher','FK'),
          ('assignment_submissions','fk_assignment_submissions_assignment','FK'),
          ('assignment_submissions','fk_assignment_submissions_student','FK'),
          ('study_notes','fk_study_notes_subject','FK'),
          ('study_notes','fk_study_notes_class','FK'),
          ('study_notes','fk_study_notes_teacher','FK'),
          ('fee_records','fk_fee_records_student','FK'),
          ('system_settings','chk_system_settings_term','CHECK'),
          ('system_settings','chk_system_settings_sessions_array','CHECK'),
          ('classes','chk_classes_category','CHECK'),
          ('classes','chk_classes_capacity','CHECK'),
          ('classes','chk_classes_arms_array','CHECK'),
          ('subjects','chk_subjects_category','CHECK'),
          ('students','chk_students_gender','CHECK'),
          ('students','chk_students_status','CHECK'),
          ('teachers','chk_teachers_status','CHECK'),
          ('teachers','chk_teachers_json_arrays','CHECK'),
          ('parents','chk_parents_student_ids_array','CHECK'),
          ('scores','chk_scores_ranges','CHECK'),
          ('terminal_results','chk_terminal_results_valid','CHECK'),
          ('attendance','chk_attendance_status','CHECK'),
          ('cbt_exams','chk_cbt_exams_valid','CHECK'),
          ('cbt_questions','chk_cbt_questions_valid','CHECK'),
          ('cbt_attempts','chk_cbt_attempts_valid','CHECK'),
          ('cbt_exam_sessions','chk_cbt_exam_sessions_valid','CHECK'),
          ('assignments','chk_assignments_format','CHECK'),
          ('news_items','chk_news_category','CHECK'),
          ('gallery_images','chk_gallery_category','CHECK'),
          ('online_applications','chk_online_applications_valid','CHECK'),
          ('download_documents','chk_download_documents_valid','CHECK'),
          ('announcements','chk_announcements_targets','CHECK'),
          ('fee_records','chk_fee_records_valid','CHECK')
      )
      SELECT ec.tbl, ec.con_name, ec.con_kind
      FROM expected_constraints ec
      JOIN pg_class cls ON cls.relnamespace = 'public'::regnamespace AND cls.relname = ec.tbl AND cls.relkind IN ('r','p')
      LEFT JOIN pg_constraint con ON con.conrelid = cls.oid AND con.conname = ec.con_name
      WHERE con.oid IS NULL
      ORDER BY ec.tbl, ec.con_name
    LOOP
      RETURN QUERY SELECT
        '08_CONSTRAINT_INVENTORY'::text,
        format('%s.%s (%s)', v_rec.tbl, v_rec.con_name, v_rec.con_kind),
        'MISSING_CONSTRAINT'::text,
        1::bigint,
        'Expected constraint is missing on existing table (schema.sql adds it conditionally).'::text;
    END LOOP;
  END IF;

  -- --------------------------------------------------------------------------
  -- 09. CATALOG CHECK: INDEXES (ALL 39 UNIQUE & PERFORMANCE INDEXES)
  -- --------------------------------------------------------------------------
  WITH expected_indexes(tbl, idx_name) AS (
    VALUES
      ('user_profiles','idx_user_profiles_role_ref'),
      ('classes','uq_classes_name'),
      ('subjects','uq_subjects_code'),
      ('students','uq_students_admission_no'),
      ('students','uq_students_email'),
      ('students','uq_students_auth_user'),
      ('teachers','uq_teachers_staff_id'),
      ('teachers','uq_teachers_email'),
      ('teachers','uq_teachers_auth_user'),
      ('parents','uq_parents_parent_id'),
      ('parents','uq_parents_email'),
      ('parents','uq_parents_auth_user'),
      ('scores','uq_scores_student_subject_term'),
      ('terminal_results','uq_terminal_results_student_term'),
      ('attendance','uq_attendance_student_date'),
      ('cbt_attempts','uq_cbt_attempts_exam_student'),
      ('cbt_exam_sessions','uq_cbt_exam_sessions_exam_student'),
      ('assignment_submissions','uq_assignment_submissions_pair'),
      ('online_applications','uq_online_applications_number'),
      ('fee_records','uq_fee_records_receipt'),
      ('fee_records','uq_fee_records_student_term'),
      ('students','idx_students_class_id'),
      ('students','idx_students_parent_email'),
      ('scores','idx_scores_class_session_term'),
      ('scores','idx_scores_teacher_id'),
      ('terminal_results','idx_results_class_session_term'),
      ('attendance','idx_attendance_class_date'),
      ('cbt_exams','idx_cbt_exams_class_published'),
      ('cbt_exams','idx_cbt_exams_teacher_id'),
      ('cbt_questions','idx_cbt_questions_exam_order'),
      ('cbt_attempts','idx_cbt_attempts_student'),
      ('cbt_exam_sessions','idx_cbt_exam_sessions_student'),
      ('cbt_exam_sessions','idx_cbt_exam_sessions_status'),
      ('assignments','idx_assignments_class_due'),
      ('assignments','idx_assignments_teacher_id'),
      ('study_notes','idx_study_notes_class'),
      ('study_notes','idx_study_notes_teacher_id'),
      ('announcements','idx_announcements_date'),
      ('fee_records','idx_fee_records_student_status')
  )
  SELECT
    (SELECT count(*) FROM expected_indexes),
    (SELECT count(*) FROM expected_indexes ei JOIN pg_indexes pi ON pi.schemaname = 'public' AND pi.tablename = ei.tbl AND pi.indexname = ei.idx_name)
  INTO v_total_expected, v_total_present;

  IF v_existing_count = 0 THEN
    RETURN QUERY SELECT
      '09_INDEX_INVENTORY'::text,
      'expected_indexes (39)'::text,
      'NOT_CREATED_YET'::text,
      0::bigint,
      '0 of 39 expected unique/performance indexes exist (database is empty).'::text;
  ELSE
    RETURN QUERY SELECT
      '09_INDEX_INVENTORY'::text,
      'index_summary'::text,
      CASE WHEN v_existing_count = 27 AND v_total_present = v_total_expected THEN 'OK' ELSE 'CHECK_DETAILS' END::text,
      0::bigint,
      format('%s of %s expected unique/performance indexes currently exist.', v_total_present, v_total_expected);

    FOR v_rec IN
      WITH expected_indexes(tbl, idx_name) AS (
        VALUES
          ('user_profiles','idx_user_profiles_role_ref'),
          ('classes','uq_classes_name'),
          ('subjects','uq_subjects_code'),
          ('students','uq_students_admission_no'),
          ('students','uq_students_email'),
          ('students','uq_students_auth_user'),
          ('teachers','uq_teachers_staff_id'),
          ('teachers','uq_teachers_email'),
          ('teachers','uq_teachers_auth_user'),
          ('parents','uq_parents_parent_id'),
          ('parents','uq_parents_email'),
          ('parents','uq_parents_auth_user'),
          ('scores','uq_scores_student_subject_term'),
          ('terminal_results','uq_terminal_results_student_term'),
          ('attendance','uq_attendance_student_date'),
          ('cbt_attempts','uq_cbt_attempts_exam_student'),
          ('cbt_exam_sessions','uq_cbt_exam_sessions_exam_student'),
          ('assignment_submissions','uq_assignment_submissions_pair'),
          ('online_applications','uq_online_applications_number'),
          ('fee_records','uq_fee_records_receipt'),
          ('fee_records','uq_fee_records_student_term'),
          ('students','idx_students_class_id'),
          ('students','idx_students_parent_email'),
          ('scores','idx_scores_class_session_term'),
          ('scores','idx_scores_teacher_id'),
          ('terminal_results','idx_results_class_session_term'),
          ('attendance','idx_attendance_class_date'),
          ('cbt_exams','idx_cbt_exams_class_published'),
          ('cbt_exams','idx_cbt_exams_teacher_id'),
          ('cbt_questions','idx_cbt_questions_exam_order'),
          ('cbt_attempts','idx_cbt_attempts_student'),
          ('cbt_exam_sessions','idx_cbt_exam_sessions_student'),
          ('cbt_exam_sessions','idx_cbt_exam_sessions_status'),
          ('assignments','idx_assignments_class_due'),
          ('assignments','idx_assignments_teacher_id'),
          ('study_notes','idx_study_notes_class'),
          ('study_notes','idx_study_notes_teacher_id'),
          ('announcements','idx_announcements_date'),
          ('fee_records','idx_fee_records_student_status')
      )
      SELECT ei.tbl, ei.idx_name
      FROM expected_indexes ei
      JOIN pg_tables pt ON pt.schemaname = 'public' AND pt.tablename = ei.tbl
      LEFT JOIN pg_indexes pi ON pi.schemaname = 'public' AND pi.tablename = ei.tbl AND pi.indexname = ei.idx_name
      WHERE pi.indexname IS NULL
      ORDER BY ei.tbl, ei.idx_name
    LOOP
      RETURN QUERY SELECT
        '09_INDEX_INVENTORY'::text,
        format('%s.%s', v_rec.tbl, v_rec.idx_name),
        'MISSING_INDEX'::text,
        1::bigint,
        'Expected index is missing on existing table (schema.sql creates it with IF NOT EXISTS).'::text;
    END LOOP;
  END IF;

  -- --------------------------------------------------------------------------
  -- 10. CATALOG CHECK: DATABASE FUNCTIONS & SECURITY DEFINER HARDENING (25)
  -- --------------------------------------------------------------------------
  WITH expected_funcs(func_name, expect_secdef) AS (
    VALUES
      ('set_updated_at', false),
      ('bootstrap_first_admin', true),
      ('current_app_role', true),
      ('is_admin', true),
      ('is_teacher', true),
      ('sync_parent_students_from_parent', true),
      ('sync_parent_students_from_student', true),
      ('sync_teacher_subjects_from_teacher', true),
      ('guard_cbt_exam_active_session', true),
      ('guard_cbt_question_active_session', true),
      ('sync_cbt_questions_from_exam', true),
      ('current_teacher_id', true),
      ('is_own_teacher_id', true),
      ('teacher_teaches_subject', true),
      ('teacher_is_form_teacher', true),
      ('teacher_assigned_to_class', true),
      ('is_student_owner', true),
      ('is_parent_of_student', true),
      ('student_in_class', true),
      ('parent_has_ward_in_class', true),
      ('sync_my_user_profile', true),
      ('verify_student_result_passcode', true),
      ('get_student_cbt_exams', true),
      ('start_cbt_exam', true),
      ('submit_cbt_exam', true)
  )
  SELECT
    (SELECT count(*) FROM expected_funcs),
    (SELECT count(DISTINCT ef.func_name) FROM expected_funcs ef JOIN pg_proc p ON p.pronamespace = 'public'::regnamespace AND p.proname = ef.func_name)
  INTO v_total_expected, v_total_present;

  IF v_total_present = 0 AND v_existing_count = 0 THEN
    RETURN QUERY SELECT
      '10_FUNCTION_INVENTORY'::text,
      'expected_functions (25)'::text,
      'NOT_CREATED_YET'::text,
      0::bigint,
      '0 of 25 expected portal functions exist (database is empty).'::text;
  ELSE
    RETURN QUERY SELECT
      '10_FUNCTION_INVENTORY'::text,
      'function_summary'::text,
      CASE WHEN v_total_present = v_total_expected THEN 'OK' ELSE 'CHECK_DETAILS' END::text,
      0::bigint,
      format('%s of %s expected public functions currently exist.', v_total_present, v_total_expected);

    FOR v_rec IN
      WITH expected_funcs(func_name, expect_secdef) AS (
        VALUES
          ('set_updated_at', false),
          ('bootstrap_first_admin', true),
          ('current_app_role', true),
          ('is_admin', true),
          ('is_teacher', true),
          ('sync_parent_students_from_parent', true),
          ('sync_parent_students_from_student', true),
          ('sync_teacher_subjects_from_teacher', true),
          ('guard_cbt_exam_active_session', true),
          ('guard_cbt_question_active_session', true),
          ('sync_cbt_questions_from_exam', true),
          ('current_teacher_id', true),
          ('is_own_teacher_id', true),
          ('teacher_teaches_subject', true),
          ('teacher_is_form_teacher', true),
          ('teacher_assigned_to_class', true),
          ('is_student_owner', true),
          ('is_parent_of_student', true),
          ('student_in_class', true),
          ('parent_has_ward_in_class', true),
          ('sync_my_user_profile', true),
          ('verify_student_result_passcode', true),
          ('get_student_cbt_exams', true),
          ('start_cbt_exam', true),
          ('submit_cbt_exam', true)
      )
      SELECT
        ef.func_name,
        ef.expect_secdef,
        p.oid IS NOT NULL AS exists_flag,
        COALESCE(p.prosecdef, false) AS is_secdef,
        EXISTS (
          SELECT 1
          FROM unnest(COALESCE(p.proconfig, ARRAY[]::text[])) cfg
          WHERE cfg LIKE 'search_path=%'
        ) AS has_search_path
      FROM expected_funcs ef
      LEFT JOIN pg_proc p
        ON p.pronamespace = 'public'::regnamespace
       AND p.proname = ef.func_name
      ORDER BY ef.func_name
    LOOP
      IF NOT v_rec.exists_flag AND v_existing_count = 27 THEN
        RETURN QUERY SELECT
          '10_FUNCTION_INVENTORY'::text,
          v_rec.func_name,
          'MISSING_FUNCTION'::text,
          1::bigint,
          'Expected function is missing even though all 27 tables exist.'::text;
      ELSIF v_rec.exists_flag AND v_rec.expect_secdef AND (NOT v_rec.is_secdef OR NOT v_rec.has_search_path) THEN
        RETURN QUERY SELECT
          '10_FUNCTION_INVENTORY'::text,
          v_rec.func_name,
          'SECURITY_HARDENING_DRIFT'::text,
          1::bigint,
          'Existing function lacks expected SECURITY DEFINER or pinned SET search_path.'::text;
      END IF;
    END LOOP;
  END IF;

  -- --------------------------------------------------------------------------
  -- 11. CATALOG CHECK: TRIGGERS (27 UPDATED_AT + 6 SYNC/CBT GUARD TRIGGERS)
  -- --------------------------------------------------------------------------
  WITH expected_triggers AS (
    SELECT t AS tbl, 'trg_' || t || '_updated_at' AS trg_name
    FROM unnest(v_expected_tables) AS t
    UNION ALL
    SELECT * FROM (
      VALUES
        ('parents','trg_parents_sync_parent_students'),
        ('students','trg_students_sync_parent_students'),
        ('teachers','trg_teachers_sync_teacher_subjects'),
        ('cbt_exams','trg_cbt_exams_guard_active_session'),
        ('cbt_exams','trg_cbt_exams_sync_questions'),
        ('cbt_questions','trg_cbt_questions_guard_active_session')
    ) AS extra(tbl, trg_name)
  )
  SELECT
    (SELECT count(*) FROM expected_triggers),
    (
      SELECT count(*)
      FROM expected_triggers et
      JOIN pg_class cls ON cls.relnamespace = 'public'::regnamespace AND cls.relname = et.tbl
      JOIN pg_trigger trg ON trg.tgrelid = cls.oid AND trg.tgname = et.trg_name AND NOT trg.tgisinternal
    )
  INTO v_total_expected, v_total_present;

  IF v_existing_count = 0 THEN
    RETURN QUERY SELECT
      '11_TRIGGER_INVENTORY'::text,
      'expected_triggers (33)'::text,
      'NOT_CREATED_YET'::text,
      0::bigint,
      '0 of 33 expected triggers exist (database is empty).'::text;
  ELSE
    RETURN QUERY SELECT
      '11_TRIGGER_INVENTORY'::text,
      'trigger_summary'::text,
      CASE WHEN v_existing_count = 27 AND v_total_present = v_total_expected THEN 'OK' ELSE 'CHECK_DETAILS' END::text,
      0::bigint,
      format('%s of %s expected triggers currently exist.', v_total_present, v_total_expected);

    FOR v_rec IN
      WITH expected_triggers AS (
        SELECT t AS tbl, 'trg_' || t || '_updated_at' AS trg_name
        FROM unnest(v_expected_tables) AS t
        UNION ALL
        SELECT * FROM (
          VALUES
            ('parents','trg_parents_sync_parent_students'),
            ('students','trg_students_sync_parent_students'),
            ('teachers','trg_teachers_sync_teacher_subjects'),
            ('cbt_exams','trg_cbt_exams_guard_active_session'),
            ('cbt_exams','trg_cbt_exams_sync_questions'),
            ('cbt_questions','trg_cbt_questions_guard_active_session')
        ) AS extra(tbl, trg_name)
      )
      SELECT
        et.tbl,
        et.trg_name,
        trg.oid IS NOT NULL AS exists_flag,
        trg.tgenabled
      FROM expected_triggers et
      JOIN pg_class cls ON cls.relnamespace = 'public'::regnamespace AND cls.relname = et.tbl AND cls.relkind IN ('r','p')
      LEFT JOIN pg_trigger trg ON trg.tgrelid = cls.oid AND trg.tgname = et.trg_name AND NOT trg.tgisinternal
      ORDER BY et.tbl, et.trg_name
    LOOP
      IF NOT v_rec.exists_flag THEN
        RETURN QUERY SELECT
          '11_TRIGGER_INVENTORY'::text,
          format('%s.%s', v_rec.tbl, v_rec.trg_name),
          'MISSING_TRIGGER'::text,
          1::bigint,
          'Expected trigger is missing on existing table.'::text;
      ELSIF v_rec.tgenabled = 'D' THEN
        RETURN QUERY SELECT
          '11_TRIGGER_INVENTORY'::text,
          format('%s.%s', v_rec.tbl, v_rec.trg_name),
          'TRIGGER_DISABLED'::text,
          1::bigint,
          'Trigger exists on table but is currently disabled.'::text;
      END IF;
    END LOOP;
  END IF;

  -- --------------------------------------------------------------------------
  -- 12. CATALOG CHECK: ROW LEVEL SECURITY & 74 SECURITY POLICIES
  -- --------------------------------------------------------------------------
  WITH expected_policies(tbl, pol_name, expected_cmd) AS (
    VALUES
      ('system_settings','authenticated_read_system_settings','SELECT'),
      ('system_settings','admin_manage_system_settings','ALL'),
      ('news_items','public_read_news','SELECT'),
      ('news_items','admin_manage_news','ALL'),
      ('gallery_images','public_read_gallery','SELECT'),
      ('gallery_images','admin_manage_gallery','ALL'),
      ('download_documents','public_read_downloads','SELECT'),
      ('download_documents','admin_manage_downloads','ALL'),
      ('academic_sessions','authenticated_read_academic_sessions','SELECT'),
      ('academic_sessions','admin_manage_academic_sessions','ALL'),
      ('announcements','anon_read_public_announcements','SELECT'),
      ('announcements','authenticated_read_announcements','SELECT'),
      ('announcements','staff_insert_announcements','INSERT'),
      ('announcements','admin_update_announcements','UPDATE'),
      ('announcements','admin_delete_announcements','DELETE'),
      ('online_applications','constrained_public_submit_application','INSERT'),
      ('online_applications','admin_manage_applications','ALL'),
      ('classes','classes_scoped_select','SELECT'),
      ('classes','admin_manage_classes','ALL'),
      ('subjects','subjects_scoped_select','SELECT'),
      ('subjects','admin_manage_subjects','ALL'),
      ('user_profiles','user_read_own_profile','SELECT'),
      ('user_profiles','admin_manage_profiles','ALL'),
      ('students','students_scoped_select','SELECT'),
      ('students','admin_manage_students','ALL'),
      ('student_result_passcodes','admin_only_result_passcodes','ALL'),
      ('teachers','teachers_scoped_select','SELECT'),
      ('teachers','admin_manage_teachers','ALL'),
      ('parents','parents_scoped_select','SELECT'),
      ('parents','admin_manage_parents','ALL'),
      ('parent_students','parent_students_scoped_select','SELECT'),
      ('parent_students','admin_manage_parent_students','ALL'),
      ('teacher_subjects','teacher_subjects_scoped_select','SELECT'),
      ('teacher_subjects','admin_manage_teacher_subjects','ALL'),
      ('scores','scores_scoped_select','SELECT'),
      ('scores','admin_manage_scores','ALL'),
      ('scores','teacher_insert_own_scores','INSERT'),
      ('scores','teacher_update_own_scores','UPDATE'),
      ('scores','teacher_delete_own_scores','DELETE'),
      ('terminal_results','terminal_results_scoped_select','SELECT'),
      ('terminal_results','admin_manage_terminal_results','ALL'),
      ('terminal_results','form_teacher_manage_terminal_results','ALL'),
      ('attendance','attendance_scoped_select','SELECT'),
      ('attendance','admin_manage_attendance','ALL'),
      ('attendance','assigned_teacher_manage_attendance','ALL'),
      ('cbt_exams','admin_manage_cbt_exams','ALL'),
      ('cbt_exams','teacher_read_own_cbt_exams','SELECT'),
      ('cbt_exams','teacher_insert_own_cbt_exams','INSERT'),
      ('cbt_exams','teacher_update_own_cbt_exams','UPDATE'),
      ('cbt_exams','teacher_delete_own_cbt_exams','DELETE'),
      ('cbt_questions','admin_manage_cbt_questions','ALL'),
      ('cbt_questions','teacher_manage_own_cbt_questions','ALL'),
      ('cbt_exam_sessions','admin_manage_cbt_exam_sessions','ALL'),
      ('cbt_exam_sessions','cbt_exam_sessions_scoped_select','SELECT'),
      ('cbt_exam_sessions','cbt_exam_sessions_owner_teacher_delete','DELETE'),
      ('cbt_attempts','admin_manage_cbt_attempts','ALL'),
      ('cbt_attempts','cbt_attempts_scoped_select','SELECT'),
      ('cbt_attempts','cbt_attempts_owner_teacher_delete','DELETE'),
      ('assignments','assignments_scoped_select','SELECT'),
      ('assignments','admin_manage_assignments','ALL'),
      ('assignments','teacher_insert_own_assignments','INSERT'),
      ('assignments','teacher_update_own_assignments','UPDATE'),
      ('assignments','teacher_delete_own_assignments','DELETE'),
      ('assignment_submissions','admin_manage_assignment_submissions','ALL'),
      ('assignment_submissions','assignment_submissions_scoped_select','SELECT'),
      ('assignment_submissions','assignment_submissions_student_insert','INSERT'),
      ('assignment_submissions','teacher_grade_own_assignment_submissions','UPDATE'),
      ('study_notes','study_notes_scoped_select','SELECT'),
      ('study_notes','admin_manage_study_notes','ALL'),
      ('study_notes','teacher_insert_own_study_notes','INSERT'),
      ('study_notes','teacher_update_own_study_notes','UPDATE'),
      ('study_notes','teacher_delete_own_study_notes','DELETE'),
      ('fee_records','fee_records_scoped_select','SELECT'),
      ('fee_records','admin_manage_fee_records','ALL')
  )
  SELECT
    (SELECT count(*) FROM expected_policies),
    (SELECT count(*) FROM expected_policies ep JOIN pg_policies p ON p.schemaname = 'public' AND p.tablename = ep.tbl AND p.policyname = ep.pol_name AND p.cmd = ep.expected_cmd)
  INTO v_total_expected, v_total_present;

  IF v_existing_count = 0 THEN
    RETURN QUERY SELECT
      '12_SECURITY_POLICY_INVENTORY'::text,
      'rls_and_policies (27 tables / 74 policies)'::text,
      'NOT_CREATED_YET'::text,
      0::bigint,
      '0 of 27 tables have RLS enabled; 0 of 74 expected policies exist (database is empty).'::text;
  ELSE
    SELECT count(*) INTO v_cnt
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename = ANY(v_expected_tables)
      AND rowsecurity = true;

    RETURN QUERY SELECT
      '12_SECURITY_POLICY_INVENTORY'::text,
      'rls_policy_summary'::text,
      CASE WHEN v_existing_count = 27 AND v_cnt = 27 AND v_total_present = v_total_expected THEN 'OK' ELSE 'CHECK_DETAILS' END::text,
      0::bigint,
      format('%s of %s existing tables have RLS enabled; %s of %s expected policies exist.', v_cnt, v_existing_count, v_total_present, v_total_expected);

    -- Flag existing tables with RLS disabled
    FOR v_rec IN
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename = ANY(v_expected_tables)
        AND NOT rowsecurity
      ORDER BY tablename
    LOOP
      RETURN QUERY SELECT
        '12_SECURITY_POLICY_INVENTORY'::text,
        v_rec.tablename,
        'RLS_DISABLED'::text,
        1::bigint,
        'Row Level Security is NOT enabled on existing portal table.'::text;
    END LOOP;

    -- Flag missing or mismatched RLS policies on existing tables
    FOR v_rec IN
      WITH expected_policies(tbl, pol_name, expected_cmd) AS (
        VALUES
          ('system_settings','authenticated_read_system_settings','SELECT'),
          ('system_settings','admin_manage_system_settings','ALL'),
          ('news_items','public_read_news','SELECT'),
          ('news_items','admin_manage_news','ALL'),
          ('gallery_images','public_read_gallery','SELECT'),
          ('gallery_images','admin_manage_gallery','ALL'),
          ('download_documents','public_read_downloads','SELECT'),
          ('download_documents','admin_manage_downloads','ALL'),
          ('academic_sessions','authenticated_read_academic_sessions','SELECT'),
          ('academic_sessions','admin_manage_academic_sessions','ALL'),
          ('announcements','anon_read_public_announcements','SELECT'),
          ('announcements','authenticated_read_announcements','SELECT'),
          ('announcements','staff_insert_announcements','INSERT'),
          ('announcements','admin_update_announcements','UPDATE'),
          ('announcements','admin_delete_announcements','DELETE'),
          ('online_applications','constrained_public_submit_application','INSERT'),
          ('online_applications','admin_manage_applications','ALL'),
          ('classes','classes_scoped_select','SELECT'),
          ('classes','admin_manage_classes','ALL'),
          ('subjects','subjects_scoped_select','SELECT'),
          ('subjects','admin_manage_subjects','ALL'),
          ('user_profiles','user_read_own_profile','SELECT'),
          ('user_profiles','admin_manage_profiles','ALL'),
          ('students','students_scoped_select','SELECT'),
          ('students','admin_manage_students','ALL'),
          ('student_result_passcodes','admin_only_result_passcodes','ALL'),
          ('teachers','teachers_scoped_select','SELECT'),
          ('teachers','admin_manage_teachers','ALL'),
          ('parents','parents_scoped_select','SELECT'),
          ('parents','admin_manage_parents','ALL'),
          ('parent_students','parent_students_scoped_select','SELECT'),
          ('parent_students','admin_manage_parent_students','ALL'),
          ('teacher_subjects','teacher_subjects_scoped_select','SELECT'),
          ('teacher_subjects','admin_manage_teacher_subjects','ALL'),
          ('scores','scores_scoped_select','SELECT'),
          ('scores','admin_manage_scores','ALL'),
          ('scores','teacher_insert_own_scores','INSERT'),
          ('scores','teacher_update_own_scores','UPDATE'),
          ('scores','teacher_delete_own_scores','DELETE'),
          ('terminal_results','terminal_results_scoped_select','SELECT'),
          ('terminal_results','admin_manage_terminal_results','ALL'),
          ('terminal_results','form_teacher_manage_terminal_results','ALL'),
          ('attendance','attendance_scoped_select','SELECT'),
          ('attendance','admin_manage_attendance','ALL'),
          ('attendance','assigned_teacher_manage_attendance','ALL'),
          ('cbt_exams','admin_manage_cbt_exams','ALL'),
          ('cbt_exams','teacher_read_own_cbt_exams','SELECT'),
          ('cbt_exams','teacher_insert_own_cbt_exams','INSERT'),
          ('cbt_exams','teacher_update_own_cbt_exams','UPDATE'),
          ('cbt_exams','teacher_delete_own_cbt_exams','DELETE'),
          ('cbt_questions','admin_manage_cbt_questions','ALL'),
          ('cbt_questions','teacher_manage_own_cbt_questions','ALL'),
          ('cbt_exam_sessions','admin_manage_cbt_exam_sessions','ALL'),
          ('cbt_exam_sessions','cbt_exam_sessions_scoped_select','SELECT'),
          ('cbt_exam_sessions','cbt_exam_sessions_owner_teacher_delete','DELETE'),
          ('cbt_attempts','admin_manage_cbt_attempts','ALL'),
          ('cbt_attempts','cbt_attempts_scoped_select','SELECT'),
          ('cbt_attempts','cbt_attempts_owner_teacher_delete','DELETE'),
          ('assignments','assignments_scoped_select','SELECT'),
          ('assignments','admin_manage_assignments','ALL'),
          ('assignments','teacher_insert_own_assignments','INSERT'),
          ('assignments','teacher_update_own_assignments','UPDATE'),
          ('assignments','teacher_delete_own_assignments','DELETE'),
          ('assignment_submissions','admin_manage_assignment_submissions','ALL'),
          ('assignment_submissions','assignment_submissions_scoped_select','SELECT'),
          ('assignment_submissions','assignment_submissions_student_insert','INSERT'),
          ('assignment_submissions','teacher_grade_own_assignment_submissions','UPDATE'),
          ('study_notes','study_notes_scoped_select','SELECT'),
          ('study_notes','admin_manage_study_notes','ALL'),
          ('study_notes','teacher_insert_own_study_notes','INSERT'),
          ('study_notes','teacher_update_own_study_notes','UPDATE'),
          ('study_notes','teacher_delete_own_study_notes','DELETE'),
          ('fee_records','fee_records_scoped_select','SELECT'),
          ('fee_records','admin_manage_fee_records','ALL')
      )
      SELECT ep.tbl, ep.pol_name, ep.expected_cmd, p.cmd AS actual_cmd
      FROM expected_policies ep
      JOIN pg_tables pt ON pt.schemaname = 'public' AND pt.tablename = ep.tbl
      LEFT JOIN pg_policies p ON p.schemaname = 'public' AND p.tablename = ep.tbl AND p.policyname = ep.pol_name
      WHERE p.policyname IS NULL OR p.cmd IS DISTINCT FROM ep.expected_cmd
      ORDER BY ep.tbl, ep.pol_name
    LOOP
      RETURN QUERY SELECT
        '12_SECURITY_POLICY_INVENTORY'::text,
        format('%s.%s', v_rec.tbl, v_rec.pol_name),
        CASE WHEN v_rec.actual_cmd IS NULL THEN 'MISSING_POLICY' ELSE 'POLICY_CMD_MISMATCH' END::text,
        1::bigint,
        CASE
          WHEN v_rec.actual_cmd IS NULL THEN format('Expected %s policy missing on existing table.', v_rec.expected_cmd)
          ELSE format('Expected command %s, found %s.', v_rec.expected_cmd, v_rec.actual_cmd)
        END::text;
    END LOOP;
  END IF;

  -- Exit cleanly before row-level table scans if database has zero portal tables
  IF v_existing_count = 0 THEN
    RETURN;
  END IF;

  -- --------------------------------------------------------------------------
  -- 03. MISSING EXPECTED COLUMNS ON EXISTING TABLES
  -- --------------------------------------------------------------------------
  FOR v_rec IN
    WITH expected_cols(tbl, col) AS (
      VALUES
        ('user_profiles','auth_user_id'),('user_profiles','role'),('user_profiles','reference_id'),('user_profiles','email'),('user_profiles','full_name'),('user_profiles','is_active'),('user_profiles','created_at'),('user_profiles','updated_at'),
        ('academic_sessions','name'),('academic_sessions','is_current'),('academic_sessions','created_at'),('academic_sessions','updated_at'),
        ('system_settings','id'),('system_settings','current_session'),('system_settings','academic_sessions'),('system_settings','current_term'),('system_settings','is_result_published'),('system_settings','result_entry_open'),('system_settings','cbt_active'),('system_settings','created_at'),('system_settings','updated_at'),
        ('teachers','id'),('teachers','auth_user_id'),('teachers','staff_id'),('teachers','email'),('teachers','subject_ids'),('teachers','subjects_taught'),('teachers','classes_taught'),('teachers','form_class_id'),('teachers','status'),('teachers','created_at'),('teachers','updated_at'),
        ('classes','id'),('classes','name'),('classes','category'),('classes','arms'),('classes','class_teacher_id'),('classes','capacity'),('classes','created_at'),('classes','updated_at'),
        ('subjects','id'),('subjects','code'),('subjects','name'),('subjects','category'),('subjects','created_at'),('subjects','updated_at'),
        ('students','id'),('students','auth_user_id'),('students','admission_no'),('students','email'),('students','dob'),('students','class_id'),('students','parent_email'),('students','status'),('students','created_at'),('students','updated_at'),
        ('student_result_passcodes','student_id'),('student_result_passcodes','result_passcode'),('student_result_passcodes','created_at'),('student_result_passcodes','updated_at'),
        ('parents','id'),('parents','auth_user_id'),('parents','parent_id'),('parents','email'),('parents','student_ids'),('parents','created_at'),('parents','updated_at'),
        ('parent_students','parent_id'),('parent_students','student_id'),('parent_students','created_at'),('parent_students','updated_at'),
        ('teacher_subjects','teacher_id'),('teacher_subjects','subject_id'),('teacher_subjects','created_at'),('teacher_subjects','updated_at'),
        ('scores','id'),('scores','student_id'),('scores','subject_id'),('scores','class_id'),('scores','session_id'),('scores','term'),('scores','ca1_score'),('scores','ca2_score'),('scores','exam_score'),('scores','total_score'),('scores','grade'),('scores','teacher_id'),('scores','created_at'),('scores','updated_at'),
        ('terminal_results','id'),('terminal_results','student_id'),('terminal_results','class_id'),('terminal_results','session_id'),('terminal_results','term'),('terminal_results','scores'),('terminal_results','psychomotor'),('terminal_results','average_score'),('terminal_results','status'),('terminal_results','created_at'),('terminal_results','updated_at'),
        ('attendance','id'),('attendance','student_id'),('attendance','class_id'),('attendance','date'),('attendance','status'),('attendance','created_at'),('attendance','updated_at'),
        ('cbt_exams','id'),('cbt_exams','subject_id'),('cbt_exams','class_id'),('cbt_exams','teacher_id'),('cbt_exams','start_date'),('cbt_exams','end_date'),('cbt_exams','questions'),('cbt_exams','created_at'),('cbt_exams','updated_at'),
        ('cbt_questions','id'),('cbt_questions','exam_id'),('cbt_questions','correct_option'),('cbt_questions','marks'),('cbt_questions','created_at'),('cbt_questions','updated_at'),
        ('cbt_attempts','id'),('cbt_attempts','exam_id'),('cbt_attempts','student_id'),('cbt_attempts','completed_at'),('cbt_attempts','answers'),('cbt_attempts','created_at'),('cbt_attempts','updated_at'),
        ('cbt_exam_sessions','id'),('cbt_exam_sessions','exam_id'),('cbt_exam_sessions','student_id'),('cbt_exam_sessions','started_at'),('cbt_exam_sessions','expires_at'),('cbt_exam_sessions','status'),('cbt_exam_sessions','question_order'),('cbt_exam_sessions','created_at'),('cbt_exam_sessions','updated_at'),
        ('assignments','id'),('assignments','subject_id'),('assignments','class_id'),('assignments','teacher_id'),('assignments','due_date'),('assignments','created_date'),('assignments','created_at'),('assignments','updated_at'),
        ('assignment_submissions','id'),('assignment_submissions','assignment_id'),('assignment_submissions','student_id'),('assignment_submissions','created_at'),('assignment_submissions','updated_at'),
        ('study_notes','id'),('study_notes','subject_id'),('study_notes','class_id'),('study_notes','teacher_id'),('study_notes','upload_date'),('study_notes','created_at'),('study_notes','updated_at'),
        ('news_items','id'),('news_items','category'),('news_items','date'),('news_items','created_at'),('news_items','updated_at'),
        ('gallery_images','id'),('gallery_images','category'),('gallery_images','date'),('gallery_images','created_at'),('gallery_images','updated_at'),
        ('online_applications','id'),('online_applications','application_number'),('online_applications','gender'),('online_applications','dob'),('online_applications','submission_date'),('online_applications','status'),('online_applications','created_at'),('online_applications','updated_at'),
        ('download_documents','id'),('download_documents','category'),('download_documents','file_type'),('download_documents','updated_date'),('download_documents','created_at'),('download_documents','updated_at'),
        ('announcements','id'),('announcements','target_audience'),('announcements','target_role'),('announcements','date'),('announcements','created_at'),('announcements','updated_at'),
        ('fee_records','id'),('fee_records','student_id'),('fee_records','term'),('fee_records','session'),('fee_records','receipt_no'),('fee_records','status'),('fee_records','created_at'),('fee_records','updated_at')
    )
    SELECT ec.tbl, ec.col
    FROM expected_cols ec
    JOIN pg_tables pt
      ON pt.schemaname = 'public' AND pt.tablename = ec.tbl
    LEFT JOIN information_schema.columns c
      ON c.table_schema = 'public' AND c.table_name = ec.tbl AND c.column_name = ec.col
    WHERE c.column_name IS NULL
    ORDER BY ec.tbl, ec.col
  LOOP
    RETURN QUERY SELECT
      '03_MISSING_COLUMN'::text,
      format('%s.%s', v_rec.tbl, v_rec.col),
      'MISSING_COLUMN'::text,
      1::bigint,
      'Column missing on existing table (schema.sql adds additive columns safely).'::text;
  END LOOP;

  -- --------------------------------------------------------------------------
  -- 04. DUPLICATE DETECTION FOR UNIQUE INDEXES (20 UNIQUE INDEXES)
  -- --------------------------------------------------------------------------
  IF pg_temp.has_table_cols('classes', ARRAY['name']) THEN
    SELECT count(*) INTO v_cnt FROM (SELECT 1 FROM public.classes GROUP BY name HAVING count(*) > 1) d;
    IF v_cnt > 0 THEN RETURN QUERY SELECT '04_DUPLICATE_KEY','classes(name)','DUPLICATE_FOUND',v_cnt,'Blocks uq_classes_name'; END IF;
  END IF;

  IF pg_temp.has_table_cols('subjects', ARRAY['code']) THEN
    SELECT count(*) INTO v_cnt FROM (SELECT 1 FROM public.subjects GROUP BY code HAVING count(*) > 1) d;
    IF v_cnt > 0 THEN RETURN QUERY SELECT '04_DUPLICATE_KEY','subjects(code)','DUPLICATE_FOUND',v_cnt,'Blocks uq_subjects_code'; END IF;
  END IF;

  IF pg_temp.has_table_cols('students', ARRAY['admission_no']) THEN
    SELECT count(*) INTO v_cnt FROM (SELECT 1 FROM public.students GROUP BY admission_no HAVING count(*) > 1) d;
    IF v_cnt > 0 THEN RETURN QUERY SELECT '04_DUPLICATE_KEY','students(admission_no)','DUPLICATE_FOUND',v_cnt,'Blocks uq_students_admission_no'; END IF;
  END IF;

  IF pg_temp.has_table_cols('students', ARRAY['email']) THEN
    SELECT count(*) INTO v_cnt FROM (SELECT 1 FROM public.students WHERE email IS NOT NULL AND trim(email) <> '' GROUP BY lower(email) HAVING count(*) > 1) d;
    IF v_cnt > 0 THEN RETURN QUERY SELECT '04_DUPLICATE_KEY','students(lower(email))','DUPLICATE_FOUND',v_cnt,'Blocks uq_students_email'; END IF;
  END IF;

  IF pg_temp.has_table_cols('students', ARRAY['auth_user_id']) THEN
    SELECT count(*) INTO v_cnt FROM (SELECT 1 FROM public.students WHERE auth_user_id IS NOT NULL GROUP BY auth_user_id HAVING count(*) > 1) d;
    IF v_cnt > 0 THEN RETURN QUERY SELECT '04_DUPLICATE_KEY','students(auth_user_id)','DUPLICATE_FOUND',v_cnt,'Blocks uq_students_auth_user'; END IF;
  END IF;

  IF pg_temp.has_table_cols('teachers', ARRAY['staff_id']) THEN
    SELECT count(*) INTO v_cnt FROM (SELECT 1 FROM public.teachers GROUP BY staff_id HAVING count(*) > 1) d;
    IF v_cnt > 0 THEN RETURN QUERY SELECT '04_DUPLICATE_KEY','teachers(staff_id)','DUPLICATE_FOUND',v_cnt,'Blocks uq_teachers_staff_id'; END IF;
  END IF;

  IF pg_temp.has_table_cols('teachers', ARRAY['email']) THEN
    SELECT count(*) INTO v_cnt FROM (SELECT 1 FROM public.teachers GROUP BY lower(email) HAVING count(*) > 1) d;
    IF v_cnt > 0 THEN RETURN QUERY SELECT '04_DUPLICATE_KEY','teachers(lower(email))','DUPLICATE_FOUND',v_cnt,'Blocks uq_teachers_email'; END IF;
  END IF;

  IF pg_temp.has_table_cols('teachers', ARRAY['auth_user_id']) THEN
    SELECT count(*) INTO v_cnt FROM (SELECT 1 FROM public.teachers WHERE auth_user_id IS NOT NULL GROUP BY auth_user_id HAVING count(*) > 1) d;
    IF v_cnt > 0 THEN RETURN QUERY SELECT '04_DUPLICATE_KEY','teachers(auth_user_id)','DUPLICATE_FOUND',v_cnt,'Blocks uq_teachers_auth_user'; END IF;
  END IF;

  IF pg_temp.has_table_cols('parents', ARRAY['parent_id']) THEN
    SELECT count(*) INTO v_cnt FROM (SELECT 1 FROM public.parents GROUP BY parent_id HAVING count(*) > 1) d;
    IF v_cnt > 0 THEN RETURN QUERY SELECT '04_DUPLICATE_KEY','parents(parent_id)','DUPLICATE_FOUND',v_cnt,'Blocks uq_parents_parent_id'; END IF;
  END IF;

  IF pg_temp.has_table_cols('parents', ARRAY['email']) THEN
    SELECT count(*) INTO v_cnt FROM (SELECT 1 FROM public.parents GROUP BY lower(email) HAVING count(*) > 1) d;
    IF v_cnt > 0 THEN RETURN QUERY SELECT '04_DUPLICATE_KEY','parents(lower(email))','DUPLICATE_FOUND',v_cnt,'Blocks uq_parents_email'; END IF;
  END IF;

  IF pg_temp.has_table_cols('parents', ARRAY['auth_user_id']) THEN
    SELECT count(*) INTO v_cnt FROM (SELECT 1 FROM public.parents WHERE auth_user_id IS NOT NULL GROUP BY auth_user_id HAVING count(*) > 1) d;
    IF v_cnt > 0 THEN RETURN QUERY SELECT '04_DUPLICATE_KEY','parents(auth_user_id)','DUPLICATE_FOUND',v_cnt,'Blocks uq_parents_auth_user'; END IF;
  END IF;

  IF pg_temp.has_table_cols('scores', ARRAY['student_id','subject_id','session_id','term']) THEN
    SELECT count(*) INTO v_cnt FROM (SELECT 1 FROM public.scores GROUP BY student_id, subject_id, session_id, term HAVING count(*) > 1) d;
    IF v_cnt > 0 THEN RETURN QUERY SELECT '04_DUPLICATE_KEY','scores(student_id,subject_id,session_id,term)','DUPLICATE_FOUND',v_cnt,'Blocks uq_scores_student_subject_term'; END IF;
  END IF;

  IF pg_temp.has_table_cols('terminal_results', ARRAY['student_id','session_id','term']) THEN
    SELECT count(*) INTO v_cnt FROM (SELECT 1 FROM public.terminal_results GROUP BY student_id, session_id, term HAVING count(*) > 1) d;
    IF v_cnt > 0 THEN RETURN QUERY SELECT '04_DUPLICATE_KEY','terminal_results(student_id,session_id,term)','DUPLICATE_FOUND',v_cnt,'Blocks uq_terminal_results_student_term'; END IF;
  END IF;

  IF pg_temp.has_table_cols('attendance', ARRAY['student_id','date']) THEN
    SELECT count(*) INTO v_cnt FROM (SELECT 1 FROM public.attendance GROUP BY student_id, date HAVING count(*) > 1) d;
    IF v_cnt > 0 THEN RETURN QUERY SELECT '04_DUPLICATE_KEY','attendance(student_id,date)','DUPLICATE_FOUND',v_cnt,'Blocks uq_attendance_student_date'; END IF;
  END IF;

  IF pg_temp.has_table_cols('cbt_attempts', ARRAY['exam_id','student_id']) THEN
    SELECT count(*) INTO v_cnt FROM (SELECT 1 FROM public.cbt_attempts GROUP BY exam_id, student_id HAVING count(*) > 1) d;
    IF v_cnt > 0 THEN RETURN QUERY SELECT '04_DUPLICATE_KEY','cbt_attempts(exam_id,student_id)','DUPLICATE_FOUND',v_cnt,'Blocks uq_cbt_attempts_exam_student'; END IF;
  END IF;

  IF pg_temp.has_table_cols('cbt_exam_sessions', ARRAY['exam_id','student_id']) THEN
    SELECT count(*) INTO v_cnt FROM (SELECT 1 FROM public.cbt_exam_sessions GROUP BY exam_id, student_id HAVING count(*) > 1) d;
    IF v_cnt > 0 THEN RETURN QUERY SELECT '04_DUPLICATE_KEY','cbt_exam_sessions(exam_id,student_id)','DUPLICATE_FOUND',v_cnt,'Blocks uq_cbt_exam_sessions_exam_student'; END IF;
  END IF;

  IF pg_temp.has_table_cols('assignment_submissions', ARRAY['assignment_id','student_id']) THEN
    SELECT count(*) INTO v_cnt FROM (SELECT 1 FROM public.assignment_submissions GROUP BY assignment_id, student_id HAVING count(*) > 1) d;
    IF v_cnt > 0 THEN RETURN QUERY SELECT '04_DUPLICATE_KEY','assignment_submissions(assignment_id,student_id)','DUPLICATE_FOUND',v_cnt,'Blocks uq_assignment_submissions_pair'; END IF;
  END IF;

  IF pg_temp.has_table_cols('online_applications', ARRAY['application_number']) THEN
    SELECT count(*) INTO v_cnt FROM (SELECT 1 FROM public.online_applications GROUP BY application_number HAVING count(*) > 1) d;
    IF v_cnt > 0 THEN RETURN QUERY SELECT '04_DUPLICATE_KEY','online_applications(application_number)','DUPLICATE_FOUND',v_cnt,'Blocks uq_online_applications_number'; END IF;
  END IF;

  IF pg_temp.has_table_cols('fee_records', ARRAY['receipt_no']) THEN
    SELECT count(*) INTO v_cnt FROM (SELECT 1 FROM public.fee_records GROUP BY receipt_no HAVING count(*) > 1) d;
    IF v_cnt > 0 THEN RETURN QUERY SELECT '04_DUPLICATE_KEY','fee_records(receipt_no)','DUPLICATE_FOUND',v_cnt,'Blocks uq_fee_records_receipt'; END IF;
  END IF;

  IF pg_temp.has_table_cols('fee_records', ARRAY['student_id','session','term']) THEN
    SELECT count(*) INTO v_cnt FROM (SELECT 1 FROM public.fee_records GROUP BY student_id, session, term HAVING count(*) > 1) d;
    IF v_cnt > 0 THEN RETURN QUERY SELECT '04_DUPLICATE_KEY','fee_records(student_id,session,term)','DUPLICATE_FOUND',v_cnt,'Blocks uq_fee_records_student_term'; END IF;
  END IF;

  -- --------------------------------------------------------------------------
  -- 05. ORPHAN FOREIGN KEY & GUARDED JSONB ARRAY REFERENCE DETECTION
  -- --------------------------------------------------------------------------
  IF pg_temp.has_table_cols('classes', ARRAY['class_teacher_id']) AND pg_temp.has_table_cols('teachers', ARRAY['id']) THEN
    SELECT count(*) INTO v_cnt FROM public.classes c LEFT JOIN public.teachers t ON t.id = c.class_teacher_id WHERE c.class_teacher_id IS NOT NULL AND t.id IS NULL;
    IF v_cnt > 0 THEN RETURN QUERY SELECT '05_ORPHAN_FK','classes.class_teacher_id -> teachers.id','ORPHAN_FOUND',v_cnt,'Invalid teacher ID in classes'; END IF;
  END IF;

  IF pg_temp.has_table_cols('teachers', ARRAY['form_class_id']) AND pg_temp.has_table_cols('classes', ARRAY['id']) THEN
    SELECT count(*) INTO v_cnt FROM public.teachers t LEFT JOIN public.classes c ON c.id = t.form_class_id WHERE t.form_class_id IS NOT NULL AND c.id IS NULL;
    IF v_cnt > 0 THEN RETURN QUERY SELECT '05_ORPHAN_FK','teachers.form_class_id -> classes.id','ORPHAN_FOUND',v_cnt,'Invalid class ID in teachers'; END IF;
  END IF;

  IF pg_temp.has_table_cols('students', ARRAY['class_id']) AND pg_temp.has_table_cols('classes', ARRAY['id']) THEN
    SELECT count(*) INTO v_cnt FROM public.students s LEFT JOIN public.classes c ON c.id = s.class_id WHERE c.id IS NULL;
    IF v_cnt > 0 THEN RETURN QUERY SELECT '05_ORPHAN_FK','students.class_id -> classes.id','ORPHAN_FOUND',v_cnt,'Invalid class ID in students'; END IF;
  END IF;

  IF pg_temp.has_table_cols('parent_students', ARRAY['parent_id','student_id'])
     AND pg_temp.has_table_cols('parents', ARRAY['id'])
     AND pg_temp.has_table_cols('students', ARRAY['id']) THEN
    SELECT count(*) INTO v_cnt FROM public.parent_students ps LEFT JOIN public.parents p ON p.id = ps.parent_id WHERE p.id IS NULL;
    IF v_cnt > 0 THEN RETURN QUERY SELECT '05_ORPHAN_FK','parent_students.parent_id -> parents.id','ORPHAN_FOUND',v_cnt,'Invalid parent ID in parent_students'; END IF;
    SELECT count(*) INTO v_cnt FROM public.parent_students ps LEFT JOIN public.students s ON s.id = ps.student_id WHERE s.id IS NULL;
    IF v_cnt > 0 THEN RETURN QUERY SELECT '05_ORPHAN_FK','parent_students.student_id -> students.id','ORPHAN_FOUND',v_cnt,'Invalid student ID in parent_students'; END IF;
  END IF;

  IF pg_temp.has_table_cols('teacher_subjects', ARRAY['teacher_id','subject_id'])
     AND pg_temp.has_table_cols('teachers', ARRAY['id'])
     AND pg_temp.has_table_cols('subjects', ARRAY['id']) THEN
    SELECT count(*) INTO v_cnt FROM public.teacher_subjects ts LEFT JOIN public.teachers t ON t.id = ts.teacher_id WHERE t.id IS NULL;
    IF v_cnt > 0 THEN RETURN QUERY SELECT '05_ORPHAN_FK','teacher_subjects.teacher_id -> teachers.id','ORPHAN_FOUND',v_cnt,'Invalid teacher ID in teacher_subjects'; END IF;
    SELECT count(*) INTO v_cnt FROM public.teacher_subjects ts LEFT JOIN public.subjects sb ON sb.id = ts.subject_id WHERE sb.id IS NULL;
    IF v_cnt > 0 THEN RETURN QUERY SELECT '05_ORPHAN_FK','teacher_subjects.subject_id -> subjects.id','ORPHAN_FOUND',v_cnt,'Invalid subject ID in teacher_subjects'; END IF;
  END IF;

  IF pg_temp.has_table_cols('scores', ARRAY['student_id','subject_id','class_id','teacher_id'])
     AND pg_temp.has_table_cols('students', ARRAY['id'])
     AND pg_temp.has_table_cols('subjects', ARRAY['id'])
     AND pg_temp.has_table_cols('classes', ARRAY['id'])
     AND pg_temp.has_table_cols('teachers', ARRAY['id']) THEN
    SELECT count(*) INTO v_cnt FROM public.scores sc LEFT JOIN public.students s ON s.id = sc.student_id WHERE s.id IS NULL;
    IF v_cnt > 0 THEN RETURN QUERY SELECT '05_ORPHAN_FK','scores.student_id -> students.id','ORPHAN_FOUND',v_cnt,'Invalid student ID in scores'; END IF;
    SELECT count(*) INTO v_cnt FROM public.scores sc LEFT JOIN public.subjects sb ON sb.id = sc.subject_id WHERE sb.id IS NULL;
    IF v_cnt > 0 THEN RETURN QUERY SELECT '05_ORPHAN_FK','scores.subject_id -> subjects.id','ORPHAN_FOUND',v_cnt,'Invalid subject ID in scores'; END IF;
    SELECT count(*) INTO v_cnt FROM public.scores sc LEFT JOIN public.classes c ON c.id = sc.class_id WHERE c.id IS NULL;
    IF v_cnt > 0 THEN RETURN QUERY SELECT '05_ORPHAN_FK','scores.class_id -> classes.id','ORPHAN_FOUND',v_cnt,'Invalid class ID in scores'; END IF;
    SELECT count(*) INTO v_cnt FROM public.scores sc LEFT JOIN public.teachers t ON t.id = sc.teacher_id WHERE sc.teacher_id IS NOT NULL AND t.id IS NULL;
    IF v_cnt > 0 THEN RETURN QUERY SELECT '05_ORPHAN_FK','scores.teacher_id -> teachers.id','ORPHAN_FOUND',v_cnt,'Invalid teacher ID in scores'; END IF;
  END IF;

  IF pg_temp.has_table_cols('terminal_results', ARRAY['student_id','class_id']) AND pg_temp.has_table_cols('students', ARRAY['id']) AND pg_temp.has_table_cols('classes', ARRAY['id']) THEN
    SELECT count(*) INTO v_cnt FROM public.terminal_results tr LEFT JOIN public.students s ON s.id = tr.student_id WHERE s.id IS NULL;
    IF v_cnt > 0 THEN RETURN QUERY SELECT '05_ORPHAN_FK','terminal_results.student_id -> students.id','ORPHAN_FOUND',v_cnt,'Invalid student ID in terminal_results'; END IF;
    SELECT count(*) INTO v_cnt FROM public.terminal_results tr LEFT JOIN public.classes c ON c.id = tr.class_id WHERE c.id IS NULL;
    IF v_cnt > 0 THEN RETURN QUERY SELECT '05_ORPHAN_FK','terminal_results.class_id -> classes.id','ORPHAN_FOUND',v_cnt,'Invalid class ID in terminal_results'; END IF;
  END IF;

  IF pg_temp.has_table_cols('attendance', ARRAY['student_id','class_id']) AND pg_temp.has_table_cols('students', ARRAY['id']) AND pg_temp.has_table_cols('classes', ARRAY['id']) THEN
    SELECT count(*) INTO v_cnt FROM public.attendance a LEFT JOIN public.students s ON s.id = a.student_id WHERE s.id IS NULL;
    IF v_cnt > 0 THEN RETURN QUERY SELECT '05_ORPHAN_FK','attendance.student_id -> students.id','ORPHAN_FOUND',v_cnt,'Invalid student ID in attendance'; END IF;
    SELECT count(*) INTO v_cnt FROM public.attendance a LEFT JOIN public.classes c ON c.id = a.class_id WHERE c.id IS NULL;
    IF v_cnt > 0 THEN RETURN QUERY SELECT '05_ORPHAN_FK','attendance.class_id -> classes.id','ORPHAN_FOUND',v_cnt,'Invalid class ID in attendance'; END IF;
  END IF;

  IF pg_temp.has_table_cols('cbt_exams', ARRAY['subject_id','class_id','teacher_id']) AND pg_temp.has_table_cols('subjects', ARRAY['id']) AND pg_temp.has_table_cols('classes', ARRAY['id']) AND pg_temp.has_table_cols('teachers', ARRAY['id']) THEN
    SELECT count(*) INTO v_cnt FROM public.cbt_exams ce LEFT JOIN public.subjects sb ON sb.id = ce.subject_id WHERE sb.id IS NULL;
    IF v_cnt > 0 THEN RETURN QUERY SELECT '05_ORPHAN_FK','cbt_exams.subject_id -> subjects.id','ORPHAN_FOUND',v_cnt,'Invalid subject ID in cbt_exams'; END IF;
    SELECT count(*) INTO v_cnt FROM public.cbt_exams ce LEFT JOIN public.classes c ON c.id = ce.class_id WHERE c.id IS NULL;
    IF v_cnt > 0 THEN RETURN QUERY SELECT '05_ORPHAN_FK','cbt_exams.class_id -> classes.id','ORPHAN_FOUND',v_cnt,'Invalid class ID in cbt_exams'; END IF;
    SELECT count(*) INTO v_cnt FROM public.cbt_exams ce LEFT JOIN public.teachers t ON t.id = ce.teacher_id WHERE ce.teacher_id IS NOT NULL AND t.id IS NULL;
    IF v_cnt > 0 THEN RETURN QUERY SELECT '05_ORPHAN_FK','cbt_exams.teacher_id -> teachers.id','ORPHAN_FOUND',v_cnt,'Invalid teacher ID in cbt_exams'; END IF;
  END IF;

  IF pg_temp.has_table_cols('cbt_questions', ARRAY['exam_id']) AND pg_temp.has_table_cols('cbt_exams', ARRAY['id']) THEN
    SELECT count(*) INTO v_cnt FROM public.cbt_questions cq LEFT JOIN public.cbt_exams ce ON ce.id = cq.exam_id WHERE ce.id IS NULL;
    IF v_cnt > 0 THEN RETURN QUERY SELECT '05_ORPHAN_FK','cbt_questions.exam_id -> cbt_exams.id','ORPHAN_FOUND',v_cnt,'Invalid exam ID in cbt_questions'; END IF;
  END IF;

  IF pg_temp.has_table_cols('cbt_attempts', ARRAY['exam_id','student_id']) AND pg_temp.has_table_cols('cbt_exams', ARRAY['id']) AND pg_temp.has_table_cols('students', ARRAY['id']) THEN
    SELECT count(*) INTO v_cnt FROM public.cbt_attempts ca LEFT JOIN public.cbt_exams ce ON ce.id = ca.exam_id WHERE ce.id IS NULL;
    IF v_cnt > 0 THEN RETURN QUERY SELECT '05_ORPHAN_FK','cbt_attempts.exam_id -> cbt_exams.id','ORPHAN_FOUND',v_cnt,'Invalid exam ID in cbt_attempts'; END IF;
    SELECT count(*) INTO v_cnt FROM public.cbt_attempts ca LEFT JOIN public.students s ON s.id = ca.student_id WHERE s.id IS NULL;
    IF v_cnt > 0 THEN RETURN QUERY SELECT '05_ORPHAN_FK','cbt_attempts.student_id -> students.id','ORPHAN_FOUND',v_cnt,'Invalid student ID in cbt_attempts'; END IF;
  END IF;

  IF pg_temp.has_table_cols('cbt_exam_sessions', ARRAY['exam_id','student_id']) AND pg_temp.has_table_cols('cbt_exams', ARRAY['id']) AND pg_temp.has_table_cols('students', ARRAY['id']) THEN
    SELECT count(*) INTO v_cnt FROM public.cbt_exam_sessions ces LEFT JOIN public.cbt_exams ce ON ce.id = ces.exam_id WHERE ce.id IS NULL;
    IF v_cnt > 0 THEN RETURN QUERY SELECT '05_ORPHAN_FK','cbt_exam_sessions.exam_id -> cbt_exams.id','ORPHAN_FOUND',v_cnt,'Invalid exam ID in cbt_exam_sessions'; END IF;
    SELECT count(*) INTO v_cnt FROM public.cbt_exam_sessions ces LEFT JOIN public.students s ON s.id = ces.student_id WHERE s.id IS NULL;
    IF v_cnt > 0 THEN RETURN QUERY SELECT '05_ORPHAN_FK','cbt_exam_sessions.student_id -> students.id','ORPHAN_FOUND',v_cnt,'Invalid student ID in cbt_exam_sessions'; END IF;
  END IF;

  IF pg_temp.has_table_cols('assignments', ARRAY['subject_id','class_id','teacher_id']) AND pg_temp.has_table_cols('subjects', ARRAY['id']) AND pg_temp.has_table_cols('classes', ARRAY['id']) AND pg_temp.has_table_cols('teachers', ARRAY['id']) THEN
    SELECT count(*) INTO v_cnt FROM public.assignments ag LEFT JOIN public.subjects sb ON sb.id = ag.subject_id WHERE sb.id IS NULL;
    IF v_cnt > 0 THEN RETURN QUERY SELECT '05_ORPHAN_FK','assignments.subject_id -> subjects.id','ORPHAN_FOUND',v_cnt,'Invalid subject ID in assignments'; END IF;
    SELECT count(*) INTO v_cnt FROM public.assignments ag LEFT JOIN public.classes c ON c.id = ag.class_id WHERE c.id IS NULL;
    IF v_cnt > 0 THEN RETURN QUERY SELECT '05_ORPHAN_FK','assignments.class_id -> classes.id','ORPHAN_FOUND',v_cnt,'Invalid class ID in assignments'; END IF;
    SELECT count(*) INTO v_cnt FROM public.assignments ag LEFT JOIN public.teachers t ON t.id = ag.teacher_id WHERE ag.teacher_id IS NOT NULL AND t.id IS NULL;
    IF v_cnt > 0 THEN RETURN QUERY SELECT '05_ORPHAN_FK','assignments.teacher_id -> teachers.id','ORPHAN_FOUND',v_cnt,'Invalid teacher ID in assignments'; END IF;
  END IF;

  IF pg_temp.has_table_cols('assignment_submissions', ARRAY['assignment_id','student_id']) AND pg_temp.has_table_cols('assignments', ARRAY['id']) AND pg_temp.has_table_cols('students', ARRAY['id']) THEN
    SELECT count(*) INTO v_cnt FROM public.assignment_submissions sub LEFT JOIN public.assignments a ON a.id = sub.assignment_id WHERE a.id IS NULL;
    IF v_cnt > 0 THEN RETURN QUERY SELECT '05_ORPHAN_FK','assignment_submissions.assignment_id -> assignments.id','ORPHAN_FOUND',v_cnt,'Invalid assignment ID in assignment_submissions'; END IF;
    SELECT count(*) INTO v_cnt FROM public.assignment_submissions sub LEFT JOIN public.students s ON s.id = sub.student_id WHERE s.id IS NULL;
    IF v_cnt > 0 THEN RETURN QUERY SELECT '05_ORPHAN_FK','assignment_submissions.student_id -> students.id','ORPHAN_FOUND',v_cnt,'Invalid student ID in assignment_submissions'; END IF;
  END IF;

  IF pg_temp.has_table_cols('study_notes', ARRAY['subject_id','class_id','teacher_id']) AND pg_temp.has_table_cols('subjects', ARRAY['id']) AND pg_temp.has_table_cols('classes', ARRAY['id']) AND pg_temp.has_table_cols('teachers', ARRAY['id']) THEN
    SELECT count(*) INTO v_cnt FROM public.study_notes sn LEFT JOIN public.subjects sb ON sb.id = sn.subject_id WHERE sn.subject_id IS NOT NULL AND sb.id IS NULL;
    IF v_cnt > 0 THEN RETURN QUERY SELECT '05_ORPHAN_FK','study_notes.subject_id -> subjects.id','ORPHAN_FOUND',v_cnt,'Invalid subject ID in study_notes'; END IF;
    SELECT count(*) INTO v_cnt FROM public.study_notes sn LEFT JOIN public.classes c ON c.id = sn.class_id WHERE sn.class_id IS NOT NULL AND c.id IS NULL;
    IF v_cnt > 0 THEN RETURN QUERY SELECT '05_ORPHAN_FK','study_notes.class_id -> classes.id','ORPHAN_FOUND',v_cnt,'Non-NULL class_id (including literal "all") does not exist in classes'; END IF;
    SELECT count(*) INTO v_cnt FROM public.study_notes sn LEFT JOIN public.teachers t ON t.id = sn.teacher_id WHERE sn.teacher_id IS NOT NULL AND t.id IS NULL;
    IF v_cnt > 0 THEN RETURN QUERY SELECT '05_ORPHAN_FK','study_notes.teacher_id -> teachers.id','ORPHAN_FOUND',v_cnt,'Invalid teacher ID in study_notes'; END IF;
  END IF;

  IF pg_temp.has_table_cols('fee_records', ARRAY['student_id']) AND pg_temp.has_table_cols('students', ARRAY['id']) THEN
    SELECT count(*) INTO v_cnt FROM public.fee_records fr LEFT JOIN public.students s ON s.id = fr.student_id WHERE s.id IS NULL;
    IF v_cnt > 0 THEN RETURN QUERY SELECT '05_ORPHAN_FK','fee_records.student_id -> students.id','ORPHAN_FOUND',v_cnt,'Invalid student ID in fee_records'; END IF;
  END IF;

  IF pg_temp.has_table_cols('parents', ARRAY['student_ids']) AND pg_temp.has_table_cols('students', ARRAY['id']) THEN
    SELECT count(*) INTO v_cnt
    FROM public.parents p
    CROSS JOIN LATERAL jsonb_array_elements_text(
      CASE WHEN jsonb_typeof(p.student_ids) = 'array' THEN p.student_ids ELSE '[]'::jsonb END
    ) AS elem(student_id)
    LEFT JOIN public.students s ON s.id = elem.student_id
    WHERE s.id IS NULL;
    IF v_cnt > 0 THEN RETURN QUERY SELECT '05_ORPHAN_FK','parents.student_ids[] -> students.id','ORPHAN_FOUND',v_cnt,'Orphan student_id in parents.student_ids JSONB array'; END IF;
  END IF;

  IF pg_temp.has_table_cols('teachers', ARRAY['subject_ids']) AND pg_temp.has_table_cols('subjects', ARRAY['id']) THEN
    SELECT count(*) INTO v_cnt
    FROM public.teachers t
    CROSS JOIN LATERAL jsonb_array_elements_text(
      CASE WHEN jsonb_typeof(t.subject_ids) = 'array' THEN t.subject_ids ELSE '[]'::jsonb END
    ) AS elem(subject_id)
    LEFT JOIN public.subjects sb ON sb.id = elem.subject_id
    WHERE sb.id IS NULL;
    IF v_cnt > 0 THEN RETURN QUERY SELECT '05_ORPHAN_FK','teachers.subject_ids[] -> subjects.id','ORPHAN_FOUND',v_cnt,'Orphan subject_id in teachers.subject_ids JSONB array'; END IF;
  END IF;

  -- --------------------------------------------------------------------------
  -- 06. JSONB DATA-TYPE CHECKS (ARRAY VS OBJECT)
  -- --------------------------------------------------------------------------
  IF pg_temp.has_table_cols('system_settings', ARRAY['academic_sessions']) THEN
    SELECT count(*) INTO v_cnt FROM public.system_settings WHERE jsonb_typeof(academic_sessions) IS DISTINCT FROM 'array';
    IF v_cnt > 0 THEN RETURN QUERY SELECT '06_JSONB_TYPE','system_settings.academic_sessions','INVALID_JSON_TYPE',v_cnt,'Expected JSONB array'; END IF;
  END IF;

  IF pg_temp.has_table_cols('classes', ARRAY['arms']) THEN
    SELECT count(*) INTO v_cnt FROM public.classes WHERE jsonb_typeof(arms) IS DISTINCT FROM 'array';
    IF v_cnt > 0 THEN RETURN QUERY SELECT '06_JSONB_TYPE','classes.arms','INVALID_JSON_TYPE',v_cnt,'Expected JSONB array'; END IF;
  END IF;

  IF pg_temp.has_table_cols('teachers', ARRAY['subject_ids','subjects_taught','classes_taught']) THEN
    SELECT count(*) INTO v_cnt FROM public.teachers
    WHERE jsonb_typeof(subject_ids) IS DISTINCT FROM 'array'
       OR jsonb_typeof(subjects_taught) IS DISTINCT FROM 'array'
       OR jsonb_typeof(classes_taught) IS DISTINCT FROM 'array';
    IF v_cnt > 0 THEN RETURN QUERY SELECT '06_JSONB_TYPE','teachers.(subject_ids|subjects_taught|classes_taught)','INVALID_JSON_TYPE',v_cnt,'Expected JSONB arrays'; END IF;
  END IF;

  IF pg_temp.has_table_cols('parents', ARRAY['student_ids']) THEN
    SELECT count(*) INTO v_cnt FROM public.parents WHERE jsonb_typeof(student_ids) IS DISTINCT FROM 'array';
    IF v_cnt > 0 THEN RETURN QUERY SELECT '06_JSONB_TYPE','parents.student_ids','INVALID_JSON_TYPE',v_cnt,'Expected JSONB array'; END IF;
  END IF;

  IF pg_temp.has_table_cols('terminal_results', ARRAY['scores','psychomotor']) THEN
    SELECT count(*) INTO v_cnt FROM public.terminal_results
    WHERE jsonb_typeof(scores) IS DISTINCT FROM 'array' OR jsonb_typeof(psychomotor) IS DISTINCT FROM 'object';
    IF v_cnt > 0 THEN RETURN QUERY SELECT '06_JSONB_TYPE','terminal_results.(scores|psychomotor)','INVALID_JSON_TYPE',v_cnt,'Expected scores=array and psychomotor=object'; END IF;
  END IF;

  IF pg_temp.has_table_cols('cbt_exams', ARRAY['questions']) THEN
    SELECT count(*) INTO v_cnt FROM public.cbt_exams WHERE jsonb_typeof(questions) IS DISTINCT FROM 'array';
    IF v_cnt > 0 THEN RETURN QUERY SELECT '06_JSONB_TYPE','cbt_exams.questions','INVALID_JSON_TYPE',v_cnt,'Expected JSONB array'; END IF;
  END IF;

  IF pg_temp.has_table_cols('cbt_attempts', ARRAY['answers']) THEN
    SELECT count(*) INTO v_cnt FROM public.cbt_attempts WHERE jsonb_typeof(answers) IS DISTINCT FROM 'object';
    IF v_cnt > 0 THEN RETURN QUERY SELECT '06_JSONB_TYPE','cbt_attempts.answers','INVALID_JSON_TYPE',v_cnt,'Expected JSONB object'; END IF;
  END IF;

  IF pg_temp.has_table_cols('cbt_exam_sessions', ARRAY['question_order']) THEN
    SELECT count(*) INTO v_cnt FROM public.cbt_exam_sessions WHERE jsonb_typeof(question_order) IS DISTINCT FROM 'array';
    IF v_cnt > 0 THEN RETURN QUERY SELECT '06_JSONB_TYPE','cbt_exam_sessions.question_order','INVALID_JSON_TYPE',v_cnt,'Expected JSONB array'; END IF;
  END IF;

  -- --------------------------------------------------------------------------
  -- 07. INVALID DATES, RANGES & DOMAIN CHECK CONSTRAINTS
  -- --------------------------------------------------------------------------
  IF pg_temp.has_table_cols('user_profiles', ARRAY['role']) THEN
    SELECT count(*) INTO v_cnt FROM public.user_profiles WHERE role NOT IN ('admin','teacher','student','parent');
    IF v_cnt > 0 THEN RETURN QUERY SELECT '07_VALUE_CONSTRAINT','user_profiles.role','INVALID_DOMAIN',v_cnt,'Expected admin/teacher/student/parent'; END IF;
  END IF;

  IF pg_temp.has_table_cols('students', ARRAY['dob','gender','status']) THEN
    SELECT count(*) INTO v_cnt FROM public.students WHERE dob::text !~ '^\d{4}-\d{2}-\d{2}$';
    IF v_cnt > 0 THEN RETURN QUERY SELECT '07_VALUE_CONSTRAINT','students.dob','INVALID_FORMAT',v_cnt,'Expected YYYY-MM-DD'; END IF;
    SELECT count(*) INTO v_cnt FROM public.students WHERE gender NOT IN ('Male','Female') OR status NOT IN ('Active','Graduated','Suspended');
    IF v_cnt > 0 THEN RETURN QUERY SELECT '07_VALUE_CONSTRAINT','students.(gender|status)','INVALID_DOMAIN',v_cnt,'Violates gender/status CHECK'; END IF;
  END IF;

  IF pg_temp.has_table_cols('scores', ARRAY['term','ca1_score','ca2_score','exam_score','total_score','grade']) THEN
    SELECT count(*) INTO v_cnt FROM public.scores
    WHERE term NOT IN ('1st Term','2nd Term','3rd Term')
       OR ca1_score < 0 OR ca1_score > 20
       OR ca2_score < 0 OR ca2_score > 20
       OR exam_score < 0 OR exam_score > 60
       OR total_score < 0 OR total_score > 100
       OR grade NOT IN ('A','B','C','D','E','F');
    IF v_cnt > 0 THEN RETURN QUERY SELECT '07_VALUE_CONSTRAINT','scores','INVALID_RANGE_OR_ENUM',v_cnt,'Violates chk_scores_ranges'; END IF;
  END IF;

  IF pg_temp.has_table_cols('terminal_results', ARRAY['term','average_score','position_in_class','total_students_in_class','days_present','days_absent','total_school_days','status']) THEN
    SELECT count(*) INTO v_cnt FROM public.terminal_results
    WHERE term NOT IN ('1st Term','2nd Term','3rd Term')
       OR average_score < 0 OR average_score > 100
       OR position_in_class < 1 OR total_students_in_class < 1
       OR days_present < 0 OR days_absent < 0 OR total_school_days < 0
       OR status NOT IN ('Draft','Published');
    IF v_cnt > 0 THEN RETURN QUERY SELECT '07_VALUE_CONSTRAINT','terminal_results','INVALID_RANGE_OR_ENUM',v_cnt,'Violates chk_terminal_results_valid'; END IF;
  END IF;

  IF pg_temp.has_table_cols('attendance', ARRAY['date','status']) THEN
    SELECT count(*) INTO v_cnt FROM public.attendance WHERE date::text !~ '^\d{4}-\d{2}-\d{2}$' OR status NOT IN ('Present','Absent','Late','Excused');
    IF v_cnt > 0 THEN RETURN QUERY SELECT '07_VALUE_CONSTRAINT','attendance.(date|status)','INVALID_VALUE',v_cnt,'Invalid date or attendance status'; END IF;
  END IF;

  IF pg_temp.has_table_cols('cbt_exams', ARRAY['start_date','end_date','duration_minutes','pass_percentage']) THEN
    SELECT count(*) INTO v_cnt FROM public.cbt_exams
    WHERE start_date::text !~ '^\d{4}-\d{2}-\d{2}$'
       OR end_date::text !~ '^\d{4}-\d{2}-\d{2}$'
       OR duration_minutes <= 0
       OR pass_percentage < 0 OR pass_percentage > 100;
    IF v_cnt > 0 THEN RETURN QUERY SELECT '07_VALUE_CONSTRAINT','cbt_exams','INVALID_VALUE',v_cnt,'Invalid dates or numeric bounds'; END IF;
  END IF;

  IF pg_temp.has_table_cols('cbt_questions', ARRAY['correct_option','marks']) THEN
    SELECT count(*) INTO v_cnt FROM public.cbt_questions WHERE correct_option NOT IN ('A','B','C','D') OR marks <= 0;
    IF v_cnt > 0 THEN RETURN QUERY SELECT '07_VALUE_CONSTRAINT','cbt_questions','INVALID_VALUE',v_cnt,'Violates chk_cbt_questions_valid'; END IF;
  END IF;

  IF pg_temp.has_table_cols('fee_records', ARRAY['term','tuition','development_fee','ict_fee','uniform_fee','total','amount_paid','balance','status']) THEN
    SELECT count(*) INTO v_cnt FROM public.fee_records
    WHERE term NOT IN ('1st Term','2nd Term','3rd Term')
       OR tuition < 0 OR development_fee < 0 OR ict_fee < 0 OR uniform_fee < 0
       OR total < 0 OR amount_paid < 0 OR balance < 0
       OR status NOT IN ('Paid','Partial','Unpaid');
    IF v_cnt > 0 THEN RETURN QUERY SELECT '07_VALUE_CONSTRAINT','fee_records','INVALID_VALUE',v_cnt,'Violates chk_fee_records_valid'; END IF;
  END IF;

  RETURN;
END;
$$;

SELECT *
FROM pg_temp.run_preflight_checks()
ORDER BY check_category, target_name;
