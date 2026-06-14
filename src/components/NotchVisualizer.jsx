import { useEffect, useMemo, useRef } from 'react'
import { useVisualizerEnabled } from '../useVisualizerEnabled.js'

// NotchVisualizer — web port of Sources/Keeb/UI/NotchVisualizer.swift.
// Renders the same five-row keyboard, glass-dark styling, ripple flash, and
// cursor-following lerp + tilt + stretch as the macOS app. Mounted globally;
// stays hidden until the first keydown, follows the mouse from then on, and
// fades back out after FADE_DELAY_MS of typing inactivity. Constants below
// are 1:1 with the Swift source so the geometry and motion match.

// ── Geometry ───────────────────────────────────────────────────────────────
// Web port renders just the keyboard board — the macOS NSPanel halo (30/36/40
// pt of glass around the board) was load-bearing on the desktop because the
// panel needed its own shadow/orderFront target, but on the web it reads as
// a redundant dark rectangle wrapping the keys, so we drop it. Sizes are
// scaled ~1.4× over the macOS source (which targets a tiny floating panel)
// so the visualizer reads cleanly at typical web viewing distance.
const KEY_SIZE = 17
const KEY_GAP = 1.5
const KEY_CORNER = 1.8
const BOARD_PADDING = 6
const BOARD_CORNER = 10
const KEY_LABEL_FONT_SIZE = 8

// ── Motion ─────────────────────────────────────────────────────────────────
const FOLLOW_OFFSET_X = 20
const FOLLOW_OFFSET_Y = 10
const FADE_DELAY_MS = 500
const LERP_FACTOR = 0.08
const SMOOTHING = 0.10
const MAX_ROT_Z = 5 // deg
const MAX_STRETCH = 0.06

// ── Ripple ─────────────────────────────────────────────────────────────────
const RIPPLE_REACH_FACTOR = 0.48
const RIPPLE_SPEED = 320 // px/s
const RIPPLE_NEIGHBOR_INTENSITY = 0.42
const RIPPLE_MIN_INTENSITY = 0.18
const RIPPLE_COOLDOWN_MS = 60

// ── Layout — five rows, width multipliers match the macOS spec at
// NotchVisualizer.swift:200–243. `code` matches KeyboardEvent.code so
// keydown events route to the right cap with no extra mapping. ─────────────
const ROWS = [
  // Row 0 — number row
  [
    { code: 'Backquote', label: '`', w: 1 },
    { code: 'Digit1', label: '1', w: 1 },
    { code: 'Digit2', label: '2', w: 1 },
    { code: 'Digit3', label: '3', w: 1 },
    { code: 'Digit4', label: '4', w: 1 },
    { code: 'Digit5', label: '5', w: 1 },
    { code: 'Digit6', label: '6', w: 1 },
    { code: 'Digit7', label: '7', w: 1 },
    { code: 'Digit8', label: '8', w: 1 },
    { code: 'Digit9', label: '9', w: 1 },
    { code: 'Digit0', label: '0', w: 1 },
    { code: 'Minus', label: '-', w: 1 },
    { code: 'Equal', label: '=', w: 1 },
    { code: 'Backspace', label: '⌫', w: 1.5 },
  ],
  // Row 1 — QWERTY
  [
    { code: 'Tab', label: '⇥', w: 1.5 },
    { code: 'KeyQ', label: 'Q', w: 1 },
    { code: 'KeyW', label: 'W', w: 1 },
    { code: 'KeyE', label: 'E', w: 1 },
    { code: 'KeyR', label: 'R', w: 1 },
    { code: 'KeyT', label: 'T', w: 1 },
    { code: 'KeyY', label: 'Y', w: 1 },
    { code: 'KeyU', label: 'U', w: 1 },
    { code: 'KeyI', label: 'I', w: 1 },
    { code: 'KeyO', label: 'O', w: 1 },
    { code: 'KeyP', label: 'P', w: 1 },
    { code: 'BracketLeft', label: '[', w: 1 },
    { code: 'BracketRight', label: ']', w: 1 },
    { code: 'Backslash', label: '\\', w: 1 },
  ],
  // Row 2 — home row
  [
    { code: 'CapsLock', label: '⇪', w: 1.75 },
    { code: 'KeyA', label: 'A', w: 1 },
    { code: 'KeyS', label: 'S', w: 1 },
    { code: 'KeyD', label: 'D', w: 1 },
    { code: 'KeyF', label: 'F', w: 1 },
    { code: 'KeyG', label: 'G', w: 1 },
    { code: 'KeyH', label: 'H', w: 1 },
    { code: 'KeyJ', label: 'J', w: 1 },
    { code: 'KeyK', label: 'K', w: 1 },
    { code: 'KeyL', label: 'L', w: 1 },
    { code: 'Semicolon', label: ';', w: 1 },
    { code: 'Quote', label: "'", w: 1 },
    { code: 'Enter', label: '⏎', w: 1.75 },
  ],
  // Row 3 — bottom row of letters
  [
    { code: 'ShiftLeft', label: '⇧', w: 2.25 },
    { code: 'KeyZ', label: 'Z', w: 1 },
    { code: 'KeyX', label: 'X', w: 1 },
    { code: 'KeyC', label: 'C', w: 1 },
    { code: 'KeyV', label: 'V', w: 1 },
    { code: 'KeyB', label: 'B', w: 1 },
    { code: 'KeyN', label: 'N', w: 1 },
    { code: 'KeyM', label: 'M', w: 1 },
    { code: 'Comma', label: ',', w: 1 },
    { code: 'Period', label: '.', w: 1 },
    { code: 'Slash', label: '/', w: 1 },
    { code: 'ShiftRight', label: '⇧', w: 2.25 },
  ],
  // Row 4 — space row
  [
    { code: 'Fn', label: 'fn', w: 1 },
    { code: 'ControlLeft', label: '⌃', w: 1 },
    { code: 'AltLeft', label: '⌥', w: 1.25 },
    { code: 'MetaLeft', label: '⌘', w: 1.25 },
    { code: 'Space', label: '', w: 5 },
    { code: 'MetaRight', label: '⌘', w: 1.25 },
    { code: 'AltRight', label: '⌥', w: 1.25 },
    { code: 'ArrowLeft', label: '◀', w: 1 },
    { code: 'ArrowRight', label: '▶', w: 1 },
  ],
]

// Compute key positions. Each row's width is sum(KEY_SIZE * w_i) + (n-1)*GAP;
// rows narrower than the widest get the deficit split between their first
// and last keys, matching the macOS algorithm at NotchVisualizer.swift:460–467.
function computeLayout() {
  const rowWidths = ROWS.map((row) => {
    const keys = row.reduce((acc, k) => acc + KEY_SIZE * k.w, 0)
    const gaps = (row.length - 1) * KEY_GAP
    return keys + gaps
  })
  const contentWidth = Math.max(...rowWidths)

  const keys = []
  ROWS.forEach((row, r) => {
    const deficit = contentWidth - rowWidths[r]
    const splitFirst = deficit / 2
    const splitLast = deficit - splitFirst
    let x = 0
    row.forEach((k, c) => {
      let extra = 0
      if (c === 0) extra += splitFirst
      if (c === row.length - 1) extra += splitLast
      const w = KEY_SIZE * k.w + extra
      const h = KEY_SIZE
      const y = r * (KEY_SIZE + KEY_GAP)
      keys.push({ ...k, x, y, w, h, row: r, col: c })
      x += w + KEY_GAP
    })
  })

  const boardWidth = contentWidth + BOARD_PADDING * 2
  const boardHeight = 5 * KEY_SIZE + 4 * KEY_GAP + BOARD_PADDING * 2
  return { keys, boardWidth, boardHeight }
}

const LAYOUT = computeLayout()
const KEY_INDEX = LAYOUT.keys.reduce((acc, k, idx) => {
  acc[k.code] = idx
  return acc
}, {})

function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)) }

export default function NotchVisualizer() {
  const enabled = useVisualizerEnabled()
  const paneRef = useRef(null)
  const innerRef = useRef(null)
  const flashRefs = useRef([])

  const stateRef = useRef('hidden') // 'hidden' | 'shown'
  const enabledRef = useRef(enabled)
  enabledRef.current = enabled
  const targetRef = useRef({ x: 0, y: 0 })
  const currentRef = useRef({ x: 0, y: 0 })
  const seenMouseRef = useRef(false)
  const rotRef = useRef(0)
  const stretchRef = useRef(0)
  const lastRippleAtRef = useRef(0)
  const fadeTimerRef = useRef(0)
  const rafRef = useRef(0)

  // Pre-compute a flat array of [x, y] centers for ripple distance lookups
  // so the hot path doesn't allocate per keydown.
  const keyCenters = useMemo(
    () => LAYOUT.keys.map((k) => [k.x + k.w / 2, k.y + k.h / 2]),
    [],
  )
  const boardReach = useMemo(
    () => Math.hypot(LAYOUT.boardWidth, LAYOUT.boardHeight),
    [],
  )

  const setShown = (shown) => {
    if (stateRef.current === (shown ? 'shown' : 'hidden')) return
    stateRef.current = shown ? 'shown' : 'hidden'
    const inner = innerRef.current
    if (!inner) return
    if (shown) {
      // Snap pane to current cursor target on first show so it doesn't
      // animate in from (0,0). Match the macOS expand: bouncy spring scale
      // from a slight under-size, opacity 0 → 1.
      if (!seenMouseRef.current) {
        // No mouse position yet (e.g. user typed before moving the mouse).
        // Park it just off the top-right corner so it doesn't sit at 0,0.
        currentRef.current = { x: window.innerWidth - LAYOUT.boardWidth - 24, y: 24 }
        targetRef.current = { ...currentRef.current }
      } else {
        currentRef.current = { ...targetRef.current }
      }
      inner.style.transition =
        'opacity 220ms ease-out, transform 420ms cubic-bezier(.34,1.4,.64,1)'
      inner.style.opacity = '1'
      inner.style.transform = 'scale(1)'
    } else {
      inner.style.transition =
        'opacity 240ms ease-in, transform 280ms cubic-bezier(.4,0,.2,1)'
      inner.style.opacity = '0'
      inner.style.transform = 'scale(0.86)'
    }
  }

  const flashKey = (idx, intensity, delayMs) => {
    const el = flashRefs.current[idx]
    if (!el) return
    const peak = Math.min(1, intensity * 1.1)
    // Match the per-key duration ramp from the Swift source:
    // 0.32s base + (1 - intensity) * 0.1s extra for distant ripple keys.
    const dur = 320 + (1 - intensity) * 100
    const apply = () => {
      el.style.transition = 'none'
      el.style.opacity = String(peak * 0.7)
      // Force reflow so the next assignment animates instead of replacing.
      // eslint-disable-next-line no-unused-expressions
      el.offsetHeight
      el.style.transition = `opacity ${dur}ms ease-out`
      el.style.opacity = '0'
    }
    if (delayMs > 0) setTimeout(apply, delayMs)
    else apply()
  }

  const ripple = (centerIdx) => {
    flashKey(centerIdx, 1.0, 0)
    const now = performance.now()
    if (now - lastRippleAtRef.current < RIPPLE_COOLDOWN_MS) return
    lastRippleAtRef.current = now
    const [cx, cy] = keyCenters[centerIdx]
    const maxR = boardReach * RIPPLE_REACH_FACTOR
    for (let i = 0; i < keyCenters.length; i++) {
      if (i === centerIdx) continue
      const [ox, oy] = keyCenters[i]
      const dist = Math.hypot(ox - cx, oy - cy)
      if (dist > maxR) continue
      const norm = Math.max(0, 1 - dist / maxR)
      const strength = Math.pow(norm, 1.35)
      const intensity = strength * RIPPLE_NEIGHBOR_INTENSITY
      if (intensity < RIPPLE_MIN_INTENSITY) continue
      flashKey(i, intensity, (dist / RIPPLE_SPEED) * 1000)
    }
  }

  // Hide immediately when the user toggles the visualizer off — don't wait
  // for the idle fade to fire, since they explicitly asked for it gone.
  useEffect(() => {
    if (!enabled && stateRef.current === 'shown') {
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current)
      setShown(false)
    }
  }, [enabled])

  // Mouse tracking — anchored to the cursor with the same +20/+10 offset the
  // macOS panel uses for its bottom-right cursor anchor (the anchor's
  // "bottomRight" means the pane sits to the bottom-right of the cursor).
  // Cursor motion also resets the idle-fade timer *only while shown*, so
  // dragging the mouse around keeps the visualizer up — the timeout fires
  // only when both typing and pointer movement go quiet. We don't show on
  // mousemove from hidden, since the visualizer is meant to appear with
  // typing, not as a passive cursor halo.
  useEffect(() => {
    const onMove = (e) => {
      seenMouseRef.current = true
      targetRef.current = {
        x: e.clientX + FOLLOW_OFFSET_X,
        y: e.clientY + FOLLOW_OFFSET_Y,
      }
      if (stateRef.current === 'shown') {
        if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current)
        fadeTimerRef.current = window.setTimeout(() => setShown(false), FADE_DELAY_MS)
      }
    }
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [])

  // Keydown — show on first keystroke, flash + ripple, and reset the idle
  // fade timer. Capture phase so contentEditable / input handlers downstream
  // still see the event with their default behavior intact.
  useEffect(() => {
    const onDown = (e) => {
      if (!enabledRef.current) return
      const idx = KEY_INDEX[e.code]
      if (stateRef.current !== 'shown') setShown(true)
      if (idx != null) ripple(idx)
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current)
      fadeTimerRef.current = window.setTimeout(() => setShown(false), FADE_DELAY_MS)
    }
    window.addEventListener('keydown', onDown, true)
    return () => {
      window.removeEventListener('keydown', onDown, true)
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current)
    }
  }, [])

  // RAF loop — lerps cursor follow at 60Hz with the same factors as the Swift
  // 1/60 timer (NotchVisualizer.swift:728–796). Velocity is computed in
  // per-frame pixels so the macOS tilt formula (-vx/5 * 5deg, clamped) ports
  // directly without re-tuning.
  useEffect(() => {
    let prevX = currentRef.current.x
    let prevY = currentRef.current.y
    const tick = () => {
      const tgt = targetRef.current
      const cur = currentRef.current
      const nx = cur.x + (tgt.x - cur.x) * LERP_FACTOR
      const ny = cur.y + (tgt.y - cur.y) * LERP_FACTOR
      const vx = nx - prevX
      const vy = ny - prevY
      prevX = nx
      prevY = ny
      currentRef.current = { x: nx, y: ny }

      const targetRot = clamp(-vx / 5 * MAX_ROT_Z, -MAX_ROT_Z, MAX_ROT_Z)
      rotRef.current += (targetRot - rotRef.current) * SMOOTHING
      const speed = Math.hypot(vx, vy)
      const intensity = Math.min(speed / 5, 1)
      const targetStretch = intensity * MAX_STRETCH
      stretchRef.current += (targetStretch - stretchRef.current) * SMOOTHING

      const pane = paneRef.current
      if (pane) {
        const s = stretchRef.current
        const r = rotRef.current
        pane.style.transform =
          `translate3d(${nx}px, ${ny}px, 0) rotate(${r}deg) scale(${1 + s}, ${1 - s * 0.4})`
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  return (
    <div
      ref={paneRef}
      aria-hidden="true"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: LAYOUT.boardWidth,
        height: LAYOUT.boardHeight,
        pointerEvents: 'none',
        zIndex: 2147483600,
        willChange: 'transform',
        transformOrigin: 'center center',
      }}
    >
      {/* Board — non-glass theme from NotchVisualizer.swift: solid frameColor
          fill rgba(26,26,28,0.96), 0.5pt rgba(51,51,51,0.5) hairline border
          (the pane border, applied here since the pane wrapper was dropped),
          continuous 8pt corner. The board is the entire visualizer now. */}
      <div
        ref={innerRef}
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: BOARD_CORNER,
          background: 'rgba(26,26,28,0.96)',
          border: '0.5px solid rgba(51,51,51,0.5)',
          boxShadow: '0 18px 50px rgba(0,0,0,0.35)',
          overflow: 'hidden',
          opacity: 0,
          transform: 'scale(0.86)',
          transformOrigin: 'center center',
          willChange: 'opacity, transform',
        }}
      >
        {LAYOUT.keys.map((k, idx) => (
          <div
            key={k.code}
            style={{
              position: 'absolute',
              left: BOARD_PADDING + k.x,
              top: BOARD_PADDING + k.y,
              width: k.w,
              height: k.h,
              borderRadius: KEY_CORNER,
              background: 'rgb(43,43,43)',
              border: '0.5px solid rgba(61,61,61,0.4)',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'rgba(255,255,255,0.6)',
              fontSize: KEY_LABEL_FONT_SIZE,
              fontWeight: 500,
              fontFamily:
                '-apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif',
              letterSpacing: '-0.02em',
            }}
          >
            <span style={{ pointerEvents: 'none' }}>{k.label}</span>
            <div
              ref={(el) => { flashRefs.current[idx] = el }}
              style={{
                position: 'absolute',
                inset: 0,
                background: 'rgba(255,255,255,1)',
                opacity: 0,
                pointerEvents: 'none',
                willChange: 'opacity',
              }}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
