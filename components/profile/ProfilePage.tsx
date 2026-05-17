'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { fmtDate, fmtTime, cn } from '@/lib/utils'
import { useAuth } from '@/lib/hooks/useAuth'
import { usePrices } from '@/lib/hooks/usePrices'
import { useToast } from '@/lib/hooks/useToast'
import { Toast, Spinner } from '@/components/ui'
import type { Profile, Post, Holding } from '@/types'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type ProfileTab = 'posts' | 'portfolio' | 'notifications' | 'settings'

const COVER_COLORS: Record<string, string> = {
  blue: 'from-blue-500 to-indigo-600',
  purple: 'from-purple-500 to-pink-500',
  green: 'from-green-500 to-teal-500',
  orange: 'from-orange-400 to-red-500',
  dark: 'from-gray-700 to-gray-900',
}

export default function ProfilePage() {
  const sb = createClient()
  const router = useRouter()
  const { user, signOut } = useAuth()
  const { prices } = usePrices()
  const { toast, showToast } = useToast()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [holdings, setHoldings] = useState<Holding[]>([])
  const [tab, setTab] = useState<ProfileTab>('posts')
  const [loading, setLoading] = useState(true)
  const [editOpen, setEditOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  // Edit form
  const [editName, setEditName] = useState('')
  const [editBio, setEditBio] = useState('')
  const [editLocation, setEditLocation] = useState('')
  const [editCountry, setEditCountry] = useState('')
  const [editCover, setEditCover] = useState('blue')

  // Computed portfolio value
  let portfolioValue = 0
  holdings.forEach(h => {
    portfolioValue += h.shares * (prices[h.ticker]?.price ?? h.buy_price)
  })

  useEffect(() => {
    if (!user) return
    loadProfile()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  async function loadProfile() {
    if (!user) return
    const [pRes, postsRes, holdRes] = await Promise.all([
      sb.from('profiles').select('*').eq('id', user.id).single(),
      sb.from('posts').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20),
      sb.from('holdings').select('*').eq('user_id', user.id)
    ])
    if (pRes.data) {
      setProfile(pRes.data as Profile)
      setEditName(pRes.data.name || '')
      setEditBio(pRes.data.bio || '')
      setEditLocation(pRes.data.location || '')
      setEditCountry(pRes.data.country || 'Nigeria')
      setEditCover(pRes.data.cover_color || 'blue')
    }
    setPosts((postsRes.data || []) as Post[])
    setHoldings((holdRes.data || []) as Holding[])
    setLoading(false)
  }

  async function saveProfile() {
    if (!user) return
    setSaving(true)
    const { error } = await sb.from('profiles').update({
      name: editName, bio: editBio, location: editLocation,
      country: editCountry, cover_color: editCover
    }).eq('id', user.id)
    if (error) { showToast('Error: ' + error.message, 'err'); setSaving(false); return }
    setProfile(prev => prev ? { ...prev, name: editName, bio: editBio, location: editLocation, country: editCountry, cover_color: editCover } : prev)
    setEditOpen(false); setSaving(false)
    showToast('Profile updated!', 'ok')
  }

  async function doSignOut() {
    if (!confirm('Log out?')) return
    await signOut()
    router.replace('/')
  }

  if (loading) return (
    <div className="flex justify-center items-center h-[60vh]"><Spinner size="lg" className="text-primary" /></div>
  )

  const ini = profile?.initials || user?.initials || '?'
  const coverGrad = COVER_COLORS[profile?.cover_color || 'blue']
  const pfVal = portfolioValue >= 1_000_000 ? `₦${(portfolioValue / 1_000_000).toFixed(2)}M`
    : portfolioValue >= 1_000 ? `₦${(portfolioValue / 1_000).toFixed(0)}K`
    : `₦${portfolioValue.toFixed(0)}`

  return (
    <div className="max-w-[900px] mx-auto px-4 pb-16">
      {/* Cover */}
      <div className={cn('h-[140px] rounded-2xl mt-4 bg-gradient-to-r relative', coverGrad)}>
        <button
          onClick={() => setEditOpen(true)}
          className="absolute top-3 right-3 bg-black/30 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg hover:bg-black/50 transition-all"
        >
          ✏ Change Cover
        </button>
      </div>

      {/* Profile info */}
      <div className="flex items-start justify-between px-2 -mt-8 mb-6 flex-wrap gap-3">
        <div className="flex items-end gap-4">
          <div className="w-[80px] h-[80px] rounded-full bg-primary border-4 border-white text-white flex items-center justify-center text-[24px] font-extrabold shadow-lg">
            {ini}
          </div>
          <div className="pb-1">
            <div className="font-display text-[20px] font-extrabold text-text flex items-center gap-2">
              {profile?.name || user?.name || 'User'}
              {profile?.is_verified && <span className="text-[10px] bg-primary-light text-primary px-2 py-0.5 rounded-full font-bold">✓ Verified</span>}
              {profile?.role === 'admin' && <span className="text-[10px] bg-[#1e1b4b] text-[#a5b4fc] px-2 py-0.5 rounded-full font-bold">🛡 Admin</span>}
            </div>
            <div className="text-[13px] text-text-muted">{user?.email}</div>
            <div className="text-[12px] text-text-muted mt-0.5">Member since {fmtDate(profile?.joined_at || null)}</div>
          </div>
        </div>
        <div className="flex gap-2 pt-10">
          <button onClick={() => setEditOpen(true)} className="flex items-center gap-1.5 bg-white border border-border text-text text-[12px] font-semibold px-4 py-2 rounded-xl hover:bg-gray-50 transition-all">
            ✏ Edit Profile
          </button>
          <button onClick={doSignOut} className="flex items-center gap-1.5 bg-loss-bg border border-loss-border text-loss text-[12px] font-semibold px-4 py-2 rounded-xl hover:bg-loss hover:text-white transition-all">
            ↩ Log Out
          </button>
          {(profile?.role === 'admin' || profile?.role === 'editor') && (
            <Link href="/admin" className="flex items-center gap-1.5 bg-[#1e1b4b] text-white text-[12px] font-semibold px-4 py-2 rounded-xl hover:bg-indigo-900 transition-all">
              🛡 Admin Panel
            </Link>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-6">
        {[
          { label: 'Portfolio', value: portfolioValue > 0 ? pfVal : '₦0' },
          { label: 'Total Return', value: '—' },
          { label: 'Posts', value: (profile?.total_posts || 0).toString() },
          { label: 'Followers', value: (profile?.followers_count || 0).toString() },
          { label: 'Points', value: (profile?.points || 0).toLocaleString() },
          { label: 'Day Streak', value: `🔥 ${profile?.streak || 0}` },
        ].map(s => (
          <div key={s.label} className="bg-surface border border-border rounded-xl py-3 px-2 text-center">
            <div className="font-display text-[15px] font-extrabold text-text">{s.value}</div>
            <div className="text-[9px] text-text-muted mt-0.5 uppercase tracking-wide">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Bio */}
      {(profile?.bio || profile?.location) && (
        <div className="bg-surface border border-border rounded-2xl p-4 mb-5">
          {profile.bio && <div className="text-[13px] text-text-secondary mb-3">{profile.bio}</div>}
          <div className="flex flex-wrap gap-4 text-[12px] text-text-muted">
            {profile.location && <span>📍 {profile.location}</span>}
            {profile.country && <span>🌍 {profile.country}</span>}
            {profile.joined_at && <span>📅 Joined {fmtDate(profile.joined_at)}</span>}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-border mb-5">
        {(['posts', 'portfolio', 'notifications', 'settings'] as ProfileTab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn('px-4 py-2.5 text-[13px] font-semibold capitalize border-b-2 transition-all',
              tab === t ? 'text-primary border-primary' : 'text-text-muted border-transparent hover:text-text-secondary')}>
            {t === 'posts' ? '📋 My Posts' : t === 'portfolio' ? '💼 Portfolio' : t === 'notifications' ? '🔔 Notifications' : '⚙ Settings'}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'posts' && (
        <div className="flex flex-col gap-3">
          {posts.length === 0 ? (
            <div className="text-center py-10 text-text-muted">
              <div className="text-3xl mb-2">📋</div>
              <div className="text-[14px] font-semibold text-text-secondary">No posts yet</div>
              <Link href="/home" className="text-primary text-[13px] mt-1 inline-block">Write your first post</Link>
            </div>
          ) : posts.map(p => (
            <div key={p.id} className="bg-surface border border-border rounded-xl p-4 hover:bg-gray-50 transition-colors">
              <div className="text-[13px] text-text-secondary leading-relaxed mb-2">{p.body}</div>
              <div className="flex items-center gap-4 text-[11px] text-text-muted">
                <span>❤️ {p.likes_count}</span>
                <span>💬 {p.comments_count}</span>
                <span>{fmtTime(p.created_at)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'portfolio' && (
        <div>
          {holdings.length === 0 ? (
            <div className="text-center py-10 text-text-muted">
              <div className="text-3xl mb-2">💼</div>
              <div className="text-[14px] font-semibold text-text-secondary mb-1">No holdings</div>
              <Link href="/portfolio" className="text-primary text-[13px]">Go to Portfolio page to add holdings</Link>
            </div>
          ) : (
            <div className="bg-surface border border-border rounded-xl overflow-hidden">
              {holdings.map(h => {
                const mp = prices[h.ticker]?.price ?? h.buy_price
                const mkt = h.shares * mp
                const pl = mkt - (h.shares * h.buy_price)
                const up = pl >= 0
                return (
                  <div key={h.id} className="flex items-center justify-between px-4 py-3 border-b border-border last:border-0">
                    <div>
                      <div className="text-[13px] font-bold">{h.ticker}</div>
                      <div className="text-[11px] text-text-muted">{h.company_name} · {h.shares} shares</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[13px] font-bold">₦{mkt.toLocaleString('en-NG', { maximumFractionDigits: 0 })}</div>
                      <div className={cn('text-[11px] font-bold', up ? 'text-gain' : 'text-loss')}>
                        {up ? '+' : ''}₦{pl.toLocaleString('en-NG', { maximumFractionDigits: 0 })}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {tab === 'notifications' && (
        <div className="bg-surface border border-border rounded-xl p-5 text-center text-text-muted">
          <div className="text-3xl mb-2">🔔</div>
          <div className="text-[14px] font-semibold text-text-secondary">No new notifications</div>
        </div>
      )}

      {tab === 'settings' && (
        <div className="bg-surface border border-border rounded-2xl p-5 max-w-[500px]">
          <div className="font-display text-[15px] font-extrabold mb-4">Security</div>
          <div className="flex flex-col gap-3">
            {[
              { icon: '🔒', label: 'Password', sub: 'Change your password', action: 'Change' },
              { icon: '📧', label: 'Email', sub: user?.email || '', action: 'Update' },
              { icon: '🛡', label: 'Two-Factor Auth', sub: 'Not enabled', action: 'Enable' },
            ].map(item => (
              <div key={item.label} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                <div className="flex items-center gap-3">
                  <span className="text-lg">{item.icon}</span>
                  <div>
                    <div className="text-[13px] font-semibold">{item.label}</div>
                    <div className="text-[11px] text-text-muted">{item.sub}</div>
                  </div>
                </div>
                <button className="text-[12px] font-semibold text-primary bg-primary-light border border-primary-border px-3 py-1.5 rounded-lg hover:bg-primary hover:text-white transition-all">
                  {item.action}
                </button>
              </div>
            ))}
          </div>
          <div className="mt-6 pt-5 border-t border-border">
            <div className="font-display text-[15px] font-extrabold mb-3 text-loss">Danger Zone</div>
            <button className="w-full bg-loss-bg border border-loss-border text-loss py-2.5 rounded-xl text-[13px] font-semibold hover:bg-loss hover:text-white transition-all">
              Delete Account
            </button>
          </div>
        </div>
      )}

      {/* Edit Profile Modal */}
      {editOpen && (
        <div className="fixed inset-0 bg-black/40 z-[500] flex items-center justify-center backdrop-blur-sm p-4"
          onClick={e => { if (e.target === e.currentTarget) setEditOpen(false) }}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-[480px] shadow-xl">
            <div className="font-display text-[16px] font-extrabold mb-5">Edit Profile</div>
            <div className="flex flex-col gap-3">
              <div>
                <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wide mb-1.5">Full Name</label>
                <input value={editName} onChange={e => setEditName(e.target.value)}
                  className="w-full bg-gray-50 border-[1.5px] border-border text-text px-3 py-2.5 rounded-xl text-[13px] outline-none focus:border-primary" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wide mb-1.5">Bio</label>
                <textarea value={editBio} onChange={e => setEditBio(e.target.value)} rows={3}
                  className="w-full bg-gray-50 border-[1.5px] border-border text-text px-3 py-2.5 rounded-xl text-[13px] outline-none focus:border-primary resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wide mb-1.5">Location</label>
                  <input value={editLocation} onChange={e => setEditLocation(e.target.value)}
                    className="w-full bg-gray-50 border-[1.5px] border-border text-text px-3 py-2.5 rounded-xl text-[13px] outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wide mb-1.5">Country</label>
                  <input value={editCountry} onChange={e => setEditCountry(e.target.value)}
                    className="w-full bg-gray-50 border-[1.5px] border-border text-text px-3 py-2.5 rounded-xl text-[13px] outline-none focus:border-primary" />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wide mb-1.5">Cover Color</label>
                <div className="flex gap-2">
                  {Object.entries(COVER_COLORS).map(([key, grad]) => (
                    <button key={key} onClick={() => setEditCover(key)}
                      className={cn('w-8 h-8 rounded-lg bg-gradient-to-r transition-all', grad, editCover === key ? 'ring-2 ring-primary ring-offset-2 scale-110' : 'hover:scale-105')} />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-5">
              <button onClick={() => setEditOpen(false)} className="px-4 py-2 bg-gray-100 text-text-secondary rounded-xl text-[13px] font-semibold">Cancel</button>
              <button onClick={saveProfile} disabled={saving}
                className="px-6 py-2 bg-primary text-white rounded-xl text-[13px] font-bold hover:bg-primary-dark disabled:opacity-50">
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast {...toast} />
    </div>
  )
}
