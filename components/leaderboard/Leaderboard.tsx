'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/lib/hooks/useAuth'
import { useToast } from '@/lib/hooks/useToast'
import { Toast, Spinner } from '@/components/ui'
import { cn, fmtDate } from '@/lib/utils'

interface LeaderboardEntry {
  id: string
  name: string | null
  username: string | null
  initials: string | null
  portfolio_pct_gain: number | null
  points: number
  streak: number
  total_posts: number
  followers_count: number
  is_verified: boolean
  joined_at: string | null
}

type LeaderboardType = 'performance' | 'points' | 'streak' | 'community'

export default function Leaderboard() {
  const sb = createClient()
  const { user } = useAuth()
  const { toast, showToast } = useToast()
  const [type, setType] = useState<LeaderboardType>('performance')
  const [data, setData] = useState<LeaderboardEntry[]>([])
  const [myRank, setMyRank] = useState<number | null>(null)
  const [myEntry, setMyEntry] = useState<LeaderboardEntry | null>(null)
  const [loading, setLoading] = useState(true)
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    loadLeaderboard()
    loadFollowing()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type])

  async function loadFollowing() {
    if (!user) return
    const { data: follows } = await sb.from('follows').select('following_id').eq('follower_id', user.id)
    setFollowedIds(new Set((follows || []).map((f: { following_id: string }) => f.following_id)))
  }

  async function loadLeaderboard() {
    setLoading(true)
    let query = sb.from('profiles').select('id,name,username,initials,portfolio_pct_gain,points,streak,total_posts,followers_count,is_verified,joined_at')

    if (type === 'performance') {
      query = query.eq('share_performance', true).not('portfolio_pct_gain', 'is', null).order('portfolio_pct_gain', { ascending: false })
    } else if (type === 'points') {
      query = query.order('points', { ascending: false })
    } else if (type === 'streak') {
      query = query.gt('streak', 0).order('streak', { ascending: false })
    } else {
      query = query.order('followers_count', { ascending: false })
    }

    const { data: entries } = await query.limit(20)
    const list = (entries || []) as LeaderboardEntry[]
    setData(list)

    // Find my rank
    if (user) {
      const myIdx = list.findIndex(e => e.id === user.id)
      if (myIdx >= 0) {
        setMyRank(myIdx + 1)
        setMyEntry(list[myIdx])
      } else {
        setMyRank(null)
        // Load my entry separately
        const { data: me } = await sb.from('profiles')
          .select('id,name,username,initials,portfolio_pct_gain,points,streak,total_posts,followers_count,is_verified,joined_at')
          .eq('id', user.id).single()
        setMyEntry((me as LeaderboardEntry) || null)
      }
    }
    setLoading(false)
  }

  async function toggleFollow(uid: string) {
    if (!user) return
    const following = followedIds.has(uid)
    setFollowedIds(prev => { const n = new Set(prev); following ? n.delete(uid) : n.add(uid); return n })
    if (following) await sb.from('follows').delete().eq('follower_id', user.id).eq('following_id', uid)
    else { await sb.from('follows').insert({ follower_id: user.id, following_id: uid }); showToast('Following!', 'ok') }
  }

  function getValue(entry: LeaderboardEntry): string {
    if (type === 'performance') return entry.portfolio_pct_gain !== null ? `${entry.portfolio_pct_gain >= 0 ? '+' : ''}${entry.portfolio_pct_gain.toFixed(2)}%` : '—'
    if (type === 'points') return `${(entry.points || 0).toLocaleString()} pts`
    if (type === 'streak') return `🔥 ${entry.streak || 0} days`
    return `${entry.followers_count || 0} followers`
  }

  function getValueColor(entry: LeaderboardEntry): string {
    if (type === 'performance' && entry.portfolio_pct_gain !== null) {
      return entry.portfolio_pct_gain >= 0 ? 'text-gain' : 'text-loss'
    }
    return 'text-primary'
  }

  const rankEmoji = (rank: number) => rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`

  const tabs: { key: LeaderboardType; label: string; icon: string }[] = [
    { key: 'performance', label: 'Returns', icon: '📈' },
    { key: 'points', label: 'Points', icon: '⭐' },
    { key: 'streak', label: 'Streak', icon: '🔥' },
    { key: 'community', label: 'Social', icon: '👥' },
  ]

  return (
    <div className="max-w-[680px] mx-auto px-4 py-5 pb-20">
      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="font-display text-[26px] font-extrabold mb-1">🏆 Leaderboard</h1>
        <p className="text-[14px] text-text-muted">Top Gopexly investors ranked by performance, points, and community impact</p>
      </div>

      {/* Type tabs */}
      <div className="grid grid-cols-4 gap-1.5 mb-6 bg-gray-50 p-1.5 rounded-2xl border border-border">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setType(t.key)}
            className={cn('py-2.5 rounded-xl text-[12px] font-bold transition-all flex flex-col items-center gap-0.5',
              type === t.key ? 'bg-white shadow-sm text-primary' : 'text-text-muted hover:text-text')}>
            <span className="text-[16px]">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner size="lg" className="text-primary" /></div>
      ) : (
        <>
          {/* Top 3 podium */}
          {data.length >= 3 && (
            <div className="flex items-end justify-center gap-3 mb-6">
              {/* 2nd place */}
              <div className="flex flex-col items-center flex-1">
                <div className="w-12 h-12 rounded-full bg-gray-200 border-4 border-gray-300 flex items-center justify-center text-[16px] font-extrabold text-gray-600 mb-2">
                  {data[1].initials || data[1].name?.charAt(0) || 'U'}
                </div>
                <div className="bg-gray-100 border border-gray-200 rounded-xl py-3 px-2 w-full text-center">
                  <div className="text-[18px] mb-1">🥈</div>
                  <div className="font-bold text-[12px] truncate">{data[1].name?.split(' ')[0]}</div>
                  <div className={cn('text-[12px] font-extrabold', getValueColor(data[1]))}>{getValue(data[1])}</div>
                </div>
              </div>
              {/* 1st place */}
              <div className="flex flex-col items-center flex-1 -mb-2">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber to-yellow-400 border-4 border-amber flex items-center justify-center text-[20px] font-extrabold text-white mb-2 shadow-lg">
                  {data[0].initials || data[0].name?.charAt(0) || 'U'}
                </div>
                <div className="bg-gradient-to-br from-amber/20 to-yellow-50 border-2 border-amber rounded-xl py-4 px-2 w-full text-center shadow-sm">
                  <div className="text-[22px] mb-1">🥇</div>
                  <div className="font-bold text-[13px] truncate">{data[0].name?.split(' ')[0]}</div>
                  <div className={cn('text-[13px] font-extrabold', getValueColor(data[0]))}>{getValue(data[0])}</div>
                </div>
              </div>
              {/* 3rd place */}
              <div className="flex flex-col items-center flex-1">
                <div className="w-12 h-12 rounded-full bg-orange-100 border-4 border-orange-300 flex items-center justify-center text-[16px] font-extrabold text-orange-600 mb-2">
                  {data[2].initials || data[2].name?.charAt(0) || 'U'}
                </div>
                <div className="bg-orange-50 border border-orange-200 rounded-xl py-3 px-2 w-full text-center">
                  <div className="text-[18px] mb-1">🥉</div>
                  <div className="font-bold text-[12px] truncate">{data[2].name?.split(' ')[0]}</div>
                  <div className={cn('text-[12px] font-extrabold', getValueColor(data[2]))}>{getValue(data[2])}</div>
                </div>
              </div>
            </div>
          )}

          {/* Full list */}
          <div className="bg-surface border border-border rounded-2xl overflow-hidden mb-4">
            {data.map((entry, i) => {
              const isMe = entry.id === user?.id
              return (
                <div key={entry.id}
                  className={cn('flex items-center gap-3 px-4 py-3.5 border-b border-border last:border-0 transition-all',
                    isMe ? 'bg-primary-light' : 'hover:bg-gray-50')}>
                  <div className="text-[16px] w-8 text-center font-bold flex-shrink-0">
                    {rankEmoji(i + 1)}
                  </div>
                  <div className={cn('w-9 h-9 rounded-full flex items-center justify-center text-[11px] font-extrabold flex-shrink-0 text-white',
                    isMe ? 'bg-primary' : 'bg-gray-400')}>
                    {entry.initials || entry.name?.charAt(0) || 'U'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={cn('font-bold text-[13px]', isMe && 'text-primary')}>{entry.name || 'User'}</span>
                      {isMe && <span className="text-[9px] bg-primary text-white px-1.5 py-0.5 rounded-full font-bold">You</span>}
                      {entry.is_verified && <span className="text-[9px] bg-primary-light text-primary px-1.5 py-0.5 rounded-full font-bold">✓</span>}
                    </div>
                    <div className="text-[11px] text-text-muted">@{entry.username} · Joined {fmtDate(entry.joined_at)}</div>
                  </div>
                  <div className={cn('font-extrabold text-[14px] flex-shrink-0', getValueColor(entry))}>
                    {getValue(entry)}
                  </div>
                  {entry.id !== user?.id && (
                    <button onClick={() => toggleFollow(entry.id)}
                      className={cn('text-[10px] font-bold px-2.5 py-1.5 rounded-full border transition-all flex-shrink-0',
                        followedIds.has(entry.id) ? 'bg-gray-100 text-text-muted border-border' : 'bg-primary-light text-primary border-primary-border hover:bg-primary hover:text-white')}>
                      {followedIds.has(entry.id) ? '✓' : '+'}
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          {/* My rank if not in top 20 */}
          {myRank === null && myEntry && (
            <div className="bg-primary-light border-2 border-primary-border rounded-2xl p-4 flex items-center gap-3">
              <div className="text-[16px] font-bold text-primary">Not ranked yet</div>
              <div className="flex-1">
                <div className="font-bold text-[13px]">{myEntry.name}</div>
                <div className="text-[12px] text-text-muted">{getValue(myEntry)}</div>
              </div>
              {type === 'performance' && (
                <div className="text-[12px] text-primary font-semibold">Share your performance to rank</div>
              )}
            </div>
          )}
        </>
      )}

      <Toast {...toast} />
    </div>
  )
}
