import type { Metadata } from 'next'
import Clubs from '@/components/clubs/Clubs'
export const metadata: Metadata = { title: 'Investment Clubs' }
export default function Page() { return <Clubs /> }
