import React, { useState, useEffect, useCallback } from 'react';
import { useSchool } from '../../context/SchoolContext';
import { CBTExam, CBTExamSession, CBTQuestion, CBTAttempt } from '../../types';
import { ConfirmDeleteModal } from '../common/ConfirmDeleteModal';
import {
  TEACHER_OPTION_A_INSTRUCTION,
  createBlankOptionAQuestion,
  isLegacyNonOptionAQuestion,
  convertLegacyQuestionToOptionA,
  validateExamQuestionsForSave,
} from '../../lib/cbtShuffling';
import {
  resolveMatchingTeacher,
  resolveSyncedSelectionId,
  validateAcademicEntityReferences,
} from '../../lib/academicSelection';
import {
  classifyExamParticipation,
  computeSafeExamEndDate,
  validateCBTExamSchedule,
} from '../../lib/cbtReliability';
import {
  Plus,
  Trash2,
  FileSpreadsheet,
  CheckCircle2,
  Save,
  Eye,
  Edit3,
  X,
  Award,
  UserCheck,
  AlertCircle,
  BarChart2,
  Sparkles,
  RotateCcw,
  Lock,
  Shuffle,
  ArrowUpDown,
} from 'lucide-react';

// Interactive Spell Checker dictionary for CBT Questions
const COMMON_DICTIONARY = [
  "what", "where", "when", "how", "which", "who", "why", "whose", "whom", "the", "and", "but", "for", "nor", "yet", "so", "with", "about", "against", "between", "into", "through", "during", "before", "after", "above", "below", "from", "down", "over", "under", "again", "further", "then", "once", "here", "there", "both", "each", "few", "more", "most", "other", "some", "such", "than", "too", "very", "can", "will", "just", "should", "would", "could", "following", "correct", "incorrect", "question", "option", "answer", "explanation", "calculate", "solve", "identify", "determine", "select", "choose", "example", "definition", "concept", "meaning", "structure", "function", "system", "process", "result", "difference", "similar", "opposite", "equal", "greater", "less", "value", "number", "integer", "fraction", "decimal", "percentage", "ratio", "proportion", "algebra", "geometry", "calculus", "matrix", "vector", "probability", "statistics", "equation", "formula", "variable", "coefficient", "exponent", "polynomial", "root", "power", "sum", "difference", "product", "quotient", "remainder", "triangle", "circle", "square", "rectangle", "polygon", "angle", "degree", "radian", "perimeter", "area", "volume", "surface", "theorem", "proof", "science", "biology", "physics", "chemistry", "element", "atom", "molecule", "compound", "reaction", "energy", "force", "mass", "weight", "gravity", "motion", "speed", "velocity", "acceleration", "temperature", "pressure", "volume", "density", "state", "matter", "solid", "liquid", "gas", "plasma", "cell", "organism", "plant", "animal", "human", "organ", "tissue", "gene", "chromosome", "evolution", "ecology", "environment", "history", "geography", "government", "politics", "economy", "society", "culture", "language", "grammar", "spelling", "vocabulary", "sentence", "paragraph", "essay", "literature", "poetry", "drama", "novel", "author", "character", "theme", "plot", "setting", "conflict", "resolution", "analysis", "interpretation", "criticism", "evaluation", "synthesis", "application", "comprehension", "knowledge", "understanding", "cognitive", "affective", "psychomotor", "domain", "taxonomy", "objective", "assessment", "evaluation", "measurement", "test", "quiz", "examination", "instruction", "curriculum", "syllabus", "pedagogy", "methodology", "technique", "strategy", "resource", "material", "activity", "assignment", "project", "homework", "feedback", "grade", "score", "performance", "achievement", "progress", "development", "growth", "learning", "teaching", "education", "school", "academy", "college", "university", "classroom", "laboratory", "library", "office", "staff", "teacher", "student", "parent", "guardian", "principal", "administrator", "director", "coordinator", "supervisor", "counselor", "librarian", "secretary", "clerk", "bursar", "accountant", "registrar", "officer", "manager", "leader", "expert", "professional", "specialist", "consultant", "advisor", "mentor", "tutor", "coach", "instructor", "facilitator", "trainer"
];

function getLevenshteinDistance(a: string, b: string): number {
  const matrix = Array.from({ length: a.length + 1 }, () =>
    Array(b.length + 1).fill(0)
  );
  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      if (a[i - 1] === b[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[a.length][b.length];
}

interface SpellingHelperProps {
  text: string;
  onCorrect: (newText: string) => void;
}

const CBTQuestionSpellingHelper: React.FC<SpellingHelperProps> = ({ text, onCorrect }) => {
  const [ignoredWords, setIgnoredWords] = React.useState<string[]>([]);

  if (!text) return null;

  // Split into words, remove punctuation but keep inner hyphens or apostrophes
  const words = text
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"]/g, " ")
    .split(/\s+/)
    .map(w => w.trim())
    .filter(w => w.length >= 3 && !/^\d+$/.test(w));

  const uniqueWords = Array.from(new Set<string>(words));
  const misspelled: { word: string; suggestions: string[] }[] = [];

  uniqueWords.forEach((w: string) => {
    const lowerWord = w.toLowerCase();
    // Skip if starts with uppercase (assuming proper nouns) or ignored
    if (ignoredWords.includes(lowerWord) || w[0] === w[0].toUpperCase()) {
      return;
    }

    // Check if in dictionary
    if (!COMMON_DICTIONARY.includes(lowerWord)) {
      // Find suggestions
      const suggestions = COMMON_DICTIONARY.filter(dictWord => {
        const dist = getLevenshteinDistance(lowerWord, dictWord);
        return dist <= 2; // Close suggestions
      }).slice(0, 3); // Max 3 suggestions

      misspelled.push({ word: w, suggestions });
    }
  });

  if (misspelled.length === 0) return null;

  const replaceWord = (oldWord: string, newWord: string) => {
    // Replace whole word while preserving case or matching exactly
    const regex = new RegExp(`\\b${oldWord}\\b`, 'g');
    const updatedText = text.replace(regex, newWord);
    onCorrect(updatedText);
  };

  const handleIgnore = (word: string) => {
    setIgnoredWords(prev => [...prev, word.toLowerCase()]);
  };

  return (
    <div className="mt-2 bg-amber-500/10 dark:bg-amber-500/5 border border-amber-500/20 rounded-xl p-3 space-y-2 text-xs">
      <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-bold">
        <Sparkles className="w-3.5 h-3.5 animate-pulse text-amber-500" />
        <span>Spelling Assistant suggestions:</span>
      </div>
      <div className="flex flex-wrap gap-3">
        {misspelled.map(({ word, suggestions }) => (
          <div key={word} className="flex flex-wrap items-center gap-1.5 bg-white dark:bg-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800">
            <span className="font-bold text-red-500 dark:text-red-400 underline decoration-wavy decoration-red-500">{word}</span>
            <span className="text-slate-400">→</span>
            {suggestions.length > 0 ? (
              <div className="flex gap-1">
                {suggestions.map(sug => (
                  <button
                    key={sug}
                    type="button"
                    onClick={() => replaceWord(word, sug)}
                    className="px-1.5 py-0.5 bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 rounded font-semibold hover:bg-amber-200 dark:hover:bg-amber-900 transition-colors"
                  >
                    {sug}
                  </button>
                ))}
              </div>
            ) : (
              <span className="text-slate-400 italic">No suggestion</span>
            )}
            <button
              type="button"
              onClick={() => handleIgnore(word)}
              className="text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 font-medium ml-1 hover:underline"
            >
              Ignore
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export const CBTQuestionBankBuilder: React.FC = () => {
  const {
    cbtExams,
    cbtAttempts,
    createCBTExam,
    updateCBTExam,
    deleteCBTExam,
    deleteMultipleCBTExams,
    deleteCBTAttempt,
    getCBTActiveSessionExamIds,
    getCBTExamSessions,
    resetCBTExamSession,
    students,
    classes,
    subjects,
    teachers,
    currentUser,
  } = useSchool();
  const matchedTeacher = resolveMatchingTeacher(currentUser, teachers);
  const [activeTab, setActiveTab] = useState<'list' | 'create' | 'import'>('list');
  const [selectedExamIds, setSelectedExamIds] = useState<string[]>([]);
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);
  const [activeSessionExamIds, setActiveSessionExamIds] = useState<string[]>([]);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const refreshActiveSessionLocks = useCallback(async () => {
    const ids = await getCBTActiveSessionExamIds();
    setActiveSessionExamIds(ids);
  }, [getCBTActiveSessionExamIds]);

  useEffect(() => {
    void refreshActiveSessionLocks();
  }, [refreshActiveSessionLocks, activeTab]);

  const toggleSelectExam = (id: string) => {
    setSelectedExamIds((prev) =>
      prev.includes(id) ? prev.filter((itemId) => itemId !== id) : [...prev, id]
    );
  };

  const handleSelectAllExams = () => {
    if (selectedExamIds.length === cbtExams.length) {
      setSelectedExamIds([]);
    } else {
      setSelectedExamIds(cbtExams.map((exam) => exam.id));
    }
  };

  const handleBulkDeleteCBTExams = () => {
    if (selectedExamIds.length === 0) return;
    const lockedSelected = selectedExamIds.filter((id) => activeSessionExamIds.includes(id));
    if (lockedSelected.length > 0) {
      setSaveError(
        'One or more selected exams have students currently taking an active session and cannot be deleted until finished.'
      );
      return;
    }
    setBulkDeleteConfirmOpen(true);
  };

  // Edit Mode state
  const [editingExamId, setEditingExamId] = useState<string | null>(null);
  const [editingExamTeacherId, setEditingExamTeacherId] = useState<string | undefined>(undefined);

  // View Results & Participation modal state
  const [viewingResultsExam, setViewingResultsExam] = useState<CBTExam | null>(null);
  const [viewingStudentScript, setViewingStudentScript] = useState<CBTAttempt | null>(null);
  const [examSessions, setExamSessions] = useState<CBTExamSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [resultsSubTab, setResultsSubTab] = useState<
    'submitted' | 'in_progress' | 'expired' | 'not_started'
  >('submitted');

  const loadSessionsForExam = useCallback(
    async (examId: string) => {
      setSessionsLoading(true);
      try {
        const list = await getCBTExamSessions(examId);
        setExamSessions(list);
      } finally {
        setSessionsLoading(false);
      }
    },
    [getCBTExamSessions]
  );

  useEffect(() => {
    if (!viewingResultsExam) {
      setExamSessions([]);
      setResultsSubTab('submitted');
      return;
    }
    void loadSessionsForExam(viewingResultsExam.id);
  }, [viewingResultsExam, loadSessionsForExam]);

  // New / Editing Exam Form State
  const [title, setTitle] = useState('');
  const [classId, setClassId] = useState(() => classes[0]?.id || '');
  const [subjectId, setSubjectId] = useState(() => subjects[0]?.id || '');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [passPercentage, setPassPercentage] = useState(50);
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState('08:00');
  const [endDate, setEndDate] = useState(() =>
    computeSafeExamEndDate(new Date().toISOString().split('T')[0], 30)
  );
  const [isPublished, setIsPublished] = useState(true);
  const [shuffleQuestions, setShuffleQuestions] = useState(true);
  const [allowAnswerReview, setAllowAnswerReview] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    setClassId((prev) =>
      resolveSyncedSelectionId(prev, classes, {
        preserveExistingWhenEditing: Boolean(editingExamId),
      })
    );
  }, [classes, editingExamId]);

  useEffect(() => {
    setSubjectId((prev) =>
      resolveSyncedSelectionId(prev, subjects, {
        preserveExistingWhenEditing: Boolean(editingExamId),
      })
    );
  }, [subjects, editingExamId]);

  // Manual Questions List (new questions always default to correctOption: 'A')
  const [questions, setQuestions] = useState<CBTQuestion[]>([
    createBlankOptionAQuestion(`q-${Date.now()}-1`),
  ]);

  // Excel / CSV Importer Raw Text State
  const [csvText, setCsvText] = useState('');
  const [importedPreview, setImportedPreview] = useState<CBTQuestion[]>([]);
  const [examToDelete, setExamToDelete] = useState<CBTExam | null>(null);

  const handleEditExam = (exam: CBTExam) => {
    setSaveError(null);
    setSaveSuccess(null);
    if (activeSessionExamIds.includes(exam.id)) {
      setSaveError(
        `"${exam.title}" currently has an active in-progress student exam session. Question editing is locked until all ongoing sessions submit or expire.`
      );
      return;
    }
    setEditingExamId(exam.id);
    setEditingExamTeacherId(exam.teacherId);
    setTitle(exam.title);
    setClassId(exam.classId);
    setSubjectId(exam.subjectId);
    setDurationMinutes(exam.durationMinutes);
    setPassPercentage(exam.passPercentage ?? 50);
    setStartDate(exam.startDate);
    setStartTime(exam.startTime || '08:00');
    setEndDate(exam.endDate || computeSafeExamEndDate(exam.startDate, 30));
    setIsPublished(exam.isPublished ?? true);
    setShuffleQuestions(exam.shuffleQuestions ?? true);
    setAllowAnswerReview(exam.allowAnswerReview);
    // Preserve existing question keys (including legacy B/C/D keys) without silent overwriting
    setQuestions(exam.questions ? JSON.parse(JSON.stringify(exam.questions)) : []);
    setActiveTab('create');
  };

  const handleCancelEdit = () => {
    const todayStr = new Date().toISOString().split('T')[0];
    setEditingExamId(null);
    setEditingExamTeacherId(undefined);
    setSaveError(null);
    setTitle('');
    setClassId(classes[0]?.id || '');
    setSubjectId(subjects[0]?.id || '');
    setDurationMinutes(60);
    setPassPercentage(50);
    setStartDate(todayStr);
    setStartTime('08:00');
    setEndDate(computeSafeExamEndDate(todayStr, 30));
    setIsPublished(true);
    setAllowAnswerReview(undefined);
    setQuestions([createBlankOptionAQuestion(`q-${Date.now()}-1`)]);
  };

  const handleAddQuestionManual = () => {
    const newQ = createBlankOptionAQuestion(`q-${Date.now()}-${questions.length + 1}`);
    setQuestions((prev) => [...prev, newQ]);
  };

  const handleUpdateQuestion = (idx: number, updated: Partial<CBTQuestion>) => {
    setQuestions((prev) => {
      const copy = [...prev];
      copy[idx] = {
        ...copy[idx],
        ...updated,
        correctOption: updated.correctOption ?? copy[idx].correctOption ?? 'A',
      };
      return copy;
    });
  };

  const handleConvertLegacyQuestion = (idx: number) => {
    setQuestions((prev) => {
      const copy = [...prev];
      copy[idx] = convertLegacyQuestionToOptionA(copy[idx]);
      return copy;
    });
  };

  const handleDeleteQuestion = (idx: number) => {
    setQuestions((prev) => prev.filter((_, i) => i !== idx));
  };

  // CSV Import Parser: supports Option-A-first 5/6 columns AND legacy 6/7-column format
  const handleParseCsv = () => {
    const lines = csvText.split('\n').filter((l) => l.trim().length > 0);
    const parsed: CBTQuestion[] = [];

    lines.forEach((line, index) => {
      if (index === 0 && line.toLowerCase().includes('question')) return;
      const parts = line.split(',').map((p) => p.trim().replace(/^"|"$/g, ''));
      if (parts.length >= 5) {
        const col6Upper = (parts[5] || '').toUpperCase();
        const isLegacyExplicitKey = ['A', 'B', 'C', 'D'].includes(col6Upper);
        parsed.push({
          id: `imp-${Date.now()}-${index}`,
          question: parts[0],
          options: {
            A: parts[1] || '',
            B: parts[2] || '',
            C: parts[3] || '',
            D: parts[4] || '',
          },
          correctOption: isLegacyExplicitKey ? (col6Upper as 'A' | 'B' | 'C' | 'D') : 'A',
          explanation: isLegacyExplicitKey
            ? parts[6] || 'Imported from Excel/CSV file'
            : parts[5] || 'Imported from Excel/CSV file',
          marks: 1,
        });
      }
    });

    setImportedPreview(parsed);
  };

  const handleConvertAllImportedToOptionA = () => {
    setImportedPreview((prev) => prev.map((q) => convertLegacyQuestionToOptionA(q)));
  };

  const handleApplyImportedQuestions = () => {
    if (importedPreview.length > 0) {
      setQuestions(importedPreview);
      setActiveTab('create');
      setSaveSuccess(
        `Loaded ${importedPreview.length} questions into the Question Bank editor.`
      );
    }
  };

  const handleSaveExam = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    setSaveSuccess(null);

    if (!title.trim()) {
      setSaveError('Please enter an exam title.');
      return;
    }

    const effectiveStartDate = startDate || new Date().toISOString().split('T')[0];
    const effectiveEndDate = endDate || computeSafeExamEndDate(effectiveStartDate, 30);

    const scheduleError = validateCBTExamSchedule({
      startDate: effectiveStartDate,
      endDate: effectiveEndDate,
      durationMinutes: Number(durationMinutes),
      passPercentage: Number(passPercentage),
    });
    if (scheduleError) {
      setSaveError(scheduleError);
      return;
    }

    const validationError = validateExamQuestionsForSave(questions);
    if (validationError) {
      setSaveError(validationError);
      return;
    }

    const normalizedQuestions = questions.map((q) => ({
      ...q,
      correctOption: q.correctOption && ['A', 'B', 'C', 'D'].includes(q.correctOption)
        ? q.correctOption
        : ('A' as const),
      marks: Number(q.marks) > 0 ? Number(q.marks) : 1,
    }));

    const resolvedTeacherId = editingExamId
      ? editingExamTeacherId ?? matchedTeacher?.id
      : matchedTeacher?.id;

    const refCheck = validateAcademicEntityReferences({
      classId,
      subjectId,
      classes,
      subjects,
      currentUserRole: currentUser?.role,
      resolvedTeacherId,
      actionLabel: editingExamId ? 'update a CBT exam' : 'create a CBT exam',
    });
    if (!refCheck.ok || !refCheck.matchedClass || !refCheck.matchedSubject) {
      setSaveError(
        refCheck.error || 'Please select a valid Class and Subject before saving this CBT exam.'
      );
      return;
    }

    const examPayload: Omit<CBTExam, 'id'> = {
      title: title.trim(),
      subjectId: refCheck.matchedSubject.id,
      subjectName: refCheck.matchedSubject.name,
      classId: refCheck.matchedClass.id,
      className: refCheck.matchedClass.name,
      teacherId: resolvedTeacherId,
      durationMinutes: Number(durationMinutes),
      totalQuestions: normalizedQuestions.length,
      totalMarks: normalizedQuestions.reduce((acc, q) => acc + (q.marks || 1), 0),
      passPercentage: Number(passPercentage) || 50,
      startDate: effectiveStartDate,
      startTime: startTime || '08:00',
      endDate: effectiveEndDate,
      isPublished,
      shuffleQuestions,
      allowAnswerReview,
      questions: normalizedQuestions,
    };

    setIsSaving(true);
    try {
      const result = editingExamId
        ? await updateCBTExam(editingExamId, examPayload)
        : await createCBTExam(examPayload);

      if (!result.ok) {
        setSaveError(result.error || 'Unable to save CBT exam. Please check your inputs.');
        await refreshActiveSessionLocks();
        return;
      }

      setSaveSuccess(
        editingExamId
          ? 'CBT Exam and questions successfully updated!'
          : isPublished
          ? 'New CBT Exam successfully created and published!'
          : 'CBT Exam saved as Draft (students cannot view until published).'
      );
      handleCancelEdit();
      setActiveTab('list');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      
      {/* Action Header Tabs */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-md flex justify-between items-center flex-wrap gap-4">
        <div>
          <h2 className="font-serif font-bold text-2xl text-slate-900 dark:text-white">
            CBT Question Bank & Exam Creator
          </h2>
          <p className="text-xs text-slate-500">
            Build objective test question banks, view student test results, or edit subject exams.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => {
              setSaveError(null);
              setActiveTab('list');
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold ${
              activeTab === 'list' ? 'bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
            }`}
          >
            Exam List ({cbtExams.length})
          </button>
          <button
            onClick={() => {
              setSaveError(null);
              setSaveSuccess(null);
              if (editingExamId) handleCancelEdit();
              setActiveTab('create');
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold ${
              activeTab === 'create' ? 'bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
            }`}
          >
            + Build New CBT Exam
          </button>
          <button
            onClick={() => {
              setSaveError(null);
              setActiveTab('import');
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 ${
              activeTab === 'import' ? 'bg-amber-500 text-slate-950' : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" /> Import Excel/CSV
          </button>
        </div>
      </div>

      {saveError && (
        <div className="bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 p-4 rounded-2xl text-xs font-bold flex items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {saveError}
          </span>
          <button type="button" onClick={() => setSaveError(null)} className="text-red-400 hover:text-red-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {saveSuccess && (
        <div className="bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 p-4 rounded-2xl text-xs font-bold flex items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            {saveSuccess}
          </span>
          <button type="button" onClick={() => setSaveSuccess(null)} className="text-emerald-500 hover:text-emerald-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {activeTab === 'list' && (
        <div className="space-y-6">
          {cbtExams.length > 0 && (
            <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="selectAllExams"
                  checked={cbtExams.length > 0 && selectedExamIds.length === cbtExams.length}
                  onChange={handleSelectAllExams}
                  className="w-4 h-4 text-amber-500 border-slate-300 rounded focus:ring-amber-500 accent-amber-500 cursor-pointer"
                />
                <label htmlFor="selectAllExams" className="text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                  Select All CBT Exam Papers ({cbtExams.length})
                </label>
              </div>

              {selectedExamIds.length > 0 && (
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-slate-500">
                    {selectedExamIds.length} paper(s) selected
                  </span>
                  <button
                    onClick={handleBulkDeleteCBTExams}
                    className="bg-red-500 hover:bg-red-600 text-white font-bold py-1.5 px-3 rounded-lg text-xs flex items-center gap-1.5 transition-all shadow-sm"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete Selected ({selectedExamIds.length})
                  </button>
                  <button
                    onClick={() => setSelectedExamIds([])}
                    className="text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 py-1.5 px-2"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>
          )}

          {cbtExams.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 text-center text-slate-500">
              No CBT Exams available. Click "Build New CBT Exam" or "Import Excel/CSV" to get started.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {cbtExams.map((exam) => {
                const examAttempts = cbtAttempts.filter((a) => a.examId === exam.id);

                return (
                  <div
                    key={exam.id}
                    className={`bg-white dark:bg-slate-900 rounded-3xl border p-6 space-y-4 shadow-sm flex flex-col justify-between hover:border-amber-400/50 transition-colors ${
                      selectedExamIds.includes(exam.id)
                        ? 'border-amber-500 dark:border-amber-500 ring-2 ring-amber-500/20'
                        : 'border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <div className="space-y-4">
                      <div className="flex justify-between items-start gap-3">
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={selectedExamIds.includes(exam.id)}
                            onChange={() => toggleSelectExam(exam.id)}
                            className="mt-1 w-4 h-4 text-amber-500 border-slate-300 rounded focus:ring-amber-500 accent-amber-500 cursor-pointer"
                          />
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[10px] font-bold uppercase bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded">
                                {exam.subjectName} ({exam.className})
                              </span>
                              <span
                                className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                                  exam.isPublished
                                    ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                                    : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                                }`}
                              >
                                {exam.isPublished ? 'Published' : 'Draft'}
                              </span>
                            </div>
                            <h3 className="font-bold text-base text-slate-900 dark:text-white mt-1">
                              {exam.title}
                            </h3>
                          </div>
                        </div>
                      </div>

                      <div className="text-xs text-slate-500 space-y-1">
                        <p>Questions: <strong>{exam.totalQuestions} Items</strong> ({exam.totalMarks} Total Marks)</p>
                        <p>Duration: <strong>{exam.durationMinutes} Minutes</strong> • Pass: <strong>{exam.passPercentage ?? 50}%</strong></p>
                        <p className="text-purple-600 dark:text-purple-400 font-semibold pt-1">
                          Window: <strong>{exam.startDate} @ {exam.startTime || '08:00'}</strong> to <strong>{exam.endDate}</strong>
                        </p>
                        {activeSessionExamIds.includes(exam.id) && (
                          <p className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/60 px-2 py-0.5 rounded mt-1">
                            <Lock className="w-3 h-3" /> Active Exam Session In Progress (Editing Locked)
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Subject CBT Action Buttons for Teachers */}
                    <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => setViewingResultsExam(exam)}
                          className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all"
                        >
                          <Eye className="w-3.5 h-3.5" /> View Results ({examAttempts.length})
                        </button>
                        <button
                          onClick={() => handleEditExam(exam)}
                          disabled={activeSessionExamIds.includes(exam.id)}
                          title={
                            activeSessionExamIds.includes(exam.id)
                              ? 'Editing locked while students are taking this exam'
                              : 'Edit Questions'
                          }
                          className="bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-bold py-2 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all"
                        >
                          {activeSessionExamIds.includes(exam.id) ? (
                            <Lock className="w-3.5 h-3.5" />
                          ) : (
                            <Edit3 className="w-3.5 h-3.5" />
                          )}{' '}
                          Edit Questions
                        </button>
                      </div>
                      <button
                        onClick={() => {
                          if (activeSessionExamIds.includes(exam.id)) {
                            setSaveError(
                              `"${exam.title}" has an active student exam session in progress and cannot be deleted right now.`
                            );
                            return;
                          }
                          setExamToDelete(exam);
                        }}
                        disabled={activeSessionExamIds.includes(exam.id)}
                        className="w-full bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-900/40 disabled:opacity-40 disabled:cursor-not-allowed text-red-600 dark:text-red-400 font-bold py-2 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all border border-red-100 dark:border-red-900/30"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Delete Exam Paper
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'create' && (
        <form onSubmit={handleSaveExam} className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 space-y-8 shadow-xl">
          <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-4">
            <div>
              <h3 className="font-serif font-bold text-xl text-slate-900 dark:text-white">
                {editingExamId ? 'Edit CBT Exam & Questions Setup' : 'New CBT Exam & Questions Setup'}
              </h3>
              <p className="text-xs text-slate-500">
                {editingExamId ? 'Update exam parameters and questions for this subject.' : 'Define test duration, subject target, and objective questions.'}
              </p>
            </div>
            {editingExamId && (
              <button
                type="button"
                onClick={handleCancelEdit}
                className="px-3.5 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl text-xs hover:bg-slate-200 dark:hover:bg-slate-700"
              >
                Cancel Editing
              </button>
            )}
          </div>

          {editingExamId && (
            <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-2xl flex items-center justify-between text-xs font-semibold text-amber-800 dark:text-amber-300">
              <div className="flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-amber-500" />
                <span>Currently editing exam: <strong>"{title}"</strong></span>
              </div>
              <span className="text-[11px] bg-amber-500 text-slate-950 font-bold px-2.5 py-0.5 rounded-md">
                Edit Mode Active
              </span>
            </div>
          )}

          {(classes.length === 0 || subjects.length === 0) && (
            <div className="bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 p-4 rounded-2xl text-xs font-semibold flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <span>
                {classes.length === 0 && subjects.length === 0
                  ? 'No active classes or subjects are available for your account yet. Ask an administrator to add subjects in Curriculum & Subject Manager and assign your classes/subjects.'
                  : classes.length === 0
                    ? 'No active classes are available for your account yet. Ask an administrator to create or assign classes in Class Management.'
                    : 'No subjects are available for your account yet. Ask an administrator to add subjects in Curriculum & Subject Manager and link them to your faculty profile.'}
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="sm:col-span-3">
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">CBT Exam Title *</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. JSS 3 Mathematics Mock CBT Exam"
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Target Class *</label>
              <select
                required
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
              >
                {classes.length === 0 ? (
                  <option value="">-- No classes available --</option>
                ) : (
                  <>
                    {!classes.some((c) => c.id === classId) && (
                      <option value="">-- Select Target Class --</option>
                    )}
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </>
                )}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Subject *</label>
              <select
                required
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
              >
                {subjects.length === 0 ? (
                  <option value="">-- No subjects available --</option>
                ) : (
                  <>
                    {!subjects.some((s) => s.id === subjectId) && (
                      <option value="">-- Select Subject --</option>
                    )}
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </>
                )}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Duration (Minutes) *</label>
              <input
                type="number"
                min={1}
                max={300}
                required
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(parseInt(e.target.value, 10) || 1)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Start Date *</label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-medium"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Start Time *</label>
              <input
                type="time"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-medium"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Closing End Date *</label>
              <input
                type="date"
                required
                min={startDate || undefined}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-medium"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Pass Mark (%) *</label>
              <input
                type="number"
                min={1}
                max={100}
                required
                value={passPercentage}
                onChange={(e) => setPassPercentage(parseInt(e.target.value, 10) || 50)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-medium"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Visibility Status</label>
              <select
                value={isPublished ? 'published' : 'draft'}
                onChange={(e) => setIsPublished(e.target.value === 'published')}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-medium"
              >
                <option value="published">Published (Visible to Eligible Class)</option>
                <option value="draft">Draft (Hidden from Students)</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Post-Submission Answer Review
              </label>
              <select
                value={allowAnswerReview === false ? 'withhold' : 'inherit'}
                onChange={(e) =>
                  setAllowAnswerReview(e.target.value === 'withhold' ? false : undefined)
                }
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-medium"
              >
                <option value="inherit">Follow School Examination Policy</option>
                <option value="withhold">Always Withhold Answers &amp; Explanations</option>
              </select>
            </div>
          </div>

          {/* Question Items Editor */}
          <div className="space-y-6 pt-4 border-t border-slate-200 dark:border-slate-800">
            {/* Teacher Option-A Instruction Banner */}
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 flex items-start gap-3 text-xs text-emerald-900 dark:text-emerald-200">
              <Shuffle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold uppercase tracking-wider text-[11px] text-emerald-700 dark:text-emerald-300">
                  Automatic Answer Option Shuffling Enabled
                </p>
                <p className="font-medium leading-relaxed">{TEACHER_OPTION_A_INSTRUCTION}</p>
              </div>
            </div>

            <div className="flex justify-between items-center">
              <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                Questions Builder ({questions.length} Items)
              </h4>
              <button
                type="button"
                onClick={handleAddQuestionManual}
                className="bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add Question
              </button>
            </div>

            {questions.map((q, idx) => {
              const isLegacyKey = isLegacyNonOptionAQuestion(q);
              const activeCorrectKey = q.correctOption || 'A';

              return (
                <div
                  key={q.id || idx}
                  className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4 text-xs"
                >
                  <div className="flex flex-wrap justify-between items-center gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-amber-600">Question #{idx + 1}</span>
                      {!isLegacyKey ? (
                        <span className="px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 font-bold text-[10px]">
                          Option A = Correct Answer (Auto-Shuffled for Students)
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 font-bold text-[10px]">
                          Legacy Answer Key Preserved: Option {activeCorrectKey}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      {isLegacyKey && (
                        <button
                          type="button"
                          onClick={() => handleConvertLegacyQuestion(idx)}
                          className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-[11px] flex items-center gap-1"
                          title="Safely swap Option A text with the legacy correct option text so Option A becomes the correct answer"
                        >
                          <ArrowUpDown className="w-3 h-3" /> Move Correct Answer to Option A
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDeleteQuestion(idx)}
                        className="text-red-500 font-bold hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Question *
                    </label>
                    <textarea
                      rows={2}
                      required
                      value={q.question}
                      onChange={(e) => handleUpdateQuestion(idx, { question: e.target.value })}
                      className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-medium resize-y outline-none focus:ring-2 focus:ring-amber-500/20"
                      placeholder="Enter examination question..."
                      spellCheck={true}
                    />
                  </div>

                  <CBTQuestionSpellingHelper
                    text={q.question}
                    onCorrect={(newText) => handleUpdateQuestion(idx, { question: newText })}
                  />

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                        <div
                          key={opt}
                          className={`p-3 rounded-xl border space-y-1.5 ${
                            isThisCorrect
                              ? 'bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-400/70 dark:border-emerald-700/70'
                              : 'bg-white/70 dark:bg-slate-900/60 border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <label
                              className={`font-bold text-[11px] ${
                                isThisCorrect
                                  ? 'text-emerald-700 dark:text-emerald-300'
                                  : 'text-slate-600 dark:text-slate-400'
                              }`}
                            >
                              {label}
                            </label>
                            {isThisCorrect && (
                              <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-emerald-600 text-white">
                                Correct
                              </span>
                            )}
                          </div>
                          <input
                            type="text"
                            required
                            value={q.options[opt]}
                            onChange={(e) =>
                              handleUpdateQuestion(idx, {
                                options: { ...q.options, [opt]: e.target.value },
                              })
                            }
                            placeholder={
                              isThisCorrect
                                ? 'Enter the correct answer (compulsory)...'
                                : `Enter incorrect answer (${opt})...`
                            }
                            className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                            spellCheck={true}
                          />
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex flex-wrap gap-4 items-center pt-2">
                    {isLegacyKey && (
                      <span className="text-[11px] text-amber-700 dark:text-amber-300 font-semibold">
                        Existing question answer key ({activeCorrectKey}) is preserved during grading.
                      </span>
                    )}
                    <div className="ml-auto flex items-center gap-2">
                      <label className="font-bold text-slate-700 dark:text-slate-300">Marks:</label>
                      <input
                        type="number"
                        min={1}
                        value={q.marks}
                        onChange={(e) => handleUpdateQuestion(idx, { marks: parseInt(e.target.value, 10) || 1 })}
                        className="w-16 p-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-center font-bold"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex gap-3 flex-wrap">
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-bold py-3.5 rounded-xl text-sm transition-colors flex items-center justify-center gap-2 shadow-lg"
            >
              <Save className="w-4 h-4" />{' '}
              {isSaving
                ? 'Saving CBT Exam...'
                : editingExamId
                ? 'Update CBT Exam & Questions'
                : 'Save & Publish CBT Exam'}
            </button>
            {editingExamId && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    const ex = cbtExams.find(e => e.id === editingExamId);
                    if (ex) setExamToDelete(ex);
                  }}
                  className="px-5 py-3.5 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors shadow-sm"
                >
                  <Trash2 className="w-4 h-4" /> Delete Paper
                </button>
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="px-6 py-3.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold rounded-xl text-xs"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </form>
      )}

      {activeTab === 'import' && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 space-y-6 shadow-xl">
          <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-3">
            <div>
              <h3 className="font-serif font-bold text-xl text-slate-900 dark:text-white">
                Import CBT Questions from Excel / CSV
              </h3>
              <p className="text-xs text-slate-500">
                Paste raw CSV rows. Option A should hold the correct answer and Options B, C, D the three wrong answers.
              </p>
            </div>
          </div>

          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 text-xs text-emerald-900 dark:text-emerald-200 font-medium">
            {TEACHER_OPTION_A_INSTRUCTION}
          </div>

          <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs space-y-2">
            <p className="font-bold text-slate-900 dark:text-white">
              Expected CSV Format (1 question per line — Option A is automatically marked correct):
            </p>
            <code className="block p-3 bg-slate-900 text-amber-400 font-mono rounded-xl overflow-x-auto text-[11px]">
              Question Text, Option A (Correct Answer), Option B (Wrong), Option C (Wrong), Option D (Wrong), Explanation (optional)
            </code>
            <p className="text-slate-500 italic">
              Example: "What is 15 + 25?", "40", "30", "50", "60", "15 plus 25 equals 40."
            </p>
            <p className="text-[11px] text-slate-400">
              Legacy 7-column rows ending with A/B/C/D are also safely preserved with optional one-click Option A conversion below.
            </p>
          </div>

          <textarea
            rows={6}
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            placeholder="Paste your CSV question lines here..."
            className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-2xl font-mono text-xs"
          />

          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleParseCsv}
              className="bg-slate-900 text-white font-bold px-6 py-2.5 rounded-xl text-xs flex items-center gap-1.5"
            >
              Parse & Preview Questions
            </button>
            {importedPreview.some((q) => isLegacyNonOptionAQuestion(q)) && (
              <button
                type="button"
                onClick={handleConvertAllImportedToOptionA}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-2.5 rounded-xl text-xs flex items-center gap-1.5"
              >
                <ArrowUpDown className="w-4 h-4" /> Convert All Imported Keys to Option A Format
              </button>
            )}
            {importedPreview.length > 0 && (
              <button
                onClick={handleApplyImportedQuestions}
                className="bg-amber-500 text-slate-950 font-bold px-6 py-2.5 rounded-xl text-xs flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" /> Load {importedPreview.length} Questions into Editor
              </button>
            )}
          </div>
        </div>
      )}

      {/* VIEW RESULTS MODAL FOR TEACHERS */}
      {viewingResultsExam && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-4xl p-6 sm:p-8 space-y-6 shadow-2xl relative my-8">
            {/* Header */}
            <div className="flex justify-between items-start border-b border-slate-200 dark:border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 px-2.5 py-1 rounded-md">
                    {viewingResultsExam.subjectName} ({viewingResultsExam.className})
                  </span>
                  <span className="text-xs text-slate-500 font-semibold">
                    Total Marks: {viewingResultsExam.totalMarks}
                  </span>
                </div>
                <h3 className="font-serif font-bold text-2xl text-slate-900 dark:text-white mt-1">
                  Student CBT Results: {viewingResultsExam.title}
                </h3>
              </div>
              <button
                onClick={() => setViewingResultsExam(null)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Results & Live Participation Breakdown */}
            {(() => {
              const attempts = cbtAttempts.filter((a) => a.examId === viewingResultsExam.id);
              const totalAttempts = attempts.length;
              const avgScore = totalAttempts > 0
                ? Math.round(attempts.reduce((acc, a) => acc + a.percentage, 0) / totalAttempts)
                : 0;
              const topScore = totalAttempts > 0
                ? Math.max(...attempts.map((a) => a.scoreObtained))
                : 0;

              const participation = classifyExamParticipation({
                exam: viewingResultsExam,
                students,
                attempts: cbtAttempts,
                sessions: examSessions,
              });

              return (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-0.5">
                      <span className="text-[10px] text-slate-500 font-bold uppercase">Submitted</span>
                      <p className="font-serif font-black text-xl text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                        <UserCheck className="w-4 h-4" /> {participation.submitted.length} / {participation.eligibleCount}
                      </p>
                    </div>
                    <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-0.5">
                      <span className="text-[10px] text-slate-500 font-bold uppercase">In Progress</span>
                      <p className="font-serif font-black text-xl text-amber-500">
                        {sessionsLoading ? '...' : participation.inProgress.length}
                      </p>
                    </div>
                    <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-0.5">
                      <span className="text-[10px] text-slate-500 font-bold uppercase">Class Average</span>
                      <p className="font-serif font-black text-xl text-purple-500 flex items-center gap-1.5">
                        <BarChart2 className="w-4 h-4" /> {avgScore}%
                      </p>
                    </div>
                    <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-0.5">
                      <span className="text-[10px] text-slate-500 font-bold uppercase">Highest Score</span>
                      <p className="font-serif font-black text-xl text-slate-900 dark:text-white flex items-center gap-1.5">
                        <Award className="w-4 h-4 text-amber-500" /> {topScore} / {viewingResultsExam.totalMarks}
                      </p>
                    </div>
                  </div>

                  {/* Participation Tabs */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap gap-1.5 text-xs">
                      {(
                        [
                          { id: 'submitted', label: `Submitted (${participation.submitted.length})` },
                          { id: 'in_progress', label: `In Progress (${participation.inProgress.length})` },
                          { id: 'expired', label: `Expired (${participation.expired.length})` },
                          { id: 'not_started', label: `Not Started (${participation.notStarted.length})` },
                        ] as const
                      ).map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setResultsSubTab(tab.id)}
                          className={`px-3 py-1.5 rounded-xl font-bold transition-colors ${
                            resultsSubTab === tab.id
                              ? 'bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => void loadSessionsForExam(viewingResultsExam.id)}
                      disabled={sessionsLoading}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1"
                    >
                      <RotateCcw className={`w-3.5 h-3.5 ${sessionsLoading ? 'animate-spin' : ''}`} /> Refresh Sessions
                    </button>
                  </div>

                  {resultsSubTab === 'submitted' && (
                    totalAttempts === 0 ? (
                      <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 space-y-2">
                        <AlertCircle className="w-8 h-8 text-slate-400 mx-auto" />
                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                          No student attempts recorded yet for this CBT exam.
                        </p>
                        <p className="text-xs text-slate-500">
                          Once students complete this test, their automatic marked scores will be listed here instantly.
                        </p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 uppercase font-bold text-[10px] tracking-wider">
                            <tr>
                              <th className="p-3.5">Student Name</th>
                              <th className="p-3.5">Admission No.</th>
                              <th className="p-3.5">Marked Score</th>
                              <th className="p-3.5">Percentage</th>
                              <th className="p-3.5">Time Taken</th>
                              <th className="p-3.5">Completed Date</th>
                              <th className="p-3.5 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium text-slate-800 dark:text-slate-200">
                            {attempts.map((att) => (
                              <tr key={att.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                <td className="p-3.5 font-bold">{att.studentName}</td>
                                <td className="p-3.5 font-mono text-slate-500">{att.admissionNo}</td>
                                <td className="p-3.5">
                                  <span className="font-bold text-slate-900 dark:text-white">
                                    {att.scoreObtained} / {att.totalMarks}
                                  </span>
                                </td>
                                <td className="p-3.5">
                                  <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300/30">
                                    {att.percentage}%
                                  </span>
                                </td>
                                <td className="p-3.5 text-slate-500">
                                  {Math.floor(att.timeTakenSeconds / 60)}m {att.timeTakenSeconds % 60}s
                                </td>
                                <td className="p-3.5 text-slate-500">
                                  {new Date(att.completedAt).toLocaleDateString()} {new Date(att.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </td>
                                <td className="p-3.5 text-right flex justify-end gap-2 items-center">
                                  <button
                                    onClick={() => setViewingStudentScript(att)}
                                    className="px-3 py-1.5 bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950 font-bold rounded-lg text-[11px] hover:opacity-90 transition-opacity whitespace-nowrap"
                                  >
                                    View Script
                                  </button>
                                  <button
                                    onClick={() => {
                                      deleteCBTAttempt(att.id);
                                      void loadSessionsForExam(viewingResultsExam.id);
                                    }}
                                    className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-[11px] flex items-center gap-1 transition-colors whitespace-nowrap"
                                    title="Reset student attempt to allow retake"
                                  >
                                    <RotateCcw className="w-3.5 h-3.5" /> Allow Retake
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )
                  )}

                  {resultsSubTab === 'in_progress' && (
                    participation.inProgress.length === 0 ? (
                      <div className="p-6 text-center bg-slate-50 dark:bg-slate-800/40 rounded-2xl text-xs text-slate-500">
                        No students are currently inside an active session for this exam.
                      </div>
                    ) : (
                      <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-500 uppercase font-bold text-[10px]">
                            <tr>
                              <th className="p-3">Student</th>
                              <th className="p-3">Admission No.</th>
                              <th className="p-3">Started At</th>
                              <th className="p-3">Expires At</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {participation.inProgress.map(({ student: st, session: sess }) => (
                              <tr key={st.id}>
                                <td className="p-3 font-bold">{st.firstName} {st.lastName}</td>
                                <td className="p-3 font-mono text-slate-500">{st.admissionNo}</td>
                                <td className="p-3 text-slate-500">{sess ? new Date(sess.startedAt).toLocaleTimeString() : '—'}</td>
                                <td className="p-3 font-semibold text-amber-600 dark:text-amber-400">{sess ? new Date(sess.expiresAt).toLocaleTimeString() : '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )
                  )}

                  {resultsSubTab === 'expired' && (
                    participation.expired.length === 0 ? (
                      <div className="p-6 text-center bg-slate-50 dark:bg-slate-800/40 rounded-2xl text-xs text-slate-500">
                        No expired unsubmitted sessions recorded for this exam.
                      </div>
                    ) : (
                      <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-500 uppercase font-bold text-[10px]">
                            <tr>
                              <th className="p-3">Student</th>
                              <th className="p-3">Admission No.</th>
                              <th className="p-3">Expired At</th>
                              <th className="p-3 text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {participation.expired.map(({ student: st, session: sess }) => (
                              <tr key={st.id}>
                                <td className="p-3 font-bold">{st.firstName} {st.lastName}</td>
                                <td className="p-3 font-mono text-slate-500">{st.admissionNo}</td>
                                <td className="p-3 text-red-500">{sess ? new Date(sess.expiresAt).toLocaleString() : '—'}</td>
                                <td className="p-3 text-right">
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      const res = await resetCBTExamSession(viewingResultsExam.id, st.id);
                                      if (!res.ok) {
                                        setSaveError(res.error || 'Could not reset expired session.');
                                      } else {
                                        await loadSessionsForExam(viewingResultsExam.id);
                                      }
                                    }}
                                    className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-lg text-[11px] inline-flex items-center gap-1"
                                  >
                                    <RotateCcw className="w-3.5 h-3.5" /> Reset Session
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )
                  )}

                  {resultsSubTab === 'not_started' && (
                    participation.notStarted.length === 0 ? (
                      <div className="p-6 text-center bg-slate-50 dark:bg-slate-800/40 rounded-2xl text-xs text-slate-500">
                        All eligible active students in {viewingResultsExam.className} have started or completed this exam.
                      </div>
                    ) : (
                      <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl max-h-64 overflow-y-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-100 dark:bg-slate-800/80 text-slate-500 uppercase font-bold text-[10px]">
                            <tr>
                              <th className="p-3">Student</th>
                              <th className="p-3">Admission No.</th>
                              <th className="p-3">Class / Arm</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                            {participation.notStarted.map(({ student: st }) => (
                              <tr key={st.id}>
                                <td className="p-3 font-bold">{st.firstName} {st.lastName}</td>
                                <td className="p-3 font-mono text-slate-500">{st.admissionNo}</td>
                                <td className="p-3 text-slate-500">{st.className} {st.arm}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )
                  )}
                </div>
              );
            })()}

            {/* Modal Footer */}
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setViewingResultsExam(null)}
                className="px-6 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold rounded-xl text-xs"
              >
                Close Results
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW INDIVIDUAL STUDENT SCRIPT MODAL */}
      {viewingStudentScript && viewingResultsExam && (
        <div className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-3xl p-6 sm:p-8 space-y-6 shadow-2xl relative my-8 text-white">
            <div className="flex justify-between items-start border-b border-slate-800 pb-4">
              <div>
                <span className="text-[10px] font-bold uppercase bg-amber-500/20 text-amber-400 px-2.5 py-1 rounded-md border border-amber-500/30">
                  Student Answer Script Review
                </span>
                <h3 className="font-serif font-bold text-xl text-white mt-1">
                  {viewingStudentScript.studentName} ({viewingStudentScript.admissionNo})
                </h3>
                <p className="text-xs text-slate-400">
                  Exam: {viewingResultsExam.title} • Score: <strong className="text-amber-400">{viewingStudentScript.scoreObtained}/{viewingStudentScript.totalMarks} ({viewingStudentScript.percentage}%)</strong>
                </p>
              </div>
              <button
                onClick={() => setViewingStudentScript(null)}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
              {viewingResultsExam.questions.map((q, idx) => {
                const studentSelected = viewingStudentScript.answers?.[q.id];
                const effectiveCorrectOption = q.correctOption || 'A';
                const isCorrect = studentSelected === effectiveCorrectOption;

                return (
                  <div
                    key={q.id || idx}
                    className={`p-4 rounded-2xl border text-xs space-y-3 ${
                      isCorrect
                        ? 'bg-emerald-950/20 border-emerald-800/50'
                        : 'bg-red-950/20 border-red-800/50'
                    }`}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <p className="font-bold text-slate-200">
                        Q{idx + 1}. {q.question}
                      </p>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          isCorrect
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-red-500/20 text-red-400 border border-red-500/30'
                        }`}
                      >
                        {isCorrect ? `+${q.marks} Marks (Correct)` : `0 / ${q.marks} Marks (Incorrect)`}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {(['A', 'B', 'C', 'D'] as const).map((optKey) => {
                        const optionText = q.options[optKey];
                        const isStudentChoice = studentSelected === optKey;
                        const isRightOption = effectiveCorrectOption === optKey;

                        let optionBg = 'bg-slate-800/40 border-slate-800 text-slate-400';
                        if (isRightOption) {
                          optionBg = 'bg-emerald-900/40 border-emerald-600 text-emerald-300 font-bold';
                        } else if (isStudentChoice && !isRightOption) {
                          optionBg = 'bg-red-900/40 border-red-600 text-red-300 font-bold';
                        }

                        return (
                          <div
                            key={optKey}
                            className={`p-2.5 rounded-xl border flex items-center justify-between text-[11px] ${optionBg}`}
                          >
                            <span>
                              <strong>{optKey}.</strong> {optionText}
                            </span>
                            {isStudentChoice && (
                              <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-900 text-white">
                                Student Answer
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-4 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setViewingStudentScript(null)}
                className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs"
              >
                Back to Results Table
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for CBT Exam Deletion */}
      <ConfirmDeleteModal
        isOpen={!!examToDelete}
        onClose={() => setExamToDelete(null)}
        onConfirm={() => {
          if (examToDelete) {
            deleteCBTExam(examToDelete.id);
            if (editingExamId === examToDelete.id) {
              handleCancelEdit();
              setActiveTab('list');
            }
            setExamToDelete(null);
          }
        }}
        title="Confirm CBT Exam Deletion"
        message="Are you sure you want to delete this CBT Exam Paper and all associated questions?"
        itemName={examToDelete ? examToDelete.title : undefined}
      />

      {/* Confirmation Modal for Bulk CBT Exam Deletion */}
      <ConfirmDeleteModal
        isOpen={bulkDeleteConfirmOpen}
        onClose={() => setBulkDeleteConfirmOpen(false)}
        onConfirm={() => {
          deleteMultipleCBTExams(selectedExamIds);
          setSelectedExamIds([]);
          setBulkDeleteConfirmOpen(false);
          setSaveSuccess('Selected CBT exam papers deleted successfully.');
        }}
        title="Confirm Bulk CBT Deletion"
        message={`Are you sure you want to permanently delete ${selectedExamIds.length} selected CBT exam paper(s) along with all corresponding student attempts?`}
        itemName={`${selectedExamIds.length} CBT Examination(s)`}
      />
    </div>
  );
};
