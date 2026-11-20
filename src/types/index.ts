export type UserRole = 'public' | 'student' | 'teacher' | 'parent' | 'admin';

export interface AdminCredentials {
  username?: string;
  email: string;
  password?: string;
  name: string;
  isBootstrapped?: boolean;
}

export type PortalAccountRole = 'student' | 'teacher' | 'parent';

export type AccountProvisioningStatus =
  | 'not_created'
  | 'invitation_pending'
  | 'active'
  | 'disabled';

export type AccountProvisioningMode = 'admin_password' | 'invite';

export interface AccountStatusSummary {
  role: PortalAccountRole;
  recordId: string;
  authUserId?: string;
  email?: string;
  loginIdentifier?: string;
  status: AccountProvisioningStatus;
  mustChangePassword: boolean;
  invitedAt?: string;
  lastSignInAt?: string;
  needsRepair?: boolean;
  source: 'edge_function' | 'rpc' | 'profiles_table';
}

export interface ProvisionAccountRequest {
  role: PortalAccountRole;
  recordId: string;
  email?: string;
  mode: AccountProvisioningMode;
  password?: string;
  mustChangePassword?: boolean;
  redirectTo?: string;
}

export interface ProvisionAccountResult {
  ok: boolean;
  status?: AccountProvisioningStatus;
  authUserId?: string;
  email?: string;
  loginIdentifier?: string;
  mode?: AccountProvisioningMode;
  recoveredPartialAccount?: boolean;
  message?: string;
  error?: string;
  code?: string;
}

export interface UserProfile {
  authUserId: string;
  role: Exclude<UserRole, 'public'>;
  referenceId?: string;
  email: string;
  fullName?: string;
  isActive: boolean;
  accountStatus?: Exclude<AccountProvisioningStatus, 'not_created'>;
  mustChangePassword?: boolean;
}

export interface User {
  id: string;
  authUserId?: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  phone?: string;
  referenceId?: string; // Student ID, Staff ID, Parent ID, or ADM-001
}

export interface Student {
  id: string;
  authUserId?: string;
  admissionNo: string;
  firstName: string;
  lastName: string;
  otherNames?: string;
  email?: string;
  gender: 'Male' | 'Female';
  dob: string;
  classId: string;
  className: string;
  arm?: string;
  house?: 'Emerald' | 'Ruby' | 'Sapphire' | 'Diamond' | 'Blue' | 'Red' | 'Green' | 'Yellow' | string;
  parentName: string;
  parentPhone: string;
  parentEmail?: string;
  password?: string;
  resultPasscode?: string; // Admin-only alphanumeric passcode issued to access terminal result
  address: string;
  avatar: string;
  status: 'Active' | 'Graduated' | 'Suspended';
}

export interface Teacher {
  id: string;
  authUserId?: string;
  staffId: string;
  firstName: string;
  lastName: string;
  qualification?: string;
  email: string;
  phone: string;
  password?: string;
  subjectIds?: string[];
  subjectsTaught: string[];
  formClassId?: string;
  formClassName?: string;
  classTaught?: string;
  classesTaught?: string[];
  avatar: string;
  joinDate?: string;
  status?: 'Active' | 'Inactive';
}

export interface Parent {
  id: string;
  authUserId?: string;
  parentId: string;
  title: string;
  fullName: string;
  email: string;
  phone: string;
  occupation: string;
  address: string;
  studentIds: string[];
}

export interface SchoolClass {
  id: string;
  name: string; // e.g. JSS 1, SS 2
  category: 'Junior Secondary' | 'Senior Secondary';
  arms: string[]; // e.g. ['A', 'B', 'C']
  classTeacherId?: string;
  capacity: number;
}

export interface Subject {
  id: string;
  code: string; // e.g., MTH101
  name: string;
  category: 'Science' | 'Arts' | 'Commercial' | 'General';
  isCompulsory: boolean;
}

export interface ScoreRecord {
  id: string;
  studentId: string;
  subjectId: string;
  subjectName: string;
  classId: string;
  sessionId: string;
  term: '1st Term' | '2nd Term' | '3rd Term';
  ca1Score: number; // max 20
  ca2Score: number; // max 20
  examScore: number; // max 60
  totalScore: number; // max 100
  grade: 'A' | 'B' | 'C' | 'D' | 'E' | 'F';
  remarks: string;
  teacherId?: string;
}

export interface PsychomotorRating {
  punctuality: number; // 1-5
  neatness: number; // 1-5
  politeness: number; // 1-5
  leadership: number; // 1-5
  honesty: number; // 1-5
  sports: number; // 1-5
  teamwork: number; // 1-5
}

export interface TerminalResult {
  id: string;
  studentId: string;
  classId: string;
  sessionId: string;
  term: '1st Term' | '2nd Term' | '3rd Term';
  scores: ScoreRecord[];
  totalObtained?: number;
  totalPossible?: number;
  grandTotalScore?: number;
  averageScore: number;
  positionInClass: number;
  totalStudentsInClass: number;
  psychomotor: PsychomotorRating;
  teacherRemarks: string;
  principalRemarks: string;
  daysPresent: number;
  daysAbsent: number;
  totalSchoolDays: number;
  nextTermBegins: string;
  status: 'Draft' | 'Published';
}

export interface AttendanceRecord {
  id: string;
  studentId: string;
  studentName?: string;
  classId: string;
  date: string;
  status: 'Present' | 'Absent' | 'Late' | 'Excused';
  remark?: string;
}

export interface CBTQuestion {
  id: string;
  question: string;
  options: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  /**
   * Opaque per-session option identifiers returned to the student runner
   * so selections and server-side grading remain decoupled from display slots A-D.
   */
  optionIds?: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  correctOption?: 'A' | 'B' | 'C' | 'D';
  explanation?: string;
  marks: number;
}

export interface CBTExam {
  id: string;
  title: string;
  subjectId: string;
  subjectName: string;
  classId: string;
  className: string;
  teacherId?: string;
  term?: string;
  session?: string;
  durationMinutes: number;
  totalQuestions: number;
  totalMarks: number;
  passPercentage: number;
  startDate: string;
  startTime?: string;
  endDate: string;
  questions: CBTQuestion[];
  isPublished: boolean;
  shuffleQuestions: boolean;
  cbtActive?: boolean;
  hasAttempt?: boolean;
  sessionStatus?: 'in_progress' | 'submitted' | 'expired' | null;
  remainingSeconds?: number | null;
}

export interface CBTExamSession {
  id: string;
  examId: string;
  studentId: string;
  startedAt: string;
  expiresAt: string;
  submittedAt?: string;
  status: 'in_progress' | 'submitted' | 'expired';
  questionOrder: string[];
}

export interface CBTStartResponse {
  sessionId: string;
  startedAt: string;
  expiresAt: string;
  remainingSeconds: number;
  savedAnswers?: Record<string, string>;
  exam: CBTExam;
}

export interface CBTQuestionReview {
  questionId: string;
  question: string;
  options: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  selectedOption?: 'A' | 'B' | 'C' | 'D' | null;
  correctOption: 'A' | 'B' | 'C' | 'D';
  explanation?: string;
  marks: number;
  earnedMarks: number;
  isCorrect: boolean;
}

export interface CBTSubmissionResponse {
  attempt: CBTAttempt;
  review: CBTQuestionReview[];
}

export interface CBTAttempt {
  id: string;
  examId: string;
  studentId: string;
  studentName: string;
  admissionNo: string;
  scoreObtained: number;
  totalMarks: number;
  percentage: number;
  passed: boolean;
  timeTakenSeconds: number;
  completedAt: string;
  answers: Record<string, 'A' | 'B' | 'C' | 'D'>;
}

export interface Assignment {
  id: string;
  title: string;
  subjectId: string;
  subjectName: string;
  classId: string;
  className: string;
  teacherId?: string;
  teacherName: string;
  dueDate: string;
  description: string;
  format?: 'text' | 'word' | 'pdf';
  content?: string;
  attachmentUrl?: string;
  attachmentName?: string;
  fileSize?: string;
  createdDate: string;
  totalMarks?: number;
}

export interface AssignmentSubmission {
  id: string;
  assignmentId: string;
  studentId: string;
  studentName: string;
  submissionDate: string;
  content: string;
  fileUrl?: string;
  grade?: number;
  feedback?: string;
}

export interface StudyNote {
  id: string;
  title: string;
  subjectId?: string;
  subjectName: string;
  classId?: string;
  className: string;
  teacherId?: string;
  teacherName?: string;
  uploadDate: string;
  fileSize: string;
  downloadUrl?: string;
  fileUrl?: string;
  description: string;
}

export interface NewsItem {
  id: string;
  title: string;
  category: 'Academics' | 'Sports' | 'Events' | 'Announcements';
  date: string;
  author: string;
  summary: string;
  content: string;
  imageUrl: string;
  featured?: boolean;
}

export interface GalleryImage {
  id: string;
  title: string;
  category: 'Campus' | 'Sports Day' | 'Science Fair' | 'Graduation' | 'Arts & Culture';
  imageUrl: string;
  caption: string;
  date: string;
}

export interface OnlineApplication {
  id: string;
  applicationNumber: string;
  applicantFirstName: string;
  applicantLastName: string;
  gender: 'Male' | 'Female';
  dob: string;
  appliedClass: string;
  guardianName: string;
  guardianEmail: string;
  guardianPhone: string;
  previousSchool: string;
  submissionDate: string;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Interview Scheduled';
  notes?: string;
}

export interface DownloadDocument {
  id: string;
  title: string;
  category: 'Academic' | 'Admissions' | 'Forms' | 'Past Questions';
  fileType: 'PDF' | 'DOCX' | 'XLSX';
  fileSize: string;
  updatedDate: string;
  url: string;
}

export interface Announcement {
  id: string;
  title: string;
  message: string;
  sender: string;
  targetAudience?: 'All' | 'Students' | 'Teachers' | 'Parents';
  targetRole?: 'All' | 'Students' | 'Teachers' | 'Parents';
  priority?: 'Normal' | 'High' | 'Urgent' | string;
  date: string;
}

export type AnnouncementNotification = Announcement;

export interface FeeRecord {
  id: string;
  studentId: string;
  studentName: string;
  term: string;
  session: string;
  tuition: number;
  developmentFee: number;
  ictFee: number;
  uniformFee: number;
  total: number;
  amountPaid: number;
  balance: number;
  status: 'Paid' | 'Partial' | 'Unpaid';
  receiptNo: string;
}

export interface SystemSessionTerm {
  currentSession: string; // e.g., "2025/2026"
  academicSessions?: string[]; // e.g., ["2026/2027", "2025/2026", "2024/2025"]
  currentTerm: '1st Term' | '2nd Term' | '3rd Term';
  isResultPublished?: boolean;
  resultEntryOpen: boolean;
  cbtActive: boolean;

  // Editable site texts & images
  schoolName?: string;
  schoolMotto?: string;
  schoolLogoText?: string;
  schoolPhone?: string;
  schoolEmail?: string;
  schoolAddress?: string;

  heroBadge?: string;
  heroTitle?: string;
  heroSubtitle?: string;
  heroImage?: string;
  heroSpotlightLabel?: string;
  heroSpotlightText?: string;
  heroImageTitle?: string;

  statStudentsNumber?: string;
  statStudentsLabel?: string;
  statWaecNumber?: string;
  statWaecLabel?: string;
  statTeachersNumber?: string;
  statTeachersLabel?: string;
  statClubsNumber?: string;
  statClubsLabel?: string;

  aboutVision?: string;
  aboutMission?: string;
  aboutPrincipalName?: string;
  aboutPrincipalTitle?: string;
  aboutPrincipalAvatar?: string;
  aboutPrincipalBio?: string;
}
