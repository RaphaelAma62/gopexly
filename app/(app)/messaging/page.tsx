import type { Metadata } from 'next'
import Messaging from '@/components/messaging/Messaging'
export const metadata: Metadata = { title: 'Messages' }
export default function Page() { return <Messaging /> }
