import React, { useState, useEffect } from 'react';
import { useSchool } from '../../context/SchoolContext';
import { AccountProvisioningMode, Student } from '../../types';
import {
  Plus,
  Trash2,
  Edit,
  Search,
  Key,
  Mail,
  CheckCircle2,
  RefreshCw,
  Copy,
  Check,
  Printer,
  ShieldCheck,
  AlertCircle,
  Loader2,
  UserPlus,
  Settings2,
  X,
  AlertTriangle,
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

interface StudentManagerProps {
  readOnly?: boolean;
  onNavigateToClasses?: () => void;
}

export const StudentManager: React.FC<StudentManagerProps> = ({
  readOnly = false,
  onNavigateToClasses,
}) => {
  const {
    activeRole,
    students,
    teachers,
    parents,
    classes,
    refreshClasses,
    addStudent,
    updateStudent,
    deleteStudent,
    generateResultPasscodeForStudent,
    bulkGenerateResultPasscodes,
    accountStatuses,
    accountStatusLoading,
    provisioningServiceAvailable,
    provisioningServiceNotice,
    refreshAccountStatuses,
    provisionPortalAccount,
  } = useSchool();

  const isReadOnly = readOnly || activeRole !== 'admin';

  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [showPasscodeSlipsModal, setShowPasscodeSlipsModal] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [warningNotice, setWarningNotice] = useState<string | null>(null);
  const [enrollError, setEnrollError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);

  // Account provisioning modal state
  const [accountModalTarget, setAccountModalTarget] = useState<AccountTargetInfo | null>(null);
  const [initialHandoff, setInitialHandoff] = useState<OneTimePasswordHandoff | null>(null);

  // Account creation options on Student Enrollment form
  const [createAccountNow, setCreateAccountNow] = useState(false);
  const [provisionMode, setProvisionMode] = useState<AccountProvisioningMode>('invite');
  const [useCustomTempPassword, setUseCustomTempPassword] = useState(false);
  const [customTempPassword, setCustomTempPassword] = useState('');

  // Helper generator
  const createAlphanumericCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = 'RES-';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  // Enroll New Student Form state (classes loaded dynamically from Supabase)
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    admissionNo: `STD/2026/${Math.floor(1000 + Math.random() * 9000)}`,
    classId: classes[0]?.id || '',
    className: classes[0]?.name || '',
    arm: classes[0]?.arms?.[0] || '',
    gender: 'Male' as 'Male' | 'Female',
    dob: '2010-04-12',
    parentName: '',
    parentPhone: '',
    parentEmail: '',
    resultPasscode: createAlphanumericCode(),
    address: 'Lagos, Nigeria',
  });

  // Edit Student Form state
  const [editFormData, setEditFormData] = useState<Partial<Student>>({});

  // Keep Student Enrollment class dropdown synced with live Supabase classes
  useEffect(() => {
    setFormData((prev) => {
      if (classes.length === 0) {
        if (!prev.classId && !prev.className) return prev;
        return { ...prev, classId: '', className: '', arm: '' };
      }
      const existing = classes.find((c) => c.id === prev.classId);
      if (existing) {
        const nextArm =
          existing.arms && existing.arms.length > 0
            ? existing.arms.includes(prev.arm)
              ? prev.arm
              : existing.arms[0]
            : '';
        if (existing.name === prev.className && nextArm === prev.arm) return prev;
        return { ...prev, className: existing.name, arm: nextArm };
      }
      const first = classes[0];
      return {
        ...prev,
        classId: first.id,
        className: first.name,
        arm: first.arms?.[0] || '',
      };
    });
  }, [classes]);

  useEffect(() => {
    if (!isReadOnly) {
      void refreshClasses();
      void refreshAccountStatuses();
    }
    // Load latest classes and authoritative account statuses when admin opens Student SIS Manager
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReadOnly]);

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 5000);
  };

  const toAccountTarget = (std: Student): AccountTargetInfo => ({
    role: 'student',
    recordId: std.id,
    fullName: `${std.firstName} ${std.lastName}`,
    identifierLabel: 'Admission No',
    identifierValue: std.admissionNo,
    email: std.email,
    authUserId: std.authUserId,
  });

  const filteredStudents = students.filter(
    (s) =>
      `${s.firstName} ${s.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
      s.admissionNo.toLowerCase().includes(search.toLowerCase()) ||
      s.className.toLowerCase().includes(search.toLowerCase()) ||
      (s.email && s.email.toLowerCase().includes(search.toLowerCase())) ||
      (!isReadOnly &&
        s.resultPasscode &&
        s.resultPasscode.toLowerCase().includes(search.toLowerCase()))
  );

  const handleBulkPasscodes = () => {
    if (isReadOnly) return;
    bulkGenerateResultPasscodes();
    showToast('Result access passcodes updated for all enrolled students.');
  };

  const handleRegenerateOne = (stdId: string) => {
    if (isReadOnly) return;
    const newCode = generateResultPasscodeForStudent(stdId);
    if (newCode) {
      showToast(`New alphanumeric passcode generated: ${newCode}`);
    }
  };

  const handleCopy = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const resetEnrollmentForm = () => {
    const defaultClass = classes[0];
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
      admissionNo: `STD/2026/${Math.floor(1000 + Math.random() * 9000)}`,
      classId: defaultClass?.id || '',
      className: defaultClass?.name || '',
      arm: defaultClass?.arms?.[0] || '',
      gender: 'Male',
      dob: '2010-04-12',
      parentName: '',
      parentPhone: '',
      parentEmail: '',
      resultPasscode: createAlphanumericCode(),
      address: 'Lagos, Nigeria',
    });
    setCreateAccountNow(false);
    setProvisionMode('invite');
    setUseCustomTempPassword(false);
    setCustomTempPassword('');
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly || isEnrolling) return;

    setEnrollError(null);
    setWarningNotice(null);

    const firstName = formData.firstName.trim();
    const lastName = formData.lastName.trim();
    const admissionNo = formData.admissionNo.trim();
    const parentName = formData.parentName.trim();
    const parentPhone = formData.parentPhone.trim();
    const normalizedEmail = normalizeLoginEmail(formData.email);
    const normalizedParentEmail = normalizeLoginEmail(formData.parentEmail);

    if (!firstName || !lastName || !admissionNo || !parentName || !parentPhone) {
      setEnrollError('Please complete all required student, admission number, and guardian fields.');
      return;
    }

    const selCls = classes.find((c) => c.id === formData.classId);
    if (!selCls) {
      setEnrollError(
        'Please select a valid class. Create classes in Class Management before enrolling students.'
      );
      return;
    }

    // Validate duplicate admission number before saving
    const dupAdm = students.find(
      (s) => s.admissionNo.trim().toLowerCase() === admissionNo.toLowerCase()
    );
    if (dupAdm) {
      setEnrollError(
        `Admission Number "${admissionNo}" is already assigned to ${dupAdm.firstName} ${dupAdm.lastName}.`
      );
      return;
    }

    // Pre-validate login email & temp password BEFORE creating the student record if account creation is selected
    let validatedProvision:
      | { normalizedEmail: string; mode: AccountProvisioningMode; temporaryPassword?: string }
      | null = null;

    if (createAccountNow) {
      const check = validateProvisionRequestInput(
        {
          role: 'student',
          recordId: '__new__',
          email: normalizedEmail,
          mode: provisionMode,
          useCustomTempPassword,
          temporaryPassword: customTempPassword,
        },
        { students, teachers, parents }
      );
      if (isProvisionValidationFailure(check)) {
        setEnrollError(check.error);
        return;
      }
      validatedProvision = check;
    } else if (normalizedEmail) {
      // Even when not provisioning immediately, ensure the student email is valid and not duplicated
      const check = validateProvisionRequestInput(
        {
          role: 'student',
          recordId: '__new__',
          email: normalizedEmail,
          mode: 'invite',
        },
        { students, teachers, parents }
      );
      if (isProvisionValidationFailure(check)) {
        setEnrollError(check.error);
        return;
      }
    }

    const newStd: Omit<Student, 'id'> = {
      firstName,
      lastName,
      email: normalizedEmail || undefined,
      admissionNo,
      classId: selCls.id,
      className: selCls.name,
      arm: formData.arm.trim() || undefined,
      gender: formData.gender,
      dob: formData.dob,
      parentName,
      parentPhone,
      parentEmail: normalizedParentEmail || undefined,
      resultPasscode: formData.resultPasscode.trim() || createAlphanumericCode(),
      address: formData.address.trim() || 'Abuja, Nigeria',
      status: 'Active',
      avatar:
        'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=300&q=80',
    };

    setIsEnrolling(true);
    try {
      const res = await addStudent(newStd);
      if (!res.ok || !res.data) {
        setEnrollError(res.error || 'Could not enroll student in Supabase.');
        return;
      }

      const savedStudent = res.data;

      if (createAccountNow && validatedProvision) {
        const provRes = await provisionPortalAccount({
          role: 'student',
          recordId: savedStudent.id,
          email: validatedProvision.normalizedEmail,
          mode: validatedProvision.mode,
          temporaryPassword: validatedProvision.temporaryPassword,
        });

        setShowAddModal(false);
        resetEnrollmentForm();

        if (!provRes.ok) {
          setWarningNotice(
            `Student "${firstName} ${lastName}" (${admissionNo}) was enrolled in ${selCls.name}, but their login account could not be provisioned yet: ${
              provRes.error || 'Unknown error'
            }. Use "Create Login Account" on their row once ready.`
          );
          return;
        }

        if (provRes.oneTimeTemporaryPassword) {
          setAccountModalTarget(null);
          setInitialHandoff({
            fullName: `${firstName} ${lastName}`,
            role: 'student',
            email: provRes.email || validatedProvision.normalizedEmail,
            temporaryPassword: provRes.oneTimeTemporaryPassword,
            recoveredPartialAccount: provRes.recoveredPartialAccount,
          });
          showToast(`Student "${firstName} ${lastName}" enrolled and login account created.`);
          return;
        }

        showToast(
          `Student "${firstName} ${lastName}" enrolled and setup invitation sent to ${
            provRes.email || validatedProvision.normalizedEmail
          }.`
        );
        return;
      }

      setShowAddModal(false);
      resetEnrollmentForm();
      showToast(
        `Student "${firstName} ${lastName}" enrolled into ${selCls.name}. Account status: Account not created.`
      );
    } finally {
      setIsEnrolling(false);
    }
  };

  const handleStartEdit = (std: Student) => {
    if (isReadOnly) return;
    setEditError(null);
    void refreshClasses();
    setEditingStudent(std);
    setEditFormData({ ...std });
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnly || !editingStudent || isUpdating) return;
    setEditError(null);

    const normalizedEmail = normalizeLoginEmail(editFormData.email);
    if (normalizedEmail) {
      const check = validateProvisionRequestInput(
        {
          role: 'student',
          recordId: editingStudent.id,
          email: normalizedEmail,
          mode: 'invite',
        },
        { students, teachers, parents }
      );
      if (isProvisionValidationFailure(check)) {
        setEditError(check.error);
        return;
      }
    }

    const selectedEditClass = classes.find((c) => c.id === editFormData.classId);
    setIsUpdating(true);
    try {
      const res = await updateStudent(editingStudent.id, {
        ...editFormData,
        admissionNo: editFormData.admissionNo?.trim() || editingStudent.admissionNo,
        firstName: editFormData.firstName?.trim() || editingStudent.firstName,
        lastName: editFormData.lastName?.trim() || editingStudent.lastName,
        email: normalizedEmail || undefined,
        classId: selectedEditClass?.id || editingStudent.classId,
        className: selectedEditClass?.name || editingStudent.className,
        arm: editFormData.arm?.trim() || undefined,
        parentName: editFormData.parentName?.trim() || editingStudent.parentName,
        parentPhone: editFormData.parentPhone?.trim() || editingStudent.parentPhone,
        parentEmail: normalizeLoginEmail(editFormData.parentEmail) || undefined,
      });

      if (!res.ok) {
        setEditError(res.error || 'Could not update student record.');
        return;
      }

      setEditingStudent(null);
      showToast(`Student record updated for ${editFormData.firstName || editingStudent.firstName}.`);
    } finally {
      setIsUpdating(false);
    }
  };

  const activeModalSummary = accountModalTarget
    ? resolveRecordAccountStatus('student', accountModalTarget.recordId, accountStatuses, {
        authUserId: accountModalTarget.authUserId,
        email: accountModalTarget.email,
      })
    : null;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Toast Notification */}
      {notification && (
        <div className="bg-emerald-100 dark:bg-emerald-950 text-emerald-900 dark:text-emerald-200 p-4 rounded-2xl border border-emerald-300 dark:border-emerald-800 flex items-center justify-between text-xs font-bold shadow-md">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
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

      {/* Partial-Success / Warning Notice */}
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

      {/* Edge Function availability banner for admin */}
      {!isReadOnly && (
        <ProvisioningServiceBanner
          available={provisioningServiceAvailable}
          notice={provisioningServiceNotice}
          loading={accountStatusLoading}
          onRefresh={() => void refreshAccountStatuses()}
        />
      )}

      {/* Header & Controls */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-md flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="font-serif font-bold text-2xl text-slate-900 dark:text-white">
            {isReadOnly ? 'Assigned Class Student Roster' : 'Student Information & Account Access'}
          </h2>
          <p className="text-xs text-slate-500">
            {isReadOnly
              ? 'View enrolled student profiles and guardian contact details for your assigned classes.'
              : 'Manage student profiles, Supabase Authentication login accounts, and admin-only terminal result passcodes.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          <div className="relative flex-1 md:w-52">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={
                isReadOnly ? 'Search student or class...' : 'Search student, email or code...'
              }
              className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>

          {!isReadOnly && (
            <>
              <button
                type="button"
                onClick={() => void refreshAccountStatuses()}
                disabled={accountStatusLoading}
                className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-200 font-bold px-3 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-colors border border-slate-200 dark:border-slate-700 disabled:opacity-60"
                title="Refresh authoritative Supabase Auth account statuses"
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
                onClick={handleBulkPasscodes}
                className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-200 font-bold px-3 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-colors border border-slate-200 dark:border-slate-700"
                title="Generate/Refresh result passcodes for all students"
              >
                <Key className="w-3.5 h-3.5 text-amber-500" /> Bulk Passcodes
              </button>

              <button
                type="button"
                onClick={() => setShowPasscodeSlipsModal(true)}
                className="bg-slate-900 dark:bg-slate-800 text-white font-bold px-3 py-2 rounded-xl text-xs flex items-center gap-1.5 hover:bg-slate-800 border border-slate-700 shadow-sm"
              >
                <Printer className="w-3.5 h-3.5 text-amber-400" /> Slips
              </button>

              <button
                type="button"
                onClick={() => {
                  setEnrollError(null);
                  void refreshClasses();
                  const defaultClass = classes.find((c) => c.id === formData.classId) || classes[0];
                  setFormData((prev) => ({
                    ...prev,
                    admissionNo: `STD/2026/${Math.floor(1000 + Math.random() * 9000)}`,
                    classId: defaultClass?.id || '',
                    className: defaultClass?.name || '',
                    arm: defaultClass?.arms?.[0] || '',
                    resultPasscode: createAlphanumericCode(),
                  }));
                  setCreateAccountNow(false);
                  setProvisionMode('invite');
                  setUseCustomTempPassword(false);
                  setCustomTempPassword('');
                  setShowAddModal(true);
                }}
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 whitespace-nowrap shadow-sm"
              >
                <Plus className="w-4 h-4" /> Enroll Student
              </button>
            </>
          )}
        </div>
      </div>

      {/* Roster Table */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-900 text-white font-semibold">
                <th className="p-3.5">Admission No</th>
                <th className="p-3.5">Student Name</th>
                <th className="p-3.5">Class</th>
                {!isReadOnly && <th className="p-3.5">Account Access (Auth)</th>}
                {!isReadOnly && <th className="p-3.5">Result Passcode</th>}
                <th className="p-3.5">Guardian &amp; Contact</th>
                <th className="p-3.5">Record</th>
                {!isReadOnly && <th className="p-3.5 text-center">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={isReadOnly ? 5 : 8} className="p-8 text-center text-slate-400">
                    No students found matching your search query.
                  </td>
                </tr>
              ) : (
                filteredStudents.map((std) => {
                  const passcode = std.resultPasscode;
                  const authSummary = resolveRecordAccountStatus(
                    'student',
                    std.id,
                    accountStatuses,
                    { authUserId: std.authUserId, email: std.email }
                  );
                  const needsAccountCreation =
                    authSummary.status === 'not_created' || Boolean(authSummary.needsRepair);

                  return (
                    <tr key={std.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="p-3.5 font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">
                        {std.admissionNo}
                      </td>
                      <td className="p-3.5">
                        <div className="flex items-center gap-2.5">
                          <img
                            src={std.avatar}
                            alt={std.firstName}
                            className="w-9 h-9 rounded-full object-cover border border-slate-200 shrink-0"
                          />
                          <div>
                            <p className="font-bold text-slate-900 dark:text-white">
                              {std.firstName} {std.lastName}
                            </p>
                            <p className="text-[10px] text-slate-400">
                              {std.gender} • DOB: {std.dob}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="p-3.5 font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">
                        {std.className}
                        {std.arm ? ` (${std.arm})` : ''}
                      </td>
                      {!isReadOnly && (
                        <td className="p-3.5">
                          <div className="space-y-1.5">
                            <AccountStatusBadge summary={authSummary} compact />
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono truncate max-w-[190px]">
                              {authSummary.email || std.email || 'No login email set'}
                            </p>
                            <button
                              type="button"
                              onClick={() => {
                                setInitialHandoff(null);
                                setAccountModalTarget(toAccountTarget(std));
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
                        </td>
                      )}
                      {!isReadOnly && (
                        <td className="p-3.5">
                          {passcode ? (
                            <div className="inline-flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950/60 px-2.5 py-1.5 rounded-xl border border-amber-200 dark:border-amber-800/80">
                              <Key className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                              <span className="font-mono font-bold text-amber-900 dark:text-amber-200 text-xs tracking-wider">
                                {passcode}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleCopy(passcode, std.id)}
                                className="p-1 text-slate-400 hover:text-slate-900 dark:hover:text-white ml-1"
                                title="Copy Passcode"
                              >
                                {copiedId === std.id ? (
                                  <Check className="w-3 h-3 text-emerald-500" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRegenerateOne(std.id)}
                                className="p-1 text-amber-600 hover:text-amber-800 dark:hover:text-amber-300"
                                title="Regenerate Alphanumeric Code"
                              >
                                <RefreshCw className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleRegenerateOne(std.id)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 text-[11px] font-bold hover:border-amber-500"
                            >
                              <RefreshCw className="w-3 h-3 text-amber-500" /> Generate Passcode
                            </button>
                          )}
                        </td>
                      )}
                      <td className="p-3.5 text-slate-600 dark:text-slate-400">
                        <p className="font-semibold text-slate-900 dark:text-white">
                          {std.parentName}
                        </p>
                        <p className="text-[11px] text-slate-500">{std.parentPhone}</p>
                        {std.parentEmail && (
                          <p className="text-[10px] text-slate-400 font-mono">{std.parentEmail}</p>
                        )}
                      </td>
                      <td className="p-3.5">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            std.status === 'Active'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                          }`}
                        >
                          {std.status}
                        </span>
                      </td>
                      {!isReadOnly && (
                        <td className="p-3.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleStartEdit(std)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950 rounded-lg transition-colors flex items-center gap-1 font-semibold text-[11px]"
                              title="Edit Student Profile"
                            >
                              <Edit className="w-4 h-4" /> Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => setStudentToDelete(std)}
                              className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950 rounded-lg transition-colors"
                              title="Delete Record"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Enroll New Student Modal (Admin only) */}
      {!isReadOnly && showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
          <form
            onSubmit={handleAddSubmit}
            className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-xl w-full space-y-4 shadow-2xl my-8 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-serif font-bold text-xl text-slate-900 dark:text-white">
                  Enroll New Student
                </h3>
                <p className="text-xs text-slate-500">
                  Register student details, assign class, and optionally provision their Supabase
                  Authentication login account.
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

            {enrollError && (
              <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-2 text-xs text-red-600 dark:text-red-400 font-bold">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{enrollError}</span>
              </div>
            )}

            {classes.length === 0 && (
              <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-amber-900 dark:text-amber-200">
                <span className="font-semibold">
                  No classes exist in Supabase yet. Create a class before enrolling students.
                </span>
                {onNavigateToClasses && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false);
                      onNavigateToClasses();
                    }}
                    className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-[11px] whitespace-nowrap self-start sm:self-auto"
                  >
                    Open Class Management
                  </button>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">First Name *</label>
                <input
                  type="text"
                  required
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
                  placeholder="e.g. David"
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
                  placeholder="e.g. Chukwu"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Admission Number *</label>
                <input
                  type="text"
                  required
                  value={formData.admissionNo}
                  onChange={(e) =>
                    setFormData({ ...formData, admissionNo: e.target.value.toUpperCase() })
                  }
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-mono font-bold"
                  placeholder="e.g. STD/2026/1042"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Date of Birth *</label>
                <input
                  type="date"
                  required
                  value={formData.dob}
                  onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
                />
              </div>

              <div className="col-span-2 sm:col-span-1">
                <label className="block font-semibold mb-1">Class *</label>
                <select
                  required
                  value={formData.classId}
                  disabled={classes.length === 0}
                  onChange={(e) => {
                    const sel = classes.find((c) => c.id === e.target.value);
                    setEnrollError(null);
                    setFormData({
                      ...formData,
                      classId: e.target.value,
                      className: sel?.name || '',
                      arm: sel?.arms?.[0] || '',
                    });
                  }}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl disabled:opacity-60"
                >
                  {classes.length === 0 ? (
                    <option value="">No classes available</option>
                  ) : (
                    classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.category})
                      </option>
                    ))
                  )}
                </select>
              </div>

              {(() => {
                const selectedClass = classes.find((c) => c.id === formData.classId);
                if (!selectedClass || !selectedClass.arms || selectedClass.arms.length === 0) {
                  return null;
                }
                return (
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block font-semibold mb-1">Class Arm / Stream</label>
                    <select
                      value={formData.arm}
                      onChange={(e) => setFormData({ ...formData, arm: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
                    >
                      {selectedClass.arms.map((arm) => (
                        <option key={arm} value={arm}>
                          {arm}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })()}

              <div>
                <label className="block font-semibold mb-1">Gender *</label>
                <select
                  value={formData.gender}
                  onChange={(e) =>
                    setFormData({ ...formData, gender: e.target.value as 'Male' | 'Female' })
                  }
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1">Guardian Name *</label>
                <input
                  type="text"
                  required
                  value={formData.parentName}
                  onChange={(e) => setFormData({ ...formData, parentName: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
                  placeholder="e.g. Mr. Chukwu"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Guardian Phone *</label>
                <input
                  type="tel"
                  required
                  value={formData.parentPhone}
                  onChange={(e) => setFormData({ ...formData, parentPhone: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
                  placeholder="e.g. +234 803 123 4567"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Guardian Email (Optional)</label>
                <input
                  type="email"
                  value={formData.parentEmail}
                  onChange={(e) => setFormData({ ...formData, parentEmail: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
                  placeholder="parent@example.com"
                />
              </div>

              <div className="col-span-2">
                <label className="block font-semibold mb-1 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-amber-500" /> Student Login Email Address{' '}
                  {createAccountNow ? '*' : '(Required to create portal login)'}
                </label>
                <input
                  type="email"
                  required={createAccountNow}
                  value={formData.email}
                  onChange={(e) => {
                    setEnrollError(null);
                    setFormData({ ...formData, email: e.target.value });
                  }}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
                  placeholder="e.g. david.chukwu@student.divineacademy.edu"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Must be a valid, unique email address for Supabase Authentication. Leave blank if
                  enrolling record only without portal login.
                </p>
              </div>

              {/* Account Access Provisioning Section */}
              <div className="col-span-2">
                <RegistrationAccountAccessSection
                  roleLabel="student"
                  loginEmail={formData.email}
                  createAccountNow={createAccountNow}
                  onToggleCreateAccountNow={(checked) => {
                    setEnrollError(null);
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
              </div>

              <div className="col-span-2 bg-amber-50 dark:bg-amber-950/40 p-3 rounded-2xl border border-amber-200 dark:border-amber-800/50 space-y-2">
                <div>
                  <label className="block font-bold text-amber-900 dark:text-amber-300 mb-1 flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-amber-600" /> Result Access Passcode
                    (Alphanumeric) *
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      required
                      value={formData.resultPasscode}
                      onChange={(e) =>
                        setFormData({ ...formData, resultPasscode: e.target.value.toUpperCase() })
                      }
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 rounded-xl font-mono text-xs font-bold uppercase tracking-wider text-amber-900 dark:text-amber-200"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setFormData({ ...formData, resultPasscode: createAlphanumericCode() })
                      }
                      className="px-3 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-[11px] whitespace-nowrap"
                    >
                      Generate New
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 flex justify-between border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                disabled={isEnrolling}
                onClick={() => setShowAddModal(false)}
                className="bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold px-5 py-2 rounded-xl text-xs disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isEnrolling || classes.length === 0}
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-6 py-2 rounded-xl text-xs shadow-md flex items-center gap-1.5 disabled:opacity-60"
              >
                {isEnrolling && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {isEnrolling
                  ? createAccountNow
                    ? 'Enrolling & Provisioning...'
                    : 'Saving...'
                  : createAccountNow
                    ? 'Enroll & Create Login Account'
                    : 'Save Student Record'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Student Profile Modal (Admin only) */}
      {!isReadOnly && editingStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
          <form
            onSubmit={handleEditSubmit}
            className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-lg w-full space-y-4 shadow-2xl my-8 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="font-serif font-bold text-xl text-slate-900 dark:text-white flex items-center gap-2">
                <Edit className="w-5 h-5 text-amber-500" /> Edit Student Record
              </h3>
              <span className="font-mono text-xs font-bold text-amber-600">
                {editingStudent.admissionNo}
              </span>
            </div>

            {editError && (
              <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-2 text-xs text-red-600 dark:text-red-400 font-bold">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{editError}</span>
              </div>
            )}

            {/* Account Access Summary Strip */}
            {(() => {
              const summary = resolveRecordAccountStatus(
                'student',
                editingStudent.id,
                accountStatuses,
                { authUserId: editingStudent.authUserId, email: editingStudent.email }
              );
              const needsCreate = summary.status === 'not_created' || Boolean(summary.needsRepair);
              return (
                <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="space-y-1">
                    <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-amber-500" /> Portal Account Access
                    </span>
                    <AccountStatusBadge summary={summary} compact />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const target = toAccountTarget(editingStudent);
                      setEditingStudent(null);
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

            <div className="grid grid-cols-2 gap-3 text-xs">
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

              <div className="col-span-2">
                <label className="block font-semibold mb-1">Admission Number</label>
                <input
                  type="text"
                  required
                  value={editFormData.admissionNo || ''}
                  onChange={(e) =>
                    setEditFormData({
                      ...editFormData,
                      admissionNo: e.target.value.toUpperCase(),
                    })
                  }
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-mono font-bold"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Class</label>
                <select
                  value={editFormData.classId || ''}
                  onChange={(e) => {
                    const sel = classes.find((c) => c.id === e.target.value);
                    setEditFormData({
                      ...editFormData,
                      classId: e.target.value,
                      className: sel?.name || editFormData.className,
                      arm: sel?.arms?.[0] || '',
                    });
                  }}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
                >
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold mb-1">Class Arm / Stream</label>
                {(() => {
                  const sel = classes.find((c) => c.id === editFormData.classId);
                  if (sel && sel.arms && sel.arms.length > 0) {
                    return (
                      <select
                        value={editFormData.arm || ''}
                        onChange={(e) => setEditFormData({ ...editFormData, arm: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
                      >
                        <option value="">None</option>
                        {sel.arms.map((arm) => (
                          <option key={arm} value={arm}>
                            {arm}
                          </option>
                        ))}
                      </select>
                    );
                  }
                  return (
                    <input
                      type="text"
                      value={editFormData.arm || ''}
                      onChange={(e) => setEditFormData({ ...editFormData, arm: e.target.value })}
                      placeholder="Optional arm"
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
                    />
                  );
                })()}
              </div>

              <div className="col-span-2">
                <label className="block font-semibold mb-1">Student Login Email</label>
                <input
                  type="email"
                  value={editFormData.email || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                  placeholder="student@student.divineacademy.edu"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Guardian Name</label>
                <input
                  type="text"
                  required
                  value={editFormData.parentName || ''}
                  onChange={(e) => setEditFormData({ ...editFormData, parentName: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-semibold mb-1">Guardian Phone</label>
                <input
                  type="tel"
                  required
                  value={editFormData.parentPhone || ''}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, parentPhone: e.target.value })
                  }
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
                />
              </div>

              <div className="col-span-2">
                <label className="block font-semibold mb-1">Guardian Email</label>
                <input
                  type="email"
                  value={editFormData.parentEmail || ''}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, parentEmail: e.target.value })
                  }
                  placeholder="parent@example.com"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl"
                />
              </div>

              <div className="col-span-2 bg-amber-50 dark:bg-amber-950/40 p-3 rounded-2xl border border-amber-200 dark:border-amber-800/50 space-y-2">
                <div>
                  <label className="block font-bold text-amber-900 dark:text-amber-300 mb-1 flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-amber-600" /> Alphanumeric Result Passcode
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={editFormData.resultPasscode || ''}
                      placeholder="Enter or generate passcode"
                      onChange={(e) =>
                        setEditFormData({
                          ...editFormData,
                          resultPasscode: e.target.value.toUpperCase(),
                        })
                      }
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 rounded-xl font-mono text-xs font-bold uppercase tracking-wider text-amber-900 dark:text-amber-200"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setEditFormData({
                          ...editFormData,
                          resultPasscode: createAlphanumericCode(),
                        })
                      }
                      className="px-3 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-[11px] whitespace-nowrap"
                    >
                      Regenerate
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 flex justify-between border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                disabled={isUpdating}
                onClick={() => setEditingStudent(null)}
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
                {isUpdating ? 'Updating...' : 'Update Profile'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Printable Result Access Passcode Slips Modal (Admin only) */}
      {!isReadOnly && showPasscodeSlipsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200 dark:border-slate-800 max-w-3xl w-full space-y-6 shadow-2xl my-8">
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-4">
              <div>
                <h3 className="font-serif font-bold text-xl text-slate-900 dark:text-white flex items-center gap-2">
                  <Key className="w-5 h-5 text-amber-500" /> Official Result Access Passcode Slips
                </h3>
                <p className="text-xs text-slate-500">
                  Distribution cards for students and parents to access terminal report cards.
                </p>
              </div>

              <button
                type="button"
                onClick={() => window.print()}
                className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 shadow-sm"
              >
                <Printer className="w-4 h-4" /> Print All Slips
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto p-2">
              {students.map((std) => (
                <div
                  key={std.id}
                  className="p-4 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border-2 border-dashed border-amber-300 dark:border-amber-800 space-y-3 relative"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-serif font-bold text-xs text-slate-900 dark:text-white uppercase tracking-wider">
                      DIVINE ACADEMY SECONDARY SCHOOL
                    </span>
                    <span className="text-[10px] font-bold text-amber-600 bg-amber-100 dark:bg-amber-950 px-2 py-0.5 rounded-full">
                      Result Scratch Card
                    </span>
                  </div>

                  <div className="text-xs space-y-0.5">
                    <p className="font-bold text-slate-900 dark:text-white text-sm">
                      {std.firstName} {std.lastName}
                    </p>
                    <p className="text-slate-500 font-mono text-[11px]">
                      Adm No: {std.admissionNo} • {std.className}
                    </p>
                  </div>

                  <div className="bg-slate-900 text-white p-3 rounded-xl text-center space-y-1">
                    <p className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">
                      Alphanumeric Passcode:
                    </p>
                    <p className="font-mono font-black text-lg tracking-widest text-amber-300">
                      {std.resultPasscode || 'NOT ISSUED'}
                    </p>
                  </div>

                  <p className="text-[9px] text-slate-400 text-center italic">
                    Keep confidential. Enter passcode on student portal to view report card.
                  </p>
                </div>
              ))}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowPasscodeSlipsModal(false)}
                className="bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold px-6 py-2 rounded-xl text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Account Provisioning & Access Management Modal */}
      {!isReadOnly && (
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
      )}

      {/* Confirmation Modal for Student Deletion (Admin only) */}
      {!isReadOnly && (
        <ConfirmDeleteModal
          isOpen={!!studentToDelete}
          onClose={() => setStudentToDelete(null)}
          onConfirm={() => {
            if (studentToDelete) {
              deleteStudent(studentToDelete.id);
              setStudentToDelete(null);
            }
          }}
          title="Confirm Student Profile Deletion"
          message="Are you sure you want to delete this student profile from the portal? This will permanently remove their records."
          itemName={
            studentToDelete
              ? `${studentToDelete.firstName} ${studentToDelete.lastName} (${studentToDelete.admissionNo})`
              : undefined
          }
        />
      )}
    </div>
  );
};
