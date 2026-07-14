/**
 * File-backed project store for local mode (no Supabase).
 *
 * Kept in memory for speed, but persisted to a JSON file on every write so a
 * server restart no longer wipes the user's projects. Good enough for a
 * single-user self-hosted instance; the real multi-user path uses Supabase.
 */

import { randomUUID } from 'crypto'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import type { BuildPlan, CoverConfig, ProjectMeta, ProjectType, ProjectVisibility } from '@/types'

export interface LocalProject {
  id: string
  creator_id: string
  title: string
  description: string | null
  type: ProjectType
  meta_json: ProjectMeta
  cover_config: CoverConfig
  visibility: ProjectVisibility
  html: string
  remix_of: string | null
  play_count: number
  like_count: number
  remix_count: number
  published_at: string | null
  created_at: string
  updated_at: string
}

export interface LocalVersion {
  version_num: number
  html: string
  created_at: string
}

const MAX_VERSIONS = 5

// Persist to a JSON file so restarts don't lose data. Override the dir with
// BARSHI_DATA_DIR; defaults to ./.barshi-data at the project root.
const DATA_DIR = process.env.BARSHI_DATA_DIR || join(process.cwd(), '.barshi-data')
const DATA_FILE = join(DATA_DIR, 'local-store.json')

interface PersistShape {
  projects: LocalProject[]
  versions: [string, LocalVersion[]][]
}

// Use a global symbol so hot-reload in dev doesn't wipe the store every edit.
const GLOBAL_KEY = Symbol.for('barshi.localStore')
const VERSIONS_KEY = Symbol.for('barshi.localVersions')
type G = typeof globalThis & {
  [GLOBAL_KEY]?: Map<string, LocalProject>
  [VERSIONS_KEY]?: Map<string, LocalVersion[]>
}
const g = globalThis as G

/** Load persisted data from disk once (first import in this process). */
function loadFromDisk(): { projects: Map<string, LocalProject>; versions: Map<string, LocalVersion[]> } {
  const projects = new Map<string, LocalProject>()
  const versions = new Map<string, LocalVersion[]>()
  try {
    if (existsSync(DATA_FILE)) {
      const raw = JSON.parse(readFileSync(DATA_FILE, 'utf8')) as PersistShape
      for (const p of raw.projects ?? []) projects.set(p.id, p)
      for (const [id, v] of raw.versions ?? []) versions.set(id, v)
    }
  } catch (err) {
    console.error('[local-store] failed to load persisted data', err)
  }
  return { projects, versions }
}

if (!g[GLOBAL_KEY] || !g[VERSIONS_KEY]) {
  const loaded = loadFromDisk()
  g[GLOBAL_KEY] = loaded.projects
  g[VERSIONS_KEY] = loaded.versions
}
const projects = g[GLOBAL_KEY]!
const versions = g[VERSIONS_KEY]!

/** Write the whole store to disk. Cheap enough for a single-user instance;
 *  debounced so a burst of writes (e.g. streamed edits) coalesces. */
let saveTimer: ReturnType<typeof setTimeout> | null = null
function persist(): void {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    try {
      if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true })
      const shape: PersistShape = {
        projects: Array.from(projects.values()),
        versions: Array.from(versions.entries()),
      }
      writeFileSync(DATA_FILE, JSON.stringify(shape), 'utf8')
    } catch (err) {
      console.error('[local-store] failed to persist data', err)
    }
  }, 300)
}

export const localStore = {
  create(input: {
    creator_id: string
    plan: BuildPlan
    cover: CoverConfig
  }): LocalProject {
    const id = randomUUID()
    const now = new Date().toISOString()
    const project: LocalProject = {
      id,
      creator_id: input.creator_id,
      title: input.plan.title,
      description: input.plan.summary,
      type: input.plan.type,
      meta_json: {
        type: input.plan.type,
        screens: input.plan.screens,
        components: input.plan.components,
        theme: { primaryColor: input.cover.accentColor, mood: input.plan.theme },
        usesKaboom: input.plan.usesKaboom,
      },
      cover_config: input.cover,
      visibility: 'private',
      html: '',
      remix_of: null,
      play_count: 0,
      like_count: 0,
      remix_count: 0,
      published_at: null,
      created_at: now,
      updated_at: now,
    }
    projects.set(id, project)
    persist()
    return project
  },

  get(id: string): LocalProject | null {
    return projects.get(id) ?? null
  },

  update(id: string, patch: Partial<LocalProject>): LocalProject | null {
    const existing = projects.get(id)
    if (!existing) return null
    const updated = { ...existing, ...patch, updated_at: new Date().toISOString() }
    projects.set(id, updated)
    persist()
    return updated
  },

  list(): LocalProject[] {
    return Array.from(projects.values())
  },

  delete(id: string): boolean {
    versions.delete(id)
    const ok = projects.delete(id)
    persist()
    return ok
  },

  /** Snapshot the current HTML as a new version (keeps the latest MAX_VERSIONS) */
  snapshot(id: string, html: string): void {
    if (!html) return
    const list = versions.get(id) ?? []
    const nextNum = (list[0]?.version_num ?? 0) + 1
    const entry: LocalVersion = { version_num: nextNum, html, created_at: new Date().toISOString() }
    versions.set(id, [entry, ...list].slice(0, MAX_VERSIONS))
    persist()
  },

  listVersions(id: string): LocalVersion[] {
    return versions.get(id) ?? []
  },

  getVersion(id: string, versionNum: number): LocalVersion | null {
    return (versions.get(id) ?? []).find((v) => v.version_num === versionNum) ?? null
  },
}
