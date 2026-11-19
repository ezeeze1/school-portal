/**
 * Server-side core business logic for Divine Academy Portal account provisioning.
 *
 * Security guarantees enforced here:
 *  1. Caller JWT must resolve to a real Supabase Auth user.
 *  2. Caller role MUST be verified as `role = 'admin'` AND `is_active = true` from `public.user_profiles`.
 *  3. Target role is strictly constrained to `'student' | 'teacher' | 'parent'` (never `'admin'`).
 *  4. Passwords are ONLY handled by Supabase Admin Auth APIs; never written to school tables or logs.
 *  5. Duplicate emails, mismatched record links, and cross-role account hijacking are blocked.
 *  6. Partial failures trigger compensating cleanup or safe metadata-verified idempotent recovery.
 */

export type ProvisionableRole = 'student' | 'teacher' | 'parent';
export type AccountStatus = 'not_created' | 'invitation_pending' | 'active' | 'disabled';
export type ProvisionMode = 'invite' | 'temporary_password';

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
  status?: string | null;
}

export interface ServerAccountStatusItem {
  role: ProvisionableRole;
  recordId: string;
  authUserId?: string;
  email?: string;
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
    normalizedEmail: string
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
  sendPasswordResetEmail(email: string, redirectTo?: string): Promise<{ ok: boolean; error?: string }>;
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

export function isValidEmail(email: string): boolean {
  return Boolean(email) && email.length <= 254 && EMAIL_REGEX.test(email);
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

export function validateTemporaryPassword(password: string): string | null {
  if (password.length < 10) return 'Temporary password must be at least 10 characters long.';
  if (password.length > 128) return 'Temporary password must not exceed 128 characters.';
  if (!/[A-Z]/.test(password)) return 'Temporary password must include an uppercase letter.';
  if (!/[a-z]/.test(password)) return 'Temporary password must include a lowercase letter.';
  if (!/[0-9]/.test(password)) return 'Temporary password must include a number.';
  if (!/[^A-Za-z0-9]/.test(password)) return 'Temporary password must include a symbol.';
  return null;
}

/**
 * Generates a cryptographically strong, readable temporary password using CSPRNG.
 */
export function generateStrongTemporaryPassword(length = 14): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnopqrstuvwxyz';
  const digits = '23456789';
  const symbols = '!@#$%&*?';
  const all = upper + lower + digits + symbols;

  const randomIndex = (max: number): number => {
    const buf = new Uint32Array(1);
    const limit = Math.floor(0x100000000 / max) * max;
    let val = 0;
    do {
      crypto.getRandomValues(buf);
      val = buf[0];
    } while (val >= limit);
    return val % max;
  };

  const chars = [
    upper[randomIndex(upper.length)],
    lower[randomIndex(lower.length)],
    digits[randomIndex(digits.length)],
    symbols[randomIndex(symbols.length)],
  ];

  while (chars.length < Math.max(length, 12)) {
    chars.push(all[randomIndex(all.length)]);
  }

  // Fisher-Yates shuffle using CSPRNG
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1);
    const tmp = chars[i];
    chars[i] = chars[j];
    chars[j] = tmp;
  }

  return chars.join('');
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

  if (!linkedAuthId && !profile && !authUser) {
    return {
      role,
      recordId: record.id,
      email: record.email || undefined,
      status: 'not_created',
      mustChangePassword: false,
      needsRepair: false,
      source: 'edge_function',
    };
  }

  // Partial link detection: e.g., auth_user_id exists on school record without user_profiles,
  // or user_profiles exists without auth_user_id written back to school record,
  // or auth_user_id points to a deleted Auth user.
  const hasCompleteTriplet =
    Boolean(record.auth_user_id) &&
    Boolean(profile) &&
    Boolean(authUser) &&
    record.auth_user_id === profile!.auth_user_id &&
    record.auth_user_id === authUser!.id;

  if (!authUser) {
    return {
      role,
      recordId: record.id,
      authUserId: linkedAuthId,
      email: profile?.email || record.email || undefined,
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

  const mustChangePassword = Boolean(
    profile?.must_change_password === true ||
      authUser.user_metadata?.must_change_password === true
  );

  return {
    role,
    recordId: record.id,
    authUserId: authUser.id,
    email: normalizeEmail(authUser.email) || normalizeEmail(profile?.email) || record.email || undefined,
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
    const requestedRolesRaw = Array.isArray(args.body.roles) ? args.body.roles : ['student', 'teacher', 'parent'];
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
      Promise.all(roles.map(async (role) => ({ role, records: await adapter.listDirectoryRecords(role) }))),
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
        error: 'Target role must be "student", "teacher", or "parent". Administrator role elevation is prohibited.',
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
  // ACTION: provision_account (idempotent, rollback-safe, no role escalation)
  // --------------------------------------------------------------------------
  if (action === 'provision_account') {
    const email = normalizeEmail(args.body?.email || record.email);
    if (!isValidEmail(email)) {
      return {
        status: 400,
        body: {
          ok: false,
          code: 'invalid_email',
          error: 'A valid, unique email address is required to create a Supabase Authentication account.',
        },
      };
    }

    const mode: ProvisionMode =
      args.body?.mode === 'temporary_password' ? 'temporary_password' : 'invite';
    const redirectTo = sanitizeRedirectUrl(args.body?.redirectTo, args.allowedRedirectOrigins);

    let resolvedTemporaryPassword: string | undefined;
    if (mode === 'temporary_password') {
      const supplied =
        typeof args.body?.temporaryPassword === 'string' ? args.body.temporaryPassword : '';
      if (supplied.trim().length > 0) {
        const pwdErr = validateTemporaryPassword(supplied);
        if (pwdErr) {
          return {
            status: 400,
            body: { ok: false, code: 'weak_password', error: pwdErr },
          };
        }
        resolvedTemporaryPassword = supplied;
      } else {
        resolvedTemporaryPassword = generateStrongTemporaryPassword(14);
      }
    }

    // Check cross-directory email conflict (another student, teacher, or parent)
    const directoryConflict = await adapter.findDirectoryEmailConflict(email, role, recordId);
    if (directoryConflict) {
      return {
        status: 409,
        body: {
          ok: false,
          code: 'duplicate_email',
          error: `Email "${email}" is already assigned to another ${directoryConflict.role} record.`,
        },
      };
    }

    // Check existing profile by email
    const existingProfileByEmail = await adapter.getProfileByEmail(email);
    if (
      existingProfileByEmail &&
      (existingProfileByEmail.role !== role || existingProfileByEmail.reference_id !== recordId)
    ) {
      return {
        status: 409,
        body: {
          ok: false,
          code: 'duplicate_email',
          error: `Email "${email}" is already linked to another portal account.`,
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
            'A Supabase login account is already linked to this record. Use Reset Password or Manage Access instead.',
        },
      };
    }

    // Check whether an Auth user already exists with this email
    const existingAuthByEmail = await adapter.findAuthUserByEmail(email);
    let authUserToLink: AuthUserRecord | null = null;
    let newlyCreatedAuthUser = false;
    let recoveredPartialAccount = false;

    if (existingRecordAuth) {
      // Partial failure where school record had auth_user_id, but user_profiles was missing
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
      // Partial failure where user_profiles row existed, but school record lacked auth_user_id
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
            error: `Email "${email}" already belongs to another Supabase Authentication account.`,
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
            error: `Email "${email}" is already registered to another Supabase Authentication account.`,
          },
        };
      }
      authUserToLink = existingAuthByEmail;
      recoveredPartialAccount = true;
    }

    const nowIso = new Date().toISOString();
    const baseUserMetadata = {
      full_name: record.fullName,
      portal_role: role,
      must_change_password: true,
    };
    const baseAppMetadata = {
      portal_role: role,
      provisioned_for_role: role,
      provisioned_record_id: recordId,
    };

    if (!authUserToLink) {
      if (mode === 'invite') {
        const inviteRes = await adapter.inviteAuthUserByEmail({
          email,
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
        // Stamp traceable server-only ownership metadata for safe idempotent retries
        await adapter.updateAuthUserById(authUserToLink.id, {
          app_metadata: baseAppMetadata,
        });
      } else {
        const createRes = await adapter.createAuthUserWithPassword({
          email,
          password: resolvedTemporaryPassword!,
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
      // Recover partially created Auth user cleanly before completing DB links
      if (mode === 'temporary_password' && !authUserToLink.last_sign_in_at) {
        const upd = await adapter.updateAuthUserById(authUserToLink.id, {
          email,
          password: resolvedTemporaryPassword!,
          email_confirm: true,
          user_metadata: baseUserMetadata,
          app_metadata: baseAppMetadata,
        });
        if (upd.user) authUserToLink = upd.user;
      } else if (mode === 'invite' && !authUserToLink.email_confirmed_at && !authUserToLink.confirmed_at) {
        await adapter.inviteAuthUserByEmail({
          email,
          redirectTo,
          userMetadata: baseUserMetadata,
        });
      }
    }

    const accountStatus: Exclude<AccountStatus, 'not_created'> =
      mode === 'invite' && !authUserToLink.email_confirmed_at && !authUserToLink.confirmed_at
        ? 'invitation_pending'
        : 'active';

    // Step 2: Upsert public.user_profiles
    const profileUpsert = await adapter.upsertUserProfile({
      authUserId: authUserToLink.id,
      role,
      referenceId: recordId,
      email,
      fullName: record.fullName,
      isActive: true,
      accountStatus,
      mustChangePassword: mode === 'temporary_password' ? true : accountStatus === 'invitation_pending',
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

    // Step 3: Link auth_user_id & email onto the school record (students / teachers / parents)
    const recordLink = await adapter.linkDirectoryRecordAuthUser(
      role,
      recordId,
      authUserToLink.id,
      email
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

    return {
      status: 200,
      body: {
        ok: true,
        status: accountStatus,
        authUserId: authUserToLink.id,
        email,
        mode,
        recoveredPartialAccount,
        ...(mode === 'temporary_password' && resolvedTemporaryPassword
          ? { oneTimeTemporaryPassword: resolvedTemporaryPassword }
          : {}),
        message:
          mode === 'invite'
            ? `Account setup invitation sent to ${email}. Status is now Invitation pending until confirmed.`
            : `Login account created for ${email}. Share the one-time temporary password securely; the user must change it on first sign-in.`,
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

  const linkedEmail = normalizeEmail(linkedAuthUser.email || linkedProfile?.email || record.email);

  // --------------------------------------------------------------------------
  // ACTION: resend_invite
  // --------------------------------------------------------------------------
  if (action === 'resend_invite') {
    if (linkedAuthUser.email_confirmed_at || linkedAuthUser.confirmed_at) {
      return {
        status: 400,
        body: {
          ok: false,
          code: 'already_confirmed',
          error: 'This account is already confirmed and active. Use Reset Password instead.',
        },
      };
    }
    if (!isValidEmail(linkedEmail)) {
      return {
        status: 400,
        body: { ok: false, code: 'invalid_email', error: 'Linked account does not have a valid email address.' },
      };
    }
    const redirectTo = sanitizeRedirectUrl(args.body?.redirectTo, args.allowedRedirectOrigins);
    const inviteRes = await adapter.inviteAuthUserByEmail({
      email: linkedEmail,
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
      email: linkedEmail,
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
        email: linkedEmail,
        message: `Setup invitation re-sent to ${linkedEmail}.`,
      },
    };
  }

  // --------------------------------------------------------------------------
  // ACTION: send_password_reset
  // --------------------------------------------------------------------------
  if (action === 'send_password_reset') {
    if ((linkedProfile && !linkedProfile.is_active) || isAuthUserBanned(linkedAuthUser)) {
      return {
        status: 400,
        body: {
          ok: false,
          code: 'account_disabled',
          error: 'This account is currently disabled. Reactivate it before sending a password reset email.',
        },
      };
    }
    if (!isValidEmail(linkedEmail)) {
      return {
        status: 400,
        body: { ok: false, code: 'invalid_email', error: 'No valid login email is linked to this account.' },
      };
    }

    const redirectTo = sanitizeRedirectUrl(args.body?.redirectTo, args.allowedRedirectOrigins);
    const resetRes = await adapter.sendPasswordResetEmail(linkedEmail, redirectTo);
    if (!resetRes.ok) {
      return {
        status: 400,
        body: {
          ok: false,
          code: 'password_reset_failed',
          error: resetRes.error || 'Could not send password reset email via Supabase Auth.',
        },
      };
    }

    return {
      status: 200,
      body: {
        ok: true,
        authUserId: linkedAuthUser.id,
        email: linkedEmail,
        message: `Password reset instructions sent to ${linkedEmail}.`,
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
      email: linkedEmail,
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
        email: linkedEmail,
        message: enabled
          ? `Login account for ${linkedEmail} has been reactivated.`
          : `Login account for ${linkedEmail} has been disabled.`,
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
