import React, { useState, useEffect, useRef } from 'react';
import { useSchool } from '../../context/SchoolContext';
import { CBTAttempt, CBTQuestionReview, CBTStartResponse, Student } from '../../types';
import { Clock, AlertTriangle, CheckCircle2, Flag, ArrowLeft, ArrowRight, LogOut, RotateCcw } from 'lucide-react';

interface CBTExamRunnerProps {
  session: CBTStartResponse;
  student: Student;
  onFinish: () => void;
}

export const CBTExamRunner: React.FC<CBTExamRunnerProps> = ({ session, student, onFinish }) => {
  const { submitCBTExamSession, logout } = useSchool();
  const exam = session.exam;

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, 'A' | 'B' | 'C' | 'D'>>({});
  const [flaggedQuestions, setFlaggedQuestions] = useState<Record<string, boolean>>({});

  // Server-authoritative remaining seconds
  const initialRemaining = Math.max(1, session.remainingSeconds || exam.durationMinutes * 60);
  const [timeLeftSeconds, setTimeLeftSeconds] = useState(initialRemaining);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isExamCompleted, setIsExamCompleted] = useState(false);
  const [autoSubmittedDueToTime, setAutoSubmittedDueToTime] = useState(false);
  const [finalAttempt, setFinalAttempt] = useState<CBTAttempt | null>(null);
  const [submissionReview, setSubmissionReview] = useState<CBTQuestionReview[]>([]);

  const currentQ = exam.questions[currentQuestionIndex];

  const userAnswersRef = useRef(userAnswers);
  useEffect(() => {
    userAnswersRef.current = userAnswers;
  }, [userAnswers]);

  const isExamCompletedRef = useRef(isExamCompleted);
  useEffect(() => {
    isExamCompletedRef.current = isExamCompleted;
  }, [isExamCompleted]);

  const isSubmittingRef = useRef(isSubmitting);
  useEffect(() => {
    isSubmittingRef.current = isSubmitting;
  }, [isSubmitting]);

  // Timer Countdown Effect
  useEffect(() => {
    if (isExamCompleted) return;

    const timer = setInterval(() => {
      setTimeLeftSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isExamCompleted]);

  const handleCompleteExam = async (isAutoSubmit = false) => {
    if (isExamCompletedRef.current || isSubmittingRef.current) return;

    setIsSubmitting(true);
    isSubmittingRef.current = true;
    setSubmitError(null);

    try {
      const response = await submitCBTExamSession(exam.id, userAnswersRef.current);
      setFinalAttempt(response.attempt);
      setSubmissionReview(response.review || []);
      if (isAutoSubmit) {
        setAutoSubmittedDueToTime(true);
      }
      setIsExamCompleted(true);
    } catch (err: any) {
      setSubmitError(
        err?.message || 'Unable to submit exam answers to the server. Please retry.'
      );
    } finally {
      setIsSubmitting(false);
      isSubmittingRef.current = false;
    }
  };

  // Handle auto-completion when timer hits 0
  useEffect(() => {
    if (timeLeftSeconds === 0 && !isExamCompleted && !isSubmittingRef.current) {
      void handleCompleteExam(true);
    }
  }, [timeLeftSeconds, isExamCompleted]);

  const handleSelectOption = (option: 'A' | 'B' | 'C' | 'D') => {
    if (isExamCompleted || isSubmitting || !currentQ) return;
    setUserAnswers((prev) => ({
      ...prev,
      [currentQ.id]: option,
    }));
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

        {/* Live Countdown Timer */}
        {!isExamCompleted && (
          <div className={`flex items-center gap-2 px-4 py-2 rounded-xl font-mono font-bold text-lg border ${
            timeLeftSeconds < 180 ? 'bg-red-950 text-red-400 border-red-800 animate-pulse' : 'bg-slate-800 text-amber-400 border-slate-700'
          }`}>
            <Clock className="w-5 h-5" />
            <span>{formatTime(timeLeftSeconds)}</span>
          </div>
        )}
      </div>

      {submitError && !isExamCompleted && (
        <div className="max-w-6xl mx-auto bg-red-950/80 border border-red-700 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs text-red-200">
          <div className="flex items-center gap-2 font-bold">
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span>{submitError}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => void handleCompleteExam(timeLeftSeconds === 0)}
              disabled={isSubmitting}
              className="px-4 py-1.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Retry Submission
            </button>
            <button
              onClick={onFinish}
              className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl"
            >
              Exit to List
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
                <p className="font-serif font-black text-4xl text-emerald-400">{finalAttempt.percentage}%</p>
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

          {/* Question-by-Question Detailed Review from Server */}
          <div className="space-y-6">
            <h3 className="font-serif font-bold text-xl text-amber-400">Detailed Answer Review</h3>
            {submissionReview.map((item, idx) => {
              const selectedOpt = item.selectedOption;
              const isCorrect = item.isCorrect;

              return (
                <div
                  key={item.questionId}
                  className={`p-6 rounded-2xl border space-y-3 ${
                    isCorrect ? 'bg-emerald-950/30 border-emerald-800/60' : 'bg-red-950/30 border-red-800/60'
                  }`}
                >
                  <div className="flex justify-between items-start gap-4">
                    <span className="font-bold text-sm text-slate-200">
                      Q{idx + 1}. {item.question}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded text-xs font-bold whitespace-nowrap ${
                      isCorrect ? 'bg-emerald-900 text-emerald-300' : 'bg-red-900 text-red-300'
                    }`}>
                      {isCorrect ? `+${item.earnedMarks} Marks` : `0 / ${item.marks} Marks`}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {(['A', 'B', 'C', 'D'] as const).map((opt) => (
                      <div
                        key={opt}
                        className={`p-2.5 rounded-xl border ${
                          opt === item.correctOption
                            ? 'bg-emerald-900/60 border-emerald-500 text-white font-bold'
                            : selectedOpt === opt
                            ? 'bg-red-900/60 border-red-500 text-white font-bold'
                            : 'bg-slate-800/50 border-slate-700 text-slate-400'
                        }`}
                      >
                        {opt}. {item.options[opt]}
                      </div>
                    ))}
                  </div>

                  {item.explanation && (
                    <div className="p-3 bg-slate-800/70 border border-slate-700 rounded-xl text-xs text-amber-200">
                      <strong className="text-amber-400">Explanation:</strong> {item.explanation}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

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
          <p className="text-xs text-slate-400">This examination currently contains no published questions.</p>
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
                  Question {currentQuestionIndex + 1} of {exam.questions.length} ({currentQ.marks} Marks)
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

              <h3 className="font-serif font-bold text-lg sm:text-xl text-white leading-relaxed">
                {currentQ.question}
              </h3>

              {/* Options Selection */}
              <div className="space-y-3">
                {(['A', 'B', 'C', 'D'] as const).map((opt) => {
                  const isSelected = userAnswers[currentQ.id] === opt;

                  return (
                    <button
                      key={opt}
                      onClick={() => handleSelectOption(opt)}
                      disabled={isSubmitting}
                      className={`w-full text-left p-4 rounded-2xl border text-sm font-medium transition-all flex items-center gap-3 ${
                        isSelected
                          ? 'border-amber-400 bg-amber-500/10 text-white font-bold ring-2 ring-amber-400/50'
                          : 'border-slate-800 bg-slate-800/40 hover:bg-slate-800 text-slate-300'
                      }`}
                    >
                      <span className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs ${
                        isSelected ? 'bg-amber-400 text-slate-950' : 'bg-slate-800 text-slate-400'
                      }`}>
                        {opt}
                      </span>
                      <span>{currentQ.options[opt]}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Navigation Buttons */}
            <div className="pt-6 border-t border-slate-800 flex items-center justify-between">
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
                  onClick={() => void handleCompleteExam(false)}
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-2 shadow-lg"
                >
                  {isSubmitting ? 'Submitting & Grading...' : 'Submit CBT Exam'} <CheckCircle2 className="w-4 h-4" />
                </button>
              )}
            </div>

          </div>

          {/* Question Palette Sidebar */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6">
            <h4 className="font-bold text-xs uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-2">
              Question Palette Grid
            </h4>

            <div className="grid grid-cols-4 gap-2">
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
                <span className="w-3 h-3 bg-emerald-900 border border-emerald-700 rounded-sm" /> Answered
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-slate-800 rounded-sm" /> Unanswered
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-amber-400 rounded-sm" /> Flagged for review
              </div>
            </div>

            <button
              disabled={isSubmitting}
              onClick={() => void handleCompleteExam(false)}
              className="w-full bg-red-900/60 hover:bg-red-800 disabled:opacity-50 text-red-200 border border-red-700 font-bold py-2.5 rounded-xl text-xs transition-colors"
            >
              {isSubmitting ? 'Submitting...' : 'Finish & Submit Test'}
            </button>
          </div>

        </div>
      )}

    </div>
  );
};
