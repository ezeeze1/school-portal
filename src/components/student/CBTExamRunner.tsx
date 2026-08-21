import React, { useState, useEffect, useRef } from 'react';
import { useSchool } from '../../context/SchoolContext';
import { CBTExam, Student } from '../../types';
import { Clock, AlertTriangle, CheckCircle2, XCircle, Flag, ArrowLeft, ArrowRight, Award, ShieldCheck, Sparkles, LogOut } from 'lucide-react';

interface CBTExamRunnerProps {
  exam: CBTExam;
  student: Student;
  onFinish: () => void;
}

export const CBTExamRunner: React.FC<CBTExamRunnerProps> = ({ exam, student, onFinish }) => {
  const { submitCBTAttempt, logout } = useSchool();
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, 'A' | 'B' | 'C' | 'D'>>({});
  const [flaggedQuestions, setFlaggedQuestions] = useState<Record<string, boolean>>({});
  
  // Timer state in seconds
  const [timeLeftSeconds, setTimeLeftSeconds] = useState(exam.durationMinutes * 60);
  const [isExamCompleted, setIsExamCompleted] = useState(false);
  const [autoSubmittedDueToTime, setAutoSubmittedDueToTime] = useState(false);
  const [finalScore, setFinalScore] = useState<any>(null);

  const currentQ = exam.questions[currentQuestionIndex];

  // Store refs to keep values fresh during interval callbacks
  const userAnswersRef = useRef(userAnswers);
  useEffect(() => {
    userAnswersRef.current = userAnswers;
  }, [userAnswers]);

  const timeLeftRef = useRef(timeLeftSeconds);
  useEffect(() => {
    timeLeftRef.current = timeLeftSeconds;
  }, [timeLeftSeconds]);

  const isExamCompletedRef = useRef(isExamCompleted);
  useEffect(() => {
    isExamCompletedRef.current = isExamCompleted;
  }, [isExamCompleted]);

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

  // Handle auto-completion when timer hits 0
  useEffect(() => {
    if (timeLeftSeconds === 0 && !isExamCompleted) {
      handleCompleteExam(true);
    }
  }, [timeLeftSeconds, isExamCompleted]);

  const handleSelectOption = (option: 'A' | 'B' | 'C' | 'D') => {
    if (isExamCompleted) return;
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

  const handleCompleteExam = (isAutoSubmit = false) => {
    if (isExamCompletedRef.current) return;

    const answersToGrade = userAnswersRef.current;
    let obtainedMarks = 0;
    exam.questions.forEach((q) => {
      if (answersToGrade[q.id] === q.correctOption) {
        obtainedMarks += q.marks;
      }
    });

    const percentage = Math.round((obtainedMarks / exam.totalMarks) * 100);
    const timeTaken = isAutoSubmit
      ? exam.durationMinutes * 60
      : exam.durationMinutes * 60 - timeLeftRef.current;

    const resultData = {
      examId: exam.id,
      studentId: student.id,
      studentName: `${student.firstName} ${student.lastName}`,
      admissionNo: student.admissionNo,
      scoreObtained: obtainedMarks,
      totalMarks: exam.totalMarks,
      percentage,
      passed: percentage >= 50,
      timeTakenSeconds: Math.max(1, timeTaken),
      completedAt: new Date().toISOString(),
      answers: answersToGrade,
    };

    submitCBTAttempt(resultData);
    setFinalScore(resultData);
    if (isAutoSubmit) {
      setAutoSubmittedDueToTime(true);
    }
    setIsExamCompleted(true);
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

      {/* Main Exam Interface or Result Review View */}
      {isExamCompleted && finalScore ? (
        /* Instant Grade Review Panel */
        <div className="max-w-4xl mx-auto bg-slate-900 border border-slate-800 rounded-3xl p-8 space-y-8 animate-fade-in shadow-2xl">
          {autoSubmittedDueToTime && (
            <div className="bg-amber-950/80 border-2 border-amber-500/80 rounded-2xl p-5 flex items-center gap-4 text-amber-200 animate-pulse shadow-lg">
              <AlertTriangle className="w-8 h-8 text-amber-400 flex-shrink-0" />
              <div className="space-y-1">
                <h4 className="font-bold text-sm text-amber-300 uppercase tracking-wider">
                  ⚠️ Time Allocated Expired - Exam Auto-Submitted
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
                ⚡ Automatic System Marked Score
              </span>
              <h2 className="font-serif font-bold text-3xl text-white mt-2">
                Exam Evaluation Completed
              </h2>
            </div>

            <div className="flex justify-center items-center gap-6 pt-2">
              <div>
                <p className="text-xs text-slate-400 uppercase font-semibold">Automatic Score</p>
                <p className="font-serif font-black text-4xl text-amber-400">{finalScore.scoreObtained} / {finalScore.totalMarks}</p>
              </div>
              <div className="h-10 w-px bg-slate-800" />
              <div>
                <p className="text-xs text-slate-400 uppercase font-semibold">Percentage</p>
                <p className="font-serif font-black text-4xl text-emerald-400">{finalScore.percentage}%</p>
              </div>
              <div className="h-10 w-px bg-slate-800" />
              <div>
                <p className="text-xs text-slate-400 uppercase font-semibold">Time Taken</p>
                <p className="font-serif font-black text-2xl text-slate-300">{formatTime(finalScore.timeTakenSeconds)}</p>
              </div>
            </div>
          </div>

          {/* Question-by-Question Detailed Review */}
          <div className="space-y-6">
            <h3 className="font-serif font-bold text-xl text-amber-400">Detailed Answer Review</h3>
            {exam.questions.map((q, idx) => {
              const selectedOpt = userAnswers[q.id];
              const isCorrect = selectedOpt === q.correctOption;

              return (
                <div
                  key={q.id}
                  className={`p-6 rounded-2xl border space-y-3 ${
                    isCorrect ? 'bg-emerald-950/30 border-emerald-800/60' : 'bg-red-950/30 border-red-800/60'
                  }`}
                >
                  <div className="flex justify-between items-start gap-4">
                    <span className="font-bold text-sm text-slate-200">
                      Q{idx + 1}. {q.question}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded text-xs font-bold ${
                      isCorrect ? 'bg-emerald-900 text-emerald-300' : 'bg-red-900 text-red-300'
                    }`}>
                      {isCorrect ? `+${q.marks} Marks` : '0 Marks'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {(['A', 'B', 'C', 'D'] as const).map((opt) => (
                      <div
                        key={opt}
                        className={`p-2.5 rounded-xl border ${
                          opt === q.correctOption
                            ? 'bg-emerald-900/60 border-emerald-500 text-white font-bold'
                            : selectedOpt === opt
                            ? 'bg-red-900/60 border-red-500 text-white font-bold'
                            : 'bg-slate-800/50 border-slate-700 text-slate-400'
                        }`}
                      >
                        {opt}. {q.options[opt]}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="text-center pt-4 space-y-3 border-t border-slate-800">
            <p className="text-xs text-slate-400">
              Score automatically calculated and recorded in school records. Click below to exit and log out student session.
            </p>
            <button
              onClick={() => {
                onFinish();
                logout();
              }}
              className="bg-red-600 hover:bg-red-700 text-white font-bold px-8 py-3.5 rounded-xl text-sm transition-all flex items-center gap-2 mx-auto shadow-xl hover:scale-105"
            >
              <LogOut className="w-4 h-4" /> Confirm Marked Score & Log Out Student
            </button>
          </div>
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
                disabled={currentQuestionIndex === 0}
                onClick={() => setCurrentQuestionIndex((prev) => prev - 1)}
                className="px-5 py-2.5 rounded-xl bg-slate-800 text-white font-bold text-xs hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" /> Previous
              </button>

              {currentQuestionIndex < exam.questions.length - 1 ? (
                <button
                  onClick={() => setCurrentQuestionIndex((prev) => prev + 1)}
                  className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs flex items-center gap-2"
                >
                  Next Question <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={handleCompleteExam}
                  className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg"
                >
                  Submit CBT Exam <CheckCircle2 className="w-4 h-4" />
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
              onClick={handleCompleteExam}
              className="w-full bg-red-900/60 hover:bg-red-800 text-red-200 border border-red-700 font-bold py-2.5 rounded-xl text-xs transition-colors"
            >
              Finish & Submit Test
            </button>
          </div>

        </div>
      )}

    </div>
  );
};
