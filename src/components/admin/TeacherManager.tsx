import React, { useState } from 'react';
import { useSchool } from '../../context/SchoolContext';
import { Teacher } from '../../types';
import { Plus, Trash2, Edit, Lock, Check, X, BookOpen, GraduationCap } from 'lucide-react';

const PRESET_CLASSES = [
  'JSS 1 Gold',
  'JSS 2 Silver',
  'JSS 3 Bronze',
  'SS 1 Diamond',
  'SS 2 Gold',
  'SS 3 Ruby',
];

const PRESET_SUBJECTS = [
  'Mathematics',
  'English Language',
  'Physics',
  'Chemistry',
  'Biology',
  'Further Mathematics',
  'Economics',
  'Government',
  'Civic Education',
  'Computer Studies',
  'Agricultural Science',
  'Literature in English',
];

export const TeacherManager: React.FC = () => {
  const { teachers, addTeacher, updateTeacher, deleteTeacher } = useSchool();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);

  // Form state for adding educator
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: 'teacherpass123',
  });

  const [selectedClasses, setSelectedClasses] = useState<string[]>(['SS 2 Gold']);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>(['Mathematics', 'Further Mathematics']);
  const [customClassInput, setCustomClassInput] = useState('');
  const [customSubjectInput, setCustomSubjectInput] = useState('');

  // Edit Teacher Form State
  const [editFormData, setEditFormData] = useState<Partial<Teacher>>({});
  const [editSelectedClasses, setEditSelectedClasses] = useState<string[]>([]);
  const [editSelectedSubjects, setEditSelectedSubjects] = useState<string[]>([]);
  const [editCustomClassInput, setEditCustomClassInput] = useState('');
  const [editCustomSubjectInput, setEditCustomSubjectInput] = useState('');

  // Add modal toggle handlers
  const toggleClass = (cls: string) => {
    setSelectedClasses((prev) =>
      prev.includes(cls) ? prev.filter((c) => c !== cls) : [...prev, cls]
    );
  };

  const toggleSubject = (subj: string) => {
    setSelectedSubjects((prev) =>
      prev.includes(subj) ? prev.filter((s) => s !== subj) : [...prev, subj]
    );
  };

  const handleAddCustomClass = () => {
    const trimmed = customClassInput.trim();
    if (trimmed && !selectedClasses.includes(trimmed)) {
      setSelectedClasses((prev) => [...prev, trimmed]);
      setCustomClassInput('');
    }
  };

  const handleAddCustomSubject = () => {
    const trimmed = customSubjectInput.trim();
    if (trimmed && !selectedSubjects.includes(trimmed)) {
      setSelectedSubjects((prev) => [...prev, trimmed]);
      setCustomSubjectInput('');
    }
  };

  // Edit modal toggle handlers
  const toggleEditClass = (cls: string) => {
    setEditSelectedClasses((prev) =>
      prev.includes(cls) ? prev.filter((c) => c !== cls) : [...prev, cls]
    );
  };

  const toggleEditSubject = (subj: string) => {
    setEditSelectedSubjects((prev) =>
      prev.includes(subj) ? prev.filter((s) => s !== subj) : [...prev, subj]
    );
  };

  const handleEditAddCustomClass = () => {
    const trimmed = editCustomClassInput.trim();
    if (trimmed && !editSelectedClasses.includes(trimmed)) {
      setEditSelectedClasses((prev) => [...prev, trimmed]);
      setEditCustomClassInput('');
    }
  };

  const handleEditAddCustomSubject = () => {
    const trimmed = editCustomSubjectInput.trim();
    if (trimmed && !editSelectedSubjects.includes(trimmed)) {
      setEditSelectedSubjects((prev) => [...prev, trimmed]);
      setEditCustomSubjectInput('');
    }
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedClasses.length === 0) {
      alert('Please select or add at least one class taught.');
      return;
    }
    if (selectedSubjects.length === 0) {
      alert('Please select or add at least one subject taught.');
      return;
    }

    const primaryClass = selectedClasses[0] || 'SS 2 Gold';
    const joinedClasses = selectedClasses.join(', ');

    const newTch: Omit<Teacher, 'id'> = {
      staffId: `TCH/2026/${Math.floor(100 + Math.random() * 900)}`,
      firstName: formData.firstName,
      lastName: formData.lastName,
      email: formData.email,
      phone: formData.phone,
      subjectsTaught: selectedSubjects,
      formClassId: 'c-ss2',
      formClassName: primaryClass,
      classTaught: joinedClasses,
      classesTaught: selectedClasses,
      password: formData.password,
      status: 'Active',
      avatar: `https://images.unsplash.com/photo-${1544005313 + Math.floor(Math.random() * 1000)}?auto=format&fit=crop&w=300&q=80`,
    };

    addTeacher(newTch);
    setShowAddModal(false);
    // Reset form
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      password: 'teacherpass123',
    });
    setSelectedClasses(['SS 2 Gold']);
    setSelectedSubjects(['Mathematics', 'Further Mathematics']);
  };

  const handleStartEdit = (teacher: Teacher) => {
    setEditingTeacher(teacher);
    setEditFormData({ ...teacher });

    const existingClasses = teacher.classesTaught || 
      (teacher.classTaught ? teacher.classTaught.split(',').map((s) => s.trim()) : []);
    setEditSelectedClasses(existingClasses.length > 0 ? existingClasses : ['SS 2 Gold']);

    const existingSubjects = Array.isArray(teacher.subjectsTaught)
      ? teacher.subjectsTaught
      : (teacher.subjectsTaught ? (teacher.subjectsTaught as unknown as string).split(',').map((s) => s.trim()) : []);
    setEditSelectedSubjects(existingSubjects);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTeacher) return;
    if (editSelectedClasses.length === 0) {
      alert('Please select at least one class taught.');
      return;
    }
    if (editSelectedSubjects.length === 0) {
      alert('Please select at least one subject taught.');
      return;
    }

    const primaryClass = editSelectedClasses[0] || 'SS 2 Gold';
    const joinedClasses = editSelectedClasses.join(', ');

    updateTeacher(editingTeacher.id, {
      ...editFormData,
      subjectsTaught: editSelectedSubjects,
      classesTaught: editSelectedClasses,
      classTaught: joinedClasses,
      formClassName: primaryClass,
    });
    setEditingTeacher(null);
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-md flex justify-between items-center">
        <div>
          <h2 className="font-serif font-bold text-2xl text-slate-900 dark:text-white">
            Teaching Faculty & Staff Roster
          </h2>
          <p className="text-xs text-slate-500">
            Manage academic staff accounts, assign multiple classes taught, subjects, and portal login credentials.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-sm"
        >
          <Plus className="w-4 h-4" /> Add New Teacher
        </button>
      </div>

      {/* Educator Profiles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {teachers.map((teacher) => {
          const teacherClasses = teacher.classesTaught || (teacher.classTaught ? teacher.classTaught.split(',').map((s) => s.trim()) : []);
          return (
            <div
              key={teacher.id}
              className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-sm relative flex flex-col justify-between hover:border-amber-400/50 transition-all"
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3.5">
                    <img
                      src={teacher.avatar}
                      alt={teacher.firstName}
                      className="w-14 h-14 rounded-2xl object-cover border-2 border-amber-400 shadow-sm"
                    />
                    <div>
                      <h3 className="font-bold text-base text-slate-900 dark:text-white">
                        {teacher.firstName} {teacher.lastName}
                      </h3>
                      <span className="inline-block mt-0.5 px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] text-slate-500 font-mono font-bold">
                        {teacher.staffId}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="text-xs text-slate-600 dark:text-slate-400 space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                  {/* Classes Taught */}
                  <div>
                    <span className="font-semibold text-slate-700 dark:text-slate-300 block mb-1 flex items-center gap-1">
                      <GraduationCap className="w-3.5 h-3.5 text-amber-500" /> Classes Taught:
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {teacherClasses.length > 0 ? (
                        teacherClasses.map((cls, idx) => (
                          <span
                            key={idx}
                            className="bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50 text-[10px] font-bold px-2 py-0.5 rounded-lg"
                          >
                            {cls}
                          </span>
                        ))
                      ) : (
                        <span className="text-slate-400 italic">Unassigned</span>
                      )}
                    </div>
                  </div>

                  {/* Subjects Taught */}
                  <div>
                    <span className="font-semibold text-slate-700 dark:text-slate-300 block mb-1 flex items-center gap-1">
                      <BookOpen className="w-3.5 h-3.5 text-blue-500" /> Subjects Taught:
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {teacher.subjectsTaught && teacher.subjectsTaught.length > 0 ? (
                        teacher.subjectsTaught.map((subj, idx) => (
                          <span
                            key={idx}
                            className="bg-blue-50 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50 text-[10px] font-bold px-2 py-0.5 rounded-lg"
                          >
                            {subj}
                          </span>
                        ))
                      ) : (
                        <span className="text-slate-400 italic">No subjects assigned</span>
                      )}
                    </div>
                  </div>

                  <p className="pt-1">
                    <strong className="text-slate-700 dark:text-slate-300">Email:</strong> {teacher.email}
                  </p>
                  <p>
                    <strong className="text-slate-700 dark:text-slate-300">Phone:</strong> {teacher.phone || 'N/A'}
                  </p>
                  {teacher.password && (
                    <p className="text-[11px] text-slate-500 flex items-center gap-1 font-mono">
                      <Lock className="w-3 h-3 text-amber-500" /> Password assigned
                    </p>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <button
                  onClick={() => handleStartEdit(teacher)}
                  className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
                >
                  <Edit className="w-3.5 h-3.5" /> Edit
                </button>
                <button
                  onClick={() => deleteTeacher(teacher.id)}
                  className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950 rounded-lg transition-colors"
                  title="Delete Teacher Profile"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Register New Educator Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
          <form
            onSubmit={handleAddSubmit}
            className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-xl w-full space-y-4 shadow-2xl text-xs my-8"
          >
            <h3 className="font-serif font-bold text-xl text-slate-900 dark:text-white">Register New Educator</h3>
            <p className="text-xs text-slate-500">
              Assign single or multiple classes and subjects for this educator.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold mb-1">First Name *</label>
                <input
                  type="text"
                  required
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
                  placeholder="e.g. Samuel"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Last Name *</label>
                <input
                  type="text"
                  required
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
                  placeholder="e.g. Okon"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold mb-1">Official Email *</label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
                  placeholder="e.g. s.okon@divineacademy.edu"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Phone Number *</label>
                <input
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
                  placeholder="e.g. +234 802 345 6789"
                />
              </div>
            </div>

            {/* Select Multiple Classes Taught */}
            <div className="space-y-2 bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700">
              <label className="block font-bold text-slate-900 dark:text-white flex items-center justify-between">
                <span>Select Classes Taught * (Select multiple)</span>
                <span className="text-[10px] text-amber-600 font-bold">{selectedClasses.length} selected</span>
              </label>

              <div className="flex flex-wrap gap-1.5">
                {PRESET_CLASSES.map((cls) => {
                  const isSelected = selectedClasses.includes(cls);
                  return (
                    <button
                      type="button"
                      key={cls}
                      onClick={() => toggleClass(cls)}
                      className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1 text-[11px] ${
                        isSelected
                          ? 'bg-amber-500 text-slate-950 shadow-sm border border-amber-400'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-amber-400'
                      }`}
                    >
                      {isSelected ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : null}
                      {cls}
                    </button>
                  );
                })}

                {/* Custom classes added */}
                {selectedClasses
                  .filter((c) => !PRESET_CLASSES.includes(c))
                  .map((cls) => (
                    <button
                      type="button"
                      key={cls}
                      onClick={() => toggleClass(cls)}
                      className="px-3 py-1.5 rounded-xl font-bold bg-amber-500 text-slate-950 shadow-sm border border-amber-400 transition-all flex items-center gap-1 text-[11px]"
                    >
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                      {cls}
                      <X className="w-3 h-3 ml-0.5 hover:text-red-900" />
                    </button>
                  ))}
              </div>

              {/* Custom Class Add Input */}
              <div className="flex gap-2 pt-1">
                <input
                  type="text"
                  value={customClassInput}
                  onChange={(e) => setCustomClassInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddCustomClass();
                    }
                  }}
                  placeholder="Or type custom class (e.g. SS 3 Emerald)..."
                  className="flex-1 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs"
                />
                <button
                  type="button"
                  onClick={handleAddCustomClass}
                  className="bg-slate-800 hover:bg-slate-700 text-white font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Class
                </button>
              </div>
            </div>

            {/* Select Multiple Subjects Taught */}
            <div className="space-y-2 bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700">
              <label className="block font-bold text-slate-900 dark:text-white flex items-center justify-between">
                <span>Select Subjects Taught * (Select multiple)</span>
                <span className="text-[10px] text-blue-600 font-bold">{selectedSubjects.length} selected</span>
              </label>

              <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto pr-1">
                {PRESET_SUBJECTS.map((subj) => {
                  const isSelected = selectedSubjects.includes(subj);
                  return (
                    <button
                      type="button"
                      key={subj}
                      onClick={() => toggleSubject(subj)}
                      className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1 text-[11px] ${
                        isSelected
                          ? 'bg-blue-600 text-white shadow-sm border border-blue-500'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-blue-400'
                      }`}
                    >
                      {isSelected ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : null}
                      {subj}
                    </button>
                  );
                })}

                {/* Custom subjects added */}
                {selectedSubjects
                  .filter((s) => !PRESET_SUBJECTS.includes(s))
                  .map((subj) => (
                    <button
                      type="button"
                      key={subj}
                      onClick={() => toggleSubject(subj)}
                      className="px-3 py-1.5 rounded-xl font-bold bg-blue-600 text-white shadow-sm border border-blue-500 transition-all flex items-center gap-1 text-[11px]"
                    >
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                      {subj}
                      <X className="w-3 h-3 ml-0.5 hover:text-red-200" />
                    </button>
                  ))}
              </div>

              {/* Custom Subject Add Input */}
              <div className="flex gap-2 pt-1">
                <input
                  type="text"
                  value={customSubjectInput}
                  onChange={(e) => setCustomSubjectInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddCustomSubject();
                    }
                  }}
                  placeholder="Or type custom subject..."
                  className="flex-1 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs"
                />
                <button
                  type="button"
                  onClick={handleAddCustomSubject}
                  className="bg-slate-800 hover:bg-slate-700 text-white font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Subject
                </button>
              </div>
            </div>

            {/* Assign Password Input */}
            <div className="bg-amber-50 dark:bg-amber-950/40 p-3 rounded-2xl border border-amber-200 dark:border-amber-800/50">
              <label className="block font-bold text-amber-900 dark:text-amber-300 mb-1 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-amber-600" /> Assign Portal Login Password *
              </label>
              <input
                type="text"
                required
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 rounded-xl font-mono text-xs text-amber-900 dark:text-amber-200"
                placeholder="Assign password..."
              />
            </div>

            <div className="pt-4 flex justify-between">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold px-5 py-2 rounded-xl text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-6 py-2 rounded-xl text-xs shadow-md"
              >
                Save Staff Record
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Educator Profile Modal */}
      {editingTeacher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
          <form
            onSubmit={handleEditSubmit}
            className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-xl w-full space-y-4 shadow-2xl text-xs my-8"
          >
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="font-serif font-bold text-xl text-slate-900 dark:text-white flex items-center gap-2">
                <Edit className="w-5 h-5 text-amber-500" /> Edit Staff Profile
              </h3>
              <span className="font-mono text-xs font-bold text-amber-600">{editingTeacher.staffId}</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold mb-1">First Name</label>
                <input
                  type="text"
                  required
                  value={editFormData.firstName || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, firstName: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Last Name</label>
                <input
                  type="text"
                  required
                  value={editFormData.lastName || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, lastName: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold mb-1">Official Email</label>
                <input
                  type="email"
                  required
                  value={editFormData.email || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Phone Number</label>
                <input
                  type="tel"
                  required
                  value={editFormData.phone || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
                />
              </div>
            </div>

            {/* Edit Classes Taught */}
            <div className="space-y-2 bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700">
              <label className="block font-bold text-slate-900 dark:text-white flex items-center justify-between">
                <span>Classes Taught * (Select multiple)</span>
                <span className="text-[10px] text-amber-600 font-bold">{editSelectedClasses.length} selected</span>
              </label>

              <div className="flex flex-wrap gap-1.5">
                {PRESET_CLASSES.map((cls) => {
                  const isSelected = editSelectedClasses.includes(cls);
                  return (
                    <button
                      type="button"
                      key={cls}
                      onClick={() => toggleEditClass(cls)}
                      className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1 text-[11px] ${
                        isSelected
                          ? 'bg-amber-500 text-slate-950 shadow-sm border border-amber-400'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-amber-400'
                      }`}
                    >
                      {isSelected ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : null}
                      {cls}
                    </button>
                  );
                })}

                {editSelectedClasses
                  .filter((c) => !PRESET_CLASSES.includes(c))
                  .map((cls) => (
                    <button
                      type="button"
                      key={cls}
                      onClick={() => toggleEditClass(cls)}
                      className="px-3 py-1.5 rounded-xl font-bold bg-amber-500 text-slate-950 shadow-sm border border-amber-400 transition-all flex items-center gap-1 text-[11px]"
                    >
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                      {cls}
                      <X className="w-3 h-3 ml-0.5 hover:text-red-900" />
                    </button>
                  ))}
              </div>

              <div className="flex gap-2 pt-1">
                <input
                  type="text"
                  value={editCustomClassInput}
                  onChange={(e) => setEditCustomClassInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleEditAddCustomClass();
                    }
                  }}
                  placeholder="Or type custom class..."
                  className="flex-1 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs"
                />
                <button
                  type="button"
                  onClick={handleEditAddCustomClass}
                  className="bg-slate-800 hover:bg-slate-700 text-white font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Class
                </button>
              </div>
            </div>

            {/* Edit Subjects Taught */}
            <div className="space-y-2 bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700">
              <label className="block font-bold text-slate-900 dark:text-white flex items-center justify-between">
                <span>Subjects Taught * (Select multiple)</span>
                <span className="text-[10px] text-blue-600 font-bold">{editSelectedSubjects.length} selected</span>
              </label>

              <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto pr-1">
                {PRESET_SUBJECTS.map((subj) => {
                  const isSelected = editSelectedSubjects.includes(subj);
                  return (
                    <button
                      type="button"
                      key={subj}
                      onClick={() => toggleEditSubject(subj)}
                      className={`px-3 py-1.5 rounded-xl font-bold transition-all flex items-center gap-1 text-[11px] ${
                        isSelected
                          ? 'bg-blue-600 text-white shadow-sm border border-blue-500'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-blue-400'
                      }`}
                    >
                      {isSelected ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : null}
                      {subj}
                    </button>
                  );
                })}

                {editSelectedSubjects
                  .filter((s) => !PRESET_SUBJECTS.includes(s))
                  .map((subj) => (
                    <button
                      type="button"
                      key={subj}
                      onClick={() => toggleEditSubject(subj)}
                      className="px-3 py-1.5 rounded-xl font-bold bg-blue-600 text-white shadow-sm border border-blue-500 transition-all flex items-center gap-1 text-[11px]"
                    >
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                      {subj}
                      <X className="w-3 h-3 ml-0.5 hover:text-red-200" />
                    </button>
                  ))}
              </div>

              <div className="flex gap-2 pt-1">
                <input
                  type="text"
                  value={editCustomSubjectInput}
                  onChange={(e) => setEditCustomSubjectInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleEditAddCustomSubject();
                    }
                  }}
                  placeholder="Or type custom subject..."
                  className="flex-1 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs"
                />
                <button
                  type="button"
                  onClick={handleEditAddCustomSubject}
                  className="bg-slate-800 hover:bg-slate-700 text-white font-bold px-3 py-1.5 rounded-xl text-xs flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Subject
                </button>
              </div>
            </div>

            {/* Assign/Update Password */}
            <div className="bg-amber-50 dark:bg-amber-950/40 p-3 rounded-2xl border border-amber-200 dark:border-amber-800/50">
              <label className="block font-bold text-amber-900 dark:text-amber-300 mb-1 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-amber-600" /> Assign / Update Password
              </label>
              <input
                type="text"
                value={editFormData.password || ''}
                onChange={(e) => setEditFormData({ ...editFormData, password: e.target.value })}
                className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 rounded-xl font-mono text-xs text-amber-900 dark:text-amber-200"
                placeholder="Enter password..."
              />
            </div>

            <div className="pt-4 flex justify-between">
              <button
                type="button"
                onClick={() => setEditingTeacher(null)}
                className="bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold px-5 py-2 rounded-xl text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-6 py-2 rounded-xl text-xs shadow-md"
              >
                Update Teacher Profile
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
