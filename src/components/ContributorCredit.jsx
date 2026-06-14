/** Inline X credit — same link treatment as the Emir/Arc footer credits. */
export function ContributorCredit({ contributor, className = '' }) {
  if (!contributor) return null
  const { name, handle, profileUrl, avatar } = contributor
  const linkClass =
    'inline-flex items-center gap-1 align-middle text-neutral-600 underline decoration-neutral-300 hover:text-neutral-900 transition-colors'

  return (
    <a
      href={profileUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`${linkClass} ${className}`.trim()}
    >
      {avatar ? (
        <img src={avatar} alt={name} width={32} height={32} className="h-4 w-4 rounded-full object-cover" />
      ) : null}
      {name}
      <span className="text-neutral-600 font-normal">(@{handle})</span>
    </a>
  )
}

/** Share-card line: "samples by @handle" with profile URL linked. */
export function ContributorShareLine({ contributor }) {
  if (!contributor) return null
  const shortUrl = contributor.profileUrl.replace(/^https:\/\//, '')
  return (
    <>
      samples by{' '}
      <a
        href={contributor.profileUrl}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          color: '#FF8C17',
          fontWeight: 600,
          textDecoration: 'underline',
          textDecorationColor: 'rgba(255, 140, 23, 0.45)',
        }}
      >
        @{contributor.handle}
      </a>
      <span style={{ color: '#737373', fontWeight: 500 }}> · {shortUrl}</span>
    </>
  )
}
