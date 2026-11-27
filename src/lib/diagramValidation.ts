import type {
  CBTDiagramSpec,
  ChartCategoryItem,
  ChartHistogramBin,
  ChartScatterPoint,
  CoordinateGraphConfig,
  DiagramValidationResult,
  GeometryElement,
  GraphEquationItem,
  GraphPointItem,
  StatisticalChartConfig,
} from '../types/cbtDiagram';

export const MAX_DIAGRAM_ELEMENTS = 200;
export const MAX_DIAGRAM_EXPRESSION_LENGTH = 160;
export const MAX_DIAGRAM_TEXT_LENGTH = 180;
export const MAX_DIAGRAM_PAYLOAD_BYTES = 32768;

const UNSAFE_TEXT_PATTERNS: RegExp[] = [
  /<\s*script\b/i,
  /<\s*svg\b/i,
  /<\s*iframe\b/i,
  /<\s*object\b/i,
  /<\s*embed\b/i,
  /<\s*img\b/i,
  /<\s*style\b/i,
  /<\s*link\b/i,
  /<\s*\/?[a-z!][^>]*>/i,
  /\bjavascript\s*:/i,
  /\bvbscript\s*:/i,
  /\bdata\s*:\s*text\/html/i,
  /\bon[a-z]+\s*=/i,
  /https?:\/\//i,
];

const SAFE_COLOR_REGEX =
  /^(?:#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})|transparent|currentColor|rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)|rgba\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*(?:0|1|0?\.\d+)\s*\))$/;

export function containsUnsafeMarkupOrUri(text: string): boolean {
  if (!text) return false;
  return UNSAFE_TEXT_PATTERNS.some((re) => re.test(text));
}

export function sanitizeDiagramText(
  value: unknown,
  maxLength = MAX_DIAGRAM_TEXT_LENGTH
): { ok: boolean; value: string; error?: string } {
  if (value === undefined || value === null) return { ok: true, value: '' };
  if (typeof value !== 'string') {
    return { ok: false, value: '', error: 'Diagram text field must be a string.' };
  }
  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    return { ok: false, value: '', error: `Text exceeds maximum length (${maxLength}).` };
  }
  if (containsUnsafeMarkupOrUri(trimmed)) {
    return { ok: false, value: '', error: 'Text contains disallowed HTML, script, or external URI.' };
  }
  return { ok: true, value: trimmed };
}

export function sanitizeColor(color: unknown, fallback = '#0f172a'): string {
  if (typeof color !== 'string') return fallback;
  const trimmed = color.trim();
  return SAFE_COLOR_REGEX.test(trimmed) ? trimmed : fallback;
}

function isFiniteInRange(n: unknown, min: number, max: number): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max;
}

// ============================================================================
// SAFE MATHEMATICAL EXPRESSION PARSER & EVALUATOR (ZERO eval / Function)
// ============================================================================

type Token =
  | { type: 'number'; value: number }
  | { type: 'ident'; value: string }
  | { type: 'op'; value: '+' | '-' | '*' | '/' | '^' }
  | { type: 'lparen' }
  | { type: 'rparen' };

const ALLOWED_FUNCTIONS = new Set([
  'sin',
  'cos',
  'tan',
  'abs',
  'sqrt',
  'cbrt',
  'ln',
  'log',
  'exp',
  'floor',
  'ceil',
]);

const ALLOWED_CONSTANTS: Record<string, number> = Object.assign(Object.create(null), {
  pi: Math.PI,
  e: Math.E,
});

export function normalizeExpressionInput(raw: string): string {
  let expr = raw.trim();
  // Strip optional "y =" or "f(x) =" prefix
  expr = expr.replace(/^(?:y|f\s*\(\s*x\s*\))\s*=\s*/i, '');

  // Replace Unicode math operators and superscripts
  expr = expr
    .replace(/−/g, '-')
    .replace(/×/g, '*')
    .replace(/÷/g, '/')
    .replace(/·/g, '*')
    .replace(/π/g, 'pi')
    .replace(/²/g, '^2')
    .replace(/³/g, '^3')
    .replace(/⁴/g, '^4')
    .replace(/√\s*\(/g, 'sqrt(')
    .replace(/√\s*([A-Za-z0-9]+)/g, 'sqrt($1)');

  return expr.trim();
}

function tokenizeExpression(expr: string): Token[] {
  const rawTokens: Token[] = [];
  let i = 0;

  while (i < expr.length) {
    const ch = expr[i];
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }

    if (/[0-9.]/.test(ch)) {
      const match = expr.slice(i).match(/^(?:\d+(?:\.\d*)?|\.\d+)/);
      if (!match) {
        throw new Error(`Invalid number near "${expr.slice(i, i + 8)}"`);
      }
      const num = Number(match[0]);
      if (!Number.isFinite(num)) {
        throw new Error(`Numeric overflow near "${match[0]}"`);
      }
      rawTokens.push({ type: 'number', value: num });
      i += match[0].length;
      continue;
    }

    if (/[A-Za-z]/.test(ch)) {
      const match = expr.slice(i).match(/^[A-Za-z]+/);
      if (!match) {
        throw new Error(`Invalid symbol near "${ch}"`);
      }
      const word = match[0].toLowerCase();
      if (
        word === 'x' ||
        ALLOWED_FUNCTIONS.has(word) ||
        Object.prototype.hasOwnProperty.call(ALLOWED_CONSTANTS, word)
      ) {
        rawTokens.push({ type: 'ident', value: word });
      } else if (/^[xe]+$/.test(word) || word === 'pix') {
        // Support e.g. 'pix' -> pi * x, or split single-letter 'x'
        if (word === 'pix') {
          rawTokens.push({ type: 'ident', value: 'pi' }, { type: 'ident', value: 'x' });
        } else {
          throw new Error(`Unsupported symbol "${match[0]}" in graph equation.`);
        }
      } else {
        throw new Error(`Unsupported function or variable "${match[0]}" in graph equation.`);
      }
      i += match[0].length;
      continue;
    }

    if (ch === '+' || ch === '-' || ch === '*' || ch === '/' || ch === '^') {
      rawTokens.push({ type: 'op', value: ch });
      i += 1;
      continue;
    }

    if (ch === '(') {
      rawTokens.push({ type: 'lparen' });
      i += 1;
      continue;
    }

    if (ch === ')') {
      rawTokens.push({ type: 'rparen' });
      i += 1;
      continue;
    }

    throw new Error(`Unexpected character "${ch}" in graph equation.`);
  }

  // Insert implicit multiplication tokens:
  // 2 x, 2 (, ) x, ) (, x (, 2 sin(x), pi x
  const tokens: Token[] = [];
  for (let k = 0; k < rawTokens.length; k++) {
    const cur = rawTokens[k];
    if (k > 0) {
      const prev = rawTokens[k - 1];
      const prevEndsOperand =
        prev.type === 'number' ||
        prev.type === 'rparen' ||
        (prev.type === 'ident' && !ALLOWED_FUNCTIONS.has(prev.value));
      const curStartsOperand =
        cur.type === 'number' || cur.type === 'ident' || cur.type === 'lparen';
      if (prevEndsOperand && curStartsOperand) {
        tokens.push({ type: 'op', value: '*' });
      }
    }
    tokens.push(cur);
  }

  return tokens;
}

type AstNode =
  | { kind: 'num'; value: number }
  | { kind: 'var' }
  | { kind: 'unary'; op: '-'; arg: AstNode }
  | { kind: 'binary'; op: '+' | '-' | '*' | '/' | '^'; left: AstNode; right: AstNode }
  | { kind: 'call'; fn: string; arg: AstNode };

class RecursiveExprParser {
  private tokens: Token[];
  private pos = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private consume(): Token | undefined {
    const t = this.tokens[this.pos];
    this.pos += 1;
    return t;
  }

  parse(): AstNode {
    if (this.tokens.length === 0) {
      throw new Error('Equation expression cannot be empty.');
    }
    const node = this.parseAddSub();
    if (this.pos < this.tokens.length) {
      throw new Error('Unexpected trailing tokens in equation.');
    }
    return node;
  }

  private parseAddSub(): AstNode {
    let left = this.parseMulDiv();
    while (true) {
      const t = this.peek();
      if (t?.type === 'op' && (t.value === '+' || t.value === '-')) {
        this.consume();
        const right = this.parseMulDiv();
        left = { kind: 'binary', op: t.value, left, right };
      } else {
        break;
      }
    }
    return left;
  }

  private parseMulDiv(): AstNode {
    let left = this.parseUnary();
    while (true) {
      const t = this.peek();
      if (t?.type === 'op' && (t.value === '*' || t.value === '/')) {
        this.consume();
        const right = this.parseUnary();
        left = { kind: 'binary', op: t.value, left, right };
      } else {
        break;
      }
    }
    return left;
  }

  private parseUnary(): AstNode {
    const t = this.peek();
    if (t?.type === 'op' && t.value === '-') {
      this.consume();
      return { kind: 'unary', op: '-', arg: this.parseUnary() };
    }
    if (t?.type === 'op' && t.value === '+') {
      this.consume();
      return this.parseUnary();
    }
    return this.parsePower();
  }

  private parsePower(): AstNode {
    const base = this.parsePrimary();
    const t = this.peek();
    if (t?.type === 'op' && t.value === '^') {
      this.consume();
      // Right-associative power, allow unary sign in exponent e.g. x^-2
      const exponent = this.parseUnary();
      return { kind: 'binary', op: '^', left: base, right: exponent };
    }
    return base;
  }

  private parsePrimary(): AstNode {
    const t = this.peek();
    if (!t) {
      throw new Error('Unexpected end of equation expression.');
    }

    if (t.type === 'number') {
      this.consume();
      return { kind: 'num', value: t.value };
    }

    if (t.type === 'ident') {
      this.consume();
      if (t.value === 'x') {
        return { kind: 'var' };
      }
      if (Object.prototype.hasOwnProperty.call(ALLOWED_CONSTANTS, t.value)) {
        return { kind: 'num', value: ALLOWED_CONSTANTS[t.value] };
      }
      if (ALLOWED_FUNCTIONS.has(t.value)) {
        const next = this.peek();
        if (next?.type === 'lparen') {
          this.consume();
          const arg = this.parseAddSub();
          const close = this.consume();
          if (close?.type !== 'rparen') {
            throw new Error(`Missing closing ")" after ${t.value}(...)`);
          }
          return { kind: 'call', fn: t.value, arg };
        }
        // Also support sin x without parens when unary-like
        const arg = this.parseUnary();
        return { kind: 'call', fn: t.value, arg };
      }
    }

    if (t.type === 'lparen') {
      this.consume();
      const inner = this.parseAddSub();
      const close = this.consume();
      if (close?.type !== 'rparen') {
        throw new Error('Unmatched "(" in equation expression.');
      }
      return inner;
    }

    throw new Error('Invalid syntax in equation expression.');
  }
}

function evaluateAst(node: AstNode, x: number): number | null {
  switch (node.kind) {
    case 'num':
      return Number.isFinite(node.value) ? node.value : null;
    case 'var':
      return Number.isFinite(x) ? x : null;
    case 'unary': {
      const val = evaluateAst(node.arg, x);
      return val === null ? null : -val;
    }
    case 'binary': {
      const left = evaluateAst(node.left, x);
      const right = evaluateAst(node.right, x);
      if (left === null || right === null) return null;
      let res: number;
      if (node.op === '+') res = left + right;
      else if (node.op === '-') res = left - right;
      else if (node.op === '*') res = left * right;
      else if (node.op === '/') {
        if (Math.abs(right) < 1e-12) return null;
        res = left / right;
      } else {
        // Guard fractional negative base cleanly
        if (left < 0 && !Number.isInteger(right)) return null;
        res = Math.pow(left, right);
      }
      return Number.isFinite(res) ? res : null;
    }
    case 'call': {
      const arg = evaluateAst(node.arg, x);
      if (arg === null) return null;
      let res: number;
      switch (node.fn) {
        case 'sin':
          res = Math.sin(arg);
          break;
        case 'cos':
          res = Math.cos(arg);
          break;
        case 'tan':
          if (Math.abs(Math.cos(arg)) < 1e-9) return null;
          res = Math.tan(arg);
          break;
        case 'abs':
          res = Math.abs(arg);
          break;
        case 'sqrt':
          if (arg < 0) return null;
          res = Math.sqrt(arg);
          break;
        case 'cbrt':
          res = Math.cbrt(arg);
          break;
        case 'ln':
          if (arg <= 0) return null;
          res = Math.log(arg);
          break;
        case 'log':
          if (arg <= 0) return null;
          res = Math.log10(arg);
          break;
        case 'exp':
          res = Math.exp(arg);
          break;
        case 'floor':
          res = Math.floor(arg);
          break;
        case 'ceil':
          res = Math.ceil(arg);
          break;
        default:
          return null;
      }
      return Number.isFinite(res) ? res : null;
    }
  }
}

export function compileSafeMathExpression(rawExpression: string): {
  ok: boolean;
  error?: string;
  normalized?: string;
  evaluate?: (x: number) => number | null;
} {
  const sanitized = sanitizeDiagramText(rawExpression, MAX_DIAGRAM_EXPRESSION_LENGTH);
  if (!sanitized.ok) {
    return { ok: false, error: sanitized.error };
  }
  if (!sanitized.value) {
    return { ok: false, error: 'Equation cannot be empty.' };
  }

  try {
    const normalized = normalizeExpressionInput(sanitized.value);
    const tokens = tokenizeExpression(normalized);
    const ast = new RecursiveExprParser(tokens).parse();
    return {
      ok: true,
      normalized,
      evaluate: (x: number) => evaluateAst(ast, x),
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Invalid mathematical expression.',
    };
  }
}

// ============================================================================
// STRUCTURAL DIAGRAM VALIDATION & SANITIZATION
// ============================================================================

const ALLOWED_SHAPE_KINDS = new Set([
  'rectangle',
  'square',
  'triangle',
  'right_triangle',
  'equilateral_triangle',
  'isosceles_triangle',
  'circle',
  'semicircle',
  'ellipse',
  'parallelogram',
  'trapezium',
  'rhombus',
  'kite',
  'polygon',
]);

const ALLOWED_LINE_KINDS = new Set([
  'line',
  'segment',
  'horizontal',
  'vertical',
  'diagonal',
  'parallel_pair',
  'perpendicular_pair',
  'radius',
  'diameter',
  'chord',
  'tangent',
  'arc',
  'sector',
  'measurement',
]);

const ALLOWED_ANGLE_KINDS = new Set([
  'acute',
  'right',
  'obtuse',
  'straight',
  'reflex',
  'arc',
]);

const ALLOWED_UNITS = new Set(['', 'mm', 'cm', 'm', 'km']);

export function validateAndSanitizeDiagramSpec(raw: unknown): DiagramValidationResult {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: 'Diagram specification must be a structured JSON object.' };
  }

  const obj = raw as Record<string, unknown>;
  if (obj.version !== 1) {
    return { ok: false, error: 'Unsupported or missing diagram schema version.' };
  }

  const mode = obj.mode;
  if (mode !== 'geometry' && mode !== 'graph' && mode !== 'chart') {
    return { ok: false, error: 'Invalid diagram mode.' };
  }

  const width = isFiniteInRange(obj.width, 180, 1200) ? obj.width : 560;
  const height = isFiniteInRange(obj.height, 120, 900) ? obj.height : 340;
  if (obj.width !== undefined && !isFiniteInRange(obj.width, 180, 1200)) {
    return { ok: false, error: 'Diagram width out of valid bounds (180-1200).' };
  }
  if (obj.height !== undefined && !isFiniteInRange(obj.height, 120, 900)) {
    return { ok: false, error: 'Diagram height out of valid bounds (120-900).' };
  }

  const titleCheck = sanitizeDiagramText(obj.title, 120);
  if (!titleCheck.ok) return { ok: false, error: titleCheck.error };

  const captionCheck = sanitizeDiagramText(obj.caption, 180);
  if (!captionCheck.ok) return { ok: false, error: captionCheck.error };

  const sanitized: CBTDiagramSpec = {
    version: 1,
    mode,
    width,
    height,
    title: titleCheck.value || undefined,
    caption: captionCheck.value || undefined,
    gridEnabled: Boolean(obj.gridEnabled),
    snapToGrid: Boolean(obj.snapToGrid),
    gridSize: isFiniteInRange(obj.gridSize, 5, 100) ? obj.gridSize : 20,
    notDrawnToScale: Boolean(obj.notDrawnToScale),
  };

  if (mode === 'geometry') {
    const geom = obj.geometry as Record<string, unknown> | undefined;
    if (!geom || !Array.isArray(geom.elements)) {
      return { ok: false, error: 'Geometry diagram must contain an elements array.' };
    }
    if (geom.elements.length > MAX_DIAGRAM_ELEMENTS) {
      return {
        ok: false,
        error: `Geometry diagram exceeds maximum element limit (${MAX_DIAGRAM_ELEMENTS}).`,
      };
    }

    const cleanElements: GeometryElement[] = [];
    for (let idx = 0; idx < geom.elements.length; idx++) {
      const el = geom.elements[idx] as Record<string, unknown>;
      if (!el || typeof el !== 'object') {
        return { ok: false, error: `Invalid geometry element at index ${idx}.` };
      }
      const elId =
        typeof el.id === 'string' && el.id.trim() ? el.id.trim().slice(0, 64) : `el-${idx}`;

      if (el.kind === 'shape') {
        if (typeof el.shapeKind !== 'string' || !ALLOWED_SHAPE_KINDS.has(el.shapeKind)) {
          return { ok: false, error: `Unsupported shapeKind at index ${idx}.` };
        }
        if (
          !isFiniteInRange(el.x, -200, 1400) ||
          !isFiniteInRange(el.y, -200, 1100) ||
          !isFiniteInRange(el.width, 8, 1200) ||
          !isFiniteInRange(el.height, 8, 900)
        ) {
          return { ok: false, error: `Shape coordinates or size out of range at index ${idx}.` };
        }
        const rotation = isFiniteInRange(el.rotation ?? 0, -360, 360)
          ? Number(el.rotation ?? 0)
          : 0;

        const cleanVertexLabels: string[] = [];
        if (Array.isArray(el.vertexLabels)) {
          for (const vl of el.vertexLabels.slice(0, 12)) {
            const vCheck = sanitizeDiagramText(vl ?? '', 16);
            if (!vCheck.ok) return { ok: false, error: vCheck.error };
            cleanVertexLabels.push(vCheck.value);
          }
        }

        const cleanSideLabels: Record<string, string> = {};
        if (el.sideLabels && typeof el.sideLabels === 'object' && !Array.isArray(el.sideLabels)) {
          for (const [k, v] of Object.entries(el.sideLabels as Record<string, unknown>).slice(0, 12)) {
            if (!/^\d+$/.test(k)) continue;
            const sCheck = sanitizeDiagramText(v ?? '', 36);
            if (!sCheck.ok) return { ok: false, error: sCheck.error };
            if (sCheck.value) cleanSideLabels[k] = sCheck.value;
          }
        }

        const unit = typeof el.unit === 'string' && ALLOWED_UNITS.has(el.unit) ? el.unit : '';

        cleanElements.push({
          id: elId,
          kind: 'shape',
          shapeKind: el.shapeKind as any,
          x: el.x,
          y: el.y,
          width: el.width,
          height: el.height,
          rotation,
          sides: isFiniteInRange(el.sides, 3, 12) ? Math.round(el.sides) : undefined,
          topRatio: isFiniteInRange(el.topRatio, 0.15, 0.95) ? el.topRatio : undefined,
          skewRatio: isFiniteInRange(el.skewRatio, -0.6, 0.6) ? el.skewRatio : undefined,
          strokeColor: sanitizeColor(el.strokeColor, '#0f172a'),
          strokeWidth: isFiniteInRange(el.strokeWidth, 0.5, 10) ? el.strokeWidth : 2,
          fillColor: sanitizeColor(el.fillColor, '#e0f2fe'),
          fillTransparent: Boolean(el.fillTransparent),
          lineStyle:
            el.lineStyle === 'dashed' || el.lineStyle === 'dotted' ? el.lineStyle : 'solid',
          vertexLabels: cleanVertexLabels.length > 0 ? cleanVertexLabels : undefined,
          sideLabels: Object.keys(cleanSideLabels).length > 0 ? cleanSideLabels : undefined,
          unit: unit as any,
          rightAngleCorner: isFiniteInRange(el.rightAngleCorner, 0, 10)
            ? Math.round(el.rightAngleCorner)
            : undefined,
          hideMeasurement: el.hideMeasurement ? true : undefined,
        });
      } else if (el.kind === 'line') {
        if (typeof el.lineKind !== 'string' || !ALLOWED_LINE_KINDS.has(el.lineKind)) {
          return { ok: false, error: `Unsupported lineKind at index ${idx}.` };
        }
        if (
          !isFiniteInRange(el.x1, -200, 1400) ||
          !isFiniteInRange(el.y1, -200, 1100) ||
          !isFiniteInRange(el.x2, -200, 1400) ||
          !isFiniteInRange(el.y2, -200, 1100)
        ) {
          return { ok: false, error: `Line coordinates out of range at index ${idx}.` };
        }
        const labelCheck = sanitizeDiagramText(el.label, 48);
        if (!labelCheck.ok) return { ok: false, error: labelCheck.error };
        const unit = typeof el.unit === 'string' && ALLOWED_UNITS.has(el.unit) ? el.unit : '';

        cleanElements.push({
          id: elId,
          kind: 'line',
          lineKind: el.lineKind as any,
          x1: el.x1,
          y1: el.y1,
          x2: el.x2,
          y2: el.y2,
          radius: isFiniteInRange(el.radius, 5, 500) ? el.radius : undefined,
          startAngleDeg: isFiniteInRange(el.startAngleDeg, -360, 720)
            ? el.startAngleDeg
            : undefined,
          endAngleDeg: isFiniteInRange(el.endAngleDeg, -360, 720) ? el.endAngleDeg : undefined,
          strokeColor: sanitizeColor(el.strokeColor, '#0f172a'),
          strokeWidth: isFiniteInRange(el.strokeWidth, 0.5, 10) ? el.strokeWidth : 2,
          fillColor: el.fillColor ? sanitizeColor(el.fillColor, '#bae6fd') : undefined,
          fillTransparent: el.fillTransparent !== undefined ? Boolean(el.fillTransparent) : undefined,
          lineStyle:
            el.lineStyle === 'dashed' || el.lineStyle === 'dotted' ? el.lineStyle : 'solid',
          arrowStart: Boolean(el.arrowStart),
          arrowEnd: Boolean(el.arrowEnd),
          parallelTicks: isFiniteInRange(el.parallelTicks, 0, 3)
            ? Math.round(el.parallelTicks)
            : undefined,
          equalTicks: isFiniteInRange(el.equalTicks, 0, 3) ? Math.round(el.equalTicks) : undefined,
          label: labelCheck.value || undefined,
          unit: unit as any,
          hideMeasurement: el.hideMeasurement ? true : undefined,
        });
      } else if (el.kind === 'angle') {
        if (typeof el.angleKind !== 'string' || !ALLOWED_ANGLE_KINDS.has(el.angleKind)) {
          return { ok: false, error: `Unsupported angleKind at index ${idx}.` };
        }
        if (
          !isFiniteInRange(el.cx, -200, 1400) ||
          !isFiniteInRange(el.cy, -200, 1100) ||
          !isFiniteInRange(el.radius, 6, 400) ||
          !isFiniteInRange(el.startAngleDeg, -360, 720) ||
          !isFiniteInRange(el.sweepAngleDeg, -360, 360)
        ) {
          return { ok: false, error: `Angle parameters out of range at index ${idx}.` };
        }
        const labelCheck = sanitizeDiagramText(el.label, 32);
        if (!labelCheck.ok) return { ok: false, error: labelCheck.error };

        cleanElements.push({
          id: elId,
          kind: 'angle',
          angleKind: el.angleKind as any,
          cx: el.cx,
          cy: el.cy,
          radius: el.radius,
          startAngleDeg: el.startAngleDeg,
          sweepAngleDeg: el.sweepAngleDeg,
          drawRays: el.drawRays !== undefined ? Boolean(el.drawRays) : undefined,
          rayLength: isFiniteInRange(el.rayLength, 20, 500) ? el.rayLength : undefined,
          rightAngleSquare: Boolean(el.rightAngleSquare),
          label: labelCheck.value || undefined,
          showDegreeSymbol:
            el.showDegreeSymbol !== undefined ? Boolean(el.showDegreeSymbol) : undefined,
          hideMeasurement: el.hideMeasurement ? true : undefined,
          strokeColor: sanitizeColor(el.strokeColor, '#b45309'),
          strokeWidth: isFiniteInRange(el.strokeWidth, 0.5, 8) ? el.strokeWidth : 2,
          fillColor: el.fillColor ? sanitizeColor(el.fillColor, '#fef3c7') : undefined,
        });
      } else if (el.kind === 'label') {
        if (!isFiniteInRange(el.x, -200, 1400) || !isFiniteInRange(el.y, -200, 1100)) {
          return { ok: false, error: `Label coordinates out of range at index ${idx}.` };
        }
        const textCheck = sanitizeDiagramText(el.text, 80);
        if (!textCheck.ok) return { ok: false, error: textCheck.error };
        cleanElements.push({
          id: elId,
          kind: 'label',
          x: el.x,
          y: el.y,
          text: textCheck.value,
          fontSize: isFiniteInRange(el.fontSize, 8, 36) ? el.fontSize : 14,
          color: sanitizeColor(el.color, '#0f172a'),
          bold: Boolean(el.bold),
          italic: Boolean(el.italic),
        });
      } else {
        return { ok: false, error: `Unknown geometry element kind at index ${idx}.` };
      }
    }

    sanitized.geometry = { elements: cleanElements };
    return { ok: true, sanitized };
  }

  if (mode === 'graph') {
    const g = obj.graph as Record<string, unknown> | undefined;
    if (!g || typeof g !== 'object') {
      return { ok: false, error: 'Graph diagram requires a graph configuration.' };
    }
    if (
      !isFiniteInRange(g.xMin, -10000, 10000) ||
      !isFiniteInRange(g.xMax, -10000, 10000) ||
      !isFiniteInRange(g.yMin, -10000, 10000) ||
      !isFiniteInRange(g.yMax, -10000, 10000) ||
      g.xMin >= g.xMax ||
      g.yMin >= g.yMax
    ) {
      return { ok: false, error: 'Graph axis min/max bounds are invalid.' };
    }

    const xStep = isFiniteInRange(g.xStep, 0.01, 1000) ? g.xStep : 1;
    const yStep = isFiniteInRange(g.yStep, 0.01, 1000) ? g.yStep : 1;

    const xLabel = sanitizeDiagramText(g.xLabel, 40);
    const yLabel = sanitizeDiagramText(g.yLabel, 40);
    const xUnit = sanitizeDiagramText(g.xUnit, 16);
    const yUnit = sanitizeDiagramText(g.yUnit, 16);
    if (!xLabel.ok || !yLabel.ok || !xUnit.ok || !yUnit.ok) {
      return { ok: false, error: 'Invalid graph axis label or unit.' };
    }

    const equations: GraphEquationItem[] = [];
    if (Array.isArray(g.equations)) {
      if (g.equations.length > 8) {
        return { ok: false, error: 'Graph cannot contain more than 8 equations.' };
      }
      for (const eq of g.equations) {
        if (!eq || typeof eq !== 'object') continue;
        const eqObj = eq as Record<string, unknown>;
        const exprStr = typeof eqObj.expression === 'string' ? eqObj.expression.trim() : '';
        const compiled = compileSafeMathExpression(exprStr);
        if (!compiled.ok) {
          return { ok: false, error: compiled.error || `Invalid graph equation: "${exprStr}"` };
        }
        const eqLabel = sanitizeDiagramText(eqObj.label, 48);
        if (!eqLabel.ok) return { ok: false, error: eqLabel.error };
        equations.push({
          id: typeof eqObj.id === 'string' ? eqObj.id : `eq-${equations.length + 1}`,
          expression: exprStr,
          label: eqLabel.value || undefined,
          color: sanitizeColor(eqObj.color, '#2563eb'),
          strokeWidth: isFiniteInRange(eqObj.strokeWidth, 1, 6) ? eqObj.strokeWidth : 2.5,
          dashed: Boolean(eqObj.dashed),
        });
      }
    }

    const points: GraphPointItem[] = [];
    if (Array.isArray(g.points)) {
      if (g.points.length > 80) {
        return { ok: false, error: 'Graph cannot contain more than 80 plotted points.' };
      }
      for (const pt of g.points) {
        if (!pt || typeof pt !== 'object') continue;
        const pObj = pt as Record<string, unknown>;
        if (!isFiniteInRange(pObj.x, -10000, 10000) || !isFiniteInRange(pObj.y, -10000, 10000)) {
          return { ok: false, error: 'Graph point coordinates must be finite numbers.' };
        }
        const pLabel = sanitizeDiagramText(pObj.label, 24);
        if (!pLabel.ok) return { ok: false, error: pLabel.error };
        points.push({
          id: typeof pObj.id === 'string' ? pObj.id : `pt-${points.length + 1}`,
          x: pObj.x,
          y: pObj.y,
          label: pLabel.value || undefined,
          color: sanitizeColor(pObj.color, '#dc2626'),
          showCoordinates: pObj.showCoordinates !== false,
        });
      }
    }

    const graphConfig: CoordinateGraphConfig = {
      xMin: g.xMin,
      xMax: g.xMax,
      yMin: g.yMin,
      yMax: g.yMax,
      xStep,
      yStep,
      xLabel: xLabel.value || 'x',
      yLabel: yLabel.value || 'y',
      xUnit: xUnit.value || undefined,
      yUnit: yUnit.value || undefined,
      showGrid: g.showGrid !== false,
      showOriginLabel: g.showOriginLabel !== false,
      equations,
      points,
      connectPoints: Boolean(g.connectPoints),
      connectColor: sanitizeColor(g.connectColor, '#059669'),
      closePolygon: Boolean(g.closePolygon),
    };

    sanitized.graph = graphConfig;
    return { ok: true, sanitized };
  }

  // Statistical charts
  const c = obj.chart as Record<string, unknown> | undefined;
  if (!c || typeof c !== 'object') {
    return { ok: false, error: 'Statistical chart diagram requires a chart configuration.' };
  }
  const allowedChartTypes = new Set([
    'bar',
    'histogram',
    'pie',
    'line',
    'frequency_polygon',
    'scatter',
  ]);
  if (typeof c.chartType !== 'string' || !allowedChartTypes.has(c.chartType)) {
    return { ok: false, error: 'Invalid statistical chartType.' };
  }

  const xAxisLabel = sanitizeDiagramText(c.xAxisLabel, 60);
  const yAxisLabel = sanitizeDiagramText(c.yAxisLabel, 60);
  if (!xAxisLabel.ok || !yAxisLabel.ok) {
    return { ok: false, error: 'Invalid chart axis label.' };
  }

  const categories: ChartCategoryItem[] = [];
  if (Array.isArray(c.categories)) {
    if (c.categories.length > 40) {
      return { ok: false, error: 'Chart exceeds maximum of 40 categories.' };
    }
    for (const item of c.categories) {
      if (!item || typeof item !== 'object') continue;
      const it = item as Record<string, unknown>;
      const lbl = sanitizeDiagramText(it.label, 40);
      if (!lbl.ok) return { ok: false, error: lbl.error };
      if (!isFiniteInRange(it.value, 0, 1_000_000_000)) {
        return { ok: false, error: 'Chart category values must be finite non-negative numbers.' };
      }
      categories.push({
        id: typeof it.id === 'string' ? it.id : `cat-${categories.length + 1}`,
        label: lbl.value || `Item ${categories.length + 1}`,
        value: it.value,
        color: sanitizeColor(it.color, '#2563eb'),
      });
    }
  }

  const bins: ChartHistogramBin[] = [];
  if (Array.isArray(c.bins)) {
    if (c.bins.length > 40) {
      return { ok: false, error: 'Histogram exceeds maximum of 40 class intervals.' };
    }
    for (const item of c.bins) {
      if (!item || typeof item !== 'object') continue;
      const it = item as Record<string, unknown>;
      if (
        !isFiniteInRange(it.min, -1_000_000, 1_000_000) ||
        !isFiniteInRange(it.max, -1_000_000, 1_000_000) ||
        it.min >= it.max ||
        !isFiniteInRange(it.frequency, 0, 1_000_000_000)
      ) {
        return { ok: false, error: 'Invalid histogram class interval or frequency.' };
      }
      bins.push({
        id: typeof it.id === 'string' ? it.id : `bin-${bins.length + 1}`,
        min: it.min,
        max: it.max,
        frequency: it.frequency,
        color: sanitizeColor(it.color, '#0284c7'),
      });
    }
  }

  const scatterPoints: ChartScatterPoint[] = [];
  if (Array.isArray(c.scatterPoints)) {
    if (c.scatterPoints.length > 100) {
      return { ok: false, error: 'Scatter plot exceeds maximum of 100 points.' };
    }
    for (const item of c.scatterPoints) {
      if (!item || typeof item !== 'object') continue;
      const it = item as Record<string, unknown>;
      if (
        !isFiniteInRange(it.x, -1_000_000, 1_000_000) ||
        !isFiniteInRange(it.y, -1_000_000, 1_000_000)
      ) {
        return { ok: false, error: 'Scatter plot points must have finite coordinates.' };
      }
      const lbl = sanitizeDiagramText(it.label, 24);
      if (!lbl.ok) return { ok: false, error: lbl.error };
      scatterPoints.push({
        id: typeof it.id === 'string' ? it.id : `sp-${scatterPoints.length + 1}`,
        x: it.x,
        y: it.y,
        label: lbl.value || undefined,
      });
    }
  }

  const chartConfig: StatisticalChartConfig = {
    chartType: c.chartType as StatisticalChartConfig['chartType'],
    xAxisLabel: xAxisLabel.value || undefined,
    yAxisLabel: yAxisLabel.value || undefined,
    showGrid: c.showGrid !== false,
    showLegend: Boolean(c.showLegend),
    showValues: c.showValues !== false,
    yMin: isFiniteInRange(c.yMin, -1_000_000, 1_000_000) ? c.yMin : undefined,
    yMax: isFiniteInRange(c.yMax, -1_000_000, 1_000_000_000) ? c.yMax : undefined,
    yStep: isFiniteInRange(c.yStep, 0.01, 1_000_000_000) ? c.yStep : undefined,
    categories: categories.length > 0 ? categories : undefined,
    bins: bins.length > 0 ? bins : undefined,
    scatterPoints: scatterPoints.length > 0 ? scatterPoints : undefined,
    accentColor: sanitizeColor(c.accentColor, '#2563eb'),
  };

  sanitized.chart = chartConfig;
  return { ok: true, sanitized };
}
