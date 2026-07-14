import { NextRequest, NextResponse } from 'next/server'
import { createServerClientInstance, createServiceClient } from '@/lib/db/server'
import { isLocalMode } from '@/lib/local-mode'

const MAX_BYTES = 2 * 1024 * 1024 // 2 MB
const ALLOWED = new Map<string, string>([
  ['image/png', 'png'],
  ['image/jpeg', 'jpg'],
  ['image/webp', 'webp'],
  ['image/gif', 'gif'],
])

/** POST /api/profile/avatar — upload a new avatar image (multipart form, field "file") */
export async function POST(req: NextRequest) {
  if (isLocalMode()) {
    return NextResponse.json({ error: 'Avatar upload is unavailable in local mode' }, { status: 400 })
  }

  const supabase = await createServerClientInstance()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No image provided' }, { status: 400 })
  }

  const ext = ALLOWED.get(file.type)
  if (!ext) {
    return NextResponse.json({ error: 'Please use a PNG, JPG, WEBP, or GIF image.' }, { status: 415 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'That image is too big — keep it under 2 MB.' }, { status: 413 })
  }

  const service = createServiceClient()
  // Stable path per user so re-uploads overwrite the old file; cache-bust via query param.
  const path = `${user.id}/avatar.${ext}`
  const bytes = new Uint8Array(await file.arrayBuffer())

  const { error: uploadError } = await service.storage
    .from('avatars')
    .upload(path, bytes, { contentType: file.type, upsert: true })

  if (uploadError) {
    console.error('[avatar] upload failed', uploadError)
    return NextResponse.json({ error: 'Upload failed. Try again.' }, { status: 500 })
  }

  const { data: pub } = service.storage.from('avatars').getPublicUrl(path)
  const url = `${pub.publicUrl}?v=${Date.now()}`

  const { error: updateError } = await service
    .from('profiles')
    .update({ avatar_url: url })
    .eq('id', user.id)

  if (updateError) {
    return NextResponse.json({ error: 'Could not save your avatar.' }, { status: 500 })
  }

  return NextResponse.json({ avatar_url: url })
}
