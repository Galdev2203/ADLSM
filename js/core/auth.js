import { supabase } from './supabase.js';

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.session;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getCurrentUserContext() {
  const session = await getSession();
  if (!session?.user) return null;

  const [{ data: profile, error: profileError }, { data: roles, error: rolesError }] = await Promise.all([
    supabase
      .from('user_profiles')
      .select('user_id, person_id, display_name, is_active')
      .eq('user_id', session.user.id)
      .maybeSingle(),
    supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', session.user.id)
  ]);

  if (profileError) throw profileError;
  if (rolesError) throw rolesError;

  return {
    session,
    user: session.user,
    profile,
    roles: (roles || []).map(row => row.role)
  };
}
