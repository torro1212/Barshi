import { NextRequest, NextResponse } from 'next/server'
import { createServerClientInstance } from '@/lib/db/server'
import { scanContent } from '@/lib/safety/scanner'
import { isLocalMode } from '@/lib/local-mode'

/** PUT /api/profile — update the current user's bio (safety-scanned) */
export async function PUT(req: NextRequest) {
  const { bio } = await req.json() as { bio?: string }
  const cleanBio = (bio ?? '').trim().slice(0, 160)

  if (isLocalMode()) return NextResponse.json({ ok: true, bio: cleanBio })

  const supabase = await createServerClientInstance()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Public text about a minor — scan before it goes live.
  if (cleanBio) {
    const scan = await scanContent({ title: '', bio: cleanBio })
    if (scan.action === 'block') {
      return NextResponse.json(
        { error: "Let's keep your bio friendly — try changing it." },
        { status: 422 }
      )
    }
  }

  const { error } = await supabase
    .from('profiles')
    .update({ bio: cleanBio || null })
    .eq('id', user.id)

  if (error) return NextResponse.json({ error: 'Failed to save' }, { status: 500 })

  return NextResponse.json({ ok: true, bio: cleanBio })
}
