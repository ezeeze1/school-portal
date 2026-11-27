import React from 'react';
import type { CBTDiagramSpec } from '../../types/cbtDiagram';
import { CBTQuestion } from '../../types';
import { QuestionRichContent } from '../common/QuestionRichContent';

interface QuestionDiagramPreviewCardProps {
  question: CBTQuestion;
  showExplanation?: boolean;
  onEditDiagramToken?: (
    field: 'question' | 'A' | 'B' | 'C' | 'D' | 'explanation',
    token: string,
    spec: CBTDiagramSpec
  ) => void;
  onRemoveDiagramToken?: (
    field: 'question' | 'A' | 'B' | 'C' | 'D' | 'explanation',
    token: string
  ) => void;
}

export const QuestionDiagramPreviewCard: React.FC<QuestionDiagramPreviewCardProps> = ({
  question,
  showExplanation = false,
  onEditDiagramToken,
  onRemoveDiagramToken,
}) => {
  const activeKey = question.correctOption || 'A';

  return (
    <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-amber-300/60 dark:border-amber-700/50 space-y-3 text-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
          Student Math &amp; Diagram Preview
        </span>
        <span className="text-[10.5px] font-medium text-slate-500">
          Option {activeKey} marked correct
        </span>
      </div>

      <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/70 text-slate-900 dark:text-slate-100 text-sm font-semibold leading-relaxed min-w-0">
        {question.question.trim() ? (
          <QuestionRichContent
            text={question.question}
            interactiveZoom
            onEditDiagramToken={
              onEditDiagramToken
                ? (token, spec) => onEditDiagramToken('question', token, spec)
                : undefined
            }
            onRemoveDiagramToken={
              onRemoveDiagramToken
                ? (token) => onRemoveDiagramToken('question', token)
                : undefined
            }
          />
        ) : (
          <span className="text-slate-400 italic">Enter question text or attach a diagram above...</span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {(['A', 'B', 'C', 'D'] as const).map((opt) => {
          const isCorrect = activeKey === opt;
          return (
            <div
              key={opt}
              className={`p-2.5 rounded-lg border flex items-start gap-2 min-w-0 ${
                isCorrect
                  ? 'bg-emerald-50/80 dark:bg-emerald-950/30 border-emerald-400/70 dark:border-emerald-700 text-emerald-950 dark:text-emerald-200'
                  : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
              }`}
            >
              <span className="font-bold text-[11px] flex-shrink-0">{opt}.</span>
              <span className="min-w-0 flex-1">
                {question.options[opt].trim() ? (
                  <QuestionRichContent
                    text={question.options[opt]}
                    compact
                    interactiveZoom
                    onEditDiagramToken={
                      onEditDiagramToken
                        ? (token, spec) => onEditDiagramToken(opt, token, spec)
                        : undefined
                    }
                    onRemoveDiagramToken={
                      onRemoveDiagramToken
                        ? (token) => onRemoveDiagramToken(opt, token)
                        : undefined
                    }
                  />
                ) : (
                  <span className="text-slate-400 italic">Empty</span>
                )}
              </span>
            </div>
          );
        })}
      </div>

      {showExplanation && question.explanation && (
        <div className="p-2.5 rounded-lg bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-[11px] text-amber-900 dark:text-amber-200">
          <strong>Explanation:</strong>{' '}
          <QuestionRichContent
            text={question.explanation}
            compact
            interactiveZoom
            onEditDiagramToken={
              onEditDiagramToken
                ? (token, spec) => onEditDiagramToken('explanation', token, spec)
                : undefined
            }
            onRemoveDiagramToken={
              onRemoveDiagramToken
                ? (token) => onRemoveDiagramToken('explanation', token)
                : undefined
            }
          />
        </div>
      )}
    </div>
  );
};
