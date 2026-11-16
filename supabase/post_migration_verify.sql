-- ============================================================================
-- DIVINE ACADEMY SECONDARY SCHOOL PORTAL
-- PRIORITY 3: POST-MIGRATION VERIFICATION SCRIPT (READ-ONLY / ROLLBACK SAFE)
-- ============================================================================

-- 1. Verify all 27 expected portal tables exist and have RLS enabled
WITH expected_tables(table_name) AS (
  VALUES
    ('academic_sessions'),
    ('announcements'),
    ('assignment_submissions'),
    ('assignments'),
    ('attendance'),
    ('cbt_attempts'),
    ('cbt_exam_sessions'),
    ('cbt_exams'),
    ('cbt_questions'),
    ('classes'),
    ('download_documents'),
    ('fee_records'),
    ('gallery_images'),
    ('news_items'),
    ('online_applications'),
    ('parent_students'),
    ('parents'),
    ('scores'),
    ('student_result_passcodes'),
    ('students'),
    ('study_notes'),
    ('subjects'),
    ('system_settings'),
    ('teacher_subjects'),
    ('teachers'),
    ('terminal_results'),
    ('user_profiles')
)
SELECT
  et.table_name,
  (pt.tablename IS NOT NULL) AS table_exists,
  COALESCE(pt.rowsecurity, false) AS rls_enabled,
  CASE
    WHEN pt.tablename IS NULL THEN 'MISSING_TABLE'
    WHEN NOT pt.rowsecurity THEN 'RLS_DISABLED'
    ELSE 'OK'
  END AS status
FROM expected_tables et
LEFT JOIN pg_tables pt
  ON pt.schemaname = 'public'
 AND pt.tablename = et.table_name
ORDER BY et.table_name;

-- 2. Verify all 3 security views exist and check security_invoker options
WITH expected_views(view_name, expected_invoker) AS (
  VALUES
    ('public_site_settings', false),
    ('students_safe', true),
    ('teachers_safe', true)
)
SELECT
  ev.view_name,
  (c.relname IS NOT NULL) AS exists,
  COALESCE('security_invoker=true' = ANY(c.reloptions), false) AS is_security_invoker,
  CASE
    WHEN c.relname IS NULL THEN 'MISSING_VIEW'
    WHEN ev.expected_invoker AND NOT COALESCE('security_invoker=true' = ANY(c.reloptions), false)
      THEN 'MISSING_SECURITY_INVOKER'
    ELSE 'OK'
  END AS status
FROM expected_views ev
LEFT JOIN pg_class c
  ON c.relnamespace = 'public'::regnamespace
 AND c.relname = ev.view_name
 AND c.relkind = 'v'
ORDER BY ev.view_name;

-- 3. Verify created_at / updated_at columns and exact trigger count (no column multiplication)
WITH expected_tables(table_name) AS (
  VALUES
    ('academic_sessions'),('announcements'),('assignment_submissions'),('assignments'),
    ('attendance'),('cbt_attempts'),('cbt_exam_sessions'),('cbt_exams'),('cbt_questions'),('classes'),
    ('download_documents'),('fee_records'),('gallery_images'),('news_items'),
    ('online_applications'),('parent_students'),('parents'),('scores'),
    ('student_result_passcodes'),('students'),('study_notes'),('subjects'),
    ('system_settings'),('teacher_subjects'),('teachers'),('terminal_results'),
    ('user_profiles')
),
col_flags AS (
  SELECT
    c.table_name,
    bool_or(c.column_name = 'created_at') AS has_created_at,
    bool_or(c.column_name = 'updated_at') AS has_updated_at
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
  GROUP BY c.table_name
),
trg_counts AS (
  SELECT
    cls.relname AS table_name,
    count(DISTINCT trg.tgname) AS updated_at_trigger_count
  FROM pg_trigger trg
  JOIN pg_class cls ON cls.oid = trg.tgrelid
  JOIN pg_namespace ns ON ns.oid = cls.relnamespace
  WHERE ns.nspname = 'public'
    AND NOT trg.tgisinternal
    AND trg.tgname = 'trg_' || cls.relname || '_updated_at'
  GROUP BY cls.relname
)
SELECT
  et.table_name,
  COALESCE(cf.has_created_at, false) AS has_created_at,
  COALESCE(cf.has_updated_at, false) AS has_updated_at,
  COALESCE(tc.updated_at_trigger_count, 0) AS updated_at_trigger_count,
  CASE
    WHEN NOT COALESCE(cf.has_created_at, false) OR NOT COALESCE(cf.has_updated_at, false) THEN 'MISSING_TIMESTAMPS'
    WHEN COALESCE(tc.updated_at_trigger_count, 0) <> 1 THEN 'TRIGGER_COUNT_MISMATCH'
    ELSE 'OK'
  END AS status
FROM expected_tables et
LEFT JOIN col_flags cf ON cf.table_name = et.table_name
LEFT JOIN trg_counts tc ON tc.table_name = et.table_name
ORDER BY et.table_name;

-- 4. Verify all foreign keys and delete actions (1 row per FK via pg_constraint)
SELECT
  src.relname AS table_name,
  con.conname AS constraint_name,
  att.attname AS column_name,
  tgt.relname AS references_table,
  CASE con.confdeltype
    WHEN 'a' THEN 'NO ACTION'
    WHEN 'r' THEN 'RESTRICT'
    WHEN 'c' THEN 'CASCADE'
    WHEN 'n' THEN 'SET NULL'
    WHEN 'd' THEN 'SET DEFAULT'
    ELSE con.confdeltype::text
  END AS delete_rule
FROM pg_constraint con
JOIN pg_class src ON src.oid = con.conrelid
JOIN pg_namespace ns ON ns.oid = src.relnamespace
JOIN pg_class tgt ON tgt.oid = con.confrelid
JOIN LATERAL unnest(con.conkey) WITH ORDINALITY AS k(attnum, ord) ON true
JOIN pg_attribute att ON att.attrelid = src.oid AND att.attnum = k.attnum
WHERE ns.nspname = 'public'
  AND con.contype = 'f'
ORDER BY src.relname, con.conname, k.ord;

-- 5. Verify all expected unique & performance indexes exist
WITH expected_indexes(index_name) AS (
  VALUES
    ('idx_user_profiles_role_ref'),
    ('uq_classes_name'),('uq_subjects_code'),('uq_students_admission_no'),('uq_students_email'),('uq_students_auth_user'),
    ('uq_teachers_staff_id'),('uq_teachers_email'),('uq_teachers_auth_user'),
    ('uq_parents_parent_id'),('uq_parents_email'),('uq_parents_auth_user'),
    ('uq_scores_student_subject_term'),('uq_terminal_results_student_term'),
    ('uq_attendance_student_date'),('uq_cbt_attempts_exam_student'),
    ('uq_cbt_exam_sessions_exam_student'),
    ('uq_assignment_submissions_pair'),('uq_online_applications_number'),
    ('uq_fee_records_receipt'),('uq_fee_records_student_term'),
    ('idx_students_class_id'),('idx_students_parent_email'),
    ('idx_scores_class_session_term'),('idx_scores_teacher_id'),
    ('idx_results_class_session_term'),('idx_attendance_class_date'),
    ('idx_cbt_exams_class_published'),('idx_cbt_exams_teacher_id'),
    ('idx_cbt_questions_exam_order'),('idx_cbt_attempts_student'),
    ('idx_cbt_exam_sessions_student'),('idx_cbt_exam_sessions_status'),
    ('idx_assignments_class_due'),('idx_assignments_teacher_id'),
    ('idx_study_notes_class'),('idx_study_notes_teacher_id'),
    ('idx_announcements_date'),('idx_fee_records_student_status')
)
SELECT
  ei.index_name,
  (pi.indexname IS NOT NULL) AS exists,
  CASE WHEN pi.indexname IS NULL THEN 'MISSING_INDEX' ELSE 'OK' END AS status
FROM expected_indexes ei
LEFT JOIN pg_indexes pi
  ON pi.schemaname = 'public'
 AND pi.indexname = ei.index_name
ORDER BY ei.index_name;

-- 6. Verify sensitive column privileges & anon table lockdown
-- Expected: 0 rows for SELECT on password / result_passcode for anon & authenticated
SELECT
  table_name,
  grantee,
  column_name,
  privilege_type
FROM information_schema.column_privileges
WHERE table_schema = 'public'
  AND table_name IN ('students', 'teachers')
  AND column_name IN ('password', 'result_passcode')
  AND privilege_type = 'SELECT'
  AND grantee IN ('anon', 'authenticated');

-- Verify anon only holds privileges on public views/tables (expected: ONLY public_site_settings,
-- news_items, gallery_images, download_documents, announcements, online_applications)
SELECT
  table_name,
  string_agg(privilege_type, ', ' ORDER BY privilege_type) AS anon_privileges
FROM information_schema.table_privileges
WHERE table_schema = 'public'
  AND grantee = 'anon'
GROUP BY table_name
ORDER BY table_name;

-- Verify view grants for authenticated & anon
SELECT
  table_name AS view_name,
  grantee,
  privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'public'
  AND table_name IN ('public_site_settings', 'students_safe', 'teachers_safe')
  AND grantee IN ('anon', 'authenticated')
ORDER BY table_name, grantee;

-- 7. Verify RLS policy coverage per expected table (flags any table with 0 policies)
WITH expected_tables(table_name) AS (
  VALUES
    ('academic_sessions'),('announcements'),('assignment_submissions'),('assignments'),
    ('attendance'),('cbt_attempts'),('cbt_exam_sessions'),('cbt_exams'),('cbt_questions'),('classes'),
    ('download_documents'),('fee_records'),('gallery_images'),('news_items'),
    ('online_applications'),('parent_students'),('parents'),('scores'),
    ('student_result_passcodes'),('students'),('study_notes'),('subjects'),
    ('system_settings'),('teacher_subjects'),('teachers'),('terminal_results'),
    ('user_profiles')
)
SELECT
  et.table_name,
  count(p.policyname) AS policy_count,
  COALESCE(string_agg(format('%s (%s)', p.policyname, p.cmd), '; ' ORDER BY p.policyname), 'NONE') AS policies,
  CASE WHEN count(p.policyname) = 0 THEN 'MISSING_POLICIES' ELSE 'OK' END AS status
FROM expected_tables et
LEFT JOIN pg_policies p
  ON p.schemaname = 'public'
 AND p.tablename = et.table_name
GROUP BY et.table_name
ORDER BY et.table_name;

-- 8. Verify Priority 4 RPC execution privileges & security isolation
WITH expected_rpcs(func_name, allow_anon, allow_authenticated, allow_service_role) AS (
  VALUES
    ('bootstrap_first_admin', false, false, true),
    ('sync_my_user_profile', false, true, true),
    ('verify_student_result_passcode', false, true, true),
    ('get_student_cbt_exams', false, true, true),
    ('start_cbt_exam', false, true, true),
    ('submit_cbt_exam', false, true, true)
)
SELECT
  er.func_name,
  (p.oid IS NOT NULL) AS exists,
  CASE WHEN p.oid IS NULL THEN false ELSE has_function_privilege('anon', p.oid, 'EXECUTE') END AS anon_exec,
  CASE WHEN p.oid IS NULL THEN false ELSE has_function_privilege('authenticated', p.oid, 'EXECUTE') END AS auth_exec,
  CASE WHEN p.oid IS NULL THEN false ELSE has_function_privilege('service_role', p.oid, 'EXECUTE') END AS service_exec,
  CASE
    WHEN p.oid IS NULL THEN 'MISSING_FUNCTION'
    WHEN has_function_privilege('anon', p.oid, 'EXECUTE') <> er.allow_anon THEN 'ANON_GRANT_MISMATCH'
    WHEN has_function_privilege('authenticated', p.oid, 'EXECUTE') <> er.allow_authenticated THEN 'AUTH_GRANT_MISMATCH'
    WHEN has_function_privilege('service_role', p.oid, 'EXECUTE') <> er.allow_service_role THEN 'SERVICE_GRANT_MISMATCH'
    ELSE 'OK'
  END AS status
FROM expected_rpcs er
LEFT JOIN pg_proc p
  ON p.pronamespace = 'public'::regnamespace
 AND p.proname = er.func_name
ORDER BY er.func_name;

-- 9. Verify CBT answer-key lockdown, immutable attempts, & assignment submission checks
SELECT
  tablename,
  policyname,
  cmd,
  CASE
    WHEN tablename IN ('cbt_exams', 'cbt_questions') AND cmd IN ('SELECT', 'ALL') AND (qual ILIKE '%student%' OR with_check ILIKE '%student%')
      THEN 'SECURITY_REGRESSION_STUDENT_CBT_READ'
    WHEN tablename = 'cbt_attempts' AND cmd IN ('INSERT', 'UPDATE') AND (with_check ILIKE '%is_student_owner%' OR qual ILIKE '%is_student_owner%')
      THEN 'SECURITY_REGRESSION_STUDENT_ATTEMPT_WRITE'
    WHEN tablename = 'assignment_submissions' AND policyname = 'assignment_submissions_student_insert'
      AND (with_check NOT ILIKE '%grade IS NULL%' OR with_check NOT ILIKE '%feedback IS NULL%')
      THEN 'SECURITY_REGRESSION_GRADE_TAMPERING'
    ELSE 'OK'
  END AS security_audit
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('cbt_exams', 'cbt_questions', 'cbt_attempts', 'assignment_submissions', 'student_result_passcodes')
ORDER BY tablename, policyname;

-- 10. Verify runtime sync & CBT active-session guard triggers exist
WITH expected_triggers(table_name, trigger_name) AS (
  VALUES
    ('parents', 'trg_parents_sync_parent_students'),
    ('students', 'trg_students_sync_parent_students'),
    ('teachers', 'trg_teachers_sync_teacher_subjects'),
    ('cbt_exams', 'trg_cbt_exams_guard_active_session'),
    ('cbt_exams', 'trg_cbt_exams_sync_questions'),
    ('cbt_questions', 'trg_cbt_questions_guard_active_session')
)
SELECT
  et.table_name,
  et.trigger_name,
  (trg.oid IS NOT NULL) AS exists,
  CASE WHEN trg.oid IS NULL THEN 'MISSING_TRIGGER' ELSE 'OK' END AS status
FROM expected_triggers et
LEFT JOIN pg_class cls
  ON cls.relnamespace = 'public'::regnamespace
 AND cls.relname = et.table_name
LEFT JOIN pg_trigger trg
  ON trg.tgrelid = cls.oid
 AND trg.tgname = et.trigger_name
 AND NOT trg.tgisinternal
ORDER BY et.table_name, et.trigger_name;

-- 11. Safe anon access simulation (rolled back; modifies zero data)
BEGIN;
SET LOCAL ROLE anon;
SELECT count(*) AS public_site_settings_ok FROM public.public_site_settings;
SELECT count(*) AS public_news_ok FROM public.news_items;
SELECT count(*) AS public_announcements_ok FROM public.announcements;
ROLLBACK;
