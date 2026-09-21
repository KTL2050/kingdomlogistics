import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { isSupabaseConfigured } from "@/lib/supabase/client";

/**
 * Server-side Supabase client — reads the logged-in session from the
 * request's cookies (set there by the browser client after login), so
 * Server Components see the same signed-in user the browser does.
 * Every function in lib/data.ts uses this instead of the browser client
 * in lib/supabase/client.ts, since Server Components can't read the
 * browser's own session directly.
 */
export async function createServerSupabaseClient() {
  if (!isSupabaseConfigured) return null;
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Components render read-only and can't set cookies —
            // middleware.ts is what actually refreshes the session, so
            // this is safe to ignore here.
          }
        },
      },
    }
  );
}