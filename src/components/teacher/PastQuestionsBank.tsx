import React, { useState } from 'react';
import { useSchool } from '../../context/SchoolContext';
import { CBTExam, CBTQuestion } from '../../types';
import { ConfirmDeleteModal } from '../common/ConfirmDeleteModal';
import {
  TEACHER_OPTION_A_INSTRUCTION,
  createBlankOptionAQuestion,
  isLegacyNonOptionAQuestion,
  convertLegacyQuestionToOptionA,
  validateExamQuestionsForSave,
} from '../../lib/cbtShuffling';
import {
  BookOpen,
  Search,
  Filter,
  Calendar,
  FileText,
  Printer,
  Copy,
  Plus,
  Trash2,
  Edit3,
  Eye,
  X,
  Layers,
  Clock,
  CheckCircle2,
  FolderOpen,
  Sparkles,
  ArrowRight,
  Shuffle,
  ArrowUpDown,
} from 'lucide-react';

export const PastQuestionsBank: React.FC = () => {
  const { cbtExams, classes, subjects, teachers, currentUser, createCBTExam, updateCBTExam, deleteCBTExam, academicSessions } = useSchool();
  const matchedTeacher =
    currentUser?.role === 'teacher'
      ? teachers.find(
          (t) =>
            t.id === currentUser.id ||
            (currentUser.referenceId && t.staffId === currentUser.referenceId)
        )
      : undefined;

  // Filters State
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [selectedTerm, setSelectedTerm] = useState<string>('all');
  const [selectedSession, setSelectedSession] = useState<string>('all');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals state
  const [viewingExam, setViewingExam] = useState<CBTExam | null>(null);
  const [printingExam, setPrintingExam] = useState<CBTExam | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingExamId, setEditingExamId] = useState<string | null>(null);
  const [editingExamTeacherId, setEditingExamTeacherId] = useState<string | undefined>(undefined);
  const [examToDelete, setExamToDelete] = useState<CBTExam | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // New Past Exam Form State
  const [formTitle, setFormTitle] = useState('');
  const [formClassId, setFormClassId] = useState('c-ss2');
  const [formSubjectId, setFormSubjectId] = useState('sub-mth');
  const [formTerm, setFormTerm] = useState('3rd Term');
  const [formSession, setFormSession] = useState('2025/2026');
  const [formDurationMinutes, setFormDurationMinutes] = useState(20);
  const [formQuestions, setFormQuestions] = useState<CBTQuestion[]>([
    createBlankOptionAQuestion(`pq-${Date.now()}-1`),
  ]);

  const termsList = ['1st Term', '2nd Term', '3rd Term'];
  const sessionsList = academicSessions || ['2026/2027', '2025/2026', '2024/2025', '2023/2024'];

  // Filter Logic
  const filteredExams = cbtExams.filter((exam) => {
    if (selectedClass !== 'all' && exam.classId !== selectedClass) return false;
    if (selectedTerm !== 'all' && exam.term !== selectedTerm) return false;
    if (selectedSession !== 'all' && exam.session !== selectedSession) return false;
    if (selectedSubject !== 'all' && exam.subjectId !== selectedSubject) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = exam.title.toLowerCase().includes(q);
      const matchSubject = exam.subjectName.toLowerCase().includes(q);
      const matchQuestion = exam.questions?.some((item) =>
        item.question.toLowerCase().includes(q)
      );
      return matchTitle || matchSubject || matchQuestion;
    }

    return true;
  });

  const handleOpenAddModal = () => {
    setSaveError(null);
    setEditingExamId(null);
    setEditingExamTeacherId(undefined);
    setFormTitle('');
    setFormClassId(classes[0]?.id || 'c-ss2');
    setFormSubjectId(subjects[0]?.id || 'sub-mth');
    setFormTerm('3rd Term');
    setFormSession('2025/2026');
    setFormDurationMinutes(20);
    setFormQuestions([createBlankOptionAQuestion(`pq-${Date.now()}-1`)]);
    setIsAddModalOpen(true);
  };

  const handleOpenEditModal = (exam: CBTExam) => {
    setSaveError(null);
    setEditingExamId(exam.id);
    setEditingExamTeacherId(exam.teacherId);
    setFormTitle(exam.title);
    setFormClassId(exam.classId);
    setFormSubjectId(exam.subjectId);
    setFormTerm(exam.term || '3rd Term');
    setFormSession(exam.session || '2025/2026');
    setFormDurationMinutes(exam.durationMinutes);
    setFormQuestions(exam.questions ? JSON.parse(JSON.stringify(exam.questions)) : []);
    setIsAddModalOpen(true);
  };

  const handleAddQuestionRow = () => {
    setFormQuestions((prev) => [
      ...prev,
      createBlankOptionAQuestion(`pq-${Date.now()}-${prev.length + 1}`),
    ]);
  };

  const handleUpdateQuestionRow = (idx: number, updated: Partial<CBTQuestion>) => {
    setFormQuestions((prev) => {
      const copy = [...prev];
      copy[idx] = {
        ...copy[idx],
        ...updated,
        correctOption: updated.correctOption ?? copy[idx].correctOption ?? 'A',
      };
      return copy;
    });
  };

  const handleConvertLegacyRow = (idx: number) => {
    setFormQuestions((prev) => {
      const copy = [...prev];
      copy[idx] = convertLegacyQuestionToOptionA(copy[idx]);
      return copy;
    });
  };

  const handleRemoveQuestionRow = (idx: number) => {
    setFormQuestions((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSavePastPaper = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    if (!formTitle.trim()) {
      setSaveError('Please enter paper title.');
      return;
    }

    const validationError = validateExamQuestionsForSave(formQuestions);
    if (validationError) {
      setSaveError(validationError);
      return;
    }

    const selectedSubj = subjects.find((s) => s.id === formSubjectId);
    const selectedCls = classes.find((c) => c.id === formClassId);

    // Prevent saving a duplicate past question paper with the same Subject, Class, Term, and Session
    const isDuplicateArchive = cbtExams.some(e => 
      e.id !== editingExamId &&
      e.subjectId === formSubjectId &&
      e.classId === formClassId &&
      e.term === formTerm &&
      e.session === formSession &&
      !e.title.toLowerCase().includes('cloned')
    );

    if (isDuplicateArchive) {
      setSaveError(`Error: A past question paper already exists in the archive for ${selectedSubj?.name || 'this Subject'} (${selectedCls?.name || 'this Class'}), ${formTerm} - ${formSession}.`);
      return;
    }

    const normalizedQuestions = formQuestions.map((q) => ({
      ...q,
      correctOption: q.correctOption && ['A', 'B', 'C', 'D'].includes(q.correctOption)
        ? q.correctOption
        : ('A' as const),
      marks: Number(q.marks) > 0 ? Number(q.marks) : 1,
    }));

    const payload: Omit<CBTExam, 'id'> = {
      title: formTitle.trim(),
      subjectId: formSubjectId,
      subjectName: selectedSubj?.name || 'General',
      classId: formClassId,
      className: selectedCls?.name || 'SS 2',
      teacherId: editingExamId ? editingExamTeacherId ?? matchedTeacher?.id : matchedTeacher?.id,
      term: formTerm,
      session: formSession,
      durationMinutes: Number(formDurationMinutes),
      totalQuestions: normalizedQuestions.length,
      totalMarks: normalizedQuestions.reduce((acc, q) => acc + (q.marks || 1), 0),
      passPercentage: 50,
      startDate: new Date().toISOString().split('T')[0],
      startTime: '08:00',
      endDate: '2026-12-31',
      isPublished: true,
      shuffleQuestions: true,
      questions: normalizedQuestions,
    };

    setIsSaving(true);
    try {
      const result = editingExamId
        ? await updateCBTExam(editingExamId, payload)
        : await createCBTExam(payload);

      if (!result.ok) {
        setSaveError(result.error || 'Unable to save past question paper.');
        return;
      }

      alert(
        editingExamId
          ? 'Past Question Paper successfully updated!'
          : 'New Past Question Paper successfully created and added to archive!'
      );
      setIsAddModalOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDuplicateToActiveCBT = async (exam: CBTExam) => {
    const clonedTitle = `${exam.subjectName} CBT Test (Cloned from ${exam.session || 'Past Paper'})`;
    
    // Check if this exam has already been cloned to the active term and session (3rd Term, 2025/2026)
    // or if a cloned exam with the same title already exists in the CBT database.
    const isAlreadyCloned = cbtExams.some(e => {
      if (e.title.toLowerCase() === clonedTitle.toLowerCase()) {
        return true;
      }
      const isSameSubjectClass = e.subjectId === exam.subjectId && e.classId === exam.classId;
      const isTargetTermSession = e.term === '3rd Term' && e.session === '2025/2026';
      const isClonedExam = e.title.toLowerCase().includes('cloned');
      return isSameSubjectClass && isTargetTermSession && isClonedExam;
    });

    if (isAlreadyCloned) {
      alert(`Error: A CBT exam for ${exam.subjectName} (${exam.className}) has already been cloned or deployed for the 3rd Term, 2025/2026. Double cloning of this paper is disallowed.`);
      return;
    }

    const payload: Omit<CBTExam, 'id'> = {
      title: clonedTitle,
      subjectId: exam.subjectId,
      subjectName: exam.subjectName,
      classId: exam.classId,
      className: exam.className,
      teacherId: matchedTeacher?.id ?? exam.teacherId,
      term: '3rd Term',
      session: '2025/2026',
      durationMinutes: exam.durationMinutes,
      totalQuestions: exam.questions.length,
      totalMarks: exam.questions.reduce((acc, q) => acc + (q.marks || 1), 0),
      passPercentage: 50,
      startDate: new Date().toISOString().split('T')[0],
      startTime: '08:00',
      endDate: '2026-08-30',
      isPublished: true,
      shuffleQuestions: true,
      questions: JSON.parse(JSON.stringify(exam.questions)),
    };

    const result = await createCBTExam(payload);
    if (!result.ok) {
      alert(result.error || 'Unable to deploy cloned CBT exam.');
      return;
    }
    alert(`Successfully deployed "${clonedTitle}" as an active CBT exam for students!`);
  };

  const handleTriggerPrint = () => {
    window.print();
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      
      {/* Top Header Card */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase font-bold tracking-widest bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 px-3 py-1 rounded-full border border-amber-300/30 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Subject Question Archive
            </span>
          </div>
          <h2 className="font-serif font-bold text-2xl sm:text-3xl text-slate-900 dark:text-white">
            Teachers' Past Questions Space
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 max-w-2xl">
            Browse, search, and filter historical exam question banks across academic terms, sessions, and subject classes. Print revision test papers or duplicate past papers into active CBT tests.
          </p>
        </div>

        <button
          onClick={handleOpenAddModal}
          className="bg-slate-900 dark:bg-amber-500 hover:bg-slate-800 dark:hover:bg-amber-600 text-white dark:text-slate-950 font-bold px-5 py-3 rounded-2xl text-xs flex items-center gap-2 shadow-lg transition-all flex-shrink-0"
        >
          <Plus className="w-4 h-4" /> Add Past Exam Paper
        </button>
      </div>

      {/* FILTERS BAR: Class, Term, Session, Subject & Search */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300">
            <Filter className="w-4 h-4 text-amber-500" />
            <span>Filter Question Papers</span>
          </div>
          {(selectedClass !== 'all' || selectedTerm !== 'all' || selectedSession !== 'all' || selectedSubject !== 'all' || searchQuery !== '') && (
            <button
              onClick={() => {
                setSelectedClass('all');
                setSelectedTerm('all');
                setSelectedSession('all');
                setSelectedSubject('all');
                setSearchQuery('');
              }}
              className="text-xs font-semibold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1"
            >
              Reset Filters
            </button>
          )}
        </div>

        {/* Filter Controls Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
          {/* Class Filter */}
          <div>
            <label className="block font-semibold text-slate-500 dark:text-slate-400 mb-1">
              Class
            </label>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-slate-900 dark:text-white"
            >
              <option value="all">All Classes</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Term Filter */}
          <div>
            <label className="block font-semibold text-slate-500 dark:text-slate-400 mb-1">
              Academic Term
            </label>
            <select
              value={selectedTerm}
              onChange={(e) => setSelectedTerm(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-slate-900 dark:text-white"
            >
              <option value="all">All Terms</option>
              {termsList.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {/* Session Filter */}
          <div>
            <label className="block font-semibold text-slate-500 dark:text-slate-400 mb-1">
              Academic Session
            </label>
            <select
              value={selectedSession}
              onChange={(e) => setSelectedSession(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-slate-900 dark:text-white"
            >
              <option value="all">All Sessions</option>
              {sessionsList.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Subject Filter */}
          <div>
            <label className="block font-semibold text-slate-500 dark:text-slate-400 mb-1">
              Subject
            </label>
            <select
              value={selectedSubject}
              onChange={(e) => setSelectedSubject(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-slate-900 dark:text-white"
            >
              <option value="all">All Subjects</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Search Query */}
          <div>
            <label className="block font-semibold text-slate-500 dark:text-slate-400 mb-1">
              Search Keywords
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search topic or question..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-slate-900 dark:text-white"
              />
            </div>
          </div>
        </div>

        {/* Results indicator */}
        <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100 dark:border-slate-800">
          <span>
            Showing <strong>{filteredExams.length}</strong> past question paper(s)
          </span>
          <span className="text-[11px] italic">
            Filter selection: {selectedClass === 'all' ? 'All Classes' : classes.find(c => c.id === selectedClass)?.name} • {selectedTerm === 'all' ? 'All Terms' : selectedTerm} • {selectedSession === 'all' ? 'All Sessions' : selectedSession}
          </span>
        </div>
      </div>

      {/* PAST QUESTION PAPERS GRID */}
      {filteredExams.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-300 dark:border-slate-800 p-12 text-center space-y-3">
          <FolderOpen className="w-12 h-12 text-slate-400 mx-auto" />
          <h3 className="font-serif font-bold text-lg text-slate-800 dark:text-slate-200">
            No Past Question Papers Found
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            No past exam papers match your current Class, Term, Session, or Subject filters. Try adjusting your filter settings or click below to add a paper.
          </p>
          <button
            onClick={handleOpenAddModal}
            className="mt-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs inline-flex items-center gap-1.5 shadow"
          >
            <Plus className="w-4 h-4" /> Upload / Create Past Paper
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredExams.map((exam) => (
            <div
              key={exam.id}
              className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 space-y-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
            >
              <div className="space-y-4">
                {/* Badges Row */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[10px] font-bold uppercase bg-amber-100 dark:bg-amber-950/90 text-amber-800 dark:text-amber-300 px-2.5 py-0.5 rounded-full border border-amber-300/30">
                    {exam.className}
                  </span>
                  <span className="text-[10px] font-bold uppercase bg-purple-100 dark:bg-purple-950/90 text-purple-800 dark:text-purple-300 px-2.5 py-0.5 rounded-full border border-purple-300/30">
                    {exam.term || '3rd Term'}
                  </span>
                  <span className="text-[10px] font-bold uppercase bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2.5 py-0.5 rounded-full border border-slate-300/30">
                    Session: {exam.session || '2025/2026'}
                  </span>
                </div>

                {/* Subject & Title */}
                <div>
                  <p className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                    {exam.subjectName}
                  </p>
                  <h3 className="font-serif font-bold text-lg text-slate-900 dark:text-white mt-0.5">
                    {exam.title}
                  </h3>
                </div>

                {/* Exam Details Specs */}
                <div className="grid grid-cols-3 gap-2 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-2xl border border-slate-100 dark:border-slate-800 text-center text-xs">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400">Questions</span>
                    <p className="font-bold text-slate-900 dark:text-white">{exam.totalQuestions} Items</p>
                  </div>
                  <div className="border-x border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Total Marks</span>
                    <p className="font-bold text-amber-500">{exam.totalMarks} Marks</p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400">Time</span>
                    <p className="font-bold text-slate-900 dark:text-white">{exam.durationMinutes} Mins</p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setViewingExam(exam)}
                    className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all"
                  >
                    <Eye className="w-3.5 h-3.5" /> View Questions
                  </button>
                  <button
                    onClick={() => setPrintingExam(exam)}
                    className="bg-slate-800 hover:bg-slate-900 text-white font-bold py-2 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all"
                  >
                    <Printer className="w-3.5 h-3.5" /> Print Paper
                  </button>
                </div>

                <div className="space-y-2 pt-1">
                  <button
                    onClick={() => handleDuplicateToActiveCBT(exam)}
                    className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all"
                  >
                    <Copy className="w-3.5 h-3.5" /> Reuse as CBT Exam
                  </button>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleOpenEditModal(exam)}
                      className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold py-2 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all"
                    >
                      <Edit3 className="w-3.5 h-3.5" /> Edit Paper
                    </button>
                    <button
                      onClick={() => setExamToDelete(exam)}
                      className="bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 font-bold py-2 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all border border-red-100 dark:border-red-900/30"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Delete Paper
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* VIEW QUESTIONS & ANSWERS KEY MODAL */}
      {viewingExam && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-4xl p-6 sm:p-8 space-y-6 shadow-2xl relative my-8">
            <div className="flex justify-between items-start border-b border-slate-200 dark:border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 px-2.5 py-1 rounded-md">
                    {viewingExam.subjectName} • {viewingExam.className}
                  </span>
                  <span className="text-xs text-slate-500 font-semibold">
                    {viewingExam.term || '3rd Term'} ({viewingExam.session || '2025/2026'})
                  </span>
                </div>
                <h3 className="font-serif font-bold text-2xl text-slate-900 dark:text-white mt-1">
                  {viewingExam.title}
                </h3>
              </div>
              <button
                onClick={() => setViewingExam(null)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Question Items List */}
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
              {viewingExam.questions.map((q, idx) => (
                <div key={q.id || idx} className="p-5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3 text-xs">
                  <div className="flex justify-between items-start gap-2">
                    <p className="font-bold text-slate-900 dark:text-white text-sm">
                      Question #{idx + 1}. {q.question}
                    </p>
                    <span className="font-bold text-amber-500 bg-amber-100 dark:bg-amber-950/80 px-2 py-0.5 rounded text-[10px]">
                      {q.marks || 1} Mark
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {(['A', 'B', 'C', 'D'] as const).map((optKey) => {
                      const isCorrect = q.correctOption === optKey;
                      return (
                        <div
                          key={optKey}
                          className={`p-3 rounded-xl border flex items-center justify-between font-medium ${
                            isCorrect
                              ? 'bg-emerald-100/70 dark:bg-emerald-950/60 border-emerald-400 text-emerald-900 dark:text-emerald-300 font-bold'
                              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          <span>
                            <strong>{optKey}.</strong> {q.options[optKey]}
                          </span>
                          {isCorrect && (
                            <span className="text-[10px] font-bold uppercase bg-emerald-600 text-white px-2 py-0.5 rounded">
                              Correct Key
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {q.explanation && (
                    <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[11px] text-amber-800 dark:text-amber-300">
                      <strong>Solution / Explanation:</strong> {q.explanation}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center">
              <button
                onClick={() => {
                  setViewingExam(null);
                  setPrintingExam(viewingExam);
                }}
                className="bg-slate-800 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-2"
              >
                <Printer className="w-4 h-4" /> Print Clean Examination Paper
              </button>
              <button
                onClick={() => setViewingExam(null)}
                className="px-6 py-2 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold rounded-xl text-xs"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PRINTABLE HARDCOPY EXAMINATION PAPER MODAL */}
      {printingExam && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
          <div className="bg-white text-slate-900 rounded-3xl w-full max-w-4xl p-8 sm:p-12 space-y-8 shadow-2xl relative my-8 print:p-0 print:shadow-none print:max-w-none print:w-full">
            {/* Screen Close & Action Controls */}
            <div className="flex justify-between items-center border-b pb-4 print:hidden">
              <span className="text-xs font-bold text-slate-500">
                Print Preview Mode — Formatted for School Test Hardcopy
              </span>
              <div className="flex gap-2">
                <button
                  onClick={handleTriggerPrint}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow"
                >
                  <Printer className="w-4 h-4" /> Print / Save PDF
                </button>
                <button
                  onClick={() => setPrintingExam(null)}
                  className="p-2 text-slate-400 hover:text-slate-700 rounded-xl"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Printable Exam Paper Header */}
            <div className="text-center space-y-2 border-b-2 border-slate-900 pb-6">
              <h2 className="font-serif font-black text-2xl uppercase tracking-wider text-slate-900">
                DIVINE GRACE HIGH SCHOOL, LAGOS
              </h2>
              <p className="text-xs uppercase font-bold text-slate-600 tracking-widest">
                {printingExam.session || '2025/2026'} ACADEMIC SESSION • {printingExam.term || '3rd Term'} EXAMINATION
              </p>
              <h3 className="font-serif font-bold text-xl text-slate-900 pt-2">
                SUBJECT: {printingExam.subjectName.toUpperCase()} ({printingExam.className.toUpperCase()})
              </h3>
              <div className="flex justify-between text-xs font-bold pt-4 border-t border-slate-300">
                <span>TIME ALLOWED: {printingExam.durationMinutes} MINUTES</span>
                <span>TOTAL MARKS: {printingExam.totalMarks} MARKS</span>
                <span>NAME: ____________________________</span>
              </div>
            </div>

            {/* Instructions */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs text-slate-700 font-medium">
              <strong>INSTRUCTIONS TO CANDIDATES:</strong> Answer all questions. Choose the correct option (A, B, C, or D) for each item. Write your answers clearly on your answer sheet.
            </div>

            {/* Questions List */}
            <div className="space-y-6 text-xs text-slate-900">
              {printingExam.questions.map((q, idx) => (
                <div key={q.id || idx} className="space-y-2">
                  <p className="font-bold text-sm">
                    {idx + 1}. {q.question}
                  </p>
                  <div className="grid grid-cols-2 gap-x-8 gap-y-1 pl-4 font-medium">
                    <span>(A) {q.options.A}</span>
                    <span>(B) {q.options.B}</span>
                    <span>(C) {q.options.C}</span>
                    <span>(D) {q.options.D}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Print Footer */}
            <div className="border-t pt-4 text-center text-[11px] text-slate-500 font-serif italic">
              *** END OF EXAMINATION PAPER — GOOD LUCK ***
            </div>
          </div>
        </div>
      )}

      {/* CREATE / EDIT PAST EXAM PAPER MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
          <form
            onSubmit={handleSavePastPaper}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-4xl p-6 sm:p-8 space-y-6 shadow-2xl relative my-8"
          >
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-4">
              <div>
                <h3 className="font-serif font-bold text-xl text-slate-900 dark:text-white">
                  {editingExamId ? 'Edit Past Question Paper' : 'Upload / Add Past Examination Paper'}
                </h3>
                <p className="text-xs text-slate-500">
                  Tag the question set with Class, Term, and Academic Session for archive retrieval.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-2 text-slate-400 hover:text-white rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="sm:col-span-3">
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Past Examination Paper Title *
                </label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. 2024/2025 SS 2 2nd Term Chemistry Past Examination"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-medium"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Target Class *
                </label>
                <select
                  value={formClassId}
                  onChange={(e) => setFormClassId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
                >
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Subject *
                </label>
                <select
                  value={formSubjectId}
                  onChange={(e) => setFormSubjectId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
                >
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Academic Term *
                </label>
                <select
                  value={formTerm}
                  onChange={(e) => setFormTerm(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-medium"
                >
                  {termsList.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Academic Session *
                </label>
                <select
                  value={formSession}
                  onChange={(e) => setFormSession(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-medium"
                >
                  {sessionsList.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Suggested Duration (Mins)
                </label>
                <input
                  type="number"
                  value={formDurationMinutes}
                  onChange={(e) => setFormDurationMinutes(parseInt(e.target.value) || 20)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
                />
              </div>
            </div>

            {/* Questions Editor */}
            <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800 max-h-[45vh] overflow-y-auto pr-2">
              {saveError && (
                <div className="bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 p-3 rounded-xl text-xs font-bold">
                  {saveError}
                </div>
              )}

              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-3 flex items-start gap-2.5 text-xs text-emerald-900 dark:text-emerald-200">
                <Shuffle className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                <p className="font-medium leading-relaxed">{TEACHER_OPTION_A_INSTRUCTION}</p>
              </div>

              <div className="flex justify-between items-center">
                <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                  Paper Question Items ({formQuestions.length})
                </h4>
                <button
                  type="button"
                  onClick={handleAddQuestionRow}
                  className="bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950 font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Item
                </button>
              </div>

              {formQuestions.map((q, idx) => {
                const isLegacyKey = isLegacyNonOptionAQuestion(q);
                const activeCorrectKey = q.correctOption || 'A';

                return (
                  <div key={q.id || idx} className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3 text-xs">
                    <div className="flex flex-wrap justify-between items-center gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-amber-500">Question #{idx + 1}</span>
                        {!isLegacyKey ? (
                          <span className="px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 font-bold text-[10px]">
                            Option A = Correct Answer
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 font-bold text-[10px]">
                            Legacy Key Preserved: Option {activeCorrectKey}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3">
                        {isLegacyKey && (
                          <button
                            type="button"
                            onClick={() => handleConvertLegacyRow(idx)}
                            className="px-2 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-[10px] flex items-center gap-1"
                          >
                            <ArrowUpDown className="w-3 h-3" /> Move Correct Answer to Option A
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRemoveQuestionRow(idx)}
                          className="text-red-500 font-bold hover:underline"
                        >
                          Remove
                        </button>
                      </div>
                    </div>

                    <input
                      type="text"
                      required
                      value={q.question}
                      onChange={(e) => handleUpdateQuestionRow(idx, { question: e.target.value })}
                      className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-medium"
                      placeholder="Enter examination question..."
                    />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {(['A', 'B', 'C', 'D'] as const).map((opt) => {
                        const isThisCorrect = activeCorrectKey === opt;
                        const label = !isLegacyKey
                          ? opt === 'A'
                            ? 'Option A — Correct Answer (Compulsory) *'
                            : `Option ${opt} — Wrong Answer *`
                          : isThisCorrect
                          ? `Option ${opt} — Legacy Correct Answer (Preserved) *`
                          : `Option ${opt} — Wrong Answer *`;

                        return (
                          <div key={opt} className="space-y-1">
                            <label
                              className={`block text-[10px] font-bold ${
                                isThisCorrect
                                  ? 'text-emerald-700 dark:text-emerald-300'
                                  : 'text-slate-500 dark:text-slate-400'
                              }`}
                            >
                              {label}
                            </label>
                            <input
                              type="text"
                              required
                              value={q.options[opt]}
                              onChange={(e) =>
                                handleUpdateQuestionRow(idx, {
                                  options: { ...q.options, [opt]: e.target.value },
                                })
                              }
                              placeholder={
                                isThisCorrect
                                  ? 'Enter correct answer...'
                                  : `Enter wrong answer (${opt})...`
                              }
                              className={`w-full p-2 bg-white dark:bg-slate-900 border rounded-lg text-xs ${
                                isThisCorrect
                                  ? 'border-emerald-400 dark:border-emerald-700'
                                  : 'border-slate-300 dark:border-slate-700'
                              }`}
                            />
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex flex-wrap gap-4 items-center pt-1">
                      <div className="flex-1 min-w-[200px]">
                        <input
                          type="text"
                          value={q.explanation || ''}
                          onChange={(e) => handleUpdateQuestionRow(idx, { explanation: e.target.value })}
                          placeholder="Explanatory notes / solution..."
                          className="w-full p-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-xs"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex gap-3 flex-wrap">
              <button
                type="submit"
                disabled={isSaving}
                className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-bold py-3 rounded-xl text-xs transition-colors flex items-center justify-center gap-2 shadow-lg"
              >
                <CheckCircle2 className="w-4 h-4" /> {isSaving ? 'Saving...' : 'Save Past Question Paper'}
              </button>
              {editingExamId && (
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`Are you sure you want to delete this past question paper? This cannot be undone.`)) {
                      deleteCBTExam(editingExamId);
                      setIsAddModalOpen(false);
                    }
                  }}
                  className="px-4 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors"
                >
                  <Trash2 className="w-4 h-4" /> Delete Paper
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="px-6 py-3 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Confirmation Modal for Past Paper Deletion */}
      <ConfirmDeleteModal
        isOpen={!!examToDelete}
        onClose={() => setExamToDelete(null)}
        onConfirm={() => {
          if (examToDelete) {
            deleteCBTExam(examToDelete.id);
            setExamToDelete(null);
          }
        }}
        title="Confirm Past Question Paper Deletion"
        message="Are you sure you want to delete this past question paper from the archive?"
        itemName={examToDelete ? examToDelete.title : undefined}
      />
    </div>
  );
};
