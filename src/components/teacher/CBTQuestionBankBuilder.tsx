import React, { useState } from 'react';
import { useSchool } from '../../context/SchoolContext';
import { CBTExam, CBTQuestion, CBTAttempt } from '../../types';
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
  const { cbtExams, cbtAttempts, createCBTExam, updateCBTExam, deleteCBTExam, deleteMultipleCBTExams, deleteCBTAttempt, classes, subjects } = useSchool();
  const [activeTab, setActiveTab] = useState<'list' | 'create' | 'import'>('list');
  const [selectedExamIds, setSelectedExamIds] = useState<string[]>([]);

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
    if (
      confirm(
        `Are you sure you want to delete ${selectedExamIds.length} selected CBT exam paper(s)? This will also permanently delete all corresponding student results and attempts. This action cannot be undone.`
      )
    ) {
      deleteMultipleCBTExams(selectedExamIds);
      setSelectedExamIds([]);
      alert('Selected CBT exam papers deleted successfully.');
    }
  };

  // Edit Mode state
  const [editingExamId, setEditingExamId] = useState<string | null>(null);

  // View Results modal state
  const [viewingResultsExam, setViewingResultsExam] = useState<CBTExam | null>(null);
  const [viewingStudentScript, setViewingStudentScript] = useState<CBTAttempt | null>(null);

  // New / Editing Exam Form State
  const [title, setTitle] = useState('');
  const [classId, setClassId] = useState('c-ss2');
  const [subjectId, setSubjectId] = useState('sub-mth');
  const [durationMinutes, setDurationMinutes] = useState(15);
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState('08:00');
  const [shuffleQuestions, setShuffleQuestions] = useState(true);

  // Manual Questions List
  const [questions, setQuestions] = useState<CBTQuestion[]>([
    {
      id: `q-${Date.now()}-1`,
      question: 'What is the standard unit of force in physics?',
      options: { A: 'Joule', B: 'Newton', C: 'Watt', D: 'Pascal' },
      correctOption: 'B',
      marks: 1,
    },
  ]);

  // Excel / CSV Importer Raw Text State
  const [csvText, setCsvText] = useState('');
  const [importedPreview, setImportedPreview] = useState<CBTQuestion[]>([]);

  const handleEditExam = (exam: CBTExam) => {
    setEditingExamId(exam.id);
    setTitle(exam.title);
    setClassId(exam.classId);
    setSubjectId(exam.subjectId);
    setDurationMinutes(exam.durationMinutes);
    setStartDate(exam.startDate);
    setStartTime(exam.startTime || '08:00');
    setShuffleQuestions(exam.shuffleQuestions ?? true);
    setQuestions(exam.questions ? JSON.parse(JSON.stringify(exam.questions)) : []);
    setActiveTab('create');
  };

  const handleCancelEdit = () => {
    setEditingExamId(null);
    setTitle('');
    setClassId('c-ss2');
    setSubjectId('sub-mth');
    setDurationMinutes(15);
    setStartDate(new Date().toISOString().split('T')[0]);
    setStartTime('08:00');
    setQuestions([
      {
        id: `q-${Date.now()}-1`,
        question: 'Enter question text here...',
        options: { A: 'Option A', B: 'Option B', C: 'Option C', D: 'Option D' },
        correctOption: 'A',
        marks: 1,
      },
    ]);
  };

  const handleAddQuestionManual = () => {
    const newQ: CBTQuestion = {
      id: `q-${Date.now()}-${questions.length + 1}`,
      question: 'Enter question text here...',
      options: { A: 'Option A', B: 'Option B', C: 'Option C', D: 'Option D' },
      correctOption: 'A',
      marks: 1,
    };
    setQuestions((prev) => [...prev, newQ]);
  };

  const handleUpdateQuestion = (idx: number, updated: Partial<CBTQuestion>) => {
    setQuestions((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], ...updated };
      return copy;
    });
  };

  const handleDeleteQuestion = (idx: number) => {
    setQuestions((prev) => prev.filter((_, i) => i !== idx));
  };

  // CSV Import Parser
  const handleParseCsv = () => {
    const lines = csvText.split('\n').filter((l) => l.trim().length > 0);
    const parsed: CBTQuestion[] = [];

    lines.forEach((line, index) => {
      if (index === 0 && line.toLowerCase().includes('question')) return;
      const parts = line.split(',').map((p) => p.trim().replace(/^"|"$/g, ''));
      if (parts.length >= 6) {
        parsed.push({
          id: `imp-${Date.now()}-${index}`,
          question: parts[0],
          options: {
            A: parts[1],
            B: parts[2],
            C: parts[3],
            D: parts[4],
          },
          correctOption: (parts[5].toUpperCase() as any) || 'A',
          explanation: parts[6] || 'Imported from Excel/CSV file',
          marks: 1,
        });
      }
    });

    setImportedPreview(parsed);
  };

  const handleApplyImportedQuestions = () => {
    if (importedPreview.length > 0) {
      setQuestions(importedPreview);
      setActiveTab('create');
      alert(`Successfully loaded ${importedPreview.length} questions into Question Bank!`);
    }
  };

  const handleSaveExam = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return alert('Please enter exam title.');
    if (questions.length === 0) return alert('Please add at least 1 question.');

    const selectedSubj = subjects.find((s) => s.id === subjectId);
    const selectedCls = classes.find((c) => c.id === classId);

    const examPayload: Omit<CBTExam, 'id'> = {
      title,
      subjectId,
      subjectName: selectedSubj?.name || 'General',
      classId,
      className: selectedCls?.name || 'SS 2',
      teacherId: 'tch-102',
      durationMinutes: Number(durationMinutes),
      totalQuestions: questions.length,
      totalMarks: questions.reduce((acc, q) => acc + q.marks, 0),
      passPercentage: 50,
      startDate: startDate || new Date().toISOString().split('T')[0],
      startTime: startTime || '08:00',
      endDate: '2026-08-30',
      isPublished: true,
      shuffleQuestions,
      questions,
    };

    if (editingExamId) {
      updateCBTExam(editingExamId, examPayload);
      alert('CBT Exam and questions successfully updated!');
    } else {
      createCBTExam(examPayload);
      alert('New CBT Exam successfully created!');
    }

    handleCancelEdit();
    setActiveTab('list');
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
            onClick={() => setActiveTab('list')}
            className={`px-4 py-2 rounded-xl text-xs font-bold ${
              activeTab === 'list' ? 'bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
            }`}
          >
            Exam List ({cbtExams.length})
          </button>
          <button
            onClick={() => {
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
            onClick={() => setActiveTab('import')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 ${
              activeTab === 'import' ? 'bg-amber-500 text-slate-950' : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" /> Import Excel/CSV
          </button>
        </div>
      </div>

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
                            <span className="text-[10px] font-bold uppercase bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded">
                              {exam.subjectName} ({exam.className})
                            </span>
                            <h3 className="font-bold text-base text-slate-900 dark:text-white mt-1">
                              {exam.title}
                            </h3>
                          </div>
                        </div>
                      </div>

                      <div className="text-xs text-slate-500 space-y-1">
                        <p>Questions: <strong>{exam.totalQuestions} Items</strong> ({exam.totalMarks} Total Marks)</p>
                        <p>Duration: <strong>{exam.durationMinutes} Minutes</strong></p>
                        <p className="text-purple-600 dark:text-purple-400 font-semibold pt-1">
                          Start Date & Time: <strong>{exam.startDate} @ {exam.startTime || '08:00'}</strong>
                        </p>
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
                          className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold py-2 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all"
                        >
                          <Edit3 className="w-3.5 h-3.5" /> Edit Questions
                        </button>
                      </div>
                      <button
                        onClick={() => {
                          if (confirm(`Are you sure you want to delete CBT Exam Paper "${exam.title}"? This cannot be undone.`)) {
                            deleteCBTExam(exam.id);
                          }
                        }}
                        className="w-full bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 font-bold py-2 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all border border-red-100 dark:border-red-900/30"
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
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
              >
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Subject *</label>
              <select
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
              >
                {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">Duration (Minutes) *</label>
              <input
                type="number"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(parseInt(e.target.value) || 10)}
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
          </div>

          {/* Question Items Editor */}
          <div className="space-y-6 pt-4 border-t border-slate-200 dark:border-slate-800">
            <div className="flex justify-between items-center">
              <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                Questions Builder ({questions.length} Items)
              </h4>
              <button
                type="button"
                onClick={handleAddQuestionManual}
                className="bg-slate-900 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add Question
              </button>
            </div>

            {questions.map((q, idx) => (
              <div key={q.id || idx} className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4 text-xs">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-amber-600">Question #{idx + 1}</span>
                  <button
                    type="button"
                    onClick={() => handleDeleteQuestion(idx)}
                    className="text-red-500 font-bold hover:underline"
                  >
                    Remove
                  </button>
                </div>

                <textarea
                  rows={2}
                  value={q.question}
                  onChange={(e) => handleUpdateQuestion(idx, { question: e.target.value })}
                  className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-medium resize-y outline-none focus:ring-2 focus:ring-amber-500/20"
                  placeholder="Enter question text..."
                  spellCheck={true}
                />

                <CBTQuestionSpellingHelper
                  text={q.question}
                  onCorrect={(newText) => handleUpdateQuestion(idx, { question: newText })}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {(['A', 'B', 'C', 'D'] as const).map((opt) => (
                    <div key={opt} className="flex items-center gap-2">
                      <span className="font-bold text-slate-500">{opt}.</span>
                      <input
                        type="text"
                        value={q.options[opt]}
                        onChange={(e) =>
                          handleUpdateQuestion(idx, {
                            options: { ...q.options, [opt]: e.target.value },
                          })
                        }
                        className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                        spellCheck={true}
                      />
                    </div>
                  ))}
                </div>

                <div className="flex gap-4 items-center pt-2">
                  <div>
                    <label className="font-bold mr-2 text-slate-700 dark:text-slate-300">Correct Option:</label>
                    <select
                      value={q.correctOption}
                      onChange={(e) => handleUpdateQuestion(idx, { correctOption: e.target.value as any })}
                      className="p-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded font-bold text-amber-500"
                    >
                      <option value="A">A</option>
                      <option value="B">B</option>
                      <option value="C">C</option>
                      <option value="D">D</option>
                    </select>
                  </div>
                  <div>
                    <label className="font-bold mr-2 text-slate-700 dark:text-slate-300">Marks:</label>
                    <input
                      type="number"
                      value={q.marks}
                      onChange={(e) => handleUpdateQuestion(idx, { marks: parseInt(e.target.value) || 1 })}
                      className="w-16 p-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-center font-bold"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-3 flex-wrap">
            <button
              type="submit"
              className="flex-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold py-3.5 rounded-xl text-sm transition-colors flex items-center justify-center gap-2 shadow-lg"
            >
              <Save className="w-4 h-4" /> {editingExamId ? 'Update CBT Exam & Questions' : 'Save & Publish CBT Exam'}
            </button>
            {editingExamId && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`Are you sure you want to delete CBT Exam Paper "${title}"? This cannot be undone.`)) {
                      deleteCBTExam(editingExamId);
                      handleCancelEdit();
                      setActiveTab('list');
                    }
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
              <p className="text-xs text-slate-500">Paste raw CSV data or uploaded file rows to convert into question bank format.</p>
            </div>
          </div>

          <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs space-y-2">
            <p className="font-bold text-slate-900 dark:text-white">Expected CSV Format (1 question per line):</p>
            <code className="block p-3 bg-slate-900 text-amber-400 font-mono rounded-xl overflow-x-auto text-[11px]">
              Question Text, Option A, Option B, Option C, Option D, CorrectOption(A/B/C/D), Explanation
            </code>
            <p className="text-slate-500 italic">Example: "What is 15 + 25?", "30", "40", "50", "60", "B", "15 plus 25 equals 40."</p>
          </div>

          <textarea
            rows={6}
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            placeholder="Paste your CSV question lines here..."
            className="w-full p-4 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-2xl font-mono text-xs"
          />

          <div className="flex gap-3">
            <button
              onClick={handleParseCsv}
              className="bg-slate-900 text-white font-bold px-6 py-2.5 rounded-xl text-xs flex items-center gap-1.5"
            >
              Parse & Preview Questions
            </button>
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

            {/* Results summary stats */}
            {(() => {
              const attempts = cbtAttempts.filter((a) => a.examId === viewingResultsExam.id);
              const totalAttempts = attempts.length;
              const avgScore = totalAttempts > 0
                ? Math.round(attempts.reduce((acc, a) => acc + a.percentage, 0) / totalAttempts)
                : 0;
              const topScore = totalAttempts > 0
                ? Math.max(...attempts.map((a) => a.scoreObtained))
                : 0;

              return (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-1">
                      <span className="text-xs text-slate-500 font-bold uppercase">Total Submissions</span>
                      <p className="font-serif font-black text-2xl text-slate-900 dark:text-white flex items-center gap-2">
                        <UserCheck className="w-5 h-5 text-purple-500" /> {totalAttempts} Students
                      </p>
                    </div>
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-1">
                      <span className="text-xs text-slate-500 font-bold uppercase">Class Average</span>
                      <p className="font-serif font-black text-2xl text-amber-500 flex items-center gap-2">
                        <BarChart2 className="w-5 h-5 text-amber-500" /> {avgScore}%
                      </p>
                    </div>
                    <div className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-1">
                      <span className="text-xs text-slate-500 font-bold uppercase">Highest Score</span>
                      <p className="font-serif font-black text-2xl text-emerald-500 flex items-center gap-2">
                        <Award className="w-5 h-5 text-emerald-500" /> {topScore} / {viewingResultsExam.totalMarks}
                      </p>
                    </div>
                  </div>

                  {/* Table */}
                  {totalAttempts === 0 ? (
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
                                  onClick={() => deleteCBTAttempt(att.id)}
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
                const isCorrect = studentSelected === q.correctOption;

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
                        const isRightOption = q.correctOption === optKey;

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

    </div>
  );
};
