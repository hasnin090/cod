import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (client) return client;
  const url = import.meta.env.VITE_SUPABASE_URL;
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    // Throw a clear, user-facing error so it's easy to fix envs
    throw new Error(
      'Supabase env missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in client/.env.local (and Netlify env) then restart dev/build.'
    );
  }
  client = createClient(url, anon, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return client;
}
