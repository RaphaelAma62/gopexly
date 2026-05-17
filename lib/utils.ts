import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

// Tailwind class merging helper
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Format naira values
export function fmtNaira(value: number): string {
  if (value >= 1_000_000_000) return `₦${(value / 1_000_000_000).toFixed(2)}B`
  if (value >= 1_000_000)     return `₦${(value / 1_000_000).toFixed(2)}M`
  if (value >= 1_000)         return `₦${(value / 1_000).toFixed(0)}K`
  return `₦${value.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// Format relative time
export function fmtTime(timestamp: string | null): string {
  if (!timestamp) return '—'
  const mins = Math.max(0, Math.floor((Date.now() - new Date(timestamp).getTime()) / 60_000))
  if (mins < 1)    return 'Just now'
  if (mins < 60)   return `${mins}m ago`
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`
  return `${Math.floor(mins / 1440)}d ago`
}

// Format full date
export function fmtDate(timestamp: string | null): string {
  if (!timestamp) return '—'
  return new Date(timestamp).toLocaleDateString('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

// Format stock volume
export function fmtVolume(vol: number | null): string {
  if (!vol) return '—'
  if (vol >= 1_000_000_000) return `${(vol / 1_000_000_000).toFixed(2)}B`
  if (vol >= 1_000_000)     return `${(vol / 1_000_000).toFixed(1)}M`
  if (vol >= 1_000)         return `${(vol / 1_000).toFixed(0)}K`
  return vol.toString()
}

// Get user initials from name
export function getInitials(name: string | null): string {
  if (!name) return '?'
  const parts = name.trim().split(' ')
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.charAt(0).toUpperCase()
}

// Time of day greeting
export function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning 👋'
  if (hour < 17) return 'Good afternoon 👋'
  return 'Good evening 👋'
}

// Build share URL for a post
export function buildShareUrl(postId: string): string {
  if (typeof window === 'undefined') return ''
  return `${window.location.origin}/home?post=${postId}`
}

// Truncate text
export function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + '...' : text
}

// Validate username
export function validateUsername(username: string): string | null {
  if (username.length < 3) return 'At least 3 characters required'
  if (username.length > 20) return 'Maximum 20 characters'
  if (!/^[a-z0-9_]+$/.test(username)) return 'Only letters, numbers, and underscores'
  return null
}

// Debounce
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timer: NodeJS.Timeout
  return (...args: Parameters<T>) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }
}
