import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSchool } from '../../context/SchoolContext';
import { CBTAttempt, CBTQuestion, CBTQuestionReview, CBTStartResponse, Student } from '../../types';
import {
  CoalescedDraftSaver,
  DraftSaverStatusSnapshot,
  MonotonicCountdownAnchor,
  computeRemainingSecondsMonotonic,
  createMonotonicCountdownAnchor,
  hasClockJumpOrSleepDrift,
  isTerminalCBTSessionError,
  summarizeSubmissionReadiness,
} from '../../lib/cbtReliability';
import { MathText } from '../common/MathText';
import {
  Clock,
  AlertTriangle,
  CheckCircle2,
  Flag,
  ArrowLeft,
  ArrowRight,
  LogOut,
  RotateCcw,
  Wifi,
  WifiOff,
  Cloud,
  RefreshCw,
} from 'lucide-react';

interface CBTExamRunnerProps {
  session: CBTStartResponse;
  student: Student;
  onFinish: () => void;
}

const OPTION_SLOTS = ['A', 'B', 'C', 'D'] as const;

const getOptionValueForSlot = (question: CBTQuestion, slot: 'A' | 'B' | 'C' | 'D'): string => {
  return question.optionIds?.[slot] || slot;
};

const isValidOptionValueForQuestion = (question: CBTQuestion, value: string): boolean => {
  if (!value) return false;
  if (question.optionIds) {
    return OPTION_SLOTS.some((slot) => question.optionIds?.[slot] === value);
  }
  return OPTION_SLOTS.includes(value as 'A' | 'B' | 'C' | 'D');
};

export const CBTExamRunner: React.FC<CBTExamRunnerProps> = ({ session, student, onFinish }) => {
  const { submitCBTExamSession, saveCBTExamDraftAnswers, startCBTExamSession, logout } =
    useSchool();
  const exam = session.exam;
  const draftStorageKey = `cbt_draft_${session.sessionId}_${exam.id}_${student.id}`;

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>(() => {
    let localDraft: Record<string, string> = {};
    try {
      const raw = localStorage.getItem(draftStorageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          localDraft = parsed;
        }
      }
    } catch {
      // Ignore storage access errors
    }

    const merged: Record<string, string> = {
      ...(session.savedAnswers || {}),
      ...localDraft,
    };

    const sanitized: Record<string, string> = {};
    for (const q of exam.questions || []) {
      const val = merged[q.id];
      if (typeof val === 'string' && isValidOptionValueForQuestion(q, val)) {
        sanitized[q.id] = val;
      }
    }
    return sanitized;
  });
  const [flaggedQuestions, setFlaggedQuestions] = useState<Record<string, boolean>>({});

  // Server-authoritative remaining seconds anchored to monotonic performance clock
  const serverRemainingSeconds =
    typeof session.remainingSeconds === 'number' && Number.isFinite(session.remainingSeconds)
      ? session.remainingSeconds
      : exam.durationMinutes * 60;
  const initialRemaining = Math.max(0, Math.floor(serverRemainingSeconds));
  const countdownAnchorRef = useRef<MonotonicCountdownAnchor>(
    createMonotonicCountdownAnchor(initialRemaining)
  );
  const [timeLeftSeconds, setTimeLeftSeconds] = useState(initialRemaining);

  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [draftSyncStatus, setDraftSyncStatus] = useState<DraftSaverStatusSnapshot>({
    state: 'idle',
    hasUnsyncedChanges: false,
    retryCount: 0,
    lastError: null,
    terminalError: false,
  });
  const [multiTabConflict, setMultiTabConflict] = useState(false);
  const [showSubmitConfirmModal, setShowSubmitConfirmModal] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isExamCompleted, setIsExamCompleted] = useState(false);
  const [autoSubmittedDueToTime, setAutoSubmittedDueToTime] = useState(false);
  const [finalAttempt, setFinalAttempt] = useState<CBTAttempt | null>(null);
  const [submissionReview, setSubmissionReview] = useState<CBTQuestionReview[]>([]);
  const [reviewPermitted, setReviewPermitted] = useState<boolean>(false);
  const [reviewPolicyMessage, setReviewPolicyMessage] = useState<string | null>(null);

  const currentQ = exam.questions[currentQuestionIndex];

  const userAnswersRef = useRef(userAnswers);
  useEffect(() => {
    userAnswersRef.current = userAnswers;
    if (!isExamCompleted) {
      try {
        localStorage.setItem(draftStorageKey, JSON.stringify(userAnswers));
      } catch {
        // Ignore storage quota errors
      }
    }
  }, [userAnswers, draftStorageKey, isExamCompleted]);

  const isExamCompletedRef = useRef(isExamCompleted);
  useEffect(() => {
    isExamCompletedRef.current = isExamCompleted;
  }, [isExamCompleted]);

  const isSubmittingRef = useRef(isSubmitting);
  useEffect(() => {
    isSubmittingRef.current = isSubmitting;
  }, [isSubmitting]);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftSaverRef = useRef<CoalescedDraftSaver | null>(null);

  if (!draftSaverRef.current) {
    draftSaverRef.current = new CoalescedDraftSaver(
      (payload) => saveCBTExamDraftAnswers(exam.id, payload),
      (status) => setDraftSyncStatus(status)
    );
  }

  const flushDraftToServer = useCallback(async () => {
    if (isExamCompletedRef.current || isSubmittingRef.current || !draftSaverRef.current) return;
    const snapshot = userAnswersRef.current;
    if (!snapshot || Object.keys(snapshot).length === 0) return;
    await draftSaverRef.current.flush(snapshot);
  }, []);

  // Re-sync countdown anchor against authoritative server session on OS sleep/wake or clock drift
  const resyncServerCountdown = useCallback(async () => {
    if (isExamCompletedRef.current || isSubmittingRef.current) return;
    try {
      const refreshed = await startCBTExamSession(exam.id);
      if (isExamCompletedRef.current) return;
      const nextRemaining =
        typeof refreshed.remainingSeconds === 'number' && Number.isFinite(refreshed.remainingSeconds)
          ? Math.max(0, Math.floor(refreshed.remainingSeconds))
          : 0;
      countdownAnchorRef.current = createMonotonicCountdownAnchor(nextRemaining);
      setTimeLeftSeconds(nextRemaining);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (isTerminalCBTSessionError(msg)) {
        countdownAnchorRef.current = createMonotonicCountdownAnchor(0);
        setTimeLeftSeconds(0);
      }
    }
  }, [exam.id, startCBTExamSession]);

  // Initial draft sync, online/offline listeners, visibility resync, and unload protection
  useEffect(() => {
    if (Object.keys(userAnswersRef.current).length > 0 && draftSaverRef.current) {
      draftSaverRef.current.markPending(userAnswersRef.current);
      void draftSaverRef.current.flush();
    }

    const handleOnline = () => {
      setIsOnline(true);
      if (draftSaverRef.current && Object.keys(userAnswersRef.current).length > 0) {
        void draftSaverRef.current.flush(userAnswersRef.current);
      }
      void resyncServerCountdown();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    const handleVisibilityChange = () => {
      if (isExamCompletedRef.current) return;
      if (document.visibilityState === 'hidden') {
        if (saveTimerRef.current) {
          clearTimeout(saveTimerRef.current);
          saveTimerRef.current = null;
        }
        if (draftSaverRef.current && Object.keys(userAnswersRef.current).length > 0) {
          void draftSaverRef.current.flush(userAnswersRef.current);
        }
      } else if (document.visibilityState === 'visible') {
        const monotonicLeft = computeRemainingSecondsMonotonic(countdownAnchorRef.current);
        setTimeLeftSeconds(monotonicLeft);
        if (hasClockJumpOrSleepDrift(countdownAnchorRef.current)) {
          void resyncServerCountdown();
        }
      }
    };

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isExamCompletedRef.current) return;
      const hasPending = draftSaverRef.current?.getStatus().hasUnsyncedChanges;
      if (hasPending || Object.keys(userAnswersRef.current).length > 0) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
      draftSaverRef.current?.dispose();
    };
  }, [resyncServerCountdown]);

  // Multi-tab guard for active session
  useEffect(() => {
    if (isExamCompleted || typeof BroadcastChannel === 'undefined') return;

    const tabId = `tab-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const channel = new BroadcastChannel(`cbt_session_${session.sessionId}`);

    channel.postMessage({ type: 'CBT_TAB_ACTIVE', tabId });

    channel.onmessage = (event) => {
      if (event.data?.tabId && event.data.tabId !== tabId) {
        if (event.data.type === 'CBT_TAB_ACTIVE') {
          setMultiTabConflict(true);
          channel.postMessage({ type: 'CBT_TAB_ACK', tabId });
        } else if (event.data.type === 'CBT_TAB_ACK') {
          setMultiTabConflict(true);
        }
      }
    };

    return () => {
      channel.close();
    };
  }, [session.sessionId, isExamCompleted]);

  // Tamper-resistant monotonic countdown effect
  useEffect(() => {
    if (isExamCompleted) return;

    const timer = setInterval(() => {
      const nextRemaining = computeRemainingSecondsMonotonic(countdownAnchorRef.current);
      setTimeLeftSeconds(nextRemaining);
      if (nextRemaining <= 0) {
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [isExamCompleted]);

  const handleCompleteExam = useCallback(
    async (isAutoSubmit = false) => {
      if (isExamCompletedRef.current || isSubmittingRef.current) return;

      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }

      setShowSubmitConfirmModal(false);
      setIsSubmitting(true);
      isSubmittingRef.current = true;
      setSubmitError(null);

      try {
        const response = await submitCBTExamSession(exam.id, userAnswersRef.current);
        setFinalAttempt(response.attempt);
        const nextReview = Array.isArray(response.review) ? response.review : [];
        const permitted =
          typeof response.reviewPermitted === 'boolean'
            ? response.reviewPermitted && nextReview.length > 0
            : nextReview.length > 0;
        setSubmissionReview(permitted ? nextReview : []);
        setReviewPermitted(permitted);
        setReviewPolicyMessage(response.reviewPolicyMessage ?? null);
        if (isAutoSubmit) {
          setAutoSubmittedDueToTime(true);
        }
        setIsExamCompleted(true);
        draftSaverRef.current?.dispose();
        try {
          localStorage.removeItem(draftStorageKey);
          sessionStorage.removeItem(`cbt_active_exam_${student.id}`);
        } catch {
          // Ignore storage errors
        }
      } catch (err: any) {
        const errMessage =
          err?.message || 'Unable to submit exam answers to the server. Please retry.';
        setSubmitError(errMessage);
        if (isTerminalCBTSessionError(errMessage)) {
          try {
            sessionStorage.removeItem(`cbt_active_exam_${student.id}`);
          } catch {
            // Ignore storage errors
          }
        }
      } finally {
        setIsSubmitting(false);
        isSubmittingRef.current = false;
      }
    },
    [draftStorageKey, exam.id, student.id, submitCBTExamSession]
  );

  // Auto-submit when countdown hits 0
  useEffect(() => {
    if (timeLeftSeconds === 0 && !isExamCompleted && !isSubmittingRef.current && !submitError) {
      void handleCompleteExam(true);
    }
  }, [timeLeftSeconds, isExamCompleted, submitError, handleCompleteExam]);

  const handleSelectOption = (slot: 'A' | 'B' | 'C' | 'D') => {
    if (isExamCompleted || isSubmitting || !currentQ) return;
    const optionValue = getOptionValueForSlot(currentQ, slot);

    const nextAnswers = {
      ...userAnswersRef.current,
      [currentQ.id]: optionValue,
    };
    userAnswersRef.current = nextAnswers;
    setUserAnswers(nextAnswers);

    draftSaverRef.current?.markPending(nextAnswers);
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = setTimeout(() => {
      void flushDraftToServer();
    }, 350);
  };

  const toggleFlag = (questionId: string) => {
    setFlaggedQuestions((prev) => ({
      ...prev,
      [questionId]: !prev[questionId],
    }));
  };

  const formatTime = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const readiness = useMemo(
    () => summarizeSubmissionReadiness(exam.questions || [], userAnswers, flaggedQuestions),
    [exam.questions, userAnswers, flaggedQuestions]
  );

  const isTerminalSubmitFailure = isTerminalCBTSessionError(submitError);

  return (
    <div className="bg-slate-950 text-white min-h-screen p-4 sm:p-8 space-y-6">
      {/* Top Examination Control Bar */}
      <div className="max-w-6xl mx-auto bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-bold">
            CBT
          </div>
          <div>
            <h2 className="font-bold text-base sm:text-lg">{exam.title}</h2>
            <p className="text-xs text-slate-400">
              Candidate: {student.firstName} {student.lastName} ({student.admissionNo})
            </p>
          </div>
        </div>

        {!isExamCompleted && (
          <div className="flex flex-wrap items-center gap-3">
            {/* Save & Connectivity Status Pill */}
            <div
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold border ${
                !isOnline || draftSyncStatus.state === 'pending_retry'
                  ? 'bg-amber-950/70 text-amber-300 border-amber-700'
                  : draftSyncStatus.state === 'terminal_error'
                  ? 'bg-red-950/70 text-red-300 border-red-800'
                  : draftSyncStatus.state === 'saving'
                  ? 'bg-slate-800 text-sky-300 border-slate-700'
                  : 'bg-emerald-950/60 text-emerald-300 border-emerald-800/70'
              }`}
            >
              {!isOnline ? (
                <>
                  <WifiOff className="w-3.5 h-3.5" />
                  <span>Offline — Saved on Device</span>
                </>
              ) : draftSyncStatus.state === 'saving' ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving Answer...</span>
                </>
              ) : draftSyncStatus.state === 'pending_retry' ? (
                <>
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Unsaved — Retrying...</span>
                </>
              ) : draftSyncStatus.state === 'terminal_error' ? (
                <>
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Session Locked</span>
                </>
              ) : (
                <>
                  <Cloud className="w-3.5 h-3.5" />
                  <span>
                    {draftSyncStatus.state === 'saved'
                      ? 'Answers Synced'
                      : `${readiness.answeredCount}/${readiness.totalQuestions} Answered`}
                  </span>
                </>
              )}
            </div>

            {/* Live Countdown Timer */}
            <div
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-mono font-bold text-lg border ${
                timeLeftSeconds < 180
                  ? 'bg-red-950 text-red-400 border-red-800 animate-pulse'
                  : 'bg-slate-800 text-amber-400 border-slate-700'
              }`}
            >
              <Clock className="w-5 h-5" />
              <span>{formatTime(timeLeftSeconds)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Multi-Tab Warning */}
      {multiTabConflict && !isExamCompleted && (
        <div className="max-w-6xl mx-auto bg-amber-950/80 border border-amber-700 rounded-2xl p-3.5 flex items-center justify-between gap-3 text-xs text-amber-200">
          <div className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span>
              This exam appears open in another browser tab. Keep only one tab open to avoid losing your place; your timer remains synced on the server.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setMultiTabConflict(false)}
            className="px-3 py-1 bg-amber-500/20 hover:bg-amber-500/30 rounded-lg font-bold text-amber-200 whitespace-nowrap"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Offline / Sync Warning */}
      {(!isOnline || (draftSyncStatus.state === 'pending_retry' && draftSyncStatus.retryCount > 0)) &&
        !isExamCompleted && (
          <div className="max-w-6xl mx-auto bg-amber-950/70 border border-amber-700 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs text-amber-200">
            <div className="flex items-center gap-2 font-semibold">
              {isOnline ? (
                <Wifi className="w-4 h-4 text-amber-400 flex-shrink-0" />
              ) : (
                <WifiOff className="w-4 h-4 text-amber-400 flex-shrink-0" />
              )}
              <span>
                {!isOnline
                  ? 'Internet connection lost. Your answers are safely cached on this device and will sync automatically once connection returns.'
                  : 'Temporary network interruption while syncing draft answers. Automatic retry is active.'}
              </span>
            </div>
            {isOnline && (
              <button
                type="button"
                onClick={() => void flushDraftToServer()}
                className="px-3 py-1.5 bg-amber-500 text-slate-950 font-bold rounded-xl whitespace-nowrap"
              >
                Sync Now
              </button>
            )}
          </div>
        )}

      {submitError && !isExamCompleted && (
        <div className="max-w-6xl mx-auto bg-red-950/80 border border-red-700 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs text-red-200">
          <div className="flex items-center gap-2 font-bold">
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span>
              {isTerminalSubmitFailure
                ? `${submitError} Your saved server answers are preserved — return to the CBT Portal to check your status.`
                : submitError}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {!isTerminalSubmitFailure && (
              <button
                onClick={() => void handleCompleteExam(timeLeftSeconds === 0)}
                disabled={isSubmitting}
                className="px-4 py-1.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl flex items-center gap-1"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Retry Submission
              </button>
            )}
            <button
              onClick={onFinish}
              className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl"
            >
              Back to CBT Portal
            </button>
          </div>
        </div>
      )}

      {/* Main Exam Interface or Result Review View */}
      {isExamCompleted && finalAttempt ? (
        /* Instant Server-Graded Review Panel */
        <div className="max-w-4xl mx-auto bg-slate-900 border border-slate-800 rounded-3xl p-8 space-y-8 animate-fade-in shadow-2xl">
          {autoSubmittedDueToTime && (
            <div className="bg-amber-950/80 border-2 border-amber-500/80 rounded-2xl p-5 flex items-center gap-4 text-amber-200 animate-pulse shadow-lg">
              <AlertTriangle className="w-8 h-8 text-amber-400 flex-shrink-0" />
              <div className="space-y-1">
                <h4 className="font-bold text-sm text-amber-300 uppercase tracking-wider">
                  Time Allocated Expired - Exam Auto-Submitted
                </h4>
                <p className="text-xs text-amber-200/90 leading-relaxed">
                  Your allocated time for this CBT examination elapsed. All your answers were automatically evaluated, your score was recorded in official school records, and submitted for you.
                </p>
              </div>
            </div>
          )}

          <div className="text-center space-y-4 border-b border-slate-800 pb-6">
            <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto text-3xl bg-emerald-950 text-emerald-400 border-2 border-emerald-500 shadow-lg">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div>
              <span className="text-xs uppercase tracking-widest font-bold text-amber-400 bg-amber-400/10 px-3 py-1 rounded-full border border-amber-400/20">
                Automatic System Marked Score
              </span>
              <h2 className="font-serif font-bold text-3xl text-white mt-2">
                Exam Evaluation Completed
              </h2>
            </div>

            <div className="flex justify-center items-center gap-6 pt-2 flex-wrap">
              <div>
                <p className="text-xs text-slate-400 uppercase font-semibold">Automatic Score</p>
                <p className="font-serif font-black text-4xl text-amber-400">
                  {finalAttempt.scoreObtained} / {finalAttempt.totalMarks}
                </p>
              </div>
              <div className="h-10 w-px bg-slate-800" />
              <div>
                <p className="text-xs text-slate-400 uppercase font-semibold">Percentage</p>
                <p className="font-serif font-black text-4xl text-emerald-400">
                  {finalAttempt.percentage}%
                </p>
              </div>
              <div className="h-10 w-px bg-slate-800" />
              <div>
                <p className="text-xs text-slate-400 uppercase font-semibold">Time Taken</p>
                <p className="font-serif font-black text-2xl text-slate-300">
                  {formatTime(finalAttempt.timeTakenSeconds)}
                </p>
              </div>
            </div>
          </div>

          {/* Question-by-Question Detailed Review from Server (Policy-Gated) */}
          {reviewPermitted && submissionReview.length > 0 ? (
            <div className="space-y-6">
              <h3 className="font-serif font-bold text-xl text-amber-400">Detailed Answer Review</h3>
              {submissionReview.map((item, idx) => {
                const selectedOpt = item.selectedOption;
                const isCorrect = item.isCorrect;

                return (
                  <div
                    key={item.questionId}
                    className={`p-6 rounded-2xl border space-y-3 ${
                      isCorrect
                        ? 'bg-emerald-950/30 border-emerald-800/60'
                        : 'bg-red-950/30 border-red-800/60'
                    }`}
                  >
                    <div className="flex justify-between items-start gap-4">
                      <span className="font-bold text-sm text-slate-200 min-w-0 flex-1">
                        Q{idx + 1}. <MathText text={item.question} />
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded text-xs font-bold whitespace-nowrap ${
                          isCorrect
                            ? 'bg-emerald-900 text-emerald-300'
                            : 'bg-red-900 text-red-300'
                        }`}
                      >
                        {isCorrect ? `+${item.earnedMarks} Marks` : `0 / ${item.marks} Marks`}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      {(['A', 'B', 'C', 'D'] as const).map((opt) => (
                        <div
                          key={opt}
                          className={`p-2.5 rounded-xl border min-w-0 flex items-start gap-1.5 ${
                            item.correctOption && opt === item.correctOption
                              ? 'bg-emerald-900/60 border-emerald-500 text-white font-bold'
                              : selectedOpt === opt
                              ? 'bg-red-900/60 border-red-500 text-white font-bold'
                              : 'bg-slate-800/50 border-slate-700 text-slate-400'
                          }`}
                        >
                          <span className="flex-shrink-0">{opt}.</span>
                          <span className="min-w-0 flex-1">
                            <MathText text={item.options[opt]} />
                          </span>
                        </div>
                      ))}
                    </div>

                    {item.explanation && (
                      <div className="p-3 bg-slate-800/70 border border-slate-700 rounded-xl text-xs text-amber-200">
                        <strong className="text-amber-400">Explanation:</strong>{' '}
                        <MathText text={item.explanation} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-5 bg-slate-800/50 border border-slate-700 rounded-2xl text-center space-y-1.5">
              <p className="text-sm font-bold text-amber-300">Answer Key Review Withheld</p>
              <p className="text-xs text-slate-400">
                {reviewPolicyMessage ||
                  'Correct answers and explanations are withheld in accordance with the school examination review policy.'}
              </p>
            </div>
          )}

          <div className="text-center pt-4 space-y-3 border-t border-slate-800">
            <p className="text-xs text-slate-400">
              Score automatically calculated and recorded in school records. Click below to exit and log out student session.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <button
                onClick={onFinish}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold px-6 py-3.5 rounded-xl text-sm transition-all"
              >
                Back to CBT Portal
              </button>
              <button
                onClick={() => {
                  onFinish();
                  void logout();
                }}
                className="bg-red-600 hover:bg-red-700 text-white font-bold px-8 py-3.5 rounded-xl text-sm transition-all flex items-center gap-2 shadow-xl hover:scale-105"
              >
                <LogOut className="w-4 h-4" /> Confirm Marked Score & Log Out Student
              </button>
            </div>
          </div>
        </div>
      ) : !currentQ ? (
        <div className="max-w-2xl mx-auto bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center space-y-4">
          <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto" />
          <h3 className="font-serif font-bold text-xl">No Questions Available</h3>
          <p className="text-xs text-slate-400">
            This examination currently contains no published questions.
          </p>
          <button
            onClick={onFinish}
            className="bg-amber-500 text-slate-950 font-bold px-6 py-2.5 rounded-xl text-xs"
          >
            Return to Exam List
          </button>
        </div>
      ) : (
        /* Active CBT Examination Player Grid */
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Question Display Card */}
          <div className="lg:col-span-3 bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 space-y-6 flex flex-col justify-between shadow-2xl">
            <div className="space-y-6">
              <div className="flex justify-between items-center border-b border-slate-800 pb-4">
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                  Question {currentQuestionIndex + 1} of {exam.questions.length} ({currentQ.marks}{' '}
                  Marks)
                </span>

                <button
                  onClick={() => toggleFlag(currentQ.id)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                    flaggedQuestions[currentQ.id]
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <Flag className="w-3.5 h-3.5" />
                  {flaggedQuestions[currentQ.id] ? 'Flagged' : 'Flag for Review'}
                </button>
              </div>

              <h3 className="font-serif font-bold text-lg sm:text-xl text-white leading-relaxed min-w-0">
                <MathText text={currentQ.question} />
              </h3>

              {/* Options Selection */}
              <div className="space-y-3">
                {OPTION_SLOTS.map((opt) => {
                  const optionValue = getOptionValueForSlot(currentQ, opt);
                  const isSelected = userAnswers[currentQ.id] === optionValue;

                  return (
                    <button
                      key={opt}
                      onClick={() => handleSelectOption(opt)}
                      disabled={isSubmitting}
                      className={`w-full text-left p-4 rounded-2xl border text-sm font-medium transition-all flex items-center gap-3 min-w-0 ${
                        isSelected
                          ? 'border-amber-400 bg-amber-500/10 text-white font-bold ring-2 ring-amber-400/50'
                          : 'border-slate-800 bg-slate-800/40 hover:bg-slate-800 text-slate-300'
                      }`}
                    >
                      <span
                        className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs flex-shrink-0 ${
                          isSelected
                            ? 'bg-amber-400 text-slate-950'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {opt}
                      </span>
                      <span className="min-w-0 flex-1 overflow-x-auto">
                        <MathText text={currentQ.options[opt]} />
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Navigation Buttons */}
            <div className="pt-6 border-t border-slate-800 flex items-center justify-between gap-3">
              <button
                disabled={currentQuestionIndex === 0 || isSubmitting}
                onClick={() => setCurrentQuestionIndex((prev) => prev - 1)}
                className="px-5 py-2.5 rounded-xl bg-slate-800 text-white font-bold text-xs hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" /> Previous
              </button>

              {currentQuestionIndex < exam.questions.length - 1 ? (
                <button
                  disabled={isSubmitting}
                  onClick={() => setCurrentQuestionIndex((prev) => prev + 1)}
                  className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-2"
                >
                  Next Question <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  disabled={isSubmitting}
                  onClick={() => setShowSubmitConfirmModal(true)}
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-2 shadow-lg"
                >
                  {isSubmitting ? 'Submitting & Grading...' : 'Submit CBT Exam'}{' '}
                  <CheckCircle2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Question Palette Sidebar */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h4 className="font-bold text-xs uppercase tracking-wider text-slate-400">
                Question Palette
              </h4>
              <span className="text-[11px] font-bold text-amber-400">
                {readiness.answeredCount}/{readiness.totalQuestions}
              </span>
            </div>

            <div className="grid grid-cols-5 sm:grid-cols-6 lg:grid-cols-4 gap-2 max-h-[340px] overflow-y-auto pr-1">
              {exam.questions.map((q, idx) => {
                const isAnswered = !!userAnswers[q.id];
                const isCurrent = idx === currentQuestionIndex;
                const isFlagged = !!flaggedQuestions[q.id];

                return (
                  <button
                    key={q.id}
                    onClick={() => setCurrentQuestionIndex(idx)}
                    className={`h-10 rounded-xl font-bold text-xs flex items-center justify-center relative transition-all ${
                      isCurrent
                        ? 'ring-2 ring-amber-400 bg-amber-500 text-slate-950'
                        : isAnswered
                        ? 'bg-emerald-900/60 text-emerald-300 border border-emerald-700'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {idx + 1}
                    {isFlagged && (
                      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-400 rounded-full" />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="pt-4 border-t border-slate-800 space-y-2 text-[11px] text-slate-400">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-emerald-900 border border-emerald-700 rounded-sm" />{' '}
                Answered ({readiness.answeredCount})
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-slate-800 rounded-sm" /> Unanswered (
                {readiness.unansweredCount})
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-amber-400 rounded-sm" /> Flagged (
                {readiness.flaggedCount})
              </div>
            </div>

            <button
              disabled={isSubmitting}
              onClick={() => setShowSubmitConfirmModal(true)}
              className="w-full bg-red-900/60 hover:bg-red-800 disabled:opacity-50 text-red-200 border border-red-700 font-bold py-2.5 rounded-xl text-xs transition-colors"
            >
              {isSubmitting ? 'Submitting...' : 'Finish & Submit Test'}
            </button>
          </div>
        </div>
      )}

      {/* Submission Confirmation Modal (Prevents Accidental 1-Click Submission) */}
      {showSubmitConfirmModal && !isExamCompleted && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-serif font-bold text-lg text-white">
                  Confirm CBT Examination Submission
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Once submitted, your answers will be graded immediately and this 1-attempt examination cannot be reopened.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-800/60">
                <p className="text-slate-400 text-[10px] uppercase font-bold">Answered</p>
                <p className="font-bold text-lg text-emerald-400">{readiness.answeredCount}</p>
              </div>
              <div
                className={`p-3 rounded-xl border ${
                  readiness.unansweredCount > 0
                    ? 'bg-amber-950/60 border-amber-700/70'
                    : 'bg-slate-800 border-slate-700'
                }`}
              >
                <p className="text-slate-400 text-[10px] uppercase font-bold">Unanswered</p>
                <p
                  className={`font-bold text-lg ${
                    readiness.unansweredCount > 0 ? 'text-amber-400' : 'text-slate-300'
                  }`}
                >
                  {readiness.unansweredCount}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-800 border border-slate-700">
                <p className="text-slate-400 text-[10px] uppercase font-bold">Flagged</p>
                <p className="font-bold text-lg text-slate-200">{readiness.flaggedCount}</p>
              </div>
            </div>

            {readiness.unansweredCount > 0 && (
              <div className="p-3 rounded-xl bg-amber-950/50 border border-amber-800/60 text-xs text-amber-200">
                Unanswered Question(s):{' '}
                <strong>
                  {readiness.unansweredQuestionNumbers.slice(0, 12).join(', ')}
                  {readiness.unansweredQuestionNumbers.length > 12 ? '...' : ''}
                </strong>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowSubmitConfirmModal(false)}
                className="flex-1 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs"
              >
                Review Questions
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => void handleCompleteExam(false)}
                className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                {isSubmitting ? 'Submitting...' : 'Confirm Final Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
