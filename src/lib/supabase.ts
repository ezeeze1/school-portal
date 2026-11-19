import { createClient, SupabaseClient } from '@supabase/supabase-js';

/**
 * Normalizes a Supabase Project URL by trimming whitespace, removing any
 * accidentally appended `/rest/v1` path, and stripping trailing slashes.
 */
export function normalizeSupabaseUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';

  try {
    const parsed = new URL(trimmed);
    const normalizedPath = parsed.pathname
      .replace(/\/rest\/v1\/?$/i, '')
      .replace(/\/+$/, '');
    return `${parsed.origin}${normalizedPath}`;
  } catch {
    return trimmed
      .replace(/\/rest\/v1\/?$/i, '')
      .replace(/\/+$/, '');
  }
}

const rawSupabaseUrl =
  typeof import.meta.env !== 'undefined' ? (import.meta.env.VITE_SUPABASE_URL ?? '') : '';
const supabaseUrl = normalizeSupabaseUrl(rawSupabaseUrl);
const supabaseAnonKey =
  typeof import.meta.env !== 'undefined' ? (import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? '') : '';

const isValidHttpUrl = (value: string): boolean => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
};

/**
 * True when both VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are configured
 * with valid non-placeholder values.
 */
export const isSupabaseConfigured: boolean =
  Boolean(supabaseUrl) &&
  Boolean(supabaseAnonKey) &&
  isValidHttpUrl(supabaseUrl) &&
  !supabaseUrl.includes('your-project') &&
  !supabaseAnonKey.includes('your-anon-key');

const SUPABASE_SINGLETON_KEY = '__divine_academy_supabase_singleton__';

interface CachedSupabaseClient {
  cacheKey: string;
  client: SupabaseClient;
}

/**
 * Returns a single shared SupabaseClient instance for the given project URL and
 * publishable/anon key across the entire browser runtime (preventing duplicate
 * GoTrueClient instances and storage/lock contention on module reloads).
 */
export function getOrCreateSupabaseClient(url: string, anonKey: string): SupabaseClient {
  const normalizedUrl = normalizeSupabaseUrl(url);
  const trimmedKey = anonKey.trim();
  const cacheKey = `${normalizedUrl}::${trimmedKey}`;
  const globalStore = globalThis as Record<string, unknown>;
  const cached = globalStore[SUPABASE_SINGLETON_KEY] as CachedSupabaseClient | undefined;

  if (cached && cached.cacheKey === cacheKey && cached.client) {
    return cached.client;
  }

  const client = createClient(normalizedUrl, trimmedKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  globalStore[SUPABASE_SINGLETON_KEY] = {
    cacheKey,
    client,
  } satisfies CachedSupabaseClient;

  return client;
}

/**
 * Reusable singleton Supabase client for frontend operations.
 * Uses only the public publishable/anon API key (never a secret/service-role key).
 * Returns null when environment variables have not been configured yet so the
 * portal continues working seamlessly without crashing on boot.
 */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? getOrCreateSupabaseClient(supabaseUrl, supabaseAnonKey)
  : null;

/**
 * Returns the configured Supabase client or throws a descriptive error if
 * VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are missing or invalid.
 */
export function getSupabaseClient(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      'Supabase is not configured. Set valid VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local.'
    );
  }
  return supabase;
}

export type SupabaseDiagnosticStatus =
  | 'connected'
  | 'missing_tables'
  | 'invalid_url'
  | 'auth_error'
  | 'network_error'
  | 'not_configured';

export interface SupabaseDiagnosticResult {
  status: SupabaseDiagnosticStatus;
  configured: boolean;
  gatewayReachable: boolean;
  connected: boolean;
  normalizedUrl: string;
  error?: string;
  details?: string;
}

/**
 * Lightweight, non-destructive connectivity diagnostic that accurately distinguishes:
 * - Valid API gateway + accessible tables (`connected`)
 * - Valid API gateway + missing database tables (`missing_tables`)
 * - Invalid URL / REST path (`invalid_url`)
 * - Authentication / invalid API key errors (`auth_error`)
 * - Network / DNS / CORS failures (`network_error`)
 */
export async function checkSupabaseConnection(): Promise<SupabaseDiagnosticResult> {
  if (!rawSupabaseUrl.trim() || !supabaseAnonKey) {
    return {
      status: 'not_configured',
      configured: false,
      gatewayReachable: false,
      connected: false,
      normalizedUrl: supabaseUrl,
      error: 'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env.local.',
    };
  }

  if (!isValidHttpUrl(supabaseUrl) || supabaseUrl.includes('your-project')) {
    return {
      status: 'invalid_url',
      configured: false,
      gatewayReachable: false,
      connected: false,
      normalizedUrl: supabaseUrl,
      error: 'VITE_SUPABASE_URL is not a valid Supabase Project URL (expected https://<project-ref>.supabase.co).',
    };
  }

  if (!supabase) {
    return {
      status: 'not_configured',
      configured: false,
      gatewayReachable: false,
      connected: false,
      normalizedUrl: supabaseUrl,
      error: 'Supabase client could not be initialized from environment variables.',
    };
  }

  try {
    const { error, status } = await supabase
      .from('public_site_settings')
      .select('id')
      .limit(1);

    if (!error) {
      return {
        status: 'connected',
        configured: true,
        gatewayReachable: true,
        connected: true,
        normalizedUrl: supabaseUrl,
      };
    }

    const msg = error.message || '';
    const code = error.code || '';

    if (code === 'PGRST125' || /invalid path/i.test(msg)) {
      return {
        status: 'invalid_url',
        configured: true,
        gatewayReachable: true,
        connected: false,
        normalizedUrl: supabaseUrl,
        error: msg,
        details: 'Supabase REST path is invalid. Ensure VITE_SUPABASE_URL is the root Project URL without /rest/v1/.',
      };
    }

    if (
      status === 401 ||
      status === 403 ||
      /invalid api key|jwt|unauthorized|permission denied/i.test(msg)
    ) {
      return {
        status: 'auth_error',
        configured: true,
        gatewayReachable: true,
        connected: false,
        normalizedUrl: supabaseUrl,
        error: msg,
        details: 'Supabase rejected the API key or request authorization.',
      };
    }

    if (
      code === 'PGRST205' ||
      code === '42P01' ||
      /could not find the table|relation .* does not exist/i.test(msg)
    ) {
      return {
        status: 'missing_tables',
        configured: true,
        gatewayReachable: true,
        connected: false,
        normalizedUrl: supabaseUrl,
        error: msg,
        details: 'API gateway connection succeeded, but database tables have not been created in Supabase yet.',
      };
    }

    return {
      status: 'network_error',
      configured: true,
      gatewayReachable: false,
      connected: false,
      normalizedUrl: supabaseUrl,
      error: msg || `Unexpected HTTP ${status}`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown network error';
    return {
      status: 'network_error',
      configured: true,
      gatewayReachable: false,
      connected: false,
      normalizedUrl: supabaseUrl,
      error: message,
      details: 'Could not reach the Supabase host. Check internet access, CORS, or VITE_SUPABASE_URL.',
    };
  }
}
