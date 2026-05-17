'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'
import { usePrices } from '@/lib/hooks/usePrices'
import { useToast } from '@/lib/hooks/useToast'
import { Toast, Spinner, EmptyState } from '@/components/ui'
import { cn } from '@/lib/utils'

interface PriceAlert {
  id: string
  user_id: string
  ticker: string
  company_name: string | null
  target_price: number
  condition: 'above' | 'below'
  is_triggered: boolean
  created_at: string
}

const FREE_LIMIT = 1

export default function PriceAlerts() {
  const sb = createClient()
  const { user } = useAuth()
  const { prices } = usePrices()
  const { toast, showToast } = useToast()

  const [alerts, setAlerts] = useState<PriceAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [tkQuery, setTkQuery] = useState('')
  const [tkResults, setTkResults] = useState<string[]>([])
  const [selectedTicker, setSelectedTicker] = useState('')
  const [targetPrice, setTargetPrice] = useState('')
  const [condition, setCondition] = useState<'above' | 'below'>('above')
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    if (!user) return
    loadAlerts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  // Check if any alerts are triggered
  useEffect(() => {
    if (!alerts.length || !Object.keys(prices).length) return
    alerts.forEach(alert => {
      if (alert.is_triggered) return
      const currentPrice = prices[alert.ticker]?.price
      if (!currentPrice) return
      const triggered =
        (alert.condition === 'above' && currentPrice >= alert.target_price) ||
        (alert.condition === 'below' && currentPrice <= alert.target_price)
      if (triggered) {
        triggerAlert(alert, currentPrice)
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prices])

  async function loadAlerts() {
    if (!user) return
    const { data } = await sb.from('price_alerts').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
    setAlerts((data || []) as PriceAlert[])
    setLoading(false)
  }

  async function triggerAlert(alert: PriceAlert, currentPrice: number) {
    await sb.from('price_alerts').update({ is_triggered: true }).eq('id', alert.id)
    setAlerts(prev => prev.map(a => a.id === alert.id ? { ...a, is_triggered: true } : a))
    showToast(`🔔 ${alert.ticker} hit ₦${currentPrice.toFixed(2)}! Your alert triggered.`, 'ok')
  }

  function searchTicker(q: string) {
    setTkQuery(q.toUpperCase())
    if (!q) { setTkResults([]); return }
    const upper = q.toUpperCase()
    setTkResults(Object.keys(prices).filter(t => t.includes(upper) || prices[t].company_name.toUpperCase().includes(upper)).slice(0, 8))
  }

  function selectTicker(ticker: string) {
    setSelectedTicker(ticker)
    setTargetPrice(prices[ticker]?.price.toFixed(2) || '')
    setTkQuery(ticker)
    setTkResults([])
  }

  async function createAlert() {
    if (!user || !selectedTicker || !targetPrice) { showToast('Please fill all fields', 'err'); return }
    const activeAlerts = alerts.filter(a => !a.is_triggered)
    if (activeAlerts.length >= FREE_LIMIT) {
      showToast(`Free plan: ${FREE_LIMIT} active alert only. Upgrade to Pro for unlimited.`, 'err')
      return
    }
    setSaving(true)
    const { error } = await sb.from('price_alerts').insert({
      user_id: user.id,
      ticker: selectedTicker,
      company_name: prices[selectedTicker]?.company_name || selectedTicker,
      target_price: parseFloat(targetPrice),
      condition,
      is_triggered: false,
    })
    if (error) { showToast('Error: ' + error.message, 'err'); setSaving(false); return }
    setSelectedTicker(''); setTargetPrice(''); setTkQuery('')
    setShowForm(false); setSaving(false)
    showToast('Price alert created!', 'ok')
    loadAlerts()
  }

  async function deleteAlert(id: string) {
    await sb.from('price_alerts').delete().eq('id', id)
    setAlerts(prev => prev.filter(a => a.id !== id))
    showToast('Alert deleted', 'ok')
  }

  const activeAlerts = alerts.filter(a => !a.is_triggered)
  const triggeredAlerts = alerts.filter(a => a.is_triggered)

  return (
    <div className="max-w-[680px] mx-auto px-4 py-5 pb-20">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="font-display text-[22px] font-extrabold">🔔 Price Alerts</h1>
          <p className="text-[13px] text-text-muted mt-0.5">Get notified when stocks hit your target</p>
        </div>
        {activeAlerts.length < FREE_LIMIT && (
          <button onClick={() => setShowForm(p => !p)}
            className="bg-primary text-white text-[13px] font-bold px-4 py-2.5 rounded-xl hover:bg-primary-dark transition-all">
            + New Alert
          </button>
        )}
      </div>

      {/* Free limit banner */}
      <div className="bg-primary-light border border-primary-border rounded-2xl p-3.5 mb-5 flex items-center gap-3">
        <span className="text-xl">💡</span>
        <div className="flex-1">
          <div className="text-[12px] font-bold text-primary">Free Plan: {activeAlerts.length}/{FREE_LIMIT} active alert</div>
          <div className="text-[11px] text-text-secondary">Upgrade to Pro for unlimited alerts on any stock</div>
        </div>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-surface border-2 border-primary-border rounded-2xl p-5 mb-5 shadow-sm">
          <div className="font-display text-[14px] font-extrabold mb-4">Create Price Alert</div>
          <div className="flex flex-col gap-3">
            <div className="relative">
              <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wide mb-1.5">Stock</label>
              <input value={tkQuery} onChange={e => searchTicker(e.target.value)}
                placeholder="Search ticker e.g. MTNN, GTCO..."
                className="w-full bg-gray-50 border-[1.5px] border-border text-text px-3.5 py-2.5 rounded-xl text-[13px] outline-none focus:border-primary uppercase placeholder:normal-case placeholder:text-text-muted" />
              {tkResults.length > 0 && (
                <div className="absolute left-0 right-0 top-full bg-white border-[1.5px] border-border rounded-xl shadow-lg z-10 max-h-[200px] overflow-y-auto mt-1">
                  {tkResults.map(tk => (
                    <button key={tk} onClick={() => selectTicker(tk)}
                      className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-primary-light border-b border-border last:border-0 transition-colors">
                      <span className="font-bold text-primary font-mono">{tk}</span>
                      <span className="text-text-muted text-[12px]">₦{prices[tk]?.price.toFixed(2)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wide mb-1.5">Condition</label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button onClick={() => setCondition('above')}
                    className={cn('py-2.5 rounded-xl text-[12px] font-bold border transition-all', condition === 'above' ? 'bg-gain-bg border-gain-border text-gain' : 'bg-gray-50 border-border text-text-muted')}>
                    ▲ Above
                  </button>
                  <button onClick={() => setCondition('below')}
                    className={cn('py-2.5 rounded-xl text-[12px] font-bold border transition-all', condition === 'below' ? 'bg-loss-bg border-loss-border text-loss' : 'bg-gray-50 border-border text-text-muted')}>
                    ▼ Below
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wide mb-1.5">Target Price (₦)</label>
                <input value={targetPrice} onChange={e => setTargetPrice(e.target.value)} type="number" step="0.01" placeholder="0.00"
                  className="w-full bg-gray-50 border-[1.5px] border-border text-text px-3.5 py-2.5 rounded-xl text-[13px] outline-none focus:border-primary" />
              </div>
            </div>

            {selectedTicker && prices[selectedTicker] && (
              <div className="bg-gray-50 rounded-xl p-3 text-[12px] text-text-secondary">
                Current price of <strong>{selectedTicker}</strong>: ₦{prices[selectedTicker].price.toFixed(2)} &nbsp;·&nbsp;
                Alert triggers when price goes <strong>{condition}</strong> ₦{targetPrice || '—'}
              </div>
            )}

            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 bg-gray-100 text-text-secondary rounded-xl text-[13px] font-semibold">Cancel</button>
              <button onClick={createAlert} disabled={saving || !selectedTicker || !targetPrice}
                className="px-5 py-2 bg-primary text-white rounded-xl text-[13px] font-bold hover:bg-primary-dark disabled:opacity-50">
                {saving ? 'Creating...' : 'Create Alert'}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Spinner className="text-primary" /></div>
      ) : alerts.length === 0 ? (
        <EmptyState icon="🔔" title="No price alerts yet" subtitle="Create an alert to be notified when a stock hits your target price" />
      ) : (
        <div className="flex flex-col gap-3">
          {/* Active alerts */}
          {activeAlerts.length > 0 && (
            <div>
              <div className="font-display text-[12px] font-extrabold text-text-muted uppercase tracking-wide mb-2">Active</div>
              {activeAlerts.map(alert => {
                const currentPrice = prices[alert.ticker]?.price ?? 0
                const up = alert.condition === 'above'
                const progress = alert.condition === 'above'
                  ? Math.min((currentPrice / alert.target_price) * 100, 100)
                  : Math.min((alert.target_price / Math.max(currentPrice, 0.01)) * 100, 100)

                return (
                  <div key={alert.id} className="bg-surface border border-border rounded-2xl p-4 mb-2 hover:border-primary-border transition-all">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold font-mono text-[15px] text-primary">{alert.ticker}</span>
                          <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', up ? 'bg-gain-bg text-gain' : 'bg-loss-bg text-loss')}>
                            {up ? '▲ Above' : '▼ Below'} ₦{alert.target_price.toFixed(2)}
                          </span>
                        </div>
                        <div className="text-[11px] text-text-muted mt-0.5">{alert.company_name}</div>
                      </div>
                      <button onClick={() => deleteAlert(alert.id)}
                        className="text-[11px] text-loss bg-loss-bg px-2.5 py-1 rounded-lg hover:bg-loss hover:text-white transition-all">
                        Delete
                      </button>
                    </div>
                    <div className="flex items-center justify-between text-[12px] mb-2">
                      <span className="text-text-muted">Current: <strong>₦{currentPrice.toFixed(2)}</strong></span>
                      <span className="text-text-muted">Target: <strong className={up ? 'text-gain' : 'text-loss'}>₦{alert.target_price.toFixed(2)}</strong></span>
                    </div>
                    <div className="bg-gray-200 rounded-full h-1.5 overflow-hidden">
                      <div className={cn('h-full rounded-full transition-all', up ? 'bg-gain' : 'bg-loss')} style={{ width: `${Math.min(progress, 100)}%` }} />
                    </div>
                    <div className="text-[10px] text-text-muted mt-1">{Math.round(progress)}% of the way to target</div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Triggered alerts */}
          {triggeredAlerts.length > 0 && (
            <div>
              <div className="font-display text-[12px] font-extrabold text-text-muted uppercase tracking-wide mb-2">Triggered</div>
              {triggeredAlerts.map(alert => (
                <div key={alert.id} className="bg-gray-50 border border-border rounded-2xl p-4 mb-2 opacity-70">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">✅</span>
                      <div>
                        <div className="font-bold text-[13px]">{alert.ticker} hit ₦{alert.target_price.toFixed(2)}</div>
                        <div className="text-[11px] text-text-muted">Alert triggered</div>
                      </div>
                    </div>
                    <button onClick={() => deleteAlert(alert.id)} className="text-[11px] text-text-muted hover:text-loss">Remove</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <Toast {...toast} />
    </div>
  )
}
