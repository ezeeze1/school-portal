-- Divine Academy Secondary School Portal - Non-Destructive Supabase Schema
-- Run this script in your Supabase Dashboard -> SQL Editor if tables do not exist yet.
-- Uses CREATE TABLE IF NOT EXISTS so existing data and tables are preserved.

CREATE TABLE IF NOT EXISTS system_settings (
  id text PRIMARY KEY,
  current_session text NOT NULL,
  academic_sessions jsonb NOT NULL DEFAULT '[]'::jsonb,
  current_term text NOT NULL,
  is_result_published boolean DEFAULT false,
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
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS classes (
  id text PRIMARY KEY,
  name text NOT NULL,
  category text NOT NULL,
  arms jsonb NOT NULL DEFAULT '[]'::jsonb,
  class_teacher_id text,
  capacity integer NOT NULL DEFAULT 35
);

CREATE TABLE IF NOT EXISTS subjects (
  id text PRIMARY KEY,
  code text NOT NULL,
  name text NOT NULL,
  category text NOT NULL,
  is_compulsory boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS students (
  id text PRIMARY KEY,
  admission_no text NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  other_names text,
  gender text NOT NULL,
  dob text NOT NULL,
  class_id text NOT NULL,
  class_name text NOT NULL,
  arm text,
  house text,
  parent_name text NOT NULL,
  parent_phone text NOT NULL,
  parent_email text,
  password text,
  result_passcode text,
  address text NOT NULL,
  avatar text NOT NULL,
  status text NOT NULL DEFAULT 'Active'
);

CREATE TABLE IF NOT EXISTS teachers (
  id text PRIMARY KEY,
  staff_id text NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  qualification text,
  email text NOT NULL,
  phone text NOT NULL,
  password text,
  subject_ids jsonb DEFAULT '[]'::jsonb,
  subjects_taught jsonb NOT NULL DEFAULT '[]'::jsonb,
  form_class_id text,
  form_class_name text,
  class_taught text,
  classes_taught jsonb DEFAULT '[]'::jsonb,
  avatar text NOT NULL,
  join_date text,
  status text DEFAULT 'Active'
);

CREATE TABLE IF NOT EXISTS parents (
  id text PRIMARY KEY,
  parent_id text NOT NULL,
  title text NOT NULL,
  full_name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  occupation text NOT NULL,
  address text NOT NULL,
  student_ids jsonb NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS scores (
  id text PRIMARY KEY,
  student_id text NOT NULL,
  subject_id text NOT NULL,
  subject_name text NOT NULL,
  class_id text NOT NULL,
  session_id text NOT NULL,
  term text NOT NULL,
  ca1_score numeric NOT NULL DEFAULT 0,
  ca2_score numeric NOT NULL DEFAULT 0,
  exam_score numeric NOT NULL DEFAULT 0,
  total_score numeric NOT NULL DEFAULT 0,
  grade text NOT NULL,
  remarks text NOT NULL,
  teacher_id text NOT NULL
);

CREATE TABLE IF NOT EXISTS terminal_results (
  id text PRIMARY KEY,
  student_id text NOT NULL,
  class_id text NOT NULL,
  session_id text NOT NULL,
  term text NOT NULL,
  scores jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_obtained numeric,
  total_possible numeric,
  grand_total_score numeric,
  average_score numeric NOT NULL DEFAULT 0,
  position_in_class integer NOT NULL DEFAULT 1,
  total_students_in_class integer NOT NULL DEFAULT 1,
  psychomotor jsonb NOT NULL DEFAULT '{}'::jsonb,
  teacher_remarks text NOT NULL DEFAULT '',
  principal_remarks text NOT NULL DEFAULT '',
  days_present integer NOT NULL DEFAULT 0,
  days_absent integer NOT NULL DEFAULT 0,
  total_school_days integer NOT NULL DEFAULT 0,
  next_term_begins text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'Draft'
);

CREATE TABLE IF NOT EXISTS attendance (
  id text PRIMARY KEY,
  student_id text NOT NULL,
  student_name text,
  class_id text NOT NULL,
  date text NOT NULL,
  status text NOT NULL,
  remark text
);

CREATE TABLE IF NOT EXISTS cbt_exams (
  id text PRIMARY KEY,
  title text NOT NULL,
  subject_id text NOT NULL,
  subject_name text NOT NULL,
  class_id text NOT NULL,
  class_name text NOT NULL,
  teacher_id text NOT NULL,
  term text,
  session text,
  duration_minutes integer NOT NULL DEFAULT 30,
  total_questions integer NOT NULL DEFAULT 0,
  total_marks numeric NOT NULL DEFAULT 0,
  pass_percentage numeric NOT NULL DEFAULT 50,
  start_date text NOT NULL,
  start_time text,
  end_date text NOT NULL,
  questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_published boolean NOT NULL DEFAULT false,
  shuffle_questions boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS cbt_attempts (
  id text PRIMARY KEY,
  exam_id text NOT NULL,
  student_id text NOT NULL,
  student_name text NOT NULL,
  admission_no text NOT NULL,
  score_obtained numeric NOT NULL DEFAULT 0,
  total_marks numeric NOT NULL DEFAULT 0,
  percentage numeric NOT NULL DEFAULT 0,
  passed boolean NOT NULL DEFAULT false,
  time_taken_seconds integer NOT NULL DEFAULT 0,
  completed_at text NOT NULL,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS assignments (
  id text PRIMARY KEY,
  title text NOT NULL,
  subject_id text NOT NULL,
  subject_name text NOT NULL,
  class_id text NOT NULL,
  class_name text NOT NULL,
  teacher_id text NOT NULL,
  teacher_name text NOT NULL,
  due_date text NOT NULL,
  description text NOT NULL,
  format text,
  content text,
  attachment_url text,
  attachment_name text,
  file_size text,
  created_date text NOT NULL,
  total_marks numeric
);

CREATE TABLE IF NOT EXISTS study_notes (
  id text PRIMARY KEY,
  title text NOT NULL,
  subject_id text,
  subject_name text NOT NULL,
  class_id text,
  class_name text NOT NULL,
  teacher_id text,
  teacher_name text,
  upload_date text NOT NULL,
  file_size text NOT NULL,
  download_url text,
  file_url text,
  description text NOT NULL
);

CREATE TABLE IF NOT EXISTS news_items (
  id text PRIMARY KEY,
  title text NOT NULL,
  category text NOT NULL,
  date text NOT NULL,
  author text NOT NULL,
  summary text NOT NULL,
  content text NOT NULL,
  image_url text NOT NULL,
  featured boolean DEFAULT false
);

CREATE TABLE IF NOT EXISTS gallery_images (
  id text PRIMARY KEY,
  title text NOT NULL,
  category text NOT NULL,
  image_url text NOT NULL,
  caption text NOT NULL,
  date text NOT NULL
);

CREATE TABLE IF NOT EXISTS online_applications (
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
  notes text
);

CREATE TABLE IF NOT EXISTS download_documents (
  id text PRIMARY KEY,
  title text NOT NULL,
  category text NOT NULL,
  file_type text NOT NULL,
  file_size text NOT NULL,
  updated_date text NOT NULL,
  url text NOT NULL
);

CREATE TABLE IF NOT EXISTS announcements (
  id text PRIMARY KEY,
  title text NOT NULL,
  message text NOT NULL,
  sender text NOT NULL,
  target_audience text,
  target_role text,
  priority text,
  date text NOT NULL
);

CREATE TABLE IF NOT EXISTS fee_records (
  id text PRIMARY KEY,
  student_id text NOT NULL,
  student_name text NOT NULL,
  term text NOT NULL,
  session text NOT NULL,
  tuition numeric NOT NULL DEFAULT 0,
  development_fee numeric NOT NULL DEFAULT 0,
  ict_fee numeric NOT NULL DEFAULT 0,
  uniform_fee numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  amount_paid numeric NOT NULL DEFAULT 0,
  balance numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'Unpaid',
  receipt_no text NOT NULL
);
