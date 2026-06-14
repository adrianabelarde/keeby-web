// Skeuomorphic keycap rendering — a faithful web port of the macOS menu
// keycap glyph (Sources/Keeb/Views/KeycapIcon.swift). The look: a top-to-bottom
// gradient body (brighter/desaturated up top, darker/more saturated at the
// bottom), a faint top-edge highlight, an embossed gradient "+" cross stem, and
// an outer hairline so the silhouette stays crisp on any background.
//
// All shading is derived from the switch's signature color in HSB, mirroring the
// Swift `shade()` helper exactly, so the web icons match the app pixel-for-pixel
// in spirit.

function hexToRgb(hex) {
  let h = hex.replace('#', '').trim()
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  const n = parseInt(h, 16)
  return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 }
}

function rgbToHsb({ r, g, b }) {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  let h = 0
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
    if (h < 0) h += 360
  }
  const s = max === 0 ? 0 : d / max
  return { h, s, b: max }
}

function hsbToRgb({ h, s, b }) {
  const c = b * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = b - c
  let r = 0, g = 0, bl = 0
  if (h < 60) [r, g, bl] = [c, x, 0]
  else if (h < 120) [r, g, bl] = [x, c, 0]
  else if (h < 180) [r, g, bl] = [0, c, x]
  else if (h < 240) [r, g, bl] = [0, x, c]
  else if (h < 300) [r, g, bl] = [x, 0, c]
  else [r, g, bl] = [c, 0, x]
  return { r: r + m, g: g + m, b: bl + m }
}

function clamp(v) { return Math.max(0, Math.min(1, v)) }

function css({ r, g, b }, a = 1) {
  return `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${a})`
}

// macOS `shade(brightnessMul, satMul)` — scale brightness and saturation about
// the base color's HSB, clamped to [0,1].
function shade(hsb, brightnessMul, satMul = 1) {
  return css(hsbToRgb({
    h: hsb.h,
    s: clamp(hsb.s * satMul),
    b: clamp(hsb.b * brightnessMul),
  }))
}

// Switches with an explicit accent stem in the app (KeycapIcon's crossColor).
// Keyed by the web signature hex so callers only need to pass `color`.
const ACCENT_CROSS = {
  '#ED802E': '#BD5714', // Aflion Carrot — deeper-orange embossed "+"
}

// Returns the CSS pieces needed to paint one skeuomorphic keycap of `color`.
export function keycapStyle(color) {
  const hsb = rgbToHsb(hexToRgb(color))

  // 1. Body — vertical gradient, top brighter/desaturated → bottom darker.
  const bodyGradient = `linear-gradient(180deg, ${shade(hsb, 1.16, 0.9)} 0%, ${shade(hsb, 0.86, 1.03)} 100%)`

  // 2 + 4. Faint top-edge highlight and outer hairline border.
  const boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.18), 0 0 0 0.5px rgba(0,0,0,0.18)'

  // 3. Cross stem gradient — accent color if defined, else light-on-dark or
  //    dark-on-light based on the body's brightness (matches Swift 0.5 cutoff).
  let crossTop, crossBottom
  const accent = ACCENT_CROSS[color.toUpperCase()]
  if (accent) {
    const c = rgbToHsb(hexToRgb(accent))
    crossTop = css(hsbToRgb({ h: c.h, s: clamp(c.s * 0.92), b: clamp(c.b * 1.14) }))
    crossBottom = css(hsbToRgb({ h: c.h, s: c.s, b: clamp(c.b * 0.9) }))
  } else if (hsb.b < 0.5) {
    crossTop = 'rgba(255,255,255,0.50)'
    crossBottom = 'rgba(255,255,255,0.28)'
  } else {
    crossTop = 'rgba(0,0,0,0.44)'
    crossBottom = 'rgba(0,0,0,0.24)'
  }
  const crossGradient = `linear-gradient(180deg, ${crossTop} 0%, ${crossBottom} 100%)`

  return { bodyGradient, boxShadow, crossGradient }
}
