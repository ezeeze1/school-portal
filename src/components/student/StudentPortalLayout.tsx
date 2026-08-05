import React, { useState } from 'react';
import { useSchool } from '../../context/SchoolContext';
import { StudentDashboard } from './StudentDashboard';
import { StudentResults } from './StudentResults';
import { StudentCBTList } from './StudentCBTList';
import { StudentAttendance } from './StudentAttendance';
import { StudentAssignments } from './StudentAssignments';
import { StudentProfile } from './StudentProfile';
import { GraduationCap, Award, Clock, Calendar, BookOpen, User, LogOut } from 'lucide-react';

export const StudentPortalLayout: React.FC = () => {
  const { currentUser, students, logout } = useSchool();
  const [activeTab, setActiveTab] = useState<string>('dashboard');

  // Find matching student record
  const currentStudent = students.find((s) => s.id === 'std-004') || students[0];

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
      {activeTab === 'dashboard' && <StudentDashboard student={currentStudent} onNavigate={(tab) => setActiveTab(tab)} />}
      {activeTab === 'results' && <StudentResults student={currentStudent} />}
      {activeTab === 'cbt' && <StudentCBTList student={currentStudent} />}
      {activeTab === 'attendance' && <StudentAttendance student={currentStudent} />}
      {activeTab === 'assignments' && <StudentAssignments student={currentStudent} />}
      {activeTab === 'profile' && <StudentProfile student={currentStudent} />}

    </div>
  );
};
