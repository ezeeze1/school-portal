import React, { useState } from 'react';
import { useSchool } from '../../context/SchoolContext';
import { Download, FileText, Search, FileCode, CheckCircle2 } from 'lucide-react';

export const DownloadsPage: React.FC = () => {
  const { downloads } = useSchool();
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [downloadedDoc, setDownloadedDoc] = useState<string | null>(null);

  const categories = ['All', 'Academic', 'Admissions', 'Forms', 'Past Questions'];

  const filteredDocs = downloads.filter(
    (doc) => selectedCategory === 'All' || doc.category === selectedCategory
  );

  const handleDownloadClick = (title: string) => {
    setDownloadedDoc(title);
    setTimeout(() => setDownloadedDoc(null), 3000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10">
      
      {/* Page Title Header */}
      <div className="text-center space-y-3 max-w-3xl mx-auto">
        <span className="text-xs font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400">
          Resource Center
        </span>
        <h1 className="font-serif font-black text-3xl sm:text-5xl text-slate-900 dark:text-white">
          Downloads & Documents
        </h1>
        <p className="text-slate-600 dark:text-slate-400 text-sm">
          Access official academic calendars, admission prospectuses, uniform guidelines, and past CBT revision packs.
        </p>
      </div>

      {downloadedDoc && (
        <div className="bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 p-4 rounded-2xl border border-emerald-300 dark:border-emerald-800 flex items-center gap-2 text-xs font-bold max-w-md mx-auto animate-fade-in">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span>Downloaded: "{downloadedDoc}"</span>
        </div>
      )}

      {/* Category Pills Filter */}
      <div className="flex flex-wrap gap-2 justify-center">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              selectedCategory === cat
                ? 'bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950 shadow-md'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Documents List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredDocs.map((doc) => (
          <div
            key={doc.id}
            className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 flex items-start justify-between gap-4 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0 font-bold text-xs">
                {doc.fileType}
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-600 dark:text-slate-400">
                  {doc.category}
                </span>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white leading-snug">
                  {doc.title}
                </h3>
                <p className="text-[11px] text-slate-500">
                  Size: {doc.fileSize} • Last Updated: {doc.updatedDate}
                </p>
              </div>
            </div>

            <button
              onClick={() => handleDownloadClick(doc.title)}
              className="bg-slate-900 hover:bg-slate-800 dark:bg-amber-500 dark:hover:bg-amber-600 dark:text-slate-950 text-white p-3 rounded-xl transition-colors flex-shrink-0"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

    </div>
  );
};
