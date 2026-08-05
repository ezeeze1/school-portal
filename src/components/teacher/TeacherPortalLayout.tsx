import React, { useState } from 'react';
import { TeacherDashboard } from './TeacherDashboard';
import { ScoreEntrySheet } from './ScoreEntrySheet';
import { CBTQuestionBankBuilder } from './CBTQuestionBankBuilder';
import { PastQuestionsBank } from './PastQuestionsBank';
import { AttendanceRecorder } from './AttendanceRecorder';
import { AssignmentsManager } from './AssignmentsManager';
import { TeacherAnnouncements } from './TeacherAnnouncements';
import { StudentManager } from '../admin/StudentManager';
import { LayoutDashboard, FileSpreadsheet, Clock, Archive, Users, BookOpen, Bell, GraduationCap } from 'lucide-react';

export const TeacherPortalLayout: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'students', label: 'Student Roster & Enroll', icon: GraduationCap },
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

      {activeTab === 'dashboard' && <TeacherDashboard onNavigate={(tab) => setActiveTab(tab)} />}
      {activeTab === 'students' && <StudentManager />}
      {activeTab === 'scores' && <ScoreEntrySheet />}
      {activeTab === 'cbt' && <CBTQuestionBankBuilder />}
      {activeTab === 'pastquestions' && <PastQuestionsBank />}
      {activeTab === 'attendance' && <AttendanceRecorder />}
      {activeTab === 'assignments' && <AssignmentsManager />}
      {activeTab === 'announcements' && <TeacherAnnouncements />}

    </div>
  );
};
