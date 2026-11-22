import React, { useState } from 'react';
import { useSchool } from '../../context/SchoolContext';
import { Subject } from '../../types';
import { BookOpen, Plus, Search, CheckCircle2, X, Filter, AlertCircle } from 'lucide-react';

export const SubjectManager: React.FC = () => {
  const { subjects, addSubject } = useSchool();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [showAddModal, setShowAddModal] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const [subjectError, setSubjectError] = useState<string | null>(null);
  const [isSavingSubject, setIsSavingSubject] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    category: 'General' as 'Science' | 'Arts' | 'Commercial' | 'General',
    isCompulsory: false,
  });

  const categories = ['All', 'General', 'Science', 'Arts', 'Commercial'];

  const filteredSubjects = subjects.filter((subj) => {
    const matchesSearch =
      subj.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      subj.code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || subj.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSavingSubject) return;
    setSubjectError(null);
    if (!formData.name.trim() || !formData.code.trim()) {
      setSubjectError('Please provide both a Subject Name and Subject Code.');
      return;
    }

    setIsSavingSubject(true);
    try {
      const res = await addSubject({
        name: formData.name.trim(),
        code: formData.code.trim().toUpperCase(),
        category: formData.category,
        isCompulsory: formData.isCompulsory,
      });

      if (!res.ok) {
        setSubjectError(res.error || 'Could not save subject to Supabase.');
        return;
      }

      setNotification(`Subject "${res.data?.name || formData.name.trim()}" successfully added to curriculum!`);
      setShowAddModal(false);
      setFormData({
        name: '',
        code: '',
        category: 'General',
        isCompulsory: false,
      });

      setTimeout(() => setNotification(null), 4000);
    } finally {
      setIsSavingSubject(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Toast Notification */}
      {notification && (
        <div className="bg-emerald-500 text-white font-bold p-4 rounded-2xl flex items-center justify-between shadow-lg text-xs animate-bounce">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5" />
            {notification}
          </span>
          <button onClick={() => setNotification(null)}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <h2 className="font-serif font-bold text-2xl text-slate-900 dark:text-white flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-purple-500" /> Curriculum & Subject Manager
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Define academic subjects, subject codes, department categories, and core compulsory courses.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-5 py-2.5 rounded-xl text-xs flex items-center gap-2 transition-all shadow-md flex-shrink-0"
        >
          <Plus className="w-4 h-4" /> Add New Subject
        </button>
      </div>

      {/* Search and Category Filter Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search subject name or code..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none focus:border-purple-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          <Filter className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex-shrink-0 ${
                selectedCategory === cat
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Subjects Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredSubjects.map((subj) => (
          <div
            key={subj.id}
            className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-3 shadow-sm hover:border-purple-300 transition-all flex flex-col justify-between"
          >
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-purple-600 dark:text-purple-400 border border-slate-200 dark:border-slate-700">
                  {subj.code}
                </span>

                <span
                  className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                    subj.category === 'Science'
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                      : subj.category === 'Arts'
                      ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                      : subj.category === 'Commercial'
                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                      : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                  }`}
                >
                  {subj.category}
                </span>
              </div>

              <h3 className="font-bold text-base text-slate-900 dark:text-white pt-1">
                {subj.name}
              </h3>
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">Curriculum Status:</span>
              {subj.isCompulsory ? (
                <span className="font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/50 px-2 py-0.5 rounded border border-purple-200 dark:border-purple-800">
                  Compulsory
                </span>
              ) : (
                <span className="font-medium text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                  Elective
                </span>
              )}
            </div>
          </div>
        ))}

        {filteredSubjects.length === 0 && (
          <div className="col-span-full p-8 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-300 dark:border-slate-800 text-center text-slate-500 space-y-2">
            <BookOpen className="w-8 h-8 text-slate-400 mx-auto" />
            <p className="font-bold text-sm">No subjects found matching filter.</p>
            <p className="text-xs">Click "Add New Subject" to create a new academic subject.</p>
          </div>
        )}
      </div>

      {/* Add New Subject Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-serif font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-purple-600" /> Add New Academic Subject
              </h3>
              <button
                onClick={() => {
                  setSubjectError(null);
                  setShowAddModal(false);
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-4 text-xs">
              {subjectError && (
                <div className="bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 p-3 rounded-xl flex items-center gap-2 font-bold">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{subjectError}</span>
                </div>
              )}
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Subject Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Further Mathematics, Civic Education"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none focus:border-purple-500 text-slate-900 dark:text-white font-semibold"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Subject Code * (Alphanumeric)
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. MTH102, CIV101, PHY202"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none focus:border-purple-500 text-slate-900 dark:text-white font-mono font-bold uppercase"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Department / Category *
                </label>
                <select
                  value={formData.category}
                  onChange={(e) =>
                    setFormData({ ...formData, category: e.target.value as any })
                  }
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none focus:border-purple-500 text-slate-900 dark:text-white font-semibold cursor-pointer"
                >
                  <option value="General">General (Compulsory/Core)</option>
                  <option value="Science">Science Department</option>
                  <option value="Arts">Arts & Humanities</option>
                  <option value="Commercial">Commercial & Business</option>
                </select>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="isCompulsory"
                  checked={formData.isCompulsory}
                  onChange={(e) => setFormData({ ...formData, isCompulsory: e.target.checked })}
                  className="w-4 h-4 text-purple-600 rounded border-slate-300 focus:ring-purple-500 cursor-pointer"
                />
                <label htmlFor="isCompulsory" className="font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                  Compulsory subject for all enrolled students
                </label>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingSubject}
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-bold shadow-md"
                >
                  {isSavingSubject ? 'Saving...' : 'Save Subject'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
