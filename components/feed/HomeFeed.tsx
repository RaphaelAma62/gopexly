'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { fmtTime, getGreeting, cn } from '@/lib/utils'
import { useAuth } from '@/lib/hooks/useAuth'
import { usePrices } from '@/lib/hooks/usePrices'
import { useToast } from '@/lib/hooks/useToast'
import { Toast, Avatar, EmptyState, Spinner } from '@/components/ui'
import type { Post, Holding, Goal, Profile, Comment } from '@/types'
import Link from 'next/link'

type FeedTab = 'fy' | 'fl' | 'nw'
interface PendingTicker { ticker: string; name: string }
interface PendingImage { file: File; dataUrl: string }

// Clean HTML entities from post body
function cleanBody(text: string): string {
  return text
    .replace(/&#128240;/g, '📰')
    .replace(/&#128203;/g, '📋')
    .replace(/&#128200;/g, '📈')
    .replace(/&#127891;/g, '🎓')
    .replace(/&#128188;/g, '💼')
    .replace(/&#128683;/g, '🚫')
    .replace(/&#9733;/g, '★')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(parseInt(code)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

export default function HomeFeed() {
  const sb = createClient()
  const { user } = useAuth()
  const { prices } = usePrices()
  const { toast, showToast } = useToast()

  const [tab, setTab] = useState<FeedTab>('fy')
  const [posts, setPosts] = useState<Post[]>([])
  const [news, setNews] = useState<{ id: string; title: string; body: string; source?: string | null; created_at: string; profiles?: { name?: string | null } | null }[]>([])
  const [feedLoading, setFeedLoading] = useState(true)
  const [feedError, setFeedError] = useState('')

  const [holdings, setHoldings] = useState<Holding[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [myPctGain, setMyPctGain] = useState<number | null>(null)
  const [portfolioValue, setPortfolioValue] = useState(0)

  const [suggested, setSuggested] = useState<Profile[]>([])
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set())

  const [postText, setPostText] = useState('')
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([])
  const [pendingTickers, setPendingTickers] = useState<PendingTicker[]>([])
  const [sharePerf, setSharePerf] = useState(false)
  const [showTkSearch, setShowTkSearch] = useState(false)
  const [showPerfRow, setShowPerfRow] = useState(false)
  const [tkQuery, setTkQuery] = useState('')
  const [tkResults, setTkResults] = useState<string[]>([])
  const [posting, setPosting] = useState(false)

  const [sharePostId, setSharePostId] = useState<string | null>(null)
  const [shareText, setShareText] = useState('')
  const [shareCopied, setShareCopied] = useState(false)

  const [editPostId, setEditPostId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const [postImages, setPostImages] = useState<Record<string, string[]>>({})
  const [openComments, setOpenComments] = useState<Set<string>>(new Set())
  const [comments, setComments] = useState<Record<string, Comment[]>>({})
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({})
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set())

  // Post detail modal
  const [openPost, setOpenPost] = useState<Post | null>(null)
  const [openPostComments, setOpenPostComments] = useState<Comment[]>([])
  const [openPostComment, setOpenPostComment] = useState('')
  const [openPostImages, setOpenPostImages] = useState<string[]>([])

  // User profile modal
  const [profileUserId, setProfileUserId] = useState<string | null>(null)
  const [profileData, setProfileData] = useState<Profile | null>(null)
  const [profilePosts, setProfilePosts] = useState<Post[]>([])
  const [profileStats, setProfileStats] = useState({ holdings: 0, followers: 0, following: 0 })
  const [profileLoading, setProfileLoading] = useState(false)

  const imgInputRef = useRef<HTMLInputElement>(null)
  const tkTimer = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (!user) return
    loadPortfolio()
    loadGoals()
    loadSuggested()
    loadFollowing()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, JSON.stringify(prices)])

  useEffect(() => {
    if (!user) return
    loadFeed(tab)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, user?.id])

  // Realtime
  useEffect(() => {
    if (!user) return
    const channel = sb.channel('home-feed')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, payload => {
        if (tab === 'fy' && (payload.new as Post).user_id !== user.id) {
          setPosts(prev => [payload.new as Post, ...prev])
        }
      })
      .subscribe()
    return () => { sb.removeChannel(channel) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, tab])

  async function loadPortfolio() {
    if (!user) return
    const { data } = await sb.from('holdings').select('*').eq('user_id', user.id)
    const h = (data || []) as Holding[]
    setHoldings(h)
    if (h.length && Object.keys(prices).length) {
      let cost = 0, mkt = 0
      h.forEach(hld => {
        const mp = prices[hld.ticker]?.price ?? hld.buy_price
        cost += hld.shares * hld.buy_price
        mkt += hld.shares * mp
      })
      setPortfolioValue(mkt)
      if (cost > 0) setMyPctGain(parseFloat(((mkt - cost) / cost * 100).toFixed(2)))
    }
  }

  async function loadGoals() {
    if (!user) return
    const { data } = await sb.from('goals').select('*').eq('user_id', user.id).limit(3)
    setGoals((data || []) as Goal[])
  }

  async function loadSuggested() {
    if (!user) return
    const { data } = await sb.from('profiles')
      .select('id,name,initials,portfolio_pct_gain,share_performance,followers_count')
      .neq('id', user.id).eq('share_performance', true)
      .not('portfolio_pct_gain', 'is', null)
      .order('portfolio_pct_gain', { ascending: false }).limit(3)
    setSuggested((data || []) as Profile[])
  }

  async function loadFollowing() {
    if (!user) return
    const { data } = await sb.from('follows').select('following_id').eq('follower_id', user.id)
    setFollowedIds(new Set((data || []).map((f: { following_id: string }) => f.following_id)))
  }

  async function loadFeed(t: FeedTab) {
    if (!user) return
    setFeedLoading(true); setFeedError('')
    try {
      if (t === 'nw') {
        const { data, error } = await sb.from('news_posts')
          .select('*, profiles!news_posts_author_id_fkey(name)')
          .order('created_at', { ascending: false }).limit(30)
        if (error) throw error
        setNews(data || [])
        setFeedLoading(false); return
      }
      let query = sb.from('posts')
        .select('id,user_id,body,ticker_holdings,portfolio_pct_gain,portfolio_period,likes_count,comments_count,created_at,profiles!posts_user_id_fkey(name,initials,role,share_performance,portfolio_pct_gain)')
        .order('created_at', { ascending: false }).limit(40)
      if (t === 'fl') {
        const { data: follows } = await sb.from('follows').select('following_id').eq('follower_id', user.id)
        const ids = (follows || []).map((f: { following_id: string }) => f.following_id)
        if (!ids.length) { setPosts([]); setFeedLoading(false); return }
        query = query.in('user_id', ids)
      }
      const { data, error } = await query
      if (error) throw error
      const postsData = (data || []) as unknown as Post[]
      setPosts(postsData)
      if (postsData.length) {
        const imgMap: Record<string, string[]> = {}
        await Promise.all(postsData.map(async p => {
          const { data: imgs } = await sb.from('post_images').select('image_url').eq('post_id', p.id)
          if (imgs?.length) imgMap[p.id] = imgs.map((i: { image_url: string }) => i.image_url)
        }))
        setPostImages(imgMap)
      }
      const { data: likes } = await sb.from('likes').select('post_id').eq('user_id', user.id)
      setLikedPosts(new Set((likes || []).map((l: { post_id: string }) => l.post_id)))
    } catch (e: unknown) {
      setFeedError(e instanceof Error ? e.message : 'Failed to load posts')
    }
    setFeedLoading(false)
  }

  // Open post detail
  async function openPostDetail(post: Post) {
    setOpenPost(post)
    setOpenPostImages(postImages[post.id] || [])
    const { data } = await sb.from('comments')
      .select('*,profiles!comments_user_id_fkey(name,initials)')
      .eq('post_id', post.id).order('created_at', { ascending: true })
    setOpenPostComments((data || []) as Comment[])
  }

  async function submitOpenPostComment() {
    if (!openPostComment.trim() || !user || !openPost) return
    const text = openPostComment.trim()
    setOpenPostComment('')
    const { data } = await sb.from('comments')
      .insert({ post_id: openPost.id, user_id: user.id, body: text })
      .select('*,profiles!comments_user_id_fkey(name,initials)').single()
    if (data) {
      setOpenPostComments(prev => [...prev, data as Comment])
      setPosts(prev => prev.map(p => p.id === openPost.id ? { ...p, comments_count: p.comments_count + 1 } : p))
    }
  }

  // Open user profile
  async function openUserProfile(uid: string) {
    if (uid === user?.id) { window.location.href = '/profile'; return }
    setProfileUserId(uid)
    setProfileLoading(true)
    const [profRes, postsRes, holdRes, follRes, follngRes] = await Promise.all([
      sb.from('profiles').select('*').eq('id', uid).single(),
      sb.from('posts').select('*').eq('user_id', uid).order('created_at', { ascending: false }).limit(10),
      sb.from('holdings').select('id', { count: 'exact', head: true }).eq('user_id', uid),
      sb.from('follows').select('id', { count: 'exact', head: true }).eq('following_id', uid),
      sb.from('follows').select('id', { count: 'exact', head: true }).eq('follower_id', uid),
    ])
    setProfileData((profRes.data || null) as Profile | null)
    setProfilePosts((postsRes.data || []) as Post[])
    setProfileStats({ holdings: holdRes.count || 0, followers: follRes.count || 0, following: follngRes.count || 0 })
    setProfileLoading(false)
  }

  function handleImages(files: FileList | null) {
    if (!files) return
    Array.from(files).slice(0, 4 - pendingImages.length).forEach(file => {
      const reader = new FileReader()
      reader.onload = e => setPendingImages(prev => [...prev, { file, dataUrl: e.target?.result as string }])
      reader.readAsDataURL(file)
    })
  }

  function searchTicker(q: string) {
    setTkQuery(q)
    if (tkTimer.current) clearTimeout(tkTimer.current)
    if (!q) { setTkResults([]); return }
    tkTimer.current = setTimeout(() => {
      const upper = q.toUpperCase()
      setTkResults(Object.keys(prices).filter(t => t.includes(upper) || prices[t].company_name.toUpperCase().includes(upper)).slice(0, 8))
    }, 200)
  }

  function addTicker(ticker: string) {
    if (!pendingTickers.find(t => t.ticker === ticker))
      setPendingTickers(prev => [...prev, { ticker, name: prices[ticker]?.company_name || ticker }])
    setTkQuery(''); setTkResults([]); setShowTkSearch(false)
  }

  async function submitPost() {
    if (!postText.trim() || !user) return
    if (postText.length > 500) { showToast('Post too long — max 500 characters', 'err'); return }
    setPosting(true)
    const tkPayload = pendingTickers.map(t => {
      const myH = holdings.find(h => h.ticker === t.ticker)
      let myPct = null
      if (myH && portfolioValue > 0) {
        const val = (prices[myH.ticker]?.price ?? myH.buy_price) * myH.shares
        myPct = Math.round(val / portfolioValue * 100)
      }
      return { ticker: t.ticker, i_hold: !!myH, my_pct: myPct }
    })
    const { data: newPost, error } = await sb.from('posts').insert({
      user_id: user.id, body: postText.trim(), ticker_holdings: tkPayload,
      portfolio_pct_gain: sharePerf && myPctGain !== null ? myPctGain : null,
      portfolio_period: sharePerf ? 'all-time' : null,
    }).select().single()
    if (error) { showToast('Error: ' + error.message, 'err'); setPosting(false); return }
    if (pendingImages.length && newPost) {
      pendingImages.forEach(async (pi, i) => {
        const path = `posts/${newPost.id}/${Date.now()}-${i}.jpg`
        const up = await sb.storage.from('post-images').upload(path, pi.file, { contentType: pi.file.type })
        if (!up.error) {
          const url = sb.storage.from('post-images').getPublicUrl(path).data.publicUrl
          await sb.from('post_images').insert({ post_id: newPost.id, image_url: url })
        }
      })
    }
    if (sharePerf && myPctGain !== null)
      await sb.from('profiles').update({ share_performance: true, portfolio_pct_gain: myPctGain }).eq('id', user.id)
    const optimistic: Post = {
      ...(newPost as Post),
      profiles: { name: user.name, initials: user.initials, role: user.role, share_performance: sharePerf, portfolio_pct_gain: sharePerf ? myPctGain : null }
    }
    setPosts(prev => [optimistic, ...prev])
    setPostText(''); setPendingImages([]); setPendingTickers([])
    setSharePerf(false); setShowTkSearch(false); setShowPerfRow(false)
    setPosting(false); showToast('Posted!', 'ok')
  }

  async function toggleLike(postId: string) {
    if (!user) return
    const liked = likedPosts.has(postId)
    setLikedPosts(prev => { const n = new Set(prev); liked ? n.delete(postId) : n.add(postId); return n })
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, likes_count: p.likes_count + (liked ? -1 : 1) } : p))
    if (liked) await sb.from('likes').delete().eq('post_id', postId).eq('user_id', user.id)
    else await sb.from('likes').insert({ post_id: postId, user_id: user.id })
  }

  async function toggleComments(postId: string) {
    const isOpen = openComments.has(postId)
    setOpenComments(prev => { const n = new Set(prev); isOpen ? n.delete(postId) : n.add(postId); return n })
    if (!isOpen && !comments[postId]) {
      const { data } = await sb.from('comments')
        .select('*,profiles!comments_user_id_fkey(name,initials)')
        .eq('post_id', postId).order('created_at', { ascending: true })
      setComments(prev => ({ ...prev, [postId]: (data || []) as Comment[] }))
    }
  }

  async function submitComment(postId: string) {
    const text = commentInputs[postId]?.trim()
    if (!text || !user) return
    setCommentInputs(prev => ({ ...prev, [postId]: '' }))
    const { data } = await sb.from('comments')
      .insert({ post_id: postId, user_id: user.id, body: text })
      .select('*,profiles!comments_user_id_fkey(name,initials)').single()
    if (data) {
      setComments(prev => ({ ...prev, [postId]: [...(prev[postId] || []), data as Comment] }))
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, comments_count: p.comments_count + 1 } : p))
    }
  }

  async function toggleFollow(uid: string) {
    if (!user) return
    const following = followedIds.has(uid)
    setFollowedIds(prev => { const n = new Set(prev); following ? n.delete(uid) : n.add(uid); return n })
    if (following) await sb.from('follows').delete().eq('follower_id', user.id).eq('following_id', uid)
    else await sb.from('follows').insert({ follower_id: user.id, following_id: uid })
  }

  async function deletePost(postId: string) {
    await sb.from('posts').delete().eq('id', postId)
    setPosts(prev => prev.filter(p => p.id !== postId))
    showToast('Post deleted', 'ok')
  }

  async function saveEdit() {
    if (!editPostId || !editText.trim()) return
    await sb.from('posts').update({ body: editText.trim() }).eq('id', editPostId).eq('user_id', user?.id || '')
    setPosts(prev => prev.map(p => p.id === editPostId ? { ...p, body: editText.trim() } : p))
    setEditPostId(null); showToast('Post updated', 'ok')
  }

  function copyLink() {
    const url = `${window.location.origin}/home?post=${sharePostId}`
    navigator.clipboard.writeText(url)
    setShareCopied(true); setTimeout(() => setShareCopied(false), 2000)
  }

  function shareTo(platform: string) {
    const url = encodeURIComponent(`${window.location.origin}/home?post=${sharePostId}`)
    const text = encodeURIComponent(`${shareText} — Gopexly`)
    const links: Record<string, string> = {
      whatsapp: `https://wa.me/?text=${text}%20${url}`,
      twitter: `https://twitter.com/intent/tweet?text=${text}&url=${url}`,
      telegram: `https://t.me/share/url?url=${url}&text=${text}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${url}`,
    }
    if (links[platform]) window.open(links[platform], '_blank', 'width=600,height=450')
    setSharePostId(null)
  }

  const pfVal = portfolioValue >= 1_000_000 ? `₦${(portfolioValue / 1_000_000).toFixed(2)}M`
    : portfolioValue >= 1_000 ? `₦${(portfolioValue / 1_000).toFixed(0)}K`
    : `₦${portfolioValue.toFixed(0)}`

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[252px_1fr] xl:grid-cols-[252px_1fr_268px] min-h-[calc(100vh-60px)]">

      {/* LEFT SIDEBAR */}
      <aside className="hidden lg:block bg-surface border-r border-border p-3.5 sticky top-[60px] h-[calc(100vh-60px)] overflow-y-auto">
        <div className="bg-gradient-to-br from-primary to-primary-dark rounded-[13px] p-4 text-white mb-3.5">
          <div className="text-[9px] opacity-70 uppercase tracking-wide mb-1">Portfolio</div>
          <div className="font-display text-[22px] font-extrabold tracking-tight mb-0.5">{portfolioValue > 0 ? pfVal : '₦0'}</div>
          {myPctGain !== null
            ? <div className="text-[11px] bg-white/15 inline-block px-2 py-0.5 rounded-full">{myPctGain >= 0 ? '+' : ''}{myPctGain.toFixed(2)}% return</div>
            : <div className="text-[11px] opacity-60">No holdings yet</div>}
        </div>
        <nav className="flex flex-col gap-px mb-3.5">
          {[
            { href: '/home', icon: '🏠', label: 'Home Feed', active: true },
            { href: '/portfolio', icon: '💼', label: 'Portfolio' },
            { href: '/market', icon: '📈', label: 'Markets' },
            { href: '/learn', icon: '📚', label: 'Learn & Earn' },
            { href: '/profile', icon: '👤', label: 'My Account' },
          ].map(item => (
            <Link key={item.href} href={item.href}
              className={cn('flex items-center gap-2 px-2.5 py-2 rounded-lg text-[13px] font-medium transition-all',
                item.active ? 'bg-primary-light text-primary font-semibold' : 'text-text-secondary hover:bg-gray-100 hover:text-text')}>
              <span className="text-[15px] w-[18px] text-center">{item.icon}</span>{item.label}
            </Link>
          ))}
        </nav>
        <div className="bg-gray-50 border border-border rounded-xl p-3">
          <div className="text-[9px] font-bold text-text-muted uppercase tracking-wide mb-2.5">Active Goals</div>
          {!goals.length
            ? <div className="text-[12px] text-text-muted">No goals yet. <Link href="/portfolio" className="text-primary">Add one</Link></div>
            : goals.map(g => {
              const pct = g.target_amount > 0 ? Math.min(Math.round(g.saved_amount / g.target_amount * 100), 100) : 0
              const col = pct >= 70 ? '#16a34a' : pct >= 40 ? '#1a6eff' : '#d97706'
              return (
                <div key={g.id} className="mb-2">
                  <div className="flex justify-between text-[11px] mb-1">
                    <span>{g.icon} {g.name}</span>
                    <span className="font-bold" style={{ color: col }}>{pct}%</span>
                  </div>
                  <div className="bg-gray-200 rounded h-[3px]">
                    <div className="h-full rounded" style={{ width: `${pct}%`, background: col }} />
                  </div>
                </div>
              )
            })}
        </div>
      </aside>

      {/* CENTER */}
      <main className="border-r border-border min-h-[calc(100vh-60px)]">
        <div className="bg-surface border-b border-border px-[18px] py-3.5">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-[10px] text-text-muted">{getGreeting()}</div>
              <div className="font-display text-[17px] font-extrabold">{user?.firstName || '...'}</div>
            </div>
            <div className="text-right">
              <div className="font-display text-[22px] font-extrabold">{portfolioValue > 0 ? pfVal : '₦0'}</div>
              {myPctGain !== null && (
                <div className={cn('text-[11px] font-bold', myPctGain >= 0 ? 'text-gain' : 'text-loss')}>
                  {myPctGain >= 0 ? '+' : ''}{myPctGain.toFixed(2)}% all-time
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-surface border-b border-border flex px-[18px] sticky top-[60px] z-40">
          {(['fy', 'fl', 'nw'] as FeedTab[]).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={cn('px-3.5 py-[11px] text-[13px] font-semibold border-b-2 transition-all',
                tab === t ? 'text-primary border-primary' : 'text-text-muted border-transparent hover:text-text-secondary')}>
              {t === 'fy' ? '✨ For You' : t === 'fl' ? '👥 Following' : '📰 News'}
            </button>
          ))}
        </div>

        {/* Compose */}
        <div className="bg-surface border-b-2 border-border px-[18px] py-3.5">
          <div className="flex gap-2.5 items-start">
            <Avatar initials={user?.initials || '?'} size="lg" />
            <div className="flex-1">
              <textarea value={postText} onChange={e => setPostText(e.target.value)}
                placeholder="What's your investment move today? Share insights, stock picks, portfolio wins..."
                rows={2} maxLength={500}
                className="w-full bg-gray-50 border-2 border-border text-text px-3 py-2.5 rounded-xl text-[14px] outline-none resize-none min-h-[60px] max-h-60 transition-all focus:border-primary focus:bg-white font-sans leading-relaxed placeholder:text-text-muted" />
              {pendingImages.length > 0 && (
                <div className="flex gap-2 flex-wrap mt-2">
                  {pendingImages.map((img, i) => (
                    <div key={i} className="relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.dataUrl} alt="" className="w-[72px] h-[72px] rounded-lg object-cover border border-border" />
                      <button onClick={() => setPendingImages(prev => prev.filter((_, idx) => idx !== i))}
                        className="absolute -top-1.5 -right-1.5 w-[18px] h-[18px] bg-loss rounded-full text-white text-[10px] flex items-center justify-center">✕</button>
                    </div>
                  ))}
                </div>
              )}
              {pendingTickers.length > 0 && (
                <div className="flex gap-1.5 flex-wrap mt-2">
                  {pendingTickers.map(t => (
                    <span key={t.ticker} className="inline-flex items-center gap-1 bg-primary-light border border-primary-border text-primary text-[11px] font-bold px-2 py-0.5 rounded-full">
                      {t.ticker}
                      <button onClick={() => setPendingTickers(prev => prev.filter(p => p.ticker !== t.ticker))} className="text-[9px] opacity-60">✕</button>
                    </span>
                  ))}
                </div>
              )}
              {showTkSearch && (
                <div className="mt-2 relative">
                  <input value={tkQuery} onChange={e => searchTicker(e.target.value)}
                    placeholder="Search NGX ticker e.g. MTNN, GTCO..." autoFocus
                    className="w-full bg-gray-50 border-[1.5px] border-border text-text px-3 py-2 rounded-lg text-[12px] outline-none focus:border-primary uppercase placeholder:normal-case placeholder:text-text-muted" />
                  {tkResults.length > 0 && (
                    <div className="absolute top-full left-0 right-0 bg-white border-[1.5px] border-border rounded-xl shadow-md z-50 max-h-[180px] overflow-y-auto mt-0.5">
                      {tkResults.map(tk => (
                        <button key={tk} onClick={() => addTicker(tk)}
                          className="w-full flex items-center justify-between px-3 py-2 text-[12px] hover:bg-primary-light text-left transition-colors">
                          <span className="font-bold text-primary">{tk}</span>
                          <span className="text-text-muted">{prices[tk]?.company_name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {showPerfRow && (
                <div className="mt-2 bg-gain-bg border border-gain-border rounded-xl px-3 py-2.5">
                  <label className="flex items-center gap-2 cursor-pointer text-[12px] font-semibold text-gain">
                    <input type="checkbox" checked={sharePerf} onChange={e => setSharePerf(e.target.checked)} />
                    Share my portfolio % return with this post
                  </label>
                  {sharePerf && myPctGain !== null && (
                    <div className="mt-1 text-[11px] font-bold text-gain">{myPctGain >= 0 ? '▲ +' : '▼ '}{Math.abs(myPctGain).toFixed(1)}%</div>
                  )}
                </div>
              )}
              <div className="flex items-center justify-between mt-2.5 flex-wrap gap-2">
                <div className="flex gap-1.5 flex-wrap">
                  <label className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-text-muted border-[1.5px] border-border px-3 py-1.5 rounded-full cursor-pointer hover:bg-primary-light hover:text-primary hover:border-primary-border transition-all">
                    📷 Photo
                    <input ref={imgInputRef} type="file" accept="image/*" multiple className="hidden" onChange={e => handleImages(e.target.files)} />
                  </label>
                  <button onClick={() => setShowTkSearch(p => !p)}
                    className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-text-muted border-[1.5px] border-border px-3 py-1.5 rounded-full hover:bg-primary-light hover:text-primary hover:border-primary-border transition-all">
                    📈 Tag Stock
                  </button>
                  <button onClick={() => setShowPerfRow(p => !p)}
                    className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-text-muted border-[1.5px] border-border px-3 py-1.5 rounded-full hover:bg-primary-light hover:text-primary hover:border-primary-border transition-all">
                    📊 Performance
                  </button>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className={cn('text-[11px]', postText.length > 450 ? 'text-loss' : postText.length > 400 ? 'text-amber' : 'text-text-muted')}>
                    {postText.length} / 500
                  </span>
                  <button onClick={submitPost} disabled={posting || !postText.trim()}
                    className="bg-gradient-to-br from-primary to-primary-dark text-white font-bold px-6 py-2 rounded-full text-[13px] shadow-md hover:shadow-lg hover:-translate-y-px transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0">
                    {posting ? 'Posting...' : 'Post'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Feed */}
        {feedLoading && (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Spinner size="md" className="text-primary" />
            <div className="text-[13px] text-text-muted">Loading posts...</div>
          </div>
        )}
        {feedError && !feedLoading && (
          <div className="p-8 text-center"><div className="text-2xl mb-2">⚠️</div><div className="text-[14px] font-semibold text-loss">{feedError}</div></div>
        )}
        {!feedLoading && tab === 'nw' && (
          !news.length
            ? <EmptyState icon="📰" title="No news yet" subtitle="Admins will post market news here" />
            : news.map(n => (
              <div key={n.id} className="bg-surface px-[18px] py-4 border-b border-border hover:bg-gray-50 cursor-pointer">
                <div className="text-[9px] font-bold text-text-muted uppercase tracking-wide mb-1.5">
                  📰 Gopexly News · {n.profiles?.name || 'Admin'} · {fmtTime(n.created_at)}
                </div>
                <div className="text-[14px] font-bold text-text mb-1.5">{n.title}</div>
                {n.body && <div className="text-[13px] text-text-secondary leading-relaxed line-clamp-3">{cleanBody(n.body)}</div>}
                {n.source && <div className="text-[11px] text-primary mt-1.5 font-semibold">Source: {n.source}</div>}
              </div>
            ))
        )}
        {!feedLoading && tab === 'fl' && !posts.length && !feedError && (
          <EmptyState icon="👥" title="Follow investors to see their posts" />
        )}
        {!feedLoading && (tab === 'fy' || tab === 'fl') && (
          !posts.length && !feedError
            ? <EmptyState icon="📋" title="No posts yet" subtitle="Be the first to post something!" />
            : posts.map(p => (
              <PostCard key={p.id} post={p}
                myId={user?.id || ''} myInitials={user?.initials || '?'}
                images={postImages[p.id] || []}
                liked={likedPosts.has(p.id)}
                commentsOpen={openComments.has(p.id)}
                commentsList={comments[p.id] || []}
                commentInput={commentInputs[p.id] || ''}
                prices={prices} myHoldings={holdings} portfolioValue={portfolioValue}
                followedIds={followedIds}
                onLike={() => toggleLike(p.id)}
                onToggleComments={() => toggleComments(p.id)}
                onCommentChange={v => setCommentInputs(prev => ({ ...prev, [p.id]: v }))}
                onCommentSubmit={() => submitComment(p.id)}
                onReact={emoji => sb.from('post_reactions').upsert({ post_id: p.id, user_id: user?.id || '', emoji }, { onConflict: 'post_id,user_id,emoji' })}
                onFollow={() => toggleFollow(p.user_id)}
                onShare={() => { setSharePostId(p.id); setShareText(p.body.substring(0, 60)); setShareCopied(false) }}
                onEdit={() => { setEditPostId(p.id); setEditText(p.body) }}
                onDelete={() => deletePost(p.id)}
                onImageClick={url => setLightboxUrl(url)}
                onOpenPost={() => openPostDetail(p)}
                onOpenProfile={() => openUserProfile(p.user_id)}
              />
            ))
        )}
      </main>

      {/* RIGHT SIDEBAR */}
      <aside className="hidden xl:block bg-surface p-3.5 sticky top-[60px] h-[calc(100vh-60px)] overflow-y-auto">
        <div className="text-[9px] font-bold text-amber uppercase tracking-wide mb-2.5">⭐ Suggested Investors</div>
        {!suggested.length
          ? <div className="text-[12px] text-text-muted mb-4">No investors sharing performance yet.</div>
          : suggested.map(inv => {
            const pct = inv.portfolio_pct_gain ?? 0
            const up = pct >= 0
            return (
              <div key={inv.id} onClick={() => openUserProfile(inv.id)}
                className="bg-gray-50 border border-border rounded-xl p-3 mb-2.5 hover:bg-white hover:shadow-sm transition-all cursor-pointer">
                <div className="flex items-center gap-2 mb-2">
                  <Avatar initials={inv.initials || (inv.name?.charAt(0) || 'U')} size="md" />
                  <div>
                    <div className="text-[12px] font-bold">{inv.name}</div>
                    <div className="text-[10px] text-text-muted">{inv.followers_count || 0} followers</div>
                  </div>
                </div>
                <div className={cn('text-[13px] font-extrabold mb-1.5', up ? 'text-gain' : 'text-loss')}>
                  {up ? '▲' : '▼'} {Math.abs(pct).toFixed(1)}% return
                </div>
                <button onClick={e => { e.stopPropagation(); toggleFollow(inv.id) }}
                  className={cn('w-full py-1.5 rounded-lg text-[11px] font-bold transition-all',
                    followedIds.has(inv.id) ? 'bg-gray-100 text-text-muted border border-border' : 'bg-primary-light border border-primary-border text-primary hover:bg-primary hover:text-white')}>
                  {followedIds.has(inv.id) ? 'Following ✓' : '+ Follow'}
                </button>
              </div>
            )
          })}
        <div className="mt-4">
          <div className="text-[9px] font-bold text-text-muted uppercase tracking-wide mb-2.5">🔥 Trending</div>
          <div className="bg-gray-50 border border-border rounded-xl">
            {['#NGXRally', '#Investing', '#JapaFund', '#MTNN', '#DollarInvesting'].map((tag, i) => (
              <div key={tag} className="flex items-center gap-2 px-3 py-2 border-b border-border last:border-0 cursor-pointer hover:bg-primary-light group">
                <span className="text-[10px] text-text-muted w-3.5">{i + 1}</span>
                <span className="text-[12px] font-semibold group-hover:text-primary transition-colors">{tag}</span>
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* POST DETAIL MODAL */}
      {openPost && (
        <div className="fixed inset-0 bg-black/50 z-[500] flex items-center justify-center backdrop-blur-sm p-4"
          onClick={e => { if (e.target === e.currentTarget) setOpenPost(null) }}>
          <div className="bg-white rounded-2xl w-full max-w-[600px] max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
              <div className="flex items-center gap-3">
                <button onClick={() => { setOpenPost(null); openUserProfile(openPost.user_id) }}
                  className="w-9 h-9 rounded-full bg-primary text-white flex items-center justify-center text-[12px] font-bold hover:bg-primary-dark transition-colors">
                  {openPost.profiles?.initials || openPost.profiles?.name?.charAt(0) || 'U'}
                </button>
                <div>
                  <div className="text-[13px] font-bold cursor-pointer hover:text-primary"
                    onClick={() => { setOpenPost(null); openUserProfile(openPost.user_id) }}>
                    {openPost.profiles?.name || 'User'}
                  </div>
                  <div className="text-[11px] text-text-muted">{fmtTime(openPost.created_at)}</div>
                </div>
              </div>
              <button onClick={() => setOpenPost(null)} className="w-7 h-7 bg-gray-100 rounded-lg text-[12px] flex items-center justify-center hover:bg-gray-200">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              {openPost.portfolio_pct_gain != null && (
                <div className={cn('inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full mb-3 border',
                  openPost.portfolio_pct_gain >= 0 ? 'bg-gain-bg text-gain border-gain-border' : 'bg-loss-bg text-loss border-loss-border')}>
                  {openPost.portfolio_pct_gain >= 0 ? '▲' : '▼'} {Math.abs(openPost.portfolio_pct_gain).toFixed(1)}% portfolio return
                </div>
              )}
              <div className="text-[15px] text-text leading-relaxed mb-4 whitespace-pre-wrap">{cleanBody(openPost.body)}</div>
              {openPostImages.length > 0 && (
                <div className={cn('grid gap-2 mb-4 rounded-xl overflow-hidden',
                  openPostImages.length === 1 ? 'grid-cols-1' : 'grid-cols-2')}>
                  {openPostImages.map((url, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={i} src={url} alt="" className="w-full object-cover rounded-xl cursor-pointer max-h-[300px]"
                      onClick={() => setLightboxUrl(url)} />
                  ))}
                </div>
              )}
              <div className="flex items-center gap-3 py-3 border-t border-b border-border mb-4">
                <button onClick={() => toggleLike(openPost.id)}
                  className={cn('flex items-center gap-1.5 text-[13px] font-medium px-3 py-1.5 rounded-lg transition-all hover:bg-gray-100',
                    likedPosts.has(openPost.id) ? 'text-loss' : 'text-text-muted')}>
                  {likedPosts.has(openPost.id) ? '❤️' : '🤍'} {openPost.likes_count}
                </button>
                <span className="text-[13px] text-text-muted">💬 {openPostComments.length} comments</span>
              </div>
              <div className="flex flex-col gap-3">
                {openPostComments.map(c => (
                  <div key={c.id} className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-bold flex-shrink-0 text-text-secondary">
                      {c.profiles?.initials || c.profiles?.name?.charAt(0) || 'U'}
                    </div>
                    <div className="bg-gray-50 rounded-2xl px-3.5 py-2.5 flex-1">
                      <div className="text-[12px] font-bold mb-0.5">{c.profiles?.name || 'User'}</div>
                      <div className="text-[13px] text-text-secondary leading-snug">{c.body}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3 px-5 py-3.5 border-t border-border flex-shrink-0">
              <Avatar initials={user?.initials || '?'} size="sm" />
              <input value={openPostComment} onChange={e => setOpenPostComment(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') submitOpenPostComment() }}
                placeholder="Write a comment..."
                className="flex-1 bg-gray-50 border-[1.5px] border-border text-text px-3.5 py-2.5 rounded-full text-[13px] outline-none focus:border-primary" />
              <button onClick={submitOpenPostComment}
                className="w-9 h-9 rounded-full bg-primary text-white flex items-center justify-center hover:bg-primary-dark transition-colors text-[14px]">→</button>
            </div>
          </div>
        </div>
      )}

      {/* USER PROFILE MODAL */}
      {profileUserId && (
        <div className="fixed inset-0 bg-black/50 z-[500] flex items-center justify-center backdrop-blur-sm p-4"
          onClick={e => { if (e.target === e.currentTarget) setProfileUserId(null) }}>
          <div className="bg-white rounded-2xl w-full max-w-[520px] max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
            {profileLoading ? (
              <div className="flex items-center justify-center py-20"><Spinner className="text-primary" /></div>
            ) : profileData ? (
              <>
                {/* Cover */}
                <div className="h-[90px] bg-gradient-to-r from-primary to-primary-dark relative flex-shrink-0">
                  <button onClick={() => setProfileUserId(null)}
                    className="absolute top-3 right-3 w-7 h-7 bg-black/30 rounded-lg text-white text-[12px] flex items-center justify-center hover:bg-black/50">✕</button>
                </div>

                <div className="flex-1 overflow-y-auto">
                  {/* Profile header */}
                  <div className="px-5 pb-4">
                    <div className="flex items-end justify-between -mt-8 mb-4">
                      <div className="w-[64px] h-[64px] rounded-full bg-primary border-4 border-white text-white flex items-center justify-center text-[20px] font-extrabold shadow-lg">
                        {profileData.initials || profileData.name?.charAt(0) || 'U'}
                      </div>
                      <button onClick={() => toggleFollow(profileData.id)}
                        className={cn('px-5 py-2 rounded-xl text-[13px] font-bold transition-all mt-10',
                          followedIds.has(profileData.id)
                            ? 'bg-gray-100 text-text-secondary border border-border hover:bg-gray-200'
                            : 'bg-primary text-white hover:bg-primary-dark')}>
                        {followedIds.has(profileData.id) ? '✓ Following' : '+ Follow'}
                      </button>
                    </div>

                    <div className="mb-1">
                      <div className="font-display text-[18px] font-extrabold flex items-center gap-2">
                        {profileData.name || 'User'}
                        {profileData.is_verified && (
                          <span className="text-[10px] bg-primary-light text-primary px-2 py-0.5 rounded-full font-bold">✓ Verified</span>
                        )}
                        {profileData.role === 'admin' && (
                          <span className="text-[10px] bg-[#1e1b4b] text-[#a5b4fc] px-2 py-0.5 rounded-full font-bold">🛡 Admin</span>
                        )}
                      </div>
                      {profileData.username && (
                        <div className="text-[13px] text-text-muted">@{profileData.username}</div>
                      )}
                    </div>

                    {profileData.bio && (
                      <div className="text-[13px] text-text-secondary leading-relaxed mb-3">{profileData.bio}</div>
                    )}

                    <div className="flex flex-wrap gap-3 text-[12px] text-text-muted mb-4">
                      {profileData.location && <span>📍 {profileData.location}</span>}
                      {profileData.country && <span>🌍 {profileData.country}</span>}
                      {profileData.joined_at && <span>📅 Joined {new Date(profileData.joined_at).toLocaleDateString('en-NG', { month: 'long', year: 'numeric' })}</span>}
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-3 mb-5">
                      {[
                        { label: 'Holdings', value: profileStats.holdings, icon: '💼' },
                        { label: 'Followers', value: profileStats.followers, icon: '👥' },
                        { label: 'Following', value: profileStats.following, icon: '➡️' },
                      ].map(s => (
                        <div key={s.label} className="bg-gray-50 border border-border rounded-xl py-3 px-2 text-center">
                          <div className="text-lg mb-0.5">{s.icon}</div>
                          <div className="font-display text-[18px] font-extrabold">{s.value}</div>
                          <div className="text-[10px] text-text-muted uppercase tracking-wide">{s.label}</div>
                        </div>
                      ))}
                    </div>

                    {/* Portfolio performance */}
                    {profileData.share_performance && profileData.portfolio_pct_gain !== null && (
                      <div className={cn('flex items-center gap-2 px-4 py-3 rounded-xl mb-5 border',
                        (profileData.portfolio_pct_gain ?? 0) >= 0 ? 'bg-gain-bg border-gain-border' : 'bg-loss-bg border-loss-border')}>
                        <span className="text-[20px]">📈</span>
                        <div>
                          <div className={cn('font-display text-[16px] font-extrabold',
                            (profileData.portfolio_pct_gain ?? 0) >= 0 ? 'text-gain' : 'text-loss')}>
                            {(profileData.portfolio_pct_gain ?? 0) >= 0 ? '+' : ''}{profileData.portfolio_pct_gain?.toFixed(2)}% return
                          </div>
                          <div className="text-[10px] text-text-muted">🔒 ₦ value is private — % only</div>
                        </div>
                      </div>
                    )}

                    {/* Posts */}
                    <div className="font-display text-[13px] font-extrabold mb-3">Recent Posts</div>
                    {profilePosts.length === 0 ? (
                      <div className="text-center py-8 text-text-muted">
                        <div className="text-3xl mb-2">📋</div>
                        <div className="text-[13px]">No posts yet</div>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {profilePosts.map(p => (
                          <div key={p.id} onClick={() => { setProfileUserId(null); openPostDetail(p) }}
                            className="bg-gray-50 border border-border rounded-xl px-4 py-3 cursor-pointer hover:bg-primary-light hover:border-primary-border transition-all">
                            <div className="text-[13px] text-text-secondary leading-relaxed line-clamp-2 mb-2">
                              {cleanBody(p.body)}
                            </div>
                            <div className="flex items-center gap-4 text-[11px] text-text-muted">
                              <span>❤️ {p.likes_count}</span>
                              <span>💬 {p.comments_count}</span>
                              <span>{fmtTime(p.created_at)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-text-muted">
                <div className="text-4xl mb-3">👤</div>
                <div className="text-[14px] font-semibold">User not found</div>
                <button onClick={() => setProfileUserId(null)} className="mt-4 text-primary text-[13px] font-semibold">Close</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SHARE SHEET */}
      {sharePostId && (
        <div className="fixed inset-0 bg-black/40 z-[600] flex items-end justify-center backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) setSharePostId(null) }}>
          <div className="bg-white rounded-t-[18px] p-5 w-full max-w-[480px] animate-slide-up">
            <div className="font-display text-[15px] font-extrabold mb-1">↗ Share Post</div>
            <div className="text-[12px] text-text-muted mb-4 truncate">{shareText}</div>
            <div className="flex items-center gap-2 bg-gray-50 border-[1.5px] border-border rounded-xl px-3 py-2.5 mb-4">
              <span className="flex-1 text-[11px] text-text-secondary truncate font-mono">
                {typeof window !== 'undefined' ? `${window.location.origin}/home?post=${sharePostId}` : ''}
              </span>
              <button onClick={copyLink}
                className={cn('text-[11px] font-bold px-3 py-1.5 rounded-lg transition-all', shareCopied ? 'bg-gain text-white' : 'bg-primary text-white hover:bg-primary-dark')}>
                {shareCopied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <div className="grid grid-cols-4 gap-2.5 mb-3">
              {[
                { id: 'whatsapp', icon: '📱', label: 'WhatsApp', bg: 'bg-gain-bg' },
                { id: 'twitter', icon: '🐦', label: 'Twitter / X', bg: 'bg-blue-50' },
                { id: 'telegram', icon: '✈️', label: 'Telegram', bg: 'bg-sky-50' },
                { id: 'linkedin', icon: '💼', label: 'LinkedIn', bg: 'bg-blue-50' },
              ].map(p => (
                <button key={p.id} onClick={() => shareTo(p.id)} className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl hover:bg-gray-100 transition-colors">
                  <div className={cn('w-10 h-10 rounded-full flex items-center justify-center text-xl', p.bg)}>{p.icon}</div>
                  <div className="text-[10px] font-semibold text-text-secondary">{p.label}</div>
                </button>
              ))}
            </div>
            <button onClick={() => setSharePostId(null)} className="w-full bg-gray-100 text-text-secondary py-3 rounded-xl text-[13px] font-semibold">Cancel</button>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {editPostId && (
        <div className="fixed inset-0 bg-black/40 z-[500] flex items-center justify-center backdrop-blur-sm p-4"
          onClick={e => { if (e.target === e.currentTarget) setEditPostId(null) }}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-[480px] shadow-xl">
            <div className="font-display text-[16px] font-extrabold mb-4">Edit Post</div>
            <textarea value={editText} onChange={e => setEditText(e.target.value)}
              className="w-full bg-gray-50 border-[1.5px] border-border rounded-xl px-3 py-2.5 text-[14px] outline-none focus:border-primary min-h-[100px] resize-none font-sans" />
            <div className="flex gap-2 justify-end mt-4">
              <button onClick={() => setEditPostId(null)} className="px-4 py-2 bg-gray-100 text-text-secondary rounded-xl text-[13px] font-semibold">Cancel</button>
              <button onClick={saveEdit} className="px-6 py-2 bg-primary text-white rounded-xl text-[13px] font-bold hover:bg-primary-dark">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* LIGHTBOX */}
      {lightboxUrl && (
        <div className="fixed inset-0 bg-black/85 z-[999] flex items-center justify-center cursor-pointer" onClick={() => setLightboxUrl(null)}>
          <button className="absolute top-4 right-4 text-white text-3xl" onClick={() => setLightboxUrl(null)}>✕</button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightboxUrl} alt="Post" className="max-w-[90vw] max-h-[90vh] rounded-xl" />
        </div>
      )}

      <Toast {...toast} />
    </div>
  )
}

// ── POST CARD ─────────────────────────────────
interface PostCardProps {
  post: Post; myId: string; myInitials: string; images: string[]
  liked: boolean; commentsOpen: boolean; commentsList: Comment[]
  commentInput: string
  prices: Record<string, { price: number; change_pct: number; company_name: string }>
  myHoldings: Holding[]; portfolioValue: number; followedIds: Set<string>
  onLike: () => void; onToggleComments: () => void
  onCommentChange: (v: string) => void; onCommentSubmit: () => void
  onReact: (emoji: string) => void; onFollow: () => void; onShare: () => void
  onEdit: () => void; onDelete: () => void; onImageClick: (url: string) => void
  onOpenPost: () => void; onOpenProfile: () => void
}

function PostCard({ post, myId, myInitials, images, liked, commentsOpen, commentsList,
  commentInput, prices, myHoldings, portfolioValue, followedIds,
  onLike, onToggleComments, onCommentChange, onCommentSubmit,
  onReact, onFollow, onShare, onEdit, onDelete, onImageClick,
  onOpenPost, onOpenProfile }: PostCardProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const isMe = post.user_id === myId
  const name = post.profiles?.name || 'Gopexly User'
  const initials = post.profiles?.initials || name.charAt(0).toUpperCase()
  const isAdmin = post.profiles?.role === 'admin'
  const tickers = Array.isArray(post.ticker_holdings) ? post.ticker_holdings : []
  const cleanedBody = cleanBody(post.body)

  return (
    <div className="bg-surface border-b border-border px-[18px] py-3.5 hover:bg-gray-50 transition-colors">
      <div className="flex items-start gap-2.5 mb-2.5">
        {/* Clickable avatar → profile */}
        <button onClick={onOpenProfile}
          className="w-[34px] h-[34px] rounded-full bg-primary text-white flex items-center justify-center text-[11px] font-bold flex-shrink-0 hover:opacity-80 transition-opacity">
          {initials}
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-bold flex items-center gap-1.5 flex-wrap">
            {/* Clickable name → profile */}
            <button onClick={onOpenProfile} className="hover:text-primary transition-colors">{name}</button>
            {isAdmin && <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#1e1b4b] text-[#a5b4fc] font-bold">Admin</span>}
          </div>
          <div className="text-[10px] text-text-muted">{fmtTime(post.created_at)}</div>
        </div>
        {!isMe && (
          <button onClick={onFollow}
            className={cn('text-[10px] font-bold px-2.5 py-1.5 rounded-full border transition-all',
              followedIds.has(post.user_id) ? 'bg-gray-100 text-text-muted border-border' : 'bg-primary-light text-primary border-primary-border hover:bg-primary hover:text-white')}>
            {followedIds.has(post.user_id) ? '✓ Following' : '+ Follow'}
          </button>
        )}
        {isMe && (
          <div className="relative">
            <button onClick={() => setMenuOpen(p => !p)} className="px-2 py-1 rounded-lg text-text-muted hover:bg-gray-100 text-[13px]">⋯</button>
            {menuOpen && (
              <div className="absolute top-full right-0 bg-white border border-border rounded-xl shadow-md z-20 min-w-[140px]">
                <button onClick={() => { onEdit(); setMenuOpen(false) }} className="w-full text-left px-3.5 py-2.5 text-[13px] text-text-secondary hover:bg-gray-50">✏ Edit</button>
                <button onClick={() => { onDelete(); setMenuOpen(false) }} className="w-full text-left px-3.5 py-2.5 text-[13px] text-loss hover:bg-gray-50">🗑 Delete</button>
              </div>
            )}
          </div>
        )}
      </div>

      {post.portfolio_pct_gain != null && post.profiles?.share_performance && (
        <div className={cn('inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full mb-2 border',
          post.portfolio_pct_gain >= 0 ? 'bg-gain-bg text-gain border-gain-border' : 'bg-loss-bg text-loss border-loss-border')}>
          {post.portfolio_pct_gain >= 0 ? '▲' : '▼'} {Math.abs(post.portfolio_pct_gain).toFixed(1)}% portfolio return
        </div>
      )}

      {tickers.filter(t => t.ticker && !t.type).length > 0 && (
        <div className="flex gap-1.5 flex-wrap mb-2">
          {tickers.filter(t => t.ticker && !t.type).map(t => {
            const mp = prices[t.ticker]
            const up = (mp?.change_pct ?? 0) >= 0
            const myH = myHoldings.find(h => h.ticker === t.ticker)
            const myPct = myH && portfolioValue > 0 ? Math.round((prices[myH.ticker]?.price ?? myH.buy_price) * myH.shares / portfolioValue * 100) : null
            return (
              <div key={t.ticker} className="bg-white border border-border rounded-xl px-2.5 py-1.5">
                <div className="text-[10px] font-extrabold font-mono">{t.ticker}</div>
                {mp && <div className={cn('text-[12px] font-bold', up ? 'text-gain' : 'text-loss')}>₦{mp.price.toFixed(2)} {up ? '▲' : '▼'} {Math.abs(mp.change_pct).toFixed(2)}%</div>}
                <div className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded-full inline-block mt-0.5', myH ? 'bg-gain-bg text-gain' : 'bg-gray-100 text-text-muted')}>
                  {myH ? `✓ ${myPct}% of portfolio` : '— Not in portfolio'}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Clickable post body → open post detail */}
      <div onClick={onOpenPost} className="text-[14px] text-text-secondary leading-relaxed mb-2 whitespace-pre-wrap break-words cursor-pointer hover:text-text transition-colors">
        {cleanedBody.length > 200 ? cleanedBody.substring(0, 200) + '...' : cleanedBody}
        {cleanedBody.length > 200 && (
          <span className="text-primary font-semibold ml-1">Read more</span>
        )}
      </div>

      {images.length > 0 && (
        <div className={cn('grid gap-1.5 mb-2 rounded-xl overflow-hidden cursor-pointer',
          images.length === 1 ? 'grid-cols-1' : images.length === 2 ? 'grid-cols-2' : 'grid-cols-3')}
          onClick={onOpenPost}>
          {images.slice(0, 3).map((url, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={url} alt="Post" onClick={e => { e.stopPropagation(); onImageClick(url) }}
              className={cn('w-full object-cover', images.length === 1 ? 'h-[280px]' : 'h-[160px]')} />
          ))}
        </div>
      )}

      <div className="flex items-center gap-px pt-2 border-t border-border">
        <button onClick={onLike} className={cn('flex items-center gap-1 text-[12px] font-medium px-2 py-1.5 rounded-lg transition-all hover:bg-gray-100', liked ? 'text-loss' : 'text-text-muted')}>
          {liked ? '❤️' : '🤍'} <span>{post.likes_count}</span>
        </button>
        <button onClick={onToggleComments} className="flex items-center gap-1 text-[12px] font-medium text-text-muted px-2 py-1.5 rounded-lg hover:bg-gray-100 transition-all">
          💬 <span>{post.comments_count}</span>
        </button>
        <button onClick={onOpenPost} className="flex items-center gap-1 text-[12px] font-medium text-text-muted px-2 py-1.5 rounded-lg hover:bg-gray-100 transition-all">
          👁 Read
        </button>
        <button onClick={onShare} className="flex items-center gap-1 text-[12px] font-medium text-text-muted px-2 py-1.5 rounded-lg hover:bg-gray-100 transition-all">↗ Share</button>
        <div className="ml-auto flex gap-px">
          {['🔥', '💯', '🚀', '📈', '👌'].map(e => (
            <button key={e} onClick={() => onReact(e)} className="text-base px-1.5 py-1 rounded-lg hover:bg-gray-100 hover:scale-125 transition-all">{e}</button>
          ))}
        </div>
      </div>

      {commentsOpen && (
        <div className="mt-2.5 pt-2.5 border-t border-border">
          <div className="flex flex-col gap-2 mb-2.5">
            {commentsList.map(c => (
              <div key={c.id} className="flex gap-2">
                <div className="w-[26px] h-[26px] rounded-full bg-gray-100 flex items-center justify-center text-[9px] font-bold flex-shrink-0">{c.profiles?.initials || c.profiles?.name?.charAt(0) || 'U'}</div>
                <div className="bg-gray-50 rounded-xl px-3 py-2 flex-1">
                  <div className="text-[11px] font-bold mb-0.5">{c.profiles?.name || 'User'}</div>
                  <div className="text-[12px] text-text-secondary leading-snug">{c.body}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <div className="w-[26px] h-[26px] rounded-full bg-primary text-white flex items-center justify-center text-[9px] font-bold flex-shrink-0">{myInitials}</div>
            <input value={commentInput} onChange={e => onCommentChange(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') onCommentSubmit() }}
              placeholder="Write a comment..."
              className="flex-1 bg-gray-50 border-[1.5px] border-border text-text px-3 py-2 rounded-full text-[12px] outline-none focus:border-primary" />
            <button onClick={onCommentSubmit} className="w-7 h-7 rounded-full bg-primary text-white text-[12px] flex items-center justify-center hover:bg-primary-dark">→</button>
          </div>
        </div>
      )}
    </div>
  )
}