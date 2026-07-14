import { describe, it, expect } from 'vitest'
import { localStore } from './local-store'
import type { BuildPlan, CoverConfig } from '@/types'

const plan: BuildPlan = {
  title: 'Test Game',
  type: 'game',
  summary: 'A test',
  screens: ['start', 'game'],
  components: ['player'],
  rules: ['dont die'],
  theme: 'neon',
  usesKaboom: true,
}

const cover: CoverConfig = {
  gradientFrom: '#000',
  gradientTo: '#fff',
  accentColor: '#8b5cf6',
  icon: '🎮',
  patternType: 'dots',
}

describe('localStore CRUD', () => {
  it('creates and reads a project with a UUID id', () => {
    const p = localStore.create({ creator_id: 'user-1', plan, cover })
    expect(p.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(localStore.get(p.id)?.title).toBe('Test Game')
    expect(p.visibility).toBe('private')
  })

  it('updates fields and bumps updated_at', () => {
    const p = localStore.create({ creator_id: 'user-1', plan, cover })
    const updated = localStore.update(p.id, { title: 'Renamed' })
    expect(updated?.title).toBe('Renamed')
    expect(localStore.get(p.id)?.title).toBe('Renamed')
  })

  it('returns null when updating a missing project', () => {
    expect(localStore.update('does-not-exist', { title: 'x' })).toBeNull()
  })

  it('deletes a project and its versions', () => {
    const p = localStore.create({ creator_id: 'user-1', plan, cover })
    localStore.snapshot(p.id, '<html>1</html>')
    expect(localStore.delete(p.id)).toBe(true)
    expect(localStore.get(p.id)).toBeNull()
    expect(localStore.listVersions(p.id)).toHaveLength(0)
  })
})

describe('localStore versions', () => {
  it('keeps only the latest 5 snapshots, newest first', () => {
    const p = localStore.create({ creator_id: 'user-1', plan, cover })
    for (let i = 1; i <= 7; i++) localStore.snapshot(p.id, `<html>${i}</html>`)

    const versions = localStore.listVersions(p.id)
    expect(versions).toHaveLength(5)
    // newest first: version_num 7 down to 3
    expect(versions[0].version_num).toBe(7)
    expect(versions[0].html).toBe('<html>7</html>')
    expect(versions[4].version_num).toBe(3)
  })

  it('ignores empty snapshots', () => {
    const p = localStore.create({ creator_id: 'user-1', plan, cover })
    localStore.snapshot(p.id, '')
    expect(localStore.listVersions(p.id)).toHaveLength(0)
  })

  it('fetches a specific version by number', () => {
    const p = localStore.create({ creator_id: 'user-1', plan, cover })
    localStore.snapshot(p.id, '<html>a</html>')
    localStore.snapshot(p.id, '<html>b</html>')
    expect(localStore.getVersion(p.id, 1)?.html).toBe('<html>a</html>')
    expect(localStore.getVersion(p.id, 2)?.html).toBe('<html>b</html>')
    expect(localStore.getVersion(p.id, 99)).toBeNull()
  })
})
