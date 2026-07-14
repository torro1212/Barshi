/**
 * HTML sanitizer for AI-generated project bundles.
 * Blocks dangerous browser APIs before HTML is stored or served.
 */

interface SanitizeResult {
  html: string
  blocked: string[]
  safe: boolean
}

const BLOCKED_PATTERNS: { pattern: RegExp; reason: string }[] = [
  { pattern: /window\.(parent|top|opener)/gi,         reason: 'frame escape attempt' },
  { pattern: /window\s*\[\s*["'`](?:parent|top|opener)["'`]\s*\]/gi, reason: 'frame escape attempt (bracket access)' },
  { pattern: /globalThis\s*(?:\.\s*|\[\s*["'`])(?:parent|top|opener)/gi, reason: 'frame escape attempt (globalThis)' },
  { pattern: /\bself\.(parent|top|opener)/gi,         reason: 'frame escape attempt (self)' },
  { pattern: /document\.cookie/gi,                    reason: 'cookie access' },
  { pattern: /document\.domain/gi,                    reason: 'document.domain access' },
  // NOTE: localStorage/sessionStorage are NOT string-replaced — that breaks
  // valid code mid-expression. Instead we inject a safe in-memory shim (see
  // injectRuntimeGuards) so generated sites/tools that use storage just work
  // inside the sandbox without persisting anything or leaking data.
  { pattern: /indexedDB/gi,                           reason: 'indexedDB access' },
  { pattern: /navigator\.(geolocation|camera|mediaDevices|permissions|credentials|sendBeacon|serviceWorker)/gi, reason: 'device API access' },
  { pattern: /new\s+WebSocket\s*\(/gi,                reason: 'WebSocket connection' },
  { pattern: /new\s+EventSource\s*\(/gi,              reason: 'EventSource connection' },
  { pattern: /eval\s*\(/gi,                           reason: 'eval usage' },
  { pattern: /new\s+Function\s*\(/gi,                 reason: 'Function constructor' },
  { pattern: /\bimport\s*\(/gi,                       reason: 'dynamic import' },
  { pattern: /window\.open\s*\(/gi,                   reason: 'window.open' },
  { pattern: /setTimeout\s*\(\s*['"]/gi,              reason: 'string-based setTimeout' },
  { pattern: /setInterval\s*\(\s*['"]/gi,             reason: 'string-based setInterval' },
]

/** Dangerous HTML constructs that are removed outright (replaced with an HTML comment) */
const STRIPPED_HTML: { pattern: RegExp; reason: string }[] = [
  { pattern: /<meta[^>]*http-equiv\s*=\s*["']?refresh[^>]*>/gi, reason: 'meta refresh' },
  { pattern: /<base\b[^>]*>/gi,                                 reason: 'base tag' },
  { pattern: /<(?:object|embed|applet)\b[^>]*>/gi,              reason: 'plugin embed' },
  // External stylesheets/fonts (Google Fonts etc.) — CSP blocks them anyway;
  // stripping avoids console noise and IP leaks to third parties.
  { pattern: /<link\b[^>]*href\s*=\s*["']https?:\/\/[^>]*>/gi,  reason: 'external stylesheet/font link' },
]

/** Script src allow-list check (run against extracted URL, not raw tag) */
function isAllowedScriptSrc(src: string): boolean {
  return (
    src.startsWith('https://cdn.barshi.app/') ||
    // Phaser — the current game engine for new projects
    src.startsWith('https://cdn.jsdelivr.net/npm/phaser') ||
    src.startsWith('https://cdnjs.cloudflare.com/ajax/libs/phaser/') ||
    // Kaboom — legacy engine, kept so older generated games still pass
    src.startsWith('https://unpkg.com/kaboom') ||
    src.startsWith('https://cdn.jsdelivr.net/npm/kaboom')
  )
}

/** Matches any <script src="..."> — allow/deny decided separately */
const SCRIPT_SRC_PATTERN = /<script\b[^>]*?\ssrc\s*=\s*["']([^"']+)["'][^>]*>/gi

/** Rewrite placeholder cdn.barshi.app URLs to real CDNs so generated projects run */
const CDN_REWRITES: { from: RegExp; to: string }[] = [
  {
    from: /https:\/\/cdn\.barshi\.app\/kaboom\/kaboom(?:\.min)?\.js/gi,
    to: 'https://unpkg.com/kaboom@3000.1.17/dist/kaboom.js',
  },
]

/** Strip any loadSound(...) call that passes a fabricated data: URL.
 *  Models routinely hallucinate base64 audio, and Kaboom throws on invalid
 *  WAV/MP3 bytes which kills the entire game. We neutralize the call. */
function stripFakeLoadSound(html: string): string {
  return html.replace(
    /loadSound\s*\([^)]*?data:audio\/[^)]*?\)\s*;?/gi,
    '/* [barshi: removed fake loadSound] */',
  )
}

/** Strip quoted `font: "..."` options from Kaboom calls. In v3000 the `font`
 *  option expects a LOADED font name, not a CSS family. Passing "sans-serif"
 *  (a common model mistake) makes Kaboom wait on a font that never loads, so
 *  the built-in loading screen hangs forever. Removing it falls back to the
 *  embedded default font, which is instant. Only matches quoted values, so CSS
 *  `font-family:` / `font-size:` / unquoted CSS shorthand are untouched. */
function stripKaboomFontOption(html: string): string {
  return html.replace(/\bfont\s*:\s*["'][^"']*["']\s*,?/gi, '')
}

/** Strip loadSprite(...) / loadFont(...) calls — models hallucinate asset bytes
 *  and any later sprite("name") or font reference throws at scene setup. */
function stripFakeAssetLoads(html: string): string {
  return html
    .replace(/loadSprite\s*\([^)]*?data:image\/[^)]*?\)\s*;?/gi, '/* [barshi: removed fake loadSprite] */')
    .replace(/loadFont\s*\([^)]*?\)\s*;?/gi, '/* [barshi: removed loadFont] */')
}

/** Unique string present only in HTML we've already processed (it lives inside
 *  the injected runtime-lockdown script). Used to make sanitizing idempotent:
 *  the builder streams our own output back on save, and running the guards a
 *  second time would duplicate + mangle them. */
const SANITIZED_MARKER = 'barshi: runtime lockdown active'

/** The single source of truth for the sandbox Content-Security-Policy.
 *  Used both as an injected <meta> (for srcdoc previews where no HTTP headers
 *  apply) and as the HTTP header when serving bundles from /api/projects/[id]/html.
 *  Blocks all network egress (connect-src 'none'), nested frames, plugins, and
 *  form submission; scripts limited to inline + the game-engine CDNs. */
export const SANDBOX_CSP =
  "default-src 'none'; script-src 'unsafe-inline' https://cdn.barshi.app https://unpkg.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; media-src data: blob:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'"

const CSP_META = `<meta http-equiv="Content-Security-Policy" content="${SANDBOX_CSP};">`

/** Compatibility shim for Kaboom v3000. Models frequently hallucinate old or
 *  wrong global names (mouseIsDown, keyIsDown, gravity(), origin()). These
 *  aliases forward to the real functions lazily — they're only invoked during
 *  gameplay, by which point kaboom({ global: true }) has defined the real ones.
 *  Only injected when the document actually uses Kaboom. */
const KABOOM_COMPAT = `<script>
(function(){
  function fwd(alias, real){
    if (typeof window[alias] !== 'undefined') return;
    window[alias] = function(){
      if (typeof window[real] === 'function') return window[real].apply(null, arguments);
      return undefined;
    };
  }
  fwd('mouseIsDown','isMouseDown');
  fwd('mouseIsPressed','isMousePressed');
  fwd('mouseIsReleased','isMouseReleased');
  fwd('keyIsDown','isKeyDown');
  fwd('keyIsPressed','isKeyPressed');
  fwd('keyIsReleased','isKeyReleased');
  fwd('gravity','setGravity');
})();
</script>`

/** Inject a top-level error handler + Object.is polyfill into generated HTML.
 *  - Polyfill is needed for older iOS Safari where Object.is is missing;
 *    without it Kaboom's internal tag checks throw "undefined is not an object".
 *  - Error handler turns silent runtime crashes into a visible red banner. */
function injectRuntimeGuards(html: string): string {
  const polyfill = `${CSP_META}<script>
if (typeof Object.is !== 'function') {
  Object.is = function(x, y) {
    if (x === y) return x !== 0 || 1/x === 1/y;
    return x !== x && y !== y;
  };
}
(function () {
  // ${SANITIZED_MARKER} — belt-and-braces on top of the CSP and regex scan.
  var blocked = function () { throw new Error('[barshi] blocked API'); };
  try { window.eval = blocked; } catch (e) {}
  try { window.WebSocket = blocked; } catch (e) {}
  try { window.EventSource = blocked; } catch (e) {}
  try { window.XMLHttpRequest = blocked; } catch (e) {}
  try { window.fetch = blocked; } catch (e) {}
  try { window.open = function () { return null; }; } catch (e) {}
  try { if (navigator.sendBeacon) navigator.sendBeacon = function () { return false; }; } catch (e) {}
  // In-memory storage shim: many generated sites/tools use localStorage (carts,
  // scores, prefs). Real localStorage is blocked in the sandbox, so we replace
  // it with a per-session in-memory Storage that satisfies the API without
  // persisting anything or leaking data. Keeps those projects fully working.
  try {
    var mem = {};
    var shim = {
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null; },
      setItem: function (k, v) { mem[k] = String(v); },
      removeItem: function (k) { delete mem[k]; },
      clear: function () { mem = {}; },
      key: function (i) { return Object.keys(mem)[i] || null; },
      get length() { return Object.keys(mem).length; }
    };
    Object.defineProperty(window, 'localStorage', { value: shim, configurable: true });
    Object.defineProperty(window, 'sessionStorage', { value: shim, configurable: true });
  } catch (e) {}
})();
</script>`
  const handler = `<script>
window.addEventListener('error', function(e){
  var msg = (e.message || e) + (e.filename ? ' @ ' + e.filename + ':' + e.lineno : '');
  document.body.insertAdjacentHTML('beforeend',
    '<pre style="position:fixed;top:0;left:0;right:0;background:#400;color:#fff;padding:10px;font-family:monospace;font-size:12px;z-index:99999;margin:0;white-space:pre-wrap;">[barshi] ' + msg + '</pre>');
});
</script>`

  // For Kaboom games, append the API-compat shim right after the polyfill so
  // its lazy global aliases are defined before the game's inline script runs.
  const head = /kaboom/i.test(html) ? polyfill + KABOOM_COMPAT : polyfill

  // Put the guards at the very start of <head> so they run before anything else
  let out = html
  if (/<head[^>]*>/i.test(out)) {
    out = out.replace(/<head([^>]*)>/i, `<head$1>${head}`)
  } else if (/<html[^>]*>/i.test(out)) {
    out = out.replace(/<html([^>]*)>/i, `<html$1><head>${head}</head>`)
  } else {
    out = head + out
  }

  // Put the error handler near the end
  if (/<\/body>/i.test(out)) out = out.replace(/<\/body>/i, handler + '</body>')
  else if (/<\/html>/i.test(out)) out = out.replace(/<\/html>/i, handler + '</html>')
  else out = out + handler

  return out
}

/** Dangerous HTML patterns */
const DANGEROUS_HTML: { pattern: RegExp; reason: string }[] = [
  { pattern: /<iframe(?![^>]*sandbox)/gi,             reason: 'nested iframe without sandbox' },
  { pattern: /javascript:/gi,                         reason: 'javascript: URL' },
  { pattern: /on\w+\s*=\s*["'][^"']*window\.(parent|top)/gi, reason: 'inline event with frame access' },
]

/** Strip a leading/trailing markdown code fence ("```html\n...\n```") from
 *  AI output. Gemini in particular routinely wraps HTML in fences even when
 *  told not to; if we don't strip them, the literal backticks render in the
 *  page body. Operates only on the outer edges so embedded triple-backticks
 *  inside the HTML (e.g. a code-display site) are preserved. */
function stripOuterCodeFence(html: string): string {
  let s = html.trim()
  // Opening fence: ``` or ```html or ```HTML etc., followed by a newline
  const openMatch = s.match(/^```[a-zA-Z0-9]*\s*\n/)
  if (openMatch) s = s.slice(openMatch[0].length)
  // Closing fence: final \n``` with optional trailing whitespace
  const closeMatch = s.match(/\n```\s*$/)
  if (closeMatch) s = s.slice(0, s.length - closeMatch[0].length)
  return s
}

export function sanitizeHTML(html: string): SanitizeResult {
  // Already sanitized by us — don't run the guards again (that would duplicate
  // and mangle the injected lockdown script). Return as-is, safe.
  if (html.includes(SANITIZED_MARKER)) {
    return { html, blocked: [], safe: true }
  }

  const blocked: string[] = []
  let clean = stripOuterCodeFence(html)

  // Rewrite placeholder CDN URLs to real, reachable CDNs
  for (const { from, to } of CDN_REWRITES) {
    clean = clean.replace(from, to)
  }

  // Remove any model-provided CSP meta so it can't conflict with the one we inject
  clean = clean.replace(/<meta[^>]*http-equiv\s*=\s*["']?content-security-policy[^>]*>/gi, '')

  // Remove outright-dangerous HTML constructs
  for (const { pattern, reason } of STRIPPED_HTML) {
    if (pattern.test(clean)) {
      blocked.push(reason)
      pattern.lastIndex = 0
      clean = clean.replace(pattern, '<!-- [barshi: blocked] -->')
    }
    pattern.lastIndex = 0
  }

  // Remove fake audio/image/font asset loads — these crash Kaboom at scene setup
  const beforeAssetStrip = clean
  clean = stripFakeLoadSound(clean)
  clean = stripFakeAssetLoads(clean)
  // Kaboom-only: strip quoted `font: "..."` options that hang the loading screen
  if (/kaboom/i.test(clean)) clean = stripKaboomFontOption(clean)
  if (clean !== beforeAssetStrip) blocked.push('fake asset load (sound/sprite/font)')

  // Block dangerous JS patterns
  for (const { pattern, reason } of BLOCKED_PATTERNS) {
    if (pattern.test(clean)) {
      blocked.push(reason)
      clean = clean.replace(pattern, '/* [barshi: blocked] */')
    }
    pattern.lastIndex = 0 // reset regex state
  }

  // Block external scripts whose src is not on the allow-list
  clean = clean.replace(SCRIPT_SRC_PATTERN, (match, src: string) => {
    if (isAllowedScriptSrc(src)) return match
    blocked.push(`external script (${src})`)
    return '<!-- [barshi: external script blocked] -->'
  })

  // Block dangerous HTML patterns
  for (const { pattern, reason } of DANGEROUS_HTML) {
    if (pattern.test(clean)) {
      blocked.push(reason)
      // Don't replace these — they may be in comments or strings, just flag
    }
    pattern.lastIndex = 0
  }

  // Inject CSP meta + Object.is polyfill + runtime lockdown + error banner.
  // Must run LAST — the guard script itself references APIs (sendBeacon, etc.)
  // that the pattern scan above would otherwise mangle.
  clean = injectRuntimeGuards(clean)

  return {
    html: clean,
    blocked,
    safe: blocked.length === 0,
  }
}

/** Extract visible text content from HTML for safety scanning */
export function extractVisibleText(html: string): string {
  // Remove script and style tags
  const text = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ') // strip all remaining HTML tags
    .replace(/\s+/g, ' ')
    .trim()

  // Truncate to 2000 chars for the safety scan API call
  return text.slice(0, 2000)
}
