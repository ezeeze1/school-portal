import React, { useState, useEffect } from 'react';
import { useSchool } from '../../context/SchoolContext';
import { ScoreRecord, TerminalResult } from '../../types';
import { Save, CheckCircle2 } from 'lucide-react';

export const ScoreEntrySheet: React.FC = () => {
  const {
    students,
    teachers,
    subjects,
    classes,
    scores,
    results,
    attendance,
    saveBatchScores,
    publishResult,
    systemSettings,
    currentUser,
  } = useSchool();

  const [selectedClassId, setSelectedClassId] = useState<string>(() => classes[0]?.id || 'c-ss2');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(() => subjects[0]?.id || 'sub-mth');
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Filter students in selected class
  const classStudents = students.filter((s) => s.classId === selectedClassId);
  const currentSubject = subjects.find((s) => s.id === selectedSubjectId);

  const buildScoreMap = () => {
    const map: Record<string, { ca1: number; ca2: number; exam: number; remark: string }> = {};
    classStudents.forEach((std) => {
      const existing = scores.find(
        (sc) =>
          sc.studentId === std.id &&
          sc.subjectId === selectedSubjectId &&
          sc.sessionId === systemSettings.currentSession &&
          sc.term === systemSettings.currentTerm
      );
      map[std.id] = {
        ca1: existing ? existing.ca1Score : 0,
        ca2: existing ? existing.ca2Score : 0,
        exam: existing ? existing.examScore : 0,
        remark: existing ? existing.remarks : '',
      };
    });
    return map;
  };

  // Local state for score entries in grid
  const [localScores, setLocalScores] = useState<
    Record<string, { ca1: number; ca2: number; exam: number; remark: string }>
  >(buildScoreMap);

  // Refresh grid whenever selected class, subject, session, term, or underlying scores change
  useEffect(() => {
    setLocalScores(buildScoreMap());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClassId, selectedSubjectId, systemSettings.currentSession, systemSettings.currentTerm, scores, students]);

  const handleScoreChange = (studentId: string, field: 'ca1' | 'ca2' | 'exam', value: number) => {
    const maxAllowed = field === 'exam' ? 60 : 20;
    const clamped = Math.max(0, Math.min(maxAllowed, Number.isNaN(value) ? 0 : value));
    setLocalScores((prev) => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || { ca1: 0, ca2: 0, exam: 0, remark: '' }),
        [field]: clamped,
      },
    }));
  };

  const handleRemarkChange = (studentId: string, remark: string) => {
    setLocalScores((prev) => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || { ca1: 0, ca2: 0, exam: 0, remark: '' }),
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

  const getDefaultRemark = (grade: 'A' | 'B' | 'C' | 'D' | 'E' | 'F'): string => {
    switch (grade) {
      case 'A':
        return 'Excellent performance';
      case 'B':
        return 'Very good performance';
      case 'C':
        return 'Good effort';
      case 'D':
        return 'Satisfactory';
      case 'E':
        return 'Needs improvement';
      default:
        return 'Requires extra attention';
    }
  };

  const handleSaveAllScores = () => {
    if (classStudents.length === 0) return;

    const matchedTeacher =
      currentUser?.role === 'teacher'
        ? teachers.find(
            (t) =>
              t.id === currentUser.id ||
              (currentUser.referenceId && t.staffId === currentUser.referenceId)
          )
        : undefined;
    const teacherId = matchedTeacher?.id;
    const recordsToSave: Omit<ScoreRecord, 'id'>[] = classStudents.map((std) => {
      const entry = localScores[std.id] || { ca1: 0, ca2: 0, exam: 0, remark: '' };
      const ca1 = Math.max(0, Math.min(20, Number(entry.ca1) || 0));
      const ca2 = Math.max(0, Math.min(20, Number(entry.ca2) || 0));
      const exam = Math.max(0, Math.min(60, Number(entry.exam) || 0));
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
        remarks: entry.remark.trim() || getDefaultRemark(grade),
        teacherId,
      };
    });

    saveBatchScores(recordsToSave);

    // Compile terminal results for each student in the class using merged subject scores
    const compiledByStudent = classStudents.map((std, idx) => {
      const savedForStudent = recordsToSave[idx];
      const existingStudentScores = scores.filter(
        (sc) =>
          sc.studentId === std.id &&
          sc.sessionId === systemSettings.currentSession &&
          sc.term === systemSettings.currentTerm &&
          sc.subjectId !== selectedSubjectId
      );
      const existingSameSubject = scores.find(
        (sc) =>
          sc.studentId === std.id &&
          sc.subjectId === selectedSubjectId &&
          sc.sessionId === systemSettings.currentSession &&
          sc.term === systemSettings.currentTerm
      );

      const currentSubjectScoreRecord: ScoreRecord = {
        ...savedForStudent,
        id: existingSameSubject?.id || `sc-${std.id}-${selectedSubjectId}-${Date.now()}`,
      };

      const mergedScores = [...existingStudentScores, currentSubjectScoreRecord];
      const totalObtained = mergedScores.reduce((sum, item) => sum + item.totalScore, 0);
      const totalPossible = mergedScores.length * 100;
      const averageScore =
        mergedScores.length > 0 ? Number((totalObtained / mergedScores.length).toFixed(1)) : 0;

      const existingResult = results.find(
        (r) =>
          r.studentId === std.id &&
          r.sessionId === systemSettings.currentSession &&
          r.term === systemSettings.currentTerm
      );

      const studentAttendance = attendance.filter((a) => a.studentId === std.id);
      const daysPresent = existingResult?.daysPresent ?? studentAttendance.filter((a) => a.status === 'Present').length;
      const daysAbsent = existingResult?.daysAbsent ?? studentAttendance.filter((a) => a.status === 'Absent').length;
      const totalSchoolDays = existingResult?.totalSchoolDays ?? Math.max(studentAttendance.length, daysPresent + daysAbsent);

      return {
        std,
        mergedScores,
        totalObtained,
        totalPossible,
        averageScore,
        existingResult,
        daysPresent,
        daysAbsent,
        totalSchoolDays,
      };
    });

    const ranked = [...compiledByStudent].sort((a, b) => b.averageScore - a.averageScore);

    compiledByStudent.forEach((item) => {
      const positionInClass = ranked.findIndex((r) => r.std.id === item.std.id) + 1;
      const compiledResult: TerminalResult = {
        id:
          item.existingResult?.id ||
          `res-${item.std.id}-${systemSettings.currentSession}-${systemSettings.currentTerm}`.replace(/\s+/g, ''),
        studentId: item.std.id,
        classId: selectedClassId,
        sessionId: systemSettings.currentSession,
        term: systemSettings.currentTerm,
        scores: item.mergedScores,
        totalObtained: item.totalObtained,
        totalPossible: item.totalPossible,
        grandTotalScore: item.totalObtained,
        averageScore: item.averageScore,
        positionInClass: Math.max(1, positionInClass),
        totalStudentsInClass: classStudents.length,
        psychomotor: item.existingResult?.psychomotor || {
          punctuality: 4,
          neatness: 4,
          politeness: 4,
          leadership: 4,
          honesty: 5,
          sports: 4,
          teamwork: 4,
        },
        teacherRemarks:
          item.existingResult?.teacherRemarks ||
          (item.averageScore >= 75
            ? 'Outstanding academic performance across subjects.'
            : item.averageScore >= 50
            ? 'Steady progress; keep working diligently.'
            : 'Needs closer academic supervision and extra revision.'),
        principalRemarks:
          item.existingResult?.principalRemarks ||
          'Result compiled and verified for the active academic term.',
        daysPresent: item.daysPresent,
        daysAbsent: item.daysAbsent,
        totalSchoolDays: item.totalSchoolDays,
        nextTermBegins: item.existingResult?.nextTermBegins || 'To be announced',
        status: systemSettings.isResultPublished === false ? 'Draft' : (item.existingResult?.status || 'Published'),
      };

      publishResult(compiledResult);
    });

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
