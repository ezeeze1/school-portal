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

/**
 * Reserved RFC 6762 / ICANN `.internal` domain suffix used strictly on the server
 * for student Supabase Auth identities when a student has no personal email address.
 * Never exposed in student-facing UI and never routable on the public internet.
 */
export const INTERNAL_STUDENT_AUTH_DOMAIN = 'students.divineacademy.internal';

export function isInternalStudentAuthEmail(raw: string | undefined | null): boolean {
  const cleaned = normalizeLoginEmail(raw);
  return cleaned.endsWith(`@${INTERNAL_STUDENT_AUTH_DOMAIN}`);
}

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
  if (isInternalStudentAuthEmail(cleaned)) return false;
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
 * Validates administrator-assigned or personal passwords for minimum security strength.
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
      error: 'Password must include at least one symbol (e.g. ! @ # $ % & *).',
    };
  }
  return { ok: true };
}

export interface ProvisionValidationSuccess {
  ok: true;
  normalizedEmail?: string;
  mode: AccountProvisioningMode;
  password?: string;
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
 *
 * Role rules:
 *  - `student`: Personal email is OPTIONAL (students log in using Admission Number + Password).
 *    Mode is always `'admin_password'` with password + confirmPassword.
 *  - `teacher` / `parent`: A valid, unique email address is REQUIRED. Supports `'admin_password'`
 *    (with password + confirmPassword) or `'invite'`.
 */
export function validateProvisionRequestInput(
  input: {
    role: PortalAccountRole;
    recordId: string;
    email?: string;
    mode: AccountProvisioningMode;
    password?: string;
    confirmPassword?: string;
    validatePassword?: boolean;
  },
  directory: {
    students: Student[];
    teachers: Teacher[];
    parents: Parent[];
  }
): ProvisionValidationResult {
  const normalizedEmail = normalizeLoginEmail(input.email);
  const emailRequired = input.role !== 'student' || input.mode === 'invite';

  if (emailRequired && !normalizedEmail) {
    return {
      ok: false,
      error: 'Enter a valid, unique email address for this portal login identity.',
    };
  }

  if (normalizedEmail) {
    if (!isValidLoginEmail(normalizedEmail)) {
      return {
        ok: false,
        error: 'Enter a valid email address (for example, name@divineacademy.edu).',
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
  }

  const effectiveMode: AccountProvisioningMode =
    input.role === 'student' ? 'admin_password' : input.mode;
  const shouldValidatePassword =
    input.validatePassword !== undefined ? input.validatePassword : effectiveMode === 'admin_password';

  if (effectiveMode === 'admin_password' && shouldValidatePassword) {
    const pwd = input.password ?? '';
    const pwdCheck = validatePortalPassword(pwd, { minLength: 8 });
    if (isPasswordValidationFailure(pwdCheck)) {
      return { ok: false, error: pwdCheck.error };
    }
    if (input.confirmPassword !== undefined && pwd !== input.confirmPassword) {
      return {
        ok: false,
        error: 'Password and Confirm Password do not match.',
      };
    }
    return {
      ok: true,
      normalizedEmail: normalizedEmail || undefined,
      mode: effectiveMode,
      password: pwd,
    };
  }

  return {
    ok: true,
    normalizedEmail: normalizedEmail || undefined,
    mode: effectiveMode,
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
  recordHints?: { authUserId?: string; email?: string; loginIdentifier?: string }
): AccountStatusSummary {
  const key = makeAccountStatusKey(role, recordId);
  const authoritative = statusMap[key];
  if (authoritative) {
    const safeEmail =
      role === 'student' && isInternalStudentAuthEmail(authoritative.email)
        ? recordHints?.email
        : authoritative.email;
    return {
      ...authoritative,
      email: safeEmail,
      loginIdentifier:
        authoritative.loginIdentifier ||
        recordHints?.loginIdentifier ||
        (role === 'student' ? undefined : safeEmail),
    };
  }

  if (recordHints?.authUserId) {
    return {
      role,
      recordId,
      authUserId: recordHints.authUserId,
      email:
        role === 'student' && isInternalStudentAuthEmail(recordHints.email)
          ? undefined
          : recordHints.email,
      loginIdentifier:
        recordHints.loginIdentifier || (role === 'student' ? undefined : recordHints.email),
      status: 'active',
      mustChangePassword: false,
      needsRepair: false,
      source: 'profiles_table',
    };
  }

  return {
    role,
    recordId,
    email:
      role === 'student' && isInternalStudentAuthEmail(recordHints?.email)
        ? undefined
        : recordHints?.email,
    loginIdentifier:
      recordHints?.loginIdentifier || (role === 'student' ? undefined : recordHints?.email),
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
