// /js/auth.js
//
// Magic link auth via Supabase. Single source of truth for the current session.
//
// Exports (on window.RG.auth):
//   getClient()       — the Supabase client singleton
//   getSession()      — current session, or null
//   getUser()         — current user, or null
//   getAccessToken()  — current access token, for use in /api calls
//   signOut()         — clears session and redirects to /login
//   requireAuth()     — call at app boot; redirects to /login if not signed in

(function () {
  const cfg = window.REPORT_GENIE_CONFIG;
  if (!cfg) throw new Error('REPORT_GENIE_CONFIG missing — load config.js first');

  const client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);

  let currentSession = null;

  // Cache session on auth state change
  client.auth.onAuthStateChange((_event, session) => {
    currentSession = session;
  });

  async function refreshSession() {
    const { data } = await client.auth.getSession();
    currentSession = data.session;
    return currentSession;
  }

  async function requireAuth() {
    const session = await refreshSession();
    if (!session) {
      window.location.href = '/login';
      return null;
    }
    return session;
  }

  async function signOut() {
    await client.auth.signOut();
    window.location.href = '/login';
  }

  window.RG = window.RG || {};
  window.RG.auth = {
    getClient: () => client,
    getSession: () => currentSession,
    getUser: () => currentSession?.user || null,
    getAccessToken: () => currentSession?.access_token || null,
    refreshSession,
    requireAuth,
    signOut,
  };
})();
