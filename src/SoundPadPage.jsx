import SoundPad from './components/SoundPad.jsx'

/*
 * Standalone test page for the 2D Sound Pad. Mounted at /soundpad.
 * Background uses the site's body bg (#F5F5F5) plus three soft color blobs so
 * the dark liquid-glass card has something interesting to refract through its
 * backdrop-filter — on a flat color, a glass surface looks like flat plastic.
 */
export default function SoundPadPage() {
  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-[#F5F5F5] px-5">
      {/* Refraction-feeders. Wide, low-opacity radial blobs sit behind the
          card so the backdrop blur picks up gentle hue shifts as the user
          moves the cursor over the surface. Pointer events disabled so they
          never steal interactions from the pad. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 -left-32 h-[520px] w-[520px] rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(255,140,23,0.30) 0%, rgba(255,140,23,0) 65%)' }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-40 -right-32 h-[560px] w-[560px] rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(85,120,255,0.28) 0%, rgba(85,120,255,0) 65%)' }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(220,80,200,0.18) 0%, rgba(220,80,200,0) 65%)' }}
      />

      <div className="relative">
        <SoundPad />
      </div>
    </div>
  )
}
