'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Heart, Play } from 'lucide-react'
import { CoverCard } from './CoverCard'
import { Avatar } from '@/components/ui/avatar'
import { formatCount } from '@/lib/utils'
import type { ProjectWithCreator } from '@/types'

interface ProjectCardProps {
  project: ProjectWithCreator
  /** stagger index for the entrance animation */
  index?: number
}

const TYPE_COLORS: Record<string, string> = {
  game:       'rgba(251,146,60,0.15)',
  website:    'rgba(96,165,250,0.15)',
  tool:       'rgba(192,132,252,0.15)',
  story:      'rgba(244,114,182,0.15)',
  world:      'rgba(52,211,153,0.15)',
  interface:  'rgba(103,232,249,0.15)',
  simulation: 'rgba(250,204,21,0.15)',
}

export function ProjectCard({ project, index = 0 }: ProjectCardProps) {
  const typeGlow = TYPE_COLORS[project.type] ?? 'rgba(139,92,246,0.15)'

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.45, delay: Math.min(index * 0.05, 0.4), ease: [0.22, 1, 0.36, 1] }}
    >
    <Link href={`/p/${project.id}`} className="group block">
      <article className="sheen lift relative rounded-[var(--radius-xl)] overflow-hidden border border-[var(--color-border)] bg-[var(--color-surface-2)] hover:border-[var(--color-border-light)]"
        style={{ '--hover-glow': typeGlow } as React.CSSProperties}
      >
        {/* Hover glow overlay */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-[var(--radius-xl)] z-10"
          style={{ boxShadow: `inset 0 0 0 1px ${typeGlow.replace('0.15', '0.4')}` }}
        />

        {/* Cover */}
        <div className="relative overflow-hidden">
          <CoverCard
            cover={project.cover_config}
            type={project.type}
            title={project.title}
            size="md"
            className="rounded-none"
          />
          {/* Play overlay on hover */}
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30 scale-90 group-hover:scale-100 transition-transform duration-200">
              <Play size={20} className="text-white fill-white ml-0.5" />
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="p-3 space-y-2.5">
          <h3 className="font-bold text-sm text-[var(--color-text)] leading-tight line-clamp-1"
            style={{ fontFamily: 'var(--font-display)' }}>
            {project.title}
          </h3>

          {/* Creator + Stats */}
          <div className="flex items-center justify-between">
            <Link
              href={`/u/${project.creator.username}`}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1.5 hover:opacity-70 transition-opacity min-w-0"
            >
              <Avatar src={project.creator.avatar_url} username={project.creator.username} size="sm" />
              <span className="text-xs text-[var(--color-text-dim)] font-medium truncate max-w-[80px]">
                {project.creator.username}
              </span>
            </Link>

            <div className="flex items-center gap-2.5 text-xs text-[var(--color-text-dim)] flex-shrink-0">
              <span className="flex items-center gap-1">
                <Heart size={11} />
                {formatCount(project.like_count)}
              </span>
              <span className="flex items-center gap-1">
                <Play size={11} />
                {formatCount(project.play_count)}
              </span>
            </div>
          </div>
        </div>
      </article>
    </Link>
    </motion.div>
  )
}
