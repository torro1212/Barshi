import { describe, it, expect } from 'vitest'
import { generateCoverConfig, coverToCSS } from './cover'
import type { ProjectType } from '@/types'

const TYPES: ProjectType[] = ['game', 'website', 'tool', 'story', 'interface', 'simulation', 'world']

describe('generateCoverConfig', () => {
  it('returns a well-formed cover for every project type', () => {
    for (const type of TYPES) {
      const cover = generateCoverConfig(type)
      expect(cover.gradientFrom).toMatch(/^#[0-9a-f]{3,8}$/i)
      expect(cover.gradientTo).toMatch(/^#[0-9a-f]{3,8}$/i)
      expect(cover.accentColor).toMatch(/^#[0-9a-f]{3,8}$/i)
      expect(cover.icon.length).toBeGreaterThan(0)
      expect(['dots', 'grid', 'none']).toContain(cover.patternType)
    }
  })

  it('falls back to a game cover for an unknown type', () => {
    const cover = generateCoverConfig('nonsense' as ProjectType)
    expect(cover).toBeDefined()
    expect(cover.gradientFrom).toMatch(/^#/)
  })
})

describe('coverToCSS', () => {
  it('builds a gradient background and translucent border', () => {
    const css = coverToCSS({
      gradientFrom: '#000000',
      gradientTo: '#ffffff',
      accentColor: '#8b5cf6',
      icon: '🎮',
      patternType: 'dots',
    })
    expect(css.background).toBe('linear-gradient(135deg, #000000 0%, #ffffff 100%)')
    expect(css.borderColor).toBe('#8b5cf622')
  })
})
