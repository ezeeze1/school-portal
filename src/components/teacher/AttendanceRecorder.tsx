import React, { useState } from 'react';
import { useSchool } from '../../context/SchoolContext';
import { AttendanceRecord, Student } from '../../types';
import { Save, CheckCircle2, Calendar, Users } from 'lucide-react';

export const AttendanceRecorder: React.FC = () => {
  const { students, classes, attendance, saveBatchAttendance } = useSchool();
  const [selectedClassId, setSelectedClassId] = useState<string>('c-ss2');
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const classStudents = students.filter((s) => s.classId === selectedClassId);

  // Attendance state per student ID
  const [statusMap, setStatusMap] = useState<Record<string, 'Present' | 'Absent' | 'Late' | 'Excused'>>({});
  const [remarksMap, setRemarksMap] = useState<Record<string, string>>({});

  const handleStatusChange = (studentId: string, status: 'Present' | 'Absent' | 'Late' | 'Excused') => {
    setStatusMap((prev) => ({ ...prev, [studentId]: status }));
  };

  const handleMarkAllPresent = () => {
    const updated: Record<string, 'Present'> = {};
    classStudents.forEach((std) => {
      updated[std.id] = 'Present';
    });
    setStatusMap(updated);
  };

  const handleSaveAttendance = () => {
    const records: Omit<AttendanceRecord, 'id'>[] = classStudents.map((std) => ({
      studentId: std.id,
      studentName: `${std.firstName} ${std.lastName}`,
      classId: selectedClassId,
      date: selectedDate,
      status: statusMap[std.id] || 'Present',
      remark: remarksMap[std.id] || '',
    }));

    saveBatchAttendance(records);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      
      {/* Header Controls */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-serif font-bold text-2xl text-slate-900 dark:text-white">
            Daily Class Attendance Roll Call
          </h2>
          <p className="text-xs text-slate-500">Record daily student attendance and track absence trends.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none"
          />

          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none"
          >
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {savedSuccess && (
        <div className="bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 p-4 rounded-2xl border border-emerald-300 dark:border-emerald-800 flex items-center gap-2 text-xs font-bold animate-fade-in">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span>Attendance roll call for {selectedDate} saved successfully!</span>
        </div>
      )}

      {/* Attendance Roster Grid */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-xl">
        <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-4">
          <span className="font-bold text-xs uppercase tracking-wider text-slate-500">
            Student Roster ({classStudents.length} Students)
          </span>

          <button
            onClick={handleMarkAllPresent}
            className="bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold px-4 py-2 rounded-xl text-xs hover:bg-emerald-200"
          >
            ✓ Mark All Present
          </button>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {classStudents.map((std) => {
            const currentStatus = statusMap[std.id] || 'Present';

            return (
              <div key={std.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3">
                  <img src={std.avatar} alt={std.firstName} className="w-9 h-9 rounded-full object-cover" />
                  <div>
                    <p className="font-bold text-slate-900 dark:text-white">{std.firstName} {std.lastName}</p>
                    <p className="text-[10px] text-slate-500 font-mono">{std.admissionNo}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {(['Present', 'Absent', 'Late', 'Excused'] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => handleStatusChange(std.id, st)}
                      className={`px-3 py-1.5 rounded-xl font-bold text-[11px] transition-all ${
                        currentStatus === st
                          ? st === 'Present'
                            ? 'bg-emerald-600 text-white'
                            : st === 'Late'
                            ? 'bg-amber-500 text-slate-950'
                            : st === 'Absent'
                            ? 'bg-red-600 text-white'
                            : 'bg-purple-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end">
          <button
            onClick={handleSaveAttendance}
            className="bg-slate-900 hover:bg-slate-800 dark:bg-amber-500 dark:text-slate-950 text-white font-bold px-8 py-3 rounded-xl text-xs flex items-center gap-2 shadow-lg"
          >
            <Save className="w-4 h-4" /> Submit Daily Roll Call
          </button>
        </div>
      </div>

    </div>
  );
};
