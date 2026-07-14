/**
 * Polyfills for older browsers (especially Safari iOS).
 * This must run on the client side.
 */

export function applyPolyfills() {
  if (typeof window === 'undefined') return

  // Object.is polyfill for Safari < 15
  if (typeof Object.is !== 'function') {
    Object.is = function (x, y) {
      // SameValue algorithm
      if (x === y) {
        // Steps 1-5, 7-10
        // Steps 6.b-6.e: +0 != -0
        return x !== 0 || 1 / x === 1 / (y as number)
      } else {
        // Step 6.a: NaN == NaN
        return x !== x && y !== y
      }
    }
    console.log('[polyfills] Applied Object.is polyfill for Safari')
  }
}
