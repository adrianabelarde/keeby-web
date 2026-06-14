function SupportPage() {
  return (
    <article className="mx-auto max-w-[720px] px-5 py-16 md:px-10 md:py-24">
      <div className="mb-10">
        <h1 className="text-3xl font-extrabold tracking-[-1.5px] leading-tight text-neutral-900 mb-3 md:text-5xl">
          Support
        </h1>
        <p className="text-sm text-neutral-600">Get help with Keeby</p>
      </div>

      <p className="text-[15px] leading-relaxed text-neutral-600 mb-8">
        Keeby is a fully local app with no network access, so most issues are related to macOS
        permissions.{' '}
        <span className="text-neutral-700 font-medium">
          Here are the most common questions and fixes.
        </span>
      </p>

      <div className="space-y-4">
        <div className="rounded-2xl border border-black/[0.04] bg-white p-6 md:p-8">
          <h2 className="text-[15px] font-bold text-neutral-900 mb-2">No sound playing</h2>
          <p className="text-[13px] leading-relaxed text-neutral-600">
            Keeby requires Input Monitoring permission to detect key presses. If you don&rsquo;t
            hear any sound, the permission may not be granted.
          </p>
          <p className="text-[13px] leading-relaxed text-neutral-600 mt-3">
            Open{' '}
            <span className="text-neutral-700 font-medium">
              System Settings&nbsp;&rarr; Privacy &amp; Security&nbsp;&rarr; Input Monitoring
            </span>{' '}
            and make sure Keeby is toggled on. You may need to restart the app after granting
            access.
          </p>
        </div>

        <div className="rounded-2xl border border-black/[0.04] bg-white p-6 md:p-8">
          <h2 className="text-[15px] font-bold text-neutral-900 mb-2">App not appearing</h2>
          <p className="text-[13px] leading-relaxed text-neutral-600">
            Keeby is a menu bar app. It lives in the top-right area of your screen, not in
            the Dock. Look for the Keeby icon in the menu bar after launching.
          </p>
          <p className="text-[13px] leading-relaxed text-neutral-600 mt-3">
            If you have many menu bar icons, Keeby may be hidden by the notch or other icons.
            Try holding{' '}
            <span className="text-neutral-700 font-medium">&#8984; (Command)</span>{' '}
            and dragging menu bar icons to rearrange them.
          </p>
        </div>

        <div className="rounded-2xl border border-black/[0.04] bg-white p-6 md:p-8">
          <h2 className="text-[15px] font-bold text-neutral-900 mb-2">Permission was revoked</h2>
          <p className="text-[13px] leading-relaxed text-neutral-600">
            If you previously granted Input Monitoring but later revoked it (or a macOS update
            reset it), Keeby will stop producing sound.
          </p>
          <p className="text-[13px] leading-relaxed text-neutral-600 mt-3">
            To re-grant access, go to{' '}
            <span className="text-neutral-700 font-medium">
              System Settings&nbsp;&rarr; Privacy &amp; Security&nbsp;&rarr; Input Monitoring
            </span>
            , find Keeby in the list, and toggle it back on. If it doesn&rsquo;t appear, remove
            it with the minus button, then reopen Keeby. It will prompt for permission
            again.
          </p>
        </div>

        <div className="rounded-2xl border border-black/[0.04] bg-white p-6 md:p-8">
          <h2 className="text-[15px] font-bold text-neutral-900 mb-2">Contact</h2>
          <p className="text-[13px] leading-relaxed text-neutral-600">
            If your issue isn&rsquo;t listed above, reach out to{' '}
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

export default SupportPage
