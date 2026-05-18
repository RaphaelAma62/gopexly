import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        // Persist session in localStorage so it survives browser restarts
        persistSession: true,
        // Auto-refresh the token before it expires
        autoRefreshToken: true,
        // Detect session from URL (needed for email confirmation links)
        detectSessionInUrl: true,
        // Store session in localStorage (survives tab close — needed for Remember Me)
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
        // Flow type
        flowType: 'pkce',
      }
    }
  )
}

// Type export for use in other files
export type SupabaseClient = ReturnType<typeof createClient>