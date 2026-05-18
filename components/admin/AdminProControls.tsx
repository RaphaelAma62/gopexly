'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/lib/hooks/useToast'
import { Toast, Spinner } from '@/components/ui'
import { fmtDate, cn } from '@/lib/utils'

interface SubscriptionRow {
  id: string
  user_id: string
  plan: string
  amount: number
  status: string
  started_at: string
  expires_at: string | null
  paystack_reference: string | null
  profiles: { name: string | null; username: string | null; email?: string | null } | null
}

interface VerificationRow {
  id: string
  user_id: string
  status: string
  reason: string | null
  created_at: string
  profiles: { name: string | null; username: string | null } | null
}

interface ToggleSetting {
  key: string
  label: string
  description: string
  icon: string
  danger?: boolean
}

const FEATURE_TOGGLES: ToggleSetting[] = [
  { key: 'pro_enabled',              label: 'Pro Subscriptions Live',    description: 'Enable Paystack payments and Pro upgrades',                    icon: '💳' },
  { key: 'pro_feature_watchlist',    label: 'Unlimited Watchlist',       description: 'Pro users get unlimited watchlist stocks',                     icon: '👁' },
  { key: 'pro_feature_alerts',       label: 'Unlimited Price Alerts',    description: 'Pro users get unlimited price alerts',                         icon: '🔔' },
  { key: 'pro_feature_screener',     label: 'Stock Screener',            description: 'Advanced NGX stock filtering for Pro users',                   icon: '📊' },
  { key: 'pro_feature_charts',       label: 'Portfolio Charts',          description: 'Performance line charts for Pro users',                        icon: '📈' },
  { key: 'pro_feature_ai_unlimited', label: 'Unlimited AI',              description: 'Remove daily AI limit for Pro users',                          icon: '🤖' },
  { key: 'pro_feature_reports',      label: 'PDF Reports',               description: 'Monthly portfolio reports for Pro users',                      icon: '📄' },
  { key: 'pro_feature_clubs',        label: 'Investment Clubs',          description: 'Pro users can create investment clubs',                        icon: '🏠' },
  { key: 'pro_feature_messaging',    label: 'Direct Messaging',          description: 'Private messages between users for Pro',                       icon: '💬' },
  { key: 'pro_feature_leaderboard',  label: 'Leaderboard Ranking',       description: 'Full leaderboard access for Pro users',                        icon: '🏆' },
  { key: 'verification_enabled',     label: 'Verification Requests',     description: 'Allow users to request verified badge',                        icon: '✅' },
  { key: 'paystack_live_mode',       label: 'Paystack LIVE Mode',        description: 'Switch from test to live Paystack keys (real payments!)',      icon: '💰', danger: true },
  { key: 'maintenance_mode',         label: 'Maintenance Mode',          description: 'Show maintenance page to all non-admin users',                  icon: '🔧', danger: true },
]

export default function AdminProControls() {
  const sb = createClient()
  const { toast, showToast } = useToast()
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [subscriptions, setSubscriptions] = useState<SubscriptionRow[]>([])
  const [verifications, setVerifications] = useState<VerificationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'features' | 'subscribers' | 'verification' | 'pricing'>('features')
  const [monthlyPrice, setMonthlyPrice] = useState('2000')
  const [annualPrice, setAnnualPrice] = useState('18000')
  const [savingPrice, setSavingPrice] = useState(false)

  const loadData = useCallback(async () => {
    const [settingsRes, subsRes, verRes] = await Promise.all([
      sb.from('app_settings').select('key,value'),
      sb.from('subscriptions')
        .select('id,user_id,plan,amount,status,started_at,expires_at,paystack_reference,profiles!subscriptions_user_id_fkey(name,username)')
        .order('created_at', { ascending: false }).limit(50),
      sb.from('verification_requests')
        .select('id,user_id,status,reason,created_at,profiles!verification_requests_user_id_fkey(name,username)')
        .order('created_at', { ascending: false }).limit(50),
    ])

    const map: Record<string, string> = {}
    ;(settingsRes.data || []).forEach((s: { key: string; value: string }) => { map[s.key] = s.value })
    setSettings(map)
    setMonthlyPrice(map.pro_monthly_price || '2000')
    setAnnualPrice(map.pro_annual_price || '18000')
    setSubscriptions((subsRes.data || []) as unknown as SubscriptionRow[])
    setVerifications((verRes.data || []) as unknown as VerificationRow[])
    setLoading(false)
  }, [sb])

  useEffect(() => { loadData() }, [loadData])

  async function toggleSetting(key: string, currentValue: string) {
    const setting = FEATURE_TOGGLES.find(f => f.key === key)
    if (setting?.danger && currentValue === 'false') {
      const confirmed = confirm(`⚠️ Are you sure you want to enable "${setting.label}"? This affects real users and payments.`)
      if (!confirmed) return
    }
    setSaving(key)
    const newValue = currentValue === 'true' ? 'false' : 'true'
    await sb.from('app_settings').update({ value: newValue, updated_at: new Date().toISOString() }).eq('key', key)
    setSettings(prev => ({ ...prev, [key]: newValue }))
    setSaving(null)
    showToast(`${setting?.label} ${newValue === 'true' ? 'enabled' : 'disabled'}`, 'ok')
  }

  async function savePricing() {
    setSavingPrice(true)
    await Promise.all([
      sb.from('app_settings').update({ value: monthlyPrice }).eq('key', 'pro_monthly_price'),
      sb.from('app_settings').update({ value: annualPrice }).eq('key', 'pro_annual_price'),
    ])
    setSavingPrice(false)
    showToast('Pricing updated!', 'ok')
  }

  async function grantProManually(userId: string, plan: string = 'monthly') {
    const months = plan === 'annual' ? 12 : 1
    const expiresAt = new Date()
    expiresAt.setMonth(expiresAt.getMonth() + months)
    await sb.from('profiles').update({ is_pro: true, pro_plan: plan, pro_expires_at: expiresAt.toISOString() }).eq('id', userId)
    await sb.from('subscriptions').insert({ user_id: userId, plan, amount: 0, status: 'manual', expires_at: expiresAt.toISOString() })
    showToast('Pro access granted manually', 'ok')
    loadData()
  }

  async function revokeProManually(userId: string) {
    if (!confirm('Revoke Pro access for this user?')) return
    await sb.from('profiles').update({ is_pro: false, pro_plan: 'free', pro_expires_at: null }).eq('id', userId)
    showToast('Pro access revoked', 'ok')
    loadData()
  }

  async function approveVerification(reqId: string, userId: string) {
    await Promise.all([
      sb.from('verification_requests').update({ status: 'approved', reviewed_at: new Date().toISOString() }).eq('id', reqId),
      sb.from('profiles').update({ is_verified: true }).eq('id', userId),
    ])
    showToast('User verified ✅', 'ok')
    loadData()
  }

  async function rejectVerification(reqId: string) {
    await sb.from('verification_requests').update({ status: 'rejected', reviewed_at: new Date().toISOString() }).eq('id', reqId)
    showToast('Verification rejected', 'ok')
    loadData()
  }

  const proEnabled = settings.pro_enabled === 'true'
  const activeSubscribers = subscriptions.filter(s => s.status === 'active').length
  const pendingVerifications = verifications.filter(v => v.status === 'pending').length

  if (loading) return <div className="flex justify-center py-10"><Spinner className="text-primary" /></div>

  return (
    <div>
      {/* Pro status banner */}
      <div className={cn('rounded-2xl p-4 mb-6 flex items-center gap-4 border-2',
        proEnabled ? 'bg-gain-bg border-gain-border' : 'bg-amber-bg border-amber/40')}>
        <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0',
          proEnabled ? 'bg-gain text-white' : 'bg-amber text-white')}>
          {proEnabled ? '🚀' : '⏸'}
        </div>
        <div className="flex-1">
          <div className="font-bold text-[15px]">
            Pro is currently <strong>{proEnabled ? 'LIVE' : 'DISABLED'}</strong>
          </div>
          <div className="text-[13px] text-text-secondary">
            {proEnabled
              ? `${activeSubscribers} active subscriber${activeSubscribers !== 1 ? 's' : ''} · Payments are ${settings.paystack_live_mode === 'true' ? '🔴 LIVE' : '🟡 TEST'} mode`
              : 'Users cannot see pricing or upgrade yet. Toggle "Pro Subscriptions Live" to enable.'}
          </div>
        </div>
        <button onClick={() => toggleSetting('pro_enabled', settings.pro_enabled || 'false')}
          className={cn('px-5 py-2.5 rounded-xl font-bold text-[13px] transition-all flex-shrink-0',
            proEnabled ? 'bg-amber-bg text-amber border border-amber/40 hover:bg-amber hover:text-white' : 'bg-gain text-white hover:bg-green-700')}>
          {saving === 'pro_enabled' ? '...' : proEnabled ? 'Disable Pro' : 'Enable Pro'}
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Active Subs', value: activeSubscribers.toString(), icon: '💳', color: 'text-gain' },
          { label: 'Pending Verif.', value: pendingVerifications.toString(), icon: '✅', color: pendingVerifications > 0 ? 'text-amber' : 'text-text-muted' },
          { label: 'Monthly Rev', value: `₦${(activeSubscribers * parseInt(monthlyPrice)).toLocaleString()}`, icon: '💰', color: 'text-primary' },
          { label: 'Pay Mode', value: settings.paystack_live_mode === 'true' ? 'LIVE' : 'TEST', icon: '🔑', color: settings.paystack_live_mode === 'true' ? 'text-loss' : 'text-amber' },
        ].map(s => (
          <div key={s.label} className="bg-surface border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[18px]">{s.icon}</span>
              <span className="text-[11px] font-bold text-text-muted uppercase tracking-wide">{s.label}</span>
            </div>
            <div className={cn('font-display text-[22px] font-extrabold', s.color)}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-50 p-1 rounded-xl border border-border mb-6">
        {[
          { key: 'features', label: '⚙ Features', badge: null },
          { key: 'subscribers', label: '💳 Subscribers', badge: subscriptions.length },
          { key: 'verification', label: '✅ Verification', badge: pendingVerifications > 0 ? pendingVerifications : null },
          { key: 'pricing', label: '💰 Pricing', badge: null },
        ].map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key as typeof activeTab)}
            className={cn('flex-1 py-2.5 rounded-lg text-[13px] font-bold transition-all flex items-center justify-center gap-1.5',
              activeTab === t.key ? 'bg-white shadow-sm text-primary' : 'text-text-muted hover:text-text')}>
            {t.label}
            {t.badge !== null && t.badge !== undefined && (
              <span className="bg-primary text-white text-[10px] font-extrabold w-5 h-5 rounded-full flex items-center justify-center">{t.badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── FEATURES TAB ── */}
      {activeTab === 'features' && (
        <div className="flex flex-col gap-2">
          {FEATURE_TOGGLES.map(toggle => {
            const isOn = settings[toggle.key] === 'true'
            const isSaving = saving === toggle.key
            return (
              <div key={toggle.key} className={cn('bg-surface border rounded-2xl p-4 flex items-center gap-4 transition-all',
                toggle.danger && isOn ? 'border-loss-border bg-loss-bg/30' : 'border-border hover:border-primary-border')}>
                <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center text-[20px] flex-shrink-0',
                  isOn ? 'bg-primary-light' : 'bg-gray-100')}>
                  {toggle.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[14px]">{toggle.label}</span>
                    {toggle.danger && <span className="text-[10px] bg-loss-bg text-loss px-2 py-0.5 rounded-full font-bold border border-loss-border">HIGH RISK</span>}
                  </div>
                  <div className="text-[12px] text-text-muted">{toggle.description}</div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className={cn('text-[12px] font-bold', isOn ? 'text-gain' : 'text-text-muted')}>
                    {isOn ? 'ON' : 'OFF'}
                  </span>
                  <button onClick={() => toggleSetting(toggle.key, settings[toggle.key] || 'false')} disabled={isSaving}
                    className={cn('relative w-12 h-6 rounded-full transition-all flex-shrink-0 focus:outline-none',
                      isOn ? (toggle.danger ? 'bg-loss' : 'bg-primary') : 'bg-gray-300')}>
                    <span className={cn('absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-all',
                      isOn ? 'left-[26px]' : 'left-0.5')}>
                      {isSaving && <span className="absolute inset-0 flex items-center justify-center text-[8px]">⟳</span>}
                    </span>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── SUBSCRIBERS TAB ── */}
      {activeTab === 'subscribers' && (
        <div>
          <div className="bg-surface border border-border rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-border">
              <div className="font-display text-[14px] font-extrabold">All Subscribers</div>
              <span className="text-[12px] text-text-muted">{subscriptions.length} total</span>
            </div>
            {subscriptions.length === 0 ? (
              <div className="text-center py-12 text-text-muted">
                <div className="text-3xl mb-2">💳</div>
                <div className="text-[14px]">No subscribers yet</div>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-border">
                    {['User', 'Plan', 'Amount', 'Status', 'Expires', 'Actions'].map(h => (
                      <th key={h} className="text-left px-4 py-2.5 text-[10px] font-bold text-text-muted uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {subscriptions.map(s => {
                    const isActive = s.status === 'active'
                    return (
                      <tr key={s.id} className="border-b border-border last:border-0 hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="text-[13px] font-semibold">{s.profiles?.name || 'Unknown'}</div>
                          <div className="text-[11px] text-text-muted">@{s.profiles?.username || '—'}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-[12px] font-bold text-primary capitalize">{s.plan}</span>
                        </td>
                        <td className="px-4 py-3 text-[13px] font-bold">₦{(s.amount || 0).toLocaleString()}</td>
                        <td className="px-4 py-3">
                          <span className={cn('text-[11px] font-bold px-2.5 py-1 rounded-full',
                            isActive ? 'bg-gain-bg text-gain' : s.status === 'pending' ? 'bg-amber-bg text-amber' : 'bg-gray-100 text-text-muted')}>
                            {s.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[12px] text-text-muted">{s.expires_at ? fmtDate(s.expires_at) : '—'}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1.5">
                            {!isActive && (
                              <button onClick={() => grantProManually(s.user_id, s.plan)}
                                className="text-[11px] font-semibold bg-primary-light text-primary px-2.5 py-1 rounded-lg hover:bg-primary hover:text-white transition-all">
                                Grant
                              </button>
                            )}
                            {isActive && (
                              <button onClick={() => revokeProManually(s.user_id)}
                                className="text-[11px] font-semibold bg-loss-bg text-loss px-2.5 py-1 rounded-lg hover:bg-loss hover:text-white transition-all">
                                Revoke
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Manual grant */}
          <div className="mt-4 bg-surface border border-border rounded-2xl p-5">
            <div className="font-bold text-[14px] mb-3">Grant Pro Manually</div>
            <div className="flex gap-3">
              <input id="manual-user-id" placeholder="User ID (from Supabase → Auth → Users)"
                className="flex-1 bg-gray-50 border-[1.5px] border-border text-text px-3.5 py-2.5 rounded-xl text-[13px] outline-none focus:border-primary font-mono" />
              <select id="manual-plan" className="bg-gray-50 border-[1.5px] border-border text-text px-3 py-2.5 rounded-xl text-[13px] outline-none">
                <option value="monthly">Monthly</option>
                <option value="annual">Annual</option>
              </select>
              <button onClick={() => {
                const uid = (document.getElementById('manual-user-id') as HTMLInputElement)?.value.trim()
                const plan = (document.getElementById('manual-plan') as HTMLSelectElement)?.value
                if (!uid) { showToast('Enter a user ID', 'err'); return }
                grantProManually(uid, plan)
              }} className="bg-primary text-white font-bold px-5 py-2.5 rounded-xl text-[13px] hover:bg-primary-dark">
                Grant Pro
              </button>
            </div>
            <div className="text-[11px] text-text-muted mt-2">Use this to manually activate Pro for users who paid via bank transfer or other methods.</div>
          </div>
        </div>
      )}

      {/* ── VERIFICATION TAB ── */}
      {activeTab === 'verification' && (
        <div>
          {verifications.length === 0 ? (
            <div className="text-center py-12 text-text-muted bg-surface border border-border rounded-2xl">
              <div className="text-3xl mb-2">✅</div>
              <div className="text-[14px]">No verification requests</div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {verifications.map(v => {
                const isPending = v.status === 'pending'
                return (
                  <div key={v.id} className={cn('bg-surface border rounded-2xl p-4 flex items-center gap-4',
                    isPending ? 'border-amber/40 bg-amber-bg/30' : 'border-border')}>
                    <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0',
                      v.status === 'approved' ? 'bg-gain-bg' : isPending ? 'bg-amber-bg' : 'bg-loss-bg')}>
                      {v.status === 'approved' ? '✅' : isPending ? '⏳' : '❌'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-[14px]">{v.profiles?.name || 'Unknown'}</div>
                      <div className="text-[12px] text-text-muted">@{v.profiles?.username} · {fmtDate(v.created_at)}</div>
                      {v.reason && <div className="text-[12px] text-text-secondary mt-0.5">Reason: {v.reason}</div>}
                    </div>
                    <div className={cn('text-[11px] font-bold px-2.5 py-1 rounded-full flex-shrink-0',
                      v.status === 'approved' ? 'bg-gain-bg text-gain' : isPending ? 'bg-amber-bg text-amber' : 'bg-loss-bg text-loss')}>
                      {v.status}
                    </div>
                    {isPending && (
                      <div className="flex gap-2 flex-shrink-0">
                        <button onClick={() => approveVerification(v.id, v.user_id)}
                          className="bg-gain text-white text-[12px] font-bold px-3.5 py-2 rounded-xl hover:bg-green-700 transition-all">
                          ✅ Approve
                        </button>
                        <button onClick={() => rejectVerification(v.id)}
                          className="bg-loss-bg text-loss text-[12px] font-bold px-3.5 py-2 rounded-xl hover:bg-loss hover:text-white transition-all">
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── PRICING TAB ── */}
      {activeTab === 'pricing' && (
        <div className="max-w-[500px]">
          <div className="bg-surface border border-border rounded-2xl p-5 mb-4">
            <div className="font-display text-[15px] font-extrabold mb-4">Subscription Pricing</div>
            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wide mb-1.5">Monthly Price (₦)</label>
                <div className="flex gap-3">
                  <input value={monthlyPrice} onChange={e => setMonthlyPrice(e.target.value)} type="number"
                    className="flex-1 bg-gray-50 border-[1.5px] border-border text-text px-3.5 py-2.5 rounded-xl text-[15px] font-bold outline-none focus:border-primary" />
                  <div className="bg-gray-100 px-4 rounded-xl flex items-center text-[13px] text-text-muted font-medium">/month</div>
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wide mb-1.5">Annual Price (₦)</label>
                <div className="flex gap-3">
                  <input value={annualPrice} onChange={e => setAnnualPrice(e.target.value)} type="number"
                    className="flex-1 bg-gray-50 border-[1.5px] border-border text-text px-3.5 py-2.5 rounded-xl text-[15px] font-bold outline-none focus:border-primary" />
                  <div className="bg-gray-100 px-4 rounded-xl flex items-center text-[13px] text-text-muted font-medium">/year</div>
                </div>
                <div className="text-[12px] text-text-muted mt-1">
                  Effective monthly: ₦{Math.round(parseInt(annualPrice || '0') / 12).toLocaleString()} · 
                  Save {Math.round(((parseInt(monthlyPrice || '1') * 12 - parseInt(annualPrice || '0')) / (parseInt(monthlyPrice || '1') * 12)) * 100)}% vs monthly
                </div>
              </div>
              <button onClick={savePricing} disabled={savingPrice}
                className="bg-primary text-white font-bold py-3 rounded-xl text-[14px] hover:bg-primary-dark disabled:opacity-50">
                {savingPrice ? 'Saving...' : 'Save Pricing'}
              </button>
            </div>
          </div>

          <div className="bg-amber-bg border border-amber/40 rounded-2xl p-4 text-[13px] text-amber">
            <div className="font-bold mb-1">⚠️ Paystack Environment Variables Required</div>
            <div className="text-[12px] leading-relaxed">
              Add these to Render environment variables:<br/>
              <code className="font-mono bg-amber/20 px-1 rounded">NEXT_PUBLIC_PAYSTACK_TEST_KEY</code> — starts with pk_test_<br/>
              <code className="font-mono bg-amber/20 px-1 rounded">NEXT_PUBLIC_PAYSTACK_LIVE_KEY</code> — starts with pk_live_<br/>
              <code className="font-mono bg-amber/20 px-1 rounded">PAYSTACK_TEST_SECRET_KEY</code> — starts with sk_test_<br/>
              <code className="font-mono bg-amber/20 px-1 rounded">PAYSTACK_LIVE_SECRET_KEY</code> — starts with sk_live_<br/>
              Get these from <strong>dashboard.paystack.com → Settings → API Keys</strong>
            </div>
          </div>
        </div>
      )}

      <Toast {...toast} />
    </div>
  )
}
