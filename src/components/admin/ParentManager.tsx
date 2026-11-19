import React, { useEffect, useMemo, useState } from 'react';
import { useSchool } from '../../context/SchoolContext';
import { AccountProvisioningMode, Parent } from '../../types';
import {
  Plus,
  Trash2,
  Edit,
  Search,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  UserPlus,
  Settings2,
  Loader2,
  X,
  ShieldCheck,
  Users,
  GraduationCap,
  Mail,
  Phone,
  Check,
} from 'lucide-react';
import { ConfirmDeleteModal } from '../common/ConfirmDeleteModal';
import {
  AccountProvisioningModal,
  AccountStatusBadge,
  AccountTargetInfo,
  OneTimePasswordHandoff,
  ProvisioningServiceBanner,
  RegistrationAccountAccessSection,
} from './AccountAccessPanel';
import {
  isProvisionValidationFailure,
  normalizeLoginEmail,
  resolveRecordAccountStatus,
  validateProvisionRequestInput,
} from '../../lib/accountProvisioning';

const TITLE_OPTIONS = ['Mr.', 'Mrs.', 'Ms.', 'Dr.', 'Prof.', 'Chief', 'Engr.', 'Rev.', 'Alhaji', 'Hajiya'];

export const ParentManager: React.FC = () => {
  const {
    students,
    teachers,
    parents,
    addParent,
    updateParent,
    deleteParent,
    accountStatuses,
    accountStatusLoading,
    provisioningServiceAvailable,
    provisioningServiceNotice,
    refreshAccountStatuses,
    provisionPortalAccount,
  } = useSchool();

  const [search, setSearch] = useState('');
  const [wardSearch, setWardSearch] = useState('');
  const [editWardSearch, setEditWardSearch] = useState('');

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingParent, setEditingParent] = useState<Parent | null>(null);
  const [parentToDelete, setParentToDelete] = useState<Parent | null>(null);

  const [notification, setNotification] = useState<string | null>(null);
  const [warningNotice, setWarningNotice] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // Account provisioning modal state
  const [accountModalTarget, setAccountModalTarget] = useState<AccountTargetInfo | null>(null);
  const [initialHandoff, setInitialHandoff] = useState<OneTimePasswordHandoff | null>(null);

  // Registration form state
  const [formData, setFormData] = useState({
    parentId: `PRT/2026/${Math.floor(100 + Math.random() * 900)}`,
    title: 'Mr.',
    fullName: '',
    email: '',
    phone: '',
    occupation: '',
    address: 'Lagos, Nigeria',
    studentIds: [] as string[],
  });

  // Account creation options on Parent Registration modal
  const [createAccountNow, setCreateAccountNow] = useState(false);
  const [provisionMode, setProvisionMode] = useState<AccountProvisioningMode>('invite');
  const [useCustomTempPassword, setUseCustomTempPassword] = useState(false);
  const [customTempPassword, setCustomTempPassword] = useState('');

  // Edit form state
  const [editFormData, setEditFormData] = useState<Partial<Parent>>({});
  const [editStudentIds, setEditStudentIds] = useState<string[]>([]);

  useEffect(() => {
    void refreshAccountStatuses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 5000);
  };

  const toAccountTarget = (parent: Parent): AccountTargetInfo => ({
    role: 'parent',
    recordId: parent.id,
    fullName: `${parent.title ? `${parent.title} ` : ''}${parent.fullName}`.trim(),
    identifierLabel: 'Parent ID',
    identifierValue: parent.parentId,
    email: parent.email,
    authUserId: parent.authUserId,
  });

  const studentLookup = useMemo(() => {
    const map = new Map<string, (typeof students)[number]>();
    students.forEach((s) => map.set(s.id, s));
    return map;
  }, [students]);

  const filteredParents = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return parents;
    return parents.filter((p) => {
      const linkedNames = (p.studentIds || [])
        .map((sid) => {
          const s = studentLookup.get(sid);
          return s ? `${s.firstName} ${s.lastName} ${s.admissionNo}` : '';
        })
        .join(' ')
        .toLowerCase();

      return (
        p.fullName.toLowerCase().includes(q) ||
        p.parentId.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q) ||
        p.phone.toLowerCase().includes(q) ||
        linkedNames.includes(q)
      );
    });
  }, [parents, search, studentLookup]);

  const filterStudentsForPicker = (query: string) => {
    const q = query.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) =>
        `${s.firstName} ${s.lastName}`.toLowerCase().includes(q) ||
        s.admissionNo.toLowerCase().includes(q) ||
        s.className.toLowerCase().includes(q)
    );
  };

  const toggleFormStudent = (studentId: string) => {
    setFormData((prev) => ({
      ...prev,
      studentIds: prev.studentIds.includes(studentId)
        ? prev.studentIds.filter((id) => id !== studentId)
        : [...prev.studentIds, studentId],
    }));
  };

  const toggleEditStudent = (studentId: string) => {
    setEditStudentIds((prev) =>
      prev.includes(studentId) ? prev.filter((id) => id !== studentId) : [...prev, studentId]
    );
  };

  const resetAddForm = () => {
    setFormData({
      parentId: `PRT/2026/${Math.floor(100 + Math.random() * 900)}`,
      title: 'Mr.',
      fullName: '',
      email: '',
      phone: '',
      occupation: '',
      address: 'Lagos, Nigeria',
      studentIds: [],
    });
    setWardSearch('');
    setCreateAccountNow(false);
    setProvisionMode('invite');
    setUseCustomTempPassword(false);
    setCustomTempPassword('');
  };

  const handleOpenAddModal = () => {
    setFormError(null);
    resetAddForm();
    setShowAddModal(true);
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;

    setFormError(null);
    setWarningNotice(null);

    const parentId = formData.parentId.trim().toUpperCase();
    const fullName = formData.fullName.trim();
    const phone = formData.phone.trim();
    const normalizedEmail = normalizeLoginEmail(formData.email);

    if (!parentId || !fullName || !phone) {
      setFormError('Please enter Parent ID, full name, and phone number.');
      return;
    }

    const dupParentId = parents.find(
      (p) => p.parentId.trim().toLowerCase() === parentId.toLowerCase()
    );
    if (dupParentId) {
      setFormError(`Parent ID "${parentId}" is already assigned to ${dupParentId.fullName}.`);
      return;
    }

    const validation = validateProvisionRequestInput(
      {
        role: 'parent',
        recordId: '__new__',
        email: normalizedEmail,
        mode: createAccountNow ? provisionMode : 'invite',
        useCustomTempPassword: createAccountNow && useCustomTempPassword,
        temporaryPassword: createAccountNow ? customTempPassword : undefined,
      },
      { students, teachers, parents }
    );
    if (isProvisionValidationFailure(validation)) {
      setFormError(validation.error);
      return;
    }

    const newParent: Omit<Parent, 'id'> = {
      parentId,
      title: formData.title.trim() || 'Mr.',
      fullName,
      email: validation.normalizedEmail,
      phone,
      occupation: formData.occupation.trim() || 'Guardian',
      address: formData.address.trim() || 'Lagos, Nigeria',
      studentIds: formData.studentIds,
    };

    setIsSaving(true);
    try {
      const res = await addParent(newParent);
      if (!res.ok || !res.data) {
        setFormError(res.error || 'Could not save parent record to Supabase.');
        return;
      }

      const savedParent = res.data;

      if (createAccountNow) {
        const provRes = await provisionPortalAccount({
          role: 'parent',
          recordId: savedParent.id,
          email: validation.normalizedEmail,
          mode: provisionMode,
          temporaryPassword: validation.temporaryPassword,
        });

        setShowAddModal(false);
        resetAddForm();

        if (!provRes.ok) {
          setWarningNotice(
            `Parent "${fullName}" (${parentId}) was saved with ${savedParent.studentIds.length} linked student(s), but their login account could not be provisioned yet: ${
              provRes.error || 'Unknown error'
            }. Click "Create Login Account" on their row once ready.`
          );
          return;
        }

        if (provRes.oneTimeTemporaryPassword) {
          setAccountModalTarget(null);
          setInitialHandoff({
            fullName: `${savedParent.title} ${savedParent.fullName}`.trim(),
            role: 'parent',
            email: provRes.email || validation.normalizedEmail,
            temporaryPassword: provRes.oneTimeTemporaryPassword,
            recoveredPartialAccount: provRes.recoveredPartialAccount,
          });
          showToast(`Parent "${fullName}" registered and login account created.`);
          return;
        }

        showToast(
          `Parent "${fullName}" registered and invitation sent to ${
            provRes.email || validation.normalizedEmail
          }.`
        );
        return;
      }

      setShowAddModal(false);
      resetAddForm();
      showToast(
        `Parent "${fullName}" (${parentId}) registered with ${savedParent.studentIds.length} linked student(s). Account status: Account not created.`
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleStartEdit = (parent: Parent) => {
    setEditError(null);
    setEditWardSearch('');
    setEditingParent(parent);
    setEditFormData({ ...parent });
    setEditStudentIds([...(parent.studentIds || [])]);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingParent || isUpdating) return;
    setEditError(null);

    const normalizedEmail = normalizeLoginEmail(editFormData.email || editingParent.email);
    const emailCheck = validateProvisionRequestInput(
      {
        role: 'parent',
        recordId: editingParent.id,
        email: normalizedEmail,
        mode: 'invite',
      },
      { students, teachers, parents }
    );
    if (isProvisionValidationFailure(emailCheck)) {
      setEditError(emailCheck.error);
      return;
    }

    setIsUpdating(true);
    try {
      const res = await updateParent(editingParent.id, {
        ...editFormData,
        parentId: editFormData.parentId?.trim().toUpperCase() || editingParent.parentId,
        title: editFormData.title?.trim() || editingParent.title,
        fullName: editFormData.fullName?.trim() || editingParent.fullName,
        email: emailCheck.normalizedEmail,
        phone: editFormData.phone?.trim() || editingParent.phone,
        occupation: editFormData.occupation?.trim() || editingParent.occupation,
        address: editFormData.address?.trim() || editingParent.address,
        studentIds: editStudentIds,
      });

      if (!res.ok) {
        setEditError(res.error || 'Could not update parent record.');
        return;
      }

      setEditingParent(null);
      showToast(
        `Parent record and child links updated for ${editFormData.fullName || editingParent.fullName}.`
      );
    } finally {
      setIsUpdating(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!parentToDelete) return;
    const target = parentToDelete;
    setParentToDelete(null);
    const res = await deleteParent(target.id);
    if (!res.ok) {
      setWarningNotice(res.error || 'Could not delete parent record.');
      return;
    }
    showToast(`Parent record deleted for ${target.fullName}.`);
  };

  const activeModalSummary = accountModalTarget
    ? resolveRecordAccountStatus('parent', accountModalTarget.recordId, accountStatuses, {
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
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-md flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="font-serif font-bold text-2xl text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-amber-500" /> Parents &amp; Guardians Directory
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Register guardians, explicitly link their enrolled children via{' '}
            <code>parent_students</code>, and manage Supabase Authentication accounts.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          <div className="relative flex-1 md:w-56">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search parent, email or ward..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>

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
            Sync Auth
          </button>

          <button
            type="button"
            onClick={handleOpenAddModal}
            className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 whitespace-nowrap shadow-sm"
          >
            <Plus className="w-4 h-4" /> Register Parent
          </button>
        </div>
      </div>

      {/* Isolation Policy Note */}
      <div className="bg-slate-900 text-slate-200 rounded-2xl p-4 border border-slate-800 flex items-start gap-3 text-xs">
        <ShieldCheck className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          <strong className="text-white">Strict Parent–Child Isolation:</strong> Each parent login
          can only view attendance, results, assignments, and fee records for the specific students
          explicitly linked to their account below (enforced by Row Level Security on{' '}
          <code className="text-amber-300">public.parent_students</code>).
        </p>
      </div>

      {/* Parents Table */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-900 text-white font-semibold">
                <th className="p-3.5">Parent ID</th>
                <th className="p-3.5">Parent / Guardian</th>
                <th className="p-3.5">Linked Children (Wards)</th>
                <th className="p-3.5">Account Access (Auth)</th>
                <th className="p-3.5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredParents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400">
                    {parents.length === 0
                      ? 'No parents registered yet. Click "Register Parent" to add a guardian and link their children.'
                      : 'No parents match your search query.'}
                  </td>
                </tr>
              ) : (
                filteredParents.map((parent) => {
                  const authSummary = resolveRecordAccountStatus(
                    'parent',
                    parent.id,
                    accountStatuses,
                    { authUserId: parent.authUserId, email: parent.email }
                  );
                  const needsAccountCreation =
                    authSummary.status === 'not_created' || Boolean(authSummary.needsRepair);

                  const linkedWards = (parent.studentIds || [])
                    .map((sid) => studentLookup.get(sid))
                    .filter((s): s is NonNullable<typeof s> => Boolean(s));

                  return (
                    <tr key={parent.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="p-3.5 font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
                        {parent.parentId}
                      </td>

                      <td className="p-3.5 space-y-0.5">
                        <p className="font-bold text-slate-900 dark:text-white">
                          {parent.title ? `${parent.title} ` : ''}
                          {parent.fullName}
                        </p>
                        <p className="text-[11px] text-slate-500 flex items-center gap-1">
                          <Mail className="w-3 h-3 text-amber-500 shrink-0" />
                          <span className="font-mono">{parent.email}</span>
                        </p>
                        <p className="text-[11px] text-slate-500 flex items-center gap-1">
                          <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                          {parent.phone}
                          {parent.occupation ? ` • ${parent.occupation}` : ''}
                        </p>
                      </td>

                      <td className="p-3.5">
                        {linkedWards.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {linkedWards.map((ward) => (
                              <span
                                key={ward.id}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-[10px] font-bold"
                              >
                                <GraduationCap className="w-3 h-3 text-amber-600" />
                                {ward.firstName} {ward.lastName} ({ward.className})
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">
                            No children linked yet
                          </span>
                        )}
                      </td>

                      <td className="p-3.5">
                        <div className="space-y-1.5">
                          <AccountStatusBadge summary={authSummary} compact />
                          <div>
                            <button
                              type="button"
                              onClick={() => {
                                setInitialHandoff(null);
                                setAccountModalTarget(toAccountTarget(parent));
                              }}
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors ${
                                needsAccountCreation
                                  ? 'bg-amber-500 hover:bg-amber-600 text-slate-950'
                                  : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700'
                              }`}
                            >
                              {needsAccountCreation ? (
                                <>
                                  <UserPlus className="w-3 h-3" />
                                  {authSummary.needsRepair
                                    ? 'Complete Account Link'
                                    : 'Create Login Account'}
                                </>
                              ) : (
                                <>
                                  <Settings2 className="w-3 h-3" /> Manage Access
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </td>

                      <td className="p-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleStartEdit(parent)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950 rounded-lg transition-colors flex items-center gap-1 font-semibold text-[11px]"
                            title="Edit Parent & Linked Children"
                          >
                            <Edit className="w-4 h-4" /> Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => setParentToDelete(parent)}
                            className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950 rounded-lg transition-colors"
                            title="Delete Parent Record"
                          >
                            <Trash2 className="w-4 h-4" />
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

      {/* Register Parent Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
          <form
            onSubmit={handleAddSubmit}
            className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-xl w-full space-y-4 shadow-2xl text-xs my-8 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-serif font-bold text-xl text-slate-900 dark:text-white">
                  Register Parent / Guardian
                </h3>
                <p className="text-xs text-slate-500">
                  Create a parent profile, explicitly link enrolled children, and optionally
                  provision their Supabase Auth login account.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
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

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold mb-1">Title *</label>
                <select
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
                >
                  {TITLE_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-span-2">
                <label className="block font-semibold mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  placeholder="e.g. Chinedu Okafor"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold mb-1">Parent ID *</label>
                <input
                  type="text"
                  required
                  value={formData.parentId}
                  onChange={(e) =>
                    setFormData({ ...formData, parentId: e.target.value.toUpperCase() })
                  }
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-mono font-bold"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Phone Number *</label>
                <input
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="e.g. +234 803 111 2233"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold mb-1">Login Email Address *</label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => {
                  setFormError(null);
                  setFormData({ ...formData, email: e.target.value });
                }}
                placeholder="e.g. c.okafor@example.com"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold mb-1">Occupation</label>
                <input
                  type="text"
                  value={formData.occupation}
                  onChange={(e) => setFormData({ ...formData, occupation: e.target.value })}
                  placeholder="e.g. Engineer"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Address</label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Home address"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
                />
              </div>
            </div>

            {/* Child / Ward Linking Picker */}
            <div className="bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <label className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <GraduationCap className="w-4 h-4 text-amber-500" />
                  Link Registered Children ({formData.studentIds.length} selected)
                </label>
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={wardSearch}
                  onChange={(e) => setWardSearch(e.target.value)}
                  placeholder="Filter enrolled students by name, admission no, or class..."
                  className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-[11px]"
                />
              </div>

              <div className="max-h-40 overflow-y-auto divide-y divide-slate-200/70 dark:divide-slate-700/70 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                {filterStudentsForPicker(wardSearch).length === 0 ? (
                  <p className="p-3 text-[11px] text-slate-400 text-center">
                    No enrolled students found.
                  </p>
                ) : (
                  filterStudentsForPicker(wardSearch).map((std) => {
                    const checked = formData.studentIds.includes(std.id);
                    return (
                      <label
                        key={std.id}
                        className={`flex items-center justify-between px-3 py-2 cursor-pointer transition-colors ${
                          checked
                            ? 'bg-amber-50/70 dark:bg-amber-950/40'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleFormStudent(std.id)}
                            className="w-4 h-4 rounded border-slate-300 text-amber-500"
                          />
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 dark:text-white truncate">
                              {std.firstName} {std.lastName}
                            </p>
                            <p className="text-[10px] text-slate-500 font-mono">
                              {std.admissionNo} • {std.className}
                            </p>
                          </div>
                        </div>
                        {checked && <Check className="w-4 h-4 text-amber-600 shrink-0" />}
                      </label>
                    );
                  })
                )}
              </div>
            </div>

            {/* Account Access Provisioning Section */}
            <RegistrationAccountAccessSection
              roleLabel="parent / guardian"
              loginEmail={formData.email}
              createAccountNow={createAccountNow}
              onToggleCreateAccountNow={(checked) => {
                setFormError(null);
                setCreateAccountNow(checked);
              }}
              mode={provisionMode}
              onModeChange={setProvisionMode}
              useCustomTempPassword={useCustomTempPassword}
              onToggleUseCustomTempPassword={setUseCustomTempPassword}
              customTempPassword={customTempPassword}
              onCustomTempPasswordChange={setCustomTempPassword}
              serviceAvailable={provisioningServiceAvailable}
            />

            <div className="pt-4 flex justify-between border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                disabled={isSaving}
                onClick={() => setShowAddModal(false)}
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
                    : 'Save Parent Record'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Parent Modal */}
      {editingParent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
          <form
            onSubmit={handleEditSubmit}
            className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-xl w-full space-y-4 shadow-2xl text-xs my-8 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="font-serif font-bold text-xl text-slate-900 dark:text-white flex items-center gap-2">
                <Edit className="w-5 h-5 text-amber-500" /> Edit Parent &amp; Linked Children
              </h3>
              <span className="font-mono text-xs font-bold text-amber-600">
                {editingParent.parentId}
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
                'parent',
                editingParent.id,
                accountStatuses,
                { authUserId: editingParent.authUserId, email: editingParent.email }
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
                      const target = toAccountTarget(editingParent);
                      setEditingParent(null);
                      setInitialHandoff(null);
                      setAccountModalTarget(target);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-[11px]"
                  >
                    {needsCreate ? 'Create Login Account' : 'Manage / Reset Password'}
                  </button>
                </div>
              );
            })()}

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold mb-1">Title</label>
                <select
                  value={editFormData.title || 'Mr.'}
                  onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
                >
                  {TITLE_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div className="col-span-2">
                <label className="block font-semibold mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={editFormData.fullName || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, fullName: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold mb-1">Login Email</label>
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

            {/* Child / Ward Linking Picker */}
            <div className="bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2.5">
              <label className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <GraduationCap className="w-4 h-4 text-amber-500" />
                Linked Children ({editStudentIds.length} selected)
              </label>

              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={editWardSearch}
                  onChange={(e) => setEditWardSearch(e.target.value)}
                  placeholder="Search students to link or unlink..."
                  className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-[11px]"
                />
              </div>

              <div className="max-h-44 overflow-y-auto divide-y divide-slate-200/70 dark:divide-slate-700/70 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                {filterStudentsForPicker(editWardSearch).length === 0 ? (
                  <p className="p-3 text-[11px] text-slate-400 text-center">
                    No enrolled students found.
                  </p>
                ) : (
                  filterStudentsForPicker(editWardSearch).map((std) => {
                    const checked = editStudentIds.includes(std.id);
                    return (
                      <label
                        key={std.id}
                        className={`flex items-center justify-between px-3 py-2 cursor-pointer transition-colors ${
                          checked
                            ? 'bg-amber-50/70 dark:bg-amber-950/40'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleEditStudent(std.id)}
                            className="w-4 h-4 rounded border-slate-300 text-amber-500"
                          />
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 dark:text-white truncate">
                              {std.firstName} {std.lastName}
                            </p>
                            <p className="text-[10px] text-slate-500 font-mono">
                              {std.admissionNo} • {std.className}
                            </p>
                          </div>
                        </div>
                        {checked && <Check className="w-4 h-4 text-amber-600 shrink-0" />}
                      </label>
                    );
                  })
                )}
              </div>
            </div>

            <div className="pt-4 flex justify-between border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                disabled={isUpdating}
                onClick={() => setEditingParent(null)}
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
                {isUpdating ? 'Updating...' : 'Update Parent & Links'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Account Provisioning & Access Management Modal */}
      <AccountProvisioningModal
        target={accountModalTarget}
        summary={activeModalSummary}
        initialHandoff={initialHandoff}
        onClose={() => {
          setAccountModalTarget(null);
          setInitialHandoff(null);
        }}
        onSuccessMessage={showToast}
      />

      {/* Confirmation Modal for Parent Deletion */}
      <ConfirmDeleteModal
        isOpen={!!parentToDelete}
        onClose={() => setParentToDelete(null)}
        onConfirm={() => void handleConfirmDelete()}
        title="Confirm Parent Profile Deletion"
        message="Are you sure you want to delete this parent record? Their ward links in parent_students will be removed."
        itemName={
          parentToDelete
            ? `${parentToDelete.title} ${parentToDelete.fullName} (${parentToDelete.parentId})`
            : undefined
        }
      />
    </div>
  );
};
