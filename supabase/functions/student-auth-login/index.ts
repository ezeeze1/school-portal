import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { buildCorsHeaders } from '../_shared/cors.ts';
import {
  handleStudentLoginRequest,
  InMemoryRateLimiter,
  type RateLimitCheckResult,
  type StudentIdentityLookup,
  type StudentLoginAdapter,
} from '../_shared/studentLoginCore.ts';

const rateLimiter = new InMemoryRateLimiter();

function createSupabaseStudentLoginAdapter(
  adminClient: SupabaseClient,
  supabaseUrl: string,
  anonKey: string
): StudentLoginAdapter {
  return {
    async checkRateLimit(
      bucketKey: string,
      maxAttempts: number,
      windowSeconds: number
    ): Promise<RateLimitCheckResult> {
      return rateLimiter.check(bucketKey, maxAttempts, windowSeconds);
    },

    async recordFailedAttempt(bucketKey: string, windowSeconds: number): Promise<void> {
      rateLimiter.recordFailure(bucketKey, windowSeconds);
    },

    async clearFailedAttempts(bucketKey: string): Promise<void> {
      rateLimiter.clear(bucketKey);
    },

    async findStudentIdentityByAdmissionNo(
      normalizedAdmissionNo: string
    ): Promise<StudentIdentityLookup | null> {
      const { data: studentRows, error: studentErr } = await adminClient
        .from('students')
        .select('id, admission_no, status, auth_user_id')
        .ilike('admission_no', normalizedAdmissionNo)
        .limit(2);

      if (studentErr || !Array.isArray(studentRows) || studentRows.length !== 1) {
        return null;
      }

      const student = studentRows[0] as {
        id: string;
        admission_no: string;
        status: string;
        auth_user_id: string | null;
      };

      if (!student.auth_user_id) {
        return {
          studentId: student.id,
          admissionNo: student.admission_no,
          status: student.status,
          authUserId: null,
          profileRole: null,
          profileIsActive: false,
          authEmail: null,
          isBanned: false,
        };
      }

      const [profileRes, authRes] = await Promise.all([
        adminClient
          .from('user_profiles')
          .select('role, is_active')
          .eq('auth_user_id', student.auth_user_id)
          .maybeSingle(),
        adminClient.auth.admin.getUserById(student.auth_user_id),
      ]);

      const profile = profileRes.data as { role?: string; is_active?: boolean } | null;
      const authUser = authRes.data?.user as
        | { email?: string | null; banned_until?: string | null }
        | undefined;

      const bannedUntilMs = authUser?.banned_until ? Date.parse(authUser.banned_until) : 0;
      const isBanned = Number.isFinite(bannedUntilMs) && bannedUntilMs > Date.now();

      return {
        studentId: student.id,
        admissionNo: student.admission_no,
        status: student.status,
        authUserId: student.auth_user_id,
        profileRole: profile?.role ?? null,
        profileIsActive: Boolean(profile?.is_active),
        authEmail: authUser?.email ? authUser.email.trim().toLowerCase() : null,
        isBanned,
      };
    },

    async signInWithSupabasePassword(authEmail: string, password: string) {
      // Ephemeral anon client performs real Supabase Auth password verification
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

      if (error || !data.session?.access_token || !data.session?.refresh_token) {
        return { session: null, error: error?.message || 'Invalid credentials.' };
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

Deno.serve(async (req: Request) => {
  const allowedOrigins = Deno.env.get('ALLOWED_ORIGIN') ?? '';
  const corsHeaders = buildCorsHeaders(req.headers.get('origin'), allowedOrigins);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ ok: false, code: 'method_not_allowed', error: 'Only POST requests are supported.' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const readFirstDictKey = (rawJson: string | undefined): string => {
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
  };

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey =
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ??
    Deno.env.get('SB_SECRET_KEY') ??
    readFirstDictKey(Deno.env.get('SUPABASE_SECRET_KEYS'));
  const anonKey =
    Deno.env.get('SUPABASE_ANON_KEY') ??
    Deno.env.get('SB_PUBLISHABLE_KEY') ??
    readFirstDictKey(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS'));

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return new Response(
      JSON.stringify({
        ok: false,
        code: 'server_misconfigured',
        error: 'Supabase authentication function environment variables are not configured.',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
    return new Response(
      JSON.stringify({ ok: false, code: 'invalid_json', error: 'Invalid JSON request payload.' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const clientIp =
    req.headers.get('cf-connecting-ip') ||
    req.headers.get('x-forwarded-for') ||
    req.headers.get('x-real-ip') ||
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
    return new Response(JSON.stringify(result.body), {
      status: result.status,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        ...(result.headers ?? {}),
      },
    });
  } catch (err) {
    console.error(
      '[student-auth-login] Unhandled error:',
      err instanceof Error ? err.message : 'unknown'
    );
    return new Response(
      JSON.stringify({
        ok: false,
        code: 'internal_error',
        error: 'Unable to complete sign-in right now. Please try again shortly.',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
