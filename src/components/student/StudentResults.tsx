import React, { useState } from 'react';
import { useSchool } from '../../context/SchoolContext';
import { Student } from '../../types';
import { Award, Printer, Lock, Unlock, Key, ShieldCheck, AlertCircle, Sparkles, Copy, Check } from 'lucide-react';
import { ReportCardModal } from '../reports/ReportCardModal';

export const StudentResults: React.FC<{ student: Student }> = ({ student }) => {
  const { results, systemSettings, academicSessions } = useSchool();
  const availableSessions = academicSessions && academicSessions.length > 0
    ? academicSessions
    : [systemSettings.currentSession];
  const [selectedTerm, setSelectedTerm] = useState<'1st Term' | '2nd Term' | '3rd Term'>(
    systemSettings.currentTerm || '2nd Term'
  );
  const [selectedSession, setSelectedSession] = useState<string>(
    systemSettings.currentSession || availableSessions[0]
  );
  const [activeReportModal, setActiveReportModal] = useState<any | null>(null);

  // Passcode verification state per session/term
  const [unlockedSessions, setUnlockedSessions] = useState<Record<string, boolean>>({});
  const [passcodeInput, setPasscodeInput] = useState('');
  const [passcodeError, setPasscodeError] = useState(false);
  const [copied, setCopied] = useState(false);

  const studentResult = results.find(
    (r) =>
      r.studentId === student.id &&
      r.sessionId === selectedSession &&
      r.term === selectedTerm
  );

  const sessionKey = `${selectedSession}-${selectedTerm}`;
  const isUnlocked = unlockedSessions[sessionKey] || false;
  const officialPasscode = (student.resultPasscode || 'RES-8K9M2P').trim().toUpperCase();

  const handleVerifyPasscode = (e: React.FormEvent) => {
    e.preventDefault();
    if (passcodeInput.trim().toUpperCase() === officialPasscode) {
      setUnlockedSessions((prev) => ({ ...prev, [sessionKey]: true }));
      setPasscodeError(false);
      setPasscodeInput('');
    } else {
      setPasscodeError(true);
    }
  };

  const handleLockSession = () => {
    setUnlockedSessions((prev) => ({ ...prev, [sessionKey]: false }));
  };

  const handleUseDemoCode = () => {
    setPasscodeInput(officialPasscode);
    setPasscodeError(false);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(officialPasscode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      
      {/* Header Controls */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="font-serif font-bold text-2xl text-slate-900 dark:text-white flex items-center gap-2">
            Academic Terminal Results
            {isUnlocked ? (
              <span className="text-xs bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 border border-emerald-300 dark:border-emerald-800">
                <Unlock className="w-3 h-3" /> Unlocked
              </span>
            ) : (
              <span className="text-xs bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 border border-amber-300 dark:border-amber-800">
                <Lock className="w-3 h-3" /> Passcode Protected
              </span>
            )}
          </h2>
          <p className="text-xs text-slate-500">Access grades, terminal broadsheet, and printable report cards using your admin-issued passcode.</p>
        </div>

        {/* Filter Selectors */}
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selectedSession}
            onChange={(e) => {
              setSelectedSession(e.target.value);
              setPasscodeError(false);
            }}
            className="px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none"
          >
            {availableSessions.map((sess) => (
              <option key={sess} value={sess}>{sess} Session</option>
            ))}
          </select>

          <select
            value={selectedTerm}
            onChange={(e) => {
              setSelectedTerm(e.target.value as any);
              setPasscodeError(false);
            }}
            className="px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none"
          >
            <option value="1st Term">1st Term</option>
            <option value="2nd Term">2nd Term</option>
            <option value="3rd Term">3rd Term</option>
          </select>
        </div>
      </div>

      {/* Security Gate or Result View */}
      {!isUnlocked ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 shadow-xl max-w-xl mx-auto space-y-6 text-center">
          <div className="w-16 h-16 bg-amber-50 dark:bg-amber-950/50 rounded-2xl border border-amber-200 dark:border-amber-800/60 flex items-center justify-center mx-auto text-amber-500 shadow-inner">
            <Key className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h3 className="font-serif font-bold text-2xl text-slate-900 dark:text-white">
              Result Access Passcode Required
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed max-w-md mx-auto">
              Terminal results for <strong className="text-slate-800 dark:text-slate-200">{selectedSession} ({selectedTerm})</strong> are secured. Please enter your official alphanumeric result passcode provided by the school administration.
            </p>
          </div>

          <form onSubmit={handleVerifyPasscode} className="space-y-4 max-w-md mx-auto">
            <div>
              <div className="relative">
                <input
                  type="text"
                  value={passcodeInput}
                  onChange={(e) => {
                    setPasscodeInput(e.target.value.toUpperCase());
                    setPasscodeError(false);
                  }}
                  placeholder="e.g. RES-8K9M2P"
                  className="w-full text-center tracking-widest font-mono text-lg font-bold px-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-slate-300 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-white outline-none focus:border-amber-500 uppercase placeholder:text-slate-400 placeholder:tracking-normal placeholder:font-sans placeholder:text-sm"
                  maxLength={12}
                />
              </div>

              {passcodeError && (
                <p className="text-xs text-red-500 font-bold mt-2 flex items-center justify-center gap-1.5 animate-bounce">
                  <AlertCircle className="w-4 h-4" />
                  Invalid passcode! Please check your Result Access Slip or request a code from Admin.
                </p>
              )}
            </div>

            <button
              type="submit"
              className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold py-3.5 px-6 rounded-2xl text-xs transition-colors flex items-center justify-center gap-2 shadow-lg shadow-amber-500/10"
            >
              <ShieldCheck className="w-4 h-4" />
              Unlock Terminal Result
            </button>
          </form>

          {/* Info note about missing passcode */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 text-center">
            <p className="text-[10px] text-slate-400 italic">
              Lost your result access slip? Please contact the school administration office or bursar to request your passcode.
            </p>
          </div>
        </div>
      ) : studentResult ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 shadow-xl space-y-6">
          
          {/* Access Verified Ribbon */}
          <div className="flex justify-between items-center bg-emerald-50 dark:bg-emerald-950/40 p-3.5 rounded-2xl border border-emerald-200 dark:border-emerald-800/50 text-xs">
            <span className="text-emerald-800 dark:text-emerald-300 font-bold flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Terminal Result Access Verified
            </span>
            <button
              onClick={handleLockSession}
              className="text-slate-500 hover:text-slate-900 dark:hover:text-white font-bold flex items-center gap-1 text-[11px] bg-white dark:bg-slate-800 px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700"
            >
              <Lock className="w-3 h-3" /> Lock Result
            </button>
          </div>

          {/* Summary Badges */}
          <div className="flex flex-wrap items-center justify-around gap-4 p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-800">
            <div className="space-y-1">
              <span className="text-xs text-slate-500 font-semibold uppercase">Terminal Average</span>
              <p className="font-serif font-black text-3xl text-amber-500">
                {studentResult.averageScore}%
              </p>
            </div>

            <div className="space-y-1">
              <span className="text-xs text-slate-500 font-semibold uppercase">Total Score Obtained</span>
              <p className="font-serif font-black text-3xl text-slate-900 dark:text-white">
                {studentResult.totalObtained} / {studentResult.totalPossible}
              </p>
            </div>

            <div className="space-y-1">
              <span className="text-xs text-slate-500 font-semibold uppercase">Attendance Summary</span>
              <p className="font-bold text-emerald-600 text-lg">
                {studentResult.daysPresent} / {studentResult.totalSchoolDays} Days
              </p>
            </div>

            <button
              onClick={() => setActiveReportModal(studentResult)}
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-6 py-3 rounded-xl text-xs transition-colors flex items-center gap-2 shadow-md"
            >
              <Printer className="w-4 h-4" />
              Print Official Report Card
            </button>
          </div>

          {/* Scores Breakdown Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs md:text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase text-[10px] font-bold">
                  <th className="py-3 px-2">Subject</th>
                  <th className="py-3 px-2 text-center">1st CA (20)</th>
                  <th className="py-3 px-2 text-center">2nd CA (20)</th>
                  <th className="py-3 px-2 text-center">Exam (60)</th>
                  <th className="py-3 px-2 text-center">Total (100)</th>
                  <th className="py-3 px-2 text-center">Grade</th>
                  <th className="py-3 px-2">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {studentResult.scores.map((s) => (
                  <tr key={s.id}>
                    <td className="py-3 px-2 font-bold text-slate-900 dark:text-white">{s.subjectName}</td>
                    <td className="py-3 px-2 text-center">{s.ca1Score}</td>
                    <td className="py-3 px-2 text-center">{s.ca2Score}</td>
                    <td className="py-3 px-2 text-center">{s.examScore}</td>
                    <td className="py-3 px-2 text-center font-extrabold text-slate-900 dark:text-white">{s.totalScore}</td>
                    <td className="py-3 px-2 text-center">
                      <span className="px-2 py-0.5 rounded font-bold text-xs bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
                        {s.grade}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-slate-500 italic text-xs">{s.remarks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Teacher & Principal Remarks */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-200 dark:border-slate-800 text-xs">
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-1">
              <span className="font-bold text-slate-700 dark:text-slate-300 uppercase text-[10px]">Form Teacher Remarks:</span>
              <p className="italic text-slate-600 dark:text-slate-400">"{studentResult.teacherRemarks}"</p>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-1">
              <span className="font-bold text-slate-700 dark:text-slate-300 uppercase text-[10px]">Principal's Remark:</span>
              <p className="italic text-slate-600 dark:text-slate-400">"{studentResult.principalRemarks}"</p>
            </div>
          </div>

        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-12 text-center space-y-3">
          <Award className="w-12 h-12 text-slate-400 mx-auto" />
          <h3 className="font-serif font-bold text-xl text-slate-900 dark:text-white">No Published Result Found</h3>
          <p className="text-xs text-slate-500">
            Results for {selectedSession} ({selectedTerm}) are currently being compiled or awaiting principal verification.
          </p>
        </div>
      )}

      {/* Printable Modal */}
      {activeReportModal && (
        <ReportCardModal
          result={activeReportModal}
          student={student}
          onClose={() => setActiveReportModal(null)}
        />
      )}

    </div>
  );
};

