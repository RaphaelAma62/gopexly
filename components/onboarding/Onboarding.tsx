'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'
import { usePrices } from '@/lib/hooks/usePrices'
import { cn } from '@/lib/utils'

interface OnboardingProps {
  onComplete: () => void
}

const POPULAR_STOCKS = ['MTNN', 'GTCO', 'ZENITHBANK', 'ACCESSCORP', 'DANGCEM', 'AIRTELAFRI', 'FBNH', 'SEPLAT', 'NESTLE', 'BUAFOODS']
const POPULAR_TOPICS = ['📈 NGX Investing', '💰 Personal Finance', '🏦 Banking Stocks', '🏗 Industrial Stocks', '🛒 Consumer Goods', '⚡ Energy Sector', '💻 Tech Stocks', '🌍 Pan-African Markets']

export default function Onboarding({ onComplete }: OnboardingProps) {
  const sb = createClient()
  const { user } = useAuth()
  const { prices } = usePrices()
  const [step, setStep] = useState(1)
  const [selectedStocks, setSelectedStocks] = useState<string[]>([])
  const [selectedTopics, setSelectedTopics] = useState<string[]>([])
  const [bio, setBio] = useState('')
  const [country, setCountry] = useState('Nigeria')
  const [saving, setSaving] = useState(false)

  const TOTAL_STEPS = 4

  function toggleStock(ticker: string) {
    setSelectedStocks(prev =>
      prev.includes(ticker) ? prev.filter(t => t !== ticker) : prev.length < 5 ? [...prev, ticker] : prev
    )
  }

  function toggleTopic(topic: string) {
    setSelectedTopics(prev =>
      prev.includes(topic) ? prev.filter(t => t !== topic) : [...prev, topic]
    )
  }

  async function finish() {
    if (!user) return
    setSaving(true)
    // Save watchlist stocks
    if (selectedStocks.length > 0) {
      await sb.from('watchlist').insert(
        selectedStocks.map(ticker => ({ user_id: user.id, ticker, company_name: prices[ticker]?.company_name || ticker, added_at: new Date().toISOString() }))
      )
    }
    // Update profile
    await sb.from('profiles').update({ bio, country }).eq('id', user.id)
    // Mark onboarding complete
    await sb.from('onboarding').upsert({ user_id: user.id, completed: true, step: TOTAL_STEPS, completed_at: new Date().toISOString() }, { onConflict: 'user_id' })
    setSaving(false)
    onComplete()
  }

  const progressPct = (step / TOTAL_STEPS) * 100

  return (
    <div className="fixed inset-0 bg-white z-[900] flex flex-col overflow-y-auto">
      {/* Progress bar */}
      <div className="h-1.5 bg-gray-100 flex-shrink-0">
        <div className="h-full bg-primary transition-all duration-500 ease-out" style={{ width: `${progressPct}%` }} />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-5 py-10">
        <div className="w-full max-w-[520px]">
          {/* Step indicator */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-2">
              {Array.from({ length: TOTAL_STEPS }, (_, i) => (
                <div key={i} className={cn('transition-all duration-300',
                  i + 1 === step ? 'w-8 h-2.5 rounded-full bg-primary' :
                  i + 1 < step ? 'w-2.5 h-2.5 rounded-full bg-primary' :
                  'w-2.5 h-2.5 rounded-full bg-gray-200')} />
              ))}
            </div>
            <button onClick={onComplete} className="text-[13px] text-text-muted hover:text-text transition-colors">Skip all</button>
          </div>

          {/* ── STEP 1: Welcome ── */}
          {step === 1 && (
            <div className="text-center">
              <div className="text-[64px] mb-6">🇳🇬</div>
              <h1 className="font-display text-[32px] font-black mb-3 leading-tight">
                Welcome to Gopexly<br />
                <span className="text-gradient">Africa&apos;s Investing Platform</span>
              </h1>
              <p className="text-[16px] text-text-muted mb-8 leading-relaxed max-w-sm mx-auto">
                Let&apos;s personalise your experience in 3 quick steps so you see what matters most.
              </p>
              <div className="grid grid-cols-3 gap-3 mb-8">
                {[['📈', 'Track NGX Stocks'], ['🤝', 'Social Investing'], ['📚', 'Learn & Earn']].map(([icon, label]) => (
                  <div key={label} className="bg-primary-light border border-primary-border rounded-2xl p-4 text-center">
                    <div className="text-[28px] mb-1">{icon}</div>
                    <div className="text-[12px] font-bold text-primary">{label}</div>
                  </div>
                ))}
              </div>
              <button onClick={() => setStep(2)} className="w-full bg-primary text-white font-bold py-4 rounded-2xl text-[16px] hover:bg-primary-dark transition-all shadow-md">
                Let&apos;s Go 🚀
              </button>
            </div>
          )}

          {/* ── STEP 2: Pick stocks ── */}
          {step === 2 && (
            <div>
              <div className="text-center mb-6">
                <div className="text-[40px] mb-3">📈</div>
                <h2 className="font-display text-[24px] font-extrabold mb-2">Pick stocks to watch</h2>
                <p className="text-[14px] text-text-muted">Select up to 5 NGX stocks to add to your watchlist</p>
              </div>
              <div className="grid grid-cols-2 gap-2.5 mb-6">
                {POPULAR_STOCKS.map(ticker => {
                  const p = prices[ticker]
                  const selected = selectedStocks.includes(ticker)
                  const up = (p?.change_pct ?? 0) >= 0
                  return (
                    <button key={ticker} onClick={() => toggleStock(ticker)}
                      className={cn('p-3.5 rounded-2xl border-2 text-left transition-all',
                        selected ? 'border-primary bg-primary-light shadow-sm' : 'border-border bg-white hover:border-primary-border')}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-extrabold font-mono text-[14px] text-primary">{ticker}</span>
                        {selected && <span className="text-[16px]">✓</span>}
                      </div>
                      <div className="text-[11px] text-text-muted mb-1 truncate">{p?.company_name || ticker}</div>
                      {p && <div className={cn('text-[13px] font-bold', up ? 'text-gain' : 'text-loss')}>₦{p.price.toFixed(2)} {up ? '▲' : '▼'} {Math.abs(p.change_pct).toFixed(2)}%</div>}
                    </button>
                  )
                })}
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStep(1)} className="px-5 py-3 bg-gray-100 text-text-secondary rounded-2xl font-semibold">Back</button>
                <button onClick={() => setStep(3)} className="flex-1 bg-primary text-white font-bold py-3 rounded-2xl text-[15px] hover:bg-primary-dark">
                  {selectedStocks.length > 0 ? `Continue with ${selectedStocks.length} stock${selectedStocks.length > 1 ? 's' : ''}` : 'Skip'}
                </button>
              </div>
            </div>
          )}

          {/* ── STEP 3: Topics ── */}
          {step === 3 && (
            <div>
              <div className="text-center mb-6">
                <div className="text-[40px] mb-3">🎯</div>
                <h2 className="font-display text-[24px] font-extrabold mb-2">What interests you?</h2>
                <p className="text-[14px] text-text-muted">We&apos;ll personalise your feed based on your interests</p>
              </div>
              <div className="flex flex-wrap gap-2.5 mb-6">
                {POPULAR_TOPICS.map(topic => {
                  const selected = selectedTopics.includes(topic)
                  return (
                    <button key={topic} onClick={() => toggleTopic(topic)}
                      className={cn('px-4 py-2.5 rounded-full border-2 text-[13px] font-semibold transition-all',
                        selected ? 'border-primary bg-primary text-white' : 'border-border bg-white text-text-secondary hover:border-primary-border hover:text-primary')}>
                      {topic}
                    </button>
                  )
                })}
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStep(2)} className="px-5 py-3 bg-gray-100 text-text-secondary rounded-2xl font-semibold">Back</button>
                <button onClick={() => setStep(4)} className="flex-1 bg-primary text-white font-bold py-3 rounded-2xl text-[15px] hover:bg-primary-dark">Continue</button>
              </div>
            </div>
          )}

          {/* ── STEP 4: Profile ── */}
          {step === 4 && (
            <div>
              <div className="text-center mb-6">
                <div className="text-[40px] mb-3">👤</div>
                <h2 className="font-display text-[24px] font-extrabold mb-2">Complete your profile</h2>
                <p className="text-[14px] text-text-muted">Help other investors know who you are</p>
              </div>
              <div className="flex flex-col gap-4 mb-6">
                <div>
                  <label className="block text-[12px] font-bold text-text-muted uppercase tracking-wide mb-1.5">Your Bio</label>
                  <textarea value={bio} onChange={e => setBio(e.target.value)} rows={3}
                    placeholder="e.g. Long-term investor focused on Nigerian banking stocks and consumer goods..."
                    className="w-full bg-gray-50 border-2 border-border text-text px-4 py-3 rounded-2xl text-[14px] outline-none focus:border-primary resize-none font-sans" />
                </div>
                <div>
                  <label className="block text-[12px] font-bold text-text-muted uppercase tracking-wide mb-1.5">Country</label>
                  <select value={country} onChange={e => setCountry(e.target.value)}
                    className="w-full bg-gray-50 border-2 border-border text-text px-4 py-3 rounded-2xl text-[14px] outline-none focus:border-primary">
                    {['Nigeria', 'Ghana', 'Kenya', 'South Africa', 'United Kingdom', 'United States', 'Canada', 'Other'].map(c => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStep(3)} className="px-5 py-3 bg-gray-100 text-text-secondary rounded-2xl font-semibold">Back</button>
                <button onClick={finish} disabled={saving}
                  className="flex-1 bg-gradient-to-r from-primary to-[#7c3aed] text-white font-bold py-3 rounded-2xl text-[15px] hover:shadow-lg disabled:opacity-50">
                  {saving ? 'Setting up...' : '🚀 Start Investing!'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
