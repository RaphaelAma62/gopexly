'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { fmtNaira, cn } from '@/lib/utils'
import { useAuth } from '@/lib/hooks/useAuth'
import { usePrices } from '@/lib/hooks/usePrices'
import { useToast } from '@/lib/hooks/useToast'
import { Toast, Spinner } from '@/components/ui'
import type { Holding, Goal } from '@/types'
import Link from 'next/link'

const COLORS = ['#1a6eff','#7c3aed','#059669','#d97706','#dc2626','#0891b2','#ea580c','#65a30d','#9333ea','#e11d48']

export default function PortfolioPage() {
  const sb = createClient()
  const { user } = useAuth()
  const { prices } = usePrices()
  const { toast, showToast } = useToast()

  const [holdings, setHoldings] = useState<Holding[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  // Form state
  const [ticker, setTicker] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [shares, setShares] = useState('')
  const [buyPrice, setBuyPrice] = useState('')
  const [tkResults, setTkResults] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  const tkTimer = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (!user) return
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  async function loadData() {
    if (!user) return
    const [h, g] = await Promise.all([
      sb.from('holdings').select('*').eq('user_id', user.id).order('created_at', { ascending: true }),
      sb.from('goals').select('*').eq('user_id', user.id)
    ])
    setHoldings((h.data || []) as Holding[])
    setGoals((g.data || []) as Goal[])
    setLoading(false)
  }

  // Computed values
  let totalMarket = 0, totalCost = 0
  holdings.forEach(h => {
    const mp = prices[h.ticker]?.price ?? h.buy_price
    totalMarket += h.shares * mp
    totalCost += h.shares * h.buy_price
  })
  const totalPl = totalMarket - totalCost
  const totalPlPct = totalCost > 0 ? (totalPl / totalCost * 100) : 0

  // Ticker autocomplete
  function searchTicker(q: string) {
    setTicker(q.toUpperCase())
    if (tkTimer.current) clearTimeout(tkTimer.current)
    if (!q) { setTkResults([]); return }
    tkTimer.current = setTimeout(() => {
      const upper = q.toUpperCase()
      setTkResults(Object.keys(prices).filter(t => t.startsWith(upper) || prices[t].company_name.toUpperCase().includes(upper)).slice(0, 10))
    }, 150)
  }

  function selectTicker(tk: string) {
    setTicker(tk)
    setCompanyName(prices[tk]?.company_name || tk)
    setBuyPrice(prices[tk]?.price.toFixed(2) || '')
    setTkResults([])
  }

  async function addHolding() {
    if (!user || !ticker || !shares || !buyPrice) { showToast('Please fill all fields', 'err'); return }
    const sharesNum = parseFloat(shares)
    const priceNum = parseFloat(buyPrice)
    if (isNaN(sharesNum) || sharesNum <= 0) { showToast('Invalid shares', 'err'); return }
    if (isNaN(priceNum) || priceNum <= 0) { showToast('Invalid price', 'err'); return }
    setSaving(true)
    const { data, error } = await sb.from('holdings').insert({
      user_id: user.id, ticker, company_name: companyName || ticker,
      shares: sharesNum, buy_price: priceNum
    }).select().single()
    if (error) { showToast('Error: ' + error.message, 'err'); setSaving(false); return }
    setHoldings(prev => [...prev, data as Holding])
    setTicker(''); setCompanyName(''); setShares(''); setBuyPrice('')
    setShowForm(false); setSaving(false)
    showToast(ticker + ' added to portfolio', 'ok')
  }

  async function removeHolding(id: string) {
    if (!confirm('Remove this holding?')) return
    await sb.from('holdings').delete().eq('id', id).eq('user_id', user?.id || '')
    setHoldings(prev => prev.filter(h => h.id !== id))
    showToast('Holding removed', 'ok')
  }

  return (
    <div className="max-w-[1100px] mx-auto">
      {/* Hero */}
      <div className="bg-gradient-to-r from-primary to-primary-dark text-white px-6 md:px-10 py-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="text-[10px] opacity-70 uppercase tracking-wide mb-1">Total Portfolio Value</div>
            <div className="font-display text-[36px] md:text-[42px] font-extrabold tracking-tight">
              {totalMarket > 0 ? fmtNaira(totalMarket) : '₦0.00'}
            </div>
            {totalCost > 0 && (
              <div className={cn('text-[13px] font-semibold mt-1 inline-block bg-white/15 px-3 py-1 rounded-full',)}>
                {totalPlPct >= 0 ? '▲ +' : '▼ '}{Math.abs(totalPlPct).toFixed(2)}% all-time
              </div>
            )}
          </div>
          <div className="flex gap-5">
            <div className="text-center">
              <div className="font-display text-[18px] font-extrabold">{holdings.length}</div>
              <div className="text-[9px] opacity-65 uppercase tracking-wide">Holdings</div>
            </div>
            <div className="text-center">
              <div className="font-display text-[18px] font-extrabold">
                {totalPlPct >= 0 ? '+' : ''}{totalPlPct.toFixed(2)}%
              </div>
              <div className="text-[9px] opacity-65 uppercase tracking-wide">Return</div>
            </div>
            <div className="text-center">
              <div className="font-display text-[18px] font-extrabold">{totalCost > 0 ? fmtNaira(totalCost) : '₦0'}</div>
              <div className="text-[9px] opacity-65 uppercase tracking-wide">Cost Basis</div>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 md:px-6 py-5">
        {/* Summary row */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="bg-surface border border-border rounded-xl p-4 text-center">
            <div className="font-display text-[17px] font-extrabold">{totalMarket > 0 ? fmtNaira(totalMarket) : '₦0'}</div>
            <div className="text-[10px] text-text-muted mt-1">Market Value</div>
          </div>
          <div className="bg-surface border border-border rounded-xl p-4 text-center">
            <div className={cn('font-display text-[17px] font-extrabold', totalPlPct >= 0 ? 'text-gain' : 'text-loss')}>
              {totalPlPct >= 0 ? '+' : ''}{totalPlPct.toFixed(2)}%
            </div>
            <div className="text-[10px] text-text-muted mt-1">Total Return</div>
          </div>
          <div className="bg-surface border border-border rounded-xl p-4 text-center">
            <div className="font-display text-[17px] font-extrabold text-amber">◌ Unverified</div>
            <div className="text-[10px] text-text-muted mt-1">Broker sync coming soon</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
          {/* Holdings */}
          <div>
            <div className="bg-surface border border-border rounded-2xl overflow-hidden mb-4">
              <div className="flex items-center justify-between px-4 py-3.5 border-b border-border">
                <div className="font-display text-[14px] font-extrabold">💼 My Holdings</div>
                <button onClick={() => setShowForm(p => !p)}
                  className="bg-primary text-white text-[12px] font-bold px-4 py-2 rounded-lg hover:bg-primary-dark transition-all">
                  + Add Holding
                </button>
              </div>

              {/* Add form */}
              {showForm && (
                <div className="bg-primary-light border-b-2 border-primary px-4 py-4">
                  <div className="text-[12px] font-bold text-primary mb-3">Add a new stock holding</div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                    {/* Ticker with autocomplete */}
                    <div className="relative">
                      <label className="block text-[9px] font-bold text-text-muted uppercase tracking-wide mb-1">Ticker Symbol</label>
                      <input value={ticker} onChange={e => searchTicker(e.target.value)}
                        placeholder="e.g. MTNN" autoComplete="off"
                        className="w-full bg-white border-[1.5px] border-border text-text px-3 py-2 rounded-lg text-[13px] outline-none focus:border-primary uppercase" />
                      {tkResults.length > 0 && (
                        <div className="absolute top-full left-0 right-0 bg-white border-[1.5px] border-border rounded-xl shadow-md z-50 max-h-[180px] overflow-y-auto mt-0.5">
                          {tkResults.map(tk => (
                            <button key={tk} onClick={() => selectTicker(tk)}
                              className="w-full flex items-center justify-between px-3 py-2 text-[12px] hover:bg-primary-light text-left">
                              <span className="font-bold text-primary">{tk}</span>
                              <span className="text-text-muted text-[11px]">{prices[tk]?.company_name}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-text-muted uppercase tracking-wide mb-1">Company</label>
                      <input value={companyName} onChange={e => setCompanyName(e.target.value)}
                        placeholder="Auto-filled" readOnly={!!prices[ticker]}
                        className="w-full bg-white border-[1.5px] border-border text-text px-3 py-2 rounded-lg text-[13px] outline-none focus:border-primary" />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-text-muted uppercase tracking-wide mb-1">Shares</label>
                      <input value={shares} onChange={e => setShares(e.target.value)} type="number" placeholder="100"
                        className="w-full bg-white border-[1.5px] border-border text-text px-3 py-2 rounded-lg text-[13px] outline-none focus:border-primary" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="block text-[9px] font-bold text-text-muted uppercase tracking-wide mb-1">Buy Price (₦/share)</label>
                      <input value={buyPrice} onChange={e => setBuyPrice(e.target.value)} type="number" placeholder="245.00"
                        className="w-full bg-white border-[1.5px] border-border text-text px-3 py-2 rounded-lg text-[13px] outline-none focus:border-primary" />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-text-muted uppercase tracking-wide mb-1">Cost Basis</label>
                      <div className="bg-gray-100 border border-border px-3 py-2 rounded-lg text-[13px] text-text-muted">
                        {shares && buyPrice ? fmtNaira(parseFloat(shares) * parseFloat(buyPrice)) : '₦0'}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setShowForm(false)} className="px-4 py-2 bg-gray-100 text-text-secondary rounded-lg text-[12px] font-semibold">Cancel</button>
                    <button onClick={addHolding} disabled={saving}
                      className="px-5 py-2 bg-primary text-white rounded-lg text-[12px] font-bold hover:bg-primary-dark disabled:opacity-50">
                      {saving ? 'Adding...' : 'Add to Portfolio'}
                    </button>
                  </div>
                </div>
              )}

              {/* Table header */}
              <div className="grid grid-cols-[1fr_90px_90px_80px_36px] gap-2 px-4 py-2 bg-gray-50 border-b border-border">
                {['Stock', 'Market Val', 'P&L', 'P&L %', ''].map(h => (
                  <div key={h} className="text-[9px] font-bold text-text-muted uppercase tracking-wide">{h}</div>
                ))}
              </div>

              {loading ? (
                <div className="flex justify-center py-10"><Spinner className="text-primary" /></div>
              ) : holdings.length === 0 ? (
                <div className="flex flex-col items-center py-12 text-text-muted">
                  <div className="text-4xl mb-3">💼</div>
                  <div className="text-[14px] font-semibold text-text-secondary mb-1">No holdings yet</div>
                  <div className="text-[12px]">Click &quot;Add Holding&quot; to start tracking your portfolio</div>
                </div>
              ) : (
                holdings.map(h => {
                  const mp = prices[h.ticker]?.price ?? h.buy_price
                  const mktVal = h.shares * mp
                  const costVal = h.shares * h.buy_price
                  const pl = mktVal - costVal
                  const plPct = costVal > 0 ? (pl / costVal * 100) : 0
                  const up = pl >= 0
                  return (
                    <div key={h.id} className="grid grid-cols-[1fr_90px_90px_80px_36px] gap-2 items-center px-4 py-3 border-b border-border last:border-0 hover:bg-gray-50 transition-colors">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-[9px] font-bold text-text-secondary">{h.ticker.slice(0, 4)}</div>
                        <div>
                          <div className="text-[12px] font-bold">{h.ticker}</div>
                          <div className="text-[10px] text-text-muted truncate max-w-[120px]">{h.company_name}</div>
                        </div>
                      </div>
                      <div className="text-[12px] font-bold">{fmtNaira(mktVal)}</div>
                      <div className={cn('text-[12px] font-bold', up ? 'text-gain' : 'text-loss')}>
                        {up ? '+' : ''}{fmtNaira(pl)}
                      </div>
                      <div className={cn('text-[11px] font-bold', up ? 'text-gain' : 'text-loss')}>
                        {up ? '+' : ''}{plPct.toFixed(2)}%
                      </div>
                      <button onClick={() => removeHolding(h.id)}
                        className="w-7 h-7 rounded-lg bg-loss-bg text-loss flex items-center justify-center text-[12px] hover:bg-loss hover:text-white transition-all">
                        ✕
                      </button>
                    </div>
                  )
                })
              )}
            </div>

            {/* Brokers */}
            <div className="bg-surface border border-border rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3.5 border-b border-border">
                <div className="font-display text-[14px] font-extrabold">🔒 Connect Brokerage</div>
                <span className="text-[11px] font-bold text-amber">Coming Soon</span>
              </div>
              <div className="grid grid-cols-3 gap-3 p-4">
                {['Bamboo', 'Trove', 'Chaka', 'Meristem', 'Afrinvest', 'Risevest'].map(b => (
                  <div key={b} className="bg-gray-50 border border-border rounded-xl p-3 text-center">
                    <div className="text-[12px] font-semibold mb-2">{b}</div>
                    <button disabled className="w-full bg-gray-200 text-text-muted text-[10px] font-bold py-1.5 rounded-lg cursor-not-allowed">🔒 Soon</button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right column */}
          <div className="flex flex-col gap-4">
            {/* Allocation donut */}
            <div className="bg-surface border border-border rounded-2xl overflow-hidden">
              <div className="px-4 py-3.5 border-b border-border">
                <div className="font-display text-[14px] font-extrabold">🥧 Allocation</div>
              </div>
              <div className="p-4">
                {holdings.length === 0 ? (
                  <div className="text-[12px] text-text-muted text-center py-4">Add holdings to see allocation</div>
                ) : (
                  <>
                    {/* Simple bar-based allocation */}
                    <div className="flex flex-col gap-2.5">
                      {holdings.map((h, i) => {
                        const mp = prices[h.ticker]?.price ?? h.buy_price
                        const val = h.shares * mp
                        const pct = totalMarket > 0 ? Math.round(val / totalMarket * 100) : 0
                        return (
                          <div key={h.id}>
                            <div className="flex justify-between text-[11px] mb-1">
                              <span className="font-semibold">{h.ticker}</span>
                              <span className="font-bold" style={{ color: COLORS[i % COLORS.length] }}>{pct}%</span>
                            </div>
                            <div className="bg-gray-200 rounded h-1.5">
                              <div className="h-full rounded transition-all" style={{ width: `${pct}%`, background: COLORS[i % COLORS.length] }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Goals */}
            <div className="bg-surface border border-border rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3.5 border-b border-border">
                <div className="font-display text-[14px] font-extrabold">🎯 Wealth Goals</div>
                <Link href="/profile" className="text-[11px] font-bold text-primary bg-primary-light border border-primary-border px-2.5 py-1 rounded-lg">Manage</Link>
              </div>
              <div className="p-4">
                {goals.length === 0 ? (
                  <div className="text-[12px] text-text-muted">
                    No goals set. <Link href="/profile" className="text-primary">Add goals in your profile.</Link>
                  </div>
                ) : goals.map(g => {
                  const pct = g.target_amount > 0 ? Math.min(Math.round(g.saved_amount / g.target_amount * 100), 100) : 0
                  const col = pct >= 70 ? '#16a34a' : pct >= 40 ? '#1a6eff' : '#d97706'
                  return (
                    <div key={g.id} className="mb-3 last:mb-0">
                      <div className="flex justify-between text-[12px] mb-1.5">
                        <span className="font-semibold">{g.icon} {g.name}</span>
                        <span className="font-bold" style={{ color: col }}>{pct}%</span>
                      </div>
                      <div className="bg-gray-200 rounded h-[5px] mb-1">
                        <div className="h-full rounded transition-all" style={{ width: `${pct}%`, background: col }} />
                      </div>
                      <div className="text-[10px] text-text-muted">
                        ₦{g.saved_amount.toLocaleString()} of ₦{g.target_amount.toLocaleString()}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      <Toast {...toast} />
    </div>
  )
}
