import { useRef, useCallback, useEffect, useSyncExternalStore } from "react"

// Batching tuned for "every keystroke" increments. At 150 WPM (~12 keys/sec)
// a typical 15s test is ~180 keys, so we'll flush ~4x during it.
// Threshold stays under the server's MAX_PER_POST=50 cap so legit bursts
// aren't silently truncated by the server.
// Tuned for the live globe — 1.5s idle flush keeps "type → other visitors see
// it" latency under ~2s end-to-end after the realtime broadcast adds ~300ms.
// MIN_FLUSH_GAP throttle still caps network calls at 1/sec so a fast typer
// can't blow up the rate limit.
const FLUSH_INTERVAL_MS = 1_500    // idle flush when user stops typing
const FLUSH_THRESHOLD = 20         // immediate flush after this many pending
const MIN_FLUSH_GAP_MS = 1_000     // never fire two network flushes closer than this
const POLL_INTERVAL_MS = 60_000    // poll others' count once/min (was 10_000)

// ──────────────────────────────────────────────────────────────────────────
// External store for the display count — only components that call
// useThockCount() re-render. Lets us increment on every keystroke without
// re-rendering the 2000-line App.
// ──────────────────────────────────────────────────────────────────────────
// Public sample: the production site hydrates this from a Supabase-backed
// /api/thocks counter (3.3M+ real keystrokes). That backend isn't included
// here, so we seed a static starting value and increment it locally as you
// type. The fetch/flush calls below stay in place but fail silently with no
// backend, which is the intended graceful-degradation path.
let _displayCount = 3_382_200
const _countListeners = new Set()

function _emitCount() {
  for (const l of _countListeners) l()
}

function _subscribeCount(listener) {
  _countListeners.add(listener)
  return () => _countListeners.delete(listener)
}

export function useThockCount() {
  return useSyncExternalStore(_subscribeCount, () => _displayCount, () => null)
}

function setCountIfHigher(nextCount) {
  if (_displayCount == null) {
    _displayCount = nextCount
    _emitCount()
  } else if (nextCount > _displayCount) {
    _displayCount = nextCount
    _emitCount()
  }
}

export function useThockCounter() {
  const pendingRef = useRef(0)
  const isFlushing = useRef(false)
  const flushTimerRef = useRef(null)
  const pollTimerRef = useRef(null)
  const lastFlushAtRef = useRef(0)

  const fetchCount = useCallback(async () => {
    try {
      const res = await fetch("/api/thocks")
      if (res.ok) {
        const data = await res.json()
        setCountIfHigher(data.count + pendingRef.current)
      }
    } catch {
      // Silently fail
    }
  }, [])

  const flush = useCallback(async () => {
    if (pendingRef.current === 0 || isFlushing.current) return

    // Hold-down guard: never hit the network more often than every MIN_FLUSH_GAP_MS.
    const now = Date.now()
    const gap = now - lastFlushAtRef.current
    if (gap < MIN_FLUSH_GAP_MS) {
      if (!flushTimerRef.current) {
        flushTimerRef.current = setTimeout(() => {
          flushTimerRef.current = null
          flush()
        }, MIN_FLUSH_GAP_MS - gap)
      }
      return
    }
    lastFlushAtRef.current = now

    const amount = pendingRef.current
    pendingRef.current = 0
    isFlushing.current = true

    try {
      const res = await fetch("/api/thocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      })
      if (res.ok) {
        const data = await res.json()
        setCountIfHigher(data.count + pendingRef.current)
      } else {
        pendingRef.current += amount
      }
    } catch {
      pendingRef.current += amount
    } finally {
      isFlushing.current = false
    }
  }, [])

  const scheduleFlush = useCallback(() => {
    if (flushTimerRef.current) return
    flushTimerRef.current = setTimeout(() => {
      flushTimerRef.current = null
      flush()
    }, FLUSH_INTERVAL_MS)
  }, [flush])

  const increment = useCallback(() => {
    pendingRef.current += 1
    _displayCount = (_displayCount ?? 0) + 1
    _emitCount()

    if (pendingRef.current >= FLUSH_THRESHOLD) {
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current)
        flushTimerRef.current = null
      }
      flush()
    } else {
      scheduleFlush()
    }
  }, [flush, scheduleFlush])

  // Start/stop polling based on tab visibility
  const startPolling = useCallback(() => {
    if (pollTimerRef.current) return
    pollTimerRef.current = setInterval(fetchCount, POLL_INTERVAL_MS)
  }, [fetchCount])

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current)
      pollTimerRef.current = null
    }
  }, [])

  // Fetch initial count + visibility-aware polling
  useEffect(() => {
    fetchCount()
    startPolling()

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        // Tab became visible — fetch immediately + resume polling
        fetchCount()
        startPolling()
      } else {
        // Tab hidden — stop polling to save requests
        stopPolling()
      }
    }
    document.addEventListener("visibilitychange", handleVisibility)

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility)
      stopPolling()
    }
  }, [fetchCount, startPolling, stopPolling])

  // Flush remaining on page unload
  useEffect(() => {
    const flushBeacon = () => {
      if (pendingRef.current > 0) {
        const payload = JSON.stringify({ amount: pendingRef.current })
        navigator.sendBeacon("/api/thocks", new Blob([payload], { type: "application/json" }))
        pendingRef.current = 0
      }
    }

    window.addEventListener("beforeunload", flushBeacon)
    return () => {
      window.removeEventListener("beforeunload", flushBeacon)
      if (flushTimerRef.current) clearTimeout(flushTimerRef.current)
      if (pendingRef.current > 0) flush()
    }
  }, [flush])

  // Expose increment at module level too, so any module (e.g. useKeyboardSounds)
  // can bump the counter without needing a hook instance.
  useEffect(() => {
    _moduleIncrement = increment
    return () => {
      if (_moduleIncrement === increment) _moduleIncrement = null
    }
  }, [increment])

  return { increment }
}

// Module-level pointer to the current hook's increment fn.
let _moduleIncrement = null

export function incrementThock() {
  if (_moduleIncrement) _moduleIncrement()
}
