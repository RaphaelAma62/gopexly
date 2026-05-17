import { createBrowserClient } from '@supabase/ssr'
import type { Tables } from '@/types'

export type Database = {
  public: {
    Tables: {
      [K in keyof Tables]: {
        Row: Tables[K]
        Insert: Partial<Tables[K]>
        Update: Partial<Tables[K]>
      }
    }
  }
}

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
