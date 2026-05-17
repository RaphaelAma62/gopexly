import type { Metadata } from 'next'
import Bookmarks from '@/components/bookmarks/Bookmarks'
export const metadata: Metadata = { title: 'Saved Posts' }
export default function Page() { return <Bookmarks /> }
