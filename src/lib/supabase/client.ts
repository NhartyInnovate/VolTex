import { createBrowserClient } from "@supabase/ssr";

/**
 * Creates a browser-side Supabase client for client components,
 * authentication listeners, and client-side queries.
 *
 * Uses NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.
 * Never exposes service-role keys to the browser.
 */
export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    // When environment variables are missing (e.g. initial setup or incomplete Vercel environment config),
    // warn in the developer console instead of throwing an unhandled client exception that crashes the entire page.
    console.warn(
      "[VolTex Supabase] Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Ensure environment variables are configured in project settings."
    );
    // Provide a non-crashing mock/dummy client or empty placeholder client
    return createBrowserClient(
      supabaseUrl || "https://placeholder-project.supabase.co",
      supabaseAnonKey || "placeholder-anon-key"
    );
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
