import { useState, useRef, useCallback, useEffect } from 'react'
import { capture } from './analytics.js'

const KINDS = [
  {
    id: 'bug',
    label: 'Bug',
    src: '/keeby-logo-bug.webp',
    placeholder: "What broke? Steps to reproduce help a ton.",
    aria: "Report a bug",
  },
  {
    id: 'feedback',
    label: 'Feedback',
    src: '/keeby-logo-feedback.webp',
    placeholder: "What's working, what isn't, what feels off?",
    aria: "Send feedback",
  },
  {
    id: 'idea',
    label: 'Idea',
    src: '/keeby-logo.webp',
    placeholder: "What should Keeby do that it doesn't yet?",
    aria: "Suggest an idea",
  },
]

const MIN_MESSAGE = 4
const MAX_MESSAGE = 4000
const MAX_IMAGE_BYTES = 3 * 1024 * 1024
const ALLOWED_IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

function FeedbackSection({ makePressHandlers, noopSetPressed, onCenterInView }) {
  const [kind, setKind] = useState('feedback')
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')
  const [website, setWebsite] = useState('') // honeypot
  const [status, setStatus] = useState('idle') // idle | sending | sent | error
  const [errorText, setErrorText] = useState('')
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [imageError, setImageError] = useState('')
  const textareaRef = useRef(null)
  const rootRef = useRef(null)
  const fileInputRef = useRef(null)

  const active = KINDS.find(k => k.id === kind) || KINDS[1]
  const trimmedLen = message.trim().length
  const canSubmit = trimmedLen >= MIN_MESSAGE && status !== 'sending'

  const onPickKind = useCallback((id) => {
    setKind(id)
    setStatus('idle')
    setErrorText('')
    onCenterInView?.({ target: 'heading' })
    requestAnimationFrame(() => textareaRef.current?.focus())
  }, [onCenterInView])

  // Mirrors TypingPlayground's recenter-on-keystroke. Fires on focus AND on
  // every input change, but with a visibility-ratio guard + cooldown so we
  // don't re-animate to the same spot on every keypress. If the user scrolls
  // a few hundred pixels off the section mid-typing, the next keystroke snaps
  // them back. Lock prevents wheel/touch from cancelling mid-animation.
  const lastCenterFiredAtRef = useRef(0)
  const requestRecenter = useCallback((target = 'form') => {
    if (!onCenterInView) return
    const root = rootRef.current
    if (!root || typeof window === 'undefined') {
      onCenterInView({ target, lock: true })
      return
    }
    const rect = root.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    const visibleW = Math.max(0, Math.min(vw, rect.right) - Math.max(0, rect.left))
    const visibleH = Math.max(0, Math.min(vh, rect.bottom) - Math.max(0, rect.top))
    const denom = (Math.min(rect.width, vw) || 1) * (Math.min(rect.height, vh) || 1)
    const ratio = (visibleW * visibleH) / denom
    if (ratio >= 0.99) return
    const now = Date.now()
    if (now - lastCenterFiredAtRef.current < 1200) return
    lastCenterFiredAtRef.current = now
    onCenterInView({ target, lock: true })
  }, [onCenterInView])

  const onFieldFocus = useCallback(() => requestRecenter('form'), [requestRecenter])
  const onMessageChange = useCallback((e) => {
    setMessage(e.target.value)
    requestRecenter('form')
  }, [requestRecenter])
  const onEmailChange = useCallback((e) => {
    setEmail(e.target.value)
    requestRecenter('form')
  }, [requestRecenter])

  useEffect(() => {
    if (status !== 'sent') return
    const t = setTimeout(() => {
      setMessage('')
      setEmail('')
      clearImage()
      setStatus('idle')
    }, 4500)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  // Image attach / remove. Object URLs are revoked when replaced or unmounted
  // so we don't leak memory across submissions.
  useEffect(() => {
    return () => { if (imagePreview) URL.revokeObjectURL(imagePreview) }
  }, [imagePreview])

  const acceptImage = useCallback((file) => {
    setImageError('')
    if (!file) return
    if (!ALLOWED_IMAGE_MIMES.has(file.type)) {
      setImageError('JPEG, PNG, WebP, or GIF only.')
      return
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setImageError('Image must be 3 MB or smaller.')
      return
    }
    setImageFile(file)
    setImagePreview(prev => {
      if (prev) URL.revokeObjectURL(prev)
      return URL.createObjectURL(file)
    })
  }, [])

  const onPickFile = useCallback((e) => {
    const file = e.target.files && e.target.files[0]
    acceptImage(file)
    // Reset value so picking the same file twice still fires onChange.
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [acceptImage])

  const clearImage = useCallback(() => {
    setImageFile(null)
    setImagePreview(prev => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
    setImageError('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [])

  // Paste-from-clipboard. Common screenshot flow on macOS: ⌘⇧4 then ⌘V into
  // the textarea. Only steal the paste when there's an image; let normal text
  // pastes through.
  const onTextareaPaste = useCallback((e) => {
    if (imageFile) return
    const items = e.clipboardData?.items
    if (!items) return
    for (const item of items) {
      if (item.type && item.type.startsWith('image/')) {
        const f = item.getAsFile()
        if (f) {
          e.preventDefault()
          acceptImage(f)
          return
        }
      }
    }
  }, [acceptImage, imageFile])

  const onSubmit = useCallback(async (e) => {
    e.preventDefault()
    if (!canSubmit) return
    setStatus('sending')
    setErrorText('')
    // Public sample: the production site POSTs this to a /api/feedback handler
    // that stores the message (and any screenshot) in Supabase. That backend
    // isn't included here, so we simulate a successful submit front-end only.
    await new Promise((resolve) => setTimeout(resolve, 500))
    capture('feedback_submitted', { kind, hasImage: !!imageFile })
    setStatus('sent')
  }, [canSubmit, kind, message, email, website, imageFile])

  return (
    <div ref={rootRef} className="mx-auto w-full max-w-[1040px] grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-16 items-center tracking-tight">
      {/* Left column: heading */}
      <div className="flex flex-col items-center md:items-start gap-3 text-center md:text-left">
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-[-1.5px] leading-[1.05] text-neutral-900">
          Found a bug?<br />Got an idea?
        </h2>
        <p className="text-[13px] sm:text-base text-neutral-600 max-w-sm text-balance">
          Pick a key. Type. Send the thock our way.
        </p>
      </div>

      {/* Right column: keycap row + form */}
      <form
        onSubmit={onSubmit}
        className="w-full flex flex-col gap-2.5"
        aria-busy={status === 'sending'}
      >
        <div
          className="flex items-end justify-center gap-3 sm:gap-4"
          role="radiogroup"
          aria-label="Feedback kind"
        >
          {KINDS.map((k) => {
            const isActive = k.id === kind
            const pressProps = makePressHandlers
              ? makePressHandlers(noopSetPressed, { thock: true })
              : {}
            return (
              <button
                key={k.id}
                type="button"
                role="radio"
                aria-checked={isActive}
                aria-label={k.aria}
                data-keeby-thock="true"
                {...pressProps}
                onClick={() => onPickKind(k.id)}
                className="group flex flex-col items-center gap-1.5 cursor-pointer select-none focus:outline-none tap-manipulation transition-transform duration-100 will-change-transform hover:scale-[0.96] active:scale-[0.9]"
              >
                <img
                  src={k.src}
                  alt=""
                  draggable={false}
                  width={192}
                  height={192}
                  className={`h-14 w-14 sm:h-16 sm:w-16 rounded-[16px] sm:rounded-[18px] pointer-events-none transition-[filter,opacity] duration-200 ease-out
                    ${isActive
                      ? 'grayscale-0 opacity-100'
                      : 'grayscale opacity-70 group-hover:opacity-90'
                    }`}
                />
                <span
                  className={`text-[11px] sm:text-[12px] font-semibold transition-colors duration-150
                    ${isActive ? 'text-neutral-900' : 'text-neutral-600 group-hover:text-neutral-700'}`}
                >
                  {k.label}
                </span>
              </button>
            )
          })}
        </div>

        {/* Honeypot */}
        <input
          type="text"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          className="absolute left-[-9999px] h-0 w-0 opacity-0"
        />

        <div className="relative">
          <textarea
            ref={textareaRef}
            data-keeby-sounds="true"
            value={message}
            onChange={onMessageChange}
            onFocus={onFieldFocus}
            onPaste={onTextareaPaste}
            placeholder={active.placeholder}
            maxLength={MAX_MESSAGE}
            rows={5}
            disabled={status === 'sending' || status === 'sent'}
            className="w-full resize-none rounded-2xl border border-black/[0.06] bg-white p-4 sm:p-5 text-[14px] leading-relaxed text-neutral-900 placeholder:text-neutral-400 outline-none transition-colors duration-150 focus:border-black/[0.12] disabled:opacity-60"
          />
          <span
            aria-hidden="true"
            className={`pointer-events-none absolute bottom-3 right-4 text-[11px] tabular-nums transition-colors duration-150 ${
              trimmedLen > MAX_MESSAGE - 200 ? 'text-orange-500' : 'text-neutral-500'
            }`}
          >
            {trimmedLen}/{MAX_MESSAGE}
          </span>
        </div>

        <input
          type="email"
          data-keeby-sounds="true"
          value={email}
          onChange={onEmailChange}
          onFocus={onFieldFocus}
          placeholder="Email (optional, recommended if you'd like a reply)"
          maxLength={200}
          disabled={status === 'sending' || status === 'sent'}
          className="w-full rounded-full border border-black/[0.06] bg-white px-5 py-3 text-[13px] text-neutral-900 placeholder:text-neutral-400 outline-none transition-colors duration-150 focus:border-black/[0.12] disabled:opacity-60"
        />

        {/* Image attach */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={onPickFile}
          className="sr-only"
          aria-hidden="true"
          tabIndex={-1}
        />
        {/* Attach UI — fixed 44px row, never wraps. Helper text is hidden
            when an image is attached (the pill communicates that state on
            its own) so the wider pill never pushes the helper to a new line. */}
        <div className="flex items-center gap-3 flex-nowrap min-h-[44px] min-w-0">
          {imagePreview ? (
            <div className="flex h-[44px] items-center gap-3 rounded-full border border-black/[0.06] bg-white pl-1.5 pr-3 min-w-0 max-w-full">
              <img
                src={imagePreview}
                alt="Attached screenshot preview"
                className="h-9 w-9 rounded-full object-cover shrink-0"
              />
              <span className="text-[12px] text-neutral-700 font-medium truncate min-w-0">
                {imageFile?.name || 'Screenshot'}
              </span>
              <button
                type="button"
                onClick={clearImage}
                aria-label="Remove image"
                className="shrink-0 inline-flex h-6 w-6 items-center justify-center rounded-full text-neutral-600 hover:bg-black/[0.04] hover:text-neutral-700 transition-colors duration-150 cursor-pointer"
              >
                <svg viewBox="0 0 16 16" className="h-3 w-3" aria-hidden="true">
                  <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={status === 'sending' || status === 'sent'}
                className="shrink-0 inline-flex h-[44px] items-center gap-2 rounded-full border border-black/[0.06] bg-white px-4 text-[12px] text-neutral-600 hover:text-neutral-900 hover:border-black/[0.12] transition-colors duration-150 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
              >
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.5 4.5L5.7 9.3a2 2 0 002.83 2.83l5.66-5.66a3.5 3.5 0 00-4.95-4.95L3.06 7.1a5 5 0 107.07 7.07L14.5 9.8" />
                </svg>
                Attach screenshot
              </button>
              <span className="text-[11px] text-neutral-600 truncate min-w-0">
                {imageError
                  ? <span className="text-orange-600">{imageError}</span>
                  : 'Optional · 3 MB max'}
              </span>
            </>
          )}
        </div>

        <div className="flex flex-col items-center gap-3 mt-6 sm:mt-8">
          <button
            type="submit"
            disabled={!canSubmit}
            className="group relative overflow-hidden inline-flex items-center justify-center gap-2 rounded-full border border-white/[0.08] bg-gradient-to-b from-[#2a2a2a] to-[#0a0a0a] px-10 py-4 text-[14px] font-semibold text-white min-w-[180px] transition-colors duration-500 ease-out hover:from-[#3a3a3a] hover:to-[#1a1a1a] hover:shadow-xl transition-shadow disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:from-[#2a2a2a] disabled:hover:to-[#0a0a0a] disabled:hover:shadow-none"
          >
            {status === 'sending' ? 'Sending…'
              : status === 'sent' ? 'Got it. Thanks!'
              : 'Send the thock'}
          </button>
          {/* Reserve 2 lines of height so swapping between status messages
              never causes layout shift. text-balance keeps wrapping graceful. */}
          <p className="text-[11px] text-neutral-600 w-full max-w-sm text-center leading-snug min-h-[2.75em] text-balance">
            {status === 'sent' ? (
              <span className="text-neutral-700">Message received.<br />We read every one.</span>
            ) : status === 'error' ? (
              <span className="text-orange-600">{errorText}</span>
            ) : trimmedLen > 0 && trimmedLen < MIN_MESSAGE ? (
              <span>A few more characters<br />before we can send it.</span>
            ) : (
              <span>No account needed.<br />We don't share your email.</span>
            )}
          </p>
        </div>
      </form>
    </div>
  )
}

export default FeedbackSection
