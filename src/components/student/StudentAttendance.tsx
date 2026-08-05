import React from 'react';
import { useSchool } from '../../context/SchoolContext';
import { Student } from '../../types';
import { Calendar, CheckCircle2, XCircle, Clock } from 'lucide-react';

export const StudentAttendance: React.FC<{ student: Student }> = ({ student }) => {
  const { attendance } = useSchool();

  const studentLogs = attendance.filter((a) => a.studentId === student.id);
  const presentCount = studentLogs.filter((a) => a.status === 'Present').length;
  const lateCount = studentLogs.filter((a) => a.status === 'Late').length;
  const absentCount = studentLogs.filter((a) => a.status === 'Absent').length;

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      
      {/* Attendance Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 p-6 rounded-3xl space-y-2">
          <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 uppercase">Days Present</span>
          <p className="font-serif font-black text-3xl text-emerald-800 dark:text-emerald-200">{presentCount} Days</p>
        </div>

        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 p-6 rounded-3xl space-y-2">
          <span className="text-xs font-bold text-amber-700 dark:text-amber-300 uppercase">Times Late</span>
          <p className="font-serif font-black text-3xl text-amber-800 dark:text-amber-200">{lateCount} Days</p>
        </div>

        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 p-6 rounded-3xl space-y-2">
          <span className="text-xs font-bold text-red-700 dark:text-red-300 uppercase">Days Absent</span>
          <p className="font-serif font-black text-3xl text-red-800 dark:text-red-200">{absentCount} Days</p>
        </div>
      </div>

      {/* Attendance Log Table */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-md">
        <h3 className="font-serif font-bold text-xl text-slate-900 dark:text-white">
          Daily Attendance Roll Call History
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase text-[10px] font-bold">
                <th className="py-3 px-3">Date</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3">Remark / Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {studentLogs.length > 0 ? (
                studentLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="py-3 px-3 font-bold text-slate-900 dark:text-white">{log.date}</td>
                    <td className="py-3 px-3">
                      <span className={`px-2.5 py-0.5 rounded font-bold ${
                        log.status === 'Present' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : log.status === 'Late' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                      }`}>
                        {log.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-500 italic">{log.remark || 'N/A'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="py-6 text-center text-slate-500">No attendance logs found for current session.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
