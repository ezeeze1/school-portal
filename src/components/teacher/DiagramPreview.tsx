import React, { useState } from 'react';
import { CBTQuestion } from '../../types';
import { QuestionRichContent } from '../common/QuestionRichContent';
import { Smartphone, Tablet, Monitor } from 'lucide-react';

interface DiagramPreviewProps {
  question: CBTQuestion;
  questionNumber?: number;
  highlightCorrect?: boolean;
}

type ViewportPreset = 'phone' | 'tablet' | 'desktop';

export const DiagramPreview: React.FC<DiagramPreviewProps> = ({
  question,
  questionNumber = 1,
  highlightCorrect = false,
}) => {
  const [viewport, setViewport] = useState<ViewportPreset>('phone');
  const [themeMode, setThemeMode] = useState<'exam-dark' | 'paper-light'>('exam-dark');

  const frameWidthClass =
    viewport === 'phone'
      ? 'max-w-[360px]'
      : viewport === 'tablet'
      ? 'max-w-[768px]'
      : 'max-w-full';

  const isDark = themeMode === 'exam-dark';

  return (
    <div className="space-y-3 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-100 dark:bg-slate-800/80 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-bold text-slate-600 dark:text-slate-300 mr-1">
            Device Viewport:
          </span>
          <button
            type="button"
            onClick={() => setViewport('phone')}
            className={`px-2.5 py-1.5 rounded-lg font-bold inline-flex items-center gap-1 whitespace-nowrap ${
              viewport === 'phone'
                ? 'bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" /> Phone (360px)
          </button>
          <button
            type="button"
            onClick={() => setViewport('tablet')}
            className={`px-2.5 py-1.5 rounded-lg font-bold inline-flex items-center gap-1 whitespace-nowrap ${
              viewport === 'tablet'
                ? 'bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
            }`}
          >
            <Tablet className="w-3.5 h-3.5" /> Tablet (768px)
          </button>
          <button
            type="button"
            onClick={() => setViewport('desktop')}
            className={`px-2.5 py-1.5 rounded-lg font-bold inline-flex items-center gap-1 whitespace-nowrap ${
              viewport === 'desktop'
                ? 'bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
            }`}
          >
            <Monitor className="w-3.5 h-3.5" /> Desktop
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setThemeMode(isDark ? 'paper-light' : 'exam-dark')}
            className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap"
          >
            {isDark ? 'Switch to Paper Light View' : 'Switch to Student CBT Dark View'}
          </button>
        </div>
      </div>

      {/* Simulated Student Exam Card */}
      <div className="w-full overflow-x-auto pb-2">
        <div
          className={`mx-auto w-full ${frameWidthClass} rounded-2xl border p-4 sm:p-6 space-y-4 transition-all ${
            isDark
              ? 'bg-slate-900 border-slate-700 text-white'
              : 'bg-white border-slate-300 text-slate-900'
          }`}
        >
          <div className="flex items-center justify-between border-b border-slate-700/40 pb-2">
            <span
              className={`text-[11px] font-bold uppercase tracking-wider ${
                isDark ? 'text-amber-400' : 'text-amber-700'
              }`}
            >
              Question {questionNumber} ({question.marks || 1} Marks)
            </span>
            <span className="text-[10px] font-semibold opacity-70">
              {viewport === 'phone' ? '360px Mobile' : viewport === 'tablet' ? '768px Tablet' : 'Desktop'} Preview
            </span>
          </div>

          <div className="font-serif font-bold text-base sm:text-lg leading-relaxed min-w-0">
            {question.question.trim() ? (
              <QuestionRichContent text={question.question} interactiveZoom />
            ) : (
              <span className="italic opacity-60 text-sm">Question text not entered yet...</span>
            )}
          </div>

          <div className="space-y-2.5">
            {(['A', 'B', 'C', 'D'] as const).map((opt) => {
              const isCorrect = highlightCorrect && (question.correctOption || 'A') === opt;
              return (
                <div
                  key={opt}
                  className={`w-full text-left p-3 min-h-[48px] rounded-xl border text-xs sm:text-sm flex items-start gap-3 min-w-0 ${
                    isCorrect
                      ? isDark
                        ? 'border-emerald-500 bg-emerald-950/50 text-emerald-100'
                        : 'border-emerald-500 bg-emerald-50 text-emerald-950'
                      : isDark
                      ? 'border-slate-700 bg-slate-800/50 text-slate-200'
                      : 'border-slate-200 bg-slate-50 text-slate-800'
                  }`}
                >
                  <span
                    className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs flex-shrink-0 ${
                      isCorrect
                        ? 'bg-emerald-600 text-white'
                        : isDark
                        ? 'bg-slate-800 text-slate-300'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {opt}
                  </span>
                  <div className="min-w-0 flex-1">
                    {question.options[opt].trim() ? (
                      <QuestionRichContent text={question.options[opt]} compact interactiveZoom />
                    ) : (
                      <span className="italic opacity-50">Option {opt} empty</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
