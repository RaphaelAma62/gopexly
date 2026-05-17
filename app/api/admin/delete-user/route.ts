import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function DELETE(request: Request) {
  const { targetUserId } = await request.json()

  if (!targetUserId) {
    return NextResponse.json({ error: 'targetUserId required' }, { status: 400 })
  }

  // Verify caller is admin
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 })
  }

  // Call the database function to wipe all user data
  const { data, error } = await supabase.rpc('delete_user_completely', {
    target_user_id: targetUserId,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Also delete from auth.users using service role
  if (data?.success) {
    const serviceClient = createServiceClient()
    await serviceClient.auth.admin.deleteUser(targetUserId)
  }

  return NextResponse.json(data)
}
