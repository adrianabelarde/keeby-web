import React, { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import createGlobe from 'cobe'
import { createClient } from '@supabase/supabase-js'
import { subscribeLastKey } from '../useKeyboardSounds.js'

// Lazy-init the Supabase client so we don't spin up a WS pool unless this
// component actually mounts. Anon key is required client-side for Realtime;
// add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local + Vercel env.
let _supabase = null
function getSupabase() {
  if (_supabase) return _supabase
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) return null
  _supabase = createClient(url, key, {
    auth: { persistSession: false },
    realtime: { params: { eventsPerSecond: 20 } },
  })
  return _supabase
}

// IANA timezone → city in our CITIES list. Picks the right starter city
// for the visitor based on their browser's timezone — privacy-friendly,
// no GeoIP / Geolocation API needed.
const TZ_TO_CITY_NAME = {
  'Asia/Manila':       'Manila',
  'Asia/Tokyo':        'Tokyo',
  'Asia/Seoul':        'Seoul',
  'Asia/Singapore':    'Singapore',
  'Asia/Jakarta':      'Jakarta',
  'Asia/Bangkok':      'Bangkok',
  'Asia/Hong_Kong':    'Hong Kong',
  'Asia/Shanghai':     'Shanghai',
  'Asia/Kolkata':      'Mumbai',
  'Asia/Calcutta':     'Mumbai',
  'Asia/Dubai':        'Dubai',
  'Asia/Istanbul':     'Istanbul',
  'Asia/Kuala_Lumpur': 'Kuala Lumpur',
  'Asia/Ho_Chi_Minh':  'Ho Chi Minh',
  'Asia/Taipei':       'Taipei',
  'Asia/Tel_Aviv':     'Tel Aviv',
  'Europe/London':     'London',
  'Europe/Paris':      'Paris',
  'Europe/Berlin':     'Berlin',
  'Europe/Madrid':     'Madrid',
  'Europe/Rome':       'Rome',
  'Europe/Amsterdam':  'Amsterdam',
  'Europe/Stockholm':  'Stockholm',
  'Europe/Moscow':     'Moscow',
  'Europe/Lisbon':     'Lisbon',
  'Europe/Dublin':     'Dublin',
  'Europe/Vienna':     'Vienna',
  'Europe/Warsaw':     'Warsaw',
  'America/New_York':       'New York',
  'America/Toronto':        'Toronto',
  'America/Chicago':        'Chicago',
  'America/Denver':         'Denver',
  'America/Los_Angeles':    'San Francisco',
  'America/Vancouver':      'Vancouver',
  'America/Sao_Paulo':      'Sao Paulo',
  'America/Mexico_City':    'Mexico City',
  'Australia/Sydney':       'Sydney',
  'Australia/Melbourne':    'Melbourne',
  'Africa/Cairo':           'Cairo',
  'Africa/Lagos':           'Lagos',
  'Africa/Johannesburg':    'Cape Town',
}

const CITIES = [
  { name: 'Manila',        lat: 14.5995, lng: 120.9842 },
  { name: 'Tokyo',         lat: 35.6762, lng: 139.6503 },
  { name: 'Seoul',         lat: 37.5665, lng: 126.9780 },
  { name: 'Singapore',     lat:  1.3521, lng: 103.8198 },
  { name: 'Jakarta',       lat: -6.2088, lng: 106.8456 },
  { name: 'Bangkok',       lat: 13.7563, lng: 100.5018 },
  { name: 'Hong Kong',     lat: 22.3193, lng: 114.1694 },
  { name: 'Shanghai',      lat: 31.2304, lng: 121.4737 },
  { name: 'Mumbai',        lat: 19.0760, lng:  72.8777 },
  { name: 'Bengaluru',     lat: 12.9716, lng:  77.5946 },
  { name: 'Dubai',         lat: 25.2048, lng:  55.2708 },
  { name: 'Istanbul',      lat: 41.0082, lng:  28.9784 },
  { name: 'Cairo',         lat: 30.0444, lng:  31.2357 },
  { name: 'Cape Town',     lat:-33.9249, lng:  18.4241 },
  { name: 'Berlin',        lat: 52.5200, lng:  13.4050 },
  { name: 'Amsterdam',     lat: 52.3676, lng:   4.9041 },
  { name: 'London',        lat: 51.5074, lng:  -0.1278 },
  { name: 'Paris',         lat: 48.8566, lng:   2.3522 },
  { name: 'Madrid',        lat: 40.4168, lng:  -3.7038 },
  { name: 'Stockholm',     lat: 59.3293, lng:  18.0686 },
  { name: 'New York',      lat: 40.7128, lng: -74.0060 },
  { name: 'Toronto',       lat: 43.6532, lng: -79.3832 },
  { name: 'Chicago',       lat: 41.8781, lng: -87.6298 },
  { name: 'Austin',        lat: 30.2672, lng: -97.7431 },
  { name: 'San Francisco', lat: 37.7749, lng:-122.4194 },
  { name: 'Seattle',       lat: 47.6062, lng:-122.3321 },
  { name: 'Los Angeles',   lat: 34.0522, lng:-118.2437 },
  { name: 'Mexico City',   lat: 19.4326, lng: -99.1332 },
  { name: 'Sao Paulo',     lat:-23.5505, lng: -46.6333 },
  { name: 'Buenos Aires',  lat:-34.6037, lng: -58.3816 },
  { name: 'Sydney',        lat:-33.8688, lng: 151.2093 },
  { name: 'Auckland',      lat:-36.8485, lng: 174.7633 },
  // Asia
  { name: 'Cebu',          lat: 10.3157, lng: 123.8854 },
  { name: 'Davao',         lat:  7.1907, lng: 125.4553 },
  { name: 'Kuala Lumpur',  lat:  3.1390, lng: 101.6869 },
  { name: 'Hanoi',         lat: 21.0285, lng: 105.8542 },
  { name: 'Taipei',        lat: 25.0330, lng: 121.5654 },
  { name: 'Kyoto',         lat: 35.0116, lng: 135.7681 },
  { name: 'Osaka',         lat: 34.6937, lng: 135.5023 },
  { name: 'Beijing',       lat: 39.9042, lng: 116.4074 },
  { name: 'Shenzhen',      lat: 22.5431, lng: 114.0579 },
  { name: 'Delhi',         lat: 28.7041, lng:  77.1025 },
  { name: 'Karachi',       lat: 24.8607, lng:  67.0011 },
  { name: 'Tel Aviv',      lat: 32.0853, lng:  34.7818 },
  { name: 'Riyadh',        lat: 24.7136, lng:  46.6753 },
  // Europe
  { name: 'Lisbon',        lat: 38.7223, lng:  -9.1393 },
  { name: 'Barcelona',     lat: 41.3851, lng:   2.1734 },
  { name: 'Milan',         lat: 45.4642, lng:   9.1900 },
  { name: 'Munich',        lat: 48.1351, lng:  11.5820 },
  { name: 'Vienna',        lat: 48.2082, lng:  16.3738 },
  { name: 'Prague',        lat: 50.0755, lng:  14.4378 },
  { name: 'Warsaw',        lat: 52.2297, lng:  21.0122 },
  { name: 'Copenhagen',    lat: 55.6761, lng:  12.5683 },
  { name: 'Oslo',          lat: 59.9139, lng:  10.7522 },
  { name: 'Helsinki',      lat: 60.1699, lng:  24.9384 },
  { name: 'Dublin',        lat: 53.3498, lng:  -6.2603 },
  { name: 'Zurich',        lat: 47.3769, lng:   8.5417 },
  { name: 'Athens',        lat: 37.9838, lng:  23.7275 },
  // Americas
  { name: 'Vancouver',     lat: 49.2827, lng:-123.1207 },
  { name: 'Montreal',      lat: 45.5019, lng: -73.5674 },
  { name: 'Boston',        lat: 42.3601, lng: -71.0589 },
  { name: 'Miami',         lat: 25.7617, lng: -80.1918 },
  { name: 'Atlanta',       lat: 33.7490, lng: -84.3880 },
  { name: 'Denver',        lat: 39.7392, lng:-104.9903 },
  { name: 'Phoenix',       lat: 33.4484, lng:-112.0740 },
  { name: 'Portland',      lat: 45.5152, lng:-122.6784 },
  { name: 'Santiago',      lat:-33.4489, lng: -70.6693 },
  { name: 'Rio de Janeiro',lat:-22.9068, lng: -43.1729 },
  // Africa & Oceania
  { name: 'Accra',         lat:  5.6037, lng:  -0.1870 },
  { name: 'Casablanca',    lat: 33.5731, lng:  -7.5898 },
  { name: 'Addis Ababa',   lat:  9.1450, lng:  40.4897 },
  { name: 'Brisbane',      lat:-27.4698, lng: 153.0251 },
  { name: 'Perth',         lat:-31.9505, lng: 115.8605 },
  { name: 'Wellington',    lat:-41.2865, lng: 174.7762 },
]

const HOLD_EXTEND_MS = 1200    // how long a sticker stays at full size after the most recent thock
const EXIT_DURATION_MS = 525   // press-out duration once hold expires
// Re-thock pulse: each press snaps `pulseIntensity` to 1 and it decays per
// frame. A snap + decay (instead of a sin curve that resets to 0) means rapid
// spam shows a visible jump on every thock with no glitchy scale-drop between
// presses, and a single thock still reads as one clean bounce.
const PULSE_DECAY_RATE = 6.5   // 1/sec — ~107ms half-life
const PULSE_PEAK = 0.22        // extra scale added at intensity = 1
const POP_IN_DURATION_MS = 210 // first-spawn pop-in length
const MARKER_ELEVATION = 0.05
const GLOBE_RADIUS = 0.8 + MARKER_ELEVATION
const STICKER_POOL = 32
const STICKER_SIZE_PX = 26
// Snap precision used to decide if two thocks are at the "same city" for merging.
// 0.5 deg matches what the server broadcasts so client-local and broadcast events
// at the same place collapse into one sticker.
const COORD_SNAP = 2
// Synthetic ambient spawn — fills in when the real feed is sparse so the
// globe never feels empty. Slower than before since real thocks now take over.
const SPAWN_DELAY_MIN_MS = 700
const SPAWN_DELAY_MAX_MS = 1400
// Each synthetic thock fires a small flurry of presses at the SAME city.
const BURST_MIN = 2
const BURST_MAX = 4
const BURST_GAP_MIN_MS = 130
const BURST_GAP_MAX_MS = 230
// Live feed poll cadence — matches the API's edge-cache so we get fresh data
// without hammering the server.
const FEED_POLL_INTERVAL_MS = 1500
// All rotation math runs in rad/sec (frame-rate independent). The numbers below
// were tuned to feel identical to the previous per-frame constants at 60 fps,
// but stay smooth when frames drop or run faster.
const AUTO_PHI_SPEED_RAD_PER_SEC = 0.18  // ~0.003 rad/frame @60fps
const PHI_DECAY_RATE  = 3.1              // exp decay rate (1/s) toward AUTO_PHI_SPEED — matches old 0.95/frame
const THETA_DECAY_RATE = 7.7             // exp decay rate (1/s) toward 0           — matches old 0.88/frame
// Exponential rate (1/sec) for the focus ease toward the visitor's city.
// First-order ease — never overshoots, settles asymptotically. ~9 means the
// remaining distance halves every ~77ms, so spam taps feel "locked on" almost
// instantly without a visible slide.
const FOCUS_RATE = 9.0
const VELOCITY_WINDOW_MS = 80 // average pointer velocity over this window for natural release
const THETA_MIN = -Math.PI / 2.6
const THETA_MAX =  Math.PI / 2.6

// How "center-only" the visibility cone is. z is the rotated depth of a marker.
// Range: 0 (silhouette edge) to GLOBE_RADIUS (~0.85, dead center).
//   z >= Z_FULL  → fully visible
//   Z_OUT < z <  Z_FULL → smooth fade with blur as it rotates toward the edge
//   z <= Z_OUT  → hidden (back of globe or beyond fade window)
const Z_FULL = 0.5
const Z_OUT  = 0.05
const EDGE_BLUR_MAX = 5

// Resolve a phi/theta that centers a given (lat, lng) on the camera.
//   targetPhi   = 3π/2 - lng_radians (mod 2π)   — derived from cobe's projection.
//   targetTheta = lat_radians (clamped to safe tilt range)
function rotationToCenter(lat, lng) {
  const lngRad = (lng * Math.PI) / 180
  const latRad = (lat * Math.PI) / 180
  const TWO_PI = Math.PI * 2
  let targetPhi = ((3 * Math.PI) / 2 - lngRad) % TWO_PI
  if (targetPhi < 0) targetPhi += TWO_PI
  return { targetPhi, targetTheta: latRad }
}

// Same projection cobe uses internally — ported from its source so HTML overlays
// line up pixel-perfect with the WebGL sphere.
function project(lat, lng, phi, theta) {
  const rLat = (lat * Math.PI) / 180
  const rLng = (lng * Math.PI) / 180 - Math.PI
  const cosLat = Math.cos(rLat)
  const v = [
    -cosLat * Math.cos(rLng),
     Math.sin(rLat),
     cosLat * Math.sin(rLng),
  ]
  const sx = v[0] * GLOBE_RADIUS
  const sy = v[1] * GLOBE_RADIUS
  const sz = v[2] * GLOBE_RADIUS
  const cosP = Math.cos(phi)
  const sinP = Math.sin(phi)
  const cosT = Math.cos(theta)
  const sinT = Math.sin(theta)
  const c =  cosP * sx + sinP * sz
  const s =  sinP * sinT * sx + cosT * sy - cosP * sinT * sz
  const z = -sinP * cosT * sx + sinT * sy + cosP * cosT * sz
  const x = (c + 1) / 2
  const y = (-s + 1) / 2
  return { x, y, z }
}

// Per-character slide-up + blur stagger for the "Thocks happening in {city}"
// label. Splitting the city name into spans lets each glyph animate on its own
// delay; key={name} on the wrapper forces a remount when the city changes so
// the animation always replays — no jarring instant text swap when the live
// feed picks up a new visitor.
function AnimatedCity({ name }) {
  const target = name || 'Tokyo'
  // `displayed` is what the DOM is actually rendering (and animating). New
  // `target` values land in `pending` and only swap into `displayed` after
  // the current stagger has had time to finish — so spam-thocking another
  // cell, or a fast live-feed burst, collapses into ONE smooth transition
  // to the latest value instead of glitching mid-animation.
  const [displayed, setDisplayed] = useState(target)
  const pending = useRef(target)
  const timerRef = useRef(null)
  const measureRef = useRef(null)
  const [width, setWidth] = useState(null)

  useEffect(() => {
    pending.current = target
    if (target === displayed) return
    if (timerRef.current != null) return
    // Time the swap to land just after the in-flight animation completes:
    //   CSS duration (280ms) + last-char stagger delay (len * 18ms) + buffer.
    const dur = 280 + displayed.length * 18 + 30
    timerRef.current = setTimeout(() => {
      timerRef.current = null
      setDisplayed(pending.current)
    }, dur)
  }, [target, displayed])

  useEffect(() => () => {
    if (timerRef.current != null) clearTimeout(timerRef.current)
  }, [])

  useLayoutEffect(() => {
    if (measureRef.current) setWidth(measureRef.current.offsetWidth)
  }, [displayed])

  return (
    // inline-flex items-center keeps the chars on the SAME vertical center as
    // the surrounding "Thocks happening in" text — avoids the baseline drift
    // you'd otherwise get from inline-block + overflow:hidden, which moves
    // the element's baseline to its bottom edge instead of the text baseline.
    <span className="relative inline-flex items-center leading-none">
      {/* Hidden mirror — same font/style as visible row, used only to measure. */}
      <span
        ref={measureRef}
        aria-hidden="true"
        className="invisible whitespace-nowrap absolute left-0 top-0 pointer-events-none"
      >
        {displayed}
      </span>
      {/* Visible row: width animates between measured sizes; the inner span is
          re-keyed on every displayed-name change so the per-char stagger
          replays exactly once per debounced swap. */}
      <span
        className="inline-flex items-center whitespace-nowrap"
        style={{
          width: width != null ? `${width}px` : 'auto',
          transition: 'width 0.35s cubic-bezier(0.32, 0.72, 0.32, 1)',
        }}
      >
        <span key={displayed} className="inline-flex items-center">
          {Array.from(displayed).map((c, i) => (
            <span
              key={i}
              className="thock-char"
              style={{ animationDelay: `${i * 18}ms` }}
            >
              {/* NBSP keeps multi-word names like "Addis Ababa" spaced —
                  a regular space inside an inline-block flex item collapses
                  to zero width. */}
              {c === ' ' ? ' ' : c}
            </span>
          ))}
        </span>
      </span>
    </span>
  )
}

function Globe() {
  const canvasRef = useRef(null)
  const slotsRef = useRef(new Array(STICKER_POOL).fill(null))
  const stickerRefs = useRef([])
  const [recent, setRecent] = useState([])

  // Stable ref callbacks per slot — defining them inline in JSX would create
  // 32 fresh closures on every Globe re-render and force React to detach +
  // reattach all 32 sticker refs, which shows up as a frame hitch when an
  // ancestor re-renders (e.g. a keeby-logo button toggling press state).
  const stickerRefSetters = useMemo(
    () => Array.from({ length: STICKER_POOL }, (_, i) => (el) => { stickerRefs.current[i] = el }),
    [],
  )

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let phi = 0
    let theta = 0.25
    let width = canvas.offsetWidth
    if (width === 0) width = 500
    let destroyed = false
    let rafId = 0
    let globe = null

    // drag interaction state
    let dragging = false
    let dragStartX = 0
    let dragStartY = 0
    let phiAtDragStart = 0
    let thetaAtDragStart = 0
    // Momentum velocities in rad/sec — applied each tick scaled by dt. Decays
    // toward AUTO_PHI_SPEED (idle) or is driven by the spring (focus).
    let velocityPhi = 0
    let velocityTheta = 0
    // Last tick timestamp — used to compute dt so motion is frame-rate independent.
    let lastTickAt = 0
    // sliding window of recent pointer samples — used to compute release velocity
    const moveSamples = []
    // focus state — when the visitor types, snap rotation to their city for a moment
    let focusTargetPhi = 0
    let focusTargetTheta = 0
    let focusUntil = 0

    // Resolve visitor's home city from their browser timezone — purely client-side.
    let visitorCity = null
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
      const cityName = TZ_TO_CITY_NAME[tz]
      if (cityName) visitorCity = CITIES.find((c) => c.name === cityName) || null
    } catch {}
    if (!visitorCity) visitorCity = CITIES[0] // sensible fallback

    const onResize = () => {
      if (canvasRef.current) {
        const w = canvasRef.current.offsetWidth
        if (w > 0) width = w
      }
    }
    window.addEventListener('resize', onResize)
    // Catch layout-driven size changes the window resize event won't fire for
    // (panel reflow, font swap, sidebar collapse, etc.) so stickers stay pixel-aligned.
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(onResize) : null
    ro?.observe(canvas)

    globe = createGlobe(canvas, {
      devicePixelRatio: 2,
      width: width * 2,
      height: width * 2,
      phi: 0,
      theta,
      dark: 0,
      diffuse: 1.2,
      mapSamples: 16000,
      mapBrightness: 1.2,
      baseColor: [1, 1, 1],
      markerColor: [251 / 255, 100 / 255, 21 / 255],
      // Halo tinted toward the page bg (#F5F5F5) so it dissolves softly instead of glowing.
      glowColor: [0.96, 0.96, 0.96],
      markers: [],
    })

    const tick = () => {
      if (destroyed) return

      const now = performance.now()
      // dt in seconds since last tick. Clamp so a backgrounded tab returning
      // doesn't cause a giant jump.
      const dt = lastTickAt > 0 ? Math.min((now - lastTickAt) / 1000, 0.05) : 1 / 60
      lastTickAt = now

      // Priority: drag > focus tween (visitor typing) > momentum + auto-rotate.
      if (!dragging) {
        if (now < focusUntil) {
          // First-order exponential ease toward the visitor city. Properties:
          //   • Frame-rate independent (uses dt).
          //   • No overshoot — ever. So spam taps stay rock-steady at target,
          //     and the previous idle velocity can't cause a transient drift.
          //   • Asymptotic — once at target, motion is zero. Repeat presses
          //     don't re-trigger any animation, the globe just stays locked.
          const TWO_PI = Math.PI * 2
          let dPhi = phi - focusTargetPhi
          dPhi = ((dPhi % TWO_PI) + TWO_PI + Math.PI) % TWO_PI - Math.PI
          // Collapse phi to its wrapped equivalent (visually identical — cobe
          // uses sin/cos) so the ease works on a bounded delta.
          phi = focusTargetPhi + dPhi

          const decay = Math.exp(-FOCUS_RATE * dt)
          const dThetaOld = theta - focusTargetTheta
          const newDPhi = dPhi * decay
          const newDTheta = dThetaOld * decay

          // Track the ease's implied velocity so when focus expires the idle
          // blend has a sane starting velocity (small, in the right direction)
          // and ramps smoothly up to AUTO_PHI_SPEED — no snap.
          velocityPhi = (newDPhi - dPhi) / dt
          velocityTheta = (newDTheta - dThetaOld) / dt

          phi = focusTargetPhi + newDPhi
          theta = focusTargetTheta + newDTheta

          if (theta < THETA_MIN) { theta = THETA_MIN; velocityTheta = 0 }
          if (theta > THETA_MAX) { theta = THETA_MAX; velocityTheta = 0 }
        } else {
          // Idle: exponentially blend velocity toward AUTO_PHI_SPEED. dt-based
          // so a slow frame doesn't chunk the motion. Coming out of focus,
          // velocityPhi is whatever the spring left us at (often near zero) —
          // this naturally eases up to the steady spin instead of snapping.
          const decayPhi = Math.exp(-PHI_DECAY_RATE * dt)
          velocityPhi = velocityPhi * decayPhi + AUTO_PHI_SPEED_RAD_PER_SEC * (1 - decayPhi)
          const decayTheta = Math.exp(-THETA_DECAY_RATE * dt)
          velocityTheta *= decayTheta

          phi += velocityPhi * dt
          theta += velocityTheta * dt
          if (theta < THETA_MIN) { theta = THETA_MIN; velocityTheta = 0 }
          if (theta > THETA_MAX) { theta = THETA_MAX; velocityTheta = 0 }
        }
      }

      const slots = slotsRef.current

      globe.update({
        phi,
        theta,
        width: width * 2,
        height: width * 2,
        markers: [],
      })

      for (let i = 0; i < STICKER_POOL; i++) {
        const el = stickerRefs.current[i]
        if (!el) continue
        const ping = slots[i]
        if (!ping) {
          if (el.style.opacity !== '0') el.style.opacity = '0'
          continue
        }

        // -------- TIME-based life curve --------
        // Three phases:
        //   1. POP-IN  — first POP_IN_DURATION_MS after birth (overshoot scale, blurEntry-gated)
        //   2. HOLD    — full size while now < holdUntil. Each repeat thock at this cell
        //                bumps holdUntil so the sticker stays alive while activity continues.
        //   3. EXIT    — press-down + fade once holdUntil has expired. Lazily started so
        //                exit progress survives a re-thock that retriggers the slot.
        const sinceBirth = now - ping.bornAt
        let lifeScale, lifeBlur, lifeOpacity

        if (sinceBirth < POP_IN_DURATION_MS) {
          const p = sinceBirth / POP_IN_DURATION_MS
          const c1 = 2.7 // ~22% overshoot
          const c3 = c1 + 1
          lifeScale = 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2)
          lifeBlur = ping.blurEntry ? (1 - p) * 6 : 0
          lifeOpacity = Math.min(1, p * 2)
        } else if (now < ping.holdUntil) {
          lifeScale = 1
          lifeBlur = 0
          lifeOpacity = 1
        } else {
          if (ping.exitStartedAt === 0) ping.exitStartedAt = ping.holdUntil
          const exitElapsed = now - ping.exitStartedAt
          const p = exitElapsed / EXIT_DURATION_MS
          if (p >= 1) {
            slots[i] = null
            el.style.opacity = '0'
            continue
          }
          const ease = p * p
          lifeScale = 1 - ease * 0.3
          lifeBlur = ping.blurExit ? ease * 4 : 0
          lifeOpacity = 1 - ease
        }

        // -------- PULSE on re-thock --------
        // Each thock snaps pulseIntensity to 1; here we decay it exponentially.
        // Snap + decay means rapid spam shows a visible "kick" every press
        // (intensity jumps back up to 1) without the scale-drop-to-zero glitch
        // a sin curve produced when restarted. A single thock still reads as
        // one clean bounce.
        if (ping.pulseIntensity > 0.001) {
          ping.pulseIntensity *= Math.exp(-PULSE_DECAY_RATE * dt)
          lifeScale += ping.pulseIntensity * PULSE_PEAK
        } else {
          ping.pulseIntensity = 0
        }

        // -------- SPATIAL edge fade (smooth out when rotating off-center) --------
        const proj = project(ping.lat, ping.lng, phi, theta)
        let edgeOpacity, edgeBlur
        if (proj.z >= Z_FULL) {
          edgeOpacity = 1
          edgeBlur = 0
        } else if (proj.z <= Z_OUT) {
          edgeOpacity = 0
          edgeBlur = EDGE_BLUR_MAX
        } else {
          const p = (proj.z - Z_OUT) / (Z_FULL - Z_OUT) // 0 (edge) → 1 (center)
          edgeOpacity = p * p
          edgeBlur = (1 - p) * EDGE_BLUR_MAX
        }

        const opacity = lifeOpacity * edgeOpacity
        const blur = Math.max(lifeBlur, edgeBlur)
        const scale = lifeScale

        if (opacity <= 0.01) {
          if (el.style.opacity !== '0') el.style.opacity = '0'
          continue
        }
        const px = proj.x * width
        const py = proj.y * width
        el.style.transform = `translate3d(${(px - STICKER_SIZE_PX / 2).toFixed(2)}px, ${(py - STICKER_SIZE_PX / 2).toFixed(2)}px, 0) scale(${scale.toFixed(3)})`
        el.style.filter = blur > 0.1 ? `blur(${blur.toFixed(2)}px)` : 'none'
        el.style.opacity = opacity.toFixed(3)
      }

      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)

    requestAnimationFrame(() => {
      if (canvasRef.current && !destroyed) canvasRef.current.style.opacity = '1'
    })

    // === drag-to-rotate with momentum ===
    const onPointerDown = (e) => {
      dragging = true
      dragStartX = e.clientX
      dragStartY = e.clientY
      phiAtDragStart = phi
      thetaAtDragStart = theta
      // grabbing the globe kills any in-flight momentum
      velocityPhi = 0
      velocityTheta = 0
      moveSamples.length = 0
      moveSamples.push({ t: performance.now(), x: e.clientX, y: e.clientY })
      canvas.style.cursor = 'grabbing'
      canvas.setPointerCapture?.(e.pointerId)
    }
    const onPointerMove = (e) => {
      if (!dragging) return
      const dx = e.clientX - dragStartX
      const dy = e.clientY - dragStartY
      phi = phiAtDragStart + (dx / width) * Math.PI * 2
      theta = thetaAtDragStart + (dy / width) * Math.PI
      if (theta < THETA_MIN) theta = THETA_MIN
      if (theta > THETA_MAX) theta = THETA_MAX

      const now = performance.now()
      moveSamples.push({ t: now, x: e.clientX, y: e.clientY })
      // drop samples older than the velocity window
      while (moveSamples.length > 0 && now - moveSamples[0].t > VELOCITY_WINDOW_MS) {
        moveSamples.shift()
      }
    }
    const onPointerUp = (e) => {
      if (!dragging) return
      dragging = false
      canvas.style.cursor = 'grab'
      canvas.releasePointerCapture?.(e.pointerId)

      // Compute release velocity from the recent sample window in rad/sec —
      // the tick loop multiplies by dt so this stays frame-rate independent.
      if (moveSamples.length >= 2) {
        const first = moveSamples[0]
        const last = moveSamples[moveSamples.length - 1]
        const dt = last.t - first.t
        if (dt > 0) {
          const vxPxPerMs = (last.x - first.x) / dt
          const vyPxPerMs = (last.y - first.y) / dt
          velocityPhi   = (vxPxPerMs / width) * Math.PI * 2 * 1000
          velocityTheta = (vyPxPerMs / width) * Math.PI     * 1000
        }
      }
      moveSamples.length = 0
    }
    canvas.style.cursor = 'grab'
    canvas.style.touchAction = 'none'
    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', onPointerUp)
    canvas.addEventListener('pointercancel', onPointerUp)
    canvas.addEventListener('pointerleave', onPointerUp)

    // Place a press at a city. If a sticker already exists at the same snapped
    // cell, pulse it + extend its hold instead of stacking another sticker —
    // so repeat thocks at the same place look like ONE keycap getting hammered,
    // not a pile of overlapping logos.
    const spawnPressAt = (city, { blurEntry = false, blurExit = false } = {}) => {
      const slots = slotsRef.current
      const snapLat = Math.round(city.lat * COORD_SNAP) / COORD_SNAP
      const snapLng = Math.round(city.lng * COORD_SNAP) / COORD_SNAP
      const cellKey = `${snapLat},${snapLng}`
      const now = performance.now()

      // Existing sticker at this cell? — kick the pulse + extend hold.
      for (let i = 0; i < STICKER_POOL; i++) {
        const s = slots[i]
        if (s && s.cellKey === cellKey) {
          s.pulseIntensity = 1
          s.holdUntil = now + HOLD_EXTEND_MS
          // Reset exit phase if we caught it mid-press-out.
          s.exitStartedAt = 0
          return
        }
      }

      // Otherwise claim the oldest free / oldest active slot.
      let target = -1
      let oldestBorn = Infinity
      for (let i = 0; i < STICKER_POOL; i++) {
        if (slots[i] === null) { target = i; break }
        if (slots[i].bornAt < oldestBorn) {
          oldestBorn = slots[i].bornAt
          target = i
        }
      }
      if (target === -1) return
      slots[target] = {
        lat: snapLat,
        lng: snapLng,
        cellKey,
        bornAt: now,
        pulseIntensity: 1,
        holdUntil: now + HOLD_EXTEND_MS,
        exitStartedAt: 0,
        blurEntry,
        blurExit,
      }
    }

    // Pick a city currently in the central view; fall back to any if the user
    // has tilted the globe somewhere weird and no candidate is visible.
    const pickCityInView = () => {
      for (let attempt = 0; attempt < 10; attempt++) {
        const candidate = CITIES[Math.floor(Math.random() * CITIES.length)]
        const p = project(candidate.lat, candidate.lng, phi, theta)
        if (p.z > Z_FULL) return candidate
      }
      return CITIES[Math.floor(Math.random() * CITIES.length)]
    }

    // One "thock event" = a city + a flurry of N presses fired at it ~60-100ms apart.
    // Blur is only applied to the burst's overall entry (first press in) and overall
    // exit (last press out) — middle presses scale-tap cleanly with no blur.
    const fireThockBurst = () => {
      const city = pickCityInView()
      const burst = BURST_MIN + Math.floor(Math.random() * (BURST_MAX - BURST_MIN + 1))
      const isSingle = burst === 1
      // First press: blurs in (or both, if burst is just 1)
      spawnPressAt(city, { blurEntry: true, blurExit: isSingle })
      for (let i = 1; i < burst; i++) {
        const isLast = i === burst - 1
        const delay = i * (BURST_GAP_MIN_MS + Math.random() * (BURST_GAP_MAX_MS - BURST_GAP_MIN_MS))
        setTimeout(() => {
          if (!destroyed) spawnPressAt(city, { blurEntry: false, blurExit: isLast })
        }, delay)
      }
      setRecent((prev) => [{ name: city.name, id: Math.random() }, ...prev].slice(0, 4))
    }

    let spawnTimer = null
    const scheduleNextSpawn = () => {
      const delay = SPAWN_DELAY_MIN_MS + Math.random() * (SPAWN_DELAY_MAX_MS - SPAWN_DELAY_MIN_MS)
      spawnTimer = setTimeout(() => {
        if (destroyed) return
        if (document.visibilityState !== 'hidden') {
          fireThockBurst()
        }
        scheduleNextSpawn()
      }, delay)
    }
    scheduleNextSpawn()

    // ── Live feed ──
    //   PRIMARY: Supabase Realtime broadcast — server publishes after each
    //            /api/thocks insert, browser receives with ~200-500ms latency.
    //   FALLBACK: poll /api/thocks-recent every 1.5s if Realtime can't connect
    //            (no env vars, blocked by network, Supabase outage, etc.).
    let lastSeenTs = Date.now()
    const handleEvent = (ev) => {
      if (destroyed) return
      if (!ev || typeof ev.ts !== 'number') return
      if (ev.ts <= lastSeenTs) return
      lastSeenTs = ev.ts
      if (typeof ev.lat !== 'number' || typeof ev.lng !== 'number') return
      spawnPressAt(
        { lat: ev.lat, lng: ev.lng, name: ev.city },
        { blurEntry: true, blurExit: true },
      )
      setRecent((prev) => [{ name: ev.city, id: ev.ts }, ...prev].slice(0, 4))
    }

    // One-shot seed so the globe has activity immediately on page load.
    fetch('/api/thocks-recent', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : []))
      .then((events) => {
        if (destroyed || !Array.isArray(events)) return
        const sorted = events
          .filter((e) => e && typeof e.ts === 'number')
          .sort((a, b) => a.ts - b.ts)
        for (const ev of sorted) {
          // Stagger seed events so they don't all pop at once.
          setTimeout(() => handleEvent(ev), Math.random() * 1200)
        }
      })
      .catch(() => {})

    let feedInterval = null
    let realtimeChannel = null
    const supabase = getSupabase()
    if (supabase) {
      realtimeChannel = supabase
        .channel('thocks-feed')
        .on('broadcast', { event: 'thock' }, ({ payload }) => handleEvent(payload))
        .subscribe((status) => {
          // If subscription fails or times out, fall back to polling.
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            if (!feedInterval && !destroyed) {
              feedInterval = setInterval(pollFeed, FEED_POLL_INTERVAL_MS)
            }
          }
        })
    } else {
      // No Realtime env vars wired — straight to polling.
      feedInterval = setInterval(pollFeed, FEED_POLL_INTERVAL_MS)
    }

    async function pollFeed() {
      if (destroyed || document.visibilityState === 'hidden') return
      try {
        const res = await fetch('/api/thocks-recent', { cache: 'no-store' })
        if (!res.ok) return
        const events = await res.json()
        if (!Array.isArray(events)) return
        const fresh = events
          .filter((e) => e && typeof e.ts === 'number' && e.ts > lastSeenTs)
          .sort((a, b) => a.ts - b.ts)
        for (const ev of fresh) {
          setTimeout(() => handleEvent(ev), Math.random() * 700)
        }
      } catch {}
    }

    // Local feedback for any visitor thock (keyboard OR clicks). Both routes
    // call this — the round-trip broadcast comes back later but visitor sees
    // their own action instantly here.
    let lastUserPressAt = 0
    const USER_PRESS_THROTTLE_MS = 70 // cap visitor presses to ~14/sec even if they typo-spam
    const fireUserThock = () => {
      if (destroyed || !visitorCity) return
      const now = performance.now()
      // Always extend the focus window so the globe stays centered while typing/tapping.
      const r = rotationToCenter(visitorCity.lat, visitorCity.lng)
      focusTargetPhi = r.targetPhi
      focusTargetTheta = r.targetTheta
      focusUntil = now + 1200
      // Throttle the actual sticker spawn so a fast typer doesn't melt the pool.
      if (now - lastUserPressAt < USER_PRESS_THROTTLE_MS) return
      lastUserPressAt = now
      spawnPressAt(visitorCity, { blurEntry: true, blurExit: true })
      // Skip the state update if the displayed city is already correct —
      // spam-clicks at the same city would otherwise re-render Globe on
      // every press for zero visual change.
      setRecent((prev) => (
        prev[0]?.name === visitorCity.name
          ? prev
          : [{ name: visitorCity.name, id: Math.random() }, ...prev].slice(0, 4)
      ))
    }

    // Real keypresses come through the keyboard sounds store.
    const unsubKey = subscribeLastKey((key) => {
      if (!key) return
      fireUserThock()
    })

    // Button clicks (keeby logo, keycap previews, etc.) dispatch a window event
    // from playTapSound. Same handler so the visual feedback is identical.
    const onUserThockEvent = () => fireUserThock()
    window.addEventListener('keeby:user-thock', onUserThockEvent)

    return () => {
      destroyed = true
      cancelAnimationFrame(rafId)
      if (spawnTimer) clearTimeout(spawnTimer)
      if (feedInterval) clearInterval(feedInterval)
      if (realtimeChannel && supabase) supabase.removeChannel(realtimeChannel)
      window.removeEventListener('resize', onResize)
      ro?.disconnect()
      unsubKey?.()
      window.removeEventListener('keeby:user-thock', onUserThockEvent)
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('pointercancel', onPointerUp)
      canvas.removeEventListener('pointerleave', onPointerUp)
      if (globe) globe.destroy()
    }
  }, [])

  return (
    <div className="relative w-full flex flex-col items-center">
      <div
        className="relative mx-auto"
        style={{ width: 'min(680px, 92vw)', aspectRatio: '1 / 1' }}
      >
        <canvas
          ref={canvasRef}
          style={{
            width: '100%',
            height: '100%',
            opacity: 0,
            transition: 'opacity 700ms ease',
            contain: 'layout paint size',
          }}
        />
        {/* sticker pool — positioned + animated per-frame in rAF */}
        <div className="pointer-events-none absolute inset-0">
          {Array.from({ length: STICKER_POOL }).map((_, i) => (
            <img
              key={i}
              ref={stickerRefSetters[i]}
              src="/keeby-logo.webp"
              alt=""
              aria-hidden="true"
              width={312}
              height={312}
              draggable={false}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: `${STICKER_SIZE_PX}px`,
                height: `${STICKER_SIZE_PX}px`,
                borderRadius: '6px',
                border: '2.5px solid white',
                boxShadow: '0 2px 6px rgba(0,0,0,0.18)',
                opacity: 0,
                transformOrigin: 'center',
                willChange: 'transform, opacity, filter',
              }}
            />
          ))}
        </div>
      </div>

      {/* Single inline line. flex items-center ensures the inline-block city
          (with its own measurement-driven width transition) shares a true
          vertical center with the surrounding prose — baseline alignment
          would otherwise drift slightly because the city container creates a
          new formatting context (overflow:hidden + inline-block). */}
      <div className="mt-6 flex items-center justify-center gap-[0.35em] text-[13px] text-neutral-600 tracking-tight leading-none">
        <span>Thocks happening in</span>
        <span className="text-neutral-900 font-medium">
          <AnimatedCity name={recent[0]?.name ?? 'Tokyo'} />
        </span>
      </div>
    </div>
  )
}

// Globe takes no props — memo prevents re-renders when ancestors update
// unrelated state (e.g. keeby-logo press toggles in App). Without this, every
// click on a logo button would re-render the Globe subtree mid-frame and the
// rAF rotation would visibly hitch.
export default memo(Globe)
