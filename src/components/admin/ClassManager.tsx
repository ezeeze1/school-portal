import React, { useState, useMemo, useEffect } from 'react';
import { useSchool } from '../../context/SchoolContext';
import { SchoolClass } from '../../types';
import {
  canonicalClassKey,
  ClassCategory,
  countClassDependencies,
  formatClassDependencyError,
  inferClassCategory,
  NIGERIAN_SECONDARY_CLASS_PRESETS,
  parseArmsInput,
  StandardClassPreset,
} from '../../lib/classManagement';
import {
  School,
  Plus,
  Search,
  Filter,
  Edit,
  Trash2,
  Users,
  UserCheck,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  X,
  Loader2,
  Lock,
} from 'lucide-react';
import { ConfirmDeleteModal } from '../common/ConfirmDeleteModal';

interface ClassFormState {
  name: string;
  category: ClassCategory;
  armsText: string;
  classTeacherId: string;
  capacity: string;
}

const EMPTY_FORM: ClassFormState = {
  name: '',
  category: 'Junior Secondary',
  armsText: 'A, B',
  classTeacherId: '',
  capacity: '35',
};

export const ClassManager: React.FC = () => {
  const {
    activeRole,
    currentUser,
    classes,
    teachers,
    students,
    scores,
    results,
    attendance,
    cbtExams,
    assignments,
    studyNotes,
    refreshClasses,
    addClass,
    updateClass,
    deleteClass,
  } = useSchool();

  const isAdmin = activeRole === 'admin' && currentUser?.role === 'admin';

  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'All' | ClassCategory>('All');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [showFormModal, setShowFormModal] = useState(false);
  const [editingClass, setEditingClass] = useState<SchoolClass | null>(null);
  const [formState, setFormState] = useState<ClassFormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [classToDelete, setClassToDelete] = useState<SchoolClass | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sync latest rows directly from Supabase when opening Class Management
  useEffect(() => {
    let active = true;
    const loadLatest = async () => {
      setIsRefreshing(true);
      const res = await refreshClasses();
      if (!active) return;
      if (!res.ok && res.error) {
        setErrorMsg(res.error);
      }
      setIsRefreshing(false);
    };
    void loadLatest();
    return () => {
      active = false;
    };
    // Run once when Class Management mounts
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showSuccess = (message: string) => {
    setErrorMsg(null);
    setSuccessMsg(message);
    setTimeout(() => {
      setSuccessMsg((curr) => (curr === message ? null : curr));
    }, 4500);
  };

  const teacherMap = useMemo(() => {
    return new Map(teachers.map((t) => [t.id, t]));
  }, [teachers]);

  const existingNameKeys = useMemo(() => {
    return new Set(classes.map((c) => canonicalClassKey(c.name)));
  }, [classes]);

  const dependencyMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof countClassDependencies>>();
    for (const cls of classes) {
      map.set(
        cls.id,
        countClassDependencies(cls.id, {
          students,
          scores,
          results,
          attendance,
          cbtExams,
          assignments,
          studyNotes,
          teachers,
        })
      );
    }
    return map;
  }, [classes, students, scores, results, attendance, cbtExams, assignments, studyNotes, teachers]);

  const filteredClasses = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return classes.filter((cls) => {
      const matchesCategory = categoryFilter === 'All' || cls.category === categoryFilter;
      if (!matchesCategory) return false;
      if (!query) return true;

      const assignedTeacher = cls.classTeacherId ? teacherMap.get(cls.classTeacherId) : undefined;
      const teacherName = assignedTeacher
        ? `${assignedTeacher.firstName} ${assignedTeacher.lastName}`.toLowerCase()
        : '';
      const armsJoined = (cls.arms ?? []).join(' ').toLowerCase();

      return (
        cls.name.toLowerCase().includes(query) ||
        cls.category.toLowerCase().includes(query) ||
        armsJoined.includes(query) ||
        teacherName.includes(query)
      );
    });
  }, [classes, categoryFilter, searchTerm, teacherMap]);

  const stats = useMemo(() => {
    const juniorCount = classes.filter((c) => c.category === 'Junior Secondary').length;
    const seniorCount = classes.filter((c) => c.category === 'Senior Secondary').length;
    const totalCapacity = classes.reduce((sum, c) => sum + (c.capacity || 0), 0);
    const totalEnrolled = classes.reduce(
      (sum, c) => sum + (dependencyMap.get(c.id)?.students ?? 0),
      0
    );
    return {
      total: classes.length,
      juniorCount,
      seniorCount,
      totalCapacity,
      totalEnrolled,
    };
  }, [classes, dependencyMap]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    setErrorMsg(null);
    const res = await refreshClasses();
    setIsRefreshing(false);
    if (!res.ok) {
      setErrorMsg(res.error || 'Could not refresh classes from Supabase.');
    } else {
      showSuccess(`Synchronized ${res.data?.length ?? 0} class record(s) from Supabase.`);
    }
  };

  const openCreateModal = (preset?: StandardClassPreset) => {
    setEditingClass(null);
    setFormError(null);
    if (preset) {
      setFormState({
        name: preset.name,
        category: preset.category,
        armsText: preset.defaultArms.join(', '),
        classTeacherId: '',
        capacity: String(preset.defaultCapacity),
      });
    } else {
      setFormState(EMPTY_FORM);
    }
    setShowFormModal(true);
  };

  const openEditModal = (cls: SchoolClass) => {
    setEditingClass(cls);
    setFormError(null);
    setFormState({
      name: cls.name,
      category: cls.category,
      armsText: (cls.arms ?? []).join(', '),
      classTeacherId: cls.classTeacherId || '',
      capacity: String(cls.capacity ?? 35),
    });
    setShowFormModal(true);
  };

  const handleNameChange = (value: string) => {
    const inferred = inferClassCategory(value);
    setFormError(null);
    setFormState((prev) => ({
      ...prev,
      name: value,
      category: inferred ?? prev.category,
    }));
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || isSaving) return;

    setFormError(null);
    setIsSaving(true);

    const payload: Omit<SchoolClass, 'id'> = {
      name: formState.name,
      category: formState.category,
      arms: parseArmsInput(formState.armsText),
      classTeacherId: formState.classTeacherId.trim() || undefined,
      capacity: Number(formState.capacity),
    };

    try {
      const result = editingClass
        ? await updateClass(editingClass.id, payload)
        : await addClass(payload);

      if (!result.ok) {
        setFormError(result.error || 'Could not save class record to Supabase.');
        return;
      }

      const savedName = result.data?.name || formState.name.trim();
      setShowFormModal(false);
      setEditingClass(null);
      setFormState(EMPTY_FORM);
      showSuccess(
        editingClass
          ? `Class "${savedName}" updated in Supabase.`
          : `Class "${savedName}" created in Supabase and is now available for student enrollment.`
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleRequestDelete = (cls: SchoolClass) => {
    const deps = dependencyMap.get(cls.id);
    if (deps && deps.totalLinked > 0) {
      setErrorMsg(formatClassDependencyError(cls.name, deps));
      return;
    }
    setErrorMsg(null);
    setClassToDelete(cls);
  };

  const handleConfirmDelete = async () => {
    if (!classToDelete || isDeleting) return;
    const target = classToDelete;
    setIsDeleting(true);
    setErrorMsg(null);
    try {
      const res = await deleteClass(target.id);
      if (!res.ok) {
        setErrorMsg(res.error || `Could not delete class "${target.name}".`);
      } else {
        showSuccess(`Unused class "${target.name}" was safely removed from Supabase.`);
      }
    } finally {
      setIsDeleting(false);
      setClassToDelete(null);
    }
  };

  const parsedArmsPreview = parseArmsInput(formState.armsText);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Success Toast */}
      {successMsg && (
        <div className="bg-emerald-100 dark:bg-emerald-950/70 text-emerald-900 dark:text-emerald-200 p-4 rounded-2xl border border-emerald-300 dark:border-emerald-800 flex items-center justify-between gap-3 text-xs font-bold shadow-md">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            {successMsg}
          </span>
          <button
            type="button"
            onClick={() => setSuccessMsg(null)}
            className="text-emerald-700 dark:text-emerald-300 hover:opacity-75"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Error Alert Banner */}
      {errorMsg && (
        <div className="bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 p-4 rounded-2xl border border-red-200 dark:border-red-800 flex items-center justify-between gap-3 text-xs font-bold shadow-sm">
          <span className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
            {errorMsg}
          </span>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="text-red-500 hover:opacity-75"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div>
          <h2 className="font-serif font-bold text-2xl text-slate-900 dark:text-white flex items-center gap-2.5">
            <School className="w-6 h-6 text-amber-500" /> Class Management
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Manage Nigerian secondary school classes (JSS 1 – JSS 3, SS 1 – SS 3), class arms, form
            teachers, and enrollment capacities directly in Supabase.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold px-3.5 py-2.5 rounded-xl text-xs flex items-center gap-1.5 border border-slate-200 dark:border-slate-700 transition-colors disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-amber-500 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Syncing...' : 'Refresh'}
          </button>

          {isAdmin && (
            <button
              type="button"
              onClick={() => openCreateModal()}
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-5 py-2.5 rounded-xl text-xs flex items-center gap-2 transition-all shadow-md"
            >
              <Plus className="w-4 h-4" /> Add New Class
            </button>
          )}
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
          <span className="text-[11px] font-bold uppercase text-slate-500">Total Classes</span>
          <p className="font-serif font-black text-3xl text-slate-900 dark:text-white">
            {stats.total}
          </p>
          <p className="text-[11px] text-slate-500">Stored in Supabase</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
          <span className="text-[11px] font-bold uppercase text-slate-500">Junior Secondary</span>
          <p className="font-serif font-black text-3xl text-blue-600 dark:text-blue-400">
            {stats.juniorCount}
          </p>
          <p className="text-[11px] text-slate-500">JSS 1 – JSS 3 Levels</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
          <span className="text-[11px] font-bold uppercase text-slate-500">Senior Secondary</span>
          <p className="font-serif font-black text-3xl text-amber-500">
            {stats.seniorCount}
          </p>
          <p className="text-[11px] text-slate-500">SS 1 – SS 3 Levels</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-1">
          <span className="text-[11px] font-bold uppercase text-slate-500">Enrolled Students</span>
          <p className="font-serif font-black text-3xl text-emerald-600 dark:text-emerald-400">
            {stats.totalEnrolled}
          </p>
          <p className="text-[11px] text-slate-500">
            of {stats.totalCapacity} combined seat capacity
          </p>
        </div>
      </div>

      {/* Nigerian Secondary School Quick-Create Strip */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-serif font-bold text-sm text-slate-900 dark:text-white">
              Standard Nigerian Secondary School Classes
            </h3>
            <p className="text-[11px] text-slate-500">
              Click any unconfigured level to open the form pre-filled. Existing classes cannot be
              duplicated.
            </p>
          </div>
          <span className="text-[11px] font-bold text-slate-500">
            {NIGERIAN_SECONDARY_CLASS_PRESETS.filter((p) =>
              existingNameKeys.has(canonicalClassKey(p.name))
            ).length}{' '}
            / {NIGERIAN_SECONDARY_CLASS_PRESETS.length} standard levels configured
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {NIGERIAN_SECONDARY_CLASS_PRESETS.map((preset) => {
            const exists = existingNameKeys.has(canonicalClassKey(preset.name));
            return (
              <button
                key={preset.name}
                type="button"
                disabled={exists || !isAdmin}
                onClick={() => openCreateModal(preset)}
                className={`p-3 rounded-2xl border text-left transition-all flex items-center justify-between gap-2 ${
                  exists
                    ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/70 text-emerald-800 dark:text-emerald-300 cursor-default'
                    : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 hover:border-amber-400 hover:bg-amber-50/40 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100'
                }`}
              >
                <div>
                  <p className="font-bold text-xs">{preset.name}</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    {preset.category === 'Junior Secondary' ? 'Junior' : 'Senior'}
                  </p>
                </div>
                {exists ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                ) : (
                  <Plus className="w-4 h-4 text-amber-500 shrink-0" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Search & Category Filter Bar */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search class name, arm, or form teacher..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-amber-400"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          {(['All', 'Junior Secondary', 'Senior Secondary'] as const).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                categoryFilter === cat
                  ? 'bg-slate-900 dark:bg-amber-500 text-white dark:text-slate-950 shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Classes Roster Table */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-900 text-white font-semibold">
                <th className="p-3.5">Class Name & Arms</th>
                <th className="p-3.5">Category</th>
                <th className="p-3.5">Class Teacher</th>
                <th className="p-3.5">Enrollment / Capacity</th>
                <th className="p-3.5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredClasses.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-10 text-center text-slate-500 space-y-2">
                    <School className="w-8 h-8 text-slate-400 mx-auto" />
                    <p className="font-bold text-sm text-slate-700 dark:text-slate-300">
                      {classes.length === 0
                        ? 'No classes have been created in Supabase yet.'
                        : 'No classes match your current search or filter.'}
                    </p>
                    <p className="text-xs text-slate-400">
                      {classes.length === 0
                        ? 'Click "Add New Class" or pick a standard level above (JSS 1 – SS 3) to get started.'
                        : 'Try clearing your search query or switching the category filter.'}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredClasses.map((cls) => {
                  const teacher = cls.classTeacherId ? teacherMap.get(cls.classTeacherId) : undefined;
                  const deps = dependencyMap.get(cls.id);
                  const enrolled = deps?.students ?? 0;
                  const totalLinked = deps?.totalLinked ?? 0;
                  const otherLinked = Math.max(0, totalLinked - enrolled);
                  const fillPercent = cls.capacity > 0 ? Math.min(100, Math.round((enrolled / cls.capacity) * 100)) : 0;

                  return (
                    <tr
                      key={cls.id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <td className="p-3.5">
                        <p className="font-bold text-sm text-slate-900 dark:text-white">
                          {cls.name}
                        </p>
                        {cls.arms && cls.arms.length > 0 ? (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {cls.arms.map((arm) => (
                              <span
                                key={arm}
                                className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-semibold text-slate-600 dark:text-slate-300"
                              >
                                {arm}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[10px] text-slate-400 mt-0.5">No arms configured</p>
                        )}
                      </td>

                      <td className="p-3.5">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            cls.category === 'Junior Secondary'
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                          }`}
                        >
                          {cls.category}
                        </span>
                      </td>

                      <td className="p-3.5">
                        {teacher ? (
                          <div className="flex items-center gap-2">
                            <UserCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                            <div>
                              <p className="font-semibold text-slate-900 dark:text-white">
                                {teacher.firstName} {teacher.lastName}
                              </p>
                              <p className="text-[10px] text-slate-400 font-mono">
                                {teacher.staffId}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Unassigned</span>
                        )}
                      </td>

                      <td className="p-3.5 min-w-[170px]">
                        <div className="flex items-center justify-between text-[11px] font-semibold mb-1">
                          <span className="flex items-center gap-1 text-slate-800 dark:text-slate-200">
                            <Users className="w-3.5 h-3.5 text-amber-500" />
                            {enrolled} {enrolled === 1 ? 'student' : 'students'}
                          </span>
                          <span className="text-slate-400">Cap: {cls.capacity}</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              fillPercent >= 95
                                ? 'bg-red-500'
                                : fillPercent >= 75
                                  ? 'bg-amber-500'
                                  : 'bg-emerald-500'
                            }`}
                            style={{ width: `${fillPercent}%` }}
                          />
                        </div>
                        {otherLinked > 0 && (
                          <p className="text-[10px] text-slate-400 mt-1">
                            +{otherLinked} linked academic {otherLinked === 1 ? 'record' : 'records'}
                          </p>
                        )}
                      </td>

                      <td className="p-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEditModal(cls)}
                            disabled={!isAdmin}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950 rounded-lg transition-colors flex items-center gap-1 font-semibold text-[11px] disabled:opacity-40"
                            title="Edit Class"
                          >
                            <Edit className="w-4 h-4" /> Edit
                          </button>

                          <button
                            type="button"
                            onClick={() => handleRequestDelete(cls)}
                            disabled={!isAdmin || isDeleting}
                            className={`p-1.5 rounded-lg transition-colors flex items-center gap-1 text-[11px] font-semibold ${
                              totalLinked > 0
                                ? 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                                : 'text-red-500 hover:bg-red-50 dark:hover:bg-red-950'
                            }`}
                            title={
                              totalLinked > 0
                                ? `Protected: linked to ${totalLinked} school record(s)`
                                : 'Delete Unused Class'
                            }
                          >
                            {totalLinked > 0 ? (
                              <Lock className="w-4 h-4" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Class Modal */}
      {showFormModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <form
            onSubmit={handleFormSubmit}
            className="bg-white dark:bg-slate-900 p-7 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-lg w-full space-y-5 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h3 className="font-serif font-bold text-xl text-slate-900 dark:text-white flex items-center gap-2">
                  <School className="w-5 h-5 text-amber-500" />
                  {editingClass ? `Edit Class — ${editingClass.name}` : 'Create New Class'}
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Saved directly to Supabase <code className="font-mono">public.classes</code>.
                </p>
              </div>
              <button
                type="button"
                disabled={isSaving}
                onClick={() => setShowFormModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-2 text-xs text-red-600 dark:text-red-400 font-bold">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            {/* Quick-select standard level pills inside Create mode */}
            {!editingClass && (
              <div className="space-y-1.5">
                <span className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Quick-Fill Standard Level
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {NIGERIAN_SECONDARY_CLASS_PRESETS.map((preset) => {
                    const exists = existingNameKeys.has(canonicalClassKey(preset.name));
                    const isSelected =
                      canonicalClassKey(formState.name) === canonicalClassKey(preset.name);
                    return (
                      <button
                        key={preset.name}
                        type="button"
                        disabled={exists || isSaving}
                        onClick={() => {
                          setFormError(null);
                          setFormState((prev) => ({
                            ...prev,
                            name: preset.name,
                            category: preset.category,
                            armsText: preset.defaultArms.join(', '),
                            capacity: String(preset.defaultCapacity),
                          }));
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors ${
                          exists
                            ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 line-through cursor-not-allowed'
                            : isSelected
                              ? 'bg-amber-500 text-slate-950 border-amber-500'
                              : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-amber-400'
                        }`}
                      >
                        {preset.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Class Name *
                </label>
                <input
                  type="text"
                  required
                  disabled={isSaving}
                  value={formState.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g. JSS 1, SS 2"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none focus:border-amber-500 text-slate-900 dark:text-white font-semibold disabled:opacity-60"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  School Category *
                </label>
                <select
                  value={formState.category}
                  disabled={isSaving}
                  onChange={(e) => {
                    setFormError(null);
                    setFormState({
                      ...formState,
                      category: e.target.value as ClassCategory,
                    });
                  }}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none focus:border-amber-500 text-slate-900 dark:text-white font-semibold cursor-pointer disabled:opacity-60"
                >
                  <option value="Junior Secondary">Junior Secondary</option>
                  <option value="Senior Secondary">Senior Secondary</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Class Teacher (Form Teacher)
                </label>
                <select
                  value={formState.classTeacherId}
                  disabled={isSaving}
                  onChange={(e) => {
                    setFormError(null);
                    setFormState({ ...formState, classTeacherId: e.target.value });
                  }}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none focus:border-amber-500 text-slate-900 dark:text-white font-semibold cursor-pointer disabled:opacity-60"
                >
                  <option value="">Unassigned</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.firstName} {t.lastName} ({t.staffId})
                    </option>
                  ))}
                </select>
                {teachers.length === 0 && (
                  <p className="text-[10px] text-slate-400 mt-1">
                    Add teachers in Staff & Faculty to assign a class teacher.
                  </p>
                )}
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Classroom Capacity *
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  max={500}
                  step={1}
                  disabled={isSaving}
                  value={formState.capacity}
                  onChange={(e) => {
                    setFormError(null);
                    setFormState({ ...formState, capacity: e.target.value });
                  }}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none focus:border-amber-500 text-slate-900 dark:text-white font-semibold disabled:opacity-60"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Class Arms / Streams (comma-separated)
                </label>
                <input
                  type="text"
                  disabled={isSaving}
                  value={formState.armsText}
                  onChange={(e) => {
                    setFormError(null);
                    setFormState({ ...formState, armsText: e.target.value });
                  }}
                  placeholder="e.g. A, B, C or Science, Arts, Commercial"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl outline-none focus:border-amber-500 text-slate-900 dark:text-white font-medium disabled:opacity-60"
                />
                {parsedArmsPreview.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {parsedArmsPreview.map((arm) => (
                      <span
                        key={arm}
                        className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-[10px] font-bold"
                      >
                        {arm}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                disabled={isSaving}
                onClick={() => setShowFormModal(false)}
                className="px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 font-bold text-xs disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-md flex items-center gap-2 disabled:opacity-60"
              >
                {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {isSaving
                  ? 'Saving to Supabase...'
                  : editingClass
                    ? 'Save Class Changes'
                    : 'Create Class'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Safe Deletion Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={Boolean(classToDelete)}
        onClose={() => {
          if (!isDeleting) setClassToDelete(null);
        }}
        onConfirm={() => {
          void handleConfirmDelete();
        }}
        title="Confirm Class Deletion"
        message="Are you sure you want to permanently remove this unused class from Supabase? Classes linked to students or academic records are automatically protected."
        itemName={
          classToDelete ? `${classToDelete.name} (${classToDelete.category})` : undefined
        }
        confirmText={isDeleting ? 'Deleting...' : 'Yes, Delete Class'}
      />
    </div>
  );
};
