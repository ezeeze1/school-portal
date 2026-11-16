import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import {
  User,
  UserRole,
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
  AdminCredentials,
} from '../types';

import {
  initialSystemSettings,
  sampleClasses,
  sampleSubjects,
  sampleTeachers,
  sampleParents,
  sampleStudents,
  sampleScores,
  sampleTerminalResults,
  sampleAttendance,
  sampleCBTExams,
  sampleCBTAttempts,
  sampleAssignments,
  sampleNotes,
  sampleNews,
  sampleGallery,
  sampleApplications,
  sampleDownloads,
  sampleAnnouncements,
  sampleFeeRecords,
} from '../data/initialData';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { supabaseSchoolService } from '../services/supabaseSchoolService';

interface SchoolContextType {
  // Auth & Session State
  currentUser: User | null;
  activeRole: UserRole;
  authLoading: boolean;
  authRecoveryMode: boolean;
  dismissAuthRecovery: () => void;
  setCurrentUser: (user: User | null) => void;
  switchRole: (role: UserRole, userObj?: User | null) => void;
  signInWithPassword: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  sendPasswordResetEmail: (email: string) => Promise<{ ok: boolean; error?: string }>;
  updatePassword: (newPassword: string) => Promise<{ ok: boolean; error?: string }>;
  updateAdminAuthProfile: (updates: {
    name?: string;
    email?: string;
    password?: string;
    username?: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;

  // Active View Navigation
  currentView: string;
  setCurrentView: (view: string) => void;

  // System Settings & Security
  systemSettings: SystemSessionTerm;
  updateSystemSettings: (settings: Partial<SystemSessionTerm>) => void;
  adminCredentials: AdminCredentials;
  updateAdminCredentials: (credentials: Partial<AdminCredentials>) => void;
  academicSessions: string[];
  addAcademicSession: (session: string) => void;
  deleteAcademicSession: (session: string) => void;

  // Data Collections
  students: Student[];
  teachers: Teacher[];
  parents: Parent[];
  classes: SchoolClass[];
  subjects: Subject[];
  scores: ScoreRecord[];
  results: TerminalResult[];
  attendance: AttendanceRecord[];
  cbtExams: CBTExam[];
  cbtAttempts: CBTAttempt[];
  assignments: Assignment[];
  assignmentSubmissions: AssignmentSubmission[];
  studyNotes: StudyNote[];
  newsItems: NewsItem[];
  galleryImages: GalleryImage[];
  applications: OnlineApplication[];
  downloads: DownloadDocument[];
  announcements: AnnouncementNotification[];
  feeRecords: FeeRecord[];

  // Student CRUD & Passcodes
  addStudent: (student: Omit<Student, 'id'>) => void;
  updateStudent: (id: string, updated: Partial<Student>) => void;
  deleteStudent: (id: string) => void;
  generateResultPasscodeForStudent: (studentId: string) => string;
  bulkGenerateResultPasscodes: () => void;
  verifyResultPasscode: (studentId: string, passcode: string) => Promise<boolean>;

  // Teacher CRUD
  addTeacher: (teacher: Omit<Teacher, 'id'>) => void;
  updateTeacher: (id: string, updated: Partial<Teacher>) => void;
  deleteTeacher: (id: string) => void;

  // Parent CRUD
  addParent: (parent: Omit<Parent, 'id'>) => void;
  updateParent: (id: string, updated: Partial<Parent>) => void;

  // Class & Subject Management
  addClass: (cls: Omit<SchoolClass, 'id'>) => void;
  addSubject: (subj: Omit<Subject, 'id'>) => void;

  // Score & Result Entry
  saveScore: (score: Omit<ScoreRecord, 'id'>) => void;
  saveBatchScores: (scoresList: Omit<ScoreRecord, 'id'>[]) => void;
  publishResult: (result: TerminalResult) => void;

  // Attendance
  recordAttendance: (records: Omit<AttendanceRecord, 'id'>[]) => void;

  // CBT Exam & Server-Side Engine
  createCBTExam: (exam: Omit<CBTExam, 'id'>) => void;
  updateCBTExam: (id: string, exam: Partial<CBTExam>) => void;
  deleteCBTExam: (id: string) => void;
  deleteMultipleCBTExams: (ids: string[]) => void;
  submitCBTAttempt: (attempt: Omit<CBTAttempt, 'id'>) => void;
  deleteCBTAttempt: (id: string) => void;
  startCBTExamSession: (examId: string) => Promise<CBTStartResponse>;
  submitCBTExamSession: (
    examId: string,
    answers: Record<string, 'A' | 'B' | 'C' | 'D'>
  ) => Promise<CBTSubmissionResponse>;

  // Assignments, Submissions & Notes
  createAssignment: (asg: Omit<Assignment, 'id'>) => void;
  addAssignment: (asg: Omit<Assignment, 'id'>) => void;
  deleteAssignment: (id: string) => void;
  submitAssignmentAnswer: (
    assignmentId: string,
    content: string,
    fileUrl?: string
  ) => Promise<{ ok: boolean; error?: string }>;
  gradeAssignmentSubmission: (
    submissionId: string,
    grade: number | undefined,
    feedback: string | undefined
  ) => Promise<{ ok: boolean; error?: string }>;
  createStudyNote: (note: Omit<StudyNote, 'id'>) => void;
  addStudyNote: (note: Omit<StudyNote, 'id'>) => void;
  deleteStudyNote: (id: string) => void;

  // Website Content
  addNewsItem: (news: Omit<NewsItem, 'id'>) => void;
  addGalleryImage: (img: Omit<GalleryImage, 'id'>) => void;
  addDownloadDocument: (doc: Omit<DownloadDocument, 'id'>) => void;

  // Applications
  submitOnlineApplication: (
    app: Omit<OnlineApplication, 'id' | 'applicationNumber' | 'submissionDate' | 'status'>
  ) => string;
  updateApplicationStatus: (
    id: string,
    status: OnlineApplication['status'],
    notes?: string
  ) => void;

  // Announcements
  sendAnnouncement: (ann: Omit<AnnouncementNotification, 'id' | 'date'>) => void;

  // Fee Records CRUD
  addFeeRecord: (fee: Omit<FeeRecord, 'id'>) => void;
  updateFeeRecord: (id: string, updated: Partial<FeeRecord>) => void;
  deleteFeeRecord: (id: string) => void;

  // Reset System Data
  resetToDefaultData: () => void;
}

const SchoolContext = createContext<SchoolContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = 'divine_academy_school_db_v2';

const PRIVATE_STORAGE_SUFFIXES = [
  'current_user',
  'active_role',
  'admin_creds',
  'students',
  'teachers',
  'parents',
  'classes',
  'subjects',
  'scores',
  'results',
  'attendance',
  'cbtExams',
  'cbtAttempts',
  'assignments',
  'assignmentSubmissions',
  'notes',
  'apps',
  'fees',
];

const initialAdminCredentials: AdminCredentials = {
  username: 'admin',
  email: 'ezekielsamson1@gmail.com',
  name: 'System Administrator',
};

const purgeSensitiveLocalStorage = () => {
  try {
    PRIVATE_STORAGE_SUFFIXES.forEach((suffix) => {
      localStorage.removeItem(`${LOCAL_STORAGE_KEY}_${suffix}`);
    });
  } catch {
    // Ignore storage access failures in restricted frames
  }
};

export const SchoolProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Never trust role or user session from localStorage
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeRole, setActiveRole] = useState<UserRole>('public');
  const [authLoading, setAuthLoading] = useState<boolean>(isSupabaseConfigured);
  const [authRecoveryMode, setAuthRecoveryMode] = useState<boolean>(false);
  const [currentView, setCurrentView] = useState<string>('home');

  const [adminCredentials, setAdminCredentials] = useState<AdminCredentials>(initialAdminCredentials);

  // Public site settings & public content
  const [systemSettings, setSystemSettings] = useState<SystemSessionTerm>(() => {
    try {
      const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_settings`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (
          !parsed.academicSessions ||
          !Array.isArray(parsed.academicSessions) ||
          parsed.academicSessions.length === 0
        ) {
          parsed.academicSessions = ['2026/2027', '2025/2026', '2024/2025', '2023/2024'];
        }
        return parsed;
      }
    } catch {
      // ignore
    }
    return initialSystemSettings;
  });

  // Private academic & PII collections start empty when Supabase is configured
  const [students, setStudents] = useState<Student[]>(() =>
    isSupabaseConfigured ? [] : sampleStudents
  );
  const [teachers, setTeachers] = useState<Teacher[]>(() =>
    isSupabaseConfigured ? [] : sampleTeachers
  );
  const [parents, setParents] = useState<Parent[]>(() =>
    isSupabaseConfigured ? [] : sampleParents
  );
  const [classes, setClasses] = useState<SchoolClass[]>(() =>
    isSupabaseConfigured ? [] : sampleClasses
  );
  const [subjects, setSubjects] = useState<Subject[]>(() =>
    isSupabaseConfigured ? [] : sampleSubjects
  );
  const [scores, setScores] = useState<ScoreRecord[]>(() =>
    isSupabaseConfigured ? [] : sampleScores
  );
  const [results, setResults] = useState<TerminalResult[]>(() =>
    isSupabaseConfigured ? [] : sampleTerminalResults
  );
  const [attendance, setAttendance] = useState<AttendanceRecord[]>(() =>
    isSupabaseConfigured ? [] : sampleAttendance
  );
  const [cbtExams, setCbtExams] = useState<CBTExam[]>(() =>
    isSupabaseConfigured ? [] : sampleCBTExams
  );
  const [cbtAttempts, setCbtAttempts] = useState<CBTAttempt[]>(() =>
    isSupabaseConfigured ? [] : sampleCBTAttempts
  );
  const [assignments, setAssignments] = useState<Assignment[]>(() =>
    isSupabaseConfigured ? [] : sampleAssignments
  );
  const [assignmentSubmissions, setAssignmentSubmissions] = useState<AssignmentSubmission[]>([]);
  const [studyNotes, setStudyNotes] = useState<StudyNote[]>(() =>
    isSupabaseConfigured ? [] : sampleNotes
  );
  const [applications, setApplications] = useState<OnlineApplication[]>(() =>
    isSupabaseConfigured ? [] : sampleApplications
  );
  const [feeRecords, setFeeRecords] = useState<FeeRecord[]>(() =>
    isSupabaseConfigured ? [] : sampleFeeRecords
  );

  // Public content collections
  const [newsItems, setNewsItems] = useState<NewsItem[]>(() => {
    try {
      const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_news`);
      return saved ? JSON.parse(saved) : sampleNews;
    } catch {
      return sampleNews;
    }
  });
  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>(() => {
    try {
      const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_gallery`);
      return saved ? JSON.parse(saved) : sampleGallery;
    } catch {
      return sampleGallery;
    }
  });
  const [downloads, setDownloads] = useState<DownloadDocument[]>(() => {
    try {
      const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_downloads`);
      return saved ? JSON.parse(saved) : sampleDownloads;
    } catch {
      return sampleDownloads;
    }
  });
  const [announcements, setAnnouncements] = useState<AnnouncementNotification[]>(() => {
    try {
      const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_announcements`);
      return saved ? JSON.parse(saved) : sampleAnnouncements;
    } catch {
      return sampleAnnouncements;
    }
  });

  const authSequenceRef = useRef(0);

  const clearPrivateCollections = useCallback(() => {
    if (!isSupabaseConfigured) return;
    setStudents([]);
    setTeachers([]);
    setParents([]);
    setClasses([]);
    setSubjects([]);
    setScores([]);
    setResults([]);
    setAttendance([]);
    setCbtExams([]);
    setCbtAttempts([]);
    setAssignments([]);
    setAssignmentSubmissions([]);
    setStudyNotes([]);
    setApplications([]);
    setFeeRecords([]);
  }, []);

  const applyPublicSnapshot = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    const snapshot = await supabaseSchoolService.fetchPublicSnapshot();
    if (snapshot.systemSettings) {
      setSystemSettings((prev) => ({
        ...prev,
        ...snapshot.systemSettings,
        academicSessions:
          snapshot.systemSettings?.academicSessions &&
          snapshot.systemSettings.academicSessions.length > 0
            ? snapshot.systemSettings.academicSessions
            : prev.academicSessions,
      }));
    }
    if (snapshot.newsItems) setNewsItems(snapshot.newsItems);
    if (snapshot.galleryImages) setGalleryImages(snapshot.galleryImages);
    if (snapshot.downloads) setDownloads(snapshot.downloads);
    if (snapshot.announcements) setAnnouncements(snapshot.announcements);
  }, []);

  const hydrateAuthenticatedSession = useCallback(
    async (
      authUser: { id: string; email?: string; user_metadata?: Record<string, any> },
      options?: { navigateToPortal?: boolean }
    ): Promise<{ ok: boolean; error?: string }> => {
      const seq = ++authSequenceRef.current;

      const { profile, error } = await supabaseSchoolService.syncMyUserProfile();
      if (seq !== authSequenceRef.current) {
        return { ok: false, error: 'Session superseded.' };
      }

      if (!profile || !profile.isActive) {
        clearPrivateCollections();
        setCurrentUser(null);
        setActiveRole('public');
        await applyPublicSnapshot();
        return {
          ok: false,
          error:
            error ||
            'Your Supabase login succeeded, but no active school portal profile is linked to this account yet. Please contact the school administrator.',
        };
      }

      const snapshot = await supabaseSchoolService.fetchPortalSnapshot(profile.role);
      if (seq !== authSequenceRef.current) {
        return { ok: false, error: 'Session superseded.' };
      }

      if (snapshot.systemSettings) {
        setSystemSettings((prev) => ({
          ...prev,
          ...snapshot.systemSettings,
          academicSessions:
            snapshot.systemSettings?.academicSessions &&
            snapshot.systemSettings.academicSessions.length > 0
              ? snapshot.systemSettings.academicSessions
              : prev.academicSessions,
        }));
      }

      const loadedStudents = snapshot.students ?? [];
      const loadedTeachers = snapshot.teachers ?? [];
      const loadedParents = snapshot.parents ?? [];

      setStudents(loadedStudents);
      setTeachers(loadedTeachers);
      setParents(loadedParents);
      setClasses(snapshot.classes ?? []);
      setSubjects(snapshot.subjects ?? []);
      setScores(snapshot.scores ?? []);
      setResults(snapshot.results ?? []);
      setAttendance(snapshot.attendance ?? []);
      setCbtExams(snapshot.cbtExams ?? []);
      setCbtAttempts(snapshot.cbtAttempts ?? []);
      setAssignments(snapshot.assignments ?? []);
      setAssignmentSubmissions(snapshot.assignmentSubmissions ?? []);
      setStudyNotes(snapshot.studyNotes ?? []);
      setApplications(snapshot.applications ?? []);
      setFeeRecords(snapshot.feeRecords ?? []);

      if (snapshot.newsItems) setNewsItems(snapshot.newsItems);
      if (snapshot.galleryImages) setGalleryImages(snapshot.galleryImages);
      if (snapshot.downloads) setDownloads(snapshot.downloads);
      if (snapshot.announcements) setAnnouncements(snapshot.announcements);

      let resolvedUser: User;
      const email = profile.email || authUser.email || '';

      if (profile.role === 'teacher') {
        const matched = loadedTeachers.find(
          (t) =>
            t.authUserId === authUser.id ||
            (profile.referenceId && t.id === profile.referenceId) ||
            t.email.toLowerCase() === email.toLowerCase()
        );
        resolvedUser = {
          id: matched?.id || profile.referenceId || authUser.id,
          authUserId: authUser.id,
          name: matched
            ? `${matched.firstName} ${matched.lastName}`
            : profile.fullName || authUser.user_metadata?.full_name || 'Faculty Member',
          email,
          role: 'teacher',
          avatar: matched?.avatar,
          referenceId: matched?.staffId || profile.referenceId,
        };
      } else if (profile.role === 'student') {
        const matched = loadedStudents.find(
          (s) =>
            s.authUserId === authUser.id ||
            (profile.referenceId && s.id === profile.referenceId) ||
            (s.email && s.email.toLowerCase() === email.toLowerCase())
        );
        resolvedUser = {
          id: matched?.id || profile.referenceId || authUser.id,
          authUserId: authUser.id,
          name: matched
            ? `${matched.firstName} ${matched.lastName}`
            : profile.fullName || authUser.user_metadata?.full_name || 'Student',
          email,
          role: 'student',
          avatar: matched?.avatar,
          referenceId: matched?.admissionNo || profile.referenceId,
        };
      } else if (profile.role === 'parent') {
        const matched = loadedParents.find(
          (p) =>
            p.authUserId === authUser.id ||
            (profile.referenceId && p.id === profile.referenceId) ||
            p.email.toLowerCase() === email.toLowerCase()
        );
        resolvedUser = {
          id: matched?.id || profile.referenceId || authUser.id,
          authUserId: authUser.id,
          name: matched
            ? matched.title
              ? `${matched.title} ${matched.fullName}`
              : matched.fullName
            : profile.fullName || authUser.user_metadata?.full_name || 'Parent / Guardian',
          email,
          role: 'parent',
          avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200',
          referenceId: matched?.parentId || profile.referenceId,
        };
      } else {
        const adminDisplayName =
          profile.fullName ||
          (typeof authUser.user_metadata?.full_name === 'string'
            ? authUser.user_metadata.full_name
            : '') ||
          'System Administrator';
        resolvedUser = {
          id: profile.referenceId || 'usr-admin',
          authUserId: authUser.id,
          name: adminDisplayName,
          email,
          role: 'admin',
          avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=200',
          referenceId: profile.referenceId || 'ADM-001',
        };
        setAdminCredentials((prev) => ({
          ...prev,
          name: adminDisplayName,
          email,
          isBootstrapped: true,
        }));
      }

      setCurrentUser(resolvedUser);
      setActiveRole(profile.role);

      if (options?.navigateToPortal) {
        setCurrentView(`${profile.role}-portal`);
      }

      return { ok: true };
    },
    [applyPublicSnapshot, clearPrivateCollections]
  );

  // Purge legacy localStorage credential/session keys & initialize Supabase Auth listener
  useEffect(() => {
    purgeSensitiveLocalStorage();

    if (!isSupabaseConfigured || !supabase) {
      setAuthLoading(false);
      return;
    }

    let isMounted = true;

    const bootstrapSession = async () => {
      setAuthLoading(true);
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!isMounted) return;

        if (session?.user) {
          const res = await hydrateAuthenticatedSession(session.user, { navigateToPortal: false });
          if (!res.ok && isMounted) {
            await supabase.auth.signOut();
          }
        } else {
          clearPrivateCollections();
          setCurrentUser(null);
          setActiveRole('public');
          await applyPublicSnapshot();
        }
      } finally {
        if (isMounted) setAuthLoading(false);
      }
    };

    void bootstrapSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;

      if (event === 'PASSWORD_RECOVERY') {
        setAuthRecoveryMode(true);
      }

      if (event === 'SIGNED_OUT' || !session?.user) {
        authSequenceRef.current += 1;
        clearPrivateCollections();
        setCurrentUser(null);
        setActiveRole('public');
        setCurrentView('home');
        void applyPublicSnapshot();
        return;
      }

      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        setTimeout(() => {
          if (!isMounted) return;
          void hydrateAuthenticatedSession(session.user, {
            navigateToPortal: event === 'SIGNED_IN',
          });
        }, 0);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [applyPublicSnapshot, clearPrivateCollections, hydrateAuthenticatedSession]);

  // Only persist public site content/settings to localStorage (never PII, credentials, or roles)
  useEffect(() => {
    try {
      localStorage.setItem(`${LOCAL_STORAGE_KEY}_settings`, JSON.stringify(systemSettings));
      localStorage.setItem(`${LOCAL_STORAGE_KEY}_news`, JSON.stringify(newsItems));
      localStorage.setItem(`${LOCAL_STORAGE_KEY}_gallery`, JSON.stringify(galleryImages));
      localStorage.setItem(`${LOCAL_STORAGE_KEY}_downloads`, JSON.stringify(downloads));
      localStorage.setItem(`${LOCAL_STORAGE_KEY}_announcements`, JSON.stringify(announcements));
    } catch {
      // ignore
    }
  }, [systemSettings, newsItems, galleryImages, downloads, announcements]);

  const dismissAuthRecovery = () => setAuthRecoveryMode(false);

  const signInWithPassword = async (
    email: string,
    password: string
  ): Promise<{ ok: boolean; error?: string }> => {
    if (!isSupabaseConfigured || !supabase) {
      return {
        ok: false,
        error:
          'Supabase authentication is not configured. Please check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
      };
    }

    const cleanedEmail = email.trim().toLowerCase();
    if (!cleanedEmail || !password) {
      return { ok: false, error: 'Please enter both your email address and password.' };
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanedEmail,
      password,
    });

    if (error || !data.user) {
      return {
        ok: false,
        error: error?.message || 'Invalid email or password.',
      };
    }

    const hydrationResult = await hydrateAuthenticatedSession(data.user, {
      navigateToPortal: true,
    });
    if (!hydrationResult.ok) {
      await supabase.auth.signOut();
      return {
        ok: false,
        error: hydrationResult.error || 'Account is not linked to an active school portal role.',
      };
    }

    return { ok: true };
  };

  const sendPasswordResetEmail = async (
    email: string
  ): Promise<{ ok: boolean; error?: string }> => {
    if (!isSupabaseConfigured || !supabase) {
      return { ok: false, error: 'Supabase authentication is not configured.' };
    }
    const cleaned = email.trim().toLowerCase();
    if (!cleaned || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleaned)) {
      return { ok: false, error: 'Please enter a valid account email address.' };
    }
    const { error } = await supabase.auth.resetPasswordForEmail(cleaned, {
      redirectTo: window.location.origin,
    });
    if (error) {
      return { ok: false, error: error.message };
    }
    return { ok: true };
  };

  const updatePassword = async (
    newPassword: string
  ): Promise<{ ok: boolean; error?: string }> => {
    if (!isSupabaseConfigured || !supabase) {
      return { ok: false, error: 'Supabase authentication is not configured.' };
    }
    if (newPassword.length < 8) {
      return { ok: false, error: 'Password must be at least 8 characters long.' };
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      return { ok: false, error: error.message };
    }
    setAuthRecoveryMode(false);
    return { ok: true };
  };

  const updateAdminAuthProfile = async (updates: {
    name?: string;
    email?: string;
    password?: string;
    username?: string;
  }): Promise<{ ok: boolean; error?: string }> => {
    if (activeRole !== 'admin' || currentUser?.role !== 'admin') {
      return { ok: false, error: 'Only an authenticated administrator can update admin credentials.' };
    }

    if (isSupabaseConfigured && supabase) {
      const payload: {
        email?: string;
        password?: string;
        data?: Record<string, any>;
      } = {};

      if (updates.email && updates.email.trim() && updates.email.trim() !== currentUser.email) {
        payload.email = updates.email.trim();
      }
      if (updates.password && updates.password.trim()) {
        if (updates.password.trim().length < 8) {
          return { ok: false, error: 'New password must be at least 8 characters long.' };
        }
        payload.password = updates.password.trim();
      }
      if (updates.name && updates.name.trim()) {
        payload.data = { full_name: updates.name.trim() };
      }

      if (payload.email || payload.password || payload.data) {
        const { error } = await supabase.auth.updateUser(payload);
        if (error) {
          return { ok: false, error: error.message };
        }
      }
    }

    setAdminCredentials((prev) => ({
      ...prev,
      name: updates.name?.trim() || prev.name,
      username: updates.username?.trim() || prev.username,
      email: updates.email?.trim() || prev.email,
    }));

    setCurrentUser((curr) =>
      curr
        ? {
            ...curr,
            name: updates.name?.trim() || curr.name,
            email: updates.email?.trim() || curr.email,
          }
        : null
    );

    return { ok: true };
  };

  const logout = async () => {
    authSequenceRef.current += 1;
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut();
    }
    clearPrivateCollections();
    setCurrentUser(null);
    setActiveRole('public');
    setCurrentView('home');
    setAuthRecoveryMode(false);
    if (isSupabaseConfigured) {
      await applyPublicSnapshot();
    }
  };

  // Never allow client-side role elevation when Supabase is configured
  const switchRole = (role: UserRole, _userObj?: User | null) => {
    if (role === 'public') {
      void logout();
      return;
    }
    console.warn('[Security] Direct client-side role switching is disabled; sign in with Supabase Auth.');
  };

  const updateSystemSettings = (updated: Partial<SystemSessionTerm>) => {
    setSystemSettings((prev) => {
      const next = { ...prev, ...updated };
      void supabaseSchoolService.upsertSystemSettings(next);
      return next;
    });
  };

  const updateAdminCredentials = (updated: Partial<AdminCredentials>) => {
    setAdminCredentials((prev) => {
      const next = {
        ...prev,
        name: updated.name ?? prev.name,
        email: updated.email ?? prev.email,
        username: updated.username ?? prev.username,
      };
      if (currentUser?.role === 'admin') {
        setCurrentUser((curr) =>
          curr
            ? {
                ...curr,
                name: next.name || curr.name,
                email: next.email || curr.email,
              }
            : null
        );
      }
      return next;
    });
  };

  // CRUD Implementations
  const addStudent = (newStudent: Omit<Student, 'id'>) => {
    if (activeRole !== 'admin') {
      console.warn('[Security] Only administrators can enroll students.');
      return;
    }
    const id = `std-${Date.now()}`;
    const { password: _ignoredPassword, resultPasscode, ...safeFields } = newStudent;
    const created: Student = { ...safeFields, resultPasscode, id };
    setStudents((prev) => [...prev, created]);
    void supabaseSchoolService.upsertStudent(created).then((res) => {
      if (res.ok && resultPasscode) {
        void supabaseSchoolService.upsertStudentResultPasscode(id, resultPasscode);
      }
    });
  };

  const updateStudent = (id: string, updated: Partial<Student>) => {
    if (activeRole !== 'admin') {
      console.warn('[Security] Only administrators can update student records.');
      return;
    }
    const { password: _ignoredPassword, resultPasscode, ...safeUpdated } = updated;
    setStudents((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        const next: Student = {
          ...s,
          ...safeUpdated,
          ...(resultPasscode !== undefined ? { resultPasscode } : {}),
        };
        void supabaseSchoolService.upsertStudent(next).then((res) => {
          if (res.ok && resultPasscode && resultPasscode.trim()) {
            void supabaseSchoolService.upsertStudentResultPasscode(id, resultPasscode.trim());
          }
        });
        return next;
      })
    );
  };

  const generateAlphanumericPasscode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = 'RES-';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const generateResultPasscodeForStudent = (studentId: string): string => {
    if (activeRole !== 'admin') {
      console.warn('[Security] Only administrators can generate result passcodes.');
      return '';
    }
    const newCode = generateAlphanumericPasscode();
    setStudents((prev) =>
      prev.map((s) => (s.id === studentId ? { ...s, resultPasscode: newCode } : s))
    );
    void supabaseSchoolService.upsertStudentResultPasscode(studentId, newCode);
    return newCode;
  };

  const bulkGenerateResultPasscodes = () => {
    if (activeRole !== 'admin') {
      console.warn('[Security] Only administrators can bulk-generate result passcodes.');
      return;
    }
    setStudents((prev) => {
      const nextList = prev.map((s) => ({
        ...s,
        resultPasscode: s.resultPasscode || generateAlphanumericPasscode(),
      }));
      const entries = nextList
        .filter((s) => Boolean(s.resultPasscode))
        .map((s) => ({ studentId: s.id, resultPasscode: s.resultPasscode as string }));
      void supabaseSchoolService.upsertStudentResultPasscodesBulk(entries);
      return nextList;
    });
  };

  const verifyResultPasscode = async (
    studentId: string,
    passcode: string
  ): Promise<boolean> => {
    const cleaned = passcode.trim().toUpperCase();
    if (!cleaned) return false;

    if (isSupabaseConfigured) {
      return supabaseSchoolService.verifyStudentResultPasscode(studentId, cleaned);
    }

    const target = students.find((s) => s.id === studentId);
    return Boolean(target?.resultPasscode && target.resultPasscode.trim().toUpperCase() === cleaned);
  };

  const deleteStudent = (id: string) => {
    if (activeRole !== 'admin') {
      console.warn('[Security] Only administrators can delete students.');
      return;
    }
    setStudents((prev) => prev.filter((s) => s.id !== id));
    void supabaseSchoolService.deleteStudent(id);
  };

  const addTeacher = (newTeacher: Omit<Teacher, 'id'>) => {
    if (activeRole !== 'admin') {
      console.warn('[Security] Only administrators can add teachers.');
      return;
    }
    const id = `tch-${Date.now()}`;
    const { password: _ignoredPassword, ...safeTeacher } = newTeacher;
    const created: Teacher = { ...safeTeacher, id };
    setTeachers((prev) => [...prev, created]);
    void supabaseSchoolService.upsertTeacher(created);
  };

  const updateTeacher = (id: string, updated: Partial<Teacher>) => {
    if (activeRole !== 'admin') {
      console.warn('[Security] Only administrators can update teachers.');
      return;
    }
    const { password: _ignoredPassword, ...safeUpdated } = updated;
    setTeachers((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        const next = { ...t, ...safeUpdated };
        void supabaseSchoolService.upsertTeacher(next);
        return next;
      })
    );
  };

  const deleteTeacher = (id: string) => {
    if (activeRole !== 'admin') {
      console.warn('[Security] Only administrators can delete teachers.');
      return;
    }
    setTeachers((prev) => prev.filter((t) => t.id !== id));
    void supabaseSchoolService.deleteTeacher(id);
  };

  const addParent = (newParent: Omit<Parent, 'id'>) => {
    const id = `prt-${Date.now()}`;
    const created = { ...newParent, id };
    setParents((prev) => [...prev, created]);
    void supabaseSchoolService.upsertParent(created);
  };

  const updateParent = (id: string, updated: Partial<Parent>) => {
    setParents((prev) =>
      prev.map((p) => {
        if (p.id !== id) return p;
        const next = { ...p, ...updated };
        void supabaseSchoolService.upsertParent(next);
        return next;
      })
    );
  };

  const addClass = (cls: Omit<SchoolClass, 'id'>) => {
    const id = `cls-${Date.now()}`;
    const created = { ...cls, id };
    setClasses((prev) => [...prev, created]);
    void supabaseSchoolService.upsertClass(created);
  };

  const addSubject = (subj: Omit<Subject, 'id'>) => {
    const id = `sub-${Date.now()}`;
    const created = { ...subj, id };
    setSubjects((prev) => [...prev, created]);
    void supabaseSchoolService.upsertSubject(created);
  };

  const resolveValidTeacherId = (teacherId?: string): string | undefined => {
    if (!teacherId) return undefined;
    return teachers.some((t) => t.id === teacherId) ? teacherId : undefined;
  };

  const saveScore = (scoreData: Omit<ScoreRecord, 'id'>) => {
    const sanitizedScoreData: Omit<ScoreRecord, 'id'> = {
      ...scoreData,
      teacherId: resolveValidTeacherId(scoreData.teacherId),
    };
    setScores((prev) => {
      const existingIdx = prev.findIndex(
        (s) =>
          s.studentId === sanitizedScoreData.studentId &&
          s.subjectId === sanitizedScoreData.subjectId &&
          s.sessionId === sanitizedScoreData.sessionId &&
          s.term === sanitizedScoreData.term
      );
      if (existingIdx >= 0) {
        const updated = [...prev];
        const nextScore = { ...sanitizedScoreData, id: prev[existingIdx].id };
        updated[existingIdx] = nextScore;
        void supabaseSchoolService.upsertScore(nextScore);
        return updated;
      }
      const created = {
        ...sanitizedScoreData,
        id: `sc-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      };
      void supabaseSchoolService.upsertScore(created);
      return [...prev, created];
    });
  };

  const saveBatchScores = (scoresList: Omit<ScoreRecord, 'id'>[]) => {
    scoresList.forEach((scoreItem) => saveScore(scoreItem));
  };

  const publishResult = (resultData: TerminalResult) => {
    void supabaseSchoolService.upsertResult(resultData);
    setResults((prev) => {
      const idx = prev.findIndex(
        (r) =>
          r.studentId === resultData.studentId &&
          r.sessionId === resultData.sessionId &&
          r.term === resultData.term
      );
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = resultData;
        return copy;
      }
      return [...prev, resultData];
    });
  };

  const recordAttendance = (records: Omit<AttendanceRecord, 'id'>[]) => {
    const newRecords = records.map((r) => ({
      ...r,
      id: `att-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    }));
    setAttendance((prev) => [...prev, ...newRecords]);
    void supabaseSchoolService.upsertAttendanceBatch(newRecords);
  };

  const createCBTExam = (exam: Omit<CBTExam, 'id'>) => {
    const id = `cbt-${Date.now()}`;
    const created: CBTExam = {
      ...exam,
      id,
      teacherId: resolveValidTeacherId(exam.teacherId),
    };
    setCbtExams((prev) => [...prev, created]);
    void supabaseSchoolService.upsertCBTExam(created);
  };

  const updateCBTExam = (id: string, updated: Partial<CBTExam>) => {
    setCbtExams((prev) =>
      prev.map((e) => {
        if (e.id !== id) return e;
        const next: CBTExam = {
          ...e,
          ...updated,
          teacherId:
            'teacherId' in updated
              ? resolveValidTeacherId(updated.teacherId)
              : resolveValidTeacherId(e.teacherId),
        };
        void supabaseSchoolService.upsertCBTExam(next);
        return next;
      })
    );
  };

  const deleteCBTExam = (id: string) => {
    setCbtExams((prev) => prev.filter((e) => e.id !== id));
    setCbtAttempts((prev) => prev.filter((a) => a.examId !== id));
    void supabaseSchoolService.deleteCBTExam(id);
  };

  const deleteMultipleCBTExams = (ids: string[]) => {
    setCbtExams((prev) => prev.filter((e) => !ids.includes(e.id)));
    setCbtAttempts((prev) => prev.filter((a) => !ids.includes(a.examId)));
    void supabaseSchoolService.deleteMultipleCBTExams(ids);
  };

  const submitCBTAttempt = (attempt: Omit<CBTAttempt, 'id'>) => {
    const id = `attmpt-${Date.now()}`;
    const created = { ...attempt, id };
    setCbtAttempts((prev) => [...prev, created]);
  };

  const deleteCBTAttempt = (id: string) => {
    setCbtAttempts((prev) => prev.filter((a) => a.id !== id));
    void supabaseSchoolService.deleteCBTAttempt(id);
  };

  const startCBTExamSession = async (examId: string): Promise<CBTStartResponse> => {
    if (!isSupabaseConfigured) {
      const localExam = cbtExams.find((e) => e.id === examId);
      if (!localExam) {
        throw new Error('CBT exam not found.');
      }
      const now = Date.now();
      return {
        sessionId: `local-${now}`,
        startedAt: new Date(now).toISOString(),
        expiresAt: new Date(now + localExam.durationMinutes * 60000).toISOString(),
        remainingSeconds: localExam.durationMinutes * 60,
        exam: {
          ...localExam,
          questions: localExam.questions.map(({ correctOption: _c, explanation: _e, ...q }) => q),
        },
      };
    }

    return supabaseSchoolService.startCBTExam(examId);
  };

  const submitCBTExamSession = async (
    examId: string,
    answers: Record<string, 'A' | 'B' | 'C' | 'D'>
  ): Promise<CBTSubmissionResponse> => {
    if (isSupabaseConfigured) {
      const response = await supabaseSchoolService.submitCBTExam(examId, answers);
      setCbtAttempts((prev) => {
        const filtered = prev.filter((a) => a.id !== response.attempt.id);
        return [...filtered, response.attempt];
      });
      setCbtExams((prev) =>
        prev.map((ex) =>
          ex.id === examId ? { ...ex, hasAttempt: true, sessionStatus: 'submitted' } : ex
        )
      );
      return response;
    }

    throw new Error('Supabase must be configured to submit and grade CBT examinations.');
  };

  const addAcademicSession = (newSession: string) => {
    const cleaned = newSession.trim();
    if (!cleaned) return;
    setSystemSettings((prev) => {
      const existing = prev.academicSessions || ['2026/2027', '2025/2026', '2024/2025', '2023/2024'];
      if (existing.includes(cleaned)) return prev;
      const next = {
        ...prev,
        academicSessions: [cleaned, ...existing],
      };
      void supabaseSchoolService.upsertSystemSettings(next);
      return next;
    });
  };

  const deleteAcademicSession = (sessionToDelete: string) => {
    setSystemSettings((prev) => {
      const existing = prev.academicSessions || ['2026/2027', '2025/2026', '2024/2025', '2023/2024'];
      const filtered = existing.filter((s) => s !== sessionToDelete);
      const next = {
        ...prev,
        academicSessions: filtered.length > 0 ? filtered : [prev.currentSession],
      };
      void supabaseSchoolService.upsertSystemSettings(next);
      return next;
    });
  };

  const createAssignment = (asg: Omit<Assignment, 'id'>) => {
    const id = `asg-${Date.now()}`;
    const created: Assignment = {
      ...asg,
      id,
      teacherId: resolveValidTeacherId(asg.teacherId),
    };
    setAssignments((prev) => [...prev, created]);
    void supabaseSchoolService.upsertAssignment(created);
  };

  const deleteAssignment = (id: string) => {
    setAssignments((prev) => prev.filter((a) => a.id !== id));
    void supabaseSchoolService.deleteAssignment(id);
  };

  const submitAssignmentAnswer = async (
    assignmentId: string,
    content: string,
    fileUrl?: string
  ): Promise<{ ok: boolean; error?: string }> => {
    const studentObj =
      students.find(
        (s) =>
          s.id === currentUser?.id ||
          (currentUser?.authUserId && s.authUserId === currentUser.authUserId) ||
          (currentUser?.referenceId &&
            s.admissionNo?.toLowerCase() === currentUser.referenceId.toLowerCase())
      ) || null;

    if (!studentObj) {
      return { ok: false, error: 'Linked student profile not found.' };
    }

    const alreadySubmitted = assignmentSubmissions.some(
      (sub) => sub.assignmentId === assignmentId && sub.studentId === studentObj.id
    );
    if (alreadySubmitted) {
      return { ok: false, error: 'You have already submitted an answer for this assignment.' };
    }

    const newSubmission: AssignmentSubmission = {
      id: `subm-${Date.now()}`,
      assignmentId,
      studentId: studentObj.id,
      studentName: `${studentObj.firstName} ${studentObj.lastName}`,
      submissionDate: new Date().toISOString().split('T')[0],
      content: content.trim(),
      fileUrl: fileUrl?.trim() || undefined,
    };

    if (isSupabaseConfigured) {
      const res = await supabaseSchoolService.insertAssignmentSubmission(newSubmission);
      if (!res.ok) {
        return res;
      }
    }

    setAssignmentSubmissions((prev) => [...prev, newSubmission]);
    return { ok: true };
  };

  const gradeAssignmentSubmission = async (
    submissionId: string,
    grade: number | undefined,
    feedback: string | undefined
  ): Promise<{ ok: boolean; error?: string }> => {
    if (activeRole !== 'teacher' && activeRole !== 'admin') {
      return { ok: false, error: 'Only teachers or administrators can grade submissions.' };
    }

    if (isSupabaseConfigured) {
      const res = await supabaseSchoolService.gradeAssignmentSubmission(
        submissionId,
        grade,
        feedback
      );
      if (!res.ok) {
        return res;
      }
    }

    setAssignmentSubmissions((prev) =>
      prev.map((sub) =>
        sub.id === submissionId ? { ...sub, grade, feedback } : sub
      )
    );
    return { ok: true };
  };

  const createStudyNote = (note: Omit<StudyNote, 'id'>) => {
    const id = `note-${Date.now()}`;
    const created: StudyNote = {
      ...note,
      id,
      classId: note.classId && note.classId !== 'all' ? note.classId : undefined,
      teacherId: resolveValidTeacherId(note.teacherId),
    };
    setStudyNotes((prev) => [...prev, created]);
    void supabaseSchoolService.upsertStudyNote(created);
  };

  const deleteStudyNote = (id: string) => {
    setStudyNotes((prev) => prev.filter((n) => n.id !== id));
    void supabaseSchoolService.deleteStudyNote(id);
  };

  const addNewsItem = (news: Omit<NewsItem, 'id'>) => {
    const id = `news-${Date.now()}`;
    const created = { ...news, id };
    setNewsItems((prev) => [...prev, created]);
    void supabaseSchoolService.upsertNewsItem(created);
  };

  const addGalleryImage = (img: Omit<GalleryImage, 'id'>) => {
    const id = `gal-${Date.now()}`;
    const created = { ...img, id };
    setGalleryImages((prev) => [...prev, created]);
    void supabaseSchoolService.upsertGalleryImage(created);
  };

  const addDownloadDocument = (doc: Omit<DownloadDocument, 'id'>) => {
    const id = `dl-${Date.now()}`;
    const created = { ...doc, id };
    setDownloads((prev) => [...prev, created]);
    void supabaseSchoolService.upsertDownloadDocument(created);
  };

  const submitOnlineApplication = (
    appData: Omit<OnlineApplication, 'id' | 'applicationNumber' | 'submissionDate' | 'status'>
  ): string => {
    const id = `app-${Date.now()}`;
    const appNum = `APP/${new Date().getFullYear()}/${Math.floor(1000 + Math.random() * 9000)}`;
    const newApp: OnlineApplication = {
      ...appData,
      id,
      applicationNumber: appNum,
      submissionDate: new Date().toISOString().split('T')[0],
      status: 'Pending',
    };
    setApplications((prev) => [newApp, ...prev]);
    void supabaseSchoolService.upsertApplication(newApp);
    return appNum;
  };

  const updateApplicationStatus = (
    id: string,
    status: OnlineApplication['status'],
    notes?: string
  ) => {
    setApplications((prev) =>
      prev.map((app) => {
        if (app.id !== id) return app;
        const next = { ...app, status, notes: notes || app.notes };
        void supabaseSchoolService.upsertApplication(next);
        return next;
      })
    );
  };

  const sendAnnouncement = (ann: Omit<AnnouncementNotification, 'id' | 'date'>) => {
    const id = `ann-${Date.now()}`;
    const newAnn: AnnouncementNotification = {
      ...ann,
      id,
      date: new Date().toISOString().split('T')[0],
    };
    setAnnouncements((prev) => [newAnn, ...prev]);
    void supabaseSchoolService.upsertAnnouncement(newAnn);
  };

  const addFeeRecord = (fee: Omit<FeeRecord, 'id'>) => {
    const id = `fee-${Date.now()}`;
    const created: FeeRecord = { ...fee, id };
    setFeeRecords((prev) => [...prev, created]);
    void supabaseSchoolService.upsertFeeRecord(created);
  };

  const updateFeeRecord = (id: string, updated: Partial<FeeRecord>) => {
    setFeeRecords((prev) =>
      prev.map((f) => {
        if (f.id !== id) return f;
        const next = { ...f, ...updated };
        void supabaseSchoolService.upsertFeeRecord(next);
        return next;
      })
    );
  };

  const deleteFeeRecord = (id: string) => {
    setFeeRecords((prev) => prev.filter((f) => f.id !== id));
    void supabaseSchoolService.deleteFeeRecord(id);
  };

  // Restricted to authenticated administrators; clears ONLY local browser cache keys and NEVER deletes Supabase records
  const resetToDefaultData = () => {
    if (activeRole !== 'admin' || currentUser?.role !== 'admin') {
      console.warn('[Security] Unauthorized resetToDefaultData attempt blocked.');
      return;
    }

    purgeSensitiveLocalStorage();
    ['settings', 'news', 'gallery', 'downloads', 'announcements'].forEach((suffix) => {
      try {
        localStorage.removeItem(`${LOCAL_STORAGE_KEY}_${suffix}`);
      } catch {
        // ignore
      }
    });

    if (isSupabaseConfigured) {
      void applyPublicSnapshot();
      return;
    }

    setSystemSettings(initialSystemSettings);
    setStudents(sampleStudents);
    setTeachers(sampleTeachers);
    setParents(sampleParents);
    setClasses(sampleClasses);
    setSubjects(sampleSubjects);
    setScores(sampleScores);
    setResults(sampleTerminalResults);
    setAttendance(sampleAttendance);
    setCbtExams(sampleCBTExams);
    setCbtAttempts(sampleCBTAttempts);
    setAssignments(sampleAssignments);
    setAssignmentSubmissions([]);
    setStudyNotes(sampleNotes);
    setNewsItems(sampleNews);
    setGalleryImages(sampleGallery);
    setApplications(sampleApplications);
    setDownloads(sampleDownloads);
    setAnnouncements(sampleAnnouncements);
    setFeeRecords(sampleFeeRecords);
  };

  return (
    <SchoolContext.Provider
      value={{
        currentUser,
        activeRole,
        authLoading,
        authRecoveryMode,
        dismissAuthRecovery,
        setCurrentUser,
        switchRole,
        signInWithPassword,
        sendPasswordResetEmail,
        updatePassword,
        updateAdminAuthProfile,
        logout,
        currentView,
        setCurrentView,
        systemSettings,
        updateSystemSettings,
        adminCredentials,
        updateAdminCredentials,
        academicSessions:
          systemSettings.academicSessions || ['2026/2027', '2025/2026', '2024/2025', '2023/2024'],
        addAcademicSession,
        deleteAcademicSession,
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
        addStudent,
        updateStudent,
        deleteStudent,
        generateResultPasscodeForStudent,
        bulkGenerateResultPasscodes,
        verifyResultPasscode,
        addTeacher,
        updateTeacher,
        deleteTeacher,
        addParent,
        updateParent,
        addClass,
        addSubject,
        saveScore,
        saveBatchScores,
        publishResult,
        recordAttendance,
        createCBTExam,
        updateCBTExam,
        deleteCBTExam,
        deleteMultipleCBTExams,
        submitCBTAttempt,
        deleteCBTAttempt,
        startCBTExamSession,
        submitCBTExamSession,
        createAssignment,
        addAssignment: createAssignment,
        deleteAssignment,
        submitAssignmentAnswer,
        gradeAssignmentSubmission,
        createStudyNote,
        addStudyNote: createStudyNote,
        deleteStudyNote,
        addNewsItem,
        addGalleryImage,
        addDownloadDocument,
        submitOnlineApplication,
        updateApplicationStatus,
        sendAnnouncement,
        addFeeRecord,
        updateFeeRecord,
        deleteFeeRecord,
        resetToDefaultData,
      }}
    >
      {children}
    </SchoolContext.Provider>
  );
};

export const useSchool = () => {
  const context = useContext(SchoolContext);
  if (!context) {
    throw new Error('useSchool must be used within a SchoolProvider');
  }
  return context;
};
