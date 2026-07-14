# Barshi

**Barshi** (pronounced *BAR-shee*) is a safe, AI-native creation platform for ages **11–15**. Kids describe an idea in plain language, AI builds a real interactive project, they refine it in a visual builder, publish with one click, and remix each other's work.

> *"The place where your ideas become real."*

---

## Table of Contents

- [What Barshi Is](#what-barshi-is)
- [What Barshi Is Not](#what-barshi-is-not)
- [Core Philosophy](#core-philosophy)
- [What Users Can Build](#what-users-can-build)
- [User Journey](#user-journey)
- [Key Features](#key-features)
- [How Projects Work](#how-projects-work)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [AI System](#ai-system)
- [Safety Model](#safety-model)
- [Community & Social](#community--social)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Local Mode](#local-mode)
- [API Routes](#api-routes)
- [Database](#database)
- [Scripts](#scripts)

---

## What Barshi Is

Barshi is a **living creation world** — an AI playground with real power where young creators:

- Build **games, websites, tools, interactive stories, and worlds**
- Use **structured AI controls** (not just free-form chat) to create and iterate
- **Publish publicly** and let others play, like, and remix their work
- Learn **through doing** — prompting, system thinking, debugging, and product mindset — without it ever feeling like school

The hidden learning loop:

```
See → Create → Change → Understand → Fix → Publish → Improve
```

Barshi should feel like **Roblox-level creativity**, **Canva-level simplicity**, and **Scratch-level accessibility** — powered by AI that writes real code.

---

## What Barshi Is Not

Barshi is intentionally **not**:

- A toy or childish edutainment app
- A course platform or formal curriculum
- A generic AI chatbot
- A developer IDE or code editor for experts

It gives power first. Explanations come later, through curiosity.

---

## Core Philosophy

| Wrong approach | Barshi approach |
|---|---|
| Explain AI concepts before building | Give power immediately |
| Force lessons before creation | Let users make something in minutes |
| Open with dashboards and settings | Open with inspiration and a blank canvas |
| Feel educational or corporate | Feel creative, modern, and alive |

Users should think: *"I'm building something cool."*  
Not: *"I'm taking a lesson."*

---

## What Users Can Build

| Type | Example prompt |
|---|---|
| **Game** | *"A space shooter with 3 levels and a boss fight"* |
| **Website** | *"A fan page for my favorite band with songs and photos"* |
| **Story** | *"A spooky haunted house where YOU choose what happens"* |
| **Tool** | *"A daily habit tracker that shows my streak"* |
| **World** | *"An interactive underwater world to explore"* |

Games use **Kaboom.js**. Everything else uses vanilla HTML, CSS, and JavaScript.

---

## User Journey

### 1. Discover
Browse the public feed on the home page. Filter by type (Games, Websites, Tools, Stories, Worlds), search, and sort by new or popular.

### 2. Create
Go to `/create`, pick a project type, describe the idea, review an AI-generated build plan, then watch full project generation stream in real time.

### 3. Build
Open the builder at `/build/[id]` — a three-panel workspace:

| Panel | Purpose |
|---|---|
| **System Map** | Visual overview of screens, components, and theme |
| **Live Preview** | Sandboxed iframe running the project |
| **Action Toolbar** | Change, Add, Fix, Make Smarter |

**Desktop (≥768px):** all three panels side by side.  
**Mobile:** tabbed layout with bottom sheets.

### 4. Publish
One-click publish runs a mandatory safety scan. Approved projects appear on the public feed and get a shareable page at `/p/[id]`.

### 5. Remix
Anyone can remix a published project — creating their own copy to modify and republish.

---

## Key Features

- **AI build plans** — fast structured outline before full generation
- **Streaming generation** — watch the project being built live
- **System Map** — metadata-driven UI showing project structure
- **Version history** — snapshots of past edits
- **Auto-save** — changes persist as you work
- **CSS cover cards** — generated thumbnails for the feed
- **Profiles** — public pages at `/u/[username]` with avatar and bio
- **Notifications** — async updates (likes, remixes, milestones)
- **Moderation dashboard** — admin review for reported content
- **Rate limiting** — fair daily AI usage per user

---

## How Projects Work

This is the most important architectural decision in Barshi.

### Direct HTML Generation (not JSON → renderer)

Claude generates a **complete, self-contained HTML file** per project — all CSS and JS inline. There is no JSON schema that gets rendered into a game engine at runtime.

```
User idea → AI → single index.html → sanitize → Supabase Storage → sandboxed iframe
```

**Why not JSON → renderer?** Building a renderer that turns JSON into working games (physics, enemies, collision) is a separate multi-month project. Direct code generation is simpler, more powerful, and is how tools like Bolt.new and v0.dev work.

### Metadata JSON (`meta_json`)

Alongside the HTML, a lightweight metadata object is stored separately. It **does not run in the browser** — it powers the System Map UI, search, filtering, and AI edit context:

```json
{
  "type": "game",
  "screens": ["start", "game", "win", "lose"],
  "components": ["player", "enemies", "health", "score"],
  "theme": { "primaryColor": "#00ff88", "mood": "dark neon" },
  "usesKaboom": true
}
```

### Games: Kaboom.js

Game projects load Kaboom from a self-hosted CDN:

```html
<script src="https://cdn.barshi.app/kaboom/kaboom.min.js"></script>
```

Kaboom.js is beginner-friendly, lightweight (~200KB), and Claude generates Kaboom code accurately. Non-game types use vanilla HTML/CSS/JS only.

### Serving & Isolation

- HTML is stored at `projects/{id}/index.html` in Supabase Storage
- Served from `play.barshi.app` with strict Content Security Policy
- Runs inside a **sandboxed iframe** in the builder and on public project pages

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     barshi.app (Next.js)                     │
│  Discover │ Create │ Builder │ Profiles │ Moderation        │
├─────────────────────────────────────────────────────────────┤
│  API Routes (/api/ai/*, /api/projects/*, /api/safety, ...)  │
├──────────┬──────────────┬──────────────┬───────────────────┤
│ Supabase │  Anthropic   │ Upstash Redis│ PostHog / Sentry  │
│ DB+Auth  │  Claude AI   │ Rate Limits  │ Analytics/Errors  │
│ Storage  │              │              │                   │
└──────────┴──────────────┴──────────────┴───────────────────┘
                              │
                    play.barshi.app (sandbox CDN)
                    CSP-isolated project iframes
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) + TypeScript |
| UI | React 19, Tailwind CSS v4, Framer Motion |
| State | Zustand |
| Database / Auth / Storage | Supabase (PostgreSQL) |
| Rate limiting | Upstash Redis |
| AI | Anthropic Claude SDK |
| Game engine | Kaboom.js (self-hosted) |
| Analytics | PostHog |
| Error tracking | Sentry |
| Email | Resend |
| Hosting | Vercel + Supabase |
| Testing | Vitest |

---

## AI System

### Model Assignment

| Task | Model | Why |
|---|---|---|
| Build plan generation | claude-haiku-4-5 | Fast, cheap, simple JSON |
| Full project generation | claude-sonnet-4-6 | Quality + cost balance |
| Edit / Change / Add | claude-haiku-4-5 | Fast, most common action |
| Fix (analysis + patch) | claude-sonnet-4-6 | Needs reasoning |
| Make Smarter | claude-sonnet-4-6 | Needs reasoning |
| Safety scan | claude-haiku-4-5 | Fast, high volume |

All system prompts use `cache_control: { type: "ephemeral" }` for Anthropic prompt caching (~90% cache hit rate on system prompts).

### Rate Limits (per user per day)

| Action | Limit |
|---|---|
| Full generations | 3 |
| Edits (Change / Add / Fix / Smarter) | 30 |
| Safety scans | Unlimited (required for publish) |

When a limit is hit, users see a friendly message: *"You've used all 3 creations today. Come back tomorrow!"*

### AI Provider Fallback

The app supports multiple AI providers via environment variables:

1. **Anthropic** (preferred) — `ANTHROPIC_API_KEY`
2. **Groq / OpenRouter / OpenAI** — `GROQ_API_KEY`, `OPENROUTER_API_KEY`, or `OPENAI_API_KEY`
3. **Google Gemini** (free tier fallback for local dev) — `GOOGLE_AI_API_KEY`

---

## Safety Model

Barshi is built for minors. Safety is not optional — it is enforced at every layer.

### HTML Sanitizer

Before any HTML is stored, `lib/ai/sanitize.ts` strips dangerous patterns:

- `window.parent`, `window.top`, `window.opener`
- `localStorage`, `sessionStorage`, `document.cookie`
- `navigator.geolocation`, camera/microphone access
- `eval()`, `Function()`
- External scripts (except `cdn.barshi.app`)

### Content Security Policy (play.barshi.app)

```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.barshi.app; connect-src 'none';
```

### Pre-Publish Safety Scan

Every project must pass an AI safety scan before going public. The scan checks for age-inappropriate content, personal information collection, and harmful patterns.

### Community Safety

- **No direct messaging** — async community only
- **No open comments** — likes and remixes only
- **Report system** — users can flag content; moderators review via `/moderation`
- **Rate limiting** — prevents AI abuse

---

## Community & Social

Barshi's social layer is intentionally lightweight and safe:

| Feature | Description |
|---|---|
| **Likes** | Heart a published project |
| **Remix** | Fork someone's project into your own editable copy |
| **Profiles** | Public creator pages with projects and stats |
| **Play milestones** | Notifications when projects hit play counts |
| **Discover feed** | Browse, search, and filter all public creations |

There is no chat, no DMs, no comments. Community interaction is async and creation-focused.

---

## Project Structure

```
barshi/
├── app/                          # Next.js App Router
│   ├── page.tsx                  # Discover feed (home)
│   ├── create/                   # Creation flow
│   ├── build/[id]/               # Builder workspace
│   ├── p/[id]/                   # Public project page
│   ├── u/[username]/             # Creator profile
│   ├── projects/                 # My projects
│   ├── login/ & signup/          # Auth pages
│   ├── moderation/               # Admin moderation dashboard
│   └── api/                      # API routes
│       ├── ai/                   # plan, generate, edit, fix, smarter
│       ├── projects/               # CRUD, publish, like, remix, play
│       ├── safety/                 # Content safety scan
│       ├── moderation/             # Reports & actions
│       ├── profile/                # User profile & avatar
│       └── notifications/          # User notifications
├── components/
│   ├── ui/                       # Design system primitives
│   ├── builder/                  # Builder panels & actions
│   ├── creation/                 # Creation flow components
│   ├── discover/                 # Feed & cards
│   ├── nav/                      # Navigation & shell
│   └── project/                  # Project cards & covers
├── lib/
│   ├── ai/                       # Claude client, prompts, sanitizer, streaming
│   ├── db/                       # Supabase client & typed queries
│   ├── safety/                   # Content scanner
│   ├── local-store.ts            # File-backed store for local mode
│   ├── local-mode.ts             # Local mode detection
│   ├── rate-limit.ts             # Upstash Redis rate limiting
│   └── cover.ts                  # CSS cover card generation
├── stores/                       # Zustand state (builder, user)
├── hooks/                        # Custom React hooks
├── types/                        # Shared TypeScript types
├── supabase/migrations/          # SQL schema migrations
├── tests/                        # Vitest test suites
└── .env.example                  # Environment variable template
```

---

## Getting Started

### Prerequisites

- Node.js 20+
- npm
- (Optional) Supabase project for full production mode

### Install & Run

```bash
# Clone the repository
git clone https://github.com/torro1212/Barshi.git
cd Barshi

# Install dependencies
npm install

# Copy environment template
cp .env.example .env.local
# Fill in your API keys (see Environment Variables below)

# Start dev server (runs on port 3004)
npm run dev
```

Open [http://localhost:3004](http://localhost:3004).

### Run Tests

```bash
npm test          # single run
npm run test:watch  # watch mode
```

### Lint

```bash
npm run lint
```

---

## Environment Variables

Copy `.env.example` to `.env.local` and fill in values. **Never commit `.env.local`.**

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Production | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Production | Server-only service role key |
| `ANTHROPIC_API_KEY` | Recommended | Anthropic Claude API key |
| `GOOGLE_AI_API_KEY` | Dev fallback | Google Gemini (free tier) |
| `UPSTASH_REDIS_REST_URL` | Production | Upstash Redis URL |
| `UPSTASH_REDIS_REST_TOKEN` | Production | Upstash Redis token |
| `NEXT_PUBLIC_POSTHOG_KEY` | Optional | PostHog analytics key |
| `NEXT_PUBLIC_POSTHOG_HOST` | Optional | PostHog host URL |
| `SENTRY_DSN` | Optional | Sentry error tracking DSN |
| `RESEND_API_KEY` | Optional | Resend email API key |
| `NEXT_PUBLIC_APP_URL` | Yes | App URL (e.g. `http://localhost:3004`) |
| `BARSHI_LOCAL_MODE` | Optional | Enable local mode without Supabase |

See `.env.example` for the full list with comments.

---

## Local Mode

For development without a real Supabase instance, Barshi supports **local mode**:

- Set `BARSHI_LOCAL_MODE=true` in `.env.local`, or
- Leave Supabase URL as placeholder in a dev build

Local mode:
- Bypasses authentication (single local user)
- Stores projects in `.barshi-data/local-store.json` (gitignored)
- Supports full AI generation and builder workflow
- **Never activates in production** — production always requires real auth

---

## API Routes

| Method | Route | Description |
|---|---|---|
| `POST` | `/api/ai/plan` | Generate build plan (Haiku, streaming) |
| `POST` | `/api/ai/generate` | Full HTML generation (Sonnet, streaming) |
| `POST` | `/api/ai/edit` | Edit / change / add (Haiku, streaming) |
| `POST` | `/api/ai/fix` | Fix analysis + patches (Sonnet) |
| `POST` | `/api/ai/smarter` | Make smarter (Sonnet, streaming) |
| `POST` | `/api/safety` | Content safety scan (Haiku) |
| `POST` | `/api/projects` | Create project |
| `GET` | `/api/projects/[id]` | Get project |
| `PUT` | `/api/projects/[id]` | Update project |
| `POST` | `/api/projects/[id]/publish` | Publish (with safety gate) |
| `POST` | `/api/projects/[id]/like` | Toggle like |
| `POST` | `/api/projects/[id]/remix` | Create remix |
| `GET` | `/api/projects/[id]/html` | Serve project HTML |
| `GET/POST` | `/api/moderation/*` | Reports & moderation actions |

All AI endpoints enforce rate limiting and require authentication (except in local mode).

---

## Database

PostgreSQL via Supabase. Schema defined in `supabase/migrations/`:

| Table | Purpose |
|---|---|
| `profiles` | User profiles (username, bio, avatar) |
| `projects` | Projects (title, type, status, meta_json, html_path) |
| `project_versions` | Version snapshots for history |
| `likes` | Project likes |
| `reports` | User-submitted content reports |
| `moderation_actions` | Admin moderation log |
| `notifications` | Async user notifications |

Run migrations against your Supabase project to set up the schema.

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server on port 3004 |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | ESLint |
| `npm test` | Run Vitest tests |
| `npm run test:watch` | Vitest in watch mode |

---

## Brand

**Barshi** — modern, memorable, friendly, creative, slightly futuristic. Safe but not childish. Not corporate, not edtech-boring, not developer-tool cold.

*"The place where your ideas become real."*

---

## License

Private repository. All rights reserved.
