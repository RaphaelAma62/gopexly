'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'
import { fmtTime, cn } from '@/lib/utils'
import { Spinner, EmptyState } from '@/components/ui'

interface Notification {
  id: string
  type: string
  title: string
  body: string | null
  is_read: boolean
  created_at: string
  post_id: string | null
  actor_id: string | null
  profiles: { name: string | null; initials: string | null } | null
}

const TYPE_ICON: Record<string, string> = {
  like: '❤️', comment: '💬', follow: '👥',
  mention: '📢', alert: '🔔', system: '📣', default: '🔔'
}
const TYPE_COLOR: Record<string, string> = {
  like: 'bg-red-50 border-red-100',
  comment: 'bg-blue-50 border-blue-100',
  follow: 'bg-purple-50 border-purple-100',
  alert: 'bg-amber-bg border-amber/30',
  system: 'bg-primary-light border-primary-border',
}

export default function Notifications() {
  const sb = createClient()
  const { user } = useAuth()
  const [notifs, setNotifs] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'unread'>('all')

  const load = useCallback(async () => {
    if (!user) return
    const { data } = await sb.from('notifications')
      .select('id,type,title,body,is_read,created_at,post_id,actor_id,profiles!notifications_actor_id_fkey(name,initials)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)
    setNotifs((data || []) as unknown as Notification[])
    setLoading(false)
  }, [sb, user])

  useEffect(() => { load() }, [load])

  // Realtime
  useEffect(() => {
    if (!user) return
    const ch = sb.channel('notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        payload => setNotifs(prev => [payload.new as Notification, ...prev]))
      .subscribe()
    return () => { sb.removeChannel(ch) }
  }, [sb, user])

  async function markAllRead() {
    if (!user) return
    await sb.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false)
    setNotifs(prev => prev.map(n => ({ ...n, is_read: true })))
  }

  async function markRead(id: string) {
    await sb.from('notifications').update({ is_read: true }).eq('id', id)
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
  }

  async function deleteNotif(id: string) {
    await sb.from('notifications').delete().eq('id', id)
    setNotifs(prev => prev.filter(n => n.id !== id))
  }

  const unreadCount = notifs.filter(n => !n.is_read).length
  const filtered = filter === 'unread' ? notifs.filter(n => !n.is_read) : notifs

  return (
    <div className="max-w-[680px] mx-auto px-4 py-5 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="font-display text-[22px] font-extrabold flex items-center gap-2">
            🔔 Notifications
            {unreadCount > 0 && (
              <span className="bg-primary text-white text-[11px] font-extrabold w-6 h-6 rounded-full flex items-center justify-center">{unreadCount}</span>
            )}
          </h1>
          <p className="text-[13px] text-text-muted mt-0.5">Stay on top of your activity</p>
        </div>
        {unreadCount > 0 && (
          <button onClick={markAllRead} className="text-[13px] font-semibold text-primary hover:text-primary-dark transition-colors">
            Mark all read
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1.5 bg-gray-50 p-1 rounded-xl border border-border mb-5">
        {(['all', 'unread'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={cn('flex-1 py-2 rounded-lg text-[13px] font-bold transition-all capitalize',
              filter === f ? 'bg-white shadow-sm text-primary' : 'text-text-muted hover:text-text')}>
            {f === 'unread' ? `Unread${unreadCount > 0 ? ` (${unreadCount})` : ''}` : 'All'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner className="text-primary" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState icon="🔔" title={filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
          subtitle="When people like, comment, or follow you, it shows up here" />
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map(n => {
            const icon = TYPE_ICON[n.type] || TYPE_ICON.default
            const color = TYPE_COLOR[n.type] || 'bg-gray-50 border-gray-100'
            return (
              <div key={n.id} onClick={() => markRead(n.id)}
                className={cn('flex items-start gap-3 p-4 rounded-2xl border cursor-pointer transition-all hover:shadow-sm',
                  n.is_read ? 'bg-white border-border' : color)}>
                {/* Actor avatar or icon */}
                <div className="flex-shrink-0">
                  {n.profiles ? (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-[#7c3aed] text-white flex items-center justify-center text-[13px] font-bold">
                      {n.profiles.initials || n.profiles.name?.charAt(0) || '?'}
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-primary-light flex items-center justify-center text-[20px]">{icon}</div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className={cn('text-[14px] font-semibold leading-snug', !n.is_read && 'font-bold')}>
                        {n.title}
                      </div>
                      {n.body && (
                        <div className="text-[13px] text-text-muted mt-0.5 line-clamp-2">{n.body}</div>
                      )}
                      <div className="text-[11px] text-text-muted mt-1.5 flex items-center gap-2">
                        <span className="text-[13px]">{icon}</span>
                        {fmtTime(n.created_at)}
                        {!n.is_read && <span className="w-2 h-2 bg-primary rounded-full inline-block" />}
                      </div>
                    </div>
                    <button onClick={e => { e.stopPropagation(); deleteNotif(n.id) }}
                      className="text-text-muted hover:text-loss transition-colors flex-shrink-0 text-[13px] p-1">✕</button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
