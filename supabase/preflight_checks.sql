-- ============================================================================
-- DIVINE ACADEMY SECONDARY SCHOOL PORTAL
-- PRIORITY 3: EMPTY-DB-SAFE READ-ONLY PREFLIGHT DIAGNOSTIC SCRIPT
-- ============================================================================
-- PURPOSE:
--   Safe to run against a COMPLETELY EMPTY Supabase database or an existing one.
--   Never references a table or column before verifying existence in catalog.
--   Uses session-only pg_temp helper functions (zero persistent DB writes).
--   Reports:
--     1. Fresh/empty database readiness & missing tables/columns (all 27 tables)
--     2. Duplicate records blocking UNIQUE indexes
--     3. Orphan foreign-key references (including guarded JSONB arrays & 'all')
--     4. JSONB data-type validation (array vs object)
--     5. Invalid dates, numeric ranges, and domain/enum values
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
  v_rec record;
BEGIN
  -- --------------------------------------------------------------------------
  -- 1. OVERALL DATABASE STATE & EXPECTED 27-TABLE INVENTORY
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
      '0 of 27 expected portal tables exist. Database is completely empty and ready for fresh execution of supabase/schema.sql.'::text;
  ELSE
    RETURN QUERY SELECT
      '01_DATABASE_STATE'::text,
      'public_schema'::text,
      CASE WHEN v_existing_count = 27 THEN 'ALL_27_TABLES_PRESENT' ELSE 'PARTIAL_SCHEMA_DETECTED' END::text,
      (27 - v_existing_count)::bigint,
      format('%s of 27 expected portal tables currently exist.', v_existing_count);
  END IF;

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
        'Table already exists; running column, duplicate, orphan, JSONB & constraint checks.'::text;
    END IF;
  END LOOP;

  -- Exit early with zero table queries if database is completely empty
  IF v_existing_count = 0 THEN
    RETURN;
  END IF;

  -- --------------------------------------------------------------------------
  -- 2. MISSING EXPECTED COLUMNS ON EXISTING TABLES
  -- --------------------------------------------------------------------------
  FOR v_rec IN
    WITH expected_cols(tbl, col) AS (
      VALUES
        ('user_profiles','auth_user_id'),('user_profiles','role'),('user_profiles','created_at'),('user_profiles','updated_at'),
        ('academic_sessions','name'),('academic_sessions','is_current'),('academic_sessions','created_at'),('academic_sessions','updated_at'),
        ('system_settings','id'),('system_settings','current_session'),('system_settings','academic_sessions'),('system_settings','current_term'),('system_settings','created_at'),('system_settings','updated_at'),
        ('teachers','id'),('teachers','auth_user_id'),('teachers','staff_id'),('teachers','email'),('teachers','subject_ids'),('teachers','classes_taught'),('teachers','form_class_id'),('teachers','status'),('teachers','created_at'),('teachers','updated_at'),
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
  -- 3. DUPLICATE DETECTION FOR UNIQUE INDEXES
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
  -- 4. ORPHAN FOREIGN KEY & GUARDED JSONB ARRAY REFERENCE DETECTION
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
  -- 5. JSONB DATA-TYPE CHECKS (ARRAY VS OBJECT)
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

  -- --------------------------------------------------------------------------
  -- 6. INVALID DATES, RANGES & DOMAIN CHECK CONSTRAINTS
  -- --------------------------------------------------------------------------
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
