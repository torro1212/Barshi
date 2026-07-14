'use client'

import { useEffect, useState } from 'react'

// Apply polyfills IMMEDIATELY before any other code runs
if (typeof window !== 'undefined' && typeof Object.is !== 'function') {
  Object.is = function (x, y) {
    if (x === y) {
      return x !== 0 || 1 / x === 1 / (y as number)
    } else {
      return x !== x && y !== y
    }
  }
  console.log('[polyfills] Applied Object.is polyfill for Safari')
}

/**
 * Mobile console for development (Eruda).
 * Shows a floating button that opens a developer console on mobile devices.
 * Only loads in development or when ?debug=1 is in the URL.
 */
export function DevTools() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    // Check if we should show dev tools
    const isDev = process.env.NODE_ENV === 'development'
    const hasDebugParam = typeof window !== 'undefined' && window.location.search.includes('debug=1')
    
    if (isDev || hasDebugParam) {
      setShow(true)
      
      // Load Eruda script
      const script = document.createElement('script')
      script.src = 'https://cdn.jsdelivr.net/npm/eruda'
      script.onload = () => {
        const eruda = (window as unknown as { eruda?: { init: () => void; destroy: () => void } }).eruda
        if (eruda) {
          eruda.init()
          console.log('[DevTools] Eruda mobile console loaded! Tap the floating button to open.')
        }
      }
      document.body.appendChild(script)

      return () => {
        // Cleanup: remove Eruda on unmount
        const eruda = (window as unknown as { eruda?: { init: () => void; destroy: () => void } }).eruda
        if (eruda) eruda.destroy()
        document.body.removeChild(script)
      }
    }
  }, [])

  if (!show) return null

  return null // Eruda adds its own UI
}
