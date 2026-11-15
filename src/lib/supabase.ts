import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() ?? '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? '';

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

/**
 * Reusable singleton Supabase client for frontend operations.
 * Uses only the public publishable/anon API key (never a secret/service-role key).
 * Returns null when environment variables have not been configured yet so the
 * portal continues working seamlessly without crashing on boot.
 */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        // Preserves existing portal auth until Supabase Auth migration is planned
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    })
  : null;

/**
 * Returns the configured Supabase client or throws a descriptive error if
 * VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are missing.
 */
export function getSupabaseClient(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      'Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.'
    );
  }
  return supabase;
}

/**
 * Lightweight connectivity check against Supabase without modifying any data.
 */
export async function checkSupabaseConnection(): Promise<{
  configured: boolean;
  connected: boolean;
  error?: string;
}> {
  if (!supabase) {
    return {
      configured: false,
      connected: false,
      error: 'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY',
    };
  }

  try {
    const { error } = await supabase
      .from('system_settings')
      .select('id', { count: 'exact', head: true });

    if (error) {
      return { configured: true, connected: false, error: error.message };
    }

    return { configured: true, connected: true };
  } catch (err) {
    return {
      configured: true,
      connected: false,
      error: err instanceof Error ? err.message : 'Unknown connection error',
    };
  }
}
