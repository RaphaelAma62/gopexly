'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { UserSession } from '@/types'

export function useAuth() {
  const [user, setUser] = useState<UserSession | null>(null)
  const [loading, setLoading] = useState(true)
  const sbRef = useRef(createClient())

  async function loadProfile(userId: string, email: string): Promise<UserSession> {
    const sb = sbRef.current
    const { data: profile } = await sb
      .from('profiles')
      .select('id,name,first_name,initials,username,role')
      .eq('id', userId)
      .single()

    if (!profile) {
      const emailName = email.split('@')[0]
      await (sb.from('profiles') as any).upsert({
        id: userId,
        name: emailName,
        first_name: emailName,
        initials: emailName.charAt(0).toUpperCase(),
        joined_at: new Date().toISOString(),
      }, { onConflict: 'id' })
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

    const fn = profile.first_name || profile.name?.split(' ')[0] || email.split('@')[0]
    return {
      id: userId,
      name: profile.name || fn,
      firstName: fn,
      initials: profile.initials || fn.charAt(0).toUpperCase(),
      username: profile.username || '',
      email,
      role: (profile.role as UserSession['role']) || 'user',
    }
  }

  useEffect(() => {
    const sb = sbRef.current

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
  }, [])

  const signOut = async () => {
    await sbRef.current.auth.signOut()
    setUser(null)
  }

  return { user, loading, signOut }
}
