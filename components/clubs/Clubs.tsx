'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'
import { useProStatus } from '@/lib/hooks/useProStatus'
import { useToast } from '@/lib/hooks/useToast'
import { Toast, Spinner, EmptyState } from '@/components/ui'
import ProGate from '@/components/pro/ProGate'
import { fmtTime, cn } from '@/lib/utils'

interface Club {
  id: string
  name: string
  description: string | null
  avatar: string
  creator_id: string
  is_private: boolean
  member_count: number
  created_at: string
  is_member?: boolean
  is_creator?: boolean
}

interface ClubPost {
  id: string
  body: string
  created_at: string
  profiles: { name: string | null; initials: string | null } | null
}

export default function Clubs() {
  const sb = createClient()
  const { user } = useAuth()
  const { isPro, settings } = useProStatus()
  const { toast, showToast } = useToast()
  const [clubs, setClubs] = useState<Club[]>([])
  const [myClubs, setMyClubs] = useState<Club[]>([])
  const [activeClub, setActiveClub] = useState<Club | null>(null)
  const [clubPosts, setClubPosts] = useState<ClubPost[]>([])
  const [loading, setLoading] = useState(true)
  const [postText, setPostText] = useState('')
  const [posting, setPosting] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newAvatar, setNewAvatar] = useState('🏆')
  const [creating, setCreating] = useState(false)
  const [tab, setTab] = useState<'discover' | 'mine'>('discover')

  const AVATARS = ['🏆', '💰', '📈', '🇳🇬', '🏦', '💎', '🚀', '🌍', '⚡', '🎯']

  const load = useCallback(async () => {
    if (!user) return
    const { data: allClubs } = await sb.from('clubs').select('*').order('member_count', { ascending: false }).limit(20)
    const { data: memberships } = await sb.from('club_members').select('club_id').eq('user_id', user.id)
    const memberIds = new Set((memberships || []).map((m: { club_id: string }) => m.club_id))

    const clubsWithMembership = ((allClubs || []) as Club[]).map(c => ({
      ...c, is_member: memberIds.has(c.id), is_creator: c.creator_id === user.id
    }))
    setClubs(clubsWithMembership)
    setMyClubs(clubsWithMembership.filter(c => c.is_member || c.is_creator))
    setLoading(false)
  }, [sb, user])

  useEffect(() => { load() }, [load])

  async function openClub(club: Club) {
    setActiveClub(club)
    const { data } = await sb.from('club_posts')
      .select('id,body,created_at,profiles!club_posts_user_id_fkey(name,initials)')
      .eq('club_id', club.id)
      .order('created_at', { ascending: false })
      .limit(30)
    setClubPosts((data || []) as unknown as ClubPost[])
  }

  async function joinClub(clubId: string) {
    if (!user) return
    await sb.from('club_members').insert({ club_id: clubId, user_id: user.id })
    await sb.from('clubs').update({ member_count: clubs.find(c => c.id === clubId)!.member_count + 1 }).eq('id', clubId)
    showToast('Joined club!', 'ok')
    load()
  }

  async function leaveClub(clubId: string) {
    if (!user) return
    await sb.from('club_members').delete().eq('club_id', clubId).eq('user_id', user.id)
    showToast('Left club', 'ok')
    setActiveClub(null)
    load()
  }

  async function postInClub() {
    if (!postText.trim() || !activeClub || !user) return
    setPosting(true)
    const { data } = await sb.from('club_posts')
      .insert({ club_id: activeClub.id, user_id: user.id, body: postText.trim() })
      .select('id,body,created_at,profiles!club_posts_user_id_fkey(name,initials)').single()
    if (data) setClubPosts(prev => [data as unknown as ClubPost, ...prev])
    setPostText('')
    setPosting(false)
  }

  async function createClub() {
    if (!newName || !user) { showToast('Club name required', 'err'); return }
    if (!isPro) { showToast('Creating clubs requires Pro', 'err'); return }
    setCreating(true)
    const { data, error } = await sb.from('clubs').insert({ name: newName, description: newDesc, avatar: newAvatar, creator_id: user.id }).select().single()
    if (error) { showToast('Error: ' + error.message, 'err'); setCreating(false); return }
    await sb.from('club_members').insert({ club_id: (data as Club).id, user_id: user.id, role: 'creator' })
    setNewName(''); setNewDesc(''); setShowCreate(false); setCreating(false)
    showToast('Club created!', 'ok')
    load()
  }

  return (
    <div className="max-w-[900px] mx-auto px-4 py-5 pb-20">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="font-display text-[22px] font-extrabold">🏠 Investment Clubs</h1>
          <p className="text-[13px] text-text-muted mt-0.5">Invest and learn together with your community</p>
        </div>
        {isPro && settings.pro_feature_clubs && (
          <button onClick={() => setShowCreate(p => !p)}
            className="bg-primary text-white font-bold text-[13px] px-4 py-2.5 rounded-xl hover:bg-primary-dark transition-all">
            + Create Club
          </button>
        )}
      </div>

      {/* Create club form */}
      {showCreate && isPro && (
        <div className="bg-white border-2 border-primary-border rounded-2xl p-5 mb-5">
          <div className="font-bold text-[15px] mb-4">Create Investment Club</div>
          <div className="flex flex-col gap-3">
            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Club Name *"
              className="w-full bg-gray-50 border-2 border-border text-text px-4 py-2.5 rounded-xl text-[14px] outline-none focus:border-primary" />
            <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} rows={2} placeholder="What is this club about?"
              className="w-full bg-gray-50 border-2 border-border text-text px-4 py-2.5 rounded-xl text-[14px] outline-none focus:border-primary resize-none" />
            <div>
              <div className="text-[12px] font-bold text-text-muted mb-2">Club Avatar</div>
              <div className="flex gap-2 flex-wrap">
                {AVATARS.map(a => (
                  <button key={a} onClick={() => setNewAvatar(a)}
                    className={cn('w-10 h-10 rounded-xl text-[20px] flex items-center justify-center transition-all border-2',
                      newAvatar === a ? 'border-primary bg-primary-light' : 'border-border bg-gray-50 hover:border-primary-border')}>
                    {a}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 bg-gray-100 text-text-secondary rounded-xl text-[13px] font-semibold">Cancel</button>
              <button onClick={createClub} disabled={creating} className="px-6 py-2 bg-primary text-white rounded-xl text-[13px] font-bold">
                {creating ? 'Creating...' : 'Create Club'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Non-pro gate for creating */}
      {!isPro && !settings.pro_feature_clubs && (
        <ProGate feature="Create Investment Clubs" description="Start your own investment club and invite friends to discuss stocks, track performance, and invest together."
          icon="🏠" freeLimit="Join only" proLimit="Create unlimited" compact className="mb-5" />
      )}

      {/* Active club view */}
      {activeClub ? (
        <div>
          <button onClick={() => setActiveClub(null)} className="flex items-center gap-1.5 text-[13px] text-text-muted hover:text-primary mb-4 font-medium">
            ← All Clubs
          </button>
          <div className="bg-gradient-to-br from-[#0f172a] to-primary rounded-3xl p-5 text-white mb-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="text-[40px]">{activeClub.avatar}</div>
              <div>
                <div className="font-display text-[20px] font-extrabold">{activeClub.name}</div>
                <div className="text-white/60 text-[13px]">{activeClub.member_count} members</div>
              </div>
            </div>
            {activeClub.description && <div className="text-white/70 text-[14px]">{activeClub.description}</div>}
          </div>

          {/* Post in club */}
          <div className="bg-white border-2 border-border rounded-2xl p-4 mb-4">
            <textarea value={postText} onChange={e => setPostText(e.target.value)} rows={2}
              placeholder={`Share something with ${activeClub.name}...`}
              className="w-full bg-gray-50 border-2 border-border text-text px-4 py-2.5 rounded-xl text-[14px] outline-none focus:border-primary resize-none mb-3" />
            <div className="flex justify-end gap-2">
              {activeClub.is_member && !activeClub.is_creator && (
                <button onClick={() => leaveClub(activeClub.id)} className="px-4 py-2 bg-loss-bg text-loss rounded-xl text-[13px] font-semibold">Leave Club</button>
              )}
              <button onClick={postInClub} disabled={posting || !postText.trim()} className="px-6 py-2 bg-primary text-white rounded-xl text-[13px] font-bold disabled:opacity-50">
                {posting ? 'Posting...' : 'Post'}
              </button>
            </div>
          </div>

          {/* Club posts */}
          <div className="flex flex-col gap-2">
            {clubPosts.map(p => (
              <div key={p.id} className="bg-white border border-border rounded-2xl p-4">
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-[#7c3aed] text-white flex items-center justify-center text-[11px] font-bold">
                    {p.profiles?.initials || 'U'}
                  </div>
                  <div>
                    <div className="font-bold text-[13px]">{p.profiles?.name || 'Member'}</div>
                    <div className="text-[11px] text-text-muted">{fmtTime(p.created_at)}</div>
                  </div>
                </div>
                <p className="text-[14px] text-text-secondary leading-relaxed">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* Tabs */}
          <div className="flex gap-1 bg-gray-50 p-1 rounded-xl border border-border mb-5">
            {[{ key: 'discover', label: '🔍 Discover' }, { key: 'mine', label: `👥 My Clubs (${myClubs.length})` }].map(t => (
              <button key={t.key} onClick={() => setTab(t.key as typeof tab)}
                className={cn('flex-1 py-2.5 rounded-lg text-[13px] font-bold transition-all',
                  tab === t.key ? 'bg-white shadow-sm text-primary' : 'text-text-muted hover:text-text')}>
                {t.label}
              </button>
            ))}
          </div>

          {loading ? <div className="flex justify-center py-10"><Spinner className="text-primary" /></div> : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {(tab === 'mine' ? myClubs : clubs).map(club => (
                <div key={club.id} className="bg-white border border-border rounded-2xl p-4 hover:border-primary-border hover:shadow-sm transition-all">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 rounded-2xl bg-primary-light flex items-center justify-center text-[24px]">{club.avatar}</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-[15px] truncate">{club.name}</div>
                      <div className="text-[12px] text-text-muted">{club.member_count} members</div>
                    </div>
                    {club.is_member || club.is_creator ? (
                      <span className="text-[11px] bg-primary-light text-primary px-2.5 py-1 rounded-full font-bold flex-shrink-0">Joined</span>
                    ) : null}
                  </div>
                  {club.description && <p className="text-[13px] text-text-muted mb-3 line-clamp-2">{club.description}</p>}
                  <div className="flex gap-2">
                    <button onClick={() => openClub(club)} className="flex-1 bg-primary-light text-primary font-bold text-[13px] py-2 rounded-xl hover:bg-primary hover:text-white transition-all">
                      Open Club
                    </button>
                    {!club.is_member && !club.is_creator && (
                      <button onClick={() => joinClub(club.id)} className="px-4 py-2 bg-primary text-white font-bold text-[13px] rounded-xl hover:bg-primary-dark transition-all">
                        Join
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {(tab === 'mine' ? myClubs : clubs).length === 0 && (
                <div className="col-span-2">
                  <EmptyState icon="🏠" title={tab === 'mine' ? 'No clubs yet' : 'No clubs available'}
                    subtitle={tab === 'mine' ? 'Join or create an investment club' : 'Be the first to create a club'} />
                </div>
              )}
            </div>
          )}
        </>
      )}

      <Toast {...toast} />
    </div>
  )
}
