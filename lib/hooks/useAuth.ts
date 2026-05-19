'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { UserSession } from '@/types'

// Module-level cache — shared across all components
let userCache: UserSession | null = null
let sessionChecked = false
let listeners: Array<(user: UserSession | null) => void> = []

function notifyListeners(user: UserSession | null) {
  userCache = user
  listeners.forEach(fn => fn(user))
}

export function useAuth() {
  const [user, setUser] = useState<UserSession | null>(userCache)
  const [loading, setLoading] = useState(!sessionChecked)
  const sbRef = useRef(createClient())

  useEffect(() => {
    // Register listener
    const handler = (u: UserSession | null) => { setUser(u); setLoading(false) }
    listeners.push(handler)

    // If already checked, use cache immediately
    if (sessionChecked) {
      setUser(userCache)
      setLoading(false)
      return () => { listeners = listeners.filter(l => l !== handler) }
    }

    const sb = sbRef.current

    async function loadProfile(userId: string, email: string): Promise<UserSession> {
      // Check sessionStorage cache first — avoids DB call on every page
      const cached = sessionStorage.getItem('gopexly_profile')
      if (cached) {
        try {
          const p = JSON.parse(cached)
          if (p.id === userId) return p
        } catch { /* ignore */ }
      }

      const { data: profile } = await sb.from('profiles').select('*').eq('id', userId).single()

      if (!profile) {
        const emailName = email.split('@')[0]
        const newProfile = {
          id: userId, name: emailName, first_name: emailName,
          initials: emailName.charAt(0).toUpperCase(),
          joined_at: new Date().toISOString(),
        }
        await (sb.from('profiles') as any).upsert(newProfile, { onConflict: 'id' })
        const u: UserSession = {
          id: userId, name: emailName, firstName: emailName,
          initials: emailName.charAt(0).toUpperCase(),
          username: '', email, role: 'user',
        }
        sessionStorage.setItem('gopexly_profile', JSON.stringify(u))
        return u
      }

      const fn = profile.first_name || profile.name?.split(' ')[0] || email.split('@')[0]
      const u: UserSession = {
        id: userId,
        name: profile.name || fn,
        firstName: fn,
        initials: profile.initials || fn.charAt(0).toUpperCase(),
        username: profile.username || '',
        email,
        role: (profile.role as UserSession['role']) || 'user',
      }
      sessionStorage.setItem('gopexly_profile', JSON.stringify(u))
      return u
    }

    sb.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const userData = await loadProfile(session.user.id, session.user.email!)
        notifyListeners(userData)
      } else {
        notifyListeners(null)
      }
      sessionChecked = true
      setLoading(false)
    })

    const { data: { subscription } } = sb.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        sessionStorage.removeItem('gopexly_profile')
        sessionStorage.removeItem('gopexly_is_pro')
        notifyListeners(null)
      } else if (session?.user) {
        // Only reload profile on actual sign in, not token refresh
        if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
          sessionStorage.removeItem('gopexly_profile') // force fresh load
          const userData = await loadProfile(session.user.id, session.user.email!)
          notifyListeners(userData)
        }
      }
      setLoading(false)
    })

    return () => {
      subscription.unsubscribe()
      listeners = listeners.filter(l => l !== handler)
    }
  }, [])

  const signOut = async () => {
    sessionStorage.removeItem('gopexly_profile')
    sessionStorage.removeItem('gopexly_is_pro')
    sessionChecked = false
    userCache = null
    await sbRef.current.auth.signOut()
    setUser(null)
  }

  return { user, loading, signOut }
}
