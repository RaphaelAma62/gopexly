'use client'

import { useState, useEffect, useRef } from 'react'
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

export default function ProfilePage() {
  const sb = createClient()
  const router = useRouter()
  const { user, signOut } = useAuth()
  const { prices } = usePrices()
  const { toast, showToast } = useToast()

  const [profile, setProfile]     = useState<Profile | null>(null)
  const [posts, setPosts]         = useState<Post[]>([])
  const [holdings, setHoldings]   = useState<Holding[]>([])
  const [tab, setTab]             = useState<ProfileTab>('posts')
  const [loading, setLoading]     = useState(true)
  const [editOpen, setEditOpen]   = useState(false)
  const [saving, setSaving]       = useState(false)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  // Edit form state
  const [editName, setEditName]         = useState('')
  const [editBio, setEditBio]           = useState('')
  const [editLocation, setEditLocation] = useState('')
  const [editCountry, setEditCountry]   = useState('')

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
    }
    setPosts((postsRes.data || []) as Post[])
    setHoldings((holdRes.data || []) as Holding[])
    setLoading(false)
  }

  async function saveProfile() {
    if (!user) return
    setSaving(true)
    await sb.from('profiles').update({
      name: editName,
      bio: editBio,
      location: editLocation,
      country: editCountry,
    }).eq('id', user.id)
    setProfile(prev => prev ? { ...prev, name: editName, bio: editBio, location: editLocation, country: editCountry } : prev)
    setSaving(false)
    setEditOpen(false)
    showToast('Profile updated!', 'ok')
  }

  async function handleAvatarUpload(file: File) {
    if (!user) return
    if (file.size > 3 * 1024 * 1024) { showToast('Image must be under 3MB', 'err'); return }
    if (!file.type.startsWith('image/')) { showToast('Please upload an image file', 'err'); return }
    setAvatarUploading(true)
    try {
      const ext = file.name.split('.').pop() || 'jpg'
      const path = `avatars/${user.id}.${ext}`
      const { error: upErr } = await sb.storage
        .from('post-images')
        .upload(path, file, { contentType: file.type, upsert: true })
      if (upErr) { showToast('Upload failed: ' + upErr.message, 'err'); return }
      const { data: urlData } = sb.storage.from('post-images').getPublicUrl(path)
      const avatarUrl = urlData.publicUrl + `?t=${Date.now()}`
      await sb.from('profiles').update({ avatar_url: avatarUrl }).eq('id', user.id)
      setProfile(prev => prev ? { ...prev, avatar_url: avatarUrl } : prev)
      showToast('Profile picture updated! 🎉', 'ok')
    } catch (e) {
      showToast('Something went wrong', 'err')
      console.error(e)
    }
    setAvatarUploading(false)
  }

  async function doSignOut() {
    await signOut()
    router.replace('/')
  }

  const ini = profile?.initials || user?.initials || '?'
  const avatarUrl = (profile as Profile & { avatar_url?: string })?.avatar_url
  const pfVal = portfolioValue >= 1_000_000 ? `₦${(portfolioValue / 1_000_000).toFixed(2)}M`
    : portfolioValue >= 1_000 ? `₦${(portfolioValue / 1_000).toFixed(0)}K`
    : `₦${portfolioValue.toFixed(0)}`

  if (loading) return (
    <div className="flex justify-center items-center h-[60vh]">
      <Spinner size="lg" className="text-primary" />
    </div>
  )

  return (
    <div className="max-w-[900px] mx-auto px-4 pb-16 pt-6">

      {/* ── PROFILE HEADER ─────────────────────────── */}
      <div className="bg-white border border-border rounded-3xl p-6 mb-5 shadow-sm">
        <div className="flex items-start gap-5 flex-wrap">

          {/* Avatar with upload */}
          <div className="relative flex-shrink-0">
            <div className="w-[88px] h-[88px] rounded-full overflow-hidden border-4 border-primary/20 shadow-md">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-primary to-[#7c3aed] flex items-center justify-center text-white text-[28px] font-extrabold">
                  {ini}
                </div>
              )}
              {avatarUploading && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-full">
                  <Spinner className="text-white" />
                </div>
              )}
            </div>
            {/* Upload button */}
            <button
              onClick={() => avatarInputRef.current?.click()}
              disabled={avatarUploading}
              className="absolute -bottom-1 -right-1 w-8 h-8 bg-primary text-white rounded-full flex items-center justify-center text-[14px] shadow-md hover:bg-primary-dark transition-all border-2 border-white"
              title="Change profile picture"
            >
              📷
            </button>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleAvatarUpload(f) }}
            />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <h1 className="font-display text-[22px] font-extrabold text-text">
                {profile?.name || user?.name || 'User'}
              </h1>
              {profile?.is_verified && (
                <span className="text-[10px] bg-primary-light text-primary px-2 py-0.5 rounded-full font-bold border border-primary-border">✓ Verified</span>
              )}
              {profile?.role === 'admin' && (
                <span className="text-[10px] bg-[#1e1b4b] text-[#a5b4fc] px-2 py-0.5 rounded-full font-bold">🛡 Admin</span>
              )}
            </div>
            {profile?.username && (
              <div className="text-[13px] text-text-muted mb-1">@{profile.username}</div>
            )}
            {profile?.bio && (
              <div className="text-[14px] text-text-secondary leading-relaxed mb-2">{profile.bio}</div>
            )}
            <div className="flex flex-wrap gap-3 text-[12px] text-text-muted">
              {profile?.location && <span>📍 {profile.location}</span>}
              {profile?.country && <span>🌍 {profile.country}</span>}
              {profile?.joined_at && <span>📅 Joined {fmtDate(profile.joined_at)}</span>}
              <span>✉ {user?.email}</span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2 flex-shrink-0">
            <button onClick={() => setEditOpen(true)}
              className="flex items-center gap-1.5 bg-primary text-white text-[13px] font-semibold px-4 py-2 rounded-xl hover:bg-primary-dark transition-all">
              ✏ Edit Profile
            </button>
            <button onClick={doSignOut}
              className="flex items-center gap-1.5 bg-loss-bg border border-loss-border text-loss text-[13px] font-semibold px-4 py-2 rounded-xl hover:bg-loss hover:text-white transition-all">
              ↩ Log Out
            </button>
            {(profile?.role === 'admin' || profile?.role === 'editor') && (
              <Link href="/admin"
                className="flex items-center gap-1.5 bg-[#1e1b4b] text-white text-[13px] font-semibold px-4 py-2 rounded-xl hover:bg-indigo-900 transition-all text-center justify-center">
                🛡 Admin Panel
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* ── STATS ──────────────────────────────────── */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-5">
        {[
          { label: 'Portfolio',    value: portfolioValue > 0 ? pfVal : '₦0' },
          { label: 'Total Return', value: '—' },
          { label: 'Posts',        value: (profile?.total_posts || 0).toString() },
          { label: 'Followers',    value: (profile?.followers_count || 0).toString() },
          { label: 'Points',       value: (profile?.points || 0).toLocaleString() },
          { label: 'Day Streak',   value: `🔥 ${profile?.streak || 0}` },
        ].map(s => (
          <div key={s.label} className="bg-white border border-border rounded-xl py-3 px-2 text-center shadow-sm">
            <div className="font-display text-[15px] font-extrabold text-text">{s.value}</div>
            <div className="text-[9px] text-text-muted mt-0.5 uppercase tracking-wide">{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── TABS ───────────────────────────────────── */}
      <div className="flex border-b border-border mb-5 bg-white rounded-t-xl overflow-hidden">
        {(['posts', 'portfolio', 'notifications', 'settings'] as ProfileTab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn('flex-1 py-3 text-[13px] font-semibold capitalize border-b-2 transition-all',
              tab === t ? 'text-primary border-primary bg-primary-light' : 'text-text-muted border-transparent hover:text-text-secondary hover:bg-gray-50')}>
            {t === 'posts' ? '📋 Posts' : t === 'portfolio' ? '💼 Portfolio' : t === 'notifications' ? '🔔 Alerts' : '⚙ Settings'}
          </button>
        ))}
      </div>

      {/* ── POSTS TAB ──────────────────────────────── */}
      {tab === 'posts' && (
        <div className="flex flex-col gap-3">
          {posts.length === 0 ? (
            <div className="text-center py-12 text-text-muted bg-white border border-border rounded-2xl">
              <div className="text-3xl mb-2">📋</div>
              <div className="text-[15px] font-semibold text-text-secondary mb-1">No posts yet</div>
              <Link href="/home" className="text-primary text-[13px] font-semibold">Write your first post →</Link>
            </div>
          ) : posts.map(p => (
            <div key={p.id} className="bg-white border border-border rounded-2xl p-4 hover:border-primary-border hover:shadow-sm transition-all">
              <div className="text-[14px] text-text-secondary leading-relaxed mb-3">{p.body}</div>
              <div className="flex items-center gap-4 text-[12px] text-text-muted pt-2.5 border-t border-border">
                <span>❤️ {p.likes_count}</span>
                <span>💬 {p.comments_count}</span>
                <span className="ml-auto">{fmtTime(p.created_at)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── PORTFOLIO TAB ──────────────────────────── */}
      {tab === 'portfolio' && (
        <div>
          {holdings.length === 0 ? (
            <div className="text-center py-12 text-text-muted bg-white border border-border rounded-2xl">
              <div className="text-3xl mb-2">💼</div>
              <div className="text-[15px] font-semibold text-text-secondary mb-1">No holdings yet</div>
              <Link href="/portfolio" className="text-primary text-[13px] font-semibold">Go to Portfolio to add holdings →</Link>
            </div>
          ) : (
            <div className="bg-white border border-border rounded-2xl overflow-hidden shadow-sm">
              {holdings.map(h => {
                const mp  = prices[h.ticker]?.price ?? h.buy_price
                const mkt = h.shares * mp
                const pl  = mkt - (h.shares * h.buy_price)
                const up  = pl >= 0
                return (
                  <div key={h.id} className="flex items-center justify-between px-5 py-4 border-b border-border last:border-0 hover:bg-gray-50 transition-colors">
                    <div>
                      <div className="font-bold text-[15px] font-mono text-primary">{h.ticker}</div>
                      <div className="text-[12px] text-text-muted">{h.company_name} · {h.shares} shares</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-[15px]">₦{mkt.toLocaleString('en-NG', { maximumFractionDigits: 0 })}</div>
                      <div className={cn('text-[12px] font-bold', up ? 'text-gain' : 'text-loss')}>
                        {up ? '+' : ''}₦{Math.abs(pl).toLocaleString('en-NG', { maximumFractionDigits: 0 })}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── NOTIFICATIONS TAB ──────────────────────── */}
      {tab === 'notifications' && (
        <div className="bg-white border border-border rounded-2xl p-6 text-center text-text-muted shadow-sm">
          <div className="text-3xl mb-2">🔔</div>
          <div className="text-[15px] font-semibold text-text-secondary mb-1">No new notifications</div>
          <Link href="/notifications" className="text-primary text-[13px] font-semibold">View all notifications →</Link>
        </div>
      )}

      {/* ── SETTINGS TAB ───────────────────────────── */}
      {tab === 'settings' && (
        <div className="flex flex-col gap-4 max-w-[520px]">
          <div className="bg-white border border-border rounded-2xl p-5 shadow-sm">
            <div className="font-display text-[15px] font-extrabold mb-4">Account Security</div>
            <div className="flex flex-col gap-px">
              {[
                { icon: '🔒', label: 'Password',          sub: 'Change your login password',  action: 'Change' },
                { icon: '📧', label: 'Email Address',      sub: user?.email || '',             action: 'Update' },
                { icon: '🛡', label: 'Two-Factor Auth',    sub: 'Not enabled',                 action: 'Enable' },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between py-3.5 border-b border-border last:border-0">
                  <div className="flex items-center gap-3">
                    <span className="text-[18px]">{item.icon}</span>
                    <div>
                      <div className="text-[14px] font-semibold">{item.label}</div>
                      <div className="text-[12px] text-text-muted truncate max-w-[240px]">{item.sub}</div>
                    </div>
                  </div>
                  <button className="text-[12px] font-semibold text-primary bg-primary-light border border-primary-border px-3 py-1.5 rounded-lg hover:bg-primary hover:text-white transition-all flex-shrink-0">
                    {item.action}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-border rounded-2xl p-5 shadow-sm">
            <div className="font-display text-[15px] font-extrabold mb-4">Profile Picture</div>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-border flex-shrink-0">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-primary to-[#7c3aed] flex items-center justify-center text-white text-[20px] font-extrabold">{ini}</div>
                )}
              </div>
              <div>
                <div className="text-[13px] font-semibold mb-1">Upload a new photo</div>
                <div className="text-[12px] text-text-muted mb-2">JPG, PNG or GIF · Max 3MB</div>
                <button onClick={() => avatarInputRef.current?.click()} disabled={avatarUploading}
                  className="text-[12px] font-bold bg-primary text-white px-4 py-2 rounded-xl hover:bg-primary-dark transition-all disabled:opacity-50">
                  {avatarUploading ? 'Uploading...' : '📷 Choose Photo'}
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white border border-loss-border rounded-2xl p-5 shadow-sm">
            <div className="font-display text-[15px] font-extrabold mb-1 text-loss">Danger Zone</div>
            <div className="text-[13px] text-text-muted mb-3">Permanently delete your account and all data. This cannot be undone.</div>
            <button className="w-full bg-loss-bg border border-loss-border text-loss py-3 rounded-xl text-[13px] font-bold hover:bg-loss hover:text-white transition-all">
              Delete My Account
            </button>
          </div>
        </div>
      )}

      {/* ── EDIT PROFILE MODAL ─────────────────────── */}
      {editOpen && (
        <div className="fixed inset-0 bg-black/50 z-[500] flex items-center justify-center backdrop-blur-sm p-4"
          onClick={e => { if (e.target === e.currentTarget) setEditOpen(false) }}>
          <div className="bg-white rounded-3xl p-6 w-full max-w-[500px] shadow-2xl">
            <div className="font-display text-[18px] font-extrabold mb-5">Edit Profile</div>

            {/* Avatar in modal */}
            <div className="flex items-center gap-4 mb-5 pb-5 border-b border-border">
              <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-border flex-shrink-0">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-primary to-[#7c3aed] flex items-center justify-center text-white text-[20px] font-extrabold">{ini}</div>
                )}
              </div>
              <div>
                <div className="text-[13px] font-semibold mb-1">Profile Picture</div>
                <button onClick={() => avatarInputRef.current?.click()} disabled={avatarUploading}
                  className="text-[12px] font-bold text-primary bg-primary-light border border-primary-border px-3 py-1.5 rounded-lg hover:bg-primary hover:text-white transition-all disabled:opacity-50">
                  {avatarUploading ? 'Uploading...' : '📷 Change Photo'}
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <div>
                <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wide mb-1.5">Full Name</label>
                <input value={editName} onChange={e => setEditName(e.target.value)}
                  className="w-full bg-gray-50 border-[1.5px] border-border text-text px-3.5 py-2.5 rounded-xl text-[14px] outline-none focus:border-primary focus:bg-white transition-all" />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wide mb-1.5">Bio</label>
                <textarea value={editBio} onChange={e => setEditBio(e.target.value)} rows={3} placeholder="Tell investors about yourself..."
                  className="w-full bg-gray-50 border-[1.5px] border-border text-text px-3.5 py-2.5 rounded-xl text-[14px] outline-none focus:border-primary focus:bg-white transition-all resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wide mb-1.5">Location</label>
                  <input value={editLocation} onChange={e => setEditLocation(e.target.value)} placeholder="Lagos, Nigeria"
                    className="w-full bg-gray-50 border-[1.5px] border-border text-text px-3.5 py-2.5 rounded-xl text-[14px] outline-none focus:border-primary focus:bg-white transition-all" />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wide mb-1.5">Country</label>
                  <select value={editCountry} onChange={e => setEditCountry(e.target.value)}
                    className="w-full bg-gray-50 border-[1.5px] border-border text-text px-3.5 py-2.5 rounded-xl text-[14px] outline-none focus:border-primary focus:bg-white transition-all">
                    {['Nigeria', 'Ghana', 'Kenya', 'South Africa', 'United Kingdom', 'United States', 'Canada', 'Other'].map(c => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="flex gap-2 justify-end mt-5">
              <button onClick={() => setEditOpen(false)} className="px-5 py-2.5 bg-gray-100 text-text-secondary rounded-xl text-[13px] font-semibold">Cancel</button>
              <button onClick={saveProfile} disabled={saving}
                className="px-7 py-2.5 bg-primary text-white rounded-xl text-[13px] font-bold hover:bg-primary-dark disabled:opacity-50 transition-all">
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