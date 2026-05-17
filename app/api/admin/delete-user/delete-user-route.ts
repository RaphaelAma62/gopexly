import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function DELETE(request: Request) {
  const { targetUserId } = await request.json()

  if (!targetUserId) {
    return NextResponse.json({ error: 'targetUserId required' }, { status: 400 })
  }

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Use explicit type assertion to fix 'never' inference issue
  const { data: profileData } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const profile = profileData as { role: string } | null

  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  // Cast to any to bypass missing RPC type definition
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)('delete_user_completely', {
    target_user_id: targetUserId,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Also delete from auth.users using service role
  if (data?.success) {
    try {
      const { createClient } = await import('@supabase/supabase-js')
      const serviceClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )
      await serviceClient.auth.admin.deleteUser(targetUserId)
    } catch (e) {
      console.error('Service role delete failed:', e)
    }
  }

  return NextResponse.json(data)
}
