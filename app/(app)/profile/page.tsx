import type { Metadata } from 'next'
import ProfilePage from '@/components/profile/ProfilePage'

export const metadata: Metadata = { title: 'My Account' }

export default function Profile() {
  return <ProfilePage />
}
