import { createClient } from '@supabase/supabase-js';

const supabaseUrl     = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY || process.env.REACT_APP_SUPABASE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase env vars. Check .env.local → REACT_APP_SUPABASE_URL + REACT_APP_SUPABASE_ANON_KEY');
}

// Singleton: ES modules are cached, but this guard survives hot-reload edge cases
let _client = null;

function buildClient() {
  if (_client) return _client;

  _client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession:     true,
      autoRefreshToken:   true,
      detectSessionInUrl: true,
      // Unique storageKey → unique Web Lock name → no cross-tab "lock stolen" collisions
      storageKey: 'hellyeah-auth-v1',
    },
  });

  return _client;
}

export const supabase = buildClient();
