import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Search, Plus, X, CheckSquare, Square } from 'lucide-react';

interface MarkDropdownSelectProps {
  label: string;
  options: string[];
  selectedValues: string[];
  onToggleValue: (value: string) => void;
  onAddCustomValue?: (value: string) => void;
  placeholder?: string;
  badgeTheme?: 'amber' | 'blue' | 'emerald' | 'indigo';
  required?: boolean;
}

export const MarkDropdownSelect: React.FC<MarkDropdownSelectProps> = ({
  label,
  options,
  selectedValues,
  onToggleValue,
  onAddCustomValue,
  placeholder = 'Click to select and mark items...',
  badgeTheme = 'amber',
  required = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [customInput, setCustomInput] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Combine preset options with any custom options already selected
  const allAvailableOptions = Array.from(new Set([...options, ...selectedValues]));

  const filteredOptions = allAvailableOptions.filter((opt) =>
    opt.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddCustom = () => {
    if (customInput.trim() && onAddCustomValue) {
      onAddCustomValue(customInput.trim());
      setCustomInput('');
    }
  };

  const getThemeClasses = () => {
    switch (badgeTheme) {
      case 'blue':
        return {
          bgSelected: 'bg-blue-600 text-white border-blue-500',
          badgeSelected: 'bg-blue-100 text-blue-700 dark:bg-blue-950/80 dark:text-blue-300 border-blue-300 dark:border-blue-800',
          countText: 'text-blue-600 dark:text-blue-400',
          checkColor: 'text-blue-600 dark:text-blue-400',
        };
      case 'emerald':
        return {
          bgSelected: 'bg-emerald-600 text-white border-emerald-500',
          badgeSelected: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
          countText: 'text-emerald-600 dark:text-emerald-400',
          checkColor: 'text-emerald-600 dark:text-emerald-400',
        };
      case 'indigo':
        return {
          bgSelected: 'bg-indigo-600 text-white border-indigo-500',
          badgeSelected: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/80 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800',
          countText: 'text-indigo-600 dark:text-indigo-400',
          checkColor: 'text-indigo-600 dark:text-indigo-400',
        };
      case 'amber':
      default:
        return {
          bgSelected: 'bg-amber-500 text-slate-950 border-amber-400 font-bold',
          badgeSelected: 'bg-amber-100 text-amber-900 dark:bg-amber-950/80 dark:text-amber-300 border-amber-300 dark:border-amber-800',
          countText: 'text-amber-600 dark:text-amber-400',
          checkColor: 'text-amber-600 dark:text-amber-400',
        };
    }
  };

  const theme = getThemeClasses();

  return (
    <div className="space-y-1.5 relative" ref={containerRef}>
      {/* Label and Selected Counter */}
      <div className="flex items-center justify-between">
        <label className="block text-xs font-bold text-slate-900 dark:text-white">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
        <span className={`text-[10px] font-bold ${theme.countText}`}>
          {selectedValues.length} marked / selected
        </span>
      </div>

      {/* Selected Items Tags Bar */}
      {selectedValues.length > 0 && (
        <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 max-h-28 overflow-y-auto">
          {selectedValues.map((val) => (
            <span
              key={val}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border ${theme.badgeSelected} transition-all`}
            >
              <Check className="w-3 h-3 stroke-[3] text-emerald-600 dark:text-emerald-400" />
              <span>{val}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleValue(val);
                }}
                className="hover:text-red-600 dark:hover:text-red-400 p-0.5 rounded transition-colors ml-0.5"
                title="Unmark option"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Dropdown Selector Input Button */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-3.5 py-2.5 bg-white dark:bg-slate-900 border rounded-xl flex items-center justify-between cursor-pointer transition-all shadow-sm ${
          isOpen
            ? 'border-amber-500 ring-2 ring-amber-500/20'
            : 'border-slate-300 dark:border-slate-700 hover:border-slate-400'
        }`}
      >
        <span className="text-xs text-slate-600 dark:text-slate-300 font-medium truncate">
          {selectedValues.length === 0
            ? placeholder
            : `Click to modify selection (${selectedValues.length} marked)`}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 transition-transform duration-200 shrink-0 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </div>

      {/* Floating Dropdown Menu Panel (Mark Format) */}
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Header & Search */}
          <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 space-y-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search options to mark..."
                className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs outline-none focus:border-amber-500"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>

          {/* List of Options with Mark / Checkboxes */}
          <div className="max-h-56 overflow-y-auto p-1.5 space-y-0.5">
            {filteredOptions.length === 0 ? (
              <div className="p-3 text-center text-xs text-slate-400">
                No matching options found.
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isMarked = selectedValues.includes(opt);
                return (
                  <div
                    key={opt}
                    onClick={() => onToggleValue(opt)}
                    className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
                      isMarked
                        ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 font-bold'
                        : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      {isMarked ? (
                        <CheckSquare className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                      ) : (
                        <Square className="w-4 h-4 text-slate-300 dark:text-slate-600 shrink-0" />
                      )}
                      <span>{opt}</span>
                    </div>
                    {isMarked && (
                      <span className="text-[10px] bg-amber-500 text-slate-950 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                        Marked
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Add Custom Option Form */}
          {onAddCustomValue && (
            <div
              className="p-2.5 bg-slate-50 dark:bg-slate-800/60 border-t border-slate-200 dark:border-slate-800 flex gap-1.5"
              onClick={(e) => e.stopPropagation()}
            >
              <input
                type="text"
                value={customInput}
                onChange={(e) => setCustomInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddCustom();
                  }
                }}
                placeholder="Add custom option..."
                className="flex-1 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none focus:border-amber-500"
              />
              <button
                type="button"
                onClick={handleAddCustom}
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs flex items-center gap-1 shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
