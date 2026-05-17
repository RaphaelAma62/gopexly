import type { Metadata } from 'next'
import PriceAlerts from '@/components/alerts/PriceAlerts'
export const metadata: Metadata = { title: 'Price Alerts' }
export default function Page() { return <PriceAlerts /> }
