import type { Metadata } from 'next'
import StockDetail from '@/components/stocks/StockDetail'

export const metadata: Metadata = { title: 'Stock Detail' }

export default function Page({ params }: { params: { ticker: string } }) {
  return <StockDetail ticker={params.ticker.toUpperCase()} />
}
