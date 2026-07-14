# Barshi — Claude Code Guide

Barshi is a safe AI-native creation platform for ages 11–15 where kids build games, websites, tools, and interactive stories using AI, publish publicly, and remix each other's work.

## Project Structure

```
c:/Ai/Barshi/
├── CLAUDE.md                          # This file
├── barshi_master_prompt_for_cursor.md # Full product vision and spec
├── barshi_build_plan.md               # Complete build plan with DB schema, AI prompts, phases
└── web/                               # Next.js 15 application
    ├── app/                           # Next.js App Router
    │   ├── (public)/                  # Unauthenticated routes
    │   ├── (auth)/                    # Login/signup
    │   ├── (app)/                     # Authenticated app
    │   └── api/                       # API routes
    ├── components/                    # React components
    │   ├── ui/                        # Design system primitives
    │   ├── discover/                  # Feed and cards
    │   ├── builder/                   # Project builder
    │   ├── creation/                  # Creation flow
    │   ├── project/                   # Project page
    │   └── profile/                   # Profile page
    ├── lib/
    │   ├── ai/                        # Claude integration + prompts + sanitizer
    │   ├── db/                        # Supabase client + typed queries
    │   ├── safety/                    # Content scanner
    │   ├── rate-limit.ts              # Upstash Redis rate limiting
    │   ├── cover.ts                   # CSS cover card generation
    │   └── posthog.ts                 # Analytics
    ├── stores/                        # Zustand stores
    ├── hooks/                         # Custom hooks
    └── supabase/
        └── migrations/                # SQL migrations
```

## Tech Stack

- **Framework:** Next.js 15 (App Router) + TypeScript
- **Styling:** Tailwind CSS v4
- **Animations:** Framer Motion
- **State:** Zustand
- **DB/Auth/Storage:** Supabase
- **Rate limiting:** Upstash Redis
- **AI:** Anthropic Claude (SDK: `@anthropic-ai/sdk`)
  - Generation: claude-sonnet-4-6
  - Edits/Safety: claude-haiku-4-5
- **Game engine:** Kaboom.js (self-hosted on cdn.barshi.app)
- **Analytics:** PostHog
- **Error tracking:** Sentry
- **Email:** Resend

## How Projects Work (Critical to understand)

**Claude generates complete self-contained HTML/CSS/JS files directly.**

- NOT a JSON schema → renderer pipeline
- Claude generates one HTML file with all CSS and JS inline
- The HTML is sanitized (remove window.parent, eval, localStorage, etc.)
- Stored in Supabase Storage at `projects/{id}/index.html`
- Served from `play.barshi.app` subdomain with strict CSP
- Runs in a sandboxed iframe in the builder

**Metadata JSON** (`meta_json`) is a separate lightweight object:
```json
{
  "type": "game",
  "screens": ["start", "game", "win", "lose"],
  "components": ["player", "enemies", "health", "score"],
  "theme": { "primaryColor": "#00ff88", "mood": "dark neon" },
  "usesKaboom": true
}
```
This powers the System Map UI. It does NOT run in the browser.

**Games use Kaboom.js:**
```html
<script src="https://cdn.barshi.app/kaboom/kaboom.min.js"></script>
```
All other project types (websites, tools, stories) use vanilla HTML/CSS/JS.

## AI Model Assignment

| Task | Model |
|---|---|
| Build plan generation | claude-haiku-4-5 |
| Full project generation | claude-sonnet-4-6 |
| Edit / Change / Add | claude-haiku-4-5 |
| Fix (analysis) | claude-sonnet-4-6 |
| Make Smarter | claude-sonnet-4-6 |
| Safety scan | claude-haiku-4-5 |

All system prompts use `cache_control: { type: "ephemeral" }` for prompt caching.

## Key API Routes

```
POST /api/ai/plan          → build plan JSON (Haiku, streaming)
POST /api/ai/generate      → full HTML generation (Sonnet, streaming)
POST /api/ai/edit          → edit/change/add (Haiku, streaming)
POST /api/ai/fix           → fix analysis + patches (Sonnet)
POST /api/ai/smarter       → make smarter (Sonnet, streaming)
POST /api/safety           → content safety scan (Haiku)
POST /api/projects         → create project
GET  /api/projects/[id]    → get project
PUT  /api/projects/[id]    → update project
POST /api/projects/[id]/publish   → publish
POST /api/projects/[id]/like      → toggle like
POST /api/projects/[id]/remix     → create remix
POST /api/moderation/report       → submit report
```

## Rate Limits (Upstash Redis)

```typescript
generate: 3 per user per day
edit:     30 per user per day
```

## Builder Layout

**Desktop (≥768px):** 3-panel — System Map | Live Preview iframe | Action Toolbar
**Mobile (<768px):** Tabbed — Preview tab | Structure tab | Do tab (bottom sheets)

## Safety Rules

The HTML sanitizer (`lib/ai/sanitize.ts`) blocks:
- `window.parent`, `window.top`, `window.opener`
- `localStorage`, `sessionStorage`, `document.cookie`
- `navigator.geolocation`, `navigator.camera`
- `eval()`, `Function()`
- External scripts (except `cdn.barshi.app`)

The CSP on `play.barshi.app`:
```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.barshi.app; connect-src 'none';
```

## Environment Variables

See `.env.example` in `web/`. Required:
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
ANTHROPIC_API_KEY
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
NEXT_PUBLIC_POSTHOG_KEY
NEXT_PUBLIC_POSTHOG_HOST
SENTRY_DSN
RESEND_API_KEY
```

## Database Tables

`profiles`, `projects`, `project_versions`, `likes`, `reports`, `moderation_actions`, `notifications`

Full schema is in `web/supabase/migrations/001_initial.sql`.

## Coding Conventions

- All components are typed with TypeScript — no `any`
- Server Components by default, Client Components only when needed (add `"use client"`)
- Use `cn()` utility (clsx + tailwind-merge) for all className logic
- All user-facing text must be friendly and non-technical
- Never show raw errors to users — always handle gracefully
- All AI streaming responses use `ReadableStream` with text/event-stream
- Zustand stores are in `stores/` — one store per domain
- Database queries are typed functions in `lib/db/queries/`

## Product Rules (Enforced in Code)

- Users aged 11-15: no adult content generation, no personal info collection
- All generated HTML is sanitized before storage
- Rate limiting is enforced on all AI endpoints
- Pre-publish safety scan is mandatory before any project goes public
- No direct messaging, no comments, no open chat — community is async only (likes, remixes)
