import { useEffect, useState } from 'react'

/// Detects whether the visitor is on macOS or Windows. Falls back to 'other'
/// (Linux, mobile, etc.) so callers can pick a sensible default. Used to
/// pre-select the right platform tile in the download dropdown.
export function useOS() {
  const [os, setOS] = useState('unknown')

  useEffect(() => {
    setOS(detectOS())
  }, [])

  return os
}

function detectOS() {
  if (typeof navigator === 'undefined') return 'other'

  // userAgentData is the modern, privacy-friendly way to check platform.
  // Falls back to userAgent string for browsers that haven't shipped it
  // yet (Safari, Firefox).
  const uaPlatform = navigator.userAgentData?.platform
  if (uaPlatform) {
    const p = uaPlatform.toLowerCase()
    if (p.includes('mac')) return 'mac'
    if (p.includes('win')) return 'windows'
    return 'other'
  }

  const ua = navigator.userAgent || ''
  // iPad on iPadOS 13+ reports as MacIntel — treat as Mac for download
  // purposes (App Store works on iPad too).
  if (/Mac/i.test(ua)) return 'mac'
  if (/Win/i.test(ua)) return 'windows'
  return 'other'
}
