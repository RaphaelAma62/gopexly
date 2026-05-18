'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'
import { useProStatus } from '@/lib/hooks/useProStatus'
import { Spinner } from '@/components/ui'
import ProGate from '@/components/pro/ProGate'
import { fmtTime, cn } from '@/lib/utils'

interface Thread {
  other_user_id: string
  other_name: string | null
  other_initials: string | null
  other_username: string | null
  last_message: string
  last_time: string
  unread: number
}

interface Message {
  id: string
  sender_id: string
  body: string
  is_read: boolean
  created_at: string
}

export default function Messaging() {
  const sb = createClient()
  const { user } = useAuth()
  const { isPro, settings } = useProStatus()
  const [threads, setThreads] = useState<Thread[]>([])
  const [activeThread, setActiveThread] = useState<Thread | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<{ id: string; name: string | null; initials: string | null; username: string | null }[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)

  const loadThreads = useCallback(async () => {
    if (!user) return
    const { data } = await sb.from('messages')
      .select('id,sender_id,receiver_id,body,is_read,created_at')
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order('created_at', { ascending: false })
      .limit(100)

    const threadMap = new Map<string, Thread>()
    for (const msg of (data || []) as (Message & { sender_id: string; receiver_id: string })[]) {
      const otherId = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id
      if (!threadMap.has(otherId)) {
        const { data: prof } = await sb.from('profiles').select('name,initials,username').eq('id', otherId).single()
        const profData = prof as { name: string | null; initials: string | null; username: string | null } | null
        threadMap.set(otherId, {
          other_user_id: otherId,
          other_name: profData?.name || 'User',
          other_initials: profData?.initials || 'U',
          other_username: profData?.username || null,
          last_message: msg.body,
          last_time: msg.created_at,
          unread: msg.receiver_id === user.id && !msg.is_read ? 1 : 0,
        })
      }
    }
    setThreads(Array.from(threadMap.values()))
    setLoading(false)
  }, [sb, user])

  useEffect(() => { loadThreads() }, [loadThreads])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (!user || !activeThread) return
    const ch = sb.channel(`messages-${activeThread.other_user_id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' },
        payload => {
          const msg = payload.new as Message & { sender_id: string; receiver_id: string }
          if ((msg.sender_id === activeThread.other_user_id && msg.receiver_id === user.id) ||
              (msg.sender_id === user.id && msg.receiver_id === activeThread.other_user_id)) {
            setMessages(prev => [...prev, msg])
          }
        })
      .subscribe()
    return () => { sb.removeChannel(ch) }
  }, [sb, user, activeThread])

  async function openThread(thread: Thread) {
    setActiveThread(thread)
    const { data } = await sb.from('messages')
      .select('id,sender_id,body,is_read,created_at')
      .or(`and(sender_id.eq.${user?.id},receiver_id.eq.${thread.other_user_id}),and(sender_id.eq.${thread.other_user_id},receiver_id.eq.${user?.id})`)
      .order('created_at', { ascending: true })
      .limit(50)
    setMessages((data || []) as Message[])
    // Mark read
    await sb.from('messages').update({ is_read: true }).eq('sender_id', thread.other_user_id).eq('receiver_id', user?.id).eq('is_read', false)
  }

  async function sendMessage() {
    if (!input.trim() || !activeThread || !user) return
    setSending(true)
    await sb.from('messages').insert({ sender_id: user.id, receiver_id: activeThread.other_user_id, body: input.trim() })
    setInput('')
    setSending(false)
  }

  async function searchUsers(q: string) {
    setSearchQuery(q)
    if (!q.trim()) { setSearchResults([]); return }
    const { data } = await sb.from('profiles').select('id,name,initials,username').ilike('name', `%${q}%`).neq('id', user?.id).limit(6)
    setSearchResults((data || []) as { id: string; name: string | null; initials: string | null; username: string | null }[])
  }

  function startNewThread(targetUser: { id: string; name: string | null; initials: string | null; username: string | null }) {
    setSearchQuery(''); setSearchResults([])
    const thread: Thread = { other_user_id: targetUser.id, other_name: targetUser.name, other_initials: targetUser.initials, other_username: targetUser.username, last_message: '', last_time: new Date().toISOString(), unread: 0 }
    setActiveThread(thread)
    setMessages([])
  }

  if (!isPro || !settings.pro_feature_messaging) {
    return (
      <div className="max-w-[680px] mx-auto px-4 py-5">
        <ProGate feature="Direct Messaging" description="Send private messages to any investor on Gopexly. Have private conversations about stocks, strategies, and investment ideas."
          icon="💬" freeLimit="Not available" proLimit="Unlimited DMs" />
      </div>
    )
  }

  return (
    <div className="max-w-[900px] mx-auto px-4 py-5 pb-0" style={{ height: 'calc(100vh - 80px)' }}>
      <div className="flex h-full bg-white border border-border rounded-2xl overflow-hidden shadow-sm">

        {/* Thread list */}
        <div className={cn('flex flex-col border-r border-border', activeThread ? 'hidden md:flex w-[280px] flex-shrink-0' : 'w-full md:w-[280px] flex-shrink-0')}>
          <div className="px-4 py-4 border-b border-border">
            <div className="font-display text-[15px] font-extrabold mb-3">💬 Messages</div>
            <div className="relative">
              <input value={searchQuery} onChange={e => searchUsers(e.target.value)}
                placeholder="Search investors..."
                className="w-full bg-gray-50 border-[1.5px] border-border text-text px-3.5 py-2.5 rounded-xl text-[13px] outline-none focus:border-primary" />
              {searchResults.length > 0 && (
                <div className="absolute left-0 right-0 top-full bg-white border border-border rounded-xl shadow-lg z-10 mt-1">
                  {searchResults.map(u => (
                    <button key={u.id} onClick={() => startNewThread(u)}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-primary-light text-left border-b border-border last:border-0">
                      <div className="w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center text-[10px] font-bold">{u.initials}</div>
                      <div>
                        <div className="text-[13px] font-semibold">{u.name}</div>
                        <div className="text-[11px] text-text-muted">@{u.username}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? <div className="flex justify-center py-8"><Spinner className="text-primary" /></div>
              : threads.length === 0 ? (
                <div className="text-center py-12 px-4 text-text-muted">
                  <div className="text-3xl mb-2">💬</div>
                  <div className="text-[13px]">No messages yet</div>
                  <div className="text-[12px] mt-1">Search for an investor to start a conversation</div>
                </div>
              ) : threads.map(t => (
                <button key={t.other_user_id} onClick={() => openThread(t)}
                  className={cn('w-full flex items-center gap-3 px-4 py-3.5 border-b border-border last:border-0 text-left transition-colors',
                    activeThread?.other_user_id === t.other_user_id ? 'bg-primary-light' : 'hover:bg-gray-50')}>
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-[#7c3aed] text-white flex items-center justify-center text-[13px] font-bold flex-shrink-0">
                    {t.other_initials || 'U'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="font-bold text-[13px] truncate">{t.other_name}</span>
                      <span className="text-[10px] text-text-muted flex-shrink-0 ml-1">{fmtTime(t.last_time)}</span>
                    </div>
                    <div className="text-[12px] text-text-muted truncate">{t.last_message}</div>
                  </div>
                  {t.unread > 0 && <div className="w-5 h-5 bg-primary rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">{t.unread}</div>}
                </button>
              ))}
          </div>
        </div>

        {/* Message view */}
        {activeThread ? (
          <div className="flex-1 flex flex-col min-w-0">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-border flex-shrink-0">
              <button onClick={() => setActiveThread(null)} className="md:hidden text-text-muted hover:text-text text-[18px]">←</button>
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-[#7c3aed] text-white flex items-center justify-center text-[12px] font-bold">
                {activeThread.other_initials || 'U'}
              </div>
              <div>
                <div className="font-bold text-[14px]">{activeThread.other_name}</div>
                <div className="text-[12px] text-text-muted">@{activeThread.other_username}</div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
              {messages.map(m => {
                const isMe = m.sender_id === user?.id
                return (
                  <div key={m.id} className={cn('flex', isMe ? 'justify-end' : 'justify-start')}>
                    <div className={cn('max-w-[75%] px-4 py-2.5 text-[14px] leading-relaxed rounded-2xl',
                      isMe ? 'bg-primary text-white rounded-br-sm' : 'bg-gray-100 text-text rounded-bl-sm')}>
                      {m.body}
                      <div className={cn('text-[10px] mt-1', isMe ? 'text-white/60' : 'text-text-muted')}>{fmtTime(m.created_at)}</div>
                    </div>
                  </div>
                )
              })}
              <div ref={bottomRef} />
            </div>

            <div className="flex items-center gap-3 px-5 py-4 border-t border-border flex-shrink-0">
              <input value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                placeholder={`Message ${activeThread.other_name}...`}
                className="flex-1 bg-gray-50 border-2 border-border text-text px-4 py-2.5 rounded-full text-[14px] outline-none focus:border-primary" />
              <button onClick={sendMessage} disabled={!input.trim() || sending}
                className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center text-[16px] hover:bg-primary-dark disabled:opacity-40 transition-all">
                →
              </button>
            </div>
          </div>
        ) : (
          <div className="hidden md:flex flex-1 items-center justify-center flex-col text-text-muted">
            <div className="text-5xl mb-4">💬</div>
            <div className="font-display text-[18px] font-bold mb-2">Select a conversation</div>
            <div className="text-[14px]">Or search for an investor to message</div>
          </div>
        )}
      </div>
    </div>
  )
}
