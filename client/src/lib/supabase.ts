import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (client) return client;
  
  const url = import.meta.env.VITE_SUPABASE_URL;
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;
  
  if (!url || !anon) {
    console.warn('Supabase env missing. Proceeding without Supabase (local dev).');
    // @ts-expect-error - return a minimal facade typed as SupabaseClient
    client = {
      auth: {
        // mimic API used in code; throw to fallback على API المحلي
        signInWithPassword: async () => {
          throw new Error('supabase-disabled');
        },
        signInWithOAuth: async () => {
          throw new Error('supabase-disabled');
        },
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } } as any),
        signOut: async () => {},
      },
    } as SupabaseClient;
    return client;
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
