// /js/config.js
//
// Public configuration. The Supabase anon key is safe to expose — it's
// rate-limited and gated by Row Level Security policies. Never put the
// service role key in here.
//
// For local dev: edit these values directly.
// For production: replace at build time, or just commit the production values
// (the anon key is public).

window.REPORT_GENIE_CONFIG = {
  supabaseUrl: 'https://YOUR_PROJECT.supabase.co',
  supabaseAnonKey: 'YOUR_ANON_KEY_HERE',
};
