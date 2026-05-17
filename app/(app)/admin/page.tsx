import type { Metadata } from 'next'
import AdminPanel from '@/components/admin/AdminPanel'

export const metadata: Metadata = { title: 'Admin Panel' }

export default function Admin() {
  return <AdminPanel />
}
