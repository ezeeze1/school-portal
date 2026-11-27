import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import type { CBTDiagramSpec } from '../src/types/cbtDiagram';
import type { CBTExam, CBTQuestion, Student } from '../src/types';
import {
  compileSafeMathExpression,
  containsUnsafeMarkupOrUri,
  sanitizeColor,
  validateAndSanitizeDiagramSpec,
} from '../src/lib/diagramValidation';
import {
  attachDiagramToText,
  extractDiagramTokens,
  hasDiagramTokens,
  parseDiagramToken,
  removeDiagramTokenFromText,
  replaceDiagramTokenInText,
  serializeDiagramToken,
  splitContentWithDiagrams,
  stripDiagramsForSpellCheck,
} from '../src/lib/diagramFormatting';
import { DIAGRAM_TEMPLATES } from '../src/lib/diagramTemplates';
import { buildSampleMathematicsDiagramExam } from '../src/lib/diagramFixtures';
import {
  buildRightAngleSquarePoints,
  buildSemicirclePath,
  buildSvgArcPath,
  computeHistogramBars,
  getShapeVertices,
} from '../src/lib/geometryPrimitives';
import {
  OPTION_SLOTS,
  buildLocalShuffledExamSession,
  convertLegacyQuestionToOptionA,
  gradeLocalShuffledAttempt,
  validateExamQuestionsForSave,
} from '../src/lib/cbtShuffling';
import { parseCsvLine, stripMathForSpellCheck } from '../src/lib/mathFormatting';

function makeStudent(index: number): Student {
  return {
    id: `stu-diag-${index}`,
    admissionNo: `DA/2026/${String(index).padStart(3, '0')}`,
    firstName: `Student${index}`,
    lastName: 'Tester',
    classId: 'cls-jss3-sample',
    className: 'JSS 3',
    arm: 'A',
    gender: index % 2 === 0 ? 'Female' : 'Male',
    dob: '2012-05-10',
    parentName: 'Parent Tester',
    parentPhone: '08000000000',
    address: 'Lagos',
    avatar: '',
    status: 'Active',
  };
}

function runTests() {
  let passedCount = 0;
  const test = (name: string, fn: () => void) => {
    fn();
    passedCount += 1;
    console.log(`PASS: ${name}`);
  };

  // 1. All 20 curriculum templates validate, serialize cleanly, and round-trip identically
  test('All 20 curriculum templates validate, serialize to base64url tokens, and parse back cleanly', () => {
    assert.equal(DIAGRAM_TEMPLATES.length, 20);
    for (const tpl of DIAGRAM_TEMPLATES) {
      const spec = tpl.createSpec();
      const val = validateAndSanitizeDiagramSpec(spec);
      assert.equal(val.ok, true, `Template ${tpl.id} failed validation: ${val.error}`);
      const ser = serializeDiagramToken(spec);
      assert.equal(ser.ok, true, `Template ${tpl.id} failed serialization: ${ser.error}`);
      assert.ok(ser.token?.startsWith('[[cbt-diagram:v1:') && ser.token.endsWith(']]'));
      assert.ok(!ser.token?.includes(','), `Token for ${tpl.id} must be comma-free for CSV compatibility`);
      const parsed = parseDiagramToken(ser.token!);
      assert.equal(parsed.ok, true, `Template ${tpl.id} failed re-parse: ${parsed.error}`);
      assert.equal(parsed.spec?.mode, spec.mode);
    }
  });

  // 2. Attachment placement modes: above, below, inline + replace + remove
  test('attachDiagramToText, replaceDiagramTokenInText, and removeDiagramTokenFromText preserve surrounding text and KaTeX', () => {
    const tpl = DIAGRAM_TEMPLATES[0].createSpec();
    const ser1 = serializeDiagramToken(tpl);
    assert.ok(ser1.ok && ser1.token);
    const token1 = ser1.token!;

    const baseText = 'Find the area of rectangle ABCD when \\(l = 12\\text{ cm}\\).';
    const below = attachDiagramToText(baseText, token1, 'below');
    assert.ok(below.startsWith(baseText));
    assert.ok(below.endsWith(token1));

    const above = attachDiagramToText(baseText, token1, 'above');
    assert.ok(above.startsWith(token1));
    assert.ok(above.endsWith(baseText));

    const inline = attachDiagramToText('Look at figure and solve.', token1, 'inline', 14);
    const segs = splitContentWithDiagrams(inline);
    assert.equal(segs.length, 3);
    assert.equal(segs[0].type, 'text');
    assert.equal(segs[1].type, 'diagram');
    assert.equal(segs[2].type, 'text');

    const tpl2 = DIAGRAM_TEMPLATES[1].createSpec();
    const token2 = serializeDiagramToken(tpl2).token!;
    const replaced = replaceDiagramTokenInText(below, token1, token2);
    assert.equal(replaced.includes(token1), false);
    assert.equal(replaced.includes(token2), true);

    const removed = removeDiagramTokenFromText(replaced, token2);
    assert.equal(hasDiagramTokens(removed), false);
    assert.equal(removed, baseText);
  });

  // 3. Spell-check & CSV comma preservation with diagram tokens
  test('stripDiagramsForSpellCheck removes diagram tokens cleanly and CSV parseCsvLine handles diagram rows', () => {
    const tok = serializeDiagramToken(DIAGRAM_TEMPLATES[0].createSpec()).token!;
    const qText = `Calculate the perimeter of \\(\\triangle ABC\\).\n${tok}`;
    const cleaned = stripMathForSpellCheck(stripDiagramsForSpellCheck(qText));
    assert.equal(cleaned.includes('cbt-diagram'), false);
    assert.equal(cleaned.includes('triangle'), false);
    assert.ok(cleaned.includes('Calculate the perimeter'));

    const csvLine = `"${qText.replace(/\n/g, ' ')}","38 cm","84 cm","19 cm","72 cm","Perimeter = 2(l+b)"`;
    const cols = parseCsvLine(csvLine);
    assert.equal(cols.length, 6);
    assert.equal(extractDiagramTokens(cols[0]).length, 1);
    assert.equal(extractDiagramTokens(cols[0])[0].ok, true);
  });

  // 4. Hidden measurement privacy strip on serialization
  test('hideMeasurement strips concealed teacher answer hints before persisting student-readable tokens', () => {
    const secretSpec: CBTDiagramSpec = {
      version: 1,
      mode: 'geometry',
      width: 400,
      height: 280,
      geometry: {
        elements: [
          {
            id: 'a1',
            kind: 'angle',
            angleKind: 'acute',
            cx: 150,
            cy: 150,
            radius: 40,
            startAngleDeg: 0,
            sweepAngleDeg: 53,
            hideMeasurement: true,
            label: '',
            showDegreeSymbol: true,
            strokeColor: '#0f172a',
            strokeWidth: 2,
          },
          {
            id: 'l1',
            kind: 'line',
            lineKind: 'segment',
            x1: 60,
            y1: 200,
            x2: 260,
            y2: 200,
            strokeColor: '#0f172a',
            strokeWidth: 2,
            lineStyle: 'solid',
            hideMeasurement: true,
            label: '',
          },
        ],
      },
    };
    const ser = serializeDiagramToken(secretSpec);
    assert.ok(ser.ok && ser.token);
    const parsed = parseDiagramToken(ser.token!);
    assert.ok(parsed.ok && parsed.spec?.geometry);
    const ang = parsed.spec!.geometry!.elements[0];
    const lin = parsed.spec!.geometry!.elements[1];
    assert.equal(ang.kind === 'angle' ? ang.label : '', 'x°');
    assert.equal(lin.kind === 'line' ? lin.label : '', 'x');
  });

  // 5. Security rejection: XSS, <script>, <svg>, javascript:, data:text/html, https://, NaN, Infinity, oversized payload
  test('Strict validator rejects script tags, inline SVG injection, event handlers, URIs, and invalid numerics', () => {
    assert.equal(containsUnsafeMarkupOrUri('<script>alert(1)</script>'), true);
    assert.equal(containsUnsafeMarkupOrUri('<svg onload="alert(1)">'), true);
    assert.equal(containsUnsafeMarkupOrUri('javascript:alert(1)'), true);
    assert.equal(containsUnsafeMarkupOrUri('data:text/html,<script>'), true);
    assert.equal(containsUnsafeMarkupOrUri('https://evil.example/a.png'), true);
    assert.equal(containsUnsafeMarkupOrUri('onclick=alert(1)'), true);
    assert.equal(containsUnsafeMarkupOrUri('Triangle ABC (12 cm)'), false);

    const maliciousSpec: CBTDiagramSpec = {
      version: 1,
      mode: 'geometry',
      width: 480,
      height: 300,
      title: '<script>alert(1)</script>',
      geometry: { elements: [] },
    };
    assert.equal(validateAndSanitizeDiagramSpec(maliciousSpec).ok, false);

    const nanSpec = {
      version: 1,
      mode: 'geometry',
      width: Number.NaN,
      height: 300,
      geometry: { elements: [] },
    } as unknown as CBTDiagramSpec;
    assert.equal(validateAndSanitizeDiagramSpec(nanSpec).ok, false);

    const infSpec = {
      version: 1,
      mode: 'geometry',
      width: 480,
      height: Number.POSITIVE_INFINITY,
      geometry: { elements: [] },
    } as unknown as CBTDiagramSpec;
    assert.equal(validateAndSanitizeDiagramSpec(infSpec).ok, false);

    assert.equal(sanitizeColor('url(https://evil.test)', '#0f172a'), '#0f172a');
    assert.equal(sanitizeColor('#2563eb', '#0f172a'), '#2563eb');
  });

  // 6. Corrupted/tampered marker graceful error handling
  test('Malformed or tampered diagram markers return safe error segments without crashing', () => {
    const tampered = 'Solve: [[cbt-diagram:v1:invalid$$$payload]] + 2';
    const segs = splitContentWithDiagrams(tampered);
    assert.equal(segs.length, 3);
    assert.equal(segs[1].type, 'diagram-error');
    const badVersion = parseDiagramToken('[[cbt-diagram:v99:e30]]');
    assert.equal(badVersion.ok, false);
  });

  // 7. Safe mathematical expression parser (no eval / Function) & discontinuities
  test('compileSafeMathExpression evaluates polynomials, trig, sqrt, implicit multiplication, and handles asymptotes cleanly', () => {
    const linear = compileSafeMathExpression('y = 2x + 3');
    assert.equal(linear.ok, true);
    assert.equal(linear.evaluate!(4), 11);

    const quad = compileSafeMathExpression('y = x² - 4x + 3');
    assert.equal(quad.ok, true);
    assert.equal(quad.evaluate!(1), 0);
    assert.equal(quad.evaluate!(2), -1);

    const trig = compileSafeMathExpression('f(x) = 2sin(pi * x / 2)');
    assert.equal(trig.ok, true);
    assert.ok(Math.abs((trig.evaluate!(1) ?? 0) - 2) < 1e-9);

    const recip = compileSafeMathExpression('1 / x');
    assert.equal(recip.ok, true);
    assert.equal(recip.evaluate!(0), null); // division by zero -> discontinuity null, not crash
    assert.equal(recip.evaluate!(2), 0.5);

    const root = compileSafeMathExpression('sqrt(x)');
    assert.equal(root.ok, true);
    assert.equal(root.evaluate!(-4), null);
    assert.equal(root.evaluate!(9), 3);

    // Reject arbitrary JS / unknown globals
    assert.equal(compileSafeMathExpression('window.alert(1)').ok, false);
    assert.equal(compileSafeMathExpression('process.exit(1)').ok, false);
    assert.equal(compileSafeMathExpression('constructor').ok, false);
  });

  // 8. Geometry primitive helpers & unequal class width frequency density histogram math
  test('Geometry primitives and unequal-width histogram frequency density compute exact mathematical geometry', () => {
    const rectPts = getShapeVertices({
      id: 'r1',
      kind: 'shape',
      shapeKind: 'rectangle',
      x: 100,
      y: 80,
      width: 120,
      height: 60,
      rotation: 0,
      strokeColor: '#000',
      strokeWidth: 2,
      fillColor: 'transparent',
    });
    assert.equal(rectPts.length, 4);
    assert.deepEqual(rectPts[0], { x: 100, y: 80 });
    assert.deepEqual(rectPts[2], { x: 220, y: 140 });

    const semi = buildSemicirclePath({
      id: 's1',
      kind: 'shape',
      shapeKind: 'semicircle',
      x: 50,
      y: 50,
      width: 100,
      height: 50,
      rotation: 0,
      strokeColor: '#000',
      strokeWidth: 2,
      fillColor: 'transparent',
    });
    assert.ok(semi.startsWith('M 50 100 A 50 50'));

    const sectorPath = buildSvgArcPath(200, 150, 80, 0, 90, true);
    assert.ok(sectorPath.startsWith('M 200 150 L ') && sectorPath.endsWith('Z'));

    const rightSq = buildRightAngleSquarePoints(
      { x: 0, y: 100 },
      { x: 0, y: 0 },
      { x: 100, y: 100 },
      12
    );
    assert.ok(rightSq.split(' ').length === 3);

    const hist = computeHistogramBars([
      { id: 'b1', min: 0, max: 10, frequency: 10, color: '#2563eb' },
      { id: 'b2', min: 10, max: 30, frequency: 30, color: '#2563eb' },
    ]);
    assert.equal(hist.hasUnequalWidths, true);
    assert.equal(hist.yLabelDefault, 'Frequency Density');
    assert.equal(hist.bars[0].frequencyDensity, 1);
    assert.equal(hist.bars[1].frequencyDensity, 1.5);
  });

  // 9. 10-question Sample Mathematics CBT Exam fixture: Option A correctness, shuffling, & 0%/50%/100% grading
  test('Sample 10-question Mathematics Diagram CBT Exam preserves Option A, shuffles fairly, and grades 0%, 50%, 100% accurately', () => {
    const sampleExam = buildSampleMathematicsDiagramExam();
    assert.equal(sampleExam.questions.length, 10);
    assert.equal(validateExamQuestionsForSave(sampleExam.questions), null);

    for (const q of sampleExam.questions) {
      assert.equal(q.correctOption, 'A');
      assert.equal(hasDiagramTokens(q.question), true);
      const tokens = extractDiagramTokens(q.question);
      assert.equal(tokens.length, 1);
      assert.equal(tokens[0].ok, true);
    }

    const student = makeStudent(1);
    const { startResponse, privateOptionMap } = buildLocalShuffledExamSession(
      sampleExam,
      student.id
    );
    assert.equal(startResponse.exam.questions.length, 10);

    // Verify 100% score by selecting the optionId corresponding to Option A on each question
    const allCorrectAnswers: Record<string, string> = {};
    const halfCorrectAnswers: Record<string, string> = {};
    const allWrongAnswers: Record<string, string> = {};

    startResponse.exam.questions.forEach((clientQ, idx) => {
      const origQ = sampleExam.questions.find((q) => q.id === clientQ.id)!;
      const correctText = origQ.options.A;
      const correctSlot = OPTION_SLOTS.find((s) => clientQ.options[s] === correctText)!;
      const wrongSlot = OPTION_SLOTS.find((s) => clientQ.options[s] !== correctText)!;
      assert.ok(correctSlot && wrongSlot);

      allCorrectAnswers[clientQ.id] = clientQ.optionIds![correctSlot];
      allWrongAnswers[clientQ.id] = clientQ.optionIds![wrongSlot];
      halfCorrectAnswers[clientQ.id] =
        idx < 5 ? clientQ.optionIds![correctSlot] : clientQ.optionIds![wrongSlot];
    });

    const fullGrade = gradeLocalShuffledAttempt(
      sampleExam,
      student,
      allCorrectAnswers,
      privateOptionMap,
      420
    );
    assert.equal(fullGrade.attempt.scoreObtained, 20);
    assert.equal(fullGrade.attempt.percentage, 100);

    const halfGrade = gradeLocalShuffledAttempt(
      sampleExam,
      student,
      halfCorrectAnswers,
      privateOptionMap,
      400
    );
    assert.equal(halfGrade.attempt.scoreObtained, 10);
    assert.equal(halfGrade.attempt.percentage, 50);

    const zeroGrade = gradeLocalShuffledAttempt(
      sampleExam,
      student,
      allWrongAnswers,
      privateOptionMap,
      300
    );
    assert.equal(zeroGrade.attempt.scoreObtained, 0);
    assert.equal(zeroGrade.attempt.percentage, 0);
  });

  // 10. Option-attached diagrams move 1:1 with their option slot during Fisher-Yates shuffling & legacy conversion
  test('Option-attached diagram tokens shuffle 1:1 with optionIds and survive legacy-to-Option-A conversion', () => {
    const optDiagramA = serializeDiagramToken(DIAGRAM_TEMPLATES[0].createSpec()).token!;
    const optDiagramB = serializeDiagramToken(DIAGRAM_TEMPLATES[1].createSpec()).token!;
    const optDiagramC = serializeDiagramToken(DIAGRAM_TEMPLATES[2].createSpec()).token!;
    const optDiagramD = serializeDiagramToken(DIAGRAM_TEMPLATES[14].createSpec()).token!;

    const legacyQ: CBTQuestion = {
      id: 'opt-diag-legacy',
      question: 'Which diagram represents a square with side 9 cm?',
      options: {
        A: `Wrong Rectangle\n${optDiagramA}`,
        B: `Correct Square\n${optDiagramB}`,
        C: `Wrong Triangle\n${optDiagramC}`,
        D: `Wrong Graph\n${optDiagramD}`,
      },
      correctOption: 'B',
      marks: 2,
    };

    const converted = convertLegacyQuestionToOptionA(legacyQ);
    assert.equal(converted.correctOption, 'A');
    assert.ok(converted.options.A.includes(optDiagramB));
    assert.ok(converted.options.B.includes(optDiagramA));

    const exam: CBTExam = {
      id: 'exam-opt-diag',
      title: 'Option Diagrams Exam',
      subjectId: 'sub-1',
      subjectName: 'Mathematics',
      classId: 'cls-1',
      className: 'JSS 2',
      durationMinutes: 15,
      totalQuestions: 1,
      totalMarks: 2,
      passPercentage: 50,
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      isPublished: true,
      shuffleQuestions: true,
      questions: [converted],
    };

    const student = makeStudent(99);
    const { startResponse, privateOptionMap } = buildLocalShuffledExamSession(
      exam,
      student.id
    );
    const clientQ = startResponse.exam.questions[0];
    const shownSlotForCorrect = OPTION_SLOTS.find((s) =>
      clientQ.options[s].includes(optDiagramB)
    )!;
    assert.ok(shownSlotForCorrect);
    assert.equal(
      extractDiagramTokens(clientQ.options[shownSlotForCorrect])[0].ok,
      true
    );

    const graded = gradeLocalShuffledAttempt(
      exam,
      student,
      {
        [converted.id]: clientQ.optionIds![shownSlotForCorrect],
      },
      privateOptionMap,
      45
    );
    assert.equal(graded.attempt.scoreObtained, 2);
    assert.equal(graded.attempt.percentage, 100);
  });

  // 11. Batch Simulation: 30 students × 60 diagram CBT questions with unique per-student shuffles & scoring verification
  test('Batch simulation: 30 students x 60 diagram CBT questions shuffle, serialize, and grade 100% reliably', () => {
    const sixtyQuestions: CBTQuestion[] = Array.from({ length: 60 }, (_, idx) => {
      const tpl = DIAGRAM_TEMPLATES[idx % DIAGRAM_TEMPLATES.length];
      const tok = serializeDiagramToken(tpl.createSpec()).token!;
      return {
        id: `batch-q-${idx + 1}`,
        question: `Question ${idx + 1}: Inspect the diagram and find the answer.\n${tok}`,
        options: {
          A: `Correct Answer ${idx + 1}`,
          B: `Distractor B ${idx + 1}`,
          C: `Distractor C ${idx + 1}`,
          D: `Distractor D ${idx + 1}`,
        },
        correctOption: 'A',
        marks: 1,
      };
    });

    const batchExam: CBTExam = {
      id: 'exam-batch-30x60',
      title: '60-Question Mathematics Diagram Mock Exam',
      subjectId: 'sub-math',
      subjectName: 'Mathematics',
      classId: 'cls-sss3',
      className: 'SSS 3',
      durationMinutes: 60,
      totalQuestions: 60,
      totalMarks: 60,
      passPercentage: 50,
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      isPublished: true,
      shuffleQuestions: true,
      questions: sixtyQuestions,
    };

    const startMs = Date.now();
    const firstSlotsSeen = new Set<string>();

    for (let sIdx = 1; sIdx <= 30; sIdx++) {
      const student = makeStudent(sIdx);
      const { startResponse, privateOptionMap } = buildLocalShuffledExamSession(
        batchExam,
        student.id
      );
      assert.equal(startResponse.exam.questions.length, 60);

      // Simulate target accuracy pattern per student (between 0 and 60 correct)
      const targetCorrect = (sIdx * 7) % 61;
      const answersByOptionId: Record<string, string> = {};

      startResponse.exam.questions.forEach((clientQ, qPos) => {
        const orig = sixtyQuestions.find((q) => q.id === clientQ.id)!;
        const correctSlot = OPTION_SLOTS.find((slot) => clientQ.options[slot] === orig.options.A)!;
        const wrongSlot = OPTION_SLOTS.find((slot) => clientQ.options[slot] !== orig.options.A)!;
        if (orig.id === 'batch-q-1') firstSlotsSeen.add(correctSlot);

        answersByOptionId[clientQ.id] =
          qPos < targetCorrect
            ? clientQ.optionIds![correctSlot]
            : clientQ.optionIds![wrongSlot];
      });

      const graded = gradeLocalShuffledAttempt(
        batchExam,
        student,
        answersByOptionId,
        privateOptionMap,
        1800
      );
      assert.equal(graded.attempt.scoreObtained, targetCorrect);
    }

    const elapsedMs = Date.now() - startMs;
    assert.ok(firstSlotsSeen.size >= 3, 'Shuffling distributed Question 1 across at least 3 slots across 30 students');
    assert.ok(elapsedMs < 15000, `30x60 diagram simulation completed quickly (${elapsedMs}ms)`);
  });

  // 12. Static security & architecture verification across all new diagram files + preserved core files
  test('Static audit: zero eval/Function/dangerouslySetInnerHTML in diagram modules, scoped lazy loading, and core CBT integrity intact', () => {
    const diagramFiles = [
      'src/types/cbtDiagram.ts',
      'src/lib/diagramValidation.ts',
      'src/lib/diagramFormatting.ts',
      'src/lib/diagramTemplates.ts',
      'src/lib/diagramFixtures.ts',
      'src/lib/geometryPrimitives.ts',
      'src/components/common/DiagramRenderer.tsx',
      'src/components/common/QuestionRichContent.tsx',
      'src/components/teacher/DiagramToolbar.tsx',
      'src/components/teacher/DiagramPropertiesPanel.tsx',
      'src/components/teacher/GeometryDiagramBuilder.tsx',
      'src/components/teacher/GraphBuilder.tsx',
      'src/components/teacher/DiagramPreview.tsx',
      'src/components/teacher/QuestionDiagramPreviewCard.tsx',
      'src/components/teacher/DiagramAndGraphBuilderModal.tsx',
    ];

    for (const rel of diagramFiles) {
      const src = fs.readFileSync(path.resolve(process.cwd(), rel), 'utf8');
      assert.equal(/\beval\s*\(/.test(src), false, `${rel} must never call eval()`);
      assert.equal(/\bnew\s+Function\s*\(/.test(src), false, `${rel} must never use new Function()`);
      assert.equal(/dangerouslySetInnerHTML/.test(src), false, `${rel} must never use dangerouslySetInnerHTML`);
      assert.equal(/\bwindow\.(alert|open|confirm)\s*\(/.test(src), false, `${rel} must never call window.alert/open/confirm`);
    }

    // Confirm student runner NEVER statically imports teacher builder components
    const runnerSrc = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/student/CBTExamRunner.tsx'),
      'utf8'
    );
    assert.equal(runnerSrc.includes('DiagramAndGraphBuilderModal'), false);
    assert.equal(runnerSrc.includes('GeometryDiagramBuilder'), false);
    assert.equal(runnerSrc.includes('GraphBuilder'), false);
    assert.equal(runnerSrc.includes('diagramTemplates'), false);
    assert.ok(runnerSrc.includes('QuestionRichContent'));

    // Confirm teacher builders use React.lazy for the diagram builder modal
    const bankSrc = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/teacher/CBTQuestionBankBuilder.tsx'),
      'utf8'
    );
    const pastSrc = fs.readFileSync(
      path.resolve(process.cwd(), 'src/components/teacher/PastQuestionsBank.tsx'),
      'utf8'
    );
    assert.ok(bankSrc.includes("React.lazy(\n  () => import('./DiagramAndGraphBuilderModal')"));
    assert.ok(pastSrc.includes("React.lazy(\n  () => import('./DiagramAndGraphBuilderModal')"));
  });

  console.log(`\nAll ${passedCount} CBT Geometry, Diagram & Graph Builder tests passed.`);
}

runTests();
