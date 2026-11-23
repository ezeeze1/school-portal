import katex from 'katex';

export interface MathSegment {
  type: 'text' | 'math';
  content: string;
  displayMode: boolean;
  raw: string;
}

const UNICODE_FRACTIONS: Record<string, string> = {
  '½': '\\frac{1}{2}',
  '⅓': '\\frac{1}{3}',
  '⅔': '\\frac{2}{3}',
  '¼': '\\frac{1}{4}',
  '¾': '\\frac{3}{4}',
  '⅕': '\\frac{1}{5}',
  '⅖': '\\frac{2}{5}',
  '⅗': '\\frac{3}{5}',
  '⅘': '\\frac{4}{5}',
  '⅙': '\\frac{1}{6}',
  '⅚': '\\frac{5}{6}',
  '⅐': '\\frac{1}{7}',
  '⅛': '\\frac{1}{8}',
  '⅜': '\\frac{3}{8}',
  '⅝': '\\frac{5}{8}',
  '⅞': '\\frac{7}{8}',
  '⅑': '\\frac{1}{9}',
  '⅒': '\\frac{1}{10}',
};

const UNICODE_SUPERSCRIPTS: Record<string, string> = {
  '⁰': '0',
  '¹': '1',
  '²': '2',
  '³': '3',
  '⁴': '4',
  '⁵': '5',
  '⁶': '6',
  '⁷': '7',
  '⁸': '8',
  '⁹': '9',
  '⁺': '+',
  '⁻': '-',
  '⁼': '=',
  '⁽': '(',
  '⁾': ')',
  'ⁿ': 'n',
  'ⁱ': 'i',
};

const UNICODE_SUBSCRIPTS: Record<string, string> = {
  '₀': '0',
  '₁': '1',
  '₂': '2',
  '₃': '3',
  '₄': '4',
  '₅': '5',
  '₆': '6',
  '₇': '7',
  '₈': '8',
  '₉': '9',
  '₊': '+',
  '₋': '-',
  '₌': '=',
  '₍': '(',
  '₎': ')',
};

const UNICODE_TO_LATEX_SYMBOLS: Array<[string, string]> = [
  ['−', '-'],
  ['×', '\\times '],
  ['÷', '\\div '],
  ['±', '\\pm '],
  ['∓', '\\mp '],
  ['·', '\\cdot '],
  ['≤', '\\le '],
  ['≥', '\\ge '],
  ['≠', '\\ne '],
  ['≈', '\\approx '],
  ['≡', '\\equiv '],
  ['∝', '\\propto '],
  ['∞', '\\infty '],
  ['°', '^{\\circ}'],
  ['π', '\\pi '],
  ['θ', '\\theta '],
  ['α', '\\alpha '],
  ['β', '\\beta '],
  ['γ', '\\gamma '],
  ['δ', '\\delta '],
  ['λ', '\\lambda '],
  ['μ', '\\mu '],
  ['σ', '\\sigma '],
  ['ϕ', '\\phi '],
  ['φ', '\\varphi '],
  ['ω', '\\omega '],
  ['Δ', '\\Delta '],
  ['Σ', '\\Sigma '],
  ['Ω', '\\Omega '],
  ['∠', '\\angle '],
  ['△', '\\triangle '],
  ['⊥', '\\perp '],
  ['∥', '\\parallel '],
  ['⇒', '\\Rightarrow '],
  ['⇔', '\\Leftrightarrow '],
  ['→', '\\to '],
  ['∈', '\\in '],
  ['∉', '\\notin '],
  ['⊂', '\\subset '],
  ['⊆', '\\subseteq '],
  ['∪', '\\cup '],
  ['∩', '\\cap '],
  ['∅', '\\emptyset '],
  ['∑', '\\sum '],
  ['∫', '\\int '],
  ['∴', '\\therefore '],
  ['∵', '\\because '],
];

const KNOWN_LATEX_COMMANDS = new Set([
  'frac',
  'dfrac',
  'tfrac',
  'cfrac',
  'sqrt',
  'binom',
  'pm',
  'mp',
  'times',
  'div',
  'cdot',
  'ast',
  'le',
  'leq',
  'ge',
  'geq',
  'ne',
  'neq',
  'approx',
  'equiv',
  'propto',
  'sim',
  'simeq',
  'cong',
  'sin',
  'cos',
  'tan',
  'cot',
  'sec',
  'csc',
  'arcsin',
  'arccos',
  'arctan',
  'sinh',
  'cosh',
  'tanh',
  'log',
  'ln',
  'lg',
  'lim',
  'sup',
  'inf',
  'max',
  'min',
  'sum',
  'prod',
  'int',
  'iint',
  'oint',
  'infty',
  'alpha',
  'beta',
  'gamma',
  'delta',
  'epsilon',
  'varepsilon',
  'zeta',
  'eta',
  'theta',
  'vartheta',
  'iota',
  'kappa',
  'lambda',
  'mu',
  'nu',
  'xi',
  'pi',
  'rho',
  'sigma',
  'tau',
  'upsilon',
  'phi',
  'varphi',
  'chi',
  'psi',
  'omega',
  'Gamma',
  'Delta',
  'Theta',
  'Lambda',
  'Xi',
  'Pi',
  'Sigma',
  'Upsilon',
  'Phi',
  'Psi',
  'Omega',
  'angle',
  'measuredangle',
  'triangle',
  'perp',
  'parallel',
  'circ',
  'degree',
  'vec',
  'bar',
  'overline',
  'underline',
  'hat',
  'tilde',
  'to',
  'rightarrow',
  'leftarrow',
  'leftrightarrow',
  'Rightarrow',
  'Leftarrow',
  'Leftrightarrow',
  'in',
  'notin',
  'subset',
  'subseteq',
  'supset',
  'supseteq',
  'cup',
  'cap',
  'emptyset',
  'varnothing',
  'therefore',
  'because',
  'forall',
  'exists',
  'left',
  'right',
  'text',
  'mathrm',
  'mathbf',
]);

const KNOWN_PLAIN_MATH_WORDS = new Set([
  'sin',
  'cos',
  'tan',
  'cot',
  'sec',
  'csc',
  'arcsin',
  'arccos',
  'arctan',
  'log',
  'ln',
  'lim',
  'mod',
  'max',
  'min',
  'det',
  'gcd',
  'lcm',
  'exp',
]);

function readBalancedParen(str: string, openIndex: number): { inner: string; endIndex: number } | null {
  if (str[openIndex] !== '(') return null;
  let depth = 0;
  for (let i = openIndex; i < str.length; i++) {
    if (str[i] === '(') depth += 1;
    else if (str[i] === ')') {
      depth -= 1;
      if (depth === 0) {
        return { inner: str.slice(openIndex + 1, i), endIndex: i + 1 };
      }
    }
  }
  return null;
}

function readBalancedBraceOrBracket(
  str: string,
  openIndex: number,
  openChar: '{' | '[',
  closeChar: '}' | ']'
): { raw: string; endIndex: number } | null {
  if (str[openIndex] !== openChar) return null;
  let depth = 0;
  for (let i = openIndex; i < str.length; i++) {
    if (str[i] === '\\' && i + 1 < str.length) {
      i += 1;
      continue;
    }
    if (str[i] === openChar) depth += 1;
    else if (str[i] === closeChar) {
      depth -= 1;
      if (depth === 0) {
        return { raw: str.slice(openIndex, i + 1), endIndex: i + 1 };
      }
    }
  }
  return null;
}

function replaceUnicodeRadicals(input: string, radicalChar: string, latexPrefix: string): string {
  let out = '';
  let i = 0;
  while (i < input.length) {
    if (input[i] === radicalChar) {
      const next = input[i + 1];
      if (next === '(') {
        const balanced = readBalancedParen(input, i + 1);
        if (balanced) {
          out += `${latexPrefix}{${balanced.inner}}`;
          i = balanced.endIndex;
          continue;
        }
      }
      if (next === '{') {
        const balanced = readBalancedBraceOrBracket(input, i + 1, '{', '}');
        if (balanced) {
          out += `${latexPrefix}${balanced.raw}`;
          i = balanced.endIndex;
          continue;
        }
      }
      const tokenMatch = input.slice(i + 1).match(/^[A-Za-z0-9²³⁴⁵⁶⁷⁸⁹]+(?:\.[0-9²³⁴⁵⁶⁷⁸⁹]+)?/);
      if (tokenMatch) {
        out += `${latexPrefix}{${tokenMatch[0]}}`;
        i += 1 + tokenMatch[0].length;
        continue;
      }
      out += latexPrefix;
      i += 1;
      continue;
    }
    out += input[i];
    i += 1;
  }
  return out;
}

/**
 * Normalizes common Unicode mathematical notation (superscripts, subscripts,
 * fractions, radicals, Greek symbols, operators) into valid LaTeX so KaTeX
 * never throws parse errors when teachers combine Unicode with LaTeX.
 */
export function normalizeUnicodeMathToLatex(expr: string): string {
  if (!expr) return '';
  let out = expr;

  // Replace unicode fractions first
  for (const [glyph, latex] of Object.entries(UNICODE_FRACTIONS)) {
    if (out.includes(glyph)) {
      out = out.split(glyph).join(latex);
    }
  }

  // Group consecutive unicode superscripts into ^{...}
  out = out.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾ⁿⁱ]+/g, (seq) => {
    const mapped = Array.from(seq, (ch) => UNICODE_SUPERSCRIPTS[ch] ?? ch).join('');
    return `^{${mapped}}`;
  });

  // Group consecutive unicode subscripts into _{...}
  out = out.replace(/[₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎]+/g, (seq) => {
    const mapped = Array.from(seq, (ch) => UNICODE_SUBSCRIPTS[ch] ?? ch).join('');
    return `_{${mapped}}`;
  });

  // Radicals (cube/fourth/square)
  out = replaceUnicodeRadicals(out, '∛', '\\sqrt[3]');
  out = replaceUnicodeRadicals(out, '∜', '\\sqrt[4]');
  out = replaceUnicodeRadicals(out, '√', '\\sqrt');

  for (const [glyph, latex] of UNICODE_TO_LATEX_SYMBOLS) {
    if (out.includes(glyph)) {
      out = out.split(glyph).join(latex);
    }
  }

  return out;
}

/**
 * Strictly determines whether `$...$` represents intentional inline LaTeX
 * math rather than currency (e.g. "$50 and $80", "$1,250.00").
 */
export function isSafeInlineDollarMath(inner: string): boolean {
  if (!inner) return false;
  // Leading or trailing whitespace disqualifies inline $math$
  if (/^\s|\s$/.test(inner)) return false;
  if (inner.includes('\n')) return false;

  // Reject pure currency amounts like $50, $1,250.00 or trailing operator artifacts like $50+
  if (/^\d[\d,]*(?:\.\d{1,2})?$/.test(inner)) return false;
  if (/[+\-*/=<>]$/.test(inner)) return false;

  // Reject if unescaped multi-letter English prose words appear (like "$50 and a book costs $12")
  const withoutCommands = inner.replace(/\\[A-Za-z]+/g, ' ');
  const multiLetterWords = withoutCommands.match(/[A-Za-z]{2,}/g) || [];
  for (const w of multiLetterWords) {
    if (!KNOWN_PLAIN_MATH_WORDS.has(w)) {
      return false;
    }
  }

  // Require at least one mathematical cue: backslash command, exponent/subscript,
  // relational/arithmetic operator, braces, or a single/indexed variable like x, x_1, f(x)
  const hasMathCue =
    /[\\^_{}=<>±×÷√∛≤≥≠≈+\-*/()]/.test(inner) ||
    /^[A-Za-z]$/.test(inner) ||
    /^\d*[A-Za-z](?:[⁰¹²³⁴⁵⁶⁷⁸⁹]+)?$/.test(inner);

  return hasMathCue;
}

const MATRIX_ENV_RE =
  /^\\begin\{(pmatrix|bmatrix|Bmatrix|vmatrix|Vmatrix|matrix|cases|aligned)\}([\s\S]*?)\\end\{\1\}/;

function consumeBareLatexExpression(text: string, startIdx: number): number | null {
  if (text[startIdx] !== '\\') return null;
  const cmdMatch = text.slice(startIdx + 1).match(/^([A-Za-z]+)/);
  if (!cmdMatch || !KNOWN_LATEX_COMMANDS.has(cmdMatch[1])) {
    return null;
  }

  let cursor = startIdx + 1 + cmdMatch[1].length;

  // Consume optional [...] and required {...} arguments of the command
  while (cursor < text.length) {
    if (text[cursor] === '[') {
      const br = readBalancedBraceOrBracket(text, cursor, '[', ']');
      if (br) {
        cursor = br.endIndex;
        continue;
      }
    }
    if (text[cursor] === '{') {
      const brace = readBalancedBraceOrBracket(text, cursor, '{', '}');
      if (brace) {
        cursor = brace.endIndex;
        continue;
      }
    }
    break;
  }

  // Optionally consume trailing _... / ^... attached directly to this command (e.g. \log_{10} or \sin^2)
  while (cursor < text.length && (text[cursor] === '^' || text[cursor] === '_')) {
    cursor += 1;
    if (text[cursor] === '{') {
      const brace = readBalancedBraceOrBracket(text, cursor, '{', '}');
      if (brace) {
        cursor = brace.endIndex;
        continue;
      }
    }
    const single = text.slice(cursor).match(/^[A-Za-z0-9]/);
    if (single) {
      cursor += single[0].length;
    }
  }

  // Continue consuming connected algebraic terms (+, -, =, <, >, \pm, \cdot, fractions, etc.)
  // while stopping cleanly before ordinary English words.
  while (cursor < text.length) {
    const rest = text.slice(cursor);
    // Stop at sentence punctuation followed by space or end
    const opMatch = rest.match(
      /^(\s*(?:[+\-=<>/*]|\\(?:pm|mp|times|div|cdot|le|leq|ge|geq|ne|neq|approx|equiv|to|Rightarrow))\s*)/
    );
    if (opMatch) {
      const afterOpIdx = cursor + opMatch[0].length;
      const afterOp = text.slice(afterOpIdx);
      // Do not consume trailing operator if nothing valid follows
      if (!afterOp || /^[^A-Za-z0-9\\({\[√∛]/.test(afterOp)) {
        break;
      }
      // If followed by plain English word >= 2 chars that isn't a math function, stop before the operator unless it's '=' + number/var
      const nextWord = afterOp.match(/^([A-Za-z]{2,})/);
      if (nextWord && !KNOWN_PLAIN_MATH_WORDS.has(nextWord[1]) && afterOp[nextWord[1].length] !== '^') {
        break;
      }
      cursor = afterOpIdx;
      const termEnd = consumeSimpleMathTerm(text, cursor);
      if (termEnd > cursor) {
        cursor = termEnd;
        continue;
      }
      break;
    }

    // Also consume immediately adjacent variable/parenthesized argument e.g. \sqrt{x}y or \sin(2x) or \log_{10}(100)
    if (rest[0] === '(' || rest[0] === '\\') {
      const termEnd = consumeSimpleMathTerm(text, cursor);
      if (termEnd > cursor) {
        cursor = termEnd;
        continue;
      }
    }

    // Consume space + math variable/number right after a trig/log function like "\log_{10} 100" or "\sin x"
    if (/^\s+(?:[A-Za-z0-9][A-Za-z0-9^_{}()]*|\\[A-Za-z]+)/.test(rest)) {
      const spaceLen = rest.match(/^\s+/)![0].length;
      const nextSlice = text.slice(cursor + spaceLen);
      const plainWord = nextSlice.match(/^([A-Za-z]{2,})(?![^a-zA-Z]*[\^_])/);
      if (plainWord && !KNOWN_PLAIN_MATH_WORDS.has(plainWord[1])) {
        break;
      }
      if (/^[A-Za-z0-9\\(]/.test(nextSlice)) {
        const termEnd = consumeSimpleMathTerm(text, cursor + spaceLen);
        if (termEnd > cursor + spaceLen && text[termEnd] !== '?' && !/^[\s]+(?:[A-Za-z]{2,})/.test(text.slice(termEnd))) {
          cursor = termEnd;
          continue;
        }
        // Check if this function command expects an argument (trig/log/lim)
        if (/^(?:sin|cos|tan|cot|sec|csc|log|ln|lim)/.test(cmdMatch[1]) && termEnd > cursor + spaceLen) {
          cursor = termEnd;
          continue;
        }
      }
    }

    break;
  }

  return cursor > startIdx ? cursor : null;
}

function consumeSimpleMathTerm(text: string, startIdx: number): number {
  let cursor = startIdx;
  while (cursor < text.length) {
    const ch = text[cursor];
    if (ch === '\\') {
      const subEnd = consumeBareLatexCommandOnly(text, cursor);
      if (subEnd > cursor) {
        cursor = subEnd;
        continue;
      }
      break;
    }
    if (ch === '(') {
      const paren = readBalancedParen(text, cursor);
      if (paren) {
        cursor = paren.endIndex;
        continue;
      }
      break;
    }
    if (ch === '{') {
      const brace = readBalancedBraceOrBracket(text, cursor, '{', '}');
      if (brace) {
        cursor = brace.endIndex;
        continue;
      }
      break;
    }
    if (ch === '^' || ch === '_') {
      cursor += 1;
      if (text[cursor] === '{') {
        const brace = readBalancedBraceOrBracket(text, cursor, '{', '}');
        if (brace) {
          cursor = brace.endIndex;
          continue;
        }
      }
      const m = text.slice(cursor).match(/^[A-Za-z0-9]+/);
      if (m) {
        cursor += m[0].length;
        continue;
      }
      break;
    }
    const wordOrNum = text.slice(cursor).match(/^(?:\d+(?:\.\d+)?|[A-Za-z]+)/);
    if (wordOrNum) {
      const token = wordOrNum[0];
      if (
        /^[A-Za-z]{2,}$/.test(token) &&
        !KNOWN_PLAIN_MATH_WORDS.has(token) &&
        text[cursor + token.length] !== '^' &&
        text[cursor + token.length] !== '_'
      ) {
        break;
      }
      cursor += token.length;
      continue;
    }
    if (ch === '√' || ch === '∛' || ch === '∜') {
      cursor += 1;
      continue;
    }
    break;
  }
  return cursor;
}

function consumeBareLatexCommandOnly(text: string, startIdx: number): number {
  if (text[startIdx] !== '\\') return startIdx;
  const cmdMatch = text.slice(startIdx + 1).match(/^([A-Za-z]+)/);
  if (!cmdMatch || !KNOWN_LATEX_COMMANDS.has(cmdMatch[1])) return startIdx;
  let cursor = startIdx + 1 + cmdMatch[1].length;
  while (cursor < text.length) {
    if (text[cursor] === '[') {
      const br = readBalancedBraceOrBracket(text, cursor, '[', ']');
      if (br) {
        cursor = br.endIndex;
        continue;
      }
    }
    if (text[cursor] === '{') {
      const brace = readBalancedBraceOrBracket(text, cursor, '{', '}');
      if (brace) {
        cursor = brace.endIndex;
        continue;
      }
    }
    break;
  }
  return cursor;
}

function consumeCaretOrSubscriptChain(text: string, startIdx: number): number | null {
  const headMatch = text
    .slice(startIdx)
    .match(/^(?:[A-Za-z0-9]+|\([^()]+\))(?:\^(?:\{[^{}]+\}|[A-Za-z0-9+-]+)|_(?:\{[^{}]+\}|[0-9]))+/);
  if (!headMatch) return null;

  // Ensure preceded by start-of-string or delimiter (not middle of a word/URL)
  if (startIdx > 0 && /[A-Za-z0-9_./]/.test(text[startIdx - 1])) {
    return null;
  }

  let cursor = startIdx + headMatch[0].length;

  // Allow attached function argument like log_{10}(100) or f_1(x)
  if (text[cursor] === '(') {
    const paren = readBalancedParen(text, cursor);
    if (paren) {
      cursor = paren.endIndex;
    }
  }

  // Chain connected operators like "x^2 + x^3" or "x^2 - 5x + 6 = 0"
  while (cursor < text.length) {
    const rest = text.slice(cursor);
    const opMatch = rest.match(/^(\s*(?:[+\-=<>]|\\(?:pm|times|div|le|ge|ne))\s*)/);
    if (!opMatch) break;
    const afterOp = cursor + opMatch[0].length;
    const termEnd = consumeSimpleMathTerm(text, afterOp);
    if (termEnd <= afterOp) break;
    cursor = termEnd;
  }

  return cursor;
}

function consumeUnicodeRadical(text: string, startIdx: number): number | null {
  const ch = text[startIdx];
  if (ch !== '√' && ch !== '∛' && ch !== '∜') return null;

  let cursor = startIdx + 1;
  if (text[cursor] === '(') {
    const paren = readBalancedParen(text, cursor);
    if (paren) {
      cursor = paren.endIndex;
      return cursor;
    }
  }
  if (text[cursor] === '{') {
    const brace = readBalancedBraceOrBracket(text, cursor, '{', '}');
    if (brace) {
      cursor = brace.endIndex;
      return cursor;
    }
  }
  const token = text.slice(cursor).match(/^[A-Za-z0-9²³⁴⁵⁶⁷⁸⁹]+(?:\.[0-9²³⁴⁵⁶⁷⁸⁹]+)?/);
  if (token) {
    return cursor + token[0].length;
  }
  return null;
}

function parsePlainSegmentForImplicitMath(plain: string): MathSegment[] {
  if (!plain) return [];
  const out: MathSegment[] = [];
  let buffer = '';
  let i = 0;

  const flushText = () => {
    if (buffer) {
      out.push({ type: 'text', content: buffer, displayMode: false, raw: buffer });
      buffer = '';
    }
  };

  while (i < plain.length) {
    // 1. Bare LaTeX command expression (e.g. \frac{3}{4}, \sqrt{144}, \sqrt[3]{27}, \frac{-b\pm\sqrt{b^2-4ac}}{2a})
    if (plain[i] === '\\') {
      const endIdx = consumeBareLatexExpression(plain, i);
      if (endIdx && endIdx > i) {
        flushText();
        const raw = plain.slice(i, endIdx);
        out.push({ type: 'math', content: raw, displayMode: false, raw });
        i = endIdx;
        continue;
      }
    }

    // 2. Unicode radical expressions (√144, ∛27, √(a² + b²)) -> render via KaTeX for crisp vinculum
    if (plain[i] === '√' || plain[i] === '∛' || plain[i] === '∜') {
      const endIdx = consumeUnicodeRadical(plain, i);
      if (endIdx && endIdx > i) {
        flushText();
        const raw = plain.slice(i, endIdx);
        out.push({ type: 'math', content: raw, displayMode: false, raw });
        i = endIdx;
        continue;
      }
    }

    // 3. Explicit caret exponent/subscript equations (e.g. x^2 + x^3, 10^{-5}, log_{10}(100))
    if (/[A-Za-z0-9(]/.test(plain[i])) {
      const endIdx = consumeCaretOrSubscriptChain(plain, i);
      if (endIdx && endIdx > i) {
        flushText();
        const raw = plain.slice(i, endIdx);
        out.push({ type: 'math', content: raw, displayMode: false, raw });
        i = endIdx;
        continue;
      }
    }

    buffer += plain[i];
    i += 1;
  }

  flushText();
  return out;
}

/**
 * Splits text into plain text segments and math segments.
 * Supports:
 * - Display delimiters: $$...$$ and \[...\]
 * - Inline delimiters: \(...\)
 * - Bare matrix/cases environments: \begin{pmatrix}...\end{pmatrix}, etc.
 * - Careful inline $...$ ONLY when non-currency mathematical content is present
 * - Un-delimited unambiguous LaTeX commands, caret exponents, and √ / ∛ expressions
 */
export function parseMathSegments(input: string): MathSegment[] {
  if (!input) return [];

  const segments: MathSegment[] = [];
  let textBuffer = '';
  let i = 0;

  const flushPlain = () => {
    if (textBuffer) {
      segments.push(...parsePlainSegmentForImplicitMath(textBuffer));
      textBuffer = '';
    }
  };

  while (i < input.length) {
    // Escaped dollar sign \$ -> literal '$'
    if (input[i] === '\\' && input[i + 1] === '$') {
      textBuffer += '$';
      i += 2;
      continue;
    }

    // $$ ... $$ display math
    if (input[i] === '$' && input[i + 1] === '$') {
      const closeIdx = input.indexOf('$$', i + 2);
      if (closeIdx !== -1) {
        const inner = input.slice(i + 2, closeIdx).trim();
        if (inner.length > 0) {
          flushPlain();
          segments.push({
            type: 'math',
            content: inner,
            displayMode: true,
            raw: input.slice(i, closeIdx + 2),
          });
          i = closeIdx + 2;
          continue;
        }
      }
    }

    // \[ ... \] display math
    if (input[i] === '\\' && input[i + 1] === '[') {
      const closeIdx = input.indexOf('\\]', i + 2);
      if (closeIdx !== -1) {
        const inner = input.slice(i + 2, closeIdx).trim();
        if (inner.length > 0) {
          flushPlain();
          segments.push({
            type: 'math',
            content: inner,
            displayMode: true,
            raw: input.slice(i, closeIdx + 2),
          });
          i = closeIdx + 2;
          continue;
        }
      }
    }

    // \( ... \) inline math
    if (input[i] === '\\' && input[i + 1] === '(') {
      const closeIdx = input.indexOf('\\)', i + 2);
      if (closeIdx !== -1) {
        const inner = input.slice(i + 2, closeIdx).trim();
        if (inner.length > 0) {
          flushPlain();
          segments.push({
            type: 'math',
            content: inner,
            displayMode: false,
            raw: input.slice(i, closeIdx + 2),
          });
          i = closeIdx + 2;
          continue;
        }
      }
    }

    // Bare \begin{pmatrix|bmatrix|...}...\end{...}
    if (input[i] === '\\' && input.startsWith('\\begin{', i)) {
      const envMatch = input.slice(i).match(MATRIX_ENV_RE);
      if (envMatch) {
        flushPlain();
        segments.push({
          type: 'math',
          content: envMatch[0],
          displayMode: false,
          raw: envMatch[0],
        });
        i += envMatch[0].length;
        continue;
      }
    }

    // Single $ ... $ ONLY if safe non-currency math
    if (input[i] === '$' && input[i + 1] !== '$') {
      let closeIdx = -1;
      let searchIdx = i + 1;
      while (searchIdx < input.length) {
        const candidate = input.indexOf('$', searchIdx);
        if (candidate === -1) break;
        if (input[candidate - 1] === '\\') {
          searchIdx = candidate + 1;
          continue;
        }
        if (input[candidate + 1] === '$') {
          searchIdx = candidate + 2;
          continue;
        }
        closeIdx = candidate;
        break;
      }

      if (closeIdx > i + 1 && !/\d/.test(input[closeIdx + 1] ?? '')) {
        const inner = input.slice(i + 1, closeIdx);
        if (isSafeInlineDollarMath(inner)) {
          flushPlain();
          segments.push({
            type: 'math',
            content: inner,
            displayMode: false,
            raw: input.slice(i, closeIdx + 1),
          });
          i = closeIdx + 1;
          continue;
        }
      }
    }

    textBuffer += input[i];
    i += 1;
  }

  flushPlain();
  return segments;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Renders a math expression to safe KaTeX HTML (`trust: false`, `throwOnError: false`).
 */
export function renderMathToHtml(expr: string, displayMode = false): string {
  const normalized = normalizeUnicodeMathToLatex(expr);
  try {
    return katex.renderToString(normalized, {
      displayMode,
      throwOnError: false,
      strict: 'ignore',
      trust: false,
      output: 'htmlAndMathml',
    });
  } catch {
    return escapeHtml(expr);
  }
}

/**
 * Strips math delimiters and LaTeX command names before running English spelling checks
 * so equations in CBT questions never trigger false-positive spellcheck warnings.
 */
export function stripMathForSpellCheck(text: string): string {
  if (!text) return '';
  return text
    .replace(/\$\$[\s\S]*?\$\$/g, ' ')
    .replace(/\\\[[\s\S]*?\\\]/g, ' ')
    .replace(/\\\([\s\S]*?\\\)/g, ' ')
    .replace(/\\begin\{[^}]+\}[\s\S]*?\\end\{[^}]+\}/g, ' ')
    .replace(/\\[A-Za-z]+(?:\[[^\]]*\])?(?:\{[^{}]*\})*/g, ' ')
    .replace(/[A-Za-z0-9)]+(?:\^(?:\{[^{}]+\}|[A-Za-z0-9+-]+)|_(?:\{[^{}]+\}|[0-9]))+/g, ' ');
}

/**
 * Quote-aware RFC-4180 CSV line parser so commas inside quoted math expressions
 * (e.g. "(2, 3)", "Find x, y if x + y = 5", or matrix rows) stay intact.
 */
export function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

export interface MathToolbarItem {
  label: string;
  snippet: string;
  title: string;
  cursorOffset?: number;
}

export interface MathToolbarGroup {
  id: string;
  label: string;
  items: MathToolbarItem[];
}

export const MATH_SYMBOL_GROUPS: readonly MathToolbarGroup[] = [
  {
    id: 'roots_powers',
    label: 'Roots & Powers',
    items: [
      { label: '√x', snippet: '\\(\\sqrt{x}\\)', title: 'Square root' },
      { label: '∛x', snippet: '\\(\\sqrt[3]{x}\\)', title: 'Cube root' },
      { label: 'x²', snippet: 'x²', title: 'Square (Unicode)' },
      { label: 'x³', snippet: 'x³', title: 'Cube (Unicode)' },
      { label: 'xⁿ', snippet: '\\(x^{n}\\)', title: 'Power / Index' },
      { label: '×10ⁿ', snippet: '\\(\\times 10^{n}\\)', title: 'Scientific notation' },
    ],
  },
  {
    id: 'fractions_algebra',
    label: 'Fractions & Equations',
    items: [
      { label: 'a/b', snippet: '\\(\\frac{a}{b}\\)', title: 'Fraction' },
      { label: 'w a/b', snippet: '\\(2\\frac{1}{2}\\)', title: 'Mixed fraction' },
      { label: 'Quad.', snippet: '\\(x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}\\)', title: 'Quadratic formula' },
      { label: 'ax²+bx+c=0', snippet: '\\(ax^2 + bx + c = 0\\)', title: 'Quadratic equation' },
      { label: 'Simul.', snippet: '\\(\\begin{cases} 2x + y = 7 \\\\ x - y = 2 \\end{cases}\\)', title: 'Simultaneous equations' },
    ],
  },
  {
    id: 'trig_log',
    label: 'Trig, Log & Matrices',
    items: [
      { label: 'sin θ', snippet: '\\(\\sin\\theta\\)', title: 'Sine' },
      { label: 'cos θ', snippet: '\\(\\cos\\theta\\)', title: 'Cosine' },
      { label: 'tan θ', snippet: '\\(\\tan\\theta\\)', title: 'Tangent' },
      { label: 'log₁₀', snippet: '\\(\\log_{10}(x)\\)', title: 'Logarithm base 10' },
      { label: '2×2 Matrix', snippet: '\\(\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}\\)', title: '2x2 Matrix' },
    ],
  },
  {
    id: 'operators_greek',
    label: 'Operators, Sets & Greek',
    items: [
      { label: '±', snippet: '±', title: 'Plus or minus' },
      { label: '×', snippet: '×', title: 'Multiplication sign' },
      { label: '÷', snippet: '÷', title: 'Division sign' },
      { label: '≤', snippet: '≤', title: 'Less than or equal to' },
      { label: '≥', snippet: '≥', title: 'Greater than or equal to' },
      { label: '≠', snippet: '≠', title: 'Not equal to' },
      { label: '≈', snippet: '≈', title: 'Approximately equal' },
      { label: 'π', snippet: 'π', title: 'Pi' },
      { label: 'θ', snippet: 'θ', title: 'Theta' },
      { label: '°', snippet: '°', title: 'Degrees' },
      { label: '∞', snippet: '∞', title: 'Infinity' },
      { label: '∠', snippet: '∠', title: 'Angle' },
    ],
  },
];

export function insertSnippetAtCursor(
  currentValue: string,
  snippet: string,
  selectionStart?: number | null,
  selectionEnd?: number | null
): { nextValue: string; nextCursorPos: number } {
  const start =
    typeof selectionStart === 'number' && selectionStart >= 0 && selectionStart <= currentValue.length
      ? selectionStart
      : currentValue.length;
  const end =
    typeof selectionEnd === 'number' && selectionEnd >= start && selectionEnd <= currentValue.length
      ? selectionEnd
      : start;

  const nextValue = currentValue.slice(0, start) + snippet + currentValue.slice(end);
  const nextCursorPos = start + snippet.length;
  return { nextValue, nextCursorPos };
}
