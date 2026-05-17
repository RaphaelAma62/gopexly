import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: {
    template: '%s | Gopexly',
    default: 'Gopexly — Africa\'s Social Investing Platform',
  },
  description: 'Track NGX stocks, share investment insights, and grow your wealth with Gopexly.',
  keywords: ['investing', 'NGX', 'Nigeria', 'stocks', 'portfolio', 'fintech'],
  openGraph: {
    title: 'Gopexly — Africa\'s Social Investing Platform',
    description: 'Track NGX stocks, share investment insights, and grow your wealth.',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
