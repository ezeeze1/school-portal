-- ============================================================================
-- DIVINE ACADEMY SECONDARY SCHOOL PORTAL
-- SINGLE-STATEMENT READ-ONLY DATABASE & SCHEMA COMPATIBILITY AUDIT
-- File: supabase/migrations/20260504_portal_compatibility_audit.sql
-- ============================================================================
-- READ-ONLY GUARANTEE:
--   - Single standalone WITH ... SELECT query for Supabase SQL Editor.
--   - Executes ZERO DDL or DML (no CREATE, ALTER, DROP, INSERT, UPDATE,
--     DELETE, TRUNCATE, GRANT, REVOKE, DO $$, or pg_temp objects).
--   - Inspects live records, IDs, foreign keys, teacher/student links,
--     and CBT option-shuffling objects without modifying any data.
-- ============================================================================

WITH
live_counts AS (
  SELECT
    (SELECT count(*)::bigint FROM public.classes) AS classes_cnt,
    (SELECT count(*)::bigint FROM public.subjects) AS subjects_cnt,
    (SELECT count(*)::bigint FROM public.teachers) AS teachers_cnt,
    (SELECT count(*)::bigint FROM public.students) AS students_cnt,
    (SELECT count(*)::bigint FROM public.parents) AS parents_cnt,
    (SELECT count(*)::bigint FROM public.user_profiles) AS user_profiles_cnt,
    (SELECT count(*)::bigint FROM public.teacher_subjects) AS teacher_subjects_cnt,
    (SELECT count(*)::bigint FROM public.cbt_exams) AS cbt_exams_cnt,
    (SELECT count(*)::bigint FROM public.cbt_questions) AS cbt_questions_cnt,
    (SELECT count(*)::bigint FROM public.cbt_attempts) AS cbt_attempts_cnt,
    (SELECT count(*)::bigint FROM public.cbt_exam_sessions) AS cbt_sessions_cnt,
    (SELECT count(*)::bigint FROM public.cbt_exam_session_options) AS cbt_session_options_cnt,
    (SELECT count(*)::bigint FROM public.scores) AS scores_cnt,
    (SELECT count(*)::bigint FROM public.terminal_results) AS terminal_results_cnt,
    (SELECT count(*)::bigint FROM public.assignments) AS assignments_cnt,
    (SELECT count(*)::bigint FROM public.study_notes) AS study_notes_cnt,
    (SELECT count(*)::bigint FROM public.attendance) AS attendance_cnt,
    (SELECT count(*)::bigint FROM public.system_settings WHERE id = 'default') AS default_settings_cnt
),
record_count_checks AS (
  SELECT
    10 AS sort_order,
    '01_LIVE_RECORD_COUNTS'::text AS check_category,
    'public.classes (row count)'::text AS target_name,
    CASE WHEN classes_cnt > 0 THEN 'PASS' ELSE 'FAIL' END::text AS status,
    CASE WHEN classes_cnt > 0 THEN 0::bigint ELSE 1::bigint END AS finding_count,
    CASE
      WHEN classes_cnt > 0 THEN format('%s class record(s) exist in public.classes.', classes_cnt)
      ELSE 'Zero class records exist. Create classes in Admin Class Management before creating exams, scores, or students.'
    END::text AS details
  FROM live_counts

  UNION ALL

  SELECT
    11 AS sort_order,
    '01_LIVE_RECORD_COUNTS'::text AS check_category,
    'public.subjects (row count)'::text AS target_name,
    CASE WHEN subjects_cnt > 0 THEN 'PASS' ELSE 'FAIL' END::text AS status,
    CASE WHEN subjects_cnt > 0 THEN 0::bigint ELSE 1::bigint END AS finding_count,
    CASE
      WHEN subjects_cnt > 0 THEN format('%s subject record(s) exist in public.subjects.', subjects_cnt)
      ELSE 'Zero subject records exist in public.subjects. CBT exams, scores, and assignments require valid subject_id foreign keys.'
    END::text AS details
  FROM live_counts

  UNION ALL

  SELECT
    12 AS sort_order,
    '01_LIVE_RECORD_COUNTS'::text AS check_category,
    'public.teachers (row count)'::text AS target_name,
    CASE WHEN teachers_cnt > 0 THEN 'PASS' ELSE 'WARN' END::text AS status,
    CASE WHEN teachers_cnt > 0 THEN 0::bigint ELSE 1::bigint END AS finding_count,
    CASE
      WHEN teachers_cnt > 0 THEN format('%s teacher record(s) exist in public.teachers.', teachers_cnt)
      ELSE 'Zero teacher records exist in public.teachers.'
    END::text AS details
  FROM live_counts

  UNION ALL

  SELECT
    13 AS sort_order,
    '01_LIVE_RECORD_COUNTS'::text AS check_category,
    'public.students (row count)'::text AS target_name,
    CASE WHEN students_cnt > 0 THEN 'PASS' ELSE 'WARN' END::text AS status,
    CASE WHEN students_cnt > 0 THEN 0::bigint ELSE 1::bigint END AS finding_count,
    CASE
      WHEN students_cnt > 0 THEN format('%s student record(s) exist in public.students.', students_cnt)
      ELSE 'Zero student records exist in public.students.'
    END::text AS details
  FROM live_counts

  UNION ALL

  SELECT
    14 AS sort_order,
    '01_LIVE_RECORD_COUNTS'::text AS check_category,
    'public.system_settings (default row)'::text AS target_name,
    CASE WHEN default_settings_cnt = 1 THEN 'PASS' ELSE 'FAIL' END::text AS status,
    CASE WHEN default_settings_cnt = 1 THEN 0::bigint ELSE 1::bigint END AS finding_count,
    CASE
      WHEN default_settings_cnt = 1 THEN 'Default system_settings row (id=''default'') exists.'
      ELSE format('Expected 1 system_settings row id=''default'', found %s.', default_settings_cnt)
    END::text AS details
  FROM live_counts

  UNION ALL

  SELECT
    15 AS sort_order,
    '01_LIVE_RECORD_COUNTS'::text AS check_category,
    'academic_activity_snapshot'::text AS target_name,
    'PASS'::text AS status,
    0::bigint AS finding_count,
    format(
      'parents=%s, user_profiles=%s, teacher_subjects=%s, cbt_exams=%s, cbt_questions=%s, cbt_sessions=%s, cbt_session_options=%s, cbt_attempts=%s, scores=%s, terminal_results=%s, assignments=%s, study_notes=%s, attendance=%s.',
      parents_cnt,
      user_profiles_cnt,
      teacher_subjects_cnt,
      cbt_exams_cnt,
      cbt_questions_cnt,
      cbt_sessions_cnt,
      cbt_session_options_cnt,
      cbt_attempts_cnt,
      scores_cnt,
      terminal_results_cnt,
      assignments_cnt,
      study_notes_cnt,
      attendance_cnt
    )::text AS details
  FROM live_counts
),
class_subject_summary AS (
  SELECT
    (SELECT string_agg(format('%s (%s)', c.id, c.name), ', ' ORDER BY c.name, c.id) FROM public.classes c) AS class_list,
    (SELECT count(*)::bigint FROM public.classes c WHERE c.id LIKE 'c-%' AND c.id NOT LIKE 'cls-%') AS legacy_c_class_cnt,
    (SELECT count(*)::bigint FROM (SELECT lower(trim(name)) FROM public.classes GROUP BY 1 HAVING count(*) > 1) d) AS dup_class_names,
    (SELECT string_agg(format('%s (%s: %s)', s.id, s.code, s.name), ', ' ORDER BY s.name, s.id) FROM public.subjects s) AS subject_list,
    (SELECT count(*)::bigint FROM (SELECT lower(trim(code)) FROM public.subjects GROUP BY 1 HAVING count(*) > 1) d) AS dup_subject_codes,
    (SELECT count(*)::bigint FROM (SELECT lower(trim(name)) FROM public.subjects GROUP BY 1 HAVING count(*) > 1) d) AS dup_subject_names
),
class_subject_checks AS (
  SELECT
    20 AS sort_order,
    '02_CLASS_AND_SUBJECT_IDS'::text AS check_category,
    'live_classes_catalog'::text AS target_name,
    CASE
      WHEN class_list IS NULL THEN 'FAIL'
      WHEN dup_class_names > 0 THEN 'WARN'
      ELSE 'PASS'
    END::text AS status,
    COALESCE(dup_class_names, 0)::bigint AS finding_count,
    CASE
      WHEN class_list IS NULL THEN 'No rows in public.classes.'
      WHEN dup_class_names > 0 THEN format('%s duplicate class name(s) found. Live classes: %s', dup_class_names, class_list)
      ELSE format('Live classes (legacy c-* count=%s): %s', legacy_c_class_cnt, class_list)
    END::text AS details
  FROM class_subject_summary

  UNION ALL

  SELECT
    21 AS sort_order,
    '02_CLASS_AND_SUBJECT_IDS'::text AS check_category,
    'live_subjects_catalog'::text AS target_name,
    CASE
      WHEN subject_list IS NULL THEN 'FAIL'
      WHEN dup_subject_codes > 0 OR dup_subject_names > 0 THEN 'WARN'
      ELSE 'PASS'
    END::text AS status,
    (COALESCE(dup_subject_codes, 0) + COALESCE(dup_subject_names, 0))::bigint AS finding_count,
    CASE
      WHEN subject_list IS NULL THEN 'No rows in public.subjects. Add subjects via Admin Subject Manager before teachers create CBT exams or enter scores.'
      WHEN dup_subject_codes > 0 OR dup_subject_names > 0 THEN format('Duplicate subject code (%s) or name (%s). Live subjects: %s', dup_subject_codes, dup_subject_names, subject_list)
      ELSE format('Live subjects: %s', subject_list)
    END::text AS details
  FROM class_subject_summary
),
teacher_student_audit AS (
  SELECT
    (SELECT count(*)::bigint FROM public.teachers t WHERE t.auth_user_id IS NULL) AS teachers_without_auth,
    (
      SELECT count(*)::bigint
      FROM public.teachers t
      WHERE t.auth_user_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM public.user_profiles up
          WHERE up.auth_user_id = t.auth_user_id
            AND up.role = 'teacher'
            AND up.reference_id = t.id
        )
    ) AS teachers_profile_mismatch,
    (
      SELECT count(*)::bigint
      FROM public.teachers t
      WHERE COALESCE(t.status, 'Active') = 'Active'
        AND NOT EXISTS (SELECT 1 FROM public.teacher_subjects ts WHERE ts.teacher_id = t.id)
        AND jsonb_array_length(CASE WHEN jsonb_typeof(t.subject_ids) = 'array' THEN t.subject_ids ELSE '[]'::jsonb END) = 0
        AND jsonb_array_length(CASE WHEN jsonb_typeof(t.subjects_taught) = 'array' THEN t.subjects_taught ELSE '[]'::jsonb END) = 0
    ) AS active_teachers_no_subjects,
    (
      SELECT count(*)::bigint
      FROM public.teachers t
      CROSS JOIN LATERAL jsonb_array_elements_text(
        CASE WHEN jsonb_typeof(t.subject_ids) = 'array' THEN t.subject_ids ELSE '[]'::jsonb END
      ) AS sid(val)
      WHERE trim(sid.val) <> ''
        AND NOT EXISTS (SELECT 1 FROM public.subjects s WHERE s.id = sid.val)
    ) AS teacher_invalid_subject_ids,
    (
      SELECT count(*)::bigint
      FROM public.teachers t
      CROSS JOIN LATERAL jsonb_array_elements_text(
        CASE WHEN jsonb_typeof(t.subjects_taught) = 'array' THEN t.subjects_taught ELSE '[]'::jsonb END
      ) AS sname(val)
      WHERE trim(sname.val) <> ''
        AND NOT EXISTS (SELECT 1 FROM public.subjects s WHERE lower(trim(s.name)) = lower(trim(sname.val)))
    ) AS teacher_unmatched_subject_names,
    (
      SELECT count(*)::bigint
      FROM public.teachers t
      WHERE COALESCE(t.status, 'Active') = 'Active'
        AND NULLIF(trim(COALESCE(t.form_class_id, '')), '') IS NULL
        AND NULLIF(trim(COALESCE(t.class_taught, '')), '') IS NULL
        AND jsonb_array_length(CASE WHEN jsonb_typeof(t.classes_taught) = 'array' THEN t.classes_taught ELSE '[]'::jsonb END) = 0
    ) AS active_teachers_no_classes,
    (
      SELECT count(*)::bigint
      FROM public.teachers t
      WHERE NULLIF(trim(COALESCE(t.form_class_id, '')), '') IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM public.classes c WHERE c.id = t.form_class_id)
    ) AS teacher_invalid_form_class_id,
    (
      SELECT count(*)::bigint
      FROM public.teachers t
      CROSS JOIN LATERAL jsonb_array_elements_text(
        CASE WHEN jsonb_typeof(t.classes_taught) = 'array' THEN t.classes_taught ELSE '[]'::jsonb END
      ) AS cname(val)
      WHERE trim(cname.val) <> ''
        AND NOT EXISTS (
          SELECT 1 FROM public.classes c
          WHERE c.id = cname.val
             OR lower(trim(c.name)) = lower(trim(cname.val))
             OR lower(trim(cname.val)) LIKE lower(trim(c.name)) || ' %'
        )
    ) AS teacher_unmatched_classes_taught,
    (SELECT count(*)::bigint FROM public.students s WHERE s.auth_user_id IS NULL) AS students_without_auth,
    (
      SELECT count(*)::bigint
      FROM public.students s
      WHERE s.auth_user_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM public.user_profiles up
          WHERE up.auth_user_id = s.auth_user_id
            AND up.role = 'student'
            AND up.reference_id = s.id
        )
    ) AS students_profile_mismatch,
    (
      SELECT count(*)::bigint
      FROM public.students s
      WHERE NOT EXISTS (SELECT 1 FROM public.classes c WHERE c.id = s.class_id)
    ) AS students_invalid_class_id,
    (
      SELECT count(*)::bigint
      FROM public.students s
      JOIN public.classes c ON c.id = s.class_id
      WHERE lower(trim(s.class_name)) <> lower(trim(c.name))
    ) AS students_stale_class_name
),
teacher_student_checks AS (
  SELECT
    30 AS sort_order,
    '03_TEACHER_AND_STUDENT_LINKS'::text AS check_category,
    'teachers: auth_user_id & user_profiles parity'::text AS target_name,
    CASE WHEN (teachers_without_auth + teachers_profile_mismatch) = 0 THEN 'PASS' ELSE 'WARN' END::text AS status,
    (teachers_without_auth + teachers_profile_mismatch)::bigint AS finding_count,
    format('Teachers without auth_user_id=%s; user_profiles mismatch=%s.', teachers_without_auth, teachers_profile_mismatch)::text AS details
  FROM teacher_student_audit

  UNION ALL

  SELECT
    31 AS sort_order,
    '03_TEACHER_AND_STUDENT_LINKS'::text AS check_category,
    'teachers: subject assignments & public.subjects parity'::text AS target_name,
    CASE
      WHEN teacher_invalid_subject_ids > 0 OR teacher_unmatched_subject_names > 0 THEN 'WARN'
      WHEN active_teachers_no_subjects > 0 THEN 'WARN'
      ELSE 'PASS'
    END::text AS status,
    (active_teachers_no_subjects + teacher_invalid_subject_ids + teacher_unmatched_subject_names)::bigint AS finding_count,
    format(
      'Active teachers with zero subjects=%s; invalid subject_ids=%s; subjects_taught names missing in public.subjects=%s.',
      active_teachers_no_subjects,
      teacher_invalid_subject_ids,
      teacher_unmatched_subject_names
    )::text AS details
  FROM teacher_student_audit

  UNION ALL

  SELECT
    32 AS sort_order,
    '03_TEACHER_AND_STUDENT_LINKS'::text AS check_category,
    'teachers: class assignments & public.classes parity'::text AS target_name,
    CASE
      WHEN teacher_invalid_form_class_id > 0 THEN 'FAIL'
      WHEN active_teachers_no_classes > 0 OR teacher_unmatched_classes_taught > 0 THEN 'WARN'
      ELSE 'PASS'
    END::text AS status,
    (active_teachers_no_classes + teacher_invalid_form_class_id + teacher_unmatched_classes_taught)::bigint AS finding_count,
    format(
      'Active teachers with zero classes=%s; invalid form_class_id=%s; classes_taught entries missing in public.classes=%s.',
      active_teachers_no_classes,
      teacher_invalid_form_class_id,
      teacher_unmatched_classes_taught
    )::text AS details
  FROM teacher_student_audit

  UNION ALL

  SELECT
    33 AS sort_order,
    '03_TEACHER_AND_STUDENT_LINKS'::text AS check_category,
    'students: auth_user_id & user_profiles parity'::text AS target_name,
    CASE WHEN students_profile_mismatch > 0 THEN 'FAIL' WHEN students_without_auth > 0 THEN 'WARN' ELSE 'PASS' END::text AS status,
    (students_without_auth + students_profile_mismatch)::bigint AS finding_count,
    format('Students without auth_user_id=%s; user_profiles mismatch=%s.', students_without_auth, students_profile_mismatch)::text AS details
  FROM teacher_student_audit

  UNION ALL

  SELECT
    34 AS sort_order,
    '03_TEACHER_AND_STUDENT_LINKS'::text AS check_category,
    'students: class_id FK & class_name sync'::text AS target_name,
    CASE
      WHEN students_invalid_class_id > 0 THEN 'FAIL'
      WHEN students_stale_class_name > 0 THEN 'WARN'
      ELSE 'PASS'
    END::text AS status,
    (students_invalid_class_id + students_stale_class_name)::bigint AS finding_count,
    format('Students with invalid class_id=%s; stale class_name<>classes.name=%s.', students_invalid_class_id, students_stale_class_name)::text AS details
  FROM teacher_student_audit
),
orphan_fk_audit AS (
  SELECT
    (
      SELECT count(*)::bigint FROM public.cbt_exams ce
      WHERE NOT EXISTS (SELECT 1 FROM public.classes c WHERE c.id = ce.class_id)
         OR NOT EXISTS (SELECT 1 FROM public.subjects sb WHERE sb.id = ce.subject_id)
         OR (ce.teacher_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.teachers t WHERE t.id = ce.teacher_id))
    ) AS cbt_exams_orphans,
    (
      SELECT count(*)::bigint FROM public.scores sc
      WHERE NOT EXISTS (SELECT 1 FROM public.classes c WHERE c.id = sc.class_id)
         OR NOT EXISTS (SELECT 1 FROM public.subjects sb WHERE sb.id = sc.subject_id)
         OR NOT EXISTS (SELECT 1 FROM public.students st WHERE st.id = sc.student_id)
         OR (sc.teacher_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.teachers t WHERE t.id = sc.teacher_id))
    ) AS scores_orphans,
    (
      SELECT count(*)::bigint FROM public.assignments a
      WHERE NOT EXISTS (SELECT 1 FROM public.classes c WHERE c.id = a.class_id)
         OR NOT EXISTS (SELECT 1 FROM public.subjects sb WHERE sb.id = a.subject_id)
         OR (a.teacher_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.teachers t WHERE t.id = a.teacher_id))
    ) AS assignments_orphans,
    (
      SELECT count(*)::bigint FROM public.study_notes sn
      WHERE (sn.class_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.classes c WHERE c.id = sn.class_id))
         OR (sn.subject_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.subjects sb WHERE sb.id = sn.subject_id))
         OR (sn.teacher_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.teachers t WHERE t.id = sn.teacher_id))
    ) AS study_notes_orphans,
    (
      SELECT count(*)::bigint FROM public.attendance atn
      WHERE NOT EXISTS (SELECT 1 FROM public.classes c WHERE c.id = atn.class_id)
         OR NOT EXISTS (SELECT 1 FROM public.students st WHERE st.id = atn.student_id)
    ) AS attendance_orphans,
    (
      SELECT count(*)::bigint FROM public.terminal_results tr
      WHERE NOT EXISTS (SELECT 1 FROM public.classes c WHERE c.id = tr.class_id)
         OR NOT EXISTS (SELECT 1 FROM public.students st WHERE st.id = tr.student_id)
    ) AS terminal_results_orphans
),
orphan_checks AS (
  SELECT
    40 AS sort_order,
    '04_ORPHAN_FK_AUDIT'::text AS check_category,
    'orphan_references: cbt_exams'::text AS target_name,
    CASE WHEN cbt_exams_orphans = 0 THEN 'PASS' ELSE 'FAIL' END::text AS status,
    cbt_exams_orphans AS finding_count,
    CASE
      WHEN cbt_exams_orphans = 0 THEN 'Zero orphan class_id, subject_id, or teacher_id values in cbt_exams.'
      ELSE format('%s orphan reference(s) found in cbt_exams.', cbt_exams_orphans)
    END::text AS details
  FROM orphan_fk_audit

  UNION ALL

  SELECT
    41 AS sort_order,
    '04_ORPHAN_FK_AUDIT'::text AS check_category,
    'orphan_references: scores & terminal_results'::text AS target_name,
    CASE WHEN (scores_orphans + terminal_results_orphans) = 0 THEN 'PASS' ELSE 'FAIL' END::text AS status,
    (scores_orphans + terminal_results_orphans)::bigint AS finding_count,
    format('Orphan references in scores=%s; terminal_results=%s.', scores_orphans, terminal_results_orphans)::text AS details
  FROM orphan_fk_audit

  UNION ALL

  SELECT
    42 AS sort_order,
    '04_ORPHAN_FK_AUDIT'::text AS check_category,
    'orphan_references: assignments, study_notes, attendance'::text AS target_name,
    CASE WHEN (assignments_orphans + study_notes_orphans + attendance_orphans) = 0 THEN 'PASS' ELSE 'FAIL' END::text AS status,
    (assignments_orphans + study_notes_orphans + attendance_orphans)::bigint AS finding_count,
    format('Orphan references in assignments=%s; study_notes=%s; attendance=%s.', assignments_orphans, study_notes_orphans, attendance_orphans)::text AS details
  FROM orphan_fk_audit
),
cbt_rpc_specs(fn_name, expected_args, expected_ret) AS (
  VALUES
    ('start_cbt_exam', 'p_exam_id text', 'jsonb'),
    ('save_cbt_exam_answers', 'p_exam_id text, p_answers jsonb', 'jsonb'),
    ('submit_cbt_exam', 'p_exam_id text, p_answers jsonb', 'jsonb'),
    ('get_student_cbt_exams', '', 'jsonb'),
    ('get_cbt_active_session_exam_ids', '', 'jsonb')
),
rls_table_specs(tbl_name) AS (
  VALUES
    ('classes'),
    ('subjects'),
    ('teachers'),
    ('students'),
    ('user_profiles'),
    ('cbt_exams'),
    ('cbt_questions'),
    ('cbt_attempts'),
    ('cbt_exam_sessions'),
    ('cbt_exam_session_options'),
    ('scores'),
    ('assignments'),
    ('study_notes'),
    ('attendance')
),
cbt_security_checks AS (
  SELECT
    50 AS sort_order,
    '05_CBT_AND_SECURITY_OBJECTS'::text AS check_category,
    format('rpc: public.%s(%s) -> %s', rs.fn_name, rs.expected_args, rs.expected_ret)::text AS target_name,
    CASE
      WHEN COALESCE(stats.fn_count, 0) = 1
       AND stats.actual_args = rs.expected_args
       AND stats.actual_ret = rs.expected_ret
        THEN 'PASS'
      ELSE 'FAIL'
    END::text AS status,
    CASE
      WHEN COALESCE(stats.fn_count, 0) = 1
       AND stats.actual_args = rs.expected_args
       AND stats.actual_ret = rs.expected_ret
        THEN 0::bigint
      ELSE 1::bigint
    END AS finding_count,
    CASE
      WHEN COALESCE(stats.fn_count, 0) = 0 THEN 'RPC missing from public schema.'
      WHEN stats.fn_count > 1 THEN format('Overloaded RPC (%s signatures).', stats.fn_count)
      WHEN stats.actual_args <> rs.expected_args OR stats.actual_ret <> rs.expected_ret
        THEN format('Signature mismatch: found (%s) -> %s.', stats.actual_args, stats.actual_ret)
      ELSE format('Verified (SECURITY DEFINER=%s).', stats.is_secdef)
    END::text AS details
  FROM cbt_rpc_specs rs
  LEFT JOIN LATERAL (
    SELECT
      count(*)::bigint AS fn_count,
      max(pg_catalog.pg_get_function_identity_arguments(p.oid)) AS actual_args,
      max(pg_catalog.pg_get_function_result(p.oid)) AS actual_ret,
      bool_and(p.prosecdef) AS is_secdef
    FROM pg_catalog.pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace
      AND p.proname = rs.fn_name::name
  ) AS stats ON true

  UNION ALL

  SELECT
    51 AS sort_order,
    '05_CBT_AND_SECURITY_OBJECTS'::text AS check_category,
    'rls_enabled: core academic & CBT tables'::text AS target_name,
    CASE WHEN count(*) FILTER (WHERE COALESCE(c.relrowsecurity, false) = false) = 0 THEN 'PASS' ELSE 'FAIL' END::text AS status,
    count(*) FILTER (WHERE COALESCE(c.relrowsecurity, false) = false)::bigint AS finding_count,
    CASE
      WHEN count(*) FILTER (WHERE COALESCE(c.relrowsecurity, false) = false) = 0
        THEN format('Row Level Security is enabled on all %s audited tables.', count(*))
      ELSE 'RLS disabled on: ' || string_agg(rts.tbl_name, ', ' ORDER BY rts.tbl_name) FILTER (WHERE COALESCE(c.relrowsecurity, false) = false)
    END::text AS details
  FROM rls_table_specs rts
  LEFT JOIN pg_catalog.pg_class c
    ON c.relnamespace = 'public'::regnamespace
   AND c.relname = rts.tbl_name::name
   AND c.relkind = 'r'

  UNION ALL

  SELECT
    52 AS sort_order,
    '05_CBT_AND_SECURITY_OBJECTS'::text AS check_category,
    'shuffling_columns & sync triggers'::text AS target_name,
    CASE
      WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='cbt_exam_sessions' AND column_name='draft_answers')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='cbt_exams' AND column_name='allow_answer_review')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='system_settings' AND column_name='cbt_allow_answer_review')
       AND EXISTS (SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid WHERE c.relnamespace='public'::regnamespace AND NOT t.tgisinternal AND t.tgname = 'trg_cbt_exams_sync_questions')
       AND EXISTS (SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid WHERE c.relnamespace='public'::regnamespace AND NOT t.tgisinternal AND t.tgname = 'trg_teachers_sync_teacher_subjects')
      THEN 'PASS'
      ELSE 'FAIL'
    END::text AS status,
    CASE
      WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='cbt_exam_sessions' AND column_name='draft_answers')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='cbt_exams' AND column_name='allow_answer_review')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='system_settings' AND column_name='cbt_allow_answer_review')
       AND EXISTS (SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid WHERE c.relnamespace='public'::regnamespace AND NOT t.tgisinternal AND t.tgname = 'trg_cbt_exams_sync_questions')
       AND EXISTS (SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid WHERE c.relnamespace='public'::regnamespace AND NOT t.tgisinternal AND t.tgname = 'trg_teachers_sync_teacher_subjects')
      THEN 0::bigint
      ELSE 1::bigint
    END AS finding_count,
    'Verifies draft_answers, allow_answer_review, cbt_allow_answer_review, trg_cbt_exams_sync_questions, and trg_teachers_sync_teacher_subjects.'::text AS details
),
all_checks AS (
  SELECT * FROM record_count_checks
  UNION ALL SELECT * FROM class_subject_checks
  UNION ALL SELECT * FROM teacher_student_checks
  UNION ALL SELECT * FROM orphan_checks
  UNION ALL SELECT * FROM cbt_security_checks
),
summary_row AS (
  SELECT
    0 AS sort_order,
    '00_SUMMARY'::text AS check_category,
    'portal_compatibility_audit'::text AS target_name,
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
) report
ORDER BY sort_order, check_category, target_name;
