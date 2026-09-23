import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://lablfftoocnyuebicfmn.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_ni5U2dBs3CqAGPT21JFv8g_SIOEQ6Ap';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});
