import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import type { Database } from '@/types/database.types'

export async function createServerSupabaseClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options) {
          try {
            cookieStore.set(name, value, options)
          } catch {
            // Server Component — cookies can't be set here, handled by middleware
          }
        },
        remove(name: string, options) {
          try {
            cookieStore.set(name, '', { ...options, maxAge: 0 })
          } catch {
            // Server Component — cookies can't be set here, handled by middleware
          }
        },
      },
    }
  )
}

// Service role client for admin operations (API routes only)
export function createServiceClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
