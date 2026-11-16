-- ============================================================================
-- DIVINE ACADEMY SECONDARY SCHOOL PORTAL
-- PRIORITY 3: FRESH-DATABASE SCHEMA, RELATIONSHIPS, BACKFILLS, GRANTS & RLS
-- ============================================================================
-- IMPORTANT:
--   1. Run supabase/preflight_checks.sql FIRST (safe on a completely empty DB).
--   2. Safe for fresh installs AND repeatable runs: uses CREATE TABLE IF NOT EXISTS,
--      ADD COLUMN IF NOT EXISTS, conditional DO $$ constraint blocks, guarded JSONB
--      operations, and ON CONFLICT DO NOTHING backfills.
--   3. Never drops, truncates, renames, or overwrites existing records.
--   4. Explicit schema, table, column, view, and function GRANT/REVOKE privileges
--      are included alongside fail-closed Row Level Security (RLS).
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. SHARED UPDATED_AT TRIGGER FUNCTION
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ----------------------------------------------------------------------------
-- 2. AUTH ROLE MAPPING & BOOTSTRAP FOUNDATION (ACTIVATED IN PRIORITY 4)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_profiles (
  auth_user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('admin', 'teacher', 'student', 'parent')),
  reference_id text,
  email text NOT NULL,
  full_name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_user_profiles_role_ref
  ON public.user_profiles (role, reference_id);

-- Resolves first-admin bootstrap safely:
-- Only runnable by SQL Editor / service_role (revoked from PUBLIC/anon/authenticated),
-- and succeeds ONLY when no active admin profile exists yet.
CREATE OR REPLACE FUNCTION public.bootstrap_first_admin(
  p_admin_email text,
  p_full_name text DEFAULT 'System Administrator'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_auth_uid uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM public.user_profiles WHERE role = 'admin' AND is_active = true) THEN
    RAISE EXCEPTION 'An active administrator already exists in user_profiles.';
  END IF;

  SELECT id INTO v_auth_uid
  FROM auth.users
  WHERE lower(email) = lower(trim(p_admin_email))
  LIMIT 1;

  IF v_auth_uid IS NULL THEN
    RAISE EXCEPTION 'No auth.users account found for email %. Create the Supabase Auth user first in Priority 4.', p_admin_email;
  END IF;

  INSERT INTO public.user_profiles (auth_user_id, role, reference_id, email, full_name, is_active)
  VALUES (
    v_auth_uid,
    'admin',
    'ADM-001',
    lower(trim(p_admin_email)),
    COALESCE(NULLIF(trim(p_full_name), ''), 'System Administrator'),
    true
  )
  ON CONFLICT (auth_user_id) DO UPDATE
    SET role = 'admin',
        reference_id = 'ADM-001',
        is_active = true,
        updated_at = now();

  RETURN v_auth_uid;
END;
$$;

-- Helper functions trusting ONLY Supabase Auth auth.uid()
CREATE OR REPLACE FUNCTION public.current_app_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_profiles
  WHERE auth_user_id = auth.uid()
    AND is_active = true
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.current_app_role() = 'admin', false);
$$;

CREATE OR REPLACE FUNCTION public.is_teacher()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.current_app_role() = 'teacher', false);
$$;

-- ----------------------------------------------------------------------------
-- 3. TABLE CREATION (ALL 27 PORTAL TABLES IN DEPENDENCY ORDER)
-- ----------------------------------------------------------------------------
-- 1/27: user_profiles (created in Section 2)

-- 2/27: academic_sessions
CREATE TABLE IF NOT EXISTS public.academic_sessions (
  name text PRIMARY KEY,
  is_current boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3/27: system_settings
CREATE TABLE IF NOT EXISTS public.system_settings (
  id text PRIMARY KEY,
  current_session text NOT NULL,
  academic_sessions jsonb NOT NULL DEFAULT '[]'::jsonb,
  current_term text NOT NULL,
  is_result_published boolean NOT NULL DEFAULT false,
  result_entry_open boolean NOT NULL DEFAULT true,
  cbt_active boolean NOT NULL DEFAULT true,
  school_name text,
  school_motto text,
  school_logo_text text,
  school_phone text,
  school_email text,
  school_address text,
  hero_badge text,
  hero_title text,
  hero_subtitle text,
  hero_image text,
  hero_spotlight_label text,
  hero_spotlight_text text,
  hero_image_title text,
  stat_students_number text,
  stat_students_label text,
  stat_waec_number text,
  stat_waec_label text,
  stat_teachers_number text,
  stat_teachers_label text,
  stat_clubs_number text,
  stat_clubs_label text,
  about_vision text,
  about_mission text,
  about_principal_name text,
  about_principal_title text,
  about_principal_avatar text,
  about_principal_bio text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4/27: teachers
CREATE TABLE IF NOT EXISTS public.teachers (
  id text PRIMARY KEY,
  auth_user_id uuid,
  staff_id text NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  qualification text,
  email text NOT NULL,
  phone text NOT NULL,
  password text, -- Deprecated: clear in Priority 4 once migrated to Supabase Auth
  subject_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  subjects_taught jsonb NOT NULL DEFAULT '[]'::jsonb,
  form_class_id text,
  form_class_name text,
  class_taught text,
  classes_taught jsonb NOT NULL DEFAULT '[]'::jsonb,
  avatar text NOT NULL,
  join_date text,
  status text NOT NULL DEFAULT 'Active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 5/27: classes
CREATE TABLE IF NOT EXISTS public.classes (
  id text PRIMARY KEY,
  name text NOT NULL,
  category text NOT NULL,
  arms jsonb NOT NULL DEFAULT '[]'::jsonb,
  class_teacher_id text,
  capacity integer NOT NULL DEFAULT 35,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 6/27: subjects
CREATE TABLE IF NOT EXISTS public.subjects (
  id text PRIMARY KEY,
  code text NOT NULL,
  name text NOT NULL,
  category text NOT NULL,
  is_compulsory boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 7/27: students
CREATE TABLE IF NOT EXISTS public.students (
  id text PRIMARY KEY,
  auth_user_id uuid,
  admission_no text NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  other_names text,
  email text,
  gender text NOT NULL,
  dob text NOT NULL,
  class_id text NOT NULL,
  class_name text NOT NULL,
  arm text,
  house text,
  parent_name text NOT NULL,
  parent_phone text NOT NULL,
  parent_email text,
  password text,        -- Deprecated: clear in Priority 4
  result_passcode text, -- Isolated to student_result_passcodes & column-restricted
  address text NOT NULL,
  avatar text NOT NULL,
  status text NOT NULL DEFAULT 'Active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 8/27: student_result_passcodes (depends on students)
CREATE TABLE IF NOT EXISTS public.student_result_passcodes (
  student_id text PRIMARY KEY REFERENCES public.students(id) ON DELETE CASCADE,
  result_passcode text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 9/27: parents
CREATE TABLE IF NOT EXISTS public.parents (
  id text PRIMARY KEY,
  auth_user_id uuid,
  parent_id text NOT NULL,
  title text NOT NULL,
  full_name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  occupation text NOT NULL,
  address text NOT NULL,
  student_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 10/27: parent_students
CREATE TABLE IF NOT EXISTS public.parent_students (
  parent_id text NOT NULL,
  student_id text NOT NULL,
  relationship text NOT NULL DEFAULT 'Guardian',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (parent_id, student_id)
);

-- 11/27: teacher_subjects
CREATE TABLE IF NOT EXISTS public.teacher_subjects (
  teacher_id text NOT NULL,
  subject_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (teacher_id, subject_id)
);

-- 12/27: scores
CREATE TABLE IF NOT EXISTS public.scores (
  id text PRIMARY KEY,
  student_id text NOT NULL,
  subject_id text NOT NULL,
  subject_name text NOT NULL,
  class_id text NOT NULL,
  session_id text NOT NULL,
  term text NOT NULL,
  ca1_score numeric(5,2) NOT NULL DEFAULT 0,
  ca2_score numeric(5,2) NOT NULL DEFAULT 0,
  exam_score numeric(5,2) NOT NULL DEFAULT 0,
  total_score numeric(5,2) NOT NULL DEFAULT 0,
  grade text NOT NULL,
  remarks text NOT NULL DEFAULT '',
  teacher_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 13/27: terminal_results
CREATE TABLE IF NOT EXISTS public.terminal_results (
  id text PRIMARY KEY,
  student_id text NOT NULL,
  class_id text NOT NULL,
  session_id text NOT NULL,
  term text NOT NULL,
  scores jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_obtained numeric(7,2),
  total_possible numeric(7,2),
  grand_total_score numeric(7,2),
  average_score numeric(5,2) NOT NULL DEFAULT 0,
  position_in_class integer NOT NULL DEFAULT 1,
  total_students_in_class integer NOT NULL DEFAULT 1,
  psychomotor jsonb NOT NULL DEFAULT '{}'::jsonb,
  teacher_remarks text NOT NULL DEFAULT '',
  principal_remarks text NOT NULL DEFAULT '',
  days_present integer NOT NULL DEFAULT 0,
  days_absent integer NOT NULL DEFAULT 0,
  total_school_days integer NOT NULL DEFAULT 0,
  next_term_begins text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'Draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 14/27: attendance
CREATE TABLE IF NOT EXISTS public.attendance (
  id text PRIMARY KEY,
  student_id text NOT NULL,
  student_name text,
  class_id text NOT NULL,
  date text NOT NULL,
  status text NOT NULL,
  remark text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 15/27: cbt_exams
CREATE TABLE IF NOT EXISTS public.cbt_exams (
  id text PRIMARY KEY,
  title text NOT NULL,
  subject_id text NOT NULL,
  subject_name text NOT NULL,
  class_id text NOT NULL,
  class_name text NOT NULL,
  teacher_id text,
  term text,
  session text,
  duration_minutes integer NOT NULL DEFAULT 30,
  total_questions integer NOT NULL DEFAULT 0,
  total_marks numeric(6,2) NOT NULL DEFAULT 0,
  pass_percentage numeric(5,2) NOT NULL DEFAULT 50,
  start_date text NOT NULL,
  start_time text,
  end_date text NOT NULL,
  questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_published boolean NOT NULL DEFAULT false,
  shuffle_questions boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 16/27: cbt_questions
CREATE TABLE IF NOT EXISTS public.cbt_questions (
  id text PRIMARY KEY,
  exam_id text NOT NULL,
  question_order integer NOT NULL DEFAULT 1,
  question text NOT NULL,
  option_a text NOT NULL,
  option_b text NOT NULL,
  option_c text NOT NULL,
  option_d text NOT NULL,
  correct_option text NOT NULL,
  explanation text,
  marks numeric(5,2) NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 17/27: cbt_attempts
CREATE TABLE IF NOT EXISTS public.cbt_attempts (
  id text PRIMARY KEY,
  exam_id text NOT NULL,
  student_id text NOT NULL,
  student_name text NOT NULL,
  admission_no text NOT NULL,
  score_obtained numeric(6,2) NOT NULL DEFAULT 0,
  total_marks numeric(6,2) NOT NULL DEFAULT 0,
  percentage numeric(5,2) NOT NULL DEFAULT 0,
  passed boolean NOT NULL DEFAULT false,
  time_taken_seconds integer NOT NULL DEFAULT 0,
  completed_at text NOT NULL,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 18/27: cbt_exam_sessions (server-authoritative CBT timer, resume & concurrency lock)
CREATE TABLE IF NOT EXISTS public.cbt_exam_sessions (
  id text PRIMARY KEY,
  exam_id text NOT NULL,
  student_id text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  submitted_at timestamptz,
  status text NOT NULL DEFAULT 'in_progress',
  question_order jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 19/27: assignments
CREATE TABLE IF NOT EXISTS public.assignments (
  id text PRIMARY KEY,
  title text NOT NULL,
  subject_id text NOT NULL,
  subject_name text NOT NULL,
  class_id text NOT NULL,
  class_name text NOT NULL,
  teacher_id text,
  teacher_name text NOT NULL,
  due_date text NOT NULL,
  description text NOT NULL,
  format text,
  content text,
  attachment_url text,
  attachment_name text,
  file_size text,
  created_date text NOT NULL,
  total_marks numeric(6,2),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 20/27: assignment_submissions
CREATE TABLE IF NOT EXISTS public.assignment_submissions (
  id text PRIMARY KEY,
  assignment_id text NOT NULL,
  student_id text NOT NULL,
  student_name text NOT NULL,
  submission_date timestamptz NOT NULL DEFAULT now(),
  content text NOT NULL DEFAULT '',
  file_url text,
  grade numeric(6,2),
  feedback text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 21/27: study_notes
CREATE TABLE IF NOT EXISTS public.study_notes (
  id text PRIMARY KEY,
  title text NOT NULL,
  subject_id text,
  subject_name text NOT NULL,
  class_id text, -- NULL = All Classes
  class_name text NOT NULL,
  teacher_id text,
  teacher_name text,
  upload_date text NOT NULL,
  file_size text NOT NULL,
  download_url text,
  file_url text,
  description text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 22/27: news_items
CREATE TABLE IF NOT EXISTS public.news_items (
  id text PRIMARY KEY,
  title text NOT NULL,
  category text NOT NULL,
  date text NOT NULL,
  author text NOT NULL,
  summary text NOT NULL,
  content text NOT NULL,
  image_url text NOT NULL,
  featured boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 23/27: gallery_images
CREATE TABLE IF NOT EXISTS public.gallery_images (
  id text PRIMARY KEY,
  title text NOT NULL,
  category text NOT NULL,
  image_url text NOT NULL,
  caption text NOT NULL,
  date text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 24/27: online_applications
CREATE TABLE IF NOT EXISTS public.online_applications (
  id text PRIMARY KEY,
  application_number text NOT NULL,
  applicant_first_name text NOT NULL,
  applicant_last_name text NOT NULL,
  gender text NOT NULL,
  dob text NOT NULL,
  applied_class text NOT NULL,
  guardian_name text NOT NULL,
  guardian_email text NOT NULL,
  guardian_phone text NOT NULL,
  previous_school text NOT NULL,
  submission_date text NOT NULL,
  status text NOT NULL DEFAULT 'Pending',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 25/27: download_documents
CREATE TABLE IF NOT EXISTS public.download_documents (
  id text PRIMARY KEY,
  title text NOT NULL,
  category text NOT NULL,
  file_type text NOT NULL,
  file_size text NOT NULL,
  updated_date text NOT NULL,
  url text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 26/27: announcements
CREATE TABLE IF NOT EXISTS public.announcements (
  id text PRIMARY KEY,
  title text NOT NULL,
  message text NOT NULL,
  sender text NOT NULL,
  target_audience text,
  target_role text,
  priority text DEFAULT 'Normal',
  date text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 27/27: fee_records
CREATE TABLE IF NOT EXISTS public.fee_records (
  id text PRIMARY KEY,
  student_id text NOT NULL,
  student_name text NOT NULL,
  term text NOT NULL,
  session text NOT NULL,
  tuition numeric(12,2) NOT NULL DEFAULT 0,
  development_fee numeric(12,2) NOT NULL DEFAULT 0,
  ict_fee numeric(12,2) NOT NULL DEFAULT 0,
  uniform_fee numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL DEFAULT 0,
  amount_paid numeric(12,2) NOT NULL DEFAULT 0,
  balance numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'Unpaid',
  receipt_no text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 4. ENSURE ALL TABLES HAVE TIMESTAMPS & ADDITIVE COLUMNS BEFORE TRIGGERS
-- ----------------------------------------------------------------------------
ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS auth_user_id uuid;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS auth_user_id uuid;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.parents  ADD COLUMN IF NOT EXISTS auth_user_id uuid;

DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'user_profiles','academic_sessions','system_settings','teachers','classes',
    'subjects','students','student_result_passcodes','parents','parent_students',
    'teacher_subjects','scores','terminal_results','attendance','cbt_exams',
    'cbt_questions','cbt_attempts','cbt_exam_sessions','assignments',
    'assignment_submissions','study_notes','news_items','gallery_images',
    'online_applications','download_documents','announcements','fee_records'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();', tbl);
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();', tbl);
  END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- 5. SAFE DATA BACKFILLS (IDEMPOTENT, GUARDED AGAINST NULL/NON-ARRAY JSONB)
-- ----------------------------------------------------------------------------
-- 5a. Backfill normalized academic_sessions from system_settings.academic_sessions
INSERT INTO public.academic_sessions (name, is_current)
SELECT
  trim(s.session_name),
  (trim(s.session_name) = ss.current_session)
FROM public.system_settings ss
CROSS JOIN LATERAL jsonb_array_elements_text(
  CASE
    WHEN jsonb_typeof(ss.academic_sessions) = 'array' THEN ss.academic_sessions
    ELSE '[]'::jsonb
  END
) AS s(session_name)
WHERE trim(s.session_name) <> ''
ON CONFLICT (name) DO NOTHING;

-- 5b. Backfill parent_students from parents.student_ids JSONB (only valid pairs)
INSERT INTO public.parent_students (parent_id, student_id)
SELECT DISTINCT p.id, elem.student_id
FROM public.parents p
CROSS JOIN LATERAL jsonb_array_elements_text(
  CASE
    WHEN jsonb_typeof(p.student_ids) = 'array' THEN p.student_ids
    ELSE '[]'::jsonb
  END
) AS elem(student_id)
JOIN public.students s ON s.id = elem.student_id
WHERE trim(elem.student_id) <> ''
ON CONFLICT (parent_id, student_id) DO NOTHING;

-- 5c. Backfill parent_students from matching parent_email where not yet linked
INSERT INTO public.parent_students (parent_id, student_id)
SELECT DISTINCT p.id, s.id
FROM public.parents p
JOIN public.students s
  ON s.parent_email IS NOT NULL
 AND trim(s.parent_email) <> ''
 AND lower(trim(s.parent_email)) = lower(trim(p.email))
ON CONFLICT (parent_id, student_id) DO NOTHING;

-- 5d. Backfill teacher_subjects from teachers.subject_ids JSONB (only valid pairs)
INSERT INTO public.teacher_subjects (teacher_id, subject_id)
SELECT DISTINCT t.id, elem.subject_id
FROM public.teachers t
CROSS JOIN LATERAL jsonb_array_elements_text(
  CASE
    WHEN jsonb_typeof(t.subject_ids) = 'array' THEN t.subject_ids
    ELSE '[]'::jsonb
  END
) AS elem(subject_id)
JOIN public.subjects sb ON sb.id = elem.subject_id
WHERE trim(elem.subject_id) <> ''
ON CONFLICT (teacher_id, subject_id) DO NOTHING;

-- 5e. Backfill cbt_questions from cbt_exams.questions JSONB (guarded against non-array/non-object/bad marks)
INSERT INTO public.cbt_questions (
  id, exam_id, question_order, question, option_a, option_b, option_c, option_d,
  correct_option, explanation, marks
)
SELECT
  COALESCE(NULLIF(trim(q.val->>'id'), ''), ce.id || '-q-' || q.ord::text),
  ce.id,
  q.ord::integer,
  COALESCE(q.val->>'question', ''),
  CASE WHEN jsonb_typeof(q.val->'options') = 'object' THEN COALESCE(q.val->'options'->>'A', '') ELSE '' END,
  CASE WHEN jsonb_typeof(q.val->'options') = 'object' THEN COALESCE(q.val->'options'->>'B', '') ELSE '' END,
  CASE WHEN jsonb_typeof(q.val->'options') = 'object' THEN COALESCE(q.val->'options'->>'C', '') ELSE '' END,
  CASE WHEN jsonb_typeof(q.val->'options') = 'object' THEN COALESCE(q.val->'options'->>'D', '') ELSE '' END,
  CASE
    WHEN upper(COALESCE(q.val->>'correctOption', 'A')) IN ('A', 'B', 'C', 'D')
      THEN upper(q.val->>'correctOption')
    ELSE 'A'
  END,
  q.val->>'explanation',
  CASE
    WHEN COALESCE(trim(q.val->>'marks'), '') ~ '^\d+(\.\d+)?$'
      THEN GREATEST((q.val->>'marks')::numeric, 1)
    ELSE 1
  END
FROM public.cbt_exams ce
CROSS JOIN LATERAL jsonb_array_elements(
  CASE
    WHEN jsonb_typeof(ce.questions) = 'array' THEN ce.questions
    ELSE '[]'::jsonb
  END
) WITH ORDINALITY AS q(val, ord)
WHERE jsonb_typeof(q.val) = 'object'
ON CONFLICT (id) DO NOTHING;

-- 5f. Backfill student_result_passcodes from students.result_passcode
INSERT INTO public.student_result_passcodes (student_id, result_passcode)
SELECT id, result_passcode
FROM public.students
WHERE result_passcode IS NOT NULL AND trim(result_passcode) <> ''
ON CONFLICT (student_id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 6. CONDITIONAL FOREIGN KEYS & DOMAIN / JSONB CHECK CONSTRAINTS
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  -- Auth user FKs
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_teachers_auth_user') THEN
    ALTER TABLE public.teachers ADD CONSTRAINT fk_teachers_auth_user FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_students_auth_user') THEN
    ALTER TABLE public.students ADD CONSTRAINT fk_students_auth_user FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_parents_auth_user') THEN
    ALTER TABLE public.parents ADD CONSTRAINT fk_parents_auth_user FOREIGN KEY (auth_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;

  -- Core relational FKs
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_classes_class_teacher') THEN
    ALTER TABLE public.classes ADD CONSTRAINT fk_classes_class_teacher FOREIGN KEY (class_teacher_id) REFERENCES public.teachers(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_teachers_form_class') THEN
    ALTER TABLE public.teachers ADD CONSTRAINT fk_teachers_form_class FOREIGN KEY (form_class_id) REFERENCES public.classes(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_students_class') THEN
    ALTER TABLE public.students ADD CONSTRAINT fk_students_class FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_parent_students_parent') THEN
    ALTER TABLE public.parent_students ADD CONSTRAINT fk_parent_students_parent FOREIGN KEY (parent_id) REFERENCES public.parents(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_parent_students_student') THEN
    ALTER TABLE public.parent_students ADD CONSTRAINT fk_parent_students_student FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_teacher_subjects_teacher') THEN
    ALTER TABLE public.teacher_subjects ADD CONSTRAINT fk_teacher_subjects_teacher FOREIGN KEY (teacher_id) REFERENCES public.teachers(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_teacher_subjects_subject') THEN
    ALTER TABLE public.teacher_subjects ADD CONSTRAINT fk_teacher_subjects_subject FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_scores_student') THEN
    ALTER TABLE public.scores ADD CONSTRAINT fk_scores_student FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_scores_subject') THEN
    ALTER TABLE public.scores ADD CONSTRAINT fk_scores_subject FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_scores_class') THEN
    ALTER TABLE public.scores ADD CONSTRAINT fk_scores_class FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_scores_teacher') THEN
    ALTER TABLE public.scores ADD CONSTRAINT fk_scores_teacher FOREIGN KEY (teacher_id) REFERENCES public.teachers(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_terminal_results_student') THEN
    ALTER TABLE public.terminal_results ADD CONSTRAINT fk_terminal_results_student FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_terminal_results_class') THEN
    ALTER TABLE public.terminal_results ADD CONSTRAINT fk_terminal_results_class FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_attendance_student') THEN
    ALTER TABLE public.attendance ADD CONSTRAINT fk_attendance_student FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_attendance_class') THEN
    ALTER TABLE public.attendance ADD CONSTRAINT fk_attendance_class FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_cbt_exams_subject') THEN
    ALTER TABLE public.cbt_exams ADD CONSTRAINT fk_cbt_exams_subject FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_cbt_exams_class') THEN
    ALTER TABLE public.cbt_exams ADD CONSTRAINT fk_cbt_exams_class FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_cbt_exams_teacher') THEN
    ALTER TABLE public.cbt_exams ADD CONSTRAINT fk_cbt_exams_teacher FOREIGN KEY (teacher_id) REFERENCES public.teachers(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_cbt_questions_exam') THEN
    ALTER TABLE public.cbt_questions ADD CONSTRAINT fk_cbt_questions_exam FOREIGN KEY (exam_id) REFERENCES public.cbt_exams(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_cbt_attempts_exam') THEN
    ALTER TABLE public.cbt_attempts ADD CONSTRAINT fk_cbt_attempts_exam FOREIGN KEY (exam_id) REFERENCES public.cbt_exams(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_cbt_attempts_student') THEN
    ALTER TABLE public.cbt_attempts ADD CONSTRAINT fk_cbt_attempts_student FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_cbt_exam_sessions_exam') THEN
    ALTER TABLE public.cbt_exam_sessions ADD CONSTRAINT fk_cbt_exam_sessions_exam FOREIGN KEY (exam_id) REFERENCES public.cbt_exams(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_cbt_exam_sessions_student') THEN
    ALTER TABLE public.cbt_exam_sessions ADD CONSTRAINT fk_cbt_exam_sessions_student FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_assignments_subject') THEN
    ALTER TABLE public.assignments ADD CONSTRAINT fk_assignments_subject FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_assignments_class') THEN
    ALTER TABLE public.assignments ADD CONSTRAINT fk_assignments_class FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_assignments_teacher') THEN
    ALTER TABLE public.assignments ADD CONSTRAINT fk_assignments_teacher FOREIGN KEY (teacher_id) REFERENCES public.teachers(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_assignment_submissions_assignment') THEN
    ALTER TABLE public.assignment_submissions ADD CONSTRAINT fk_assignment_submissions_assignment FOREIGN KEY (assignment_id) REFERENCES public.assignments(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_assignment_submissions_student') THEN
    ALTER TABLE public.assignment_submissions ADD CONSTRAINT fk_assignment_submissions_student FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_study_notes_subject') THEN
    ALTER TABLE public.study_notes ADD CONSTRAINT fk_study_notes_subject FOREIGN KEY (subject_id) REFERENCES public.subjects(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_study_notes_class') THEN
    ALTER TABLE public.study_notes ADD CONSTRAINT fk_study_notes_class FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_study_notes_teacher') THEN
    ALTER TABLE public.study_notes ADD CONSTRAINT fk_study_notes_teacher FOREIGN KEY (teacher_id) REFERENCES public.teachers(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_fee_records_student') THEN
    ALTER TABLE public.fee_records ADD CONSTRAINT fk_fee_records_student FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE RESTRICT;
  END IF;

  -- Domain & JSONB shape CHECK constraints
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_system_settings_term') THEN
    ALTER TABLE public.system_settings ADD CONSTRAINT chk_system_settings_term CHECK (current_term IN ('1st Term', '2nd Term', '3rd Term'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_system_settings_sessions_array') THEN
    ALTER TABLE public.system_settings ADD CONSTRAINT chk_system_settings_sessions_array CHECK (jsonb_typeof(academic_sessions) = 'array');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_classes_category') THEN
    ALTER TABLE public.classes ADD CONSTRAINT chk_classes_category CHECK (category IN ('Junior Secondary', 'Senior Secondary'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_classes_capacity') THEN
    ALTER TABLE public.classes ADD CONSTRAINT chk_classes_capacity CHECK (capacity > 0);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_classes_arms_array') THEN
    ALTER TABLE public.classes ADD CONSTRAINT chk_classes_arms_array CHECK (jsonb_typeof(arms) = 'array');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_subjects_category') THEN
    ALTER TABLE public.subjects ADD CONSTRAINT chk_subjects_category CHECK (category IN ('Science', 'Arts', 'Commercial', 'General'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_students_gender') THEN
    ALTER TABLE public.students ADD CONSTRAINT chk_students_gender CHECK (gender IN ('Male', 'Female'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_students_status') THEN
    ALTER TABLE public.students ADD CONSTRAINT chk_students_status CHECK (status IN ('Active', 'Graduated', 'Suspended'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_teachers_status') THEN
    ALTER TABLE public.teachers ADD CONSTRAINT chk_teachers_status CHECK (status IS NULL OR status IN ('Active', 'Inactive'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_teachers_json_arrays') THEN
    ALTER TABLE public.teachers ADD CONSTRAINT chk_teachers_json_arrays CHECK (
      jsonb_typeof(subject_ids) = 'array'
      AND jsonb_typeof(subjects_taught) = 'array'
      AND jsonb_typeof(classes_taught) = 'array'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_parents_student_ids_array') THEN
    ALTER TABLE public.parents ADD CONSTRAINT chk_parents_student_ids_array CHECK (jsonb_typeof(student_ids) = 'array');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_scores_ranges') THEN
    ALTER TABLE public.scores ADD CONSTRAINT chk_scores_ranges CHECK (
      term IN ('1st Term', '2nd Term', '3rd Term')
      AND ca1_score BETWEEN 0 AND 20
      AND ca2_score BETWEEN 0 AND 20
      AND exam_score BETWEEN 0 AND 60
      AND total_score BETWEEN 0 AND 100
      AND grade IN ('A', 'B', 'C', 'D', 'E', 'F')
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_terminal_results_valid') THEN
    ALTER TABLE public.terminal_results ADD CONSTRAINT chk_terminal_results_valid CHECK (
      term IN ('1st Term', '2nd Term', '3rd Term')
      AND average_score BETWEEN 0 AND 100
      AND position_in_class >= 1
      AND total_students_in_class >= 1
      AND days_present >= 0
      AND days_absent >= 0
      AND total_school_days >= 0
      AND status IN ('Draft', 'Published')
      AND jsonb_typeof(scores) = 'array'
      AND jsonb_typeof(psychomotor) = 'object'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_attendance_status') THEN
    ALTER TABLE public.attendance ADD CONSTRAINT chk_attendance_status CHECK (status IN ('Present', 'Absent', 'Late', 'Excused'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_cbt_exams_valid') THEN
    ALTER TABLE public.cbt_exams ADD CONSTRAINT chk_cbt_exams_valid CHECK (
      (term IS NULL OR term IN ('1st Term', '2nd Term', '3rd Term'))
      AND duration_minutes > 0
      AND total_questions >= 0
      AND total_marks >= 0
      AND pass_percentage BETWEEN 0 AND 100
      AND jsonb_typeof(questions) = 'array'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_cbt_questions_valid') THEN
    ALTER TABLE public.cbt_questions ADD CONSTRAINT chk_cbt_questions_valid CHECK (
      correct_option IN ('A', 'B', 'C', 'D') AND marks > 0
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_cbt_attempts_valid') THEN
    ALTER TABLE public.cbt_attempts ADD CONSTRAINT chk_cbt_attempts_valid CHECK (
      score_obtained >= 0
      AND total_marks >= 0
      AND percentage BETWEEN 0 AND 100
      AND time_taken_seconds >= 0
      AND jsonb_typeof(answers) = 'object'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_cbt_exam_sessions_valid') THEN
    ALTER TABLE public.cbt_exam_sessions ADD CONSTRAINT chk_cbt_exam_sessions_valid CHECK (
      status IN ('in_progress', 'submitted', 'expired')
      AND expires_at >= started_at
      AND jsonb_typeof(question_order) = 'array'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_assignments_format') THEN
    ALTER TABLE public.assignments ADD CONSTRAINT chk_assignments_format CHECK (
      format IS NULL OR format IN ('text', 'word', 'pdf')
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_news_category') THEN
    ALTER TABLE public.news_items ADD CONSTRAINT chk_news_category CHECK (category IN ('Academics', 'Sports', 'Events', 'Announcements'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_gallery_category') THEN
    ALTER TABLE public.gallery_images ADD CONSTRAINT chk_gallery_category CHECK (category IN ('Campus', 'Sports Day', 'Science Fair', 'Graduation', 'Arts & Culture'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_online_applications_valid') THEN
    ALTER TABLE public.online_applications ADD CONSTRAINT chk_online_applications_valid CHECK (
      gender IN ('Male', 'Female')
      AND status IN ('Pending', 'Approved', 'Rejected', 'Interview Scheduled')
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_download_documents_valid') THEN
    ALTER TABLE public.download_documents ADD CONSTRAINT chk_download_documents_valid CHECK (
      category IN ('Academic', 'Admissions', 'Forms', 'Past Questions')
      AND file_type IN ('PDF', 'DOCX', 'XLSX')
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_announcements_targets') THEN
    ALTER TABLE public.announcements ADD CONSTRAINT chk_announcements_targets CHECK (
      (target_audience IS NULL OR target_audience IN ('All', 'Students', 'Teachers', 'Parents'))
      AND (target_role IS NULL OR target_role IN ('All', 'Students', 'Teachers', 'Parents'))
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_fee_records_valid') THEN
    ALTER TABLE public.fee_records ADD CONSTRAINT chk_fee_records_valid CHECK (
      term IN ('1st Term', '2nd Term', '3rd Term')
      AND tuition >= 0 AND development_fee >= 0 AND ict_fee >= 0 AND uniform_fee >= 0
      AND total >= 0 AND amount_paid >= 0 AND balance >= 0
      AND status IN ('Paid', 'Partial', 'Unpaid')
    );
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 7. UNIQUE CONSTRAINTS & PERFORMANCE INDEXES
-- ----------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS uq_classes_name ON public.classes (name);
CREATE UNIQUE INDEX IF NOT EXISTS uq_subjects_code ON public.subjects (code);
CREATE UNIQUE INDEX IF NOT EXISTS uq_students_admission_no ON public.students (admission_no);
CREATE UNIQUE INDEX IF NOT EXISTS uq_students_email ON public.students (lower(email)) WHERE email IS NOT NULL AND trim(email) <> '';
CREATE UNIQUE INDEX IF NOT EXISTS uq_students_auth_user ON public.students (auth_user_id) WHERE auth_user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_teachers_staff_id ON public.teachers (staff_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_teachers_email ON public.teachers (lower(email));
CREATE UNIQUE INDEX IF NOT EXISTS uq_teachers_auth_user ON public.teachers (auth_user_id) WHERE auth_user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_parents_parent_id ON public.parents (parent_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_parents_email ON public.parents (lower(email));
CREATE UNIQUE INDEX IF NOT EXISTS uq_parents_auth_user ON public.parents (auth_user_id) WHERE auth_user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_scores_student_subject_term ON public.scores (student_id, subject_id, session_id, term);
CREATE UNIQUE INDEX IF NOT EXISTS uq_terminal_results_student_term ON public.terminal_results (student_id, session_id, term);
CREATE UNIQUE INDEX IF NOT EXISTS uq_attendance_student_date ON public.attendance (student_id, date);
CREATE UNIQUE INDEX IF NOT EXISTS uq_cbt_attempts_exam_student ON public.cbt_attempts (exam_id, student_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_cbt_exam_sessions_exam_student ON public.cbt_exam_sessions (exam_id, student_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_assignment_submissions_pair ON public.assignment_submissions (assignment_id, student_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_online_applications_number ON public.online_applications (application_number);
CREATE UNIQUE INDEX IF NOT EXISTS uq_fee_records_receipt ON public.fee_records (receipt_no);
CREATE UNIQUE INDEX IF NOT EXISTS uq_fee_records_student_term ON public.fee_records (student_id, session, term);

CREATE INDEX IF NOT EXISTS idx_students_class_id ON public.students (class_id);
CREATE INDEX IF NOT EXISTS idx_students_parent_email ON public.students (lower(parent_email));
CREATE INDEX IF NOT EXISTS idx_scores_class_session_term ON public.scores (class_id, session_id, term);
CREATE INDEX IF NOT EXISTS idx_scores_teacher_id ON public.scores (teacher_id);
CREATE INDEX IF NOT EXISTS idx_results_class_session_term ON public.terminal_results (class_id, session_id, term);
CREATE INDEX IF NOT EXISTS idx_attendance_class_date ON public.attendance (class_id, date);
CREATE INDEX IF NOT EXISTS idx_cbt_exams_class_published ON public.cbt_exams (class_id, is_published);
CREATE INDEX IF NOT EXISTS idx_cbt_exams_teacher_id ON public.cbt_exams (teacher_id);
CREATE INDEX IF NOT EXISTS idx_cbt_questions_exam_order ON public.cbt_questions (exam_id, question_order);
CREATE INDEX IF NOT EXISTS idx_cbt_attempts_student ON public.cbt_attempts (student_id);
CREATE INDEX IF NOT EXISTS idx_cbt_exam_sessions_student ON public.cbt_exam_sessions (student_id);
CREATE INDEX IF NOT EXISTS idx_cbt_exam_sessions_status ON public.cbt_exam_sessions (status, expires_at);
CREATE INDEX IF NOT EXISTS idx_assignments_class_due ON public.assignments (class_id, due_date);
CREATE INDEX IF NOT EXISTS idx_assignments_teacher_id ON public.assignments (teacher_id);
CREATE INDEX IF NOT EXISTS idx_study_notes_class ON public.study_notes (class_id);
CREATE INDEX IF NOT EXISTS idx_study_notes_teacher_id ON public.study_notes (teacher_id);
CREATE INDEX IF NOT EXISTS idx_announcements_date ON public.announcements (date DESC);
CREATE INDEX IF NOT EXISTS idx_fee_records_student_status ON public.fee_records (student_id, status);

-- ----------------------------------------------------------------------------
-- 8. UPDATED_AT TRIGGERS (ONE BEFORE-UPDATE TRIGGER PER TABLE)
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'user_profiles','academic_sessions','system_settings','teachers','classes',
    'subjects','students','student_result_passcodes','parents','parent_students',
    'teacher_subjects','scores','terminal_results','attendance','cbt_exams',
    'cbt_questions','cbt_attempts','cbt_exam_sessions','assignments',
    'assignment_submissions','study_notes','news_items','gallery_images',
    'online_applications','download_documents','announcements','fee_records'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_updated_at ON public.%I;', tbl, tbl);
    EXECUTE format(
      'CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();',
      tbl, tbl
    );
  END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- 8b. RUNTIME INTEGRITY & SYNC TRIGGERS (JUNCTION TABLES + CBT PROTECTION)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_parent_students_from_parent()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF jsonb_typeof(NEW.student_ids) = 'array' THEN
    INSERT INTO public.parent_students (parent_id, student_id)
    SELECT DISTINCT NEW.id, elem.student_id
    FROM jsonb_array_elements_text(NEW.student_ids) AS elem(student_id)
    JOIN public.students s ON s.id = elem.student_id
    WHERE trim(elem.student_id) <> ''
    ON CONFLICT (parent_id, student_id) DO NOTHING;
  END IF;

  IF NEW.email IS NOT NULL AND trim(NEW.email) <> '' THEN
    INSERT INTO public.parent_students (parent_id, student_id)
    SELECT DISTINCT NEW.id, s.id
    FROM public.students s
    WHERE s.parent_email IS NOT NULL
      AND trim(s.parent_email) <> ''
      AND lower(trim(s.parent_email)) = lower(trim(NEW.email))
    ON CONFLICT (parent_id, student_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_parents_sync_parent_students ON public.parents;
CREATE TRIGGER trg_parents_sync_parent_students
  AFTER INSERT OR UPDATE OF student_ids, email ON public.parents
  FOR EACH ROW EXECUTE FUNCTION public.sync_parent_students_from_parent();

CREATE OR REPLACE FUNCTION public.sync_parent_students_from_student()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.parent_email IS NOT NULL AND trim(NEW.parent_email) <> '' THEN
    INSERT INTO public.parent_students (parent_id, student_id)
    SELECT DISTINCT p.id, NEW.id
    FROM public.parents p
    WHERE lower(trim(p.email)) = lower(trim(NEW.parent_email))
    ON CONFLICT (parent_id, student_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_students_sync_parent_students ON public.students;
CREATE TRIGGER trg_students_sync_parent_students
  AFTER INSERT OR UPDATE OF parent_email ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.sync_parent_students_from_student();

CREATE OR REPLACE FUNCTION public.sync_teacher_subjects_from_teacher()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF jsonb_typeof(NEW.subject_ids) = 'array' THEN
    INSERT INTO public.teacher_subjects (teacher_id, subject_id)
    SELECT DISTINCT NEW.id, elem.subject_id
    FROM jsonb_array_elements_text(NEW.subject_ids) AS elem(subject_id)
    JOIN public.subjects sb ON sb.id = elem.subject_id
    WHERE trim(elem.subject_id) <> ''
    ON CONFLICT (teacher_id, subject_id) DO NOTHING;
  END IF;

  IF jsonb_typeof(NEW.subjects_taught) = 'array' THEN
    INSERT INTO public.teacher_subjects (teacher_id, subject_id)
    SELECT DISTINCT NEW.id, sb.id
    FROM jsonb_array_elements_text(NEW.subjects_taught) AS elem(subject_name)
    JOIN public.subjects sb ON lower(trim(sb.name)) = lower(trim(elem.subject_name))
    WHERE trim(elem.subject_name) <> ''
    ON CONFLICT (teacher_id, subject_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_teachers_sync_teacher_subjects ON public.teachers;
CREATE TRIGGER trg_teachers_sync_teacher_subjects
  AFTER INSERT OR UPDATE OF subject_ids, subjects_taught ON public.teachers
  FOR EACH ROW EXECUTE FUNCTION public.sync_teacher_subjects_from_teacher();

CREATE OR REPLACE FUNCTION public.guard_cbt_exam_active_session()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.cbt_exam_sessions ces
    WHERE ces.exam_id = OLD.id
      AND ces.status = 'in_progress'
      AND ces.expires_at > now()
  ) THEN
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'Cannot delete CBT exam "%" while a student has an active in-progress session.', OLD.id;
    END IF;

    IF NEW.questions IS DISTINCT FROM OLD.questions
       OR NEW.total_marks IS DISTINCT FROM OLD.total_marks
       OR NEW.duration_minutes IS DISTINCT FROM OLD.duration_minutes
       OR NEW.pass_percentage IS DISTINCT FROM OLD.pass_percentage
       OR NEW.class_id IS DISTINCT FROM OLD.class_id
       OR NEW.is_published IS DISTINCT FROM OLD.is_published THEN
      RAISE EXCEPTION 'Cannot modify CBT exam questions, marks, duration, class, or publish status while a student has an active in-progress session.';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cbt_exams_guard_active_session ON public.cbt_exams;
CREATE TRIGGER trg_cbt_exams_guard_active_session
  BEFORE UPDATE OR DELETE ON public.cbt_exams
  FOR EACH ROW EXECUTE FUNCTION public.guard_cbt_exam_active_session();

CREATE OR REPLACE FUNCTION public.guard_cbt_question_active_session()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exam_id text := COALESCE(NEW.exam_id, OLD.exam_id);
BEGIN
  IF pg_trigger_depth() > 1 THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.cbt_exam_sessions ces
    WHERE ces.exam_id = v_exam_id
      AND ces.status = 'in_progress'
      AND ces.expires_at > now()
  ) THEN
    RAISE EXCEPTION 'Cannot modify CBT questions while a student has an active in-progress session for exam "%".', v_exam_id;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cbt_questions_guard_active_session ON public.cbt_questions;
CREATE TRIGGER trg_cbt_questions_guard_active_session
  BEFORE INSERT OR UPDATE OR DELETE ON public.cbt_questions
  FOR EACH ROW EXECUTE FUNCTION public.guard_cbt_question_active_session();

CREATE OR REPLACE FUNCTION public.sync_cbt_questions_from_exam()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_active_ids text[] := ARRAY[]::text[];
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN NEW;
  END IF;

  IF jsonb_typeof(NEW.questions) <> 'array' THEN
    DELETE FROM public.cbt_questions WHERE exam_id = NEW.id;
    RETURN NEW;
  END IF;

  SELECT COALESCE(
    array_agg(COALESCE(NULLIF(trim(q.val->>'id'), ''), NEW.id || '-q-' || q.ord::text)),
    ARRAY[]::text[]
  )
  INTO v_active_ids
  FROM jsonb_array_elements(NEW.questions) WITH ORDINALITY AS q(val, ord)
  WHERE jsonb_typeof(q.val) = 'object';

  DELETE FROM public.cbt_questions
  WHERE exam_id = NEW.id
    AND NOT (id = ANY(v_active_ids));

  INSERT INTO public.cbt_questions (
    id, exam_id, question_order, question, option_a, option_b, option_c, option_d,
    correct_option, explanation, marks
  )
  SELECT
    COALESCE(NULLIF(trim(q.val->>'id'), ''), NEW.id || '-q-' || q.ord::text),
    NEW.id,
    q.ord::integer,
    COALESCE(q.val->>'question', ''),
    CASE WHEN jsonb_typeof(q.val->'options') = 'object' THEN COALESCE(q.val->'options'->>'A', '') ELSE '' END,
    CASE WHEN jsonb_typeof(q.val->'options') = 'object' THEN COALESCE(q.val->'options'->>'B', '') ELSE '' END,
    CASE WHEN jsonb_typeof(q.val->'options') = 'object' THEN COALESCE(q.val->'options'->>'C', '') ELSE '' END,
    CASE WHEN jsonb_typeof(q.val->'options') = 'object' THEN COALESCE(q.val->'options'->>'D', '') ELSE '' END,
    CASE
      WHEN upper(COALESCE(q.val->>'correctOption', 'A')) IN ('A', 'B', 'C', 'D')
        THEN upper(q.val->>'correctOption')
      ELSE 'A'
    END,
    q.val->>'explanation',
    CASE
      WHEN COALESCE(trim(q.val->>'marks'), '') ~ '^\d+(\.\d+)?$'
        THEN GREATEST((q.val->>'marks')::numeric, 1)
      ELSE 1
    END
  FROM jsonb_array_elements(NEW.questions) WITH ORDINALITY AS q(val, ord)
  WHERE jsonb_typeof(q.val) = 'object'
  ON CONFLICT (id) DO UPDATE
    SET question_order = EXCLUDED.question_order,
        question = EXCLUDED.question,
        option_a = EXCLUDED.option_a,
        option_b = EXCLUDED.option_b,
        option_c = EXCLUDED.option_c,
        option_d = EXCLUDED.option_d,
        correct_option = EXCLUDED.correct_option,
        explanation = EXCLUDED.explanation,
        marks = EXCLUDED.marks,
        updated_at = now()
    WHERE public.cbt_questions.exam_id = EXCLUDED.exam_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cbt_exams_sync_questions ON public.cbt_exams;
CREATE TRIGGER trg_cbt_exams_sync_questions
  AFTER INSERT OR UPDATE OF questions ON public.cbt_exams
  FOR EACH ROW EXECUTE FUNCTION public.sync_cbt_questions_from_exam();

-- ----------------------------------------------------------------------------
-- 9. SAFE PUBLIC & NON-SECRET PROJECTION VIEWS
-- ----------------------------------------------------------------------------
-- Public website projection excludes internal flags (result_entry_open, cbt_active,
-- is_result_published, academic_sessions). Owned by migration executor so anon
-- can query ONLY these public fields while direct access to system_settings is revoked.
CREATE OR REPLACE VIEW public.public_site_settings AS
SELECT
  id,
  current_session,
  current_term,
  school_name,
  school_motto,
  school_logo_text,
  school_phone,
  school_email,
  school_address,
  hero_badge,
  hero_title,
  hero_subtitle,
  hero_image,
  hero_spotlight_label,
  hero_spotlight_text,
  hero_image_title,
  stat_students_number,
  stat_students_label,
  stat_waec_number,
  stat_waec_label,
  stat_teachers_number,
  stat_teachers_label,
  stat_clubs_number,
  stat_clubs_label,
  about_vision,
  about_mission,
  about_principal_name,
  about_principal_title,
  about_principal_avatar,
  about_principal_bio,
  updated_at
FROM public.system_settings;

-- Safe student & teacher roster views exclude plaintext password & result_passcode
-- and run with security_invoker = true so underlying RLS applies per caller.
CREATE OR REPLACE VIEW public.students_safe
WITH (security_invoker = true) AS
SELECT
  id, auth_user_id, admission_no, first_name, last_name, other_names, email,
  gender, dob, class_id, class_name, arm, house, parent_name, parent_phone,
  parent_email, address, avatar, status, created_at, updated_at
FROM public.students;

CREATE OR REPLACE VIEW public.teachers_safe
WITH (security_invoker = true) AS
SELECT
  id, auth_user_id, staff_id, first_name, last_name, qualification, email,
  phone, subject_ids, subjects_taught, form_class_id, form_class_name,
  class_taught, classes_taught, avatar, join_date, status, created_at, updated_at
FROM public.teachers;

-- ----------------------------------------------------------------------------
-- 10. AUTHORIZATION HELPER FUNCTIONS (SECURITY DEFINER + GUARDED JSONB)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_teacher_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT t.id
  FROM public.teachers t
  WHERE t.auth_user_id = auth.uid()
    AND COALESCE(t.status, 'Active') = 'Active'
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_own_teacher_id(target_teacher_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT target_teacher_id IS NOT NULL
     AND target_teacher_id = public.current_teacher_id();
$$;

CREATE OR REPLACE FUNCTION public.teacher_teaches_subject(target_subject_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.teachers t
    LEFT JOIN public.subjects sb ON sb.id = target_subject_id
    WHERE t.auth_user_id = auth.uid()
      AND COALESCE(t.status, 'Active') = 'Active'
      AND (
        EXISTS (
          SELECT 1 FROM public.teacher_subjects ts
          WHERE ts.teacher_id = t.id AND ts.subject_id = target_subject_id
        )
        OR (jsonb_typeof(t.subject_ids) = 'array' AND t.subject_ids ? target_subject_id)
        OR (
          sb.id IS NOT NULL
          AND jsonb_typeof(t.subjects_taught) = 'array'
          AND EXISTS (
            SELECT 1
            FROM jsonb_array_elements_text(t.subjects_taught) AS elem(val)
            WHERE lower(trim(elem.val)) = lower(trim(sb.name))
          )
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.teacher_is_form_teacher(target_class_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.teachers t
    LEFT JOIN public.classes c ON c.id = target_class_id
    WHERE t.auth_user_id = auth.uid()
      AND COALESCE(t.status, 'Active') = 'Active'
      AND (
        c.class_teacher_id = t.id
        OR t.form_class_id = target_class_id
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.teacher_assigned_to_class(target_class_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.teachers t
    JOIN public.classes c ON c.id = target_class_id
    WHERE t.auth_user_id = auth.uid()
      AND COALESCE(t.status, 'Active') = 'Active'
      AND (
        c.class_teacher_id = t.id
        OR t.form_class_id = target_class_id
        OR lower(trim(COALESCE(t.class_taught, ''))) = lower(trim(c.name))
        OR EXISTS (
          SELECT 1
          FROM regexp_split_to_table(COALESCE(t.class_taught, ''), '\s*,\s*') AS tok(val)
          WHERE trim(tok.val) <> ''
            AND (
              lower(trim(tok.val)) = lower(trim(c.name))
              OR lower(trim(tok.val)) LIKE lower(trim(c.name)) || ' %'
            )
        )
        OR (
          jsonb_typeof(t.classes_taught) = 'array'
          AND (
            t.classes_taught ? c.name
            OR t.classes_taught ? c.id
            OR EXISTS (
              SELECT 1
              FROM jsonb_array_elements_text(t.classes_taught) AS elem(val)
              WHERE trim(elem.val) <> ''
                AND (
                  lower(trim(elem.val)) = lower(trim(c.name))
                  OR lower(trim(elem.val)) LIKE lower(trim(c.name)) || ' %'
                )
            )
          )
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.is_student_owner(target_student_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.id = target_student_id
      AND s.auth_user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_parent_of_student(target_student_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.parents p
    JOIN public.parent_students ps ON ps.parent_id = p.id
    WHERE p.auth_user_id = auth.uid()
      AND ps.student_id = target_student_id
  );
$$;

CREATE OR REPLACE FUNCTION public.student_in_class(target_class_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.students s
    WHERE s.auth_user_id = auth.uid()
      AND s.class_id = target_class_id
  );
$$;

CREATE OR REPLACE FUNCTION public.parent_has_ward_in_class(target_class_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.parents p
    JOIN public.parent_students ps ON ps.parent_id = p.id
    JOIN public.students s ON s.id = ps.student_id
    WHERE p.auth_user_id = auth.uid()
      AND s.class_id = target_class_id
  );
$$;

-- ----------------------------------------------------------------------------
-- 10b. PRIORITY 4 SECURITY RPCs (AUTH PROFILE LINKING, PASSCODES, CBT ENGINE)
-- ----------------------------------------------------------------------------
-- Safely links an authenticated user to their pre-enrolled non-admin directory
-- record (teacher, parent, or student). NEVER creates or promotes 'admin'.
CREATE OR REPLACE FUNCTION public.sync_my_user_profile()
RETURNS TABLE (
  auth_user_id uuid,
  role text,
  reference_id text,
  email text,
  full_name text,
  is_active boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_email text;
  v_profile public.user_profiles%ROWTYPE;
  v_teacher public.teachers%ROWTYPE;
  v_parent public.parents%ROWTYPE;
  v_student public.students%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  SELECT lower(trim(u.email)) INTO v_email
  FROM auth.users u
  WHERE u.id = v_uid;

  SELECT * INTO v_profile
  FROM public.user_profiles up
  WHERE up.auth_user_id = v_uid
  LIMIT 1;

  IF FOUND THEN
    IF NOT v_profile.is_active THEN
      RAISE EXCEPTION 'This account has been deactivated. Contact the school administrator.';
    END IF;

    -- Keep email synced if updated via Supabase Auth
    IF v_email IS NOT NULL AND lower(trim(v_profile.email)) IS DISTINCT FROM v_email THEN
      UPDATE public.user_profiles
      SET email = v_email, updated_at = now()
      WHERE public.user_profiles.auth_user_id = v_uid
      RETURNING * INTO v_profile;
    END IF;

    IF v_profile.role = 'teacher' THEN
      UPDATE public.teachers t
      SET auth_user_id = v_uid, updated_at = now()
      WHERE (t.id = v_profile.reference_id OR lower(trim(t.email)) = v_email)
        AND (t.auth_user_id IS NULL OR t.auth_user_id = v_uid);
    ELSIF v_profile.role = 'parent' THEN
      UPDATE public.parents p
      SET auth_user_id = v_uid, updated_at = now()
      WHERE (p.id = v_profile.reference_id OR lower(trim(p.email)) = v_email)
        AND (p.auth_user_id IS NULL OR p.auth_user_id = v_uid);
    ELSIF v_profile.role = 'student' THEN
      UPDATE public.students s
      SET auth_user_id = v_uid, updated_at = now()
      WHERE (s.id = v_profile.reference_id OR (s.email IS NOT NULL AND lower(trim(s.email)) = v_email))
        AND (s.auth_user_id IS NULL OR s.auth_user_id = v_uid);
    END IF;

    RETURN QUERY SELECT v_profile.auth_user_id, v_profile.role, v_profile.reference_id, v_profile.email, v_profile.full_name, v_profile.is_active;
    RETURN;
  END IF;

  IF v_email IS NULL OR v_email = '' THEN
    RETURN;
  END IF;

  -- Check pre-enrolled Active teacher
  SELECT * INTO v_teacher
  FROM public.teachers t
  WHERE lower(trim(t.email)) = v_email
    AND COALESCE(t.status, 'Active') = 'Active'
    AND (t.auth_user_id IS NULL OR t.auth_user_id = v_uid)
  LIMIT 1;

  IF FOUND THEN
    UPDATE public.teachers SET auth_user_id = v_uid, updated_at = now() WHERE id = v_teacher.id;
    INSERT INTO public.user_profiles (auth_user_id, role, reference_id, email, full_name, is_active)
    VALUES (v_uid, 'teacher', v_teacher.id, v_email, trim(v_teacher.first_name || ' ' || v_teacher.last_name), true)
    ON CONFLICT (auth_user_id) DO NOTHING;

    SELECT * INTO v_profile FROM public.user_profiles up WHERE up.auth_user_id = v_uid;
    RETURN QUERY SELECT v_profile.auth_user_id, v_profile.role, v_profile.reference_id, v_profile.email, v_profile.full_name, v_profile.is_active;
    RETURN;
  END IF;

  -- Check pre-enrolled parent
  SELECT * INTO v_parent
  FROM public.parents p
  WHERE lower(trim(p.email)) = v_email
    AND (p.auth_user_id IS NULL OR p.auth_user_id = v_uid)
  LIMIT 1;

  IF FOUND THEN
    UPDATE public.parents SET auth_user_id = v_uid, updated_at = now() WHERE id = v_parent.id;
    INSERT INTO public.user_profiles (auth_user_id, role, reference_id, email, full_name, is_active)
    VALUES (
      v_uid,
      'parent',
      v_parent.id,
      v_email,
      trim(COALESCE(NULLIF(v_parent.title, '') || ' ', '') || v_parent.full_name),
      true
    )
    ON CONFLICT (auth_user_id) DO NOTHING;

    SELECT * INTO v_profile FROM public.user_profiles up WHERE up.auth_user_id = v_uid;
    RETURN QUERY SELECT v_profile.auth_user_id, v_profile.role, v_profile.reference_id, v_profile.email, v_profile.full_name, v_profile.is_active;
    RETURN;
  END IF;

  -- Check pre-enrolled Active student
  SELECT * INTO v_student
  FROM public.students s
  WHERE s.email IS NOT NULL
    AND lower(trim(s.email)) = v_email
    AND s.status = 'Active'
    AND (s.auth_user_id IS NULL OR s.auth_user_id = v_uid)
  LIMIT 1;

  IF FOUND THEN
    UPDATE public.students SET auth_user_id = v_uid, updated_at = now() WHERE id = v_student.id;
    INSERT INTO public.user_profiles (auth_user_id, role, reference_id, email, full_name, is_active)
    VALUES (v_uid, 'student', v_student.id, v_email, trim(v_student.first_name || ' ' || v_student.last_name), true)
    ON CONFLICT (auth_user_id) DO NOTHING;

    SELECT * INTO v_profile FROM public.user_profiles up WHERE up.auth_user_id = v_uid;
    RETURN QUERY SELECT v_profile.auth_user_id, v_profile.role, v_profile.reference_id, v_profile.email, v_profile.full_name, v_profile.is_active;
    RETURN;
  END IF;

  RETURN;
END;
$$;

-- Server-side verification of student result passcode (never returns the stored passcode)
CREATE OR REPLACE FUNCTION public.verify_student_result_passcode(
  p_student_id text,
  p_passcode text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stored text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  IF NOT (
    public.is_admin()
    OR public.is_student_owner(p_student_id)
    OR public.is_parent_of_student(p_student_id)
  ) THEN
    RETURN false;
  END IF;

  SELECT srp.result_passcode INTO v_stored
  FROM public.student_result_passcodes srp
  WHERE srp.student_id = p_student_id
  LIMIT 1;

  IF v_stored IS NULL OR trim(v_stored) = '' THEN
    RETURN false;
  END IF;

  RETURN upper(trim(COALESCE(p_passcode, ''))) = upper(trim(v_stored));
END;
$$;

-- Returns published CBT exam summaries for the authenticated student WITHOUT questions or answers
CREATE OR REPLACE FUNCTION public.get_student_cbt_exams()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student public.students%ROWTYPE;
  v_cbt_active boolean := true;
  v_result jsonb := '[]'::jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  SELECT * INTO v_student
  FROM public.students s
  WHERE s.auth_user_id = auth.uid()
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT COALESCE(ss.cbt_active, true) INTO v_cbt_active
  FROM public.system_settings ss
  WHERE ss.id = 'default'
  LIMIT 1;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', ce.id,
        'title', ce.title,
        'subjectId', ce.subject_id,
        'subjectName', ce.subject_name,
        'classId', ce.class_id,
        'className', ce.class_name,
        'term', ce.term,
        'session', ce.session,
        'durationMinutes', ce.duration_minutes,
        'totalQuestions', ce.total_questions,
        'totalMarks', ce.total_marks,
        'passPercentage', ce.pass_percentage,
        'startDate', ce.start_date,
        'startTime', ce.start_time,
        'endDate', ce.end_date,
        'isPublished', ce.is_published,
        'shuffleQuestions', ce.shuffle_questions,
        'cbtActive', v_cbt_active,
        'questions', '[]'::jsonb,
        'hasAttempt', (ca.id IS NOT NULL),
        'sessionStatus', ces.status,
        'remainingSeconds', CASE
          WHEN ces.status = 'in_progress' THEN GREATEST(0, floor(EXTRACT(EPOCH FROM (ces.expires_at - now())))::integer)
          ELSE NULL
        END
      )
      ORDER BY ce.start_date DESC, ce.created_at DESC
    ),
    '[]'::jsonb
  )
  INTO v_result
  FROM public.cbt_exams ce
  LEFT JOIN public.cbt_attempts ca
    ON ca.exam_id = ce.id AND ca.student_id = v_student.id
  LEFT JOIN public.cbt_exam_sessions ces
    ON ces.exam_id = ce.id AND ces.student_id = v_student.id
  WHERE ce.is_published = true
    AND ce.class_id = v_student.class_id;

  RETURN v_result;
END;
$$;

-- Starts or resumes a CBT exam session on the server; strips correct_option & explanation
CREATE OR REPLACE FUNCTION public.start_cbt_exam(p_exam_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  PERFORM pg_advisory_xact_lock(hashtext('cbt:' || p_exam_id || ':' || v_student.id));

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
  v_local_now := now() AT TIME ZONE 'Africa/Lagos';
  IF v_exam.start_date ~ '^\d{4}-\d{2}-\d{2}$' THEN
    v_start_ts := (v_exam.start_date || ' ' || COALESCE(NULLIF(trim(v_exam.start_time), ''), '00:00'))::timestamp;
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
    IF v_session.status = 'expired' OR now() > v_session.expires_at THEN
      UPDATE public.cbt_exam_sessions
      SET status = 'expired', updated_at = now()
      WHERE id = v_session.id;
      RAISE EXCEPTION 'Your allocated time for this CBT session has expired.';
    END IF;
  ELSE
    -- Compute question order (shuffled if requested)
    IF EXISTS (SELECT 1 FROM public.cbt_questions cq WHERE cq.exam_id = p_exam_id) THEN
      SELECT COALESCE(
        jsonb_agg(sub.id ORDER BY CASE WHEN v_exam.shuffle_questions THEN random() ELSE sub.question_order::double precision END),
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
        jsonb_agg(sub.qid ORDER BY CASE WHEN v_exam.shuffle_questions THEN random() ELSE sub.ord::double precision END),
        '[]'::jsonb
      )
      INTO v_order
      FROM (
        SELECT COALESCE(NULLIF(trim(q.val->>'id'), ''), p_exam_id || '-q-' || q.ord::text) AS qid, q.ord
        FROM jsonb_array_elements(CASE WHEN jsonb_typeof(v_exam.questions) = 'array' THEN v_exam.questions ELSE '[]'::jsonb END) WITH ORDINALITY AS q(val, ord)
      ) sub;
    END IF;

    INSERT INTO public.cbt_exam_sessions (
      id, exam_id, student_id, started_at, expires_at, status, question_order
    )
    VALUES (
      'cbtsess-' || md5(p_exam_id || ':' || v_student.id),
      p_exam_id,
      v_student.id,
      now(),
      now() + make_interval(mins => v_exam.duration_minutes),
      'in_progress',
      v_order
    )
    RETURNING * INTO v_session;
  END IF;

  -- Build sanitized questions array WITHOUT correctOption or explanation
  IF EXISTS (SELECT 1 FROM public.cbt_questions cq WHERE cq.exam_id = p_exam_id) THEN
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', cq.id,
          'question', cq.question,
          'options', jsonb_build_object(
            'A', cq.option_a,
            'B', cq.option_b,
            'C', cq.option_c,
            'D', cq.option_d
          ),
          'marks', cq.marks
        )
        ORDER BY COALESCE(ord_idx.pos, cq.question_order::bigint)
      ),
      '[]'::jsonb
    )
    INTO v_questions
    FROM public.cbt_questions cq
    LEFT JOIN LATERAL jsonb_array_elements_text(v_session.question_order) WITH ORDINALITY AS ord_idx(qid, pos)
      ON ord_idx.qid = cq.id
    WHERE cq.exam_id = p_exam_id;
  ELSE
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', COALESCE(NULLIF(trim(q.val->>'id'), ''), p_exam_id || '-q-' || q.ord::text),
          'question', COALESCE(q.val->>'question', ''),
          'options', COALESCE(q.val->'options', '{}'::jsonb),
          'marks', CASE WHEN COALESCE(trim(q.val->>'marks'), '') ~ '^\d+(\.\d+)?$' THEN (q.val->>'marks')::numeric ELSE 1 END
        )
        ORDER BY COALESCE(ord_idx.pos, q.ord)
      ),
      '[]'::jsonb
    )
    INTO v_questions
    FROM jsonb_array_elements(CASE WHEN jsonb_typeof(v_exam.questions) = 'array' THEN v_exam.questions ELSE '[]'::jsonb END) WITH ORDINALITY AS q(val, ord)
    LEFT JOIN LATERAL jsonb_array_elements_text(v_session.question_order) WITH ORDINALITY AS ord_idx(qid, pos)
      ON ord_idx.qid = COALESCE(NULLIF(trim(q.val->>'id'), ''), p_exam_id || '-q-' || q.ord::text);
  END IF;

  v_remaining := GREATEST(0, floor(EXTRACT(EPOCH FROM (v_session.expires_at - now())))::integer);

  RETURN jsonb_build_object(
    'sessionId', v_session.id,
    'startedAt', v_session.started_at,
    'expiresAt', v_session.expires_at,
    'remainingSeconds', v_remaining,
    'exam', jsonb_build_object(
      'id', v_exam.id,
      'title', v_exam.title,
      'subjectId', v_exam.subject_id,
      'subjectName', v_exam.subject_name,
      'classId', v_exam.class_id,
      'className', v_exam.class_name,
      'term', v_exam.term,
      'session', v_exam.session,
      'durationMinutes', v_exam.duration_minutes,
      'totalQuestions', jsonb_array_length(v_questions),
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

-- Server-side grading & attempt recording; returns scored attempt + post-submission review
CREATE OR REPLACE FUNCTION public.submit_cbt_exam(
  p_exam_id text,
  p_answers jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student public.students%ROWTYPE;
  v_exam public.cbt_exams%ROWTYPE;
  v_session public.cbt_exam_sessions%ROWTYPE;
  v_answers jsonb := CASE WHEN jsonb_typeof(p_answers) = 'object' THEN p_answers ELSE '{}'::jsonb END;
  v_score numeric(6,2) := 0;
  v_total_marks numeric(6,2) := 0;
  v_percentage numeric(5,2) := 0;
  v_passed boolean := false;
  v_time_taken integer := 1;
  v_completed_at text := to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
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

  PERFORM pg_advisory_xact_lock(hashtext('cbt:' || p_exam_id || ':' || v_student.id));

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

  -- Allow brief 20-second network grace window for client auto-submit on expiry
  IF now() > v_session.expires_at + interval '20 seconds' THEN
    UPDATE public.cbt_exam_sessions
    SET status = 'expired', updated_at = now()
    WHERE id = v_session.id;
    RAISE EXCEPTION 'Exam submission window has expired.';
  END IF;

  v_time_taken := GREATEST(
    1,
    LEAST(
      v_exam.duration_minutes * 60,
      floor(EXTRACT(EPOCH FROM (now() - v_session.started_at)))::integer
    )
  );

  -- Compute marks and build post-submission review strictly on the server
  IF EXISTS (SELECT 1 FROM public.cbt_questions cq WHERE cq.exam_id = p_exam_id) THEN
    WITH ordered_q AS (
      SELECT
        cq.id,
        cq.question,
        jsonb_build_object('A', cq.option_a, 'B', cq.option_b, 'C', cq.option_c, 'D', cq.option_d) AS options,
        cq.correct_option,
        cq.explanation,
        cq.marks,
        upper(trim(COALESCE(v_answers->>cq.id, ''))) AS selected_opt,
        COALESCE(ord_idx.pos, cq.question_order::bigint) AS sort_pos
      FROM public.cbt_questions cq
      LEFT JOIN LATERAL jsonb_array_elements_text(v_session.question_order) WITH ORDINALITY AS ord_idx(qid, pos)
        ON ord_idx.qid = cq.id
      WHERE cq.exam_id = p_exam_id
    )
    SELECT
      COALESCE(sum(CASE WHEN selected_opt = correct_option THEN marks ELSE 0 END), 0),
      COALESCE(sum(marks), 0),
      COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'questionId', id,
            'question', question,
            'options', options,
            'selectedOption', NULLIF(selected_opt, ''),
            'correctOption', correct_option,
            'explanation', explanation,
            'marks', marks,
            'earnedMarks', CASE WHEN selected_opt = correct_option THEN marks ELSE 0 END,
            'isCorrect', (selected_opt = correct_option)
          )
          ORDER BY sort_pos
        ),
        '[]'::jsonb
      )
    INTO v_score, v_total_marks, v_review
    FROM ordered_q;
  ELSE
    WITH ordered_q AS (
      SELECT
        COALESCE(NULLIF(trim(q.val->>'id'), ''), p_exam_id || '-q-' || q.ord::text) AS id,
        COALESCE(q.val->>'question', '') AS question,
        COALESCE(q.val->'options', '{}'::jsonb) AS options,
        CASE WHEN upper(COALESCE(q.val->>'correctOption', 'A')) IN ('A','B','C','D') THEN upper(q.val->>'correctOption') ELSE 'A' END AS correct_option,
        q.val->>'explanation' AS explanation,
        CASE WHEN COALESCE(trim(q.val->>'marks'), '') ~ '^\d+(\.\d+)?$' THEN (q.val->>'marks')::numeric ELSE 1 END AS marks,
        upper(trim(COALESCE(v_answers->>COALESCE(NULLIF(trim(q.val->>'id'), ''), p_exam_id || '-q-' || q.ord::text), ''))) AS selected_opt,
        COALESCE(ord_idx.pos, q.ord) AS sort_pos
      FROM jsonb_array_elements(CASE WHEN jsonb_typeof(v_exam.questions) = 'array' THEN v_exam.questions ELSE '[]'::jsonb END) WITH ORDINALITY AS q(val, ord)
      LEFT JOIN LATERAL jsonb_array_elements_text(v_session.question_order) WITH ORDINALITY AS ord_idx(qid, pos)
        ON ord_idx.qid = COALESCE(NULLIF(trim(q.val->>'id'), ''), p_exam_id || '-q-' || q.ord::text)
    )
    SELECT
      COALESCE(sum(CASE WHEN selected_opt = correct_option THEN marks ELSE 0 END), 0),
      COALESCE(sum(marks), 0),
      COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'questionId', id,
            'question', question,
            'options', options,
            'selectedOption', NULLIF(selected_opt, ''),
            'correctOption', correct_option,
            'explanation', explanation,
            'marks', marks,
            'earnedMarks', CASE WHEN selected_opt = correct_option THEN marks ELSE 0 END,
            'isCorrect', (selected_opt = correct_option)
          )
          ORDER BY sort_pos
        ),
        '[]'::jsonb
      )
    INTO v_score, v_total_marks, v_review
    FROM ordered_q;
  END IF;

  IF v_total_marks <= 0 THEN
    v_total_marks := GREATEST(v_exam.total_marks, 1);
  END IF;

  v_percentage := LEAST(100, GREATEST(0, round((v_score / v_total_marks) * 100.0, 2)));
  v_passed := v_percentage >= COALESCE(v_exam.pass_percentage, 50);
  v_attempt_id := 'attmpt-' || substr(md5(p_exam_id || ':' || v_student.id || ':' || now()::text), 1, 16);

  INSERT INTO public.cbt_attempts (
    id, exam_id, student_id, student_name, admission_no,
    score_obtained, total_marks, percentage, passed,
    time_taken_seconds, completed_at, answers
  )
  VALUES (
    v_attempt_id,
    p_exam_id,
    v_student.id,
    trim(v_student.first_name || ' ' || v_student.last_name),
    v_student.admission_no,
    v_score,
    v_total_marks,
    v_percentage,
    v_passed,
    v_time_taken,
    v_completed_at,
    v_answers
  )
  RETURNING * INTO v_attempt_row;

  UPDATE public.cbt_exam_sessions
  SET status = 'submitted',
      submitted_at = now(),
      updated_at = now()
  WHERE id = v_session.id;

  RETURN jsonb_build_object(
    'attempt', jsonb_build_object(
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
-- 11. EXPLICIT LEAST-PRIVILEGE GRANTS & REVOKES
--     (RLS policies filter rows; PostgreSQL privilege GRANTs govern table/column access.)
-- ----------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- Service role retains full administrative database privileges
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- Lock down default table & view grants from PUBLIC and anon first
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon, authenticated;

-- Grant anon ONLY safe public website read views/tables + constrained application insert
GRANT SELECT ON public.public_site_settings TO anon;
GRANT SELECT ON public.news_items TO anon;
GRANT SELECT ON public.gallery_images TO anon;
GRANT SELECT ON public.download_documents TO anon;
GRANT SELECT ON public.announcements TO anon;
GRANT INSERT ON public.online_applications TO anon;

-- Grant authenticated users scoped table privileges (enforced per-row by RLS)
GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.user_profiles,
  public.academic_sessions,
  public.system_settings,
  public.classes,
  public.subjects,
  public.student_result_passcodes,
  public.parents,
  public.parent_students,
  public.teacher_subjects,
  public.scores,
  public.terminal_results,
  public.attendance,
  public.cbt_exams,
  public.cbt_questions,
  public.cbt_attempts,
  public.cbt_exam_sessions,
  public.assignments,
  public.assignment_submissions,
  public.study_notes,
  public.news_items,
  public.gallery_images,
  public.online_applications,
  public.download_documents,
  public.announcements,
  public.fee_records
TO authenticated;

-- Column-level privilege hardening on students & teachers:
-- Block SELECT on password & result_passcode for ALL anon & authenticated callers.
GRANT SELECT (
  id, auth_user_id, admission_no, first_name, last_name, other_names, email,
  gender, dob, class_id, class_name, arm, house, parent_name, parent_phone,
  parent_email, address, avatar, status, created_at, updated_at
) ON public.students TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.students TO authenticated;

GRANT SELECT (
  id, auth_user_id, staff_id, first_name, last_name, qualification, email,
  phone, subject_ids, subjects_taught, form_class_id, form_class_name,
  class_taught, classes_taught, avatar, join_date, status, created_at, updated_at
) ON public.teachers TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.teachers TO authenticated;

-- Safe view grants
GRANT SELECT ON public.public_site_settings TO authenticated;
GRANT SELECT ON public.students_safe TO authenticated;
GRANT SELECT ON public.teachers_safe TO authenticated;

-- Explicit function execution grants
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_parent_students_from_parent() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_parent_students_from_student() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_teacher_subjects_from_teacher() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_cbt_exam_active_session() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_cbt_question_active_session() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_cbt_questions_from_exam() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bootstrap_first_admin(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bootstrap_first_admin(text, text) TO service_role;

REVOKE ALL ON FUNCTION
  public.current_app_role(),
  public.is_admin(),
  public.is_teacher(),
  public.current_teacher_id(),
  public.is_own_teacher_id(text),
  public.teacher_teaches_subject(text),
  public.teacher_is_form_teacher(text),
  public.teacher_assigned_to_class(text),
  public.is_student_owner(text),
  public.is_parent_of_student(text),
  public.student_in_class(text),
  public.parent_has_ward_in_class(text),
  public.sync_my_user_profile(),
  public.verify_student_result_passcode(text, text),
  public.get_student_cbt_exams(),
  public.start_cbt_exam(text),
  public.submit_cbt_exam(text, jsonb)
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION
  public.current_app_role(),
  public.is_admin(),
  public.is_teacher(),
  public.current_teacher_id(),
  public.is_own_teacher_id(text),
  public.teacher_teaches_subject(text),
  public.teacher_is_form_teacher(text),
  public.teacher_assigned_to_class(text),
  public.is_student_owner(text),
  public.is_parent_of_student(text),
  public.student_in_class(text),
  public.parent_has_ward_in_class(text),
  public.sync_my_user_profile(),
  public.verify_student_result_passcode(text, text),
  public.get_student_cbt_exams(),
  public.start_cbt_exam(text),
  public.submit_cbt_exam(text, jsonb)
TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 12. ROW LEVEL SECURITY (FAIL-CLOSED BY DEFAULT; STRICT ROLE & OWNER SCOPING)
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'user_profiles','academic_sessions','system_settings','teachers','classes',
    'subjects','students','student_result_passcodes','parents','parent_students',
    'teacher_subjects','scores','terminal_results','attendance','cbt_exams',
    'cbt_questions','cbt_attempts','cbt_exam_sessions','assignments',
    'assignment_submissions','study_notes','news_items','gallery_images',
    'online_applications','download_documents','announcements','fee_records'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl);
  END LOOP;
END $$;

-- Drop existing policies idempotently before re-creating
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'user_profiles','academic_sessions','system_settings','teachers','classes',
        'subjects','students','student_result_passcodes','parents','parent_students',
        'teacher_subjects','scores','terminal_results','attendance','cbt_exams',
        'cbt_questions','cbt_attempts','cbt_exam_sessions','assignments',
        'assignment_submissions','study_notes','news_items','gallery_images',
        'online_applications','download_documents','announcements','fee_records'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', pol.policyname, pol.tablename);
  END LOOP;
END $$;

-- A. SYSTEM SETTINGS (Authenticated read; Admin full control; Anon uses public_site_settings view)
CREATE POLICY "authenticated_read_system_settings"
  ON public.system_settings FOR SELECT TO authenticated
  USING (public.current_app_role() IN ('admin', 'teacher', 'student', 'parent'));
CREATE POLICY "admin_manage_system_settings"
  ON public.system_settings FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- B. PUBLIC WEBSITE CONTENT (Safe Read-Only Public; Admin Manage)
CREATE POLICY "public_read_news"
  ON public.news_items FOR SELECT TO anon, authenticated
  USING (true);
CREATE POLICY "admin_manage_news"
  ON public.news_items FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "public_read_gallery"
  ON public.gallery_images FOR SELECT TO anon, authenticated
  USING (true);
CREATE POLICY "admin_manage_gallery"
  ON public.gallery_images FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "public_read_downloads"
  ON public.download_documents FOR SELECT TO anon, authenticated
  USING (true);
CREATE POLICY "admin_manage_downloads"
  ON public.download_documents FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Academic sessions: authenticated read only; Admin manage
CREATE POLICY "authenticated_read_academic_sessions"
  ON public.academic_sessions FOR SELECT TO authenticated
  USING (public.current_app_role() IN ('admin', 'teacher', 'student', 'parent'));
CREATE POLICY "admin_manage_academic_sessions"
  ON public.academic_sessions FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Announcements: separated anon vs authenticated so anon never invokes role helper functions
CREATE POLICY "anon_read_public_announcements"
  ON public.announcements FOR SELECT TO anon
  USING (COALESCE(target_audience, target_role, 'All') = 'All');
CREATE POLICY "authenticated_read_announcements"
  ON public.announcements FOR SELECT TO authenticated
  USING (
    COALESCE(target_audience, target_role, 'All') = 'All'
    OR public.is_admin()
    OR (public.current_app_role() = 'student' AND COALESCE(target_audience, target_role) = 'Students')
    OR (public.current_app_role() = 'teacher' AND COALESCE(target_audience, target_role) = 'Teachers')
    OR (public.current_app_role() = 'parent'  AND COALESCE(target_audience, target_role) = 'Parents')
  );
CREATE POLICY "staff_insert_announcements"
  ON public.announcements FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() OR public.is_teacher());
CREATE POLICY "admin_update_announcements"
  ON public.announcements FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "admin_delete_announcements"
  ON public.announcements FOR DELETE TO authenticated
  USING (public.is_admin());

-- C. ONLINE APPLICATIONS (No public SELECT/UPDATE/DELETE; constrained Pending INSERT only)
CREATE POLICY "constrained_public_submit_application"
  ON public.online_applications FOR INSERT TO anon, authenticated
  WITH CHECK (
    status = 'Pending'
    AND notes IS NULL
    AND length(trim(applicant_first_name)) > 0
    AND length(trim(applicant_last_name)) > 0
    AND length(trim(guardian_email)) > 3
  );
CREATE POLICY "admin_manage_applications"
  ON public.online_applications FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- D. CURRICULUM STRUCTURE (Role-scoped reads; Admin manages)
-- Teachers read only classes & subjects assigned to them; students read own class; parents read ward classes
CREATE POLICY "classes_scoped_select"
  ON public.classes FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR (public.is_teacher() AND public.teacher_assigned_to_class(id))
    OR public.student_in_class(id)
    OR public.parent_has_ward_in_class(id)
  );
CREATE POLICY "admin_manage_classes"
  ON public.classes FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "subjects_scoped_select"
  ON public.subjects FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR (public.is_teacher() AND public.teacher_teaches_subject(id))
    OR public.current_app_role() IN ('student', 'parent')
  );
CREATE POLICY "admin_manage_subjects"
  ON public.subjects FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- E. PROFILES, DIRECTORY TABLES & PASSCODE SECRETS (Strict Role/Owner Isolation)
CREATE POLICY "user_read_own_profile"
  ON public.user_profiles FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid() OR public.is_admin());
CREATE POLICY "admin_manage_profiles"
  ON public.user_profiles FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Students: column grants block password/result_passcode; teachers only see students in assigned classes
CREATE POLICY "students_scoped_select"
  ON public.students FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR (public.is_teacher() AND public.teacher_assigned_to_class(class_id))
    OR auth_user_id = auth.uid()
    OR public.is_parent_of_student(id)
  );
CREATE POLICY "admin_manage_students"
  ON public.students FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Result Passcodes isolated exclusively to Admin (verified via verify_student_result_passcode RPC)
CREATE POLICY "admin_only_result_passcodes"
  ON public.student_result_passcodes FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Teachers: column grants exclude password; non-admin teachers see only their own teacher record
CREATE POLICY "teachers_scoped_select"
  ON public.teachers FOR SELECT TO authenticated
  USING (public.is_admin() OR auth_user_id = auth.uid());
CREATE POLICY "admin_manage_teachers"
  ON public.teachers FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "parents_scoped_select"
  ON public.parents FOR SELECT TO authenticated
  USING (public.is_admin() OR auth_user_id = auth.uid());
CREATE POLICY "admin_manage_parents"
  ON public.parents FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "parent_students_scoped_select"
  ON public.parent_students FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR EXISTS (SELECT 1 FROM public.parents p WHERE p.id = parent_id AND p.auth_user_id = auth.uid())
    OR public.is_student_owner(student_id)
  );
CREATE POLICY "admin_manage_parent_students"
  ON public.parent_students FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY "teacher_subjects_scoped_select"
  ON public.teacher_subjects FOR SELECT TO authenticated
  USING (public.is_admin() OR public.is_own_teacher_id(teacher_id));
CREATE POLICY "admin_manage_teacher_subjects"
  ON public.teacher_subjects FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- F. ACADEMIC RECORDS (SCORES, RESULTS, ATTENDANCE)
-- Teachers can only read/write scores for their own assigned classes/subjects or own teacher_id
CREATE POLICY "scores_scoped_select"
  ON public.scores FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR (
      public.is_teacher()
      AND (
        public.is_own_teacher_id(teacher_id)
        OR public.teacher_teaches_subject(subject_id)
        OR public.teacher_is_form_teacher(class_id)
      )
    )
    OR public.is_student_owner(student_id)
    OR public.is_parent_of_student(student_id)
  );
CREATE POLICY "admin_manage_scores"
  ON public.scores FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "teacher_insert_own_scores"
  ON public.scores FOR INSERT TO authenticated
  WITH CHECK (
    public.is_teacher()
    AND public.is_own_teacher_id(teacher_id)
    AND public.teacher_assigned_to_class(class_id)
    AND (public.teacher_teaches_subject(subject_id) OR public.teacher_is_form_teacher(class_id))
  );
CREATE POLICY "teacher_update_own_scores"
  ON public.scores FOR UPDATE TO authenticated
  USING (public.is_teacher() AND public.is_own_teacher_id(teacher_id))
  WITH CHECK (
    public.is_teacher()
    AND public.is_own_teacher_id(teacher_id)
    AND public.teacher_assigned_to_class(class_id)
    AND (public.teacher_teaches_subject(subject_id) OR public.teacher_is_form_teacher(class_id))
  );
CREATE POLICY "teacher_delete_own_scores"
  ON public.scores FOR DELETE TO authenticated
  USING (public.is_teacher() AND public.is_own_teacher_id(teacher_id));

-- Terminal results: Admin manages all; authorized form teacher manages their assigned class
CREATE POLICY "terminal_results_scoped_select"
  ON public.terminal_results FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR (public.is_teacher() AND public.teacher_is_form_teacher(class_id))
    OR (status = 'Published' AND (public.is_student_owner(student_id) OR public.is_parent_of_student(student_id)))
  );
CREATE POLICY "admin_manage_terminal_results"
  ON public.terminal_results FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "form_teacher_manage_terminal_results"
  ON public.terminal_results FOR ALL TO authenticated
  USING (public.is_teacher() AND public.teacher_is_form_teacher(class_id))
  WITH CHECK (public.is_teacher() AND public.teacher_is_form_teacher(class_id));

-- Attendance: Admin manages all; teachers assigned to that class read & manage attendance
CREATE POLICY "attendance_scoped_select"
  ON public.attendance FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR (public.is_teacher() AND public.teacher_assigned_to_class(class_id))
    OR public.is_student_owner(student_id)
    OR public.is_parent_of_student(student_id)
  );
CREATE POLICY "admin_manage_attendance"
  ON public.attendance FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "assigned_teacher_manage_attendance"
  ON public.attendance FOR ALL TO authenticated
  USING (public.is_teacher() AND public.teacher_assigned_to_class(class_id))
  WITH CHECK (public.is_teacher() AND public.teacher_assigned_to_class(class_id));

-- G. CBT EXAMS, QUESTIONS, SESSIONS & ATTEMPTS
-- CRITICAL: Students cannot SELECT cbt_exams or cbt_questions directly (answer key protection).
-- Students use get_student_cbt_exams(), start_cbt_exam(), and submit_cbt_exam() RPCs.
-- Students cannot INSERT or UPDATE cbt_attempts directly (server-authoritative scoring).
CREATE POLICY "admin_manage_cbt_exams"
  ON public.cbt_exams FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "teacher_read_own_cbt_exams"
  ON public.cbt_exams FOR SELECT TO authenticated
  USING (public.is_teacher() AND public.is_own_teacher_id(teacher_id));
CREATE POLICY "teacher_insert_own_cbt_exams"
  ON public.cbt_exams FOR INSERT TO authenticated
  WITH CHECK (public.is_teacher() AND public.is_own_teacher_id(teacher_id));
CREATE POLICY "teacher_update_own_cbt_exams"
  ON public.cbt_exams FOR UPDATE TO authenticated
  USING (public.is_teacher() AND public.is_own_teacher_id(teacher_id))
  WITH CHECK (public.is_teacher() AND public.is_own_teacher_id(teacher_id));
CREATE POLICY "teacher_delete_own_cbt_exams"
  ON public.cbt_exams FOR DELETE TO authenticated
  USING (public.is_teacher() AND public.is_own_teacher_id(teacher_id));

CREATE POLICY "admin_manage_cbt_questions"
  ON public.cbt_questions FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "teacher_manage_own_cbt_questions"
  ON public.cbt_questions FOR ALL TO authenticated
  USING (
    public.is_teacher()
    AND EXISTS (
      SELECT 1 FROM public.cbt_exams ce
      WHERE ce.id = exam_id AND public.is_own_teacher_id(ce.teacher_id)
    )
  )
  WITH CHECK (
    public.is_teacher()
    AND EXISTS (
      SELECT 1 FROM public.cbt_exams ce
      WHERE ce.id = exam_id AND public.is_own_teacher_id(ce.teacher_id)
    )
  );

-- CBT Sessions: Admin full control; student/owner-teacher read-only; mutations only via RPCs
CREATE POLICY "admin_manage_cbt_exam_sessions"
  ON public.cbt_exam_sessions FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "cbt_exam_sessions_scoped_select"
  ON public.cbt_exam_sessions FOR SELECT TO authenticated
  USING (
    public.is_student_owner(student_id)
    OR (
      public.is_teacher()
      AND EXISTS (
        SELECT 1 FROM public.cbt_exams ce
        WHERE ce.id = exam_id AND public.is_own_teacher_id(ce.teacher_id)
      )
    )
  );
CREATE POLICY "cbt_exam_sessions_owner_teacher_delete"
  ON public.cbt_exam_sessions FOR DELETE TO authenticated
  USING (
    public.is_teacher()
    AND EXISTS (
      SELECT 1 FROM public.cbt_exams ce
      WHERE ce.id = exam_id AND public.is_own_teacher_id(ce.teacher_id)
    )
  );

-- CBT Attempts: immutable for students & parents; Admin manages all; owner teacher reads & can reset (DELETE)
CREATE POLICY "admin_manage_cbt_attempts"
  ON public.cbt_attempts FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "cbt_attempts_scoped_select"
  ON public.cbt_attempts FOR SELECT TO authenticated
  USING (
    public.is_student_owner(student_id)
    OR public.is_parent_of_student(student_id)
    OR (
      public.is_teacher()
      AND EXISTS (
        SELECT 1 FROM public.cbt_exams ce
        WHERE ce.id = exam_id AND public.is_own_teacher_id(ce.teacher_id)
      )
    )
  );
CREATE POLICY "cbt_attempts_owner_teacher_delete"
  ON public.cbt_attempts FOR DELETE TO authenticated
  USING (
    public.is_teacher()
    AND EXISTS (
      SELECT 1 FROM public.cbt_exams ce
      WHERE ce.id = exam_id AND public.is_own_teacher_id(ce.teacher_id)
    )
  );

-- H. ASSIGNMENTS, SUBMISSIONS & STUDY NOTES (OWNER-SCOPED TEACHER WRITES + ADMIN ALL)
CREATE POLICY "assignments_scoped_select"
  ON public.assignments FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR (public.is_teacher() AND (public.is_own_teacher_id(teacher_id) OR public.teacher_assigned_to_class(class_id)))
    OR public.student_in_class(class_id)
  );
CREATE POLICY "admin_manage_assignments"
  ON public.assignments FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "teacher_insert_own_assignments"
  ON public.assignments FOR INSERT TO authenticated
  WITH CHECK (public.is_teacher() AND public.is_own_teacher_id(teacher_id));
CREATE POLICY "teacher_update_own_assignments"
  ON public.assignments FOR UPDATE TO authenticated
  USING (public.is_teacher() AND public.is_own_teacher_id(teacher_id))
  WITH CHECK (public.is_teacher() AND public.is_own_teacher_id(teacher_id));
CREATE POLICY "teacher_delete_own_assignments"
  ON public.assignments FOR DELETE TO authenticated
  USING (public.is_teacher() AND public.is_own_teacher_id(teacher_id));

CREATE POLICY "admin_manage_assignment_submissions"
  ON public.assignment_submissions FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "assignment_submissions_scoped_select"
  ON public.assignment_submissions FOR SELECT TO authenticated
  USING (
    public.is_student_owner(student_id)
    OR public.is_parent_of_student(student_id)
    OR (
      public.is_teacher()
      AND EXISTS (
        SELECT 1 FROM public.assignments a
        WHERE a.id = assignment_id AND public.is_own_teacher_id(a.teacher_id)
      )
    )
  );
CREATE POLICY "assignment_submissions_student_insert"
  ON public.assignment_submissions FOR INSERT TO authenticated
  WITH CHECK (
    public.is_student_owner(student_id)
    AND grade IS NULL
    AND feedback IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.assignments a
      JOIN public.students s ON s.id = student_id
      WHERE a.id = assignment_id
        AND a.class_id = s.class_id
        AND s.status = 'Active'
    )
  );
CREATE POLICY "teacher_grade_own_assignment_submissions"
  ON public.assignment_submissions FOR UPDATE TO authenticated
  USING (
    public.is_teacher()
    AND EXISTS (
      SELECT 1 FROM public.assignments a
      WHERE a.id = assignment_id AND public.is_own_teacher_id(a.teacher_id)
    )
  )
  WITH CHECK (
    public.is_teacher()
    AND EXISTS (
      SELECT 1 FROM public.assignments a
      WHERE a.id = assignment_id AND public.is_own_teacher_id(a.teacher_id)
    )
  );

CREATE POLICY "study_notes_scoped_select"
  ON public.study_notes FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR (
      public.is_teacher()
      AND (public.is_own_teacher_id(teacher_id) OR class_id IS NULL OR public.teacher_assigned_to_class(class_id))
    )
    OR (
      public.current_app_role() = 'student'
      AND (class_id IS NULL OR public.student_in_class(class_id))
    )
    OR (
      public.current_app_role() = 'parent'
      AND (class_id IS NULL OR public.parent_has_ward_in_class(class_id))
    )
  );
CREATE POLICY "admin_manage_study_notes"
  ON public.study_notes FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "teacher_insert_own_study_notes"
  ON public.study_notes FOR INSERT TO authenticated
  WITH CHECK (public.is_teacher() AND public.is_own_teacher_id(teacher_id));
CREATE POLICY "teacher_update_own_study_notes"
  ON public.study_notes FOR UPDATE TO authenticated
  USING (public.is_teacher() AND public.is_own_teacher_id(teacher_id))
  WITH CHECK (public.is_teacher() AND public.is_own_teacher_id(teacher_id));
CREATE POLICY "teacher_delete_own_study_notes"
  ON public.study_notes FOR DELETE TO authenticated
  USING (public.is_teacher() AND public.is_own_teacher_id(teacher_id));

-- I. SCHOOL FEES & FINANCIAL LEDGER (STRICTLY ADMIN, OWNER STUDENT & LINKED PARENT)
CREATE POLICY "fee_records_scoped_select"
  ON public.fee_records FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR public.is_student_owner(student_id)
    OR public.is_parent_of_student(student_id)
  );
CREATE POLICY "admin_manage_fee_records"
  ON public.fee_records FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

COMMIT;
