import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const username = searchParams.get('username')?.toLowerCase().trim()

  if (!username) {
    return NextResponse.json({ available: false, error: 'Username required' })
  }

  if (username.length < 3 || username.length > 20 || !/^[a-z0-9_]+$/.test(username)) {
    return NextResponse.json({ available: false, error: 'Invalid format' })
  }

  const supabase = await createServerSupabaseClient()
  const { data } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', username)
    .single()

  return NextResponse.json({ available: !data })
}
