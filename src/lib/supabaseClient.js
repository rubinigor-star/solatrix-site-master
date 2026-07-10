import { createClient } from '@supabase/supabase-js';

let browserClient;

export function getSupabaseConfig() {
  return {
    url: String(import.meta.env.VITE_SUPABASE_URL || '').trim(),
    anonKey: String(import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim()
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
