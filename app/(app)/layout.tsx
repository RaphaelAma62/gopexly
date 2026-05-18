import type { Metadata } from 'next'
import AppNavbar from '@/components/layout/AppNavbar'
import GopexAI from '@/components/ai/GopexAI'

export const metadata: Metadata = {
  title: { template: '%s | Gopexly', default: 'Gopexly' },
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AppNavbar />
      <main className="pt-[60px] flex-1">
        {children}
      </main>
      <footer className="border-t border-border bg-white py-6 px-5 mt-10">
        <div className="max-w-[1280px] mx-auto flex items-center justify-between flex-wrap gap-4">
          <div className="font-display text-[14px] font-bold text-text flex items-center gap-2">
            <div className="w-6 h-6 bg-primary rounded-[6px] flex items-center justify-center text-white text-[11px] font-extrabold">G</div>
            Gopexly
          </div>
          <div className="text-[11px] text-text-muted">&copy; 2026 Gopexly Technologies Ltd &middot; Nigeria &middot; Not investment advice</div>
          <div className="flex gap-5 text-[12px] text-text-muted flex-wrap">
            <a href="/about" className="hover:text-primary transition-colors">About</a>
            <a href="/contact" className="hover:text-primary transition-colors">Contact</a>
            <a href="/privacy-policy.html" className="hover:text-primary transition-colors">Privacy</a>
            <a href="/terms-of-service.html" className="hover:text-primary transition-colors">Terms</a>
          </div>
        </div>
      </footer>
      <GopexAI />
    </div>
  )
}
