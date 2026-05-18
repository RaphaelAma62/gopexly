'use client'

import { cn } from '@/lib/utils'
import type { ToastType } from '@/types'

// ── BUTTON ────────────────────────────────────
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'gain' | 'amber'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  className?: string
  children?: React.ReactNode
  disabled?: boolean
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  const base = 'inline-flex items-center justify-center gap-1.5 font-semibold rounded-lg transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed'

  const variants = {
    primary: 'bg-primary text-white hover:bg-primary-dark shadow-sm hover:shadow-md',
    secondary: 'bg-gray-100 text-text-secondary hover:bg-gray-200',
    danger: 'bg-loss-bg text-loss hover:bg-loss hover:text-white',
    ghost: 'bg-transparent text-text-secondary hover:bg-gray-100',
    gain: 'bg-gain-bg text-gain',
    amber: 'bg-amber-bg text-amber',
  }

  const sizes = {
    sm: 'text-[11px] px-2.5 py-1.5',
    md: 'text-[12px] px-3 py-1.5',
    lg: 'text-[13px] px-5 py-2.5',
  }

  return (
    <button
      className={cn(base, variants[variant], sizes[size], className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Spinner size="sm" className="text-current" /> : null}
      {children}
    </button>
  )
}

// ── SPINNER ───────────────────────────────────
interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function Spinner({ size = 'md', className }: SpinnerProps) {
  const sizes = {
    sm: 'w-3.5 h-3.5 border-[1.5px]',
    md: 'w-[18px] h-[18px] border-2',
    lg: 'w-7 h-7 border-2',
  }
  return (
    <div
      className={cn(
        'rounded-full border-gray-200 border-t-current animate-spin-slow',
        sizes[size],
        className
      )}
    />
  )
}

// ── TOAST ─────────────────────────────────────
interface ToastProps {
  message: string
  type: ToastType
  visible: boolean
}

export function Toast({ message, type, visible }: ToastProps) {
  const colors = {
    ok: 'bg-gain',
    err: 'bg-loss',
    info: 'bg-primary',
    '': 'bg-gray-900',
  }

  return (
    <div
      className={cn(
        'fixed bottom-5 right-5 text-white px-[18px] py-[11px] rounded-[9px] text-[13px] font-semibold z-[9999] max-w-xs transition-all duration-300',
        colors[type],
        visible ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0 pointer-events-none'
      )}
    >
      {message}
    </div>
  )
}

// ── MODAL ─────────────────────────────────────
interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  maxWidth?: string
}

export function Modal({ open, onClose, title, children, maxWidth = 'max-w-[480px]' }: ModalProps) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 bg-black/40 z-[500] flex items-center justify-center backdrop-blur-[5px] animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className={cn(
          'bg-white rounded-2xl p-6 w-full mx-4 relative shadow-lg animate-fade-in',
          maxWidth
        )}
      >
        {title && (
          <div className="font-display text-[16px] font-extrabold mb-4">{title}</div>
        )}
        <button
          onClick={onClose}
          className="absolute top-3.5 right-3.5 bg-gray-100 border-none w-[26px] h-[26px] rounded-[7px] text-[12px] flex items-center justify-center hover:bg-gray-200"
        >
          ✕
        </button>
        {children}
      </div>
    </div>
  )
}

// ── AVATAR ────────────────────────────────────
interface AvatarProps {
  initials: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

export function Avatar({ initials, size = 'md', className }: AvatarProps) {
  const sizes = {
    sm: 'w-[26px] h-[26px] text-[10px]',
    md: 'w-[34px] h-[34px] text-[11px]',
    lg: 'w-[38px] h-[38px] text-[12px]',
    xl: 'w-14 h-14 text-[18px]',
  }
  return (
    <div
      className={cn(
        'rounded-full bg-primary text-white flex items-center justify-center font-bold flex-shrink-0',
        sizes[size],
        className
      )}
    >
      {initials}
    </div>
  )
}

// ── STATUS PILL ───────────────────────────────
interface PillProps {
  label: string
  variant: 'ok' | 'error' | 'warning' | 'info' | 'neutral'
}

export function Pill({ label, variant }: PillProps) {
  const variants = {
    ok:      'bg-gain-bg text-gain',
    error:   'bg-loss-bg text-loss',
    warning: 'bg-amber-bg text-amber',
    info:    'bg-primary-light text-primary',
    neutral: 'bg-gray-100 text-gray-500',
  }
  return (
    <span className={cn('inline-block text-[10px] font-bold px-2 py-0.5 rounded-[10px]', variants[variant])}>
      {label}
    </span>
  )
}

// ── CARD ──────────────────────────────────────
interface CardProps {
  children: React.ReactNode
  className?: string
  padding?: boolean
}

export function Card({ children, className, padding = false }: CardProps) {
  return (
    <div className={cn('bg-surface border border-border rounded-2xl shadow-sm', padding && 'p-4', className)}>
      {children}
    </div>
  )
}

export function CardHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 py-3.5 border-b border-border">
      <div className="font-display text-[14px] font-extrabold">{title}</div>
      {children}
    </div>
  )
}

// ── INPUT ─────────────────────────────────────
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  className?: string
}

export function Input({ label, error, className, ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-[11px] font-bold text-text-secondary uppercase tracking-[0.4px]">
          {label}
        </label>
      )}
      <input
        className={cn(
          'w-full bg-gray-50 border-[1.5px] border-border text-text px-3 py-[9px] rounded-[9px] text-[13px] outline-none transition-colors',
          'focus:border-primary focus:bg-white',
          error && 'border-loss',
          className
        )}
        {...props}
      />
      {error && <span className="text-[11px] text-loss">{error}</span>}
    </div>
  )
}

// ── EMPTY STATE ───────────────────────────────
export function EmptyState({ icon, title, subtitle }: { icon: string; title: string; subtitle?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-5 text-text-muted">
      <div className="text-4xl mb-3">{icon}</div>
      <div className="text-[14px] font-semibold text-text-secondary mb-1">{title}</div>
      {subtitle && <div className="text-[12px]">{subtitle}</div>}
    </div>
  )
}
