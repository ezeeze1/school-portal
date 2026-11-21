import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  OPTION_SLOTS,
  TEACHER_OPTION_A_INSTRUCTION,
  buildLocalShuffledExamSession,
  convertLegacyQuestionToOptionA,
  createBlankOptionAQuestion,
  gradeLocalShuffledAttempt,
  isLegacyNonOptionAQuestion,
  shuffleArrayFisherYates,
  validateExamQuestionsForSave,
} from '../src/lib/cbtShuffling';
import { CBTExam, CBTQuestion, Student } from '../src/types';

function runTests() {
  let passedCount = 0;
  const test = (name: string, fn: () => void) => {
    fn();
    passedCount += 1;
    console.log(`PASS: ${name}`);
  };

  // 1. Option A Creation & Validation
  test('New question template enforces Option A as correct answer and validates compulsory fields', () => {
    const q = createBlankOptionAQuestion('q-new-1');
    assert.equal(q.correctOption, 'A');
    assert.equal(isLegacyNonOptionAQuestion(q), false);
    assert.ok(validateExamQuestionsForSave([q])?.includes('question text'));

    q.question = 'What is the capital of Nigeria?';
    assert.ok(validateExamQuestionsForSave([q])?.includes('Option A'));

    q.options.A = 'Abuja';
    assert.ok(validateExamQuestionsForSave([q])?.includes('All four options'));

    q.options.B = 'Lagos';
    q.options.C = 'Kano';
    q.options.D = 'Ibadan';
    assert.equal(validateExamQuestionsForSave([q]), null);
    assert.equal(
      TEACHER_OPTION_A_INSTRUCTION,
      'Enter the correct answer in Option A. Enter three incorrect answers in Options B, C, and D. The system will automatically shuffle the options when students take the examination.'
    );
  });

  // 2. Fisher-Yates Distribution Fairness & Permutation Integrity
  test('Fisher-Yates shuffle preserves all 4 elements without loss and distributes evenly across A, B, C, D', () => {
    const counts: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 };
    const trials = 2000;

    for (let i = 0; i < trials; i++) {
      const shuffled = shuffleArrayFisherYates(OPTION_SLOTS);
      assert.equal(shuffled.length, 4);
      assert.deepEqual([...shuffled].sort(), ['A', 'B', 'C', 'D']);
      const aIndex = shuffled.indexOf('A');
      assert.ok(aIndex >= 0 && aIndex < 4);
      counts[OPTION_SLOTS[aIndex]] += 1;
    }

    for (const slot of OPTION_SLOTS) {
      const ratio = counts[slot] / trials;
      assert.ok(
        ratio > 0.2 && ratio < 0.3,
        `Expected slot ${slot} ratio near 0.25, got ${ratio.toFixed(4)}`
      );
    }
  });

  // 3. Student Payload Security (No Answer Key Leakage)
  test('Student session payload strips correctOption, canonicalKey, isCorrect, and explanation', () => {
    const exam: CBTExam = {
      id: 'exam-sec-1',
      title: 'Security Check Exam',
      subjectId: 'sub-phy',
      subjectName: 'Physics',
      classId: 'c-ss2',
      className: 'SS 2',
      durationMinutes: 60,
      totalQuestions: 1,
      totalMarks: 2,
      passPercentage: 50,
      startDate: '2026-07-01',
      endDate: '2026-12-31',
      isPublished: true,
      shuffleQuestions: false,
      questions: [
        {
          id: 'q-sec',
          question: 'What is the SI unit of Force?',
          options: { A: 'Newton', B: 'Joule', C: 'Watt', D: 'Pascal' },
          correctOption: 'A',
          explanation: 'Force is measured in Newtons (N).',
          marks: 2,
        },
      ],
    };

    const { startResponse } = buildLocalShuffledExamSession(exam, 'std-001');
    const qOut = startResponse.exam.questions[0];
    const serialized = JSON.stringify(startResponse);

    assert.equal('correctOption' in qOut, false);
    assert.equal('explanation' in qOut, false);
    assert.equal(serialized.includes('correctOption'), false);
    assert.equal(serialized.includes('canonicalKey'), false);
    assert.equal(serialized.includes('isCorrect'), false);
    assert.equal(serialized.includes('Newtons (N)'), false);
    assert.ok(qOut.optionIds);
    for (const slot of OPTION_SLOTS) {
      assert.ok(qOut.optionIds![slot].startsWith('opt_'));
    }
  });

  // 4. Opaque ID Marking Across All 4 Shuffled Positions
  test('Server-equivalent grading awards full marks for correct opaque optionId regardless of shuffled display slot', () => {
    const student: Student = {
      id: 'std-100',
      admissionNo: 'DA/2026/100',
      firstName: 'Ada',
      lastName: 'Okafor',
      gender: 'Female',
      dob: '2010-03-14',
      classId: 'c-ss2',
      className: 'SS 2',
      arm: 'A',
      parentName: 'Mr Okafor',
      parentPhone: '08000000000',
      address: 'Lagos',
      avatar: '',
      status: 'Active',
    };

    const exam: CBTExam = {
      id: 'exam-mark-1',
      title: 'Marking Accuracy Exam',
      subjectId: 'sub-mth',
      subjectName: 'Mathematics',
      classId: 'c-ss2',
      className: 'SS 2',
      durationMinutes: 60,
      totalQuestions: 2,
      totalMarks: 5,
      passPercentage: 50,
      startDate: '2026-07-01',
      endDate: '2026-12-31',
      isPublished: true,
      shuffleQuestions: false,
      questions: [
        {
          id: 'q-opt-a',
          question: '2 + 2 = ?',
          options: { A: '4', B: '3', C: '5', D: '6' },
          correctOption: 'A',
          marks: 2,
        },
        {
          id: 'q-legacy-c',
          question: '3 x 3 = ?',
          options: { A: '6', B: '12', C: '9', D: '3' },
          correctOption: 'C',
          marks: 3,
        },
      ],
    };

    const { startResponse, privateOptionMap } = buildLocalShuffledExamSession(exam, student.id);
    const q1 = startResponse.exam.questions[0];
    const q2 = startResponse.exam.questions[1];

    const slotFor4 = OPTION_SLOTS.find((s) => q1.options[s] === '4')!;
    const wrongSlotQ2 = OPTION_SLOTS.find((s) => q2.options[s] === '12')!;

    // Default fail-closed review policy omits answer keys & explanations
    const resLocked = gradeLocalShuffledAttempt(
      exam,
      student,
      {
        'q-opt-a': q1.optionIds![slotFor4],
        'q-legacy-c': q2.optionIds![wrongSlotQ2],
      },
      privateOptionMap,
      120
    );

    assert.equal(resLocked.attempt.scoreObtained, 2);
    assert.equal(resLocked.attempt.totalMarks, 5);
    assert.equal(resLocked.attempt.percentage, 40);
    assert.equal(resLocked.attempt.passed, false);
    assert.deepEqual(resLocked.attempt.answers, {
      'q-opt-a': 'A',
      'q-legacy-c': 'B',
    });
    assert.equal(resLocked.reviewPermitted, false);
    assert.equal(resLocked.review.length, 0);
    assert.ok(resLocked.reviewPolicyMessage);

    // When policy permits review, shuffled display slots & marks are returned
    const resPermitted = gradeLocalShuffledAttempt(
      exam,
      student,
      {
        'q-opt-a': q1.optionIds![slotFor4],
        'q-legacy-c': q2.optionIds![wrongSlotQ2],
      },
      privateOptionMap,
      120,
      { allowAnswerReview: true }
    );
    assert.equal(resPermitted.reviewPermitted, true);
    assert.equal(resPermitted.review[0].isCorrect, true);
    assert.equal(resPermitted.review[0].selectedOption, slotFor4);
    assert.equal(resPermitted.review[0].correctOption, slotFor4);
    assert.equal(resPermitted.review[1].isCorrect, false);
    assert.equal(resPermitted.review[1].selectedOption, wrongSlotQ2);

    // Fail-closed: missing option map rejects marking
    assert.throws(
      () => gradeLocalShuffledAttempt(exam, student, {}, {}, 120),
      /missing or incomplete/i
    );

    // Raw display slot ('A') must not match opaque optionIds
    const resTamperedSlot = gradeLocalShuffledAttempt(
      exam,
      student,
      {
        'q-opt-a': 'A',
        'q-legacy-c': 'C',
      },
      privateOptionMap,
      120
    );
    assert.equal(resTamperedSlot.attempt.scoreObtained, 0);
  });

  // 5. Safe Legacy Question Conversion
  test('convertLegacyQuestionToOptionA swaps texts cleanly without data loss', () => {
    const legacy: CBTQuestion = {
      id: 'leg-1',
      question: 'Chemical symbol for Gold?',
      options: { A: 'Ag', B: 'Fe', C: 'Au', D: 'Cu' },
      correctOption: 'C',
      marks: 1,
    };
    assert.equal(isLegacyNonOptionAQuestion(legacy), true);

    const converted = convertLegacyQuestionToOptionA(legacy);
    assert.equal(converted.correctOption, 'A');
    assert.equal(converted.options.A, 'Au');
    assert.equal(converted.options.C, 'Ag');
    assert.equal(converted.options.B, 'Fe');
    assert.equal(converted.options.D, 'Cu');
  });

  // 6. Scale Test: 30 Concurrent Students x 60 Questions
  test('30 concurrent students x 60 questions generate independent sessions and grade accurately', () => {
    const questions60: CBTQuestion[] = Array.from({ length: 60 }, (_, idx) => ({
      id: `q-${idx + 1}`,
      question: `Sample Question ${idx + 1}`,
      options: {
        A: `Correct Answer ${idx + 1}`,
        B: `Wrong B ${idx + 1}`,
        C: `Wrong C ${idx + 1}`,
        D: `Wrong D ${idx + 1}`,
      },
      correctOption: 'A',
      marks: 1,
    }));

    const exam60: CBTExam = {
      id: 'exam-60q',
      title: 'Term Final 60Q Exam',
      subjectId: 'sub-mth',
      subjectName: 'Mathematics',
      classId: 'c-ss3',
      className: 'SS 3',
      durationMinutes: 60,
      totalQuestions: 60,
      totalMarks: 60,
      passPercentage: 50,
      startDate: '2026-07-01',
      endDate: '2026-12-31',
      isPublished: true,
      shuffleQuestions: true,
      questions: questions60,
    };

    const t0 = performance.now();
    const firstQuestionSlotsSeen = new Set<string>();

    for (let s = 1; s <= 30; s++) {
      const student: Student = {
        id: `std-${s}`,
        admissionNo: `DA/2026/${s}`,
        firstName: 'Student',
        lastName: `${s}`,
        gender: 'Male',
        dob: '2009-01-01',
        classId: 'c-ss3',
        className: 'SS 3',
        arm: 'A',
        parentName: 'Parent',
        parentPhone: '08000000000',
        address: 'Lagos',
        avatar: '',
        status: 'Active',
      };

      const { startResponse, privateOptionMap } = buildLocalShuffledExamSession(
        exam60,
        student.id
      );
      assert.equal(startResponse.exam.questions.length, 60);

      const q1 = startResponse.exam.questions.find((q) => q.id === 'q-1')!;
      const q1CorrectSlot = OPTION_SLOTS.find(
        (slot) => q1.options[slot] === 'Correct Answer 1'
      )!;
      firstQuestionSlotsSeen.add(q1CorrectSlot);

      const answers: Record<string, string> = {};
      for (const q of startResponse.exam.questions) {
        const correctSlot = OPTION_SLOTS.find((slot) =>
          q.options[slot].startsWith('Correct Answer ')
        )!;
        answers[q.id] = q.optionIds![correctSlot];
      }

      const graded = gradeLocalShuffledAttempt(
        exam60,
        student,
        answers,
        privateOptionMap,
        1800
      );
      assert.equal(graded.attempt.scoreObtained, 60);
      assert.equal(graded.attempt.percentage, 100);
    }

    const elapsedMs = performance.now() - t0;
    assert.ok(
      firstQuestionSlotsSeen.size >= 3,
      'Across 30 students, correct answer should appear in multiple shuffled slots'
    );
    assert.ok(elapsedMs < 2000, `Expected 30x60 benchmark < 2000ms, got ${elapsedMs.toFixed(1)}ms`);
  });

  // 7. Static SQL Migration vs TypeScript RPC Contract & Hardening Verification
  test('SQL migration enforces fail-closed grading, review policy, portable RNG, FKs/CHECKs, and matching RPC contracts', () => {
    const sqlPath = path.resolve(
      process.cwd(),
      'supabase/migrations/20260503_cbt_option_shuffling.sql'
    );
    const servicePath = path.resolve(
      process.cwd(),
      'src/services/supabaseSchoolService.ts'
    );
    const sql = fs.readFileSync(sqlPath, 'utf8');
    const service = fs.readFileSync(servicePath, 'utf8');

    // Every SECURITY DEFINER declaration in migration must use SET search_path = ''
    const secDefCount = (sql.match(/^\s*SECURITY DEFINER\b/gm) || []).length;
    const searchPathCount = (sql.match(/^\s*SET search_path = ''\s*$/gm) || []).length;
    assert.equal(secDefCount, 6);
    assert.equal(searchPathCount, 6);

    // Private option map table must have RLS enabled, FKs, CHECKs, updated_at trigger & zero student privileges
    assert.ok(
      sql.includes('ALTER TABLE public.cbt_exam_session_options ENABLE ROW LEVEL SECURITY;')
    );
    assert.ok(
      sql.includes('REVOKE ALL ON TABLE public.cbt_exam_session_options FROM PUBLIC, anon, authenticated;')
    );
    assert.ok(sql.includes('fk_cbt_exam_session_options_exam'));
    assert.ok(sql.includes('fk_cbt_exam_session_options_student'));
    assert.ok(sql.includes('chk_cbt_exam_session_options_valid'));
    assert.ok(sql.includes('chk_cbt_exam_sessions_draft_answers_object'));
    assert.ok(sql.includes('trg_cbt_exam_session_options_updated_at'));

    // Helper functions must remain restricted to service_role (never executable by anon/authenticated)
    assert.ok(
      sql.includes('REVOKE ALL ON FUNCTION public.cbt_fisher_yates_shuffle_keys() FROM PUBLIC, anon, authenticated;')
    );
    assert.ok(
      sql.includes('REVOKE ALL ON FUNCTION public.cbt_ensure_session_shuffled_options(text, text, text) FROM PUBLIC, anon, authenticated;')
    );

    // Portable bytea CSPRNG RNG (must NOT use invalid 'x' || ...::bit(32) cast)
    assert.equal(sql.includes('::bit(32)'), false);
    assert.ok(sql.includes('pg_catalog.decode('));
    assert.ok(sql.includes('pg_catalog.get_byte('));

    // Fail-closed grading: zero LEFT JOIN to cbt_exam_session_options and zero raw slot fallback
    assert.equal(/LEFT\s+JOIN\s+public\.cbt_exam_session_options/i.test(sql), false);
    assert.equal(sql.includes("opt->>'slot' ="), false);
    assert.ok(sql.includes('Session option mapping is missing or incomplete'));

    // Review policy columns and fail-closed default
    assert.ok(sql.includes('cbt_allow_answer_review boolean NOT NULL DEFAULT false'));
    assert.ok(sql.includes('allow_answer_review boolean'));
    assert.ok(sql.includes('v_review_permitted'));
    assert.ok(sql.includes('reviewPermitted'));

    // RPC names & argument names match service calls
    for (const rpc of [
      'start_cbt_exam',
      'save_cbt_exam_answers',
      'submit_cbt_exam',
      'get_cbt_active_session_exam_ids',
    ]) {
      assert.ok(sql.includes(`public.${rpc}(`), `Missing RPC ${rpc} in SQL`);
      assert.ok(service.includes(`'${rpc}'`), `Missing RPC ${rpc} in service`);
    }
    assert.ok(sql.includes('p_exam_id text'));
    assert.ok(sql.includes('p_answers jsonb'));
    assert.ok(service.includes('p_exam_id: examId'));
    assert.ok(service.includes('p_answers: answers'));
  });

  // 8. Read-Only Preflight SQL Safety Verification
  test('Preflight SQL script is strictly read-only and uses pg_temp functions only', () => {
    const preflightPath = path.resolve(
      process.cwd(),
      'supabase/migrations/20260503_cbt_option_shuffling_preflight.sql'
    );
    const preflight = fs.readFileSync(preflightPath, 'utf8');

    assert.ok(preflight.includes('pg_temp.run_cbt_shuffling_preflight'));
    assert.equal(/CREATE\s+(?:OR\s+REPLACE\s+)?(?:TABLE|VIEW|TRIGGER|FUNCTION\s+public\.)/i.test(preflight), false);
    assert.equal(/\b(?:INSERT\s+INTO|UPDATE\s+public\.|DELETE\s+FROM|ALTER\s+TABLE|DROP\s+TABLE|TRUNCATE)\b/i.test(preflight), false);
  });

  // 9. Standalone Single-Statement Read-Only Verification Query Safety & Coverage
  test('Standalone verification SQL is a single WITH...SELECT statement with zero DDL/DML and all 7 check sections', () => {
    const verifyPath = path.resolve(
      process.cwd(),
      'supabase/migrations/20260503_cbt_option_shuffling_verify.sql'
    );
    const verifySql = fs.readFileSync(verifyPath, 'utf8');

    // Strip SQL comments and single-quoted string literals before structural & keyword checks
    const strippedComments = verifySql.replace(/--.*$/gm, '').trim();
    const strippedTokens = strippedComments.replace(/'(?:''|[^'])*'/g, "''").trim();
    assert.ok(strippedTokens.startsWith('WITH'), 'Verification SQL must start with WITH CTE');
    assert.ok(strippedTokens.endsWith(';'), 'Verification SQL must end with a single semicolon');

    const semicolons = strippedTokens.match(/;/g) || [];
    assert.equal(semicolons.length, 1, 'Verification SQL must contain exactly one top-level SQL statement');
    // Zero DDL, DML, DO blocks, XML queries, pg_catalog.substring(... FROM ...), or pg_temp creation
    assert.equal(/\b(?:CREATE|ALTER|DROP|INSERT|UPDATE|DELETE|TRUNCATE|GRANT|REVOKE)\b/i.test(strippedTokens), false);
    assert.equal(/\bDO\s+\$\$/i.test(strippedTokens), false);
    assert.equal(/\bpg_temp\b/i.test(strippedTokens), false);
    assert.equal(/\bquery_to_xml\b/i.test(verifySql), false);
    assert.equal(/pg_catalog\.substring\s*\([^;]*\bFROM\b/i.test(verifySql), false);

    // Must cover summary + all 7 required diagnostic categories and exact schema.sql param names
    for (const category of [
      '00_SUMMARY',
      '01_REQUIRED_TABLES',
      '02_REQUIRED_COLUMNS',
      '03_RPC_SIGNATURES',
      '04_TRIGGERS_AND_HELPERS',
      '05_RLS_POLICIES',
      '06_CONFLICTING_OBJECTS',
      '07_DATA_INTEGRITY',
    ]) {
      assert.ok(verifySql.includes(`'${category}'`), `Missing category ${category}`);
    }
    assert.ok(verifySql.includes("('is_student_owner', 'target_student_id text', 'boolean')"));
    assert.ok(verifySql.includes("('student_in_class', 'target_class_id text', 'boolean')"));
    assert.ok(verifySql.includes("has_table_privilege('anon'::name, om.tbl_oid"));
  });

  // 10. Post-Migration Frontend Integration Regressions (Timer, Expiry, Refresh Resume, Teacher Script)
  test('Frontend CBT components enforce zero-second timer accuracy, expired session detection, refresh resume, and default A script grading', () => {
    const runnerSrc = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/student/CBTExamRunner.tsx'),
      'utf8'
    );
    const listSrc = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/student/StudentCBTList.tsx'),
      'utf8'
    );
    const layoutSrc = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/student/StudentPortalLayout.tsx'),
      'utf8'
    );
    const builderSrc = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/teacher/CBTQuestionBankBuilder.tsx'),
      'utf8'
    );

    // Timer must NOT use falsy || fallback when session.remainingSeconds === 0
    assert.equal(runnerSrc.includes('session.remainingSeconds || exam.durationMinutes * 60'), false);
    assert.ok(runnerSrc.includes("typeof session.remainingSeconds === 'number'"));

    // StudentCBTList must treat in_progress with remainingSeconds <= 0 as expired, key runner by sessionId, and support sessionStorage auto-resume
    assert.ok(listSrc.includes('exam.remainingSeconds <= 0'));
    assert.ok(listSrc.includes('key={activeSession.sessionId}'));
    assert.ok(listSrc.includes('cbt_active_exam_'));

    // StudentPortalLayout must restore CBT tab on refresh if active exam marker exists
    assert.ok(layoutSrc.includes('cbt_active_exam_'));

    // Teacher script review modal must normalize missing correctOption to canonical 'A'
    assert.ok(builderSrc.includes("const effectiveCorrectOption = q.correctOption || 'A';"));
  });

  console.log(`\nAll ${passedCount} CBT option shuffling tests passed.`);
}

runTests();
