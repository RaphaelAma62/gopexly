import type { Metadata } from 'next'
import LearnPage from '@/components/learn/LearnPage'

export const metadata: Metadata = { title: 'Learn & Earn' }

export default function Learn() {
  return <LearnPage />
}
