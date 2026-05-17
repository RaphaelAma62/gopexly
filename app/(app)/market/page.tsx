import type { Metadata } from 'next'
import MarketPage from '@/components/market/MarketPage'

export const metadata: Metadata = { title: 'NGX Market' }

export default function Market() {
  return <MarketPage />
}
