import { NextRequest, NextResponse } from 'next/server'
import { createServerClientInstance } from '@/lib/db/server'
import { isLocalMode } from '@/lib/local-mode'

/** GET /api/notifications — latest notifications + unread count for the current user */
export async function GET() {
  if (isLocalMode()) {
    return NextResponse.json({ notifications: [], unread: 0 })
  }

  const supabase = await createServerClientInstance()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [{ data: notifications }, { count }] = await Promise.all([
    supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('read', false),
  ])

  return NextResponse.json({ notifications: notifications ?? [], unread: count ?? 0 })
}

/** PUT /api/notifications — mark all notifications as read */
export async function PUT(_req: NextRequest) {
  if (isLocalMode()) return NextResponse.json({ ok: true })

  const supabase = await createServerClientInstance()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', user.id)
    .eq('read', false)

  return NextResponse.json({ ok: true })
}
