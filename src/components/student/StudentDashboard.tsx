import React from 'react';
import { useSchool } from '../../context/SchoolContext';
import { Student } from '../../types';
import { Award, Clock, BookOpen, CheckCircle2, Calendar, Bell, ArrowRight } from 'lucide-react';

export const StudentDashboard: React.FC<{ student: Student; onNavigate: (tab: string) => void }> = ({
  student,
  onNavigate,
}) => {
  const { results, announcements, cbtExams, assignments } = useSchool();

  const latestResult = results.find((r) => r.studentId === student.id);
  const studentExams = cbtExams.filter(
    (e) => e.isPublished && (e.classId === student.classId || e.className.includes(student.className))
  );

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      
      {/* Welcome Banner */}
      <div className="bg-slate-900 text-white rounded-3xl p-8 border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl">
        <div className="flex items-center gap-5">
          <img
            src={student.avatar}
            alt={student.firstName}
            className="w-20 h-20 rounded-2xl object-cover border-2 border-amber-400"
          />
          <div>
            <span className="text-amber-400 font-bold text-xs uppercase tracking-wider">
              {student.className} • {student.house} House
            </span>
            <h1 className="font-serif font-bold text-2xl sm:text-3xl mt-1">
              Welcome back, {student.firstName} {student.lastName}!
            </h1>
            <p className="text-xs text-slate-400">Admission No: {student.admissionNo}</p>
          </div>
        </div>

        <button
          onClick={() => onNavigate('cbt')}
          className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-6 py-3 rounded-xl text-xs flex items-center gap-2 shadow-lg"
        >
          <Clock className="w-4 h-4" /> Start Active CBT Exam
        </button>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-1 shadow-sm">
          <span className="text-xs font-bold uppercase text-slate-500">Terminal Average</span>
          <p className="font-serif font-black text-3xl text-amber-500">
            {latestResult ? `${latestResult.averageScore}%` : '87.4%'}
          </p>
          <p className="text-[11px] text-emerald-600 font-semibold">Verified Academic Result</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-1 shadow-sm">
          <span className="text-xs font-bold uppercase text-slate-500">Attendance Rate</span>
          <p className="font-serif font-black text-3xl text-emerald-600">97.0%</p>
          <p className="text-[11px] text-slate-500">62 Days Present</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-1 shadow-sm">
          <span className="text-xs font-bold uppercase text-slate-500">Active CBT Tests</span>
          <p className="font-serif font-black text-3xl text-blue-600">{studentExams.length}</p>
          <p className="text-[11px] text-slate-500">Ready to take</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-1 shadow-sm">
          <span className="text-xs font-bold uppercase text-slate-500">Assignments Due</span>
          <p className="font-serif font-black text-3xl text-purple-600">{assignments.length}</p>
          <p className="text-[11px] text-slate-500">Homework pending</p>
        </div>

      </div>

      {/* Announcements & Quick Shortcuts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Announcements Stream */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-md">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
            <h3 className="font-serif font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
              <Bell className="w-4 h-4 text-amber-500" /> Recent School Broadcasts
            </h3>
          </div>

          <div className="space-y-3">
            {announcements.map((ann) => (
              <div key={ann.id} className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-1">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-slate-900 dark:text-white">{ann.title}</span>
                  <span className="text-slate-400">{ann.date}</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400">{ann.message}</p>
                <span className="text-[10px] text-amber-600 font-semibold">From: {ann.sender}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Shortcut Quick Menu */}
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-md">
          <h3 className="font-serif font-bold text-lg text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-3">
            Quick Actions
          </h3>

          <div className="space-y-2">
            <button
              onClick={() => onNavigate('results')}
              className="w-full text-left p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 font-bold text-xs text-slate-900 dark:text-white flex items-center justify-between"
            >
              <span>Check Terminal Report Card</span>
              <ArrowRight className="w-4 h-4 text-amber-500" />
            </button>

            <button
              onClick={() => onNavigate('cbt')}
              className="w-full text-left p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 font-bold text-xs text-slate-900 dark:text-white flex items-center justify-between"
            >
              <span>Take Online CBT Exam</span>
              <ArrowRight className="w-4 h-4 text-amber-500" />
            </button>

            <button
              onClick={() => onNavigate('assignments')}
              className="w-full text-left p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 font-bold text-xs text-slate-900 dark:text-white flex items-center justify-between"
            >
              <span>Download Lecture Notes</span>
              <ArrowRight className="w-4 h-4 text-amber-500" />
            </button>

            <button
              onClick={() => onNavigate('attendance')}
              className="w-full text-left p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 font-bold text-xs text-slate-900 dark:text-white flex items-center justify-between"
            >
              <span>View Attendance Record</span>
              <ArrowRight className="w-4 h-4 text-amber-500" />
            </button>
          </div>
        </div>

      </div>

    </div>
  );
};
