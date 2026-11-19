import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { buildCorsHeaders } from '../_shared/cors.ts';
import {
  handleProvisioningRequest,
  type AuthUserRecord,
  type DirectoryRecord,
  type ProfileRow,
  type ProvisionableRole,
  type ProvisioningBackendAdapter,
} from '../_shared/provisioningCore.ts';

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
    status: typeof row.status === 'string' ? row.status : 'Active',
  };
}

function createSupabaseBackendAdapter(
  adminClient: SupabaseClient,
  supabaseUrl: string,
  anonKey: string
): ProvisioningBackendAdapter {
  const listAllAuthUsers = async (): Promise<AuthUserRecord[]> => {
    const users: AuthUserRecord[] = [];
    const perPage = 200;
    const maxPages = 50;
    for (let page = 1; page <= maxPages; page++) {
      const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });
      if (error || !data?.users) break;
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
    ): Promise<ProfileRow | null> {
      const { data, error } = await adminClient
        .from('user_profiles')
        .select('*')
        .eq('role', role)
        .eq('reference_id', recordId)
        .maybeSingle();
      if (error || !data) return null;
      return data as ProfileRow;
    },

    async getProfileByEmail(normalizedEmail: string): Promise<ProfileRow | null> {
      const { data, error } = await adminClient
        .from('user_profiles')
        .select('*')
        .ilike('email', normalizedEmail)
        .maybeSingle();
      if (error || !data) return null;
      return data as ProfileRow;
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
      const checks: ProvisionableRole[] = ['student', 'teacher', 'parent'];
      for (const checkRole of checks) {
        const table = tableForRole(checkRole);
        const { data } = await adminClient
          .from(table)
          .select('id')
          .ilike('email', normalizedEmail);
        if (Array.isArray(data)) {
          for (const row of data) {
            const id = String((row as { id: string }).id);
            if (!(checkRole === excludeRole && id === excludeRecordId)) {
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
      normalizedEmail: string
    ) {
      const table = tableForRole(role);
      const { error } = await adminClient
        .from(table)
        .update({ auth_user_id: authUserId, email: normalizedEmail })
        .eq('id', recordId);
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

      // Graceful compatibility if optional additive migration columns have not been applied yet
      if (/column .* does not exist|schema cache/i.test(error.message)) {
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
      await adminClient.from('user_profiles').delete().eq('auth_user_id', authUserId);
    },

    listAllAuthUsers,

    async getAuthUserById(authUserId: string): Promise<AuthUserRecord | null> {
      const { data, error } = await adminClient.auth.admin.getUserById(authUserId);
      if (error || !data?.user) return null;
      return data.user as unknown as AuthUserRecord;
    },

    async findAuthUserByEmail(normalizedEmail: string): Promise<AuthUserRecord | null> {
      const allUsers = await listAllAuthUsers();
      return (
        allUsers.find((u) => (u.email ?? '').trim().toLowerCase() === normalizedEmail) ?? null
      );
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
      await adminClient.auth.admin.deleteUser(authUserId);
    },

    async sendPasswordResetEmail(email: string, redirectTo?: string) {
      // Ephemeral server-side client triggers Supabase SMTP password reset without touching admin session
      const ephemeralClient = createClient(supabaseUrl, anonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      });
      const { error } = await ephemeralClient.auth.resetPasswordForEmail(email, {
        redirectTo,
      });
      if (error) {
        return { ok: false, error: error.message };
      }
      return { ok: true };
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

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? serviceRoleKey;

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(
      JSON.stringify({
        ok: false,
        code: 'server_misconfigured',
        error: 'Supabase Edge Function environment variables are not configured.',
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

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const adapter = createSupabaseBackendAdapter(adminClient, supabaseUrl, anonKey);

  try {
    const result = await handleProvisioningRequest(
      {
        authHeader: req.headers.get('Authorization'),
        body,
        allowedRedirectOrigins: Deno.env.get('ALLOWED_REDIRECT_ORIGINS') ?? '',
      },
      adapter
    );

    return new Response(JSON.stringify(result.body), {
      status: result.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[admin-account-provisioning] Unhandled error:', err instanceof Error ? err.message : 'unknown');
    return new Response(
      JSON.stringify({
        ok: false,
        code: 'internal_error',
        error: 'An unexpected server error occurred while processing the account request.',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
