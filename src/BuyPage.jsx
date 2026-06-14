// Public sample: this is a static "Get Keeby for Windows" page.
//
// The production site runs a region-aware checkout here (PayMongo ₱199 for PH
// e-wallets, Polar in USD elsewhere) with email license-key delivery. None of
// that payment code ships in this public sample, so this page is purely a
// front-end download CTA that points at the live product.

const WINDOWS_DOWNLOAD = 'https://getkeeby.com/download/KeebySetup.msi'
const MAC_APP_STORE = 'https://apps.apple.com/us/app/keeby/id6760791739?mt=12'

export default function BuyPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-5 py-16">
      <article className="w-full max-w-[420px] text-center">
        <img
          src="/keeby-logo.webp"
          alt="Keeby"
          className="mx-auto mb-6 h-16 w-16 rounded-[16px] select-none"
        />
        <h1 className="text-3xl font-extrabold tracking-[-1.5px] leading-tight text-neutral-900 mb-2 md:text-4xl">
          Get Keeby for Windows
        </h1>
        <p className="text-[15px] text-neutral-600 mb-8">
          Lifetime license, activates on up to 2 devices.
        </p>

        <a
          href={WINDOWS_DOWNLOAD}
          className="inline-block w-full rounded-full bg-gradient-to-b from-[#2a2a2a] to-[#0a0a0a] border border-white/[0.08] px-6 py-4 text-[15px] font-semibold text-white tracking-tight cursor-pointer"
        >
          Download Keeby for Windows
        </a>

        <p className="mt-4 text-[13px] text-neutral-600 tracking-tight">
          On a Mac? Get it on the{' '}
          <a href={MAC_APP_STORE} className="font-semibold text-neutral-700 underline">
            Mac App Store
          </a>
          .
        </p>

        <p className="mt-10 text-[12px] text-neutral-400 leading-relaxed">
          Note: checkout and license delivery run on the live site, not in this
          public sample. Buttons here link to the real product.
        </p>
      </article>
    </div>
  )
}
