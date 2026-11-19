import React, { useState } from 'react';
import { AdminDashboard } from './AdminDashboard';
import { ClassManager } from './ClassManager';
import { StudentManager } from './StudentManager';
import { TeacherManager } from './TeacherManager';
import { ParentManager } from './ParentManager';
import { ApplicationsManager } from './ApplicationsManager';
import { AcademicSessionManager } from './AcademicSessionManager';
import { SubjectManager } from './SubjectManager';
import {
  LayoutDashboard,
  School,
  GraduationCap,
  Users,
  UserCheck,
  FileText,
  Settings,
  ShieldCheck,
  BookOpen,
} from 'lucide-react';

export const AdminPortalLayout: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');

  const tabs = [
    { id: 'dashboard', label: 'Dashboard Overview', icon: LayoutDashboard },
    { id: 'classes', label: 'Class Management', icon: School },
    { id: 'students', label: 'Student SIS Manager', icon: GraduationCap },
    { id: 'teachers', label: 'Staff & Faculty', icon: Users },
    { id: 'parents', label: 'Parents & Guardians', icon: UserCheck },
    { id: 'subjects', label: 'Curriculum & Subjects', icon: BookOpen },
    { id: 'applications', label: 'Online Applications Desk', icon: FileText },
    { id: 'sessions', label: 'Sessions & Settings', icon: Settings },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-10">
      <div className="flex flex-col lg:flex-row items-start gap-6 lg:gap-8">
        {/* Administrator Sidebar Navigation (Desktop) & Horizontal Bar (Mobile/Tablet) */}
        <aside
          aria-label="Administrator Navigation"
          className="w-full lg:w-64 shrink-0 lg:sticky lg:top-24"
        >
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-3 lg:p-4 shadow-sm space-y-2">
            <div className="hidden lg:flex items-center gap-2 px-3 py-2 border-b border-slate-100 dark:border-slate-800 mb-2">
              <ShieldCheck className="w-4 h-4 text-amber-500 shrink-0" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Admin Portal Menu
              </span>
            </div>

            <nav className="flex lg:flex-col items-center lg:items-stretch gap-2 overflow-x-auto lg:overflow-visible pb-1 lg:pb-0 scrollbar-none">
              {tabs.map((t) => {
                const Icon = t.icon;
                const isActive = activeTab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setActiveTab(t.id)}
                    className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2.5 flex-shrink-0 lg:w-full text-left ${
                      isActive
                        ? 'bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950 shadow-md'
                        : 'bg-slate-50 dark:bg-slate-800/60 lg:bg-transparent lg:dark:bg-transparent text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 lg:border-transparent hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </aside>

        {/* Active Administrator Workspace */}
        <div className="flex-1 min-w-0 w-full">
          {activeTab === 'dashboard' && <AdminDashboard onNavigate={(tab) => setActiveTab(tab)} />}
          {activeTab === 'classes' && <ClassManager />}
          {activeTab === 'students' && (
            <StudentManager onNavigateToClasses={() => setActiveTab('classes')} />
          )}
          {activeTab === 'teachers' && <TeacherManager />}
          {activeTab === 'parents' && <ParentManager />}
          {activeTab === 'subjects' && <SubjectManager />}
          {activeTab === 'applications' && <ApplicationsManager />}
          {activeTab === 'sessions' && <AcademicSessionManager />}
        </div>
      </div>
    </div>
  );
};


