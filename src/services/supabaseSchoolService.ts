import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  Student,
  Teacher,
  Parent,
  SchoolClass,
  Subject,
  ScoreRecord,
  TerminalResult,
  AttendanceRecord,
  CBTExam,
  CBTAttempt,
  Assignment,
  StudyNote,
  NewsItem,
  GalleryImage,
  OnlineApplication,
  DownloadDocument,
  AnnouncementNotification,
  FeeRecord,
  SystemSessionTerm,
} from '../types';

export interface SupabasePortalSnapshot {
  systemSettings?: SystemSessionTerm;
  students?: Student[];
  teachers?: Teacher[];
  parents?: Parent[];
  classes?: SchoolClass[];
  subjects?: Subject[];
  scores?: ScoreRecord[];
  results?: TerminalResult[];
  attendance?: AttendanceRecord[];
  cbtExams?: CBTExam[];
  cbtAttempts?: CBTAttempt[];
  assignments?: Assignment[];
  studyNotes?: StudyNote[];
  newsItems?: NewsItem[];
  galleryImages?: GalleryImage[];
  applications?: OnlineApplication[];
  downloads?: DownloadDocument[];
  announcements?: AnnouncementNotification[];
  feeRecords?: FeeRecord[];
}

// Generic safe row mapper helpers
const toSystemSettingsRow = (s: SystemSessionTerm) => ({
  id: 'default',
  current_session: s.currentSession,
  academic_sessions: s.academicSessions ?? [],
  current_term: s.currentTerm,
  is_result_published: s.isResultPublished ?? false,
  result_entry_open: s.resultEntryOpen,
  cbt_active: s.cbtActive,
  school_name: s.schoolName ?? null,
  school_motto: s.schoolMotto ?? null,
  school_logo_text: s.schoolLogoText ?? null,
  school_phone: s.schoolPhone ?? null,
  school_email: s.schoolEmail ?? null,
  school_address: s.schoolAddress ?? null,
  hero_badge: s.heroBadge ?? null,
  hero_title: s.heroTitle ?? null,
  hero_subtitle: s.heroSubtitle ?? null,
  hero_image: s.heroImage ?? null,
  hero_spotlight_label: s.heroSpotlightLabel ?? null,
  hero_spotlight_text: s.heroSpotlightText ?? null,
  hero_image_title: s.heroImageTitle ?? null,
  stat_students_number: s.statStudentsNumber ?? null,
  stat_students_label: s.statStudentsLabel ?? null,
  stat_waec_number: s.statWaecNumber ?? null,
  stat_waec_label: s.statWaecLabel ?? null,
  stat_teachers_number: s.statTeachersNumber ?? null,
  stat_teachers_label: s.statTeachersLabel ?? null,
  stat_clubs_number: s.statClubsNumber ?? null,
  stat_clubs_label: s.statClubsLabel ?? null,
  about_vision: s.aboutVision ?? null,
  about_mission: s.aboutMission ?? null,
  about_principal_name: s.aboutPrincipalName ?? null,
  about_principal_title: s.aboutPrincipalTitle ?? null,
  about_principal_avatar: s.aboutPrincipalAvatar ?? null,
  about_principal_bio: s.aboutPrincipalBio ?? null,
});

const fromSystemSettingsRow = (r: Record<string, any>): SystemSessionTerm => ({
  currentSession: r.current_session,
  academicSessions: Array.isArray(r.academic_sessions) ? r.academic_sessions : undefined,
  currentTerm: r.current_term,
  isResultPublished: r.is_result_published ?? undefined,
  resultEntryOpen: Boolean(r.result_entry_open),
  cbtActive: Boolean(r.cbt_active),
  schoolName: r.school_name ?? undefined,
  schoolMotto: r.school_motto ?? undefined,
  schoolLogoText: r.school_logo_text ?? undefined,
  schoolPhone: r.school_phone ?? undefined,
  schoolEmail: r.school_email ?? undefined,
  schoolAddress: r.school_address ?? undefined,
  heroBadge: r.hero_badge ?? undefined,
  heroTitle: r.hero_title ?? undefined,
  heroSubtitle: r.hero_subtitle ?? undefined,
  heroImage: r.hero_image ?? undefined,
  heroSpotlightLabel: r.hero_spotlight_label ?? undefined,
  heroSpotlightText: r.hero_spotlight_text ?? undefined,
  heroImageTitle: r.hero_image_title ?? undefined,
  statStudentsNumber: r.stat_students_number ?? undefined,
  statStudentsLabel: r.stat_students_label ?? undefined,
  statWaecNumber: r.stat_waec_number ?? undefined,
  statWaecLabel: r.stat_waec_label ?? undefined,
  statTeachersNumber: r.stat_teachers_number ?? undefined,
  statTeachersLabel: r.stat_teachers_label ?? undefined,
  statClubsNumber: r.stat_clubs_number ?? undefined,
  statClubsLabel: r.stat_clubs_label ?? undefined,
  aboutVision: r.about_vision ?? undefined,
  aboutMission: r.about_mission ?? undefined,
  aboutPrincipalName: r.about_principal_name ?? undefined,
  aboutPrincipalTitle: r.about_principal_title ?? undefined,
  aboutPrincipalAvatar: r.about_principal_avatar ?? undefined,
  aboutPrincipalBio: r.about_principal_bio ?? undefined,
});

const toStudentRow = (s: Student) => ({
  id: s.id,
  admission_no: s.admissionNo,
  first_name: s.firstName,
  last_name: s.lastName,
  other_names: s.otherNames ?? null,
  gender: s.gender,
  dob: s.dob,
  class_id: s.classId,
  class_name: s.className,
  arm: s.arm ?? null,
  house: s.house ?? null,
  parent_name: s.parentName,
  parent_phone: s.parentPhone,
  parent_email: s.parentEmail ?? null,
  password: s.password ?? null,
  result_passcode: s.resultPasscode ?? null,
  address: s.address,
  avatar: s.avatar,
  status: s.status,
});

const fromStudentRow = (r: Record<string, any>): Student => ({
  id: r.id,
  admissionNo: r.admission_no,
  firstName: r.first_name,
  lastName: r.last_name,
  otherNames: r.other_names ?? undefined,
  gender: r.gender,
  dob: r.dob,
  classId: r.class_id,
  className: r.class_name,
  arm: r.arm ?? undefined,
  house: r.house ?? undefined,
  parentName: r.parent_name,
  parentPhone: r.parent_phone,
  parentEmail: r.parent_email ?? undefined,
  password: r.password ?? undefined,
  resultPasscode: r.result_passcode ?? undefined,
  address: r.address,
  avatar: r.avatar,
  status: r.status,
});

const toTeacherRow = (t: Teacher) => ({
  id: t.id,
  staff_id: t.staffId,
  first_name: t.firstName,
  last_name: t.lastName,
  qualification: t.qualification ?? null,
  email: t.email,
  phone: t.phone,
  password: t.password ?? null,
  subject_ids: t.subjectIds ?? [],
  subjects_taught: t.subjectsTaught ?? [],
  form_class_id: t.formClassId ?? null,
  form_class_name: t.formClassName ?? null,
  class_taught: t.classTaught ?? null,
  classes_taught: t.classesTaught ?? [],
  avatar: t.avatar,
  join_date: t.joinDate ?? null,
  status: t.status ?? 'Active',
});

const fromTeacherRow = (r: Record<string, any>): Teacher => ({
  id: r.id,
  staffId: r.staff_id,
  firstName: r.first_name,
  lastName: r.last_name,
  qualification: r.qualification ?? undefined,
  email: r.email,
  phone: r.phone,
  password: r.password ?? undefined,
  subjectIds: Array.isArray(r.subject_ids) ? r.subject_ids : undefined,
  subjectsTaught: Array.isArray(r.subjects_taught) ? r.subjects_taught : [],
  formClassId: r.form_class_id ?? undefined,
  formClassName: r.form_class_name ?? undefined,
  classTaught: r.class_taught ?? undefined,
  classesTaught: Array.isArray(r.classes_taught) ? r.classes_taught : undefined,
  avatar: r.avatar,
  joinDate: r.join_date ?? undefined,
  status: r.status ?? undefined,
});

const toParentRow = (p: Parent) => ({
  id: p.id,
  parent_id: p.parentId,
  title: p.title,
  full_name: p.fullName,
  email: p.email,
  phone: p.phone,
  occupation: p.occupation,
  address: p.address,
  student_ids: p.studentIds ?? [],
});

const fromParentRow = (r: Record<string, any>): Parent => ({
  id: r.id,
  parentId: r.parent_id,
  title: r.title,
  fullName: r.full_name,
  email: r.email,
  phone: r.phone,
  occupation: r.occupation,
  address: r.address,
  studentIds: Array.isArray(r.student_ids) ? r.student_ids : [],
});

const toClassRow = (c: SchoolClass) => ({
  id: c.id,
  name: c.name,
  category: c.category,
  arms: c.arms ?? [],
  class_teacher_id: c.classTeacherId ?? null,
  capacity: c.capacity,
});

const fromClassRow = (r: Record<string, any>): SchoolClass => ({
  id: r.id,
  name: r.name,
  category: r.category,
  arms: Array.isArray(r.arms) ? r.arms : [],
  classTeacherId: r.class_teacher_id ?? undefined,
  capacity: Number(r.capacity ?? 35),
});

const toSubjectRow = (s: Subject) => ({
  id: s.id,
  code: s.code,
  name: s.name,
  category: s.category,
  is_compulsory: s.isCompulsory,
});

const fromSubjectRow = (r: Record<string, any>): Subject => ({
  id: r.id,
  code: r.code,
  name: r.name,
  category: r.category,
  isCompulsory: Boolean(r.is_compulsory),
});

const toScoreRow = (s: ScoreRecord) => ({
  id: s.id,
  student_id: s.studentId,
  subject_id: s.subjectId,
  subject_name: s.subjectName,
  class_id: s.classId,
  session_id: s.sessionId,
  term: s.term,
  ca1_score: s.ca1Score,
  ca2_score: s.ca2Score,
  exam_score: s.examScore,
  total_score: s.totalScore,
  grade: s.grade,
  remarks: s.remarks,
  teacher_id: s.teacherId,
});

const fromScoreRow = (r: Record<string, any>): ScoreRecord => ({
  id: r.id,
  studentId: r.student_id,
  subjectId: r.subject_id,
  subjectName: r.subject_name,
  classId: r.class_id,
  sessionId: r.session_id,
  term: r.term,
  ca1Score: Number(r.ca1_score),
  ca2Score: Number(r.ca2_score),
  examScore: Number(r.exam_score),
  totalScore: Number(r.total_score),
  grade: r.grade,
  remarks: r.remarks,
  teacherId: r.teacher_id,
});

const toResultRow = (res: TerminalResult) => ({
  id: res.id,
  student_id: res.studentId,
  class_id: res.classId,
  session_id: res.sessionId,
  term: res.term,
  scores: res.scores ?? [],
  total_obtained: res.totalObtained ?? null,
  total_possible: res.totalPossible ?? null,
  grand_total_score: res.grandTotalScore ?? null,
  average_score: res.averageScore,
  position_in_class: res.positionInClass,
  total_students_in_class: res.totalStudentsInClass,
  psychomotor: res.psychomotor,
  teacher_remarks: res.teacherRemarks,
  principal_remarks: res.principalRemarks,
  days_present: res.daysPresent,
  days_absent: res.daysAbsent,
  total_school_days: res.totalSchoolDays,
  next_term_begins: res.nextTermBegins,
  status: res.status,
});

const fromResultRow = (r: Record<string, any>): TerminalResult => ({
  id: r.id,
  studentId: r.student_id,
  classId: r.class_id,
  sessionId: r.session_id,
  term: r.term,
  scores: Array.isArray(r.scores) ? r.scores : [],
  totalObtained: r.total_obtained != null ? Number(r.total_obtained) : undefined,
  totalPossible: r.total_possible != null ? Number(r.total_possible) : undefined,
  grandTotalScore: r.grand_total_score != null ? Number(r.grand_total_score) : undefined,
  averageScore: Number(r.average_score),
  positionInClass: Number(r.position_in_class),
  totalStudentsInClass: Number(r.total_students_in_class),
  psychomotor: r.psychomotor,
  teacherRemarks: r.teacher_remarks,
  principalRemarks: r.principal_remarks,
  daysPresent: Number(r.days_present),
  daysAbsent: Number(r.days_absent),
  totalSchoolDays: Number(r.total_school_days),
  nextTermBegins: r.next_term_begins,
  status: r.status,
});

const toAttendanceRow = (a: AttendanceRecord) => ({
  id: a.id,
  student_id: a.studentId,
  student_name: a.studentName ?? null,
  class_id: a.classId,
  date: a.date,
  status: a.status,
  remark: a.remark ?? null,
});

const fromAttendanceRow = (r: Record<string, any>): AttendanceRecord => ({
  id: r.id,
  studentId: r.student_id,
  studentName: r.student_name ?? undefined,
  classId: r.class_id,
  date: r.date,
  status: r.status,
  remark: r.remark ?? undefined,
});

const toCBTExamRow = (e: CBTExam) => ({
  id: e.id,
  title: e.title,
  subject_id: e.subjectId,
  subject_name: e.subjectName,
  class_id: e.classId,
  class_name: e.className,
  teacher_id: e.teacherId,
  term: e.term ?? null,
  session: e.session ?? null,
  duration_minutes: e.durationMinutes,
  total_questions: e.totalQuestions,
  total_marks: e.totalMarks,
  pass_percentage: e.passPercentage,
  start_date: e.startDate,
  start_time: e.startTime ?? null,
  end_date: e.endDate,
  questions: e.questions ?? [],
  is_published: e.isPublished,
  shuffle_questions: e.shuffleQuestions,
});

const fromCBTExamRow = (r: Record<string, any>): CBTExam => ({
  id: r.id,
  title: r.title,
  subjectId: r.subject_id,
  subjectName: r.subject_name,
  classId: r.class_id,
  className: r.class_name,
  teacherId: r.teacher_id,
  term: r.term ?? undefined,
  session: r.session ?? undefined,
  durationMinutes: Number(r.duration_minutes),
  totalQuestions: Number(r.total_questions),
  totalMarks: Number(r.total_marks),
  passPercentage: Number(r.pass_percentage),
  startDate: r.start_date,
  startTime: r.start_time ?? undefined,
  endDate: r.end_date,
  questions: Array.isArray(r.questions) ? r.questions : [],
  isPublished: Boolean(r.is_published),
  shuffleQuestions: Boolean(r.shuffle_questions),
});

const toCBTAttemptRow = (a: CBTAttempt) => ({
  id: a.id,
  exam_id: a.examId,
  student_id: a.studentId,
  student_name: a.studentName,
  admission_no: a.admissionNo,
  score_obtained: a.scoreObtained,
  total_marks: a.totalMarks,
  percentage: a.percentage,
  passed: a.passed,
  time_taken_seconds: a.timeTakenSeconds,
  completed_at: a.completedAt,
  answers: a.answers ?? {},
});

const fromCBTAttemptRow = (r: Record<string, any>): CBTAttempt => ({
  id: r.id,
  examId: r.exam_id,
  studentId: r.student_id,
  studentName: r.student_name,
  admissionNo: r.admission_no,
  scoreObtained: Number(r.score_obtained),
  totalMarks: Number(r.total_marks),
  percentage: Number(r.percentage),
  passed: Boolean(r.passed),
  timeTakenSeconds: Number(r.time_taken_seconds),
  completedAt: r.completed_at,
  answers: r.answers ?? {},
});

const toAssignmentRow = (a: Assignment) => ({
  id: a.id,
  title: a.title,
  subject_id: a.subjectId,
  subject_name: a.subjectName,
  class_id: a.classId,
  class_name: a.className,
  teacher_id: a.teacherId,
  teacher_name: a.teacherName,
  due_date: a.dueDate,
  description: a.description,
  format: a.format ?? null,
  content: a.content ?? null,
  attachment_url: a.attachmentUrl ?? null,
  attachment_name: a.attachmentName ?? null,
  file_size: a.fileSize ?? null,
  created_date: a.createdDate,
  total_marks: a.totalMarks ?? null,
});

const fromAssignmentRow = (r: Record<string, any>): Assignment => ({
  id: r.id,
  title: r.title,
  subjectId: r.subject_id,
  subjectName: r.subject_name,
  classId: r.class_id,
  className: r.class_name,
  teacherId: r.teacher_id,
  teacherName: r.teacher_name,
  dueDate: r.due_date,
  description: r.description,
  format: r.format ?? undefined,
  content: r.content ?? undefined,
  attachmentUrl: r.attachment_url ?? undefined,
  attachmentName: r.attachment_name ?? undefined,
  fileSize: r.file_size ?? undefined,
  createdDate: r.created_date,
  totalMarks: r.total_marks != null ? Number(r.total_marks) : undefined,
});

const toStudyNoteRow = (n: StudyNote) => ({
  id: n.id,
  title: n.title,
  subject_id: n.subjectId ?? null,
  subject_name: n.subjectName,
  class_id: n.classId ?? null,
  class_name: n.className,
  teacher_id: n.teacherId ?? null,
  teacher_name: n.teacherName ?? null,
  upload_date: n.uploadDate,
  file_size: n.fileSize,
  download_url: n.downloadUrl ?? null,
  file_url: n.fileUrl ?? null,
  description: n.description,
});

const fromStudyNoteRow = (r: Record<string, any>): StudyNote => ({
  id: r.id,
  title: r.title,
  subjectId: r.subject_id ?? undefined,
  subjectName: r.subject_name,
  classId: r.class_id ?? undefined,
  className: r.class_name,
  teacherId: r.teacher_id ?? undefined,
  teacherName: r.teacher_name ?? undefined,
  uploadDate: r.upload_date,
  fileSize: r.file_size,
  downloadUrl: r.download_url ?? undefined,
  fileUrl: r.file_url ?? undefined,
  description: r.description,
});

const toNewsRow = (n: NewsItem) => ({
  id: n.id,
  title: n.title,
  category: n.category,
  date: n.date,
  author: n.author,
  summary: n.summary,
  content: n.content,
  image_url: n.imageUrl,
  featured: n.featured ?? false,
});

const fromNewsRow = (r: Record<string, any>): NewsItem => ({
  id: r.id,
  title: r.title,
  category: r.category,
  date: r.date,
  author: r.author,
  summary: r.summary,
  content: r.content,
  imageUrl: r.image_url,
  featured: r.featured ?? undefined,
});

const toGalleryRow = (g: GalleryImage) => ({
  id: g.id,
  title: g.title,
  category: g.category,
  image_url: g.imageUrl,
  caption: g.caption,
  date: g.date,
});

const fromGalleryRow = (r: Record<string, any>): GalleryImage => ({
  id: r.id,
  title: r.title,
  category: r.category,
  imageUrl: r.image_url,
  caption: r.caption,
  date: r.date,
});

const toApplicationRow = (a: OnlineApplication) => ({
  id: a.id,
  application_number: a.applicationNumber,
  applicant_first_name: a.applicantFirstName,
  applicant_last_name: a.applicantLastName,
  gender: a.gender,
  dob: a.dob,
  applied_class: a.appliedClass,
  guardian_name: a.guardianName,
  guardian_email: a.guardianEmail,
  guardian_phone: a.guardianPhone,
  previous_school: a.previousSchool,
  submission_date: a.submissionDate,
  status: a.status,
  notes: a.notes ?? null,
});

const fromApplicationRow = (r: Record<string, any>): OnlineApplication => ({
  id: r.id,
  applicationNumber: r.application_number,
  applicantFirstName: r.applicant_first_name,
  applicantLastName: r.applicant_last_name,
  gender: r.gender,
  dob: r.dob,
  appliedClass: r.applied_class,
  guardianName: r.guardian_name,
  guardianEmail: r.guardian_email,
  guardianPhone: r.guardian_phone,
  previousSchool: r.previous_school,
  submissionDate: r.submission_date,
  status: r.status,
  notes: r.notes ?? undefined,
});

const toDownloadRow = (d: DownloadDocument) => ({
  id: d.id,
  title: d.title,
  category: d.category,
  file_type: d.fileType,
  file_size: d.fileSize,
  updated_date: d.updatedDate,
  url: d.url,
});

const fromDownloadRow = (r: Record<string, any>): DownloadDocument => ({
  id: r.id,
  title: r.title,
  category: r.category,
  fileType: r.file_type,
  fileSize: r.file_size,
  updatedDate: r.updated_date,
  url: r.url,
});

const toAnnouncementRow = (a: AnnouncementNotification) => ({
  id: a.id,
  title: a.title,
  message: a.message,
  sender: a.sender,
  target_audience: a.targetAudience ?? null,
  target_role: a.targetRole ?? null,
  priority: a.priority ?? null,
  date: a.date,
});

const fromAnnouncementRow = (r: Record<string, any>): AnnouncementNotification => ({
  id: r.id,
  title: r.title,
  message: r.message,
  sender: r.sender,
  targetAudience: r.target_audience ?? undefined,
  targetRole: r.target_role ?? undefined,
  priority: r.priority ?? undefined,
  date: r.date,
});

const fromFeeRecordRow = (r: Record<string, any>): FeeRecord => ({
  id: r.id,
  studentId: r.student_id,
  studentName: r.student_name,
  term: r.term,
  session: r.session,
  tuition: Number(r.tuition),
  developmentFee: Number(r.development_fee),
  ictFee: Number(r.ict_fee),
  uniformFee: Number(r.uniform_fee),
  total: Number(r.total),
  amountPaid: Number(r.amount_paid),
  balance: Number(r.balance),
  status: r.status,
  receiptNo: r.receipt_no,
});

async function safeSelect<T>(
  table: string,
  mapper: (row: Record<string, any>) => T
): Promise<T[] | undefined> {
  if (!supabase) return undefined;
  try {
    const { data, error } = await supabase.from(table).select('*');
    if (error) {
      console.warn(`[Supabase] Could not read table "${table}": ${error.message}`);
      return undefined;
    }
    if (!data || data.length === 0) {
      return undefined; // Preserve existing data; do not overwrite with empty
    }
    return data.map(mapper);
  } catch (err) {
    console.warn(`[Supabase] Read error on "${table}":`, err);
    return undefined;
  }
}

async function safeUpsert(table: string, payload: Record<string, any> | Record<string, any>[]): Promise<void> {
  if (!supabase) return;
  try {
    const { error } = await supabase.from(table).upsert(payload, { onConflict: 'id' });
    if (error) {
      console.warn(`[Supabase] Upsert error on "${table}": ${error.message}`);
    }
  } catch (err) {
    console.warn(`[Supabase] Upsert exception on "${table}":`, err);
  }
}

async function safeDeleteById(table: string, id: string): Promise<void> {
  if (!supabase) return;
  try {
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) {
      console.warn(`[Supabase] Delete error on "${table}": ${error.message}`);
    }
  } catch (err) {
    console.warn(`[Supabase] Delete exception on "${table}":`, err);
  }
}

async function safeDeleteByIds(table: string, ids: string[]): Promise<void> {
  if (!supabase || ids.length === 0) return;
  try {
    const { error } = await supabase.from(table).delete().in('id', ids);
    if (error) {
      console.warn(`[Supabase] Batch delete error on "${table}": ${error.message}`);
    }
  } catch (err) {
    console.warn(`[Supabase] Batch delete exception on "${table}":`, err);
  }
}

export const supabaseSchoolService = {
  isConfigured: () => isSupabaseConfigured,

  /**
   * Fetches existing records from Supabase tables without overwriting or seeding sample data.
   * Only tables that already contain data in Supabase will be returned in the snapshot.
   */
  async fetchPortalSnapshot(): Promise<SupabasePortalSnapshot> {
    if (!supabase) return {};

    const [
      settingsRows,
      students,
      teachers,
      parents,
      classes,
      subjects,
      scores,
      results,
      attendance,
      cbtExams,
      cbtAttempts,
      assignments,
      studyNotes,
      newsItems,
      galleryImages,
      applications,
      downloads,
      announcements,
      feeRecords,
    ] = await Promise.all([
      safeSelect('system_settings', fromSystemSettingsRow),
      safeSelect('students', fromStudentRow),
      safeSelect('teachers', fromTeacherRow),
      safeSelect('parents', fromParentRow),
      safeSelect('classes', fromClassRow),
      safeSelect('subjects', fromSubjectRow),
      safeSelect('scores', fromScoreRow),
      safeSelect('terminal_results', fromResultRow),
      safeSelect('attendance', fromAttendanceRow),
      safeSelect('cbt_exams', fromCBTExamRow),
      safeSelect('cbt_attempts', fromCBTAttemptRow),
      safeSelect('assignments', fromAssignmentRow),
      safeSelect('study_notes', fromStudyNoteRow),
      safeSelect('news_items', fromNewsRow),
      safeSelect('gallery_images', fromGalleryRow),
      safeSelect('online_applications', fromApplicationRow),
      safeSelect('download_documents', fromDownloadRow),
      safeSelect('announcements', fromAnnouncementRow),
      safeSelect('fee_records', fromFeeRecordRow),
    ]);

    return {
      systemSettings: settingsRows?.[0],
      students,
      teachers,
      parents,
      classes,
      subjects,
      scores,
      results,
      attendance,
      cbtExams,
      cbtAttempts,
      assignments,
      studyNotes,
      newsItems,
      galleryImages,
      applications,
      downloads,
      announcements,
      feeRecords,
    };
  },

  upsertSystemSettings: (settings: SystemSessionTerm) =>
    safeUpsert('system_settings', toSystemSettingsRow(settings)),

  upsertStudent: (student: Student) =>
    safeUpsert('students', toStudentRow(student)),

  upsertStudents: (students: Student[]) =>
    students.length > 0 ? safeUpsert('students', students.map(toStudentRow)) : Promise.resolve(),

  deleteStudent: (id: string) => safeDeleteById('students', id),

  upsertTeacher: (teacher: Teacher) =>
    safeUpsert('teachers', toTeacherRow(teacher)),

  deleteTeacher: (id: string) => safeDeleteById('teachers', id),

  upsertParent: (parent: Parent) =>
    safeUpsert('parents', toParentRow(parent)),

  upsertClass: (cls: SchoolClass) =>
    safeUpsert('classes', toClassRow(cls)),

  upsertSubject: (subject: Subject) =>
    safeUpsert('subjects', toSubjectRow(subject)),

  upsertScore: (score: ScoreRecord) =>
    safeUpsert('scores', toScoreRow(score)),

  upsertScores: (scores: ScoreRecord[]) =>
    scores.length > 0 ? safeUpsert('scores', scores.map(toScoreRow)) : Promise.resolve(),

  upsertResult: (result: TerminalResult) =>
    safeUpsert('terminal_results', toResultRow(result)),

  upsertAttendanceBatch: (records: AttendanceRecord[]) =>
    records.length > 0 ? safeUpsert('attendance', records.map(toAttendanceRow)) : Promise.resolve(),

  upsertCBTExam: (exam: CBTExam) =>
    safeUpsert('cbt_exams', toCBTExamRow(exam)),

  deleteCBTExam: async (id: string) => {
    await safeDeleteById('cbt_exams', id);
    if (supabase) {
      try {
        await supabase.from('cbt_attempts').delete().eq('exam_id', id);
      } catch (err) {
        console.warn('[Supabase] Delete related cbt_attempts warning:', err);
      }
    }
  },

  deleteMultipleCBTExams: async (ids: string[]) => {
    await safeDeleteByIds('cbt_exams', ids);
    if (supabase && ids.length > 0) {
      try {
        await supabase.from('cbt_attempts').delete().in('exam_id', ids);
      } catch (err) {
        console.warn('[Supabase] Batch delete related cbt_attempts warning:', err);
      }
    }
  },

  upsertCBTAttempt: (attempt: CBTAttempt) =>
    safeUpsert('cbt_attempts', toCBTAttemptRow(attempt)),

  deleteCBTAttempt: (id: string) => safeDeleteById('cbt_attempts', id),

  upsertAssignment: (assignment: Assignment) =>
    safeUpsert('assignments', toAssignmentRow(assignment)),

  deleteAssignment: (id: string) => safeDeleteById('assignments', id),

  upsertStudyNote: (note: StudyNote) =>
    safeUpsert('study_notes', toStudyNoteRow(note)),

  deleteStudyNote: (id: string) => safeDeleteById('study_notes', id),

  upsertNewsItem: (news: NewsItem) =>
    safeUpsert('news_items', toNewsRow(news)),

  upsertGalleryImage: (img: GalleryImage) =>
    safeUpsert('gallery_images', toGalleryRow(img)),

  upsertDownloadDocument: (doc: DownloadDocument) =>
    safeUpsert('download_documents', toDownloadRow(doc)),

  upsertApplication: (app: OnlineApplication) =>
    safeUpsert('online_applications', toApplicationRow(app)),

  upsertAnnouncement: (ann: AnnouncementNotification) =>
    safeUpsert('announcements', toAnnouncementRow(ann)),
};
