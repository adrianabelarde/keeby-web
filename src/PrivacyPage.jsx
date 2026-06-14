function PrivacyPage() {
  return (
    <article className="mx-auto max-w-[720px] px-5 py-16 md:px-10 md:py-24">
      <div className="mb-10">
        <h1 className="text-3xl font-extrabold tracking-[-1.5px] leading-tight text-neutral-900 mb-3 md:text-5xl">
          Privacy Policy
        </h1>
        <p className="text-sm text-neutral-600">Effective March 2026</p>
      </div>

      <p className="text-[15px] leading-relaxed text-neutral-600 mb-8">
        Keeby is a macOS menu bar app that plays mechanical keyboard sounds as you type.
        This policy explains how Keeby handles your data.{' '}
        <span className="text-neutral-700 font-medium">The short version: it doesn&rsquo;t.</span>
      </p>

      <div className="space-y-4">
        <div className="rounded-2xl border border-black/[0.04] bg-white p-6 md:p-8">
          <h2 className="text-[15px] font-bold text-neutral-900 mb-2">Input Monitoring</h2>
          <p className="text-[13px] leading-relaxed text-neutral-600">
            Keeby requests macOS Input Monitoring permission to detect when keyboard keys
            are pressed and released. This is used solely to trigger sound playback in real
            time.
          </p>
          <p className="text-[13px] leading-relaxed text-neutral-600 mt-3">
            Keeby does not read, record, or interpret the content of your keystrokes. It has
            no knowledge of what you type, only that a physical key event occurred.
          </p>
        </div>

        <div className="rounded-2xl border border-black/[0.04] bg-white p-6 md:p-8">
          <h2 className="text-[15px] font-bold text-neutral-900 mb-3">No Data Collection</h2>
          <p className="text-[13px] leading-relaxed text-neutral-600 mb-3">
            Keeby does not collect, store, or transmit:
          </p>
          <ul className="space-y-2 text-[13px] text-neutral-600">
            {[
              'Keystroke content, text, or passwords',
              'Typing patterns or statistics',
              'Personal information or identifiers',
              'Usage analytics or telemetry',
              'Crash reports or diagnostics',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-neutral-300" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-black/[0.04] bg-white p-6 md:p-8">
          <h2 className="text-[15px] font-bold text-neutral-900 mb-2">No Network Access</h2>
          <p className="text-[13px] leading-relaxed text-neutral-600">
            Keeby has no network capability. It makes no HTTP requests, connects to no
            servers, and sends no data anywhere. All processing happens entirely on your Mac.
          </p>
        </div>

        <div className="rounded-2xl border border-black/[0.04] bg-white p-6 md:p-8">
          <h2 className="text-[15px] font-bold text-neutral-900 mb-2">No Accounts or Tracking</h2>
          <p className="text-[13px] leading-relaxed text-neutral-600">
            Keeby has no user accounts, no sign-in, no cookies, no analytics SDKs, and no
            third-party tracking of any kind.
          </p>
        </div>

        <div className="rounded-2xl border border-black/[0.04] bg-white p-6 md:p-8">
          <h2 className="text-[15px] font-bold text-neutral-900 mb-2">Your Control</h2>
          <p className="text-[13px] leading-relaxed text-neutral-600">
            You can revoke Input Monitoring access at any time in System Settings&nbsp;&rarr;
            Privacy &amp; Security&nbsp;&rarr; Input Monitoring. Keeby will stop playing sounds
            but will otherwise continue to run normally.
          </p>
        </div>

        <div className="rounded-2xl border border-black/[0.04] bg-white p-6 md:p-8">
          <h2 className="text-[15px] font-bold text-neutral-900 mb-2">Contact</h2>
          <p className="text-[13px] leading-relaxed text-neutral-600">
            If you have questions about this privacy policy, contact{' '}
            <a
              href="https://abelarde.vercel.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-neutral-900 underline decoration-neutral-300 transition-colors hover:text-neutral-600"
            >
              Adrian Angelo Abelarde
            </a>
            .
          </p>
        </div>
      </div>
    </article>
  )
}

export default PrivacyPage
