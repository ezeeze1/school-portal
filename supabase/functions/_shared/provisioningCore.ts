/**
 * Server-side core business logic for Divine Academy Portal account provisioning.
 *
 * Security guarantees enforced here:
 *  1. Caller JWT must resolve to a real Supabase Auth user.
 *  2. Caller role MUST be verified as `role = 'admin'` AND `is_active = true` from `public.user_profiles`.
 *  3. Target role is strictly constrained to `'student' | 'teacher' | 'parent'` (never `'admin'`).
 *  4. Passwords are ONLY handled by Supabase Admin Auth APIs; NEVER written to school tables,
 *     NEVER logged, and NEVER returned in server HTTP responses.
 *  5. Students do not require a personal email address — a non-deliverable internal auth
 *     identifier (`std.<id>@students.divineacademy.internal`) is used strictly inside Supabase Auth,
 *     while students authenticate via Admission Number + Password through `student-auth-login`.
 *  6. Duplicate emails, mismatched record links, and cross-role account hijacking are blocked.
 *  7. Partial failures trigger compensating cleanup or safe metadata-verified idempotent recovery.
 *  8. Password-recovery emails are NOT sent by this function.
 */

export type ProvisionableRole = 'student' | 'teacher' | 'parent';
export type AccountStatus = 'not_created' | 'invitation_pending' | 'active' | 'disabled';
export type ProvisionMode = 'admin_password' | 'invite';

export const INTERNAL_STUDENT_AUTH_DOMAIN = 'students.divineacademy.internal';

export interface AuthUserRecord {
  id: string;
  email?: string | null;
  email_confirmed_at?: string | null;
  confirmed_at?: string | null;
  invited_at?: string | null;
  last_sign_in_at?: string | null;
  banned_until?: string | null;
  user_metadata?: Record<string, unknown> | null;
  app_metadata?: Record<string, unknown> | null;
}

export interface ProfileRow {
  auth_user_id: string;
  role: string;
  reference_id: string | null;
  email: string;
  full_name: string;
  is_active: boolean;
  account_status?: string | null;
  must_change_password?: boolean | null;
  invited_at?: string | null;
  activated_at?: string | null;
}

export interface DirectoryRecord {
  id: string;
  auth_user_id: string | null;
  email: string | null;
  fullName: string;
  admissionNo?: string | null;
  status?: string | null;
}

export interface ServerAccountStatusItem {
  role: ProvisionableRole;
  recordId: string;
  authUserId?: string;
  email?: string;
  loginIdentifier?: string;
  status: AccountStatus;
  mustChangePassword: boolean;
  invitedAt?: string;
  lastSignInAt?: string;
  needsRepair?: boolean;
  source: 'edge_function';
}

export interface ProvisioningBackendAdapter {
  getCallerFromJwt(jwt: string): Promise<{ user: AuthUserRecord | null; error?: string }>;
  getProfileByAuthUserId(authUserId: string): Promise<ProfileRow | null>;
  getProfileByRoleAndReference(role: ProvisionableRole, recordId: string): Promise<ProfileRow | null>;
  getProfileByEmail(normalizedEmail: string): Promise<ProfileRow | null>;
  listNonAdminProfiles(): Promise<ProfileRow[]>;

  getDirectoryRecord(role: ProvisionableRole, recordId: string): Promise<DirectoryRecord | null>;
  listDirectoryRecords(role: ProvisionableRole): Promise<DirectoryRecord[]>;
  findDirectoryEmailConflict(
    normalizedEmail: string,
    excludeRole: ProvisionableRole,
    excludeRecordId: string
  ): Promise<{ role: ProvisionableRole; recordId: string } | null>;
  linkDirectoryRecordAuthUser(
    role: ProvisionableRole,
    recordId: string,
    authUserId: string,
    normalizedEmail?: string | null
  ): Promise<{ ok: boolean; error?: string }>;

  upsertUserProfile(input: {
    authUserId: string;
    role: ProvisionableRole;
    referenceId: string;
    email: string;
    fullName: string;
    isActive: boolean;
    accountStatus: Exclude<AccountStatus, 'not_created'>;
    mustChangePassword: boolean;
    invitedAt?: string | null;
    activatedAt?: string | null;
  }): Promise<{ ok: boolean; error?: string }>;
  deleteUserProfile(authUserId: string): Promise<void>;

  listAllAuthUsers(): Promise<AuthUserRecord[]>;
  getAuthUserById(authUserId: string): Promise<AuthUserRecord | null>;
  findAuthUserByEmail(normalizedEmail: string): Promise<AuthUserRecord | null>;
  inviteAuthUserByEmail(input: {
    email: string;
    redirectTo?: string;
    userMetadata: Record<string, unknown>;
  }): Promise<{ user: AuthUserRecord | null; error?: string }>;
  createAuthUserWithPassword(input: {
    email: string;
    password: string;
    userMetadata: Record<string, unknown>;
    appMetadata: Record<string, unknown>;
  }): Promise<{ user: AuthUserRecord | null; error?: string }>;
  updateAuthUserById(
    authUserId: string,
    updates: {
      email?: string;
      password?: string;
      email_confirm?: boolean;
      ban_duration?: string;
      user_metadata?: Record<string, unknown>;
      app_metadata?: Record<string, unknown>;
    }
  ): Promise<{ user: AuthUserRecord | null; error?: string }>;
  deleteAuthUser(authUserId: string): Promise<void>;
}

export interface CoreHttpResult {
  status: number;
  body: Record<string, unknown>;
}

const VALID_ROLES = new Set<ProvisionableRole>(['student', 'teacher', 'parent']);
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isProvisionableRole(value: unknown): value is ProvisionableRole {
  return typeof value === 'string' && VALID_ROLES.has(value as ProvisionableRole);
}

export function normalizeEmail(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim().toLowerCase() : '';
}

export function isInternalStudentAuthEmail(raw: unknown): boolean {
  const cleaned = normalizeEmail(raw);
  return cleaned.endsWith(`@${INTERNAL_STUDENT_AUTH_DOMAIN}`);
}

export function isValidExternalEmail(email: string): boolean {
  return (
    Boolean(email) &&
    email.length <= 254 &&
    !isInternalStudentAuthEmail(email) &&
    EMAIL_REGEX.test(email)
  );
}

/**
 * Generates a deterministic, unique, non-deliverable Supabase Auth identifier
 * for a student record using the RFC-reserved `.internal` top-level domain.
 * Never routable over public email infrastructure and never exposed in student UI.
 */
export function buildInternalStudentAuthEmail(studentRecordId: string): string {
  const safeSlug = studentRecordId
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  const localPart = safeSlug ? `std.${safeSlug}` : `std.${Date.now()}`;
  return `${localPart}@${INTERNAL_STUDENT_AUTH_DOMAIN}`;
}

export function sanitizeRedirectUrl(raw: unknown, allowedOriginsRaw?: string): string | undefined {
  if (typeof raw !== 'string' || !raw.trim()) return undefined;
  try {
    const parsed = new URL(raw.trim());
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return undefined;
    }
    const allowedOrigins = (allowedOriginsRaw ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (allowedOrigins.length > 0 && !allowedOrigins.includes(parsed.origin)) {
      return undefined;
    }
    return parsed.origin;
  } catch {
    return undefined;
  }
}

export function validateAssignedPassword(password: string): string | null {
  if (password.length < 8) return 'Password must be at least 8 characters long.';
  if (password.length > 128) return 'Password must not exceed 128 characters.';
  if (!/[A-Z]/.test(password)) return 'Password must include at least one uppercase letter.';
  if (!/[a-z]/.test(password)) return 'Password must include at least one lowercase letter.';
  if (!/[0-9]/.test(password)) return 'Password must include at least one number.';
  return null;
}

export function isAuthUserBanned(authUser: AuthUserRecord | null | undefined, nowMs = Date.now()): boolean {
  if (!authUser?.banned_until) return false;
  const bannedUntilMs = Date.parse(authUser.banned_until);
  return Number.isFinite(bannedUntilMs) && bannedUntilMs > nowMs;
}

export function deriveAuthoritativeStatus(
  record: DirectoryRecord,
  profile: ProfileRow | null | undefined,
  authUser: AuthUserRecord | null | undefined,
  role: ProvisionableRole,
  nowMs = Date.now()
): ServerAccountStatusItem {
  const linkedAuthId = record.auth_user_id || profile?.auth_user_id || undefined;
  const studentLoginId =
    role === 'student' ? (record.admissionNo?.trim() || undefined) : undefined;
  const safeExternalEmail = (candidate?: string | null): string | undefined => {
    const norm = normalizeEmail(candidate);
    if (!norm) return undefined;
    if (role === 'student' && isInternalStudentAuthEmail(norm)) return undefined;
    return norm;
  };

  if (!linkedAuthId && !profile && !authUser) {
    const recEmail = safeExternalEmail(record.email);
    return {
      role,
      recordId: record.id,
      email: recEmail,
      loginIdentifier: studentLoginId || recEmail,
      status: 'not_created',
      mustChangePassword: false,
      needsRepair: false,
      source: 'edge_function',
    };
  }

  const hasCompleteTriplet =
    Boolean(record.auth_user_id) &&
    Boolean(profile) &&
    Boolean(authUser) &&
    record.auth_user_id === profile!.auth_user_id &&
    record.auth_user_id === authUser!.id;

  if (!authUser) {
    const fallbackEmail = safeExternalEmail(profile?.email) || safeExternalEmail(record.email);
    return {
      role,
      recordId: record.id,
      authUserId: linkedAuthId,
      email: fallbackEmail,
      loginIdentifier: studentLoginId || fallbackEmail,
      status: 'not_created',
      mustChangePassword: false,
      needsRepair: Boolean(linkedAuthId || profile),
      source: 'edge_function',
    };
  }

  const isDisabled =
    (profile ? !profile.is_active : false) ||
    isAuthUserBanned(authUser, nowMs) ||
    (role === 'student' && record.status === 'Suspended') ||
    (role === 'teacher' && record.status === 'Inactive');

  const isConfirmed = Boolean(authUser.email_confirmed_at || authUser.confirmed_at);
  const isInvitePending =
    !isDisabled &&
    !isConfirmed &&
    (Boolean(authUser.invited_at) || profile?.account_status === 'invitation_pending');

  const status: AccountStatus = isDisabled
    ? 'disabled'
    : isInvitePending
      ? 'invitation_pending'
      : 'active';

  const mustChangePassword =
    role === 'student'
      ? false
      : Boolean(
          profile?.must_change_password === true ||
            authUser.user_metadata?.must_change_password === true
        );

  const resolvedEmail =
    safeExternalEmail(authUser.email) ||
    safeExternalEmail(profile?.email) ||
    safeExternalEmail(record.email);

  return {
    role,
    recordId: record.id,
    authUserId: authUser.id,
    email: resolvedEmail,
    loginIdentifier: studentLoginId || resolvedEmail,
    status,
    mustChangePassword,
    invitedAt: profile?.invited_at || authUser.invited_at || undefined,
    lastSignInAt: authUser.last_sign_in_at || undefined,
    needsRepair: !hasCompleteTriplet,
    source: 'edge_function',
  };
}

function isRecoverablePartialAuthUser(
  authUser: AuthUserRecord,
  role: ProvisionableRole,
  recordId: string,
  record: DirectoryRecord,
  existingProfileForAuth: ProfileRow | null
): boolean {
  // Never touch an admin account or a profile belonging to another role/record
  if (existingProfileForAuth) {
    if (existingProfileForAuth.role === 'admin') return false;
    if (existingProfileForAuth.role !== role || existingProfileForAuth.reference_id !== recordId) {
      return false;
    }
    return true;
  }

  if (record.auth_user_id && record.auth_user_id === authUser.id) {
    return true;
  }

  const metaRole = authUser.app_metadata?.provisioned_for_role;
  const metaRecordId = authUser.app_metadata?.provisioned_record_id;
  if (metaRole === role && metaRecordId === recordId) {
    return true;
  }

  return false;
}

export async function handleProvisioningRequest(
  args: {
    authHeader: string | null;
    body: Record<string, unknown>;
    allowedRedirectOrigins?: string;
  },
  adapter: ProvisioningBackendAdapter
): Promise<CoreHttpResult> {
  // 1. Verify Bearer JWT
  const authHeader = args.authHeader?.trim() || '';
  if (!authHeader.toLowerCase().startsWith('bearer ')) {
    return {
      status: 401,
      body: { ok: false, code: 'missing_auth', error: 'Missing or invalid Authorization header.' },
    };
  }
  const jwt = authHeader.slice(7).trim();
  if (!jwt) {
    return {
      status: 401,
      body: { ok: false, code: 'missing_auth', error: 'Authentication token is required.' },
    };
  }

  const callerLookup = await adapter.getCallerFromJwt(jwt);
  if (!callerLookup.user) {
    return {
      status: 401,
      body: {
        ok: false,
        code: 'invalid_jwt',
        error: 'Your session token is invalid or expired. Please sign in again.',
      },
    };
  }

  // 2. Verify Administrator role strictly from trusted database state (public.user_profiles)
  const callerProfile = await adapter.getProfileByAuthUserId(callerLookup.user.id);
  if (!callerProfile || callerProfile.role !== 'admin' || !callerProfile.is_active) {
    return {
      status: 403,
      body: {
        ok: false,
        code: 'admin_required',
        error: 'Administrator privileges are required to manage portal authentication accounts.',
      },
    };
  }

  const action = typeof args.body?.action === 'string' ? args.body.action.trim() : '';

  // --------------------------------------------------------------------------
  // ACTION: list_statuses
  // --------------------------------------------------------------------------
  if (action === 'list_statuses') {
    const requestedRolesRaw = Array.isArray(args.body.roles)
      ? args.body.roles
      : ['student', 'teacher', 'parent'];
    const roles: ProvisionableRole[] = [];
    for (const r of requestedRolesRaw) {
      if (isProvisionableRole(r) && !roles.includes(r)) {
        roles.push(r);
      }
    }
    if (roles.length === 0) {
      roles.push('student', 'teacher', 'parent');
    }

    const [profiles, authUsers, roleLists] = await Promise.all([
      adapter.listNonAdminProfiles(),
      adapter.listAllAuthUsers(),
      Promise.all(
        roles.map(async (role) => ({ role, records: await adapter.listDirectoryRecords(role) }))
      ),
    ]);

    const authById = new Map<string, AuthUserRecord>(authUsers.map((u) => [u.id, u]));
    const profileByAuthId = new Map<string, ProfileRow>(profiles.map((p) => [p.auth_user_id, p]));
    const profileByRoleRef = new Map<string, ProfileRow>();
    for (const p of profiles) {
      if (isProvisionableRole(p.role) && p.reference_id) {
        profileByRoleRef.set(`${p.role}:${p.reference_id}`, p);
      }
    }

    const items: ServerAccountStatusItem[] = [];
    for (const { role, records } of roleLists) {
      for (const rec of records) {
        const profile =
          (rec.auth_user_id ? profileByAuthId.get(rec.auth_user_id) : undefined) ||
          profileByRoleRef.get(`${role}:${rec.id}`) ||
          null;
        const authId = rec.auth_user_id || profile?.auth_user_id || null;
        const authUser = authId ? authById.get(authId) ?? null : null;
        items.push(deriveAuthoritativeStatus(rec, profile, authUser, role));
      }
    }

    return {
      status: 200,
      body: { ok: true, statuses: items },
    };
  }

  // Validate target role & recordId for all record-targeted actions
  const rawRole = args.body?.role;
  if (!isProvisionableRole(rawRole)) {
    return {
      status: 400,
      body: {
        ok: false,
        code: 'invalid_role',
        error:
          'Target role must be "student", "teacher", or "parent". Administrator role elevation is prohibited.',
      },
    };
  }
  const role: ProvisionableRole = rawRole;

  const recordId = typeof args.body?.recordId === 'string' ? args.body.recordId.trim() : '';
  if (!recordId) {
    return {
      status: 400,
      body: { ok: false, code: 'missing_record_id', error: 'A valid target recordId is required.' },
    };
  }

  const record = await adapter.getDirectoryRecord(role, recordId);
  if (!record) {
    return {
      status: 404,
      body: {
        ok: false,
        code: 'record_not_found',
        error: `No ${role} record was found for ID "${recordId}". Save the school record before provisioning a login account.`,
      },
    };
  }

  // --------------------------------------------------------------------------
  // ACTION: provision_account (idempotent, rollback-safe, no password in responses)
  // --------------------------------------------------------------------------
  if (action === 'provision_account') {
    const requestedMode = args.body?.mode;
    const mode: ProvisionMode =
      role === 'student'
        ? 'admin_password'
        : requestedMode === 'invite'
          ? 'invite'
          : 'admin_password';

    if (role === 'student' && requestedMode === 'invite') {
      return {
        status: 400,
        body: {
          ok: false,
          code: 'student_password_required',
          error:
            'Student accounts are provisioned with an administrator-assigned password and Admission Number login.',
        },
      };
    }

    let authEmail: string;
    let externalEmailToStore: string | null = null;
    let displayLoginIdentifier: string;

    if (role === 'student') {
      if (!record.admissionNo || !record.admissionNo.trim()) {
        return {
          status: 400,
          body: {
            ok: false,
            code: 'missing_admission_no',
            error: 'Student record must have a valid Admission Number before creating a login account.',
          },
        };
      }
      // Internal non-deliverable Auth identifier strictly for Supabase Auth storage.
      // Preserves student's optional contact email (or NULL) without requiring personal email.
      authEmail = buildInternalStudentAuthEmail(record.id);
      externalEmailToStore = null; // Do not overwrite students.email with internal identifier
      displayLoginIdentifier = record.admissionNo.trim().toUpperCase();
    } else {
      const normalized = normalizeEmail(args.body?.email || record.email);
      if (!isValidExternalEmail(normalized)) {
        return {
          status: 400,
          body: {
            ok: false,
            code: 'invalid_email',
            error: 'A valid, unique email address is required to create a staff or parent login account.',
          },
        };
      }
      authEmail = normalized;
      externalEmailToStore = normalized;
      displayLoginIdentifier = normalized;
    }

    const redirectTo = sanitizeRedirectUrl(args.body?.redirectTo, args.allowedRedirectOrigins);

    let assignedPassword: string | undefined;
    if (mode === 'admin_password') {
      const supplied = typeof args.body?.password === 'string' ? args.body.password : '';
      const pwdErr = validateAssignedPassword(supplied);
      if (pwdErr) {
        return {
          status: 400,
          body: { ok: false, code: 'weak_password', error: pwdErr },
        };
      }
      assignedPassword = supplied;
    }

    const mustChangePassword =
      role === 'student'
        ? false
        : mode === 'invite'
          ? true
          : typeof args.body?.mustChangePassword === 'boolean'
            ? args.body.mustChangePassword
            : true;

    // Check cross-directory email conflict for external emails (teachers / parents)
    if (externalEmailToStore) {
      const directoryConflict = await adapter.findDirectoryEmailConflict(
        externalEmailToStore,
        role,
        recordId
      );
      if (directoryConflict) {
        return {
          status: 409,
          body: {
            ok: false,
            code: 'duplicate_email',
            error: `Email "${externalEmailToStore}" is already assigned to another ${directoryConflict.role} record.`,
          },
        };
      }
    }

    // Check existing profile by authEmail
    const existingProfileByEmail = await adapter.getProfileByEmail(authEmail);
    if (
      existingProfileByEmail &&
      (existingProfileByEmail.role !== role || existingProfileByEmail.reference_id !== recordId)
    ) {
      return {
        status: 409,
        body: {
          ok: false,
          code: 'duplicate_email',
          error:
            role === 'student'
              ? 'An authentication identity conflict was detected for this student record.'
              : `Email "${authEmail}" is already linked to another portal account.`,
        },
      };
    }

    // Check existing profile / auth link for this target record
    const existingProfileByRef = await adapter.getProfileByRoleAndReference(role, recordId);
    const existingRecordAuth = record.auth_user_id
      ? await adapter.getAuthUserById(record.auth_user_id)
      : null;

    if (
      record.auth_user_id &&
      existingRecordAuth &&
      existingProfileByRef &&
      existingProfileByRef.auth_user_id === record.auth_user_id
    ) {
      return {
        status: 409,
        body: {
          ok: false,
          code: 'already_provisioned',
          error:
            'A Supabase login account is already linked to this record. Use "Manage Access & Password" to assign a new password or update status.',
        },
      };
    }

    // Check whether an Auth user already exists with authEmail
    const existingAuthByEmail = await adapter.findAuthUserByEmail(authEmail);
    let authUserToLink: AuthUserRecord | null = null;
    let newlyCreatedAuthUser = false;
    let recoveredPartialAccount = false;

    if (existingRecordAuth) {
      const profForAuth = await adapter.getProfileByAuthUserId(existingRecordAuth.id);
      if (!isRecoverablePartialAuthUser(existingRecordAuth, role, recordId, record, profForAuth)) {
        return {
          status: 409,
          body: {
            ok: false,
            code: 'mismatched_link',
            error:
              'This record references an authentication identity linked to a different profile. Contact system support to audit the link.',
          },
        };
      }
      authUserToLink = existingRecordAuth;
      recoveredPartialAccount = true;
    } else if (existingProfileByRef) {
      const profAuthUser = await adapter.getAuthUserById(existingProfileByRef.auth_user_id);
      if (profAuthUser) {
        authUserToLink = profAuthUser;
        recoveredPartialAccount = true;
      }
    }

    if (existingAuthByEmail) {
      if (authUserToLink && authUserToLink.id !== existingAuthByEmail.id) {
        return {
          status: 409,
          body: {
            ok: false,
            code: 'duplicate_email',
            error:
              role === 'student'
                ? 'This student account identity conflicts with an existing authentication record.'
                : `Email "${authEmail}" already belongs to another Supabase Authentication account.`,
          },
        };
      }
      const profForEmailAuth = await adapter.getProfileByAuthUserId(existingAuthByEmail.id);
      if (!isRecoverablePartialAuthUser(existingAuthByEmail, role, recordId, record, profForEmailAuth)) {
        return {
          status: 409,
          body: {
            ok: false,
            code: 'duplicate_email',
            error:
              role === 'student'
                ? 'This student account identity conflicts with an existing authentication record.'
                : `Email "${authEmail}" is already registered to another Supabase Authentication account.`,
          },
        };
      }
      authUserToLink = existingAuthByEmail;
      recoveredPartialAccount = true;
    }

    const nowIso = new Date().toISOString();
    const baseUserMetadata: Record<string, unknown> = {
      full_name: record.fullName,
      portal_role: role,
      must_change_password: mustChangePassword,
      ...(role === 'student' && record.admissionNo
        ? { admission_no: record.admissionNo.trim().toUpperCase() }
        : {}),
    };
    const baseAppMetadata: Record<string, unknown> = {
      portal_role: role,
      provisioned_for_role: role,
      provisioned_record_id: recordId,
    };

    if (!authUserToLink) {
      if (mode === 'invite') {
        const inviteRes = await adapter.inviteAuthUserByEmail({
          email: authEmail,
          redirectTo,
          userMetadata: baseUserMetadata,
        });
        if (!inviteRes.user) {
          return {
            status: 400,
            body: {
              ok: false,
              code: 'auth_invite_failed',
              error: inviteRes.error || 'Could not send Supabase account setup invitation.',
            },
          };
        }
        authUserToLink = inviteRes.user;
        newlyCreatedAuthUser = true;
        await adapter.updateAuthUserById(authUserToLink.id, {
          app_metadata: baseAppMetadata,
        });
      } else {
        const createRes = await adapter.createAuthUserWithPassword({
          email: authEmail,
          password: assignedPassword!,
          userMetadata: baseUserMetadata,
          appMetadata: baseAppMetadata,
        });
        if (!createRes.user) {
          return {
            status: 400,
            body: {
              ok: false,
              code: 'auth_create_failed',
              error: createRes.error || 'Could not create Supabase Authentication account.',
            },
          };
        }
        authUserToLink = createRes.user;
        newlyCreatedAuthUser = true;
      }
    } else if (recoveredPartialAccount) {
      if (mode === 'admin_password') {
        const upd = await adapter.updateAuthUserById(authUserToLink.id, {
          email: authUserToLink.email || authEmail,
          password: assignedPassword!,
          email_confirm: true,
          user_metadata: baseUserMetadata,
          app_metadata: baseAppMetadata,
        });
        if (upd.user) authUserToLink = upd.user;
      } else if (mode === 'invite' && !authUserToLink.email_confirmed_at && !authUserToLink.confirmed_at) {
        await adapter.inviteAuthUserByEmail({
          email: authEmail,
          redirectTo,
          userMetadata: baseUserMetadata,
        });
      }
    }

    const finalAuthEmail = normalizeEmail(authUserToLink.email) || authEmail;
    const accountStatus: Exclude<AccountStatus, 'not_created'> =
      mode === 'invite' && !authUserToLink.email_confirmed_at && !authUserToLink.confirmed_at
        ? 'invitation_pending'
        : 'active';

    // Step 2: Upsert public.user_profiles
    const profileUpsert = await adapter.upsertUserProfile({
      authUserId: authUserToLink.id,
      role,
      referenceId: recordId,
      email: finalAuthEmail,
      fullName: record.fullName,
      isActive: true,
      accountStatus,
      mustChangePassword: mode === 'invite' ? accountStatus === 'invitation_pending' : mustChangePassword,
      invitedAt: mode === 'invite' ? nowIso : null,
      activatedAt: accountStatus === 'active' ? nowIso : null,
    });

    if (!profileUpsert.ok) {
      if (newlyCreatedAuthUser) {
        await adapter.deleteAuthUser(authUserToLink.id);
      }
      return {
        status: 500,
        body: {
          ok: false,
          code: 'profile_link_failed',
          error:
            profileUpsert.error ||
            'Failed to link user profile in Supabase. Rolled back newly created Auth user; you may safely retry.',
        },
      };
    }

    // Step 3: Link auth_user_id (and external email for staff/parents only) onto school record
    const recordLink = await adapter.linkDirectoryRecordAuthUser(
      role,
      recordId,
      authUserToLink.id,
      externalEmailToStore
    );

    if (!recordLink.ok) {
      if (newlyCreatedAuthUser) {
        await adapter.deleteUserProfile(authUserToLink.id);
        await adapter.deleteAuthUser(authUserToLink.id);
      }
      return {
        status: 500,
        body: {
          ok: false,
          code: 'record_link_failed',
          error:
            recordLink.error ||
            `Failed to save Auth UID on ${role} record. Changes were rolled back safely; you may retry.`,
        },
      };
    }

    // SECURITY: Never return any password value in the HTTP response.
    return {
      status: 200,
      body: {
        ok: true,
        status: accountStatus,
        authUserId: authUserToLink.id,
        ...(externalEmailToStore ? { email: externalEmailToStore } : {}),
        loginIdentifier: displayLoginIdentifier,
        mode,
        recoveredPartialAccount,
        message:
          mode === 'invite'
            ? `Account setup invitation sent to ${displayLoginIdentifier}. Status is now Invitation pending until confirmed.`
            : role === 'student'
              ? `Student login account created and activated for Admission Number ${displayLoginIdentifier}.`
              : `Portal login account created and activated for ${displayLoginIdentifier}.`,
      },
    };
  }

  // Resolve linked Auth user & profile for post-provisioning actions
  const profileByRef = await adapter.getProfileByRoleAndReference(role, recordId);
  const linkedAuthId = record.auth_user_id || profileByRef?.auth_user_id || null;
  if (!linkedAuthId) {
    return {
      status: 400,
      body: {
        ok: false,
        code: 'account_not_created',
        error: 'No Supabase login account exists for this record yet. Click "Create Login Account" first.',
      },
    };
  }

  const linkedProfile =
    (await adapter.getProfileByAuthUserId(linkedAuthId)) || profileByRef;
  if (linkedProfile && linkedProfile.role === 'admin') {
    return {
      status: 403,
      body: {
        ok: false,
        code: 'admin_protected',
        error: 'Administrator accounts cannot be modified through student/staff provisioning actions.',
      },
    };
  }

  const linkedAuthUser = await adapter.getAuthUserById(linkedAuthId);
  if (!linkedAuthUser) {
    return {
      status: 404,
      body: {
        ok: false,
        code: 'auth_user_missing',
        error:
          'Linked Supabase Auth identity was not found. Use "Create Login Account" to repair and re-link this record.',
      },
    };
  }

  const linkedAuthEmail = normalizeEmail(
    linkedAuthUser.email || linkedProfile?.email || record.email
  );
  const safeDisplayIdentifier =
    role === 'student'
      ? record.admissionNo?.trim().toUpperCase() || record.id
      : linkedAuthEmail;
  const safeExternalLinkedEmail =
    role === 'student' && isInternalStudentAuthEmail(linkedAuthEmail)
      ? undefined
      : linkedAuthEmail || undefined;

  // --------------------------------------------------------------------------
  // ACTION: assign_password (authorized administrator-only password replacement)
  // --------------------------------------------------------------------------
  if (action === 'assign_password') {
    if ((linkedProfile && !linkedProfile.is_active) || isAuthUserBanned(linkedAuthUser)) {
      return {
        status: 400,
        body: {
          ok: false,
          code: 'account_disabled',
          error: 'This account is currently disabled. Reactivate it before assigning a new password.',
        },
      };
    }

    const newPassword = typeof args.body?.password === 'string' ? args.body.password : '';
    const pwdErr = validateAssignedPassword(newPassword);
    if (pwdErr) {
      return {
        status: 400,
        body: { ok: false, code: 'weak_password', error: pwdErr },
      };
    }

    const mustChangePassword =
      role === 'student'
        ? false
        : typeof args.body?.mustChangePassword === 'boolean'
          ? args.body.mustChangePassword
          : true;

    const existingUserMeta =
      linkedAuthUser.user_metadata && typeof linkedAuthUser.user_metadata === 'object'
        ? linkedAuthUser.user_metadata
        : {};

    const authUpdate = await adapter.updateAuthUserById(linkedAuthUser.id, {
      password: newPassword,
      email_confirm: true,
      user_metadata: {
        ...existingUserMeta,
        full_name: record.fullName,
        portal_role: role,
        must_change_password: mustChangePassword,
        ...(role === 'student' && record.admissionNo
          ? { admission_no: record.admissionNo.trim().toUpperCase() }
          : {}),
      },
    });

    if (!authUpdate.user) {
      return {
        status: 500,
        body: {
          ok: false,
          code: 'password_update_failed',
          error: authUpdate.error || 'Could not assign new password in Supabase Authentication.',
        },
      };
    }

    const profileRes = await adapter.upsertUserProfile({
      authUserId: linkedAuthUser.id,
      role,
      referenceId: recordId,
      email: linkedAuthEmail,
      fullName: record.fullName,
      isActive: true,
      accountStatus: 'active',
      mustChangePassword,
      invitedAt: linkedProfile?.invited_at ?? authUpdate.user.invited_at ?? null,
      activatedAt: linkedProfile?.activated_at ?? new Date().toISOString(),
    });

    if (!profileRes.ok) {
      return {
        status: 500,
        body: {
          ok: false,
          code: 'profile_status_update_failed',
          error: profileRes.error || 'Password updated, but profile metadata sync failed.',
        },
      };
    }

    // SECURITY: Never return the assigned password in the HTTP response.
    return {
      status: 200,
      body: {
        ok: true,
        status: 'active',
        authUserId: linkedAuthUser.id,
        ...(safeExternalLinkedEmail ? { email: safeExternalLinkedEmail } : {}),
        loginIdentifier: safeDisplayIdentifier,
        message: `A new password has been securely assigned in Supabase Auth for ${safeDisplayIdentifier}.`,
      },
    };
  }

  // --------------------------------------------------------------------------
  // ACTION: resend_invite (teachers & parents only when invitation_pending)
  // --------------------------------------------------------------------------
  if (action === 'resend_invite') {
    if (role === 'student') {
      return {
        status: 400,
        body: {
          ok: false,
          code: 'invite_not_supported_for_student',
          error: 'Student accounts use Admission Number + administrator-assigned password.',
        },
      };
    }
    if (linkedAuthUser.email_confirmed_at || linkedAuthUser.confirmed_at) {
      return {
        status: 400,
        body: {
          ok: false,
          code: 'already_confirmed',
          error: 'This account is already confirmed and active. Use "Assign New Password" if needed.',
        },
      };
    }
    if (!isValidExternalEmail(linkedAuthEmail)) {
      return {
        status: 400,
        body: {
          ok: false,
          code: 'invalid_email',
          error: 'Linked account does not have a valid email address.',
        },
      };
    }
    const redirectTo = sanitizeRedirectUrl(args.body?.redirectTo, args.allowedRedirectOrigins);
    const inviteRes = await adapter.inviteAuthUserByEmail({
      email: linkedAuthEmail,
      redirectTo,
      userMetadata: {
        full_name: record.fullName,
        portal_role: role,
        must_change_password: true,
      },
    });
    if (!inviteRes.user) {
      return {
        status: 400,
        body: {
          ok: false,
          code: 'resend_invite_failed',
          error: inviteRes.error || 'Could not resend account setup invitation.',
        },
      };
    }

    await adapter.upsertUserProfile({
      authUserId: linkedAuthUser.id,
      role,
      referenceId: recordId,
      email: linkedAuthEmail,
      fullName: record.fullName,
      isActive: true,
      accountStatus: 'invitation_pending',
      mustChangePassword: true,
      invitedAt: new Date().toISOString(),
    });

    return {
      status: 200,
      body: {
        ok: true,
        status: 'invitation_pending',
        authUserId: linkedAuthUser.id,
        email: linkedAuthEmail,
        loginIdentifier: linkedAuthEmail,
        message: `Setup invitation re-sent to ${linkedAuthEmail}.`,
      },
    };
  }

  // --------------------------------------------------------------------------
  // ACTION: set_account_status (disable / reactivate)
  // --------------------------------------------------------------------------
  if (action === 'set_account_status') {
    if (typeof args.body?.enabled !== 'boolean') {
      return {
        status: 400,
        body: { ok: false, code: 'invalid_enabled', error: 'Boolean "enabled" flag is required.' },
      };
    }
    const enabled = args.body.enabled;

    const authUpdate = await adapter.updateAuthUserById(linkedAuthUser.id, {
      ban_duration: enabled ? 'none' : '876000h',
    });
    if (!authUpdate.user) {
      return {
        status: 500,
        body: {
          ok: false,
          code: 'auth_status_update_failed',
          error: authUpdate.error || 'Could not update Supabase Auth status for this account.',
        },
      };
    }

    const isConfirmed = Boolean(authUpdate.user.email_confirmed_at || authUpdate.user.confirmed_at);
    const nextStatus: Exclude<AccountStatus, 'not_created'> = !enabled
      ? 'disabled'
      : !isConfirmed && authUpdate.user.invited_at
        ? 'invitation_pending'
        : 'active';

    const profileRes = await adapter.upsertUserProfile({
      authUserId: linkedAuthUser.id,
      role,
      referenceId: recordId,
      email: linkedAuthEmail,
      fullName: record.fullName,
      isActive: enabled,
      accountStatus: nextStatus,
      mustChangePassword: Boolean(linkedProfile?.must_change_password),
      invitedAt: linkedProfile?.invited_at ?? authUpdate.user.invited_at ?? null,
      activatedAt:
        nextStatus === 'active' ? linkedProfile?.activated_at ?? new Date().toISOString() : null,
    });

    if (!profileRes.ok) {
      return {
        status: 500,
        body: {
          ok: false,
          code: 'profile_status_update_failed',
          error: profileRes.error || 'Auth ban state changed, but profile status update failed.',
        },
      };
    }

    return {
      status: 200,
      body: {
        ok: true,
        status: nextStatus,
        authUserId: linkedAuthUser.id,
        ...(safeExternalLinkedEmail ? { email: safeExternalLinkedEmail } : {}),
        loginIdentifier: safeDisplayIdentifier,
        message: enabled
          ? `Login account for ${safeDisplayIdentifier} has been reactivated.`
          : `Login account for ${safeDisplayIdentifier} has been disabled.`,
      },
    };
  }

  return {
    status: 400,
    body: {
      ok: false,
      code: 'unknown_action',
      error: `Unsupported provisioning action "${action}".`,
    },
  };
}
