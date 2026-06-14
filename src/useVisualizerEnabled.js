import { useEffect, useState } from 'react'

// Module-level pubsub for the keyboard visualizer's enabled flag — same
// pattern as `useMuted` in useKeyboardSounds.js so any component (the
// SoundPad's settings dropdown, the visualizer itself) can subscribe and
// flip it without prop-drilling. Persisted to localStorage so user choice
// survives reloads.

const STORAGE_KEY = 'keeby-visualizer-enabled'

let _enabled = (() => {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return v === null ? true : v !== '0'
  } catch {
    return true
  }
})()

const _listeners = new Set()

export function getVisualizerEnabled() { return _enabled }

export function setVisualizerEnabled(v) {
  const next = !!v
  if (next === _enabled) return
  _enabled = next
  try { localStorage.setItem(STORAGE_KEY, _enabled ? '1' : '0') } catch { /* ignore */ }
  _listeners.forEach((fn) => fn(_enabled))
}

export function useVisualizerEnabled() {
  const [v, setV] = useState(_enabled)
  useEffect(() => {
    _listeners.add(setV)
    return () => { _listeners.delete(setV) }
  }, [])
  return v
}
