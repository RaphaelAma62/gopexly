import type { Metadata } from 'next'
import HomeFeed from '@/components/feed/HomeFeed'

export const metadata: Metadata = { title: 'Home Feed' }

export default function HomePage() {
  return <HomeFeed />
}
