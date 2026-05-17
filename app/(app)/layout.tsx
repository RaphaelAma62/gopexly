import type { Metadata } from 'next'
import AppNavbar from '@/components/layout/AppNavbar'

export const metadata: Metadata = {
  title: {
    template: '%s | Gopexly',
    default: 'Gopexly',
  },
}

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background">
      <AppNavbar />
      <main className="pt-[60px]">
        {children}
      </main>
    </div>
  )
}
