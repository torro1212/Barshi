import { Suspense } from 'react'
import Link from 'next/link'
import { Search, Sparkles, Zap, Clock, Flame, Rocket, SearchX, ShieldCheck, EyeOff, MessageSquareOff } from 'lucide-react'
import { AppShell } from '@/components/nav/AppShell'
import { ProjectCard } from '@/components/project/ProjectCard'
import { Onboarding } from '@/components/Onboarding'
import { AuroraBackground } from '@/components/ui/AuroraBackground'
import { TypeIcon, TypeIconBadge } from '@/components/ui/TypeIcon'
import { getPublicProjects } from '@/lib/db/queries/projects'
import type { ProjectType } from '@/types'

const TYPES: { label: string; value: ProjectType | 'all' }[] = [
  { label: 'All',       value: 'all' },
  { label: 'Games',     value: 'game' },
  { label: 'Websites',  value: 'website' },
  { label: 'Tools',     value: 'tool' },
  { label: 'Stories',   value: 'story' },
  { label: 'Worlds',    value: 'world' },
]

const INSPIRATION: {
  label: string
  example: string
  type: ProjectType
  gradient: string
}[] = [
  {
    label: 'Game', type: 'game',
    example: '"A space shooter with 3 levels and a boss fight"',
    gradient: 'linear-gradient(135deg, #fb923c22 0%, #f97316 8%, #431407 100%)',
  },
  {
    label: 'Website', type: 'website',
    example: '"A fan page for my favorite band with songs and photos"',
    gradient: 'linear-gradient(135deg, #60a5fa22 0%, #3b82f6 8%, #1e1b4b 100%)',
  },
  {
    label: 'Story', type: 'story',
    example: '"A spooky haunted house where YOU choose what happens"',
    gradient: 'linear-gradient(135deg, #f472b622 0%, #ec4899 8%, #4a044e 100%)',
  },
  {
    label: 'Tool', type: 'tool',
    example: '"A daily habit tracker that shows my streak"',
    gradient: 'linear-gradient(135deg, #c084fc22 0%, #a855f7 8%, #2e1065 100%)',
  },
  {
    label: 'World', type: 'world',
    example: '"An interactive underwater world to explore"',
    gradient: 'linear-gradient(135deg, #34d39922 0%, #10b981 8%, #064e3b 100%)',
  },
]

interface PageProps {
  searchParams: Promise<{ type?: string; q?: string; sort?: string }>
}

/** Build a feed URL preserving the other active filters */
function feedURL(opts: { type?: string; q?: string; sort?: string }): string {
  const params = new URLSearchParams()
  if (opts.type && opts.type !== 'all') params.set('type', opts.type)
  if (opts.q) params.set('q', opts.q)
  if (opts.sort && opts.sort !== 'new') params.set('sort', opts.sort)
  const qs = params.toString()
  return qs ? `/?${qs}` : '/'
}

export default async function DiscoverPage({ searchParams }: PageProps) {
  const params = await searchParams
  const rawType = params.type as ProjectType | undefined
  const activeType: ProjectType | 'all' = rawType ?? 'all'
  const q = (params.q ?? '').trim().slice(0, 80)
  const sort: 'new' | 'popular' = params.sort === 'popular' ? 'popular' : 'new'

  const projects = await getPublicProjects({ type: rawType, q: q || undefined, sort, limit: 24 }).catch(() => [])

  return (
    <AppShell>
      <Onboarding />
      {/* Hero */}
      <div className="relative overflow-hidden">
        <AuroraBackground variant="absolute" />

        <div className="relative max-w-6xl mx-auto px-4 pt-12 pb-10 text-center">
          <div className="animate-rise inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-[var(--color-brand)]/30 bg-[var(--color-brand)]/10 text-[var(--color-brand-light)] text-xs font-semibold mb-5 uppercase tracking-wider backdrop-blur-sm"
            style={{ animationDelay: '0.02s' }}>
            <Zap size={10} className="fill-current animate-pulse-glow" />
            AI-powered creation
          </div>

          <h1 className="animate-rise text-4xl sm:text-5xl md:text-6xl font-black leading-[1.05] tracking-tight mb-4"
            style={{ fontFamily: 'var(--font-display)', animationDelay: '0.08s' }}>
            Build real things
            <br />
            <span className="gradient-text-anim">with AI</span>
          </h1>

          <p className="animate-rise text-[var(--color-text-muted)] text-base sm:text-lg max-w-md mx-auto mb-6 leading-relaxed"
            style={{ animationDelay: '0.14s' }}>
            Games, websites, tools, stories — describe your idea and AI builds it in seconds.
          </p>

          <Link
            href="/create"
            className="animate-rise group inline-flex items-center gap-2 font-semibold transition-all duration-200 cursor-pointer select-none active:scale-[0.96] bg-[var(--color-brand)] text-white hover:bg-[var(--color-brand-light)] h-13 text-base rounded-[var(--radius-lg)] px-8 glow-sm hover:shadow-[0_0_36px_rgba(139,92,246,0.7)]"
            style={{ animationDelay: '0.2s' }}
          >
            <Sparkles size={18} className="transition-transform duration-300 group-hover:rotate-90" />
            Start creating
          </Link>

          {/* How it works - 3 steps */}
          <div className="animate-rise flex items-center justify-center gap-6 sm:gap-10 mt-10 flex-wrap" style={{ animationDelay: '0.28s' }}>
            {[
              { num: '1', text: 'Describe your idea' },
              { num: '2', text: 'AI builds it' },
              { num: '3', text: 'Share with everyone' },
            ].map(({ num, text }, i) => (
              <div key={num} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-[var(--color-brand)]/20 border border-[var(--color-brand)]/40 flex items-center justify-center text-xs font-bold text-[var(--color-brand-light)]">
                  {num}
                </div>
                <span className="text-sm text-[var(--color-text-muted)]">{text}</span>
                {i < 2 && <span className="hidden sm:block text-[var(--color-text-dim)]">→</span>}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 pb-24 md:pb-8 space-y-5">
        {/* Search + sort */}
        <div className="flex flex-col sm:flex-row gap-2">
          <form action="/" method="get" className="relative flex-1">
            {activeType !== 'all' && <input type="hidden" name="type" value={activeType} />}
            {sort !== 'new' && <input type="hidden" name="sort" value={sort} />}
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--color-text-dim)] pointer-events-none" />
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Search for games, websites, stories…"
              maxLength={80}
              className="w-full h-11 pl-10 pr-4 rounded-full bg-[var(--color-surface-2)] border border-[var(--color-border)] text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-dim)] outline-none focus:border-[var(--color-brand)]/60 focus:shadow-[0_0_12px_rgba(139,92,246,0.25)] transition-all"
            />
          </form>

          <div className="flex gap-1 p-1 rounded-full bg-[var(--color-surface-2)] border border-[var(--color-border)] self-start">
            {([
              { value: 'new' as const,     label: 'New',     icon: <Clock size={13} /> },
              { value: 'popular' as const, label: 'Popular', icon: <Flame size={13} /> },
            ]).map(({ value, label, icon }) => (
              <Link
                key={value}
                href={feedURL({ type: activeType, q, sort: value })}
                className={`flex items-center gap-1.5 px-4 h-9 rounded-full text-xs font-semibold transition-all ${
                  sort === value
                    ? 'bg-[var(--color-brand)] text-white'
                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                }`}
              >
                {icon}
                {label}
              </Link>
            ))}
          </div>
        </div>

        {/* Type filter */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none -mx-4 px-4">
          {TYPES.map(({ label, value }) => (
            <Link
              key={value}
              href={feedURL({ type: value, q, sort })}
              className={`flex-shrink-0 flex items-center gap-1.5 px-4 h-10 rounded-full text-sm font-semibold border transition-all duration-200 active:scale-95 ${
                activeType === value
                  ? 'bg-[var(--color-brand)] text-white border-transparent shadow-[0_0_16px_rgba(139,92,246,0.5)]'
                  : 'bg-[var(--color-surface-2)] text-[var(--color-text-muted)] border-[var(--color-border)] hover:border-[var(--color-border-light)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-3)]'
              }`}
            >
              {value === 'all'
                ? <Sparkles size={14} />
                : <TypeIcon type={value} size={14} />}
              {label}
            </Link>
          ))}
        </div>

        {/* Feed */}
        <Suspense fallback={<FeedSkeleton />}>
          {projects.length === 0 ? (
            q ? <NoResults q={q} clearHref={feedURL({ type: activeType, sort })} /> : <EmptyFeed />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
              {projects.map((p, i) => (
                <ProjectCard key={p.id} project={p} index={i} />
              ))}
            </div>
          )}
        </Suspense>

        <ForParents />
      </div>
    </AppShell>
  )
}

/** Trust strip aimed at parents — the audience is minors, so the safety promise
 *  needs to be visible, not just enforced in code. */
function ForParents() {
  const points = [
    { icon: <ShieldCheck size={18} />, title: 'Every project is scanned', text: 'AI checks each creation for unsafe content before it can go public.' },
    { icon: <EyeOff size={18} />, title: 'No personal info', text: 'We never ask kids for real names, phone numbers, or locations.' },
    { icon: <MessageSquareOff size={18} />, title: 'No open chat', text: 'No messaging or comments — kids connect only through likes and remixes.' },
  ]
  return (
    <section className="mt-10 rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface-2)] p-6 sm:p-8">
      <div className="flex items-center gap-2 mb-1">
        <ShieldCheck size={16} className="text-[var(--color-success)]" />
        <span className="text-xs font-bold uppercase tracking-widest text-[var(--color-success)]">For parents</span>
      </div>
      <h2 className="text-xl sm:text-2xl font-black mb-5" style={{ fontFamily: 'var(--font-display)' }}>
        A safe place to create
      </h2>
      <div className="grid sm:grid-cols-3 gap-4">
        {points.map((p) => (
          <div key={p.title} className="flex gap-3">
            <div className="w-9 h-9 rounded-xl bg-[var(--color-success)]/12 border border-[var(--color-success)]/25 text-[var(--color-success)] flex items-center justify-center flex-shrink-0">
              {p.icon}
            </div>
            <div>
              <p className="text-sm font-bold">{p.title}</p>
              <p className="text-xs text-[var(--color-text-muted)] leading-relaxed mt-0.5">{p.text}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function FeedSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="rounded-[var(--radius-xl)] overflow-hidden border border-[var(--color-border)]">
          <div className="aspect-[4/3] shimmer" />
          <div className="p-3 space-y-2 bg-[var(--color-surface-2)]">
            <div className="h-3.5 w-3/4 rounded-full shimmer" />
            <div className="h-3 w-1/2 rounded-full shimmer" />
          </div>
        </div>
      ))}
    </div>
  )
}

function NoResults({ q, clearHref }: { q: string; clearHref: string }) {
  return (
    <div className="text-center py-16 space-y-3">
      <div className="mx-auto w-16 h-16 rounded-2xl bg-[var(--color-surface-3)] border border-[var(--color-border)] flex items-center justify-center">
        <SearchX size={28} className="text-[var(--color-text-muted)]" />
      </div>
      <p className="text-lg font-bold" style={{ fontFamily: 'var(--font-display)' }}>
        Nothing found for &ldquo;{q}&rdquo;
      </p>
      <p className="text-sm text-[var(--color-text-muted)]">
        Try a different search — or be the first to make it!
      </p>
      <div className="flex items-center justify-center gap-2 pt-2">
        <Link
          href={clearHref}
          className="inline-flex items-center gap-2 font-semibold transition-all duration-200 cursor-pointer select-none active:scale-[0.96] bg-[var(--color-surface-3)] text-[var(--color-text)] hover:bg-[var(--color-surface-4)] h-10 text-sm rounded-[var(--radius-md)] px-5"
        >
          Clear search
        </Link>
        <Link
          href="/create"
          className="inline-flex items-center gap-2 font-semibold transition-all duration-200 cursor-pointer select-none active:scale-[0.96] bg-[var(--color-brand)] text-white hover:bg-[var(--color-brand-light)] h-10 text-sm rounded-[var(--radius-md)] px-5"
        >
          <Sparkles size={14} />
          Create it yourself
        </Link>
      </div>
    </div>
  )
}

function EmptyFeed() {
  return (
    <div className="space-y-10 py-4">
      {/* What can you build? */}
      <div className="text-center space-y-2">
        <p className="text-xs font-bold uppercase tracking-widest text-[var(--color-text-dim)]">
          What can you build?
        </p>
        <p className="text-2xl font-black inline-flex items-center gap-2" style={{ fontFamily: 'var(--font-display)' }}>
          Anything you can imagine
          <Rocket size={22} className="text-[var(--color-brand-light)]" />
        </p>
        <p className="text-sm text-[var(--color-text-muted)] max-w-sm mx-auto">
          Just describe your idea — AI builds it for you in seconds. No coding needed.
        </p>
      </div>

      {/* Inspiration cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {INSPIRATION.map(({ label, example, type, gradient }) => (
          <Link
            key={type}
            href={`/create?type=${type}`}
            className="sheen group relative rounded-[var(--radius-xl)] border border-white/10 overflow-hidden transition-all duration-300 hover:-translate-y-1.5 hover:border-white/20 hover:shadow-[0_20px_50px_rgba(0,0,0,0.6)]"
          >
            {/* Gradient background */}
            <div className="absolute inset-0 transition-opacity duration-300 group-hover:opacity-90" style={{ background: gradient }} />

            {/* Content */}
            <div className="relative p-5 space-y-3">
              <div className="flex items-center justify-between">
                <TypeIconBadge type={type} size={48} />
                <span className="text-xs font-bold uppercase tracking-wider text-white/60 bg-white/10 px-2 py-1 rounded-full">
                  {label}
                </span>
              </div>
              <p className="text-sm text-white/80 leading-relaxed italic min-h-[3rem]">
                {example}
              </p>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-white/90">
                <Sparkles size={12} />
                <span className="group-hover:underline">Build this →</span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* CTA */}
      <div className="text-center space-y-3 pt-4">
        <p className="text-sm text-[var(--color-text-dim)]">
          Be the first to publish something amazing here!
        </p>
        <Link
          href="/create"
          className="inline-flex items-center gap-2 font-semibold transition-all duration-200 cursor-pointer select-none active:scale-[0.96] bg-[var(--color-brand)] text-white hover:bg-[var(--color-brand-light)] h-11 text-sm rounded-[var(--radius-md)] px-6 glow-sm"
        >
          <Sparkles size={15} />
          Create something cool
        </Link>
      </div>
    </div>
  )
}
