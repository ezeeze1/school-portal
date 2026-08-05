import React, { useState } from 'react';
import { AdminDashboard } from './AdminDashboard';
import { StudentManager } from './StudentManager';
import { TeacherManager } from './TeacherManager';
import { ApplicationsManager } from './ApplicationsManager';
import { AcademicSessionManager } from './AcademicSessionManager';
import { SubjectManager } from './SubjectManager';
import { LayoutDashboard, GraduationCap, Users, FileText, Settings, ShieldCheck, BookOpen } from 'lucide-react';

export const AdminPortalLayout: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');

  const tabs = [
    { id: 'dashboard', label: 'Dashboard Overview', icon: LayoutDashboard },
    { id: 'students', label: 'Student SIS Manager', icon: GraduationCap },
    { id: 'teachers', label: 'Staff & Faculty', icon: Users },
    { id: 'subjects', label: 'Curriculum & Subjects', icon: BookOpen },
    { id: 'applications', label: 'Online Applications Desk', icon: FileText },
    { id: 'sessions', label: 'Sessions & Settings', icon: Settings },
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

      {activeTab === 'dashboard' && <AdminDashboard onNavigate={(tab) => setActiveTab(tab)} />}
      {activeTab === 'students' && <StudentManager />}
      {activeTab === 'teachers' && <TeacherManager />}
      {activeTab === 'subjects' && <SubjectManager />}
      {activeTab === 'applications' && <ApplicationsManager />}
      {activeTab === 'sessions' && <AcademicSessionManager />}

    </div>
  );
};

