import React, { useState } from 'react';
import { useSchool } from '../../context/SchoolContext';
import { Student, CBTExam } from '../../types';
import { Clock, Play, Award, CheckCircle2, AlertCircle, Calendar } from 'lucide-react';
import { CBTExamRunner } from './CBTExamRunner';

export const StudentCBTList: React.FC<{ student: Student }> = ({ student }) => {
  const { cbtExams, cbtAttempts } = useSchool();
  const [activeExam, setActiveExam] = useState<CBTExam | null>(null);

  // Available CBT exams for this student's class
  const classExams = cbtExams.filter(
    (e) => e.isPublished && (e.classId === student.classId || e.className.includes(student.className))
  );

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      
      {activeExam ? (
        <CBTExamRunner
          exam={activeExam}
          student={student}
          onFinish={() => setActiveExam(null)}
        />
      ) : (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-md flex justify-between items-center">
            <div>
              <h2 className="font-serif font-bold text-2xl text-slate-900 dark:text-white">
                CBT Online Examination Portal
              </h2>
              <p className="text-xs text-slate-500">
                Take timed objective assessments, review scores, and track past CBT test attempts.
              </p>
            </div>

            <div className="bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1.5">
              <Clock className="w-4 h-4" /> Auto-Timed & Instant Scoring
            </div>
          </div>

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
                          Start Date & Time: <strong className="font-bold">{exam.startDate} @ {exam.startTime || '08:00'}</strong>
                        </p>
                        <p>Questions: <strong>{exam.totalQuestions} Questions</strong> ({exam.totalMarks} Marks)</p>
                      </div>

                      <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                        {pastAttempt ? (
                          <div className="flex items-center gap-2 text-xs">
                            <span className={`font-bold px-2.5 py-1 rounded-full ${
                              pastAttempt.passed ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                            }`}>
                              Completed: {pastAttempt.percentage}%
                            </span>
                            <button
                              onClick={() => setActiveExam(exam)}
                              className="text-amber-600 font-bold hover:underline text-xs"
                            >
                              Retake / Review
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setActiveExam(exam)}
                            className="w-full bg-slate-900 hover:bg-slate-800 dark:bg-amber-500 dark:hover:bg-amber-600 dark:text-slate-950 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-2 transition-colors"
                          >
                            <Play className="w-4 h-4" /> Start CBT Exam Now
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
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800 text-slate-500 uppercase text-[10px] font-bold">
                      <th className="p-3">Exam ID</th>
                      <th className="p-3">Date Completed</th>
                      <th className="p-3 text-center">Score</th>
                      <th className="p-3 text-center">Percentage</th>
                      <th className="p-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {cbtAttempts
                      .filter((a) => a.studentId === student.id)
                      .map((attempt) => (
                        <tr key={attempt.id}>
                          <td className="p-3 font-mono text-slate-900 dark:text-white">{attempt.examId}</td>
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
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      )}

    </div>
  );
};
