import React, { useState } from 'react';
import { useSchool } from '../../context/SchoolContext';
import { ScoreRecord, Student, Subject } from '../../types';
import { Save, CheckCircle2, Award, Sparkles, Sliders } from 'lucide-react';

export const ScoreEntrySheet: React.FC = () => {
  const { students, subjects, classes, scores, saveBatchScores, systemSettings } = useSchool();

  const [selectedClassId, setSelectedClassId] = useState<string>('c-ss2');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('sub-mth');
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Filter students in selected class
  const classStudents = students.filter((s) => s.classId === selectedClassId);
  const currentSubject = subjects.find((s) => s.id === selectedSubjectId);

  // Local state for score entries in grid
  const [localScores, setLocalScores] = useState<Record<string, { ca1: number; ca2: number; exam: number; remark: string }>>(() => {
    const initialMap: Record<string, { ca1: number; ca2: number; exam: number; remark: string }> = {};
    classStudents.forEach((std) => {
      const existing = scores.find(
        (sc) => sc.studentId === std.id && sc.subjectId === selectedSubjectId && sc.sessionId === systemSettings.currentSession && sc.term === systemSettings.currentTerm
      );
      initialMap[std.id] = {
        ca1: existing ? existing.ca1Score : 16,
        ca2: existing ? existing.ca2Score : 16,
        exam: existing ? existing.examScore : 52,
        remark: existing ? existing.remarks : 'Good performance',
      };
    });
    return initialMap;
  });

  const handleScoreChange = (studentId: string, field: 'ca1' | 'ca2' | 'exam', value: number) => {
    setLocalScores((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [field]: Math.max(0, value),
      },
    }));
  };

  const handleRemarkChange = (studentId: string, remark: string) => {
    setLocalScores((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        remark,
      },
    }));
  };

  const calculateGrade = (total: number): 'A' | 'B' | 'C' | 'D' | 'E' | 'F' => {
    if (total >= 80) return 'A';
    if (total >= 70) return 'B';
    if (total >= 60) return 'C';
    if (total >= 50) return 'D';
    if (total >= 40) return 'E';
    return 'F';
  };

  const handleSaveAllScores = () => {
    const recordsToSave: Omit<ScoreRecord, 'id'>[] = classStudents.map((std) => {
      const entry = localScores[std.id] || { ca1: 16, ca2: 16, exam: 52, remark: 'Satisfactory' };
      const ca1 = Math.min(20, entry.ca1 || 0);
      const ca2 = Math.min(20, entry.ca2 || 0);
      const exam = Math.min(60, entry.exam || 0);
      const total = ca1 + ca2 + exam;
      const grade = calculateGrade(total);

      return {
        studentId: std.id,
        subjectId: selectedSubjectId,
        subjectName: currentSubject?.name || 'Mathematics',
        classId: selectedClassId,
        sessionId: systemSettings.currentSession,
        term: systemSettings.currentTerm,
        ca1Score: ca1,
        ca2Score: ca2,
        examScore: exam,
        totalScore: total,
        grade,
        remarks: entry.remark,
        teacherId: 'tch-102',
      };
    });

    saveBatchScores(recordsToSave);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      
      {/* Top Controls Header */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-serif font-bold text-2xl text-slate-900 dark:text-white">
            CA & Examination Score Entry Sheet
          </h2>
          <p className="text-xs text-slate-500">
            Active: {systemSettings.currentSession} ({systemSettings.currentTerm})
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none"
          >
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          <select
            value={selectedSubjectId}
            onChange={(e) => setSelectedSubjectId(e.target.value)}
            className="px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none"
          >
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
            ))}
          </select>
        </div>
      </div>

      {savedSuccess && (
        <div className="bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 p-4 rounded-2xl border border-emerald-300 dark:border-emerald-800 flex items-center gap-2 text-xs font-bold animate-fade-in">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span>Scores saved successfully and updated in terminal broadsheet!</span>
        </div>
      )}

      {/* Spreadsheet Score Table */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs md:text-sm">
            <thead>
              <tr className="bg-slate-900 text-white font-semibold">
                <th className="p-3">Admission No</th>
                <th className="p-3">Student Name</th>
                <th className="p-3 text-center w-28">1st CA (Max 20)</th>
                <th className="p-3 text-center w-28">2nd CA (Max 20)</th>
                <th className="p-3 text-center w-28">Exam (Max 60)</th>
                <th className="p-3 text-center">Total (100)</th>
                <th className="p-3 text-center">Grade</th>
                <th className="p-3">Teacher Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {classStudents.map((std) => {
                const entry = localScores[std.id] || { ca1: 16, ca2: 16, exam: 52, remark: 'Good effort' };
                const ca1 = Math.min(20, Number(entry.ca1) || 0);
                const ca2 = Math.min(20, Number(entry.ca2) || 0);
                const exam = Math.min(60, Number(entry.exam) || 0);
                const total = ca1 + ca2 + exam;
                const grade = calculateGrade(total);

                return (
                  <tr key={std.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="p-3 font-mono text-slate-500 text-xs">{std.admissionNo}</td>
                    <td className="p-3 font-bold text-slate-900 dark:text-white">
                      {std.firstName} {std.lastName}
                    </td>
                    <td className="p-3 text-center">
                      <input
                        type="number"
                        max={20}
                        min={0}
                        value={entry.ca1}
                        onChange={(e) => handleScoreChange(std.id, 'ca1', parseInt(e.target.value) || 0)}
                        className="w-16 px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-center font-bold text-xs"
                      />
                    </td>
                    <td className="p-3 text-center">
                      <input
                        type="number"
                        max={20}
                        min={0}
                        value={entry.ca2}
                        onChange={(e) => handleScoreChange(std.id, 'ca2', parseInt(e.target.value) || 0)}
                        className="w-16 px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-center font-bold text-xs"
                      />
                    </td>
                    <td className="p-3 text-center">
                      <input
                        type="number"
                        max={60}
                        min={0}
                        value={entry.exam}
                        onChange={(e) => handleScoreChange(std.id, 'exam', parseInt(e.target.value) || 0)}
                        className="w-16 px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-center font-bold text-xs"
                      />
                    </td>
                    <td className="p-3 text-center font-extrabold text-slate-900 dark:text-white text-base">
                      {total}
                    </td>
                    <td className="p-3 text-center">
                      <span className="px-2.5 py-1 rounded font-bold text-xs bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                        {grade}
                      </span>
                    </td>
                    <td className="p-3">
                      <input
                        type="text"
                        value={entry.remark}
                        onChange={(e) => handleRemarkChange(std.id, e.target.value)}
                        placeholder="Add remark..."
                        className="w-full px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-xs"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end">
          <button
            onClick={handleSaveAllScores}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-8 py-3 rounded-xl text-xs flex items-center gap-2 shadow-lg"
          >
            <Save className="w-4 h-4" /> Save & Compute Results
          </button>
        </div>

      </div>

    </div>
  );
};
