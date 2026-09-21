import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * True once real Supabase credentials are present in the environment.
 * Every data-fetching function in lib/data.ts checks this and falls back
 * to the bundled mock data when it's false, so the app runs immediately
 * and switches to live data the moment you add your project's keys.
 */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// Browser-side client — used by client components (the login/signup
// form). createBrowserClient (from @supabase/ssr) stores the session in
// cookies rather than only localStorage, so the same session can be read
// server-side via lib/supabase/server.ts. Never throw at import time —
// many files import this before any env vars are set, and the app
// should still render with mock data rather than crash.
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createBrowserClient(supabaseUrl as string, supabaseAnonKey as string)
  : null;