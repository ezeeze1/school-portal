import React, { useEffect, useMemo, useState } from 'react';
import { useSchool } from '../../context/SchoolContext';
import { AccountProvisioningMode, Teacher } from '../../types';
import {
  Plus,
  Trash2,
  Edit,
  BookOpen,
  GraduationCap,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  UserPlus,
  Settings2,
  Loader2,
  X,
  ShieldCheck,
} from 'lucide-react';
import { ConfirmDeleteModal } from '../common/ConfirmDeleteModal';
import { MarkDropdownSelect } from '../common/MarkDropdownSelect';
import {
  AccountProvisioningModal,
  AccountStatusBadge,
  AccountTargetInfo,
  ProvisioningServiceBanner,
  RegistrationAccountAccessSection,
} from './AccountAccessPanel';
import {
  isProvisionValidationFailure,
  normalizeLoginEmail,
  resolveRecordAccountStatus,
  validateProvisionRequestInput,
} from '../../lib/accountProvisioning';

const FALLBACK_CLASSES = ['JSS 1', 'JSS 2', 'JSS 3', 'SS 1', 'SS 2', 'SS 3'];

const FALLBACK_SUBJECTS = [
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
  const {
    students,
    teachers,
    parents,
    classes,
    subjects,
    refreshClasses,
    addTeacher,
    updateTeacher,
    deleteTeacher,
    accountStatuses,
    accountStatusLoading,
    provisioningServiceAvailable,
    provisioningServiceNotice,
    refreshAccountStatuses,
    provisionPortalAccount,
  } = useSchool();

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<Teacher | null>(null);
  const [teacherToDelete, setTeacherToDelete] = useState<Teacher | null>(null);

  const [notification, setNotification] = useState<string | null>(null);
  const [warningNotice, setWarningNotice] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // Account provisioning modal state
  const [accountModalTarget, setAccountModalTarget] = useState<AccountTargetInfo | null>(null);

  // Account access options inside Register Educator modal
  const [createAccountNow, setCreateAccountNow] = useState(false);
  const [provisionMode, setProvisionMode] = useState<AccountProvisioningMode>('admin_password');
  const [accountPassword, setAccountPassword] = useState('');
  const [confirmAccountPassword, setConfirmAccountPassword] = useState('');
  const [requireChangeOnFirstLogin, setRequireChangeOnFirstLogin] = useState(true);

  // Live class & subject options from Supabase (preserving exact class names for RLS alignment)
  const classOptions = useMemo(() => {
    const names = classes.map((c) => c.name).filter(Boolean);
    return names.length > 0 ? Array.from(new Set(names)) : FALLBACK_CLASSES;
  }, [classes]);

  const subjectOptions = useMemo(() => {
    const names = subjects.map((s) => s.name).filter(Boolean);
    return names.length > 0 ? Array.from(new Set(names)) : FALLBACK_SUBJECTS;
  }, [subjects]);

  // Form state for adding educator (passwords are never stored in school records)
  const [formData, setFormData] = useState({
    staffId: `TCH/2026/${Math.floor(100 + Math.random() * 900)}`,
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
  });

  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);

  // Edit Teacher Form State
  const [editFormData, setEditFormData] = useState<Partial<Teacher>>({});
  const [editSelectedClasses, setEditSelectedClasses] = useState<string[]>([]);
  const [editSelectedSubjects, setEditSelectedSubjects] = useState<string[]>([]);

  useEffect(() => {
    void refreshClasses();
    void refreshAccountStatuses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 5000);
  };

  const toAccountTarget = (teacher: Teacher): AccountTargetInfo => ({
    role: 'teacher',
    recordId: teacher.id,
    fullName: `${teacher.firstName} ${teacher.lastName}`,
    identifierLabel: 'Staff ID',
    identifierValue: teacher.staffId,
    email: teacher.email,
    authUserId: teacher.authUserId,
  });

  const resolveSubjectIdsFromNames = (names: string[]): string[] => {
    const ids: string[] = [];
    for (const name of names) {
      const match = subjects.find(
        (s) => s.name.trim().toLowerCase() === name.trim().toLowerCase()
      );
      if (match && !ids.includes(match.id)) {
        ids.push(match.id);
      }
    }
    return ids;
  };

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

  const resetAddForm = () => {
    setFormData({
      staffId: `TCH/2026/${Math.floor(100 + Math.random() * 900)}`,
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
    });
    setSelectedClasses(classOptions.length > 0 ? [classOptions[0]] : []);
    setSelectedSubjects(subjectOptions.length > 0 ? [subjectOptions[0]] : []);
    setCreateAccountNow(false);
    setProvisionMode('admin_password');
    setAccountPassword('');
    setConfirmAccountPassword('');
    setRequireChangeOnFirstLogin(true);
  };

  const handleCloseAddModal = () => {
    setAccountPassword('');
    setConfirmAccountPassword('');
    setFormError(null);
    setShowAddModal(false);
  };

  const handleOpenAddModal = () => {
    setFormError(null);
    void refreshClasses();
    resetAddForm();
    setShowAddModal(true);
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;

    setFormError(null);
    setWarningNotice(null);

    const staffId = formData.staffId.trim().toUpperCase();
    const firstName = formData.firstName.trim();
    const lastName = formData.lastName.trim();
    const normalizedEmail = normalizeLoginEmail(formData.email);
    const phone = formData.phone.trim();

    if (!staffId || !firstName || !lastName || !phone) {
      setFormError('Please enter Staff ID, first name, last name, and phone number.');
      return;
    }

    const dupStaff = teachers.find(
      (t) => t.staffId.trim().toLowerCase() === staffId.toLowerCase()
    );
    if (dupStaff) {
      setFormError(
        `Staff ID "${staffId}" is already assigned to ${dupStaff.firstName} ${dupStaff.lastName}.`
      );
      return;
    }

    // Always validate official email uniqueness & syntax (and password if assigning password now)
    const shouldValidatePassword = createAccountNow && provisionMode === 'admin_password';
    const validation = validateProvisionRequestInput(
      {
        role: 'teacher',
        recordId: '__new__',
        email: normalizedEmail,
        mode: createAccountNow ? provisionMode : 'invite',
        password: shouldValidatePassword ? accountPassword : undefined,
        confirmPassword: shouldValidatePassword ? confirmAccountPassword : undefined,
        validatePassword: shouldValidatePassword,
      },
      { students, teachers, parents }
    );
    if (isProvisionValidationFailure(validation)) {
      setFormError(validation.error);
      return;
    }

    if (selectedClasses.length === 0) {
      setFormError('Please select at least one class taught.');
      return;
    }
    if (selectedSubjects.length === 0) {
      setFormError('Please select at least one subject taught.');
      return;
    }

    const primaryClass = selectedClasses[0];
    const joinedClasses = selectedClasses.join(', ');
    const matchedFormClass = classes.find(
      (c) =>
        c.name.trim().toLowerCase() === primaryClass.trim().toLowerCase() ||
        primaryClass.trim().toLowerCase().startsWith(c.name.trim().toLowerCase())
    );

    const newTch: Omit<Teacher, 'id'> = {
      staffId,
      firstName,
      lastName,
      email: validation.normalizedEmail || normalizedEmail,
      phone,
      subjectIds: resolveSubjectIdsFromNames(selectedSubjects),
      subjectsTaught: selectedSubjects,
      formClassId: matchedFormClass?.id,
      formClassName: matchedFormClass?.name || primaryClass,
      classTaught: joinedClasses,
      classesTaught: selectedClasses,
      status: 'Active',
      avatar:
        'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=300&q=80',
    };

    setIsSaving(true);
    try {
      const res = await addTeacher(newTch);
      if (!res.ok || !res.data) {
        setFormError(res.error || 'Could not save staff record to Supabase.');
        return;
      }

      const savedTeacher = res.data;

      if (createAccountNow) {
        const provRes = await provisionPortalAccount({
          role: 'teacher',
          recordId: savedTeacher.id,
          email: validation.normalizedEmail || normalizedEmail,
          mode: provisionMode,
          password: validation.password,
          mustChangePassword: provisionMode === 'invite' ? true : requireChangeOnFirstLogin,
        });

        setShowAddModal(false);
        resetAddForm();

        if (!provRes.ok) {
          setWarningNotice(
            `Staff member "${firstName} ${lastName}" (${staffId}) was saved, but their login account could not be provisioned yet: ${
              provRes.error || 'Unknown error'
            }. Click "Create Login Account" on their profile card once ready.`
          );
          return;
        }

        showToast(
          provisionMode === 'invite'
            ? `Staff member "${firstName} ${lastName}" registered and setup invitation sent to ${
                provRes.email || validation.normalizedEmail
              }.`
            : `Staff member "${firstName} ${lastName}" registered and active login account created (${
                provRes.email || validation.normalizedEmail
              }).`
        );
        return;
      }

      setShowAddModal(false);
      resetAddForm();
      showToast(
        `Staff member "${firstName} ${lastName}" (${staffId}) registered. Account status: Account not created.`
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleStartEdit = (teacher: Teacher) => {
    setEditError(null);
    setEditingTeacher(teacher);
    setEditFormData({ ...teacher });

    const existingClasses =
      teacher.classesTaught && teacher.classesTaught.length > 0
        ? teacher.classesTaught
        : teacher.classTaught
          ? teacher.classTaught
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          : [];
    setEditSelectedClasses(existingClasses);

    const existingSubjects = Array.isArray(teacher.subjectsTaught)
      ? teacher.subjectsTaught
      : teacher.subjectsTaught
        ? (teacher.subjectsTaught as unknown as string)
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : [];
    setEditSelectedSubjects(existingSubjects);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTeacher || isUpdating) return;
    setEditError(null);

    const normalizedEmail = normalizeLoginEmail(editFormData.email || editingTeacher.email);
    const emailCheck = validateProvisionRequestInput(
      {
        role: 'teacher',
        recordId: editingTeacher.id,
        email: normalizedEmail,
        mode: 'invite',
        validatePassword: false,
      },
      { students, teachers, parents }
    );
    if (isProvisionValidationFailure(emailCheck)) {
      setEditError(emailCheck.error);
      return;
    }

    if (editSelectedClasses.length === 0) {
      setEditError('Please select at least one class taught.');
      return;
    }
    if (editSelectedSubjects.length === 0) {
      setEditError('Please select at least one subject taught.');
      return;
    }

    const primaryClass = editSelectedClasses[0];
    const joinedClasses = editSelectedClasses.join(', ');
    const matchedFormClass = classes.find(
      (c) =>
        c.name.trim().toLowerCase() === primaryClass.trim().toLowerCase() ||
        primaryClass.trim().toLowerCase().startsWith(c.name.trim().toLowerCase())
    );

    setIsUpdating(true);
    try {
      const res = await updateTeacher(editingTeacher.id, {
        ...editFormData,
        staffId: editFormData.staffId?.trim().toUpperCase() || editingTeacher.staffId,
        firstName: editFormData.firstName?.trim() || editingTeacher.firstName,
        lastName: editFormData.lastName?.trim() || editingTeacher.lastName,
        email: emailCheck.normalizedEmail,
        phone: editFormData.phone?.trim() || editingTeacher.phone,
        subjectIds: resolveSubjectIdsFromNames(editSelectedSubjects),
        subjectsTaught: editSelectedSubjects,
        classesTaught: editSelectedClasses,
        classTaught: joinedClasses,
        formClassId: matchedFormClass?.id,
        formClassName: matchedFormClass?.name || primaryClass,
      });

      if (!res.ok) {
        setEditError(res.error || 'Could not update staff record.');
        return;
      }

      setEditingTeacher(null);
      showToast(`Staff profile updated for ${editFormData.firstName || editingTeacher.firstName}.`);
    } finally {
      setIsUpdating(false);
    }
  };

  const activeModalSummary = accountModalTarget
    ? resolveRecordAccountStatus('teacher', accountModalTarget.recordId, accountStatuses, {
        authUserId: accountModalTarget.authUserId,
        email: accountModalTarget.email,
      })
    : null;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Success Toast */}
      {notification && (
        <div className="bg-emerald-100 dark:bg-emerald-950 text-emerald-900 dark:text-emerald-200 p-4 rounded-2xl border border-emerald-300 dark:border-emerald-800 flex items-center justify-between text-xs font-bold shadow-md">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            {notification}
          </span>
          <button
            type="button"
            onClick={() => setNotification(null)}
            className="text-emerald-700 dark:text-emerald-300"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Warning Notice */}
      {warningNotice && (
        <div className="bg-amber-50 dark:bg-amber-950/50 text-amber-950 dark:text-amber-200 p-4 rounded-2xl border border-amber-300 dark:border-amber-800 flex items-start justify-between gap-3 text-xs font-semibold shadow-sm">
          <span className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>{warningNotice}</span>
          </span>
          <button
            type="button"
            onClick={() => setWarningNotice(null)}
            className="text-amber-700 dark:text-amber-300 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Provisioning Service Deployment Banner */}
      <ProvisioningServiceBanner
        available={provisioningServiceAvailable}
        notice={provisioningServiceNotice}
        loading={accountStatusLoading}
        onRefresh={() => void refreshAccountStatuses()}
      />

      {/* Header */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-md flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="font-serif font-bold text-2xl text-slate-900 dark:text-white">
            Teaching Faculty &amp; Staff Roster
          </h2>
          <p className="text-xs text-slate-500">
            Manage academic staff profiles, assigned live classes &amp; subjects, and Supabase
            Authentication login access.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => void refreshAccountStatuses()}
            disabled={accountStatusLoading}
            className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-200 font-bold px-3.5 py-2 rounded-xl text-xs flex items-center gap-1.5 border border-slate-200 dark:border-slate-700 disabled:opacity-60"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 text-emerald-600 ${
                accountStatusLoading ? 'animate-spin' : ''
              }`}
            />
            Sync Auth Status
          </button>

          <button
            type="button"
            onClick={handleOpenAddModal}
            className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-sm"
          >
            <Plus className="w-4 h-4" /> Add New Teacher
          </button>
        </div>
      </div>

      {/* Educator Profiles Grid */}
      {teachers.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-10 text-center space-y-2 text-xs text-slate-500">
          <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">
            No teaching staff registered yet
          </p>
          <p>Click &quot;Add New Teacher&quot; above to register faculty and provision login access.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {teachers.map((teacher) => {
            const teacherClasses =
              teacher.classesTaught && teacher.classesTaught.length > 0
                ? teacher.classesTaught
                : teacher.classTaught
                  ? teacher.classTaught
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean)
                  : [];

            const authSummary = resolveRecordAccountStatus('teacher', teacher.id, accountStatuses, {
              authUserId: teacher.authUserId,
              email: teacher.email,
            });
            const needsAccountCreation =
              authSummary.status === 'not_created' || Boolean(authSummary.needsRepair);

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
                        className="w-14 h-14 rounded-2xl object-cover border-2 border-amber-400 shadow-sm shrink-0"
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

                  {/* Authoritative Supabase Auth Account Status */}
                  <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Portal Account
                      </span>
                      <AccountStatusBadge summary={authSummary} compact />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setAccountModalTarget(toAccountTarget(teacher));
                      }}
                      className={`w-full py-1.5 px-3 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors ${
                        needsAccountCreation
                          ? 'bg-amber-500 hover:bg-amber-600 text-slate-950'
                          : 'bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {needsAccountCreation ? (
                        <>
                          <UserPlus className="w-3.5 h-3.5" />
                          {authSummary.needsRepair
                            ? 'Complete Account Link'
                            : 'Create Login Account'}
                        </>
                      ) : (
                        <>
                          <Settings2 className="w-3.5 h-3.5" /> Manage Access &amp; Password
                        </>
                      )}
                    </button>
                  </div>

                  <div className="text-xs text-slate-600 dark:text-slate-400 space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
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

                    <p className="pt-1 break-all">
                      <strong className="text-slate-700 dark:text-slate-300">Official Email:</strong>{' '}
                      {teacher.email}
                    </p>
                    <p>
                      <strong className="text-slate-700 dark:text-slate-300">Phone:</strong>{' '}
                      {teacher.phone || 'N/A'}
                    </p>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => handleStartEdit(teacher)}
                    className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
                  >
                    <Edit className="w-3.5 h-3.5" /> Edit
                  </button>
                  <button
                    type="button"
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
      )}

      {/* Register New Educator Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
          <form
            onSubmit={handleAddSubmit}
            className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-xl w-full space-y-4 shadow-2xl text-xs my-8 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-serif font-bold text-xl text-slate-900 dark:text-white">
                  Register New Educator
                </h3>
                <p className="text-xs text-slate-500">
                  Assign Staff ID, live classes, subjects, and optionally provision their Supabase
                  Authentication login account.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseAddModal}
                className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white"
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
                <label className="block font-semibold mb-1">Staff ID *</label>
                <input
                  type="text"
                  required
                  value={formData.staffId}
                  onChange={(e) =>
                    setFormData({ ...formData, staffId: e.target.value.toUpperCase() })
                  }
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-mono font-bold"
                  placeholder="e.g. TCH/2026/104"
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

            <div>
              <label className="block font-semibold mb-1">Official Login Email *</label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => {
                  setFormError(null);
                  setFormData({ ...formData, email: e.target.value });
                }}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
                placeholder="e.g. s.okon@divineacademy.edu"
              />
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
              <MarkDropdownSelect
                label="Select Classes Taught"
                required
                options={classOptions}
                selectedValues={selectedClasses}
                onToggleValue={toggleClass}
                onAddCustomValue={(customVal) => {
                  if (!selectedClasses.includes(customVal)) {
                    setSelectedClasses([...selectedClasses, customVal]);
                  }
                }}
                placeholder="Click to select classes from Class Management..."
                badgeTheme="amber"
              />
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
              <MarkDropdownSelect
                label="Select Subjects Taught"
                required
                options={subjectOptions}
                selectedValues={selectedSubjects}
                onToggleValue={toggleSubject}
                onAddCustomValue={(customVal) => {
                  if (!selectedSubjects.includes(customVal)) {
                    setSelectedSubjects([...selectedSubjects, customVal]);
                  }
                }}
                placeholder="Click to select subjects..."
                badgeTheme="blue"
              />
            </div>

            {/* Account Access Provisioning Section */}
            <RegistrationAccountAccessSection
              role="teacher"
              roleLabel="staff member"
              loginEmail={formData.email}
              createAccountNow={createAccountNow}
              onToggleCreateAccountNow={(checked) => {
                setFormError(null);
                setCreateAccountNow(checked);
              }}
              mode={provisionMode}
              onModeChange={setProvisionMode}
              password={accountPassword}
              onPasswordChange={setAccountPassword}
              confirmPassword={confirmAccountPassword}
              onConfirmPasswordChange={setConfirmAccountPassword}
              requireChangeOnFirstLogin={requireChangeOnFirstLogin}
              onToggleRequireChangeOnFirstLogin={setRequireChangeOnFirstLogin}
              serviceAvailable={provisioningServiceAvailable}
            />

            <div className="pt-4 flex justify-between border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                disabled={isSaving}
                onClick={handleCloseAddModal}
                className="bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold px-5 py-2 rounded-xl text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-6 py-2 rounded-xl text-xs shadow-md flex items-center gap-1.5 disabled:opacity-60"
              >
                {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {isSaving
                  ? createAccountNow
                    ? 'Saving & Provisioning...'
                    : 'Saving...'
                  : createAccountNow
                    ? 'Register & Create Login Account'
                    : 'Save Staff Record'}
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
            className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-xl w-full space-y-4 shadow-2xl text-xs my-8 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="font-serif font-bold text-xl text-slate-900 dark:text-white flex items-center gap-2">
                <Edit className="w-5 h-5 text-amber-500" /> Edit Staff Profile
              </h3>
              <span className="font-mono text-xs font-bold text-amber-600">
                {editingTeacher.staffId}
              </span>
            </div>

            {editError && (
              <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-2 text-xs text-red-600 dark:text-red-400 font-bold">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{editError}</span>
              </div>
            )}

            {/* Account Access Strip */}
            {(() => {
              const summary = resolveRecordAccountStatus(
                'teacher',
                editingTeacher.id,
                accountStatuses,
                { authUserId: editingTeacher.authUserId, email: editingTeacher.email }
              );
              const needsCreate = summary.status === 'not_created' || Boolean(summary.needsRepair);
              return (
                <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2">
                  <div className="space-y-1">
                    <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-amber-500" /> Portal Account Access
                    </span>
                    <AccountStatusBadge summary={summary} compact />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const target = toAccountTarget(editingTeacher);
                      setEditingTeacher(null);
                      setAccountModalTarget(target);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-[11px]"
                  >
                    {needsCreate ? 'Create Login Account' : 'Manage Access & Password'}
                  </button>
                </div>
              );
            })()}

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
                <label className="block font-semibold mb-1">Staff ID</label>
                <input
                  type="text"
                  required
                  value={editFormData.staffId || ''}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, staffId: e.target.value.toUpperCase() })
                  }
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-mono font-bold"
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

            <div className="bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
              <MarkDropdownSelect
                label="Classes Taught"
                required
                options={classOptions}
                selectedValues={editSelectedClasses}
                onToggleValue={toggleEditClass}
                onAddCustomValue={(customVal) => {
                  if (!editSelectedClasses.includes(customVal)) {
                    setEditSelectedClasses([...editSelectedClasses, customVal]);
                  }
                }}
                placeholder="Click to select classes..."
                badgeTheme="amber"
              />
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
              <MarkDropdownSelect
                label="Subjects Taught"
                required
                options={subjectOptions}
                selectedValues={editSelectedSubjects}
                onToggleValue={toggleEditSubject}
                onAddCustomValue={(customVal) => {
                  if (!editSelectedSubjects.includes(customVal)) {
                    setEditSelectedSubjects([...editSelectedSubjects, customVal]);
                  }
                }}
                placeholder="Click to select subjects..."
                badgeTheme="blue"
              />
            </div>

            <div className="pt-4 flex justify-between border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                disabled={isUpdating}
                onClick={() => setEditingTeacher(null)}
                className="bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold px-5 py-2 rounded-xl text-xs"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isUpdating}
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-6 py-2 rounded-xl text-xs shadow-md flex items-center gap-1.5 disabled:opacity-60"
              >
                {isUpdating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {isUpdating ? 'Updating...' : 'Update Teacher Profile'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Account Provisioning & Access Management Modal */}
      <AccountProvisioningModal
        target={accountModalTarget}
        summary={activeModalSummary}
        onClose={() => {
          setAccountModalTarget(null);
        }}
        onSuccessMessage={showToast}
      />

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
        itemName={
          teacherToDelete
            ? `${teacherToDelete.firstName} ${teacherToDelete.lastName} (${teacherToDelete.staffId})`
            : undefined
        }
      />
    </div>
  );
};
