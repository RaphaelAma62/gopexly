'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { fmtTime, cn } from '@/lib/utils'
import { usePrices } from '@/lib/hooks/usePrices'
import { useAuth } from '@/lib/hooks/useAuth'
import { Avatar, Spinner } from '@/components/ui'
import type { Profile, Post } from '@/types'

type SearchTab = 'all' | 'users' | 'posts' | 'stocks'

interface StockResult {
  ticker: string
  company_name: string | null
  price: number
  change_pct: number
}

interface SearchResults {
  users: Profile[]
  posts: Post[]
  stocks: StockResult[]
}

export default function SearchPage() {
  const sb = createClient()
  const { user } = useAuth()
  const { prices } = usePrices()
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<SearchTab>('all')
  const [results, setResults] = useState<SearchResults>({ users: [], posts: [], stocks: [] })
  const [loading, setLoading] = useState(false)
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set())
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const [trendingStocks, setTrendingStocks] = useState<StockResult[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const searchTimer = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    inputRef.current?.focus()
    loadFollowing()
    loadTrending()
    const saved = localStorage.getItem('gopexly_recent_searches')
    if (saved) setRecentSearches(JSON.parse(saved))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadFollowing() {
    if (!user) return
    const { data } = await sb.from('follows').select('following_id').eq('follower_id', user.id)
    setFollowedIds(new Set((data || []).map((f: { following_id: string }) => f.following_id)))
  }

  async function loadTrending() {
    const { data } = await sb.from('stock_prices')
      .select('ticker,company_name,price,change_pct')
      .order('change_pct', { ascending: false })
      .limit(6)
    setTrendingStocks((data || []) as StockResult[])
  }

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults({ users: [], posts: [], stocks: [] }); return }
    setLoading(true)
    const upper = q.toUpperCase()
    const lower = q.toLowerCase()

    const [usersRes, postsRes, stocksRes] = await Promise.all([
      sb.from('profiles')
        .select('id,name,username,initials,is_verified,role,portfolio_pct_gain,share_performance,followers_count,bio')
        .or(`name.ilike.%${q}%,username.ilike.%${q}%`)
        .limit(8),
      sb.from('posts')
        .select('id,user_id,body,created_at,likes_count,comments_count,profiles!posts_user_id_fkey(name,initials)')
        .ilike('body', `%${q}%`)
        .order('created_at', { ascending: false })
        .limit(10),
      sb.from('stock_prices')
        .select('ticker,company_name,price,change_pct')
        .or(`ticker.ilike.%${upper}%,company_name.ilike.%${q}%`)
        .limit(8),
    ])

    setResults({
      users: (usersRes.data || []) as Profile[],
      posts: (postsRes.data || []) as unknown as Post[],
      stocks: (stocksRes.data || []) as StockResult[],
    })
    setLoading(false)

    // Save to recent searches
    const updated = [q, ...recentSearches.filter(s => s !== q)].slice(0, 5)
    setRecentSearches(updated)
    localStorage.setItem('gopexly_recent_searches', JSON.stringify(updated))
    void lower
    void upper
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sb, recentSearches])

  function handleInput(val: string) {
    setQuery(val)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    if (!val.trim()) { setResults({ users: [], posts: [], stocks: [] }); return }
    searchTimer.current = setTimeout(() => doSearch(val), 400)
  }

  async function toggleFollow(uid: string) {
    if (!user) return
    const following = followedIds.has(uid)
    setFollowedIds(prev => { const n = new Set(prev); following ? n.delete(uid) : n.add(uid); return n })
    if (following) await sb.from('follows').delete().eq('follower_id', user.id).eq('following_id', uid)
    else await sb.from('follows').insert({ follower_id: user.id, following_id: uid })
  }

  function clearRecent() {
    setRecentSearches([])
    localStorage.removeItem('gopexly_recent_searches')
  }

  const totalResults = results.users.length + results.posts.length + results.stocks.length
  const hasQuery = query.trim().length > 0

  const tabs: { key: SearchTab; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: totalResults },
    { key: 'users', label: 'People', count: results.users.length },
    { key: 'posts', label: 'Posts', count: results.posts.length },
    { key: 'stocks', label: 'Stocks', count: results.stocks.length },
  ]

  return (
    <div className="max-w-[680px] mx-auto px-4 py-5 pb-20">
      {/* Search bar */}
      <div className="relative mb-5">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted text-[18px]">🔍</span>
        <input
          ref={inputRef}
          value={query}
          onChange={e => handleInput(e.target.value)}
          placeholder="Search investors, posts, NGX stocks..."
          className="w-full bg-surface border-2 border-border text-text pl-11 pr-10 py-3.5 rounded-2xl text-[15px] outline-none focus:border-primary transition-all shadow-sm"
        />
        {query && (
          <button onClick={() => { setQuery(''); setResults({ users: [], posts: [], stocks: [] }) }}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted hover:text-text transition-colors text-[16px]">
            ✕
          </button>
        )}
      </div>

      {/* No query — show recent + trending */}
      {!hasQuery && (
        <div className="space-y-6">
          {/* Recent searches */}
          {recentSearches.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="font-display text-[14px] font-extrabold">Recent Searches</div>
                <button onClick={clearRecent} className="text-[12px] text-primary font-semibold">Clear</button>
              </div>
              <div className="flex flex-wrap gap-2">
                {recentSearches.map(s => (
                  <button key={s} onClick={() => { setQuery(s); doSearch(s) }}
                    className="flex items-center gap-2 bg-surface border border-border px-3.5 py-2 rounded-full text-[13px] font-medium hover:bg-primary-light hover:border-primary-border hover:text-primary transition-all">
                    <span className="text-text-muted">🕐</span> {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Trending stocks */}
          <div>
            <div className="font-display text-[14px] font-extrabold mb-3">🔥 Trending on NGX</div>
            <div className="grid grid-cols-2 gap-2.5">
              {trendingStocks.map(s => {
                const up = (s.change_pct ?? 0) >= 0
                return (
                  <button key={s.ticker} onClick={() => { setQuery(s.ticker); doSearch(s.ticker) }}
                    className="bg-surface border border-border rounded-xl p-3.5 text-left hover:border-primary-border hover:shadow-sm transition-all">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-extrabold font-mono text-[13px] text-primary">{s.ticker}</span>
                      <span className={cn('text-[11px] font-bold px-2 py-0.5 rounded-full', up ? 'bg-gain-bg text-gain' : 'bg-loss-bg text-loss')}>
                        {up ? '+' : ''}{(s.change_pct ?? 0).toFixed(2)}%
                      </span>
                    </div>
                    <div className="text-[11px] text-text-muted truncate">{s.company_name}</div>
                    <div className="text-[13px] font-bold mt-0.5">₦{(s.price ?? 0).toFixed(2)}</div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Suggested people */}
          <div>
            <div className="font-display text-[14px] font-extrabold mb-3">👥 People to Follow</div>
            <PeopleToFollow sb={sb} userId={user?.id || ''} followedIds={followedIds} onToggleFollow={toggleFollow} />
          </div>
        </div>
      )}

      {/* Loading */}
      {hasQuery && loading && (
        <div className="flex justify-center py-12">
          <Spinner size="md" className="text-primary" />
        </div>
      )}

      {/* Results */}
      {hasQuery && !loading && (
        <>
          {totalResults === 0 ? (
            <div className="text-center py-16">
              <div className="text-5xl mb-4">🔍</div>
              <div className="font-display text-[18px] font-extrabold mb-2">No results for &ldquo;{query}&rdquo;</div>
              <div className="text-text-muted text-[14px]">Try searching for an investor name, stock ticker, or topic</div>
            </div>
          ) : (
            <>
              {/* Tabs */}
              <div className="flex gap-1 mb-5 bg-gray-50 p-1 rounded-xl border border-border">
                {tabs.map(t => (
                  <button key={t.key} onClick={() => setTab(t.key)}
                    className={cn('flex-1 py-2 rounded-lg text-[12px] font-bold transition-all',
                      tab === t.key ? 'bg-white shadow-sm text-primary' : 'text-text-muted hover:text-text')}>
                    {t.label}
                    {t.count > 0 && <span className={cn('ml-1 text-[10px]', tab === t.key ? 'text-primary' : 'text-text-muted')}>({t.count})</span>}
                  </button>
                ))}
              </div>

              {/* Users */}
              {(tab === 'all' || tab === 'users') && results.users.length > 0 && (
                <div className="mb-6">
                  {tab === 'all' && <div className="font-display text-[13px] font-extrabold text-text-muted uppercase tracking-wide mb-3">People</div>}
                  <div className="flex flex-col gap-2">
                    {results.users.map(u => (
                      <div key={u.id} className="bg-surface border border-border rounded-2xl p-4 flex items-center gap-3 hover:border-primary-border hover:shadow-sm transition-all">
                        <Avatar initials={u.initials || u.name?.charAt(0) || 'U'} size="lg" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-[14px]">{u.name}</span>
                            {u.is_verified && <span className="text-[10px] bg-primary-light text-primary px-1.5 py-0.5 rounded-full font-bold">✓</span>}
                            {u.role === 'admin' && <span className="text-[10px] bg-[#1e1b4b] text-[#a5b4fc] px-1.5 py-0.5 rounded-full font-bold">Admin</span>}
                          </div>
                          <div className="text-[12px] text-text-muted">@{u.username} · {u.followers_count || 0} followers</div>
                          {u.bio && <div className="text-[12px] text-text-secondary mt-0.5 truncate">{u.bio}</div>}
                          {u.share_performance && u.portfolio_pct_gain !== null && (
                            <div className={cn('text-[11px] font-bold mt-1', (u.portfolio_pct_gain ?? 0) >= 0 ? 'text-gain' : 'text-loss')}>
                              {(u.portfolio_pct_gain ?? 0) >= 0 ? '▲ +' : '▼ '}{Math.abs(u.portfolio_pct_gain ?? 0).toFixed(1)}% return
                            </div>
                          )}
                        </div>
                        {u.id !== user?.id && (
                          <button onClick={() => toggleFollow(u.id)}
                            className={cn('text-[11px] font-bold px-3 py-1.5 rounded-full border transition-all flex-shrink-0',
                              followedIds.has(u.id) ? 'bg-gray-100 text-text-muted border-border' : 'bg-primary-light text-primary border-primary-border hover:bg-primary hover:text-white')}>
                            {followedIds.has(u.id) ? '✓ Following' : '+ Follow'}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Stocks */}
              {(tab === 'all' || tab === 'stocks') && results.stocks.length > 0 && (
                <div className="mb-6">
                  {tab === 'all' && <div className="font-display text-[13px] font-extrabold text-text-muted uppercase tracking-wide mb-3">NGX Stocks</div>}
                  <div className="grid grid-cols-2 gap-2.5">
                    {results.stocks.map(s => {
                      const up = (s.change_pct ?? 0) >= 0
                      return (
                        <div key={s.ticker} className="bg-surface border border-border rounded-xl p-3.5 hover:border-primary-border hover:shadow-sm transition-all">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-extrabold font-mono text-[14px] text-primary">{s.ticker}</span>
                            <span className={cn('text-[11px] font-bold px-2 py-0.5 rounded-full', up ? 'bg-gain-bg text-gain' : 'bg-loss-bg text-loss')}>
                              {up ? '+' : ''}{(s.change_pct ?? 0).toFixed(2)}%
                            </span>
                          </div>
                          <div className="text-[11px] text-text-muted mb-1 truncate">{s.company_name}</div>
                          <div className="text-[15px] font-extrabold">₦{(s.price ?? 0).toFixed(2)}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Posts */}
              {(tab === 'all' || tab === 'posts') && results.posts.length > 0 && (
                <div>
                  {tab === 'all' && <div className="font-display text-[13px] font-extrabold text-text-muted uppercase tracking-wide mb-3">Posts</div>}
                  <div className="flex flex-col gap-2">
                    {results.posts.map(p => {
                      const prof = p.profiles as unknown as { name?: string | null; initials?: string | null } | null
                      return (
                        <div key={p.id} className="bg-surface border border-border rounded-2xl p-4 hover:border-primary-border hover:shadow-sm transition-all">
                          <div className="flex items-center gap-2.5 mb-2.5">
                            <Avatar initials={prof?.initials || prof?.name?.charAt(0) || 'U'} size="md" />
                            <div>
                              <div className="text-[13px] font-bold">{prof?.name || 'User'}</div>
                              <div className="text-[11px] text-text-muted">{fmtTime(p.created_at)}</div>
                            </div>
                          </div>
                          <p className="text-[13px] text-text-secondary leading-relaxed line-clamp-3">{p.body}</p>
                          <div className="flex items-center gap-4 mt-2.5 text-[11px] text-text-muted">
                            <span>❤️ {p.likes_count}</span>
                            <span>💬 {p.comments_count}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}

function PeopleToFollow({ sb, userId, followedIds, onToggleFollow }: {
  sb: ReturnType<typeof createClient>
  userId: string
  followedIds: Set<string>
  onToggleFollow: (uid: string) => void
}) {
  const [people, setPeople] = useState<Profile[]>([])

  useEffect(() => {
    sb.from('profiles')
      .select('id,name,username,initials,is_verified,followers_count,bio,portfolio_pct_gain,share_performance')
      .neq('id', userId)
      .order('followers_count', { ascending: false })
      .limit(4)
      .then(({ data }) => setPeople((data || []) as Profile[]))
  }, [sb, userId])

  return (
    <div className="flex flex-col gap-2">
      {people.map(u => (
        <div key={u.id} className="bg-surface border border-border rounded-2xl p-3.5 flex items-center gap-3 hover:border-primary-border transition-all">
          <Avatar initials={u.initials || u.name?.charAt(0) || 'U'} size="md" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-[13px]">{u.name}</span>
              {u.is_verified && <span className="text-[9px] bg-primary-light text-primary px-1.5 py-0.5 rounded-full font-bold">✓</span>}
            </div>
            <div className="text-[11px] text-text-muted">@{u.username} · {u.followers_count || 0} followers</div>
          </div>
          <button onClick={() => onToggleFollow(u.id)}
            className={cn('text-[11px] font-bold px-3 py-1.5 rounded-full border transition-all flex-shrink-0',
              followedIds.has(u.id) ? 'bg-gray-100 text-text-muted border-border' : 'bg-primary-light text-primary border-primary-border hover:bg-primary hover:text-white')}>
            {followedIds.has(u.id) ? '✓' : '+ Follow'}
          </button>
        </div>
      ))}
    </div>
  )
}
