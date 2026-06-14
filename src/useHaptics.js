import { WebHaptics } from 'web-haptics'
import { isMuted } from './useKeyboardSounds.js'

// ──────────────────────────────────────────────────────────────────────────
// Thin wrapper around web-haptics. Vibration API is mobile-only (Android);
// iOS Safari + desktop silently no-op, which is exactly what we want.
// Gated on the site-wide mute toggle so silencing sound also silences buzz.
// ──────────────────────────────────────────────────────────────────────────

let _instance = null

function getInstance() {
  if (typeof window === 'undefined') return null
  if (!WebHaptics.isSupported) return null
  if (!_instance) _instance = new WebHaptics()
  return _instance
}

export function triggerHaptic(input) {
  if (isMuted()) return
  const inst = getInstance()
  if (!inst) return
  const p = inst.trigger(input)
  if (p && typeof p.catch === 'function') p.catch(() => {})
}

// Semantic helpers — map UI moments to built-in presets.
// Keystroke uses `selection` (8ms, 0.3 intensity) — deliberately subtle so a
// long typing burst doesn't turn the phone into a continuous hum.
export const hapticKey     = () => triggerHaptic('selection')
export const hapticLine    = () => triggerHaptic('light')    // 15ms, 0.4
export const hapticTap     = () => triggerHaptic('rigid')    // 10ms, 1.0 — snappy button confirm
export const hapticSuccess = () => triggerHaptic('success')  // two-tap celebration
