/**
 * Server-side core authentication logic for Student Admission Number + Password login.
 *
 * Security guarantees:
 *  1. Accepts ONLY `{ admissionNo, password }`.
 *  2. Resolves `admission_no -> auth_user_id -> auth.users.email` strictly on the server
 *     using privileged `service_role` access; NEVER exposes the mapping to public/anon callers.
 *  3. Verifies credentials strictly through Supabase Authentication (`signInWithPassword`),
 *     never storing or comparing plaintext passwords in school tables.
 *  4. Returns uniform HTTP 401 `"Invalid admission number or password."` for non-existent
 *     admission numbers, unprovisioned students, suspended/disabled accounts, and wrong passwords
 *     to prevent account enumeration.
 *  5. Enforces sliding-window rate limiting per client IP AND per normalized admission number,
 *     returning HTTP 429 + `Retry-After` on excessive failed attempts.
 *  6. Returns ONLY short-lived Supabase session tokens upon successful authentication
 *     (never returns passwords or internal synthetic emails).
 */

export interface StudentIdentityLookup {
  studentId: string;
  admissionNo: string;
  status: string;
  authUserId: string | null;
  profileRole: string | null;
  profileIsActive: boolean;
  authEmail: string | null;
  isBanned: boolean;
}

export interface RateLimitCheckResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

export interface VerifiedSupabaseSession {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
  expires_in?: number;
  token_type?: string;
}

export interface StudentLoginAdapter {
  checkRateLimit(bucketKey: string, maxAttempts: number, windowSeconds: number): Promise<RateLimitCheckResult>;
  recordFailedAttempt(bucketKey: string, windowSeconds: number): Promise<void>;
  clearFailedAttempts(bucketKey: string): Promise<void>;
  findStudentIdentityByAdmissionNo(normalizedAdmissionNo: string): Promise<StudentIdentityLookup | null>;
  signInWithSupabasePassword(
    authEmail: string,
    password: string
  ): Promise<{ session: VerifiedSupabaseSession | null; error?: string }>;
}

export interface StudentLoginHttpResult {
  status: number;
  headers?: Record<string, string>;
  body: Record<string, unknown>;
}

const ADMISSION_PATTERN = /^[A-Z0-9][A-Z0-9/-]{2,31}$/;
const UNIFORM_AUTH_ERROR = 'Invalid admission number or password.';

export const STUDENT_LOGIN_RATE_LIMITS = {
  perAdmissionMaxAttempts: 5,
  perAdmissionWindowSeconds: 15 * 60, // 15 minutes
  perIpMaxAttempts: 20,
  perIpWindowSeconds: 15 * 60, // 15 minutes
};

export function normalizeAdmissionNoForLogin(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.trim().replace(/\s+/g, '').toUpperCase();
}

export function sanitizeClientIp(raw: string | null | undefined): string {
  if (!raw) return 'unknown';
  const first = raw.split(',')[0]?.trim() || 'unknown';
  return first.slice(0, 64).replace(/[^a-zA-Z0-9.:_-]/g, '') || 'unknown';
}

/**
 * In-memory sliding-window rate limiter used as fallback if the optional DB rate-limit
 * table has not yet been installed, and directly in unit tests.
 */
export class InMemoryRateLimiter {
  private readonly buckets = new Map<string, number[]>();

  private prune(bucketKey: string, windowSeconds: number, nowMs: number): number[] {
    const cutoff = nowMs - windowSeconds * 1000;
    const existing = this.buckets.get(bucketKey) ?? [];
    const active = existing.filter((ts) => ts > cutoff);
    if (active.length > 0) {
      this.buckets.set(bucketKey, active);
    } else {
      this.buckets.delete(bucketKey);
    }
    return active;
  }

  check(bucketKey: string, maxAttempts: number, windowSeconds: number, nowMs = Date.now()): RateLimitCheckResult {
    const active = this.prune(bucketKey, windowSeconds, nowMs);
    if (active.length >= maxAttempts) {
      const oldest = active[0];
      const retryAfterMs = Math.max(1000, oldest + windowSeconds * 1000 - nowMs);
      return {
        allowed: false,
        retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
      };
    }
    return { allowed: true, retryAfterSeconds: 0 };
  }

  recordFailure(bucketKey: string, windowSeconds: number, nowMs = Date.now()): void {
    const active = this.prune(bucketKey, windowSeconds, nowMs);
    active.push(nowMs);
    this.buckets.set(bucketKey, active);
  }

  clear(bucketKey: string): void {
    this.buckets.delete(bucketKey);
  }
}

export async function handleStudentLoginRequest(
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

  const ipBucket = `ip:${ip}`;
  const admBucket = `adm:${admissionNo}`;

  // 1. Check IP and Admission Number rate limits BEFORE touching Auth
  const [ipCheck, admCheck] = await Promise.all([
    adapter.checkRateLimit(
      ipBucket,
      STUDENT_LOGIN_RATE_LIMITS.perIpMaxAttempts,
      STUDENT_LOGIN_RATE_LIMITS.perIpWindowSeconds
    ),
    adapter.checkRateLimit(
      admBucket,
      STUDENT_LOGIN_RATE_LIMITS.perAdmissionMaxAttempts,
      STUDENT_LOGIN_RATE_LIMITS.perAdmissionWindowSeconds
    ),
  ]);

  if (!ipCheck.allowed || !admCheck.allowed) {
    const retryAfterSeconds = Math.max(ipCheck.retryAfterSeconds, admCheck.retryAfterSeconds, 30);
    const retryMinutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
    return {
      status: 429,
      headers: {
        'Retry-After': String(retryAfterSeconds),
      },
      body: {
        ok: false,
        code: 'rate_limited',
        retryAfterSeconds,
        error: `Too many failed sign-in attempts. Please wait about ${retryMinutes} minute${retryMinutes > 1 ? 's' : ''} before trying again.`,
      },
    };
  }

  // 2. Resolve student Auth identity strictly server-side
  const identity = await adapter.findStudentIdentityByAdmissionNo(admissionNo);
  const isEligibleStudent =
    Boolean(identity) &&
    identity!.status === 'Active' &&
    Boolean(identity!.authUserId) &&
    identity!.profileRole === 'student' &&
    identity!.profileIsActive === true &&
    !identity!.isBanned &&
    Boolean(identity!.authEmail);

  if (!isEligibleStudent || !identity?.authEmail) {
    await Promise.all([
      adapter.recordFailedAttempt(ipBucket, STUDENT_LOGIN_RATE_LIMITS.perIpWindowSeconds),
      adapter.recordFailedAttempt(admBucket, STUDENT_LOGIN_RATE_LIMITS.perAdmissionWindowSeconds),
    ]);
    return {
      status: 401,
      body: {
        ok: false,
        code: 'invalid_credentials',
        error: UNIFORM_AUTH_ERROR,
      },
    };
  }

  // 3. Verify password via Supabase Authentication (never custom password storage)
  const authRes = await adapter.signInWithSupabasePassword(identity.authEmail, password);
  if (!authRes.session?.access_token || !authRes.session?.refresh_token) {
    await Promise.all([
      adapter.recordFailedAttempt(ipBucket, STUDENT_LOGIN_RATE_LIMITS.perIpWindowSeconds),
      adapter.recordFailedAttempt(admBucket, STUDENT_LOGIN_RATE_LIMITS.perAdmissionWindowSeconds),
    ]);
    return {
      status: 401,
      body: {
        ok: false,
        code: 'invalid_credentials',
        error: UNIFORM_AUTH_ERROR,
      },
    };
  }

  // 4. Clear failed-attempt bucket for this admission number upon legitimate sign-in
  await adapter.clearFailedAttempts(admBucket);

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
}
