import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import '@fontsource/geist-mono/400.css'
import '@fontsource/geist-mono/600.css'
import { capture } from './analytics.js'
import { EASTER_EGG_PROFILES, ALL_SWITCHES, TYPABLE_SWITCHES, isMuted } from './useKeyboardSounds.js'
import { setHeroSelection, usePlaygroundProfileId } from './heroSelectionStore.js'
import { contributorForProfile } from './contributors.js'
import { keycapStyle } from './keycap.js'
import { ContributorCredit, ContributorShareLine } from './components/ContributorCredit.jsx'
import { hapticLine, hapticTap, hapticSuccess } from './useHaptics.js'
import { pickWords } from './words.js'
import { Keyboard } from './components/ui/keyboard.tsx'

const TEST_SECONDS = 15

// ?debug=results  → skip the test and render DoneView (optionally &wpm=120&acc=97).
function readDebugResults() {
  if (typeof window === 'undefined') return null
  const params = new URLSearchParams(window.location.search)
  if (params.get('debug') !== 'results') return null
  const wpm = parseInt(params.get('wpm') ?? '78', 10)
  const acc = parseInt(params.get('acc') ?? '96', 10)
  return {
    wpm: Number.isFinite(wpm) ? Math.max(0, Math.min(999, wpm)) : 78,
    accuracy: Number.isFinite(acc) ? Math.max(0, Math.min(100, acc)) : 96,
  }
}

export default function TypingPlayground({ keyboardSounds, onCenterInView, hideSwitchPicker = false, zenMode = false }) {
  const debugResults = useMemo(() => readDebugResults(), [])
  const [words, setWords] = useState(() => pickWords(60))
  const [currentWordIdx, setCurrentWordIdx] = useState(0)
  const [typedChars, setTypedChars] = useState('')
  const [completedWords, setCompletedWords] = useState([])
  const [elapsedMs, setElapsedMs] = useState(() => debugResults ? TEST_SECONDS * 1000 : 0)
  const [phase, setPhase] = useState(() => debugResults ? 'done' : 'idle')
  const [doneExiting, setDoneExiting] = useState(false)
  const [runningExiting, setRunningExiting] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  // Per-second WPM samples collected during the test. Populated from the
  // polling tick (1 sample per second) and frozen into `finalStats` when
  // the test finalizes. Shape: [{ second: 1, wpm: 82 }, ...].
  const wpmSeriesRef = useRef([])
  // Timestamps (test-seconds) of keystroke errors. Each mistyped character
  // pushes one entry. Rendered as X marks on the share chart to visualize
  // where accuracy dipped during the run.
  const errorsRef = useRef([])
  const [finalStats, setFinalStats] = useState(null) // { series, consistency, errors }
  const [switchMenuOpen, setSwitchMenuOpen] = useState(false)
  const switchMenuWrapRef = useRef(null)
  const [capsLockOn, setCapsLockOn] = useState(false)
  const [totalCorrect, setTotalCorrect] = useState(0)
  const [totalIncorrect, setTotalIncorrect] = useState(0)
  const [isFocused, setIsFocused] = useState(false)

  const inputRef = useRef(null)
  const rootRef = useRef(null)
  const startTimeRef = useRef(null)
  const wordsOuterRef = useRef(null)
  const wordsInnerRef = useRef(null)
  const wordRefs = useRef({})
  const caretTargetRef = useRef(null)
  const caretElRef = useRef(null)
  const wordRefSetters = useRef(new Map())
  const scrollSoundPoolRef = useRef(null)
  const scrollSoundCursorRef = useRef(0)
  const prevTranslateYRef = useRef(0)
  const keebyVoiceRef = useRef(null)
  const keebyChimeRef = useRef(null)

  // Defer playground SFX until the section nears the viewport — keeps MP3/OGG
  // fetches out of the landing-page critical path.
  useEffect(() => {
    const el = rootRef.current
    if (!el) return

    let primed = false
    const primeAudio = () => {
      if (primed) return
      primed = true

      const files = ['/sounds/line_scroll_01.mp3', '/sounds/line_scroll_02.mp3']
      const pool = []
      for (let i = 0; i < 4; i++) {
        for (const src of files) {
          const audio = new Audio(src)
          audio.preload = 'auto'
          audio.volume = 0.35
          pool.push(audio)
        }
      }
      scrollSoundPoolRef.current = pool

      const voice = new Audio('/sounds/keeby-voice.mp3')
      voice.preload = 'auto'
      voice.volume = 0.7
      keebyVoiceRef.current = voice
      const chime = new Audio('/sounds/keeby-success-chime.mp3')
      chime.preload = 'auto'
      chime.volume = 0.6
      keebyChimeRef.current = chime
    }

    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) primeAudio() },
      { rootMargin: '240px' },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const playKeebyVoice = useCallback(() => {
    if (isMuted()) return
    const a = keebyVoiceRef.current
    if (!a) return
    try { a.currentTime = 0; a.play().catch(() => {}) } catch {}
  }, [])

  const playKeebyChime = useCallback(() => {
    if (isMuted()) return
    const a = keebyChimeRef.current
    if (!a) return
    try { a.currentTime = 0; a.play().catch(() => {}) } catch {}
  }, [])

  const playLineScroll = useCallback(() => {
    if (isMuted()) return
    const pool = scrollSoundPoolRef.current
    if (!pool || pool.length === 0) return
    // Prefer a voice that's already finished; otherwise round-robin.
    let audio = pool.find((a) => a.paused || a.ended)
    if (!audio) {
      audio = pool[scrollSoundCursorRef.current % pool.length]
      scrollSoundCursorRef.current++
    }
    try {
      audio.currentTime = 0
      // Random pitch via playbackRate: ±12% feels alive without sounding broken.
      audio.playbackRate = 0.88 + Math.random() * 0.24
      audio.play().catch(() => {})
    } catch {}
  }, [])

  const getWordRefSetter = useCallback((idx) => {
    const map = wordRefSetters.current
    let setter = map.get(idx)
    if (!setter) {
      setter = (el) => {
        if (el) wordRefs.current[idx] = el
        else delete wordRefs.current[idx]
      }
      map.set(idx, setter)
    }
    return setter
  }, [])

  const { selectHeroSwitch } = keyboardSounds
  const playgroundProfileId = usePlaygroundProfileId()
  const profile = ALL_SWITCHES.find((s) => s.id === playgroundProfileId) ?? TYPABLE_SWITCHES[0]

  const completedWordsRef = useRef(completedWords)
  const totalCorrectRef = useRef(totalCorrect)
  const totalIncorrectRef = useRef(totalIncorrect)
  useEffect(() => { completedWordsRef.current = completedWords }, [completedWords])
  useEffect(() => { totalCorrectRef.current = totalCorrect }, [totalCorrect])
  useEffect(() => { totalIncorrectRef.current = totalIncorrect }, [totalIncorrect])

  const runningExitingRef = useRef(false)
  useEffect(() => { runningExitingRef.current = runningExiting }, [runningExiting])

  const finalize = useCallback((ms) => {
    if (runningExitingRef.current) return
    runningExitingRef.current = true
    setRunningExiting(true)
    setElapsedMs(ms)
    const seconds = Math.max(1, ms / 1000)
    const correctWordChars = completedWordsRef.current
      .filter((w) => w.correct)
      .reduce((a, w) => a + w.word.length + 1, 0)
    const wpm = Math.round((correctWordChars * (60 / seconds)) / 5)
    const total = totalCorrectRef.current + totalIncorrectRef.current
    const accuracy = total === 0 ? 100 : Math.round((totalCorrectRef.current / total) * 100)

    // Ensure the series covers the full test window even if the final tick
    // didn't align with a whole second. Last sample = final wpm at total
    // seconds so the chart ends right on the hero number.
    const series = [...wpmSeriesRef.current]
    const lastSecond = series.length ? series[series.length - 1].second : 0
    const finalSecond = Math.round(seconds)
    if (finalSecond > lastSecond) {
      series.push({ second: finalSecond, wpm })
    } else if (series.length) {
      series[series.length - 1] = { second: series[series.length - 1].second, wpm }
    }
    // Consistency: 100 × (1 − stdDev / mean) clamped to [0, 100]. Mirrors
    // Monkeytype's "how steady was your WPM" metric without the exp() curve.
    const mean = series.length ? series.reduce((a, s) => a + s.wpm, 0) / series.length : wpm
    const variance = series.length > 1
      ? series.reduce((a, s) => a + (s.wpm - mean) ** 2, 0) / series.length
      : 0
    const stdDev = Math.sqrt(variance)
    const consistency = mean > 0
      ? Math.max(0, Math.min(100, Math.round((1 - stdDev / mean) * 100)))
      : 100
    setFinalStats({ series, consistency, errors: [...errorsRef.current] })

    capture('playground_completed', {
      wpm, accuracy, consistency,
      errors: errorsRef.current.length,
      profile: profile.id,
    })
    hapticSuccess()
    // Running exit lasts ~280ms. Flip to done at 220ms so DoneView's entry
    // overlaps the tail of the running exit — no dead gap between the two.
    setTimeout(() => {
      if (!runningExitingRef.current) return
      setPhase('done')
      setRunningExiting(false)
      runningExitingRef.current = false
    }, 220)
  }, [profile.id])

  useEffect(() => {
    if (phase !== 'running' || runningExiting) return
    const iv = setInterval(() => {
      const ms = Date.now() - startTimeRef.current
      // Sample running WPM at each whole-second boundary. Uses the same
      // formula as finalize so the last sample lines up with the hero.
      const seconds = Math.floor(ms / 1000)
      const lastSampled = wpmSeriesRef.current.length
        ? wpmSeriesRef.current[wpmSeriesRef.current.length - 1].second
        : 0
      if (seconds > 0 && seconds > lastSampled) {
        const correctSoFar = completedWordsRef.current
          .filter((w) => w.correct)
          .reduce((a, w) => a + w.word.length + 1, 0)
        const wpmSoFar = Math.round((correctSoFar * (60 / seconds)) / 5)
        wpmSeriesRef.current.push({ second: seconds, wpm: wpmSoFar })
      }
      if (ms >= TEST_SECONDS * 1000) finalize(TEST_SECONDS * 1000)
      else setElapsedMs(ms)
    }, 80)
    return () => clearInterval(iv)
  }, [phase, runningExiting, finalize])

  const doneExitingRef = useRef(false)
  useEffect(() => { doneExitingRef.current = doneExiting }, [doneExiting])

  const doReset = useCallback(() => {
    setWords(pickWords(60))
    setCurrentWordIdx(0)
    setTypedChars('')
    setCompletedWords([])
    setElapsedMs(0)
    setPhase('idle')
    setTotalCorrect(0)
    setTotalIncorrect(0)
    setDoneExiting(false)
    setRunningExiting(false)
    runningExitingRef.current = false
    startTimeRef.current = null
    wpmSeriesRef.current = []
    errorsRef.current = []
    setFinalStats(null)
    capture('playground_retry')
    setTimeout(() => inputRef.current?.focus(), 0)
  }, [])

  const retry = useCallback(() => {
    // If results are showing, play exit animation first, then reset.
    if (phase === 'done' && !doneExitingRef.current) {
      setDoneExiting(true)
      // Longest exit = 80ms delay + 400ms stat-slide-out = 480ms.
      setTimeout(doReset, 500)
      return
    }
    doReset()
  }, [phase, doReset])

  const handleKeyUp = useCallback((e) => {
    const caps = typeof e.getModifierState === 'function' ? e.getModifierState('CapsLock') : undefined
    if (typeof caps === 'boolean') setCapsLockOn(caps)
  }, [])

  const handleKeyDown = useCallback((e) => {
    const key = e.key
    const caps = typeof e.getModifierState === 'function' ? e.getModifierState('CapsLock') : undefined
    if (typeof caps === 'boolean' && caps !== capsLockOn) setCapsLockOn(caps)
    if (e.shiftKey && key === 'Enter') {
      e.preventDefault()
      retry()
      return
    }
    if (key === 'Tab') {
      e.preventDefault()
      retry()
      return
    }
    if (phase === 'done' || runningExiting) {
      // Swallow everything else so Space / Arrow / PageDown don't scroll the
      // horizontal-scroll container while the results/exit animation is showing.
      if (!e.metaKey && !e.ctrlKey && !e.altKey && key !== 'Escape') {
        e.preventDefault()
      }
      return
    }
    if (key === 'Escape') return
    if (key.startsWith('Arrow')) { e.preventDefault(); return }
    if (e.metaKey) return
    if ((e.ctrlKey || e.altKey) && key !== 'Backspace') return

    if (phase === 'idle') {
      if (key.length === 1 && key !== ' ') {
        startTimeRef.current = Date.now()
        setPhase('running')
        capture('playground_started', { profile: profile.id })
      }
    }

    if (key === 'Backspace') {
      e.preventDefault()
      const wholeWord = e.ctrlKey || e.altKey

      if (typedChars.length > 0) {
        setTypedChars(wholeWord ? '' : typedChars.slice(0, -1))
        return
      }

      if (currentWordIdx === 0) return
      const prev = completedWords[currentWordIdx - 1]
      if (!prev || prev.correct) return

      const prevWord = words[currentWordIdx - 1]
      const typed = prev.typed
      let c = 0, ic = 0
      const L = Math.max(prevWord.length, typed.length)
      for (let i = 0; i < L; i++) {
        if (typed[i] !== undefined && typed[i] === prevWord[i]) c++
        else ic++
      }
      setTotalCorrect((tc) => tc - c)
      setTotalIncorrect((ti) => ti - ic)
      setCompletedWords((cw) => cw.slice(0, -1))
      setCurrentWordIdx((idx) => idx - 1)
      setTypedChars(wholeWord ? '' : typed)
      return
    }

    if (key === ' ') {
      e.preventDefault()
      if (typedChars.length === 0) return
      const word = words[currentWordIdx]
      const typed = typedChars
      const correct = typed === word
      let c = 0, ic = 0
      const len = Math.max(word.length, typed.length)
      for (let i = 0; i < len; i++) {
        if (typed[i] !== undefined && typed[i] === word[i]) c++
        else ic++
      }
      setCompletedWords((prev) => [...prev, { word, typed, correct }])
      setTotalCorrect((prev) => prev + c + (correct ? 1 : 0))
      setTotalIncorrect((prev) => prev + ic)
      setTypedChars('')
      if (word === 'keeby' && correct) { playKeebyVoice(); playKeebyChime() }
      const nextIdx = currentWordIdx + 1
      if (nextIdx >= words.length) finalize(Date.now() - startTimeRef.current)
      else setCurrentWordIdx(nextIdx)
      return
    }

    if (key.length === 1) {
      e.preventDefault()
      // Cap overtype at word.length + 8 so runaway typing can't blow up the
      // line layout or produce an unreadable wall of red. Backspace always
      // still works to recover, and Space still commits the word.
      const currentWord = words[currentWordIdx]
      const maxLen = (currentWord?.length ?? 0) + 8
      setTypedChars((prev) => {
        if (prev.length >= maxLen) return prev
        // Record the second of any mistyped character for the share chart's
        // X-mark overlay. Overtyping past the word end also counts as an
        // error since those characters are always incorrect.
        const expected = currentWord?.[prev.length]
        const isWrong = expected === undefined || key !== expected
        if (isWrong && startTimeRef.current) {
          const second = Math.max(1, Math.ceil((Date.now() - startTimeRef.current) / 1000))
          errorsRef.current.push({ second })
        }
        return prev + key
      })
    }
  }, [phase, runningExiting, capsLockOn, words, currentWordIdx, typedChars, completedWords, profile.id, finalize, retry, playKeebyVoice, playKeebyChime])

  const focusInput = useCallback(() => { inputRef.current?.focus() }, [])

  // Close the switches dropdown on any click outside its wrapper. The old
  // fixed-inset backdrop didn't work inside HorizontalScroll because the
  // track has a transform, which makes position:fixed resolve relative to
  // the transformed ancestor instead of the viewport. Document listener is
  // immune to that.
  useEffect(() => {
    if (!switchMenuOpen) return
    const onDocDown = (e) => {
      const wrap = switchMenuWrapRef.current
      if (!wrap) return
      if (wrap.contains(e.target)) return
      setSwitchMenuOpen(false)
    }
    document.addEventListener('mousedown', onDocDown)
    document.addEventListener('touchstart', onDocDown, { passive: true })
    return () => {
      document.removeEventListener('mousedown', onDocDown)
      document.removeEventListener('touchstart', onDocDown)
    }
  }, [switchMenuOpen])

  // Auto-focus when the playground is ≥15% in view so users can start typing
  // without tapping the area. Blur when it scrolls out so the next re-entry
  // triggers focus again. Use preventScroll so focusing doesn't jump the page.
  useEffect(() => {
    const root = rootRef.current
    const input = inputRef.current
    if (!root || !input) return

    let wasVisible = false
    const obs = new IntersectionObserver(
      ([entry]) => {
        const visible = entry.intersectionRatio >= 0.15
        if (visible && !wasVisible) {
          input.focus({ preventScroll: true })
        } else if (!visible && wasVisible) {
          if (document.activeElement === input) input.blur()
        }
        wasVisible = visible
      },
      { threshold: [0, 0.15, 0.3, 0.6, 1] },
    )
    obs.observe(root)
    return () => obs.disconnect()
  }, [])

  // While the user is typing (phase === 'running'), keep the playground
  // centered. Fires on every keystroke (typedChars / currentWordIdx deps) so
  // if the user scrolls a bit off-panel mid-test, the next keystroke snaps
  // them back. Ratio check gates the actual scroll — if already locked on the
  // panel, skip so we don't animate to the same spot over and over.
  //
  // Must check both axes: on desktop the playground lives inside a
  // HorizontalScroll whose sticky viewport always fills Y, so a Y-only check
  // would always say "fully visible" and the scroll would never fire there.
  const lastCenterFiredAtRef = useRef(0)
  useEffect(() => {
    if (phase !== 'running') return
    const root = rootRef.current
    if (!root || typeof window === 'undefined') return

    const rect = root.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight

    const visibleLeft   = Math.max(0, rect.left)
    const visibleRight  = Math.min(vw, rect.right)
    const visibleTop    = Math.max(0, rect.top)
    const visibleBottom = Math.min(vh, rect.bottom)
    const visibleW = Math.max(0, visibleRight  - visibleLeft)
    const visibleH = Math.max(0, visibleBottom - visibleTop)
    const denom = (Math.min(rect.width, vw) || 1) * (Math.min(rect.height, vh) || 1)
    const ratio = (visibleW * visibleH) / denom
    // Only skip if essentially locked on the panel already.
    if (ratio >= 0.99) return

    // Cooldown: don't retrigger Lenis.scrollTo for every keystroke during the
    // ~1.1s animation window — one call per off-center session is enough.
    const now = Date.now()
    if (now - lastCenterFiredAtRef.current < 1200) return
    lastCenterFiredAtRef.current = now

    // lock=true so user wheel/touch can't cancel the centering mid-animation.
    onCenterInView?.({ lock: true })
  }, [phase, typedChars, currentWordIdx, onCenterInView])

  const liveStats = useMemo(() => {
    if (debugResults && phase === 'done') return debugResults
    if (phase === 'idle') return { wpm: 0, accuracy: 100 }
    const seconds = Math.max(1, elapsedMs / 1000)
    const correctWordChars = completedWords.filter((w) => w.correct).reduce((a, w) => a + w.word.length + 1, 0)
    const wpm = Math.round((correctWordChars * (60 / seconds)) / 5)
    const total = totalCorrect + totalIncorrect
    const accuracy = total === 0 ? 100 : Math.round((totalCorrect / total) * 100)
    return { wpm, accuracy }
  }, [debugResults, phase, elapsedMs, completedWords, totalCorrect, totalIncorrect])

  const remainingSeconds = Math.max(0, TEST_SECONDS - Math.floor(elapsedMs / 1000))
  const timerLabel = phase === 'idle' ? `${TEST_SECONDS}` : `${remainingSeconds}`
  const isLowTime = phase === 'running' && remainingSeconds <= 3

  useLayoutEffect(() => {
    const inner = wordsInnerRef.current
    const outer = wordsOuterRef.current
    const word = wordRefs.current[currentWordIdx]
    const target = caretTargetRef.current
    const caretEl = caretElRef.current
    if (!inner || !outer || !word) return

    // === READS (batched) ===
    const lineHeight = parseFloat(getComputedStyle(outer).lineHeight) || 0
    if (!lineHeight) return
    const wordTop = word.offsetTop
    const tRect = target ? target.getBoundingClientRect() : null
    const iRect = (target && tRect) ? inner.getBoundingClientRect() : null

    // === COMPUTE ===
    const lineIndex = Math.round(wordTop / lineHeight)
    const targetLine = Math.max(0, lineIndex - 1)
    const newTranslateY = -targetLine * lineHeight
    const caretH = Math.round(lineHeight * 0.72)
    const caretY = wordTop + Math.round((lineHeight - caretH) / 2)
    const caretX = (tRect && iRect) ? tRect.left - iRect.left : 0
    const caretVisible = target != null && isFocused && phase !== 'done'

    // === WRITES (batched) ===
    inner.style.transform = `translate3d(0, ${newTranslateY}px, 0)`
    // Line advance → play the paper-feed SFX with random pitch. Only fire
    // during running (not on initial mount, retry reset, or caret-only updates).
    if (newTranslateY !== prevTranslateYRef.current) {
      if (phase === 'running' && !runningExiting) {
        playLineScroll()
        hapticLine()
      }
      prevTranslateYRef.current = newTranslateY
    }
    if (caretEl) {
      caretEl.style.transform = `translate3d(${caretX - 1.75}px, ${caretY}px, 0)`
      caretEl.style.height = `${caretH}px`
      caretEl.style.opacity = caretVisible ? '1' : '0'
    }
  }, [currentWordIdx, typedChars, words, phase, isFocused, runningExiting, playLineScroll])

  return (
    <div ref={rootRef} className="relative w-full tracking-tight">
    <div
      className="relative mx-auto w-full max-w-[820px] px-5 md:px-8"
      onClick={focusInput}
    >
      <textarea
        ref={inputRef}
        data-keeby-sounds="true"
        value=""
        onChange={() => {}}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck="false"
        aria-label="Typing test input"
        className="absolute opacity-0 pointer-events-none"
        style={{ width: 1, height: 1, top: 0, left: 0 }}
      />

      <div className="min-h-[250px] md:min-h-[290px] flex flex-col justify-center">
      {phase === 'done' ? (
        <DoneView wpm={liveStats.wpm} accuracy={liveStats.accuracy} exiting={doneExiting} />
      ) : (
        <div
          className={runningExiting ? 'ios-blur-out' : 'ios-blur-in'}
          style={{ willChange: 'opacity, filter, transform' }}
        >
          <div className="flex items-center justify-between gap-4 mb-10">
            <h2 className="text-[11px] sm:text-sm font-medium tracking-tight text-neutral-600">
              Type to hear it
            </h2>
            <div className="flex items-center gap-5 sm:gap-7 text-[12px] tabular-nums text-neutral-600 font-medium tracking-tight">
              <span className={`inline-flex items-baseline gap-1.5 transition-colors ${isLowTime ? 'text-[#FF8C17]' : ''}`}>
                <span className={`inline-block text-right text-[18px] font-semibold tracking-tight tabular-nums ${isLowTime ? 'text-[#FF8C17]' : 'text-neutral-900'}`} style={{ minWidth: '2ch' }}>{timerLabel}</span>
                <span>s</span>
              </span>
              <span className="inline-flex items-baseline gap-1.5">
                <span className="inline-block text-right text-[18px] font-semibold tracking-tight text-neutral-900 tabular-nums" style={{ minWidth: '3ch' }}>{liveStats.wpm}</span>
                <span>wpm</span>
              </span>
              <span className="inline-flex items-baseline gap-1.5">
                <span className="inline-block text-right text-[18px] font-semibold tracking-tight text-neutral-900 tabular-nums" style={{ minWidth: '3ch' }}>{liveStats.accuracy}</span>
                <span>% acc</span>
              </span>
            </div>
          </div>
          <div className="relative">
          <div
            ref={wordsOuterRef}
            className={`relative select-none overflow-hidden transition-[opacity,filter] duration-300 ${isFocused ? 'opacity-100' : 'opacity-70'}`}
            style={{
              fontFamily: "'Geist Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
              fontSize: 'clamp(20px, 3.4vw, 30px)',
              fontWeight: 500,
              lineHeight: 1.45,
              letterSpacing: '-0.01em',
              color: '#bfbfbf',
              textAlign: 'left',
              wordSpacing: '0.3em',
              height: 'calc(1.45em * 3)',
              paddingLeft: '4px',
              paddingRight: '4px',
              contain: 'content',
              filter: capsLockOn ? 'blur(6px)' : 'none',
            }}
          >
            <div
              ref={wordsInnerRef}
              style={{
                position: 'relative',
                transform: 'translate3d(0, 0, 0)',
                transition: 'transform 220ms cubic-bezier(0.4, 0, 0.2, 1)',
                willChange: 'transform',
              }}
            >
              {words.map((word, absIdx) => {
                const state = absIdx < currentWordIdx ? 'past'
                  : absIdx === currentWordIdx ? 'current' : 'future'
                const completed = state === 'past' ? completedWords[absIdx] : null
                return (
                  <WordBlock
                    key={absIdx}
                    word={word}
                    state={state}
                    typed={state === 'current' ? typedChars : completed?.typed ?? ''}
                    leading={absIdx > 0}
                    elRef={getWordRefSetter(absIdx)}
                    caretTargetRef={state === 'current' ? caretTargetRef : null}
                  />
                )
              })}

              <span
                ref={caretElRef}
                aria-hidden="true"
                className={phase === 'idle' ? 'caret-pulse' : ''}
                style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  width: '3.5px',
                  height: 0,
                  borderRadius: '1.75px',
                  background: '#ff8d0e',
                  opacity: 0,
                  transform: 'translate3d(0, 0, 0)',
                  transition: 'transform 280ms cubic-bezier(0.16, 1, 0.3, 1), height 220ms ease, opacity 220ms ease',
                  pointerEvents: 'none',
                  willChange: 'transform',
                  contain: 'strict',
                }}
              />
            </div>
          </div>

          {/* Caps Lock indicator — blurs the words + floats a pill above them */}
          <div
            aria-hidden={!capsLockOn}
            className={`pointer-events-none absolute inset-0 flex items-center justify-center transition-[opacity,filter] duration-300 ease-out ${
              capsLockOn ? 'opacity-100 blur-0' : 'opacity-0 blur-[6px]'
            }`}
          >
            <div className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-b from-[#2a2a2a] to-[#0a0a0a] border border-white/[0.08] px-3 py-2 text-[11px] font-semibold tracking-tight text-white shadow-lg sm:px-5 sm:py-2.5 sm:text-sm sm:gap-2">
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 14l6-8 6 8h-4v4h-4v-4z" />
                <line x1="6" y1="20" x2="18" y2="20" />
              </svg>
              <span className="whitespace-nowrap">Caps Lock is on</span>
            </div>
          </div>
          </div>

        </div>
      )}
      </div>

      {/* Visual keyboard — desktop-only, purely cosmetic. Our own sound +
          haptic pipeline runs on the window-level listener, so we disable the
          component's built-in audio/haptics to avoid double-firing.

          Zen-mode collapse uses the grid-rows-[0fr↔1fr] technique so the
          height animates from intrinsic content size down to zero (no magic
          numbers). The parent panel's `items-center` then re-centers the
          typing test smoothly as this row's contributed height changes. */}
      <div
        className={`hidden lg:grid w-full mt-4 pointer-events-none transition-[grid-template-rows,margin-top] duration-[600ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
          zenMode ? 'grid-rows-[0fr] mt-0' : 'grid-rows-[1fr]'
        }`}
        aria-hidden={zenMode}
      >
        {/* min-h-0 lets the grid track actually shrink to 0; overflow-visible
            keeps the credit + keyboard shadows un-clipped. The inner content
            handles its own visual disappearance via scale + opacity + blur,
            using origin-top so it scrunches up into the toolbar above rather
            than overlapping the toolbar below as the row collapses. */}
        <div className="min-h-0 overflow-visible flex justify-center">
          <div
            className={`relative origin-top transition-[transform,opacity,filter] duration-[600ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
              zenMode ? 'opacity-0 blur-[6px] scale-y-0' : 'opacity-100 blur-0 scale-y-100'
            }`}
          >
            <Keyboard theme="classic" enableSound={false} enableHaptics={false} />
            {/* Credit for Himanshu — K2 Max K Pro Brown samples + the visual
                keyboard component (keyb.himan.me). Floats to the right of the
                keyboard, mirrors the Emir/Arc footer credit style. */}
            <div className="absolute left-full top-1/2 -translate-y-1/2 ml-6 w-[200px] pointer-events-auto">
              <span className="block text-xs text-neutral-600 leading-[1.3] tracking-tight">
                This keyboard + K Pro Brown{' '}
                <span className="whitespace-nowrap">
                  by{' '}
                  <ContributorCredit contributor={contributorForProfile('keychron-k2-max-brown')} />.
                  Legend.
                </span>
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-10 flex items-center justify-between gap-4">
        {/* Switches dropdown — same component mobile + desktop. Hidden via
            the navbar settings toggle so users typing along with their own
            Keeby app don't see a redundant browser-side switch picker. The
            empty placeholder keeps Share/Restart right-aligned. */}
        {hideSwitchPicker ? <div /> : (
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="hidden sm:inline text-sm font-medium tracking-tight text-neutral-600">Switches</span>
          <div ref={switchMenuWrapRef} className="relative">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); hapticTap(); setSwitchMenuOpen((v) => !v) }}
            className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-[11px] font-medium tracking-tight text-neutral-900 bg-black/[0.05] transition duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.96] sm:px-5 sm:py-2.5 sm:text-sm sm:gap-2.5"
            aria-expanded={switchMenuOpen}
            aria-haspopup="listbox"
          >
            <span className="relative block shrink-0 rounded-[2px] h-[11px] w-[11px] sm:h-[13px] sm:w-[13px]" style={{ backgroundColor: profile.color }} aria-hidden="true">
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="absolute h-[5px] w-[1px] sm:h-[6px] sm:w-[1.2px] rounded-full bg-black/40" />
                <span className="absolute h-[1px] w-[5px] sm:h-[1.2px] sm:w-[6px] rounded-full bg-black/40" />
              </span>
            </span>
            <span>{profile.name.replace('K2 Max · ', '')}</span>
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`h-[10px] w-[10px] sm:h-3 sm:w-3 transition-transform duration-200 ${switchMenuOpen ? 'rotate-180' : ''}`}>
              <polyline points="6 9 10 13 14 9" />
            </svg>
          </button>
          <div
            className={`absolute bottom-full left-0 mb-2 min-w-[200px] sm:min-w-[240px] rounded-2xl bg-white p-1 z-20 transition-[opacity,filter] duration-[240ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
              switchMenuOpen
                ? 'opacity-100 blur-0 pointer-events-auto'
                : 'opacity-0 blur-[10px] pointer-events-none'
            }`}
            style={{
              boxShadow:
                '0 24px 60px -18px rgba(0,0,0,0.1), 0 10px 24px -12px rgba(0,0,0,0.05)',
              willChange: 'opacity, transform, filter',
            }}
            role="listbox"
            aria-hidden={!switchMenuOpen}
          >
            <div
              data-lenis-prevent
              className="max-h-[min(240px,42vh)] overflow-y-auto overscroll-contain playground-switch-scroll -mr-0.5 pr-0.5"
            >
            {TYPABLE_SWITCHES.map((p) => {
              const active = p.id === playgroundProfileId
              const catalogIndex = ALL_SWITCHES.findIndex((s) => s.id === p.id)
              return (
                <button
                  key={p.id}
                  type="button"
                  role="option"
                  aria-selected={active}
                  tabIndex={switchMenuOpen ? 0 : -1}
                  onClick={(e) => {
                    e.stopPropagation()
                    hapticTap()
                    if (catalogIndex >= 0) setHeroSelection(catalogIndex, p.id)
                    selectHeroSwitch?.(p.id)
                    setSwitchMenuOpen(false)
                    capture('playground_switch_selected', { profile: p.name })
                    inputRef.current?.focus()
                  }}
                  className={`flex items-center gap-2 w-full rounded-xl px-3 py-2 text-[11px] font-medium tracking-tight text-left transition-colors sm:px-4 sm:py-2.5 sm:text-sm sm:gap-2.5 ${
                    active ? 'text-neutral-900 bg-black/[0.05]' : 'text-neutral-600 hover:text-neutral-900 hover:bg-black/[0.03]'
                  }`}
                >
                  <span className="relative block shrink-0 rounded-[2px] h-[11px] w-[11px] sm:h-[13px] sm:w-[13px]" style={{ backgroundColor: p.color }} aria-hidden="true">
                    <span className="absolute inset-0 flex items-center justify-center">
                      <span className="absolute h-[5px] w-[1px] sm:h-[6px] sm:w-[1.2px] rounded-full bg-black/40" />
                      <span className="absolute h-[1px] w-[5px] sm:h-[1.2px] sm:w-[6px] rounded-full bg-black/40" />
                    </span>
                  </span>
                  {p.name.replace('K2 Max · ', '')}
                </button>
              )
            })}
            </div>
          </div>
          </div>
        </div>
        )}

        <div className="flex items-center gap-2">
          {/* Share button — always rendered so the toolbar has no layout
              shift when results arrive. Visibility driven by ios-blur-in /
              ios-blur-out animations keyed off phase + doneExiting, matching
              the DoneView stats hero. When hidden it sits idle with opacity
              0 and pointer-events disabled so it doesn't catch stray clicks. */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              hapticTap()
              setShareOpen(true)
              capture('share_card_opened', {
                wpm: liveStats.wpm,
                accuracy: liveStats.accuracy,
                profile: profile?.id,
              })
            }}
            className={`group inline-flex items-center gap-1.5 rounded-full bg-gradient-to-b from-[#2a2a2a] to-[#0a0a0a] border border-white/[0.08] px-3 py-2 text-[11px] font-semibold tracking-tight text-white hover:shadow-lg active:scale-[0.96] sm:gap-2 sm:px-5 sm:py-2.5 sm:text-sm ${
              phase === 'done' && !doneExiting
                ? 'ios-blur-in pointer-events-auto'
                : doneExiting
                  ? 'ios-blur-out pointer-events-none'
                  : 'opacity-0 pointer-events-none'
            }`}
            style={{ animationDelay: doneExiting ? '0ms' : '180ms' }}
            aria-hidden={phase !== 'done'}
            tabIndex={phase === 'done' ? 0 : -1}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7" />
              <polyline points="16 6 12 2 8 6" />
              <line x1="12" y1="2" x2="12" y2="15" />
            </svg>
            <span className="whitespace-nowrap">Share</span>
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); hapticTap(); retry() }}
            className="group relative overflow-hidden rounded-full px-3 py-2 text-[11px] font-medium tracking-tight text-neutral-600 hover:text-neutral-700 hover:bg-black/[0.04] transition duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.96] sm:px-5 sm:py-2.5 sm:text-sm"
            title="Tab"
          >
            <span className="flex items-center gap-1.5 transition-all duration-300 group-hover:-translate-y-full group-hover:opacity-0 group-hover:blur-[6px] sm:gap-2">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>
              <span className="whitespace-nowrap">Restart</span>
            </span>
            <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center gap-1.5 translate-y-full transition-transform duration-300 group-hover:translate-y-0 sm:gap-2">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>
              <span className="whitespace-nowrap">Restart</span>
            </span>
          </button>
        </div>
      </div>
    </div>
    {shareOpen && (
      <ShareCardModal
        wpm={liveStats.wpm}
        accuracy={liveStats.accuracy}
        profile={profile}
        series={finalStats?.series ?? []}
        errors={finalStats?.errors ?? []}
        consistency={finalStats?.consistency ?? null}
        onClose={() => setShareOpen(false)}
      />
    )}
    </div>
  )
}

const caretTargetStyle = { display: 'inline-block', width: 0, height: '1em', verticalAlign: 'baseline' }

const WordBlock = memo(function WordBlock({ word, state, typed, leading, elRef, caretTargetRef }) {
  const isKeeby = word === 'keeby'
  const keebySuccess = isKeeby && state === 'past' && typed === word
  const logoEl = isKeeby ? (
    <img
      src="/keeby-logo.webp"
      alt=""
      aria-hidden="true"
      style={{
        display: 'inline-block',
        height: '0.82em',
        width: '0.82em',
        marginLeft: '0.22em',
        verticalAlign: '-0.1em',
        transform: keebySuccess ? 'rotate(0deg)' : 'rotate(14deg)',
        // Desaturated until success — the orange reveal matches the text
        // shimmer so the whole moment "earns" its color at the same time.
        filter: keebySuccess ? 'saturate(1) opacity(1)' : 'saturate(0) opacity(0.85)',
        transition: 'transform 520ms cubic-bezier(0.34, 1.56, 0.64, 1), filter 420ms ease-out',
        willChange: 'transform, filter',
      }}
    />
  ) : null

  // Shimmer only fires on the success state (past + typed exactly matches) —
  // before that, the keeby word renders in normal neutral typing colors so
  // the orange reveal feels earned. Rendered as ONE span across the whole
  // word so the gradient flows continuously, not per-character.
  if (keebySuccess) {
    return (
      <>
        {leading && ' '}
        <span ref={elRef} style={{ display: 'inline-block', whiteSpace: 'nowrap' }}>
          <span className="keeby-shimmer">{word}</span>
          {logoEl}
        </span>
      </>
    )
  }

  // Fallback: per-char rendering (used for non-keeby words, and for keeby when
  // the user has made a mistake — so wrong chars still visibly go red).
  const nodes = []
  const len = Math.max(word.length, typed.length)
  const caretAt = caretTargetRef ? typed.length : -1

  for (let i = 0; i < len; i++) {
    if (i === caretAt) {
      nodes.push(<span key={`ct-${i}`} ref={caretTargetRef} aria-hidden="true" style={caretTargetStyle}>{'\u200B'}</span>)
    }
    const expected = word[i]
    const actual = typed[i]
    let color
    let ch = expected ?? actual
    if (state === 'past') {
      if (actual === undefined) color = 'rgba(229, 72, 77, 0.5)'
      else if (actual === expected) color = '#171717'
      else color = '#E5484D'
      if (expected === undefined) { color = 'rgba(229, 72, 77, 0.6)'; ch = actual }
    } else if (state === 'current') {
      if (actual === undefined) color = '#bfbfbf'
      else if (actual === expected) color = '#171717'
      else color = '#E5484D'
      if (expected === undefined) { color = 'rgba(229, 72, 77, 0.75)'; ch = actual }
    } else {
      color = '#bfbfbf'
    }
    nodes.push(<span key={i} style={{ color }}>{ch}</span>)
  }
  if (caretAt === len) {
    nodes.push(<span key="ct-end" ref={caretTargetRef} aria-hidden="true" style={caretTargetStyle}>{'\u200B'}</span>)
  }
  return (
    <>
      {leading && ' '}
      <span ref={elRef} style={{ display: 'inline-block', whiteSpace: 'nowrap' }}>
        {nodes}
        {logoEl}
      </span>
    </>
  )
})

// Full-screen modal showing the daily share card at 1080×1920 (story ratio).
// Renders the card at native export size and scales it down with CSS for the
// preview, so html-to-image captures the real pixel dimensions straight off
// the DOM without any re-layout.
function ShareCardModal({ wpm, accuracy, profile, series, errors, consistency, onClose }) {
  const cardRef = useRef(null)
  const [saving, setSaving] = useState(false)

  const today = useMemo(() => {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'short', month: 'long', day: 'numeric',
    })
  }, [])

  // Scale the 1080×1920 card to fit the viewport's short axis minus chrome.
  // Recomputes on resize so the preview stays centered and fully visible.
  const [scale, setScale] = useState(0.3)
  useEffect(() => {
    const recompute = () => {
      const padding = 180 // header/footer chrome around the card
      const maxH = Math.max(400, window.innerHeight - padding)
      const maxW = Math.max(320, window.innerWidth - 48)
      setScale(Math.min(maxH / 1920, maxW / 1080, 0.5))
    }
    recompute()
    window.addEventListener('resize', recompute)
    return () => window.removeEventListener('resize', recompute)
  }, [])

  // Enter/exit animation state machine. `entering` is the initial mount
  // frame (invisible), `visible` triggers the transition to fully shown,
  // and `exiting` plays the reverse before the parent unmounts us. Using
  // three states (not two) means the initial render can start off-screen
  // without a flicker before CSS picks up the final class.
  const [animState, setAnimState] = useState('entering')
  useEffect(() => {
    const id = requestAnimationFrame(() => setAnimState('visible'))
    return () => cancelAnimationFrame(id)
  }, [])

  const ANIM_MS = 260
  const requestClose = useCallback(() => {
    setAnimState('exiting')
    window.setTimeout(() => onClose?.(), ANIM_MS)
  }, [onClose])

  // Escape key closes the modal (with the exit animation).
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') requestClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [requestClose])

  const savePNG = async () => {
    if (!cardRef.current) return
    setSaving(true)
    try {
      const { toPng } = await import('html-to-image')
      // Export at exactly 1080×1920 (pixelRatio 1). Instagram and Facebook
      // both recommend this for Stories / My Day — anything larger gets
      // downscaled on upload and risks hitting FB's 4 MB photo cap.
      // `width` and `height` are explicit so the transform-scaled preview
      // node still exports at native card size, not scaled-preview size.
      const dataUrl = await toPng(cardRef.current, {
        pixelRatio: 1,
        cacheBust: true,
        width: 1080,
        height: 1920,
        canvasWidth: 1080,
        canvasHeight: 1920,
        style: { transform: 'none' },
      })
      const link = document.createElement('a')
      link.download = `keeby-${wpm}wpm.png`
      link.href = dataUrl
      link.click()
      capture('share_card_saved', { wpm, accuracy, profile: profile.id })
    } finally {
      setSaving(false)
    }
  }

  // Portal to document.body so the fixed-position overlay escapes the
  // desktop HorizontalScroll track's `transform: translate3d(...)`, which
  // otherwise turns `position: fixed` into a stacking context relative to
  // the 5-panel-wide track and pushes the modal off-screen.
  const visible = animState === 'visible'
  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center px-4 py-6"
      onClick={requestClose}
      style={{
        backgroundColor: visible ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0)',
        backdropFilter: visible ? 'blur(6px)' : 'blur(0px)',
        WebkitBackdropFilter: visible ? 'blur(6px)' : 'blur(0px)',
        transition: `background-color ${ANIM_MS}ms cubic-bezier(0.22, 1, 0.36, 1), backdrop-filter ${ANIM_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`,
      }}
    >
      {/* Card (scaled preview wrapper; the inner node is the export target).
          The wrapper itself carries the enter/exit transition — opacity +
          scale + blur — so the card appears to softly materialize, then
          gently dissolve on close. */}
      <div
        className="relative"
        style={{
          width: 1080 * scale,
          height: 1920 * scale,
          opacity: visible ? 1 : 0,
          transform: visible ? 'scale(1)' : 'scale(0.96)',
          filter: visible ? 'blur(0px)' : 'blur(10px)',
          transition: `opacity ${ANIM_MS}ms cubic-bezier(0.22, 1, 0.36, 1), transform ${ANIM_MS}ms cubic-bezier(0.22, 1, 0.36, 1), filter ${ANIM_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`,
          willChange: 'opacity, transform, filter',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          ref={cardRef}
          className="absolute top-0 left-0 origin-top-left"
          style={{
            width: 1080,
            height: 1920,
            transform: `scale(${scale})`,
            background: '#F5F5F5',
            color: '#1a1a1a',
            fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
            letterSpacing: '-0.025em',
            padding: '128px 96px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            borderRadius: 40,
          }}
        >
          {/* ── Top masthead: wordmark + issue metadata, no divider. ── */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <img src="/logo-text.webp" alt="Keeby" style={{ height: 40, width: 'auto' }} />
            <div style={{
              fontSize: 18, fontWeight: 600, color: '#1a1a1a',
              textTransform: 'uppercase', letterSpacing: '-0.01em',
            }}>
              Daily thock · {today}
            </div>
          </div>

          {/* ── Hero: single dominant number, set editorial-tight.
              Sub-label sits directly under on its own line for a clean
              label/value split. Everything aligned left. ── */}
          <div style={{ marginTop: 110 }}>
            <div style={{
              fontSize: 28, fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '-0.01em',
              color: '#888',
            }}>
              Words per minute
            </div>
            <div style={{
              fontSize: 440, fontWeight: 800,
              letterSpacing: '-0.095em',
              color: '#1a1a1a', lineHeight: 0.84,
              marginTop: 6,
            }}>
              {wpm}
            </div>
          </div>

          {/* ── Edge-to-edge horizontal chart. Negative margins absorb
              the card's 96px horizontal padding so the line's first
              point sits at x=0 (left edge) and its last point at
              x=1080 (right edge). Vertical size stays contained. ── */}
          {series && series.length >= 2 && (
            <div style={{ marginTop: 48, marginLeft: -96, marginRight: -96 }}>
              <ShareChart
                series={series}
                errors={errors ?? []}
                width={1080}
                height={300}
              />
            </div>
          )}

          {/* ── Three-up stat strip, same type scale across columns. ── */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
            marginTop: 44,
          }}>
            <StatCell label="Accuracy" value={`${accuracy}%`} />
            <StatCell
              label="Consistency"
              value={Number.isFinite(consistency) ? `${consistency}%` : '0%'}
            />
            <StatCell label="Errors" value={errors?.length ?? 0} />
          </div>

          {/* ── Switch credit row: swatch on the left; primary switch
              label and (optional) contributor line stack in a second
              column so both text lines share the same x-origin and the
              contributor sits directly under the switch name. ── */}
          <div style={{
            marginTop: 40,
            display: 'flex', alignItems: 'flex-start', gap: 16,
          }}>
            <SwitchSwatch color={profile?.color ?? '#888'} size={40} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{
                fontSize: 30, fontWeight: 600, color: '#1a1a1a',
                letterSpacing: '-0.03em', lineHeight: 1.05,
              }}>
                Typed on {profile?.name?.replace(/^K2 Max · /, 'K2 Max ') ?? 'Keeby'}
                <span style={{ color: '#888', fontWeight: 500 }}> · {profile?.type ?? ''}</span>
              </div>
              {profile?.contributor && (
                <div style={{
                  fontSize: 28, fontWeight: 500, color: '#888',
                  letterSpacing: '-0.03em',
                }}>
                  <ContributorShareLine contributor={profile.contributor} />
                </div>
              )}
            </div>
          </div>

          {/* ── Footer: keycap logo left, domain right. No divider. ── */}
          <div style={{
            marginTop: 'auto',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <img
              src="/keeby-logo.webp"
              alt="Keeby"
              style={{ height: 72, width: 72, display: 'block' }}
            />
            <div style={{
              fontSize: 26, fontWeight: 600, color: '#1a1a1a',
              letterSpacing: '-0.02em',
            }}>
              getkeeby.com
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div
        className="mt-6 flex items-center gap-2"
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(8px)',
          transition: `opacity ${ANIM_MS}ms cubic-bezier(0.22, 1, 0.36, 1), transform ${ANIM_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={requestClose}
          className="rounded-full bg-white/90 px-5 py-2.5 text-[13px] font-semibold tracking-tight text-neutral-700 hover:bg-white"
        >
          Close
        </button>
        <button
          type="button"
          onClick={savePNG}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-full bg-gradient-to-b from-[#2a2a2a] to-[#0a0a0a] border border-white/[0.08] px-5 py-2.5 text-[13px] font-semibold tracking-tight text-white transition-shadow hover:shadow-lg active:scale-[0.98] disabled:opacity-60"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          <span>{saving ? 'Saving…' : 'Save as PNG'}</span>
        </button>
      </div>
    </div>,
    document.body,
  )
}

// Horizontal edge-to-edge line chart. X-axis is time — the line's first
// point sits exactly at x=0 (left edge) and its last point at x=width
// (right edge), no horizontal inset. Y-axis is WPM, gently inset top
// and bottom so the line never clips. No fill, no glow, no grid. Just
// the smooth orange trace with plain red X marks at error seconds.
function ShareChart({ series, errors, width, height }) {
  if (!series || series.length < 2) return null

  const yInset = 20

  const xs = series.map((s) => s.second)
  const ys = series.map((s) => s.wpm)
  const tMin = Math.min(...xs)
  const tMax = Math.max(...xs)

  // WPM range uses the actual spread for max visual variation; floor at 0
  // only when the test is nearly flat, otherwise the line would look dead.
  const yRange = Math.max(...ys) - Math.min(...ys)
  const wpmMin = yRange < 10 ? 0 : Math.max(0, Math.min(...ys) - 5)
  const wpmMax = Math.max(wpmMin + 10, Math.max(...ys) + 5)

  const sx = (second) => ((second - tMin) / Math.max(1, tMax - tMin)) * width
  const sy = (wpm) => yInset + (1 - (wpm - wpmMin) / (wpmMax - wpmMin)) * (height - yInset * 2)

  const pts = series.map((s) => [sx(s.second), sy(s.wpm)])

  // Catmull-Rom → cubic bezier smoothing. Works in 2D, axis swap is free.
  const pathD = (() => {
    const segs = [`M ${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)}`]
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] ?? pts[i]
      const p1 = pts[i]
      const p2 = pts[i + 1]
      const p3 = pts[i + 2] ?? p2
      const c1x = p1[0] + (p2[0] - p0[0]) / 6
      const c1y = p1[1] + (p2[1] - p0[1]) / 6
      const c2x = p2[0] - (p3[0] - p1[0]) / 6
      const c2y = p2[1] - (p3[1] - p1[1]) / 6
      segs.push(`C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}`)
    }
    return segs.join(' ')
  })()

  // Error scatter: x = second, y = number of errors made during that
  // second. Not aligned to the WPM line — the X marks live on their own
  // vertical scale so clustered errors rise visibly above lighter ones.
  const errorCountBySecond = {}
  for (const e of errors ?? []) {
    if (e.second < tMin || e.second > tMax) continue
    errorCountBySecond[e.second] = (errorCountBySecond[e.second] || 0) + 1
  }
  const errorSeconds = Object.keys(errorCountBySecond).map(Number).sort((a, b) => a - b)
  const maxErrorCount = Math.max(...Object.values(errorCountBySecond), 0)
  // Use at least 3 as the y-scale denominator so a single-error run
  // doesn't peg its X to the very top; it reads as "one mistake here"
  // rather than "maxed out".
  const errorYScale = Math.max(3, maxErrorCount)
  const errorY = (count) => yInset + (1 - count / errorYScale) * (height - yInset * 2)

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ display: 'block' }}
      aria-hidden="true"
    >
      {/* The trace. Single stroke, no fill, no glow. */}
      <path
        d={pathD}
        fill="none"
        stroke="#FF8C17"
        strokeWidth={8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Error X marks. x = errored second, y = per-second error count.
          Thicker strokes, tighter arms — reads as a punchy tally mark. */}
      {errorSeconds.map((sec) => {
        const cx = sx(sec)
        const cy = errorY(errorCountBySecond[sec])
        const arm = 7
        return (
          <g key={`err-${sec}`}>
            <line x1={cx - arm} y1={cy - arm} x2={cx + arm} y2={cy + arm} stroke="#E5484D" strokeWidth={6} strokeLinecap="round" />
            <line x1={cx + arm} y1={cy - arm} x2={cx - arm} y2={cy + arm} stroke="#E5484D" strokeWidth={6} strokeLinecap="round" />
          </g>
        )
      })}
    </svg>
  )
}

// Editorial stat cell for the stat strip. Consistent type scale across
// columns so the row reads as one typographic rhythm.
function StatCell({ label, value }) {
  return (
    <div style={{ padding: '16px 0' }}>
      <div style={{
        fontSize: 22, fontWeight: 700, color: '#888',
        textTransform: 'uppercase', letterSpacing: '-0.01em',
        marginBottom: 8,
      }}>
        {label}
      </div>
      <div style={{
        fontSize: 84, fontWeight: 800, color: '#1a1a1a',
        letterSpacing: '-0.07em', lineHeight: 0.9,
      }}>
        {value}
      </div>
    </div>
  )
}

// Switch brand swatch — a faithful web port of the macOS-menu skeuomorphic
// keycap glyph (see keycap.js / KeycapIcon.swift): a gradient-lit cap with a
// top-edge highlight, an embossed gradient "+" cross stem, and a hairline
// border. Used throughout Keeby (playground profile picker, pubmat keyboards).
function SwitchSwatch({ color, size = 28 }) {
  const thickness = Math.max(1.4, size * 0.13)
  const bar = size * 0.45
  const { bodyGradient, boxShadow, crossGradient } = keycapStyle(color)
  return (
    <span
      style={{
        position: 'relative',
        display: 'inline-block',
        flex: 'none',
        width: size,
        height: size,
        borderRadius: size * 0.22,
        background: bodyGradient,
        boxShadow,
      }}
      aria-hidden="true"
    >
      <span style={{
        position: 'absolute', left: '50%', top: '50%',
        transform: 'translate(-50%, -50%)',
        width: thickness, height: bar,
        background: crossGradient, borderRadius: thickness * 0.35,
      }} />
      <span style={{
        position: 'absolute', left: '50%', top: '50%',
        transform: 'translate(-50%, -50%)',
        width: bar, height: thickness,
        background: crossGradient, borderRadius: thickness * 0.35,
      }} />
    </span>
  )
}

function DoneView({ wpm, accuracy, exiting }) {
  // Entry stagger flows top-to-bottom. Exit reverses.
  const d = (inDelay, outDelay) => ({
    animationDelay: exiting ? `${outDelay}ms` : `${inDelay}ms`,
  })
  // Numbers get the stronger slide+blur animation; labels + CTA get the subtle one.
  const statCls = exiting ? 'ios-stat-out' : 'ios-stat-in'
  const softCls = exiting ? 'ios-blur-out' : 'ios-blur-in'

  return (
    <div className="text-center mt-4 sm:mt-6 md:mt-10">
      <div className="flex items-baseline justify-center gap-6 sm:gap-10 md:gap-16">
        <div>
          <div
            className={`text-8xl sm:text-9xl md:text-[11rem] font-extrabold text-neutral-900 leading-[0.9] ${statCls}`}
            style={{ letterSpacing: '-0.06em', ...d(0, 60) }}
          >
            {wpm}
          </div>
          <div
            className={`text-[11px] font-semibold tracking-tight text-neutral-600 mt-2 ${softCls}`}
            style={d(90, 20)}
          >
            WPM
          </div>
        </div>
        <div>
          <div
            className={`text-8xl sm:text-9xl md:text-[11rem] font-extrabold text-neutral-900 leading-[0.9] ${statCls}`}
            style={{ letterSpacing: '-0.06em', ...d(40, 30) }}
          >
            <span>{accuracy}</span>
            <span aria-hidden="true" className="text-neutral-600" style={{ letterSpacing: '-0.08em', marginLeft: '-0.05em' }}>%</span>
          </div>
          <div
            className={`text-[11px] font-semibold tracking-tight text-neutral-600 mt-2 ${softCls}`}
            style={d(130, 0)}
          >
            Accuracy
          </div>
        </div>
      </div>

    </div>
  )
}
