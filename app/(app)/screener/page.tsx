import type { Metadata } from 'next'
import StockScreener from '@/components/screener/StockScreener'
export const metadata: Metadata = { title: 'Stock Screener' }
export default function Page() { return <StockScreener /> }
