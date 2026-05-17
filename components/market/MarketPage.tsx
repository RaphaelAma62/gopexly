'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { fmtTime, cn } from '@/lib/utils'
import { Spinner } from '@/components/ui'
import type { StockPrice } from '@/types'

export default function MarketPage() {
  const sb = createClient()
  const [stocks, setStocks] = useState<StockPrice[]>([])
  const [filtered, setFiltered] = useState<StockPrice[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<StockPrice | null>(null)
  const [lastUpdated, setLastUpdated] = useState('')
  const PER = 20

  const loadPrices = useCallback(async () => {
    const { data } = await sb.from('stock_prices').select('*').order('ticker')
    if (data) {
      setStocks(data as StockPrice[])
      setFiltered(data as StockPrice[])
      if (data[0]?.last_updated) {
        const mins = Math.floor((Date.now() - new Date(data[0].last_updated).getTime()) / 60000)
        setLastUpdated(mins < 2 ? 'Just now' : `${mins}m ago`)
      }
    }
    setLoading(false)
  }, [sb])

  useEffect(() => { loadPrices(); const t = setInterval(loadPrices, 10 * 60 * 1000); return () => clearInterval(t) }, [loadPrices])

  function filterStocks(q: string) {
    setSearch(q); setPage(1)
    if (!q) { setFiltered(stocks); return }
    const u = q.toUpperCase()
    setFiltered(stocks.filter(s => s.ticker.includes(u) || (s.company_name?.toUpperCase().includes(u))))
  }

  const gainers = stocks.filter(s => (s.change_pct ?? 0) > 0).sort((a, b) => (b.change_pct ?? 0) - (a.change_pct ?? 0)).slice(0, 7)
  const losers = stocks.filter(s => (s.change_pct ?? 0) < 0).sort((a, b) => (a.change_pct ?? 0) - (b.change_pct ?? 0)).slice(0, 7)
  const gainCount = stocks.filter(s => (s.change_pct ?? 0) > 0).length
  const lossCount = stocks.filter(s => (s.change_pct ?? 0) < 0).length
  const flatCount = stocks.filter(s => (s.change_pct ?? 0) === 0).length
  const avgChg = stocks.length ? stocks.reduce((a, s) => a + (s.change_pct ?? 0), 0) / stocks.length : 0
  const fg = stocks.length ? Math.round(gainCount / stocks.length * 100) : 50
  const fgLabel = fg >= 80 ? 'Extreme Greed' : fg >= 60 ? 'Greed' : fg >= 40 ? 'Neutral' : fg >= 20 ? 'Fear' : 'Extreme Fear'
  const fgColor = fg >= 60 ? 'text-gain' : fg >= 40 ? 'text-amber' : 'text-loss'

  const paged = filtered.slice((page - 1) * PER, page * PER)
  const pages = Math.ceil(filtered.length / PER)

  // Ticker tape
  const tapeStocks = stocks.slice(0, 40)

  return (
    <div className="max-w-[1280px] mx-auto px-5 pb-16">
      {/* Ticker tape */}
      <div className="bg-gray-900 -mx-5 px-0 overflow-hidden mb-6">
        <div className="flex whitespace-nowrap animate-[scroll-left_60s_linear_infinite] hover:[animation-play-state:paused]"
          style={{ animation: 'scrollLeft 60s linear infinite' }}>
          {[...tapeStocks, ...tapeStocks].map((s, i) => {
            const up = (s.change_pct ?? 0) >= 0
            return (
              <div key={i} className="inline-flex items-center gap-2 px-5 py-2">
                <span className="font-bold text-white text-[12px]">{s.ticker}</span>
                <span className="text-white/70 text-[12px]">₦{(s.price ?? 0).toFixed(2)}</span>
                <span className={cn('text-[12px] font-semibold', up ? 'text-green-400' : 'text-red-400')}>
                  {up ? '▲' : '▼'} {Math.abs(s.change_pct ?? 0).toFixed(2)}%
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h1 className="font-display text-[22px] font-extrabold">NGX Market Overview</h1>
          <p className="text-[12px] text-text-muted">Updated {lastUpdated || '...'} · {stocks.length} stocks tracked</p>
        </div>
        <button onClick={loadPrices} className="bg-primary-light border border-primary-border text-primary text-[12px] font-bold px-3.5 py-2 rounded-lg hover:bg-primary hover:text-white transition-all">
          ↻ Refresh
        </button>
      </div>

      {/* Overview cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="text-[10px] font-bold text-text-muted uppercase tracking-wide mb-1.5">NGX Avg Change</div>
          <div className={cn('font-display text-[20px] font-extrabold', avgChg >= 0 ? 'text-gain' : 'text-loss')}>
            {avgChg >= 0 ? '+' : ''}{avgChg.toFixed(2)}%
          </div>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="text-[10px] font-bold text-text-muted uppercase tracking-wide mb-1.5">Gainers / Losers</div>
          <div className="font-display text-[20px] font-extrabold">
            <span className="text-gain">{gainCount}</span>
            <span className="text-text-muted text-[16px]"> / </span>
            <span className="text-loss">{lossCount}</span>
          </div>
          <div className="text-[11px] text-text-muted">{flatCount} unchanged</div>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="text-[10px] font-bold text-text-muted uppercase tracking-wide mb-1.5">Stocks Tracked</div>
          <div className="font-display text-[20px] font-extrabold">{stocks.length}</div>
          <div className="text-[11px] text-gain">● Auto-refreshing</div>
        </div>
        <div className="bg-surface border border-border rounded-xl p-4">
          <div className="text-[10px] font-bold text-text-muted uppercase tracking-wide mb-1.5">Fear &amp; Greed</div>
          <div className={cn('font-display text-[20px] font-extrabold', fgColor)}>{fg}</div>
          <div className={cn('text-[11px] font-bold', fgColor)}>{fgLabel}</div>
        </div>
      </div>

      {/* Top Movers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {[{ title: '▲ Top Gainers', data: gainers, up: true }, { title: '▼ Top Losers', data: losers, up: false }].map(col => (
          <div key={col.title} className="bg-surface border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <span className={cn('font-display text-[13px] font-extrabold', col.up ? 'text-gain' : 'text-loss')}>{col.title}</span>
            </div>
            <div>
              {col.data.map((s, i) => (
                <div key={s.ticker} onClick={() => setSelected(s)}
                  className="flex items-center gap-3 px-4 py-2.5 border-b border-border last:border-0 cursor-pointer hover:bg-primary-light transition-colors">
                  <span className="text-[11px] text-text-muted w-4">{i + 1}</span>
                  <span className="text-[12px] font-extrabold font-mono w-[70px] text-primary">{s.ticker}</span>
                  <span className="text-[11px] text-text-secondary flex-1 truncate">{s.company_name}</span>
                  <span className="text-[12px] font-bold">₦{(s.price ?? 0).toFixed(2)}</span>
                  <span className={cn('text-[11px] font-bold w-14 text-right', col.up ? 'text-gain' : 'text-loss')}>
                    {col.up ? '+' : ''}{(s.change_pct ?? 0).toFixed(2)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* All stocks */}
      <div className="font-display text-[16px] font-extrabold mb-3">All NGX Stocks</div>
      <input value={search} onChange={e => filterStocks(e.target.value)}
        placeholder="Search by ticker or company name..."
        className="w-full bg-surface border-[1.5px] border-border text-text px-3.5 py-2.5 rounded-xl text-[14px] outline-none focus:border-primary mb-3 transition-colors" />

      {loading ? (
        <div className="flex justify-center py-16"><Spinner size="lg" className="text-primary" /></div>
      ) : (
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[80px_1fr_100px_80px_80px] gap-2 px-4 py-2.5 bg-gray-50 border-b border-border">
            {['Ticker', 'Company', 'Price', 'Change', 'Updated'].map(h => (
              <div key={h} className="text-[10px] font-bold text-text-muted uppercase tracking-wide">{h}</div>
            ))}
          </div>
          {paged.map(s => {
            const up = (s.change_pct ?? 0) > 0
            const flat = (s.change_pct ?? 0) === 0
            return (
              <div key={s.ticker} onClick={() => setSelected(s)}
                className="grid grid-cols-[80px_1fr_100px_80px_80px] gap-2 items-center px-4 py-3 border-b border-border last:border-0 cursor-pointer hover:bg-primary-light transition-colors">
                <div className="text-[12px] font-extrabold font-mono text-primary">{s.ticker}</div>
                <div className="text-[12px] text-text-secondary truncate">{s.company_name || '—'}</div>
                <div className="text-[12px] font-bold">₦{(s.price ?? 0).toFixed(2)}</div>
                <div>
                  <span className={cn('text-[11px] font-bold px-2 py-0.5 rounded-full',
                    flat ? 'bg-gray-100 text-text-muted' : up ? 'bg-gain-bg text-gain' : 'bg-loss-bg text-loss')}>
                    {up ? '+' : ''}{(s.change_pct ?? 0).toFixed(2)}%
                  </span>
                </div>
                <div className="text-[11px] text-text-muted">{fmtTime(s.last_updated)}</div>
              </div>
            )
          })}

          {/* Pagination */}
          {pages > 1 && (
            <div className="flex justify-center gap-1.5 p-3 border-t border-border">
              {page > 1 && <button onClick={() => setPage(p => p - 1)} className="w-8 h-8 rounded-lg bg-gray-100 text-[12px] font-bold hover:bg-primary hover:text-white transition-all">‹</button>}
              {Array.from({ length: Math.min(5, pages) }, (_, i) => {
                const n = Math.max(1, Math.min(page - 2, pages - 4)) + i
                return (
                  <button key={n} onClick={() => setPage(n)}
                    className={cn('w-8 h-8 rounded-lg text-[12px] font-bold transition-all', n === page ? 'bg-primary text-white' : 'bg-gray-100 hover:bg-primary hover:text-white')}>
                    {n}
                  </button>
                )
              })}
              {page < pages && <button onClick={() => setPage(p => p + 1)} className="w-8 h-8 rounded-lg bg-gray-100 text-[12px] font-bold hover:bg-primary hover:text-white transition-all">›</button>}
            </div>
          )}
        </div>
      )}

      {/* Detail panel */}
      {selected && (
        <div className="fixed inset-0 bg-black/30 z-50 flex justify-end" onClick={e => { if (e.target === e.currentTarget) setSelected(null) }}>
          <div className="bg-white w-full max-w-[380px] h-full overflow-y-auto p-6 shadow-xl">
            <button onClick={() => setSelected(null)} className="float-right bg-gray-100 rounded-lg w-7 h-7 text-[12px] mb-4 hover:bg-gray-200">✕</button>
            <div className="clear-both">
              <div className="font-display text-[24px] font-extrabold mb-0.5">{selected.ticker}</div>
              <div className="text-[13px] text-text-secondary mb-4">{selected.company_name}</div>
              <div className="font-display text-[32px] font-extrabold mb-1">₦{(selected.price ?? 0).toFixed(2)}</div>
              <div className={cn('text-[14px] font-bold mb-5', (selected.change_pct ?? 0) >= 0 ? 'text-gain' : 'text-loss')}>
                {(selected.change_pct ?? 0) >= 0 ? '▲ +' : '▼ '}{Math.abs(selected.change_pct ?? 0).toFixed(2)}%
                {' '}(₦{Math.abs(selected.change_amt ?? 0).toFixed(2)})
              </div>
              <div className="grid grid-cols-2 gap-3 mb-5">
                {[
                  { label: 'Prev Close', value: selected.prev_close ? `₦${selected.prev_close.toFixed(2)}` : '—' },
                  { label: 'Change ₦', value: `${(selected.change_amt ?? 0) >= 0 ? '+' : ''}₦${(selected.change_amt ?? 0).toFixed(2)}` },
                  { label: 'Volume', value: selected.volume ? selected.volume.toLocaleString() : '—' },
                  { label: 'Market Cap', value: selected.market_cap || '—' },
                ].map(item => (
                  <div key={item.label} className="bg-gray-50 rounded-xl p-3">
                    <div className="text-[9px] font-bold text-text-muted uppercase tracking-wide mb-1">{item.label}</div>
                    <div className="text-[14px] font-bold">{item.value}</div>
                  </div>
                ))}
              </div>
              <div className="text-[12px] text-text-muted leading-relaxed">
                NGX listed stock. Price data updated automatically from the Nigerian Exchange Group every 10 minutes.
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes scrollLeft {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  )
}
