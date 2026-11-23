import React, { useMemo } from 'react';
import { parseMathSegments, renderMathToHtml } from '../../lib/mathFormatting';

interface MathTextProps {
  text?: string | null;
  className?: string;
  as?: 'span' | 'div' | 'p';
}

/**
 * Safely renders mixed natural language text, Unicode math expressions,
 * and LaTeX equations without modifying stored strings or grading keys.
 * Plain text segments render strictly via React text nodes; math segments
 * render via KaTeX with `trust: false` and responsive horizontal overflow.
 */
export const MathText: React.FC<MathTextProps> = ({
  text,
  className = '',
  as: Component = 'span',
}) => {
  const segments = useMemo(() => parseMathSegments(text ?? ''), [text]);

  if (!text) {
    return null;
  }

  return (
    <Component className={`cbt-math-root break-words ${className}`.trim()}>
      {segments.map((seg, idx) => {
        if (seg.type === 'text') {
          return <React.Fragment key={idx}>{seg.content}</React.Fragment>;
        }

        const html = renderMathToHtml(seg.content, seg.displayMode);

        if (seg.displayMode) {
          return (
            <span
              key={idx}
              className="cbt-math-display block max-w-full overflow-x-auto my-2 align-middle"
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        }

        return (
          <span
            key={idx}
            className="cbt-math-inline inline-block max-w-full overflow-x-auto align-middle"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        );
      })}
    </Component>
  );
};
