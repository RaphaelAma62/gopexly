'use client'

import { cn } from '@/lib/utils'
import Link from 'next/link'

interface ProGateProps {
  feature: string
  description: string
  icon: string
  freeLimit?: string
  proLimit?: string
  className?: string
  compact?: boolean
}

export default function ProGate({ feature, description, icon, freeLimit, proLimit, className, compact = false }: ProGateProps) {
  if (compact) {
    return (
      <div className={cn('bg-gradient-to-r from-[#1e1b4b]/5 to-primary/5 border-2 border-primary-border rounded-2xl p-4 flex items-center gap-4', className)}>
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-[#7c3aed] flex items-center justify-center text-xl flex-shrink-0 shadow-sm">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-[14px] flex items-center gap-2">
            👑 {feature} is a Pro feature
          </div>
          <div className="text-[12px] text-text-muted truncate">{description}</div>
        </div>
        <Link href="/pro"
          className="bg-gradient-to-r from-amber to-yellow-400 text-[#0f172a] font-bold text-[12px] px-4 py-2 rounded-xl hover:shadow-md transition-all flex-shrink-0 whitespace-nowrap">
          Upgrade →
        </Link>
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col items-center justify-center py-16 px-6 text-center', className)}>
      {/* Blurred background decoration */}
      <div className="relative mb-8">
        <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-primary to-[#7c3aed] flex items-center justify-center text-[48px] shadow-xl">
          {icon}
        </div>
        <div className="absolute -top-2 -right-2 w-8 h-8 bg-gradient-to-br from-amber to-yellow-400 rounded-full flex items-center justify-center text-[16px] shadow-md">
          👑
        </div>
      </div>

      <h2 className="font-display text-[24px] font-extrabold mb-2">{feature}</h2>
      <p className="text-text-muted text-[15px] max-w-sm mb-6 leading-relaxed">{description}</p>

      {/* Free vs Pro comparison */}
      {(freeLimit || proLimit) && (
        <div className="grid grid-cols-2 gap-3 w-full max-w-[320px] mb-8">
          <div className="bg-gray-50 border border-border rounded-2xl p-4 text-center">
            <div className="text-[11px] font-bold text-text-muted uppercase tracking-wide mb-2">Free</div>
            <div className="font-display text-[18px] font-extrabold text-text-secondary">{freeLimit}</div>
          </div>
          <div className="bg-gradient-to-br from-amber/20 to-yellow-50 border-2 border-amber/40 rounded-2xl p-4 text-center">
            <div className="text-[11px] font-bold text-amber uppercase tracking-wide mb-2">👑 Pro</div>
            <div className="font-display text-[18px] font-extrabold text-primary">{proLimit}</div>
          </div>
        </div>
      )}

      <Link href="/pro"
        className="bg-gradient-to-r from-amber via-yellow-400 to-amber text-[#0f172a] font-extrabold text-[16px] px-10 py-4 rounded-2xl hover:shadow-xl hover:-translate-y-0.5 transition-all shadow-lg inline-flex items-center gap-2">
        👑 Upgrade to Pro
      </Link>
      <p className="text-text-muted text-[12px] mt-3">Starting at ₦2,000/month · Cancel anytime</p>
    </div>
  )
}
