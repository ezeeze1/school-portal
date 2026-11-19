/**
 * Divine Academy Secondary School Portal
 * Supabase Edge Function: admin-account-provisioning (Self-Contained Single File)
 *
 * Designed for direct deployment via BOTH:
 *   - Supabase Dashboard -> Edge Functions -> Deploy a new function -> Via Editor
 *   - Supabase CLI (`npx supabase functions deploy admin-account-provisioning`)
 *
 * Security guarantees enforced strictly on the server:
 *  1. Caller Authorization Bearer JWT must validate via Supabase Auth (`auth.getUser(jwt)`)
 *     and the caller must not be banned in Supabase Auth.
 *  2. Caller role is verified strictly from trusted database state (`public.user_profiles`
 *     where `role = 'admin'` AND `is_active = true`).
 *  3. Target role is strictly constrained to `'student' | 'teacher' | 'parent'`.
 *     Administrator creation, role elevation, and modification of admin or caller accounts
 *     are unconditionally blocked.
 *  4. Passwords are handled ONLY by Supabase Admin Auth APIs; NEVER written to school
 *     directory tables, NEVER logged, and NEVER returned in HTTP responses.
 *  5. Students use Admission Number + administrator-assigned password login via the
 *     companion `student-auth-login` function. A deterministic non-deliverable Auth
 *     identifier (`std.<recordId>@students.divineacademy.internal`) is used strictly
 *     inside Supabase Auth / `public.user_profiles` and is never written to
 *     `public.students.email` or exposed in responses.
 *  6. Duplicate accounts, duplicate emails (with safe LIKE wildcard escaping + exact
 *     case-insensitive comparison), and cross-record link mismatches are blocked.
 *  7. Partial failures trigger compensating rollback or metadata-verified idempotent
 *     recovery, and every response carries `Cache-Control: no-store`.
 */

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

// ============================================================================
// 1. CORS & ENVIRONMENT HELPERS
// ============================================================================

const ALLOWED_CORS_HEADERS =
  'authorization, x-client-info, apikey, content-type, x-supabase-api-version, x-retry-count, x-region, traceparent, tracestate, baggage';

function buildCorsHeaders(
  requestOrigin: string | null,
  allowedOriginsRaw?: string
): Record<string, string> {
  const allowedList = (allowedOriginsRaw ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  let allowOrigin = '*';
  if (allowedList.length > 0) {
    if (requestOrigin && allowedList.includes(requestOrigin)) {
      allowOrigin = requestOrigin;
    } else {
      allowOrigin = allowedList[0];
    }
  } else if (requestOrigin) {
    allowOrigin = requestOrigin;
  }

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': ALLOWED_CORS_HEADERS,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

function resolveServiceRoleKey(): string {
  const direct =
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SB_SECRET_KEY') ?? '';
  if (direct.trim()) return direct.trim();

  const secretKeysJson = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (secretKeysJson) {
    try {
      const parsed = JSON.parse(secretKeysJson) as Record<string, unknown>;
      const firstSecret = Object.values(parsed).find(
        (val): val is string => typeof val === 'string' && val.trim().length > 0
      );
      if (firstSecret) return firstSecret.trim();
    } catch {
      // Ignore malformed optional dictionary
    }
  }
  return '';
}

function escapeLikePattern(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

function jsonResponse(
  status: number,
  body: Record<string, unknown>,
  corsHeaders: Record<string, string>
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

// ============================================================================
// 2. TYPES & DOMAIN VALIDATORS
// ============================================================================

type ProvisionableRole = 'student' | 'teacher' | 'parent';
type AccountStatus = 'not_created' | 'invitation_pending' | 'active' | 'disabled';
type ProvisionMode = 'admin_password' | 'invite';

const INTERNAL_STUDENT_AUTH_DOMAIN = 'students.divineacademy.internal';
const VALID_ROLES = new Set<ProvisionableRole>(['student', 'teacher', 'parent']);
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

interface AuthUserRecord {
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

interface ProfileRow {
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

interface DirectoryRecord {
  id: string;
  auth_user_id: string | null;
  email: string | null;
  fullName: string;
  admissionNo?: string | null;
  status?: string | null;
}

interface ServerAccountStatusItem {
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

interface ProfileLookupResult {
  profile: ProfileRow | null;
  ambiguousDuplicate?: boolean;
}

interface CoreHttpResult {
  status: number;
  body: Record<string, unknown>;
}

interface ProvisioningBackendAdapter {
  getCallerFromJwt(jwt: string): Promise<{ user: AuthUserRecord | null; error?: string }>;
  getProfileByAuthUserId(authUserId: string): Promise<ProfileRow | null>;
  getProfileByRoleAndReference(
    role: ProvisionableRole,
    recordId: string
  ): Promise<ProfileLookupResult>;
  getProfileByEmail(normalizedEmail: string): Promise<ProfileLookupResult>;
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

function isProvisionableRole(value: unknown): value is ProvisionableRole {
  return typeof value === 'string' && VALID_ROLES.has(value as ProvisionableRole);
}

function normalizeEmail(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim().toLowerCase() : '';
}

function isInternalStudentAuthEmail(raw: unknown): boolean {
  const cleaned = normalizeEmail(raw);
  return cleaned.endsWith(`@${INTERNAL_STUDENT_AUTH_DOMAIN}`);
}

function isValidExternalEmail(email: string): boolean {
  return (
    Boolean(email) &&
    email.length <= 254 &&
    !isInternalStudentAuthEmail(email) &&
    EMAIL_REGEX.test(email)
  );
}

function buildInternalStudentAuthEmail(studentRecordId: string): string {
  const safeSlug = studentRecordId
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  const localPart = safeSlug ? `std.${safeSlug}` : `std.${Date.now()}`;
  return `${localPart}@${INTERNAL_STUDENT_AUTH_DOMAIN}`;
}

function sanitizeRedirectUrl(raw: unknown, allowedOriginsRaw?: string): string | undefined {
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

function validateAssignedPassword(password: string): string | null {
  if (password.length < 8) return 'Password must be at least 8 characters long.';
  if (password.length > 128) return 'Password must not exceed 128 characters.';
  if (!/[A-Z]/.test(password)) return 'Password must include at least one uppercase letter.';
  if (!/[a-z]/.test(password)) return 'Password must include at least one lowercase letter.';
  if (!/[0-9]/.test(password)) return 'Password must include at least one number.';
  return null;
}

function isAuthUserBanned(authUser: AuthUserRecord | null | undefined, nowMs = Date.now()): boolean {
  if (!authUser?.banned_until) return false;
  const bannedUntilMs = Date.parse(authUser.banned_until);
  return Number.isFinite(bannedUntilMs) && bannedUntilMs > nowMs;
}

function isProtectedAdminAuthUser(
  authUser: AuthUserRecord | null | undefined,
  profile: ProfileRow | null | undefined,
  callerAuthUserId: string
): boolean {
  if (profile?.role === 'admin') return true;
  if (!authUser) return false;
  if (authUser.id === callerAuthUserId) return true;
  if (authUser.app_metadata?.portal_role === 'admin') return true;
  if (authUser.app_metadata?.role === 'admin') return true;
  return false;
}

function deriveAuthoritativeStatus(
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
  existingProfileForAuth: ProfileRow | null,
  callerAuthUserId: string
): boolean {
  // Never touch an admin account, the caller's own account, or a profile owned by another user/record
  if (isProtectedAdminAuthUser(authUser, existingProfileForAuth, callerAuthUserId)) {
    return false;
  }

  if (existingProfileForAuth) {
    if (existingProfileForAuth.role !== role || existingProfileForAuth.reference_id !== recordId) {
      return false;
    }
    return true;
  }

  if (record.auth_user_id && record.auth_user_id === authUser.id) {
    const metaRecordId = authUser.app_metadata?.provisioned_record_id;
    const metaRole = authUser.app_metadata?.provisioned_for_role;
    if (metaRecordId && (metaRecordId !== recordId || (metaRole && metaRole !== role))) {
      return false;
    }
    return true;
  }

  const metaRole = authUser.app_metadata?.provisioned_for_role;
  const metaRecordId = authUser.app_metadata?.provisioned_record_id;
  if (metaRole === role && metaRecordId === recordId) {
    return true;
  }

  return false;
}

// ============================================================================
// 3. CORE PROVISIONING REQUEST HANDLER
// ============================================================================

async function handleProvisioningRequest(
  args: {
    authHeader: string | null;
    body: Record<string, unknown>;
    allowedRedirectOrigins?: string;
  },
  adapter: ProvisioningBackendAdapter
): Promise<CoreHttpResult> {
  // 1. Verify Bearer JWT via Supabase Auth (signature, expiry, revocation, ban state)
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
  if (!callerLookup.user || isAuthUserBanned(callerLookup.user)) {
    return {
      status: 401,
      body: {
        ok: false,
        code: 'invalid_jwt',
        error: 'Your session token is invalid, expired, or suspended. Please sign in again.',
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

  const callerAuthUserId = callerLookup.user.id;
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
      authEmail = buildInternalStudentAuthEmail(record.id);
      externalEmailToStore = null; // Never overwrite students.email with internal identifier
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

    // Students NEVER self-manage passwords; only authorized administrators set/replace them.
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

    // Check existing profile by authEmail (fail closed on duplicates)
    const emailProfileLookup = await adapter.getProfileByEmail(authEmail);
    if (emailProfileLookup.ambiguousDuplicate) {
      return {
        status: 409,
        body: {
          ok: false,
          code: 'duplicate_email',
          error: 'Multiple user profiles share this login identity. Audit user_profiles before continuing.',
        },
      };
    }
    const existingProfileByEmail = emailProfileLookup.profile;
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
    const refProfileLookup = await adapter.getProfileByRoleAndReference(role, recordId);
    if (refProfileLookup.ambiguousDuplicate) {
      return {
        status: 409,
        body: {
          ok: false,
          code: 'duplicate_profile_link',
          error: 'Multiple user_profiles rows reference this record. Audit user_profiles before continuing.',
        },
      };
    }
    const existingProfileByRef = refProfileLookup.profile;
    const existingRecordAuth = record.auth_user_id
      ? await adapter.getAuthUserById(record.auth_user_id)
      : null;

    if (
      record.auth_user_id &&
      existingProfileByRef &&
      existingProfileByRef.auth_user_id !== record.auth_user_id
    ) {
      return {
        status: 409,
        body: {
          ok: false,
          code: 'mismatched_link',
          error:
            'This record has conflicting Auth links between its school row and user_profiles. Audit the link before provisioning.',
        },
      };
    }

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
      if (
        !isRecoverablePartialAuthUser(
          existingRecordAuth,
          role,
          recordId,
          record,
          profForAuth,
          callerAuthUserId
        )
      ) {
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
        if (
          !isRecoverablePartialAuthUser(
            profAuthUser,
            role,
            recordId,
            record,
            existingProfileByRef,
            callerAuthUserId
          )
        ) {
          return {
            status: 409,
            body: {
              ok: false,
              code: 'mismatched_link',
              error:
                'Existing profile references an authentication identity that cannot be linked to this record.',
            },
          };
        }
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
      if (
        !isRecoverablePartialAuthUser(
          existingAuthByEmail,
          role,
          recordId,
          record,
          profForEmailAuth,
          callerAuthUserId
        )
      ) {
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
        const metaSync = await adapter.updateAuthUserById(authUserToLink.id, {
          app_metadata: baseAppMetadata,
        });
        if (!metaSync.user) {
          console.warn('[admin-account-provisioning] Could not stamp app_metadata on invited user.');
        }
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
        if (!upd.user) {
          return {
            status: 500,
            body: {
              ok: false,
              code: 'auth_recovery_update_failed',
              error:
                upd.error ||
                'Could not finalize password and metadata on the existing partial Auth account.',
            },
          };
        }
        authUserToLink = upd.user;
      } else if (mode === 'invite' && !authUserToLink.email_confirmed_at && !authUserToLink.confirmed_at) {
        const inviteRetry = await adapter.inviteAuthUserByEmail({
          email: authEmail,
          redirectTo,
          userMetadata: baseUserMetadata,
        });
        if (!inviteRetry.user) {
          return {
            status: 400,
            body: {
              ok: false,
              code: 'auth_invite_failed',
              error: inviteRetry.error || 'Could not resend invitation while completing partial account.',
            },
          };
        }
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
      mustChangePassword:
        role === 'student'
          ? false
          : mode === 'invite'
            ? accountStatus === 'invitation_pending'
            : mustChangePassword,
      invitedAt: mode === 'invite' ? nowIso : null,
      activatedAt: accountStatus === 'active' ? nowIso : null,
    });

    if (!profileUpsert.ok) {
      if (newlyCreatedAuthUser) {
        try {
          await adapter.deleteAuthUser(authUserToLink.id);
        } catch (rollbackErr) {
          console.error(
            '[admin-account-provisioning] Rollback deleteAuthUser failed:',
            rollbackErr instanceof Error ? rollbackErr.message : 'unknown'
          );
        }
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
        try {
          await adapter.deleteUserProfile(authUserToLink.id);
        } catch (rollbackErr) {
          console.error(
            '[admin-account-provisioning] Rollback deleteUserProfile failed:',
            rollbackErr instanceof Error ? rollbackErr.message : 'unknown'
          );
        }
        try {
          await adapter.deleteAuthUser(authUserToLink.id);
        } catch (rollbackErr) {
          console.error(
            '[admin-account-provisioning] Rollback deleteAuthUser failed:',
            rollbackErr instanceof Error ? rollbackErr.message : 'unknown'
          );
        }
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

    // SECURITY: Never return any password value or internal student Auth email.
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

  // --------------------------------------------------------------------------
  // Resolve & verify linked Auth user + profile for post-provisioning actions
  // --------------------------------------------------------------------------
  const refProfileLookup = await adapter.getProfileByRoleAndReference(role, recordId);
  if (refProfileLookup.ambiguousDuplicate) {
    return {
      status: 409,
      body: {
        ok: false,
        code: 'duplicate_profile_link',
        error: 'Multiple user_profiles rows reference this record. Audit user_profiles before modifying access.',
      },
    };
  }
  const profileByRef = refProfileLookup.profile;

  if (
    record.auth_user_id &&
    profileByRef?.auth_user_id &&
    record.auth_user_id !== profileByRef.auth_user_id
  ) {
    return {
      status: 409,
      body: {
        ok: false,
        code: 'mismatched_link',
        error:
          'This record has conflicting Auth links between its directory row and user_profiles. Audit before modifying credentials.',
      },
    };
  }

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

  const linkedProfile = (await adapter.getProfileByAuthUserId(linkedAuthId)) || profileByRef;
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

  if (
    linkedProfile &&
    (linkedProfile.role !== role ||
      (linkedProfile.reference_id && linkedProfile.reference_id !== recordId))
  ) {
    return {
      status: 409,
      body: {
        ok: false,
        code: 'mismatched_link',
        error:
          'Linked Supabase Auth identity belongs to a different portal profile. Audit the account link before making changes.',
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

  if (isProtectedAdminAuthUser(linkedAuthUser, linkedProfile, callerAuthUserId)) {
    return {
      status: 403,
      body: {
        ok: false,
        code: 'admin_protected',
        error: 'Administrator accounts cannot be modified through student/staff provisioning actions.',
      },
    };
  }

  const metaBoundRecordId = linkedAuthUser.app_metadata?.provisioned_record_id;
  const metaBoundRole = linkedAuthUser.app_metadata?.provisioned_for_role;
  if (
    metaBoundRecordId &&
    (metaBoundRecordId !== recordId || (metaBoundRole && metaBoundRole !== role))
  ) {
    return {
      status: 409,
      body: {
        ok: false,
        code: 'mismatched_link',
        error:
          'Linked Supabase Auth identity metadata points to a different school record. Audit the account link first.',
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

    const profileRes = await adapter.upsertUserProfile({
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
    if (!profileRes.ok) {
      console.warn('[admin-account-provisioning] Profile metadata sync failed after resend_invite.');
    }

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
  // ACTION: set_account_status (disable / reactivate with rollback on failure)
  // --------------------------------------------------------------------------
  if (action === 'set_account_status') {
    if (typeof args.body?.enabled !== 'boolean') {
      return {
        status: 400,
        body: { ok: false, code: 'invalid_enabled', error: 'Boolean "enabled" flag is required.' },
      };
    }
    const enabled = args.body.enabled;
    const wasPreviouslyBanned = isAuthUserBanned(linkedAuthUser);

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
      mustChangePassword:
        role === 'student' ? false : Boolean(linkedProfile?.must_change_password),
      invitedAt: linkedProfile?.invited_at ?? authUpdate.user.invited_at ?? null,
      activatedAt:
        nextStatus === 'active' ? linkedProfile?.activated_at ?? new Date().toISOString() : null,
    });

    if (!profileRes.ok) {
      // Compensating rollback so Auth ban state and user_profiles.is_active stay consistent
      try {
        await adapter.updateAuthUserById(linkedAuthUser.id, {
          ban_duration: wasPreviouslyBanned ? '876000h' : 'none',
        });
      } catch (rollbackErr) {
        console.error(
          '[admin-account-provisioning] Rollback ban_duration failed:',
          rollbackErr instanceof Error ? rollbackErr.message : 'unknown'
        );
      }
      return {
        status: 500,
        body: {
          ok: false,
          code: 'profile_status_update_failed',
          error:
            profileRes.error ||
            'Could not update profile status; Auth status change was reverted.',
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

// ============================================================================
// 4. SUPABASE BACKEND ADAPTER
// ============================================================================

function tableForRole(role: ProvisionableRole): 'students' | 'teachers' | 'parents' {
  if (role === 'student') return 'students';
  if (role === 'teacher') return 'teachers';
  return 'parents';
}

function mapDirectoryRow(role: ProvisionableRole, row: Record<string, unknown>): DirectoryRecord {
  if (role === 'parent') {
    const title = typeof row.title === 'string' ? row.title.trim() : '';
    const full = typeof row.full_name === 'string' ? row.full_name.trim() : '';
    return {
      id: String(row.id),
      auth_user_id: typeof row.auth_user_id === 'string' ? row.auth_user_id : null,
      email: typeof row.email === 'string' ? row.email : null,
      fullName: [title, full].filter(Boolean).join(' ') || 'Parent / Guardian',
      status: 'Active',
    };
  }
  const first = typeof row.first_name === 'string' ? row.first_name.trim() : '';
  const last = typeof row.last_name === 'string' ? row.last_name.trim() : '';
  return {
    id: String(row.id),
    auth_user_id: typeof row.auth_user_id === 'string' ? row.auth_user_id : null,
    email: typeof row.email === 'string' ? row.email : null,
    fullName: [first, last].filter(Boolean).join(' ') || (role === 'student' ? 'Student' : 'Teacher'),
    admissionNo: role === 'student' && typeof row.admission_no === 'string' ? row.admission_no : null,
    status: typeof row.status === 'string' ? row.status : 'Active',
  };
}

function createSupabaseBackendAdapter(adminClient: SupabaseClient): ProvisioningBackendAdapter {
  const listAllAuthUsers = async (): Promise<AuthUserRecord[]> => {
    const users: AuthUserRecord[] = [];
    const perPage = 200;
    const maxPages = 50;
    for (let page = 1; page <= maxPages; page++) {
      const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });
      if (error) {
        console.error('[admin-account-provisioning] listUsers error:', error.message);
        break;
      }
      if (!data?.users) break;
      users.push(...(data.users as unknown as AuthUserRecord[]));
      if (data.users.length < perPage) break;
    }
    return users;
  };

  return {
    async getCallerFromJwt(jwt: string) {
      const { data, error } = await adminClient.auth.getUser(jwt);
      if (error || !data?.user) {
        return { user: null, error: error?.message || 'Invalid JWT.' };
      }
      return { user: data.user as unknown as AuthUserRecord };
    },

    async getProfileByAuthUserId(authUserId: string): Promise<ProfileRow | null> {
      const { data, error } = await adminClient
        .from('user_profiles')
        .select('*')
        .eq('auth_user_id', authUserId)
        .maybeSingle();
      if (error || !data) return null;
      return data as ProfileRow;
    },

    async getProfileByRoleAndReference(
      role: ProvisionableRole,
      recordId: string
    ): Promise<ProfileLookupResult> {
      const { data, error } = await adminClient
        .from('user_profiles')
        .select('*')
        .eq('role', role)
        .eq('reference_id', recordId)
        .limit(2);
      if (error || !Array.isArray(data) || data.length === 0) {
        return { profile: null };
      }
      if (data.length > 1) {
        return { profile: null, ambiguousDuplicate: true };
      }
      return { profile: data[0] as ProfileRow };
    },

    async getProfileByEmail(normalizedEmail: string): Promise<ProfileLookupResult> {
      const { data, error } = await adminClient
        .from('user_profiles')
        .select('*')
        .ilike('email', escapeLikePattern(normalizedEmail))
        .limit(10);
      if (error || !Array.isArray(data)) return { profile: null };
      const exactMatches = (data as ProfileRow[]).filter(
        (row) => normalizeEmail(row.email) === normalizedEmail
      );
      if (exactMatches.length > 1) {
        return { profile: null, ambiguousDuplicate: true };
      }
      return { profile: exactMatches[0] ?? null };
    },

    async listNonAdminProfiles(): Promise<ProfileRow[]> {
      const { data, error } = await adminClient
        .from('user_profiles')
        .select('*')
        .in('role', ['student', 'teacher', 'parent']);
      if (error || !data) return [];
      return data as ProfileRow[];
    },

    async getDirectoryRecord(role: ProvisionableRole, recordId: string): Promise<DirectoryRecord | null> {
      const table = tableForRole(role);
      const selectCols =
        role === 'parent'
          ? 'id, auth_user_id, email, title, full_name'
          : role === 'student'
            ? 'id, auth_user_id, admission_no, email, first_name, last_name, status'
            : 'id, auth_user_id, email, first_name, last_name, status';
      const { data, error } = await adminClient
        .from(table)
        .select(selectCols)
        .eq('id', recordId)
        .maybeSingle();
      if (error || !data) return null;
      return mapDirectoryRow(role, data as unknown as Record<string, unknown>);
    },

    async listDirectoryRecords(role: ProvisionableRole): Promise<DirectoryRecord[]> {
      const table = tableForRole(role);
      const selectCols =
        role === 'parent'
          ? 'id, auth_user_id, email, title, full_name'
          : role === 'student'
            ? 'id, auth_user_id, admission_no, email, first_name, last_name, status'
            : 'id, auth_user_id, email, first_name, last_name, status';
      const { data, error } = await adminClient.from(table).select(selectCols);
      if (error || !data) return [];
      return (data as unknown as Record<string, unknown>[]).map((row) => mapDirectoryRow(role, row));
    },

    async findDirectoryEmailConflict(
      normalizedEmail: string,
      excludeRole: ProvisionableRole,
      excludeRecordId: string
    ) {
      const escaped = escapeLikePattern(normalizedEmail);
      const checks: ProvisionableRole[] = ['student', 'teacher', 'parent'];
      for (const checkRole of checks) {
        const table = tableForRole(checkRole);
        const { data } = await adminClient
          .from(table)
          .select('id, email')
          .ilike('email', escaped)
          .limit(10);
        if (Array.isArray(data)) {
          for (const row of data as Array<{ id: string; email?: string | null }>) {
            const id = String(row.id);
            if (
              normalizeEmail(row.email) === normalizedEmail &&
              !(checkRole === excludeRole && id === excludeRecordId)
            ) {
              return { role: checkRole, recordId: id };
            }
          }
        }
      }
      return null;
    },

    async linkDirectoryRecordAuthUser(
      role: ProvisionableRole,
      recordId: string,
      authUserId: string,
      normalizedEmail?: string | null
    ) {
      const table = tableForRole(role);
      const patch: Record<string, unknown> = { auth_user_id: authUserId };
      // Only update directory email when an explicit external email is provided
      // (never overwrite public.students.email with an internal `.internal` identifier).
      if (normalizedEmail) {
        patch.email = normalizedEmail;
      }
      const { error } = await adminClient.from(table).update(patch).eq('id', recordId);
      if (error) {
        return { ok: false, error: error.message };
      }
      return { ok: true };
    },

    async upsertUserProfile(input) {
      const fullPayload: Record<string, unknown> = {
        auth_user_id: input.authUserId,
        role: input.role,
        reference_id: input.referenceId,
        email: input.email,
        full_name: input.fullName,
        is_active: input.isActive,
        account_status: input.accountStatus,
        must_change_password: input.mustChangePassword,
        invited_at: input.invitedAt ?? null,
        activated_at: input.activatedAt ?? null,
      };

      const { error } = await adminClient
        .from('user_profiles')
        .upsert(fullPayload, { onConflict: 'auth_user_id' });

      if (!error) return { ok: true };

      // Graceful fallback to base 6 columns if optional 20260501_account_provisioning.sql
      // metadata columns have not been applied yet.
      if (
        error.code === 'PGRST204' ||
        error.code === '42703' ||
        /column .* does not exist|schema cache/i.test(error.message)
      ) {
        const basePayload = {
          auth_user_id: input.authUserId,
          role: input.role,
          reference_id: input.referenceId,
          email: input.email,
          full_name: input.fullName,
          is_active: input.isActive,
        };
        const { error: baseErr } = await adminClient
          .from('user_profiles')
          .upsert(basePayload, { onConflict: 'auth_user_id' });
        if (!baseErr) return { ok: true };
        return { ok: false, error: baseErr.message };
      }

      return { ok: false, error: error.message };
    },

    async deleteUserProfile(authUserId: string) {
      const { error } = await adminClient
        .from('user_profiles')
        .delete()
        .eq('auth_user_id', authUserId);
      if (error) {
        console.error('[admin-account-provisioning] deleteUserProfile error:', error.message);
      }
    },

    listAllAuthUsers,

    async getAuthUserById(authUserId: string): Promise<AuthUserRecord | null> {
      const { data, error } = await adminClient.auth.admin.getUserById(authUserId);
      if (error || !data?.user) return null;
      return data.user as unknown as AuthUserRecord;
    },

    async findAuthUserByEmail(normalizedEmail: string): Promise<AuthUserRecord | null> {
      const allUsers = await listAllAuthUsers();
      return allUsers.find((u) => normalizeEmail(u.email) === normalizedEmail) ?? null;
    },

    async inviteAuthUserByEmail({ email, redirectTo, userMetadata }) {
      const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
        redirectTo,
        data: userMetadata,
      });
      if (error || !data?.user) {
        return { user: null, error: error?.message || 'Invite failed.' };
      }
      return { user: data.user as unknown as AuthUserRecord };
    },

    async createAuthUserWithPassword({ email, password, userMetadata, appMetadata }) {
      const { data, error } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: userMetadata,
        app_metadata: appMetadata,
      });
      if (error || !data?.user) {
        return { user: null, error: error?.message || 'User creation failed.' };
      }
      return { user: data.user as unknown as AuthUserRecord };
    },

    async updateAuthUserById(authUserId, updates) {
      const { data, error } = await adminClient.auth.admin.updateUserById(authUserId, updates);
      if (error || !data?.user) {
        return { user: null, error: error?.message || 'Auth user update failed.' };
      }
      return { user: data.user as unknown as AuthUserRecord };
    },

    async deleteAuthUser(authUserId: string) {
      const { error } = await adminClient.auth.admin.deleteUser(authUserId);
      if (error) {
        console.error('[admin-account-provisioning] deleteAuthUser error:', error.message);
      }
    },
  };
}

// ============================================================================
// 5. HTTP ENTRY POINT
// ============================================================================

Deno.serve(async (req: Request) => {
  const allowedOrigins = Deno.env.get('ALLOWED_ORIGIN') ?? '';
  const corsHeaders = buildCorsHeaders(req.headers.get('origin'), allowedOrigins);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse(
      405,
      { ok: false, code: 'method_not_allowed', error: 'Only POST requests are supported.' },
      corsHeaders
    );
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = resolveServiceRoleKey();

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(
      500,
      {
        ok: false,
        code: 'server_misconfigured',
        error: 'Supabase Edge Function environment variables are not configured.',
      },
      corsHeaders
    );
  }

  let body: Record<string, unknown>;
  try {
    const parsed = await req.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Request payload must be a JSON object.');
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return jsonResponse(
      400,
      { ok: false, code: 'invalid_json', error: 'Invalid JSON request payload.' },
      corsHeaders
    );
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const adapter = createSupabaseBackendAdapter(adminClient);

  try {
    const result = await handleProvisioningRequest(
      {
        authHeader: req.headers.get('Authorization'),
        body,
        allowedRedirectOrigins: Deno.env.get('ALLOWED_REDIRECT_ORIGINS') ?? '',
      },
      adapter
    );

    return jsonResponse(result.status, result.body, corsHeaders);
  } catch (err) {
    console.error(
      '[admin-account-provisioning] Unhandled error:',
      err instanceof Error ? err.message : 'unknown'
    );
    return jsonResponse(
      500,
      {
        ok: false,
        code: 'internal_error',
        error: 'An unexpected server error occurred while processing the account request.',
      },
      corsHeaders
    );
  }
});
