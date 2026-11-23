import React, { useState } from 'react';
import { useSchool } from '../../context/SchoolContext';
import { NewsItem } from '../../types';
import { Calendar, Tag, Search, User, ArrowRight, X } from 'lucide-react';

export const NewsEventsPage: React.FC = () => {
  const { newsItems, announcements } = useSchool();
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeArticleModal, setActiveArticleModal] = useState<NewsItem | null>(null);

  const categories = ['All', 'Academics', 'Sports', 'Events', 'Announcements'];

  const filteredNews = newsItems.filter((item) => {
    const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
    const matchesSearch =
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.summary.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10">
      
      {/* Page Title */}
      <div className="text-center space-y-3 max-w-3xl mx-auto">
        <span className="text-xs font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400">
          Stay Updated
        </span>
        <h1 className="font-serif font-black text-3xl sm:text-5xl text-slate-900 dark:text-white">
          News & Upcoming Events
        </h1>
        <p className="text-slate-600 dark:text-slate-400 text-sm">
          Discover the latest stories, academic achievements, sports competitions, and campus announcements.
        </p>
      </div>

      {/* Search & Category Filters */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        
        {/* Category Pills */}
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
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

        {/* Search Input */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search news..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>

      </div>

      {/* News Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filteredNews.map((item) => (
          <div
            key={item.id}
            onClick={() => setActiveArticleModal(item)}
            className="group bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm hover:shadow-xl transition-all cursor-pointer flex flex-col"
          >
            <div className="relative h-52 overflow-hidden">
              <img
                src={item.imageUrl}
                alt={item.title}
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              <span className="absolute top-3 left-3 bg-slate-950/80 text-amber-400 text-[11px] font-bold px-2.5 py-1 rounded-md backdrop-blur-sm uppercase">
                {item.category}
              </span>
            </div>

            <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-3 text-slate-400 text-xs">
                  <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5 text-amber-500" /> {item.date}</span>
                  <span>•</span>
                  <span className="flex items-center gap-1"><User className="w-3.5 h-3.5" /> {item.author}</span>
                </div>
                <h3 className="font-bold text-lg text-slate-900 dark:text-white leading-snug group-hover:text-amber-600 transition-colors">
                  {item.title}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-3 leading-relaxed">
                  {item.summary}
                </p>
              </div>

              <div className="pt-2 text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                Read Full Story <ArrowRight className="w-4 h-4" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Article Detail Modal */}
      {activeArticleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xl my-8">
            <div className="relative h-64">
              <img src={activeArticleModal.imageUrl} alt={activeArticleModal.title} className="w-full h-full object-cover" />
              <button
                onClick={() => setActiveArticleModal(null)}
                className="absolute top-4 right-4 bg-slate-950/70 text-white p-2 rounded-full hover:bg-slate-950"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-8 space-y-4">
              <span className="bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 text-xs font-bold px-2.5 py-1 rounded-md uppercase">
                {activeArticleModal.category}
              </span>
              <h2 className="font-serif font-bold text-2xl text-slate-900 dark:text-white">
                {activeArticleModal.title}
              </h2>
              <div className="flex items-center gap-3 text-xs text-slate-400 border-b border-slate-100 dark:border-slate-800 pb-3">
                <span>By {activeArticleModal.author}</span>
                <span>•</span>
                <span>Published on {activeArticleModal.date}</span>
              </div>
              <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-light">
                {activeArticleModal.content}
              </p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
