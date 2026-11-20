import {
  CBTExam,
  CBTQuestion,
  CBTQuestionReview,
  CBTStartResponse,
  CBTSubmissionResponse,
  Student,
} from '../types';

export type OptionSlot = 'A' | 'B' | 'C' | 'D';

export const OPTION_SLOTS: readonly OptionSlot[] = ['A', 'B', 'C', 'D'];

export const TEACHER_OPTION_A_INSTRUCTION =
  'Enter the correct answer in Option A. Enter three incorrect answers in Options B, C, and D. The system will automatically shuffle the options when students take the examination.';

export interface ShuffledOptionMapping {
  slot: OptionSlot;
  optionId: string;
  canonicalKey: OptionSlot;
  text: string;
}

export interface LocalSessionOptionMap {
  questionId: string;
  shuffledOptions: ShuffledOptionMapping[];
  correctOptionId: string;
}

const getCryptoRandomFloat = (): number => {
  const cryptoObj =
    typeof globalThis !== 'undefined' && globalThis.crypto ? globalThis.crypto : undefined;

  if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
    const arr = new Uint32Array(1);
    cryptoObj.getRandomValues(arr);
    return arr[0] / 4294967296;
  }

  return Math.random();
};

const getCryptoRandomIndex = (maxExclusive: number, randomFloat?: () => number): number => {
  if (maxExclusive <= 1) return 0;

  if (randomFloat) {
    const raw = randomFloat();
    const clamped = raw >= 1 ? 0.999999999999 : raw < 0 ? 0 : raw;
    return Math.floor(clamped * maxExclusive);
  }

  const cryptoObj =
    typeof globalThis !== 'undefined' && globalThis.crypto ? globalThis.crypto : undefined;

  if (cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
    // Rejection sampling eliminates modulo bias completely
    const range = 4294967296;
    const limit = range - (range % maxExclusive);
    const buf = new Uint32Array(1);
    let candidate = 0;
    do {
      cryptoObj.getRandomValues(buf);
      candidate = buf[0];
    } while (candidate >= limit);
    return candidate % maxExclusive;
  }

  return Math.floor(getCryptoRandomFloat() * maxExclusive);
};

/**
 * Unbiased Fisher-Yates (Knuth) shuffle.
 * Iterates from the end of the array down to index 1, swapping each element
 * with a uniformly random index in [0, i].
 */
export function shuffleArrayFisherYates<T>(
  items: readonly T[],
  randomFloat?: () => number
): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = getCryptoRandomIndex(i + 1, randomFloat);
    const temp = copy[i];
    copy[i] = copy[j];
    copy[j] = temp;
  }
  return copy;
}

export function generateOpaqueOptionId(randomFloat?: () => number): string {
  const cryptoObj =
    typeof globalThis !== 'undefined' && globalThis.crypto ? globalThis.crypto : undefined;

  if (!randomFloat && cryptoObj && typeof cryptoObj.getRandomValues === 'function') {
    const bytes = new Uint8Array(8);
    cryptoObj.getRandomValues(bytes);
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    return `opt_${hex}`;
  }

  let hex = '';
  for (let i = 0; i < 16; i++) {
    hex += Math.floor((randomFloat ? randomFloat() : Math.random()) * 16).toString(16);
  }
  return `opt_${hex}`;
}

export function createBlankOptionAQuestion(id?: string): CBTQuestion {
  return {
    id: id || `q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    question: '',
    options: { A: '', B: '', C: '', D: '' },
    correctOption: 'A',
    marks: 1,
  };
}

export function isLegacyNonOptionAQuestion(question: CBTQuestion): boolean {
  return Boolean(question.correctOption && question.correctOption !== 'A');
}

/**
 * Explicit, non-destructive helper for converting a legacy question (where correctOption
 * was B, C, or D) into the Option-A-correct entry format by swapping Option A text
 * with the current correct option's text.
 */
export function convertLegacyQuestionToOptionA(question: CBTQuestion): CBTQuestion {
  const key = question.correctOption || 'A';
  if (key === 'A') {
    return { ...question, correctOption: 'A' };
  }

  const nextOptions = { ...question.options };
  const originalA = nextOptions.A;
  nextOptions.A = nextOptions[key];
  nextOptions[key] = originalA;

  return {
    ...question,
    options: nextOptions,
    correctOption: 'A',
  };
}

export function validateExamQuestionsForSave(questions: CBTQuestion[]): string | null {
  if (!questions || questions.length === 0) {
    return 'Please add at least 1 question before saving.';
  }

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const num = i + 1;
    if (!q.question || !q.question.trim()) {
      return `Question #${num}: Please enter the question text.`;
    }
    if (!q.options?.A || !q.options.A.trim()) {
      return `Question #${num}: Option A (${
        isLegacyNonOptionAQuestion(q) ? 'Option A' : 'Correct Answer'
      }) is compulsory and cannot be empty.`;
    }
    if (!q.options?.B?.trim() || !q.options?.C?.trim() || !q.options?.D?.trim()) {
      return `Question #${num}: All four options (A, B, C, and D) must be filled in before saving.`;
    }
  }

  return null;
}

/**
 * Local/offline fallback session generator (mirrors the server-side PostgreSQL RPC).
 * Strips all answer keys, canonical markers, and explanations before returning to the student.
 */
export function buildLocalShuffledExamSession(
  exam: CBTExam,
  studentId: string,
  randomFloat?: () => number
): {
  startResponse: CBTStartResponse;
  privateOptionMap: Record<string, LocalSessionOptionMap>;
} {
  const now = Date.now();
  const sessionId = `local-${exam.id}-${studentId}-${now}`;
  const rawQuestions = Array.isArray(exam.questions) ? exam.questions : [];
  const orderedQuestions = exam.shuffleQuestions
    ? shuffleArrayFisherYates(rawQuestions, randomFloat)
    : [...rawQuestions];

  const privateOptionMap: Record<string, LocalSessionOptionMap> = {};

  const studentQuestions: CBTQuestion[] = orderedQuestions.map((q) => {
    const trueCorrectKey: OptionSlot =
      q.correctOption && OPTION_SLOTS.includes(q.correctOption) ? q.correctOption : 'A';
    const shuffledCanonicalKeys = shuffleArrayFisherYates(OPTION_SLOTS, randomFloat);

    const shuffledOptions: ShuffledOptionMapping[] = [];
    const displayOptions: Record<OptionSlot, string> = { A: '', B: '', C: '', D: '' };
    const optionIds: Record<OptionSlot, string> = { A: '', B: '', C: '', D: '' };
    let correctOptionId = '';

    OPTION_SLOTS.forEach((slot, idx) => {
      const canonicalKey = shuffledCanonicalKeys[idx];
      const optionId = generateOpaqueOptionId(randomFloat);
      const text = q.options?.[canonicalKey] ?? '';

      displayOptions[slot] = text;
      optionIds[slot] = optionId;

      if (canonicalKey === trueCorrectKey) {
        correctOptionId = optionId;
      }

      shuffledOptions.push({
        slot,
        optionId,
        canonicalKey,
        text,
      });
    });

    privateOptionMap[q.id] = {
      questionId: q.id,
      shuffledOptions,
      correctOptionId,
    };

    // Never leak correctOption, canonicalKey, or explanation to student runner
    return {
      id: q.id,
      question: q.question,
      options: displayOptions,
      optionIds,
      marks: Number(q.marks) > 0 ? Number(q.marks) : 1,
    };
  });

  return {
    startResponse: {
      sessionId,
      startedAt: new Date(now).toISOString(),
      expiresAt: new Date(now + exam.durationMinutes * 60000).toISOString(),
      remainingSeconds: exam.durationMinutes * 60,
      savedAnswers: {},
      exam: {
        ...exam,
        totalQuestions: studentQuestions.length,
        questions: studentQuestions,
      },
    },
    privateOptionMap,
  };
}

/**
 * Local/offline fallback scorer (mirrors submit_cbt_exam PostgreSQL RPC).
 * Evaluates submitted opaque optionIds against privateOptionMap & true correctOption.
 */
export function gradeLocalShuffledAttempt(
  exam: CBTExam,
  student: Pick<Student, 'id' | 'firstName' | 'lastName' | 'admissionNo'>,
  submittedAnswers: Record<string, string>,
  privateOptionMap: Record<string, LocalSessionOptionMap>,
  timeTakenSeconds: number
): CBTSubmissionResponse {
  let scoreObtained = 0;
  let totalMarks = 0;
  const canonicalAnswers: Record<string, OptionSlot> = {};
  const review: CBTQuestionReview[] = [];

  for (const q of exam.questions || []) {
    const marks = Number(q.marks) > 0 ? Number(q.marks) : 1;
    totalMarks += marks;

    const mapEntry = privateOptionMap[q.id];
    const rawSelection = submittedAnswers?.[q.id] ?? '';
    const trueCorrectKey: OptionSlot =
      q.correctOption && OPTION_SLOTS.includes(q.correctOption) ? q.correctOption : 'A';

    let selectedDisplaySlot: OptionSlot | null = null;
    let selectedCanonical: OptionSlot | null = null;
    let correctDisplaySlot: OptionSlot = trueCorrectKey;
    const displayOptions: { A: string; B: string; C: string; D: string } = {
      A: q.options.A,
      B: q.options.B,
      C: q.options.C,
      D: q.options.D,
    };

    if (mapEntry) {
      for (const item of mapEntry.shuffledOptions) {
        displayOptions[item.slot] = item.text;
        if (item.canonicalKey === trueCorrectKey) {
          correctDisplaySlot = item.slot;
        }
        if (rawSelection && item.optionId === rawSelection) {
          selectedDisplaySlot = item.slot;
          selectedCanonical = item.canonicalKey;
        }
      }
      // Fallback if display slot key was passed instead of opaque optionId
      if (!selectedDisplaySlot && OPTION_SLOTS.includes(rawSelection.toUpperCase() as OptionSlot)) {
        const slotMatch = mapEntry.shuffledOptions.find(
          (item) => item.slot === (rawSelection.toUpperCase() as OptionSlot)
        );
        if (slotMatch) {
          selectedDisplaySlot = slotMatch.slot;
          selectedCanonical = slotMatch.canonicalKey;
        }
      }
    } else if (OPTION_SLOTS.includes(rawSelection.toUpperCase() as OptionSlot)) {
      selectedDisplaySlot = rawSelection.toUpperCase() as OptionSlot;
      selectedCanonical = selectedDisplaySlot;
    }

    if (selectedCanonical) {
      canonicalAnswers[q.id] = selectedCanonical;
    }

    const isCorrect = selectedCanonical === trueCorrectKey;
    const earnedMarks = isCorrect ? marks : 0;
    scoreObtained += earnedMarks;

    review.push({
      questionId: q.id,
      question: q.question,
      options: displayOptions,
      selectedOption: selectedDisplaySlot,
      correctOption: correctDisplaySlot,
      explanation: q.explanation,
      marks,
      earnedMarks,
      isCorrect,
    });
  }

  const safeTotalMarks = totalMarks > 0 ? totalMarks : Math.max(exam.totalMarks || 1, 1);
  const percentage = Math.min(100, Math.max(0, Number(((scoreObtained / safeTotalMarks) * 100).toFixed(2))));
  const passed = percentage >= (exam.passPercentage ?? 50);

  return {
    attempt: {
      id: `attmpt-${Date.now()}`,
      examId: exam.id,
      studentId: student.id,
      studentName: `${student.firstName} ${student.lastName}`.trim(),
      admissionNo: student.admissionNo,
      scoreObtained,
      totalMarks: safeTotalMarks,
      percentage,
      passed,
      timeTakenSeconds: Math.max(1, timeTakenSeconds),
      completedAt: new Date().toISOString(),
      answers: canonicalAnswers,
    },
    review,
  };
}
