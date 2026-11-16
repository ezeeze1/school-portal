import React, { createContext, useContext, useState, useEffect } from 'react';
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
  Assignment,
  StudyNote,
  NewsItem,
  GalleryImage,
  OnlineApplication,
  DownloadDocument,
  AnnouncementNotification,
  FeeRecord,
  SystemSessionTerm,
  AdminCredentials
} from '../types';

import {
  initialSystemSettings,
  sampleUsers,
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
  sampleFeeRecords
} from '../data/initialData';
import { isSupabaseConfigured } from '../lib/supabase';
import { supabaseSchoolService } from '../services/supabaseSchoolService';

interface SchoolContextType {
  // Auth & Session State
  currentUser: User | null;
  activeRole: UserRole;
  setCurrentUser: (user: User | null) => void;
  switchRole: (role: UserRole, userObj?: User | null) => void;
  logout: () => void;

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

  // CBT Exam
  createCBTExam: (exam: Omit<CBTExam, 'id'>) => void;
  updateCBTExam: (id: string, exam: Partial<CBTExam>) => void;
  deleteCBTExam: (id: string) => void;
  deleteMultipleCBTExams: (ids: string[]) => void;
  submitCBTAttempt: (attempt: Omit<CBTAttempt, 'id'>) => void;
  deleteCBTAttempt: (id: string) => void;

  // Assignments & Notes
  createAssignment: (asg: Omit<Assignment, 'id'>) => void;
  addAssignment: (asg: Omit<Assignment, 'id'>) => void;
  deleteAssignment: (id: string) => void;
  createStudyNote: (note: Omit<StudyNote, 'id'>) => void;
  addStudyNote: (note: Omit<StudyNote, 'id'>) => void;
  deleteStudyNote: (id: string) => void;

  // Website Content
  addNewsItem: (news: Omit<NewsItem, 'id'>) => void;
  addGalleryImage: (img: Omit<GalleryImage, 'id'>) => void;
  addDownloadDocument: (doc: Omit<DownloadDocument, 'id'>) => void;

  // Applications
  submitOnlineApplication: (app: Omit<OnlineApplication, 'id' | 'applicationNumber' | 'submissionDate' | 'status'>) => string;
  updateApplicationStatus: (id: string, status: OnlineApplication['status'], notes?: string) => void;

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

const initialAdminCredentials: AdminCredentials = {
  username: 'admin',
  email: 'ezekielsamson1@gmail.com',
  password: 'sezuo2020',
  name: 'System Administrator',
};

export const SchoolProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_current_user`);
      const parsed = saved ? (JSON.parse(saved) as User | null) : null;
      return parsed && parsed.id && parsed.role ? parsed : null;
    } catch {
      return null;
    }
  });
  const [activeRole, setActiveRole] = useState<UserRole>(() => {
    try {
      const savedRole = localStorage.getItem(`${LOCAL_STORAGE_KEY}_active_role`);
      const savedUser = localStorage.getItem(`${LOCAL_STORAGE_KEY}_current_user`);
      const parsedRole: UserRole = savedRole ? JSON.parse(savedRole) : 'public';
      const parsedUser: User | null = savedUser ? JSON.parse(savedUser) : null;
      // Do not trust activeRole in localStorage unless a matching user session exists
      if (parsedRole !== 'public' && (!parsedUser || parsedUser.role !== parsedRole)) {
        return 'public';
      }
      return parsedRole;
    } catch {
      return 'public';
    }
  });
  const [currentView, setCurrentView] = useState<string>('home');

  // Admin Credentials State
  const [adminCredentials, setAdminCredentials] = useState<AdminCredentials>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_admin_creds`);
    return saved ? JSON.parse(saved) : initialAdminCredentials;
  });

  // Load state from local storage or initial mock data
  const [systemSettings, setSystemSettings] = useState<SystemSessionTerm>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_settings`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (!parsed.academicSessions || !Array.isArray(parsed.academicSessions) || parsed.academicSessions.length === 0) {
          parsed.academicSessions = ['2026/2027', '2025/2026', '2024/2025', '2023/2024'];
        }
        return parsed;
      } catch (e) {
        return initialSystemSettings;
      }
    }
    return initialSystemSettings;
  });

  const [students, setStudents] = useState<Student[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_students`);
    return saved ? JSON.parse(saved) : sampleStudents;
  });

  const [teachers, setTeachers] = useState<Teacher[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_teachers`);
    return saved ? JSON.parse(saved) : sampleTeachers;
  });

  const [parents, setParents] = useState<Parent[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_parents`);
    return saved ? JSON.parse(saved) : sampleParents;
  });

  const [classes, setClasses] = useState<SchoolClass[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_classes`);
    return saved ? JSON.parse(saved) : sampleClasses;
  });

  const [subjects, setSubjects] = useState<Subject[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_subjects`);
    return saved ? JSON.parse(saved) : sampleSubjects;
  });

  const [scores, setScores] = useState<ScoreRecord[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_scores`);
    return saved ? JSON.parse(saved) : sampleScores;
  });

  const [results, setResults] = useState<TerminalResult[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_results`);
    return saved ? JSON.parse(saved) : sampleTerminalResults;
  });

  const [attendance, setAttendance] = useState<AttendanceRecord[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_attendance`);
    return saved ? JSON.parse(saved) : sampleAttendance;
  });

  const [cbtExams, setCbtExams] = useState<CBTExam[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_cbtExams`);
    return saved ? JSON.parse(saved) : sampleCBTExams;
  });

  const [cbtAttempts, setCbtAttempts] = useState<CBTAttempt[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_cbtAttempts`);
    return saved ? JSON.parse(saved) : sampleCBTAttempts;
  });

  const [assignments, setAssignments] = useState<Assignment[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_assignments`);
    return saved ? JSON.parse(saved) : sampleAssignments;
  });

  const [studyNotes, setStudyNotes] = useState<StudyNote[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_notes`);
    return saved ? JSON.parse(saved) : sampleNotes;
  });

  const [newsItems, setNewsItems] = useState<NewsItem[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_news`);
    return saved ? JSON.parse(saved) : sampleNews;
  });

  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_gallery`);
    return saved ? JSON.parse(saved) : sampleGallery;
  });

  const [applications, setApplications] = useState<OnlineApplication[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_apps`);
    return saved ? JSON.parse(saved) : sampleApplications;
  });

  const [downloads, setDownloads] = useState<DownloadDocument[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_downloads`);
    return saved ? JSON.parse(saved) : sampleDownloads;
  });

  const [announcements, setAnnouncements] = useState<AnnouncementNotification[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_announcements`);
    return saved ? JSON.parse(saved) : sampleAnnouncements;
  });

  const [feeRecords, setFeeRecords] = useState<FeeRecord[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_fees`);
    return saved ? JSON.parse(saved) : sampleFeeRecords;
  });

  // Hydrate existing data from Supabase if configured (non-destructive: never overwrites with sample data)
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    let isMounted = true;
    supabaseSchoolService.fetchPortalSnapshot().then((snapshot) => {
      if (!isMounted) return;
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
      if (snapshot.students) setStudents(snapshot.students);
      if (snapshot.teachers) setTeachers(snapshot.teachers);
      if (snapshot.parents) setParents(snapshot.parents);
      if (snapshot.classes) setClasses(snapshot.classes);
      if (snapshot.subjects) setSubjects(snapshot.subjects);
      if (snapshot.scores) setScores(snapshot.scores);
      if (snapshot.results) setResults(snapshot.results);
      if (snapshot.attendance) setAttendance(snapshot.attendance);
      if (snapshot.cbtExams) setCbtExams(snapshot.cbtExams);
      if (snapshot.cbtAttempts) setCbtAttempts(snapshot.cbtAttempts);
      if (snapshot.assignments) setAssignments(snapshot.assignments);
      if (snapshot.studyNotes) setStudyNotes(snapshot.studyNotes);
      if (snapshot.newsItems) setNewsItems(snapshot.newsItems);
      if (snapshot.galleryImages) setGalleryImages(snapshot.galleryImages);
      if (snapshot.applications) setApplications(snapshot.applications);
      if (snapshot.downloads) setDownloads(snapshot.downloads);
      if (snapshot.announcements) setAnnouncements(snapshot.announcements);
      if (snapshot.feeRecords) setFeeRecords(snapshot.feeRecords);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  // Persist handlers
  useEffect(() => {
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_admin_creds`, JSON.stringify(adminCredentials));
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_settings`, JSON.stringify(systemSettings));
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_students`, JSON.stringify(students));
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_teachers`, JSON.stringify(teachers));
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_parents`, JSON.stringify(parents));
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_classes`, JSON.stringify(classes));
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_subjects`, JSON.stringify(subjects));
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_scores`, JSON.stringify(scores));
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_results`, JSON.stringify(results));
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_attendance`, JSON.stringify(attendance));
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_cbtExams`, JSON.stringify(cbtExams));
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_cbtAttempts`, JSON.stringify(cbtAttempts));
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_assignments`, JSON.stringify(assignments));
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_notes`, JSON.stringify(studyNotes));
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_news`, JSON.stringify(newsItems));
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_gallery`, JSON.stringify(galleryImages));
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_apps`, JSON.stringify(applications));
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_downloads`, JSON.stringify(downloads));
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_announcements`, JSON.stringify(announcements));
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_fees`, JSON.stringify(feeRecords));
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_current_user`, JSON.stringify(currentUser));
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_active_role`, JSON.stringify(activeRole));
  }, [
    currentUser,
    activeRole,
    adminCredentials,
    systemSettings,
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
  ]);

  // Role switching
  const switchRole = (role: UserRole, userObj?: User | null) => {
    setActiveRole(role);
    if (role === 'public') {
      setCurrentUser(null);
      setCurrentView('home');
      return;
    }

    if (userObj) {
      setCurrentUser(userObj);
    } else if (role === 'admin') {
      setCurrentUser({
        id: 'usr-admin',
        name: adminCredentials.name || 'System Administrator',
        email: adminCredentials.email || adminCredentials.username || 'ezekielsamson1@gmail.com',
        role: 'admin',
        avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=200',
        referenceId: 'ADM-001',
      });
    } else if (role === 'teacher') {
      const teacherObj = teachers[0];
      setCurrentUser({
        id: teacherObj?.id || 'tch-102',
        name: teacherObj ? `${teacherObj.firstName} ${teacherObj.lastName}` : 'Mr. David Adams',
        email: teacherObj?.email || 'david.adams@divineacademy.edu',
        role: 'teacher',
        avatar: teacherObj?.avatar || 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&q=80&w=200',
        referenceId: teacherObj?.staffId || 'TCH-102',
      });
    } else if (role === 'student') {
      const studentObj = students[0];
      setCurrentUser({
        id: studentObj?.id || 'std-004',
        name: studentObj ? `${studentObj.firstName} ${studentObj.lastName}` : 'David Adeleke',
        email: studentObj?.parentEmail || 'david.adeleke@student.divineacademy.edu',
        role: 'student',
        avatar: studentObj?.avatar || 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&q=80&w=200',
        referenceId: studentObj?.admissionNo || 'STD/2025/004',
      });
    } else if (role === 'parent') {
      const parentObj = parents[0];
      setCurrentUser({
        id: parentObj?.id || 'prt-409',
        name: parentObj ? (parentObj.title ? `${parentObj.title} ${parentObj.fullName}` : parentObj.fullName) : 'Chief Olabisi Adeleke',
        email: parentObj?.email || 'parent.adeleke@gmail.com',
        role: 'parent',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=200',
        referenceId: parentObj?.parentId || 'PRT-409',
      });
    }

    if (role === 'teacher') setCurrentView('teacher-portal');
    else if (role === 'student') setCurrentView('student-portal');
    else if (role === 'parent') setCurrentView('parent-portal');
    else if (role === 'admin') setCurrentView('admin-portal');
  };

  const logout = () => {
    setCurrentUser(null);
    setActiveRole('public');
    setCurrentView('home');
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
      const next = { ...prev, ...updated };
      if (currentUser?.role === 'admin') {
        setCurrentUser((curr) => curr ? {
          ...curr,
          name: next.name || curr.name,
          email: next.email || curr.email,
        } : null);
      }
      return next;
    });
  };

  // CRUD Implementations
  const addStudent = (newStudent: Omit<Student, 'id'>) => {
    const id = `std-${Date.now()}`;
    const created = { ...newStudent, id };
    setStudents((prev) => [...prev, created]);
    void supabaseSchoolService.upsertStudent(created);
  };

  const updateStudent = (id: string, updated: Partial<Student>) => {
    setStudents((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        const next = { ...s, ...updated };
        void supabaseSchoolService.upsertStudent(next);
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
    const newCode = generateAlphanumericPasscode();
    setStudents((prev) =>
      prev.map((s) => {
        if (s.id !== studentId) return s;
        const next = { ...s, resultPasscode: newCode };
        void supabaseSchoolService.upsertStudent(next);
        return next;
      })
    );
    return newCode;
  };

  const bulkGenerateResultPasscodes = () => {
    setStudents((prev) => {
      const nextList = prev.map((s) => ({
        ...s,
        resultPasscode: s.resultPasscode || generateAlphanumericPasscode(),
      }));
      void supabaseSchoolService.upsertStudents(nextList);
      return nextList;
    });
  };

  const deleteStudent = (id: string) => {
    setStudents((prev) => prev.filter((s) => s.id !== id));
    void supabaseSchoolService.deleteStudent(id);
  };

  const addTeacher = (newTeacher: Omit<Teacher, 'id'>) => {
    const id = `tch-${Date.now()}`;
    const created = { ...newTeacher, id };
    setTeachers((prev) => [...prev, created]);
    void supabaseSchoolService.upsertTeacher(created);
  };

  const updateTeacher = (id: string, updated: Partial<Teacher>) => {
    setTeachers((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        const next = { ...t, ...updated };
        void supabaseSchoolService.upsertTeacher(next);
        return next;
      })
    );
  };

  const deleteTeacher = (id: string) => {
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
      const created = { ...sanitizedScoreData, id: `sc-${Date.now()}-${Math.random().toString(36).substr(2, 4)}` };
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
    void supabaseSchoolService.upsertCBTAttempt(created);
  };

  const deleteCBTAttempt = (id: string) => {
    setCbtAttempts((prev) => prev.filter((a) => a.id !== id));
    void supabaseSchoolService.deleteCBTAttempt(id);
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

  const updateApplicationStatus = (id: string, status: OnlineApplication['status'], notes?: string) => {
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

    const keysToRemove = [
      'settings',
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
      'notes',
      'news',
      'gallery',
      'apps',
      'downloads',
      'announcements',
      'fees',
    ];
    keysToRemove.forEach((suffix) => {
      localStorage.removeItem(`${LOCAL_STORAGE_KEY}_${suffix}`);
    });

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
        setCurrentUser,
        switchRole,
        logout,
        currentView,
        setCurrentView,
        systemSettings,
        updateSystemSettings,
        adminCredentials,
        updateAdminCredentials,
        academicSessions: systemSettings.academicSessions || ['2026/2027', '2025/2026', '2024/2025', '2023/2024'],
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
        createAssignment,
        addAssignment: createAssignment,
        deleteAssignment,
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
