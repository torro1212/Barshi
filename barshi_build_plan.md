# BARSHI — FULL BUILD PLAN v2

Complete, production-ready implementation plan. All architectural decisions are final.

---

# CORE ARCHITECTURAL DECISION

## How Projects Work: Direct Code Generation (Approach B)

Claude generates a **complete, self-contained HTML file** per project.
The HTML includes all CSS and JS inline. No external resources except allowed CDN libraries.
The file is sanitized, stored in Supabase Storage, and served from a sandboxed subdomain.

**Why not JSON schema → renderer:**
Building a renderer that can turn JSON into a working game (with physics, enemies, collision) is a separate multi-month project. Direct code generation is simpler, more powerful, and is how tools like Bolt.new and v0.dev work.

**What JSON is used for (metadata only):**
```json
{
  "type": "game",
  "title": "Zombie Survival",
  "screens": ["start", "game", "win", "lose"],
  "components": ["player", "enemies", "health", "score"],
  "theme": { "primaryColor": "#00ff88", "mood": "dark neon" },
  "kaboom": true
}
```
This metadata powers the System Map UI, search, filtering, and AI edit context.
It is NOT what runs in the browser. The HTML file runs.

## Game Engine: Kaboom.js

All game-type projects use **Kaboom.js** (hosted on `cdn.barshi.app`, not external).

Why Kaboom.js:
- Designed for beginners, simple API
- Claude generates Kaboom.js code very accurately
- Lightweight (~200KB)
- Built-in: sprites, physics, collision, scenes, sounds, input handling
- Active community, well-documented

Non-game types (websites, tools, stories, interfaces) use vanilla HTML/CSS/JS only.

---

# TECH STACK (FINAL)

| Layer | Technology | Reason |
|---|---|---|
| Frontend | Next.js 15 (App Router) + TypeScript | SSR, routing, streaming API |
| Styling | Tailwind CSS v4 | fast UI |
| Animations | Framer Motion | transitions, micro-interactions |
| State | Zustand | simple, no boilerplate |
| Database | Supabase (PostgreSQL + Auth + Storage + Realtime) | all-in-one |
| Cache / Rate Limit | Upstash Redis | per-user generation limits |
| AI | Anthropic Claude | generation + edits + safety |
| Game Engine | Kaboom.js (self-hosted on cdn.barshi.app) | game projects |
| Analytics | PostHog | product funnel tracking |
| Error Tracking | Sentry | production errors |
| Thumbnails | CSS cover cards (MVP) → Browserless screenshots (post-MVP) | no Puppeteer complexity in MVP |
| Email | Resend | transactional |
| Hosting | Vercel (main app) + Supabase (DB/storage) | |
| Sandbox CDN | `play.barshi.app` (Vercel edge or Cloudflare) | iframe isolation |

---

# AI MODEL ASSIGNMENT

| Task | Model | Why |
|---|---|---|
| Full project generation | claude-sonnet-4-6 | quality + cost balance |
| Build plan generation | claude-haiku-4-5 | fast, cheap, simple JSON |
| Edit / Change | claude-haiku-4-5 | fast, cheap, most common action |
| Fix (analysis + patch) | claude-sonnet-4-6 | needs reasoning |
| Make Smarter | claude-sonnet-4-6 | needs reasoning |
| Safety scan | claude-haiku-4-5 | fastest, cheapest, high volume |

**Prompt caching:** All system prompts are cached (Anthropic cache_control: ephemeral).
System prompts include Kaboom.js API reference + safe HTML patterns + Barshi context.
Estimated cache hit rate: 90%+ on system prompt → reduces input cost by ~90%.

---

# AI COST MODEL

## Per-Action Cost Estimates (with prompt caching)

| Action | Model | Input tokens | Output tokens | Cost per action |
|---|---|---|---|---|
| Build plan | Haiku | 500 (cached) + 200 user | 300 | ~$0.0003 |
| Full generation | Sonnet | 2000 (cached) + 500 user | 4000 | ~$0.06 |
| Edit / Change | Haiku | 3000 (cached) + 500 code + 100 request | 2000 | ~$0.01 |
| Fix | Sonnet | 2000 (cached) + 500 code | 1000 | ~$0.016 |
| Safety scan | Haiku | 200 (cached) + 300 content | 100 | ~$0.0003 |

## Free Tier Limits (per user per day)

| Action | Free limit | Why |
|---|---|---|
| Full generations | **3 per day** | Most expensive action |
| Edits (Change/Add/Fix/Smarter) | **30 per day** | Encourage iteration |
| Safety scans | Unlimited | Required for safety |

## Cost Projection at Scale

| Users (daily active) | Avg generations/day | Avg edits/day | Daily AI cost | Monthly |
|---|---|---|---|---|
| 100 | 2 | 10 | ~$13 | ~$390 |
| 1,000 | 2 | 10 | ~$130 | ~$3,900 |
| 10,000 | 1.5 | 8 | ~$980 | ~$29,400 |

At 10K DAU, revenue from Pro subscriptions (~15% conversion at $8/month) = $12,000/month.
Profit-positive by ~8K DAU. Plan monetization to launch before hitting that scale.

## Rate Limiting Implementation

```typescript
// lib/rate-limit.ts
// Uses Upstash Redis sliding window

const LIMITS = {
  generate: { requests: 3, window: '1d' },
  edit: { requests: 30, window: '1d' },
} as const;

export async function checkRateLimit(
  userId: string,
  action: keyof typeof LIMITS
): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
  const { requests, window } = LIMITS[action];
  const key = `rate:${action}:${userId}`;
  // Upstash ratelimit sliding window
}
```

When limit is hit, show: "You've used all 3 creations today. Come back tomorrow — or go Pro for unlimited."

---

# REPOSITORY STRUCTURE

```
barshi/
├── apps/
│   └── web/                          # Next.js 15 app
│       ├── app/
│       │   ├── (public)/
│       │   │   ├── page.tsx           # Discover feed
│       │   │   ├── p/[id]/page.tsx    # Public project page
│       │   │   └── u/[username]/page.tsx
│       │   ├── (auth)/
│       │   │   ├── login/page.tsx
│       │   │   └── signup/page.tsx
│       │   ├── (app)/                 # Requires auth
│       │   │   ├── create/page.tsx    # Creation flow
│       │   │   ├── build/[id]/page.tsx # Builder
│       │   │   ├── projects/page.tsx
│       │   │   └── profile/page.tsx
│       │   └── api/
│       │       ├── ai/
│       │       │   ├── plan/route.ts      # Build plan generation
│       │       │   ├── generate/route.ts  # Full project generation (streaming)
│       │       │   ├── edit/route.ts      # Edit/Change/Add
│       │       │   ├── fix/route.ts       # Fix analysis + patch
│       │       │   └── smarter/route.ts   # Make Smarter
│       │       ├── projects/
│       │       │   ├── route.ts           # CRUD
│       │       │   └── [id]/
│       │       │       ├── publish/route.ts
│       │       │       ├── like/route.ts
│       │       │       └── remix/route.ts
│       │       ├── safety/route.ts        # Safety scan
│       │       └── moderation/route.ts    # Report handling
│       ├── components/
│       │   ├── discover/
│       │   │   ├── Feed.tsx
│       │   │   ├── ProjectCard.tsx
│       │   │   └── CategoryTabs.tsx
│       │   ├── builder/
│       │   │   ├── BuilderLayout.tsx      # Responsive layout switcher
│       │   │   ├── DesktopBuilder.tsx     # 3-panel desktop
│       │   │   ├── MobileBuilder.tsx      # Tabbed mobile
│       │   │   ├── LivePreview.tsx        # Sandboxed iframe
│       │   │   ├── SystemMap.tsx          # Project structure tree
│       │   │   ├── ActionBar.tsx          # Add/Change/Fix/Smarter/Publish
│       │   │   └── actions/
│       │   │       ├── AddPanel.tsx
│       │   │       ├── ChangePanel.tsx
│       │   │       ├── FixPanel.tsx
│       │   │       └── SmarterPanel.tsx
│       │   ├── creation/
│       │   │   ├── TypeSelector.tsx
│       │   │   ├── IntentForm.tsx
│       │   │   ├── BuildPlanDisplay.tsx
│       │   │   └── GenerationProgress.tsx
│       │   ├── project/
│       │   │   ├── ProjectPage.tsx
│       │   │   ├── ProjectCover.tsx       # CSS-generated cover
│       │   │   └── ReportModal.tsx
│       │   ├── profile/
│       │   │   ├── ProfilePage.tsx
│       │   │   └── ProjectGrid.tsx
│       │   └── ui/                        # Design system
│       │       ├── Button.tsx
│       │       ├── Card.tsx
│       │       ├── Input.tsx
│       │       ├── Modal.tsx
│       │       ├── Badge.tsx
│       │       └── Avatar.tsx
│       ├── lib/
│       │   ├── ai/
│       │   │   ├── client.ts             # Anthropic SDK setup
│       │   │   ├── prompts/              # All system prompts
│       │   │   │   ├── generate.ts
│       │   │   │   ├── edit.ts
│       │   │   │   ├── fix.ts
│       │   │   │   └── safety.ts
│       │   │   └── sanitize.ts           # HTML sanitization
│       │   ├── db/
│       │   │   ├── client.ts             # Supabase client
│       │   │   └── queries/              # Typed query functions
│       │   ├── safety/
│       │   │   └── scanner.ts
│       │   ├── rate-limit.ts
│       │   ├── cover.ts                  # CSS cover generation
│       │   └── posthog.ts               # Analytics
│       ├── stores/
│       │   ├── builderStore.ts           # Builder state
│       │   └── userStore.ts
│       └── hooks/
│           ├── useHistory.ts             # In-session undo/redo
│           └── useAutoSave.ts
├── packages/
│   ├── project-meta/                     # Shared TypeScript types for metadata
│   └── prompts/                          # Shared prompt templates
├── templates/                            # Fallback HTML templates (per type)
│   ├── game-fallback.html
│   ├── website-fallback.html
│   ├── story-fallback.html
│   └── tool-fallback.html
└── supabase/
    ├── migrations/
    └── functions/
        └── moderation-worker/            # Edge function: auto-moderation
```

---

# DATABASE SCHEMA

```sql
-- Users (extends Supabase auth.users)
create table public.profiles (
  id            uuid references auth.users primary key,
  username      text unique not null,
  avatar_url    text,
  bio           text,
  account_status text default 'active',
  -- active | warned | restricted | suspended | banned
  restriction_until timestamptz,
  created_at    timestamptz default now()
);

-- Projects
create table public.projects (
  id            uuid primary key default gen_random_uuid(),
  creator_id    uuid references public.profiles not null,
  title         text not null,
  description   text,
  type          text not null,
  -- game | website | tool | story | interface | simulation | world
  meta_json     jsonb default '{}',
  -- lightweight metadata: screens, components, theme. NOT the runnable code.
  bundle_path   text,
  -- path in Supabase Storage: projects/{id}/index.html
  cover_config  jsonb default '{}',
  -- CSS cover parameters: gradient, icon, colors
  visibility    text default 'private',
  -- private | public | removed
  remix_of      uuid references public.projects,
  play_count    integer default 0,
  like_count    integer default 0,
  remix_count   integer default 0,
  published_at  timestamptz,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- Project version history (last 5 versions per project)
create table public.project_versions (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid references public.projects not null,
  bundle_path   text not null,
  meta_json     jsonb default '{}',
  version_num   integer not null,
  created_at    timestamptz default now()
);

-- Likes
create table public.likes (
  user_id       uuid references public.profiles not null,
  project_id    uuid references public.projects not null,
  created_at    timestamptz default now(),
  primary key (user_id, project_id)
);

-- Reports
create table public.reports (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid references public.projects not null,
  reporter_id   uuid references public.profiles not null,
  reason        text not null,
  status        text default 'pending',
  -- pending | safe | actioned
  created_at    timestamptz default now()
);

-- Moderation actions (audit log)
create table public.moderation_actions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references public.profiles not null,
  action_type   text not null,
  -- warning | restrict_publishing | suspend | ban | project_removed
  reason        text not null,
  project_id    uuid references public.projects,
  expires_at    timestamptz,
  created_at    timestamptz default now()
);

-- Notifications
create table public.notifications (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references public.profiles not null,
  type          text not null,
  -- like | remix | play_milestone | publish_success | moderation
  data          jsonb default '{}',
  read          boolean default false,
  created_at    timestamptz default now()
);

-- Indexes
create index idx_projects_public
  on public.projects (visibility, published_at desc)
  where visibility = 'public';

create index idx_projects_creator
  on public.projects (creator_id, created_at desc);

create index idx_projects_type
  on public.projects (type, visibility, published_at desc);

create index idx_projects_remix_of
  on public.projects (remix_of)
  where remix_of is not null;

create index idx_likes_project
  on public.likes (project_id);

create index idx_notifications_user
  on public.notifications (user_id, read, created_at desc);

create index idx_project_versions_project
  on public.project_versions (project_id, version_num desc);

-- Row Level Security
alter table public.profiles         enable row level security;
alter table public.projects         enable row level security;
alter table public.likes            enable row level security;
alter table public.reports          enable row level security;
alter table public.notifications    enable row level security;
alter table public.project_versions enable row level security;

-- Profiles: anyone reads, self updates
create policy "profiles_select" on public.profiles
  for select using (true);
create policy "profiles_update" on public.profiles
  for update using (auth.uid() = id);
create policy "profiles_insert" on public.profiles
  for insert with check (auth.uid() = id);

-- Projects: public reads public, creator reads all own
create policy "projects_select" on public.projects
  for select using (
    visibility = 'public' or creator_id = auth.uid()
  );
create policy "projects_creator_write" on public.projects
  for all using (creator_id = auth.uid());

-- Versions: creator only
create policy "versions_creator" on public.project_versions
  for all using (
    project_id in (
      select id from public.projects where creator_id = auth.uid()
    )
  );

-- Likes: public read, self manage
create policy "likes_select" on public.likes
  for select using (true);
create policy "likes_self" on public.likes
  for all using (user_id = auth.uid());

-- Notifications: self only
create policy "notifications_self" on public.notifications
  for all using (user_id = auth.uid());
```

---

# AI PROMPT ARCHITECTURE

All system prompts use `cache_control: { type: "ephemeral" }` on the system block.
This caches the large system prompt (Kaboom.js docs, HTML patterns, rules) across calls.

## Prompt 1 — Build Plan

```
Model: claude-haiku-4-5

System (cached):
You are Barshi's build planner. Generate exciting, achievable build plans for young creators (ages 11-15).
Output ONLY valid JSON. No markdown. No explanation.

Output format:
{
  "title": "suggested project title",
  "type": "game|website|tool|story|interface|simulation|world",
  "summary": "one exciting sentence about what this will be",
  "screens": ["Screen names as strings"],
  "components": ["Key feature names"],
  "rules": ["Key interactions: when X → Y"],
  "theme": "visual direction as a string",
  "usesKaboom": true/false
}

Rules:
- Keep components list under 8 items
- Keep rules list under 6 items
- Make the summary exciting and creator-focused

User: [intent form JSON]
```

## Prompt 2 — Full Project Generation

```
Model: claude-sonnet-4-6

System (cached, large):
You are Barshi's project generator. Generate complete, self-contained HTML files for a creation platform used by kids aged 11-15.

KABOOM.JS GAMES:
- Always use: <script src="https://cdn.barshi.app/kaboom/kaboom.min.js"></script>
- Initialize with: kaboom({ background: [r,g,b] })
- Use scene(), add(), onCollide(), onKeyDown(), etc.
- Include: start screen, game scene, win scene, lose scene (minimum)
- Keep code simple and readable
- Game must be immediately playable with keyboard or mouse

WEBSITES AND TOOLS:
- Pure HTML/CSS/JS only
- No external resources
- CSS must be modern and responsive
- Include all pages/screens within one HTML file using show/hide divs
- Navigation must work without page reload

ALL PROJECTS:
- Output ONLY a complete HTML file. Nothing else.
- No markdown, no explanation, no code blocks
- File must be completely self-contained
- No localStorage, sessionStorage, cookies
- No fetch() or XHR to external URLs
- No window.parent, window.top access
- No navigator API usage
- Target viewport: 390px wide (mobile-first)

SAFETY RULES (never include):
- Personal info collection forms (email, phone, real name, address)
- User-generated content storage
- Chat or messaging features
- Anything that could identify real people

User: [approved build plan JSON]
```

## Prompt 3 — Edit / Change / Add

```
Model: claude-haiku-4-5

System (cached):
You are Barshi's project editor. Given HTML code and an edit request, return ONLY the updated complete HTML file.
Apply the exact change requested. Keep everything else identical.
Preserve all existing functionality. Output ONLY the complete HTML. No explanation.

User:
CURRENT HTML:
[current HTML — truncated to 8000 tokens max]

EDIT REQUEST:
[user's change request in plain language]

METADATA:
[project meta_json]
```

## Prompt 4 — Fix

```
Model: claude-sonnet-4-6

System (cached):
You are Barshi's project quality checker. Analyze HTML/JS projects for issues.
Output ONLY valid JSON.

Output format:
{
  "issues": [
    {
      "id": "unique-id",
      "title": "Short title of the issue",
      "description": "Simple explanation for a 12-year-old. What's wrong and why it matters.",
      "severity": "critical|warning|suggestion",
      "fix": "Complete updated HTML with this issue fixed"
    }
  ]
}

Check for:
- Buttons with no action
- Missing win/lose conditions in games
- Broken navigation (links to nothing)
- Missing start screen
- Game that can't end
- Layout broken on mobile
- Text that's too small to read
- Missing main call-to-action in websites

User: [project HTML]
```

## Prompt 5 — Make Smarter

```
Model: claude-sonnet-4-6

System (cached):
You are Barshi's creative improver. Given a project and improvement request, enhance it meaningfully.
Output JSON with the improved HTML and a simple summary of what changed.

Output format:
{
  "html": "complete updated HTML",
  "changes": ["What changed — in simple language", "..."]
}

User:
PROJECT: [current HTML]
IMPROVE: [user's request]
```

## Prompt 6 — Safety Scan

```
Model: claude-haiku-4-5

System (cached):
You are a content safety system for a platform used by children aged 11-15.
Analyze content for safety issues. Output ONLY valid JSON.

Output format:
{
  "safe": true/false,
  "severity": "none|low|medium|high",
  "reasons": ["list of issues found, empty if safe"],
  "action": "allow|flag|block"
}

Check for: bullying, harassment, hate speech, sexual content, extreme violence,
self-harm, personal information (real names, phone numbers, addresses, school names),
targeting real classmates, spam.

User:
TITLE: [title]
DESCRIPTION: [description]
VISIBLE TEXT: [extracted text from HTML]
```

---

# HTML SANITIZATION

Before any generated HTML is stored or served, it is sanitized.

```typescript
// lib/ai/sanitize.ts

const BLOCKED_PATTERNS = [
  /window\.parent/gi,
  /window\.top/gi,
  /window\.opener/gi,
  /document\.cookie/gi,
  /localStorage/gi,
  /sessionStorage/gi,
  /indexedDB/gi,
  /navigator\.(geolocation|camera|mediaDevices|permissions)/gi,
  /new\s+WebSocket/gi,
  /eval\s*\(/gi,
  /Function\s*\(/gi,
  /<script[^>]*src\s*=\s*["'][^"']*(?!cdn\.barshi\.app)[^"']*["']/gi,
  // Blocks all external scripts except barshi CDN
];

const ALLOWED_CDN = [
  'https://cdn.barshi.app/',
];

export function sanitizeHTML(html: string): {
  clean: string;
  blocked: string[];
} {
  const blocked: string[] = [];
  let clean = html;

  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(clean)) {
      blocked.push(pattern.toString());
      clean = clean.replace(pattern, '/* blocked */');
    }
  }

  return { clean, blocked };
}
```

**CSP header on `play.barshi.app`:**
```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'unsafe-inline' https://cdn.barshi.app;
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob:;
  connect-src 'none';
  frame-ancestors 'self' https://barshi.app https://*.barshi.app;
```

---

# FALLBACK TEMPLATES

If Claude generation fails (error, timeout, invalid HTML), the system falls back to a working template parameterized with the build plan data.

```
templates/
├── game-fallback.html       # Kaboom.js template: platform game, parameterized title/colors
├── website-fallback.html    # 3-page website template: home/about/CTA
├── story-fallback.html      # Choice-based story template with 4 scenes
└── tool-fallback.html       # Input → output tool template
```

Each template is filled with: title, colors from theme, component names from build plan.

The fallback must feel good enough that the user doesn't know something went wrong.
Show: "Here's a starting version — now make it yours."

---

# THUMBNAIL STRATEGY

## MVP: CSS Cover Cards

No screenshots. No Puppeteer. No external services.

Each project gets a `cover_config` JSON:
```json
{
  "gradientFrom": "#1a1a2e",
  "gradientTo": "#16213e",
  "accentColor": "#00ff88",
  "icon": "🎮",
  "patternType": "dots"
}
```

The cover is rendered as a pure CSS card in the browser.

```tsx
// components/project/ProjectCover.tsx
// Renders a beautiful CSS-based cover from cover_config
// No image needed. Works everywhere. Loads instantly.
```

Claude generates the `cover_config` as part of project generation based on the theme.

## Post-MVP: Real Screenshots

Use Browserless.io API:
- Call after first publish
- Screenshot the sandbox iframe
- Store WebP thumbnail in Supabase Storage
- Replace CSS cover with actual screenshot

---

# BUILDER SCREEN — RESPONSIVE UX

## Desktop (≥ 768px): 3-Panel Layout

```
┌─────────────────────────────────────────────────────────┐
│  Barshi logo    [Title]    [Publish]    [avatar]         │  Header
├──────────┬──────────────────────────────┬────────────────┤
│          │                              │                │
│ System   │       Live Preview           │  Action Panel  │
│ Map      │    (sandboxed iframe)        │                │
│          │                              │  [Add]         │
│ Screen 1 │   ┌────────────────────┐     │  [Change]      │
│ Screen 2 │   │   Running project  │     │  [Fix]         │
│ Screen 3 │   │   in sandbox       │     │  [Smarter]     │
│          │   └────────────────────┘     │                │
│ Player   │                              │                │
│ Enemies  │                              │                │
│ Score    │                              │                │
│          │                              │                │
└──────────┴──────────────────────────────┴────────────────┘
  250px          flex-1 (takes remaining)    320px
```

## Mobile (< 768px): Tabbed Layout

```
┌──────────────────────────────┐
│  ← Barshi       [Publish]   │  Header
├──────────────────────────────┤
│                              │
│                              │
│     Active Tab Content       │  Full height
│                              │
│                              │
│                              │
├──────────────────────────────┤
│  [Preview] [Structure] [Do]  │  Bottom tab bar
└──────────────────────────────┘
```

- **Preview tab:** Full-screen live sandbox iframe
- **Structure tab:** System Map (full height, scrollable)
- **Do tab:** Action buttons (Add, Change, Fix, Smarter, Publish) with bottom sheet for each

When user taps an action on mobile, a bottom sheet slides up:
```
┌──────────────────────────────┐
│  ▔▔▔▔▔▔▔ (drag handle)      │
│  Change something            │
│                              │
│  What do you want to change? │
│  ┌────────────────────────┐  │
│  │ type here...           │  │
│  └────────────────────────┘  │
│                              │
│  Quick suggestions:          │
│  [make it darker]            │
│  [change the color]          │
│  [make text bigger]          │
│                              │
│          [Apply Change]      │
└──────────────────────────────┘
```

---

# VERSION HISTORY

In-session undo/redo is memory-based (fast):
```typescript
// hooks/useHistory.ts
// Keeps last 20 HTML states in a circular buffer in memory
// Undo = pop previous state, update preview
// Redo = go forward in buffer
```

Cross-session version history is Supabase-based (last 5 versions):
```typescript
// Stored in project_versions table
// Triggered on: Publish, "Save version" button
// Not on every auto-save (too many writes)
// Visible in builder as: "Restore previous version" dropdown
```

Auto-save (Supabase) fires every 30 seconds of inactivity (debounced):
- Saves HTML bundle + meta_json to current project row
- Does NOT create a new project_versions entry

---

# PRODUCT ANALYTICS (POSTHOG)

Track these events to measure the core loop:

```typescript
// lib/posthog.ts

export const EVENTS = {
  // Creation funnel
  CREATE_STARTED: 'create_started',           // opens /create
  TYPE_SELECTED: 'type_selected',             // picks Game/Website/etc
  INTENT_SUBMITTED: 'intent_submitted',       // submits intent form
  PLAN_APPROVED: 'plan_approved',             // approves build plan
  GENERATION_STARTED: 'generation_started',
  GENERATION_COMPLETE: 'generation_complete', // HTML received
  GENERATION_FAILED: 'generation_failed',     // timeout or error

  // Builder
  EDIT_MADE: 'edit_made',                     // any Add/Change/Fix/Smarter
  UNDO_USED: 'undo_used',
  VERSION_RESTORED: 'version_restored',

  // Publish funnel
  PUBLISH_STARTED: 'publish_started',
  SAFETY_BLOCKED: 'safety_blocked',           // pre-publish block
  PUBLISH_COMPLETE: 'publish_complete',       // project goes live

  // Community
  PROJECT_PLAYED: 'project_played',           // someone opens a project
  LIKE_CLICKED: 'like_clicked',
  REMIX_CLICKED: 'remix_clicked',
  PROFILE_VIEWED: 'profile_viewed',
  SEARCH_USED: 'search_used',

  // Safety
  REPORT_SUBMITTED: 'report_submitted',
} as const;
```

Key funnels to track:
1. `create_started → generation_complete` (generation success rate, target: >85%)
2. `generation_complete → publish_complete` (publish rate, target: >40%)
3. `project_played → remix_clicked` (remix rate, target: >20%)

PostHog session recordings: enable for first 2 weeks post-launch to watch real user behavior.

---

# ERROR HANDLING STRATEGY

## AI Generation Fails

Scenario: Claude times out, returns invalid HTML, or errors.

```
1. Retry once automatically (after 2s)
2. If second attempt fails → use fallback template
3. Show to user: "Here's a starting version — now make it yours."
4. Log error to Sentry with: intent, build plan, error message
5. Never show a raw error to the user
```

## HTML Sanitization Catches Something

```
1. Log blocked pattern to Sentry (no PII)
2. If blocked patterns are non-critical → clean and continue
3. If blocked patterns are critical (window.parent, eval) → use fallback template
4. Never serve unsanitized HTML to any iframe
```

## Supabase Storage Upload Fails

```
1. Retry 3 times with exponential backoff
2. If all fail → save meta to DB, mark bundle_path as null
3. Show builder with error state: "Saving failed. Try again."
4. Never lose the user's work — keep HTML in memory
```

## Rate Limit Hit

```
1. Show friendly message: "You've used all 3 creations today."
2. Offer: "Come back tomorrow" or "Go Pro for unlimited"
3. Do NOT show a 429 error or any technical language
```

---

# TIMELINE (WITH TEAM ASSUMPTIONS)

**Assumptions:** 2 developers. 1 senior full-stack, 1 frontend.
Solo developer: multiply all weeks by 2.5–3.

| Week | Phase | Key Deliverable | Risk |
|---|---|---|---|
| 1–2 | 0: Foundation | Auth, DB, Claude connected, design system, sandbox CDN | Low |
| 3–4 | 1A: Generation | Intent form → build plan → generation → sanitized HTML stored | HIGH |
| 5–6 | 1B: Builder | Live preview iframe, System Map, action toolbar, auto-save | HIGH |
| 7 | 2: Builder Actions | Add/Change/Fix/Make Smarter all work end-to-end | Medium |
| 8 | 3A: Publish | Publish flow, CSS covers, public project page | Low |
| 9 | 3B: Discovery | Discover feed, search, category explore | Low |
| 10 | 4A: Identity | Signup flow, creator profiles, My Projects | Low |
| 11 | 4B: Community | Likes, remixes with lineage, stats | Low |
| 12 | 5A: Safety | Pre-publish scan, report system | Medium |
| 13 | 5B: Moderation | Auto-moderation, removal, enforcement levels | Medium |
| 14 | 6A: Analytics | PostHog integration, funnel events, session recordings | Low |
| 15 | 6B: Polish | Animations, empty states, error states, responsive pass | Low |
| 16 | 6C: Launch Prep | Seed content, legal pages, monitoring, soft launch | Low |

**Highest risk phases: 1A and 1B.**
If generation quality is bad or builder UX is confusing, nothing else matters.
Allocate extra time here. Consider a "generation quality sprint" after week 4.

---

# GENERATION QUALITY STRATEGY

Generation quality is the product. It must be tested obsessively.

## Quality Test Suite

Build a test suite of 20 canonical prompts:
```
Games:
- "zombie survival game with 3 levels"
- "platformer game with coins and enemies"
- "space shooter with a boss"
- "racing game with 3 tracks"
- "quiz game about animals"

Websites:
- "sneaker store website"
- "portfolio website for a photographer"
- "restaurant menu website"
- "fan page for my favorite band"

Stories:
- "haunted house adventure with 3 endings"
- "mystery detective story"
- "choose your own adventure in space"

Tools:
- "grade calculator for school"
- "daily habit tracker"
- "random name picker"
```

For each prompt: generate 3 times, evaluate output on:
- Does it run without errors? (0/1)
- Is it immediately playable/usable? (0/1)
- Does it match what was asked? (0-3)
- Does it feel polished? (0-3)
- Is it mobile-friendly? (0/1)

Target before launch: average score > 6/8, 100% run-without-errors rate.

## Prompt Improvement Loop

If a prompt type consistently produces bad output:
1. Identify the failure pattern
2. Add a specific rule to the system prompt
3. Re-test that prompt type
4. Ship system prompt update (no deploy needed — system prompt is in DB or env var)

---

# SEED CONTENT PLAN

Before soft launch, create 25–30 seed projects manually.

Mix:
- 8 games (varied types and themes)
- 7 websites (varied niches)
- 5 interactive stories
- 5 tools
- 5 simulations/worlds

Quality bar: each seed project must feel like something a real 13-year-old would be excited to see or remix.

Use internal team accounts with realistic usernames and avatars.

Do not make seed content feel corporate or overly polished.
Make it feel like a real community of young creators.

---

# SOFT LAUNCH CRITERIA (before opening to public)

All of the following must be true:

- [ ] Generation success rate (runs without JS errors): ≥ 90%
- [ ] Average generation time: ≤ 15 seconds
- [ ] Publish flow completion rate (started → done): ≥ 80%
- [ ] Safety scan correctly blocks test harmful content: 100%
- [ ] Zero reports of real harmful content reaching public feed in testing
- [ ] Mobile builder works on iPhone 14 (Safari) and Galaxy S23 (Chrome)
- [ ] Desktop builder works on Chrome, Safari, Firefox
- [ ] Page load time (Discover feed): ≤ 2 seconds
- [ ] 25+ seed projects live in discover feed
- [ ] Rate limiting works (verified manually)
- [ ] Error states are friendly (no raw errors anywhere)
- [ ] Legal pages live (Terms, Privacy, Community Guidelines)

---

# POST-MVP ROADMAP

## V1.1 — Notifications (2 weeks)
- In-app notification center
- Events: like, remix, play milestone (10/50/100)
- Badge on nav, notification bell

## V1.2 — Achievements (1 week)
- First publish, first remix, 10 likes, 100 plays
- Subtle display on profile

## V1.3 — Creator Levels (1 week)
- Maker → Builder → Creator → Legend
- Based on total plays + projects
- Badge on project cards and profiles

## V1.4 — Leaderboards (1 week)
- Most Liked / Played / Remixed
- By type, by time range

## V1.5 — Kaboom.js Logic Blocks (4 weeks)
- Visual when→then editor for game rules
- Supplements natural language editing
- "when player hits enemy → lose 10 health"

## V1.6 — Real Screenshots (1 week)
- Replace CSS covers with Browserless.io screenshots
- Run after publish, store as WebP

## V1.7 — Parent Mode (3 weeks)
- Optional parent account link via email
- Weekly summary: what their child published
- Parent can set: publish requires approval

## V2.0 — Barshi Pro (~$8/month)
- Unlimited daily generations (vs 3 free)
- Custom published project domain
- Exclusive visual themes
- Priority generation queue

## V2.1 — Barshi School (annual B2B)
- Teacher dashboard + class management
- Assignment creation and submission
- Student analytics
- COPPA/GDPR compliant
- Per-seat pricing, annual contract

## V3.0 — Mobile Apps
- iOS and Android (React Native or PWA)
- Push notifications
- Offline draft editing

---

# THE MOST IMPORTANT THING

Before any of this:

**The moment a 12-year-old types "make a zombie game" and sees a working, playable game appear in under 15 seconds must feel like magic.**

Everything in this plan exists to support that moment.

Start there. Nail that. Build everything else around it.
