'use client'

import { useMemo } from 'react'
import { TYPE_META } from '@/components/ui/TypeIcon'
import type { BuildPlan, ProjectType } from '@/types'

/** Escape user/plan text before dropping it into the mockup HTML string. */
function esc(s: string): string {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/** Build a realistic, themed, NON-interactive mock-up of the project's first
 *  screen — real fonts, gradients, layout — rendered in a sandboxed iframe.
 *  It's still a preview (no game logic), but looks close to the real thing. */
function buildMockup(plan: BuildPlan, accent: string): string {
  const title = esc(plan.title)
  const summary = esc(plan.summary || '')
  const screens = plan.screens.slice(0, 5).map(esc)
  const comps = plan.components.slice(0, 6).map(esc)

  const base = `
    * { margin:0; box-sizing:border-box; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; }
    body { height:100vh; overflow:hidden; color:#fff; background:
      radial-gradient(ellipse at 50% 0%, ${accent}22 0%, transparent 60%),
      linear-gradient(160deg, #0c0c1a 0%, #05050c 100%); }
    .accent { color:${accent}; }
    .btn { background:${accent}; color:#08080f; font-weight:800; border:none; border-radius:10px; padding:10px 22px; font-size:15px; box-shadow:0 0 22px ${accent}77; }
    .btn-o { background:${accent}1a; color:${accent}; border:2px solid ${accent}66; border-radius:10px; padding:8px 18px; font-weight:700; font-size:13px; }
  `

  function game(): string {
    // dark canvas, title, glowing PLAY, faux HUD + shapes
    return `<style>${base}
      .wrap{height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;position:relative;}
      .dots{position:absolute;inset:0;background-image:radial-gradient(${accent}55 1px, transparent 1px);background-size:22px 22px;opacity:.5;}
      .hud{position:absolute;top:12px;left:0;right:0;display:flex;justify-content:space-between;padding:0 16px;font-weight:800;font-size:13px;}
      .title{font-size:clamp(26px,7vw,44px);font-weight:900;text-align:center;line-height:1.05;text-shadow:0 0 24px ${accent}88;padding:0 16px;}
      .enemy{position:absolute;border-radius:6px;opacity:.9;}
    </style>
    <div class="wrap">
      <div class="dots"></div>
      <div class="hud"><span class="accent">SCORE 0</span><span class="accent">♥ ♥ ♥</span></div>
      <div class="enemy" style="width:26px;height:26px;background:${accent};top:26%;left:22%;"></div>
      <div class="enemy" style="width:20px;height:20px;background:#fff;opacity:.6;top:34%;right:24%;"></div>
      <div class="title accent">${title}</div>
      <div style="opacity:.8;font-size:14px;text-align:center;padding:0 24px;max-width:80%;">${summary}</div>
      <button class="btn">▶ PLAY</button>
    </div>`
  }

  function website(): string {
    const nav = screens.map((s, i) => `<span style="${i === 0 ? `color:${accent};font-weight:700;` : 'opacity:.6;'}">${s}</span>`).join('')
    const cards = comps.slice(0, 3).map((c) => `
      <div style="background:#ffffff08;border:1px solid #ffffff12;border-radius:12px;padding:14px;">
        <div style="width:30px;height:30px;border-radius:8px;background:${accent}33;border:1px solid ${accent}55;margin-bottom:8px;"></div>
        <div style="font-weight:700;font-size:13px;">${c}</div>
        <div style="opacity:.5;font-size:11px;margin-top:4px;">Lorem detail about this.</div>
      </div>`).join('')
    return `<style>${base}
      .nav{display:flex;gap:16px;align-items:center;padding:14px 18px;font-size:13px;border-bottom:1px solid #ffffff10;}
      .hero{padding:34px 20px;text-align:center;}
      .h1{font-size:clamp(24px,5vw,40px);font-weight:900;line-height:1.1;}
      .grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;padding:0 18px;}
    </style>
    <div class="nav"><b class="accent" style="margin-right:auto;">${title}</b>${nav}</div>
    <div class="hero">
      <div class="h1">${summary || title}</div>
      <button class="btn" style="margin-top:16px;">Get started</button>
    </div>
    <div class="grid">${cards}</div>`
  }

  function tool(): string {
    return `<style>${base}
      .wrap{height:100vh;display:flex;align-items:center;justify-content:center;padding:20px;}
      .card{width:100%;max-width:420px;background:#ffffff08;border:1px solid #ffffff14;border-radius:16px;padding:22px;}
      .lbl{font-size:12px;opacity:.6;margin-bottom:6px;}
      .inp{width:100%;height:44px;border-radius:10px;background:#ffffff10;border:1px solid ${accent}44;margin-bottom:14px;}
    </style>
    <div class="wrap"><div class="card">
      <div style="font-weight:900;font-size:20px;margin-bottom:4px;" class="accent">${title}</div>
      <div style="opacity:.6;font-size:13px;margin-bottom:18px;">${summary}</div>
      <div class="lbl">${comps[0] || 'Your input'}</div>
      <div class="inp"></div>
      <button class="btn" style="width:100%;">${comps[1] || 'Go'}</button>
      <div style="margin-top:16px;height:56px;border-radius:10px;background:${accent}12;border:1px dashed ${accent}44;"></div>
    </div></div>`
  }

  function story(): string {
    const choices = (comps.length ? comps.slice(0, 3) : ['Go left', 'Go right', 'Wait']).map((c) =>
      `<button class="btn-o" style="display:block;width:100%;text-align:left;margin-top:8px;">${c}</button>`).join('')
    return `<style>${base}
      .wrap{height:100vh;display:flex;flex-direction:column;justify-content:flex-end;padding:20px;gap:6px;
        background:radial-gradient(ellipse at 50% 20%, ${accent}22 0%, transparent 55%), linear-gradient(160deg,#0c0c1a,#05050c);}
      .t{font-size:clamp(20px,5vw,30px);font-weight:900;} 
    </style>
    <div class="wrap">
      <div class="t accent">${title}</div>
      <div style="opacity:.85;font-size:14px;line-height:1.6;margin:6px 0 10px;">${summary || 'Your adventure begins…'}</div>
      ${choices}
    </div>`
  }

  const byType: Record<string, () => string> = {
    game, website, tool, story,
    interface: website, simulation: game, world: game,
  }
  const bodyHtml = (byType[plan.type] ?? game)()
  return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>${bodyHtml}</body></html>`
}

/** Cheap stable hash of a string — used to force the iframe to remount when
 *  its content changes (Safari/iOS does not reliably reload on srcdoc change). */
function hash(s: string): string {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return String(h)
}

export function ConceptSketch({ plan }: { plan: BuildPlan }) {
  const { accent } = TYPE_META[plan.type] ?? TYPE_META.game
  const wide = (['website', 'tool', 'interface'] as ProjectType[]).includes(plan.type)
  const srcDoc = useMemo(() => buildMockup(plan, accent), [plan, accent])

  return (
    <div
      className="relative rounded-[var(--radius-lg)] overflow-hidden border p-3"
      style={{ borderColor: `${accent}33`, background: `radial-gradient(ellipse at 50% 0%, ${accent}12 0%, var(--color-surface-2) 70%)` }}
    >
      <div className="flex items-center justify-between mb-2.5 px-1">
        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: accent }}>Preview sketch</span>
        <span className="text-[10px] text-[var(--color-text-dim)]">a peek — the real one is interactive</span>
      </div>

      <div className="flex justify-center">
        <div
          className="rounded-xl overflow-hidden border-2 shadow-2xl bg-black"
          style={{
            borderColor: `${accent}55`,
            width: '100%',
            maxWidth: wide ? 420 : 300,
            aspectRatio: wide ? '16 / 10' : '10 / 16',
          }}
        >
          <iframe
            key={hash(srcDoc)}
            srcDoc={srcDoc}
            sandbox=""
            title="Concept preview"
            className="w-full h-full block border-0"
            style={{ pointerEvents: 'none' }}
          />
        </div>
      </div>
    </div>
  )
}
