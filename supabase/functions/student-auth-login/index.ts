/**
 * Divine Academy Secondary School Portal
 * Supabase Edge Function: student-auth-login (Self-Contained Single File)
 *
 * Designed for direct deployment via BOTH:
 *   - Supabase Dashboard -> Edge Functions -> Deploy a new function -> Via Editor
 *   - Supabase CLI (`npx supabase functions deploy student-auth-login --no-verify-jwt`)
 *
 * PREREQUISITE MIGRATION (REQUIRED BEFORE ENABLING STUDENT LOGIN):
 *   Review and apply `supabase/migrations/20260502_student_login_rate_limits.sql`
 *   in Supabase SQL Editor so the persistent PostgreSQL rate-limiting table and
 *   `service_role`-only RPCs are installed. This function fails closed with
 *   HTTP 503 if any required rate-limiting RPC is missing or fails.
 *
 * IMPORTANT GATEWAY SETTING:
 *   Disable JWT verification at the Edge Function gateway (`--no-verify-jwt` or
 *   "Verify JWT with legacy secret" / "Enforce JWT Verification" OFF in Dashboard),
 *   because students are unauthenticated when submitting their Admission Number + Password.
 *
 * Security guarantees enforced strictly on the server:
 *  1. Accepts ONLY `{ admissionNo, password }` over HTTP POST.
 *  2. Enforces mandatory persistent, atomic rate limiting across all Edge Function
 *     instances via PostgreSQL `service_role`-only RPCs (`consume_student_login_attempt`,
 *     `clear_student_login_rate_limit`, `release_student_login_attempt`) using SHA-256
 *     hashed IP and Admission Number bucket keys — with NO in-memory fallback.
 *     If any required rate-limiting RPC is missing or fails, returns HTTP 503 with a
 *     generic service-unavailable message without processing login credentials or
 *     leaking database details.
 *  3. Resolves `admission_no -> public.students.auth_user_id -> public.user_profiles -> auth.users`
 *     strictly on the server using privileged `service_role` access; NEVER exposes
 *     service-role credentials, passwords, internal student emails, or database errors.
 *  4. Strictly verifies that:
 *       - Exactly one `public.students` row matches the normalized Admission Number,
 *         has `status = 'Active'`, and has a valid `auth_user_id` not shared with any
 *         other student, teacher, or parent row.
 *       - `public.user_profiles` for `auth_user_id` has `role = 'student'`,
 *         `is_active = true`, and a non-empty `reference_id` that EXACTLY matches
 *         `students.id` (missing or mismatched `reference_id` is rejected).
 *       - The linked Supabase Auth user exists, is confirmed/active, is not banned or
 *         deleted, has no admin/non-student role metadata, and (if `provisioned_record_id`
 *         metadata is present) matches `students.id`.
 *  5. Performs real password verification strictly through Supabase Authentication
 *     (`signInWithPassword`) using an ephemeral non-persisting anon/publishable client,
 *     verifying that the authenticated user ID matches the linked student `auth_user_id`.
 *  6. Returns uniform HTTP 401 `"Invalid admission number or password."` for all
 *     non-rate-limited auth failures to prevent account enumeration.
 *  7. Returns ONLY short-lived Supabase session tokens on success with
 *     `Cache-Control: no-store` and `Pragma: no-cache`.
 */

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

// ============================================================================
// 1. CORS, ENVIRONMENT & CRYPTO HELPERS
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

function readFirstDictKey(rawJson: string | undefined): string {
  if (!rawJson) return '';
  try {
    const parsed = JSON.parse(rawJson) as Record<string, unknown>;
    const match = Object.values(parsed).find(
      (val): val is string => typeof val === 'string' && val.trim().length > 0
    );
    return match ? match.trim() : '';
  } catch {
    return '';
  }
}

function resolveServiceRoleKey(): string {
  return (
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim() ||
    Deno.env.get('SB_SECRET_KEY')?.trim() ||
    readFirstDictKey(Deno.env.get('SUPABASE_SECRET_KEYS'))
  );
}

function resolveAnonKey(): string {
  return (
    Deno.env.get('SUPABASE_ANON_KEY')?.trim() ||
    Deno.env.get('SB_PUBLISHABLE_KEY')?.trim() ||
    readFirstDictKey(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS'))
  );
}

function escapeLikePattern(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

async function hashRateLimitBucket(prefix: 'ip' | 'adm', rawValue: string): Promise<string> {
  const data = new TextEncoder().encode(`${prefix}:${rawValue}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const hex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `${prefix}:${hex}`;
}

function jsonResponse(
  status: number,
  body: Record<string, unknown>,
  corsHeaders: Record<string, string>,
  extraHeaders?: Record<string, string>
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'Pragma': 'no-cache',
      ...(extraHeaders ?? {}),
    },
  });
}

// ============================================================================
// 2. TYPES, VALIDATION & RATE-LIMIT ERROR BOUNDARY
// ============================================================================

class RateLimitServiceUnavailableError extends Error {
  constructor() {
    super('Rate-limit service unavailable');
    this.name = 'RateLimitServiceUnavailableError';
  }
}

interface StudentIdentityLookup {
  studentId: string;
  admissionNo: string;
  studentStatus: string;
  authUserId: string | null;
  hasUniqueStudentAuthLink: boolean;
  hasConflictingRoleLink: boolean;
  hasDuplicateStudentProfile: boolean;
  profileRole: string | null;
  profileReferenceId: string | null;
  profileIsActive: boolean;
  authUserExists: boolean;
  authUserIdMatches: boolean;
  authEmail: string | null;
  authIsConfirmed: boolean;
  authIsBanned: boolean;
  authIsDeleted: boolean;
  authMetadataValidForStudent: boolean;
}

interface RateLimitConsumeResult {
  allowed: boolean;
  retryAfterSeconds: number;
  remainingAttempts: number;
}

interface VerifiedSupabaseSession {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
  expires_in?: number;
  token_type?: string;
}

interface StudentLoginAdapter {
  consumeRateLimitAttempt(
    bucketKey: string,
    maxAttempts: number,
    windowSeconds: number
  ): Promise<RateLimitConsumeResult>;
  clearRateLimitBucket(bucketKey: string): Promise<void>;
  releaseRateLimitAttempt(bucketKey: string): Promise<void>;
  findStudentIdentityByAdmissionNo(
    normalizedAdmissionNo: string
  ): Promise<StudentIdentityLookup | null>;
  signInWithSupabasePassword(
    authEmail: string,
    password: string,
    expectedAuthUserId: string
  ): Promise<{ session: VerifiedSupabaseSession | null }>;
}

interface StudentLoginHttpResult {
  status: number;
  headers?: Record<string, string>;
  body: Record<string, unknown>;
}

const ADMISSION_PATTERN = /^[A-Z0-9][A-Z0-9/-]{2,31}$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UNIFORM_AUTH_ERROR = 'Invalid admission number or password.';
const SERVICE_UNAVAILABLE_ERROR =
  'Student sign-in service is temporarily unavailable. Please try again later.';

const STUDENT_LOGIN_RATE_LIMITS = {
  perAdmissionMaxAttempts: 5,
  perAdmissionWindowSeconds: 15 * 60, // 15 minutes
  perIpMaxAttempts: 20,
  perIpWindowSeconds: 15 * 60, // 15 minutes
};

function normalizeAdmissionNoForLogin(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.trim().replace(/\s+/g, '').toUpperCase();
}

function sanitizeClientIp(raw: string | null | undefined): string {
  if (!raw) return 'unknown';
  const first = raw.split(',')[0]?.trim() || 'unknown';
  return first.slice(0, 64).replace(/[^a-zA-Z0-9.:_-]/g, '') || 'unknown';
}

function isNonStudentMetadataRole(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return false;
  // Supabase's built-in JWT role claim on auth users is 'authenticated', which is normal.
  if (normalized === 'authenticated') return false;
  return normalized !== 'student';
}

// ============================================================================
// 3. CORE STUDENT ADMISSION-NUMBER LOGIN HANDLER
// ============================================================================

function buildServiceUnavailableResponse(): StudentLoginHttpResult {
  return {
    status: 503,
    body: {
      ok: false,
      code: 'service_unavailable',
      error: SERVICE_UNAVAILABLE_ERROR,
    },
  };
}

function buildRateLimitedResponse(retryAfterSeconds: number): StudentLoginHttpResult {
  const safeRetrySeconds = Math.max(retryAfterSeconds, 30);
  const retryMinutes = Math.max(1, Math.ceil(safeRetrySeconds / 60));
  return {
    status: 429,
    headers: {
      'Retry-After': String(safeRetrySeconds),
    },
    body: {
      ok: false,
      code: 'rate_limited',
      retryAfterSeconds: safeRetrySeconds,
      error: `Too many failed sign-in attempts. Please wait about ${retryMinutes} minute${retryMinutes > 1 ? 's' : ''} before trying again.`,
    },
  };
}

function isVerifiedActiveStudentIdentity(identity: StudentIdentityLookup | null): boolean {
  if (!identity) return false;

  // Strict exact match required: reject NULL, empty, whitespace, or mismatched reference_id
  const exactReferenceMatch =
    typeof identity.profileReferenceId === 'string' &&
    identity.profileReferenceId.trim().length > 0 &&
    identity.profileReferenceId.trim() === identity.studentId;

  return (
    identity.studentStatus === 'Active' &&
    Boolean(identity.authUserId) &&
    identity.hasUniqueStudentAuthLink === true &&
    identity.hasConflictingRoleLink === false &&
    identity.hasDuplicateStudentProfile === false &&
    identity.profileRole === 'student' &&
    identity.profileIsActive === true &&
    exactReferenceMatch &&
    identity.authUserExists === true &&
    identity.authUserIdMatches === true &&
    Boolean(identity.authEmail) &&
    identity.authIsConfirmed === true &&
    identity.authIsBanned === false &&
    identity.authIsDeleted === false &&
    identity.authMetadataValidForStudent === true
  );
}

async function handleStudentLoginRequest(
  args: {
    body: Record<string, unknown>;
    clientIp: string;
  },
  adapter: StudentLoginAdapter
): Promise<StudentLoginHttpResult> {
  const admissionNo = normalizeAdmissionNoForLogin(args.body?.admissionNo);
  const password = typeof args.body?.password === 'string' ? args.body.password : '';
  const ip = sanitizeClientIp(args.clientIp);

  if (!admissionNo || !password) {
    return {
      status: 400,
      body: {
        ok: false,
        code: 'missing_credentials',
        error: 'Please enter both your Admission Number and password.',
      },
    };
  }

  const [ipBucket, admBucket] = await Promise.all([
    hashRateLimitBucket('ip', ip),
    hashRateLimitBucket('adm', admissionNo),
  ]);

  try {
    // 1. Atomically consume persistent PostgreSQL IP rate-limit slot BEFORE
    //    inspecting credentials, querying student tables, or calling Auth.
    //    Fails closed (HTTP 503) if the persistent RPC is missing or errors.
    const ipLimit = await adapter.consumeRateLimitAttempt(
      ipBucket,
      STUDENT_LOGIN_RATE_LIMITS.perIpMaxAttempts,
      STUDENT_LOGIN_RATE_LIMITS.perIpWindowSeconds
    );
    if (!ipLimit.allowed) {
      return buildRateLimitedResponse(ipLimit.retryAfterSeconds);
    }

    if (!ADMISSION_PATTERN.test(admissionNo) || password.length > 128) {
      return {
        status: 401,
        body: {
          ok: false,
          code: 'invalid_credentials',
          error: UNIFORM_AUTH_ERROR,
        },
      };
    }

    // 2. Atomically consume persistent PostgreSQL per-Admission-Number slot
    //    BEFORE DB/Auth lookup (eliminates concurrent multi-instance TOCTOU bursts).
    //    Fails closed (HTTP 503) if the persistent RPC is missing or errors.
    const admLimit = await adapter.consumeRateLimitAttempt(
      admBucket,
      STUDENT_LOGIN_RATE_LIMITS.perAdmissionMaxAttempts,
      STUDENT_LOGIN_RATE_LIMITS.perAdmissionWindowSeconds
    );
    if (!admLimit.allowed) {
      return buildRateLimitedResponse(admLimit.retryAfterSeconds);
    }

    // 3. Resolve and strictly validate the linked Supabase Auth student account
    const identity = await adapter.findStudentIdentityByAdmissionNo(admissionNo);
    if (!isVerifiedActiveStudentIdentity(identity) || !identity?.authEmail || !identity.authUserId) {
      return {
        status: 401,
        body: {
          ok: false,
          code: 'invalid_credentials',
          error: UNIFORM_AUTH_ERROR,
        },
      };
    }

    // 4. Perform real password verification strictly through Supabase Authentication
    const authRes = await adapter.signInWithSupabasePassword(
      identity.authEmail,
      password,
      identity.authUserId
    );
    if (!authRes.session?.access_token || !authRes.session?.refresh_token) {
      return {
        status: 401,
        body: {
          ok: false,
          code: 'invalid_credentials',
          error: UNIFORM_AUTH_ERROR,
        },
      };
    }

    // 5. Clear Admission Number failures and release the shared IP slot on valid sign-in
    //    (prevents school lab / shared Wi-Fi students from exhausting the IP allowance).
    //    Fails closed (HTTP 503) if either required rate-limit RPC is missing or errors.
    await Promise.all([
      adapter.clearRateLimitBucket(admBucket),
      adapter.releaseRateLimitAttempt(ipBucket),
    ]);

    // SECURITY: Return ONLY short-lived Supabase session tokens (never passwords or internal emails).
    return {
      status: 200,
      body: {
        ok: true,
        session: {
          access_token: authRes.session.access_token,
          refresh_token: authRes.session.refresh_token,
          expires_at: authRes.session.expires_at,
          expires_in: authRes.session.expires_in,
          token_type: authRes.session.token_type || 'bearer',
        },
      },
    };
  } catch (err) {
    if (err instanceof RateLimitServiceUnavailableError) {
      return buildServiceUnavailableResponse();
    }
    throw err;
  }
}

// ============================================================================
// 4. SUPABASE BACKEND ADAPTER (PERSISTENT POSTGRESQL RATE LIMITING REQUIRED)
// ============================================================================

function createSupabaseStudentLoginAdapter(
  adminClient: SupabaseClient,
  supabaseUrl: string,
  anonKey: string
): StudentLoginAdapter {
  return {
    async consumeRateLimitAttempt(
      bucketKey: string,
      maxAttempts: number,
      windowSeconds: number
    ): Promise<RateLimitConsumeResult> {
      try {
        const { data, error } = await adminClient.rpc('consume_student_login_attempt', {
          p_bucket_key: bucketKey,
          p_max_attempts: maxAttempts,
          p_window_seconds: windowSeconds,
        });

        if (error) {
          console.error(
            `[student-auth-login] Persistent rate-limit RPC "consume_student_login_attempt" failed (code: ${error.code || 'unknown'}).`
          );
          throw new RateLimitServiceUnavailableError();
        }

        const row = (Array.isArray(data) ? data[0] : data) as
          | {
              out_allowed?: unknown;
              out_retry_after_seconds?: unknown;
              out_remaining_attempts?: unknown;
            }
          | null
          | undefined;

        if (
          !row ||
          typeof row.out_allowed !== 'boolean' ||
          typeof row.out_retry_after_seconds !== 'number' ||
          !Number.isFinite(row.out_retry_after_seconds) ||
          typeof row.out_remaining_attempts !== 'number' ||
          !Number.isFinite(row.out_remaining_attempts)
        ) {
          console.error(
            '[student-auth-login] Persistent rate-limit RPC "consume_student_login_attempt" returned an invalid response shape.'
          );
          throw new RateLimitServiceUnavailableError();
        }

        return {
          allowed: row.out_allowed,
          retryAfterSeconds: Math.max(0, Math.trunc(row.out_retry_after_seconds)),
          remainingAttempts: Math.max(0, Math.trunc(row.out_remaining_attempts)),
        };
      } catch (err) {
        if (err instanceof RateLimitServiceUnavailableError) {
          throw err;
        }
        console.error(
          '[student-auth-login] Persistent rate-limit RPC "consume_student_login_attempt" threw an exception.'
        );
        throw new RateLimitServiceUnavailableError();
      }
    },

    async clearRateLimitBucket(bucketKey: string): Promise<void> {
      try {
        const { error } = await adminClient.rpc('clear_student_login_rate_limit', {
          p_bucket_key: bucketKey,
        });
        if (error) {
          console.error(
            `[student-auth-login] Persistent rate-limit RPC "clear_student_login_rate_limit" failed (code: ${error.code || 'unknown'}).`
          );
          throw new RateLimitServiceUnavailableError();
        }
      } catch (err) {
        if (err instanceof RateLimitServiceUnavailableError) {
          throw err;
        }
        console.error(
          '[student-auth-login] Persistent rate-limit RPC "clear_student_login_rate_limit" threw an exception.'
        );
        throw new RateLimitServiceUnavailableError();
      }
    },

    async releaseRateLimitAttempt(bucketKey: string): Promise<void> {
      try {
        const { error } = await adminClient.rpc('release_student_login_attempt', {
          p_bucket_key: bucketKey,
        });
        if (error) {
          console.error(
            `[student-auth-login] Persistent rate-limit RPC "release_student_login_attempt" failed (code: ${error.code || 'unknown'}).`
          );
          throw new RateLimitServiceUnavailableError();
        }
      } catch (err) {
        if (err instanceof RateLimitServiceUnavailableError) {
          throw err;
        }
        console.error(
          '[student-auth-login] Persistent rate-limit RPC "release_student_login_attempt" threw an exception.'
        );
        throw new RateLimitServiceUnavailableError();
      }
    },

    async findStudentIdentityByAdmissionNo(
      normalizedAdmissionNo: string
    ): Promise<StudentIdentityLookup | null> {
      // Columns verified against public.students in supabase/schema.sql:
      // id (text PK), admission_no (text NOT NULL), status (text NOT NULL), auth_user_id (uuid)
      const { data: studentRows, error: studentErr } = await adminClient
        .from('students')
        .select('id, admission_no, status, auth_user_id')
        .ilike('admission_no', escapeLikePattern(normalizedAdmissionNo))
        .limit(5);

      if (studentErr || !Array.isArray(studentRows)) {
        return null;
      }

      const exactMatches = (
        studentRows as Array<{
          id: string;
          admission_no: string;
          status: string;
          auth_user_id: string | null;
        }>
      ).filter((row) => normalizeAdmissionNoForLogin(row.admission_no) === normalizedAdmissionNo);

      // Fail closed if not found or if duplicate admission numbers exist
      if (exactMatches.length !== 1) {
        return null;
      }

      const student = exactMatches[0];
      const authUserId =
        typeof student.auth_user_id === 'string' && UUID_PATTERN.test(student.auth_user_id.trim())
          ? student.auth_user_id.trim()
          : null;

      if (!authUserId) {
        return {
          studentId: student.id,
          admissionNo: student.admission_no,
          studentStatus: student.status,
          authUserId: null,
          hasUniqueStudentAuthLink: false,
          hasConflictingRoleLink: false,
          hasDuplicateStudentProfile: false,
          profileRole: null,
          profileReferenceId: null,
          profileIsActive: false,
          authUserExists: false,
          authUserIdMatches: false,
          authEmail: null,
          authIsConfirmed: false,
          authIsBanned: false,
          authIsDeleted: false,
          authMetadataValidForStudent: false,
        };
      }

      // Cross-verify in parallel against public.user_profiles, public.students,
      // public.teachers, public.parents, and auth.users (all columns verified against schema.sql)
      const [
        profileByAuthRes,
        profilesByStudentRefRes,
        studentsByAuthRes,
        teachersByAuthRes,
        parentsByAuthRes,
        authRes,
      ] = await Promise.all([
        adminClient
          .from('user_profiles')
          .select('auth_user_id, role, reference_id, is_active')
          .eq('auth_user_id', authUserId)
          .maybeSingle(),
        adminClient
          .from('user_profiles')
          .select('auth_user_id')
          .eq('role', 'student')
          .eq('reference_id', student.id)
          .limit(2),
        adminClient
          .from('students')
          .select('id')
          .eq('auth_user_id', authUserId)
          .limit(2),
        adminClient
          .from('teachers')
          .select('id')
          .eq('auth_user_id', authUserId)
          .limit(1),
        adminClient
          .from('parents')
          .select('id')
          .eq('auth_user_id', authUserId)
          .limit(1),
        adminClient.auth.admin.getUserById(authUserId),
      ]);

      // Fail closed if any cross-table security query errored
      if (
        profileByAuthRes.error ||
        profilesByStudentRefRes.error ||
        studentsByAuthRes.error ||
        teachersByAuthRes.error ||
        parentsByAuthRes.error ||
        authRes.error
      ) {
        return null;
      }

      const profile = profileByAuthRes.data as {
        auth_user_id?: string;
        role?: string;
        reference_id?: string | null;
        is_active?: boolean;
      } | null;

      const profilesForStudent = Array.isArray(profilesByStudentRefRes.data)
        ? (profilesByStudentRefRes.data as Array<{ auth_user_id: string }>)
        : [];
      const hasDuplicateStudentProfile =
        profilesForStudent.length > 1 ||
        profilesForStudent.some((p) => p.auth_user_id !== authUserId);

      const studentsWithSameAuth = Array.isArray(studentsByAuthRes.data)
        ? (studentsByAuthRes.data as Array<{ id: string }>)
        : [];
      const hasUniqueStudentAuthLink =
        studentsWithSameAuth.length === 1 && studentsWithSameAuth[0].id === student.id;

      const hasTeacherLink =
        Array.isArray(teachersByAuthRes.data) && teachersByAuthRes.data.length > 0;
      const hasParentLink =
        Array.isArray(parentsByAuthRes.data) && parentsByAuthRes.data.length > 0;
      const hasConflictingRoleLink = hasTeacherLink || hasParentLink;

      const authUser = authRes.data?.user as
        | {
            id?: string;
            email?: string | null;
            email_confirmed_at?: string | null;
            confirmed_at?: string | null;
            banned_until?: string | null;
            deleted_at?: string | null;
            app_metadata?: Record<string, unknown> | null;
            user_metadata?: Record<string, unknown> | null;
          }
        | undefined;

      const bannedUntilMs = authUser?.banned_until ? Date.parse(authUser.banned_until) : 0;
      const authIsBanned = Number.isFinite(bannedUntilMs) && bannedUntilMs > Date.now();
      const authIsDeleted = Boolean(authUser?.deleted_at);
      const authIsConfirmed = Boolean(authUser?.email_confirmed_at || authUser?.confirmed_at);

      const appMeta =
        authUser?.app_metadata && typeof authUser.app_metadata === 'object'
          ? authUser.app_metadata
          : {};
      const userMeta =
        authUser?.user_metadata && typeof authUser.user_metadata === 'object'
          ? authUser.user_metadata
          : {};

      const metaProvisionedRecordId =
        typeof appMeta.provisioned_record_id === 'string'
          ? appMeta.provisioned_record_id.trim()
          : '';

      const authMetadataValidForStudent =
        !isNonStudentMetadataRole(appMeta.portal_role) &&
        !isNonStudentMetadataRole(appMeta.provisioned_for_role) &&
        !isNonStudentMetadataRole(appMeta.role) &&
        !isNonStudentMetadataRole(userMeta.portal_role) &&
        (!metaProvisionedRecordId || metaProvisionedRecordId === student.id);

      return {
        studentId: student.id,
        admissionNo: student.admission_no,
        studentStatus: student.status,
        authUserId,
        hasUniqueStudentAuthLink,
        hasConflictingRoleLink,
        hasDuplicateStudentProfile,
        profileRole: typeof profile?.role === 'string' ? profile.role : null,
        profileReferenceId:
          typeof profile?.reference_id === 'string' ? profile.reference_id : null,
        profileIsActive: profile?.is_active === true,
        authUserExists: Boolean(authUser),
        authUserIdMatches: authUser?.id === authUserId,
        authEmail: authUser?.email ? authUser.email.trim().toLowerCase() : null,
        authIsConfirmed,
        authIsBanned,
        authIsDeleted,
        authMetadataValidForStudent,
      };
    },

    async signInWithSupabasePassword(
      authEmail: string,
      password: string,
      expectedAuthUserId: string
    ) {
      // Ephemeral non-persisting anon/publishable client performs real Supabase Auth verification
      const ephemeralClient = createClient(supabaseUrl, anonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      });

      const { data, error } = await ephemeralClient.auth.signInWithPassword({
        email: authEmail,
        password,
      });

      const verifiedUserId = data.user?.id || data.session?.user?.id || '';
      if (
        error ||
        !data.session?.access_token ||
        !data.session?.refresh_token ||
        verifiedUserId !== expectedAuthUserId
      ) {
        return { session: null };
      }

      return {
        session: {
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
          expires_at: data.session.expires_at,
          expires_in: data.session.expires_in,
          token_type: data.session.token_type,
        },
      };
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
  const anonKey = resolveAnonKey();

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    console.error('[student-auth-login] Required server authentication configuration is missing.');
    return jsonResponse(
      503,
      {
        ok: false,
        code: 'service_unavailable',
        error: SERVICE_UNAVAILABLE_ERROR,
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

  const clientIp =
    req.headers.get('cf-connecting-ip') ||
    req.headers.get('x-real-ip') ||
    req.headers.get('x-forwarded-for') ||
    'unknown';

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const adapter = createSupabaseStudentLoginAdapter(adminClient, supabaseUrl, anonKey);

  try {
    const result = await handleStudentLoginRequest({ body, clientIp }, adapter);
    return jsonResponse(result.status, result.body, corsHeaders, result.headers);
  } catch (err) {
    if (err instanceof RateLimitServiceUnavailableError) {
      return jsonResponse(
        503,
        {
          ok: false,
          code: 'service_unavailable',
          error: SERVICE_UNAVAILABLE_ERROR,
        },
        corsHeaders
      );
    }
    console.error(
      '[student-auth-login] Unhandled error:',
      err instanceof Error ? err.name : 'unknown'
    );
    return jsonResponse(
      500,
      {
        ok: false,
        code: 'internal_error',
        error: 'Unable to complete sign-in right now. Please try again shortly.',
      },
      corsHeaders
    );
  }
});
