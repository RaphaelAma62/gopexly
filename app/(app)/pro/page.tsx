import type { Metadata } from 'next'
import ProUpgrade from '@/components/pro/ProUpgrade'

export const metadata: Metadata = { title: 'Gopexly Pro' }

export default function ProPage() {
  return <ProUpgrade />
}
