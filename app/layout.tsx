import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: {
    template: '%s | Gopexly',
    default: 'Gopexly — Nigeria\'s Social Investing Platform',
  },
  description: 'Track NGX stocks, share investment insights, and grow your wealth with Gopexly.',
  keywords: ['investing', 'NGX', 'Nigeria', 'stocks', 'portfolio', 'fintech'],
  openGraph: {
    title: 'Gopexly — Africa\'s Social Investing Platform',
    description: 'Track NGX stocks, share investment insights, and grow your wealth.',
    type: 'website',
  },
  icons: {
    icon: [
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon.ico' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180' },
    ],
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