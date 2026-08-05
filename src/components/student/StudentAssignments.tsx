import React, { useState } from 'react';
import { useSchool } from '../../context/SchoolContext';
import { Student } from '../../types';
import { BookOpen, Download, FileText, Calendar, CheckCircle2, Clock, Send } from 'lucide-react';

export const StudentAssignments: React.FC<{ student: Student }> = ({ student }) => {
  const { assignments, studyNotes } = useSchool();
  const [activeTab, setActiveTab] = useState<'assignments' | 'notes'>('assignments');
  const [submittedTasks, setSubmittedTasks] = useState<Record<string, string>>({});
  const [submissionText, setSubmissionText] = useState('');
  const [activeAsgId, setActiveAsgId] = useState<string | null>(null);

  const studentAssignments = assignments.filter(
    (a) => a.classId === student.classId || a.className.includes(student.className)
  );

  const handleSubmitHomework = (asgId: string) => {
    setSubmittedTasks((prev) => ({ ...prev, [asgId]: submissionText || 'Answer submitted.' }));
    setActiveAsgId(null);
    setSubmissionText('');
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      
      {/* Header Tabs */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-md flex justify-between items-center">
        <div>
          <h2 className="font-serif font-bold text-2xl text-slate-900 dark:text-white">
            Assignments & Study Materials
          </h2>
          <p className="text-xs text-slate-500">Access homework prompts and download teacher lecture notes.</p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('assignments')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'assignments'
                ? 'bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950 shadow-md'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
            }`}
          >
            Assignments ({studentAssignments.length})
          </button>
          <button
            onClick={() => setActiveTab('notes')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'notes'
                ? 'bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950 shadow-md'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
            }`}
          >
            Download Notes ({studyNotes.length})
          </button>
        </div>
      </div>

      {activeTab === 'assignments' ? (
        <div className="space-y-6">
          {studentAssignments.map((asg) => {
            const isDone = !!submittedTasks[asg.id];

            return (
              <div
                key={asg.id}
                className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-sm"
              >
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <span className="text-[10px] font-bold uppercase bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 px-2.5 py-0.5 rounded">
                      {asg.subjectName}
                    </span>
                    <h3 className="font-bold text-lg text-slate-900 dark:text-white mt-1">
                      {asg.title}
                    </h3>
                    <p className="text-xs text-slate-500">Posted by {asg.teacherName}</p>
                  </div>

                  <div className="text-right text-xs">
                    <span className="text-red-500 font-bold flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" /> Due: {asg.dueDate}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                  {asg.description}
                </p>

                <div className="pt-2 flex items-center justify-between">
                  {isDone ? (
                    <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                      <CheckCircle2 className="w-4 h-4" /> Homework Submitted
                    </span>
                  ) : activeAsgId === asg.id ? (
                    <div className="w-full space-y-3 pt-2">
                      <textarea
                        rows={3}
                        value={submissionText}
                        onChange={(e) => setSubmissionText(e.target.value)}
                        placeholder="Type your homework response or paste drive link here..."
                        className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSubmitHomework(asg.id)}
                          className="bg-amber-500 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1"
                        >
                          Submit Answer <Send className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setActiveAsgId(null)}
                          className="bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold px-4 py-2 rounded-xl text-xs"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setActiveAsgId(asg.id)}
                      className="bg-slate-900 hover:bg-slate-800 dark:bg-amber-500 text-white dark:text-slate-950 font-bold px-5 py-2.5 rounded-xl text-xs flex items-center gap-2"
                    >
                      <Send className="w-3.5 h-3.5" /> Submit Response
                    </button>
                  )}
                </div>

              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {studyNotes.map((note) => (
            <div
              key={note.id}
              className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 space-y-3 shadow-sm flex flex-col justify-between"
            >
              <div className="space-y-2">
                <span className="text-[10px] font-bold uppercase bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 px-2 py-0.5 rounded">
                  {note.subjectName}
                </span>
                <h4 className="font-bold text-base text-slate-900 dark:text-white">
                  {note.title}
                </h4>
                <p className="text-xs text-slate-500">{note.description}</p>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-xs">
                <span className="text-slate-400">{note.fileSize}</span>
                <button
                  onClick={() => alert(`Downloading "${note.title}" PDF`)}
                  className="bg-slate-900 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" /> Download PDF
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  );
};
