import React, { useState } from 'react';
import { useSchool } from '../../context/SchoolContext';
import { TeacherDashboard } from './TeacherDashboard';
import { ScoreEntrySheet } from './ScoreEntrySheet';
import { CBTQuestionBankBuilder } from './CBTQuestionBankBuilder';
import { PastQuestionsBank } from './PastQuestionsBank';
import { AttendanceRecorder } from './AttendanceRecorder';
import { AssignmentsManager } from './AssignmentsManager';
import { TeacherAnnouncements } from './TeacherAnnouncements';
import { StudentManager } from '../admin/StudentManager';
import {
  LayoutDashboard,
  FileSpreadsheet,
  Clock,
  Archive,
  Users,
  BookOpen,
  Bell,
  GraduationCap,
  AlertCircle,
  LogOut,
} from 'lucide-react';

export const TeacherPortalLayout: React.FC = () => {
  const { currentUser, teachers, logout } = useSchool();
  const [activeTab, setActiveTab] = useState('dashboard');

  const currentTeacher = currentUser
    ? teachers.find(
        (t) =>
          (currentUser.authUserId && t.authUserId === currentUser.authUserId) ||
          t.id === currentUser.id ||
          (currentUser.referenceId &&
            t.staffId?.toLowerCase() === currentUser.referenceId.toLowerCase()) ||
          (currentUser.email && t.email.toLowerCase() === currentUser.email.toLowerCase())
      ) ||
      teachers.find(
        (t) => `${t.firstName} ${t.lastName}`.toLowerCase() === currentUser.name?.toLowerCase()
      )
    : undefined;

  if (!currentTeacher) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-10 text-center space-y-4 shadow-xl">
          <div className="w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800 flex items-center justify-center mx-auto">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="font-serif font-bold text-2xl text-slate-900 dark:text-white">
            Teacher Profile Not Linked
          </h2>
          <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
            Your Supabase account ({currentUser?.email || 'signed-in user'}) is not linked to an
            active faculty record yet. Please contact the school administrator to link your Staff ID
            and email address.
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
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'students', label: 'Class Student Roster', icon: GraduationCap },
    { id: 'scores', label: 'Enter Scores', icon: FileSpreadsheet },
    { id: 'cbt', label: 'CBT Exam Builder', icon: Clock },
    { id: 'pastquestions', label: 'Past Questions Space', icon: Archive },
    { id: 'attendance', label: 'Daily Roll Call', icon: Users },
    { id: 'assignments', label: 'Assignments & Notes', icon: BookOpen },
    { id: 'announcements', label: 'Broadcast Alerts', icon: Bell },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Navigation Ribbon */}
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

      {activeTab === 'dashboard' && (
        <TeacherDashboard teacher={currentTeacher} onNavigate={(tab) => setActiveTab(tab)} />
      )}
      {activeTab === 'students' && <StudentManager readOnly={true} />}
      {activeTab === 'scores' && <ScoreEntrySheet />}
      {activeTab === 'cbt' && <CBTQuestionBankBuilder />}
      {activeTab === 'pastquestions' && <PastQuestionsBank />}
      {activeTab === 'attendance' && <AttendanceRecorder />}
      {activeTab === 'assignments' && <AssignmentsManager />}
      {activeTab === 'announcements' && <TeacherAnnouncements />}
    </div>
  );
};
