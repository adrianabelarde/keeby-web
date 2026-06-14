import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Volume2, Volume1, VolumeX, Volume } from 'lucide-react'
import { EASTER_EGG_PROFILES, SWITCH_NORMALIZATION_GAIN } from '../useKeyboardSounds.js'
import { decodeAndNormalize } from '../loudnessNormalizer.js'
import { keycapStyle } from '../keycap.js'
import { SOUND_DEFINES_DOWN, SOUND_DEFINES_UP } from './ui/keyboard.tsx'

// Home-row alpha keys used as round-robin variants for sprite-packed profiles
// (e.g. K Pro Brown). Each maps to a distinct slice in SOUND_DEFINES so the
// release-preview's three-press cadence doesn't repeat the same sample.
const SPRITE_ALPHA_KEYS = ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyJ', 'KeyK', 'KeyL']

// Drop the "K2 Max · " prefix when rendering Keychron variants so the pill
// reads as a single switch name ("K Pro Red") instead of a board+switch
// concatenation. The brand and type are still shown in the dropdown row.
function displaySwitchName(name) {
  return name.replace(/^K2 Max · /, '')
}

/*
 * SoundPad — 1:1 web port of the macOS app's Sound Pad
 * (AppDelegate.swift SoundPadView + TonePadGrid).
 *
 * - 220px tone pad, 13×13 dot lattice, knob blooms 2.8× on drag
 * - Active row + column highlight, intersection brightens, center neutral ring
 * - Snap to 13-step grid on release; vertical volume slider snaps to 20 steps
 *   with rubber-band overdrag, just like the menu-bar HUD
 * - On release, plays the **selected switch's** alpha sample (down + up)
 *   shaped by toneX (Thock↔Clack) and toneY (Deep↔Sharp). Picker at the top
 *   lets the user swap switches just like the macOS menu-bar entry.
 *
 * The knob position is updated imperatively via DOM refs on every pointer
 * event so it stays nailed to the cursor regardless of React render timing —
 * the previous state-driven approach skipped frames during fast drags. Dot
 * bloom and active-axis highlights are likewise imperative.
 */

const PAD_SIZE = 220
const SLIDER_WIDTH = 56
const KNOB_SIZE = 18
const GRID_COUNT = 13
const DOT_SIZE = 3.5
const PADDING = 14
const VOLUME_STEPS = 20
const TONE_STEP = 1 / (GRID_COUNT - 1)
const PROXIMITY_RADIUS = 4
const USABLE = PAD_SIZE - PADDING * 2
const DOWN_FILES = ['alpha_down_01.wav', 'alpha_down_02.wav', 'alpha_down_03.wav']
const UP_FILES = ['alpha_up_01.wav', 'alpha_up_02.wav', 'alpha_up_03.wav']

function clamp01(v) { return Math.min(1, Math.max(0, v)) }
function snapTone(value) { return Math.round(value / TONE_STEP) * TONE_STEP }
function snapVolume(value) { return Math.round(value * VOLUME_STEPS) / VOLUME_STEPS }

// ──────────────────────────────────────────────────────────────────────────
// Audio singletons — sharing across mounts means navigating to /soundpad and
// back doesn't refetch samples or stack contexts. Per-profile caches keep
// each switch's samples ready for the release-preview as soon as the user
// picks it from the dropdown.
// ──────────────────────────────────────────────────────────────────────────
let _ctx = null
let _compressor = null
const _profileBuffers = {} // profileId → { down: AudioBuffer[], up: AudioBuffer[] }
const _profileLoading = {} // profileId → Promise
let _ticks = []
let _ticksLoading = null
let _tickIndex = 0
let _lastTickAt = 0
const TICK_MIN_INTERVAL = 0.04 // matches TickPlayer.swift

function getCtx() {
  if (_ctx) return _ctx
  const Impl = typeof window !== 'undefined' ? (window.AudioContext || window.webkitAudioContext) : null
  if (!Impl) return null
  _ctx = new Impl({ latencyHint: 'interactive' })
  return _ctx
}

function getCompressor() {
  const ctx = getCtx()
  if (!ctx) return null
  if (_compressor && _compressor.context === ctx) return _compressor
  const c = ctx.createDynamicsCompressor()
  c.threshold.value = -12
  c.knee.value = 6
  c.ratio.value = 4
  c.attack.value = 0.002
  c.release.value = 0.05
  c.connect(ctx.destination)
  _compressor = c
  return c
}

async function fetchBuffer(url) {
  const ctx = getCtx()
  if (!ctx) return null
  try {
    const res = await fetch(url, { cache: 'force-cache' })
    if (!res.ok) return null
    const ab = await res.arrayBuffer()
    return await decodeAndNormalize(ctx, ab)
  } catch {
    return null
  }
}

async function loadTicks() {
  if (_ticks.length) return _ticks
  if (_ticksLoading) return _ticksLoading
  _ticksLoading = (async () => {
    const buffers = await Promise.all(
      [1, 2, 3, 4, 5, 6, 7].map((i) => fetchBuffer(`/sounds/ticks/tick_${i}.wav`))
    )
    _ticks = buffers.filter(Boolean)
    return _ticks
  })()
  return _ticksLoading
}

// Per-profile loader. Multi-file profiles fetch the alpha_down_NN / alpha_up
// WAVs. Sprite-packed profiles (e.g. K Pro Brown) decode a single OGG and
// expose per-key slice offsets so the release-preview can play different
// variants on each press.
async function loadProfile(profileId) {
  if (_profileBuffers[profileId]) return _profileBuffers[profileId]
  if (_profileLoading[profileId]) return _profileLoading[profileId]
  const profile = EASTER_EGG_PROFILES.find((p) => p.id === profileId)
  _profileLoading[profileId] = (async () => {
    if (profile?.sprite) {
      const sprite = await fetchBuffer(profile.sprite)
      const downSlices = SPRITE_ALPHA_KEYS
        .map((k) => SOUND_DEFINES_DOWN[k])
        .filter(Boolean)
        .map(([startMs, durationMs]) => ({ startMs, durationMs }))
      const upSlices = SPRITE_ALPHA_KEYS
        .map((k) => SOUND_DEFINES_UP[k])
        .filter(Boolean)
        .map(([startMs, durationMs]) => ({ startMs, durationMs }))
      const result = sprite
        ? { sprite, down: downSlices, up: upSlices }
        : { down: [], up: [] }
      _profileBuffers[profileId] = result
      return result
    }
    const downs = await Promise.all(
      DOWN_FILES.map((f) => fetchBuffer(`/sounds/${profileId}/${f}`))
    )
    const ups = await Promise.all(
      UP_FILES.map((f) => fetchBuffer(`/sounds/${profileId}/${f}`))
    )
    const result = {
      down: downs.filter(Boolean),
      up: ups.filter(Boolean),
    }
    _profileBuffers[profileId] = result
    return result
  })()
  return _profileLoading[profileId]
}

// ── Tick (drag feedback) ──────────────────────────────────────────────────
// Crisp + clear, no muffling. Direct path to ctx.destination at a soft gain
// so the wav samples sit underneath the typing preview rather than competing
// with it. Tuned by ear after the user flagged the previous level as too
// loud — keeps the per-cell drag feedback present but not punchy.
const TICK_GAIN = 0.8 * 0.45

function playSynthTick(ctx, dest, volumeScale, variantIndex) {
  const now = ctx.currentTime
  const variants = [2400, 2200, 2600, 2050, 2800, 2300, 2500]
  const base = variants[variantIndex % variants.length]
  const osc = ctx.createOscillator()
  const noise = ctx.createBufferSource()
  const noiseBuf = ctx.createBuffer(1, 220, ctx.sampleRate)
  const data = noiseBuf.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length)
  noise.buffer = noiseBuf
  const gain = ctx.createGain()
  osc.type = 'square'
  osc.frequency.setValueAtTime(base, now)
  osc.frequency.exponentialRampToValueAtTime(base * 0.55, now + 0.018)
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(0.5 * volumeScale, now + 0.0015)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.03)
  osc.connect(gain)
  noise.connect(gain)
  gain.connect(dest)
  osc.start(now)
  noise.start(now)
  osc.stop(now + 0.04)
  noise.stop(now + 0.02)
}

function playTick(volumeScale = 1) {
  const ctx = getCtx()
  if (!ctx) return
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  const now = ctx.currentTime
  if (now - _lastTickAt < TICK_MIN_INTERVAL) return
  _lastTickAt = now
  if (!_ticks.length) {
    playSynthTick(ctx, ctx.destination, volumeScale, _tickIndex++)
    return
  }
  const buf = _ticks[_tickIndex % _ticks.length]
  _tickIndex++
  const src = ctx.createBufferSource()
  const gain = ctx.createGain()
  src.buffer = buf
  gain.gain.value = TICK_GAIN * volumeScale
  // Direct path: no filters, no compressor — same straight-through signal
  // chain TickPlayer.swift uses with AVAudioPlayer.
  src.connect(gain).connect(ctx.destination)
  src.start(now + 0.002)
}

// ── Tone-pad release preview ──────────────────────────────────────────────
// 1:1 port of the macOS AudioEngine tone shaping (Sources/Keeb/Core/AudioEngine.swift):
//
//   toneX (Thock 0 → Clack 1) drives a low-pass filter with a parallel dry
//     tap and a quadratic makeup gain. The native engine uses a one-pole IIR
//     with alpha = max(0.06, toneX²). On the web we approximate the same
//     cutoff with a BiquadFilter (lowpass) tuned by inverting the IIR alpha
//     formula, then run a parallel dry path that crossfades from full-wet at
//     Clack to wet+0.45·dry at Thock — same energy conservation that keeps
//     click transients audible at the warm extreme.
//
//   toneY (Deep 0 → Sharp 1) maps to a playback rate of 0.88 + toneY·0.24.
//     AudioBufferSourceNode.playbackRate exposes the same kind of native
//     pitch/rate change AVAudioSourceNode uses on macOS. y=0 deepens to
//     0.88×, y=1 sharpens to 1.12×, y=0.5 is unity.
//
// Plays three key presses spaced 200ms apart so the release feels like a
// short type-test rather than a single thock.
let _rrIndex = 0
const PREVIEW_PRESS_GAP_MS = 200
const PREVIEW_PRESS_COUNT = 3
const PREVIEW_UP_OFFSET_MS = 85

// Convert the macOS one-pole IIR alpha into a Biquad lowpass cutoff (Hz).
// Derivation: a one-pole IIR with `y += alpha * (x - y)` has a -3 dB point at
// fc = -fs/(2π) · ln(1 - alpha). At alpha=0.06, sr=44.1k → ~430 Hz.
function lpfCutoffFromToneX(toneX, sampleRate) {
  if (toneX >= 0.99) return Math.min(20000, sampleRate / 2 - 100) // bypass
  const alpha = Math.max(0.06, toneX * toneX)
  const fc = -sampleRate / (2 * Math.PI) * Math.log(1 - alpha)
  return Math.max(80, Math.min(20000, fc))
}

function playToneSample({ profileId, toneX, toneY, volume }) {
  const ctx = getCtx()
  if (!ctx) return
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  const buffers = _profileBuffers[profileId]
  if (!buffers || !buffers.down.length) return
  const dest = getCompressor() || ctx.destination

  // Shared shaping coefficients — same numbers the macOS engine uses.
  const thockiness = Math.max(0, 1 - toneX)
  const applyLPF = toneX < 0.99
  const wetMakeup = applyLPF ? 1 + thockiness * thockiness * 3 : 1
  const dryMix = applyLPF ? thockiness * 0.45 : 0
  const cutoff = lpfCutoffFromToneX(toneX, ctx.sampleRate)
  const playbackRate = 0.88 + toneY * 0.24 // matches AudioEngine line 1782

  const isSprite = !!buffers.sprite
  const norm = SWITCH_NORMALIZATION_GAIN[profileId] ?? 1.0

  const shapeNode = (entry, baseGain, startOffset) => {
    if (!entry) return
    let buffer, sliceOffsetSec = 0, sliceDurationSec
    if (isSprite) {
      buffer = buffers.sprite
      sliceOffsetSec = entry.startMs / 1000
      sliceDurationSec = entry.durationMs / 1000
    } else {
      buffer = entry
    }
    if (!buffer) return
    const now = ctx.currentTime + startOffset
    const src = ctx.createBufferSource()
    src.buffer = buffer
    src.playbackRate.value = playbackRate

    const wet = ctx.createGain()
    const dry = ctx.createGain()
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = cutoff
    // Q close to a one-pole's natural broadness — keep it shallow so we don't
    // ring at the cutoff and add a "wow"-ing artefact that isn't in the
    // macOS reference path.
    lp.Q.value = 0.5
    wet.gain.value = wetMakeup
    dry.gain.value = dryMix

    // Master envelope keeps overlapping releases from clipping.
    const env = ctx.createGain()
    const target = baseGain * volume
    env.gain.setValueAtTime(0.0001, now)
    env.gain.linearRampToValueAtTime(target, now + 0.003)
    const sourceDur = sliceDurationSec ?? buffer.duration
    const dur = sourceDur / playbackRate
    if (dur > 0.04) {
      env.gain.setValueAtTime(target, now + dur - 0.02)
      env.gain.linearRampToValueAtTime(0.0001, now + dur)
    }

    // Wet path: src → lp → wet (makeup) → env → dest
    // Dry path:  src → dry → env → dest  (parallel, only when LPF is active)
    src.connect(lp).connect(wet).connect(env)
    if (dryMix > 0) {
      src.connect(dry).connect(env)
    }
    env.connect(dest)
    if (isSprite) {
      src.start(now, sliceOffsetSec, sliceDurationSec)
    } else {
      src.start(now)
    }
    src.stop(now + dur + 0.04)
  }

  for (let i = 0; i < PREVIEW_PRESS_COUNT; i++) {
    const downBuf = buffers.down[_rrIndex % buffers.down.length]
    const upBuf = buffers.up[_rrIndex % Math.max(buffers.up.length, 1)]
    _rrIndex++
    const offsetSec = (i * PREVIEW_PRESS_GAP_MS) / 1000
    shapeNode(downBuf, 0.55 * norm, offsetSec)
    // Up offset uses the *real-time* gap between down and up, scaled by
    // playbackRate so a deeper voice still has a proportional release.
    shapeNode(upBuf, 0.4 * norm, offsetSec + (PREVIEW_UP_OFFSET_MS / 1000) / playbackRate)
  }
}

// ──────────────────────────────────────────────────────────────────────────
// VolumeSlider — vertical, 20-step snap, rubber-band overdrag
// ──────────────────────────────────────────────────────────────────────────
function VolumeIcon({ volume, className, style }) {
  if (volume === 0) return <VolumeX className={className} style={style} aria-hidden="true" />
  if (volume < 0.34) return <Volume className={className} style={style} aria-hidden="true" />
  if (volume < 0.67) return <Volume1 className={className} style={style} aria-hidden="true" />
  return <Volume2 className={className} style={style} aria-hidden="true" />
}

function VolumeSlider({ volume, setVolume, onReleasePreview }) {
  // Imperative DOM updates throughout the drag, mirroring TonePad. React state
  // is reserved for the post-drag "settled" rendering and the volume value
  // itself; everything else (fill height, stretch deformation, knob-style
  // transforms) is set on element.style directly per pointer event so we
  // never wait for a React render between mouse motion and visual update.
  const wrapRef = useRef(null)
  const trackRef = useRef(null)
  const fillRef = useRef(null)
  const draggingRef = useRef(false)
  const movedRef = useRef(false)
  const downRef = useRef({ x: 0, y: 0 })
  const lastSnappedRef = useRef(volume)

  // Spring catch-up runs only when *not* dragging (idle volume changes from
  // outside, e.g. a future "Reset" button). During a drag we set the fill
  // height directly per move so it locks to the cursor.
  useEffect(() => {
    if (draggingRef.current) return
    let raf = 0
    let v = parseFloat(fillRef.current?.dataset.lastV || `${volume}`)
    let velocity = 0
    let lastT = performance.now()
    const tick = (t) => {
      const dt = Math.min(0.04, (t - lastT) / 1000)
      lastT = t
      const force = (volume - v) * 200
      const friction = velocity * 22
      velocity += (force - friction) * dt
      v += velocity * dt
      if (fillRef.current) {
        fillRef.current.style.height = `${v * 100}%`
        fillRef.current.dataset.lastV = `${v}`
      }
      if (Math.abs(volume - v) < 0.0005 && Math.abs(velocity) < 0.01) {
        if (fillRef.current) fillRef.current.style.height = `${volume * 100}%`
        return
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [volume])

  const applyTrackTransform = (stretchAmount, stretchDirection, dragging) => {
    const track = trackRef.current
    if (!track) return
    const w = dragging ? SLIDER_WIDTH - 10 - stretchAmount * 24 : SLIDER_WIDTH
    const h = PAD_SIZE + stretchAmount * 60
    const offsetY = -stretchDirection * stretchAmount * 30
    track.style.width = `${w}px`
    track.style.height = `${h}px`
    track.style.transform = `translateY(${offsetY}px)`
    // Keep the smooth 240ms spring transition on the track itself even while
    // dragging — width, height, and rubber-band offset don't need to be
    // pixel-locked to the cursor (they're soft visual feedback). The thing
    // that *does* lock to the cursor is the fill height, which we set
    // directly on `fillRef` in update() and that element has no transition.
    track.style.transition =
      'width 240ms cubic-bezier(.34,1.4,.64,1), height 240ms cubic-bezier(.34,1.4,.64,1), transform 240ms cubic-bezier(.34,1.4,.64,1)'
  }

  const update = (e) => {
    const el = wrapRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const rawRatio = 1 - (e.clientY - rect.top) / rect.height
    const snapped = snapVolume(clamp01(rawRatio))
    if (snapped !== lastSnappedRef.current) {
      lastSnappedRef.current = snapped
      setVolume(snapped)
      playTick(0.7)
    }
    // Only drive the fill height imperatively once the pointer has actually
    // moved past the drag threshold — that's when the user wants the fill to
    // lock to the cursor. Before that (i.e. a tap), let the spring useEffect
    // animate the fill from its current rendered height to the new volume so
    // the bar glides to the click point instead of jumping.
    if (movedRef.current && fillRef.current) {
      fillRef.current.style.height = `${clamp01(rawRatio) * 100}%`
      fillRef.current.dataset.lastV = `${clamp01(rawRatio)}`
    }
    const overshoot = rawRatio > 1 ? rawRatio - 1 : rawRatio < 0 ? -rawRatio : 0
    const stretchAmount = Math.min(overshoot * 0.8, 0.15)
    const stretchDirection = rawRatio > 1 ? 1 : rawRatio < 0 ? -1 : 0
    applyTrackTransform(stretchAmount, stretchDirection, true)
  }

  const handlePointerDown = (e) => {
    if (e.button != null && e.button !== 0) return
    e.preventDefault()
    e.currentTarget.setPointerCapture?.(e.pointerId)
    const ctx = getCtx()
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {})
    draggingRef.current = true
    movedRef.current = false
    downRef.current = { x: e.clientX, y: e.clientY }
    update(e)
  }

  const handlePointerMove = (e) => {
    if (!draggingRef.current) return
    if (!movedRef.current) {
      const dx = e.clientX - downRef.current.x
      const dy = e.clientY - downRef.current.y
      if (dx * dx + dy * dy > 16) {
        movedRef.current = true
      }
    }
    update(e)
  }

  const endDrag = () => {
    if (!draggingRef.current) return
    draggingRef.current = false
    // Snap stretch back to zero with the spring transition; let the next
    // useEffect cycle drive the fill height to its final spring-settled
    // position from the current snapped volume.
    applyTrackTransform(0, 0, false)
    // Audible test-type preview at the new volume so the user hears what
    // they just dialled in. Pass the snapped value explicitly — React state
    // hasn't necessarily flushed by this synchronous release.
    onReleasePreview?.({ volume: lastSnappedRef.current })
  }

  return (
    <div
      ref={wrapRef}
      className="relative flex items-center justify-center cursor-grab touch-none select-none active:cursor-grabbing"
      style={{ width: SLIDER_WIDTH, height: PAD_SIZE }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onLostPointerCapture={endDrag}
    >
      <div
        ref={trackRef}
        className="relative pointer-events-none"
        style={{
          width: SLIDER_WIDTH,
          height: PAD_SIZE,
          borderRadius: 28,
          transform: 'translateY(0px)',
          transition:
            'width 240ms cubic-bezier(.34,1.4,.64,1), height 240ms cubic-bezier(.34,1.4,.64,1), transform 240ms cubic-bezier(.34,1.4,.64,1)',
          overflow: 'hidden',
        }}
      >
        <div className="absolute inset-0" style={{ background: 'rgba(255,255,255,0.12)' }} />
        <div
          ref={fillRef}
          className="absolute inset-x-0 bottom-0"
          style={{ height: `${volume * 100}%`, background: 'white' }}
        />
        <div className="absolute inset-x-0 bottom-4 flex items-center justify-center pointer-events-none">
          <VolumeIcon
            volume={volume}
            className="h-3.5 w-3.5"
            style={{ color: volume > 0.08 ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.4)' }}
          />
        </div>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────
// TonePad — fully imperative knob/dot updates
// ──────────────────────────────────────────────────────────────────────────
const CENTER_IDX = (GRID_COUNT - 1) / 2

function TonePad({ toneX, toneY, setTone, onReleasePreview }) {
  const padRef = useRef(null)
  const knobWrapRef = useRef(null)
  const haloScaleRef = useRef(null)
  const knobScaleRef = useRef(null)
  const dotRefs = useRef([])
  const dragRef = useRef({
    active: false,
    x: toneX,
    y: toneY,
    lastCol: -1,
    lastRow: -1,
    pointerId: -1,
    moved: false,
    downX: 0,
    downY: 0,
  })
  const [, forceRender] = useState(0)
  const releaseTimerRef = useRef(0)

  const renderImperative = useCallback((thumbX, thumbY, dragging) => {
    const knobX = PADDING + thumbX * USABLE
    const knobY = PADDING + (1 - thumbY) * USABLE
    if (knobWrapRef.current) {
      knobWrapRef.current.style.transform = `translate3d(${knobX}px, ${knobY}px, 0)`
    }
    const activeCol = Math.round(thumbX * (GRID_COUNT - 1))
    const activeRow = Math.round((1 - thumbY) * (GRID_COUNT - 1))
    const dots = dotRefs.current
    for (let i = 0; i < dots.length; i++) {
      const dot = dots[i]
      if (!dot) continue
      const col = i % GRID_COUNT
      const row = Math.floor(i / GRID_COUNT)
      let proximity = 0
      if (dragging) {
        const dx = col - thumbX * (GRID_COUNT - 1)
        const dy = row - (1 - thumbY) * (GRID_COUNT - 1)
        const dist = Math.sqrt(dx * dx + dy * dy)
        proximity = Math.max(0, 1 - dist / PROXIMITY_RADIUS)
      }
      const isCenter = col === CENTER_IDX && row === CENTER_IDX
      if (isCenter) {
        const ringSize = DOT_SIZE * 2.6 + proximity * 10
        dot.style.width = `${ringSize}px`
        dot.style.height = `${ringSize}px`
        dot.style.borderColor = `rgba(255,255,255,${0.38 + proximity * 0.25})`
      } else {
        const onAxis = col === activeCol || row === activeRow
        const onBoth = col === activeCol && row === activeRow
        const size = DOT_SIZE + proximity * 18
        const opacity = onBoth ? 0.5 : onAxis ? 0.4 : 0.1 + proximity * 0.25
        dot.style.width = `${size}px`
        dot.style.height = `${size}px`
        dot.style.background = `rgba(255,255,255,${opacity})`
      }
    }
  }, [])

  // Keep visuals in sync with external toneX/toneY changes (e.g. switch
  // changes shouldn't move the knob, but a future "reset" would).
  useLayoutEffect(() => {
    renderImperative(toneX, toneY, dragRef.current.active)
  }, [toneX, toneY, renderImperative])

  const updateFromPointer = (clientX, clientY) => {
    const el = padRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const dx = clamp01((clientX - rect.left - PADDING) / USABLE)
    const dy = clamp01(1 - (clientY - rect.top - PADDING) / USABLE)
    dragRef.current.x = dx
    dragRef.current.y = dy
    const col = Math.round(dx * (GRID_COUNT - 1))
    const row = Math.round((1 - dy) * (GRID_COUNT - 1))
    if (col !== dragRef.current.lastCol || row !== dragRef.current.lastRow) {
      dragRef.current.lastCol = col
      dragRef.current.lastRow = row
      playTick(1)
    }
    renderImperative(dx, dy, true)
  }

  const handlePointerDown = (e) => {
    if (e.button != null && e.button !== 0) return
    e.preventDefault()
    e.currentTarget.setPointerCapture?.(e.pointerId)
    const ctx = getCtx()
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {})
    if (releaseTimerRef.current) {
      clearTimeout(releaseTimerRef.current)
      releaseTimerRef.current = 0
    }
    dragRef.current.active = true
    dragRef.current.pointerId = e.pointerId
    dragRef.current.moved = false
    dragRef.current.downX = e.clientX
    dragRef.current.downY = e.clientY
    // Drive the knob/halo scale via direct DOM mutation so we don't pay for
    // a React render on drag-start either. The transition is set in JSX so
    // CSS does the springy bloom.
    if (haloScaleRef.current) {
      haloScaleRef.current.style.transform = 'scale(2.8)'
      haloScaleRef.current.style.background = 'rgba(255,255,255,0.12)'
    }
    if (knobScaleRef.current) {
      knobScaleRef.current.style.transform = 'scale(2.8)'
      knobScaleRef.current.style.boxShadow = '0 0 10px rgba(255,255,255,0.5)'
    }
    // Keep the spring transition active on press so a tap glides to the
    // click point. We only kill the transition once the pointer actually
    // moves past the drag threshold, switching to instant cursor-follow.
    if (knobWrapRef.current) {
      knobWrapRef.current.style.transition = 'transform 380ms cubic-bezier(.34,1.4,.64,1)'
    }
    updateFromPointer(e.clientX, e.clientY)
  }

  const handlePointerMove = (e) => {
    if (!dragRef.current.active) return
    if (!dragRef.current.moved) {
      const dx = e.clientX - dragRef.current.downX
      const dy = e.clientY - dragRef.current.downY
      if (dx * dx + dy * dy > 16) {
        dragRef.current.moved = true
        if (knobWrapRef.current) knobWrapRef.current.style.transition = 'transform 0s'
      }
    }
    updateFromPointer(e.clientX, e.clientY)
  }

  const endDrag = () => {
    if (!dragRef.current.active) return
    const snappedX = snapTone(dragRef.current.x)
    const snappedY = snapTone(dragRef.current.y)
    dragRef.current.active = false
    dragRef.current.lastCol = -1
    dragRef.current.lastRow = -1
    setTone(snappedX, snappedY)
    onReleasePreview?.({ toneX: snappedX, toneY: snappedY })
    // Spring the knob to the snapped grid intersection.
    if (knobWrapRef.current) {
      knobWrapRef.current.style.transition = 'transform 380ms cubic-bezier(.34,1.4,.64,1)'
    }
    renderImperative(snappedX, snappedY, false)
    // Keep the knob bloomed for a brief tail before deflating, matching the
    // 150ms grace period in the macOS gesture's onEnded.
    releaseTimerRef.current = window.setTimeout(() => {
      if (haloScaleRef.current) {
        haloScaleRef.current.style.transform = 'scale(1)'
        haloScaleRef.current.style.background = 'rgba(255,255,255,0)'
      }
      if (knobScaleRef.current) {
        knobScaleRef.current.style.transform = 'scale(1)'
        knobScaleRef.current.style.boxShadow = '0 0 4px rgba(255,255,255,0.15)'
      }
    }, 150)
    // Trigger a render so React's view of e.g. cursor styling stays in sync;
    // visual updates are already done imperatively above.
    forceRender((n) => n + 1)
  }

  useEffect(() => () => {
    if (releaseTimerRef.current) clearTimeout(releaseTimerRef.current)
  }, [])

  // Pre-build dot definitions once.
  const dotsArr = []
  for (let row = 0; row < GRID_COUNT; row++) {
    for (let col = 0; col < GRID_COUNT; col++) {
      dotsArr.push({ col, row })
    }
  }

  return (
    <div
      ref={padRef}
      className="relative cursor-grab touch-none select-none active:cursor-grabbing"
      style={{
        width: PAD_SIZE,
        height: PAD_SIZE,
        borderRadius: 16,
        background: 'rgba(255,255,255,0.08)',
        border: '0.5px solid rgba(255,255,255,0.1)',
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onLostPointerCapture={endDrag}
    >
      {dotsArr.map(({ col, row }, idx) => {
        const cx = PADDING + (USABLE * col) / (GRID_COUNT - 1)
        const cy = PADDING + (USABLE * row) / (GRID_COUNT - 1)
        const isCenter = col === CENTER_IDX && row === CENTER_IDX
        return (
          <div
            key={idx}
            className="absolute pointer-events-none"
            style={{
              left: cx,
              top: cy,
              transform: 'translate(-50%, -50%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              ref={(r) => { dotRefs.current[idx] = r }}
              style={
                isCenter
                  ? {
                      width: DOT_SIZE * 2.6,
                      height: DOT_SIZE * 2.6,
                      borderRadius: '50%',
                      border: '1px solid rgba(255,255,255,0.38)',
                      borderColor: 'rgba(255,255,255,0.38)',
                      transition: 'background-color 150ms ease-out, border-color 150ms ease-out',
                    }
                  : {
                      width: DOT_SIZE,
                      height: DOT_SIZE,
                      borderRadius: '50%',
                      background: 'rgba(255,255,255,0.1)',
                      transition: 'background-color 150ms ease-out',
                    }
              }
            />
          </div>
        )
      })}

      {/* Knob — outer wrapper carries the position (set imperatively, no
          transition while dragging so it stays nailed to the cursor). Inner
          halo/body carry the scale + glow (set imperatively too, with a CSS
          transition for the springy bloom). */}
      <div
        ref={knobWrapRef}
        className="absolute pointer-events-none top-0 left-0"
        style={{
          transform: `translate3d(${PADDING + toneX * USABLE}px, ${PADDING + (1 - toneY) * USABLE}px, 0)`,
          transition: 'transform 380ms cubic-bezier(.34,1.4,.64,1)',
          willChange: 'transform',
        }}
      >
        <div
          ref={haloScaleRef}
          style={{
            width: KNOB_SIZE * 2,
            height: KNOB_SIZE * 2,
            marginLeft: -KNOB_SIZE,
            marginTop: -KNOB_SIZE,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0)',
            filter: 'blur(6px)',
            transform: 'scale(1)',
            transformOrigin: 'center',
            transition: 'transform 380ms cubic-bezier(.34,1.4,.64,1), background-color 220ms ease-out',
            position: 'absolute',
          }}
        />
        <div
          ref={knobScaleRef}
          style={{
            width: KNOB_SIZE,
            height: KNOB_SIZE,
            marginLeft: -KNOB_SIZE / 2,
            marginTop: -KNOB_SIZE / 2,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.9)',
            boxShadow: '0 0 4px rgba(255,255,255,0.15)',
            transform: 'scale(1)',
            transformOrigin: 'center',
            transition: 'transform 380ms cubic-bezier(.34,1.4,.64,1), box-shadow 240ms ease-out',
            position: 'absolute',
          }}
        />
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────
// SwitchPicker — light pill above the dark glass card. Mirrors the screenshot
// style ("Switches" label + colored swatch + name + chevron) and reuses the
// project's EASTER_EGG_PROFILES so the choices match the rest of the site.
// ──────────────────────────────────────────────────────────────────────────

// Skeuomorphic keycap swatch — a faithful web port of the macOS-menu keycap
// glyph (see keycap.js / KeycapIcon.swift): a gradient-lit cap with a top-edge
// highlight, a hairline border, and an embossed gradient "+" cross stem (two
// thin bars so the cross hits dead center at any size, independent of font
// metrics).
function SwitchSwatch({ color, className = '', style }) {
  const { bodyGradient, boxShadow, crossGradient } = keycapStyle(color)
  return (
    <span
      className={`relative block shrink-0 rounded-[3px] h-[11px] w-[11px] sm:h-[13px] sm:w-[13px] ${className}`}
      style={{ background: bodyGradient, boxShadow, ...style }}
      aria-hidden="true"
    >
      <span className="absolute inset-0 flex items-center justify-center">
        <span className="absolute h-[5px] w-[1.4px] sm:h-[6px] sm:w-[1.7px] rounded-full" style={{ background: crossGradient }} />
        <span className="absolute h-[1.4px] w-[5px] sm:h-[1.7px] sm:w-[6px] rounded-full" style={{ background: crossGradient }} />
      </span>
    </span>
  )
}

function SwatchAndName({ profile }) {
  const name = displaySwitchName(profile.name)
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap sm:gap-2.5">
      <SwitchSwatch color={profile.color} />
      <span className="text-[11px] font-medium tracking-tight text-neutral-900 sm:text-sm">
        {name}
      </span>
    </span>
  )
}

// Smoothly resizes the pill between switches: a hidden measurer reports the
// natural width of the new content, and that width is applied (with a CSS
// transition) to the visible layer. No entry animation on the content itself
// — the swap is instantaneous, only the width interpolates.
function FluidPillContent({ profile }) {
  const measureRef = useRef(null)
  const [width, setWidth] = useState(null)


  useLayoutEffect(() => {
    const raf = requestAnimationFrame(() => {
      if (measureRef.current) setWidth(measureRef.current.offsetWidth)
    })
    return () => cancelAnimationFrame(raf)
  }, [profile])

  return (
    <span className="relative inline-flex items-center leading-none align-middle">
      {/* Mirrors AnimatedCity's pattern in Globe.jsx exactly: the measurer
          is absolutely positioned (so it doesn't contribute its width to
          the wrapper), but offsetWidth still reports the natural content
          width — that becomes the explicit width applied to the visible
          layer below, with a CSS transition smoothing the change between
          switches. The visible layer stays in normal flow so it drives the
          wrapper's bounding box. */}
      <span
        ref={measureRef}
        aria-hidden="true"
        className="invisible whitespace-nowrap absolute left-0 top-0 pointer-events-none inline-flex items-center"
      >
        <SwatchAndName profile={profile} />
      </span>
      <span
        className="inline-flex items-center whitespace-nowrap"
        style={{
          width: width != null ? `${width}px` : 'auto',
          transition: 'width 0.35s cubic-bezier(0.32, 0.72, 0.32, 1)',
        }}
      >
        <SwatchAndName profile={profile} />
      </span>
    </span>
  )
}

function SwitchPicker({ profile, onSelect }) {
  // Two flags so the exit animation gets a chance to play:
  // - mounted: keeps the dropdown in the DOM
  // - visible: drives the open/closed style state. We flip visible -> false
  //   first, wait for the transition to finish (200ms), then unmount.
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)
  const wrapRef = useRef(null)
  const exitTimerRef = useRef(0)

  const options = EASTER_EGG_PROFILES

  const open = useCallback(() => {
    if (exitTimerRef.current) {
      clearTimeout(exitTimerRef.current)
      exitTimerRef.current = 0
    }
    setMounted(true)
    // requestAnimationFrame ensures the closed-state styles paint first so
    // the open transition runs from "scale 0.96, blur 8px, opacity 0" to
    // the open visuals — without this the initial render arrives already at
    // the open state and there's no animation.
    requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)))
  }, [])

  const close = useCallback(() => {
    setVisible(false)
    if (exitTimerRef.current) clearTimeout(exitTimerRef.current)
    exitTimerRef.current = window.setTimeout(() => {
      setMounted(false)
      exitTimerRef.current = 0
    }, 200)
  }, [])

  const toggle = useCallback(() => {
    if (visible) close()
    else open()
  }, [visible, open, close])

  useEffect(() => {
    if (!mounted) return
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) close()
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [mounted, close])

  useEffect(() => () => {
    if (exitTimerRef.current) clearTimeout(exitTimerRef.current)
  }, [])

  return (
    <div ref={wrapRef} className="inline-flex items-center gap-3">
      <span className="text-[15px] text-neutral-600 tracking-tight">Switches</span>
      <div className="relative">
      <button
        type="button"
        onClick={toggle}
        // Mirrors TypingPlayground.jsx's switches button so the two pills
        // feel like the same control: same padding, same fill, same active
        // press scale, same easing.
        className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-[11px] font-medium tracking-tight text-neutral-900 bg-black/[0.05] transition duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.96] sm:px-5 sm:py-2.5 sm:text-sm sm:gap-2.5"
        aria-expanded={visible}
        aria-haspopup="listbox"
      >
        <FluidPillContent profile={profile} />
        <svg
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`h-[10px] w-[10px] sm:h-3 sm:w-3 text-neutral-600 transition-transform duration-200 ${visible ? 'rotate-180' : ''}`}
          aria-hidden="true"
        >
          <polyline points="6 9 10 13 14 9" />
        </svg>
      </button>

      {mounted && (
        <div
          className="absolute left-1/2 bottom-[calc(100%+8px)] z-50 w-[320px] origin-bottom rounded-2xl border border-black/[0.06] bg-white p-2 shadow-[0_24px_60px_rgba(0,0,0,0.18)]"
          style={{
            opacity: visible ? 1 : 0,
            transform: visible
              ? 'translate(-50%, 0) scale(1)'
              : 'translate(-50%, 6px) scale(0.96)',
            filter: visible ? 'blur(0px)' : 'blur(8px)',
            transition:
              'opacity 200ms cubic-bezier(.34,1.4,.64,1), transform 220ms cubic-bezier(.34,1.4,.64,1), filter 200ms ease-out',
            pointerEvents: visible ? 'auto' : 'none',
            willChange: 'opacity, transform, filter',
          }}
        >
          {options.map((p) => {
            const selected = p.id === profile.id
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => { onSelect(p); close() }}
                className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors ${selected ? 'bg-neutral-100' : 'hover:bg-neutral-50'}`}
              >
                <span
                  className="flex h-5 w-5 items-center justify-center rounded-[5px] text-[11px] font-bold"
                  style={{ backgroundColor: p.color, color: 'rgba(0,0,0,0.55)' }}
                >
                  +
                </span>
                <div className="flex flex-col leading-tight">
                  <span className="text-[13px] font-semibold tracking-tight text-neutral-900">{displaySwitchName(p.name)}</span>
                  <span className="text-[11px] tracking-tight text-neutral-600">{p.brand} · {p.type}</span>
                </div>
              </button>
            )
          })}
        </div>
      )}
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────
// SoundPad (root) — switch picker above + dark glass card below
// ──────────────────────────────────────────────────────────────────────────
export default function SoundPad({
  initialVolume = 0.55,
  initialToneX = 0.5,
  initialToneY = 0.5,
  initialProfileId = 'novelkeys-cream',
  onChange,
}) {
  const initial = EASTER_EGG_PROFILES.find((p) => p.id === initialProfileId)
                  || EASTER_EGG_PROFILES[0]
  const [profile, setProfile] = useState(initial)
  const [volume, setVolumeState] = useState(initialVolume)
  const [toneX, setToneX] = useState(initialToneX)
  const [toneY, setToneY] = useState(initialToneY)

  // Preload ticks always, plus the active profile. Ticks are tiny so they
  // load instantly; alpha samples vary by profile and load per pick.
  useEffect(() => {
    loadTicks()
    if (profile) loadProfile(profile.id)
  }, [profile])

  const setVolume = useCallback((v) => {
    setVolumeState(v)
    onChange?.({ volume: v, toneX, toneY, profileId: profile?.id })
  }, [onChange, toneX, toneY, profile])

  const setTone = useCallback((x, y) => {
    setToneX(x)
    setToneY(y)
    onChange?.({ volume, toneX: x, toneY: y, profileId: profile?.id })
  }, [onChange, volume, profile])

  const handleSelectProfile = useCallback((p) => {
    setProfile(p)
    // Pre-warm the new profile so the very next release-preview is silent-free.
    loadProfile(p.id).then(() => {
      // Audible confirmation: tap the new switch once at neutral tone.
      playToneSample({ profileId: p.id, toneX, toneY, volume })
    })
  }, [toneX, toneY, volume])

  const handleReleasePreview = useCallback(
    (overrides = {}) => {
      playToneSample({
        profileId: profile?.id,
        toneX: overrides.toneX ?? toneX,
        toneY: overrides.toneY ?? toneY,
        volume: overrides.volume ?? volume,
      })
    },
    [toneX, toneY, volume, profile]
  )

  return (
    <div className="inline-flex flex-col items-center gap-3 tracking-tight">
      <div
        className="relative inline-block tracking-tight text-white"
        style={{
          background: 'rgba(12, 14, 19, 0.55)',
          backdropFilter: 'blur(36px) saturate(180%)',
          WebkitBackdropFilter: 'blur(36px) saturate(180%)',
          border: '1px solid rgba(255,255,255,0.10)',
          borderRadius: 22,
          // Outer drop shadows removed per request — only inset highlights
          // and a faint white outline remain to keep the glass character
          // (the specular ring at the top edge, a soft body shading, and
          // the refraction edge).
          boxShadow: [
            'inset 0 1px 0 rgba(255,255,255,0.18)',
            'inset 0 -1px 0 rgba(0,0,0,0.35)',
            'inset 0 0 0 1px rgba(255,255,255,0.04)',
          ].join(', '),
          padding: 16,
          userSelect: 'none',
          isolation: 'isolate',
        }}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            borderRadius: 'inherit',
            background:
              'linear-gradient(180deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.02) 18%, rgba(255,255,255,0) 38%, rgba(0,0,0,0) 78%, rgba(0,0,0,0.10) 100%), radial-gradient(120% 60% at 50% 0%, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0) 60%)',
          }}
        />
        <div className="relative flex flex-col" style={{ gap: 6 }}>
          <div className="flex items-start" style={{ gap: 14 }}>
            <div style={{ width: SLIDER_WIDTH }} />
            <div
              className="flex justify-between"
              style={{ width: PAD_SIZE, fontSize: 9, fontWeight: 500, color: 'rgba(255,255,255,0.3)' }}
            >
              <span>Warm</span>
              <span>Bright</span>
            </div>
          </div>

          <div className="flex items-start" style={{ gap: 14 }}>
            <VolumeSlider volume={volume} setVolume={setVolume} onReleasePreview={handleReleasePreview} />
            <TonePad
              toneX={toneX}
              toneY={toneY}
              setTone={setTone}
              onReleasePreview={handleReleasePreview}
            />
          </div>

          <div className="flex items-start" style={{ gap: 14 }}>
            <div
              className="text-center"
              style={{ width: SLIDER_WIDTH, fontSize: 9, fontWeight: 500, color: 'rgba(255,255,255,0.3)' }}
            >
              Volume
            </div>
            <div
              className="flex justify-between"
              style={{ width: PAD_SIZE, fontSize: 9, fontWeight: 500, color: 'rgba(255,255,255,0.3)' }}
            >
              <span>Thock</span>
              <span>Clack</span>
            </div>
          </div>
        </div>
      </div>

      <SwitchPicker profile={profile} onSelect={handleSelectProfile} />
    </div>
  )
}
