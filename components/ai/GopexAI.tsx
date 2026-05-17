'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'
import { usePrices } from '@/lib/hooks/usePrices'
import { cn } from '@/lib/utils'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const SUGGESTIONS = [
  'How is my portfolio doing?',
  'Which NGX stocks are up today?',
  'How do I diversify my portfolio?',
  'What is a P/E ratio?',
  'How do I add a holding?',
]

export default function GopexAI() {
  const sb = createClient()
  const { user } = useAuth()
  const { prices } = usePrices()

  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [portfolio, setPortfolio] = useState<{ ticker: string; shares: number; buy_price: number; company_name: string }[]>([])
  const [unread, setUnread] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!user) return
    sb.from('holdings').select('ticker,shares,buy_price,company_name').eq('user_id', user.id)
      .then(({ data }) => setPortfolio(data || []))
  }, [user, sb])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100)
      setUnread(false)
    }
  }, [open])

  useEffect(() => {
    if (open && messages.length === 0) {
      const greeting = user?.firstName
        ? `Hi ${user.firstName}! 👋 I'm Gopex AI — your personal NGX investing assistant. I can see your portfolio and live market data. What would you like to know?`
        : `Hi! 👋 I'm Gopex AI — your NGX investing assistant. I have access to live market data and can help you invest smarter. Ask me anything!`
      setMessages([{ role: 'assistant', content: greeting }])
    }
  }, [open, user, messages.length])

  async function sendMessage(text?: string) {
    const msg = (text || input).trim()
    if (!msg || loading) return
    setInput('')
    const newMessages: Message[] = [...messages, { role: 'user', content: msg }]
    setMessages(newMessages)
    setLoading(true)
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map(m => ({ role: m.role, content: m.content })),
          portfolio,
          prices,
        }),
      })
      const data = await res.json()
      const reply = data.reply || 'Sorry, something went wrong. Please try again.'
      setMessages(prev => [...prev, { role: 'assistant', content: reply }])
      if (!open) setUnread(true)
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Connection error. Please check your internet and try again.' }])
    }
    setLoading(false)
  }

  function clearChat() {
    setMessages([])
    setTimeout(() => {
      setMessages([{ role: 'assistant', content: `Chat cleared! How can I help you?` }])
    }, 100)
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(p => !p)}
        className={cn(
          'fixed bottom-5 right-5 z-[400] w-14 h-14 rounded-full shadow-lg transition-all duration-200 flex items-center justify-center text-2xl',
          open ? 'bg-gray-900 hover:bg-gray-800' : 'bg-gradient-to-br from-primary to-primary-dark hover:shadow-xl hover:-translate-y-0.5'
        )}
        title="Gopex AI"
      >
        {open ? <span className="text-white text-[18px] font-bold">✕</span> : '🤖'}
        {unread && !open && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-loss rounded-full border-2 border-white" />
        )}
      </button>

      {/* Chat window */}
      {open && (
        <div
          className="fixed bottom-24 right-5 z-[400] w-[360px] max-w-[calc(100vw-40px)] bg-white rounded-2xl shadow-2xl border border-border flex flex-col overflow-hidden animate-fade-in"
          style={{ height: '520px' }}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-primary to-primary-dark px-4 py-3.5 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-base">🤖</div>
              <div>
                <div className="text-white font-bold text-[14px]">Gopex AI</div>
                <div className="text-white/60 text-[10px] flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-gain rounded-full inline-block animate-pulse" />
                  NGX-aware investing assistant
                </div>
              </div>
            </div>
            <button onClick={clearChat} className="text-white/50 hover:text-white text-[11px] font-semibold transition-colors px-2 py-1 rounded-lg hover:bg-white/10">
              Clear
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3.5 py-3 flex flex-col gap-2.5">
            {messages.map((m, i) => (
              <div key={i} className={cn('flex items-end gap-1.5', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                {m.role === 'assistant' && (
                  <div className="w-6 h-6 rounded-full bg-primary-light flex items-center justify-center text-[11px] flex-shrink-0 mb-0.5">🤖</div>
                )}
                <div className={cn(
                  'max-w-[82%] px-3.5 py-2.5 text-[13px] leading-relaxed',
                  m.role === 'user'
                    ? 'bg-primary text-white rounded-2xl rounded-br-sm'
                    : 'bg-gray-100 text-text rounded-2xl rounded-bl-sm'
                )}>
                  {m.content}
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {loading && (
              <div className="flex items-end gap-1.5 justify-start">
                <div className="w-6 h-6 rounded-full bg-primary-light flex items-center justify-center text-[11px] flex-shrink-0 mb-0.5">🤖</div>
                <div className="bg-gray-100 px-4 py-3 rounded-2xl rounded-bl-sm flex items-center gap-1.5">
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Suggestions */}
          {messages.length <= 1 && (
            <div className="px-3.5 pb-2 flex gap-1.5 flex-wrap flex-shrink-0 border-t border-border pt-2">
              {SUGGESTIONS.map(s => (
                <button key={s} onClick={() => sendMessage(s)}
                  className="text-[11px] font-medium text-primary bg-primary-light border border-primary-border px-2.5 py-1 rounded-full hover:bg-primary hover:text-white transition-all whitespace-nowrap">
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="px-3.5 pb-3.5 pt-2 border-t border-border flex-shrink-0">
            <div className="flex items-center gap-2 bg-gray-50 border-[1.5px] border-border rounded-xl px-3 py-2 focus-within:border-primary focus-within:bg-white transition-all">
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                placeholder="Ask about stocks, your portfolio..."
                className="flex-1 bg-transparent text-[13px] text-text outline-none placeholder:text-text-muted"
                disabled={loading}
              />
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || loading}
                className="w-7 h-7 rounded-lg bg-primary text-white flex items-center justify-center text-[13px] disabled:opacity-40 hover:bg-primary-dark transition-all flex-shrink-0"
              >
                →
              </button>
            </div>
            <div className="text-[10px] text-text-muted text-center mt-1.5">
              Powered by Groq · Not financial advice
            </div>
          </div>
        </div>
      )}
    </>
  )
}
