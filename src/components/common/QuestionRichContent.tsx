import React, { useMemo } from 'react';
import type { CBTDiagramSpec } from '../../types/cbtDiagram';
import { hasDiagramTokens, splitContentWithDiagrams } from '../../lib/diagramFormatting';
import { MathText } from './MathText';
import { DiagramRenderer } from './DiagramRenderer';
import { Edit3, Trash2 } from 'lucide-react';

interface QuestionRichContentProps {
  text?: string | null;
  className?: string;
  compact?: boolean;
  interactiveZoom?: boolean;
  maxDiagramWidth?: number;
  onEditDiagramToken?: (token: string, spec: CBTDiagramSpec) => void;
  onRemoveDiagramToken?: (token: string) => void;
}

/**
 * Renders mixed plain text, Unicode/KaTeX mathematical notation, and zero or more
 * validated Geometry / Coordinate Graph / Statistical Chart diagrams in exact order.
 * Delegates all plain text & LaTeX segments to the untouched MathText component.
 */
export const QuestionRichContent: React.FC<QuestionRichContentProps> = ({
  text,
  className = '',
  compact = false,
  interactiveZoom = true,
  maxDiagramWidth,
  onEditDiagramToken,
  onRemoveDiagramToken,
}) => {
  const hasDiagrams = hasDiagramTokens(text);

  const segments = useMemo(
    () => (hasDiagrams ? splitContentWithDiagrams(text) : []),
    [hasDiagrams, text]
  );

  if (!text) return null;

  if (!hasDiagrams) {
    return <MathText text={text} className={className} />;
  }

  return (
    <div className={`space-y-2 min-w-0 ${className}`.trim()}>
      {segments.map((seg, idx) => {
        if (seg.type === 'text') {
          const cleaned = seg.content.replace(/^\n+|\n+$/g, '');
          if (!cleaned) return null;
          return (
            <div key={`txt-${idx}`} className="leading-relaxed">
              <MathText text={cleaned} />
            </div>
          );
        }

        if (seg.type === 'diagram-error') {
          return (
            <div key={`err-${idx}`}>
              <DiagramRenderer error={seg.error} compact={compact} interactiveZoom={false} />
              {onRemoveDiagramToken && (
                <button
                  type="button"
                  onClick={() => onRemoveDiagramToken(seg.token)}
                  className="text-[11px] font-bold text-red-600 hover:underline mt-1"
                >
                  Remove invalid diagram marker
                </button>
              )}
            </div>
          );
        }

        return (
          <div key={`diag-${idx}`} className="space-y-1">
            <DiagramRenderer
              spec={seg.spec}
              compact={compact}
              interactiveZoom={interactiveZoom}
              maxWidth={maxDiagramWidth}
            />
            {(onEditDiagramToken || onRemoveDiagramToken) && (
              <div className="flex items-center gap-2 print:hidden">
                {onEditDiagramToken && (
                  <button
                    type="button"
                    onClick={() => onEditDiagramToken(seg.token, seg.spec)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-100 dark:bg-amber-950/70 hover:bg-amber-200 dark:hover:bg-amber-900 text-amber-900 dark:text-amber-300 text-[11px] font-bold"
                  >
                    <Edit3 className="w-3 h-3" /> Edit Diagram
                  </button>
                )}
                {onRemoveDiagramToken && (
                  <button
                    type="button"
                    onClick={() => onRemoveDiagramToken(seg.token)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-50 dark:bg-red-950/50 hover:bg-red-100 text-red-600 dark:text-red-400 text-[11px] font-bold"
                  >
                    <Trash2 className="w-3 h-3" /> Remove Diagram
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
