import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { localStore } from '@/lib/local-store'
import { LOCAL_USER_ID } from '@/lib/local-mode'
import type { BuildPlan, CoverConfig } from '@/types'

// Route handlers under test
import { PUT as putProject, DELETE as deleteProject, GET as getProject } from '@/app/api/projects/[id]/route'
import { POST as generate } from '@/app/api/ai/generate/route'
import { GET as listVersions, POST as snapshotVersion, PUT as restoreVersion } from '@/app/api/projects/[id]/versions/route'

const plan: BuildPlan = {
  title: 'Test', type: 'game', summary: 's',
  screens: ['a'], components: ['b'], rules: ['c'], theme: 'neon', usesKaboom: true,
}
const cover: CoverConfig = {
  gradientFrom: '#000', gradientTo: '#fff', accentColor: '#8b5cf6', icon: '🎮', patternType: 'dots',
}

/** Build a NextRequest with a JSON body */
function jsonReq(url: string, method: string, body: unknown): NextRequest {
  return new NextRequest(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function ctx(id: string) {
  return { params: Promise.resolve({ id }) }
}

beforeEach(() => {
  // Force local mode so routes exercise the in-memory store, not Supabase
  vi.stubEnv('BARSHI_LOCAL_MODE', 'true')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '')
})

describe('PUT /api/projects/[id] — sanitizes HTML on save', () => {
  it('strips dangerous code and injects CSP before persisting', async () => {
    const p = localStore.create({ creator_id: LOCAL_USER_ID, plan, cover })
    const evil = '<html><head></head><body><script>eval("x"); window.parent.location="y"</script></body></html>'

    const res = await putProject(jsonReq(`http://t/api/projects/${p.id}`, 'PUT', { html: evil }), ctx(p.id))
    expect(res.status).toBe(200)

    const saved = localStore.get(p.id)!
    expect(saved.html).not.toMatch(/eval\s*\(/)
    expect(saved.html).not.toContain('window.parent')
    expect(saved.html).toContain('Content-Security-Policy')
  })

  it('returns 404 for a missing project', async () => {
    const res = await putProject(jsonReq('http://t/api/projects/nope', 'PUT', { html: '<p>x</p>' }), ctx('nope'))
    expect(res.status).toBe(404)
  })
})

describe('DELETE /api/projects/[id]', () => {
  it('removes the project from the store', async () => {
    const p = localStore.create({ creator_id: LOCAL_USER_ID, plan, cover })
    const res = await deleteProject(new NextRequest(`http://t/api/projects/${p.id}`, { method: 'DELETE' }), ctx(p.id))
    expect(res.status).toBe(200)
    expect(localStore.get(p.id)).toBeNull()
  })

  it('returns 404 when deleting something that does not exist', async () => {
    const res = await deleteProject(new NextRequest('http://t/api/projects/ghost', { method: 'DELETE' }), ctx('ghost'))
    expect(res.status).toBe(404)
  })
})

describe('POST /api/ai/generate — ownership (IDOR) guard', () => {
  it('returns 404 when the project does not exist', async () => {
    const res = await generate(jsonReq('http://t/api/ai/generate', 'POST', { projectId: 'missing', plan }))
    expect(res.status).toBe(404)
  })

  it('returns 404 when the project belongs to someone else', async () => {
    const other = localStore.create({ creator_id: 'someone-else', plan, cover })
    const res = await generate(jsonReq('http://t/api/ai/generate', 'POST', { projectId: other.id, plan }))
    expect(res.status).toBe(404)
  })
})

describe('project versions — snapshot / list / restore', () => {
  it('round-trips a snapshot and restores it', async () => {
    const p = localStore.create({ creator_id: LOCAL_USER_ID, plan, cover })

    // Snapshot v1
    const snapRes = await snapshotVersion(
      jsonReq(`http://t/api/projects/${p.id}/versions`, 'POST', { html: '<html><body>v1</body></html>' }),
      ctx(p.id),
    )
    expect(snapRes.status).toBe(200)

    // List shows one version
    const listRes = await listVersions(new NextRequest(`http://t/api/projects/${p.id}/versions`), ctx(p.id))
    const { versions } = await listRes.json()
    expect(versions).toHaveLength(1)
    expect(versions[0].version_num).toBe(1)

    // Move current html forward, then restore v1
    localStore.update(p.id, { html: '<html><body>v2-current</body></html>' })
    const restoreRes = await restoreVersion(
      jsonReq(`http://t/api/projects/${p.id}/versions`, 'PUT', { version_num: 1 }),
      ctx(p.id),
    )
    expect(restoreRes.status).toBe(200)
    const restored = await restoreRes.json()
    expect(restored.html).toContain('v1')
    expect(localStore.get(p.id)!.html).toContain('v1')
  })

  it('returns 404 restoring a version that does not exist', async () => {
    const p = localStore.create({ creator_id: LOCAL_USER_ID, plan, cover })
    const res = await restoreVersion(
      jsonReq(`http://t/api/projects/${p.id}/versions`, 'PUT', { version_num: 99 }),
      ctx(p.id),
    )
    expect(res.status).toBe(404)
  })
})

describe('GET /api/projects/[id]', () => {
  it('returns the project in local mode', async () => {
    const p = localStore.create({ creator_id: LOCAL_USER_ID, plan, cover })
    const res = await getProject(new NextRequest(`http://t/api/projects/${p.id}`), ctx(p.id))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.id).toBe(p.id)
    expect(body.title).toBe('Test')
  })
})
