import { createClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = 'https://nafzypkwdaxmsswgyuuk.supabase.co';
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_F4zwLhTECqsFJyH065nNyA_tsE3U7IK';

let browserClient;

export function getSupabaseConfig() {
  return {
    url: String(import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL).trim(),
    anonKey: String(import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_PUBLISHABLE_KEY).trim()
  };
}

export function isSupabaseConfigured() {
  const { url, anonKey } = getSupabaseConfig();
  return Boolean(url && anonKey && !url.includes('YOUR_PROJECT') && !anonKey.includes('YOUR_SUPABASE'));
}

export function getSupabaseClient() {
  if (browserClient) return browserClient;

  const { url, anonKey } = getSupabaseConfig();
  if (!url || !anonKey) {
    throw new Error('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  }

  browserClient = createClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    },
    global: {
      headers: {
        'x-solatrix-client': 'public-site'
      }
    }
  });

  return browserClient;
}
