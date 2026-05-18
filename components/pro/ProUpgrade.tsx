'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'
import { useProStatus } from '@/lib/hooks/useProStatus'
import { useToast } from '@/lib/hooks/useToast'
import { Toast, Spinner } from '@/components/ui'
import { cn, fmtDate } from '@/lib/utils'

declare global {
  interface Window {
    PaystackPop: {
      setup: (options: {
        key: string
        email: string
        amount: number
        currency: string
        ref: string
        metadata: Record<string, unknown>
        callback: (response: { reference: string }) => void
        onClose: () => void
      }) => { openIframe: () => void }
    }
  }
}

const PRO_FEATURES = [
  { icon: '🤖', title: 'Gopex AI — Unlimited', desc: 'Ask unlimited questions. No daily cap. Priority responses.' },
  { icon: '👁', title: 'Unlimited Watchlist', desc: 'Track unlimited NGX stocks. Free tier is capped at 5.' },
  { icon: '🔔', title: 'Unlimited Price Alerts', desc: 'Set unlimited alerts. Free tier allows only 1 active alert.' },
  { icon: '📊', title: 'Stock Screener', desc: 'Filter 124 NGX stocks by P/E, market cap, sector, dividend yield, and momentum signals.' },
  { icon: '📈', title: 'Portfolio Performance Chart', desc: 'See your portfolio value over time as a beautiful line chart.' },
  { icon: '📄', title: 'Monthly PDF Reports', desc: 'Auto-generated portfolio performance report you can share or print.' },
  { icon: '🏆', title: 'Full Leaderboard Access', desc: 'Compete and be ranked against all Gopexly investors.' },
  { icon: '🏠', title: 'Investment Clubs', desc: 'Create and manage group investment clubs with friends and colleagues.' },
  { icon: '💬', title: 'Direct Messaging', desc: 'Private messages between you and any investor on Gopexly.' },
  { icon: '✅', title: 'Verified Investor Badge', desc: 'Blue checkmark on your profile and every post you make.' },
  { icon: '🔖', title: 'Unlimited Bookmarks', desc: 'Save unlimited posts. Free tier caps at 10.' },
  { icon: '📥', title: 'Export Portfolio CSV', desc: 'Download your holdings and history as a spreadsheet.' },
  { icon: '🚫', title: 'No Ads — Ever', desc: 'Clean, distraction-free investing experience forever.' },
  { icon: '⚡', title: 'Early Access to Features', desc: 'Be first to get every new Gopexly feature before free users.' },
]

export default function ProUpgrade() {
  const sb = createClient()
  const { user } = useAuth()
  const { isPro, plan, expiresAt, settings, loading } = useProStatus()
  const { toast, showToast } = useToast()
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('monthly')
  const [paying, setPaying] = useState(false)
  const [paystackLoaded, setPaystackLoaded] = useState(false)

  // Load Paystack script
  useEffect(() => {
    if (document.getElementById('paystack-script')) { setPaystackLoaded(true); return }
    const script = document.createElement('script')
    script.id = 'paystack-script'
    script.src = 'https://js.paystack.co/v1/inline.js'
    script.onload = () => setPaystackLoaded(true)
    document.head.appendChild(script)
  }, [])

  async function handleUpgrade() {
    if (!user || !paystackLoaded) return
    if (!settings.pro_enabled) {
      showToast('Pro subscriptions are not yet available. Coming soon!', 'err')
      return
    }

    setPaying(true)
    const amount = billingPeriod === 'monthly' ? settings.pro_monthly_price : settings.pro_annual_price
    const ref = `gopexly_pro_${user.id}_${Date.now()}`

    // Save pending subscription
    await sb.from('subscriptions').insert({
      user_id: user.id,
      plan: billingPeriod,
      amount,
      currency: 'NGN',
      status: 'pending',
      paystack_reference: ref,
    })

    const paystackKey = settings.paystack_live_mode
      ? process.env.NEXT_PUBLIC_PAYSTACK_LIVE_KEY
      : process.env.NEXT_PUBLIC_PAYSTACK_TEST_KEY

    if (!paystackKey) {
      showToast('Payment not configured yet. Contact support.', 'err')
      setPaying(false)
      return
    }

    const handler = window.PaystackPop.setup({
      key: paystackKey,
      email: user.email,
      amount: amount * 100, // kobo
      currency: 'NGN',
      ref,
      metadata: {
        user_id: user.id,
        plan: billingPeriod,
        custom_fields: [
          { display_name: 'Plan', variable_name: 'plan', value: billingPeriod },
          { display_name: 'User', variable_name: 'user_id', value: user.id },
        ]
      },
      callback: async (response) => {
        // Verify payment and activate Pro
        const res = await fetch('/api/payments/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reference: response.reference, plan: billingPeriod }),
        })
        const data = await res.json()
        if (data.success) {
          showToast('🎉 Welcome to Gopexly Pro!', 'ok')
          setTimeout(() => window.location.href = '/home', 1500)
        } else {
          showToast('Payment verification failed. Contact support.', 'err')
        }
        setPaying(false)
      },
      onClose: () => { setPaying(false) }
    })
    handler.openIframe()
  }

  const monthlyPrice = settings.pro_monthly_price
  const annualPrice = settings.pro_annual_price
  const annualMonthly = Math.round(annualPrice / 12)
  const annualSaving = Math.round(((monthlyPrice * 12 - annualPrice) / (monthlyPrice * 12)) * 100)

  if (loading) return <div className="flex justify-center items-center h-[60vh]"><Spinner size="lg" className="text-primary" /></div>

  return (
    <div className="min-h-screen bg-[#f4f6fb] pb-20">
      {/* Hero */}
      <div className="bg-gradient-to-br from-[#0f172a] via-[#1e1b4b] to-[#0f4dd4] text-white py-16 px-5">
        <div className="max-w-[800px] mx-auto text-center">
          {isPro ? (
            <>
              <div className="inline-flex items-center gap-2 bg-amber/20 border border-amber/40 rounded-full px-4 py-2 mb-5 text-amber font-bold text-[13px]">
                👑 You are a Pro Member
              </div>
              <h1 className="font-display text-[36px] md:text-[48px] font-black mb-3">Your Pro Membership</h1>
              <p className="text-[16px] text-white/70 mb-6">
                Plan: <strong className="text-white capitalize">{plan}</strong> ·
                {expiresAt ? ` Renews ${fmtDate(expiresAt)}` : ' Active'}
              </p>
              <div className="inline-flex items-center gap-2 bg-white/10 rounded-2xl px-6 py-3">
                <span className="text-[28px]">✅</span>
                <span className="font-bold text-[16px]">All Pro features are unlocked</span>
              </div>
            </>
          ) : (
            <>
              <div className="inline-flex items-center gap-2 bg-amber/20 border border-amber/40 rounded-full px-4 py-2 mb-5 text-amber font-bold text-[13px]">
                👑 Gopexly Pro
              </div>
              <h1 className="font-display text-[36px] md:text-[52px] font-black mb-4 leading-tight">
                Invest Like a Professional
              </h1>
              <p className="text-[17px] text-white/70 mb-8 max-w-lg mx-auto leading-relaxed">
                Unlimited AI, advanced charts, stock screener, investment clubs, and 10+ more features built for serious Nigerian investors.
              </p>

              {/* Billing toggle */}
              <div className="inline-flex bg-white/10 rounded-2xl p-1.5 mb-8 gap-1">
                <button onClick={() => setBillingPeriod('monthly')}
                  className={cn('px-6 py-2.5 rounded-xl text-[14px] font-bold transition-all', billingPeriod === 'monthly' ? 'bg-white text-[#0f172a]' : 'text-white/70 hover:text-white')}>
                  Monthly
                </button>
                <button onClick={() => setBillingPeriod('annual')}
                  className={cn('px-6 py-2.5 rounded-xl text-[14px] font-bold transition-all flex items-center gap-2', billingPeriod === 'annual' ? 'bg-white text-[#0f172a]' : 'text-white/70 hover:text-white')}>
                  Annual
                  <span className="bg-gain text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full">-{annualSaving}%</span>
                </button>
              </div>

              {/* Price display */}
              <div className="mb-8">
                <div className="font-display text-[56px] font-black leading-none">
                  ₦{billingPeriod === 'monthly' ? monthlyPrice.toLocaleString() : annualMonthly.toLocaleString()}
                  <span className="text-[22px] text-white/60 font-medium">/month</span>
                </div>
                {billingPeriod === 'annual' && (
                  <div className="text-white/60 text-[14px] mt-1">
                    Billed ₦{annualPrice.toLocaleString()} annually · Save ₦{(monthlyPrice * 12 - annualPrice).toLocaleString()}/year
                  </div>
                )}
              </div>

              {/* CTA */}
              <button onClick={handleUpgrade} disabled={paying || !settings.pro_enabled}
                className={cn('inline-flex items-center gap-3 font-bold text-[17px] px-10 py-5 rounded-2xl transition-all shadow-xl',
                  settings.pro_enabled
                    ? 'bg-gradient-to-r from-amber to-yellow-400 text-[#0f172a] hover:shadow-2xl hover:-translate-y-0.5'
                    : 'bg-white/20 text-white/50 cursor-not-allowed')}>
                {paying ? <Spinner size="sm" className="text-[#0f172a]" /> : '👑'}
                {paying ? 'Processing...' : settings.pro_enabled ? `Upgrade to Pro — ₦${billingPeriod === 'monthly' ? monthlyPrice.toLocaleString() : annualPrice.toLocaleString()}` : 'Coming Soon'}
              </button>

              {!settings.pro_enabled && (
                <p className="text-white/50 text-[13px] mt-3">Pro subscriptions are launching soon. Stay tuned!</p>
              )}
              <p className="text-white/40 text-[12px] mt-3">Cancel anytime · Secure payment via Paystack · Nigerian cards & bank transfer accepted</p>
            </>
          )}
        </div>
      </div>

      <div className="max-w-[900px] mx-auto px-5 py-12">
        {/* Features grid */}
        <h2 className="font-display text-[28px] font-extrabold text-center mb-2">Everything in Pro</h2>
        <p className="text-text-muted text-center mb-10 text-[15px]">14 premium features unlocked instantly on upgrade</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-12">
          {PRO_FEATURES.map(f => (
            <div key={f.title} className={cn('bg-white border rounded-2xl p-5 flex gap-4 hover:shadow-sm transition-all',
              isPro ? 'border-gain-border bg-gain-bg/30' : 'border-border')}>
              <div className="text-[28px] flex-shrink-0">{f.icon}</div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold text-[15px]">{f.title}</span>
                  {isPro && <span className="text-[10px] bg-gain text-white px-2 py-0.5 rounded-full font-bold">✓ Active</span>}
                </div>
                <div className="text-[13px] text-text-secondary leading-relaxed">{f.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Comparison table */}
        <h2 className="font-display text-[24px] font-extrabold text-center mb-6">Free vs Pro</h2>
        <div className="bg-white border border-border rounded-3xl overflow-hidden shadow-sm">
          <div className="grid grid-cols-3 bg-[#0f172a] text-white">
            <div className="px-5 py-4 text-[14px] font-bold">Feature</div>
            <div className="px-5 py-4 text-[14px] font-bold text-center border-x border-white/10">Free</div>
            <div className="px-5 py-4 text-[14px] font-bold text-center text-amber">👑 Pro</div>
          </div>
          {[
            ['Social Feed', '✅ Unlimited', '✅ Unlimited'],
            ['NGX Live Prices', '✅ 124 stocks', '✅ 124 stocks'],
            ['Portfolio Tracker', '✅ Basic', '✅ + Charts & Reports'],
            ['Watchlist', '5 stocks', 'Unlimited'],
            ['Price Alerts', '1 active', 'Unlimited'],
            ['Gopex AI', '10/day', 'Unlimited'],
            ['Courses', '2/month', 'Unlimited'],
            ['Stock Screener', '❌', '✅'],
            ['Investment Clubs', 'Join only', 'Create & Join'],
            ['Leaderboard', 'View only', '✅ Full ranking'],
            ['Direct Messaging', '❌', '✅'],
            ['Verified Badge', '❌', '✅'],
            ['Portfolio PDF Report', '❌', '✅ Monthly'],
            ['Bookmarks', '10 posts', 'Unlimited'],
            ['Export CSV', '❌', '✅'],
            ['Ads', 'May appear', 'Never'],
          ].map(([feature, free, pro], i) => (
            <div key={feature} className={cn('grid grid-cols-3', i % 2 === 0 ? 'bg-white' : 'bg-gray-50')}>
              <div className="px-5 py-3.5 text-[14px] font-medium border-b border-border">{feature}</div>
              <div className="px-5 py-3.5 text-[13px] text-text-muted text-center border-x border-b border-border">{free}</div>
              <div className={cn('px-5 py-3.5 text-[13px] font-semibold text-center border-b border-border',
                pro.startsWith('✅') || pro === 'Unlimited' || pro.includes('Never') ? 'text-gain' : 'text-primary')}>{pro}</div>
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        {!isPro && (
          <div className="mt-12 bg-gradient-to-br from-[#0f172a] to-[#1e1b4b] rounded-3xl p-10 text-center text-white">
            <div className="text-[48px] mb-4">👑</div>
            <h2 className="font-display text-[28px] font-extrabold mb-3">Ready to invest like a pro?</h2>
            <p className="text-white/60 mb-8 text-[15px]">Join serious Nigerian investors who are already on Pro</p>
            <button onClick={handleUpgrade} disabled={paying || !settings.pro_enabled}
              className={cn('inline-flex items-center gap-3 font-bold text-[16px] px-10 py-4 rounded-2xl transition-all',
                settings.pro_enabled ? 'bg-gradient-to-r from-amber to-yellow-400 text-[#0f172a] hover:shadow-xl' : 'bg-white/20 text-white/50 cursor-not-allowed')}>
              {paying ? <Spinner size="sm" /> : '👑'}
              {settings.pro_enabled ? `Start Pro — ₦${monthlyPrice.toLocaleString()}/month` : 'Coming Soon'}
            </button>
          </div>
        )}
      </div>

      <Toast {...toast} />
    </div>
  )
}
