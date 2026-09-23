import { getCurrentUserContext } from './auth.js';

export async function requireAuthenticatedRoute(loginPath) {
  const context = await getCurrentUserContext();
  if (!context) {
    window.location.replace(loginPath);
    return null;
  }
  if (context.profile && context.profile.is_active === false) {
    await import('./auth.js').then(({ signOut }) => signOut());
    window.location.replace(loginPath);
    return null;
  }
  return context;
}
