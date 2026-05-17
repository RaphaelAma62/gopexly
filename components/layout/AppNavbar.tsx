'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/hooks/useAuth'

const NAV_LINKS = [
  { href: '/home',      label: 'Home' },
  { href: '/market',    label: 'Market' },
  { href: '/portfolio', label: 'Portfolio' },
  { href: '/learn',     label: 'Learn' },
]

export default function AppNavbar() {
  const pathname = usePathname()
  const { user } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-[300] h-[60px] flex items-center bg-white/95 backdrop-blur-xl border-b border-border">
        <div className="flex items-center justify-between w-full max-w-[1280px] mx-auto px-5 gap-2.5">
          {/* Logo */}
          <Link href="/home" className="font-display text-[18px] font-extrabold flex items-center gap-1.5 text-text">
            <div className="w-7 h-7 bg-primary rounded-[7px] flex items-center justify-center text-white text-[13px] font-extrabold">
              G
            </div>
            Gopexly
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex gap-px">
            {NAV_LINKS.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'px-[11px] py-1.5 rounded-[7px] text-[13px] font-medium transition-all duration-150',
                  pathname === link.href
                    ? 'bg-primary-light text-primary font-semibold'
                    : 'text-gray-500 hover:bg-gray-100 hover:text-text'
                )}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-1.5">
            {/* Notification bell */}
            <div className="w-8 h-8 rounded-lg bg-gray-50 border border-border flex items-center justify-center text-sm cursor-pointer relative">
              🔔
            </div>

            {/* Profile pill */}
            <Link
              href="/profile"
              className="flex items-center gap-1.5 bg-gray-50 border border-border rounded-[9px] py-[3px] pl-1 pr-2.5 hover:bg-gray-100 transition-all"
            >
              <div className="w-[26px] h-[26px] rounded-full bg-primary text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                {user?.initials ?? '?'}
              </div>
              <span className="text-[12px] font-semibold text-text hidden sm:block">
                {user?.firstName ?? 'Account'}
              </span>
            </Link>

            {/* Mobile burger */}
            <button
              className="md:hidden bg-none border-none text-[21px] text-gray-500 cursor-pointer"
              onClick={() => setMobileOpen(prev => !prev)}
            >
              ☰
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile nav */}
      {mobileOpen && (
        <div className="md:hidden fixed top-[60px] left-0 right-0 bg-white border-b border-border px-3.5 py-2 pb-3 flex flex-col gap-px z-[299] shadow-md">
          {NAV_LINKS.map(link => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                'px-3 py-2.5 rounded-lg text-[14px] font-medium',
                pathname === link.href
                  ? 'text-primary bg-primary-light'
                  : 'text-text-secondary'
              )}
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/profile"
            onClick={() => setMobileOpen(false)}
            className="px-3 py-2.5 rounded-lg text-[14px] font-medium text-text-secondary"
          >
            My Account
          </Link>
        </div>
      )}
    </>
  )
}
