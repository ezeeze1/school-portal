import type { CBTExam } from '../types';
import { serializeDiagramToken } from './diagramFormatting';
import { DIAGRAM_TEMPLATES } from './diagramTemplates';

function mustTokenFromTemplate(templateId: string, customize?: (spec: any) => void): string {
  const tpl = DIAGRAM_TEMPLATES.find((t) => t.id === templateId);
  if (!tpl) {
    throw new Error(`Missing diagram template: ${templateId}`);
  }
  const spec = tpl.createSpec();
  if (customize) customize(spec);
  const res = serializeDiagramToken(spec);
  if (!res.ok || !res.token) {
    throw new Error(`Failed to serialize sample diagram ${templateId}: ${res.error}`);
  }
  return res.token;
}

/**
 * Isolated 10-question Mathematics CBT fixture covering all required topics.
 * Used strictly for verification tests and offline sample inspection.
 * NEVER auto-inserted into live Supabase tables.
 */
export function buildSampleMathematicsDiagramExam(): CBTExam {
  const rectToken = mustTokenFromTemplate('tpl-rectangle-area-perimeter'); // 12 cm x 7 cm -> Area = 84 cm²
  const sqToken = mustTokenFromTemplate('tpl-square-area-perimeter'); // side 9 cm -> Perimeter = 36 cm
  const triToken = mustTokenFromTemplate('tpl-triangle-area'); // base 14 cm, h = 8 cm -> Area = 56 cm²
  const pythToken = mustTokenFromTemplate('tpl-pythagoras-theorem'); // legs 6 cm, 8 cm -> x = 10 cm
  const circleToken = mustTokenFromTemplate('tpl-circle-circumference-area'); // d = 21 cm, pi=22/7 -> C = 66 cm
  const straightLineToken = mustTokenFromTemplate('tpl-angles-straight-line'); // 128° + x° = 180° -> 52°
  const angleTriToken = mustTokenFromTemplate('tpl-angles-in-triangle'); // 55° + 72° + x° = 180° -> 53°
  const parallelToken = mustTokenFromTemplate('tpl-parallel-transversal'); // corresponding 64° -> x = 64°
  const linearGraphToken = mustTokenFromTemplate('tpl-linear-graph'); // y = 2x + 1, at x=2 -> y=5
  const barChartToken = mustTokenFromTemplate('tpl-bar-chart'); // Math:18, Eng:24, Bio:15, Phy:12 -> total=69, mode=English

  return {
    id: 'fixture-math-diagrams-10q',
    title: 'Sample JSS 3 / SS 1 Mathematics Diagrams & Graphs Assessment',
    subjectId: 'sub-math-sample',
    subjectName: 'Mathematics',
    classId: 'cls-jss3-sample',
    className: 'JSS 3',
    durationMinutes: 30,
    totalQuestions: 10,
    totalMarks: 20,
    passPercentage: 50,
    startDate: '2026-01-01',
    startTime: '08:00',
    endDate: '2026-12-31',
    isPublished: true,
    shuffleQuestions: true,
    allowAnswerReview: true,
    questions: [
      {
        id: 'smp-q1-rect',
        question: `Calculate the area of rectangle ABCD shown below.\n${rectToken}`,
        options: {
          A: '84 cm²',
          B: '38 cm²',
          C: '19 cm²',
          D: '72 cm²',
        },
        correctOption: 'A',
        explanation: 'Area of rectangle = length × breadth = 12 cm × 7 cm = 84 cm².',
        marks: 2,
      },
      {
        id: 'smp-q2-sq',
        question: `Find the perimeter of square PQRS shown below.\n${sqToken}`,
        options: {
          A: '36 cm',
          B: '81 cm',
          C: '18 cm',
          D: '27 cm',
        },
        correctOption: 'A',
        explanation: 'Perimeter of a square = 4 × side = 4 × 9 cm = 36 cm.',
        marks: 2,
      },
      {
        id: 'smp-q3-tri',
        question: `Find the area of triangle ABC shown in the diagram.\n${triToken}`,
        options: {
          A: '56 cm²',
          B: '112 cm²',
          C: '22 cm²',
          D: '48 cm²',
        },
        correctOption: 'A',
        explanation: 'Area = ½ × base × height = ½ × 14 × 8 = 56 cm².',
        marks: 2,
      },
      {
        id: 'smp-q4-pyth',
        question: `In right-angled triangle ABC below, calculate the value of x.\n${pythToken}`,
        options: {
          A: '10 cm',
          B: '14 cm',
          C: '48 cm',
          D: '√28 cm',
        },
        correctOption: 'A',
        explanation: 'By Pythagoras theorem: x = √(6² + 8²) = √(36 + 64) = √100 = 10 cm.',
        marks: 2,
      },
      {
        id: 'smp-q5-circle',
        question: `Taking \\(\\pi = \\frac{22}{7}\\), find the circumference of the circle shown below.\n${circleToken}`,
        options: {
          A: '66 cm',
          B: '44 cm',
          C: '132 cm',
          D: '33 cm',
        },
        correctOption: 'A',
        explanation: 'Circumference = πd = (22/7) × 21 = 66 cm.',
        marks: 2,
      },
      {
        id: 'smp-q6-line',
        question: `AOB is a straight line. Find the value of x° in the diagram below.\n${straightLineToken}`,
        options: {
          A: '52°',
          B: '62°',
          C: '128°',
          D: '48°',
        },
        correctOption: 'A',
        explanation: 'Angles on a straight line add up to 180°, so x = 180° − 128° = 52°.',
        marks: 2,
      },
      {
        id: 'smp-q7-angtri',
        question: `Find the value of angle x° in triangle PQR below.\n${angleTriToken}`,
        options: {
          A: '53°',
          B: '63°',
          C: '127°',
          D: '43°',
        },
        correctOption: 'A',
        explanation: 'Sum of angles in a triangle = 180°, so x = 180° − (55° + 72°) = 53°.',
        marks: 2,
      },
      {
        id: 'smp-q8-par',
        question: `The two horizontal lines below are parallel. Find the value of x°.\n${parallelToken}`,
        options: {
          A: '64°',
          B: '116°',
          C: '26°',
          D: '90°',
        },
        correctOption: 'A',
        explanation: 'Corresponding angles formed by a transversal on parallel lines are equal, so x = 64°.',
        marks: 2,
      },
      {
        id: 'smp-q9-graph',
        question: `From the linear graph of \\(y = 2x + 1\\) shown below, what is the value of y when x = 2?\n${linearGraphToken}`,
        options: {
          A: '5',
          B: '3',
          C: '1',
          D: '4',
        },
        correctOption: 'A',
        explanation: 'From point B(2, 5) on the line, y = 2(2) + 1 = 5.',
        marks: 2,
      },
      {
        id: 'smp-q10-bar',
        question: `Use the bar chart below to find the total number of students surveyed across all four subjects.\n${barChartToken}`,
        options: {
          A: '69',
          B: '57',
          C: '72',
          D: '64',
        },
        correctOption: 'A',
        explanation: 'Total = 18 + 24 + 15 + 12 = 69 students.',
        marks: 2,
      },
    ],
  };
}
