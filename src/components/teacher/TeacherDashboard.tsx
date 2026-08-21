import React from 'react';
import { useSchool } from '../../context/SchoolContext';
import { Users, FileSpreadsheet, Clock, Archive, BookOpen, GraduationCap, UserPlus, Send, FileText } from 'lucide-react';

export const TeacherDashboard: React.FC<{ onNavigate: (tab: string) => void }> = ({ onNavigate }) => {
  const { students, cbtExams, assignments, systemSettings } = useSchool();

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      
      {/* Welcome Banner */}
      <div className="bg-slate-900 text-white rounded-3xl p-8 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-2xl">
        <div className="space-y-1">
          <span className="text-amber-400 font-bold text-xs uppercase tracking-wider">
            Faculty Member Portal • SS 2 Form Teacher
          </span>
          <h1 className="font-serif font-bold text-2xl sm:text-3xl">
            Welcome, Dr. (Mrs.) Victoria Adebayo
          </h1>
          <p className="text-xs text-slate-400">
            Current Session: {systemSettings.currentSession} ({systemSettings.currentTerm})
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => onNavigate('assignments')}
            className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black px-5 py-3 rounded-xl text-xs flex items-center gap-2 shadow-lg transition-transform active:scale-95 cursor-pointer"
          >
            <Send className="w-4 h-4" /> Send Assignment
          </button>
          <button
            onClick={() => onNavigate('students')}
            className="bg-slate-800 hover:bg-slate-700 text-white font-bold px-4 py-3 rounded-xl text-xs flex items-center gap-2 border border-slate-700"
          >
            <UserPlus className="w-4 h-4" /> Enroll Student
          </button>
          <button
            onClick={() => onNavigate('scores')}
            className="bg-slate-800 hover:bg-slate-700 text-white font-bold px-4 py-3 rounded-xl text-xs flex items-center gap-2 border border-slate-700"
          >
            <FileSpreadsheet className="w-4 h-4" /> Enter Scores
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        
        <div
          onClick={() => onNavigate('students')}
          className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-1 shadow-sm cursor-pointer hover:border-amber-400 transition-colors"
        >
          <span className="text-xs font-bold uppercase text-slate-500">Enrolled Students</span>
          <p className="font-serif font-black text-3xl text-slate-900 dark:text-white">{students.length}</p>
          <p className="text-[11px] text-amber-600 font-semibold">+ Add / Edit Students</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-1 shadow-sm">
          <span className="text-xs font-bold uppercase text-slate-500">Created CBT Exams</span>
          <p className="font-serif font-black text-3xl text-amber-500">{cbtExams.length}</p>
          <p className="text-[11px] text-slate-500">Question banks active</p>
        </div>

        <div
          onClick={() => onNavigate('assignments')}
          className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-1 shadow-sm cursor-pointer hover:border-amber-400 transition-colors"
        >
          <span className="text-xs font-bold uppercase text-slate-500 font-semibold">Active Assignments</span>
          <p className="font-serif font-black text-3xl text-blue-600">{assignments.length}</p>
          <p className="text-[11px] text-amber-600 font-semibold">+ Send Text / Word / PDF</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-1 shadow-sm">
          <span className="text-xs font-bold uppercase text-slate-500">Daily Attendance</span>
          <p className="font-serif font-black text-3xl text-emerald-600">Complete</p>
          <p className="text-[11px] text-slate-500">Roll call up to date</p>
        </div>

      </div>

      {/* Shortcut Buttons */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-md">
        <h3 className="font-serif font-bold text-lg text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-3">
          Teacher Management Workflows
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <button
            onClick={() => onNavigate('assignments')}
            className="p-5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/40 text-left space-y-2 transition-all border border-amber-200 dark:border-amber-800/50 shadow-sm hover:shadow"
          >
            <div className="flex items-center justify-between">
              <Send className="w-6 h-6 text-amber-600 dark:text-amber-400" />
              <span className="text-[10px] font-black uppercase tracking-wider bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-200 px-2 py-0.5 rounded">NEW</span>
            </div>
            <p className="font-bold text-sm text-slate-900 dark:text-white">Send Assignment to Students</p>
            <p className="text-xs text-slate-500">Post homework tasks in Text, Word (.docx), or PDF (.pdf) format</p>
          </button>

          <button
            onClick={() => onNavigate('students')}
            className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-left space-y-2 transition-all border border-slate-200 dark:border-slate-700"
          >
            <GraduationCap className="w-6 h-6 text-amber-500" />
            <p className="font-bold text-sm text-slate-900 dark:text-white">Enroll & Manage Students</p>
            <p className="text-xs text-slate-500">Add student profiles & passwords</p>
          </button>

          <button
            onClick={() => onNavigate('scores')}
            className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-left space-y-2 transition-all border border-slate-200 dark:border-slate-700"
          >
            <FileSpreadsheet className="w-6 h-6 text-blue-500" />
            <p className="font-bold text-sm text-slate-900 dark:text-white">Score Entry Sheet</p>
            <p className="text-xs text-slate-500">Record CA1, CA2 & Exam scores</p>
          </button>

          <button
            onClick={() => onNavigate('cbt')}
            className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-left space-y-2 transition-all border border-slate-200 dark:border-slate-700"
          >
            <Clock className="w-6 h-6 text-emerald-500" />
            <p className="font-bold text-sm text-slate-900 dark:text-white">CBT Question Builder</p>
            <p className="text-xs text-slate-500">Create tests or import Excel</p>
          </button>

          <button
            onClick={() => onNavigate('pastquestions')}
            className="p-5 rounded-2xl bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-100 dark:hover:bg-purple-900/40 text-left space-y-2 transition-all border border-purple-200 dark:border-purple-800/50"
          >
            <Archive className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            <p className="font-bold text-sm text-slate-900 dark:text-white">Past Questions Space</p>
            <p className="text-xs text-slate-500">Filter by Class, Term & Session</p>
          </button>

          <button
            onClick={() => onNavigate('attendance')}
            className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-left space-y-2 transition-all border border-slate-200 dark:border-slate-700"
          >
            <Users className="w-6 h-6 text-indigo-500" />
            <p className="font-bold text-sm text-slate-900 dark:text-white">Daily Attendance</p>
            <p className="text-xs text-slate-500">Take roll call for class</p>
          </button>
        </div>
      </div>
    </div>
  );
};
