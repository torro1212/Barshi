import { NextRequest, NextResponse } from 'next/server'
import { createServerClientInstance } from '@/lib/db/server'
import { scanContent } from '@/lib/safety/scanner'
import { isLocalMode } from '@/lib/local-mode'

/** POST /api/safety — run a content safety scan on title/description/html/profile text */
export async function POST(req: NextRequest) {
  if (!isLocalMode()) {
    const supabase = await createServerClientInstance()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { title, description, html, username, bio } = await req.json() as {
    title?: string
    description?: string
    html?: string
    username?: string
    bio?: string
  }

  if (!title && !description && !html && !username && !bio) {
    return NextResponse.json({ error: 'Nothing to scan' }, { status: 400 })
  }

  const result = await scanContent({ title: title ?? '', description, html, username, bio })
  return NextResponse.json(result)
}
