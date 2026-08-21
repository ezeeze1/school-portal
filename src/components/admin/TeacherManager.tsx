import React, { useState } from 'react';
import { useSchool } from '../../context/SchoolContext';
import { Teacher } from '../../types';
import { Plus, Trash2, Edit, Lock, Check, X, BookOpen, GraduationCap } from 'lucide-react';
import { ConfirmDeleteModal } from '../common/ConfirmDeleteModal';
import { MarkDropdownSelect } from '../common/MarkDropdownSelect';

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
  const [teacherToDelete, setTeacherToDelete] = useState<Teacher | null>(null);

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
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] text-slate-500 font-mono font-bold">
                          {teacher.staffId}
                        </span>
                      </div>
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
                  onClick={() => setTeacherToDelete(teacher)}
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

            {/* Mark and Dropdown Select: Classes Taught */}
            <div className="bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
              <MarkDropdownSelect
                label="Select Classes Taught"
                required
                options={PRESET_CLASSES}
                selectedValues={selectedClasses}
                onToggleValue={toggleClass}
                onAddCustomValue={(customVal) => {
                  if (!selectedClasses.includes(customVal)) {
                    setSelectedClasses([...selectedClasses, customVal]);
                  }
                }}
                placeholder="Click to select and mark classes taught..."
                badgeTheme="amber"
              />
            </div>

            {/* Mark and Dropdown Select: Subjects Taught */}
            <div className="bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
              <MarkDropdownSelect
                label="Select Subjects Taught"
                required
                options={PRESET_SUBJECTS}
                selectedValues={selectedSubjects}
                onToggleValue={toggleSubject}
                onAddCustomValue={(customVal) => {
                  if (!selectedSubjects.includes(customVal)) {
                    setSelectedSubjects([...selectedSubjects, customVal]);
                  }
                }}
                placeholder="Click to select and mark subjects taught..."
                badgeTheme="blue"
              />
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

            {/* Edit Mark and Dropdown Select: Classes Taught */}
            <div className="bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
              <MarkDropdownSelect
                label="Classes Taught"
                required
                options={PRESET_CLASSES}
                selectedValues={editSelectedClasses}
                onToggleValue={toggleEditClass}
                onAddCustomValue={(customVal) => {
                  if (!editSelectedClasses.includes(customVal)) {
                    setEditSelectedClasses([...editSelectedClasses, customVal]);
                  }
                }}
                placeholder="Click to select and mark classes taught..."
                badgeTheme="amber"
              />
            </div>

            {/* Edit Mark and Dropdown Select: Subjects Taught */}
            <div className="bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
              <MarkDropdownSelect
                label="Subjects Taught"
                required
                options={PRESET_SUBJECTS}
                selectedValues={editSelectedSubjects}
                onToggleValue={toggleEditSubject}
                onAddCustomValue={(customVal) => {
                  if (!editSelectedSubjects.includes(customVal)) {
                    setEditSelectedSubjects([...editSelectedSubjects, customVal]);
                  }
                }}
                placeholder="Click to select and mark subjects taught..."
                badgeTheme="blue"
              />
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

      {/* Confirmation Modal for Teacher Deletion */}
      <ConfirmDeleteModal
        isOpen={!!teacherToDelete}
        onClose={() => setTeacherToDelete(null)}
        onConfirm={() => {
          if (teacherToDelete) {
            deleteTeacher(teacherToDelete.id);
            setTeacherToDelete(null);
          }
        }}
        title="Confirm Educator Profile Deletion"
        message="Are you sure you want to delete this teacher profile from the school portal?"
        itemName={teacherToDelete ? `${teacherToDelete.firstName} ${teacherToDelete.lastName} (${teacherToDelete.staffId})` : undefined}
      />
    </div>
  );
};
