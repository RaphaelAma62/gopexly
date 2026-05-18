'use client'

import { useState, useMemo } from 'react'
import { usePrices } from '@/lib/hooks/usePrices'
import { useProStatus } from '@/lib/hooks/useProStatus'
import ProGate from '@/components/pro/ProGate'
import { cn } from '@/lib/utils'
import Link from 'next/link'

type SortKey = 'ticker' | 'price' | 'change_pct' | 'volume' | 'market_cap'
type SignalFilter = 'all' | 'buy' | 'sell' | 'hold'

interface ScreenerStock {
  ticker: string
  company_name: string
  price: number
  change_pct: number
  change_amt: number
  volume?: number
  market_cap?: number
  signal: 'strong_buy' | 'buy' | 'hold' | 'sell' | 'strong_sell'
}

function getSignal(changePct: number): ScreenerStock['signal'] {
  if (changePct > 5)  return 'strong_buy'
  if (changePct > 2)  return 'buy'
  if (changePct < -5) return 'strong_sell'
  if (changePct < -2) return 'sell'
  return 'hold'
}

const SIGNAL_CONFIG = {
  strong_buy:  { label: 'Strong Buy',  color: 'bg-gain text-white',                     dot: 'bg-gain' },
  buy:         { label: 'Buy',         color: 'bg-gain-bg text-gain border border-gain-border', dot: 'bg-gain' },
  hold:        { label: 'Hold',        color: 'bg-gray-100 text-text-muted',             dot: 'bg-gray-400' },
  sell:        { label: 'Sell',        color: 'bg-loss-bg text-loss border border-loss-border', dot: 'bg-loss' },
  strong_sell: { label: 'Strong Sell', color: 'bg-loss text-white',                      dot: 'bg-loss' },
}

export default function StockScreener() {
  const { prices, loading: pricesLoading } = usePrices()
  const { isPro, settings, loading: proLoading } = useProStatus()

  const [search, setSearch]         = useState('')
  const [sortKey, setSortKey]       = useState<SortKey>('change_pct')
  const [sortAsc, setSortAsc]       = useState(false)
  const [signal, setSignal]         = useState<SignalFilter>('all')
  const [minPrice, setMinPrice]     = useState('')
  const [maxPrice, setMaxPrice]     = useState('')
  const [minVol, setMinVol]         = useState('')
  const [showFilters, setShowFilters] = useState(false)

  if (proLoading || pricesLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <div className="text-[15px] text-text-muted font-medium">Loading market data...</div>
        </div>
      </div>
    )
  }

  if (!isPro || !settings.pro_feature_screener) {
    return (
      <div className="min-h-[calc(100vh-60px)] flex flex-col">
        {/* Blurred preview */}
        <div className="relative overflow-hidden flex-1">
          <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 flex items-center justify-center">
            <ProGate
              feature="Stock Screener"
              description="Filter and screen all 124 NGX stocks by price range, volume, market cap, and momentum signals to find your next investment opportunity."
              icon="📊"
              freeLimit="Not available"
              proLimit="Full access"
            />
          </div>
          {/* Fake blurred table behind paywall */}
          <div className="p-5 opacity-30 pointer-events-none select-none">
            <div className="h-12 bg-gray-100 rounded-2xl mb-4" />
            <div className="flex gap-2 mb-4">{[1,2,3,4].map(i => <div key={i} className="h-9 w-24 bg-gray-100 rounded-full"/>)}</div>
            {[...Array(8)].map((_, i) => <div key={i} className="h-14 bg-gray-50 border border-border rounded-xl mb-2" />)}
          </div>
        </div>
      </div>
    )
  }

  // Build stocks array
  const allStocks: ScreenerStock[] = Object.entries(prices).map(([ticker, data]) => ({
    ticker,
    company_name: data.company_name,
    price:        data.price,
    change_pct:   data.change_pct,
    change_amt:   data.change_amt ?? 0,
    volume:       data.volume,
    market_cap:   data.market_cap,
    signal:       getSignal(data.change_pct),
  }))

  // Filter + sort (memoised)
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const filtered = useMemo(() => {
    return allStocks
      .filter(s => {
        if (search) {
          const q = search.toUpperCase()
          if (!s.ticker.includes(q) && !s.company_name.toUpperCase().includes(q)) return false
        }
        if (minPrice && s.price < parseFloat(minPrice)) return false
        if (maxPrice && s.price > parseFloat(maxPrice)) return false
        if (minVol && s.volume && s.volume < parseFloat(minVol) * 1000) return false
        if (signal !== 'all') {
          if (signal === 'buy'  && !s.signal.includes('buy'))  return false
          if (signal === 'sell' && !s.signal.includes('sell')) return false
          if (signal === 'hold' && s.signal !== 'hold')        return false
        }
        return true
      })
      .sort((a, b) => {
        const av = (a as Record<string, unknown>)[sortKey] ?? 0
        const bv = (b as Record<string, unknown>)[sortKey] ?? 0
        if (typeof av === 'string') return sortAsc ? (av as string).localeCompare(bv as string) : (bv as string).localeCompare(av as string)
        return sortAsc ? (av as number) - (bv as number) : (bv as number) - (av as number)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allStocks, search, minPrice, maxPrice, minVol, signal, sortKey, sortAsc])

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(p => !p)
    else { setSortKey(key); setSortAsc(false) }
  }

  function clearFilters() {
    setSearch(''); setMinPrice(''); setMaxPrice(''); setMinVol(''); setSignal('all')
  }

  const hasFilters = search || minPrice || maxPrice || minVol || signal !== 'all'
  const gainers    = allStocks.filter(s => s.change_pct > 0).length
  const losers     = allStocks.filter(s => s.change_pct < 0).length
  const strongBuys = allStocks.filter(s => s.signal === 'strong_buy').length

  return (
    <div className="min-h-screen bg-[#f4f6fb] pb-20">

      {/* ── HERO ─────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-[#0f172a] via-[#1e1b4b] to-[#0f4dd4] text-white px-5 py-10">
        <div className="max-w-[1100px] mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber to-yellow-400 flex items-center justify-center text-[24px] shadow-lg">📊</div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-display text-[26px] font-extrabold">NGX Stock Screener</h1>
                <span className="text-[11px] bg-amber text-[#0f172a] px-2.5 py-1 rounded-full font-extrabold">PRO</span>
              </div>
              <p className="text-white/60 text-[14px]">Filter, sort and analyse all {allStocks.length} NGX-listed stocks</p>
            </div>
          </div>

          {/* Market summary pills */}
          <div className="flex flex-wrap gap-2.5">
            {[
              { icon: '📈', label: 'Total Stocks',   value: allStocks.length.toString(),    color: 'bg-white/10 border-white/20' },
              { icon: '▲',  label: 'Gainers Today',  value: gainers.toString(),              color: 'bg-gain/20 border-gain/30' },
              { icon: '▼',  label: 'Losers Today',   value: losers.toString(),               color: 'bg-loss/20 border-loss/30' },
              { icon: '🚀', label: 'Strong Buy',      value: strongBuys.toString(),           color: 'bg-amber/20 border-amber/30' },
              { icon: '🔍', label: 'Showing',         value: filtered.length.toString(),      color: 'bg-primary/30 border-primary/40' },
            ].map(s => (
              <div key={s.label} className={cn('flex items-center gap-2 border rounded-xl px-3.5 py-2', s.color)}>
                <span className="text-[15px]">{s.icon}</span>
                <div>
                  <div className="font-extrabold text-[16px] leading-none">{s.value}</div>
                  <div className="text-[10px] text-white/60 uppercase tracking-wide">{s.label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-[1100px] mx-auto px-5 py-5">

        {/* ── FILTER BAR ───────────────────────────────── */}
        <div className="bg-white border border-border rounded-2xl p-4 mb-4 shadow-sm">
          {/* Search + toggle */}
          <div className="flex items-center gap-3 mb-3">
            <div className="relative flex-1">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted text-[16px]">🔍</span>
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search by ticker or company name..."
                className="w-full bg-gray-50 border-2 border-border text-text pl-10 pr-4 py-2.5 rounded-xl text-[14px] outline-none focus:border-primary focus:bg-white transition-all uppercase placeholder:normal-case placeholder:text-text-muted"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text text-[14px]">✕</button>
              )}
            </div>
            <button onClick={() => setShowFilters(p => !p)}
              className={cn('flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 text-[13px] font-bold transition-all whitespace-nowrap',
                showFilters ? 'bg-primary text-white border-primary' : 'bg-gray-50 border-border text-text-muted hover:border-primary-border hover:text-primary')}>
              ⚙ Filters {hasFilters && <span className="w-5 h-5 bg-white/30 rounded-full text-[10px] flex items-center justify-center">!</span>}
            </button>
            {hasFilters && (
              <button onClick={clearFilters} className="px-3.5 py-2.5 rounded-xl text-[13px] font-bold text-loss bg-loss-bg border border-loss-border hover:bg-loss hover:text-white transition-all whitespace-nowrap">
                Clear
              </button>
            )}
          </div>

          {/* Signal chips */}
          <div className="flex gap-2 flex-wrap">
            {([
              { key: 'all',  label: 'All Signals',   icon: '📊' },
              { key: 'buy',  label: 'Buy Signals',   icon: '📈' },
              { key: 'sell', label: 'Sell Signals',  icon: '📉' },
              { key: 'hold', label: 'Hold',          icon: '⏸' },
            ] as { key: SignalFilter; label: string; icon: string }[]).map(s => (
              <button key={s.key} onClick={() => setSignal(s.key)}
                className={cn('flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[13px] font-semibold border transition-all',
                  signal === s.key ? 'bg-primary text-white border-primary shadow-sm' : 'bg-gray-50 border-border text-text-muted hover:border-primary-border hover:text-primary')}>
                {s.icon} {s.label}
              </button>
            ))}
          </div>

          {/* Advanced filters */}
          {showFilters && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-4 pt-4 border-t border-border">
              <div>
                <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wide mb-1.5">Min Price (₦)</label>
                <input value={minPrice} onChange={e => setMinPrice(e.target.value)} type="number" placeholder="0"
                  className="w-full bg-gray-50 border-2 border-border text-text px-3.5 py-2.5 rounded-xl text-[14px] outline-none focus:border-primary" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wide mb-1.5">Max Price (₦)</label>
                <input value={maxPrice} onChange={e => setMaxPrice(e.target.value)} type="number" placeholder="∞"
                  className="w-full bg-gray-50 border-2 border-border text-text px-3.5 py-2.5 rounded-xl text-[14px] outline-none focus:border-primary" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wide mb-1.5">Min Volume (K shares)</label>
                <input value={minVol} onChange={e => setMinVol(e.target.value)} type="number" placeholder="0"
                  className="w-full bg-gray-50 border-2 border-border text-text px-3.5 py-2.5 rounded-xl text-[14px] outline-none focus:border-primary" />
              </div>
            </div>
          )}
        </div>

        {/* ── TABLE ─────────────────────────────────────── */}
        <div className="bg-white border border-border rounded-2xl overflow-hidden shadow-sm">
          {/* Table header */}
          <div className="grid grid-cols-[2fr_1.2fr_1.2fr_1fr_1.2fr_1fr] bg-gray-50 border-b border-border px-5 py-3">
            {[
              { key: 'ticker',     label: 'Stock' },
              { key: 'price',      label: 'Price' },
              { key: 'change_pct', label: 'Change' },
              { key: 'volume',     label: 'Volume' },
              { key: 'market_cap', label: 'Mkt Cap' },
              { key: null,         label: 'Signal' },
            ].map(col => (
              <button key={col.label}
                onClick={() => col.key && toggleSort(col.key as SortKey)}
                className={cn('text-left text-[11px] font-extrabold text-text-muted uppercase tracking-wider flex items-center gap-1',
                  col.key ? 'hover:text-primary cursor-pointer select-none' : 'cursor-default')}>
                {col.label}
                {col.key === sortKey && <span className="text-primary">{sortAsc ? '▲' : '▼'}</span>}
              </button>
            ))}
          </div>

          {/* Rows */}
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-text-muted">
              <div className="text-5xl mb-4">🔍</div>
              <div className="font-display text-[18px] font-extrabold mb-2">No stocks match your filters</div>
              <div className="text-[14px] mb-4">Try adjusting your search or clearing filters</div>
              <button onClick={clearFilters} className="bg-primary text-white font-bold px-5 py-2.5 rounded-xl text-[14px] hover:bg-primary-dark">
                Clear All Filters
              </button>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.slice(0, 100).map(s => {
                const up   = s.change_pct >= 0
                const flat = s.change_pct === 0
                const sig  = SIGNAL_CONFIG[s.signal]
                return (
                  <Link key={s.ticker} href={`/stocks/${s.ticker}`}
                    className="grid grid-cols-[2fr_1.2fr_1.2fr_1fr_1.2fr_1fr] px-5 py-4 hover:bg-primary-light transition-colors group items-center">

                    {/* Stock */}
                    <div className="flex items-center gap-3">
                      <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center text-[11px] font-extrabold border flex-shrink-0',
                        up ? 'bg-gain-bg border-gain-border text-gain' : flat ? 'bg-gray-100 border-gray-200 text-text-muted' : 'bg-loss-bg border-loss-border text-loss')}>
                        {up ? '▲' : flat ? '●' : '▼'}
                      </div>
                      <div>
                        <div className="font-extrabold font-mono text-[14px] text-primary group-hover:text-primary-dark">{s.ticker}</div>
                        <div className="text-[11px] text-text-muted truncate max-w-[140px]">{s.company_name}</div>
                      </div>
                    </div>

                    {/* Price */}
                    <div>
                      <div className="font-bold text-[15px]">₦{s.price.toFixed(2)}</div>
                      {s.change_amt !== 0 && (
                        <div className={cn('text-[11px] font-medium', up ? 'text-gain' : 'text-loss')}>
                          {up ? '+' : ''}₦{s.change_amt.toFixed(2)}
                        </div>
                      )}
                    </div>

                    {/* Change % */}
                    <div className={cn('font-extrabold text-[15px]', up ? 'text-gain' : flat ? 'text-text-muted' : 'text-loss')}>
                      {up ? '+' : ''}{s.change_pct.toFixed(2)}%
                    </div>

                    {/* Volume */}
                    <div className="text-[13px] text-text-muted">
                      {s.volume ? (s.volume >= 1_000_000 ? `${(s.volume / 1_000_000).toFixed(1)}M` : `${(s.volume / 1_000).toFixed(0)}K`) : '—'}
                    </div>

                    {/* Market cap */}
                    <div className="text-[13px] text-text-muted">
                      {s.market_cap ? `₦${(s.market_cap / 1_000_000_000).toFixed(1)}B` : '—'}
                    </div>

                    {/* Signal */}
                    <div>
                      <span className={cn('inline-flex items-center gap-1.5 text-[11px] font-extrabold px-2.5 py-1.5 rounded-full', sig.color)}>
                        <span className={cn('w-1.5 h-1.5 rounded-full inline-block', sig.dot)} />
                        {sig.label}
                      </span>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}

          {/* Footer */}
          {filtered.length > 0 && (
            <div className="px-5 py-3.5 bg-gray-50 border-t border-border flex items-center justify-between">
              <div className="text-[13px] text-text-muted">
                Showing <strong>{Math.min(filtered.length, 100)}</strong> of <strong>{filtered.length}</strong> stocks
              </div>
              <div className="text-[12px] text-text-muted">
                Signals based on today&apos;s price movement · Not financial advice
              </div>
            </div>
          )}
        </div>

        {/* Signal legend */}
        <div className="mt-4 bg-white border border-border rounded-2xl p-4">
          <div className="text-[11px] font-bold text-text-muted uppercase tracking-widest mb-3">Signal Guide</div>
          <div className="flex flex-wrap gap-3">
            {Object.entries(SIGNAL_CONFIG).map(([key, cfg]) => (
              <div key={key} className="flex items-center gap-2">
                <span className={cn('text-[11px] font-bold px-2.5 py-1 rounded-full', cfg.color)}>{cfg.label}</span>
                <span className="text-[12px] text-text-muted">
                  {key === 'strong_buy' ? '>+5%' : key === 'buy' ? '+2% to +5%' : key === 'hold' ? '-2% to +2%' : key === 'sell' ? '-5% to -2%' : '<-5%'}
                </span>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-text-muted mt-3 italic">⚠ Signals are based on daily price movement only and are not financial advice. Always conduct your own research before investing.</p>
        </div>

      </div>
    </div>
  )
}