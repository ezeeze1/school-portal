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

interface SchoolContextType {
  // Auth & Session State
  currentUser: User | null;
  activeRole: UserRole;
  setCurrentUser: (user: User | null) => void;
  switchRole: (role: UserRole) => void;
  logout: () => void;

  // Active View Navigation
  currentView: string;
  setCurrentView: (view: string) => void;

  // System Settings & Security
  systemSettings: SystemSessionTerm;
  updateSystemSettings: (settings: Partial<SystemSessionTerm>) => void;
  adminCredentials: AdminCredentials;
  updateAdminCredentials: (credentials: Partial<AdminCredentials>) => void;

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
  createStudyNote: (note: Omit<StudyNote, 'id'>) => void;

  // Website Content
  addNewsItem: (news: Omit<NewsItem, 'id'>) => void;
  addGalleryImage: (img: Omit<GalleryImage, 'id'>) => void;
  addDownloadDocument: (doc: Omit<DownloadDocument, 'id'>) => void;

  // Applications
  submitOnlineApplication: (app: Omit<OnlineApplication, 'id' | 'applicationNumber' | 'submissionDate' | 'status'>) => string;
  updateApplicationStatus: (id: string, status: OnlineApplication['status'], notes?: string) => void;

  // Announcements
  sendAnnouncement: (ann: Omit<AnnouncementNotification, 'id' | 'date'>) => void;

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
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeRole, setActiveRole] = useState<UserRole>('public');
  const [currentView, setCurrentView] = useState<string>('home');

  // Admin Credentials State
  const [adminCredentials, setAdminCredentials] = useState<AdminCredentials>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_admin_creds`);
    return saved ? JSON.parse(saved) : initialAdminCredentials;
  });

  // Load state from local storage or initial mock data
  const [systemSettings, setSystemSettings] = useState<SystemSessionTerm>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_settings`);
    return saved ? JSON.parse(saved) : initialSystemSettings;
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

  const [feeRecords] = useState<FeeRecord[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_fees`);
    return saved ? JSON.parse(saved) : sampleFeeRecords;
  });

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
  }, [
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
  ]);

  // Role switching
  const switchRole = (role: UserRole) => {
    setActiveRole(role);
    if (role === 'public') {
      setCurrentUser(null);
      setCurrentView('home');
    } else if (role === 'admin') {
      setCurrentUser({
        id: 'usr-admin',
        name: adminCredentials.name || 'System Administrator',
        email: adminCredentials.email || adminCredentials.username || 'ezekielsamson1@gmail.com',
        role: 'admin',
      });
      setCurrentView('admin-portal');
    } else {
      const demoUser = sampleUsers.find((u) => u.role === role);
      if (demoUser) {
        setCurrentUser(demoUser);
      }
      if (role === 'teacher') setCurrentView('teacher-portal');
      else if (role === 'student') setCurrentView('student-portal');
      else if (role === 'parent') setCurrentView('parent-portal');
    }
  };

  const logout = () => {
    setCurrentUser(null);
    setActiveRole('public');
    setCurrentView('home');
  };

  const updateSystemSettings = (updated: Partial<SystemSessionTerm>) => {
    setSystemSettings((prev) => ({ ...prev, ...updated }));
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
    setStudents((prev) => [...prev, { ...newStudent, id }]);
  };

  const updateStudent = (id: string, updated: Partial<Student>) => {
    setStudents((prev) => prev.map((s) => (s.id === id ? { ...s, ...updated } : s)));
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
      prev.map((s) => (s.id === studentId ? { ...s, resultPasscode: newCode } : s))
    );
    return newCode;
  };

  const bulkGenerateResultPasscodes = () => {
    setStudents((prev) =>
      prev.map((s) => ({
        ...s,
        resultPasscode: s.resultPasscode || generateAlphanumericPasscode(),
      }))
    );
  };

  const deleteStudent = (id: string) => {
    setStudents((prev) => prev.filter((s) => s.id !== id));
  };

  const addTeacher = (newTeacher: Omit<Teacher, 'id'>) => {
    const id = `tch-${Date.now()}`;
    setTeachers((prev) => [...prev, { ...newTeacher, id }]);
  };

  const updateTeacher = (id: string, updated: Partial<Teacher>) => {
    setTeachers((prev) => prev.map((t) => (t.id === id ? { ...t, ...updated } : t)));
  };

  const deleteTeacher = (id: string) => {
    setTeachers((prev) => prev.filter((t) => t.id !== id));
  };

  const addParent = (newParent: Omit<Parent, 'id'>) => {
    const id = `prt-${Date.now()}`;
    setParents((prev) => [...prev, { ...newParent, id }]);
  };

  const updateParent = (id: string, updated: Partial<Parent>) => {
    setParents((prev) => prev.map((p) => (p.id === id ? { ...p, ...updated } : p)));
  };

  const addClass = (cls: Omit<SchoolClass, 'id'>) => {
    const id = `cls-${Date.now()}`;
    setClasses((prev) => [...prev, { ...cls, id }]);
  };

  const addSubject = (subj: Omit<Subject, 'id'>) => {
    const id = `sub-${Date.now()}`;
    setSubjects((prev) => [...prev, { ...subj, id }]);
  };

  const saveScore = (scoreData: Omit<ScoreRecord, 'id'>) => {
    setScores((prev) => {
      const existingIdx = prev.findIndex(
        (s) =>
          s.studentId === scoreData.studentId &&
          s.subjectId === scoreData.subjectId &&
          s.sessionId === scoreData.sessionId &&
          s.term === scoreData.term
      );
      if (existingIdx >= 0) {
        const updated = [...prev];
        updated[existingIdx] = { ...scoreData, id: prev[existingIdx].id };
        return updated;
      }
      return [...prev, { ...scoreData, id: `sc-${Date.now()}-${Math.random().toString(36).substr(2, 4)}` }];
    });
  };

  const saveBatchScores = (scoresList: Omit<ScoreRecord, 'id'>[]) => {
    scoresList.forEach((scoreItem) => saveScore(scoreItem));
  };

  const publishResult = (resultData: TerminalResult) => {
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
  };

  const createCBTExam = (exam: Omit<CBTExam, 'id'>) => {
    const id = `cbt-${Date.now()}`;
    setCbtExams((prev) => [...prev, { ...exam, id }]);
  };

  const updateCBTExam = (id: string, updated: Partial<CBTExam>) => {
    setCbtExams((prev) => prev.map((e) => (e.id === id ? { ...e, ...updated } : e)));
  };

  const deleteCBTExam = (id: string) => {
    setCbtExams((prev) => prev.filter((e) => e.id !== id));
    setCbtAttempts((prev) => prev.filter((a) => a.examId !== id));
  };

  const deleteMultipleCBTExams = (ids: string[]) => {
    setCbtExams((prev) => prev.filter((e) => !ids.includes(e.id)));
    setCbtAttempts((prev) => prev.filter((a) => !ids.includes(a.examId)));
  };

  const submitCBTAttempt = (attempt: Omit<CBTAttempt, 'id'>) => {
    const id = `attmpt-${Date.now()}`;
    setCbtAttempts((prev) => [...prev, { ...attempt, id }]);
  };

  const deleteCBTAttempt = (id: string) => {
    setCbtAttempts((prev) => prev.filter((a) => a.id !== id));
  };

  const createAssignment = (asg: Omit<Assignment, 'id'>) => {
    const id = `asg-${Date.now()}`;
    setAssignments((prev) => [...prev, { ...asg, id }]);
  };

  const createStudyNote = (note: Omit<StudyNote, 'id'>) => {
    const id = `note-${Date.now()}`;
    setStudyNotes((prev) => [...prev, { ...note, id }]);
  };

  const addNewsItem = (news: Omit<NewsItem, 'id'>) => {
    const id = `news-${Date.now()}`;
    setNewsItems((prev) => [...prev, { ...news, id }]);
  };

  const addGalleryImage = (img: Omit<GalleryImage, 'id'>) => {
    const id = `gal-${Date.now()}`;
    setGalleryImages((prev) => [...prev, { ...img, id }]);
  };

  const addDownloadDocument = (doc: Omit<DownloadDocument, 'id'>) => {
    const id = `dl-${Date.now()}`;
    setDownloads((prev) => [...prev, { ...doc, id }]);
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
    return appNum;
  };

  const updateApplicationStatus = (id: string, status: OnlineApplication['status'], notes?: string) => {
    setApplications((prev) =>
      prev.map((app) => (app.id === id ? { ...app, status, notes: notes || app.notes } : app))
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
  };

  const resetToDefaultData = () => {
    localStorage.clear();
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
        createStudyNote,
        addNewsItem,
        addGalleryImage,
        addDownloadDocument,
        submitOnlineApplication,
        updateApplicationStatus,
        sendAnnouncement,
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
