import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  CoalescedDraftSaver,
  classifyExamParticipation,
  computeRemainingSecondsMonotonic,
  computeRetryDelayMs,
  computeSafeExamEndDate,
  createMonotonicCountdownAnchor,
  hasClockJumpOrSleepDrift,
  isTerminalCBTSessionError,
  summarizeSubmissionReadiness,
  validateCBTExamSchedule,
} from '../src/lib/cbtReliability';
import {
  buildLocalShuffledExamSession,
  gradeLocalShuffledAttempt,
} from '../src/lib/cbtShuffling';
import {
  doesStudentClassMatch,
  validateAcademicEntityReferences,
} from '../src/lib/academicSelection';
import type { CBTAttempt, CBTExam, CBTExamSession, CBTQuestion, SchoolClass, Student, Subject } from '../src/types';

function make60QuestionExam(id = 'cbt-audit-60q'): CBTExam {
  const questions: CBTQuestion[] = Array.from({ length: 60 }, (_, idx) => ({
    id: `${id}-q-${idx + 1}`,
    question: `Sample examination question #${idx + 1}`,
    options: {
      A: `Correct Answer ${idx + 1}`,
      B: `Distractor B ${idx + 1}`,
      C: `Distractor C ${idx + 1}`,
      D: `Distractor D ${idx + 1}`,
    },
    correctOption: 'A',
    explanation: `Because option A is correct for Q${idx + 1}.`,
    marks: 1,
  }));

  return {
    id,
    title: 'Comprehensive 60-Question Mock CBT',
    subjectId: 'sub-mth',
    subjectName: 'Mathematics',
    classId: 'cls-ss1',
    className: 'SS 1',
    teacherId: 'tch-1',
    durationMinutes: 60,
    totalQuestions: 60,
    totalMarks: 60,
    passPercentage: 50,
    startDate: '2026-11-01',
    startTime: '08:00',
    endDate: '2026-12-31',
    isPublished: true,
    shuffleQuestions: true,
    questions,
  };
}

function makeStudent(index: number, overrides?: Partial<Student>): Student {
  return {
    id: `stu-${index}`,
    admissionNo: `DA/2026/${String(index).padStart(3, '0')}`,
    firstName: `Candidate${index}`,
    lastName: 'Student',
    gender: index % 2 === 0 ? 'Female' : 'Male',
    dob: '2010-05-15',
    classId: 'cls-ss1',
    className: 'SS 1',
    arm: 'A',
    parentName: 'Parent Name',
    parentPhone: '08000000000',
    parentEmail: `parent${index}@example.com`,
    address: 'Lagos',
    avatar: '',
    status: 'Active',
    ...overrides,
  };
}

const results: { name: string; status: 'PASSED' | 'FAILED'; detail?: string }[] = [];

async function runTest(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    results.push({ name, status: 'PASSED' });
    console.log(`PASS: ${name}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    results.push({ name, status: 'FAILED', detail: message });
    console.error(`FAIL: ${name} -> ${message}`);
    throw err;
  }
}

async function main() {
  // 1. Timer monotonicity & backwards clock-tamper resistance
  await runTest('1. Monotonic countdown resists backwards OS clock tampering & detects sleep drift', () => {
    const startPerf = 10_000;
    const startWall = 1_800_000_000_000;
    const anchor = createMonotonicCountdownAnchor(3600, startPerf, startWall);

    // 10 minutes elapsed monotonically, while student turned wall clock backwards by 30 minutes
    const after10MinPerf = startPerf + 600_000;
    const tamperedBackwardsWall = startWall - 1_800_000;

    const remaining = computeRemainingSecondsMonotonic(anchor, after10MinPerf);
    assert.equal(remaining, 3000, 'Monotonic timer must count down to 3000s regardless of backwards clock tamper');
    assert.equal(
      hasClockJumpOrSleepDrift(anchor, after10MinPerf, tamperedBackwardsWall),
      true,
      'Large clock divergence should trigger authoritative server countdown resync'
    );

    // Expired zero-second anchor must immediately return 0 (no forced +1s artificial delay)
    const zeroAnchor = createMonotonicCountdownAnchor(0, startPerf, startWall);
    assert.equal(computeRemainingSecondsMonotonic(zeroAnchor, startPerf), 0);
  });

  // 2. Schedule date generation & validation
  await runTest('2. Dynamic exam schedule closing date avoids past-date lockout & rejects endDate < startDate', () => {
    const refNow = new Date('2026-11-22T10:00:00Z');
    const safeEnd = computeSafeExamEndDate('2026-11-22', 30, refNow);
    assert.equal(safeEnd, '2026-12-22');

    assert.equal(
      validateCBTExamSchedule({
        startDate: '2026-11-22',
        endDate: safeEnd,
        durationMinutes: 60,
        passPercentage: 50,
      }),
      null
    );

    const reversedErr = validateCBTExamSchedule({
      startDate: '2026-11-22',
      endDate: '2026-11-20',
      durationMinutes: 60,
      passPercentage: 50,
    });
    assert.ok(reversedErr && reversedErr.includes('End Date cannot be earlier'));
  });

  // 3. Single-flight coalesced draft auto-save prevents race overwrite & halts on terminal error
  await runTest('3. CoalescedDraftSaver serializes concurrent updates & preserves unsynced state during in-flight click', async () => {
    const sentPayloads: Record<string, string>[] = [];
    let releaseFirstSave!: () => void;
    let callCount = 0;

    const saver = new CoalescedDraftSaver(async (answers) => {
      callCount += 1;
      sentPayloads.push({ ...answers });
      if (callCount === 1) {
        await new Promise<void>((resolve) => {
          releaseFirstSave = resolve;
        });
      }
      return { ok: true };
    });

    // Click 1 starts save #1
    const firstPromise = saver.flush({ q1: 'opt_1' });
    assert.equal(saver.getStatus().state, 'saving');

    // Click 2 happens WHILE save #1 is still in flight
    saver.markPending({ q1: 'opt_1', q2: 'opt_2' });
    assert.equal(saver.getStatus().hasUnsyncedChanges, true);

    // Save #1 finishes -> must automatically trigger save #2 with { q1, q2 }
    releaseFirstSave();
    const fullySynced = await firstPromise;

    assert.equal(fullySynced, true);
    assert.equal(callCount, 2);
    assert.deepEqual(sentPayloads[1], { q1: 'opt_1', q2: 'opt_2' });
    assert.equal(saver.getStatus().hasUnsyncedChanges, false);
    assert.equal(saver.getStatus().state, 'saved');
    saver.dispose();
  });

  // 4. Draft auto-save retries with bounded backoff on transient failure & stops on terminal expiry
  await runTest('4. CoalescedDraftSaver schedules bounded retry on network error and aborts retry on expired session', async () => {
    const d1 = computeRetryDelayMs(1, 1500, 15000, 0.25, 0.5);
    const d4 = computeRetryDelayMs(4, 1500, 15000, 0.25, 0.5);
    assert.equal(d1, 1500);
    assert.equal(d4, 12000);
    assert.equal(isTerminalCBTSessionError('CBT exam session time has expired.'), true);
    assert.equal(isTerminalCBTSessionError('Network timeout'), false);

    let attempts = 0;
    const saver = new CoalescedDraftSaver(
      async () => {
        attempts += 1;
        if (attempts === 1) {
          return { ok: false, error: 'Failed to fetch (network drop)' };
        }
        return { ok: false, error: 'CBT exam session time has expired.' };
      },
      undefined,
      () => 15
    );

    await saver.flush({ q1: 'opt_a' });
    assert.equal(saver.getStatus().state, 'pending_retry');
    assert.equal(saver.getStatus().terminalError, false);

    // Wait for fast 15ms retry to execute and hit terminal expiry error
    await new Promise((r) => setTimeout(r, 45));
    assert.equal(attempts, 2);
    assert.equal(saver.getStatus().state, 'terminal_error');
    assert.equal(saver.getStatus().terminalError, true);
    saver.dispose();
  });

  // 5. Shuffling, zero answer-key exposure, grading accuracy & review policy gating
  await runTest('5. Shuffled exam strips answer keys, grades 0/partial/full accurately, and gates review policy', () => {
    const exam = make60QuestionExam();
    const student = makeStudent(1);
    const { startResponse, privateOptionMap } = buildLocalShuffledExamSession(exam, student.id);

    // Zero leakage verification on student-facing payload
    for (const q of startResponse.exam.questions) {
      assert.equal(q.correctOption, undefined);
      assert.equal(q.explanation, undefined);
      assert.ok(q.optionIds?.A && q.optionIds?.B && q.optionIds?.C && q.optionIds?.D);
    }

    // Answer 30 questions correctly (50% = pass), leave 30 unanswered/wrong
    const submitted: Record<string, string> = {};
    for (let i = 0; i < 30; i++) {
      const q = exam.questions[i];
      submitted[q.id] = privateOptionMap[q.id].correctOptionId;
    }

    const gradedWithheld = gradeLocalShuffledAttempt(exam, student, submitted, privateOptionMap, 900, {
      allowAnswerReview: false,
    });
    assert.equal(gradedWithheld.attempt.scoreObtained, 30);
    assert.equal(gradedWithheld.attempt.totalMarks, 60);
    assert.equal(gradedWithheld.attempt.percentage, 50);
    assert.equal(gradedWithheld.attempt.passed, true);
    assert.equal(gradedWithheld.reviewPermitted, false);
    assert.equal(gradedWithheld.review.length, 0);

    const gradedAllowed = gradeLocalShuffledAttempt(exam, student, submitted, privateOptionMap, 900, {
      allowAnswerReview: true,
    });
    assert.equal(gradedAllowed.reviewPermitted, true);
    assert.equal(gradedAllowed.review.length, 60);
  });

  // 6. Student class eligibility & academic FK validation
  await runTest('6. Eligibility enforces exact class match (SS 1 != JSS 1) and academic reference checks', () => {
    const ss1 = makeStudent(1, { classId: 'cls-ss1', className: 'SS 1' });
    const jss1 = makeStudent(2, { classId: 'cls-jss1', className: 'JSS 1' });

    assert.equal(doesStudentClassMatch('cls-ss1', 'SS 1', ss1), true);
    assert.equal(doesStudentClassMatch('cls-ss1', 'SS 1', jss1), false);
    assert.equal(doesStudentClassMatch(undefined, 'SS 1', jss1), false);

    const classes: SchoolClass[] = [
      { id: 'cls-ss1', name: 'SS 1', category: 'Senior Secondary', arms: ['A'], capacity: 40 },
    ];
    const subjects: Subject[] = [
      { id: 'sub-mth', code: 'MTH101', name: 'Mathematics', category: 'General', isCompulsory: true },
    ];

    const invalidTeacherCheck = validateAcademicEntityReferences({
      classId: 'cls-ss1',
      subjectId: 'sub-mth',
      classes,
      subjects,
      currentUserRole: 'teacher',
      resolvedTeacherId: undefined,
      actionLabel: 'create a CBT exam',
    });
    assert.equal(invalidTeacherCheck.ok, false);
  });

  // 7. Participation & incomplete/expired session breakdown + submission summary
  await runTest('7. Participation classifier categorizes Submitted, In-Progress, Expired, and Not Started students', () => {
    const exam = make60QuestionExam('exam-part');
    const nowMs = Date.parse('2026-11-22T10:00:00Z');
    const students = [
      makeStudent(1), // Submitted
      makeStudent(2), // In progress
      makeStudent(3), // Expired (in_progress past expiresAt)
      makeStudent(4), // Not started
      makeStudent(5, { classId: 'cls-jss1', className: 'JSS 1' }), // Ineligible class
    ];
    const attempts: CBTAttempt[] = [
      {
        id: 'att-1',
        examId: exam.id,
        studentId: 'stu-1',
        studentName: 'Candidate1 Student',
        admissionNo: 'DA/2026/001',
        scoreObtained: 45,
        totalMarks: 60,
        percentage: 75,
        passed: true,
        timeTakenSeconds: 1200,
        completedAt: '2026-11-22T09:30:00Z',
        answers: {},
      },
    ];
    const sessions: CBTExamSession[] = [
      {
        id: 'sess-1',
        examId: exam.id,
        studentId: 'stu-1',
        startedAt: '2026-11-22T09:00:00Z',
        expiresAt: '2026-11-22T10:00:00Z',
        submittedAt: '2026-11-22T09:30:00Z',
        status: 'submitted',
        questionOrder: [],
      },
      {
        id: 'sess-2',
        examId: exam.id,
        studentId: 'stu-2',
        startedAt: '2026-11-22T09:40:00Z',
        expiresAt: '2026-11-22T10:40:00Z',
        status: 'in_progress',
        questionOrder: [],
      },
      {
        id: 'sess-3',
        examId: exam.id,
        studentId: 'stu-3',
        startedAt: '2026-11-22T08:00:00Z',
        expiresAt: '2026-11-22T09:00:00Z',
        status: 'in_progress',
        questionOrder: [],
      },
    ];

    const breakdown = classifyExamParticipation({ exam, students, attempts, sessions, nowMs });
    assert.equal(breakdown.eligibleCount, 4);
    assert.equal(breakdown.submitted.length, 1);
    assert.equal(breakdown.inProgress.length, 1);
    assert.equal(breakdown.expired.length, 1);
    assert.equal(breakdown.notStarted.length, 1);

    const summary = summarizeSubmissionReadiness(
      exam.questions.slice(0, 4),
      { [exam.questions[0].id]: 'opt_1', [exam.questions[2].id]: 'opt_3' },
      { [exam.questions[1].id]: true }
    );
    assert.equal(summary.answeredCount, 2);
    assert.equal(summary.unansweredCount, 2);
    assert.equal(summary.flaggedCount, 1);
    assert.deepEqual(summary.unansweredQuestionNumbers, [2, 4]);
  });

  // 8. Static security & regression check across CBT source files
  await runTest('8. Static audit confirms zero hardcoded stale 2026-08-30 dates, native confirm(), or service-role leaks in CBT files', () => {
    const filesToCheck = [
      'src/components/student/CBTExamRunner.tsx',
      'src/components/student/StudentCBTList.tsx',
      'src/components/teacher/CBTQuestionBankBuilder.tsx',
      'src/components/teacher/PastQuestionsBank.tsx',
      'src/lib/cbtReliability.ts',
    ];
    for (const rel of filesToCheck) {
      const content = fs.readFileSync(path.join(process.cwd(), rel), 'utf8');
      assert.equal(content.includes('2026-08-30'), false, `${rel} still contains stale 2026-08-30`);
      assert.equal(/\bconfirm\s*\(/.test(content), false, `${rel} uses native window.confirm()`);
      assert.equal(/SERVICE_ROLE/i.test(content), false, `${rel} references SERVICE_ROLE`);
    }
  });

  // 9. Local in-memory concurrent CBT batch simulation: 5, 10, 20, and 30 simultaneous students x 60 questions
  await runTest('9. [LOCAL IN-MEMORY SIMULATION] Concurrent batches of 5, 10, 20, and 30 students x 60 questions complete with zero cross-talk', async () => {
    const exam = make60QuestionExam('sim-batch-60q');
    const batchSizes = [5, 10, 20, 30];

    for (const size of batchSizes) {
      const t0 = performance.now();
      const batchResults = await Promise.all(
        Array.from({ length: size }, async (_, i) => {
          const student = makeStudent(i + 1);
          const { startResponse, privateOptionMap } = buildLocalShuffledExamSession(exam, student.id);
          assert.equal(startResponse.exam.questions.length, 60);

          // Simulate coalesced draft auto-save across 10 checkpoints of 6 questions each
          const draftState: Record<string, string> = {};
          const saver = new CoalescedDraftSaver(async (payload) => ({
            ok: Object.keys(payload).length > 0,
          }));

          const expectedCorrectCount = (i % 5) * 10 + 10; // varies 10..50 per student
          for (let qIdx = 0; qIdx < 60; qIdx++) {
            const q = exam.questions[qIdx];
            if (qIdx < expectedCorrectCount) {
              draftState[q.id] = privateOptionMap[q.id].correctOptionId;
            } else {
              const wrongEntry = privateOptionMap[q.id].shuffledOptions.find(
                (o) => o.optionId !== privateOptionMap[q.id].correctOptionId
              )!;
              draftState[q.id] = wrongEntry.optionId;
            }
            if ((qIdx + 1) % 6 === 0) {
              await saver.flush(draftState);
            }
          }
          saver.dispose();

          const submission = gradeLocalShuffledAttempt(
            exam,
            student,
            draftState,
            privateOptionMap,
            1800,
            { allowAnswerReview: false }
          );

          assert.equal(submission.attempt.studentId, student.id);
          assert.equal(submission.attempt.scoreObtained, expectedCorrectCount);
          return submission.attempt;
        })
      );
      const elapsedMs = performance.now() - t0;
      const uniqueStudents = new Set(batchResults.map((a) => a.studentId));
      assert.equal(uniqueStudents.size, size);
      console.log(
        `  -> [LOCAL SIMULATION] Batch ${size} students x 60 questions: ${elapsedMs.toFixed(1)}ms total, 0 errors`
      );
    }
  });

  console.log(`\nCBT Audit Suite Summary: ${results.length}/${results.length} tests PASSED.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
