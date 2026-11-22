import React, { useEffect, useState } from 'react';
import { useSchool } from '../../context/SchoolContext';
import { Assignment, StudyNote } from '../../types';
import {
  resolveMatchingTeacher,
  resolveSyncedSelectionId,
  validateAcademicEntityReferences,
} from '../../lib/academicSelection';
import { BookOpen, Plus, FileText, Upload, Trash2, CheckCircle2, FileType, FileCode, Paperclip, Download, Send, Users, Award, ExternalLink, AlertCircle } from 'lucide-react';
import { ConfirmDeleteModal } from '../common/ConfirmDeleteModal';

export const AssignmentsManager: React.FC = () => {
  const { assignments, assignmentSubmissions, gradeAssignmentSubmission, studyNotes, addAssignment, deleteAssignment, addStudyNote, deleteStudyNote, classes, subjects, teachers, currentUser } = useSchool();
  const matchedTeacher = resolveMatchingTeacher(currentUser, teachers);
  const resolvedTeacherId = matchedTeacher?.id;
  const resolvedTeacherName = matchedTeacher
    ? `${matchedTeacher.firstName} ${matchedTeacher.lastName}`
    : currentUser?.name || 'School Educator';
  const [activeTab, setActiveTab] = useState<'assignments' | 'notes'>('assignments');
  const [assignmentToDelete, setAssignmentToDelete] = useState<Assignment | null>(null);
  const [expandedAssignmentId, setExpandedAssignmentId] = useState<string | null>(null);
  const [gradingDrafts, setGradingDrafts] = useState<Record<string, { grade: string; feedback: string }>>({});
  const [savingSubmissionId, setSavingSubmissionId] = useState<string | null>(null);
  const [gradeNotice, setGradeNotice] = useState<{ id: string; ok: boolean; text: string } | null>(null);

  // Assignment Form State
  const [asgTitle, setAsgTitle] = useState('');
  const [asgClassId, setAsgClassId] = useState(() => classes[0]?.id || '');
  const [asgSubjId, setAsgSubjId] = useState(() => subjects[0]?.id || '');
  const [asgDesc, setAsgDesc] = useState('');
  const [asgDueDate, setAsgDueDate] = useState('2026-08-30');
  const [asgFormat, setAsgFormat] = useState<'text' | 'word' | 'pdf'>('text');
  const [asgContent, setAsgContent] = useState('');
  const [asgAttachmentName, setAsgAttachmentName] = useState('');
  const [asgAttachmentUrl, setAsgAttachmentUrl] = useState('');
  const [asgFileSize, setAsgFileSize] = useState('');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Note Form State with Class Selection
  const [noteTitle, setNoteTitle] = useState('');
  const [noteClassId, setNoteClassId] = useState(() => classes[0]?.id || 'all');
  const [noteSubjId, setNoteSubjId] = useState(() => subjects[0]?.id || '');
  const [noteDesc, setNoteDesc] = useState('');
  const [noteAttachmentName, setNoteAttachmentName] = useState('');
  const [noteAttachmentUrl, setNoteAttachmentUrl] = useState('');
  const [noteFileSize, setNoteFileSize] = useState('');
  const [noteFilterClass, setNoteFilterClass] = useState('all');
  const [noteToDelete, setNoteToDelete] = useState<StudyNote | null>(null);

  useEffect(() => {
    setAsgClassId((prev) => resolveSyncedSelectionId(prev, classes));
    setNoteClassId((prev) => resolveSyncedSelectionId(prev, classes, { allowAll: true }));
  }, [classes]);

  useEffect(() => {
    setAsgSubjId((prev) => resolveSyncedSelectionId(prev, subjects));
    setNoteSubjId((prev) => resolveSyncedSelectionId(prev, subjects));
  }, [subjects]);

  // File Upload Handler for Lecture Notes
  const handleNoteFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileName = file.name;
    const fileBytes = file.size;
    const sizeInMB = (fileBytes / (1024 * 1024)).toFixed(2);

    setNoteAttachmentName(fileName);
    if (fileName.toLowerCase().endsWith('.pdf')) {
      setNoteFileSize(`${sizeInMB} MB PDF Document`);
    } else if (fileName.toLowerCase().endsWith('.doc') || fileName.toLowerCase().endsWith('.docx')) {
      setNoteFileSize(`${sizeInMB} MB Word Document`);
    } else {
      setNoteFileSize(`${sizeInMB} MB Document`);
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setNoteAttachmentUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  // File Upload Handler for Word/PDF/Text files
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileName = file.name;
    const fileBytes = file.size;
    const sizeInMB = (fileBytes / (1024 * 1024)).toFixed(2);

    setAsgAttachmentName(fileName);

    // Auto-detect format from extension
    if (fileName.toLowerCase().endsWith('.pdf')) {
      setAsgFormat('pdf');
      setAsgFileSize(`${sizeInMB} MB PDF Document`);
    } else if (fileName.toLowerCase().endsWith('.doc') || fileName.toLowerCase().endsWith('.docx')) {
      setAsgFormat('word');
      setAsgFileSize(`${sizeInMB} MB Word Document`);
    } else {
      setAsgFormat('text');
      setAsgFileSize(`${sizeInMB} MB Text File`);
    }

    // Read file as Data URL
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setAsgAttachmentUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!asgTitle.trim() || !asgDesc.trim()) {
      setFormError('Please fill in assignment title and summary instructions.');
      return;
    }

    const refCheck = validateAcademicEntityReferences({
      classId: asgClassId,
      subjectId: asgSubjId,
      classes,
      subjects,
      currentUserRole: currentUser?.role,
      resolvedTeacherId,
      actionLabel: 'post an assignment',
    });
    if (!refCheck.ok || !refCheck.matchedClass || !refCheck.matchedSubject) {
      setFormError(refCheck.error || 'Please select a valid Class and Subject.');
      return;
    }

    let defaultName = asgAttachmentName;
    if (!defaultName) {
      if (asgFormat === 'word') defaultName = `${asgTitle.replace(/\s+/g, '_')}_Assignment.docx`;
      if (asgFormat === 'pdf') defaultName = `${asgTitle.replace(/\s+/g, '_')}_Assignment.pdf`;
      if (asgFormat === 'text') defaultName = `${asgTitle.replace(/\s+/g, '_')}_TextPrompt.txt`;
    }

    const newAsg: Omit<Assignment, 'id'> = {
      title: asgTitle.trim(),
      subjectId: refCheck.matchedSubject.id,
      subjectName: refCheck.matchedSubject.name,
      classId: refCheck.matchedClass.id,
      className: refCheck.matchedClass.name,
      teacherId: resolvedTeacherId,
      teacherName: resolvedTeacherName,
      description: asgDesc.trim(),
      format: asgFormat,
      content: asgContent.trim() || undefined,
      attachmentName: defaultName,
      attachmentUrl: asgAttachmentUrl || '#',
      fileSize: asgFileSize || (asgFormat === 'pdf' ? '1.2 MB PDF' : asgFormat === 'word' ? '650 KB Word' : 'Text Assignment'),
      dueDate: asgDueDate,
      createdDate: new Date().toISOString().split('T')[0],
      totalMarks: 20,
    };

    const res = await addAssignment(newAsg);
    if (!res.ok) {
      setFormError(res.error || 'Unable to post assignment to Supabase.');
      return;
    }
    setAsgTitle('');
    setAsgDesc('');
    setAsgContent('');
    setAsgAttachmentName('');
    setAsgAttachmentUrl('');
    setAsgFileSize('');
    setSuccessMsg(`Assignment "${newAsg.title}" posted successfully to ${newAsg.className}!`);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  const handleCreateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!noteTitle.trim()) {
      setFormError('Please enter a lecture note title.');
      return;
    }

    const refCheck = validateAcademicEntityReferences({
      classId: noteClassId,
      subjectId: noteSubjId,
      classes,
      subjects,
      allowAllClass: true,
      currentUserRole: currentUser?.role,
      resolvedTeacherId,
      actionLabel: 'upload a study note',
    });
    if (!refCheck.ok || !refCheck.matchedSubject) {
      setFormError(refCheck.error || 'Please select a valid Subject before uploading.');
      return;
    }

    const targetClassName = refCheck.matchedClass ? refCheck.matchedClass.name : 'All Classes';

    const newNote: Omit<StudyNote, 'id'> = {
      title: noteTitle.trim(),
      subjectId: refCheck.matchedSubject.id,
      subjectName: refCheck.matchedSubject.name,
      classId: refCheck.matchedClass ? refCheck.matchedClass.id : undefined,
      className: targetClassName,
      teacherId: resolvedTeacherId,
      teacherName: resolvedTeacherName,
      description: noteDesc.trim(),
      fileUrl: noteAttachmentUrl || '#',
      fileSize: noteFileSize || (noteAttachmentName ? `${noteAttachmentName}` : '2.4 MB PDF Document'),
      uploadDate: new Date().toISOString().split('T')[0],
    };

    const res = await addStudyNote(newNote);
    if (!res.ok) {
      setFormError(res.error || 'Unable to publish lecture study note to Supabase.');
      return;
    }
    setNoteTitle('');
    setNoteDesc('');
    setNoteAttachmentName('');
    setNoteAttachmentUrl('');
    setNoteFileSize('');
    setSuccessMsg(`Lecture Note "${newNote.title}" uploaded successfully for ${targetClassName}!`);
    setTimeout(() => setSuccessMsg(null), 4000);
  };

  const handleSaveSubmissionGrade = async (submissionId: string, maxMarks: number) => {
    const draft = gradingDrafts[submissionId];
    const existing = assignmentSubmissions.find((s) => s.id === submissionId);
    const gradeRaw = draft ? draft.grade : existing?.grade !== undefined ? String(existing.grade) : '';
    const feedbackRaw = draft ? draft.feedback : existing?.feedback || '';

    const numericGrade = gradeRaw.trim() === '' ? undefined : Number(gradeRaw);
    if (numericGrade !== undefined && (Number.isNaN(numericGrade) || numericGrade < 0 || numericGrade > maxMarks)) {
      setGradeNotice({ id: submissionId, ok: false, text: `Enter a score between 0 and ${maxMarks}.` });
      return;
    }

    setSavingSubmissionId(submissionId);
    setGradeNotice(null);
    try {
      const res = await gradeAssignmentSubmission(submissionId, numericGrade, feedbackRaw.trim() || undefined);
      if (res.ok) {
        setGradeNotice({ id: submissionId, ok: true, text: 'Grade saved.' });
      } else {
        setGradeNotice({ id: submissionId, ok: false, text: res.error || 'Failed to save grade.' });
      }
    } finally {
      setSavingSubmissionId(null);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      
      {/* Header Controls */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-md flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="font-serif font-bold text-2xl text-slate-900 dark:text-white flex items-center gap-2">
            <Send className="w-6 h-6 text-amber-500" /> Send Homework & E-Notes
          </h2>
          <p className="text-xs text-slate-500">Post homework for students in Text, Word (.docx), or PDF (.pdf) format.</p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('assignments')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'assignments' ? 'bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950 shadow-md' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
            }`}
          >
            Manage Assignments ({assignments.length})
          </button>
          <button
            onClick={() => setActiveTab('notes')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'notes' ? 'bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950 shadow-md' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
            }`}
          >
            Manage Study Notes ({studyNotes.length})
          </button>
        </div>
      </div>

      {activeTab === 'assignments' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Create Assignment Form */}
          <form onSubmit={handleCreateAssignment} className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 space-y-5 shadow-xl">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                Teacher Assignment Dispatcher
              </span>
              <h3 className="font-serif font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2 mt-0.5">
                <Plus className="w-5 h-5 text-amber-500" /> Send New Assignment
              </h3>
            </div>

            {formError && (
              <div className="bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 p-3.5 rounded-2xl flex items-center gap-2 text-xs font-bold">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {successMsg && (
              <div className="bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-200 p-3.5 rounded-2xl border border-emerald-300 dark:border-emerald-800 flex items-center gap-2 text-xs font-bold animate-fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}
            
            <div className="space-y-4 text-xs">
              {/* Assignment Format Selector */}
              <div className="space-y-1.5">
                <label className="block font-bold text-slate-800 dark:text-slate-200">
                  Assignment Format *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setAsgFormat('text')}
                    className={`p-2.5 rounded-xl border text-center font-bold flex flex-col items-center gap-1 transition-all ${
                      asgFormat === 'text'
                        ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 ring-2 ring-amber-500/20'
                        : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <FileText className="w-4 h-4 text-amber-500" />
                    <span>Text Format</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAsgFormat('word')}
                    className={`p-2.5 rounded-xl border text-center font-bold flex flex-col items-center gap-1 transition-all ${
                      asgFormat === 'word'
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 ring-2 ring-blue-500/20'
                        : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <FileType className="w-4 h-4 text-blue-500" />
                    <span>Word Document</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAsgFormat('pdf')}
                    className={`p-2.5 rounded-xl border text-center font-bold flex flex-col items-center gap-1 transition-all ${
                      asgFormat === 'pdf'
                        ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 ring-2 ring-rose-500/20'
                        : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <FileCode className="w-4 h-4 text-rose-500" />
                    <span>PDF Document</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-bold mb-1">Assignment Title *</label>
                <input
                  type="text"
                  required
                  value={asgTitle}
                  onChange={(e) => setAsgTitle(e.target.value)}
                  placeholder="e.g. Simultaneous Equations Word Problems"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-semibold text-slate-900 dark:text-white outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold mb-1">Target Class *</label>
                  <select
                    required
                    value={asgClassId}
                    onChange={(e) => setAsgClassId(e.target.value)}
                    className="w-full px-2.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-semibold text-slate-900 dark:text-white outline-none focus:border-amber-500"
                  >
                    {classes.length === 0 ? (
                      <option value="">-- No classes available --</option>
                    ) : (
                      classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)
                    )}
                  </select>
                </div>

                <div>
                  <label className="block font-bold mb-1">Subject *</label>
                  <select
                    required
                    value={asgSubjId}
                    onChange={(e) => setAsgSubjId(e.target.value)}
                    className="w-full px-2.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-semibold text-slate-900 dark:text-white outline-none focus:border-amber-500"
                  >
                    {subjects.length === 0 ? (
                      <option value="">-- No subjects available --</option>
                    ) : (
                      subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)
                    )}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold mb-1">Due Date *</label>
                <input
                  type="date"
                  required
                  value={asgDueDate}
                  onChange={(e) => setAsgDueDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-semibold text-slate-900 dark:text-white outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block font-bold mb-1">Assignment Summary / Guidelines *</label>
                <textarea
                  required
                  rows={2}
                  value={asgDesc}
                  onChange={(e) => setAsgDesc(e.target.value)}
                  placeholder="Summary of what students are required to do..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white outline-none focus:border-amber-500 resize-none"
                />
              </div>

              {/* Conditional Format Specific Field */}
              {asgFormat === 'text' ? (
                <div>
                  <label className="block font-bold mb-1">Full Text Assignment / Questions *</label>
                  <textarea
                    rows={4}
                    value={asgContent}
                    onChange={(e) => setAsgContent(e.target.value)}
                    placeholder="Type or paste the complete assignment questions, essay prompts, or math problems here..."
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white outline-none focus:border-amber-500 resize-none font-mono text-xs"
                  />
                </div>
              ) : (
                <div className="space-y-2 p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <Paperclip className="w-3.5 h-3.5 text-amber-500" />
                      Upload {asgFormat === 'word' ? 'Word (.doc/.docx)' : 'PDF (.pdf)'} File
                    </label>
                  </div>

                  <input
                    type="file"
                    accept={asgFormat === 'word' ? '.doc,.docx' : '.pdf'}
                    onChange={handleFileUpload}
                    className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-amber-500 file:text-slate-950 hover:file:bg-amber-600 file:cursor-pointer"
                  />

                  {asgAttachmentName && (
                    <div className="bg-white dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between font-mono text-[11px]">
                      <span className="font-bold text-amber-600 dark:text-amber-400 truncate max-w-[180px]">{asgAttachmentName}</span>
                      <span className="text-slate-400">{asgFileSize}</span>
                    </div>
                  )}

                  <p className="text-[11px] text-slate-500">
                    If you don't have a file ready, a formatted download placeholder will automatically be generated for students.
                  </p>
                </div>
              )}

              <button
                type="submit"
                className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-black py-3 rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-md hover:shadow-lg cursor-pointer"
              >
                <Send className="w-4 h-4" /> Send Assignment to Students
              </button>
            </div>
          </form>

          {/* Assignments List */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
              <h3 className="font-serif font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-amber-500" /> Sent Assignments List
              </h3>
              <span className="text-xs font-bold bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full text-slate-600 dark:text-slate-300">
                {assignments.length} Homework Tasks Active
              </span>
            </div>

            {assignments.map((asg) => {
              const fmt = asg.format || 'text';
              const subs = assignmentSubmissions.filter((s) => s.assignmentId === asg.id);
              const isExpanded = expandedAssignmentId === asg.id;
              const maxMarks = asg.totalMarks || 20;

              return (
                <div key={asg.id} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 space-y-3 shadow-sm hover:shadow-md transition-all">
                  <div className="flex flex-wrap justify-between items-start gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 px-2.5 py-0.5 rounded-md">
                          {asg.subjectName} • {asg.className}
                        </span>

                        {/* Format Badge */}
                        {fmt === 'word' ? (
                          <span className="text-[10px] font-bold bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 px-2 py-0.5 rounded-md flex items-center gap-1">
                            <FileType className="w-3 h-3 text-blue-500" /> Word Document
                          </span>
                        ) : fmt === 'pdf' ? (
                          <span className="text-[10px] font-bold bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 px-2 py-0.5 rounded-md flex items-center gap-1">
                            <FileCode className="w-3 h-3 text-rose-500" /> PDF Document
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded-md flex items-center gap-1">
                            <FileText className="w-3 h-3 text-amber-500" /> Text Assignment
                          </span>
                        )}
                      </div>

                      <h4 className="font-bold text-base text-slate-900 dark:text-white mt-1">{asg.title}</h4>
                    </div>

                    <div className="text-right">
                      <span className="text-xs text-rose-500 font-bold bg-rose-50 dark:bg-rose-950/40 px-2.5 py-1 rounded-lg border border-rose-200 dark:border-rose-900">
                        Due: {asg.dueDate}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/40 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800">
                    {asg.description}
                  </p>

                  {/* Text Content Preview */}
                  {asg.content && (
                    <div className="bg-slate-900 text-slate-200 p-3.5 rounded-2xl font-mono text-[11px] whitespace-pre-wrap border border-slate-800">
                      <p className="text-[10px] text-amber-400 font-sans font-bold uppercase mb-1">Full Text Instructions:</p>
                      {asg.content}
                    </div>
                  )}

                  {/* Document Download Bar for Word/PDF */}
                  {(asg.attachmentName || fmt !== 'text') && (
                    <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded-2xl flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 font-mono">
                        {fmt === 'word' ? <FileType className="w-4 h-4 text-blue-500" /> : <FileCode className="w-4 h-4 text-rose-500" />}
                        <span className="font-bold text-slate-900 dark:text-white truncate max-w-[200px]">
                          {asg.attachmentName || `${asg.title}.${fmt === 'word' ? 'docx' : 'pdf'}`}
                        </span>
                        <span className="text-[10px] text-slate-500">({asg.fileSize || 'Attached File'})</span>
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
                        className="bg-slate-900 hover:bg-slate-800 dark:bg-amber-500 text-white dark:text-slate-950 font-bold px-3 py-1.5 rounded-xl text-[11px] flex items-center gap-1"
                      >
                        <Download className="w-3.5 h-3.5" /> Download File
                      </a>
                    </div>
                  )}

                  <div className="pt-2 flex flex-wrap justify-between items-center gap-2 text-xs border-t border-slate-100 dark:border-slate-800">
                    <span className="text-[11px] text-slate-500">Posted by {asg.teacherName} on {asg.createdDate}</span>

                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setExpandedAssignmentId(isExpanded ? null : asg.id)}
                        className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold px-3 py-1.5 rounded-xl text-[11px] flex items-center gap-1.5 transition-colors"
                      >
                        <Users className="w-3.5 h-3.5 text-amber-500" />
                        {isExpanded ? 'Hide' : 'View'} Submissions ({subs.length})
                      </button>

                      {deleteAssignment && (
                        <button
                          onClick={() => setAssignmentToDelete(asg)}
                          className="text-rose-500 hover:text-rose-700 font-bold flex items-center gap-1 text-[11px]"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Remove Assignment
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Student Submissions & Grading Panel */}
                  {isExpanded && (
                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
                      {subs.length === 0 ? (
                        <p className="text-xs text-slate-500 italic bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl">
                          No student submissions received yet for this assignment.
                        </p>
                      ) : (
                        subs.map((sub) => {
                          const draft = gradingDrafts[sub.id] ?? {
                            grade: sub.grade !== undefined && sub.grade !== null ? String(sub.grade) : '',
                            feedback: sub.feedback || '',
                          };
                          const isSaving = savingSubmissionId === sub.id;

                          return (
                            <div
                              key={sub.id}
                              className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-2.5 text-xs"
                            >
                              <div className="flex flex-wrap justify-between items-center gap-2">
                                <div>
                                  <span className="font-bold text-slate-900 dark:text-white">{sub.studentName}</span>
                                  <span className="text-[11px] text-slate-500 ml-2">Submitted {sub.submissionDate}</span>
                                </div>
                                {sub.grade !== undefined && sub.grade !== null && (
                                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold text-[11px] flex items-center gap-1">
                                    <Award className="w-3 h-3" /> {sub.grade} / {maxMarks}
                                  </span>
                                )}
                              </div>

                              <p className="text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 whitespace-pre-wrap">
                                {sub.content}
                              </p>

                              {sub.fileUrl && (
                                <a
                                  href={sub.fileUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:underline"
                                >
                                  <ExternalLink className="w-3 h-3" /> Open Attached File
                                </a>
                              )}

                              <div className="flex flex-wrap items-center gap-2 pt-1">
                                <input
                                  type="number"
                                  min={0}
                                  max={maxMarks}
                                  placeholder={`Score / ${maxMarks}`}
                                  value={draft.grade}
                                  onChange={(e) =>
                                    setGradingDrafts((prev) => ({
                                      ...prev,
                                      [sub.id]: { ...draft, grade: e.target.value },
                                    }))
                                  }
                                  className="w-24 px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-900 dark:text-white"
                                />
                                <input
                                  type="text"
                                  placeholder="Feedback / remarks for student..."
                                  value={draft.feedback}
                                  onChange={(e) =>
                                    setGradingDrafts((prev) => ({
                                      ...prev,
                                      [sub.id]: { ...draft, feedback: e.target.value },
                                    }))
                                  }
                                  className="flex-1 min-w-[180px] px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white"
                                />
                                <button
                                  type="button"
                                  disabled={isSaving}
                                  onClick={() => void handleSaveSubmissionGrade(sub.id, maxMarks)}
                                  className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-bold rounded-lg text-[11px]"
                                >
                                  {isSaving ? 'Saving...' : 'Save Grade'}
                                </button>
                              </div>

                              {gradeNotice && gradeNotice.id === sub.id && (
                                <p className={`text-[11px] font-bold ${gradeNotice.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
                                  {gradeNotice.text}
                                </p>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Note Upload Form */}
          <form onSubmit={handleCreateNote} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-md">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-serif font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                <Upload className="w-5 h-5 text-amber-500" /> Upload New Lecture Note
              </h3>
            </div>
            
            {formError && (
              <div className="bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 p-3 rounded-2xl flex items-center gap-2 text-xs font-bold">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                  Note Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  placeholder="e.g. Calculus & Vectors Chapter 4, Waves & Optics"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                />
              </div>

              {/* Select Class */}
              <div>
                <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                  Select Class <span className="text-rose-500">*</span>
                </label>
                <select
                  value={noteClassId}
                  onChange={(e) => setNoteClassId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-medium text-slate-900 dark:text-white"
                >
                  <option value="all">All Classes (General School Study Material)</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400 mt-1">Students enrolled in this class will access this note in their student portal.</p>
              </div>

              <div>
                <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                  Subject <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={noteSubjId}
                  onChange={(e) => setNoteSubjId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-medium text-slate-900 dark:text-white"
                >
                  {subjects.length === 0 ? (
                    <option value="">-- No subjects available --</option>
                  ) : (
                    subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)
                  )}
                </select>
              </div>

              {/* Document / PDF Attachment Upload */}
              <div>
                <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                  Attach PDF or Document File
                </label>
                <div className="relative">
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.txt"
                    onChange={handleNoteFileUpload}
                    className="w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-slate-900 file:text-white dark:file:bg-amber-500 dark:file:text-slate-950 hover:file:opacity-90 cursor-pointer border border-slate-300 dark:border-slate-700 rounded-xl p-1 bg-slate-50 dark:bg-slate-800"
                  />
                </div>
                {noteAttachmentName && (
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Attached: {noteAttachmentName} ({noteFileSize})
                  </p>
                )}
              </div>

              <div>
                <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                  Summary & Key Takeaways <span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={noteDesc}
                  onChange={(e) => setNoteDesc(e.target.value)}
                  placeholder="Outline key learning objectives, required formulas, or revision summaries covered in this lecture note..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                />
              </div>

              <button
                type="submit"
                className="w-full bg-slate-900 hover:bg-slate-800 dark:bg-amber-500 dark:hover:bg-amber-600 text-white dark:text-slate-950 font-bold py-3 rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-md hover:shadow-lg"
              >
                <Upload className="w-4 h-4" /> Publish Lecture Study Note
              </button>
            </div>
          </form>

          {/* Notes List */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm">
              <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                Published Lecture Notes ({studyNotes.length})
              </h4>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-500 text-[11px] font-medium">Filter by Class:</span>
                <select
                  value={noteFilterClass}
                  onChange={(e) => setNoteFilterClass(e.target.value)}
                  className="px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-900 dark:text-white"
                >
                  <option value="all">All Classes</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {studyNotes
              .filter((n) => {
                if (noteFilterClass === 'all') return true;
                return !n.classId || n.classId === 'all' || n.classId === noteFilterClass;
              })
              .map((note) => (
                <div key={note.id} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 space-y-3 shadow-sm hover:border-amber-500/40 transition-all">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 px-2.5 py-0.5 rounded">
                        {note.subjectName}
                      </span>
                      <span className="text-[10px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 px-2.5 py-0.5 rounded">
                        Class: {note.className || 'All Classes'}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400">
                      Uploaded on {note.uploadDate}
                    </span>
                  </div>

                  <div>
                    <h4 className="font-bold text-base text-slate-900 dark:text-white">{note.title}</h4>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{note.description}</p>
                  </div>

                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                    <span className="text-[11px] text-slate-500 font-mono">
                      {note.fileSize || 'PDF Document'}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => alert(`Opening / downloading ${note.title} (${note.className})`)}
                        className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold px-3 py-1.5 rounded-xl text-[11px] flex items-center gap-1.5 transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" /> Download
                      </button>
                      <button
                        onClick={() => setNoteToDelete(note)}
                        className="text-rose-500 hover:text-rose-700 font-bold p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                        title="Remove Lecture Note"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}

            {studyNotes.filter((n) => noteFilterClass === 'all' || !n.classId || n.classId === 'all' || n.classId === noteFilterClass).length === 0 && (
              <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 text-xs text-slate-500">
                No lecture notes found for the selected class filter. Use the form on the left to upload one.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Confirmation Modal for Assignment Deletion */}
      <ConfirmDeleteModal
        isOpen={!!assignmentToDelete}
        onClose={() => setAssignmentToDelete(null)}
        onConfirm={() => {
          if (assignmentToDelete) {
            deleteAssignment(assignmentToDelete.id);
            setAssignmentToDelete(null);
          }
        }}
        title="Confirm Assignment Removal"
        message="Are you sure you want to delete this homework assignment from the portal?"
        itemName={assignmentToDelete ? assignmentToDelete.title : undefined}
      />

      {/* Confirmation Modal for Lecture Note Deletion */}
      <ConfirmDeleteModal
        isOpen={!!noteToDelete}
        onClose={() => setNoteToDelete(null)}
        onConfirm={() => {
          if (noteToDelete) {
            deleteStudyNote(noteToDelete.id);
            setNoteToDelete(null);
          }
        }}
        title="Confirm Lecture Note Removal"
        message="Are you sure you want to delete this lecture note from the portal?"
        itemName={noteToDelete ? `${noteToDelete.title} (${noteToDelete.className})` : undefined}
      />
    </div>
  );
};
