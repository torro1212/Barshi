import { describe, it, expect } from 'vitest'
import { sanitizeHTML, extractVisibleText } from './sanitize'

/** Convenience: does the cleaned output still contain a dangerous substring? */
function clean(html: string) {
  return sanitizeHTML(html)
}

describe('sanitizeHTML — frame escape blocking', () => {
  it('blocks window.parent/top/opener (dot access)', () => {
    for (const prop of ['parent', 'top', 'opener']) {
      const r = clean(`<script>window.${prop}.location = 'x'</script>`)
      expect(r.html).not.toContain(`window.${prop}`)
      expect(r.safe).toBe(false)
    }
  })

  it('blocks bracket-notation frame access', () => {
    const r = clean(`<script>window["parent"].postMessage(1)</script>`)
    expect(r.html).not.toMatch(/window\s*\[\s*["']parent["']\s*\]/)
    expect(r.blocked.join(' ')).toMatch(/bracket/)
  })

  it('blocks globalThis and self frame access', () => {
    const r1 = clean(`<script>globalThis.top.x = 1</script>`)
    expect(r1.html).not.toContain('globalThis.top')
    const r2 = clean(`<script>self.opener.y = 1</script>`)
    expect(r2.html).not.toContain('self.opener')
  })
})

describe('sanitizeHTML — storage & cookies', () => {
  it('blocks cookie and document.domain', () => {
    expect(clean('<script>document.cookie="a=1"</script>').html).not.toContain('document.cookie')
    expect(clean('<script>document.domain="evil"</script>').html).not.toContain('document.domain')
  })

  it('blocks indexedDB', () => {
    const r = clean(`<script>indexedDB.open('x')</script>`)
    expect(r.html).not.toContain('indexedDB.open')
  })

  it('keeps localStorage code intact and injects a safe in-memory shim', () => {
    // Real bug this guards against: stripping the identifier turned
    // JSON.parse(localStorage.getItem(...)) into a syntax error that killed
    // the whole script. Now the user's code is preserved and backed by an
    // in-memory Storage shim (no persistence, no leak).
    const r = clean(`<script>const c = JSON.parse(localStorage.getItem('cart')) || {}; localStorage.setItem('cart','1')</script>`)
    expect(r.html).toContain("localStorage.getItem('cart')")
    expect(r.html).toContain("localStorage.setItem('cart'")
    // shim present
    expect(r.html).toMatch(/Object\.defineProperty\(window, 'localStorage'/)
  })
})

describe('sanitizeHTML — network egress', () => {
  it('blocks WebSocket, EventSource', () => {
    expect(clean('<script>new WebSocket("wss://x")</script>').html).not.toContain('new WebSocket')
    expect(clean('<script>new EventSource("/x")</script>').html).not.toContain('new EventSource')
  })

  it('blocks sendBeacon and window.open calls', () => {
    // Note: the injected runtime-lockdown script legitimately *mentions* these
    // APIs (it reassigns them defensively), so we assert the user's CALL form
    // was neutralized and the block was recorded — not that the string vanishes.
    const beacon = clean('<script>navigator.sendBeacon("/x")</script>')
    expect(beacon.html).not.toContain('sendBeacon("/x")')
    expect(beacon.blocked.join(' ')).toMatch(/device API/)

    const open = clean('<script>window.open("http://x")</script>')
    expect(open.html).not.toContain('window.open("http://x")')
    expect(open.blocked.join(' ')).toMatch(/window\.open/)
  })
})

describe('sanitizeHTML — code execution', () => {
  it('blocks eval, Function constructor, dynamic import', () => {
    expect(clean('<script>eval("1+1")</script>').html).not.toMatch(/eval\s*\(/)
    expect(clean('<script>new Function("return 1")</script>').html).not.toMatch(/new\s+Function\s*\(/)
    expect(clean('<script>import("http://evil/x.js")</script>').html).not.toMatch(/\bimport\s*\(/)
  })

  it('blocks string-form setTimeout/setInterval but allows function-form', () => {
    expect(clean(`<script>setTimeout("alert(1)", 10)</script>`).html).not.toContain('setTimeout("')
    const fnForm = clean(`<script>setTimeout(function(){ score++ }, 10)</script>`)
    expect(fnForm.html).toContain('setTimeout(function()')
  })
})

describe('sanitizeHTML — external scripts', () => {
  it('blocks arbitrary external scripts', () => {
    const r = clean('<script src="https://evil.com/x.js"></script>')
    expect(r.html).not.toContain('evil.com')
    expect(r.blocked.join(' ')).toMatch(/external script/)
  })

  it('allows Kaboom CDNs on the allow-list (legacy games)', () => {
    const r = clean('<script src="https://unpkg.com/kaboom@3000.1.17/dist/kaboom.js"></script>')
    expect(r.html).toContain('unpkg.com/kaboom')
  })

  it('allows the Phaser CDN (current engine)', () => {
    const r = clean('<script src="https://cdn.jsdelivr.net/npm/phaser@3/dist/phaser.min.js"></script>')
    expect(r.html).toContain('cdn.jsdelivr.net/npm/phaser')
    expect(r.blocked).toHaveLength(0)
  })

  it('rewrites placeholder cdn.barshi.app kaboom URL to a real CDN', () => {
    const r = clean('<script src="https://cdn.barshi.app/kaboom/kaboom.min.js"></script>')
    expect(r.html).toContain('unpkg.com/kaboom')
    expect(r.html).not.toContain('cdn.barshi.app/kaboom')
  })
})

describe('sanitizeHTML — dangerous HTML constructs', () => {
  it('strips external stylesheet/font links (Google Fonts etc.)', () => {
    const r = clean('<html><head><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap"></head><body></body></html>')
    expect(r.html).not.toContain('fonts.googleapis.com')
    expect(r.blocked.join(' ')).toMatch(/external stylesheet/)
  })

  it('strips meta refresh, base, object/embed/applet', () => {
    const r = clean(`
      <meta http-equiv="refresh" content="0;url=http://evil">
      <base href="http://evil/">
      <object data="x.swf"></object>
      <embed src="y">
      <applet code="z"></applet>
    `)
    expect(r.html).not.toMatch(/<base\b/i)
    expect(r.html).not.toMatch(/http-equiv=["']?refresh/i)
    expect(r.html).not.toMatch(/<object\b/i)
    expect(r.html).not.toMatch(/<embed\b/i)
    expect(r.html).not.toMatch(/<applet\b/i)
  })

  it('removes a model-supplied CSP meta and injects our own', () => {
    const r = clean(`<meta http-equiv="Content-Security-Policy" content="default-src *"><body></body>`)
    expect(r.html).not.toContain('default-src *')
    // Our strict CSP is present
    expect(r.html).toContain("connect-src 'none'")
  })
})

describe('sanitizeHTML — injected guards', () => {
  it('injects CSP meta and runtime lockdown into every document', () => {
    const r = clean('<html><head></head><body></body></html>')
    expect(r.html).toContain('Content-Security-Policy')
    expect(r.html).toContain('runtime lockdown active')
    expect(r.html).toContain('Object.is') // polyfill
  })

  it('strips quoted font: options in Kaboom docs but leaves CSS font rules alone', () => {
    const r = clean('<html><head><style>h1{font-family:"Segoe UI";font-size:20px}</style></head><body><script>kaboom({font:"sans-serif"}); add([text("hi",{size:20,font:"sans-serif"})])</script></body></html>')
    expect(r.html).not.toMatch(/\bfont\s*:\s*["']sans-serif["']/)
    // CSS untouched
    expect(r.html).toContain('font-family:"Segoe UI"')
    expect(r.html).toContain('font-size:20px')
  })

  it('injects the Kaboom compat shim only for Kaboom documents', () => {
    const game = clean('<html><head></head><body><script src="https://cdn.barshi.app/kaboom/kaboom.min.js"></script><script>kaboom()</script></body></html>')
    expect(game.html).toContain('isMouseDown')
    expect(game.html).toContain("fwd('gravity','setGravity')")

    const site = clean('<html><head></head><body><h1>hi</h1></body></html>')
    expect(site.html).not.toContain("fwd('gravity'")
  })

  it('is idempotent — sanitizing already-sanitized output is a no-op', () => {
    const first = clean('<html><head></head><body><script>eval("x")</script></body></html>').html
    const second = sanitizeHTML(first)
    expect(second.html).toBe(first)
    expect(second.safe).toBe(true)
    // guards must appear exactly once, not duplicated
    const cspCount = (second.html.match(/Content-Security-Policy/g) ?? []).length
    expect(cspCount).toBe(1)
  })
})

describe('sanitizeHTML — code fences & asset hallucinations', () => {
  it('strips an outer markdown code fence', () => {
    const r = clean('```html\n<html><body>hi</body></html>\n```')
    expect(r.html).not.toMatch(/^```/)
    expect(r.html).not.toMatch(/```$/)
  })

  it('removes fabricated data: asset loads', () => {
    const r = clean('<script>loadSound("boom", "data:audio/wav;base64,AAAA")</script>')
    expect(r.html).not.toContain('data:audio/wav')
    expect(r.blocked.join(' ')).toMatch(/fake asset/)
  })
})

describe('sanitizeHTML — benign project', () => {
  it('leaves a clean Kaboom game essentially intact and marks it safe', () => {
    const good = '<html><head></head><body><script src="https://cdn.barshi.app/kaboom/kaboom.min.js"></script><script>kaboom(); add([rect(10,10)]); setTimeout(function(){}, 5)</script></body></html>'
    const r = clean(good)
    expect(r.safe).toBe(true)
    expect(r.blocked).toHaveLength(0)
    expect(r.html).toContain('kaboom()')
  })
})

describe('extractVisibleText', () => {
  it('strips scripts, styles, and tags, collapsing whitespace', () => {
    const text = extractVisibleText('<style>.a{color:red}</style><script>var x=1</script><h1>Hello</h1>  <p>World</p>')
    expect(text).toBe('Hello World')
  })

  it('truncates to 2000 characters', () => {
    const long = '<p>' + 'a'.repeat(5000) + '</p>'
    expect(extractVisibleText(long).length).toBe(2000)
  })
})
