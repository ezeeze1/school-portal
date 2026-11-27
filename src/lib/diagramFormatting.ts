import type { CBTDiagramSpec, DiagramPlacement } from '../types/cbtDiagram';
import {
  MAX_DIAGRAM_PAYLOAD_BYTES,
  validateAndSanitizeDiagramSpec,
} from './diagramValidation';

export const DIAGRAM_TOKEN_PREFIX = '[[cbt-diagram:v1:';
export const DIAGRAM_TOKEN_SUFFIX = ']]';

export type RichContentSegment =
  | { type: 'text'; content: string }
  | { type: 'diagram'; token: string; spec: CBTDiagramSpec }
  | { type: 'diagram-error'; token: string; error: string };

function utf8ToBase64Url(input: string): string {
  if (typeof TextEncoder !== 'undefined') {
    const bytes = new TextEncoder().encode(input);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const b64 =
      typeof btoa === 'function'
        ? btoa(binary)
        : Buffer.from(bytes).toString('base64');
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  const b64 = Buffer.from(input, 'utf8').toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToUtf8(b64Url: string): string {
  const padded = b64Url.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (padded.length % 4)) % 4;
  const base64 = padded + '='.repeat(padLen);

  if (typeof TextDecoder !== 'undefined' && typeof atob === 'function') {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  }
  return Buffer.from(base64, 'base64').toString('utf8');
}

/**
 * Strips any hidden teacher-only fields before persisting a diagram token
 * so student payloads never receive unrendered measurements or answer hints.
 */
function stripHiddenStudentFields(spec: CBTDiagramSpec): CBTDiagramSpec {
  const cloned: CBTDiagramSpec = JSON.parse(JSON.stringify(spec));
  if (cloned.geometry?.elements) {
    cloned.geometry.elements = cloned.geometry.elements.map((el) => {
      if (el.kind === 'angle' && el.hideMeasurement) {
        return {
          ...el,
          label: el.label || 'x°',
          hideMeasurement: true,
        };
      }
      if (el.kind === 'line' && el.hideMeasurement) {
        return {
          ...el,
          label: el.label || 'x',
          hideMeasurement: true,
        };
      }
      if (el.kind === 'shape' && el.hideMeasurement) {
        return {
          ...el,
          hideMeasurement: true,
        };
      }
      return el;
    });
  }
  return cloned;
}

export function serializeDiagramToken(spec: CBTDiagramSpec): {
  ok: boolean;
  token?: string;
  error?: string;
} {
  const validation = validateAndSanitizeDiagramSpec(spec);
  if (!validation.ok || !validation.sanitized) {
    return { ok: false, error: validation.error || 'Invalid diagram data.' };
  }

  const safeSpec = stripHiddenStudentFields(validation.sanitized);
  const json = JSON.stringify(safeSpec);
  if (json.length > MAX_DIAGRAM_PAYLOAD_BYTES) {
    return {
      ok: false,
      error: `Diagram payload exceeds maximum size (${MAX_DIAGRAM_PAYLOAD_BYTES} bytes).`,
    };
  }

  const encoded = utf8ToBase64Url(json);
  return {
    ok: true,
    token: `${DIAGRAM_TOKEN_PREFIX}${encoded}${DIAGRAM_TOKEN_SUFFIX}`,
  };
}

export function parseDiagramToken(token: string): {
  ok: boolean;
  spec?: CBTDiagramSpec;
  error?: string;
} {
  const trimmed = token.trim();
  if (!trimmed.startsWith('[[cbt-diagram:') || !trimmed.endsWith(DIAGRAM_TOKEN_SUFFIX)) {
    return { ok: false, error: 'Malformed diagram marker format.' };
  }

  if (!trimmed.startsWith(DIAGRAM_TOKEN_PREFIX)) {
    return { ok: false, error: 'Unsupported diagram schema version in marker.' };
  }

  const payload = trimmed.slice(
    DIAGRAM_TOKEN_PREFIX.length,
    trimmed.length - DIAGRAM_TOKEN_SUFFIX.length
  );
  if (!payload || !/^[A-Za-z0-9_-]+$/.test(payload)) {
    return { ok: false, error: 'Diagram payload contains invalid characters.' };
  }

  if (payload.length > MAX_DIAGRAM_PAYLOAD_BYTES * 2) {
    return { ok: false, error: 'Diagram payload exceeds allowed size limit.' };
  }

  try {
    const jsonStr = base64UrlToUtf8(payload);
    if (jsonStr.length > MAX_DIAGRAM_PAYLOAD_BYTES) {
      return { ok: false, error: 'Decoded diagram exceeds allowed size limit.' };
    }
    const parsed = JSON.parse(jsonStr);
    const validated = validateAndSanitizeDiagramSpec(parsed);
    if (!validated.ok || !validated.sanitized) {
      return { ok: false, error: validated.error || 'Diagram failed safety validation.' };
    }
    return { ok: true, spec: validated.sanitized };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Corrupted diagram payload.',
    };
  }
}

export function hasDiagramTokens(text?: string | null): boolean {
  if (!text) return false;
  return text.includes('[[cbt-diagram:');
}

const DIAGRAM_TOKEN_SCAN_RE = /\[\[cbt-diagram:[^\]]*\]\]/g;

export function extractDiagramTokens(text?: string | null): Array<{
  token: string;
  ok: boolean;
  spec?: CBTDiagramSpec;
  error?: string;
}> {
  if (!text || !hasDiagramTokens(text)) return [];
  const matches = text.match(DIAGRAM_TOKEN_SCAN_RE) || [];
  return matches.map((token) => ({
    token,
    ...parseDiagramToken(token),
  }));
}

export function splitContentWithDiagrams(text?: string | null): RichContentSegment[] {
  if (!text) return [];
  if (!hasDiagramTokens(text)) {
    return [{ type: 'text', content: text }];
  }

  const segments: RichContentSegment[] = [];
  let lastIndex = 0;
  DIAGRAM_TOKEN_SCAN_RE.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = DIAGRAM_TOKEN_SCAN_RE.exec(text)) !== null) {
    const matchStart = match.index;
    const matchEnd = matchStart + match[0].length;
    if (matchStart > lastIndex) {
      const slice = text.slice(lastIndex, matchStart);
      if (slice.trim().length > 0 || slice.length > 0) {
        segments.push({ type: 'text', content: slice });
      }
    }

    const parsed = parseDiagramToken(match[0]);
    if (parsed.ok && parsed.spec) {
      segments.push({ type: 'diagram', token: match[0], spec: parsed.spec });
    } else {
      segments.push({
        type: 'diagram-error',
        token: match[0],
        error: parsed.error || 'Unable to display diagram safely.',
      });
    }

    lastIndex = matchEnd;
  }

  if (lastIndex < text.length) {
    const tail = text.slice(lastIndex);
    if (tail.length > 0) {
      segments.push({ type: 'text', content: tail });
    }
  }

  return segments;
}

export function stripDiagramsForSpellCheck(text: string): string {
  if (!text) return '';
  return text.replace(DIAGRAM_TOKEN_SCAN_RE, ' ');
}

export function attachDiagramToText(
  existingText: string,
  diagramToken: string,
  placement: DiagramPlacement,
  cursorPos?: number | null
): string {
  const base = existingText || '';
  if (!base.trim()) {
    return diagramToken;
  }

  if (placement === 'above') {
    return `${diagramToken}\n${base.replace(/^\n+/, '')}`;
  }

  if (placement === 'inline') {
    const pos =
      typeof cursorPos === 'number' && cursorPos >= 0 && cursorPos <= base.length
        ? cursorPos
        : base.length;
    const before = base.slice(0, pos);
    const after = base.slice(pos);
    const padBefore = before && !/\s$/.test(before) ? ' ' : '';
    const padAfter = after && !/^\s/.test(after) ? ' ' : '';
    return `${before}${padBefore}${diagramToken}${padAfter}${after}`;
  }

  // 'below'
  return `${base.replace(/\n+$/, '')}\n${diagramToken}`;
}

export function replaceDiagramTokenInText(
  existingText: string,
  oldToken: string,
  newToken: string
): string {
  if (!existingText) return newToken;
  if (!existingText.includes(oldToken)) {
    return attachDiagramToText(existingText, newToken, 'below');
  }
  return existingText.replace(oldToken, newToken);
}

export function removeDiagramTokenFromText(
  existingText: string,
  targetToken: string
): string {
  if (!existingText) return '';
  return existingText
    .replace(targetToken, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\s*\n/, '')
    .replace(/\n\s*$/, '')
    .trim();
}
