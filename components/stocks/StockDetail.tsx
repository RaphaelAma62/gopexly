'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'
import { usePrices } from '@/lib/hooks/usePrices'
import { useToast } from '@/lib/hooks/useToast'
import { Toast, Spinner } from '@/components/ui'
import { cn, fmtTime } from '@/lib/utils'
import Link from 'next/link'

interface StockDetailProps { ticker: string }
interface HolderRow {
  user_id: string; shares: number; buy_price: number
  profiles: { name: string | null; initials: string | null; username: string | null } | null
}
interface PostRow {
  id: string; body: string; created_at: string; likes_count: number
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
  const [inPortfolio, setInPortfolio] = useState(false)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'overview' | 'holders' | 'posts'>('overview')

  const stock = prices[ticker]
  const up   = (stock?.change_pct ?? 0) > 0
  const flat = (stock?.change_pct ?? 0) === 0
  const down = (stock?.change_pct ?? 0) < 0

  useEffect(() => {
    if (!ticker) return
    loadData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticker, user?.id])

  async function loadData() {
    const [holdersRes, postsRes, watchRes, portRes] = await Promise.all([
      sb.from('holdings')
        .select('user_id,shares,buy_price,profiles!holdings_user_id_fkey(name,initials,username)')
        .eq('ticker', ticker).limit(20),
      sb.from('posts')
        .select('id,body,created_at,likes_count,profiles!posts_user_id_fkey(name,initials)')
        .ilike('body', `%${ticker}%`)
        .order('created_at', { ascending: false }).limit(15),
      user ? sb.from('watchlist').select('id').eq('user_id', user.id).eq('ticker', ticker).maybeSingle() : Promise.resolve({ data: null }),
      user ? sb.from('holdings').select('id').eq('user_id', user.id).eq('ticker', ticker).maybeSingle() : Promise.resolve({ data: null }),
    ])
    setHolders((holdersRes.data || []) as unknown as HolderRow[])
    setPosts((postsRes.data || []) as unknown as PostRow[])
    setInWatchlist(!!watchRes.data)
    setInPortfolio(!!portRes.data)
    setLoading(false)
  }

  async function toggleWatchlist() {
    if (!user) return
    if (inWatchlist) {
      await sb.from('watchlist').delete().eq('user_id', user.id).eq('ticker', ticker)
      setInWatchlist(false)
      showToast(`${ticker} removed from watchlist`, 'ok')
    } else {
      const { error } = await sb.from('watchlist').insert({ user_id: user.id, ticker, company_name: stock?.company_name || ticker, added_at: new Date().toISOString() })
      if (error && error.code === '23505') { showToast('Already in watchlist', ''); return }
      setInWatchlist(true)
      showToast(`${ticker} added to watchlist 👁`, 'ok')
    }
  }

  const bullishCount = posts.filter(p => !p.body.toLowerCase().includes('sell') && !p.body.toLowerCase().includes('avoid')).length
  const bullishPct   = posts.length > 0 ? Math.round((bullishCount / posts.length) * 100) : 0

  return (
    <div className="min-h-screen bg-[#f4f6fb] pb-20">

      {/* ── HERO ──────────────────────────────────── */}
      <div className={cn('text-white',
        up   ? 'bg-gradient-to-br from-[#0f172a] via-[#064e3b] to-[#0f172a]' :
        down ? 'bg-gradient-to-br from-[#0f172a] via-[#7f1d1d] to-[#0f172a]' :
               'bg-gradient-to-br from-[#0f172a] via-[#1e1b4b] to-[#0f172a]')}>
        <div className="max-w-[800px] mx-auto px-5 py-8">

          {/* Breadcrumb */}
          <Link href="/market" className="inline-flex items-center gap-1.5 text-[13px] text-white/50 hover:text-white/80 transition-colors mb-6 font-medium">
            ← Market
          </Link>

          <div className="flex items-start justify-between gap-4 mb-6">
            <div>
              {/* Ticker + company */}
              <div className="flex items-center gap-3 mb-1">
                <div className="font-extrabold font-mono text-[36px] md:text-[44px] tracking-tight leading-none">{ticker}</div>
                {inPortfolio && (
                  <span className="text-[11px] bg-gain/30 border border-gain/40 text-green-300 px-2.5 py-1 rounded-full font-bold">✓ In Portfolio</span>
                )}
              </div>
              <div className="text-white/60 text-[15px]">{stock?.company_name || ticker}</div>
            </div>

            {/* Watch button */}
            <button onClick={toggleWatchlist}
              className={cn('flex items-center gap-2 px-5 py-2.5 rounded-xl text-[14px] font-bold transition-all border flex-shrink-0',
                inWatchlist
                  ? 'bg-white/20 border-white/30 text-white hover:bg-white/30'
                  : 'bg-white text-[#0f172a] border-white hover:bg-white/90 shadow-md')}>
              {inWatchlist ? '✓ Watching' : '+ Watch'}
            </button>
          </div>

          {stock ? (
            <>
              {/* Price + change */}
              <div className="flex items-end gap-4 mb-6">
                <div className="font-display text-[52px] md:text-[64px] font-black leading-none">
                  ₦{stock.price.toFixed(2)}
                </div>
                <div className="pb-2">
                  <div className={cn('text-[18px] font-extrabold', up ? 'text-green-300' : down ? 'text-red-300' : 'text-white/60')}>
                    {up ? '▲ +' : down ? '▼ ' : ''}{Math.abs(stock.change_pct).toFixed(2)}%
                  </div>
                  {stock.change_amt !== undefined && (
                    <div className={cn('text-[14px] font-medium', up ? 'text-green-400' : down ? 'text-red-400' : 'text-white/40')}>
                      {up ? '+' : down ? '' : ''}₦{Math.abs(stock.change_amt).toFixed(2)} today
                    </div>
                  )}
                </div>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                {[
                  { label: 'Volume',       value: stock.volume ? (stock.volume >= 1_000_000 ? `${(stock.volume / 1_000_000).toFixed(1)}M` : `${(stock.volume / 1_000).toFixed(0)}K`) : '—' },
                  { label: 'Market Cap',   value: stock.market_cap ? `₦${(stock.market_cap / 1_000_000_000).toFixed(1)}B` : '—' },
                  { label: 'Holders',      value: `${holders.length} investors` },
                  { label: 'Last Updated', value: stock.last_updated ? fmtTime(stock.last_updated) : '—' },
                ].map(s => (
                  <div key={s.label} className="bg-white/10 border border-white/15 rounded-2xl px-4 py-3">
                    <div className="text-[10px] text-white/50 uppercase tracking-widest font-bold mb-1">{s.label}</div>
                    <div className="font-bold text-[14px] text-white">{s.value}</div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="text-white/50 text-[15px]">Loading price data...</div>
          )}
        </div>
      </div>

      <div className="max-w-[800px] mx-auto px-5 py-5">

        {/* ── TABS ──────────────────────────────────── */}
        <div className="flex gap-1 bg-white border border-border p-1 rounded-2xl mb-5 shadow-sm">
          {[
            { key: 'overview', label: '📊 Overview' },
            { key: 'holders',  label: `👥 Holders (${holders.length})` },
            { key: 'posts',    label: `💬 Mentions (${posts.length})` },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key as typeof tab)}
              className={cn('flex-1 py-2.5 rounded-xl text-[13px] font-bold transition-all',
                tab === t.key ? 'bg-primary text-white shadow-sm' : 'text-text-muted hover:text-text')}>
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" className="text-primary" /></div>
        ) : (
          <>
            {/* ── OVERVIEW ───────────────────────────── */}
            {tab === 'overview' && stock && (
              <div className="flex flex-col gap-4">

                {/* Price analysis */}
                <div className="bg-white border border-border rounded-2xl p-5 shadow-sm">
                  <div className="font-display text-[16px] font-extrabold mb-4">Price Analysis</div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {[
                      { label: 'Current Price',  value: `₦${stock.price.toFixed(2)}`,                                 color: 'text-text' },
                      { label: 'Change %',        value: `${up ? '+' : ''}${stock.change_pct.toFixed(2)}%`,            color: up ? 'text-gain' : down ? 'text-loss' : 'text-text-muted' },
                      { label: 'Change ₦',        value: `${up ? '+' : ''}₦${(stock.change_amt ?? 0).toFixed(2)}`,    color: up ? 'text-gain' : down ? 'text-loss' : 'text-text-muted' },
                      { label: 'Volume',          value: stock.volume ? `${(stock.volume / 1_000).toFixed(0)}K shares` : '—', color: 'text-text' },
                      { label: 'Market Cap',      value: stock.market_cap ? `₦${(stock.market_cap / 1_000_000_000).toFixed(2)}B` : '—', color: 'text-text' },
                      { label: 'Last Updated',    value: stock.last_updated ? fmtTime(stock.last_updated) : '—',      color: 'text-text-muted' },
                    ].map(item => (
                      <div key={item.label} className="bg-gray-50 border border-border rounded-xl p-3.5">
                        <div className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-1.5">{item.label}</div>
                        <div className={cn('font-extrabold text-[16px]', item.color)}>{item.value}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Today's momentum */}
                <div className="bg-white border border-border rounded-2xl p-5 shadow-sm">
                  <div className="font-display text-[16px] font-extrabold mb-4">Today&apos;s Momentum</div>
                  <div className="flex items-center gap-4 mb-3">
                    <div className={cn('text-[40px] font-black', up ? 'text-gain' : down ? 'text-loss' : 'text-text-muted')}>
                      {up ? '📈' : down ? '📉' : '➡️'}
                    </div>
                    <div>
                      <div className={cn('font-display text-[22px] font-extrabold', up ? 'text-gain' : down ? 'text-loss' : 'text-text-muted')}>
                        {up ? 'Positive Day' : down ? 'Negative Day' : 'Flat Day'}
                      </div>
                      <div className="text-[13px] text-text-muted">
                        {ticker} is {up ? `up ${stock.change_pct.toFixed(2)}% today` : down ? `down ${Math.abs(stock.change_pct).toFixed(2)}% today` : 'unchanged today'}
                      </div>
                    </div>
                  </div>
                  {/* Momentum bar */}
                  <div className="bg-gray-100 rounded-full h-3 overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all', up ? 'bg-gain' : down ? 'bg-loss' : 'bg-gray-400')}
                      style={{ width: `${Math.min(Math.abs(stock.change_pct) / 10 * 100, 100)}%`, marginLeft: down ? 'auto' : undefined }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] text-text-muted mt-1.5">
                    <span>-10%</span><span>0%</span><span>+10%</span>
                  </div>
                </div>

                {/* Community sentiment */}
                {posts.length > 0 && (
                  <div className="bg-white border border-border rounded-2xl p-5 shadow-sm">
                    <div className="font-display text-[16px] font-extrabold mb-4">Community Sentiment</div>
                    <div className="flex items-center gap-4 mb-3">
                      <div className="flex-1">
                        <div className="flex justify-between text-[13px] font-semibold mb-2">
                          <span className="text-gain">Bullish {bullishPct}%</span>
                          <span className="text-loss">Bearish {100 - bullishPct}%</span>
                        </div>
                        <div className="bg-loss-bg rounded-full h-3 overflow-hidden">
                          <div className="h-full bg-gain rounded-full transition-all" style={{ width: `${bullishPct}%` }} />
                        </div>
                      </div>
                    </div>
                    <div className="text-[12px] text-text-muted">Based on {posts.length} post{posts.length !== 1 ? 's' : ''} mentioning {ticker}</div>
                  </div>
                )}

                {/* Disclaimer */}
                <div className="bg-amber-bg border border-amber/30 rounded-2xl p-4 flex gap-3">
                  <span className="text-xl flex-shrink-0">⚠️</span>
                  <div className="text-[13px] text-amber leading-relaxed">
                    <strong>Disclaimer:</strong> This data is for informational purposes only and does not constitute financial advice. Past performance does not guarantee future results. Always conduct your own research before investing.
                  </div>
                </div>
              </div>
            )}

            {/* ── HOLDERS ───────────────────────────── */}
            {tab === 'holders' && (
              holders.length === 0 ? (
                <div className="bg-white border border-border rounded-2xl flex flex-col items-center justify-center py-16 text-center shadow-sm">
                  <div className="text-5xl mb-4">👥</div>
                  <div className="font-display text-[20px] font-extrabold mb-2">No investors yet</div>
                  <div className="text-[14px] text-text-muted mb-5">Be the first Gopexly investor to hold {ticker}</div>
                  <Link href="/portfolio" className="bg-primary text-white font-bold px-6 py-3 rounded-xl text-[14px] hover:bg-primary-dark">
                    Add to Portfolio
                  </Link>
                </div>
              ) : (
                <div className="flex flex-col gap-2.5">
                  {holders.map((h, i) => {
                    const currentPrice = prices[ticker]?.price ?? h.buy_price
                    const pl      = (currentPrice - h.buy_price) * h.shares
                    const plPct   = ((currentPrice - h.buy_price) / h.buy_price * 100)
                    const isProfit = pl >= 0
                    return (
                      <div key={h.user_id} className="bg-white border border-border rounded-2xl p-4 flex items-center gap-4 hover:border-primary-border hover:shadow-sm transition-all">
                        <div className="text-[16px] font-extrabold text-text-muted w-6 text-center flex-shrink-0">
                          {i + 1 === 1 ? '🥇' : i + 1 === 2 ? '🥈' : i + 1 === 3 ? '🥉' : `#${i + 1}`}
                        </div>
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-[#7c3aed] text-white flex items-center justify-center text-[13px] font-extrabold flex-shrink-0">
                          {h.profiles?.initials || h.profiles?.name?.charAt(0) || 'U'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-[15px]">{h.profiles?.name || 'Investor'}</div>
                          <div className="text-[12px] text-text-muted">@{h.profiles?.username} · {h.shares.toLocaleString()} shares @ ₦{h.buy_price.toFixed(2)}</div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className={cn('font-extrabold text-[15px]', isProfit ? 'text-gain' : 'text-loss')}>
                            {isProfit ? '+' : ''}₦{Math.abs(pl).toFixed(0)}
                          </div>
                          <div className={cn('text-[12px] font-semibold', isProfit ? 'text-gain' : 'text-loss')}>
                            {isProfit ? '+' : ''}{plPct.toFixed(2)}%
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            )}

            {/* ── POSTS ──────────────────────────────── */}
            {tab === 'posts' && (
              posts.length === 0 ? (
                <div className="bg-white border border-border rounded-2xl flex flex-col items-center justify-center py-16 text-center shadow-sm">
                  <div className="text-5xl mb-4">💬</div>
                  <div className="font-display text-[20px] font-extrabold mb-2">No posts mentioning {ticker} yet</div>
                  <div className="text-[14px] text-text-muted mb-5">Share your thoughts on this stock</div>
                  <Link href="/home" className="bg-primary text-white font-bold px-6 py-3 rounded-xl text-[14px] hover:bg-primary-dark">
                    Post about {ticker}
                  </Link>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {posts.map(p => (
                    <div key={p.id} className="bg-white border border-border rounded-2xl p-4 hover:border-primary-border hover:shadow-sm transition-all">
                      <div className="flex items-center gap-2.5 mb-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-[#7c3aed] text-white flex items-center justify-center text-[12px] font-bold flex-shrink-0">
                          {p.profiles?.initials || 'U'}
                        </div>
                        <div>
                          <div className="font-bold text-[14px]">{p.profiles?.name || 'Investor'}</div>
                          <div className="text-[12px] text-text-muted">{fmtTime(p.created_at)}</div>
                        </div>
                      </div>
                      <p className="text-[14px] text-text-secondary leading-relaxed line-clamp-3">{p.body}</p>
                      <div className="flex gap-4 mt-3 pt-3 border-t border-border text-[12px] text-text-muted">
                        <span>❤️ {p.likes_count} likes</span>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
          </>
        )}
      </div>

      <Toast {...toast} />
    </div>
  )
}