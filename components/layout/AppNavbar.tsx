'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/hooks/useAuth'
import { useProStatus } from '@/lib/hooks/useProStatus'
import { createClient } from '@/lib/supabase/client'

const MENU_GROUPS = [
  {
    group: 'Investing',
    items: [
      { href: '/market',    label: 'Market',         icon: '📈', desc: 'Live NGX prices' },
      { href: '/portfolio', label: 'Portfolio',       icon: '💼', desc: 'Holdings & P&L' },
      { href: '/watchlist', label: 'Watchlist',       icon: '👁', desc: 'Stocks you follow' },
      { href: '/alerts',    label: 'Price Alerts',    icon: '🔔', desc: 'Get notified' },
      { href: '/screener',  label: 'Stock Screener',  icon: '📊', desc: 'Filter NGX stocks', pro: true },
    ],
  },
  {
    group: 'Community',
    items: [
      { href: '/home',        label: 'Social Feed',      icon: '🏠', desc: 'Posts & insights' },
      { href: '/leaderboard', label: 'Leaderboard',      icon: '🏆', desc: 'Top investors' },
      { href: '/clubs',       label: 'Investment Clubs', icon: '🏘', desc: 'Invest together' },
      { href: '/messaging',   label: 'Messages',         icon: '💬', desc: 'Direct messages', pro: true },
      { href: '/search',      label: 'Search',           icon: '🔍', desc: 'Find investors & stocks' },
    ],
  },
  {
    group: 'My Account',
    items: [
      { href: '/learn',         label: 'Learn & Earn',   icon: '📚', desc: 'Courses & points' },
      { href: '/bookmarks',     label: 'Saved Posts',    icon: '🔖', desc: 'Your bookmarks' },
      { href: '/notifications', label: 'Notifications',  icon: '🔔', desc: 'Activity & alerts' },
      { href: '/referral',      label: 'Refer & Earn',   icon: '🎁', desc: 'Earn Pro free' },
      { href: '/profile',       label: 'My Profile',     icon: '👤', desc: 'Settings & account' },
    ],
  },
  {
    group: 'Company',
    items: [
      { href: '/about',   label: 'About Gopexly', icon: '🌍', desc: 'Our story & mission' },
      { href: '/contact', label: 'Contact Us',    icon: '📧', desc: 'Get in touch' },
    ],
  },
]

const TOP_NAV = [
  { href: '/home',      label: 'Home' },
  { href: '/market',    label: 'Market' },
  { href: '/portfolio', label: 'Portfolio' },
  { href: '/learn',     label: 'Learn' },
]

export default function AppNavbar() {
  const pathname = usePathname()
  const sb = createClient()
  const { user } = useAuth()
  const { isPro } = useProStatus()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [openGroup, setOpenGroup] = useState<string | null>(null)
  const [openMobileGroup, setOpenMobileGroup] = useState<string | null>(null)
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    if (!user) return
    sb.from('notifications').select('id', { count: 'exact', head: true })
      .eq('user_id', user.id).eq('is_read', false)
      .then(({ count }) => setUnreadCount(count || 0))
    const ch = sb.channel('notif-badge')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        () => setUnreadCount(p => p + 1))
      .subscribe()
    return () => { sb.removeChannel(ch) }
  }, [user, sb])

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-[300] h-[60px] flex items-center bg-white/95 backdrop-blur-xl border-b border-border">
        <div className="flex items-center justify-between w-full max-w-[1280px] mx-auto px-5 gap-3">

          <Link href="/home" className="font-display text-[18px] font-extrabold flex items-center gap-1.5 text-text flex-shrink-0">
            <div className="w-7 h-7 bg-primary rounded-[7px] flex items-center justify-center text-white text-[13px] font-extrabold">G</div>
            <span className="hidden sm:block">Gopexly</span>
          </Link>

          <div className="hidden md:flex items-center gap-px flex-1 justify-center">
            {TOP_NAV.map(link => (
              <Link key={link.href} href={link.href}
                className={cn('px-3 py-1.5 rounded-[7px] text-[13px] font-medium transition-all whitespace-nowrap',
                  pathname === link.href ? 'bg-primary-light text-primary font-semibold' : 'text-gray-500 hover:bg-gray-100 hover:text-text')}>
                {link.label}
              </Link>
            ))}

            {MENU_GROUPS.map(group => (
              <div key={group.group} className="relative"
                onMouseEnter={() => setOpenGroup(group.group)}
                onMouseLeave={() => setOpenGroup(null)}>
                <button className={cn('px-3 py-1.5 rounded-[7px] text-[13px] font-medium transition-all flex items-center gap-1 whitespace-nowrap',
                  group.items.some(i => pathname === i.href)
                    ? 'bg-primary-light text-primary font-semibold'
                    : 'text-gray-500 hover:bg-gray-100 hover:text-text')}>
                  {group.group}
                  <span className="text-[9px] opacity-60">{openGroup === group.group ? '▲' : '▼'}</span>
                </button>

                {openGroup === group.group && (
                  <div className="absolute top-full left-0 mt-1 bg-white border border-border rounded-2xl shadow-xl z-50 min-w-[220px] py-2 overflow-hidden">
                    <div className="px-3 py-1 mb-1">
                      <div className="text-[10px] font-extrabold text-text-muted uppercase tracking-widest">{group.group}</div>
                    </div>
                    {group.items.map(item => (
                      <Link key={item.href} href={item.href} onClick={() => setOpenGroup(null)}
                        className={cn('flex items-center gap-3 px-3 py-2.5 mx-1 rounded-xl transition-all',
                          pathname === item.href ? 'bg-primary-light text-primary' : 'hover:bg-gray-50')}>
                        <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center text-[15px] flex-shrink-0',
                          pathname === item.href ? 'bg-primary text-white' : 'bg-gray-100')}>
                          {item.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[13px] font-semibold">{item.label}</span>
                            {item.pro && !isPro && (
                              <span className="text-[9px] bg-amber text-white px-1.5 py-0.5 rounded-full font-bold">PRO</span>
                            )}
                          </div>
                          <div className="text-[11px] text-text-muted">{item.desc}</div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            {isPro ? (
              <Link href="/pro" className="hidden sm:flex items-center gap-1 bg-gradient-to-r from-amber to-yellow-400 text-[#0f172a] font-extrabold text-[11px] px-2.5 py-1.5 rounded-full hover:shadow-md transition-all">
                👑 Pro
              </Link>
            ) : (
              <Link href="/pro" className="hidden sm:flex items-center gap-1 bg-gradient-to-r from-[#1e1b4b] to-primary text-white font-bold text-[11px] px-2.5 py-1.5 rounded-full hover:shadow-md transition-all whitespace-nowrap">
                👑 Upgrade
              </Link>
            )}

            <Link href="/notifications"
              className={cn('relative w-8 h-8 rounded-lg flex items-center justify-center text-[15px] transition-all',
                pathname === '/notifications' ? 'bg-primary-light text-primary' : 'bg-gray-50 border border-border hover:bg-primary-light')}>
              🔔
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-loss rounded-full flex items-center justify-center text-[9px] font-extrabold text-white border border-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Link>

            <Link href="/profile" className="flex items-center gap-1.5 bg-gray-50 border border-border rounded-[9px] py-[3px] pl-1 pr-2.5 hover:bg-gray-100 transition-all">
              <div className={cn('w-[26px] h-[26px] rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0',
                isPro ? 'bg-gradient-to-br from-amber to-yellow-400 text-[#0f172a]' : 'bg-primary text-white')}>
                {user?.initials ?? '?'}
              </div>
              <span className="text-[12px] font-semibold text-text hidden sm:block">{user?.firstName ?? 'Me'}</span>
            </Link>

            <button className="md:hidden text-[21px] text-gray-500" onClick={() => setMobileOpen(p => !p)}>
              {mobileOpen ? '✕' : '☰'}
            </button>
          </div>
        </div>
      </nav>

      {mobileOpen && (
        <div className="md:hidden fixed top-[60px] left-0 right-0 bg-white border-b border-border z-[299] shadow-xl max-h-[85vh] overflow-y-auto">

          {/* Pro banner */}
          <Link href="/pro" onClick={() => setMobileOpen(false)}
            className={cn('flex items-center gap-2.5 mx-3 mt-3 px-4 py-3 rounded-xl font-bold text-[14px]',
              isPro ? 'bg-amber/10 border border-amber/30 text-amber' : 'bg-gradient-to-r from-[#1e1b4b] to-primary text-white')}>
            <span>👑</span>
            {isPro ? 'Gopexly Pro — Active' : 'Upgrade to Pro'}
            {!isPro && <span className="ml-auto text-[11px] opacity-70">₦2,000/mo</span>}
          </Link>

          {/* Collapsible category dropdowns */}
          <div className="px-3 py-3 flex flex-col gap-1.5">
            {MENU_GROUPS.map(group => {
              const isGroupOpen = openMobileGroup === group.group
              const hasActive = group.items.some(i => pathname === i.href)
              return (
                <div key={group.group} className={cn('rounded-2xl border overflow-hidden', hasActive ? 'border-primary-border' : 'border-border')}>
                  <button
                    onClick={() => setOpenMobileGroup(isGroupOpen ? null : group.group)}
                    className={cn('w-full flex items-center justify-between px-4 py-3.5 text-left transition-colors',
                      hasActive ? 'bg-primary-light' : isGroupOpen ? 'bg-gray-50' : 'bg-white hover:bg-gray-50')}>
                    <div className="flex items-center gap-2">
                      <span className={cn('text-[14px] font-bold', hasActive ? 'text-primary' : 'text-text')}>{group.group}</span>
                      {hasActive && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
                    </div>
                    <span className={cn('text-[11px] transition-all duration-200', isGroupOpen ? 'rotate-180 inline-block' : '', hasActive ? 'text-primary' : 'text-text-muted')}>▼</span>
                  </button>
                  {isGroupOpen && (
                    <div className="border-t border-border bg-white px-2 py-2 flex flex-col gap-0.5">
                      {group.items.map(item => (
                        <Link key={item.href} href={item.href}
                          onClick={() => { setMobileOpen(false); setOpenMobileGroup(null) }}
                          className={cn('flex items-center gap-3 px-3 py-3 rounded-xl transition-colors',
                            pathname === item.href ? 'bg-primary-light text-primary' : 'text-text-secondary hover:bg-gray-50')}>
                          <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center text-[17px] flex-shrink-0',
                            pathname === item.href ? 'bg-primary text-white' : 'bg-gray-100')}>
                            {item.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-[14px] font-semibold">{item.label}</span>
                              {item.pro && !isPro && (
                                <span className="text-[9px] bg-amber text-white px-1.5 py-0.5 rounded-full font-bold">PRO</span>
                              )}
                            </div>
                            <div className="text-[12px] text-text-muted">{item.desc}</div>
                          </div>
                          {pathname === item.href && <span className="text-primary text-[13px]">✓</span>}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <div className="h-4" />
        </div>
      )}
    </>
  )
}