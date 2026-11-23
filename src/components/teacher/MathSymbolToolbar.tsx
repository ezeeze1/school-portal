import React, { useState } from 'react';
import { MATH_SYMBOL_GROUPS } from '../../lib/mathFormatting';
import { Eye, EyeOff, Sigma } from 'lucide-react';
import { MathText } from '../common/MathText';
import type { CBTQuestion } from '../../types';

interface MathSymbolToolbarProps {
  activeFieldLabel: string | null;
  onInsertSnippet: (snippet: string) => void;
  showPreview: boolean;
  onTogglePreview: () => void;
}

export const MathSymbolToolbar: React.FC<MathSymbolToolbarProps> = ({
  activeFieldLabel,
  onInsertSnippet,
  showPreview,
  onTogglePreview,
}) => {
  const [selectedGroupId, setSelectedGroupId] = useState<string>(MATH_SYMBOL_GROUPS[0].id);

  const activeGroup =
    MATH_SYMBOL_GROUPS.find((g) => g.id === selectedGroupId) ?? MATH_SYMBOL_GROUPS[0];

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-3 space-y-2.5 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1 font-bold text-amber-600 dark:text-amber-400">
            <Sigma className="w-3.5 h-3.5" /> Math Toolbar
          </span>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            {activeFieldLabel
              ? `Inserting into: ${activeFieldLabel}`
              : 'Click Question or Option A–D first, then tap any symbol/template'}
          </span>
        </div>

        <button
          type="button"
          onClick={onTogglePreview}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-[11px]"
        >
          {showPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          {showPreview ? 'Hide Student Preview' : 'Show Student Preview'}
        </button>
      </div>

      {/* Category tabs */}
      <div className="flex flex-wrap gap-1.5">
        {MATH_SYMBOL_GROUPS.map((group) => (
          <button
            key={group.id}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setSelectedGroupId(group.id)}
            className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-colors ${
              selectedGroupId === group.id
                ? 'bg-amber-500 text-slate-950'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            {group.label}
          </button>
        ))}
      </div>

      {/* Symbols & equation templates */}
      <div className="flex flex-wrap gap-1.5">
        {activeGroup.items.map((item) => (
          <button
            key={item.title}
            type="button"
            title={`${item.title}: inserts ${item.snippet}`}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onInsertSnippet(item.snippet)}
            className="px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-amber-100 dark:hover:bg-amber-950/70 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-[11px] transition-colors"
          >
            {item.label}
          </button>
        ))}
      </div>

      <p className="text-[10px] text-slate-400">
        Tip: You can type Unicode symbols (√144, ∛27, x², ¾) or LaTeX expressions such as{' '}
        <code className="text-amber-600 dark:text-amber-400">{'\\(\\frac{3}{4}\\)'}</code> and{' '}
        <code className="text-amber-600 dark:text-amber-400">{'\\(\\sqrt{b^2-4ac}\\)'}</code>. Plain currency like $50 stays normal text.
      </p>
    </div>
  );
};

interface QuestionMathPreviewProps {
  question: CBTQuestion;
  showExplanation?: boolean;
}

export const QuestionMathPreview: React.FC<QuestionMathPreviewProps> = ({
  question,
  showExplanation = false,
}) => {
  const activeCorrectKey = question.correctOption || 'A';

  return (
    <div className="p-4 rounded-xl bg-slate-900 text-white border border-slate-700 space-y-3 text-xs">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <span className="text-[10px] uppercase tracking-wider font-bold text-amber-400">
          Live Student Display Preview
        </span>
        <span className="text-[10px] text-slate-400">
          Correct Answer Key: Option {activeCorrectKey}
        </span>
      </div>

      <div className="font-serif font-bold text-sm text-white leading-relaxed">
        {question.question.trim() ? (
          <MathText text={question.question} />
        ) : (
          <span className="text-slate-500 italic">Enter question text above to preview...</span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {(['A', 'B', 'C', 'D'] as const).map((opt) => {
          const isCorrect = activeCorrectKey === opt;
          const val = question.options[opt];

          return (
            <div
              key={opt}
              className={`p-2.5 rounded-xl border flex items-center gap-2 min-w-0 ${
                isCorrect
                  ? 'bg-emerald-950/60 border-emerald-600 text-emerald-200 font-semibold'
                  : 'bg-slate-800/70 border-slate-700 text-slate-200'
              }`}
            >
              <span
                className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-[11px] flex-shrink-0 ${
                  isCorrect ? 'bg-emerald-500 text-slate-950' : 'bg-slate-700 text-slate-300'
                }`}
              >
                {opt}
              </span>
              <span className="min-w-0 flex-1 break-words">
                {val.trim() ? (
                  <MathText text={val} />
                ) : (
                  <span className="text-slate-500 italic">Option {opt} empty</span>
                )}
              </span>
            </div>
          );
        })}
      </div>

      {showExplanation && question.explanation && question.explanation.trim() && (
        <div className="p-2.5 rounded-lg bg-slate-800/80 border border-slate-700 text-[11px] text-amber-200">
          <strong className="text-amber-400">Explanation Preview: </strong>
          <MathText text={question.explanation} />
        </div>
      )}
    </div>
  );
};
