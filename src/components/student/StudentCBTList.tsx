import React, { useState } from 'react';
import { useSchool } from '../../context/SchoolContext';
import { Student, CBTStartResponse } from '../../types';
import { doesStudentClassMatch } from '../../lib/academicSelection';
import { Clock, Play, CheckCircle2, AlertCircle, Calendar, Lock } from 'lucide-react';
import { CBTExamRunner } from './CBTExamRunner';
import { formatFriendlyNetworkError } from '../../lib/pwaProtection';

export const StudentCBTList: React.FC<{ student: Student }> = ({ student }) => {
  const { cbtExams, cbtAttempts, startCBTExamSession } = useSchool();
  const [activeSession, setActiveSession] = useState<CBTStartResponse | null>(null);
  const [startingExamId, setStartingExamId] = useState<string | null>(null);
  const [isAutoResuming, setIsAutoResuming] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const activeExamStorageKey = `cbt_active_exam_${student.id}`;
  const attemptedAutoResumeRef = React.useRef<boolean>(false);

  // Available CBT exams for this student's class (exact match so SS 1 never matches JSS 1)
  const classExams = cbtExams.filter(
    (e) => e.isPublished && doesStudentClassMatch(e.classId, e.className, student)
  );

  const clearActiveExamMarker = React.useCallback(() => {
    try {
      sessionStorage.removeItem(activeExamStorageKey);
    } catch {
      // Ignore storage access errors
    }
  }, [activeExamStorageKey]);

  const handleStartExam = React.useCallback(
    async (examId: string) => {
      setStartError(null);
      setStartingExamId(examId);
      try {
        const session = await startCBTExamSession(examId);
        try {
          sessionStorage.setItem(activeExamStorageKey, examId);
        } catch {
          // Ignore storage access errors
        }
        setActiveSession(session);
      } catch (err: any) {
        clearActiveExamMarker();
        setStartError(
          formatFriendlyNetworkError(
            err,
            'Unable to start CBT examination. Please check with your teacher.'
          )
        );
      } finally {
        setStartingExamId(null);
        setIsAutoResuming(false);
      }
    },
    [activeExamStorageKey, clearActiveExamMarker, startCBTExamSession]
  );

  // Seamless auto-resume if the student refreshes the browser page while inside an active exam
  React.useEffect(() => {
    if (attemptedAutoResumeRef.current || activeSession || startingExamId) return;

    let savedActiveExamId: string | null = null;
    try {
      savedActiveExamId = sessionStorage.getItem(activeExamStorageKey);
    } catch {
      return;
    }

    if (!savedActiveExamId) {
      attemptedAutoResumeRef.current = true;
      return;
    }

    const matchingExam = classExams.find((e) => e.id === savedActiveExamId);
    if (!matchingExam) {
      return;
    }

    attemptedAutoResumeRef.current = true;

    const alreadyAttempted = Boolean(
      cbtAttempts.some((a) => a.examId === matchingExam.id && a.studentId === student.id) ||
        matchingExam.hasAttempt ||
        matchingExam.sessionStatus === 'submitted'
    );
    const alreadyExpired =
      matchingExam.sessionStatus === 'expired' ||
      (matchingExam.sessionStatus === 'in_progress' &&
        typeof matchingExam.remainingSeconds === 'number' &&
        matchingExam.remainingSeconds <= 0);

    if (alreadyAttempted || alreadyExpired || matchingExam.cbtActive === false) {
      clearActiveExamMarker();
      return;
    }

    setIsAutoResuming(true);
    void handleStartExam(matchingExam.id);
  }, [
    activeExamStorageKey,
    activeSession,
    cbtAttempts,
    classExams,
    clearActiveExamMarker,
    handleStartExam,
    startingExamId,
    student.id,
  ]);

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      
      {activeSession ? (
        <CBTExamRunner
          key={activeSession.sessionId}
          session={activeSession}
          student={student}
          onFinish={() => {
            clearActiveExamMarker();
            setActiveSession(null);
          }}
        />
      ) : (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-md flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
            <div>
              <h2 className="font-serif font-bold text-xl sm:text-2xl text-slate-900 dark:text-white">
                CBT Online Examination Portal
              </h2>
              <p className="text-xs text-slate-500">
                Take timed objective assessments, review scores, and track past CBT test attempts.
              </p>
            </div>

            <div className="bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5 w-fit shrink-0">
              <Clock className="w-4 h-4" /> Auto-Timed &amp; Instant Scoring
            </div>
          </div>

          {isAutoResuming && (
            <div className="bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-200 p-4 rounded-2xl text-xs font-bold flex items-center gap-2">
              <Clock className="w-4 h-4 animate-spin flex-shrink-0" />
              <span>Resuming your active CBT examination session and restoring saved answers...</span>
            </div>
          )}

          {startError && (
            <div className="bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 p-4 rounded-2xl text-xs font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{startError}</span>
            </div>
          )}

          {/* Active Exams Grid */}
          <div className="space-y-4">
            <h3 className="font-bold text-sm text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Active & Scheduled CBT Exams ({classExams.length})
            </h3>

            {classExams.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {classExams.map((exam) => {
                  const pastAttempt = cbtAttempts.find(
                    (a) => a.examId === exam.id && a.studentId === student.id
                  );
                  const isCompleted = Boolean(pastAttempt || exam.hasAttempt || exam.sessionStatus === 'submitted');
                  const isExpired =
                    !isCompleted &&
                    (exam.sessionStatus === 'expired' ||
                      (exam.sessionStatus === 'in_progress' &&
                        typeof exam.remainingSeconds === 'number' &&
                        exam.remainingSeconds <= 0));
                  const isInProgress = exam.sessionStatus === 'in_progress' && !isCompleted && !isExpired;
                  const isLocked = exam.cbtActive === false;
                  const isStarting = startingExamId === exam.id;

                  return (
                    <div
                      key={exam.id}
                      className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-sm hover:shadow-md transition-shadow"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <span className="text-[10px] font-bold uppercase bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 px-2 py-0.5 rounded">
                            {exam.subjectName}
                          </span>
                          <h4 className="font-bold text-base text-slate-900 dark:text-white mt-1">
                            {exam.title}
                          </h4>
                        </div>
                        <span className="text-xs font-mono font-bold text-slate-500">
                          {exam.durationMinutes} Mins
                        </span>
                      </div>

                      <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1.5">
                        <p className="flex items-center gap-1.5 text-purple-700 dark:text-purple-300 font-semibold">
                          <Calendar className="w-3.5 h-3.5 text-purple-500" />
                          Window: <strong className="font-bold">{exam.startDate} @ {exam.startTime || '08:00'}</strong>
                          {exam.endDate ? ` to ${exam.endDate}` : ''}
                        </p>
                        <p>Questions: <strong>{exam.totalQuestions} Questions</strong> ({exam.totalMarks} Marks)</p>
                      </div>

                      <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                        {isCompleted ? (
                          <div className="flex items-center justify-between w-full text-xs">
                            <span className={`font-bold px-2.5 py-1 rounded-full ${
                              pastAttempt
                                ? pastAttempt.passed
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                  : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                                : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            }`}>
                              {pastAttempt ? `Completed: ${pastAttempt.percentage}%` : 'Exam Completed'}
                            </span>
                            <span className="text-slate-400 dark:text-slate-500 font-semibold italic flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Submitted
                            </span>
                          </div>
                        ) : isExpired ? (
                          <div className="w-full bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 font-bold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-2 border border-red-200 dark:border-red-900">
                            <AlertCircle className="w-4 h-4" /> Session Time Expired
                          </div>
                        ) : isLocked ? (
                          <div className="w-full bg-slate-100 dark:bg-slate-800 text-slate-500 font-bold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-2">
                            <Lock className="w-4 h-4" /> CBT Portal Currently Locked
                          </div>
                        ) : (
                          <button
                            onClick={() => void handleStartExam(exam.id)}
                            disabled={isStarting || startingExamId !== null}
                            className="w-full bg-slate-900 hover:bg-slate-800 disabled:opacity-50 dark:bg-amber-500 dark:hover:bg-amber-600 dark:text-slate-950 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 transition-colors"
                          >
                            <Play className="w-4 h-4" />
                            {isStarting
                              ? 'Starting Exam Session...'
                              : isInProgress
                              ? `Resume CBT Exam${typeof exam.remainingSeconds === 'number' ? ` (${Math.max(1, Math.ceil(exam.remainingSeconds / 60))}m left)` : ''}`
                              : 'Start CBT Exam Now'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 text-center space-y-2">
                <AlertCircle className="w-8 h-8 text-slate-400 mx-auto" />
                <p className="text-xs text-slate-500">No active CBT exams scheduled for your class at the moment.</p>
              </div>
            )}
          </div>

          {/* Past CBT Attempt History */}
          {cbtAttempts.filter((a) => a.studentId === student.id).length > 0 && (
            <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
              <h3 className="font-bold text-sm text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                My CBT Test Attempt History
              </h3>

              <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs min-w-[540px]">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800 text-slate-500 uppercase text-[10px] font-bold">
                        <th className="p-3">Examination</th>
                        <th className="p-3">Date Completed</th>
                        <th className="p-3 text-center">Score</th>
                        <th className="p-3 text-center">Percentage</th>
                        <th className="p-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {cbtAttempts
                        .filter((a) => a.studentId === student.id)
                        .map((attempt) => {
                          const matchedExam = cbtExams.find((ex) => ex.id === attempt.examId);
                          return (
                            <tr key={attempt.id}>
                              <td className="p-3">
                                <p className="font-bold text-slate-900 dark:text-white">
                                  {matchedExam ? matchedExam.title : attempt.examId}
                                </p>
                                {matchedExam && (
                                  <p className="text-[11px] text-slate-500">
                                    {matchedExam.subjectName}
                                  </p>
                                )}
                              </td>
                              <td className="p-3 text-slate-500">{new Date(attempt.completedAt).toLocaleDateString()}</td>
                              <td className="p-3 text-center font-bold">{attempt.scoreObtained} / {attempt.totalMarks}</td>
                              <td className="p-3 text-center font-extrabold text-amber-500">{attempt.percentage}%</td>
                              <td className="p-3 text-center">
                                <span className={`px-2 py-0.5 rounded font-bold ${
                                  attempt.passed ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                                }`}>
                                  {attempt.passed ? 'PASSED' : 'FAILED'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

        </div>
      )}

    </div>
  );
};
