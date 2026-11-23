import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  MATH_SYMBOL_GROUPS,
  insertSnippetAtCursor,
  isSafeInlineDollarMath,
  normalizeUnicodeMathToLatex,
  parseCsvLine,
  parseMathSegments,
  renderMathToHtml,
  stripMathForSpellCheck,
} from '../src/lib/mathFormatting';
import {
  OPTION_SLOTS,
  buildLocalShuffledExamSession,
  gradeLocalShuffledAttempt,
  validateExamQuestionsForSave,
} from '../src/lib/cbtShuffling';
import { CBTExam, Student } from '../src/types';

function assertCleanKatex(html: string, label: string) {
  assert.ok(html.includes('class="katex"'), `${label}: expected KaTeX output`);
  assert.equal(html.includes('katex-error'), false, `${label}: unexpected katex-error in HTML: ${html}`);
}

function runTests() {
  let passedCount = 0;
  const test = (name: string, fn: () => void) => {
    fn();
    passedCount += 1;
    console.log(`PASS: ${name}`);
  };

  // 1. Bare & Delimited LaTeX Expressions
  test('Renders bare and delimited LaTeX expressions cleanly without katex-error', () => {
    const expressions = [
      '\\sqrt{144}',
      '\\sqrt[3]{27}',
      'x^2 + x^3',
      '\\frac{3}{4}',
      '\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}',
      '\\sin^2\\theta + \\cos^2\\theta = 1',
      '\\log_{10}(100) = 2',
      'log_{10}(100) = 2',
      '\\begin{pmatrix} 1 & 2 \\\\ 3 & 4 \\end{pmatrix}',
      '\\begin{cases} 2x + y = 7 \\\\ x - y = 2 \\end{cases}',
      '\\(3.5 \\times 10^{-4}\\)',
      '$$\\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$',
      '\\[x^2 - 5x + 6 = 0\\]',
    ];

    for (const expr of expressions) {
      const segments = parseMathSegments(expr);
      const mathSegs = segments.filter((s) => s.type === 'math');
      assert.ok(mathSegs.length >= 1, `Expected math segment for: ${expr}`);
      for (const seg of mathSegs) {
        const html = renderMathToHtml(seg.content, seg.displayMode);
        assertCleanKatex(html, expr);
      }
    }

    // Bare quadratic formula should parse as a single cohesive math segment
    const qfSegments = parseMathSegments('\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}');
    assert.equal(qfSegments.length, 1);
    assert.equal(qfSegments[0].type, 'math');
  });

  // 2. Unicode Math & Radicals
  test('Parses Unicode radicals and normalizes Unicode superscripts, fractions, and operators for KaTeX', () => {
    // Radicals should split cleanly into math segments while preserving sentence punctuation
    const radicalCases = [
      { input: '√144', expectedContent: '√144', trailingText: '' },
      { input: '∛27', expectedContent: '∛27', trailingText: '' },
      { input: '√(a² + b²)', expectedContent: '√(a² + b²)', trailingText: '' },
      { input: 'Find √144.', expectedContent: '√144', trailingText: '.' },
    ];

    for (const tc of radicalCases) {
      const segs = parseMathSegments(tc.input);
      const mathSeg = segs.find((s) => s.type === 'math');
      assert.ok(mathSeg, `Expected math segment for ${tc.input}`);
      assert.equal(mathSeg!.content, tc.expectedContent);
      if (tc.trailingText) {
        const lastSeg = segs[segs.length - 1];
        assert.equal(lastSeg.type, 'text');
        assert.equal(lastSeg.content, tc.trailingText);
      }
      assertCleanKatex(renderMathToHtml(mathSeg!.content, false), tc.input);
    }

    // Unicode expressions inside delimited math or normalized directly
    const unicodeExpressions = [
      'x² + x³',
      '¾ + ½',
      'x² − 5x + 6 = 0',
      '√(a² + b²)',
      'sin²θ + cos²θ = 1',
      '3.5 × 10⁻⁴',
      '2x + 3 ≤ 15',
    ];
    for (const u of unicodeExpressions) {
      const normalized = normalizeUnicodeMathToLatex(u);
      assert.ok(normalized.length > 0);
      assertCleanKatex(renderMathToHtml(u, false), `Unicode direct: ${u}`);
      const delimitedSegs = parseMathSegments(`\\(${u}\\)`);
      assert.equal(delimitedSegs.length, 1);
      assert.equal(delimitedSegs[0].type, 'math');
      assertCleanKatex(renderMathToHtml(delimitedSegs[0].content, false), `Delimited Unicode: ${u}`);
    }
  });

  // 3. Ordinary Currency ($) & Plain Text Preservation
  test('Never parses ordinary dollar currency or English prose as math', () => {
    const currencyCases = [
      'A book costs $50.',
      'A pen costs $50 and a bag costs $120.',
      'Total fee is $1,250.00 per term.',
      'Pay $15.50 for lunch and $20.00 for transport.',
      '$50+$20',
      '$100-$25',
      'Explain the process of photosynthesis in green plants.',
    ];

    for (const text of currencyCases) {
      const segs = parseMathSegments(text);
      assert.equal(
        segs.some((s) => s.type === 'math'),
        false,
        `Currency/prose mistakenly parsed as math: "${text}" -> ${JSON.stringify(segs)}`
      );
      assert.equal(segs.map((s) => s.raw || s.content).join(''), text);
    }

    // Intentional inline $...$ LaTeX remains supported when unmistakably math
    assert.equal(isSafeInlineDollarMath('50'), false);
    assert.equal(isSafeInlineDollarMath('50 and '), false);
    assert.equal(isSafeInlineDollarMath('50+'), false);
    assert.equal(isSafeInlineDollarMath('\\frac{3}{4}'), true);
    assert.equal(isSafeInlineDollarMath('x^2 + 1'), true);
  });

  // 4. Security: KaTeX trust:false blocks unsafe URI/HTML injection
  test('KaTeX rendering runs with trust:false and neutralizes unsafe commands', () => {
    const htmlHref = renderMathToHtml('\\href{javascript:alert(1)}{click}', false);
    assert.equal(/<a[\s>]/i.test(htmlHref), false);
    assert.equal(/\bhref\s*=/i.test(htmlHref), false);
    const htmlClass = renderMathToHtml('\\htmlClass{injected-cls}{x}', false);
    assert.equal(/class="[^"]*injected-cls/.test(htmlClass), false);
  });

  // 5. Teacher Utilities: Spellcheck Stripping, Quote-Aware CSV, Cursor Insertion, Toolbar Snippets
  test('Teacher math utilities strip math for spellcheck, parse quoted CSV commas, insert at cursor, and validate toolbar snippets', () => {
    const stripped = stripMathForSpellCheck(
      'Solve \\(\\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}\\) and x^2 + y^2 = 25.'
    );
    assert.equal(stripped.includes('frac'), false);
    assert.equal(stripped.includes('sqrt'), false);
    assert.ok(stripped.includes('Solve'));

    const csvFields = parseCsvLine(
      '"Find the midpoint of (2, 3) and (4, 7)","(3, 5)","(2, 4)","(1, 5)","(6, 10)",2'
    );
    assert.equal(csvFields.length, 6);
    assert.equal(csvFields[0], 'Find the midpoint of (2, 3) and (4, 7)');
    assert.equal(csvFields[1], '(3, 5)');
    assert.equal(csvFields[5], '2');

    const inserted = insertSnippetAtCursor('Solve  for x', '\\(x^{2}\\)', 6, 6);
    assert.equal(inserted.nextValue, 'Solve \\(x^{2}\\) for x');
    assert.equal(inserted.nextCursorPos, 6 + '\\(x^{2}\\)'.length);

    for (const group of MATH_SYMBOL_GROUPS) {
      for (const item of group.items) {
        const segs = parseMathSegments(item.snippet);
        for (const seg of segs) {
          if (seg.type === 'math') {
            assertCleanKatex(renderMathToHtml(seg.content, seg.displayMode), `Toolbar ${item.label}`);
          }
        }
      }
    }
  });

  // 6. CBT Option Shuffling & Automatic Grading Preservation With Math Content
  test('Math expressions in CBT questions and Options A-D shuffle evenly and grade with 100% accuracy', () => {
    const student: Student = {
      id: 'std-math-1',
      admissionNo: 'DA/2026/M01',
      firstName: 'Chinedu',
      lastName: 'Eze',
      gender: 'Male',
      dob: '2010-05-11',
      classId: 'c-ss2',
      className: 'SS 2',
      arm: 'A',
      parentName: 'Mrs Eze',
      parentPhone: '08000000000',
      address: 'Abuja',
      avatar: '',
      status: 'Active',
    };

    const mathExam: CBTExam = {
      id: 'exam-math-verify',
      title: 'SS2 Mathematics Assessment',
      subjectId: 'sub-mth',
      subjectName: 'Mathematics',
      classId: 'c-ss2',
      className: 'SS 2',
      durationMinutes: 45,
      totalQuestions: 5,
      totalMarks: 10,
      passPercentage: 50,
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      isPublished: true,
      shuffleQuestions: false,
      questions: [
        {
          id: 'mq-1',
          question: 'Evaluate √144 + ∛27',
          options: { A: '15', B: '12', C: '9', D: '18' },
          correctOption: 'A',
          explanation: '\\sqrt{144} = 12 and \\sqrt[3]{27} = 3, so 12 + 3 = 15.',
          marks: 2,
        },
        {
          id: 'mq-2',
          question: 'Simplify \\frac{3}{4} + \\frac{1}{2}',
          options: {
            A: '\\frac{5}{4}',
            B: '\\frac{4}{6}',
            C: '\\frac{3}{8}',
            D: '\\frac{7}{4}',
          },
          correctOption: 'A',
          explanation: 'Common denominator 4 gives \\frac{3}{4} + \\frac{2}{4} = \\frac{5}{4}.',
          marks: 2,
        },
        {
          id: 'mq-3',
          question: 'State the quadratic formula for ax² + bx + c = 0.',
          options: {
            A: '\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}',
            B: '\\frac{b\\pm\\sqrt{b^2+4ac}}{2a}',
            C: '\\frac{-b\\pm\\sqrt{b^2-2ac}}{a}',
            D: '\\frac{-b\\pm\\sqrt{4ac-b^2}}{2a}',
          },
          correctOption: 'A',
          marks: 2,
        },
        {
          id: 'mq-4',
          question: 'Factorize x^2 - 5x + 6 = 0',
          options: {
            A: '(x - 2)(x - 3) = 0',
            B: '(x + 2)(x + 3) = 0',
            C: '(x - 1)(x - 6) = 0',
            D: '(x + 2)(x - 3) = 0',
          },
          correctOption: 'A',
          marks: 2,
        },
        {
          id: 'mq-5',
          question: 'Given A = \\begin{pmatrix} 1 & 2 \\\\ 3 & 4 \\end{pmatrix}, what is det(A)?',
          options: { A: '-2', B: '2', C: '10', D: '-10' },
          correctOption: 'A',
          marks: 2,
        },
      ],
    };

    // Validation still passes Option A rules cleanly
    assert.equal(validateExamQuestionsForSave(mathExam.questions), null);

    // Run 120 shuffle trials verifying all math strings survive verbatim & slot positions vary
    const q2SlotsSeen = new Set<string>();
    for (let trial = 0; trial < 120; trial++) {
      const { startResponse, privateOptionMap } = buildLocalShuffledExamSession(
        mathExam,
        `${student.id}-${trial}`
      );
      const q2 = startResponse.exam.questions.find((q) => q.id === 'mq-2')!;
      const q2CorrectSlot = OPTION_SLOTS.find((s) => q2.options[s] === '\\frac{5}{4}')!;
      assert.ok(q2CorrectSlot, 'Correct math option \\frac{5}{4} must exist after shuffle');
      q2SlotsSeen.add(q2CorrectSlot);

      // Submit all correct answers using shuffled opaque optionIds
      const allCorrectAnswers: Record<string, string> = {};
      for (const origQ of mathExam.questions) {
        const shuffledQ = startResponse.exam.questions.find((q) => q.id === origQ.id)!;
        const slot = OPTION_SLOTS.find((s) => shuffledQ.options[s] === origQ.options.A)!;
        allCorrectAnswers[origQ.id] = shuffledQ.optionIds![slot];
      }

      const graded = gradeLocalShuffledAttempt(
        mathExam,
        student,
        allCorrectAnswers,
        privateOptionMap,
        600,
        { allowAnswerReview: true }
      );
      assert.equal(graded.attempt.scoreObtained, 10);
      assert.equal(graded.attempt.totalMarks, 10);
      assert.equal(graded.attempt.percentage, 100);
      assert.equal(graded.attempt.passed, true);
      assert.equal(graded.review.length, 5);
      assert.equal(graded.review[1].options[graded.review[1].correctOption], '\\frac{5}{4}');
    }
    assert.equal(q2SlotsSeen.size, 4, 'Correct math option should shuffle across all 4 slots A/B/C/D');

    // Verify partial scoring when 1 math answer is wrong
    const { startResponse, privateOptionMap } = buildLocalShuffledExamSession(mathExam, student.id);
    const partialAnswers: Record<string, string> = {};
    for (const origQ of mathExam.questions) {
      const shuffledQ = startResponse.exam.questions.find((q) => q.id === origQ.id)!;
      const targetText = origQ.id === 'mq-3' ? origQ.options.B : origQ.options.A;
      const slot = OPTION_SLOTS.find((s) => shuffledQ.options[s] === targetText)!;
      partialAnswers[origQ.id] = shuffledQ.optionIds![slot];
    }
    const partialGraded = gradeLocalShuffledAttempt(
      mathExam,
      student,
      partialAnswers,
      privateOptionMap,
      600
    );
    assert.equal(partialGraded.attempt.scoreObtained, 8);
    assert.equal(partialGraded.attempt.percentage, 80);
  });

  // 7. Static Safety Verification: Math integration touches UI presentation/input only
  test('CBTExamRunner, CBTQuestionBankBuilder, and PastQuestionsBank render math cleanly without mutating grading/shuffling', () => {
    const runnerSrc = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/student/CBTExamRunner.tsx'),
      'utf8'
    );
    const builderSrc = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/teacher/CBTQuestionBankBuilder.tsx'),
      'utf8'
    );
    const pastSrc = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/teacher/PastQuestionsBank.tsx'),
      'utf8'
    );
    const mathTextSrc = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/common/MathText.tsx'),
      'utf8'
    );

    assert.ok(runnerSrc.includes('<MathText text={currentQ.question}'));
    assert.ok(runnerSrc.includes('<MathText text={currentQ.options[opt]}'));
    assert.ok(runnerSrc.includes('getOptionValueForSlot(currentQ, slot)'));

    assert.ok(builderSrc.includes('MathSymbolToolbar'));
    assert.ok(builderSrc.includes('QuestionMathPreview'));
    assert.ok(builderSrc.includes('stripMathForSpellCheck'));
    assert.ok(builderSrc.includes('parseCsvLine'));

    assert.ok(pastSrc.includes('MathSymbolToolbar'));
    assert.ok(pastSrc.includes('QuestionMathPreview'));
    assert.ok(pastSrc.includes('<MathText text={'));

    assert.ok(mathTextSrc.includes('renderMathToHtml'));
    assert.ok(mathTextSrc.includes('parseMathSegments'));
  });

  console.log(`\nAll ${passedCount} math rendering & CBT preservation tests passed.`);
}

runTests();
