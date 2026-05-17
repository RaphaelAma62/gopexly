import type { Metadata } from 'next'
import PortfolioPage from '@/components/portfolio/PortfolioPage'

export const metadata: Metadata = { title: 'My Portfolio' }

export default function Portfolio() {
  return <PortfolioPage />
}
