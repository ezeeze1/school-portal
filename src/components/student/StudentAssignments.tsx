import React, { useState } from 'react';
import { useSchool } from '../../context/SchoolContext';
import { Student } from '../../types';
import { doesStudentClassMatch } from '../../lib/academicSelection';
import { Download, FileText, CheckCircle2, Clock, Send, FileType, FileCode, AlertCircle, Award, ExternalLink } from 'lucide-react';

export const StudentAssignments: React.FC<{ student: Student }> = ({ student }) => {
  const { assignments, assignmentSubmissions, submitAssignmentAnswer, studyNotes } = useSchool();
  const [activeTab, setActiveTab] = useState<'assignments' | 'notes'>('assignments');
  const [submissionText, setSubmissionText] = useState('');
  const [submissionFileUrl, setSubmissionFileUrl] = useState('');
  const [activeAsgId, setActiveAsgId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  const studentAssignments = assignments.filter((a) =>
    doesStudentClassMatch(a.classId, a.className, student)
  );

  const studentNotes = studyNotes.filter(
    (n) =>
      !n.classId ||
      n.classId === 'all' ||
      n.className === 'All Classes' ||
      doesStudentClassMatch(n.classId, n.className, student)
  );

  const handleSubmitHomework = async (asgId: string) => {
    if (!submissionText.trim() && !submissionFileUrl.trim()) {
      setSubmitError('Please enter your homework answer or attach a completed file URL.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(null);
    try {
      const res = await submitAssignmentAnswer(
        asgId,
        submissionText.trim() || 'Submitted attachment.',
        submissionFileUrl.trim() || undefined
      );
      if (!res.ok) {
        setSubmitError(res.error || 'Failed to submit homework.');
        return;
      }
      setActiveAsgId(null);
      setSubmissionText('');
      setSubmissionFileUrl('');
      setSubmitSuccess('Homework answer submitted successfully.');
      setTimeout(() => setSubmitSuccess(null), 4000);
    } catch (err: any) {
      setSubmitError(err?.message || 'Failed to submit homework.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      
      {/* Header Tabs */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-md flex justify-between items-center">
        <div>
          <h2 className="font-serif font-bold text-2xl text-slate-900 dark:text-white">
            Assignments & Study Materials
          </h2>
          <p className="text-xs text-slate-500">Access homework prompts and download teacher lecture notes in Text, Word, or PDF.</p>
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
            Download Notes ({studentNotes.length})
          </button>
        </div>
      </div>

      {submitSuccess && (
        <div className="bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 p-4 rounded-2xl text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          <span>{submitSuccess}</span>
        </div>
      )}

      {activeTab === 'assignments' ? (
        <div className="space-y-6">
          {studentAssignments.map((asg) => {
            const existingSubmission = assignmentSubmissions.find(
              (sub) => sub.assignmentId === asg.id && sub.studentId === student.id
            );
            const fmt = asg.format || 'text';

            return (
              <div
                key={asg.id}
                className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-sm"
              >
                <div className="flex justify-between items-start gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 px-2.5 py-0.5 rounded">
                        {asg.subjectName}
                      </span>

                      {/* Format Badge */}
                      {fmt === 'word' ? (
                        <span className="text-[10px] font-bold bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 px-2 py-0.5 rounded flex items-center gap-1">
                          <FileType className="w-3 h-3 text-blue-500" /> Word (.docx)
                        </span>
                      ) : fmt === 'pdf' ? (
                        <span className="text-[10px] font-bold bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 px-2 py-0.5 rounded flex items-center gap-1">
                          <FileCode className="w-3 h-3 text-rose-500" /> PDF (.pdf)
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded flex items-center gap-1">
                          <FileText className="w-3 h-3 text-amber-500" /> Text Prompt
                        </span>
                      )}
                    </div>

                    <h3 className="font-bold text-lg text-slate-900 dark:text-white mt-1">
                      {asg.title}
                    </h3>
                    <p className="text-xs text-slate-500">Posted by {asg.teacherName}</p>
                  </div>

                  <div className="text-right text-xs">
                    <span className="text-red-500 font-bold flex items-center gap-1 bg-red-50 dark:bg-red-950/40 px-2.5 py-1 rounded-lg border border-red-200 dark:border-red-900">
                      <Clock className="w-3.5 h-3.5" /> Due: {asg.dueDate}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                  {asg.description}
                </p>

                {/* Full Text Questions if text format */}
                {asg.content && (
                  <div className="bg-slate-900 text-slate-200 p-4 rounded-2xl font-mono text-xs whitespace-pre-wrap border border-slate-800 space-y-1">
                    <p className="text-[10px] text-amber-400 font-sans font-bold uppercase tracking-wider">Assignment Questions / Prompt:</p>
                    {asg.content}
                  </div>
                )}

                {/* Word / PDF Download Attachment Bar */}
                {(asg.attachmentName || fmt !== 'text') && (
                  <div className="bg-slate-100 dark:bg-slate-800 p-3.5 rounded-2xl flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 font-mono">
                      {fmt === 'word' ? <FileType className="w-4 h-4 text-blue-500" /> : <FileCode className="w-4 h-4 text-rose-500" />}
                      <span className="font-bold text-slate-900 dark:text-white truncate max-w-[220px]">
                        {asg.attachmentName || `${asg.title}.${fmt === 'word' ? 'docx' : 'pdf'}`}
                      </span>
                      <span className="text-[10px] text-slate-500">({asg.fileSize || 'Downloadable File'})</span>
                    </div>

                    <a
                      href={asg.attachmentUrl || '#'}
                      download={asg.attachmentName || 'Assignment'}
                      onClick={(e) => {
                        if (!asg.attachmentUrl || asg.attachmentUrl === '#') {
                          e.preventDefault();
                          alert(`Downloading ${asg.attachmentName || asg.title}...`);
                        }
                      }}
                      className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-xs"
                    >
                      <Download className="w-3.5 h-3.5" /> Download {fmt === 'word' ? 'Word Document' : 'PDF Document'}
                    </a>
                  </div>
                )}

                <div className="pt-2">
                  {existingSubmission ? (
                    <div className="bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-200 p-4 rounded-2xl text-xs border border-emerald-200 dark:border-emerald-800 space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2 font-bold">
                        <span className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Homework Submitted ({existingSubmission.submissionDate})
                        </span>
                        {existingSubmission.grade !== undefined && existingSubmission.grade !== null ? (
                          <span className="bg-amber-500 text-slate-950 px-2.5 py-0.5 rounded-full text-[11px] font-black flex items-center gap-1">
                            <Award className="w-3.5 h-3.5" /> Score: {existingSubmission.grade} / {asg.totalMarks || 20}
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono opacity-80">Awaiting teacher grading</span>
                        )}
                      </div>

                      <div className="bg-white/70 dark:bg-slate-900/60 p-3 rounded-xl border border-emerald-200/70 dark:border-emerald-900 text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                        {existingSubmission.content}
                      </div>

                      {existingSubmission.fileUrl && (
                        <a
                          href={existingSubmission.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 dark:text-amber-300 hover:underline"
                        >
                          <ExternalLink className="w-3 h-3" /> View Submitted Attachment
                        </a>
                      )}

                      {existingSubmission.feedback && (
                        <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200">
                          <strong>Teacher Feedback:</strong> {existingSubmission.feedback}
                        </div>
                      )}
                    </div>
                  ) : activeAsgId === asg.id ? (
                    <div className="w-full space-y-3 pt-2">
                      {submitError && (
                        <div className="p-2.5 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs font-bold flex items-center gap-1.5">
                          <AlertCircle className="w-4 h-4 flex-shrink-0" />
                          <span>{submitError}</span>
                        </div>
                      )}
                      <textarea
                        rows={3}
                        value={submissionText}
                        onChange={(e) => {
                          setSubmissionText(e.target.value);
                          setSubmitError(null);
                        }}
                        placeholder="Type your homework answer here..."
                        className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:border-amber-500"
                      />
                      <input
                        type="url"
                        value={submissionFileUrl}
                        onChange={(e) => setSubmissionFileUrl(e.target.value)}
                        placeholder="Optional link to completed file (e.g. Google Drive / Docs URL)"
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white outline-none focus:border-amber-500"
                      />
                      <div className="flex gap-2">
                        <button
                          disabled={isSubmitting}
                          onClick={() => void handleSubmitHomework(asg.id)}
                          className="bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1 shadow-sm"
                        >
                          {isSubmitting ? 'Submitting...' : 'Submit Answer'} <Send className="w-3.5 h-3.5" />
                        </button>
                        <button
                          disabled={isSubmitting}
                          onClick={() => {
                            setActiveAsgId(null);
                            setSubmitError(null);
                          }}
                          className="bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold px-4 py-2 rounded-xl text-xs"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setActiveAsgId(asg.id);
                        setSubmissionText('');
                        setSubmissionFileUrl('');
                        setSubmitError(null);
                      }}
                      className="bg-slate-900 hover:bg-slate-800 dark:bg-amber-500 text-white dark:text-slate-950 font-bold px-5 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-sm"
                    >
                      <Send className="w-3.5 h-3.5" /> Submit Homework Answer
                    </button>
                  )}
                </div>

              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {studentNotes.map((note) => (
            <div
              key={note.id}
              className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 space-y-3 shadow-sm flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-bold uppercase bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 px-2 py-0.5 rounded">
                    {note.subjectName}
                  </span>
                  <span className="text-[10px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded">
                    {note.className || 'All Classes'}
                  </span>
                </div>
                <h4 className="font-bold text-base text-slate-900 dark:text-white">
                  {note.title}
                </h4>
                <p className="text-xs text-slate-500">{note.description}</p>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center text-xs">
                <span className="text-slate-400 font-mono text-[11px]">{note.fileSize || 'PDF Document'}</span>
                <button
                  onClick={() => alert(`Downloading "${note.title}" (${note.className})`)}
                  className="bg-slate-900 hover:bg-slate-800 dark:bg-amber-500 text-white dark:text-slate-950 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-all shadow-sm"
                >
                  <Download className="w-3.5 h-3.5" /> Download Note
                </button>
              </div>
            </div>
          ))}

          {studentNotes.length === 0 && (
            <div className="md:col-span-2 p-8 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 text-xs text-slate-500">
              No lecture notes have been published for your class yet. Check back soon!
            </div>
          )}
        </div>
      )}

    </div>
  );
};
