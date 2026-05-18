'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'
import { usePrices } from '@/lib/hooks/usePrices'
import { useToast } from '@/lib/hooks/useToast'
import { Toast, Spinner } from '@/components/ui'
import { cn, fmtTime } from '@/lib/utils'
import Link from 'next/link'

interface StockDetailProps {
  ticker: string
}

interface HolderRow {
  user_id: string
  shares: number
  buy_price: number
  profiles: { name: string | null; initials: string | null; username: string | null } | null
}

interface PostRow {
  id: string
  body: string
  created_at: string
  likes_count: number
  profiles: { name: string | null; initials: string | null } | null
}

export default function StockDetail({ ticker }: StockDetailProps) {
  const sb = createClient()
  const { user } = useAuth()
  const { prices } = usePrices()
  const { toast, showToast } = useToast()

  const [holders, setHolders] = useState<HolderRow[]>([])
  const [posts, setPosts] = useState<PostRow[]>([])
  const [inWatchlist, setInWatchlist] = useState(false)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'overview' | 'holders' | 'posts'>('overview')

  const stock = prices[ticker]
  const up = (stock?.change_pct ?? 0) >= 0

  useEffect(() => {
    if (!ticker) return
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticker])

  async function loadData() {
    const [holdersRes, postsRes, watchRes] = await Promise.all([
      sb.from('holdings').select('user_id,shares,buy_price,profiles!holdings_user_id_fkey(name,initials,username)').eq('ticker', ticker).limit(10),
      sb.from('posts').select('id,body,created_at,likes_count,profiles!posts_user_id_fkey(name,initials)').ilike('body', `%${ticker}%`).order('created_at', { ascending: false }).limit(10),
      user ? sb.from('watchlist').select('id').eq('user_id', user.id).eq('ticker', ticker).maybeSingle() : Promise.resolve({ data: null }),
    ])
    setHolders((holdersRes.data || []) as unknown as HolderRow[])
    setPosts((postsRes.data || []) as unknown as PostRow[])
    setInWatchlist(!!watchRes.data)
    setLoading(false)
  }

  async function toggleWatchlist() {
    if (!user) return
    if (inWatchlist) {
      await sb.from('watchlist').delete().eq('user_id', user.id).eq('ticker', ticker)
      setInWatchlist(false)
      showToast(`${ticker} removed from watchlist`, 'ok')
    } else {
      await sb.from('watchlist').insert({ user_id: user.id, ticker, company_name: stock?.company_name || ticker, added_at: new Date().toISOString() })
      setInWatchlist(true)
      showToast(`${ticker} added to watchlist 👁`, 'ok')
    }
  }

  if (!stock && !loading) return (
    <div className="max-w-[680px] mx-auto px-4 py-10 text-center">
      <div className="text-5xl mb-4">📊</div>
      <div className="font-display text-[20px] font-extrabold mb-2">Stock not found</div>
      <div className="text-text-muted mb-6">We don&apos;t have data for {ticker} yet</div>
      <Link href="/market" className="text-primary font-semibold">← Back to Market</Link>
    </div>
  )

  return (
    <div className="max-w-[720px] mx-auto px-4 py-5 pb-20">
      {/* Back */}
      <Link href="/market" className="inline-flex items-center gap-1.5 text-[13px] text-text-muted hover:text-primary transition-colors mb-4 font-medium">
        ← Market
      </Link>

      {/* Hero card */}
      {stock && (
        <div className={cn('rounded-3xl p-6 mb-5 text-white', up ? 'bg-gradient-to-br from-[#0f172a] via-[#16a34a]/80 to-[#0f172a]' : 'bg-gradient-to-br from-[#0f172a] via-[#dc2626]/60 to-[#0f172a]')}>
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="font-extrabold font-mono text-[32px] tracking-tight">{ticker}</div>
              <div className="text-white/70 text-[14px]">{stock.company_name}</div>
            </div>
            <button onClick={toggleWatchlist}
              className={cn('px-4 py-2 rounded-xl text-[13px] font-bold transition-all border',
                inWatchlist ? 'bg-white/20 border-white/30 text-white' : 'bg-white text-[#0f172a] border-white hover:bg-white/90')}>
              {inWatchlist ? '✓ Watching' : '+ Watch'}
            </button>
          </div>

          <div className="flex items-end gap-4 mb-4">
            <div>
              <div className="font-display text-[48px] font-black leading-none">₦{stock.price.toFixed(2)}</div>
              <div className={cn('text-[16px] font-bold mt-1', up ? 'text-green-300' : 'text-red-300')}>
                {up ? '▲ +' : '▼ '}{Math.abs(stock.change_pct).toFixed(2)}% today
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Volume', value: stock.volume ? stock.volume.toLocaleString() : '—' },
              { label: 'Market Cap', value: stock.market_cap ? `₦${(stock.market_cap / 1_000_000_000).toFixed(1)}B` : '—' },
              { label: 'Holders on App', value: holders.length.toString() },
            ].map(s => (
              <div key={s.label} className="bg-white/10 rounded-xl px-3 py-2.5 text-center">
                <div className="font-bold text-[15px]">{s.value}</div>
                <div className="text-white/60 text-[10px] uppercase tracking-wide mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-50 p-1 rounded-xl border border-border mb-5">
        {[
          { key: 'overview', label: '📊 Overview' },
          { key: 'holders', label: `👥 Holders (${holders.length})` },
          { key: 'posts', label: `💬 Posts (${posts.length})` },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as typeof tab)}
            className={cn('flex-1 py-2.5 rounded-lg text-[12px] font-bold transition-all',
              tab === t.key ? 'bg-white shadow-sm text-primary' : 'text-text-muted hover:text-text')}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Spinner className="text-primary" /></div>
      ) : (
        <>
          {/* Overview */}
          {tab === 'overview' && stock && (
            <div className="flex flex-col gap-3">
              <div className="bg-white border border-border rounded-2xl p-5">
                <div className="font-bold text-[15px] mb-4">Price Details</div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Current Price', value: `₦${stock.price.toFixed(2)}` },
                    { label: 'Change Today', value: `${up ? '+' : ''}${stock.change_pct.toFixed(2)}%`, color: up ? 'text-gain' : 'text-loss' },
                    { label: 'Change Amount', value: `${up ? '+' : ''}₦${(stock.change_amt ?? 0).toFixed(2)}`, color: up ? 'text-gain' : 'text-loss' },
                    { label: 'Volume Traded', value: stock.volume ? stock.volume.toLocaleString() : '—' },
                    { label: 'Market Cap', value: stock.market_cap ? `₦${(stock.market_cap / 1_000_000_000).toFixed(2)}B` : '—' },
                    { label: 'Last Updated', value: fmtTime(stock.last_updated) },
                  ].map(item => (
                    <div key={item.label} className="bg-gray-50 rounded-xl p-3">
                      <div className="text-[11px] text-text-muted uppercase tracking-wide font-bold mb-1">{item.label}</div>
                      <div className={cn('font-bold text-[16px]', item.color || 'text-text')}>{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white border border-border rounded-2xl p-5">
                <div className="font-bold text-[15px] mb-3">Community Sentiment</div>
                {posts.length === 0 ? (
                  <div className="text-text-muted text-[14px] text-center py-4">No posts mentioning {ticker} yet</div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="flex-1 bg-gray-100 rounded-full h-3 overflow-hidden">
                      <div className="h-full bg-gain rounded-full" style={{ width: '65%' }} />
                    </div>
                    <span className="text-[13px] font-bold text-gain">65% Bullish</span>
                  </div>
                )}
              </div>

              <div className="bg-primary-light border border-primary-border rounded-2xl p-4 flex items-center gap-3">
                <span className="text-2xl">💡</span>
                <div className="text-[13px] text-primary leading-relaxed">
                  <strong>Disclaimer:</strong> Gopexly provides market data for informational purposes only. This is not financial advice. Always do your own research before investing.
                </div>
              </div>
            </div>
          )}

          {/* Holders */}
          {tab === 'holders' && (
            holders.length === 0 ? (
              <div className="text-center py-12 text-text-muted">
                <div className="text-3xl mb-2">👥</div>
                <div className="text-[15px]">No Gopexly investors hold {ticker} yet</div>
                <div className="text-[13px] mt-1">Be the first — add it to your portfolio!</div>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {holders.map((h, i) => (
                  <div key={h.user_id} className="bg-white border border-border rounded-2xl p-4 flex items-center gap-3 hover:border-primary-border transition-all">
                    <div className="text-[16px] font-bold w-6 text-center text-text-muted">{i + 1}</div>
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-[#7c3aed] text-white flex items-center justify-center text-[12px] font-bold">
                      {h.profiles?.initials || h.profiles?.name?.charAt(0) || 'U'}
                    </div>
                    <div className="flex-1">
                      <div className="font-bold text-[14px]">{h.profiles?.name || 'Investor'}</div>
                      <div className="text-[12px] text-text-muted">@{h.profiles?.username} · {h.shares} shares</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-[14px]">₦{h.buy_price.toFixed(2)}</div>
                      <div className="text-[11px] text-text-muted">avg buy price</div>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {/* Posts */}
          {tab === 'posts' && (
            posts.length === 0 ? (
              <div className="text-center py-12 text-text-muted">
                <div className="text-3xl mb-2">💬</div>
                <div className="text-[15px]">No posts mentioning {ticker} yet</div>
                <div className="text-[13px] mt-1">Be the first to share your thoughts!</div>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {posts.map(p => (
                  <div key={p.id} className="bg-white border border-border rounded-2xl p-4 hover:border-primary-border transition-all">
                    <div className="flex items-center gap-2.5 mb-2.5">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-[#7c3aed] text-white flex items-center justify-center text-[11px] font-bold">
                        {p.profiles?.initials || 'U'}
                      </div>
                      <div>
                        <div className="font-bold text-[13px]">{p.profiles?.name}</div>
                        <div className="text-[11px] text-text-muted">{fmtTime(p.created_at)}</div>
                      </div>
                    </div>
                    <p className="text-[14px] text-text-secondary leading-relaxed line-clamp-3">{p.body}</p>
                    <div className="flex gap-4 mt-2 text-[12px] text-text-muted">
                      <span>❤️ {p.likes_count}</span>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </>
      )}

      <Toast {...toast} />
    </div>
  )
}
