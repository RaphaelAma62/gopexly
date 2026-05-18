'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/hooks/useAuth'
import { useProStatus } from '@/lib/hooks/useProStatus'
import { createClient } from '@/lib/supabase/client'

const NAV_LINKS = [
  { href: '/home',        label: 'Home',      icon: '🏠' },
  { href: '/market',      label: 'Market',    icon: '📈' },
  { href: '/portfolio',   label: 'Portfolio', icon: '💼' },
  { href: '/learn',       label: 'Learn',     icon: '📚' },
  { href: '/leaderboard', label: 'Rankings',  icon: '🏆' },
]

const MORE_LINKS = [
  { href: '/watchlist',   label: 'Watchlist',          icon: '👁' },
  { href: '/alerts',      label: 'Price Alerts',       icon: '🔔' },
  { href: '/bookmarks',   label: 'Saved Posts',        icon: '🔖' },
  { href: '/screener',    label: 'Stock Screener',     icon: '📊', pro: true },
  { href: '/clubs',       label: 'Investment Clubs',   icon: '🏠' },
  { href: '/messaging',   label: 'Messages',           icon: '💬', pro: true },
  { href: '/referral',    label: 'Refer & Earn',       icon: '🎁' },
  { href: '/search',      label: 'Search',             icon: '🔍' },
]

export default function AppNavbar() {
  const pathname = usePathname()
  const sb = createClient()
  const { user } = useAuth()
  const { isPro } = useProStatus()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const isMoreActive = MORE_LINKS.some(l => pathname === l.href)

  // Load unread notification count
  useEffect(() => {
    if (!user) return
    sb.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('is_read', false)
      .then(({ count }) => setUnreadCount(count || 0))

    // Realtime unread badge
    const ch = sb.channel('notif-count')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        () => setUnreadCount(p => p + 1))
      .subscribe()
    return () => { sb.removeChannel(ch) }
  }, [user, sb])

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-[300] h-[60px] flex items-center bg-white/95 backdrop-blur-xl border-b border-border">
        <div className="flex items-center justify-between w-full max-w-[1280px] mx-auto px-5 gap-2.5">

          {/* Logo */}
          <Link href="/home" className="font-display text-[18px] font-extrabold flex items-center gap-1.5 text-text">
            <div className="w-7 h-7 bg-primary rounded-[7px] flex items-center justify-center text-white text-[13px] font-extrabold">G</div>
            <span className="hidden sm:block">Gopexly</span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex gap-px items-center">
            {NAV_LINKS.map(link => (
              <Link key={link.href} href={link.href}
                className={cn('px-[11px] py-1.5 rounded-[7px] text-[13px] font-medium transition-all',
                  pathname === link.href ? 'bg-primary-light text-primary font-semibold' : 'text-gray-500 hover:bg-gray-100 hover:text-text')}>
                {link.label}
              </Link>
            ))}

            {/* More dropdown */}
            <div className="relative">
              <button onClick={() => setMoreOpen(p => !p)}
                className={cn('px-[11px] py-1.5 rounded-[7px] text-[13px] font-medium transition-all flex items-center gap-1',
                  isMoreActive ? 'bg-primary-light text-primary font-semibold' : 'text-gray-500 hover:bg-gray-100 hover:text-text')}>
                More {moreOpen ? '▲' : '▼'}
              </button>
              {moreOpen && (
                <div className="absolute top-full right-0 mt-1 bg-white border border-border rounded-2xl shadow-xl z-50 min-w-[200px] py-1.5 overflow-hidden"
                  onMouseLeave={() => setMoreOpen(false)}>
                  {MORE_LINKS.map(link => (
                    <Link key={link.href} href={link.href} onClick={() => setMoreOpen(false)}
                      className={cn('flex items-center justify-between gap-2.5 px-4 py-2.5 text-[13px] font-medium transition-colors',
                        pathname === link.href ? 'text-primary bg-primary-light' : 'text-text-secondary hover:bg-gray-50')}>
                      <div className="flex items-center gap-2.5">
                        <span>{link.icon}</span>{link.label}
                      </div>
                      {link.pro && !isPro && (
                        <span className="text-[9px] bg-amber text-white px-1.5 py-0.5 rounded-full font-bold">PRO</span>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-1.5">

            {/* Pro badge / upgrade button */}
            {isPro ? (
              <Link href="/pro" className="hidden sm:flex items-center gap-1.5 bg-gradient-to-r from-amber to-yellow-400 text-[#0f172a] font-extrabold text-[11px] px-3 py-1.5 rounded-full hover:shadow-md transition-all">
                👑 Pro
              </Link>
            ) : (
              <Link href="/pro" className="hidden sm:flex items-center gap-1.5 bg-gradient-to-r from-[#1e1b4b] to-primary text-white font-bold text-[11px] px-3 py-1.5 rounded-full hover:shadow-md hover:-translate-y-px transition-all whitespace-nowrap">
                👑 Upgrade
              </Link>
            )}

            {/* Notifications bell with badge */}
            <Link href="/notifications" className={cn('relative w-8 h-8 rounded-lg flex items-center justify-center text-[16px] transition-all',
              pathname === '/notifications' ? 'bg-primary-light text-primary' : 'bg-gray-50 border border-border hover:bg-primary-light')}>
              🔔
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-loss rounded-full flex items-center justify-center text-[9px] font-extrabold text-white border border-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Link>

            {/* Search */}
            <Link href="/search" className={cn('w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-all',
              pathname === '/search' ? 'bg-primary-light text-primary' : 'bg-gray-50 border border-border hover:bg-primary-light')}>
              🔍
            </Link>

            {/* Profile */}
            <Link href="/profile" className="flex items-center gap-1.5 bg-gray-50 border border-border rounded-[9px] py-[3px] pl-1 pr-2.5 hover:bg-gray-100 transition-all">
              <div className={cn('w-[26px] h-[26px] rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0',
                isPro ? 'bg-gradient-to-br from-amber to-yellow-400 text-[#0f172a]' : 'bg-primary text-white')}>
                {user?.initials ?? '?'}
              </div>
              <span className="text-[12px] font-semibold text-text hidden sm:block">{user?.firstName ?? 'Account'}</span>
            </Link>

            {/* Mobile burger */}
            <button className="md:hidden text-[21px] text-gray-500" onClick={() => setMobileOpen(p => !p)}>☰</button>
          </div>
        </div>
      </nav>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden fixed top-[60px] left-0 right-0 bg-white border-b border-border px-3.5 py-2 pb-4 flex flex-col gap-px z-[299] shadow-md max-h-[85vh] overflow-y-auto">

          {/* Pro banner */}
          <Link href="/pro" onClick={() => setMobileOpen(false)}
            className={cn('flex items-center gap-2.5 px-3 py-3 rounded-xl mb-1 font-bold text-[14px]',
              isPro ? 'bg-gradient-to-r from-amber/20 to-yellow-50 border border-amber/40 text-amber' : 'bg-gradient-to-r from-[#1e1b4b] to-primary text-white')}>
            <span>👑</span>
            {isPro ? 'Gopexly Pro — Active' : 'Upgrade to Pro'}
            {!isPro && <span className="ml-auto text-[11px] opacity-70">₦2,000/mo</span>}
          </Link>

          {[...NAV_LINKS, ...MORE_LINKS,
            { href: '/notifications', label: 'Notifications', icon: '🔔' },
            { href: '/referral', label: 'Refer & Earn', icon: '🎁' },
            { href: '/profile', label: 'My Account', icon: '👤' }
          ].map(link => (
            <Link key={link.href} href={link.href} onClick={() => setMobileOpen(false)}
              className={cn('flex items-center justify-between px-3 py-2.5 rounded-lg text-[14px] font-medium',
                pathname === link.href ? 'text-primary bg-primary-light' : 'text-text-secondary')}>
              <div className="flex items-center gap-2.5">
                <span>{link.icon}</span>{link.label}
              </div>
              {'pro' in link && link.pro && !isPro && (
                <span className="text-[9px] bg-amber text-white px-1.5 py-0.5 rounded-full font-bold">PRO</span>
              )}
            </Link>
          ))}
        </div>
      )}
    </>
  )
}
