'use client'

import { useEffect, useRef } from 'react'
import { Spinner } from '@/components/ui/spinner'

/** Picked element descriptor sent from the inspector inside the iframe. */
export interface PickedElement {
  label: string      // short human label, e.g. the <button> with text "Shop Now"
  tag: string
  text: string
  outerHTML: string  // the EXACT markup of the element, so the AI edits only it
  selector: string   // a precise nth-of-type CSS path to the element
}

/** A free-drag drop result: the element (by selector) was dropped at a point. */
export interface MovedElement {
  selector: string
  leftPct: number
  topPct: number
}

interface LivePreviewProps {
  html: string
  isLoading?: boolean
  /** 'select' → clicking reports a PickedElement; off when undefined */
  pickMode?: boolean
  onPick?: (el: PickedElement) => void
  /** When set, arms free-drag for that element's selector; cleared after drop */
  dragSelector?: string | null
  onMoved?: (m: MovedElement) => void
  onDragEnd?: () => void
  /** A text hint to briefly flash-highlight the matching element in the preview.
   *  Pass a new {text, nonce} each time so repeated locates re-trigger. */
  locate?: { text: string; nonce: number } | null
}

/** Inline inspector injected into the builder preview only (never into published
 *  bundles). Supports (a) click-to-select and (b) free-drag of a chosen element,
 *  reporting back to the parent via postMessage. */
const INSPECTOR = `<script>(function(){
  var picking = false;      // click-to-select mode
  var dragEl = null;        // element armed for free-drag
  var dragSelOrig = '';     // selector of the element in its ORIGINAL position
  var dragging = false;
  var last = null, box = null;
  function ensureBox(){
    if (box) return box;
    box = document.createElement('div');
    box.style.cssText = 'position:fixed;pointer-events:none;z-index:2147483647;border:2px solid #8b5cf6;background:rgba(139,92,246,0.18);border-radius:4px;';
    document.documentElement.appendChild(box);
    return box;
  }
  function highlight(el){
    if(!el){ if(box) box.style.display='none'; return; }
    var r = el.getBoundingClientRect();
    var b = ensureBox();
    b.style.display='block'; b.style.left=r.left+'px'; b.style.top=r.top+'px'; b.style.width=r.width+'px'; b.style.height=r.height+'px';
  }
  function cssPath(el){
    var parts = [], node = el;
    while (node && node.nodeType === 1 && node.tagName.toLowerCase() !== 'html') {
      var tag = node.tagName.toLowerCase();
      if (node.id) { parts.unshift(tag + '#' + node.id); break; }
      var i = 1, sib = node;
      while ((sib = sib.previousElementSibling)) { if (sib.tagName === node.tagName) i++; }
      parts.unshift(tag + ':nth-of-type(' + i + ')');
      if (tag === 'body') break;
      node = node.parentElement;
    }
    return parts.join(' > ');
  }
  function describe(el){
    var tag = el.tagName.toLowerCase();
    var text = (el.innerText||el.textContent||'').trim().replace(/\\s+/g,' ').slice(0,60);
    var id = el.id ? ('#'+el.id) : '';
    var cls = (typeof el.className==='string' && el.className.trim()) ? ('.'+el.className.trim().split(/\\s+/).slice(0,2).join('.')) : '';
    var loc = 'the <'+tag+'>'+(id||cls?(' ('+ (id||cls) +')'):'') + (text?(' with text "'+text+'"'):'');
    return { label: loc, tag: tag, text: text, outerHTML: (el.outerHTML||'').slice(0,600), selector: cssPath(el) };
  }
  function setCursor(c){ try { document.documentElement.style.cursor = c; } catch(e){} }
  function flash(el){
    highlight(el);
    var b = ensureBox();
    b.style.transition = 'opacity .3s';
    setTimeout(function(){ if(box){ box.style.display='none'; box.style.transition=''; } }, 1800);
  }

  function onMove(e){
    if (dragging && dragEl){
      e.preventDefault();
      var p = (e.touches && e.touches[0]) ? e.touches[0] : e;
      dragEl.style.position='fixed';
      dragEl.style.left = p.clientX+'px';
      dragEl.style.top = p.clientY+'px';
      dragEl.style.transform='translate(-50%,-50%)';
      dragEl.style.margin='0';
      dragEl.style.zIndex='99999';
      highlight(dragEl);
      return;
    }
    if (picking){ var el=e.target; if(el && el!==last){ last=el; highlight(el); } }
  }
  function onDown(e){
    if (dragEl){
      dragging = true; setCursor('grabbing');
      if (e.cancelable) e.preventDefault();
    }
  }
  function onUp(e){
    if (dragging && dragEl){
      var p = (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0] : e;
      var leftPct = Math.max(0, Math.min(100, (p.clientX / window.innerWidth) * 100));
      var topPct = Math.max(0, Math.min(100, (p.clientY / window.innerHeight) * 100));
      // Report the ORIGINAL selector so the parent edits the right node in the
      // stored HTML (the on-screen node may have been reparented for dragging).
      parent.postMessage({ type:'barshi:moved', selector: dragSelOrig, leftPct: leftPct, topPct: topPct }, '*');
      dragging = false; dragEl = null; setCursor(''); highlight(null);
      document.documentElement.style.touchAction='';
      return;
    }
    if (picking){
      e.preventDefault(); e.stopPropagation();
      parent.postMessage({ type:'barshi:picked', el: describe(e.target) }, '*');
      picking = false; setCursor(''); last=null; highlight(null);
    }
  }

  window.addEventListener('message', function(e){
    if(!e.data) return;
    if(e.data.type==='barshi:pick'){ picking = !!e.data.on; setCursor(picking?'crosshair':''); if(!picking){ last=null; highlight(null); } }
    if(e.data.type==='barshi:startDrag'){
      dragEl = e.data.selector ? document.querySelector(e.data.selector) : null;
      dragSelOrig = e.data.selector || '';
      picking = false;
      if(dragEl){
        // Escape any transformed/positioned ancestor by moving the node to
        // <body> and pinning it fixed AT ITS CURRENT SPOT — so it doesn't jump
        // on grab and lands exactly where the user drops it.
        var r = dragEl.getBoundingClientRect();
        try { document.body.appendChild(dragEl); } catch(err){}
        dragEl.style.position='fixed';
        dragEl.style.left=(r.left + r.width/2)+'px';
        dragEl.style.top=(r.top + r.height/2)+'px';
        dragEl.style.transform='translate(-50%,-50%)';
        dragEl.style.margin='0';
        dragEl.style.zIndex='99999';
        setCursor('grab'); highlight(dragEl); document.documentElement.style.touchAction='none';
      }
    }
    if(e.data.type==='barshi:cancelDrag'){ dragEl=null; dragging=false; setCursor(''); highlight(null); document.documentElement.style.touchAction=''; }
    if(e.data.type==='barshi:locate'){
      var q=(e.data.text||'').trim().toLowerCase();
      if(!q) return;
      var all=document.body.getElementsByTagName('*'); var found=null;
      for(var i=0;i<all.length;i++){
        var t=(all[i].innerText||all[i].textContent||'').trim().toLowerCase();
        if(t && t.indexOf(q)!==-1 && all[i].children.length<=8){ found=all[i]; break; }
      }
      if(found){ try{ found.scrollIntoView({block:'center'}); }catch(err){} flash(found); }
    }
  });
  document.addEventListener('mousemove', onMove, true);
  document.addEventListener('mousedown', onDown, true);
  document.addEventListener('mouseup', onUp, true);
  document.addEventListener('touchmove', onMove, { capture:true, passive:false });
  document.addEventListener('touchstart', onDown, { capture:true, passive:false });
  document.addEventListener('touchend', onUp, true);
  document.addEventListener('click', function(e){ if(picking||dragging){ e.preventDefault(); e.stopPropagation(); } }, true);
})();</script>`

export function LivePreview({ html, isLoading, pickMode, onPick, dragSelector, onMoved, onDragEnd, locate }: LivePreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const onPickRef = useRef(onPick)
  const onMovedRef = useRef(onMoved)
  const onDragEndRef = useRef(onDragEnd)
  useEffect(() => { onPickRef.current = onPick }, [onPick])
  useEffect(() => { onMovedRef.current = onMoved }, [onMoved])
  useEffect(() => { onDragEndRef.current = onDragEnd }, [onDragEnd])

  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe) return
    const doc = html
      ? html + INSPECTOR
      : '<!DOCTYPE html><html><body style="margin:0;background:#131328"></body></html>'
    iframe.srcdoc = doc
  }, [html])

  useEffect(() => {
    iframeRef.current?.contentWindow?.postMessage({ type: 'barshi:pick', on: !!pickMode }, '*')
  }, [pickMode, html])

  // Arm/disarm free-drag for a selector
  useEffect(() => {
    const win = iframeRef.current?.contentWindow
    if (!win) return
    if (dragSelector) win.postMessage({ type: 'barshi:startDrag', selector: dragSelector }, '*')
    else win.postMessage({ type: 'barshi:cancelDrag' }, '*')
  }, [dragSelector, html])

  // Flash-highlight an element by text hint (sidebar clicks)
  useEffect(() => {
    if (!locate?.text) return
    iframeRef.current?.contentWindow?.postMessage({ type: 'barshi:locate', text: locate.text }, '*')
  }, [locate])

  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.data?.type === 'barshi:picked' && e.data.el) onPickRef.current?.(e.data.el as PickedElement)
      if (e.data?.type === 'barshi:moved') {
        onMovedRef.current?.({ selector: e.data.selector, leftPct: e.data.leftPct, topPct: e.data.topPct })
        onDragEndRef.current?.()
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  const showEmpty = !html && !isLoading

  return (
    <div className="relative w-full h-full bg-[var(--color-surface-3)] rounded-[var(--radius-lg)] overflow-hidden">
      {isLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10 bg-[var(--color-surface-3)]">
          <Spinner size="lg" />
          <p className="text-sm text-[var(--color-text-muted)]">Building your project…</p>
        </div>
      )}
      {showEmpty && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 z-10 bg-[var(--color-surface-3)] text-center px-6">
          <Spinner size="lg" />
          <p className="text-sm text-[var(--color-text-muted)]">Loading your project…</p>
          <p className="text-xs text-[var(--color-text-dim)]">Hang tight — this only takes a moment.</p>
        </div>
      )}
      {pickMode && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 px-3 py-1.5 rounded-full bg-[var(--color-brand)] text-white text-xs font-semibold shadow-lg pointer-events-none animate-pulse-glow">
          Tap anything to edit it
        </div>
      )}
      {dragSelector && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 px-3 py-1.5 rounded-full bg-[var(--color-brand)] text-white text-xs font-semibold shadow-lg pointer-events-none animate-pulse-glow">
          Drag it where you want, then let go
        </div>
      )}
      <iframe
        ref={iframeRef}
        sandbox="allow-scripts allow-pointer-lock"
        className="sandbox-frame"
        title="Project preview"
        style={{ opacity: isLoading || showEmpty ? 0 : 1, transition: 'opacity 0.3s' }}
      />
    </div>
  )
}
