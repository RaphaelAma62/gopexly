'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { UserSession } from '@/types'

export function useAuth() {
  const [user, setUser] = useState<UserSession | null>(null)
  const [loading, setLoading] = useState(true)
  const sb = createClient()

  const loadProfile = useCallback(async (userId: string, email: string) => {
    const { data: profile } = await sb
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (!profile) {
      // Auto-create profile if missing
      const emailName = email.split('@')[0]
      const newProfile = {
        id: userId,
        name: emailName,
        first_name: emailName,
        initials: emailName.charAt(0).toUpperCase(),
        joined_at: new Date().toISOString(),
      }
      await (sb.from('profiles') as any).upsert(newProfile, { onConflict: 'id' })
      return {
        id: userId,
        name: emailName,
        firstName: emailName,
        initials: emailName.charAt(0).toUpperCase(),
        username: '',
        email,
        role: 'user' as const,
      }
    }

    const fn = profile.first_name || (profile.name ? profile.name.split(' ')[0] : email.split('@')[0])
    return {
      id: userId,
      name: profile.name || fn,
      firstName: fn,
      initials: profile.initials || fn.charAt(0).toUpperCase(),
      username: profile.username || '',
      email,
      role: (profile.role as UserSession['role']) || 'user',
    }
  }, [sb])

  useEffect(() => {
    sb.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const userData = await loadProfile(session.user.id, session.user.email!)
        setUser(userData)
      }
      setLoading(false)
    })

    const { data: { subscription } } = sb.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        const userData = await loadProfile(session.user.id, session.user.email!)
        setUser(userData)
      } else {
        setUser(null)
      }
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [sb, loadProfile])

  const signOut = async () => {
    await sb.auth.signOut()
    setUser(null)
  }

  return { user, loading, signOut }
}
