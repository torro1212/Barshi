import type { CoverConfig, ProjectType } from '@/types'

/** Cover configs per project type */
const TYPE_COVERS: Record<ProjectType, CoverConfig[]> = {
  game: [
    { gradientFrom: '#0d0d14', gradientTo: '#1a0533', accentColor: '#f97316', icon: '🎮', patternType: 'dots' },
    { gradientFrom: '#0a0a0a', gradientTo: '#1a1a1a', accentColor: '#ef4444', icon: '⚔️', patternType: 'grid' },
    { gradientFrom: '#0f0c29', gradientTo: '#24243e', accentColor: '#6c47ff', icon: '🚀', patternType: 'dots' },
  ],
  website: [
    { gradientFrom: '#0a192f', gradientTo: '#112240', accentColor: '#3b82f6', icon: '🌐', patternType: 'grid' },
    { gradientFrom: '#0d1117', gradientTo: '#161b22', accentColor: '#58a6ff', icon: '💻', patternType: 'dots' },
  ],
  tool: [
    { gradientFrom: '#1a0533', gradientTo: '#2d1b69', accentColor: '#a855f7', icon: '🔧', patternType: 'grid' },
    { gradientFrom: '#13131f', gradientTo: '#1f1f2e', accentColor: '#c084fc', icon: '⚙️', patternType: 'none' },
  ],
  story: [
    { gradientFrom: '#1a0a1a', gradientTo: '#2d0d2d', accentColor: '#ec4899', icon: '📖', patternType: 'dots' },
    { gradientFrom: '#0a0a14', gradientTo: '#14142a', accentColor: '#f472b6', icon: '✨', patternType: 'none' },
  ],
  interface: [
    { gradientFrom: '#0a1929', gradientTo: '#0d2137', accentColor: '#06b6d4', icon: '🖥️', patternType: 'grid' },
  ],
  simulation: [
    { gradientFrom: '#0a1a0a', gradientTo: '#0d2a0d', accentColor: '#22c55e', icon: '⚡', patternType: 'dots' },
  ],
  world: [
    { gradientFrom: '#0a1f14', gradientTo: '#0d2d1a', accentColor: '#10b981', icon: '🌍', patternType: 'dots' },
  ],
}

/** Generate a cover config for a project type */
export function generateCoverConfig(type: ProjectType): CoverConfig {
  const options = TYPE_COVERS[type] ?? TYPE_COVERS.game
  return options[Math.floor(Math.random() * options.length)]
}

/** Generate inline CSS for a cover card */
export function coverToCSS(cover: CoverConfig): React.CSSProperties {
  return {
    background: `linear-gradient(135deg, ${cover.gradientFrom} 0%, ${cover.gradientTo} 100%)`,
    borderColor: `${cover.accentColor}22`,
  }
}

// Note: React import needed only if using React.CSSProperties
// Add `import type React from 'react'` in files that use coverToCSS
