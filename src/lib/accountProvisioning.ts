import type {
  AccountProvisioningMode,
  AccountProvisioningStatus,
  AccountStatusSummary,
  Parent,
  PortalAccountRole,
  Student,
  Teacher,
} from '../types';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const ACCOUNT_STATUS_META: Record<
  AccountProvisioningStatus,
  {
    label: string;
    shortLabel: string;
    description: string;
    badgeClass: string;
    dotClass: string;
  }
> = {
  not_created: {
    label: 'Account not created',
    shortLabel: 'Not Created',
    description: 'No Supabase Authentication login identity is linked to this record yet.',
    badgeClass:
      'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
    dotClass: 'bg-slate-400',
  },
  invitation_pending: {
    label: 'Invitation pending',
    shortLabel: 'Invite Pending',
    description:
      'An account setup invitation has been issued. Waiting for the user to confirm and set their password.',
    badgeClass:
      'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
    dotClass: 'bg-amber-500',
  },
  active: {
    label: 'Account active',
    shortLabel: 'Active',
    description: 'Verified Supabase Authentication identity is active and linked to this record.',
    badgeClass:
      'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
    dotClass: 'bg-emerald-500',
  },
  disabled: {
    label: 'Account disabled',
    shortLabel: 'Disabled',
    description: 'Login access has been disabled by an administrator.',
    badgeClass:
      'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800',
    dotClass: 'bg-red-500',
  },
};

export function makeAccountStatusKey(role: PortalAccountRole, recordId: string): string {
  return `${role}:${recordId}`;
}

export function normalizeLoginEmail(raw: string | undefined | null): string {
  return (raw ?? '').trim().toLowerCase();
}

export function isValidLoginEmail(raw: string | undefined | null): boolean {
  const cleaned = normalizeLoginEmail(raw);
  if (!cleaned || cleaned.length > 254) return false;
  return EMAIL_PATTERN.test(cleaned);
}

export interface PasswordValidationSuccess {
  ok: true;
}

export interface PasswordValidationFailure {
  ok: false;
  error: string;
}

export type PasswordValidationResult = PasswordValidationSuccess | PasswordValidationFailure;

export function isPasswordValidationFailure(
  result: PasswordValidationResult
): result is PasswordValidationFailure {
  return result.ok === false;
}

/**
 * Validates temporary or personal passwords for minimum security strength.
 * Never logs or persists the password value.
 */
export function validatePortalPassword(
  password: string,
  options?: { minLength?: number; requireSymbol?: boolean }
): PasswordValidationResult {
  const minLength = options?.minLength ?? 8;
  const requireSymbol = options?.requireSymbol ?? false;

  if (!password || password.length < minLength) {
    return {
      ok: false,
      error: `Password must be at least ${minLength} characters long.`,
    };
  }
  if (password.length > 128) {
    return {
      ok: false,
      error: 'Password must not exceed 128 characters.',
    };
  }
  if (!/[A-Z]/.test(password)) {
    return {
      ok: false,
      error: 'Password must include at least one uppercase letter (A–Z).',
    };
  }
  if (!/[a-z]/.test(password)) {
    return {
      ok: false,
      error: 'Password must include at least one lowercase letter (a–z).',
    };
  }
  if (!/[0-9]/.test(password)) {
    return {
      ok: false,
      error: 'Password must include at least one number (0–9).',
    };
  }
  if (requireSymbol && !/[^A-Za-z0-9]/.test(password)) {
    return {
      ok: false,
      error: 'Temporary password must include at least one symbol (e.g. ! @ # $ % & *).',
    };
  }
  return { ok: true };
}

export interface ProvisionValidationSuccess {
  ok: true;
  normalizedEmail: string;
  mode: AccountProvisioningMode;
  temporaryPassword?: string;
}

export interface ProvisionValidationFailure {
  ok: false;
  error: string;
}

export type ProvisionValidationResult = ProvisionValidationSuccess | ProvisionValidationFailure;

export function isProvisionValidationFailure(
  result: ProvisionValidationResult
): result is ProvisionValidationFailure {
  return result.ok === false;
}

/**
 * Validates client-side inputs before invoking the server-side provisioning Edge Function.
 * Checks valid email syntax, cross-directory uniqueness, and temporary password strength.
 */
export function validateProvisionRequestInput(
  input: {
    role: PortalAccountRole;
    recordId: string;
    email: string;
    mode: AccountProvisioningMode;
    useCustomTempPassword?: boolean;
    temporaryPassword?: string;
  },
  directory: {
    students: Student[];
    teachers: Teacher[];
    parents: Parent[];
  }
): ProvisionValidationResult {
  const normalizedEmail = normalizeLoginEmail(input.email);
  if (!isValidLoginEmail(normalizedEmail)) {
    return {
      ok: false,
      error: 'Enter a valid, unique email address for this portal login identity.',
    };
  }

  // Check duplicate email against other student, teacher, and parent records
  const duplicateStudent = directory.students.find(
    (s) =>
      normalizeLoginEmail(s.email) === normalizedEmail &&
      !(input.role === 'student' && s.id === input.recordId)
  );
  if (duplicateStudent) {
    return {
      ok: false,
      error: `Email "${normalizedEmail}" is already assigned to student ${duplicateStudent.firstName} ${duplicateStudent.lastName} (${duplicateStudent.admissionNo}).`,
    };
  }

  const duplicateTeacher = directory.teachers.find(
    (t) =>
      normalizeLoginEmail(t.email) === normalizedEmail &&
      !(input.role === 'teacher' && t.id === input.recordId)
  );
  if (duplicateTeacher) {
    return {
      ok: false,
      error: `Email "${normalizedEmail}" is already assigned to staff member ${duplicateTeacher.firstName} ${duplicateTeacher.lastName} (${duplicateTeacher.staffId}).`,
    };
  }

  const duplicateParent = directory.parents.find(
    (p) =>
      normalizeLoginEmail(p.email) === normalizedEmail &&
      !(input.role === 'parent' && p.id === input.recordId)
  );
  if (duplicateParent) {
    return {
      ok: false,
      error: `Email "${normalizedEmail}" is already assigned to parent/guardian ${duplicateParent.fullName} (${duplicateParent.parentId}).`,
    };
  }

  if (input.mode === 'temporary_password' && input.useCustomTempPassword) {
    const pwdCheck = validatePortalPassword(input.temporaryPassword ?? '', {
      minLength: 10,
      requireSymbol: true,
    });
    if (isPasswordValidationFailure(pwdCheck)) {
      return { ok: false, error: pwdCheck.error };
    }
    return {
      ok: true,
      normalizedEmail,
      mode: input.mode,
      temporaryPassword: input.temporaryPassword,
    };
  }

  return {
    ok: true,
    normalizedEmail,
    mode: input.mode,
  };
}

/**
 * Resolves the authoritative AccountStatusSummary for a record from the
 * server-fetched status map. Never fabricates "active" status from an email
 * string alone — an unlinked record always defaults to `not_created`.
 */
export function resolveRecordAccountStatus(
  role: PortalAccountRole,
  recordId: string,
  statusMap: Record<string, AccountStatusSummary>,
  recordHints?: { authUserId?: string; email?: string }
): AccountStatusSummary {
  const key = makeAccountStatusKey(role, recordId);
  const authoritative = statusMap[key];
  if (authoritative) {
    return authoritative;
  }

  // Only if the database record itself carries a persisted auth_user_id UUID
  // before status hydration completes, report a partial/repairable state rather
  // than fabricating active status.
  if (recordHints?.authUserId) {
    return {
      role,
      recordId,
      authUserId: recordHints.authUserId,
      email: recordHints.email,
      status: 'active',
      mustChangePassword: false,
      needsRepair: false,
      source: 'profiles_table',
    };
  }

  return {
    role,
    recordId,
    email: recordHints?.email,
    status: 'not_created',
    mustChangePassword: false,
    source: 'profiles_table',
  };
}

export function formatRecordPersistenceError(
  entityLabel: 'student' | 'teacher' | 'parent',
  message: string,
  code?: string
): string {
  const lower = (message || '').toLowerCase();
  if (code === '23505' || lower.includes('duplicate key') || lower.includes('unique constraint')) {
    if (lower.includes('admission_no')) {
      return 'A student with this Admission Number already exists in Supabase.';
    }
    if (lower.includes('staff_id')) {
      return 'A staff member with this Staff ID already exists in Supabase.';
    }
    if (lower.includes('parent_id')) {
      return 'A parent record with this Parent ID already exists in Supabase.';
    }
    if (lower.includes('email')) {
      return `This email address is already assigned to another ${entityLabel} record.`;
    }
    return `A duplicate ${entityLabel} record already exists in Supabase.`;
  }
  if (code === '42501' || lower.includes('row-level security') || lower.includes('permission denied')) {
    return `Permission denied: only an authenticated school administrator can manage ${entityLabel} records.`;
  }
  return message || `Unable to save ${entityLabel} record in Supabase.`;
}
