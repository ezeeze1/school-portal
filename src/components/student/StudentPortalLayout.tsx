import React, { useState } from 'react';
import { useSchool } from '../../context/SchoolContext';
import { StudentDashboard } from './StudentDashboard';
import { StudentResults } from './StudentResults';
import { StudentCBTList } from './StudentCBTList';
import { StudentAttendance } from './StudentAttendance';
import { StudentAssignments } from './StudentAssignments';
import { StudentProfile } from './StudentProfile';
import {
  GraduationCap,
  Award,
  Clock,
  Calendar,
  BookOpen,
  User,
  LogOut,
  AlertCircle,
} from 'lucide-react';

export const StudentPortalLayout: React.FC = () => {
  const { currentUser, students, logout } = useSchool();
  const [activeTab, setActiveTab] = useState<string>('dashboard');

  // Strictly match authenticated student record without falling back to another student
  const currentStudent = currentUser
    ? students.find(
        (s) =>
          (currentUser.authUserId && s.authUserId === currentUser.authUserId) ||
          s.id === currentUser.id ||
          (currentUser.referenceId &&
            (s.admissionNo?.toLowerCase() === currentUser.referenceId.toLowerCase() ||
              s.id === currentUser.referenceId)) ||
          (currentUser.email && s.email?.toLowerCase() === currentUser.email.toLowerCase())
      ) ||
      students.find(
        (s) => `${s.firstName} ${s.lastName}`.toLowerCase() === currentUser.name?.toLowerCase()
      )
    : undefined;

  React.useEffect(() => {
    if (!currentStudent?.id) return;
    try {
      if (sessionStorage.getItem(`cbt_active_exam_${currentStudent.id}`)) {
        setActiveTab('cbt');
      }
    } catch {
      // Ignore storage access errors
    }
  }, [currentStudent?.id]);

  if (!currentStudent) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-10 text-center space-y-4 shadow-xl">
          <div className="w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800 flex items-center justify-center mx-auto">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="font-serif font-bold text-2xl text-slate-900 dark:text-white">
            Student Profile Not Linked
          </h2>
          <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
            Your Supabase account ({currentUser?.referenceId || currentUser?.email || 'signed-in student'}) is not linked to an
            enrolled student profile yet. Please contact the school administration office to link
            your Admission Number.
          </p>
          <button
            onClick={() => void logout()}
            className="inline-flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-bold px-5 py-2.5 rounded-xl text-xs"
          >
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: GraduationCap },
    { id: 'results', label: 'Check Results & Report Cards', icon: Award },
    { id: 'cbt', label: 'CBT Online Exams', icon: Clock },
    { id: 'attendance', label: 'Attendance Record', icon: Calendar },
    { id: 'assignments', label: 'Assignments & Notes', icon: BookOpen },
    { id: 'profile', label: 'Student Profile', icon: User },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Tab Navigation Ribbon */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-200 dark:border-slate-800 scrollbar-none">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 flex-shrink-0 ${
                activeTab === t.id
                  ? 'bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950 shadow-md'
                  : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Render Active View */}
      {activeTab === 'dashboard' && (
        <StudentDashboard student={currentStudent} onNavigate={(tab) => setActiveTab(tab)} />
      )}
      {activeTab === 'results' && <StudentResults student={currentStudent} />}
      {activeTab === 'cbt' && <StudentCBTList student={currentStudent} />}
      {activeTab === 'attendance' && <StudentAttendance student={currentStudent} />}
      {activeTab === 'assignments' && <StudentAssignments student={currentStudent} />}
      {activeTab === 'profile' && <StudentProfile student={currentStudent} />}
    </div>
  );
};
