'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'
import { useToast } from '@/lib/hooks/useToast'
import { Toast, Spinner } from '@/components/ui'
import { fmtDate } from '@/lib/utils'

interface ReferralRow {
  id: string
  referral_code: string
  referred_id: string | null
  status: string
  reward_given: boolean
  created_at: string
  completed_at: string | null
  referred_profiles: { name: string | null; username: string | null } | null
}

export default function Referral() {
  const sb = createClient()
  const { user } = useAuth()
  const { toast, showToast } = useToast()
  const [referrals, setReferrals] = useState<ReferralRow[]>([])
  const [myCode, setMyCode] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [generating, setGenerating] = useState(false)

  const load = useCallback(async () => {
    if (!user) return
    const { data: profile } = await sb.from('profiles').select('referral_code').eq('id', user.id).single()
    const profileData = profile as { referral_code: string | null } | null
    setMyCode(profileData?.referral_code || null)

    const { data: refs } = await sb.from('referrals')
      .select('id,referral_code,referred_id,status,reward_given,created_at,completed_at')
      .eq('referrer_id', user.id)
      .order('created_at', { ascending: false })
    setReferrals((refs || []) as ReferralRow[])
    setLoading(false)
  }, [sb, user])

  useEffect(() => { load() }, [load])

  async function generateCode() {
    if (!user) return
    setGenerating(true)
    const code = user.firstName?.toLowerCase().replace(/\s/g, '') + Math.random().toString(36).slice(2, 6).toUpperCase()
    await sb.from('profiles').update({ referral_code: code }).eq('id', user.id)
    await sb.from('referrals').insert({ referrer_id: user.id, referral_code: code })
    setMyCode(code)
    setGenerating(false)
    showToast('Referral code created!', 'ok')
    load()
  }

  function copyLink() {
    const link = `${window.location.origin}?ref=${myCode}`
    navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    showToast('Link copied!', 'ok')
  }

  function shareWhatsApp() {
    const link = `${window.location.origin}?ref=${myCode}`
    const text = `Join me on Gopexly — Africa's Social Investing Platform! Track NGX stocks, share your portfolio, and learn how to invest smarter. Sign up free: ${link}`
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank')
  }

  function shareTwitter() {
    const link = `${window.location.origin}?ref=${myCode}`
    const text = `I'm investing smarter with Gopexly — Africa's social investing platform. Track NGX stocks, share insights, and grow your wealth. Join free 👇 #NGX #Investing #Nigeria`
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(link)}`, '_blank')
  }

  const completedReferrals = referrals.filter(r => r.status === 'completed').length
  const rewardedReferrals = referrals.filter(r => r.reward_given).length
  const nextRewardAt = 3
  const progressToReward = Math.min(completedReferrals % nextRewardAt, nextRewardAt)

  return (
    <div className="max-w-[680px] mx-auto px-4 py-5 pb-20">
      <div className="text-center mb-8">
        <h1 className="font-display text-[26px] font-extrabold mb-2">🎁 Refer & Earn</h1>
        <p className="text-[15px] text-text-muted">Invite 3 friends and get <strong className="text-primary">1 month Pro free</strong></p>
      </div>

      {/* Hero reward card */}
      <div className="bg-gradient-to-br from-[#0f172a] via-[#1e1b4b] to-[#0f4dd4] text-white rounded-3xl p-6 mb-6">
        <div className="text-center mb-5">
          <div className="text-[48px] mb-2">👑</div>
          <div className="font-display text-[22px] font-extrabold mb-1">Invite 3 friends</div>
          <div className="text-white/70 text-[14px]">Get 1 month of Gopexly Pro — free</div>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-5">
          {[1, 2, 3].map(n => {
            const done = n <= completedReferrals % nextRewardAt || (completedReferrals > 0 && completedReferrals % nextRewardAt === 0)
            return (
              <div key={n} className={`rounded-2xl p-3 text-center border-2 ${done ? 'bg-gain/20 border-gain/40' : 'bg-white/10 border-white/20'}`}>
                <div className="text-[24px] mb-1">{done ? '✅' : '👤'}</div>
                <div className="text-[12px] font-bold">Friend {n}</div>
                <div className="text-[10px] text-white/60">{done ? 'Joined!' : 'Pending'}</div>
              </div>
            )
          })}
        </div>

        {/* Progress */}
        <div className="mb-5">
          <div className="flex justify-between text-[12px] text-white/60 mb-2">
            <span>{progressToReward}/{nextRewardAt} referrals</span>
            <span>{nextRewardAt - progressToReward} more to earn Pro</span>
          </div>
          <div className="bg-white/20 rounded-full h-2.5 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-amber to-yellow-400 rounded-full transition-all" style={{ width: `${(progressToReward / nextRewardAt) * 100}%` }} />
          </div>
        </div>

        {/* Code and share */}
        {loading ? (
          <div className="flex justify-center"><Spinner className="text-white" /></div>
        ) : myCode ? (
          <div>
            <div className="flex items-center gap-2 bg-white/10 rounded-2xl px-4 py-3 mb-3">
              <span className="text-[14px] text-white/60 font-mono flex-1">gopexly.com?ref=<strong className="text-white">{myCode}</strong></span>
              <button onClick={copyLink}
                className={`text-[12px] font-bold px-3 py-1.5 rounded-xl transition-all ${copied ? 'bg-gain text-white' : 'bg-white text-[#0f172a] hover:bg-white/90'}`}>
                {copied ? '✓ Copied!' : 'Copy'}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={shareWhatsApp} className="flex items-center justify-center gap-2 bg-[#25D366]/20 border border-[#25D366]/40 text-white py-2.5 rounded-xl text-[13px] font-bold hover:bg-[#25D366]/30 transition-colors">
                📱 Share on WhatsApp
              </button>
              <button onClick={shareTwitter} className="flex items-center justify-center gap-2 bg-white/10 border border-white/20 text-white py-2.5 rounded-xl text-[13px] font-bold hover:bg-white/20 transition-colors">
                🐦 Share on Twitter
              </button>
            </div>
          </div>
        ) : (
          <button onClick={generateCode} disabled={generating}
            className="w-full bg-gradient-to-r from-amber to-yellow-400 text-[#0f172a] font-extrabold py-3.5 rounded-2xl text-[15px] hover:shadow-xl transition-all disabled:opacity-50">
            {generating ? 'Generating...' : '🎁 Generate My Referral Code'}
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Total Invited', value: referrals.length.toString(), icon: '📨' },
          { label: 'Joined', value: completedReferrals.toString(), icon: '✅' },
          { label: 'Rewards Earned', value: `${rewardedReferrals} mo`, icon: '👑' },
        ].map(s => (
          <div key={s.label} className="bg-white border border-border rounded-2xl p-4 text-center">
            <div className="text-[22px] mb-1">{s.icon}</div>
            <div className="font-display text-[22px] font-extrabold">{s.value}</div>
            <div className="text-[11px] text-text-muted uppercase tracking-wide">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Referral history */}
      {referrals.length > 0 && (
        <div className="bg-white border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border font-display text-[14px] font-extrabold">Your Referrals</div>
          {referrals.map(r => (
            <div key={r.id} className="flex items-center gap-3 px-5 py-3.5 border-b border-border last:border-0">
              <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-[13px]">👤</div>
              <div className="flex-1">
                <div className="font-semibold text-[14px]">
                  {r.referred_id ? (r.referred_profiles?.name || 'New User') : 'Pending signup'}
                </div>
                <div className="text-[12px] text-text-muted">Code: {r.referral_code} · {fmtDate(r.created_at)}</div>
              </div>
              <div className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${
                r.status === 'completed' ? 'bg-gain-bg text-gain' : r.reward_given ? 'bg-amber-bg text-amber' : 'bg-gray-100 text-text-muted'
              }`}>
                {r.reward_given ? '👑 Rewarded' : r.status === 'completed' ? '✅ Joined' : '⏳ Pending'}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* How it works */}
      <div className="mt-6 bg-gray-50 border border-border rounded-2xl p-5">
        <div className="font-bold text-[14px] mb-4">How it works</div>
        {[
          { icon: '🔗', title: 'Share your link', desc: 'Copy your unique referral link and share it with friends and family' },
          { icon: '👋', title: 'Friend signs up', desc: 'When they create a Gopexly account using your link they become your referral' },
          { icon: '👑', title: 'Earn Pro free', desc: 'Every 3 friends who join = 1 month of Gopexly Pro, credited automatically' },
        ].map(step => (
          <div key={step.title} className="flex gap-3 mb-3 last:mb-0">
            <div className="w-9 h-9 rounded-xl bg-primary-light flex items-center justify-center text-[18px] flex-shrink-0">{step.icon}</div>
            <div>
              <div className="font-bold text-[13px]">{step.title}</div>
              <div className="text-[12px] text-text-muted leading-relaxed">{step.desc}</div>
            </div>
          </div>
        ))}
      </div>

      <Toast {...toast} />
    </div>
  )
}
