'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { fmtTime, fmtDate, cn } from '@/lib/utils'
import { useAuth } from '@/lib/hooks/useAuth'
import { useToast } from '@/lib/hooks/useToast'
import { Toast, Spinner } from '@/components/ui'
import type { Profile, Post, StockPrice } from '@/types'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

// Explicit row types to avoid Supabase 'never' inference
type ProfileRow = { id: string; name: string | null; username: string | null; country: string | null; role: string; is_suspended: boolean; is_verified: boolean; total_posts: number; joined_at: string | null; initials: string | null; phone: string | null; followers_count: number; points: number; streak: number }
type PostRow = { id: string; body: string; created_at: string; likes_count: number; comments_count: number; user_id: string; profiles: { name: string | null } | null }
type NewsRow = { id: string; title: string; body: string; created_at: string; source: string | null; profiles: { name: string | null } | null }
type CourseRow = { id: string; title: string; category: string; difficulty: string; points_reward: number; lesson_count: number; is_published: boolean }
type HoldingRow = { id: string; ticker: string; company_name: string | null; shares: number; buy_price: number; profiles: { name: string | null } | null }
type LogRow = { id: string; body: string; created_at: string; profiles: { name: string | null } | null }
type SupabaseRelation<T> = T | T[] | null

function oneRelation<T>(relation: SupabaseRelation<T>): T | null {
  return Array.isArray(relation) ? relation[0] ?? null : relation
}


type AdminSection = 'dashboard' | 'users' | 'suspended' | 'admins' | 'posts' | 'news' | 'courses' | 'portfolios' | 'market' | 'settings' | 'logs'

const NAV_ITEMS = [
  { section: 'dashboard' as AdminSection, icon: '🏠', label: 'Dashboard', group: 'overview' },
  { section: 'users' as AdminSection, icon: '👥', label: 'All Users', group: 'users' },
  { section: 'suspended' as AdminSection, icon: '🚫', label: 'Suspended', group: 'users' },
  { section: 'admins' as AdminSection, icon: '🛡', label: 'Admins', group: 'users' },
  { section: 'posts' as AdminSection, icon: '📋', label: 'All Posts', group: 'content' },
  { section: 'news' as AdminSection, icon: '📰', label: 'Post News', group: 'content' },
  { section: 'courses' as AdminSection, icon: '🎓', label: 'Courses', group: 'content' },
  { section: 'portfolios' as AdminSection, icon: '💼', label: 'Portfolios', group: 'finance' },
  { section: 'market' as AdminSection, icon: '📈', label: 'Market Data', group: 'finance' },
  { section: 'settings' as AdminSection, icon: '⚙', label: 'Settings', group: 'system' },
  { section: 'logs' as AdminSection, icon: '📝', label: 'Activity Logs', group: 'system' },
]

export default function AdminPanel() {
  const sb = createClient()
  const router = useRouter()
  const { user } = useAuth()
  const { toast, showToast } = useToast()

  const [section, setSection] = useState<AdminSection>('dashboard')
  const [loading, setLoading] = useState(true)
  const [accessDenied, setAccessDenied] = useState(false)

  // Dashboard stats
  const [stats, setStats] = useState({ users: 0, posts: 0, holdings: 0 })
  const [countryData, setCountryData] = useState<Record<string, number>>({})
  const [healthData, setHealthData] = useState({ active: 0, suspended: 0, verified: 0 })

  // Users
  const [users, setUsers] = useState<ProfileRow[]>([])
  const [filteredUsers, setFilteredUsers] = useState<ProfileRow[]>([])
  const [userPage, setUserPage] = useState(1)
  const [userLoading, setUserLoading] = useState(false)
  const PER = 15

  // Selected user for modal
  const [viewUser, setViewUser] = useState<ProfileRow | null>(null)
  const [viewUserStats, setViewUserStats] = useState({ posts: 0, holdings: 0, followers: 0 })

  // Suspend modal
  const [suspendTarget, setSuspendTarget] = useState<string | null>(null)
  const [suspendReason, setSuspendReason] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleteLoading, setDeleteLoading] = useState(false)

  // Posts
  const [posts, setPosts] = useState<PostRow[]>([])

  // News
  const [newsTitle, setNewsTitle] = useState('')
  const [newsBody, setNewsBody] = useState('')
  const [newsSource, setNewsSource] = useState('')
  const [newsImg, setNewsImg] = useState<File | null>(null)
  const [newsImgPreview, setNewsImgPreview] = useState('')
  const [newsPostLoading, setNewsPostLoading] = useState(false)
  const [newsList, setNewsList] = useState<{ id: string; title: string; body: string; created_at: string; source?: string | null; profiles?: { name?: string | null } | null }[]>([])

  // Courses
  const [coTitle, setCoTitle] = useState('')
  const [coDesc, setCoDesc] = useState('')
  const [coCat, setCoCat] = useState('Investing')
  const [coDiff, setCoDiff] = useState('Beginner')
  const [coDur, setCoDur] = useState('30')
  const [coPts, setCoPts] = useState('100')
  const [coursesList, setCoursesList] = useState<{ id: string; title: string; category: string; difficulty: string; points_reward: number; lesson_count: number; is_published: boolean }[]>([])
  const [activeCourseId, setActiveCourseId] = useState<string | null>(null)
  const [activeCourseName, setActiveCourseName] = useState('')
  const [lsTitle, setLsTitle] = useState('')
  const [lsContent, setLsContent] = useState('')
  const [lsVideo, setLsVideo] = useState('')
  const [lsType, setLsType] = useState('text')
  const [lsDur, setLsDur] = useState('10')
  const [asQ, setAsQ] = useState('')
  const [asOpts, setAsOpts] = useState(['', '', '', ''])
  const [asCorrect, setAsCorrect] = useState(0)
  const [asExp, setAsExp] = useState('')

  // Market
  const [market, setMarket] = useState<StockPrice[]>([])

  // ── AUTH CHECK ────────────────────────────────
  useEffect(() => {
    if (!user) return
    sb.from('profiles').select('role').eq('id', user.id).single().then(({ data: rd }) => {
      const roleData = rd as { role: string } | null
      if (!roleData || !['admin', 'editor'].includes(roleData.role)) {
        setAccessDenied(true)
      } else {
        setLoading(false)
        loadDashboard()
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  // ── DASHBOARD ─────────────────────────────────
  const loadDashboard = useCallback(async () => {
    const [uRes, pRes, hRes, vRes, sRes, cRes] = await Promise.all([
      sb.from('profiles').select('id', { count: 'exact', head: true }),
      sb.from('posts').select('id', { count: 'exact', head: true }),
      sb.from('holdings').select('id', { count: 'exact', head: true }),
      sb.from('profiles').select('id', { count: 'exact', head: true }).eq('is_verified', true),
      sb.from('profiles').select('id', { count: 'exact', head: true }).eq('is_suspended', true),
      sb.from('profiles').select('country'),
    ])
    setStats({ users: uRes.count || 0, posts: pRes.count || 0, holdings: hRes.count || 0 })
    setHealthData({ active: Math.max(0, (uRes.count || 0) - (sRes.count || 0)), suspended: sRes.count || 0, verified: vRes.count || 0 })
    const countries: Record<string, number> = {}
    ;(cRes.data as { country: string | null }[] || []).forEach(p => { const c = p.country || 'Nigeria'; countries[c] = (countries[c] || 0) + 1 })
    setCountryData(countries)
  }, [sb])

  // ── SECTION LOADER ────────────────────────────
  useEffect(() => {
    if (loading || accessDenied) return
    if (section === 'users' || section === 'suspended' || section === 'admins') loadUsers()
    else if (section === 'posts') loadPosts()
    else if (section === 'news') loadNews()
    else if (section === 'courses') loadCourses()
    else if (section === 'market') loadMarket()
    else if (section === 'logs') loadLogs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section, loading])

  async function loadUsers() {
    setUserLoading(true)
    const { data: ud } = await sb.from('profiles').select('*').order('joined_at', { ascending: false })
    const all = (ud || []) as Profile[]
    setUsers(all)
    if (section === 'suspended') setFilteredUsers(all.filter(u => u.is_suspended))
    else if (section === 'admins') setFilteredUsers(all.filter(u => u.role === 'admin' || u.role === 'editor'))
    else setFilteredUsers(all)
    setUserPage(1)
    setUserLoading(false)
  }

  async function loadPosts() {
    const { data: pd } = await sb.from('posts')
      .select('id,user_id,body,created_at,likes_count,comments_count,profiles!posts_user_id_fkey(name)')
      .order('created_at', { ascending: false }).limit(60)
    setPosts(((pd || []) as (Omit<PostRow, 'profiles'> & { profiles: SupabaseRelation<{ name: string | null }> })[])
      .map(p => ({ ...p, profiles: oneRelation(p.profiles) })))
  }

  async function loadNews() {
    const { data: nd } = await sb.from('news_posts')
      .select('*, profiles!news_posts_author_id_fkey(name)')
      .order('created_at', { ascending: false }).limit(20)
    setNewsList((nd || []) as typeof newsList)
  }

  async function loadCourses() {
    const { data: cd } = await sb.from('courses').select('*').order('created_at', { ascending: false })
    setCoursesList((cd || []) as typeof coursesList)
  }

  async function loadMarket() {
    const { data: md } = await sb.from('stock_prices').select('*').order('ticker')
    setMarket((md || []) as StockPrice[])
  }

  const [holdings, setHoldings] = useState<HoldingRow[]>([])
  const [logs, setLogs] = useState<LogRow[]>([])
  async function loadLogs() {
    const { data: ld } = await sb.from('posts')
      .select('id,body,created_at,profiles!posts_user_id_fkey(name)')
      .order('created_at', { ascending: false }).limit(30)
    setLogs(((ld || []) as (Omit<LogRow, 'profiles'> & { profiles: SupabaseRelation<{ name: string | null }> })[])
      .map(l => ({ ...l, profiles: oneRelation(l.profiles) })))
  }

  // ── USER ACTIONS ──────────────────────────────
  async function openViewUser(u: ProfileRow) {
    setViewUser(u)
    const [pRes, hRes, fRes] = await Promise.all([
      sb.from('posts').select('id', { count: 'exact', head: true }).eq('user_id', u.id),
      sb.from('holdings').select('id', { count: 'exact', head: true }).eq('user_id', u.id),
      sb.from('follows').select('id', { count: 'exact', head: true }).eq('following_id', u.id),
    ])
    setViewUserStats({ posts: pRes.count || 0, holdings: hRes.count || 0, followers: fRes.count || 0 })
  }

  async function doSuspend() {
    if (!suspendTarget) return
    await (sb.from('profiles') as any).update({ is_suspended: true, suspension_reason: suspendReason || 'No reason' }).eq('id', suspendTarget)
    setSuspendTarget(null); setSuspendReason('')
    showToast('User suspended', 'ok')
    loadUsers()
  }

  async function doUnsuspend(uid: string) {
    await (sb.from('profiles') as any).update({ is_suspended: false, suspension_reason: null }).eq('id', uid)
    showToast('User unsuspended', 'ok')
    loadUsers()
  }

  async function doMakeAdmin(uid: string) {
    if (!confirm('Give this user admin privileges?')) return
    await (sb.from('profiles') as any).update({ role: 'admin' }).eq('id', uid)
    showToast('User promoted to admin', 'ok')
    setViewUser(null); loadUsers()
  }

  async function doDeleteUser() {
    if (deleteConfirm !== 'DELETE') { showToast('Type DELETE in caps', 'err'); return }
    if (!deleteTarget) return
    setDeleteLoading(true)
    const res = await fetch('/api/admin/delete-user', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetUserId: deleteTarget.id })
    })
    const data = await res.json()
    setDeleteLoading(false)
    if (!res.ok || !data.success) { showToast('Error: ' + (data.error || 'Unknown'), 'err'); return }
    showToast('User deleted successfully', 'ok')
    setDeleteTarget(null); setDeleteConfirm('')
    loadUsers(); loadDashboard()
  }

  async function doDeletePost(id: string, el: HTMLElement) {
    if (!confirm('Delete this post?')) return
    await (sb.from('posts') as any).delete().eq('id', id)
    el.closest('tr')?.remove()
    showToast('Post deleted', 'ok')
  }

  // ── NEWS ──────────────────────────────────────
  async function postNews() {
    if (!newsTitle || !newsBody) { showToast('Title and body required', 'err'); return }
    if (!user) return
    setNewsPostLoading(true)
    let imageUrl: string | null = null
    if (newsImg) {
      const path = `news/${Date.now()}-${newsImg.name.replace(/\s/g, '_')}`
      const up = await sb.storage.from('post-images').upload(path, newsImg, { contentType: newsImg.type })
      if (!up.error) imageUrl = sb.storage.from('post-images').getPublicUrl(path).data.publicUrl
    }
    const { data: n, error } = await (sb.from('news_posts') as any).insert({
      title: newsTitle, body: newsBody, source: newsSource || null, image_url: imageUrl, author_id: user.id
    }).select().single()
    if (error) { showToast('Error: ' + error.message, 'err'); setNewsPostLoading(false); return }
    const excerpt = newsBody.length > 200 ? newsBody.slice(0, 200) + '...' : newsBody
    await (sb.from('posts') as any).insert({ user_id: user.id, body: '📰 [NEWS] ' + newsTitle + '\n\n' + excerpt + (newsSource ? '\n\nSource: ' + newsSource : ''), ticker_holdings: [] })
    setNewsTitle(''); setNewsBody(''); setNewsSource(''); setNewsImg(null); setNewsImgPreview('')
    setNewsPostLoading(false)
    showToast('News published to all users!', 'ok')
    loadNews()
    if (n) setNewsList(prev => [n, ...prev])
  }

  // ── COURSES ───────────────────────────────────
  async function createCourse() {
    if (!coTitle || !user) { showToast('Title required', 'err'); return }
    const { error } = await (sb.from('courses') as any).insert({
      title: coTitle, description: coDesc, category: coCat, difficulty: coDiff,
      duration_mins: parseInt(coDur) || 30, points_reward: parseInt(coPts) || 100,
      created_by: user.id, is_published: false
    })
    if (error) { showToast('Error: ' + error.message, 'err'); return }
    setCoTitle(''); setCoDesc('')
    showToast('Course created! Add lessons and publish.', 'ok')
    loadCourses()
  }

  async function addLesson() {
    if (!activeCourseId || !lsTitle || !lsContent) { showToast('Title and content required', 'err'); return }
    const cnt = await (sb.from('course_lessons') as any).select('id', { count: 'exact', head: true }).eq('course_id', activeCourseId)
    const order = (cnt.count || 0) + 1
    const { data: lr, error } = await (sb.from('course_lessons') as any).insert({
      course_id: activeCourseId, title: lsTitle, content: lsContent,
      video_url: lsVideo || null, lesson_type: lsType, lesson_order: order, duration_mins: parseInt(lsDur) || 10
    }).select().single()
    if (error || !lr) { showToast('Error: ' + (error?.message || 'Failed'), 'err'); return }
    if (asQ) {
      await (sb.from('course_assessments') as any).insert({
        course_id: activeCourseId, lesson_id: lr.id, question: asQ,
        options: JSON.stringify(asOpts), correct_index: asCorrect, explanation: asExp || null
      })
    }
    await (sb.from('courses') as any).update({ lesson_count: order }).eq('id', activeCourseId)
    setLsTitle(''); setLsContent(''); setLsVideo('')
    setAsQ(''); setAsOpts(['', '', '', '']); setAsCorrect(0); setAsExp('')
    showToast(`Lesson ${order} added!`, 'ok')
    loadCourses()
  }

  async function togglePublish(id: string, current: boolean) {
    await (sb.from('courses') as any).update({ is_published: !current }).eq('id', id)
    showToast(!current ? 'Course published!' : 'Course unpublished', 'ok')
    loadCourses()
  }

  async function deleteCourse(id: string) {
    if (!confirm('Delete this course and all lessons?')) return
    await (sb.from('courses') as any).delete().eq('id', id)
    showToast('Course deleted', 'ok')
    loadCourses()
  }

  // ── ACCESS DENIED ─────────────────────────────
  if (accessDenied) return (
    <div className="min-h-screen bg-[#1e1b4b] flex items-center justify-center">
      <div className="text-center text-white">
        <div className="text-6xl mb-4">🚫</div>
        <div className="font-display text-[20px] font-extrabold mb-2">Access Denied</div>
        <div className="text-white/60 mb-6">Admin privileges required.</div>
        <Link href="/home" className="bg-indigo-500 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-600 transition-all">← Back to App</Link>
      </div>
    </div>
  )

  if (loading) return (
    <div className="min-h-screen bg-[#1e1b4b] flex items-center justify-center">
      <div className="text-center text-white">
        <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl flex items-center justify-center text-xl font-black mx-auto mb-4">G</div>
        <div className="text-white/60 text-[13px]">Loading admin panel...</div>
        <div className="w-40 h-1 bg-white/10 rounded-full mx-auto mt-4 overflow-hidden">
          <div className="h-full bg-indigo-500 rounded-full animate-loadbar" />
        </div>
      </div>
    </div>
  )

  const pagedUsers = filteredUsers.slice((userPage - 1) * PER, userPage * PER)
  const userPages = Math.ceil(filteredUsers.length / PER)
  const totalCountry = Object.values(countryData).reduce((a, v) => a + v, 0) || 1

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* SIDEBAR */}
      <aside className="w-[240px] flex-shrink-0 bg-[#1e1b4b] text-white flex flex-col">
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-lg flex items-center justify-center text-[14px] font-black">G</div>
            <div>
              <div className="font-display text-[15px] font-extrabold">Gopexly</div>
              <div className="text-[10px] opacity-40">Admin Panel</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-2 py-3 overflow-y-auto">
          {['overview', 'users', 'content', 'finance', 'system'].map(group => (
            <div key={group}>
              <div className="text-[9px] font-bold text-white/30 uppercase tracking-wider px-2 py-2 mt-3 first:mt-0 capitalize">{group}</div>
              {NAV_ITEMS.filter(i => i.group === group).map(item => (
                <button key={item.section} onClick={() => setSection(item.section)}
                  className={cn('w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-[12px] font-medium transition-all mb-px',
                    section === item.section ? 'bg-white/15 text-white font-semibold' : 'text-white/55 hover:bg-white/8 hover:text-white')}>
                  <span className="text-[14px] w-4 text-center">{item.icon}</span>
                  {item.label}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="p-3 border-t border-white/10">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-full bg-indigo-500 flex items-center justify-center text-[11px] font-bold">{user?.initials || 'A'}</div>
            <div>
              <div className="text-[12px] font-semibold text-white/80">{user?.name || 'Admin'}</div>
              <div className="text-[10px] text-white/35">🛡 Administrator</div>
            </div>
          </div>
          <button onClick={async () => { await sb.auth.signOut(); router.replace('/') }}
            className="w-full bg-white/7 border border-white/12 text-white/60 py-2 rounded-lg text-[11px] font-semibold hover:bg-white/12 hover:text-white transition-all">
            ↩ Log Out
          </button>
          <Link href="/home" className="block text-center text-[11px] text-white/30 mt-2 hover:text-white/60 transition-colors">← Back to App</Link>
        </div>
      </aside>

      {/* MAIN */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 bg-surface border-b border-border flex items-center justify-between px-6 flex-shrink-0">
          <div className="font-display text-[16px] font-extrabold capitalize">{section}</div>
          <div className="w-7 h-7 rounded-full bg-primary text-white flex items-center justify-center text-[11px] font-bold">{user?.initials || 'A'}</div>
        </header>

        <div className="flex-1 overflow-y-auto p-6">

          {/* DASHBOARD */}
          {section === 'dashboard' && (
            <div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                {[
                  { label: 'Total Users', value: stats.users, icon: '👥', color: 'bg-primary-light' },
                  { label: 'Total Posts', value: stats.posts, icon: '📋', color: 'bg-gain-bg' },
                  { label: 'Holdings', value: stats.holdings, icon: '💼', color: 'bg-purple-bg' },
                  { label: 'NGX Stocks', value: 124, icon: '📈', color: 'bg-amber-bg' },
                ].map(s => (
                  <div key={s.label} className="bg-surface border border-border rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center text-lg', s.color)}>{s.icon}</div>
                      <span className="text-[10px] font-bold text-gain bg-gain-bg px-2 py-0.5 rounded-full">↑ live</span>
                    </div>
                    <div className="font-display text-[26px] font-extrabold">{s.value.toLocaleString()}</div>
                    <div className="text-[11px] text-text-muted">{s.label}</div>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-surface border border-border rounded-xl p-4">
                  <div className="text-[11px] font-bold text-text-muted uppercase tracking-wide mb-3">User Registrations</div>
                  {Object.entries(countryData).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([c, v]) => (
                    <div key={c} className="flex items-center gap-2 mb-2">
                      <div className="text-[11px] text-text-secondary w-16 truncate">{c}</div>
                      <div className="flex-1 bg-gray-200 rounded h-1.5">
                        <div className="h-full rounded bg-primary" style={{ width: `${Math.round(v / totalCountry * 100)}%` }} />
                      </div>
                      <div className="text-[11px] font-bold w-6 text-right">{v}</div>
                    </div>
                  ))}
                </div>
                <div className="bg-surface border border-border rounded-xl p-4">
                  <div className="text-[11px] font-bold text-text-muted uppercase tracking-wide mb-3">Platform Health</div>
                  {[
                    { label: 'Active', val: healthData.active, col: 'bg-gain' },
                    { label: 'Suspended', val: healthData.suspended, col: 'bg-loss' },
                    { label: 'Verified', val: healthData.verified, col: 'bg-primary' },
                  ].map(item => (
                    <div key={item.label} className="flex items-center gap-2 mb-2">
                      <div className="text-[11px] text-text-secondary w-16">{item.label}</div>
                      <div className="flex-1 bg-gray-200 rounded h-1.5">
                        <div className={cn('h-full rounded', item.col)} style={{ width: `${stats.users > 0 ? Math.round(item.val / stats.users * 100) : 0}%` }} />
                      </div>
                      <div className="text-[11px] font-bold w-6 text-right">{item.val}</div>
                    </div>
                  ))}
                </div>
                <div className="bg-surface border border-border rounded-xl p-4">
                  <div className="text-[11px] font-bold text-text-muted uppercase tracking-wide mb-3">Quick Actions</div>
                  <div className="flex flex-col gap-2">
                    {[
                      { label: '👥 Manage Users', s: 'users' },
                      { label: '📰 Post News', s: 'news' },
                      { label: '🎓 Create Course', s: 'courses' },
                      { label: '📋 Review Posts', s: 'posts' },
                    ].map(a => (
                      <button key={a.s} onClick={() => setSection(a.s as AdminSection)}
                        className="w-full text-left bg-gray-50 border border-border px-3 py-2 rounded-lg text-[12px] font-semibold hover:bg-primary-light hover:border-primary-border hover:text-primary transition-all">
                        {a.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* USERS */}
          {(section === 'users' || section === 'suspended' || section === 'admins') && (
            <div>
              <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                <div className="text-[13px] text-text-muted">{filteredUsers.length} users</div>
                <button onClick={() => {
                  const csv = 'Name,Username,Country,Role,Posts,Joined\n' + users.map(u => `"${u.name||''}",${u.username||''},${u.country||''},${u.role},${u.total_posts||0},${u.joined_at||''}`).join('\n')
                  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'users.csv'; a.click()
                  showToast('CSV exported', 'ok')
                }} className="text-[12px] font-semibold bg-surface border border-border px-3 py-1.5 rounded-lg hover:bg-gray-100">↓ Export CSV</button>
              </div>
              {userLoading ? <div className="flex justify-center py-10"><Spinner className="text-primary" /></div> : (
                <div className="bg-surface border border-border rounded-xl overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-50 border-b border-border">
                        {['User', 'Username', 'Country', 'Posts', 'Status', 'Joined', 'Actions'].map(h => (
                          <th key={h} className="text-left px-3.5 py-2.5 text-[10px] font-bold text-text-muted uppercase tracking-wide">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {pagedUsers.map(u => {
                        const ini = u.initials || u.name?.charAt(0) || 'U'
                        const pill = u.is_suspended ? 'bg-loss-bg text-loss' : u.role === 'admin' ? 'bg-purple-bg text-purple' : u.is_verified ? 'bg-gain-bg text-gain' : 'bg-gray-100 text-text-muted'
                        const pillLabel = u.is_suspended ? 'Suspended' : u.role === 'admin' ? 'Admin' : u.is_verified ? 'Verified' : 'Unverified'
                        return (
                          <tr key={u.id} className="border-b border-border last:border-0 hover:bg-gray-50 transition-colors">
                            <td className="px-3.5 py-3">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0">{ini}</div>
                                <div className="text-[13px] font-semibold">{u.name || 'No Name'}</div>
                              </div>
                            </td>
                            <td className="px-3.5 py-3 text-[12px] text-text-muted">@{u.username || '—'}</td>
                            <td className="px-3.5 py-3 text-[12px]">{u.country || '—'}</td>
                            <td className="px-3.5 py-3 text-[12px] font-bold">{u.total_posts || 0}</td>
                            <td className="px-3.5 py-3"><span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', pill)}>{pillLabel}</span></td>
                            <td className="px-3.5 py-3 text-[11px] text-text-muted">{fmtDate(u.joined_at)}</td>
                            <td className="px-3.5 py-3">
                              <div className="flex gap-1.5">
                                <button onClick={() => openViewUser(u)} className="text-[11px] font-semibold bg-gray-100 px-2.5 py-1 rounded-lg hover:bg-gray-200">View</button>
                                {!u.is_suspended
                                  ? <button onClick={() => { setSuspendTarget(u.id); setSuspendReason('') }} className="text-[11px] font-semibold bg-amber-bg text-amber px-2.5 py-1 rounded-lg hover:bg-amber hover:text-white transition-all">Suspend</button>
                                  : <button onClick={() => doUnsuspend(u.id)} className="text-[11px] font-semibold bg-gain-bg text-gain px-2.5 py-1 rounded-lg">Unsuspend</button>}
                                <button onClick={() => { setDeleteTarget({ id: u.id, name: u.name || 'User' }); setDeleteConfirm('') }} className="text-[11px] font-semibold bg-loss-bg text-loss px-2 py-1 rounded-lg hover:bg-loss hover:text-white transition-all">🗑</button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  {userPages > 1 && (
                    <div className="flex justify-center gap-1.5 p-3 border-t border-border">
                      {userPage > 1 && <button onClick={() => setUserPage(p => p - 1)} className="w-8 h-8 rounded-lg bg-gray-100 text-[12px] font-bold hover:bg-primary hover:text-white">‹</button>}
                      {Array.from({ length: Math.min(5, userPages) }, (_, i) => {
                        const n = Math.max(1, Math.min(userPage - 2, userPages - 4)) + i
                        return <button key={n} onClick={() => setUserPage(n)} className={cn('w-8 h-8 rounded-lg text-[12px] font-bold', n === userPage ? 'bg-primary text-white' : 'bg-gray-100 hover:bg-primary hover:text-white')}>{n}</button>
                      })}
                      {userPage < userPages && <button onClick={() => setUserPage(p => p + 1)} className="w-8 h-8 rounded-lg bg-gray-100 text-[12px] font-bold hover:bg-primary hover:text-white">›</button>}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* POSTS */}
          {section === 'posts' && (
            <div className="bg-surface border border-border rounded-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-border">
                    {['Content', 'Author', 'Likes', 'Comments', 'Time', 'Action'].map(h => (
                      <th key={h} className="text-left px-3.5 py-2.5 text-[10px] font-bold text-text-muted uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {posts.map(p => (
                    <tr key={p.id} className="border-b border-border last:border-0 hover:bg-gray-50">
                      <td className="px-3.5 py-3 max-w-[280px]">
                        <div className="text-[12px] text-text-secondary truncate">{p.body.substring(0, 80)}{p.body.length > 80 ? '...' : ''}</div>
                      </td>
                      <td className="px-3.5 py-3 text-[12px] font-semibold">{(p as Post & { profiles?: { name?: string | null } }).profiles?.name || 'Unknown'}</td>
                      <td className="px-3.5 py-3 text-[12px] font-bold">❤️ {p.likes_count}</td>
                      <td className="px-3.5 py-3 text-[12px] font-bold">💬 {p.comments_count}</td>
                      <td className="px-3.5 py-3 text-[11px] text-text-muted">{fmtTime(p.created_at)}</td>
                      <td className="px-3.5 py-3">
                        <button onClick={e => doDeletePost(p.id, e.currentTarget)} className="text-[11px] font-semibold bg-loss-bg text-loss px-2.5 py-1 rounded-lg hover:bg-loss hover:text-white transition-all">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* NEWS */}
          {section === 'news' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="bg-surface border border-border rounded-xl p-5">
                <div className="font-display text-[15px] font-extrabold mb-1">📰 Post News Article</div>
                <div className="text-[11px] text-text-muted mb-4">Appears in News tab AND main feed for all users.</div>
                <div className="flex flex-col gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wide mb-1">Headline *</label>
                    <input value={newsTitle} onChange={e => setNewsTitle(e.target.value)} placeholder="NGX All-Share Index hits new high..."
                      className="w-full bg-gray-50 border-[1.5px] border-border text-text px-3 py-2.5 rounded-xl text-[13px] outline-none focus:border-primary" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wide mb-1">Article Content *</label>
                    <textarea value={newsBody} onChange={e => setNewsBody(e.target.value)} rows={5}
                      className="w-full bg-gray-50 border-[1.5px] border-border text-text px-3 py-2.5 rounded-xl text-[13px] outline-none focus:border-primary resize-none"
                      placeholder="Write the full article here..." />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wide mb-1">Source</label>
                      <input value={newsSource} onChange={e => setNewsSource(e.target.value)} placeholder="BusinessDay..."
                        className="w-full bg-gray-50 border-[1.5px] border-border text-text px-3 py-2.5 rounded-xl text-[13px] outline-none focus:border-primary" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-text-muted uppercase tracking-wide mb-1">Featured Image</label>
                      <input type="file" accept="image/*" onChange={e => {
                        const f = e.target.files?.[0]; if (!f) return; setNewsImg(f)
                        const r = new FileReader(); r.onload = ev => setNewsImgPreview(ev.target?.result as string); r.readAsDataURL(f)
                      }} className="w-full text-[12px] bg-gray-50 border-[1.5px] border-dashed border-border rounded-xl px-2 py-2 cursor-pointer" />
                    </div>
                  </div>
                  {newsImgPreview && (
                    <div className="flex items-center gap-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={newsImgPreview} alt="" className="h-16 rounded-lg object-cover" />
                      <button onClick={() => { setNewsImg(null); setNewsImgPreview('') }} className="text-loss text-[12px] font-semibold">Remove</button>
                    </div>
                  )}
                  <button onClick={postNews} disabled={newsPostLoading}
                    className="w-full bg-primary text-white font-bold py-3 rounded-xl text-[13px] hover:bg-primary-dark disabled:opacity-50">
                    {newsPostLoading ? 'Publishing...' : '📰 Publish to All Users'}
                  </button>
                </div>
              </div>
              <div className="bg-surface border border-border rounded-xl overflow-hidden">
                <div className="px-4 py-3.5 border-b border-border flex items-center justify-between">
                  <div className="font-display text-[14px] font-extrabold">Published Articles</div>
                  <span className="text-[12px] text-text-muted">{newsList.length} articles</span>
                </div>
                <div className="p-4 max-h-[500px] overflow-y-auto">
                  {newsList.length === 0 ? (
                    <div className="text-center py-8 text-text-muted text-[13px]">No news posted yet.</div>
                  ) : newsList.map(n => (
                    <div key={n.id} className="pb-3 mb-3 border-b border-border last:border-0 last:mb-0">
                      <div className="text-[13px] font-semibold mb-1">{n.title}</div>
                      <div className="text-[11px] text-text-muted mb-2">{fmtTime(n.created_at)} · {n.profiles?.name || 'Admin'}</div>
                      <button onClick={async () => {
                        if (!confirm('Delete this news article?')) return
                        await (sb.from('news_posts') as any).delete().eq('id', n.id)
                        setNewsList(prev => prev.filter(x => x.id !== n.id))
                        showToast('Deleted', 'ok')
                      }} className="text-[11px] font-semibold text-loss bg-loss-bg px-2.5 py-1 rounded-lg hover:bg-loss hover:text-white transition-all">🗑 Delete</button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* COURSES */}
          {section === 'courses' && (
            <div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
                <div className="bg-surface border border-border rounded-xl p-5">
                  <div className="font-display text-[15px] font-extrabold mb-4">🎓 Create New Course</div>
                  <div className="flex flex-col gap-3">
                    <input value={coTitle} onChange={e => setCoTitle(e.target.value)} placeholder="Introduction to NGX Investing"
                      className="w-full bg-gray-50 border-[1.5px] border-border text-text px-3 py-2.5 rounded-xl text-[13px] outline-none focus:border-primary" />
                    <textarea value={coDesc} onChange={e => setCoDesc(e.target.value)} rows={2} placeholder="What will students learn?"
                      className="w-full bg-gray-50 border-[1.5px] border-border text-text px-3 py-2.5 rounded-xl text-[13px] outline-none focus:border-primary resize-none" />
                    <div className="grid grid-cols-2 gap-3">
                      <select value={coCat} onChange={e => setCoCat(e.target.value)} className="bg-gray-50 border-[1.5px] border-border text-text px-3 py-2.5 rounded-xl text-[13px] outline-none">
                        {['Investing', 'Stock Market', 'Personal Finance', 'Crypto'].map(o => <option key={o}>{o}</option>)}
                      </select>
                      <select value={coDiff} onChange={e => setCoDiff(e.target.value)} className="bg-gray-50 border-[1.5px] border-border text-text px-3 py-2.5 rounded-xl text-[13px] outline-none">
                        {['Beginner', 'Intermediate', 'Advanced'].map(o => <option key={o}>{o}</option>)}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <input value={coDur} onChange={e => setCoDur(e.target.value)} type="number" placeholder="Duration (mins)"
                        className="bg-gray-50 border-[1.5px] border-border text-text px-3 py-2.5 rounded-xl text-[13px] outline-none focus:border-primary" />
                      <input value={coPts} onChange={e => setCoPts(e.target.value)} type="number" placeholder="Points reward"
                        className="bg-gray-50 border-[1.5px] border-border text-text px-3 py-2.5 rounded-xl text-[13px] outline-none focus:border-primary" />
                    </div>
                    <button onClick={createCourse} className="w-full bg-primary text-white font-bold py-2.5 rounded-xl text-[13px] hover:bg-primary-dark">Create Course</button>
                  </div>
                </div>
                <div className="bg-surface border border-border rounded-xl overflow-hidden">
                  <div className="px-4 py-3.5 border-b border-border"><div className="font-display text-[14px] font-extrabold">All Courses</div></div>
                  <div className="p-4 max-h-[400px] overflow-y-auto">
                    {coursesList.length === 0 ? <div className="text-center py-6 text-text-muted text-[13px]">No courses yet.</div>
                      : coursesList.map(c => (
                        <div key={c.id} className="pb-3 mb-3 border-b border-border last:border-0">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="text-[13px] font-bold">{c.title}</div>
                              <div className="text-[10px] text-text-muted">{c.category} · {c.difficulty} · {c.points_reward} pts · {c.lesson_count} lessons</div>
                              <span className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full inline-block mt-1', c.is_published ? 'bg-gain-bg text-gain' : 'bg-amber-bg text-amber')}>
                                {c.is_published ? '● Published' : '○ Draft'}
                              </span>
                            </div>
                            <div className="flex gap-1.5 flex-shrink-0">
                              <button onClick={() => { setActiveCourseId(c.id); setActiveCourseName(c.title) }} className="text-[11px] font-semibold bg-primary-light text-primary px-2 py-1 rounded-lg">+ Lesson</button>
                              <button onClick={() => togglePublish(c.id, c.is_published)} className={cn('text-[11px] font-semibold px-2 py-1 rounded-lg', c.is_published ? 'bg-amber-bg text-amber' : 'bg-gain-bg text-gain')}>
                                {c.is_published ? 'Unpublish' : 'Publish'}
                              </button>
                              <button onClick={() => deleteCourse(c.id)} className="text-[11px] font-semibold bg-loss-bg text-loss px-2 py-1 rounded-lg">🗑</button>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              </div>

              {/* Add lesson panel */}
              {activeCourseId && (
                <div className="bg-surface border border-border rounded-xl p-5">
                  <div className="font-display text-[15px] font-extrabold mb-1">Add Lesson to: <span className="text-primary">{activeCourseName}</span></div>
                  <div className="text-[11px] text-text-muted mb-4">Add video, text content, and a quiz question.</div>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <input value={lsTitle} onChange={e => setLsTitle(e.target.value)} placeholder="Lesson Title *"
                      className="bg-gray-50 border-[1.5px] border-border text-text px-3 py-2.5 rounded-xl text-[13px] outline-none focus:border-primary" />
                    <select value={lsType} onChange={e => setLsType(e.target.value)} className="bg-gray-50 border-[1.5px] border-border text-text px-3 py-2.5 rounded-xl text-[13px] outline-none">
                      <option value="text">Text / Article</option>
                      <option value="video">Video</option>
                      <option value="audio">Audio</option>
                    </select>
                  </div>
                  <input value={lsVideo} onChange={e => setLsVideo(e.target.value)} placeholder="Video URL (YouTube or direct link)"
                    className="w-full bg-gray-50 border-[1.5px] border-border text-text px-3 py-2.5 rounded-xl text-[13px] outline-none focus:border-primary mb-3" />
                  <textarea value={lsContent} onChange={e => setLsContent(e.target.value)} rows={4} placeholder="Lesson content *"
                    className="w-full bg-gray-50 border-[1.5px] border-border text-text px-3 py-2.5 rounded-xl text-[13px] outline-none focus:border-primary resize-none mb-3" />
                  <div className="bg-gray-50 rounded-xl p-4 mb-3">
                    <div className="text-[11px] font-bold text-text-secondary mb-3">Quiz Question (optional)</div>
                    <input value={asQ} onChange={e => setAsQ(e.target.value)} placeholder="Question"
                      className="w-full bg-white border-[1.5px] border-border text-text px-3 py-2 rounded-xl text-[13px] outline-none focus:border-primary mb-2" />
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      {['A', 'B', 'C', 'D'].map((l, i) => (
                        <input key={l} value={asOpts[i]} onChange={e => { const n = [...asOpts]; n[i] = e.target.value; setAsOpts(n) }}
                          placeholder={`Option ${l}`}
                          className="bg-white border-[1.5px] border-border text-text px-3 py-2 rounded-xl text-[13px] outline-none focus:border-primary" />
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <select value={asCorrect} onChange={e => setAsCorrect(parseInt(e.target.value))} className="bg-white border-[1.5px] border-border text-text px-3 py-2 rounded-xl text-[13px] outline-none">
                        {['A', 'B', 'C', 'D'].map((l, i) => <option key={l} value={i}>Correct: {l}</option>)}
                      </select>
                      <input value={asExp} onChange={e => setAsExp(e.target.value)} placeholder="Explanation"
                        className="bg-white border-[1.5px] border-border text-text px-3 py-2 rounded-xl text-[13px] outline-none focus:border-primary" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setActiveCourseId(null)} className="px-4 py-2 bg-gray-100 text-text-secondary rounded-xl text-[13px] font-semibold">Cancel</button>
                    <button onClick={addLesson} className="px-5 py-2 bg-primary text-white rounded-xl text-[13px] font-bold hover:bg-primary-dark">Add Lesson</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* MARKET */}
          {section === 'market' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="text-[13px] text-text-muted">{market.length} stocks</div>
                <button onClick={async () => {
                  showToast('Triggering refresh...', '')
                  try { await (sb.rpc as any)('fetch_all_ngx_prices'); showToast('Refreshed!', 'ok') } catch { showToast('pg_cron will refresh shortly', '') }
                  loadMarket()
                }} className="bg-primary text-white text-[12px] font-bold px-4 py-2 rounded-lg hover:bg-primary-dark">↻ Refresh Now</button>
              </div>
              <div className="bg-surface border border-border rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 border-b border-border">
                      {['Ticker', 'Company', 'Price', 'Change', 'Volume', 'Updated'].map(h => (
                        <th key={h} className="text-left px-3.5 py-2.5 text-[10px] font-bold text-text-muted uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {market.map(s => {
                      const up = (s.change_pct ?? 0) >= 0
                      return (
                        <tr key={s.ticker} className="border-b border-border last:border-0 hover:bg-gray-50">
                          <td className="px-3.5 py-2.5 text-[12px] font-extrabold font-mono text-primary">{s.ticker}</td>
                          <td className="px-3.5 py-2.5 text-[12px] text-text-secondary">{s.company_name || '—'}</td>
                          <td className="px-3.5 py-2.5 text-[12px] font-bold">₦{(s.price ?? 0).toFixed(2)}</td>
                          <td className="px-3.5 py-2.5">
                            <span className={cn('text-[11px] font-bold', up ? 'text-gain' : 'text-loss')}>
                              {up ? '▲ +' : '▼ '}{Math.abs(s.change_pct ?? 0).toFixed(2)}%
                            </span>
                          </td>
                          <td className="px-3.5 py-2.5 text-[11px] text-text-muted">{s.volume ? s.volume.toLocaleString() : '—'}</td>
                          <td className="px-3.5 py-2.5 text-[11px] text-text-muted">{fmtTime(s.last_updated)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SETTINGS */}
          {section === 'settings' && (
            <div className="bg-surface border border-border rounded-xl p-5 max-w-[480px]">
              <div className="font-display text-[15px] font-extrabold mb-4">⚙ Admin Settings</div>
              <div>
                <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wide mb-1.5">Promote User to Admin</label>
                <input id="promote-email" placeholder="user@email.com" className="w-full bg-gray-50 border-[1.5px] border-border text-text px-3 py-2.5 rounded-xl text-[13px] outline-none focus:border-primary mb-2" />
                <div className="bg-amber-bg rounded-xl p-3 text-[12px] text-amber mb-3">
                  Or run in Supabase SQL: <code className="font-mono">UPDATE public.profiles SET role = &apos;admin&apos; WHERE id = (SELECT id FROM auth.users WHERE email = &apos;email&apos;);</code>
                </div>
                <button onClick={() => {
                  const email = (document.getElementById('promote-email') as HTMLInputElement).value.trim()
                  if (!email) { showToast('Enter an email', 'err'); return }
                  showToast(`Run SQL to promote ${email}`, '')
                }} className="bg-primary text-white font-bold px-5 py-2.5 rounded-xl text-[13px] hover:bg-primary-dark">Promote to Admin</button>
              </div>
            </div>
          )}

          {/* LOGS */}
          {section === 'logs' && (
            <div className="bg-surface border border-border rounded-xl overflow-hidden">
              <div className="px-4 py-3.5 border-b border-border"><div className="font-display text-[14px] font-extrabold">Recent Activity</div></div>
              <div className="p-4">
                {logs.map(l => (
                  <div key={l.id} className="flex items-center gap-3 py-2.5 border-b border-border last:border-0 text-[12px]">
                    <span className="text-[15px]">📋</span>
                    <div className="flex-1"><strong>{(l as typeof l & { profiles?: { name?: string | null } }).profiles?.name || 'User'}</strong> posted: {l.body.substring(0, 60)}{l.body.length > 60 ? '...' : ''}</div>
                    <div className="text-text-muted whitespace-nowrap">{fmtTime(l.created_at)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* VIEW USER MODAL */}
      {viewUser && (
        <div className="fixed inset-0 bg-black/40 z-[500] flex items-center justify-center backdrop-blur-sm p-4" onClick={e => { if (e.target === e.currentTarget) setViewUser(null) }}>
          <div className="bg-white rounded-2xl p-6 w-full max-w-[500px] shadow-xl">
            <div className="font-display text-[16px] font-extrabold mb-4">User Details</div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {[
                { label: 'Name', value: viewUser.name || '—' },
                { label: 'Username', value: '@' + (viewUser.username || '—') },
                { label: 'Posts', value: viewUserStats.posts.toString() },
                { label: 'Holdings', value: viewUserStats.holdings.toString() },
                { label: 'Followers', value: viewUserStats.followers.toString() },
                { label: 'Status', value: viewUser.is_suspended ? '🚫 Suspended' : viewUser.is_verified ? '✓ Verified' : '○ Unverified' },
              ].map(item => (
                <div key={item.label} className="bg-gray-50 rounded-xl p-3">
                  <div className="text-[9px] font-bold text-text-muted uppercase tracking-wide mb-1">{item.label}</div>
                  <div className="text-[14px] font-bold">{item.value}</div>
                </div>
              ))}
            </div>
            <div className="text-[12px] text-text-muted mb-1">Phone: {viewUser.phone || 'Not set'}</div>
            <div className="text-[11px] text-text-muted font-mono mb-4 truncate">ID: {viewUser.id}</div>
            <div className="flex gap-2 flex-wrap pt-3 border-t border-border">
              {!viewUser.is_suspended
                ? <button onClick={() => { setViewUser(null); setSuspendTarget(viewUser.id); setSuspendReason('') }} className="px-3 py-2 bg-amber-bg text-amber border border-amber/30 rounded-xl text-[12px] font-semibold">🚫 Suspend</button>
                : <button onClick={() => { doUnsuspend(viewUser.id); setViewUser(null) }} className="px-3 py-2 bg-gain-bg text-gain rounded-xl text-[12px] font-semibold">✓ Unsuspend</button>}
              <button onClick={() => doMakeAdmin(viewUser.id)} className="px-3 py-2 bg-gray-100 text-text-secondary rounded-xl text-[12px] font-semibold hover:bg-gray-200">🛡 Make Admin</button>
              <button onClick={() => { setViewUser(null); setDeleteTarget({ id: viewUser.id, name: viewUser.name || 'User' }); setDeleteConfirm('') }} className="px-3 py-2 bg-loss-bg text-loss rounded-xl text-[12px] font-semibold hover:bg-loss hover:text-white transition-all">🗑 Delete</button>
              <button onClick={() => setViewUser(null)} className="ml-auto px-3 py-2 bg-gray-100 text-text-secondary rounded-xl text-[12px] font-semibold">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* SUSPEND MODAL */}
      {suspendTarget && (
        <div className="fixed inset-0 bg-black/40 z-[500] flex items-center justify-center backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-[440px] shadow-xl">
            <div className="font-display text-[16px] font-extrabold text-amber mb-3">🚫 Suspend User</div>
            <div className="bg-amber-bg rounded-xl p-3 text-[13px] text-amber mb-4">This user will lose access to Gopexly.</div>
            <div className="mb-4">
              <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wide mb-1.5">Reason</label>
              <input value={suspendReason} onChange={e => setSuspendReason(e.target.value)} placeholder="Violation of community guidelines..."
                className="w-full bg-gray-50 border-[1.5px] border-border text-text px-3 py-2.5 rounded-xl text-[13px] outline-none focus:border-primary" />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setSuspendTarget(null)} className="px-4 py-2 bg-gray-100 text-text-secondary rounded-xl text-[13px] font-semibold">Cancel</button>
              <button onClick={doSuspend} className="px-5 py-2 bg-amber text-white rounded-xl text-[13px] font-bold">Confirm Suspend</button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE MODAL */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/40 z-[500] flex items-center justify-center backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-[440px] shadow-xl">
            <div className="font-display text-[16px] font-extrabold text-loss mb-3">🗑 Delete User Account</div>
            <div className="bg-loss-bg rounded-xl p-3 text-[13px] text-loss mb-3 leading-relaxed">
              <strong>{deleteTarget.name}</strong> and ALL their data will be permanently deleted. They can re-register with the same email.
            </div>
            <div className="mb-4">
              <label className="block text-[11px] font-bold text-text-muted uppercase tracking-wide mb-1.5">Type DELETE to confirm</label>
              <input value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)} placeholder="DELETE"
                className="w-full bg-gray-50 border-[1.5px] border-border text-text px-3 py-2.5 rounded-xl text-[13px] outline-none focus:border-primary" />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setDeleteTarget(null)} className="px-4 py-2 bg-gray-100 text-text-secondary rounded-xl text-[13px] font-semibold">Cancel</button>
              <button onClick={doDeleteUser} disabled={deleteLoading} className="px-5 py-2 bg-loss text-white rounded-xl text-[13px] font-bold disabled:opacity-50">
                {deleteLoading ? 'Deleting...' : '🗑 Permanently Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast {...toast} />
    </div>
  )
}