'use client'

import { useState } from 'react'
import { usePrices } from '@/lib/hooks/usePrices'
import { useProStatus } from '@/lib/hooks/useProStatus'
import ProGate from '@/components/pro/ProGate'
import { cn } from '@/lib/utils'
import Link from 'next/link'

type SortKey = 'ticker' | 'price' | 'change_pct' | 'volume' | 'market_cap'
type Signal = 'all' | 'buy' | 'sell' | 'hold'

export default function StockScreener() {
  const { prices } = usePrices()
  const { isPro, settings } = useProStatus()
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('change_pct')
  const [sortAsc, setSortAsc] = useState(false)
  const [signal, setSignal] = useState<Signal>('all')
  const [minPrice, setMinPrice] = useState('')
  const [maxPrice, setMaxPrice] = useState('')

  // Gate check
  if (!isPro || !settings.pro_feature_screener) {
    return (
      <div className="max-w-[680px] mx-auto px-4 py-5">
        <ProGate
          feature="Stock Screener"
          description="Filter and screen all 124 NGX stocks by price, volume, market cap, and momentum signals to find your next investment."
          icon="📊"
          freeLimit="Not available"
          proLimit="Full access"
        />
      </div>
    )
  }

  function getSignal(changePct: number): string {
    if (changePct > 5) return 'strong_buy'
    if (changePct > 2) return 'buy'
    if (changePct < -5) return 'strong_sell'
    if (changePct < -2) return 'sell'
    return 'hold'
  }

  const allStocks = Object.entries(prices).map(([ticker, data]) => ({
    ticker, ...data, signal: getSignal(data.change_pct ?? 0)
  }))

  const filtered = allStocks.filter(s => {
    if (search && !s.ticker.includes(search.toUpperCase()) && !s.company_name.toUpperCase().includes(search.toUpperCase())) return false
    if (minPrice && s.price < parseFloat(minPrice)) return false
    if (maxPrice && s.price > parseFloat(maxPrice)) return false
    if (signal !== 'all') {
      if (signal === 'buy' && !s.signal.includes('buy')) return false
      if (signal === 'sell' && !s.signal.includes('sell')) return false
      if (signal === 'hold' && s.signal !== 'hold') return false
    }
    return true
  }).sort((a, b) => {
    const av = (a as Record<string, unknown>)[sortKey] ?? 0
    const bv = (b as Record<string, unknown>)[sortKey] ?? 0
    if (typeof av === 'string') return sortAsc ? av.localeCompare(bv as string) : (bv as string).localeCompare(av)
    return sortAsc ? (av as number) - (bv as number) : (bv as number) - (av as number)
  })

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(p => !p)
    else { setSortKey(key); setSortAsc(false) }
  }

  const signalStyle: Record<string, string> = {
    strong_buy: 'bg-gain text-white',
    buy: 'bg-gain-bg text-gain border border-gain-border',
    strong_sell: 'bg-loss text-white',
    sell: 'bg-loss-bg text-loss border border-loss-border',
    hold: 'bg-gray-100 text-text-muted',
  }

  return (
    <div className="max-w-[900px] mx-auto px-4 py-5 pb-20">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber to-yellow-400 flex items-center justify-center text-[20px] shadow-sm">📊</div>
        <div>
          <h1 className="font-display text-[22px] font-extrabold flex items-center gap-2">
            Stock Screener <span className="text-[11px] bg-amber text-white px-2 py-0.5 rounded-full font-bold">PRO</span>
          </h1>
          <p className="text-[13px] text-text-muted">{filtered.length} of {allStocks.length} stocks</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-border rounded-2xl p-4 mb-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="col-span-2">
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search ticker or company..."
              className="w-full bg-gray-50 border-[1.5px] border-border text-text px-3.5 py-2.5 rounded-xl text-[14px] outline-none focus:border-primary uppercase placeholder:normal-case placeholder:text-text-muted" />
          </div>
          <input value={minPrice} onChange={e => setMinPrice(e.target.value)} type="number" placeholder="Min Price (₦)"
            className="bg-gray-50 border-[1.5px] border-border text-text px-3.5 py-2.5 rounded-xl text-[13px] outline-none focus:border-primary" />
          <input value={maxPrice} onChange={e => setMaxPrice(e.target.value)} type="number" placeholder="Max Price (₦)"
            className="bg-gray-50 border-[1.5px] border-border text-text px-3.5 py-2.5 rounded-xl text-[13px] outline-none focus:border-primary" />
        </div>

        {/* Signal filter */}
        <div className="flex gap-2 mt-3 flex-wrap">
          {(['all', 'buy', 'sell', 'hold'] as Signal[]).map(s => (
            <button key={s} onClick={() => setSignal(s)}
              className={cn('px-3.5 py-1.5 rounded-full text-[12px] font-bold border transition-all capitalize',
                signal === s ? 'bg-primary text-white border-primary' : 'bg-gray-50 border-border text-text-muted hover:border-primary-border hover:text-primary')}>
              {s === 'all' ? 'All Signals' : s === 'buy' ? '📈 Buy' : s === 'sell' ? '📉 Sell' : '⏸ Hold'}
            </button>
          ))}
          <button onClick={() => { setSearch(''); setMinPrice(''); setMaxPrice(''); setSignal('all') }}
            className="px-3.5 py-1.5 rounded-full text-[12px] font-bold text-loss bg-loss-bg border border-loss-border hover:bg-loss hover:text-white transition-all ml-auto">
            Clear Filters
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-border rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-border">
              {[
                { key: 'ticker', label: 'Stock' },
                { key: 'price', label: 'Price' },
                { key: 'change_pct', label: 'Change' },
                { key: 'volume', label: 'Volume' },
                { key: 'market_cap', label: 'Mkt Cap' },
                { key: null, label: 'Signal' },
              ].map(h => (
                <th key={h.label}
                  onClick={() => h.key && toggleSort(h.key as SortKey)}
                  className={cn('text-left px-4 py-3 text-[11px] font-bold text-text-muted uppercase tracking-wide select-none',
                    h.key ? 'cursor-pointer hover:text-primary' : '')}>
                  {h.label}
                  {h.key === sortKey && <span className="ml-1">{sortAsc ? '▲' : '▼'}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 50).map(s => {
              const up = (s.change_pct ?? 0) >= 0
              return (
                <tr key={s.ticker} className="border-b border-border last:border-0 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/stocks/${s.ticker}`} className="hover:text-primary transition-colors">
                      <div className="font-extrabold font-mono text-[14px] text-primary">{s.ticker}</div>
                      <div className="text-[11px] text-text-muted truncate max-w-[120px]">{s.company_name}</div>
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-bold text-[14px]">₦{s.price.toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <span className={cn('font-bold text-[13px]', up ? 'text-gain' : 'text-loss')}>
                      {up ? '+' : ''}{(s.change_pct ?? 0).toFixed(2)}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[13px] text-text-muted">{(s as unknown as {volume?: number}).volume ? ((s as unknown as {volume: number}).volume / 1000).toFixed(0) + 'K' : '—'}</td>
                  <td className="px-4 py-3 text-[13px] text-text-muted">{(s as unknown as {market_cap?: number}).market_cap ? `₦${((s as unknown as {market_cap: number}).market_cap / 1_000_000_000).toFixed(1)}B` : '—'}</td>
                  <td className="px-4 py-3">
                    <span className={cn('text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase', signalStyle[s.signal])}>
                      {s.signal.replace('_', ' ')}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-text-muted">
            <div className="text-3xl mb-2">🔍</div>
            <div className="text-[14px]">No stocks match your filters</div>
          </div>
        )}
      </div>
    </div>
  )
}
