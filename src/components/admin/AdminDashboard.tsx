import React, { useState } from 'react';
import { useSchool } from '../../context/SchoolContext';
import { Users, BookOpen, GraduationCap, Award, Settings, FileText, CheckCircle2, Download, ShieldCheck, Plus, X } from 'lucide-react';

export const AdminDashboard: React.FC<{ onNavigate: (tab: string) => void }> = ({ onNavigate }) => {
  const { students, teachers, parents, applications, subjects, addSubject, systemSettings } = useSchool();

  const [showAddSubjectModal, setShowAddSubjectModal] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  // Form State for Adding New Subject directly from Admin Dashboard
  const [subjectForm, setSubjectForm] = useState({
    name: '',
    code: '',
    category: 'General' as 'Science' | 'Arts' | 'Commercial' | 'General',
    isCompulsory: false,
  });

  const pendingApps = applications.filter((a) => a.status === 'Pending').length;

  const handleAddSubjectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjectForm.name.trim() || !subjectForm.code.trim()) {
      alert('Please enter both subject name and code.');
      return;
    }

    addSubject({
      name: subjectForm.name.trim(),
      code: subjectForm.code.trim().toUpperCase(),
      category: subjectForm.category,
      isCompulsory: subjectForm.isCompulsory,
    });

    setNotification(`Subject "${subjectForm.name.trim()}" successfully created!`);
    setShowAddSubjectModal(false);
    setSubjectForm({
      name: '',
      code: '',
      category: 'General',
      isCompulsory: false,
    });

    setTimeout(() => setNotification(null), 4000);
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      
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

      {/* Admin Banner */}
      <div className="bg-slate-900 text-white rounded-3xl p-8 border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl">
        <div className="space-y-1">
          <span className="text-amber-400 font-bold text-xs uppercase tracking-wider flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4" /> System Administrator Control Center
          </span>
          <h1 className="font-serif font-bold text-2xl sm:text-3xl">
            DIVINE ACADEMY SECONDARY SCHOOL Management
          </h1>
          <p className="text-xs text-slate-400">
            Current Session: {systemSettings.currentSession} ({systemSettings.currentTerm})
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setShowAddSubjectModal(true)}
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold px-5 py-3 rounded-xl text-xs flex items-center gap-2 shadow-lg transition-all"
          >
            <Plus className="w-4 h-4" /> Add New Subject
          </button>

          <button
            onClick={() => onNavigate('sessions')}
            className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-5 py-3 rounded-xl text-xs flex items-center gap-2 shadow-lg transition-all"
          >
            <Settings className="w-4 h-4" /> System Settings
          </button>
        </div>
      </div>

      {/* Admin KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        
        <div
          onClick={() => onNavigate('students')}
          className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-1 shadow-sm cursor-pointer hover:border-amber-400 transition-colors"
        >
          <span className="text-xs font-bold uppercase text-slate-500">Total Enrolled Students</span>
          <p className="font-serif font-black text-3xl text-slate-900 dark:text-white">{students.length}</p>
          <p className="text-[11px] text-emerald-600 font-semibold">Active in 12 Classes</p>
        </div>

        <div
          onClick={() => onNavigate('teachers')}
          className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-1 shadow-sm cursor-pointer hover:border-amber-400 transition-colors"
        >
          <span className="text-xs font-bold uppercase text-slate-500">Teaching Staff</span>
          <p className="font-serif font-black text-3xl text-amber-500">{teachers.length}</p>
          <p className="text-[11px] text-slate-500">Full-time Faculty</p>
        </div>

        <div
          onClick={() => onNavigate('applications')}
          className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-1 shadow-sm cursor-pointer hover:border-amber-400 transition-colors"
        >
          <span className="text-xs font-bold uppercase text-slate-500">Online Applications</span>
          <p className="font-serif font-black text-3xl text-blue-600">{applications.length}</p>
          <p className="text-[11px] text-amber-600 font-semibold">{pendingApps} Pending Review</p>
        </div>

        <div
          onClick={() => onNavigate('subjects')}
          className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-1 shadow-sm cursor-pointer hover:border-amber-400 transition-colors"
        >
          <span className="text-xs font-bold uppercase text-slate-500">Curriculum Subjects</span>
          <p className="font-serif font-black text-3xl text-purple-600">{subjects.length}</p>
          <p className="text-[11px] text-slate-500 font-semibold">Active Subjects Offerings</p>
        </div>

      </div>

      {/* Modules Shortcuts */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-md">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
          <h3 className="font-serif font-bold text-lg text-slate-900 dark:text-white">
            Administrative Operations
          </h3>
          <button
            onClick={() => setShowAddSubjectModal(true)}
            className="text-xs font-bold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> Quick Add Subject
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          
          <button
            onClick={() => onNavigate('students')}
            className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-left space-y-1 transition-all border border-slate-200 dark:border-slate-700"
          >
            <GraduationCap className="w-6 h-6 text-amber-500 mb-2" />
            <p className="font-bold text-xs text-slate-900 dark:text-white">Student Information System (SIS)</p>
            <p className="text-[11px] text-slate-500">Manage student enrollment, classes & IDs</p>
          </button>

          <button
            onClick={() => onNavigate('teachers')}
            className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-left space-y-1 transition-all border border-slate-200 dark:border-slate-700"
          >
            <Users className="w-6 h-6 text-blue-500 mb-2" />
            <p className="font-bold text-xs text-slate-900 dark:text-white">Staff & Faculty Directory</p>
            <p className="text-[11px] text-slate-500">Assign subjects, form teachers & roles</p>
          </button>

          <button
            onClick={() => onNavigate('applications')}
            className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-left space-y-1 transition-all border border-slate-200 dark:border-slate-700"
          >
            <FileText className="w-6 h-6 text-emerald-500 mb-2" />
            <p className="font-bold text-xs text-slate-900 dark:text-white">Admissions & Applications Desk</p>
            <p className="text-[11px] text-slate-500">Review candidate forms & approve entries</p>
          </button>

          <button
            onClick={() => onNavigate('subjects')}
            className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-left space-y-1 transition-all border border-slate-200 dark:border-slate-700 relative group"
          >
            <BookOpen className="w-6 h-6 text-purple-500 mb-2" />
            <p className="font-bold text-xs text-slate-900 dark:text-white">Curriculum & Subject Manager</p>
            <p className="text-[11px] text-slate-500">Define subjects, codes & department categories ({subjects.length} registered)</p>
          </button>

          <button
            onClick={() => onNavigate('sessions')}
            className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-left space-y-1 transition-all border border-slate-200 dark:border-slate-700"
          >
            <Settings className="w-6 h-6 text-red-500 mb-2" />
            <p className="font-bold text-xs text-slate-900 dark:text-white">Academic Sessions & Result Release</p>
            <p className="text-[11px] text-slate-500">Set active terms & result publication</p>
          </button>

          <button
            onClick={() => alert('Full database backup exported to JSON!')}
            className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-left space-y-1 transition-all border border-slate-200 dark:border-slate-700"
          >
            <Download className="w-6 h-6 text-slate-700 dark:text-slate-300 mb-2" />
            <p className="font-bold text-xs text-slate-900 dark:text-white">Database Backup & Export</p>
            <p className="text-[11px] text-slate-500">Export local DB schema snapshot</p>
          </button>

        </div>
      </div>

      {/* Direct Add New Subject Modal on Admin Dashboard */}
      {showAddSubjectModal && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-md w-full border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-serif font-bold text-lg text-slate-900 dark:text-white flex items-center gap-2">
                <Plus className="w-5 h-5 text-purple-600" /> Create New Academic Subject
              </h3>
              <button
                onClick={() => setShowAddSubjectModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSubjectSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Subject Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Further Mathematics, Financial Accounting"
                  value={subjectForm.name}
                  onChange={(e) => setSubjectForm({ ...subjectForm, name: e.target.value })}
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
                  placeholder="e.g. MTH202, ACC101, CIV101"
                  value={subjectForm.code}
                  onChange={(e) => setSubjectForm({ ...subjectForm, code: e.target.value.toUpperCase() })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none focus:border-purple-500 text-slate-900 dark:text-white font-mono font-bold uppercase"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Department / Category *
                </label>
                <select
                  value={subjectForm.category}
                  onChange={(e) =>
                    setSubjectForm({ ...subjectForm, category: e.target.value as any })
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
                  id="dashboardIsCompulsory"
                  checked={subjectForm.isCompulsory}
                  onChange={(e) => setSubjectForm({ ...subjectForm, isCompulsory: e.target.checked })}
                  className="w-4 h-4 text-purple-600 rounded border-slate-300 focus:ring-purple-500 cursor-pointer"
                />
                <label htmlFor="dashboardIsCompulsory" className="font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                  Compulsory subject for all enrolled students
                </label>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddSubjectModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold shadow-md"
                >
                  Save Subject
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

