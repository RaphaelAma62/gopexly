'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'
import { usePrices } from '@/lib/hooks/usePrices'
import { useToast } from '@/lib/hooks/useToast'
import { Toast, Spinner, EmptyState } from '@/components/ui'
import { cn } from '@/lib/utils'

interface WatchlistItem {
  id: string
  user_id: string
  ticker: string
  company_name: string | null
  added_at: string
  notes: string | null
}

const FREE_LIMIT = 5

export default function Watchlist() {
  const sb = createClient()
  const { user } = useAuth()
  const { prices } = usePrices()
  const { toast, showToast } = useToast()

  const [items, setItems] = useState<WatchlistItem[]>([])
  const [loading, setLoading] = useState(true)
  const [tkQuery, setTkQuery] = useState('')
  const [tkResults, setTkResults] = useState<string[]>([])
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    if (!user) return
    loadWatchlist()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  async function loadWatchlist() {
    if (!user) return
    const { data } = await sb.from('watchlist').select('*').eq('user_id', user.id).order('added_at', { ascending: false })
    setItems((data || []) as WatchlistItem[])
    setLoading(false)
  }

  function searchTicker(q: string) {
    setTkQuery(q.toUpperCase())
    if (!q) { setTkResults([]); return }
    const upper = q.toUpperCase()
    setTkResults(
      Object.keys(prices)
        .filter(t => t.includes(upper) || prices[t].company_name.toUpperCase().includes(upper))
        .slice(0, 8)
    )
  }

  async function addToWatchlist(ticker: string) {
    if (!user) return
    if (items.length >= FREE_LIMIT) {
      showToast(`Free plan: max ${FREE_LIMIT} stocks. Upgrade to Pro for unlimited.`, 'err')
      return
    }
    if (items.find(i => i.ticker === ticker)) {
      showToast(`${ticker} is already in your watchlist`, 'err')
      return
    }
    setAdding(true)
    const { error } = await sb.from('watchlist').insert({
      user_id: user.id,
      ticker,
      company_name: prices[ticker]?.company_name || ticker,
      added_at: new Date().toISOString(),
    })
    if (error) { showToast('Error: ' + error.message, 'err'); setAdding(false); return }
    setTkQuery(''); setTkResults([])
    showToast(`${ticker} added to watchlist`, 'ok')
    loadWatchlist()
    setAdding(false)
  }

  async function removeFromWatchlist(id: string, ticker: string) {
    await sb.from('watchlist').delete().eq('id', id)
    setItems(prev => prev.filter(i => i.id !== id))
    showToast(`${ticker} removed`, 'ok')
  }

  const totalValue = items.reduce((sum, item) => {
    return sum + (prices[item.ticker]?.price ?? 0)
  }, 0)

  const gainers = items.filter(i => (prices[i.ticker]?.change_pct ?? 0) > 0).length
  const losers = items.filter(i => (prices[i.ticker]?.change_pct ?? 0) < 0).length

  return (
    <div className="max-w-[800px] mx-auto px-4 py-5 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="font-display text-[22px] font-extrabold">👁 My Watchlist</h1>
          <p className="text-[13px] text-text-muted mt-0.5">Track stocks before you invest</p>
        </div>
        <div className="text-right">
          <div className="text-[11px] text-text-muted">{items.length} / {FREE_LIMIT} stocks</div>
          <div className="w-24 h-1.5 bg-gray-200 rounded-full mt-1 overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${(items.length / FREE_LIMIT) * 100}%` }} />
          </div>
        </div>
      </div>

      {/* Stats row */}
      {items.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="bg-surface border border-border rounded-xl p-3.5 text-center">
            <div className="font-display text-[18px] font-extrabold">{items.length}</div>
            <div className="text-[10px] text-text-muted uppercase tracking-wide mt-0.5">Watching</div>
          </div>
          <div className="bg-gain-bg border border-gain-border rounded-xl p-3.5 text-center">
            <div className="font-display text-[18px] font-extrabold text-gain">▲ {gainers}</div>
            <div className="text-[10px] text-text-muted uppercase tracking-wide mt-0.5">Up Today</div>
          </div>
          <div className="bg-loss-bg border border-loss-border rounded-xl p-3.5 text-center">
            <div className="font-display text-[18px] font-extrabold text-loss">▼ {losers}</div>
            <div className="text-[10px] text-text-muted uppercase tracking-wide mt-0.5">Down Today</div>
          </div>
        </div>
      )}

      {/* Add stock */}
      {items.length < FREE_LIMIT && (
        <div className="bg-surface border-2 border-dashed border-border rounded-2xl p-4 mb-5 relative">
          <div className="text-[12px] font-bold text-text-muted mb-2">Add NGX Stock</div>
          <input
            value={tkQuery}
            onChange={e => searchTicker(e.target.value)}
            placeholder="Search ticker or company name e.g. MTNN, Dangote..."
            className="w-full bg-gray-50 border-[1.5px] border-border text-text px-3.5 py-2.5 rounded-xl text-[13px] outline-none focus:border-primary uppercase placeholder:normal-case placeholder:text-text-muted"
            disabled={adding}
          />
          {tkResults.length > 0 && (
            <div className="absolute left-4 right-4 bg-white border-[1.5px] border-border rounded-xl shadow-lg z-10 max-h-[220px] overflow-y-auto mt-1">
              {tkResults.map(tk => {
                const up = (prices[tk]?.change_pct ?? 0) >= 0
                const alreadyAdded = items.some(i => i.ticker === tk)
                return (
                  <button key={tk} onClick={() => addToWatchlist(tk)} disabled={alreadyAdded}
                    className={cn('w-full flex items-center justify-between px-4 py-3 text-left border-b border-border last:border-0 transition-colors',
                      alreadyAdded ? 'opacity-40 cursor-not-allowed' : 'hover:bg-primary-light')}>
                    <div>
                      <span className="font-extrabold text-primary font-mono text-[13px]">{tk}</span>
                      <span className="text-text-muted text-[12px] ml-2">{prices[tk]?.company_name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] font-bold">₦{prices[tk]?.price.toFixed(2)}</span>
                      <span className={cn('text-[11px] font-bold px-2 py-0.5 rounded-full', up ? 'bg-gain-bg text-gain' : 'bg-loss-bg text-loss')}>
                        {up ? '+' : ''}{prices[tk]?.change_pct.toFixed(2)}%
                      </span>
                      {alreadyAdded && <span className="text-[11px] text-text-muted">Added</span>}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Upgrade nudge */}
      {items.length >= FREE_LIMIT && (
        <div className="bg-gradient-to-r from-purple/10 to-primary/10 border border-primary-border rounded-2xl p-4 mb-5 flex items-center gap-3">
          <span className="text-2xl">👑</span>
          <div className="flex-1">
            <div className="font-bold text-[13px]">Watchlist full — upgrade to Pro</div>
            <div className="text-[12px] text-text-secondary">Pro gives you unlimited stocks on your watchlist</div>
          </div>
          <button className="bg-primary text-white text-[12px] font-bold px-4 py-2 rounded-xl hover:bg-primary-dark transition-all flex-shrink-0">
            Upgrade
          </button>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-12"><Spinner className="text-primary" /></div>
      ) : items.length === 0 ? (
        <EmptyState icon="👁" title="Your watchlist is empty" subtitle="Search for NGX stocks above to start watching them" />
      ) : (
        <div className="flex flex-col gap-2.5">
          {items.map(item => {
            const p = prices[item.ticker]
            const up = (p?.change_pct ?? 0) >= 0
            const flat = (p?.change_pct ?? 0) === 0
            return (
              <div key={item.id}
                className="bg-surface border border-border rounded-2xl p-4 hover:border-primary-border hover:shadow-sm transition-all">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center text-[11px] font-extrabold border',
                      up ? 'bg-gain-bg border-gain-border text-gain' : flat ? 'bg-gray-100 border-gray-200 text-text-muted' : 'bg-loss-bg border-loss-border text-loss')}>
                      {up ? '▲' : flat ? '●' : '▼'}
                    </div>
                    <div>
                      <div className="font-extrabold font-mono text-[15px] text-primary">{item.ticker}</div>
                      <div className="text-[12px] text-text-muted truncate max-w-[180px]">{item.company_name}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-display text-[18px] font-extrabold">
                      {p ? `₦${p.price.toFixed(2)}` : '—'}
                    </div>
                    {p && (
                      <div className={cn('text-[12px] font-bold', up ? 'text-gain' : flat ? 'text-text-muted' : 'text-loss')}>
                        {up ? '+' : ''}{p.change_pct.toFixed(2)}%
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                  <div className="text-[11px] text-text-muted">Added {new Date(item.added_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })}</div>
                  <button onClick={() => removeFromWatchlist(item.id, item.ticker)}
                    className="text-[11px] font-semibold text-loss bg-loss-bg px-2.5 py-1 rounded-lg hover:bg-loss hover:text-white transition-all">
                    Remove
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Toast {...toast} />
    </div>
  )
}
