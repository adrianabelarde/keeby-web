import { useState, useEffect, useRef, useCallback, useSyncExternalStore } from 'react'
import { incrementThock } from './useThockCounter.js'
import { hapticKey } from './useHaptics.js'
import { SOUND_DEFINES_DOWN, SOUND_DEFINES_UP } from './components/ui/keyboard.tsx'

// ──────────────────────────────────────────────────────────────────────────
// External store for `lastKey` — avoids re-rendering every consumer of
// useKeyboardSounds on every keystroke. Only components that call useLastKey()
// resubscribe.
// ──────────────────────────────────────────────────────────────────────────
let _lastKey = null
const _lastKeyListeners = new Set()

function _emitLastKey(value) {
  _lastKey = value
  for (const l of _lastKeyListeners) l()
}

function _subscribeLastKey(listener) {
  _lastKeyListeners.add(listener)
  return () => _lastKeyListeners.delete(listener)
}

export function useLastKey() {
  return useSyncExternalStore(_subscribeLastKey, () => _lastKey, () => null)
}

export function subscribeLastKey(cb) {
  const listener = () => cb(_lastKey)
  _lastKeyListeners.add(listener)
  return () => _lastKeyListeners.delete(listener)
}

// ──────────────────────────────────────────────────────────────────────────
// External store for site-wide mute (persisted to localStorage).
// ──────────────────────────────────────────────────────────────────────────
const MUTE_STORAGE_KEY = 'keeby-web-muted'
let _muted = (() => {
  try { return typeof localStorage !== 'undefined' && localStorage.getItem(MUTE_STORAGE_KEY) === '1' } catch { return false }
})()
const _mutedListeners = new Set()

function _emitMuted() { for (const l of _mutedListeners) l() }
function _subscribeMuted(listener) {
  _mutedListeners.add(listener)
  return () => _mutedListeners.delete(listener)
}

export function useMuted() {
  return useSyncExternalStore(_subscribeMuted, () => _muted, () => false)
}

export function setMuted(v) {
  const next = !!v
  if (next === _muted) return
  _muted = next
  try { localStorage.setItem(MUTE_STORAGE_KEY, next ? '1' : '0') } catch {}
  _emitMuted()
}

export function toggleMuted() { setMuted(!_muted) }
export function isMuted() { return _muted }

import { SWITCH_CONTRIBUTORS } from './contributors.js'
import { getHeroProfileId } from './heroSelectionStore.js'
import { decodeAndNormalize } from './loudnessNormalizer.js'

export const EASTER_EGG_PROFILES = [
  { id: 'keychron-k2-max-red', name: 'K2 Max · K Pro Red', brand: 'Keychron', color: '#C74747', type: 'Linear · 45g' },
  // Sprite-packed profile: single OGG sampled by Himanshu (keyb.himan.me)
  // from his K2 Max w/ K Pro Brown. Plays back via byte offsets into
  // SOUND_DEFINES_DOWN/UP instead of per-key WAVs. Kept right after Red so
  // both K2 Max entries group under a single "Keychron" heading in the
  // macbook switches menu. Himanshu is credited inline next to the visual
  // keyboard in the playground, not in the switches list.
  {
    id: 'keychron-k2-max-brown',
    name: 'K2 Max · K Pro Brown',
    brand: 'Keychron',
    color: '#8B6F47',
    type: 'Tactile · 55g',
    sprite: '/sounds/sound.ogg',
    contributor: SWITCH_CONTRIBUTORS['keychron-k2-max-brown'],
  },
  { id: 'durock-alpaca', name: 'Alpaca', brand: 'Durock', color: '#E6CCB3', type: 'Linear · 62g' },
  { id: 'novelkeys-cream', name: 'Cream', brand: 'NovelKeys', color: '#F2E6CC', type: 'Linear · 55g' },
]

// Full switch catalog — every profile shipped in the Mac app, mirrored on the
// web so visitors can audition each one in the hero macbook gallery. Switches in
// HERO_PREVIEW_ONLY_SWITCH_IDS get a spatial preview on pick; every other row
// also drives the Notes typing demo in panel 1. The typing playground keeps
// which carry full per-key audio (space, enter, backspace…) needed for free
// typing. Colors / weights are transcribed from the app's SwitchType.swift.
// Order mirrors the Mac app's Switches submenu exactly: brands follow
// AppDelegate.preferredBrandOrder (iqunix, lofree, akko, keychron, aflion,
// durock, gateron, novelkeys, drop, kailh, ibm, topre) with any unlisted
// brand — alps, then quirky — appended in SwitchBrand.allCases order; within
// each brand the rows follow SwitchType's declaration order.
export const ALL_SWITCHES = [
  { id: 'iqunix-mq80', name: 'MQ80', brand: 'IQUNIX', color: '#4DA6D9', type: 'Low-profile linear · 40g' },
  { id: 'lofree-flow-2-surfer', name: 'Flow 2 Surfer', brand: 'Lofree', color: '#FFFFFF', type: 'Low-profile linear · 40g' },
  { id: 'lofree-flow-2-void', name: 'Flow 2 Void', brand: 'Lofree', color: '#CCCCD1', type: 'Low-profile silent · 40g' },
  { id: 'lofree-flow-2-pulse', name: 'Flow 2 Pulse', brand: 'Lofree', color: '#42424A', type: 'Low-profile tactile · 40g' },
  { id: 'akko-piano-pro', name: 'Piano Pro', brand: 'Akko', color: '#9E73C7', type: 'Linear · 45g' },
  { id: 'akko-cs-jelly-black', name: 'CS Jelly Black', brand: 'Akko', color: '#292930', type: 'Linear · 50g' },
  { id: 'akko-v3-pro-cream-yellow', name: 'V3 Cream Yellow Pro', brand: 'Akko', color: '#F5DB80', type: 'Linear · 50g' },
  { id: 'akko-clicky-pink', name: 'Clicky Pink', brand: 'Akko', color: '#ED739E', type: 'Clicky · 50g' },
  { id: 'keychron-k2-max-red', name: 'K2 Max · K Pro Red', brand: 'Keychron', color: '#C74747', type: 'Linear · 45g' },
  {
    id: 'keychron-k2-max-brown',
    name: 'K2 Max · K Pro Brown',
    brand: 'Keychron',
    color: '#8B6F47',
    type: 'Tactile · 55g',
    sprite: '/sounds/sound.ogg',
    contributor: SWITCH_CONTRIBUTORS['keychron-k2-max-brown'],
  },
  { id: 'aflion-carrot', name: 'Carrot Orange', brand: 'Aflion', color: '#ED802E', type: 'Tactile · 37g' },
  { id: 'durock-alpaca', name: 'Alpaca', brand: 'Durock', color: '#E6CCB3', type: 'Linear · 62g' },
  { id: 'gateron-ink-black', name: 'Ink Black', brand: 'Gateron', color: '#333340', type: 'Linear · 60g' },
  { id: 'gateron-ink-red', name: 'Ink Red', brand: 'Gateron', color: '#C74747', type: 'Linear · 45g' },
  { id: 'gateron-turquoise-tealios', name: 'Turquoise Tealios', brand: 'Gateron', color: '#40BFB3', type: 'Linear · 63.5g' },
  { id: 'novelkeys-cream', name: 'Cream', brand: 'NovelKeys', color: '#F2E6CC', type: 'Linear · 55g' },
  { id: 'drop-holy-panda', name: 'Holy Panda', brand: 'Drop', color: '#D98C33', type: 'Tactile · 67g' },
  { id: 'kailh-box-navy', name: 'Box Navy', brand: 'Kailh', color: '#26408C', type: 'Clicky · 75g' },
  { id: 'ibm-buckling-spring', name: 'Buckling Spring', brand: 'IBM', color: '#B3B3A6', type: 'Clicky · 65g' },
  { id: 'topre-classic', name: 'Classic', brand: 'Topre', color: '#998CA6', type: 'Tactile · 45g' },
  { id: 'alps-skcm-blue', name: 'SKCM Blue', brand: 'Alps', color: '#4D80CC', type: 'Clicky · 70g' },
  { id: 'lizard', name: 'Lizard', brand: 'Quirky', color: '#73BF4D', type: 'Gecko · lol' },
]

// Hero macbook gallery switches that only ship alpha samples for the spatial
// preview demo — no Notes typing. Every other gallery row is typable in Notes.
export const HERO_PREVIEW_ONLY_SWITCH_IDS = new Set([
  'aflion-carrot',
  'akko-clicky-pink',
  'akko-v3-pro-cream-yellow',
  'akko-cs-jelly-black',
  'lofree-flow-2-surfer',
  'lofree-flow-2-void',
  'lofree-flow-2-pulse',
  'iqunix-mq80',
])

export function isHeroTypableSwitch(profileId) {
  return profileId && !HERO_PREVIEW_ONLY_SWITCH_IDS.has(profileId)
}

export function isHeroPreviewOnlySelected() {
  return HERO_PREVIEW_ONLY_SWITCH_IDS.has(getHeroProfileId())
}

export const TYPABLE_SWITCHES = ALL_SWITCHES.filter((p) => isHeroTypableSwitch(p.id))

// Per-switch loudness compensation, mirrored from the Mac app's
// SwitchType.normalizationGain (see scripts/calibrate-normalization-gains.py).
// Every profile lands at the same perceived loudness in the preview.
export const SWITCH_NORMALIZATION_GAIN = {
  'aflion-carrot': 0.88,
  'akko-piano-pro': 1.30,
  'akko-cs-jelly-black': 0.97,
  'akko-v3-pro-cream-yellow': 0.88,
  'akko-clicky-pink': 0.88,
  'alps-skcm-blue': 0.88,
  'drop-holy-panda': 0.88,
  'durock-alpaca': 0.88,
  'gateron-ink-black': 0.88,
  'gateron-ink-red': 0.88,
  'gateron-turquoise-tealios': 0.88,
  'ibm-buckling-spring': 0.88,
  'iqunix-mq80': 0.88,
  'kailh-box-navy': 0.88,
  'keychron-k2-max-red': 0.88,
  'keychron-k2-max-brown': 0.88,
  'lizard': 0.88,
  'lofree-flow-2-surfer': 1.47,
  'lofree-flow-2-void': 2.02,
  'lofree-flow-2-pulse': 1.34,
  'novelkeys-cream': 0.88,
  'topre-classic': 0.88,
}

// Base volume for the switch preview's down/up taps, before per-switch
// normalization (a normalized profile lands at BASE × its gain).
const BASE_PREVIEW_DOWN = 0.30
const BASE_PREVIEW_UP = 0.20
// Safety rail for quiet-profile gains that push past unity (Lofree Void ≈ 0.30 × 2.02).
const PREVIEW_VOL_CEILING = 2.2

const SOUND_FILES = {
  alpha: {
    down: ['alpha_down_01.wav', 'alpha_down_02.wav', 'alpha_down_03.wav'],
    up: ['alpha_up_01.wav', 'alpha_up_02.wav', 'alpha_up_03.wav'],
  },
  space: { down: ['space_down_01.wav'], up: ['space_up_01.wav'] },
  enter: { down: ['enter_down_01.wav'], up: ['enter_up_01.wav'] },
  backspace: { down: ['backspace_down_01.wav'], up: ['backspace_up_01.wav'] },
}

function getKeyGroup(code) {
  if (code === 'Space') return 'space'
  if (code === 'Enter' || code === 'NumpadEnter') return 'enter'
  if (code === 'Backspace' || code === 'Delete') return 'backspace'
  if (code.startsWith('Shift') || code.startsWith('Control') || code.startsWith('Alt') || code.startsWith('Meta')) return null
  if (code === 'CapsLock' || code === 'Escape' || code === 'Tab') return null
  if (code === 'ArrowLeft' || code === 'ArrowRight' || code === 'ArrowUp' || code === 'ArrowDown') return null
  return 'alpha'
}

function pickCachedBuffer(cache, files, rr = 0) {
  if (!cache) return null
  for (let i = 0; i < files.length; i++) {
    const buf = cache[files[(rr + i) % files.length]]
    if (buf) return buf
  }
  return null
}

function pickGroupBuffer(cache, group, direction, rr = 0) {
  const files = SOUND_FILES[group][direction]
  return pickCachedBuffer(cache, files, rr)
    ?? pickCachedBuffer(cache, SOUND_FILES.alpha[direction], rr)
}

function resolveTypingProfile(target, profileIndex) {
  if (isHeroPreviewOnlySelected()) return null

  const heroProfileId = getHeroProfileId()
  if (heroProfileId && isHeroTypableSwitch(heroProfileId)) {
    return ALL_SWITCHES.find((p) => p.id === heroProfileId) ?? EASTER_EGG_PROFILES[profileIndex]
  }

  return EASTER_EGG_PROFILES[profileIndex]
}

function typingVolume(prof, direction) {
  const norm = SWITCH_NORMALIZATION_GAIN[prof.id] ?? 1.0
  const base = direction === 'down' ? 0.28 : 0.16
  return Math.min(PREVIEW_VOL_CEILING, base * norm)
}

export function useKeyboardSounds() {
  const [activated, setActivated] = useState(true)
  const [profileIndex, setProfileIndex] = useState(1)
  const lastKeyTimer = useRef(null)
  const keyIdCounter = useRef(0)
  const audioCtx = useRef(null)
  const bufferCache = useRef({})
  const roundRobin = useRef(0)
  const pressedKeys = useRef(new Set())
  const loadPromises = useRef({})

  const mouseBuffers = useRef({ down: null, up: null })

  const profile = EASTER_EGG_PROFILES[profileIndex]

  const activate = useCallback(() => setActivated(true), [])
  const deactivate = useCallback(() => {
    setActivated(false)
    pressedKeys.current.clear()
  }, [])

  const preloadProfilePreview = useCallback(async (prof) => {
    if (!audioCtx.current) return
    const cache = bufferCache.current[prof.id]
    if (cache?.__previewReady) return

    const pending = loadPromises.current[`${prof.id}:preview`]
    if (pending) return pending

    const job = (async () => {
      const bucket = bufferCache.current[prof.id] ?? {}

      if (prof.sprite) {
        if (!bucket.__sprite__) {
          try {
            const res = await fetch(prof.sprite, { cache: 'force-cache' })
            if (res.ok) {
              const buf = await res.arrayBuffer()
              bucket.__sprite__ = await audioCtx.current.decodeAudioData(buf)
            }
          } catch { /* skip */ }
        }
      } else {
        const files = [...SOUND_FILES.alpha.down, ...SOUND_FILES.alpha.up]
        await Promise.all(files.map(async (file) => {
          if (bucket[file]) return
          try {
            const res = await fetch(`/sounds/${prof.id}/${file}`, { cache: 'force-cache' })
            if (!res.ok) return
            const buf = await res.arrayBuffer()
            bucket[file] = await decodeAndNormalize(audioCtx.current, buf)
          } catch { /* skip */ }
        }))
      }

      bucket.__previewReady = true
      bufferCache.current[prof.id] = bucket
    })().finally(() => {
      delete loadPromises.current[`${prof.id}:preview`]
    })

    loadPromises.current[`${prof.id}:preview`] = job
    return job
  }, [])

  const preloadProfileFull = useCallback(async (prof) => {
    if (!audioCtx.current) return
    await preloadProfilePreview(prof)

    const cache = bufferCache.current[prof.id]
    if (!cache || cache.__fullReady || prof.sprite) {
      if (cache) cache.__fullReady = true
      return
    }

    const pending = loadPromises.current[`${prof.id}:full`]
    if (pending) return pending

    const job = (async () => {
      const extraFiles = Object.values(SOUND_FILES).flatMap((g) => [...g.down, ...g.up])
      await Promise.all(extraFiles.map(async (file) => {
        if (cache[file]) return
        try {
          const res = await fetch(`/sounds/${prof.id}/${file}`, { cache: 'force-cache' })
          if (!res.ok) return
          const buf = await res.arrayBuffer()
          cache[file] = await decodeAndNormalize(audioCtx.current, buf)
        } catch { /* skip */ }
      }))
      cache.__fullReady = true
    })().finally(() => {
      delete loadPromises.current[`${prof.id}:full`]
    })

    loadPromises.current[`${prof.id}:full`] = job
    return job
  }, [preloadProfilePreview])

  // Back-compat alias — typing paths want the full set when available.
  const preloadProfile = preloadProfileFull

  const compressorRef = useRef(null)
  const activeVoices = useRef([])
  const MAX_VOICES = 6

  // opts: { startMs?, durationMs?, pan? } — startMs/durationMs play a slice of
  // the buffer (sprite-packed K Pro Brown profile); pan (-1 left … +1 right)
  // routes the voice through a StereoPannerNode for the spatial switch preview.
  const playBuffer = useCallback((buffer, volume = 0.55, opts) => {
    if (_muted) return
    const ctx = audioCtx.current
    if (!ctx || !buffer) return
    if (ctx.state === 'suspended') ctx.resume().catch(() => {})

    // Lazy-init a shared compressor to prevent clipping from overlapping sounds
    if (!compressorRef.current) {
      const comp = ctx.createDynamicsCompressor()
      comp.threshold.value = -12
      comp.knee.value = 6
      comp.ratio.value = 4
      comp.attack.value = 0.002
      comp.release.value = 0.05
      comp.connect(ctx.destination)
      compressorRef.current = comp
    }

    // Evict oldest voice if at limit
    const voices = activeVoices.current
    while (voices.length >= MAX_VOICES) {
      const old = voices.shift()
      try { old.gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.01); old.source.stop(ctx.currentTime + 0.015) } catch {}
    }

    const now = ctx.currentTime
    const source = ctx.createBufferSource()
    const gain = ctx.createGain()
    source.buffer = buffer

    // Ramp in to avoid click at start
    gain.gain.setValueAtTime(0.001, now)
    gain.gain.linearRampToValueAtTime(volume, now + 0.003)

    // Ramp out before end to avoid pop
    const startOffsetSec = opts && typeof opts.startMs === 'number' ? opts.startMs / 1000 : 0
    const dur = opts && typeof opts.durationMs === 'number' ? opts.durationMs / 1000 : buffer.duration
    if (dur > 0.04) {
      gain.gain.setValueAtTime(volume, now + dur - 0.02)
      gain.gain.linearRampToValueAtTime(0.001, now + dur)
    }

    source.connect(gain)
    // Optional stereo pan — used by the spatial switch preview to throw taps
    // hard left/right. Falls back to a straight (mono → centered) path when no
    // pan is given, so normal typing playback is untouched.
    let tail = gain
    if (opts && typeof opts.pan === 'number' && typeof ctx.createStereoPanner === 'function') {
      const panner = ctx.createStereoPanner()
      panner.pan.value = Math.max(-1, Math.min(1, opts.pan))
      gain.connect(panner)
      tail = panner
    }
    tail.connect(compressorRef.current)
    source.start(now, startOffsetSec, dur)
    source.stop(now + dur)

    const voice = { source, gain }
    voices.push(voice)
    source.onended = () => {
      const idx = voices.indexOf(voice)
      if (idx !== -1) voices.splice(idx, 1)
    }
  }, [])

  const ensureContext = useCallback(() => {
    if (audioCtx.current) return
    const Impl = window.AudioContext || window.webkitAudioContext
    if (!Impl) return
    audioCtx.current = new Impl({ latencyHint: 'interactive' })
  }, [])

  const preloadMouseSounds = useCallback(async () => {
    if (!audioCtx.current || mouseBuffers.current.down) return
    // Sibat (Crisp) samples — same files served at root and used by App.jsx's
    // tapSoundConfig, so global mouse clicks under the easter egg match the
    // landing-page click sound exactly.
    const SOURCES = { down: '/sibat-down.wav', up: '/sibat-up.wav' }
    for (const dir of ['down', 'up']) {
      try {
        const res = await fetch(SOURCES[dir], { cache: 'force-cache' })
        if (!res.ok) continue
        const buf = await res.arrayBuffer()
        mouseBuffers.current[dir] = await decodeAndNormalize(audioCtx.current, buf)
      } catch { /* skip */ }
    }
  }, [])

  // Preview-only on activation — full buffers and mouse clicks load on first
  // interaction so Lighthouse's critical path isn't a chain of WAV/OGG fetches.
  useEffect(() => {
    if (!activated) return
    ensureContext()
    preloadProfilePreview(EASTER_EGG_PROFILES[profileIndex])
  }, [activated, profileIndex, ensureContext, preloadProfilePreview])

  useEffect(() => {
    if (!activated) return
    ensureContext()
    const prof = ALL_SWITCHES.find((p) => p.id === getHeroProfileId())
    if (prof) preloadProfilePreview(prof)
  }, [activated, ensureContext, preloadProfilePreview])

  // Keyboard listeners — only active when Easter egg is on
  useEffect(() => {
    if (!activated) return

    const playKeySound = (e, direction) => {
      // Hero gallery Preview picks are audition-only — no keystroke audio anywhere.
      if (isHeroPreviewOnlySelected()) return

      const group = getKeyGroup(e.code)
      if (!group) return

      const prof = resolveTypingProfile(e.target, profileIndex)
      if (!prof) return
      const cache = bufferCache.current[prof.id]
      if (!cache) {
        void preloadProfileFull(prof)
        return
      }
      if (!prof.sprite && !cache.__fullReady) {
        void preloadProfileFull(prof)
      }

      if (prof.sprite) {
        const defs = direction === 'down' ? SOUND_DEFINES_DOWN : SOUND_DEFINES_UP
        const def = defs[e.code]
        if (!def) return
        playBuffer(cache.__sprite__, typingVolume(prof, direction), { startMs: def[0], durationMs: def[1] })
        return
      }

      const dirKey = direction === 'down' ? 'down' : 'up'
      const rr = direction === 'down' ? roundRobin.current++ : roundRobin.current
      const buffer = pickGroupBuffer(cache, group, dirKey, rr)
      if (buffer) playBuffer(buffer, typingVolume(prof, direction))
    }

    const onKeyDown = (e) => {
      const tag = e.target?.tagName
      if ((tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target?.isContentEditable) && !e.target?.dataset?.keebySounds) return

      const group = getKeyGroup(e.code)
      if (!group) return
      if (pressedKeys.current.has(e.code)) return
      pressedKeys.current.add(e.code)

      // Show key label in notch
      const label = e.code === 'Space' ? '␣'
        : e.code === 'Enter' || e.code === 'NumpadEnter' ? '↵'
        : e.code === 'Backspace' ? '⌫'
        : e.key.length === 1 ? e.key.toUpperCase()
        : e.code.replace(/^Key|^Digit|^Numpad/, '')
      keyIdCounter.current++
      const id = keyIdCounter.current
      _emitLastKey({ label, id })
      clearTimeout(lastKeyTimer.current)
      lastKeyTimer.current = setTimeout(() => _emitLastKey(null), 600)

      // Bump the live thock counter (external store → only NavThockCounter
      // re-renders, App stays still).
      incrementThock()

      // Mobile: buzz the device motor alongside the click. No-op on desktop
      // and iOS Safari (Vibration API unsupported). Gated by site-wide mute.
      hapticKey()

      ensureContext()
      playKeySound(e, 'down')
    }

    const onKeyUp = (e) => {
      const tag = e.target?.tagName
      if ((tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target?.isContentEditable) && !e.target?.dataset?.keebySounds) return

      if (!pressedKeys.current.has(e.code)) return
      pressedKeys.current.delete(e.code)

      ensureContext()
      playKeySound(e, 'up')
    }

    // Skip mouse-click playback when the press lands on a keeby-logo "thock"
    // button — those are meant to feel like a keyboard switch, not a mouse,
    // so the user explicitly asked for no click sound on logo presses.
    const isThockButton = (target) =>
      target && typeof target.closest === 'function' && target.closest('[data-keeby-thock]')
    const onMouseDown = (e) => {
      ensureContext()
      void preloadMouseSounds()
      if (isThockButton(e.target)) return
      // Match the lower thocky gain used by App.jsx's tapSoundConfig so the
      // easter-egg global click feels identical to the local button-press click.
      if (mouseBuffers.current.down) playBuffer(mouseBuffers.current.down, 0.3)
    }
    const onMouseUp = (e) => {
      if (isThockButton(e.target)) return
      if (mouseBuffers.current.up) playBuffer(mouseBuffers.current.up, 0.18)
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [activated, profileIndex, ensureContext, playBuffer, preloadProfileFull, preloadMouseSounds])

  useEffect(() => {
    return () => {
      if (audioCtx.current) {
        audioCtx.current.close().catch(() => {})
        audioCtx.current = null
      }
    }
  }, [])

  // Spatial flourish that mirrors the macOS Switches-dropdown preview: a
  // right-then-far-left bounce (Return ▸ Left Shift) shows off the stereo
  // field immediately, then three taps settle back into the typing zone, so
  // the click both *sounds* like the switch and demonstrates the spatial
  // audio. Pans are copied from AppDelegate.scheduleSwitchHoverPreview; the
  // notch echoes each key. Every tap is loudness-normalized to the same level
  // (SWITCH_NORMALIZATION_GAIN), so quiet profiles like the Lofree low-
  // profiles and Akko Piano Pro sit as loud as the rest. The app's per-key
  // "feel" gains are intentionally dropped here — they vary loudness, which is
  // the opposite of the even level we want.
  //
  // Anti-spam: each call cancels any still-scheduled taps from the prior
  // preview so rapid-clicking switches doesn't stack overlapping sounds.
  const previewTimeoutsRef = useRef([])
  const previewProfile = useCallback(async (profileId) => {
    for (const id of previewTimeoutsRef.current) clearTimeout(id)
    previewTimeoutsRef.current = []

    if (_muted) return
    // Resolve against the full catalog (superset of EASTER_EGG_PROFILES) so the
    // hero's all-switches gallery can preview any profile, not just the four
    // typing-test ones.
    const prof = ALL_SWITCHES.find((p) => p.id === profileId)
    if (!prof) return
    ensureContext()
    await preloadProfilePreview(prof)
    const cache = bufferCache.current[prof.id]
    const ctx = audioCtx.current
    if (!cache || !ctx) return

    // Uniform per-switch loudness. The gain is allowed PAST unity here — the
    // quiet profiles (Lofree +5.8…+9.4 dB, Akko Piano Pro) need real
    // amplification to reach parity; clamping to 1.0 left them at their native
    // quiet level. Only the generous safety ceiling caps it.
    const norm = SWITCH_NORMALIZATION_GAIN[prof.id] ?? 1.0
    const downVol = Math.min(PREVIEW_VOL_CEILING, BASE_PREVIEW_DOWN * norm)
    const upVol   = Math.min(PREVIEW_VOL_CEILING, BASE_PREVIEW_UP * norm)

    // label → notch glyph, code → sprite sample key, pan → stereo position.
    const SEQUENCE = [
      { label: '↵', code: 'Enter',       pan:  0.95 },  // Return  — hard right
      { label: '⇧', code: 'ShiftLeft',   pan: -0.95 },  // L Shift — hard left
      { label: 'G', code: 'KeyG',        pan: -0.03 },  // centre
      { label: '[', code: 'BracketLeft', pan:  0.75 },  // right stretch
      { label: '/', code: 'Slash',       pan:  0.80 },  // right stretch
    ]
    const GAP_MS = 200
    const UP_MS  = 70
    const timeouts = previewTimeoutsRef.current
    const schedule = (fn, delay) => { timeouts.push(setTimeout(fn, delay)) }

    // Web profiles only ship alpha samples, so every tap reuses the alpha
    // buffers (cycling whichever variants loaded) — only the pan changes.
    const downBufs = prof.sprite ? null : SOUND_FILES.alpha.down.map((f) => cache[f]).filter(Boolean)
    const upBufs   = prof.sprite ? null : SOUND_FILES.alpha.up.map((f) => cache[f]).filter(Boolean)

    SEQUENCE.forEach((step, i) => {
      const delay = i * GAP_MS
      schedule(() => {
        keyIdCounter.current++
        _emitLastKey({ label: step.label, id: keyIdCounter.current })
      }, delay)
      if (prof.sprite) {
        const buf  = cache.__sprite__
        // Fall back to a letter key if the sprite map lacks Enter/Shift/etc.
        const down = SOUND_DEFINES_DOWN[step.code] || SOUND_DEFINES_DOWN['KeyG']
        const up   = SOUND_DEFINES_UP[step.code]   || SOUND_DEFINES_UP['KeyG']
        if (down) schedule(() => playBuffer(buf, downVol, { startMs: down[0], durationMs: down[1], pan: step.pan }), delay)
        if (up)   schedule(() => playBuffer(buf, upVol,   { startMs: up[0],   durationMs: up[1],   pan: step.pan }), delay + UP_MS)
      } else {
        const downBuf = downBufs.length ? downBufs[i % downBufs.length] : null
        const upBuf   = upBufs.length ? upBufs[i % upBufs.length] : null
        if (downBuf) schedule(() => playBuffer(downBuf, downVol, { pan: step.pan }), delay)
        if (upBuf)   schedule(() => playBuffer(upBuf,   upVol,   { pan: step.pan }), delay + UP_MS)
      }
    })
    schedule(() => _emitLastKey(null), SEQUENCE.length * GAP_MS + 400)
  }, [ensureContext, preloadProfilePreview, preloadProfileFull, playBuffer])

  const selectHeroSwitch = useCallback((profileId) => {
    if (isHeroTypableSwitch(profileId)) {
      const prof = ALL_SWITCHES.find((p) => p.id === profileId)
      if (prof) preloadProfileFull(prof)
    }
    previewProfile(profileId)
  }, [previewProfile, preloadProfileFull])

  const playHeroClick = useCallback((direction) => {
    if (_muted) return false
    const heroProfileId = getHeroProfileId()
    if (!heroProfileId) return false

    const prof = ALL_SWITCHES.find((p) => p.id === heroProfileId)
    if (!prof || prof.sprite) return false

    // Preview-only picks audition a single alpha tap on the dock icon.
    if (HERO_PREVIEW_ONLY_SWITCH_IDS.has(heroProfileId)) {
      ensureContext()
      const cache = bufferCache.current[prof.id]
      if (!cache) {
        preloadProfilePreview(prof)
        return false
      }
      const dirKey = direction === 'down' ? 'down' : 'up'
      const buffer = pickGroupBuffer(cache, 'alpha', dirKey, roundRobin.current)
      if (!buffer) return false
      if (direction === 'down') roundRobin.current++
      playBuffer(buffer, typingVolume(prof, direction))
      return true
    }

    if (!isHeroTypableSwitch(heroProfileId)) return false

    ensureContext()
    const cache = bufferCache.current[prof.id]
    if (!cache) {
      preloadProfilePreview(prof)
      return false
    }

    const dirKey = direction === 'down' ? 'down' : 'up'
    const rr = direction === 'down' ? roundRobin.current++ : roundRobin.current
    const buffer = pickGroupBuffer(cache, 'alpha', dirKey, rr)
    if (!buffer) return false

    if (direction === 'down') incrementThock()
    playBuffer(buffer, typingVolume(prof, direction))
    return true
  }, [ensureContext, preloadProfilePreview, playBuffer])

  return {
    activated,
    activate,
    deactivate,
    profile,
    profileIndex,
    setProfileIndex,
    previewProfile,
    selectHeroSwitch,
    playHeroClick,
  }
}
