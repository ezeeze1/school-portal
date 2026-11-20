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
  CBTStartResponse,
  CBTSubmissionResponse,
  Assignment,
  AssignmentSubmission,
  StudyNote,
  NewsItem,
  GalleryImage,
  OnlineApplication,
  DownloadDocument,
  AnnouncementNotification,
  FeeRecord,
  SystemSessionTerm,
  UserProfile,
  UserRole,
  AccountProvisioningStatus,
  AccountStatusSummary,
  PortalAccountRole,
  ProvisionAccountRequest,
  ProvisionAccountResult,
} from '../types';
import {
  ClassDependencyCounts,
  formatClassDependencyError,
  formatSupabaseClassError,
  sortSchoolClasses,
} from '../lib/classManagement';
import {
  formatRecordPersistenceError,
  isInternalStudentAuthEmail,
  makeAccountStatusKey,
} from '../lib/accountProvisioning';

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
  assignmentSubmissions?: AssignmentSubmission[];
  studyNotes?: StudyNote[];
  newsItems?: NewsItem[];
  galleryImages?: GalleryImage[];
  applications?: OnlineApplication[];
  downloads?: DownloadDocument[];
  announcements?: AnnouncementNotification[];
  feeRecords?: FeeRecord[];
}

// Generic safe row mapper helpers
const sanitizeTeacherId = (teacherId?: string | null): string | null => {
  if (!teacherId) return null;
  const trimmed = teacherId.trim();
  if (!trimmed || trimmed === 'usr-admin' || trimmed.startsWith('u-admin')) {
    return null;
  }
  return trimmed;
};

const toSystemSettingsRow = (s: SystemSessionTerm) => ({
  id: 'default',
  current_session: s.currentSession,
  academic_sessions: s.academicSessions ?? [],
  current_term: s.currentTerm,
  is_result_published: s.isResultPublished ?? false,
  result_entry_open: s.resultEntryOpen,
  cbt_active: s.cbtActive,
  cbt_allow_answer_review: s.cbtAllowAnswerReview ?? false,
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
  resultEntryOpen: Boolean(r.result_entry_open ?? false),
  cbtActive: Boolean(r.cbt_active ?? true),
  cbtAllowAnswerReview: Boolean(r.cbt_allow_answer_review ?? false),
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

// Never write plaintext passwords, result_passcode, or internal synthetic auth emails to public.students
const toStudentRow = (s: Student) => ({
  id: s.id,
  auth_user_id: s.authUserId ?? null,
  admission_no: s.admissionNo,
  first_name: s.firstName,
  last_name: s.lastName,
  other_names: s.otherNames ?? null,
  email: s.email && !isInternalStudentAuthEmail(s.email) ? s.email : null,
  gender: s.gender,
  dob: s.dob,
  class_id: s.classId,
  class_name: s.className,
  arm: s.arm ?? null,
  house: s.house ?? null,
  parent_name: s.parentName,
  parent_phone: s.parentPhone,
  parent_email: s.parentEmail ?? null,
  address: s.address,
  avatar: s.avatar,
  status: s.status,
});

const fromStudentRow = (r: Record<string, any>): Student => ({
  id: r.id,
  authUserId: r.auth_user_id ?? undefined,
  admissionNo: r.admission_no,
  firstName: r.first_name,
  lastName: r.last_name,
  otherNames: r.other_names ?? undefined,
  email: r.email && !isInternalStudentAuthEmail(r.email) ? r.email : undefined,
  gender: r.gender,
  dob: r.dob,
  classId: r.class_id,
  className: r.class_name,
  arm: r.arm ?? undefined,
  house: r.house ?? undefined,
  parentName: r.parent_name,
  parentPhone: r.parent_phone,
  parentEmail: r.parent_email ?? undefined,
  address: r.address,
  avatar: r.avatar,
  status: r.status,
});

// Never write plaintext passwords to public.teachers
const toTeacherRow = (t: Teacher) => ({
  id: t.id,
  auth_user_id: t.authUserId ?? null,
  staff_id: t.staffId,
  first_name: t.firstName,
  last_name: t.lastName,
  qualification: t.qualification ?? null,
  email: t.email,
  phone: t.phone,
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
  authUserId: r.auth_user_id ?? undefined,
  staffId: r.staff_id,
  firstName: r.first_name,
  lastName: r.last_name,
  qualification: r.qualification ?? undefined,
  email: r.email,
  phone: r.phone,
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
  auth_user_id: p.authUserId ?? null,
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
  authUserId: r.auth_user_id ?? undefined,
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
  name: c.name.trim(),
  category: c.category,
  arms: Array.isArray(c.arms) ? c.arms : [],
  class_teacher_id: c.classTeacherId?.trim() || null,
  capacity: Number(c.capacity),
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
  teacher_id: sanitizeTeacherId(s.teacherId),
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
  teacherId: r.teacher_id ?? undefined,
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
  teacher_id: sanitizeTeacherId(e.teacherId),
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
  allow_answer_review: e.allowAnswerReview ?? null,
});

const fromCBTExamRow = (r: Record<string, any>): CBTExam => ({
  id: r.id,
  title: r.title,
  subjectId: r.subject_id,
  subjectName: r.subject_name,
  classId: r.class_id,
  className: r.class_name,
  teacherId: r.teacher_id ?? undefined,
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
  allowAnswerReview:
    typeof r.allow_answer_review === 'boolean' ? r.allow_answer_review : undefined,
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
  teacher_id: sanitizeTeacherId(a.teacherId),
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
  teacherId: r.teacher_id ?? undefined,
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

const toAssignmentSubmissionInsertRow = (s: AssignmentSubmission) => ({
  id: s.id,
  assignment_id: s.assignmentId,
  student_id: s.studentId,
  student_name: s.studentName,
  submission_date: s.submissionDate,
  content: s.content,
  file_url: s.fileUrl ?? null,
  grade: null,
  feedback: null,
});

const fromAssignmentSubmissionRow = (r: Record<string, any>): AssignmentSubmission => ({
  id: r.id,
  assignmentId: r.assignment_id,
  studentId: r.student_id,
  studentName: r.student_name,
  submissionDate: r.submission_date,
  content: r.content ?? '',
  fileUrl: r.file_url ?? undefined,
  grade: r.grade != null ? Number(r.grade) : undefined,
  feedback: r.feedback ?? undefined,
});

const toStudyNoteRow = (n: StudyNote) => ({
  id: n.id,
  title: n.title,
  subject_id: n.subjectId ?? null,
  subject_name: n.subjectName,
  class_id: n.classId && n.classId !== 'all' ? n.classId : null,
  class_name: n.className,
  teacher_id: sanitizeTeacherId(n.teacherId),
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
  classId: r.class_id ?? 'all',
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
  target_audience: a.targetAudience ?? a.targetRole ?? 'All',
  target_role: a.targetRole ?? a.targetAudience ?? 'All',
  priority: a.priority ?? 'Normal',
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

const toFeeRecordRow = (f: FeeRecord) => ({
  id: f.id,
  student_id: f.studentId,
  student_name: f.studentName,
  term: f.term,
  session: f.session,
  tuition: f.tuition,
  development_fee: f.developmentFee,
  ict_fee: f.ictFee,
  uniform_fee: f.uniformFee,
  total: f.total,
  amount_paid: f.amountPaid,
  balance: f.balance,
  status: f.status,
  receipt_no: f.receiptNo,
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
  mapper: (row: Record<string, any>) => T,
  options?: { allowEmpty?: boolean }
): Promise<T[] | undefined> {
  if (!supabase) return undefined;
  try {
    const { data, error } = await supabase.from(table).select('*');
    if (error) {
      console.warn(`[Supabase] Could not read "${table}": ${error.message}`);
      return undefined;
    }
    if (!data) return undefined;
    if (data.length === 0 && !options?.allowEmpty) {
      return undefined;
    }
    return data.map(mapper);
  } catch (err) {
    console.warn(`[Supabase] Read error on "${table}":`, err);
    return undefined;
  }
}

async function safeUpsert(
  table: string,
  payload: Record<string, any> | Record<string, any>[],
  onConflict = 'id'
): Promise<{ ok: boolean; error?: string }> {
  if (!supabase) return { ok: false, error: 'Supabase not configured' };
  try {
    const { error } = await supabase.from(table).upsert(payload, { onConflict });
    if (error) {
      console.warn(`[Supabase] Upsert error on "${table}": ${error.message}`);
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.warn(`[Supabase] Upsert exception on "${table}":`, err);
    return { ok: false, error: msg };
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

interface EdgeInvokeResponse {
  ok: boolean;
  data?: Record<string, unknown>;
  error?: string;
  code?: string;
  edgeFunctionUnavailable?: boolean;
}

async function invokeAdminProvisioningFunction(
  payload: Record<string, unknown>
): Promise<EdgeInvokeResponse> {
  if (!supabase) {
    return {
      ok: false,
      code: 'not_configured',
      error: 'Supabase is not configured.',
      edgeFunctionUnavailable: true,
    };
  }

  const {
    data: { session },
    error: sessionErr,
  } = await supabase.auth.getSession();

  if (sessionErr || !session?.access_token) {
    return {
      ok: false,
      code: 'missing_auth',
      error: 'Your administrator session is missing or expired. Please sign in again.',
    };
  }

  try {
    const { data, error } = await supabase.functions.invoke('admin-account-provisioning', {
      body: payload,
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    if (error) {
      const errObj = error as unknown as {
        name?: string;
        message?: string;
        context?: Response;
      };
      let parsedBody: Record<string, unknown> | null = null;
      let statusCode: number | undefined;

      if (errObj.context && typeof errObj.context.json === 'function') {
        statusCode = errObj.context.status;
        try {
          const json = await errObj.context.clone().json();
          if (json && typeof json === 'object') {
            parsedBody = json as Record<string, unknown>;
          }
        } catch {
          // Response was not JSON (e.g. gateway 404 when function is not deployed)
        }
      }

      if (parsedBody && typeof parsedBody.error === 'string') {
        return {
          ok: false,
          code: typeof parsedBody.code === 'string' ? parsedBody.code : undefined,
          error: parsedBody.error,
        };
      }

      if (parsedBody && typeof parsedBody.message === 'string' && statusCode !== 404) {
        return {
          ok: false,
          code: typeof parsedBody.code === 'string' ? parsedBody.code : 'gateway_error',
          error: parsedBody.message,
        };
      }

      const rawMessage = errObj.message || 'Could not reach account provisioning function.';
      const isUnavailable =
        errObj.name === 'FunctionsFetchError' ||
        errObj.name === 'FunctionsRelayError' ||
        statusCode === 404 ||
        /failed to send a request|failed to fetch|not found|404/i.test(rawMessage);

      return {
        ok: false,
        code: isUnavailable ? 'edge_function_unavailable' : 'edge_function_error',
        edgeFunctionUnavailable: isUnavailable,
        error: isUnavailable
          ? 'The server-side account provisioning Edge Function ("admin-account-provisioning") is not deployed or unreachable on Supabase yet. Deploy supabase/functions/admin-account-provisioning before provisioning login accounts.'
          : rawMessage,
      };
    }

    if (data && typeof data === 'object' && (data as Record<string, unknown>).ok === false) {
      const bodyObj = data as Record<string, unknown>;
      return {
        ok: false,
        code: typeof bodyObj.code === 'string' ? bodyObj.code : undefined,
        error:
          typeof bodyObj.error === 'string'
            ? bodyObj.error
            : 'Account provisioning request was rejected.',
      };
    }

    return {
      ok: true,
      data: (data && typeof data === 'object' ? data : {}) as Record<string, unknown>,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Network error reaching Edge Function.';
    return {
      ok: false,
      code: 'edge_function_unavailable',
      edgeFunctionUnavailable: true,
      error: `Could not reach the server-side account provisioning Edge Function ("admin-account-provisioning"): ${msg}`,
    };
  }
}

export const supabaseSchoolService = {
  isConfigured: () => isSupabaseConfigured,

  /**
   * Resolves and auto-links the current authenticated Supabase user to their
   * active role profile (`admin`, `teacher`, `parent`, `student`) on the server.
   * Never creates or elevates an `admin` role.
   */
  async syncMyUserProfile(): Promise<{ profile: UserProfile | null; error?: string }> {
    if (!supabase) return { profile: null, error: 'Supabase is not configured.' };
    try {
      const { data, error } = await supabase.rpc('sync_my_user_profile');
      if (error) {
        return { profile: null, error: error.message };
      }
      const row = Array.isArray(data) ? data[0] : data;
      if (!row || !row.auth_user_id || !row.role) {
        return { profile: null };
      }
      const profile: UserProfile = {
        authUserId: row.auth_user_id,
        role: row.role,
        referenceId: row.reference_id ?? undefined,
        email: row.email ?? '',
        fullName: row.full_name ?? undefined,
        isActive: Boolean(row.is_active),
      };

      // Enrich with server-side must_change_password & account_status if optional migration is applied
      const securityState = await this.getMyAccountSecurityState();
      if (securityState) {
        profile.mustChangePassword = securityState.mustChangePassword;
        profile.accountStatus = securityState.accountStatus;
      }

      return { profile };
    } catch (err) {
      return {
        profile: null,
        error: err instanceof Error ? err.message : 'Unable to resolve user profile.',
      };
    }
  },

  async getMyAccountSecurityState(): Promise<{
    accountStatus?: Exclude<AccountProvisioningStatus, 'not_created'>;
    mustChangePassword: boolean;
    isActive: boolean;
  } | null> {
    if (!supabase) return null;
    try {
      const { data, error } = await supabase.rpc('get_my_account_security_state');
      if (error) {
        // Optional migration may not be applied yet; caller falls back to Supabase Auth user_metadata
        return null;
      }
      const row = Array.isArray(data) ? data[0] : data;
      if (!row) return null;
      const rawStatus = row.out_account_status;
      const accountStatus: Exclude<AccountProvisioningStatus, 'not_created'> | undefined =
        rawStatus === 'invitation_pending' || rawStatus === 'active' || rawStatus === 'disabled'
          ? rawStatus
          : undefined;
      return {
        accountStatus,
        mustChangePassword: Boolean(row.out_must_change_password),
        isActive: Boolean(row.out_is_active),
      };
    } catch {
      return null;
    }
  },

  async completeMyPasswordSetup(): Promise<{ ok: boolean }> {
    if (!supabase) return { ok: false };
    try {
      const { error } = await supabase.rpc('complete_my_password_setup');
      if (error) {
        // Ignore if optional migration RPC is not installed; Auth user_metadata was already cleared
        return { ok: false };
      }
      return { ok: true };
    } catch {
      return { ok: false };
    }
  },

  /**
   * Safe unauthenticated (`anon`) snapshot reading ONLY public views/tables.
   */
  async fetchPublicSnapshot(): Promise<SupabasePortalSnapshot> {
    if (!supabase) return {};

    const [settingsRows, newsItems, galleryImages, downloads, announcements] = await Promise.all([
      safeSelect('public_site_settings', fromSystemSettingsRow),
      safeSelect('news_items', fromNewsRow),
      safeSelect('gallery_images', fromGalleryRow),
      safeSelect('download_documents', fromDownloadRow),
      safeSelect('announcements', fromAnnouncementRow),
    ]);

    return {
      systemSettings: settingsRows?.[0],
      newsItems,
      galleryImages,
      downloads,
      announcements,
    };
  },

  /**
   * Role-scoped snapshot for authenticated users.
   * Reads `students_safe` and `teachers_safe` (excluding protected credential columns).
   * Students receive sanitized CBT summaries via `get_student_cbt_exams()` RPC (no answer keys).
   */
  async fetchPortalSnapshot(role: UserRole = 'public'): Promise<SupabasePortalSnapshot> {
    if (!supabase) return {};
    if (role === 'public') {
      return this.fetchPublicSnapshot();
    }

    const isAdmin = role === 'admin';
    const isTeacher = role === 'teacher';
    const isStudent = role === 'student';

    const [
      settingsRows,
      studentsRaw,
      passcodeRows,
      teachers,
      parentsRaw,
      parentStudentLinks,
      classes,
      subjects,
      scores,
      results,
      attendance,
      cbtExams,
      cbtAttempts,
      assignments,
      assignmentSubmissions,
      studyNotes,
      newsItems,
      galleryImages,
      applications,
      downloads,
      announcements,
      feeRecords,
    ] = await Promise.all([
      safeSelect('system_settings', fromSystemSettingsRow),
      safeSelect('students_safe', fromStudentRow, { allowEmpty: true }),
      isAdmin
        ? safeSelect<{ studentId: string; resultPasscode: string }>(
            'student_result_passcodes',
            (r) => ({ studentId: r.student_id as string, resultPasscode: r.result_passcode as string }),
            { allowEmpty: true }
          )
        : Promise.resolve(undefined as { studentId: string; resultPasscode: string }[] | undefined),
      safeSelect('teachers_safe', fromTeacherRow, { allowEmpty: true }),
      safeSelect('parents', fromParentRow, { allowEmpty: true }),
      isAdmin || role === 'parent'
        ? safeSelect<{ parentId: string; studentId: string }>(
            'parent_students',
            (r) => ({ parentId: r.parent_id as string, studentId: r.student_id as string }),
            { allowEmpty: true }
          )
        : Promise.resolve(undefined as { parentId: string; studentId: string }[] | undefined),
      safeSelect('classes', fromClassRow, { allowEmpty: true }),
      safeSelect('subjects', fromSubjectRow, { allowEmpty: true }),
      safeSelect('scores', fromScoreRow, { allowEmpty: true }),
      safeSelect('terminal_results', fromResultRow, { allowEmpty: true }),
      safeSelect('attendance', fromAttendanceRow, { allowEmpty: true }),
      isStudent
        ? this.getStudentCBTExams()
        : isAdmin || isTeacher
          ? safeSelect('cbt_exams', fromCBTExamRow, { allowEmpty: true })
          : Promise.resolve(undefined),
      safeSelect('cbt_attempts', fromCBTAttemptRow, { allowEmpty: true }),
      safeSelect('assignments', fromAssignmentRow, { allowEmpty: true }),
      safeSelect('assignment_submissions', fromAssignmentSubmissionRow, { allowEmpty: true }),
      safeSelect('study_notes', fromStudyNoteRow, { allowEmpty: true }),
      safeSelect('news_items', fromNewsRow),
      safeSelect('gallery_images', fromGalleryRow),
      isAdmin
        ? safeSelect('online_applications', fromApplicationRow, { allowEmpty: true })
        : Promise.resolve(undefined),
      safeSelect('download_documents', fromDownloadRow),
      safeSelect('announcements', fromAnnouncementRow),
      safeSelect('fee_records', fromFeeRecordRow, { allowEmpty: true }),
    ]);

    let students = studentsRaw;
    if (isAdmin && students && passcodeRows) {
      const codeMap = new Map<string, string>(
        passcodeRows.map((p) => [p.studentId, p.resultPasscode])
      );
      students = students.map((s) => ({
        ...s,
        resultPasscode: codeMap.get(s.id) ?? s.resultPasscode,
      }));
    }

    // Align parent.studentIds with authoritative public.parent_students junction table
    let parents = parentsRaw;
    if (parents && parentStudentLinks) {
      const linksByParent = new Map<string, string[]>();
      for (const link of parentStudentLinks) {
        const list = linksByParent.get(link.parentId) ?? [];
        if (!list.includes(link.studentId)) {
          list.push(link.studentId);
        }
        linksByParent.set(link.parentId, list);
      }
      parents = parents.map((p) => ({
        ...p,
        studentIds: linksByParent.get(p.id) ?? [],
      }));
    }

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
      assignmentSubmissions,
      studyNotes,
      newsItems,
      galleryImages,
      applications,
      downloads,
      announcements,
      feeRecords,
    };
  },

  // Server-side RPCs (Priority 4)
  async verifyStudentResultPasscode(studentId: string, passcode: string): Promise<boolean> {
    if (!supabase) return false;
    try {
      const { data, error } = await supabase.rpc('verify_student_result_passcode', {
        p_student_id: studentId,
        p_passcode: passcode,
      });
      if (error) {
        console.warn('[Supabase] Passcode verification failed:', error.message);
        return false;
      }
      return Boolean(data);
    } catch (err) {
      console.warn('[Supabase] Passcode verification error:', err);
      return false;
    }
  },

  async getStudentCBTExams(): Promise<CBTExam[] | undefined> {
    if (!supabase) return undefined;
    try {
      const { data, error } = await supabase.rpc('get_student_cbt_exams');
      if (error) {
        console.warn('[Supabase] Could not load student CBT exams:', error.message);
        return undefined;
      }
      if (!Array.isArray(data)) return [];
      return data as CBTExam[];
    } catch (err) {
      console.warn('[Supabase] get_student_cbt_exams error:', err);
      return undefined;
    }
  },

  async startCBTExam(examId: string): Promise<CBTStartResponse> {
    if (!supabase) {
      throw new Error('Supabase client is not initialized.');
    }
    const { data, error } = await supabase.rpc('start_cbt_exam', {
      p_exam_id: examId,
    });
    if (error) {
      throw new Error(error.message || 'Unable to start CBT exam session.');
    }
    return data as CBTStartResponse;
  },

  async saveCBTExamAnswers(
    examId: string,
    answers: Record<string, string>
  ): Promise<{ ok: boolean; savedAnswers?: Record<string, string>; error?: string }> {
    if (!supabase) {
      return { ok: false, error: 'Supabase client is not initialized.' };
    }
    try {
      const { data, error } = await supabase.rpc('save_cbt_exam_answers', {
        p_exam_id: examId,
        p_answers: answers,
      });
      if (error) {
        return { ok: false, error: error.message || 'Unable to save CBT draft answers.' };
      }
      return {
        ok: true,
        savedAnswers: (data as { savedAnswers?: Record<string, string> } | null)?.savedAnswers,
      };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'Unable to save CBT draft answers.',
      };
    }
  },

  async submitCBTExam(
    examId: string,
    answers: Record<string, string>
  ): Promise<CBTSubmissionResponse> {
    if (!supabase) {
      throw new Error('Supabase client is not initialized.');
    }
    const { data, error } = await supabase.rpc('submit_cbt_exam', {
      p_exam_id: examId,
      p_answers: answers,
    });
    if (error) {
      throw new Error(error.message || 'Unable to submit CBT exam.');
    }
    return data as CBTSubmissionResponse;
  },

  async getCBTActiveSessionExamIds(): Promise<string[]> {
    if (!supabase) return [];
    try {
      const { data, error } = await supabase.rpc('get_cbt_active_session_exam_ids');
      if (error || !Array.isArray(data)) return [];
      return data.filter((id): id is string => typeof id === 'string');
    } catch {
      return [];
    }
  },

  // Admin-only result passcode persistence
  upsertStudentResultPasscode: (studentId: string, resultPasscode: string) =>
    safeUpsert(
      'student_result_passcodes',
      { student_id: studentId, result_passcode: resultPasscode },
      'student_id'
    ),

  upsertStudentResultPasscodesBulk: (entries: { studentId: string; resultPasscode: string }[]) =>
    entries.length > 0
      ? safeUpsert(
          'student_result_passcodes',
          entries.map((e) => ({ student_id: e.studentId, result_passcode: e.resultPasscode })),
          'student_id'
        )
      : Promise.resolve({ ok: true }),

  upsertSystemSettings: (settings: SystemSessionTerm) =>
    safeUpsert('system_settings', toSystemSettingsRow(settings)),

  // ---------------------------------------------------------------------------
  // Server-Side Account Provisioning & Authoritative Status (Admin Only)
  // ---------------------------------------------------------------------------
  async fetchAccountStatuses(): Promise<{
    ok: boolean;
    statuses: Record<string, AccountStatusSummary>;
    edgeFunctionAvailable: boolean;
    warning?: string;
    error?: string;
  }> {
    if (!supabase) {
      return {
        ok: false,
        statuses: {},
        edgeFunctionAvailable: false,
        error: 'Supabase is not configured.',
      };
    }

    // 1. Primary authoritative source: deployed Edge Function inspecting auth.users + user_profiles
    const edgeRes = await invokeAdminProvisioningFunction({ action: 'list_statuses' });
    if (edgeRes.ok && Array.isArray(edgeRes.data?.statuses)) {
      const map: Record<string, AccountStatusSummary> = {};
      for (const raw of edgeRes.data.statuses as AccountStatusSummary[]) {
        if (raw && raw.role && raw.recordId) {
          map[makeAccountStatusKey(raw.role, raw.recordId)] = {
            ...raw,
            source: 'edge_function',
          };
        }
      }
      return {
        ok: true,
        statuses: map,
        edgeFunctionAvailable: true,
      };
    }

    // 2. Authoritative database fallback if Edge Function is not deployed yet:
    //    First try get_admin_account_statuses() RPC (reads auth.users + user_profiles),
    //    then fall back to admin-readable public.user_profiles.
    const fallbackMap: Record<string, AccountStatusSummary> = {};
    try {
      const { data: rpcRows, error: rpcErr } = await supabase.rpc('get_admin_account_statuses');
      if (!rpcErr && Array.isArray(rpcRows)) {
        for (const r of rpcRows as Record<string, any>[]) {
          const role = r.out_role as PortalAccountRole;
          const recordId = r.out_reference_id as string | null;
          if (!recordId || (role !== 'student' && role !== 'teacher' && role !== 'parent')) continue;
          const statusVal: AccountProvisioningStatus =
            r.out_account_status === 'disabled'
              ? 'disabled'
              : r.out_account_status === 'invitation_pending'
                ? 'invitation_pending'
                : 'active';
          fallbackMap[makeAccountStatusKey(role, recordId)] = {
            role,
            recordId,
            authUserId: r.out_auth_user_id ?? undefined,
            email:
              r.out_email && !(role === 'student' && isInternalStudentAuthEmail(r.out_email))
                ? r.out_email
                : undefined,
            status: statusVal,
            mustChangePassword: Boolean(r.out_must_change_password),
            invitedAt: r.out_invited_at ?? undefined,
            lastSignInAt: r.out_last_sign_in_at ?? undefined,
            source: 'rpc',
          };
        }

        return {
          ok: true,
          statuses: fallbackMap,
          edgeFunctionAvailable: false,
          warning: edgeRes.error,
        };
      }

      const { data: profileRows, error: profileErr } = await supabase
        .from('user_profiles')
        .select('auth_user_id, role, reference_id, email, is_active')
        .in('role', ['student', 'teacher', 'parent']);

      if (!profileErr && Array.isArray(profileRows)) {
        for (const r of profileRows as Record<string, any>[]) {
          const role = r.role as PortalAccountRole;
          const recordId = r.reference_id as string | null;
          if (!recordId || (role !== 'student' && role !== 'teacher' && role !== 'parent')) continue;
          fallbackMap[makeAccountStatusKey(role, recordId)] = {
            role,
            recordId,
            authUserId: r.auth_user_id ?? undefined,
            email:
              r.email && !(role === 'student' && isInternalStudentAuthEmail(r.email))
                ? r.email
                : undefined,
            status: r.is_active ? 'active' : 'disabled',
            mustChangePassword: false,
            source: 'profiles_table',
          };
        }
        return {
          ok: true,
          statuses: fallbackMap,
          edgeFunctionAvailable: false,
          warning: edgeRes.error,
        };
      }
    } catch (err) {
      console.warn('[Supabase] Fallback account status query failed:', err);
    }

    return {
      ok: false,
      statuses: {},
      edgeFunctionAvailable: !edgeRes.edgeFunctionUnavailable,
      error: edgeRes.error || 'Could not retrieve authoritative account statuses from Supabase.',
    };
  },

  async provisionPortalAccount(req: ProvisionAccountRequest): Promise<ProvisionAccountResult> {
    const res = await invokeAdminProvisioningFunction({
      action: 'provision_account',
      role: req.role,
      recordId: req.recordId,
      mode: req.mode,
      ...(req.email ? { email: req.email } : {}),
      ...(req.password ? { password: req.password } : {}),
      ...(typeof req.mustChangePassword === 'boolean'
        ? { mustChangePassword: req.mustChangePassword }
        : {}),
      ...(req.redirectTo ? { redirectTo: req.redirectTo } : {}),
    });

    if (!res.ok) {
      return {
        ok: false,
        code: res.code,
        error: res.error || 'Account provisioning failed.',
      };
    }

    const d = res.data ?? {};
    const safeEmail =
      typeof d.email === 'string' && !isInternalStudentAuthEmail(d.email) ? d.email : undefined;
    return {
      ok: true,
      status: d.status as AccountProvisioningStatus | undefined,
      authUserId: typeof d.authUserId === 'string' ? d.authUserId : undefined,
      email: safeEmail,
      loginIdentifier:
        typeof d.loginIdentifier === 'string' ? d.loginIdentifier : safeEmail,
      mode: (d.mode as ProvisionAccountRequest['mode']) ?? req.mode,
      recoveredPartialAccount: Boolean(d.recoveredPartialAccount),
      message: typeof d.message === 'string' ? d.message : undefined,
    };
  },

  async resendPortalAccountInvite(
    role: PortalAccountRole,
    recordId: string,
    redirectTo?: string
  ): Promise<ProvisionAccountResult> {
    const res = await invokeAdminProvisioningFunction({
      action: 'resend_invite',
      role,
      recordId,
      ...(redirectTo ? { redirectTo } : {}),
    });
    if (!res.ok) {
      return { ok: false, code: res.code, error: res.error || 'Could not resend invitation.' };
    }
    const d = res.data ?? {};
    return {
      ok: true,
      status: d.status as AccountProvisioningStatus | undefined,
      authUserId: typeof d.authUserId === 'string' ? d.authUserId : undefined,
      email: typeof d.email === 'string' ? d.email : undefined,
      message: typeof d.message === 'string' ? d.message : undefined,
    };
  },

  /**
   * Allows an authenticated administrator to assign a new password for an existing
   * student, teacher, or parent account without ever returning or storing the password.
   */
  async assignPortalAccountPassword(
    role: PortalAccountRole,
    recordId: string,
    password: string,
    mustChangePassword?: boolean
  ): Promise<ProvisionAccountResult> {
    const res = await invokeAdminProvisioningFunction({
      action: 'assign_password',
      role,
      recordId,
      password,
      ...(typeof mustChangePassword === 'boolean' ? { mustChangePassword } : {}),
    });
    if (!res.ok) {
      return {
        ok: false,
        code: res.code,
        error: res.error || 'Could not assign a new password for this account.',
      };
    }
    const d = res.data ?? {};
    const safeEmail =
      typeof d.email === 'string' && !isInternalStudentAuthEmail(d.email) ? d.email : undefined;
    return {
      ok: true,
      status: d.status as AccountProvisioningStatus | undefined,
      authUserId: typeof d.authUserId === 'string' ? d.authUserId : undefined,
      email: safeEmail,
      loginIdentifier:
        typeof d.loginIdentifier === 'string' ? d.loginIdentifier : safeEmail,
      message: typeof d.message === 'string' ? d.message : undefined,
    };
  },

  async setPortalAccountEnabled(
    role: PortalAccountRole,
    recordId: string,
    enabled: boolean
  ): Promise<ProvisionAccountResult> {
    const res = await invokeAdminProvisioningFunction({
      action: 'set_account_status',
      role,
      recordId,
      enabled,
    });
    if (!res.ok) {
      return {
        ok: false,
        code: res.code,
        error: res.error || 'Could not update account status.',
      };
    }
    const d = res.data ?? {};
    return {
      ok: true,
      status: d.status as AccountProvisioningStatus | undefined,
      authUserId: typeof d.authUserId === 'string' ? d.authUserId : undefined,
      email:
        typeof d.email === 'string' && !isInternalStudentAuthEmail(d.email) ? d.email : undefined,
      loginIdentifier: typeof d.loginIdentifier === 'string' ? d.loginIdentifier : undefined,
      message: typeof d.message === 'string' ? d.message : undefined,
    };
  },

  /**
   * Authenticates a student via Admission Number + Password through the dedicated
   * server-side Edge Function (`student-auth-login`), returning short-lived Supabase
   * session tokens without exposing student records or internal auth mappings publicly.
   */
  async authenticateStudentByAdmissionNo(
    admissionNo: string,
    password: string
  ): Promise<{
    ok: boolean;
    session?: {
      access_token: string;
      refresh_token: string;
      expires_at?: number;
      expires_in?: number;
      token_type?: string;
    };
    error?: string;
    code?: string;
    retryAfterSeconds?: number;
  }> {
    if (!supabase) {
      return {
        ok: false,
        code: 'not_configured',
        error: 'Supabase authentication is not configured.',
      };
    }

    try {
      const { data, error, response } = await supabase.functions.invoke('student-auth-login', {
        method: 'POST',
        body: { admissionNo, password },
      });

      if (error) {
        const errObj = error as unknown as {
          name?: string;
          message?: string;
          context?: Response;
        };
        const responseObj = response ?? errObj.context;
        let parsedBody: Record<string, unknown> | null = null;
        let statusCode: number | undefined = responseObj?.status;

        if (responseObj && typeof responseObj.json === 'function') {
          try {
            const json = await responseObj.clone().json();
            if (json && typeof json === 'object') {
              parsedBody = json as Record<string, unknown>;
            }
          } catch {
            // Non-JSON response (e.g. gateway 404/503)
          }
        }

        const bodyCode =
          typeof parsedBody?.code === 'string'
            ? parsedBody.code
            : typeof parsedBody?.code === 'number'
              ? String(parsedBody.code)
              : undefined;
        const bodyError = typeof parsedBody?.error === 'string' ? parsedBody.error : undefined;
        const gatewayMessage =
          typeof parsedBody?.message === 'string' ? parsedBody.message : undefined;

        const isWrongFunctionAuthRejection =
          statusCode === 401 &&
          (bodyCode === 'missing_auth' ||
            (bodyError !== undefined && /missing or invalid authorization header/i.test(bodyError)));
        const isGatewayAuthRejection =
          statusCode === 401 &&
          gatewayMessage !== undefined &&
          /missing authorization header|invalid jwt/i.test(gatewayMessage);

        if (import.meta.env.DEV) {
          console.warn('[student-auth-login][dev]', {
            status: statusCode ?? null,
            errorName: errObj.name ?? null,
            code: bodyCode ?? null,
            gatewayMessage: gatewayMessage ?? null,
            hint: isWrongFunctionAuthRejection
              ? 'Endpoint returned missing_auth: verify supabase/functions/student-auth-login/index.ts (not admin-account-provisioning) is deployed to the student-auth-login slug.'
              : isGatewayAuthRejection
                ? 'Supabase gateway rejected unauthenticated POST: disable JWT verification on student-auth-login.'
                : undefined,
          });
        }

        if (isWrongFunctionAuthRejection || isGatewayAuthRejection) {
          return {
            ok: false,
            code: 'service_misconfigured',
            error:
              'Student sign-in service is temporarily unavailable due to a server configuration error. Please contact the school administrator.',
          };
        }

        if (bodyError) {
          return {
            ok: false,
            code: bodyCode,
            error: bodyError,
            retryAfterSeconds:
              typeof parsedBody?.retryAfterSeconds === 'number'
                ? parsedBody.retryAfterSeconds
                : undefined,
          };
        }

        if (statusCode === 503) {
          return {
            ok: false,
            code: 'service_unavailable',
            error: 'Student sign-in service is temporarily unavailable. Please try again later.',
          };
        }

        const rawMessage = errObj.message || 'Unable to sign in right now.';
        const isUnavailable =
          errObj.name === 'FunctionsFetchError' ||
          errObj.name === 'FunctionsRelayError' ||
          statusCode === 404 ||
          /failed to send a request|failed to fetch|not found|404/i.test(rawMessage);

        return {
          ok: false,
          code: isUnavailable ? 'edge_function_unavailable' : 'auth_error',
          error: isUnavailable
            ? 'Student Admission Number sign-in service ("student-auth-login") is not deployed on Supabase yet. Deploy supabase/functions/student-auth-login with --no-verify-jwt.'
            : 'Invalid admission number or password.',
        };
      }

      const payload = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
      if (payload.ok === false) {
        return {
          ok: false,
          code: typeof payload.code === 'string' ? payload.code : 'invalid_credentials',
          error:
            typeof payload.error === 'string'
              ? payload.error
              : 'Invalid admission number or password.',
          retryAfterSeconds:
            typeof payload.retryAfterSeconds === 'number' ? payload.retryAfterSeconds : undefined,
        };
      }

      const sessionObj = payload.session as Record<string, unknown> | undefined;
      if (
        !sessionObj ||
        typeof sessionObj.access_token !== 'string' ||
        typeof sessionObj.refresh_token !== 'string'
      ) {
        return {
          ok: false,
          code: 'invalid_response',
          error: 'Student authentication succeeded but no valid session was returned.',
        };
      }

      return {
        ok: true,
        session: {
          access_token: sessionObj.access_token,
          refresh_token: sessionObj.refresh_token,
          expires_at:
            typeof sessionObj.expires_at === 'number' ? sessionObj.expires_at : undefined,
          expires_in:
            typeof sessionObj.expires_in === 'number' ? sessionObj.expires_in : undefined,
          token_type:
            typeof sessionObj.token_type === 'string' ? sessionObj.token_type : undefined,
        },
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Network error';
      return {
        ok: false,
        code: 'edge_function_unavailable',
        error: `Could not reach student authentication service ("student-auth-login"): ${msg}`,
      };
    }
  },

  fetchExistingAdmissionNumbers: async (): Promise<string[]> => {
    if (!supabase) return [];
    try {
      const { data, error } = await supabase.from('students').select('admission_no');
      if (error || !Array.isArray(data)) return [];
      return data
        .map((row: Record<string, unknown>) =>
          typeof row.admission_no === 'string' ? row.admission_no : ''
        )
        .filter(Boolean);
    } catch {
      return [];
    }
  },

  upsertStudent: async (
    student: Student
  ): Promise<{ ok: boolean; error?: string; code?: string }> => {
    if (!supabase) return { ok: false, error: 'Supabase not configured' };
    try {
      const { error } = await supabase
        .from('students')
        .upsert(toStudentRow(student), { onConflict: 'id' });
      if (error) {
        return {
          ok: false,
          code: error.code,
          error: formatRecordPersistenceError('student', error.message, error.code),
        };
      }
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'Unable to save student record.',
      };
    }
  },

  upsertStudents: (students: Student[]) =>
    students.length > 0 ? safeUpsert('students', students.map(toStudentRow)) : Promise.resolve({ ok: true }),

  deleteStudent: (id: string) => safeDeleteById('students', id),

  upsertTeacher: async (teacher: Teacher): Promise<{ ok: boolean; error?: string }> => {
    if (!supabase) return { ok: false, error: 'Supabase not configured' };
    try {
      const { error } = await supabase
        .from('teachers')
        .upsert(toTeacherRow(teacher), { onConflict: 'id' });
      if (error) {
        return { ok: false, error: formatRecordPersistenceError('teacher', error.message, error.code) };
      }
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'Unable to save teacher record.',
      };
    }
  },

  deleteTeacher: (id: string) => safeDeleteById('teachers', id),

  upsertParent: async (parent: Parent): Promise<{ ok: boolean; error?: string }> => {
    if (!supabase) return { ok: false, error: 'Supabase not configured' };
    try {
      const { error } = await supabase
        .from('parents')
        .upsert(toParentRow(parent), { onConflict: 'id' });
      if (error) {
        return { ok: false, error: formatRecordPersistenceError('parent', error.message, error.code) };
      }
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'Unable to save parent record.',
      };
    }
  },

  /**
   * Explicitly synchronizes `public.parent_students` so that added wards are linked
   * and removed wards are strictly unlinked (preventing a parent from accessing
   * another parent's or previously unlinked children).
   */
  syncParentStudentLinks: async (
    parentId: string,
    parentEmail: string,
    desiredStudentIds: string[]
  ): Promise<{ ok: boolean; error?: string }> => {
    if (!supabase) return { ok: false, error: 'Supabase not configured' };
    try {
      const uniqueDesired = Array.from(new Set(desiredStudentIds.filter(Boolean)));
      const { data: existingRows, error: fetchErr } = await supabase
        .from('parent_students')
        .select('student_id')
        .eq('parent_id', parentId);

      if (fetchErr) {
        return { ok: false, error: fetchErr.message };
      }

      const existingIds = new Set(
        (existingRows ?? []).map((r: Record<string, any>) => String(r.student_id))
      );
      const desiredSet = new Set(uniqueDesired);

      const toDelete = Array.from(existingIds).filter((sid) => !desiredSet.has(sid));
      const toInsert = uniqueDesired.filter((sid) => !existingIds.has(sid));

      if (toDelete.length > 0) {
        const { error: delErr } = await supabase
          .from('parent_students')
          .delete()
          .eq('parent_id', parentId)
          .in('student_id', toDelete);
        if (delErr) {
          return { ok: false, error: delErr.message };
        }

        // Clear matching students.parent_email on explicitly unlinked wards so the
        // DB trigger trg_parents_sync_parent_students never silently re-links them.
        const cleanedEmail = parentEmail.trim().toLowerCase();
        if (cleanedEmail) {
          await supabase
            .from('students')
            .update({ parent_email: null })
            .in('id', toDelete)
            .ilike('parent_email', cleanedEmail);
        }
      }

      if (toInsert.length > 0) {
        const { error: insErr } = await supabase.from('parent_students').upsert(
          toInsert.map((studentId) => ({
            parent_id: parentId,
            student_id: studentId,
            relationship: 'Guardian',
          })),
          { onConflict: 'parent_id,student_id' }
        );
        if (insErr) {
          return { ok: false, error: insErr.message };
        }
      }

      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'Unable to synchronize parent-student links.',
      };
    }
  },

  deleteParent: async (id: string): Promise<{ ok: boolean; error?: string }> => {
    if (!supabase) return { ok: false, error: 'Supabase not configured' };
    try {
      const { error } = await supabase.from('parents').delete().eq('id', id);
      if (error) {
        return {
          ok: false,
          error: formatRecordPersistenceError('parent', error.message, error.code),
        };
      }
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'Unable to delete parent record.',
      };
    }
  },

  fetchClasses: async (): Promise<{ ok: boolean; data: SchoolClass[]; error?: string }> => {
    if (!supabase) {
      return { ok: false, data: [], error: 'Supabase is not configured.' };
    }
    try {
      const { data, error } = await supabase
        .from('classes')
        .select('id, name, category, arms, class_teacher_id, capacity');
      if (error) {
        return {
          ok: false,
          data: [],
          error: formatSupabaseClassError(error.message, error.code),
        };
      }
      return {
        ok: true,
        data: sortSchoolClasses((data ?? []).map(fromClassRow)),
      };
    } catch (err) {
      return {
        ok: false,
        data: [],
        error: err instanceof Error ? err.message : 'Unable to load classes from Supabase.',
      };
    }
  },

  createClass: async (
    cls: SchoolClass
  ): Promise<{ ok: boolean; data?: SchoolClass; error?: string }> => {
    if (!supabase) {
      return { ok: false, error: 'Supabase is not configured.' };
    }
    try {
      const { data, error } = await supabase
        .from('classes')
        .insert(toClassRow(cls))
        .select('id, name, category, arms, class_teacher_id, capacity')
        .single();
      if (error || !data) {
        return {
          ok: false,
          error: formatSupabaseClassError(error?.message || 'Unable to create class.', error?.code, cls.name),
        };
      }
      return { ok: true, data: fromClassRow(data) };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'Unable to create class in Supabase.',
      };
    }
  },

  updateClass: async (
    cls: SchoolClass,
    options?: { previousName?: string }
  ): Promise<{ ok: boolean; data?: SchoolClass; error?: string }> => {
    if (!supabase) {
      return { ok: false, error: 'Supabase is not configured.' };
    }
    try {
      const row = toClassRow(cls);
      const { data, error } = await supabase
        .from('classes')
        .update({
          name: row.name,
          category: row.category,
          arms: row.arms,
          class_teacher_id: row.class_teacher_id,
          capacity: row.capacity,
        })
        .eq('id', cls.id)
        .select('id, name, category, arms, class_teacher_id, capacity')
        .single();
      if (error || !data) {
        return {
          ok: false,
          error: formatSupabaseClassError(error?.message || 'Unable to update class.', error?.code, cls.name),
        };
      }

      const updated = fromClassRow(data);

      // Keep denormalized students.class_name aligned if the class name changed
      if (options?.previousName && options.previousName !== updated.name) {
        const { error: syncErr } = await supabase
          .from('students')
          .update({ class_name: updated.name })
          .eq('class_id', cls.id);
        if (syncErr) {
          console.warn(`[Supabase] Could not sync student class_name for "${cls.id}": ${syncErr.message}`);
        }
      }

      return { ok: true, data: updated };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'Unable to update class in Supabase.',
      };
    }
  },

  getClassDependencyCounts: async (
    classId: string
  ): Promise<{ ok: boolean; counts?: ClassDependencyCounts; error?: string }> => {
    if (!supabase) {
      return { ok: false, error: 'Supabase is not configured.' };
    }
    const countByColumn = async (table: string, column: string): Promise<number> => {
      const { count, error } = await supabase!
        .from(table)
        .select('id', { count: 'exact', head: true })
        .eq(column, classId);
      if (error) {
        throw new Error(`Could not verify linked records in "${table}": ${error.message}`);
      }
      return count ?? 0;
    };

    try {
      const [
        students,
        scores,
        terminalResults,
        attendance,
        cbtExams,
        assignments,
        studyNotes,
        formTeachers,
      ] = await Promise.all([
        countByColumn('students', 'class_id'),
        countByColumn('scores', 'class_id'),
        countByColumn('terminal_results', 'class_id'),
        countByColumn('attendance', 'class_id'),
        countByColumn('cbt_exams', 'class_id'),
        countByColumn('assignments', 'class_id'),
        countByColumn('study_notes', 'class_id'),
        countByColumn('teachers', 'form_class_id'),
      ]);

      return {
        ok: true,
        counts: {
          students,
          scores,
          terminalResults,
          attendance,
          cbtExams,
          assignments,
          studyNotes,
          formTeachers,
          totalLinked:
            students +
            scores +
            terminalResults +
            attendance +
            cbtExams +
            assignments +
            studyNotes +
            formTeachers,
        },
      };
    } catch (err) {
      return {
        ok: false,
        error:
          err instanceof Error
            ? err.message
            : 'Unable to verify whether this class is linked to existing school records.',
      };
    }
  },

  deleteClass: async (
    id: string,
    className?: string
  ): Promise<{ ok: boolean; error?: string }> => {
    if (!supabase) {
      return { ok: false, error: 'Supabase is not configured.' };
    }
    try {
      const depCheck = await supabaseSchoolService.getClassDependencyCounts(id);
      if (!depCheck.ok || !depCheck.counts) {
        return {
          ok: false,
          error:
            depCheck.error ||
            'Could not verify linked records before deletion. Class was not deleted.',
        };
      }

      if (depCheck.counts.totalLinked > 0) {
        return {
          ok: false,
          error: formatClassDependencyError(className || id, depCheck.counts),
        };
      }

      const { error } = await supabase.from('classes').delete().eq('id', id);
      if (error) {
        return {
          ok: false,
          error: formatSupabaseClassError(error.message, error.code, className),
        };
      }
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'Unable to delete class from Supabase.',
      };
    }
  },

  upsertClass: (cls: SchoolClass) =>
    safeUpsert('classes', toClassRow(cls)),

  upsertSubject: (subject: Subject) =>
    safeUpsert('subjects', toSubjectRow(subject)),

  upsertScore: (score: ScoreRecord) =>
    safeUpsert('scores', toScoreRow(score)),

  upsertScores: (scores: ScoreRecord[]) =>
    scores.length > 0 ? safeUpsert('scores', scores.map(toScoreRow)) : Promise.resolve({ ok: true }),

  upsertResult: (result: TerminalResult) =>
    safeUpsert('terminal_results', toResultRow(result)),

  upsertAttendanceBatch: (records: AttendanceRecord[]) =>
    records.length > 0 ? safeUpsert('attendance', records.map(toAttendanceRow)) : Promise.resolve({ ok: true }),

  upsertCBTExam: (exam: CBTExam) =>
    safeUpsert('cbt_exams', toCBTExamRow(exam)),

  deleteCBTExam: async (id: string) => {
    await safeDeleteById('cbt_exams', id);
  },

  deleteMultipleCBTExams: async (ids: string[]) => {
    await safeDeleteByIds('cbt_exams', ids);
  },

  deleteCBTAttempt: async (id: string, examId?: string, studentId?: string) => {
    await safeDeleteById('cbt_attempts', id);
    if (supabase && examId && studentId) {
      await supabase
        .from('cbt_exam_sessions')
        .delete()
        .eq('exam_id', examId)
        .eq('student_id', studentId);
    }
  },

  upsertAssignment: (assignment: Assignment) =>
    safeUpsert('assignments', toAssignmentRow(assignment)),

  deleteAssignment: (id: string) => safeDeleteById('assignments', id),

  async insertAssignmentSubmission(
    submission: AssignmentSubmission
  ): Promise<{ ok: boolean; error?: string }> {
    if (!supabase) return { ok: false, error: 'Supabase not configured' };
    try {
      const { error } = await supabase
        .from('assignment_submissions')
        .insert(toAssignmentSubmissionInsertRow(submission));
      if (error) {
        console.warn('[Supabase] Assignment submission error:', error.message);
        return { ok: false, error: error.message };
      }
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'Unable to submit assignment.',
      };
    }
  },

  async gradeAssignmentSubmission(
    id: string,
    grade: number | undefined,
    feedback: string | undefined
  ): Promise<{ ok: boolean; error?: string }> {
    if (!supabase) return { ok: false, error: 'Supabase not configured' };
    try {
      const { error } = await supabase
        .from('assignment_submissions')
        .update({ grade: grade ?? null, feedback: feedback ?? null })
        .eq('id', id);
      if (error) {
        console.warn('[Supabase] Grade submission error:', error.message);
        return { ok: false, error: error.message };
      }
      return { ok: true };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'Unable to grade submission.',
      };
    }
  },

  upsertStudyNote: (note: StudyNote) =>
    safeUpsert('study_notes', toStudyNoteRow(note)),

  deleteStudyNote: (id: string) => safeDeleteById('study_notes', id),

  upsertNewsItem: (news: NewsItem) =>
    safeUpsert('news_items', toNewsRow(news)),

  upsertGalleryImage: (img: GalleryImage) =>
    safeUpsert('gallery_images', toGalleryRow(img)),

  upsertDownloadDocument: (doc: DownloadDocument) =>
    safeUpsert('download_documents', toDownloadRow(doc)),

  insertApplication: async (app: OnlineApplication): Promise<{ ok: boolean; error?: string }> => {
    if (!supabase) return { ok: false, error: 'Supabase not configured' };
    try {
      const row = {
        ...toApplicationRow(app),
        status: 'Pending' as const,
        notes: null,
      };
      const { error } = await supabase.from('online_applications').insert(row);
      if (error) {
        console.warn(`[Supabase] Insert error on "online_applications": ${error.message}`);
        return { ok: false, error: error.message };
      }
      return { ok: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      console.warn('[Supabase] Insert exception on "online_applications":', err);
      return { ok: false, error: msg };
    }
  },

  upsertApplication: (app: OnlineApplication) =>
    safeUpsert('online_applications', toApplicationRow(app)),

  upsertAnnouncement: (ann: AnnouncementNotification) =>
    safeUpsert('announcements', toAnnouncementRow(ann)),

  upsertFeeRecord: (fee: FeeRecord) =>
    safeUpsert('fee_records', toFeeRecordRow(fee)),

  upsertFeeRecords: (fees: FeeRecord[]) =>
    fees.length > 0 ? safeUpsert('fee_records', fees.map(toFeeRecordRow)) : Promise.resolve({ ok: true }),

  deleteFeeRecord: (id: string) => safeDeleteById('fee_records', id),
};
