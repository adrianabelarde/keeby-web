import React, { useState, useEffect, useRef, useCallback, useId, lazy, Suspense } from 'react'
import { createPortal } from 'react-dom'
import { capture } from './analytics.js'
import { CircleCheckBig, SlidersHorizontal, Keyboard, LayoutGrid, Settings, XCircle, ChevronRight, EyeOff, ArrowDownToLine, Sparkles } from 'lucide-react'
import PrivacyPage from './PrivacyPage.jsx'
import SupportPage from './SupportPage.jsx'
import BuyPage from './BuyPage.jsx'
import { useOS } from './useOS.js'
import SoundPadPage from './SoundPadPage.jsx'
import { useThockCounter, useThockCount } from './useThockCounter.js'
import { useKeyboardSounds, EASTER_EGG_PROFILES, ALL_SWITCHES, HERO_PREVIEW_ONLY_SWITCH_IDS, isHeroTypableSwitch, useLastKey, subscribeLastKey, useMuted, setMuted } from './useKeyboardSounds.js'
import { setHeroSelection, useHeroSwitchIndex, useHeroProfileId } from './heroSelectionStore.js'
import { useVisualizerEnabled, setVisualizerEnabled } from './useVisualizerEnabled.js'
import {
  useHideSwitchPicker, setHideSwitchPicker,
  useAutoScrollPlayground, setAutoScrollPlayground,
  useZenMode, setZenMode,
  getAutoScrollPlayground,
} from './usePlaygroundPrefs.js'
import { hapticTap } from './useHaptics.js'
import NotchVisualizer from './components/NotchVisualizer.jsx'
import ArrowIndicator from './components/ArrowIndicator.jsx'

const TypingPlayground = lazy(() => import('./TypingPlayground.jsx'))
const FeedbackSection = lazy(() => import('./FeedbackSection.jsx'))
const SoundPad = lazy(() => import('./components/SoundPad.jsx'))
const Globe = lazy(() => import('./components/Globe.jsx'))

function LazySectionFallback() {
  return <div className="min-h-[1px]" aria-hidden="true" />
}

const APP_STORE = "https://apps.apple.com/us/app/keeby/id6760791739?mt=12"
const isPH = Intl.DateTimeFormat().resolvedOptions().timeZone === 'Asia/Manila'
const PRICE = isPH ? '₱199' : '$4.99'
const APP_LIVE = true
const EU_AVAILABILITY_LABEL = 'Now available in EU'
const menuPanelFrame = "relative isolate overflow-hidden rounded-[8px] sm:rounded-[12px] border border-white/12 bg-black/36 bg-clip-padding shadow-[0_18px_48px_rgba(0,0,0,0.34),inset_0_1px_0_rgba(255,255,255,0.08),inset_0_-1px_0_rgba(0,0,0,0.18)] backdrop-saturate-150"
const menuPanelBlurStyle = {
  backdropFilter: 'blur(44px) saturate(150%)',
  WebkitBackdropFilter: 'blur(44px) saturate(150%)',
}
const menuPanelMain = "bg-black/30"
const menuPanelSub = "bg-black/24"
const menuPanelGloss = "pointer-events-none absolute inset-0 rounded-[inherit] bg-[linear-gradient(180deg,rgba(255,255,255,0.10)_0%,rgba(255,255,255,0.04)_18%,rgba(255,255,255,0.015)_36%,rgba(255,255,255,0)_58%),radial-gradient(circle_at_top_left,rgba(255,255,255,0.06),transparent_40%)]"
const menuContent = "relative z-10 p-0.5 sm:p-1"
const menuSection = "px-2 pt-1 pb-px text-[9px] font-medium tracking-[0.02em] text-white/34 sm:px-2.5 sm:text-[10px]"
const menuDivider = "mx-2 my-[4px] h-px bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.14),transparent)] sm:my-[5px]"
// Hover uses a macOS-adjacent blue dark enough for WCAG AA with white 11px labels.
const menuRow = "menu-row flex min-h-5 select-none items-center gap-1.5 rounded-[6px] px-2 py-[2px] text-[11px] font-medium leading-none tracking-[-0.01em] text-white transition-colors duration-100 hover:bg-[#0056B3] hover:text-white sm:min-h-6 sm:gap-2 sm:px-2.5 sm:py-[3px] sm:text-[12px]"
const menuRowSelected = "bg-[#0056B3] text-white hover:bg-[#0056B3]"
const menuRowChecked = "bg-white/6"
// Disabled rows must never pick up the blue hover or the white text bump.
const menuRowDisabled = "text-white/44 hover:!bg-transparent hover:!text-white/44"
const menuShortcut = "ml-auto font-mono text-[9px] tracking-normal text-white sm:text-[10px]"
const menuBadge = "ml-auto rounded-[4px] bg-white/8 px-1.5 py-0.5 text-[7px] leading-none text-white/24 sm:text-[8px]"
const menuPreviewBadge = "ml-auto shrink-0 rounded-full bg-white/10 px-2.5 py-[3px] text-[8px] font-medium leading-none tracking-tight text-white/45 sm:px-3 sm:py-1 sm:text-[9px]"
const macBookInnerRadius = 'calc(var(--macbook-radius) - var(--macbook-bezel))'
const macBookTopRadiusStyle = {
  borderTopLeftRadius: 'var(--macbook-radius)',
  borderTopRightRadius: 'var(--macbook-radius)',
}
const macBookBottomRadiusStyle = {
  borderBottomLeftRadius: 'var(--macbook-radius)',
  borderBottomRightRadius: 'var(--macbook-radius)',
}
// Site-wide tap sound profile. /sibat-down.wav and /sibat-up.wav are the macOS
// app's "Sibat" (Crisp) preset — mouse_down_03 / mouse_up_03 — copied from
// Sources/Keeb/Resources/Sounds/. The filenames intentionally differ from the
// previous /click.wav so visitors don't get the old cached bytes back; the
// `cache: 'force-cache'` fetch below would otherwise replay the legacy click.
// Gains are tuned low so the sample reads as a soft thock rather than a pop.
const tapSoundConfig = {
  down: { src: '/sibat-down.wav', volume: 0.35 },
  up: { src: '/sibat-up.wav', volume: 0.22 },
}

// Switch ("thock") sound profile for the keeby-logo "tap to thock" buttons.
// /thock-down.wav and /thock-up.wav are NovelKeys Cream alpha samples
// (alpha_down_01 / alpha_up_01 from Sources/Keeb/Resources/Sounds/novelkeys-cream/).
// These are real keyboard-switch recordings, so logo presses sound like
// pressing a mech key instead of clicking a mouse — what the user expected.
const thockSoundConfig = {
  down: { src: '/thock-down.wav', volume: 0.55 },
  up: { src: '/thock-up.wav', volume: 0.4 },
}
const visualizerRows = [10, 10, 9, 8]

/* Hand-drawn laurel halves. Each SVG is already oriented for its side
   (left has the stem on its right edge, right mirrors that), so the
   render path never needs a CSS flip. Both share a 66x90 viewBox so
   sizing classes stay identical. */
const LAUREL_LEFT_PATH = "M65.0301 84.2036C64.9129 84.6528 64.5067 84.9536 64.0614 84.9536C63.9793 84.9536 63.8934 84.9419 63.8114 84.9224C60.7958 84.1411 57.9208 83.231 55.163 82.2115C55.0028 82.1646 54.8387 82.1099 54.6786 82.063C53.5028 84.0552 51.7255 85.7114 49.745 86.8833C45.5028 89.3989 40.5262 90.4731 35.64 89.7895C33.6986 89.52 28.8314 88.3793 27.9134 86.5825C27.2454 85.2739 28.4954 84.4302 29.39 83.6919C33.4955 80.3013 41.699 78.7505 46.925 79.2505L48.1945 79.4146C44.9172 78.0474 41.7922 76.313 38.8937 74.2584C37.6476 75.8639 35.4875 76.6217 33.5812 77.1256C27.5539 78.7154 19.9762 77.2584 14.6322 74.11C12.6517 72.942 7.32359 69.153 11.1283 66.9967C12.0306 66.485 13.5111 66.1217 14.5424 65.9498C20.0151 65.024 25.9994 65.9927 31.0114 68.2936L32.402 68.8561C32.402 68.8561 31.8551 68.3639 31.5817 68.1178C29.8005 66.528 28.1442 64.5748 26.6325 62.7428C26.1598 62.1686 25.7145 61.5592 25.2887 60.9498C24.8121 61.1139 24.4371 61.2857 23.9176 61.3717C23.316 61.4693 22.7145 61.5357 22.109 61.5787C20.9254 61.6607 19.7379 61.6373 18.5582 61.5201C16.1949 61.2818 13.8707 60.6607 11.7027 59.6959C9.18318 58.5748 6.87848 57.0045 4.86678 55.1256C2.89798 53.2858 0.925379 51.11 0.147979 48.4733C-0.0395212 47.8327 -0.0746812 47.1178 0.194854 46.5045C0.534694 45.735 1.29646 45.2272 2.09326 44.9576C3.29636 44.5514 4.61666 44.6061 5.85886 44.8678C8.07766 45.3287 10.2769 46.1959 12.2964 47.2037C17.2456 49.6725 20.9409 54.0084 20.9409 54.0084C20.9409 54.0084 20.8237 53.7076 20.726 53.5396C19.308 50.9888 16.1518 42.5826 16.1518 42.5826C12.8784 42.7389 9.60881 40.9146 7.23771 38.7388C5.37441 37.0318 3.89391 34.9458 2.71821 32.7193C1.52681 30.4654 0.495514 28.0162 0.237714 25.4615C0.116624 24.274 0.0775551 21.5592 0.690835 20.5592C1.76504 18.8092 4.08533 20.3248 5.21813 21.1998C8.51893 23.7428 11.9798 29.0709 13.9134 32.7738C14.1166 33.1645 14.4681 33.9613 14.4681 33.9613C14.4681 33.9613 14.4056 33.3715 14.3236 32.516C14.0423 30.5082 13.8705 28.641 13.7767 26.9457C13.5736 26.7426 13.3509 26.5707 13.1556 26.3286C10.6947 23.1919 10.5228 18.3052 10.5579 14.5046C10.5579 14.4342 10.5579 14.3639 10.5618 14.2936C10.5892 11.7584 10.7259 9.19981 11.3236 6.72721C11.8782 4.44201 12.9642 1.51631 15.1634 0.317012C15.6399 0.0552919 16.2064 -0.0775179 16.7376 0.0474821C17.4641 0.215452 18.0071 0.836542 18.3548 1.49668C20.515 5.59048 20.6126 10.3834 20.1595 14.8877C19.7649 18.833 18.8236 23.4502 15.9798 26.4147C15.9212 26.4733 15.8391 26.5553 15.7571 26.6373C15.8743 28.9459 16.1399 31.6139 16.6399 34.5162C17.1751 32.356 18.0188 30.2662 19.0461 28.2935C20.2375 26.0044 21.7063 23.8208 23.5149 21.9732C24.3508 21.1178 25.2688 20.3326 26.2766 19.688C27.4094 18.9615 28.7454 18.1489 30.1321 18.1763C30.5774 18.1842 31.0384 18.2935 31.3821 18.5709C31.679 18.8092 31.8704 19.1529 31.9993 19.5084C32.4681 20.8365 32.1243 22.3717 31.8196 23.6998C31.4993 25.106 31.0188 26.4732 30.4407 27.7896C29.2845 30.4146 27.718 32.8638 25.886 35.0708C24.6477 36.563 23.3118 37.9966 21.7571 39.1528C20.3821 40.1723 19.0579 40.9926 18.2376 41.4731C19.3314 45.2504 20.8704 49.2231 23.0188 53.1841C22.4446 47.5943 23.9133 41.6221 27.1477 37.0161C28.0383 35.7466 30.1282 33.1294 31.6789 32.8208C32.7062 32.6137 33.3859 32.8325 33.882 33.7817C34.8742 35.6645 34.3312 41.0239 33.9523 43.1606C33.0695 48.145 31.2023 52.6762 27.8781 56.5436C27.3195 57.1921 26.7492 57.7155 26.132 58.2545C28.5461 61.7428 31.4992 65.149 35.1164 68.3205C34.0344 65.2463 32.0539 58.2615 33.5539 51.6645C33.9914 49.7387 35.2687 46.0707 37.05 45.0395C37.8117 44.5981 38.8039 45.0239 39.3742 45.6098C42.3312 48.645 43.0656 57.0828 42.8351 61.1838C42.6476 64.4768 41.7062 69.0236 39.9913 71.8678C39.9523 71.9303 39.9015 71.9928 39.8585 72.0514C43.1593 74.3912 46.9054 76.5436 51.1515 78.4381C51.0031 78.2311 50.8625 78.0397 50.7765 77.9186C47.6124 73.6374 46.2453 66.9266 46.7257 61.6766C46.9093 59.6883 47.7335 55.0164 50.671 56.2586C53.4991 57.4539 55.4835 61.9852 56.2062 64.7938C57.4874 69.7665 57.2843 75.3558 55.3586 80.1608C58.1477 81.2116 61.1242 82.1647 64.3117 82.9889C64.8468 83.1256 65.1671 83.6725 65.0304 84.2077L65.0301 84.2036Z"
const LAUREL_RIGHT_PATH = "M0.0318909 84.2036C0.149081 84.6528 0.555331 84.9536 1.00064 84.9536C1.08267 84.9536 1.16861 84.9419 1.25064 84.9224C4.26624 84.1411 7.14124 83.231 9.89904 82.2115C10.0592 82.1646 10.2233 82.1099 10.3834 82.063C11.5592 84.0552 13.3365 85.7114 15.317 86.8833C19.5592 89.3989 24.5358 90.4731 29.422 89.7895C31.3634 89.52 36.2306 88.3793 37.1486 86.5825C37.8166 85.2739 36.5666 84.4302 35.672 83.6919C31.5665 80.3013 23.363 78.7505 18.137 79.2505L16.8675 79.4146C20.1448 78.0474 23.2698 76.313 26.1683 74.2584C27.4144 75.8639 29.5745 76.6217 31.4808 77.1256C37.5081 78.7154 45.0858 77.2584 50.4298 74.11C52.4103 72.942 57.7384 69.153 53.9337 66.9967C53.0314 66.485 51.5509 66.1217 50.5196 65.9498C45.0469 65.024 39.0626 65.9927 34.0506 68.2936L32.66 68.8561C32.66 68.8561 33.2069 68.3639 33.4803 68.1178C35.2615 66.528 36.9178 64.5748 38.4295 62.7428C38.9022 62.1686 39.3475 61.5592 39.7733 60.9498C40.2499 61.1139 40.6249 61.2857 41.1444 61.3717C41.746 61.4693 42.3475 61.5357 42.953 61.5787C44.1366 61.6607 45.3241 61.6373 46.5038 61.5201C48.8671 61.2818 51.1913 60.6607 53.3593 59.6959C55.8788 58.5748 58.1835 57.0045 60.1952 55.1256C62.164 53.2858 64.1366 51.11 64.914 48.4733C65.1015 47.8327 65.1367 47.1178 64.8672 46.5045C64.5273 45.735 63.7656 45.2272 62.9688 44.9576C61.7657 44.5514 60.4454 44.6061 59.2032 44.8678C56.9844 45.3287 54.7852 46.1959 52.7657 47.2037C47.8165 49.6725 44.1212 54.0084 44.1212 54.0084C44.1212 54.0084 44.2383 53.7076 44.336 53.5396C45.754 50.9888 48.9102 42.5826 48.9102 42.5826C52.1836 42.7389 55.4532 40.9146 57.8243 38.7388C59.6876 37.0318 61.1681 34.9458 62.3438 32.7193C63.5352 30.4654 64.5665 28.0162 64.8243 25.4615C64.9454 24.274 64.9845 21.5592 64.3712 20.5592C63.297 18.8092 60.9767 20.3248 59.8439 21.1998C56.5431 23.7428 53.0822 29.0709 51.1486 32.7738C50.9455 33.1645 50.5939 33.9613 50.5939 33.9613C50.5939 33.9613 50.6564 33.3715 50.7384 32.516C51.0197 30.5082 51.1915 28.641 51.2853 26.9457C51.4884 26.7426 51.7111 26.5707 51.9064 26.3286C54.3673 23.1919 54.5392 18.3052 54.5041 14.5046C54.5041 14.4342 54.5041 14.3639 54.5002 14.2936C54.4728 11.7584 54.3361 9.19981 53.7385 6.72721C53.1838 4.44201 52.0979 1.51631 49.8987 0.317012C49.4221 0.0552919 48.8556 -0.0775179 48.3244 0.0474821C47.5979 0.215452 47.055 0.836542 46.7073 1.49668C44.5471 5.59048 44.4495 10.3834 44.9026 14.8877C45.2971 18.833 46.2385 23.4502 49.0823 26.4147C49.1408 26.4733 49.2229 26.5553 49.3049 26.6373C49.1877 28.9459 48.9221 31.6139 48.4221 34.5162C47.8869 32.356 47.0432 30.2662 46.0159 28.2935C44.8245 26.0044 43.3557 23.8208 41.5471 21.9732C40.7112 21.1178 39.7932 20.3326 38.7854 19.688C37.6526 18.9615 36.3166 18.1489 34.9299 18.1763C34.4846 18.1842 34.0236 18.2935 33.6799 18.5709C33.383 18.8092 33.1916 19.1529 33.0627 19.5084C32.594 20.8365 32.9377 22.3717 33.2424 23.6998C33.5627 25.106 34.0432 26.4732 34.6213 27.7896C35.7775 30.4146 37.344 32.8638 39.176 35.0708C40.4143 36.563 41.7502 37.9966 43.3049 39.1528C44.6799 40.1723 46.0041 40.9926 46.8244 41.4731C45.7306 45.2504 44.1916 49.2231 42.0432 53.1841C42.6174 47.5943 41.1487 41.6221 37.9143 37.0161C37.0237 35.7466 34.9338 33.1294 33.3831 32.8208C32.3558 32.6137 31.6761 32.8325 31.18 33.7817C30.1878 35.6645 30.7308 41.0239 31.1097 43.1606C31.9925 48.145 33.8597 52.6762 37.1839 56.5436C37.7425 57.1921 38.3128 57.7155 38.93 58.2545C36.5159 61.7428 33.5628 65.149 29.9456 68.3205C31.0276 65.2463 33.0081 58.2615 31.5081 51.6645C31.0706 49.7387 29.7933 46.0707 28.012 45.0395C27.2503 44.5981 26.2581 45.0239 25.6878 45.6098C22.7308 48.645 21.9964 57.0828 22.2269 61.1838C22.4144 64.4768 23.3558 69.0236 25.0707 71.8678C25.1098 71.9303 25.1605 71.9928 25.2035 72.0514C21.9027 74.3912 18.1566 76.5436 13.9105 78.4381C14.0589 78.2311 14.1996 78.0397 14.2855 77.9186C17.4496 73.6374 18.8167 66.9266 18.3363 61.6766C18.1527 59.6883 17.3285 55.0164 14.391 56.2586C11.5629 57.4539 9.5785 61.9852 8.8558 64.7938C7.5746 69.7665 7.7777 75.3558 9.70346 80.1608C6.91436 81.2116 3.93786 82.1647 0.750359 82.9889C0.215199 83.1256 -0.105111 83.6725 0.0316086 84.2077L0.0318909 84.2036Z"

function Laurel({ side, className }) {
  return (
    <svg
      viewBox="0 0 66 90"
      className={className}
      aria-hidden="true"
      fill="currentColor"
    >
      <path d={side === 'right' ? LAUREL_RIGHT_PATH : LAUREL_LEFT_PATH} />
    </svg>
  )
}

/* #1 Top Paid laurel, tuned for the navbar. Text sized to match the
   center "thocks and counting" pill; laurels sit on either side so the
   mark reads as a medal. Hidden on mobile because the navbar is already
   dense there. */
function NavTopPaidLaurel() {
  return (
    <span
      className="group hidden cursor-default select-none items-center text-sm font-semibold tracking-tight text-neutral-600 transition-colors duration-300 ease-out group-hover:text-neutral-700 hover:text-neutral-700 sm:inline-flex"
      title="Currently #1 Top Paid on Mac App Store (Philippines)"
      aria-label="Number one Top Paid Apps on Mac App Store, Philippines"
    >
      <Laurel
        side="left"
        className="h-6 w-6 shrink-0 rotate-[10deg] text-neutral-400 transition-all duration-300 ease-out group-hover:-translate-x-1 group-hover:text-[#B8A160]"
      />
      <span>
        <span>#1</span> Top Paid Apps (PH)
      </span>
      <Laurel
        side="right"
        className="h-6 w-6 shrink-0 -rotate-[10deg] text-neutral-400 transition-all duration-300 ease-out group-hover:translate-x-1 group-hover:text-[#B8A160]"
      />
    </span>
  )
}

/* Visualizer with multiple simultaneous keys + ripple */
function VisualizerIllustration() {
  const [keys, setKeys] = useState({})

  useEffect(() => {
    const iv = setInterval(() => {
      const count = Math.random() > 0.5 ? 2 : 1
      const newKeys = {}
      for (let c = 0; c < count; c++) {
        const r = Math.floor(Math.random() * visualizerRows.length)
        const k = Math.floor(Math.random() * visualizerRows[r])
        newKeys[`${r}-${k}`] = Date.now() + c
      }
      setKeys(prev => ({ ...prev, ...newKeys }))
      setTimeout(() => {
        setKeys(prev => {
          const next = { ...prev }
          Object.keys(newKeys).forEach(k => delete next[k])
          return next
        })
      }, 350)
    }, 280)
    return () => clearInterval(iv)
  }, [])

  return (
    <div className="flex flex-col gap-[3px]">
      {visualizerRows.map((n, ri) => (
        <div key={ri} className="flex gap-[3px] justify-center">
          {Array(n).fill(0).map((_, ki) => {
            const id = `${ri}-${ki}`
            const isActive = id in keys
            return (
              <div
                key={ki}
                className="w-[10px] h-[10px] rounded-[2px] transition-all duration-150"
                style={{
                  background: isActive ? '#FF8C17' : '#e5e5e5',
                  boxShadow: isActive ? '0 0 8px rgba(255,140,23,0.5)' : 'none',
                  transform: isActive ? 'scale(1.2)' : 'scale(1)',
                }}
              />
            )
          })}
        </div>
      ))}
    </div>
  )
}

/* Three sine waves at different pitches, one highlighted */
function PitchIllustration() {
  const [offset, setOffset] = useState(0)
  useEffect(() => {
    let frame
    const tick = () => { setOffset(prev => prev + 0.03); frame = requestAnimationFrame(tick) }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])

  const makePath = (freq, amp, y, w = 240) => {
    const pts = []
    for (let x = 0; x <= w; x += 2) {
      const val = y + Math.sin((x * freq * 0.05) + offset) * amp
      pts.push(`${x === 0 ? 'M' : 'L'}${x},${val.toFixed(1)}`)
    }
    return pts.join(' ')
  }

  return (
    <svg width="100%" height="72" viewBox="0 0 240 72" preserveAspectRatio="none" fill="none">
      <path d={makePath(1.0, 10, 20, 240)} stroke="#e0e0e0" strokeWidth="2" strokeLinecap="round" fill="none" />
      <path d={makePath(1.4, 12, 36, 240)} stroke="#FF8C17" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.45" />
      <path d={makePath(0.7, 8, 52, 240)} stroke="#e0e0e0" strokeWidth="2" strokeLinecap="round" fill="none" />
    </svg>
  )
}

function LatencyIllustration() {
  const bolt = "24,0 4,32 18,32 14,60 44,22 28,22 32,0"
  return (
    <svg width="72" height="94" viewBox="-2 -2 52 64" fill="none">
      <polygon points={bolt} fill="#FF8C17" opacity="0.18" />
      <polygon points={bolt} fill="none" stroke="#FF8C17" strokeWidth="2" strokeLinejoin="miter" pathLength="100" strokeDasharray="18 82" opacity="0.5" className="animate-[latencyOrbit_2.6s_cubic-bezier(0.4,0,0.2,1)_infinite]" />
    </svg>
  )
}

const AppleIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.71 19.5C17.88 20.74 17 21.95 15.66 21.97C14.32 21.99 13.89 21.18 12.37 21.18C10.84 21.18 10.37 21.95 9.1 21.99C7.79 22.03 6.8 20.68 5.96 19.47C4.25 16.97 2.94 12.45 4.7 9.39C5.57 7.87 7.13 6.91 8.82 6.88C10.1 6.86 11.32 7.75 12.11 7.75C12.89 7.75 14.37 6.68 15.92 6.84C16.57 6.87 18.39 7.1 19.56 8.82C19.47 8.88 17.39 10.1 17.41 12.63C17.44 15.65 20.06 16.66 20.09 16.67C20.06 16.74 19.67 18.11 18.71 19.5ZM13 3.5C13.73 2.67 14.94 2.04 15.94 2C16.07 3.17 15.6 4.35 14.9 5.19C14.21 6.04 13.07 6.7 11.95 6.61C11.8 5.46 12.36 4.26 13 3.5Z" />
  </svg>
)

const WindowsIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M3 5.475L10.275 4.5V11.25H3V5.475ZM3 18.525L10.275 19.5V12.75H3V18.525ZM11.25 19.65L21 21V12.75H11.25V19.65ZM11.25 4.35V11.25H21V3L11.25 4.35Z" />
  </svg>
)

/* Dock icons */
const FinderIcon = () => (
  <svg viewBox="0 0 120 120" className="w-full h-full"><defs><linearGradient id="fg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#42A5F5"/><stop offset="100%" stopColor="#1565C0"/></linearGradient></defs><rect width="120" height="120" rx="26" fill="url(#fg)"/><path d="M38 36c0-3 2-5 5-5h34c3 0 5 2 5 5v48c0 3-2 5-5 5H43c-3 0-5-2-5-5V36z" fill="#fff" opacity="0.95"/><circle cx="52" cy="52" r="4" fill="#1565C0"/><circle cx="68" cy="52" r="4" fill="#1565C0"/><path d="M48 65c0 0 6 8 12 8s12-8 12-8" stroke="#1565C0" strokeWidth="3" fill="none" strokeLinecap="round"/><line x1="60" y1="42" x2="60" y2="72" stroke="#1565C0" strokeWidth="2" opacity="0.15"/></svg>
)
const SafariIcon = () => (
  <svg viewBox="0 0 120 120" className="w-full h-full"><defs><linearGradient id="sg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#64B5F6"/><stop offset="100%" stopColor="#1976D2"/></linearGradient></defs><rect width="120" height="120" rx="26" fill="url(#sg)"/><circle cx="60" cy="60" r="36" fill="none" stroke="#fff" strokeWidth="2.5" opacity="0.9"/><polygon points="60,30 70,50 90,60 70,70 60,90 50,70 30,60 50,50" fill="#fff" opacity="0.9"/><polygon points="60,60 70,50 90,60 70,70" fill="#E53935" opacity="0.85"/><polygon points="60,60 50,70 30,60 50,50" fill="#E53935" opacity="0.85"/></svg>
)
const MailIcon = () => (
  <svg viewBox="0 0 120 120" className="w-full h-full"><defs><linearGradient id="mg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#42A5F5"/><stop offset="100%" stopColor="#1E88E5"/></linearGradient></defs><rect width="120" height="120" rx="26" fill="url(#mg)"/><rect x="24" y="38" width="72" height="48" rx="6" fill="#fff" opacity="0.95"/><path d="M24 44l36 24 36-24" stroke="#1E88E5" strokeWidth="3" fill="none" strokeLinejoin="round"/></svg>
)
const MessagesIcon = () => (
  <svg viewBox="0 0 120 120" className="w-full h-full"><defs><linearGradient id="msg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#66BB6A"/><stop offset="100%" stopColor="#2E7D32"/></linearGradient></defs><rect width="120" height="120" rx="26" fill="url(#msg)"/><path d="M30 50c0-11 13-20 30-20s30 9 30 20-13 20-30 20c-4 0-8-.5-11-1.5L38 76l-1-10c-4-4-7-9-7-16z" fill="#fff" opacity="0.95"/></svg>
)
const MusicIcon = () => (
  <svg viewBox="0 0 120 120" className="w-full h-full"><defs><linearGradient id="mu" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#EC407A"/><stop offset="100%" stopColor="#E53935"/></linearGradient></defs><rect width="120" height="120" rx="26" fill="url(#mu)"/><path d="M72 36v38c0 7-5 12-12 12s-12-5-12-12 5-12 12-12c2 0 4 .5 6 1.5V36h6z" fill="#fff" opacity="0.95"/><path d="M72 36l-6 0v8l6-2V36z" fill="#fff" opacity="0.7"/></svg>
)
const SettingsIcon = () => (
  <svg viewBox="0 0 120 120" className="w-full h-full"><defs><linearGradient id="set" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#78909C"/><stop offset="100%" stopColor="#455A64"/></linearGradient></defs><rect width="120" height="120" rx="26" fill="url(#set)"/><circle cx="60" cy="60" r="16" fill="none" stroke="#fff" strokeWidth="5" opacity="0.9"/>{[0,45,90,135,180,225,270,315].map(a=>(<line key={a} x1={60+Math.cos(a*Math.PI/180)*24} y1={60-Math.sin(a*Math.PI/180)*24} x2={60+Math.cos(a*Math.PI/180)*32} y2={60-Math.sin(a*Math.PI/180)*32} stroke="#fff" strokeWidth="5" strokeLinecap="round" opacity="0.9"/>))}</svg>
)

const pubmatSwitches = [
  { brand: 'Gateron', name: 'Ink Black', color: '#333340' },
  { brand: 'Gateron', name: 'Ink Red', color: '#C74747' },
  { brand: 'Gateron', name: 'Turquoise Tealios', color: '#40BFB3' },
  { brand: 'Keychron', name: 'K2 Max · K Pro Red', color: '#C74747', selected: true },
  { brand: 'Durock', name: 'Alpaca', color: '#E6CCB3' },
  { brand: 'NovelKeys', name: 'Cream', color: '#F2E6CC' },
]

function HorizontalScroll({ panels, className, children }) {
  const containerRef = useRef(null)
  const viewportRef = useRef(null)
  const trackRef = useRef(null)
  const metricsRef = useRef({ maxTranslate: 0, start: 0 })
  const lastTranslateRef = useRef(0)
  const metricsRafRef = useRef(0)
  const [containerHeight, setContainerHeight] = useState(`${panels * 100}dvh`)

  const applyTranslate = useCallback((translateX) => {
    const track = trackRef.current
    if (!track) return

    const nextTranslate = Math.round(translateX * 1000) / 1000
    if (lastTranslateRef.current === nextTranslate) return

    lastTranslateRef.current = nextTranslate
    track.style.transform = `translate3d(-${nextTranslate}px, 0, 0)`
  }, [])

  const syncScrollPosition = useCallback(() => {
    const { maxTranslate, start } = metricsRef.current
    const scrollY = window.scrollY || window.pageYOffset
    const translateX = maxTranslate <= 0
      ? 0
      : Math.min(maxTranslate, Math.max(0, scrollY - start))

    applyTranslate(translateX)
  }, [applyTranslate])

  const updateMetrics = useCallback(() => {
    if (metricsRafRef.current) return
    metricsRafRef.current = requestAnimationFrame(() => {
      metricsRafRef.current = 0
      const container = containerRef.current
      const viewport = viewportRef.current
      const track = trackRef.current
      if (!container || !viewport || !track) return

      const viewportWidth = viewport.clientWidth || window.innerWidth
      const viewportHeight = viewport.clientHeight || window.innerHeight
      const maxTranslate = Math.max(0, track.scrollWidth - viewportWidth)
      const start = container.getBoundingClientRect().top + (window.scrollY || window.pageYOffset)

      metricsRef.current = { maxTranslate, start }
      setContainerHeight(`${viewportHeight + maxTranslate}px`)
      syncScrollPosition()
    })
  }, [syncScrollPosition])

  useEffect(() => {
    const resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => updateMetrics())
      : null

    if (viewportRef.current) resizeObserver?.observe(viewportRef.current)
    if (trackRef.current) resizeObserver?.observe(trackRef.current)

    window.addEventListener('scroll', syncScrollPosition, { passive: true })
    window.addEventListener('resize', updateMetrics)
    updateMetrics()

    return () => {
      resizeObserver?.disconnect()
      window.removeEventListener('scroll', syncScrollPosition)
      window.removeEventListener('resize', updateMetrics)
      if (metricsRafRef.current) cancelAnimationFrame(metricsRafRef.current)
    }
  }, [panels, syncScrollPosition, updateMetrics])

  return (
    <div ref={containerRef} data-hscroll-root="" className={`${className} relative`} style={{ height: containerHeight }}>
      <div ref={viewportRef} className="sticky top-0 h-[100dvh] w-full overflow-hidden">
        <div
          ref={trackRef}
          className="flex h-full"
          style={{
            transform: 'translate3d(0px, 0, 0)',
            backfaceVisibility: 'hidden',
            willChange: 'transform',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}

function AnimatedDigit({ digit }) {
  const [displayDigit, setDisplayDigit] = useState(digit)
  const [prevDigit, setPrevDigit] = useState(digit)
  const [key, setKey] = useState(0)

  useEffect(() => {
    if (digit !== displayDigit) {
      setPrevDigit(displayDigit)
      setDisplayDigit(digit)
      setKey(k => k + 1)
    }
  }, [digit])

  return (
    <span className="relative inline-flex w-[0.6em] h-[1em] overflow-hidden items-center justify-center" style={{ lineHeight: 1, top: '2px' }}>
      {/* Previous digit sliding out */}
      <span
        key={`prev-${key}`}
        className="absolute inset-0 flex items-center justify-center animate-slide-out-up"
      >
        {prevDigit}
      </span>
      {/* Current digit sliding in */}
      <span
        key={`curr-${key}`}
        className="absolute inset-0 flex items-center justify-center animate-slide-in-up"
      >
        {displayDigit}
      </span>
    </span>
  )
}

function AnimatedNumber({ value }) {
  const formatted = value.toLocaleString()

  return (
    <span className="inline-flex items-center">
      {formatted.split('').map((char, i) => (
        char === ',' ? (
          <span key={`sep-${i}`} className="w-[0.3em]">,</span>
        ) : (
          <AnimatedDigit key={`d-${i}-${formatted.length}`} digit={char} />
        )
      ))}
    </span>
  )
}

function BackdropPage() {
  return (
    <div className="fixed inset-0 w-screen h-screen overflow-hidden bg-[#F5F5F5]">
      <img
        src="/backdrop-tiktok.png"
        alt=""
        aria-hidden="true"
        className="w-full h-full object-cover select-none pointer-events-none"
        draggable="false"
      />
    </div>
  )
}

// Angry-Birds-style slingshot paper airplane, riding the Threads airplane trend.
// Pull back -> dotted trajectory projects the launch path (opposite direction).
// Release -> airplane follows a curved throw with a delayed fade, then fades
// back in at origin (no slide).
const LAUNCH_SCALE = 5          // flight distance = pull distance * this
const MIN_LAUNCH_PX = 18        // ignore tiny pulls (treated as a click, not a fling)
const LAUNCH_MS = 760
const FADE_IN_MS = 320
const PROJECTION_GAP_PX = 10                    // gap from cursor to where the projection line starts
const PROJECTION_STRETCH_FULL_PX = 120          // pull distance at which dash-stretch saturates
const PROJECTION_DASH_MIN = 0.5                 // dot-like at zero pull (linecap=round renders this as a round dot)
const PROJECTION_DASH_MAX = 14.5                // long dash once the pull is past PROJECTION_STRETCH_FULL_PX
const PROJECTION_GAP = 9                        // constant gap between dashes
const PROJECTION_STROKE_WIDTH = 3.6
const PROJECTION_COLOR = '#ff8c17'
// Trail mirrors the projection's dashed style so the after-flight ribbon visually
// rhymes with the pre-launch guide. Color stays gray (it's a "left behind"
// marker, not an action prompt) and the leading edge stops a small flight-
// progress gap before the plane's back so dashes don't crowd the airplane.
const TRAIL_DASH_MIN = PROJECTION_DASH_MIN
const TRAIL_DASH_MAX = PROJECTION_DASH_MAX
const TRAIL_GAP = PROJECTION_GAP
const TRAIL_STROKE_WIDTH = 2.8
const TRAIL_COLOR = '#9ca3af'
const TRAIL_NOSE_GAP_PROGRESS = 0.096           // ≈ 1.15 / 12, preserved from prior 12-dot layout
const TRAIL_SAMPLES = 32                        // polyline samples along the parabolic flight curve
const TRAIL_FADE_START = 0.6                    // earlier than FLIGHT_FADE_START so the trail dissipates first
const TRAIL_HEAD_OPACITY = 0.55                 // newest end (just behind plane)
const TRAIL_TAIL_OPACITY = 0                    // oldest end fades fully — the trail dissolves into nothing
const AIRPLANE_ICON_SIZE = 18
const AIRPLANE_VIEWBOX_SIZE = 24
const AIRPLANE_TIP_X = 22
const AIRPLANE_TIP_Y = 2
const AIRPLANE_TRAIL_ANCHOR_X = 11
const AIRPLANE_TRAIL_ANCHOR_Y = 13
// Tip in icon-local pixels — also where transformOrigin pivots, and the offset
// the portaled flying clone must subtract from `left`/`top` so its SVG tip
// lands exactly on `launch.originX/Y` (otherwise the trail draws against a
// phantom tip position and visibly misses the back of the plane).
const AIRPLANE_TIP_OFFSET_X = (AIRPLANE_TIP_X / AIRPLANE_VIEWBOX_SIZE) * AIRPLANE_ICON_SIZE
const AIRPLANE_TIP_OFFSET_Y = (AIRPLANE_TIP_Y / AIRPLANE_VIEWBOX_SIZE) * AIRPLANE_ICON_SIZE
const AIRPLANE_TIP_ORIGIN = `${AIRPLANE_TIP_OFFSET_X}px ${AIRPLANE_TIP_OFFSET_Y}px`
const FLIGHT_FADE_START = 0.78
const FLIGHT_SCALE_BASE = 1.22
const FLIGHT_SCALE_BOOST = 0.16
const DRAG_SCALE = 1.34
const FLIGHT_GRAVITY_MIN = 52
const FLIGHT_GRAVITY_MAX = 132
const FLIGHT_GRAVITY_FACTOR = 0.3
const FLYING_AIRPLANE_Z_INDEX = 2147483647

function getFlightPoint(launch, progress) {
  const startOffsetX = -launch.dx / LAUNCH_SCALE
  const startOffsetY = -launch.dy / LAUNCH_SCALE
  const travelX = launch.dx - startOffsetX
  const travelY = launch.dy - startOffsetY
  const flightDistance = Math.hypot(travelX, travelY)
  const gravity = Math.max(
    FLIGHT_GRAVITY_MIN,
    Math.min(FLIGHT_GRAVITY_MAX, flightDistance * FLIGHT_GRAVITY_FACTOR),
  )
  const x = startOffsetX + travelX * progress
  const y = startOffsetY + travelY * progress + gravity * progress * progress
  const velocityX = travelX
  const velocityY = travelY + 2 * gravity * progress
  const angle = (Math.atan2(velocityY, velocityX) * 180) / Math.PI

  return { x, y, angle }
}

function getAirplaneTrailAnchorOffset(angleDeg, scale) {
  const localDx = ((AIRPLANE_TRAIL_ANCHOR_X - AIRPLANE_TIP_X) / AIRPLANE_VIEWBOX_SIZE) * AIRPLANE_ICON_SIZE * scale
  const localDy = ((AIRPLANE_TRAIL_ANCHOR_Y - AIRPLANE_TIP_Y) / AIRPLANE_VIEWBOX_SIZE) * AIRPLANE_ICON_SIZE * scale
  const angleRad = (angleDeg * Math.PI) / 180
  const cos = Math.cos(angleRad)
  const sin = Math.sin(angleRad)

  return {
    x: localDx * cos - localDy * sin,
    y: localDx * sin + localDy * cos,
  }
}

function DragAirplane({ onGrab, onRelease }) {
  const [drag, setDrag] = useState(null)       // { originX, originY, x, y }
  const [launch, setLaunch] = useState(null)   // { originX, originY, dx, dy }
  const [phase, setPhase] = useState('idle')   // 'idle' | 'flying' | 'hidden' | 'reappearing'
  const [flightProgress, setFlightProgress] = useState(0)
  const ref = useRef(null)       // button element (for transform + event target)
  const svgRef = useRef(null)    // measure the svg directly for accurate tip coords
  const timers = useRef({})
  // Unique gradient IDs per instance — both hero pubmat versions render the airplane.
  const idSuffix = useId()
  const gradientId = `airplane-projection-${idSuffix}`
  const trailGradientId = `airplane-trail-${idSuffix}`

  const startDrag = (clientX, clientY) => {
    const measureEl = svgRef.current || ref.current
    if (!measureEl) return
    Object.values(timers.current).forEach(clearTimeout)
    setLaunch(null)
    setPhase('idle')
    setFlightProgress(0)
    // Compute tip in viewBox space, then map to screen via CTM so it's correct
    // regardless of button padding, stroke expansion, or SVG aspect-ratio quirks.
    let originX, originY
    if (svgRef.current && svgRef.current.createSVGPoint) {
      const pt = svgRef.current.createSVGPoint()
      pt.x = AIRPLANE_TIP_X // viewBox x of the airplane tip
      pt.y = AIRPLANE_TIP_Y // viewBox y of the airplane tip
      const screenPt = pt.matrixTransform(svgRef.current.getScreenCTM())
      originX = screenPt.x
      originY = screenPt.y
    } else {
      const rect = measureEl.getBoundingClientRect()
      originX = rect.left + rect.width * (AIRPLANE_TIP_X / AIRPLANE_VIEWBOX_SIZE)
      originY = rect.top + rect.height * (AIRPLANE_TIP_Y / AIRPLANE_VIEWBOX_SIZE)
    }
    setDrag({ originX, originY, x: clientX, y: clientY })
    onGrab?.()
  }

  useEffect(() => {
    if (!drag) return
    // rAF-throttle pointer updates so we only re-render once per frame even on
    // high-refresh displays. Keeps the drag buttery smooth.
    let pending = null
    let rafId = null
    const flush = () => {
      rafId = null
      if (!pending) return
      const { x, y } = pending
      pending = null
      setDrag((d) => (d ? { ...d, x, y } : d))
    }
    const onMove = (e) => {
      const p = e.touches ? e.touches[0] : e
      pending = { x: p.clientX, y: p.clientY }
      if (rafId == null) rafId = requestAnimationFrame(flush)
      if (e.cancelable) e.preventDefault()
    }
    const onUp = () => {
      if (rafId != null) { cancelAnimationFrame(rafId); rafId = null }
      setDrag((d) => {
        if (!d) return null
        const pullDx = d.x - d.originX
        const pullDy = d.y - d.originY
        const pullDist = Math.hypot(pullDx, pullDy)
        if (pullDist < MIN_LAUNCH_PX) {
          onRelease?.()
          return null
        }
        // Slingshot: launch opposite the pull direction.
        const launchDx = -pullDx * LAUNCH_SCALE
        const launchDy = -pullDy * LAUNCH_SCALE
        // Keep origin in launch state so the trail can render during 'flying'
        // (drag is cleared at this point).
        setFlightProgress(0)
        setLaunch({ originX: d.originX, originY: d.originY, dx: launchDx, dy: launchDy })
        setPhase('flying')
        // After flight, snap-hide at origin (no sliding back), then fade in.
        timers.current.hide = setTimeout(() => {
          setLaunch(null)
          setPhase('hidden')
          // One tick to apply the hidden (origin + invisible) state, then fade in.
          timers.current.reappear = setTimeout(() => setPhase('reappearing'), 30)
          timers.current.idle = setTimeout(() => setPhase('idle'), 30 + FADE_IN_MS)
        }, LAUNCH_MS)
        onRelease?.()
        return null
      })
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    window.addEventListener('touchmove', onMove, { passive: false })
    window.addEventListener('touchend', onUp)
    return () => {
      if (rafId != null) cancelAnimationFrame(rafId)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onUp)
    }
  }, [drag, onRelease])

  useEffect(() => () => Object.values(timers.current).forEach(clearTimeout), [])

  useEffect(() => {
    if (typeof document === 'undefined') return
    const shouldLockScroll = Boolean(drag) || phase === 'flying'
    if (!shouldLockScroll) return

    const { documentElement, body } = document
    const previousHtmlOverflowX = documentElement.style.overflowX
    const previousBodyOverflowX = body.style.overflowX
    const previousHtmlOverscrollX = documentElement.style.overscrollBehaviorX
    const previousBodyOverscrollX = body.style.overscrollBehaviorX

    documentElement.style.overflowX = 'clip'
    body.style.overflowX = 'clip'
    documentElement.style.overscrollBehaviorX = 'none'
    body.style.overscrollBehaviorX = 'none'

    return () => {
      documentElement.style.overflowX = previousHtmlOverflowX
      body.style.overflowX = previousBodyOverflowX
      documentElement.style.overscrollBehaviorX = previousHtmlOverscrollX
      body.style.overscrollBehaviorX = previousBodyOverscrollX
    }
  }, [drag, phase])

  useEffect(() => {
    if (phase !== 'flying' || !launch) {
      setFlightProgress(0)
      return
    }

    let rafId = null
    const startedAt = performance.now()

    const tick = (now) => {
      const nextProgress = Math.min((now - startedAt) / LAUNCH_MS, 1)
      setFlightProgress(nextProgress)
      if (nextProgress < 1) rafId = requestAnimationFrame(tick)
    }

    rafId = requestAnimationFrame(tick)
    return () => {
      if (rafId != null) cancelAnimationFrame(rafId)
    }
  }, [phase, launch])

  // Style per phase. Idle opacity 0.4 matches the click-me svg's opacity-40.
  let transform = 'none'
  let transition = 'none'
  let opacity = 0.4
  let filter = 'none'
  let color = undefined

  const currentFlight = phase === 'flying' && launch ? getFlightPoint(launch, flightProgress) : null

  if (drag) {
    const dx = drag.x - drag.originX
    const dy = drag.y - drag.originY
    // Nose points toward launch direction (opposite of pull). +45deg because the
    // SVG nose rests at up-right (45deg).
    const angle = (Math.atan2(-dy, -dx) * 180) / Math.PI + 45
    transform = `translate(${dx}px, ${dy}px) rotate(${angle}deg) scale(${DRAG_SCALE})`
    transition = 'none'
    opacity = 1
    color = '#000'
  } else if (currentFlight) {
    const scale = FLIGHT_SCALE_BASE + Math.sin(flightProgress * Math.PI) * FLIGHT_SCALE_BOOST
    const fadeProgress = flightProgress <= FLIGHT_FADE_START
      ? 1
      : Math.max(0, 1 - ((flightProgress - FLIGHT_FADE_START) / (1 - FLIGHT_FADE_START)))
    transform = `translate(${currentFlight.x}px, ${currentFlight.y}px) rotate(${currentFlight.angle + 45}deg) scale(${scale})`
    transition = 'none'
    opacity = fadeProgress
    filter = 'none'
    color = '#000'
  } else if (phase === 'hidden') {
    // Snap to origin invisibly (no slide-back). Seed blur here so the
    // reappear phase has something to animate out from.
    transform = 'none'
    transition = 'none'
    opacity = 0
    filter = 'blur(8px)'
  } else if (phase === 'reappearing') {
    // Fade + blur in to the idle opacity (matches click-me svg's opacity-40).
    transform = 'none'
    transition = `opacity ${FADE_IN_MS}ms ease-out, filter ${FADE_IN_MS}ms ease-out`
    opacity = 0.4
    filter = 'blur(0)'
  }

  const viewportWidth = typeof window === 'undefined' ? 0 : window.innerWidth
  const viewportHeight = typeof window === 'undefined' ? 0 : window.innerHeight

  // Projection follows the airplane's dragged tip so the guide stays centered on
  // the icon instead of being pinned to the resting origin. As the pull grows,
  // the dash pattern smoothly stretches from dot-like (small pull) to longer
  // dashes (committed pull), so the trajectory visually "loads up".
  const projection = drag ? (() => {
    const launchDx = -(drag.x - drag.originX)
    const launchDy = -(drag.y - drag.originY)
    const launchDist = Math.hypot(launchDx, launchDy)
    if (launchDist === 0) return null

    const unitX = launchDx / launchDist
    const unitY = launchDy / launchDist
    const projectionLength = launchDist * (LAUNCH_SCALE / 2)

    const x1 = drag.x + unitX * PROJECTION_GAP_PX
    const y1 = drag.y + unitY * PROJECTION_GAP_PX
    const x2 = drag.x + unitX * (PROJECTION_GAP_PX + projectionLength)
    const y2 = drag.y + unitY * (PROJECTION_GAP_PX + projectionLength)

    const stretch = Math.min(1, launchDist / PROJECTION_STRETCH_FULL_PX)
    const dashLength = PROJECTION_DASH_MIN + stretch * (PROJECTION_DASH_MAX - PROJECTION_DASH_MIN)

    return { x1, y1, x2, y2, dashLength }
  })() : null

  const trail = phase === 'flying' && launch ? (() => {
    const visibleProgress = Math.max(0, flightProgress - TRAIL_NOSE_GAP_PROGRESS)
    if (visibleProgress <= 0) return null

    // Recover the original pull distance from the launch vector so the trail's
    // dash length matches the dashed projection that was shown during drag.
    const pullDist = Math.hypot(launch.dx, launch.dy) / LAUNCH_SCALE
    const stretch = Math.min(1, pullDist / PROJECTION_STRETCH_FULL_PX)
    const dashLength = TRAIL_DASH_MIN + stretch * (TRAIL_DASH_MAX - TRAIL_DASH_MIN)

    // Smooth global fade-out across the latter part of the flight, so when the
    // plane reaches the end and disappears, the trail is already nearly gone
    // — instead of vanishing in lock-step with the plane.
    const fade = flightProgress <= TRAIL_FADE_START
      ? 1
      : Math.max(0, 1 - ((flightProgress - TRAIL_FADE_START) / (1 - TRAIL_FADE_START)))

    let d = ''
    let firstX = 0, firstY = 0, lastX = 0, lastY = 0
    for (let i = 0; i <= TRAIL_SAMPLES; i++) {
      const t = (i / TRAIL_SAMPLES) * visibleProgress
      const point = getFlightPoint(launch, t)
      const scale = FLIGHT_SCALE_BASE + Math.sin(t * Math.PI) * FLIGHT_SCALE_BOOST
      const offset = getAirplaneTrailAnchorOffset(point.angle + 45, scale)
      const x = launch.originX + point.x + offset.x
      const y = launch.originY + point.y + offset.y
      if (i === 0) {
        firstX = x; firstY = y
        d = `M${x.toFixed(2)} ${y.toFixed(2)}`
      } else {
        d += ` L${x.toFixed(2)} ${y.toFixed(2)}`
      }
      lastX = x; lastY = y
    }

    return { d, dashLength, fade, startX: firstX, startY: firstY, endX: lastX, endY: lastY }
  })() : null

  return (
    <>
      <button
        ref={ref}
        type="button"
        aria-label="Paper airplane — pull back and release to launch"
        onMouseDown={(e) => { e.preventDefault(); startDrag(e.clientX, e.clientY) }}
        onTouchStart={(e) => { e.preventDefault(); const t = e.touches[0]; startDrag(t.clientX, t.clientY) }}
        className="relative z-20 select-none cursor-grab active:cursor-grabbing touch-none text-[#1e1e1e]"
        style={{
          transform,
          transition,
          opacity: currentFlight ? 0 : opacity,
          filter,
          color,
          pointerEvents: currentFlight ? 'none' : undefined,
          willChange: 'transform, opacity, filter, color',
          transformOrigin: AIRPLANE_TIP_ORIGIN,
        }}
      >
        <svg
          ref={svgRef}
          width={AIRPLANE_ICON_SIZE}
          height={AIRPLANE_ICON_SIZE}
          viewBox={`0 0 ${AIRPLANE_VIEWBOX_SIZE} ${AIRPLANE_VIEWBOX_SIZE}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M22 2 11 13" />
          <path d="M22 2 15 22l-4-9-9-4 20-7z" />
        </svg>
      </button>

      {currentFlight && typeof document !== 'undefined' && createPortal(
        <div
          aria-hidden="true"
          className="pointer-events-none"
          style={{
            position: 'fixed',
            // Subtract the tip's offset within the SVG so the SVG's nose lands
            // exactly on (launch.originX, launch.originY) — same point the trail
            // dot math projects from — keeping the trail centered on the back.
            left: launch.originX - AIRPLANE_TIP_OFFSET_X,
            top: launch.originY - AIRPLANE_TIP_OFFSET_Y,
            zIndex: FLYING_AIRPLANE_Z_INDEX,
            transform,
            transition,
            opacity,
            filter,
            color,
            willChange: 'transform, opacity, filter, color',
            transformOrigin: AIRPLANE_TIP_ORIGIN,
          }}
        >
          <svg
            width={AIRPLANE_ICON_SIZE}
            height={AIRPLANE_ICON_SIZE}
            viewBox={`0 0 ${AIRPLANE_VIEWBOX_SIZE} ${AIRPLANE_VIEWBOX_SIZE}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M22 2 11 13" />
            <path d="M22 2 15 22l-4-9-9-4 20-7z" />
          </svg>
        </div>,
        document.body,
      )}

      {drag && projection && typeof document !== 'undefined' && createPortal(
        // Portaled to <body> so the overlay uses raw viewport coordinates even
        // inside transformed ancestors, and give it an explicit viewBox so the
        // SVG's coordinate space matches screen pixels exactly.
        <svg
          className="pointer-events-none"
          width={viewportWidth}
          height={viewportHeight}
          viewBox={`0 0 ${viewportWidth} ${viewportHeight}`}
          style={{
            position: 'fixed',
            inset: 0,
            width: '100vw',
            height: '100vh',
            zIndex: 19,
          }}
        >
          <defs>
            <linearGradient
              id={gradientId}
              gradientUnits="userSpaceOnUse"
              x1={projection.x1}
              y1={projection.y1}
              x2={projection.x2}
              y2={projection.y2}
            >
              <stop offset="0%" stopColor={PROJECTION_COLOR} stopOpacity="0.95" />
              <stop offset="100%" stopColor={PROJECTION_COLOR} stopOpacity="0.4" />
            </linearGradient>
          </defs>
          <line
            x1={projection.x1}
            y1={projection.y1}
            x2={projection.x2}
            y2={projection.y2}
            stroke={`url(#${gradientId})`}
            strokeWidth={PROJECTION_STROKE_WIDTH}
            strokeLinecap="round"
            strokeDasharray={`${projection.dashLength} ${PROJECTION_GAP}`}
          />
        </svg>,
        document.body,
      )}

      {phase === 'flying' && trail && typeof document !== 'undefined' && createPortal(
        // Throw trail: dashed gray ribbon traced along the exact same curved
        // flight path as the airplane. Mirrors the projection's dashed style so
        // the pre-launch guide and the post-launch ribbon visually rhyme. Path
        // grows from t=0 to t=visibleProgress each frame, so dashes "leave
        // behind" the plane as it flies. Old end fades faintly, new end stays
        // closer to full.
        <svg
          className="pointer-events-none"
          width={viewportWidth}
          height={viewportHeight}
          viewBox={`0 0 ${viewportWidth} ${viewportHeight}`}
          style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', zIndex: FLYING_AIRPLANE_Z_INDEX - 1 }}
        >
          <defs>
            <linearGradient
              id={trailGradientId}
              gradientUnits="userSpaceOnUse"
              x1={trail.startX}
              y1={trail.startY}
              x2={trail.endX}
              y2={trail.endY}
            >
              <stop offset="0%" stopColor={TRAIL_COLOR} stopOpacity={TRAIL_TAIL_OPACITY} />
              <stop offset="100%" stopColor={TRAIL_COLOR} stopOpacity={TRAIL_HEAD_OPACITY} />
            </linearGradient>
          </defs>
          <path
            d={trail.d}
            fill="none"
            stroke={`url(#${trailGradientId})`}
            strokeWidth={TRAIL_STROKE_WIDTH}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={`${trail.dashLength} ${TRAIL_GAP}`}
            opacity={trail.fade}
          />
        </svg>,
        document.body,
      )}
    </>
  )
}

function PubmatPage() {
  const pubmatRef = useRef(null)
  const coverRef = useRef(null)
  const phRef = useRef(null)
  const numberOneRef = useRef(null)
  const thumbRef = useRef(null)
  const exportAs = async (ref, filename) => {
    const { toPng } = await import('html-to-image')
    const dataUrl = await toPng(ref.current, { pixelRatio: 2 })
    const link = document.createElement('a')
    link.download = filename
    link.href = dataUrl
    link.click()
  }
  return (
    <div className="flex flex-col items-center justify-center py-10 px-4 bg-[#F5F5F5] min-h-screen gap-6">
      <p className="text-[18px] font-bold text-[#1a1a1a]">Facebook Post (1080x1080)</p>
      <button onClick={() => exportAs(pubmatRef, 'keeby-pubmat.png')} className="px-6 py-2.5 bg-gradient-to-b from-[#2a2a2a] to-[#0a0a0a] text-white rounded-full text-[14px] font-semibold cursor-pointer border-none shadow-md hover:shadow-lg transition-shadow">
        Export as PNG
      </button>
      <div ref={pubmatRef} className="relative w-[1080px] h-[1080px] bg-[#F5F5F5] flex items-center justify-center gap-12 px-20 overflow-hidden rounded-2xl outline outline-1 outline-black/[0.08]">
        {/* Subtle glow */}
        <div className="absolute -top-[200px] -right-[100px] w-[600px] h-[600px] bg-[radial-gradient(circle,rgba(255,140,23,0.08)_0%,transparent_70%)] pointer-events-none" />

        {/* Left */}
        <div className="flex flex-col gap-8 max-w-[580px] z-10">
          <img src="/logo-text.webp" alt="Keeby" className="h-12 w-auto shrink-0 object-contain self-start" />
          <h1 className="text-[56px] font-extrabold text-[#1a1a1a] tracking-[-2px] leading-[1.1]">
            Your keyboard,<br />but better.
          </h1>
          <p className="text-[24px] text-[#888] leading-relaxed max-w-[480px]">
            Mechanical keyboard sounds for your Mac. Real recordings, not synthesized.
          </p>
          <div className="flex items-center gap-3 bg-gradient-to-b from-[#2a2a2a] to-[#0a0a0a] text-white rounded-[14px] px-8 py-4 text-[18px] font-medium w-fit shadow-[0_4px_16px_rgba(0,0,0,0.15)]">
            <svg width="24" height="24" viewBox="0 0 17 20" fill="white"><path d="M12.15 0c.12 1.17-.35 2.33-1.05 3.17-.71.84-1.85 1.5-2.97 1.41-.14-1.13.36-2.33 1.03-3.07C9.87.67 11.06.06 12.15 0zm3.56 6.82c-.09.05-2.12 1.22-2.1 3.63.02 2.88 2.54 3.87 2.57 3.88-.02.07-.4 1.37-1.33 2.72-.82 1.17-1.67 2.34-3.01 2.36-1.32.02-1.74-.78-3.25-.78s-1.99.76-3.24.8c-1.29.04-2.27-1.27-3.1-2.43C.55 14.72-.73 10.2 1.03 7.14c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.49.87 3.27.87.78 0 2.24-1.07 3.77-.91.64.03 2.45.26 3.61 1.95l-.09.08z"/></svg>
            Available on the Mac App Store
          </div>
          <p className="text-[16px] text-[#999] -mt-3">₱199 one-time purchase</p>
        </div>

        {/* Right */}
        <div className="flex items-start gap-5 z-10">
          <img src="/keeby-logo.webp" alt="Keeby" className="w-20 h-20 rounded-[20px] shadow-lg" />
          <div className="w-[260px] rounded-[14px] p-2.5 border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.08)]" style={{ background: 'linear-gradient(165deg, rgba(40,40,45,0.95) 0%, rgba(10,10,12,0.95) 100%)' }}>
            {pubmatSwitches.map((s, i) => (
              <div key={s.name}>
                {(i === 0 || pubmatSwitches[i - 1].brand !== s.brand) && (
                  <div className="px-3 pt-2 pb-0.5 text-[12px] font-medium text-white/30 tracking-wide">{s.brand}</div>
                )}
                <div className={`flex items-center gap-2.5 px-3 py-[6px] rounded-[7px] text-[14px] font-medium text-white/90 ${s.selected ? 'bg-white/[0.06]' : ''}`}>
                  <div className="flex h-[16px] w-[16px] items-center justify-center rounded-[4px] text-[10px] font-bold text-white/80" style={{ backgroundColor: s.color, color: 'rgba(0,0,0,0.5)' }}>+</div>
                  <span>{s.name}</span>
                  {s.selected && <span className="ml-auto text-white/60 text-[15px]">✓</span>}
                </div>
                {i < pubmatSwitches.length - 1 && pubmatSwitches[i + 1]?.brand !== s.brand && (
                  <div className="mx-3 my-1 h-px bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.12),transparent)]" />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Facebook Cover (820x312) */}
      <p className="text-[18px] font-bold text-[#1a1a1a] mt-10">Facebook Cover (820x312)</p>
      <button onClick={() => exportAs(coverRef, 'keeby-fb-cover.png')} className="px-6 py-2.5 bg-gradient-to-b from-[#2a2a2a] to-[#0a0a0a] text-white rounded-full text-[14px] font-semibold cursor-pointer border-none shadow-md hover:shadow-lg transition-shadow">
        Export as PNG
      </button>
      <div ref={coverRef} className="relative w-[820px] h-[312px] bg-[#F5F5F5] flex items-center justify-center gap-12 px-16 overflow-hidden outline outline-1 outline-black/[0.08]">
        <div className="absolute -top-[100px] -right-[50px] w-[400px] h-[400px] bg-[radial-gradient(circle,rgba(255,140,23,0.06)_0%,transparent_70%)] pointer-events-none" />

        {/* Left */}
        <div className="flex flex-col gap-3 max-w-[420px] z-10">
          <img src="/logo-text.webp" alt="Keeby" className="h-9 w-auto shrink-0 object-contain self-start" />
          <h1 className="text-[28px] font-extrabold text-[#1a1a1a] tracking-[-1px] leading-[1.1]">
            Your keyboard,<br />but better.
          </h1>
          <p className="text-[13px] text-[#888] leading-relaxed">
            Mechanical keyboard sounds for your Mac. Real recordings, not synthesized.
          </p>
          <div className="flex items-center gap-2 bg-gradient-to-b from-[#2a2a2a] to-[#0a0a0a] text-white rounded-[8px] px-4 py-2 text-[11px] font-semibold w-fit shadow-[0_2px_8px_rgba(0,0,0,0.15)]">
            <svg width="14" height="14" viewBox="0 0 17 20" fill="white"><path d="M12.15 0c.12 1.17-.35 2.33-1.05 3.17-.71.84-1.85 1.5-2.97 1.41-.14-1.13.36-2.33 1.03-3.07C9.87.67 11.06.06 12.15 0zm3.56 6.82c-.09.05-2.12 1.22-2.1 3.63.02 2.88 2.54 3.87 2.57 3.88-.02.07-.4 1.37-1.33 2.72-.82 1.17-1.67 2.34-3.01 2.36-1.32.02-1.74-.78-3.25-.78s-1.99.76-3.24.8c-1.29.04-2.27-1.27-3.1-2.43C.55 14.72-.73 10.2 1.03 7.14c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.49.87 3.27.87.78 0 2.24-1.07 3.77-.91.64.03 2.45.26 3.61 1.95l-.09.08z"/></svg>
            Available on the Mac App Store
          </div>
        </div>

        {/* Right */}
        <div className="flex items-start gap-3 z-10">
          <img src="/keeby-logo.webp" alt="Keeby" className="w-14 h-14 rounded-[14px] shadow-lg" />
          <div className="w-[180px] rounded-[10px] p-1.5 border border-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.08)]" style={{ background: 'linear-gradient(165deg, rgba(40,40,45,0.95) 0%, rgba(10,10,12,0.95) 100%)' }}>
            {pubmatSwitches.map((s, i) => (
              <div key={s.name}>
                {(i === 0 || pubmatSwitches[i - 1].brand !== s.brand) && (
                  <div className="px-2 pt-1.5 pb-0 text-[8px] font-medium text-white/30 tracking-wide">{s.brand}</div>
                )}
                <div className={`flex items-center gap-1.5 px-2 py-[3px] rounded-[5px] text-[10px] font-medium text-white/90 ${s.selected ? 'bg-white/[0.06]' : ''}`}>
                  <div className="flex h-[11px] w-[11px] items-center justify-center rounded-[3px] text-[7px] font-bold text-white/80" style={{ backgroundColor: s.color, color: 'rgba(0,0,0,0.5)' }}>+</div>
                  <span>{s.name}</span>
                  {s.selected && <span className="ml-auto text-white/60 text-[10px]">✓</span>}
                </div>
                {i < pubmatSwitches.length - 1 && pubmatSwitches[i + 1]?.brand !== s.brand && (
                  <div className="mx-2 my-0.5 h-px bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.12),transparent)]" />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      {/* Product Hunt X Post (1200x675) */}
      <p className="text-[18px] font-bold text-[#1a1a1a] mt-10">Product Hunt X Post (1200x675)</p>
      <button onClick={() => exportAs(phRef, 'keeby-ph-x-post.png')} className="px-6 py-2.5 bg-gradient-to-b from-[#2a2a2a] to-[#0a0a0a] text-white rounded-full text-[14px] font-semibold cursor-pointer border-none shadow-md hover:shadow-lg transition-shadow">
        Export as PNG
      </button>
      <div ref={phRef} className="relative w-[1200px] h-[675px] bg-[#F5F5F5] flex items-center justify-start overflow-hidden outline outline-1 outline-black/[0.08]">

        {/* Left side */}
        <div className="flex flex-col gap-6 z-10 pl-20 max-w-[480px]">
          <img src="/logo-text.webp" alt="Keeby" className="h-9 w-auto shrink-0 object-contain self-start" />
          <h1 className="text-[52px] font-extrabold text-[#1a1a1a] tracking-[-2px] leading-[1.05]">
            #1 Top Paid App<br />Mac App Store
          </h1>
          <p className="text-[20px] text-[#888] leading-relaxed max-w-[320px]">
            Mechanical keyboard sounds for your Mac. Spatial audio, 12 switch profiles, and a notch visualizer.
          </p>
          <span className="text-[14px] font-medium text-[#FF6154]">Support us on Product Hunt</span>
        </div>

        {/* Right side */}
        <div className="absolute right-0 top-1/2 -translate-y-1/2 z-10 flex flex-col items-center gap-5">
          <div className="flex items-center gap-3">
            <img src="/keeby-logo.webp" alt="Keeby" className="w-8 h-8 rounded-[8px]" />
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            <img src="/product-hunt-logo.png" alt="Product Hunt" className="h-8 w-auto object-contain" />
          </div>
          <img src="/ph-ranking.png" alt="Product Hunt Ranking" className="w-[620px] h-auto" />
        </div>
      </div>

      {/* #1 Top Paid + #8 Product Hunt (1200x675) */}
      <p className="text-[18px] font-bold text-[#1a1a1a] mt-10">#1 Top Paid + PH Launch (1200x675)</p>
      <button onClick={() => exportAs(numberOneRef, 'keeby-number-1.png')} className="px-6 py-2.5 bg-gradient-to-b from-[#2a2a2a] to-[#0a0a0a] text-white rounded-full text-[14px] font-semibold cursor-pointer border-none shadow-md hover:shadow-lg transition-shadow">
        Export as PNG
      </button>
      <div ref={numberOneRef} className="relative w-[1200px] h-[675px] bg-[#F5F5F5] flex items-center justify-start overflow-hidden outline outline-1 outline-black/[0.08]">

        {/* Left side */}
        <div className="flex flex-col gap-5 z-10 pl-20 max-w-[480px]">
          <div className="flex items-center gap-3 self-start">
            <div className="relative">
              <img src="/keeby-logo.webp" alt="Keeby" className="w-16 h-16 rounded-[16px]" />
              <svg className="absolute -top-3 -left-3 -right-3 w-[88px] h-[88px]" viewBox="0 0 88 88" fill="none">
                {/* Left laurel */}
                <path d="M20 68 C18 60, 12 55, 10 48 C8 41, 10 34, 14 28 C18 22, 16 16, 18 10" stroke="#FFB800" strokeWidth="2" fill="none" strokeLinecap="round"/>
                <path d="M14 28 C18 30, 20 28, 20 24" stroke="#FFB800" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
                <path d="M12 38 C16 38, 18 36, 17 32" stroke="#FFB800" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
                <path d="M10 48 C14 47, 16 44, 14 40" stroke="#FFB800" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
                <path d="M14 56 C17 54, 18 51, 16 48" stroke="#FFB800" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
                <path d="M18 63 C20 60, 20 57, 18 54" stroke="#FFB800" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
                {/* Right laurel */}
                <path d="M68 68 C70 60, 76 55, 78 48 C80 41, 78 34, 74 28 C70 22, 72 16, 70 10" stroke="#FFB800" strokeWidth="2" fill="none" strokeLinecap="round"/>
                <path d="M74 28 C70 30, 68 28, 68 24" stroke="#FFB800" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
                <path d="M76 38 C72 38, 70 36, 71 32" stroke="#FFB800" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
                <path d="M78 48 C74 47, 72 44, 74 40" stroke="#FFB800" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
                <path d="M74 56 C71 54, 70 51, 72 48" stroke="#FFB800" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
                <path d="M70 63 C68 60, 68 57, 70 54" stroke="#FFB800" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
              </svg>
            </div>
            <img src="/logo-text.webp" alt="Keeby" className="h-9 w-auto shrink-0 object-contain" />
          </div>
          <h1 className="text-[52px] font-extrabold text-[#1a1a1a] tracking-[-2px] leading-[1.05]">
            #1 Top Paid App
          </h1>
          <div className="flex items-center gap-3">
            <span className="bg-[#1a1a1a] text-white rounded-[8px] px-4 py-2 text-[14px] font-semibold">Mac App Store</span>
            <span className="bg-[#FF6154] text-white rounded-[8px] px-4 py-2 text-[14px] font-semibold">#8 on Product Hunt</span>
          </div>
          <p className="text-[18px] text-[#888] leading-relaxed max-w-[380px]">
            Mechanical keyboard sounds for your Mac. Spatial audio, 12 switch profiles, and sub-3ms latency.
          </p>
        </div>

        {/* Right side: App Store screenshot */}
        <div className="absolute right-0 top-0 bottom-0 z-10 flex items-start overflow-hidden">
          <img src="/top-paid-screenshot.png" alt="#1 Top Paid Apps" className="h-[130%] w-auto object-cover object-top rounded-l-[16px] shadow-[0_8px_32px_rgba(0,0,0,0.12)]" style={{ marginTop: '-20px' }} />
        </div>
      </div>

      {/* YouTube Thumbnail (1280x720) */}
      <p className="text-[18px] font-bold text-[#1a1a1a] mt-10">YouTube Thumbnail (1280x720)</p>
      <button onClick={() => exportAs(thumbRef, 'keeby-yt-thumbnail.png')} className="px-6 py-2.5 bg-gradient-to-b from-[#2a2a2a] to-[#0a0a0a] text-white rounded-full text-[14px] font-semibold cursor-pointer border-none shadow-md hover:shadow-lg transition-shadow">
        Export as PNG
      </button>
      <div ref={thumbRef} className="relative w-[1280px] h-[720px] bg-[#F5F5F5] flex items-center justify-center gap-24 overflow-hidden outline outline-1 outline-black/[0.08]">
        <div className="absolute -top-[200px] -right-[100px] w-[800px] h-[800px] bg-[radial-gradient(circle,rgba(255,140,23,0.1)_0%,transparent_60%)] pointer-events-none" />
        <div className="absolute -bottom-[200px] -left-[100px] w-[600px] h-[600px] bg-[radial-gradient(circle,rgba(255,140,23,0.06)_0%,transparent_60%)] pointer-events-none" />

        {/* Left side */}
        <div className="flex flex-col gap-5 z-10 pl-16 max-w-[700px]">
          <img src="/logo-text.webp" alt="Keeby" className="h-9 w-auto shrink-0 object-contain self-start" />
          <h1 className="text-[52px] font-extrabold text-[#1a1a1a] tracking-[-2px] leading-[1.05]">
            I Made My<br />MacBook Sound<br />Like a Mech
          </h1>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-gradient-to-b from-[#2a2a2a] to-[#0a0a0a] text-white rounded-[10px] px-5 py-2.5 text-[14px] font-semibold shadow-[0_2px_8px_rgba(0,0,0,0.15)]">
              <svg width="16" height="16" viewBox="0 0 17 20" fill="white"><path d="M12.15 0c.12 1.17-.35 2.33-1.05 3.17-.71.84-1.85 1.5-2.97 1.41-.14-1.13.36-2.33 1.03-3.07C9.87.67 11.06.06 12.15 0zm3.56 6.82c-.09.05-2.12 1.22-2.1 3.63.02 2.88 2.54 3.87 2.57 3.88-.02.07-.4 1.37-1.33 2.72-.82 1.17-1.67 2.34-3.01 2.36-1.32.02-1.74-.78-3.25-.78s-1.99.76-3.24.8c-1.29.04-2.27-1.27-3.1-2.43C.55 14.72-.73 10.2 1.03 7.14c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.49.87 3.27.87.78 0 2.24-1.07 3.77-.91.64.03 2.45.26 3.61 1.95l-.09.08z"/></svg>
              Mac App Store
            </div>
            <span className="text-[16px] font-semibold text-[#FF8C17]">11 Switch Profiles</span>
          </div>
        </div>

        {/* Right side: app icon */}
        <div className="flex items-center justify-center z-10 pr-16">
          <img src="/keeby-logo.webp" alt="Keeby" className="w-[220px] h-[220px] rounded-[52px] shadow-2xl" />
        </div>
      </div>
    </div>
  )
}

const NotesWindow = React.memo(function NotesWindow() {
  const textareaRef = useRef(null)
  const heroProfileId = useHeroProfileId()
  const activeSwitch = ALL_SWITCHES.find((s) => s.id === heroProfileId)
  const isTypable = activeSwitch && isHeroTypableSwitch(activeSwitch.id)

  return (
    <div
      className="hidden sm:block sm:absolute sm:right-[calc(200%+21px)] sm:top-[120px] cursor-text w-full max-w-[220px] sm:w-[220px]"
      onClick={() => textareaRef.current?.focus()}
    >
      <div
        className={`${menuPanelFrame} bg-black/80`}
        style={{ backdropFilter: 'blur(30px)', WebkitBackdropFilter: 'blur(30px)' }}
      >
        {/* Title bar */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.06]">
          <div className="flex items-center gap-[4px]">
            <div className="w-[8px] h-[8px] rounded-full bg-white/[0.12]" />
            <div className="w-[8px] h-[8px] rounded-full bg-white/[0.12]" />
            <div className="w-[8px] h-[8px] rounded-full bg-white/[0.12]" />
          </div>
          <span className="flex-1 text-center text-[10px] sm:text-[11px] font-medium tracking-[-0.01em] text-white/40">Notes</span>
          <div className="w-[52px]" />
        </div>
        {/* Content — scrollable */}
        <div className="px-2.5 py-2">
          {isTypable && (
            <div className="mb-2 flex items-center gap-1.5 select-none">
              <div
                className="h-[10px] w-[10px] shrink-0 rounded-[2px]"
                style={{ backgroundColor: activeSwitch.color }}
              />
              <span className="text-[10px] sm:text-[11px] font-medium tracking-tight text-white/55">
                Typing with {activeSwitch.name}
              </span>
            </div>
          )}
          <textarea
            ref={textareaRef}
            placeholder={isTypable ? 'Try typing here to hear it yourself.' : 'Preview switch — typing is silent.'}
            className="w-full bg-transparent text-[11px] sm:text-[12px] font-medium tracking-[-0.01em] text-white/90 placeholder-white/70 outline-none caret-white resize-none overflow-hidden"
            style={{ height: '80px' }}
            maxLength={200}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
            {...(isTypable ? { 'data-keeby-sounds': 'true' } : {})}
            data-keeby-hero-sounds="true"
          />
        </div>
      </div>
      <img src="/try-typing.svg" alt="try typing" className="mt-2 h-9 w-auto mx-auto select-none pointer-events-none brightness-0 invert" draggable="false" />
    </div>
  )
})

function HeroSwitchSubmenu({ activated, onSelect }) {
  const heroSwitchIndex = useHeroSwitchIndex()
  if (!activated) {
    return (
      <>
        <div className={menuSection}>Keychron</div>
        <div className={`${menuRow} ${menuRowChecked}`}>
          <div className="flex h-[14px] w-[14px] items-center justify-center rounded-[4px] text-[9px] font-bold leading-none" style={{ backgroundColor: '#C74747', color: 'rgba(0,0,0,0.5)' }}>+</div>
          <span>K2 Max · K Pro Red</span>
          <CircleCheckBig className="ml-auto h-3.5 w-3.5 text-white/70" />
        </div>
        <div className={menuDivider} />
        <div className={`${menuRow} ${menuRowDisabled}`}>
          <div className="flex h-[14px] w-[14px] items-center justify-center rounded-[4px] bg-white/12 text-[9px] font-bold leading-none text-white/60">+</div>
          <span>Cherry MX Blue</span>
          <span className={menuBadge}>Soon</span>
        </div>
        <div className={`${menuRow} ${menuRowDisabled}`}>
          <div className="flex h-[14px] w-[14px] items-center justify-center rounded-[4px] bg-white/12 text-[9px] font-bold leading-none text-white/60">+</div>
          <span>Holy Panda X</span>
          <span className={menuBadge}>Soon</span>
        </div>
        <div className={`${menuRow} ${menuRowDisabled}`}>
          <div className="flex h-[14px] w-[14px] items-center justify-center rounded-[4px] bg-white/12 text-[9px] font-bold leading-none text-white/60">+</div>
          <span>Razer Green</span>
          <span className={menuBadge}>Soon</span>
        </div>
      </>
    )
  }

  return (
    <div
      data-lenis-prevent
      style={{ maxHeight: 'min(340px, 56vh)', overflowY: 'auto', overscrollBehavior: 'contain' }}
      className="hero-switch-scroll notes-scroll -mr-1.5 pr-1"
    >
      {ALL_SWITCHES.map((prof, i) => {
        const isSelected = heroSwitchIndex === i
        const isPreviewOnly = HERO_PREVIEW_ONLY_SWITCH_IDS.has(prof.id)
        const isFirst = i === 0
        return (
          <div key={prof.id}>
            {isFirst && <div className={menuSection}>{prof.brand}</div>}
            {!isFirst && ALL_SWITCHES[i - 1].brand !== prof.brand && (
              <>
                <div className={menuDivider} />
                <div className={menuSection}>{prof.brand}</div>
              </>
            )}
            <div
              className={`${menuRow} ${isSelected ? menuRowChecked : ''} cursor-pointer`}
              onClick={() => onSelect(prof, i)}
            >
              <div
                className="flex h-[14px] w-[14px] shrink-0 items-center justify-center rounded-[4px] text-[9px] font-bold leading-none text-white/80"
                style={{ backgroundColor: prof.color, color: 'rgba(0,0,0,0.5)' }}
              >+</div>
              <span className="min-w-0 truncate">{prof.name}</span>
              {isPreviewOnly && !isSelected && (
                <span className={menuPreviewBadge}>Preview</span>
              )}
              {isSelected && <CircleCheckBig className="ml-auto h-3.5 w-3.5 shrink-0 text-white/70" />}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function HeroNotchSwitchDot() {
  const heroSwitchIndex = useHeroSwitchIndex()
  const color = ALL_SWITCHES[heroSwitchIndex]?.color ?? '#C74747'
  return (
    <div className="relative h-[8px] w-[8px] sm:h-[12px] sm:w-[12px] rounded-[2px] sm:rounded-[3px] shrink-0" style={{ backgroundColor: color, transition: 'background-color 0.3s ease' }}>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="absolute h-[4px] w-[0.8px] sm:h-[5px] sm:w-[1.2px] rounded-full bg-black/40" />
        <div className="absolute h-[0.8px] w-[4px] sm:h-[1.2px] sm:w-[5px] rounded-full bg-black/40" />
      </div>
    </div>
  )
}

// Tiny subscriber — re-renders only on keypress, insulating App from the firehose.
function NotchKeyCap() {
  const lastKey = useLastKey()
  if (!lastKey) return null
  return (
    <div key={lastKey.id} className="flex h-[18px] min-w-[18px] items-center justify-center rounded-[4px] bg-white/15 px-1 keycap-pop -mt-px">
      <span className="text-[9px] font-bold leading-none text-white/90">{lastKey.label}</span>
    </div>
  )
}

// Same pattern for the nav thock counter — isolated from App re-renders.
function NavThockCounter() {
  const thockCount = useThockCount()
  if (thockCount == null) return null
  return (
    <p className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 hidden md:flex items-center gap-1.5 text-sm text-neutral-600 tabular-nums tracking-tight">
      <span className="font-semibold text-neutral-700"><AnimatedNumber value={thockCount} /></span> <span>thocks and counting</span>
    </p>
  )
}

// Small toggle switch — used inside NavSettingsDropdown for both rows so
// the mute and visualizer controls share the same affordance.
function NavToggleSwitch({ value, onChange, ariaLabel }) {
  return (
    <span
      role="switch"
      aria-checked={value}
      aria-label={ariaLabel}
      onClick={(e) => { e.stopPropagation(); onChange(!value); hapticTap() }}
      className={`relative inline-flex h-[22px] w-[38px] shrink-0 cursor-pointer items-center rounded-full transition-colors ${value ? 'bg-neutral-900' : 'bg-neutral-300'}`}
    >
      <span
        className="inline-block h-[18px] w-[18px] rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.18)] transition-transform"
        style={{ transform: value ? 'translateX(18px)' : 'translateX(2px)' }}
      />
    </span>
  )
}

// Site-wide settings dropdown — replaces the bare mute toggle. Hosts the
// audio mute control plus the keyboard-visualizer enable toggle so both
// global preferences live behind one navbar entry. Open/close/exit-timer
// pattern matches SoundPad's SwitchPicker so the two dropdowns feel the
// same when opened.
// Single source of truth for the platform-pick dropdown (Mac default,
// Windows below). Used in 5 places across the landing — navbar, hero,
// bottom CTAs (desktop + mobile). The `variant` prop maps to the
// existing trigger button styling so the visual rhythm of the page
// doesn't change. Click the trigger -> menu opens -> user picks
// Mac (App Store) or Windows (/windows, region-aware checkout).
// Single auto-detected download button. Replaces the old dropdown — most
// visitors are confidently Mac or Windows, so the picker step was friction
// for 95% of traffic. Mac/iPad (App Store works on both) goes to the store;
// Windows goes to /windows. Linux/Android/unknown fall back to Mac since
// the App Store flow is the more polished path and those visitors usually
// can't install either native binary anyway.
function DownloadButton({ variant = 'navbar', location = 'navbar', fadeClass = '', navigate }) {
  const os = useOS() // 'mac' | 'windows' | 'other' | 'unknown' (pre-mount)
  const platform = os === 'windows' ? 'windows' : 'mac'

  const onClick = useCallback((e) => {
    hapticTap()
    capture('download_clicked', { location, platform })
    if (platform === 'windows') {
      // Kick off the MSI download immediately, then route to the buy page.
      // The anchor click stays in the background because /download/* is
      // served with Content-Disposition: attachment (see vercel.json), so
      // the current tab is free to navigate. Buyer comes back to a primed
      // installer right after they pay.
      const link = document.createElement('a')
      link.href = 'https://getkeeby.com/download/KeebySetup.msi'
      link.rel = 'noopener'
      link.style.display = 'none'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      if (navigate) navigate('/windows')(e)
      else window.location.href = '/windows'
    } else {
      window.open(APP_STORE, '_blank', 'noopener,noreferrer')
    }
  }, [location, platform, navigate])

  // Per-variant trigger styling matches the previous dropdown trigger so the
  // surrounding page composition is unchanged.
  const styles = {
    navbar: {
      btn: 'group relative overflow-hidden rounded-full bg-gradient-to-b from-[#2a2a2a] to-[#0a0a0a] border border-white/[0.08] transition-colors duration-500 ease-out hover:from-[#3a3a3a] hover:to-[#1a1a1a] px-3 py-2 text-[11px] font-semibold text-white sm:px-5 sm:py-2.5 sm:text-sm cursor-pointer',
      icon: 'h-3.5 w-3.5',
      gap: 'gap-1.5 sm:gap-2',
      label: platform === 'windows' ? 'Get Keeby' : 'Download',
    },
    hero: {
      btn: `group relative overflow-hidden px-10 py-5 bg-gradient-to-b from-[#2a2a2a] to-[#0a0a0a] border border-white/[0.08] transition-colors duration-500 ease-out hover:from-[#3a3a3a] hover:to-[#1a1a1a] text-white rounded-full text-[17px] font-semibold mb-2 cursor-pointer ${fadeClass}`,
      icon: 'w-5 h-5',
      gap: 'gap-3',
      label: platform === 'windows' ? 'Get for Windows' : 'Download for Mac',
    },
    cta: {
      btn: 'group relative overflow-hidden px-12 py-6 bg-gradient-to-b from-[#2a2a2a] to-[#0a0a0a] border border-white/[0.08] text-white rounded-full text-lg font-bold cursor-pointer',
      icon: 'w-5 h-5',
      gap: 'gap-3',
      label: platform === 'windows' ? 'Get for Windows' : 'Download for Mac',
    },
  }
  const v = styles[variant] || styles.navbar

  return (
    <button
      type="button"
      onClick={onClick}
      className={v.btn}
    >
      <span className={`flex items-center ${v.gap}`}>
        {platform === 'windows' ? <WindowsIcon className={v.icon} /> : <AppleIcon className={v.icon} />}
        <span className="whitespace-nowrap">{v.label}</span>
      </span>
    </button>
  )
}

// System requirements label that follows the visitor's OS. The CTA used to
// hardcode "Requires macOS 13 or later" even when the page was in Windows
// mode (Get for Windows button + Windows-first dropdown), which was a
// confusing mismatch for Windows visitors.
function SystemRequirementsLabel({ className = 'text-xs text-neutral-600' }) {
  const os = useOS()
  const label = os === 'windows'
    ? 'Requires Windows 10 or later'
    : 'Requires macOS 13 or later'
  return <span className={className}>{label}</span>
}

// Old dropdown component — kept here only for the deprecated callers below.
// TODO: delete after switching all callers to DownloadButton.
function DownloadDropdown({ variant = 'navbar', location = 'navbar', fadeClass = '', navigate }) {
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)
  const [placement, setPlacement] = useState('bottom') // 'bottom' | 'top'
  const wrapRef = useRef(null)
  const triggerRef = useRef(null)
  const exitTimerRef = useRef(0)
  const os = useOS() // 'mac' | 'windows' | 'other' | 'unknown' (pre-mount)

  // Approximate menu height: 2 rows * (12px py + 36px icon) + 16px outer
  // padding = ~136px. Slight overestimate is fine — better to flip a little
  // early than have the menu clip off the bottom.
  const ESTIMATED_MENU_HEIGHT = 150

  const open = useCallback(() => {
    if (exitTimerRef.current) {
      clearTimeout(exitTimerRef.current)
      exitTimerRef.current = 0
    }
    // Pick placement before mount so the entrance animation slides from
    // the right side (above-trigger menu slides down, below-trigger slides up).
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      const spaceAbove = rect.top
      setPlacement(spaceBelow < ESTIMATED_MENU_HEIGHT && spaceAbove > spaceBelow ? 'top' : 'bottom')
    }
    setMounted(true)
    requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)))
  }, [])

  const close = useCallback(() => {
    setVisible(false)
    if (exitTimerRef.current) clearTimeout(exitTimerRef.current)
    exitTimerRef.current = window.setTimeout(() => {
      setMounted(false)
      exitTimerRef.current = 0
    }, 200)
  }, [])

  const toggle = useCallback(() => { if (visible) close(); else open() }, [visible, open, close])

  useEffect(() => {
    if (!mounted) return
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) close()
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [mounted, close])

  useEffect(() => () => {
    if (exitTimerRef.current) clearTimeout(exitTimerRef.current)
  }, [])

  const onPickMac = useCallback(() => {
    hapticTap()
    capture('download_clicked', { location, platform: 'mac' })
    window.open(APP_STORE, '_blank', 'noopener,noreferrer')
    close()
  }, [location, close])

  const onPickWindows = useCallback((e) => {
    hapticTap()
    capture('download_clicked', { location, platform: 'windows' })
    close()
    if (navigate) navigate('/windows')(e)
    else window.location.href = '/windows'
  }, [location, close, navigate])

  // Trigger button styling per placement. Each variant matches what was
  // there before so the page composition is unchanged.
  const triggerByVariant = {
    navbar: {
      btn: 'group relative overflow-hidden rounded-full bg-gradient-to-b from-[#2a2a2a] to-[#0a0a0a] border border-white/[0.08] transition-colors duration-500 ease-out hover:from-[#3a3a3a] hover:to-[#1a1a1a] px-3 py-2 text-[11px] font-semibold text-white sm:px-5 sm:py-2.5 sm:text-sm cursor-pointer',
      icon: 'h-3.5 w-3.5',
      gap: 'gap-1.5 sm:gap-2',
      label: 'Download',
      caret: 'h-3 w-3',
    },
    hero: {
      btn: `group relative overflow-hidden px-10 py-5 bg-gradient-to-b from-[#2a2a2a] to-[#0a0a0a] border border-white/[0.08] transition-colors duration-500 ease-out hover:from-[#3a3a3a] hover:to-[#1a1a1a] text-white rounded-full text-[17px] font-semibold mb-2 cursor-pointer ${fadeClass}`,
      icon: 'w-5 h-5',
      gap: 'gap-3',
      label: 'Download',
      caret: 'h-4 w-4',
    },
    cta: {
      btn: 'group relative overflow-hidden px-12 py-6 bg-gradient-to-b from-[#2a2a2a] to-[#0a0a0a] border border-white/[0.08] text-white rounded-full text-lg font-bold cursor-pointer',
      icon: 'w-5 h-5',
      gap: 'gap-3',
      label: 'Download',
      caret: 'h-4 w-4',
    },
  }
  const v = triggerByVariant[variant] || triggerByVariant.navbar

  // Menu sticks to the trigger but anchors right so it doesn't overflow
  // off-screen for buttons near the right edge of the viewport.
  return (
    <div ref={wrapRef} className="relative inline-flex">
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        aria-label="Download Keeby"
        aria-expanded={visible}
        aria-haspopup="menu"
        className={v.btn}
      >
        <span className={`flex items-center ${v.gap}`}>
          {os === 'windows' ? <WindowsIcon className={v.icon} /> : <AppleIcon className={v.icon} />}
          <span className="whitespace-nowrap">
            {os === 'windows' ? (variant === 'navbar' ? 'Get Keeby' : 'Get for Windows') : v.label}
          </span>
          <svg
            viewBox="0 0 20 20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`${v.caret} text-white/70 transition-transform duration-200 ${visible ? 'rotate-180' : ''}`}
            aria-hidden="true"
          >
            <polyline points="6 9 10 13 14 9" />
          </svg>
        </span>
      </button>

      {mounted && (
        <div
          role="menu"
          className={`absolute z-50 w-[260px] rounded-2xl border border-black/[0.06] bg-white p-2 tracking-tight left-1/2 ${placement === 'top' ? 'bottom-[calc(100%+8px)] origin-bottom' : 'top-[calc(100%+8px)] origin-top'}`}
          style={{
            opacity: visible ? 1 : 0,
            // Slide IN toward the trigger: above-placed menus rise from below
            // their resting position, below-placed menus fall from above.
            transform: `translateX(-50%) ${visible ? 'translateY(0) scale(1)' : `translateY(${placement === 'top' ? '6px' : '-6px'}) scale(0.96)`}`,
            filter: visible ? 'blur(0px)' : 'blur(8px)',
            transition: 'opacity 200ms ease, transform 200ms ease, filter 200ms ease',
          }}
        >
          {[
            os === 'windows' ? 'windows' : 'mac',
            os === 'windows' ? 'mac' : 'windows',
          ].map(item => item === 'mac' ? (
            <button
              key="mac"
              type="button"
              role="menuitem"
              onClick={onPickMac}
              className="w-full flex items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-neutral-50 cursor-pointer border-none bg-transparent"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-black text-white">
                <AppleIcon className="h-4 w-4" />
              </span>
              <span className="flex-1">
                <span className="block text-[14px] font-semibold text-neutral-900">Mac</span>
                <span className="block text-[11px] text-neutral-600">App Store · macOS 13+</span>
              </span>
            </button>
          ) : (
            <button
              key="windows"
              type="button"
              role="menuitem"
              onClick={onPickWindows}
              className="w-full flex items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-neutral-50 cursor-pointer border-none bg-transparent"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#0078D4] text-white">
                <WindowsIcon className="h-4 w-4" />
              </span>
              <span className="flex-1">
                <span className="block text-[14px] font-semibold text-neutral-900">Windows</span>
                <span className="block text-[11px] text-neutral-600">Windows 10 or later</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function NavSettingsDropdown() {
  const [mounted, setMounted] = useState(false)
  const [visible, setVisible] = useState(false)
  const wrapRef = useRef(null)
  const exitTimerRef = useRef(0)
  const muted = useMuted()
  const visualizerEnabled = useVisualizerEnabled()
  const hideSwitchPicker = useHideSwitchPicker()
  const autoScrollPlayground = useAutoScrollPlayground()
  const zenMode = useZenMode()

  const open = useCallback(() => {
    if (exitTimerRef.current) {
      clearTimeout(exitTimerRef.current)
      exitTimerRef.current = 0
    }
    setMounted(true)
    requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)))
  }, [])

  const close = useCallback(() => {
    setVisible(false)
    if (exitTimerRef.current) clearTimeout(exitTimerRef.current)
    exitTimerRef.current = window.setTimeout(() => {
      setMounted(false)
      exitTimerRef.current = 0
    }, 200)
  }, [])

  const toggle = useCallback(() => { if (visible) close(); else open() }, [visible, open, close])

  useEffect(() => {
    if (!mounted) return
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) close()
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [mounted, close])

  useEffect(() => () => {
    if (exitTimerRef.current) clearTimeout(exitTimerRef.current)
  }, [])

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label="Audio and visualizer settings"
        aria-expanded={visible}
        aria-haspopup="menu"
        title="Settings"
        className="group relative inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-2 text-[11px] font-semibold text-neutral-700 transition duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.94] sm:px-5 sm:py-2.5 sm:text-sm sm:gap-2"
      >
        {muted ? (
          <svg className="h-3.5 w-3.5 text-neutral-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <line x1="23" y1="9" x2="17" y2="15" />
            <line x1="17" y1="9" x2="23" y2="15" />
          </svg>
        ) : (
          <svg className="h-3.5 w-3.5 text-neutral-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
          </svg>
        )}
        <span className="whitespace-nowrap">Audio</span>
        <svg
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`h-3 w-3 text-neutral-400 transition-transform duration-200 ${visible ? 'rotate-180' : ''}`}
          aria-hidden="true"
        >
          <polyline points="6 9 10 13 14 9" />
        </svg>
      </button>

      {mounted && (
        <div
          className="absolute right-0 top-[calc(100%+8px)] z-50 w-[280px] origin-top-right rounded-2xl border border-black/[0.06] bg-white p-2 shadow-[0_24px_60px_rgba(0,0,0,0.18)] tracking-tight"
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0) scale(1)' : 'translateY(-6px) scale(0.96)',
            filter: visible ? 'blur(0px)' : 'blur(8px)',
            transition:
              'opacity 200ms cubic-bezier(.34,1.4,.64,1), transform 220ms cubic-bezier(.34,1.4,.64,1), filter 200ms ease-out',
            pointerEvents: visible ? 'auto' : 'none',
          }}
          role="menu"
        >
          <button
            type="button"
            onClick={() => { setMuted(!muted); hapticTap() }}
            className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-neutral-50"
            role="menuitemcheckbox"
            aria-checked={!muted}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-600">
              {muted ? (
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <line x1="23" y1="9" x2="17" y2="15" />
                  <line x1="17" y1="9" x2="23" y2="15" />
                </svg>
              ) : (
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                </svg>
              )}
            </span>
            <span className="flex flex-1 flex-col leading-tight">
              <span className="text-[13px] font-semibold text-neutral-900">Keyboard sounds</span>
              <span className="text-[11px] text-neutral-600">{muted ? 'Currently muted' : 'Tap to mute site-wide'}</span>
            </span>
            <NavToggleSwitch
              value={!muted}
              onChange={(v) => setMuted(!v)}
              ariaLabel={muted ? 'Unmute keyboard sounds' : 'Mute keyboard sounds'}
            />
          </button>

          <div className="my-1 h-px bg-neutral-100" />

          <button
            type="button"
            onClick={() => { setVisualizerEnabled(!visualizerEnabled); hapticTap() }}
            className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-neutral-50"
            role="menuitemcheckbox"
            aria-checked={visualizerEnabled}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-600">
              <Keyboard className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="flex flex-1 flex-col leading-tight">
              <span className="text-[13px] font-semibold text-neutral-900">Keyboard visualizer</span>
              <span className="text-[11px] text-neutral-600">Floating keys near your cursor</span>
            </span>
            <NavToggleSwitch
              value={visualizerEnabled}
              onChange={setVisualizerEnabled}
              ariaLabel={visualizerEnabled ? 'Disable keyboard visualizer' : 'Enable keyboard visualizer'}
            />
          </button>

          <div className="my-1 h-px bg-neutral-100" />

          <button
            type="button"
            onClick={() => { setHideSwitchPicker(!hideSwitchPicker); hapticTap() }}
            className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-neutral-50"
            role="menuitemcheckbox"
            aria-checked={hideSwitchPicker}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-600">
              <EyeOff className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="flex flex-1 flex-col leading-tight">
              <span className="text-[13px] font-semibold text-neutral-900">Hide switch picker</span>
              <span className="text-[11px] text-neutral-600">Type with your own Keeby app</span>
            </span>
            <NavToggleSwitch
              value={hideSwitchPicker}
              onChange={setHideSwitchPicker}
              ariaLabel={hideSwitchPicker ? 'Show switch picker' : 'Hide switch picker'}
            />
          </button>

          <div className="my-1 h-px bg-neutral-100" />

          <button
            type="button"
            onClick={() => { setAutoScrollPlayground(!autoScrollPlayground); hapticTap() }}
            className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-neutral-50"
            role="menuitemcheckbox"
            aria-checked={autoScrollPlayground}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-600">
              <ArrowDownToLine className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="flex flex-1 flex-col leading-tight">
              <span className="text-[13px] font-semibold text-neutral-900">Open to typing test</span>
              <span className="text-[11px] text-neutral-600">Auto-scroll on every visit</span>
            </span>
            <NavToggleSwitch
              value={autoScrollPlayground}
              onChange={setAutoScrollPlayground}
              ariaLabel={autoScrollPlayground ? 'Disable auto-scroll to typing test' : 'Enable auto-scroll to typing test'}
            />
          </button>

          <div className="my-1 h-px bg-neutral-100" />

          <button
            type="button"
            onClick={() => { setZenMode(!zenMode); hapticTap() }}
            className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-neutral-50"
            role="menuitemcheckbox"
            aria-checked={zenMode}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-neutral-600">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="flex flex-1 flex-col leading-tight">
              <span className="text-[13px] font-semibold text-neutral-900">Zen mode</span>
              <span className="text-[11px] text-neutral-600">Hide on-page keyboard, just the test</span>
            </span>
            <NavToggleSwitch
              value={zenMode}
              onChange={setZenMode}
              ariaLabel={zenMode ? 'Disable zen mode' : 'Enable zen mode'}
            />
          </button>
        </div>
      )}
    </div>
  )
}

function App() {
  const [keyPressed, setKeyPressed] = useState(false)
  // Press visuals on the keeby-logo buttons used to be driven by React state
  // (setHeroPressed / setGlobeLogoPressed). Each press fired two App-wide
  // re-renders (down + up) — spam-clicking starved the Globe's rAF loop and
  // the rotation visibly lagged. The press feedback is now a pure CSS
  // `active:` scale, so the handlers below pass a noop to makePressHandlers.
  const noopSetPressed = useRef(() => {}).current
  const { increment: incrementThock } = useThockCounter()
  const keyboardSounds = useKeyboardSounds()
  const selectHeroSwitch = keyboardSounds.selectHeroSwitch
  const handleHeroSwitchSelect = useCallback((prof, i) => {
    setHeroSelection(i, prof.id)
    selectHeroSwitch(prof.id)
    capture('easter_egg_switch_selected', { profile: prof.name })
  }, [selectHeroSwitch])
  const hideSwitchPicker = useHideSwitchPicker()
  const zenMode = useZenMode()
  const eggTaps = useRef(0)
  const eggTapTimer = useRef(null)
  const [eggToast, setEggToast] = useState(false)
  const demoVideoRef = useRef(null)
  const demoVideoMobileRef = useRef(null)
  const demoContainerRef = useRef(null)
  const demoMobileSectionRef = useRef(null)
  const [demoVideoReady, setDemoVideoReady] = useState(false)
  const demoCapsuleRef = useRef(null)
  const [demoMuted, setDemoMuted] = useState(true)
  const [demoMobileMuted, setDemoMobileMuted] = useState(true)
  const demoCursorVisible = useRef(false)
  const demoCursorTarget = useRef({ x: 0, y: 0 })
  const demoCursorPos = useRef({ x: 0, y: 0 })
  const demoCursorRaf = useRef(null)

  useEffect(() => {
    const lerp = () => {
      const t = 0.15
      demoCursorPos.current.x += (demoCursorTarget.current.x - demoCursorPos.current.x) * t
      demoCursorPos.current.y += (demoCursorTarget.current.y - demoCursorPos.current.y) * t
      const el = demoCapsuleRef.current
      if (el) {
        el.style.left = `${demoCursorPos.current.x}px`
        el.style.top = `${demoCursorPos.current.y}px`
      }
      demoCursorRaf.current = requestAnimationFrame(lerp)
    }
    demoCursorRaf.current = requestAnimationFrame(lerp)
    return () => { if (demoCursorRaf.current) cancelAnimationFrame(demoCursorRaf.current) }
  }, [])
  const clickAudioContext = useRef(null)
  const clickAudioBuffers = useRef({ down: null, up: null })
  const clickAudioFallback = useRef({ down: null, up: null })
  // Parallel buffer/fallback for the keyboard-switch "thock" sample. Shares
  // the click AudioContext to avoid spinning up a second one — same Web Audio
  // pipeline, just a different decoded sample.
  const thockAudioBuffers = useRef({ down: null, up: null })
  const thockAudioFallback = useRef({ down: null, up: null })
  const lenisRef = useRef(null)
  const [path, setPath] = useState(() => window.location.pathname.replace(/\/+$/, '') || '/')
  const [showComingSoon, setShowComingSoon] = useState(false)
  const supportsPointerEvents = typeof window !== 'undefined' && 'PointerEvent' in window


  const scrollToTop = useCallback(() => {
    const lenis = lenisRef.current
    if (lenis) {
      lenis.scrollTo(0, { immediate: true, force: true })
      return
    }

    window.scrollTo(0, 0)
  }, [])

  // Lenis-aware scroll to the playground panel. Shared by the navbar "Try it"
  // button (user intent) and the on-type auto-center (implicit intent when the
  // user starts typing). Extracted so typing the playground fires the same
  // motion as clicking Try it.
  //
  // `lock` locks out user wheel/touch scroll until the animation finishes —
  // used by the on-type centering so a fast mouse-wheel can't cancel it.
  // Try it passes lock=false: user can still interrupt their own button press.
  const doScrollToPlayground = useCallback((opts = {}) => {
    const { lock = false } = opts
    const isDesktop = window.matchMedia('(min-width: 1024px)').matches
    if (isDesktop) {
      const hscroll = document.querySelector('[data-hscroll-root]')
      if (hscroll) {
        const PANEL_INDEX = 2 // 0: Hero, 1: Features, 2: Playground, 3: Video Demo, 4: Globe, 5: CTA
        const baseY = hscroll.getBoundingClientRect().top + window.scrollY
        const targetY = baseY + PANEL_INDEX * window.innerWidth
        const lenis = lenisRef.current
        if (lenis) lenis.scrollTo(targetY, { duration: 1.1, lock, force: lock })
        else window.scrollTo({ top: targetY, behavior: 'smooth' })
        return
      }
    }
    const mobileTarget = document.getElementById('playground-mobile')
    if (mobileTarget) {
      const lenis = lenisRef.current
      if (lenis) lenis.scrollTo(mobileTarget, { duration: 1.0, lock, force: lock })
      else mobileTarget.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [])

  const scrollToPlayground = useCallback(() => {
    capture('try_it_clicked', { location: 'navbar' })
    hapticTap()
    doScrollToPlayground()
  }, [doScrollToPlayground])

  // Scroll to the "Thocks around the world" panel — mirrors doScrollToPlayground
  // but for panel index 4 on desktop (or #globe-mobile on the stacked layout).
  // Hooked to the keeby-logo "tap to thock" buttons in that section so a press
  // also re-centers the panel, matching the Try-it ⇒ Playground behavior.
  const doScrollToGlobe = useCallback((opts = {}) => {
    const { lock = false } = opts
    const isDesktop = window.matchMedia('(min-width: 1024px)').matches
    if (isDesktop) {
      const hscroll = document.querySelector('[data-hscroll-root]')
      if (hscroll) {
        const PANEL_INDEX = 4 // 0: Hero, 1: Features, 2: Playground, 3: Video Demo, 4: Globe, 5: CTA
        const baseY = hscroll.getBoundingClientRect().top + window.scrollY
        const targetY = baseY + PANEL_INDEX * window.innerWidth
        const lenis = lenisRef.current
        if (lenis) lenis.scrollTo(targetY, { duration: 1.1, lock, force: lock })
        else window.scrollTo({ top: targetY, behavior: 'smooth' })
        return
      }
    }
    const mobileTarget = document.getElementById('globe-mobile')
    if (mobileTarget) {
      const lenis = lenisRef.current
      if (lenis) lenis.scrollTo(mobileTarget, { duration: 1.0, lock, force: lock })
      else mobileTarget.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [])

  const scrollToGlobe = useCallback(() => {
    hapticTap()
    doScrollToGlobe()
  }, [doScrollToGlobe])

  // Re-center the Feedback panel on interaction (keycap thock or typing into
  // the form). Mirrors doScrollToPlayground / doScrollToGlobe so the page
  // motion feels consistent when a user starts engaging with the section.
  // target='heading' parks the heading at the top of the viewport (good for
  // thock — user just chose a keycap and now expects to type);
  // target='form' centers the form area (good for typing — keeps both the
  // textarea and the helper text comfortably on-screen).
  const doScrollToFeedback = useCallback((opts = {}) => {
    const { lock = false, target = 'form' } = opts
    const isDesktop = window.matchMedia('(min-width: 1024px)').matches
    if (isDesktop) {
      const hscroll = document.querySelector('[data-hscroll-root]')
      if (hscroll) {
        const PANEL_INDEX = 5 // 0: Hero, 1: Features, 2: Playground, 3: Video Demo, 4: Globe, 5: Feedback, 6: CTA
        const baseY = hscroll.getBoundingClientRect().top + window.scrollY
        const targetY = baseY + PANEL_INDEX * window.innerWidth
        const lenis = lenisRef.current
        if (lenis) lenis.scrollTo(targetY, { duration: 1.1, lock, force: lock })
        else window.scrollTo({ top: targetY, behavior: 'smooth' })
        return
      }
    }
    const mobileTarget = document.getElementById('feedback')
    if (!mobileTarget) return
    const lenis = lenisRef.current
    if (target === 'form') {
      // Center the section vertically. Lenis takes a numeric offset, so we
      // compute the Y that puts the section midpoint at the viewport center.
      const rect = mobileTarget.getBoundingClientRect()
      const sectionY = rect.top + window.scrollY
      const centerY = sectionY + rect.height / 2 - window.innerHeight / 2
      if (lenis) lenis.scrollTo(centerY, { duration: 1.0, lock, force: lock })
      else window.scrollTo({ top: centerY, behavior: 'smooth' })
    } else {
      if (lenis) lenis.scrollTo(mobileTarget, { duration: 1.0, lock, force: lock })
      else mobileTarget.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [])

  useEffect(() => {
    history.scrollRestoration = 'manual'
    scrollToTop()
    const onPop = () => setPath(window.location.pathname.replace(/\/+$/, '') || '/')
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [scrollToTop])

  useEffect(() => {
    let lenis = null
    const desktopBreakpoint = window.matchMedia('(min-width: 1024px)')

    const destroyLenis = () => {
      if (!lenis) return

      lenis.destroy()
      if (lenisRef.current === lenis) {
        lenisRef.current = null
      }
      lenis = null
      document.documentElement.style.removeProperty('scroll-behavior')
      document.body.style.removeProperty('scroll-behavior')
    }

    const createLenis = () => {
      if (lenis || path !== '/' || !desktopBreakpoint.matches) return

      void Promise.all([
        import('lenis'),
        import('lenis/dist/lenis.css'),
      ]).then(([{ default: Lenis }]) => {
        if (lenis || path !== '/' || !desktopBreakpoint.matches) return

        document.documentElement.style.scrollBehavior = 'auto'
        document.body.style.scrollBehavior = 'auto'

        lenis = new Lenis({
          autoRaf: true,
          smoothWheel: true,
          gestureOrientation: 'vertical',
          lerp: 0.12,
          wheelMultiplier: 1,
          overscroll: false,
        })

        lenisRef.current = lenis
      })
    }

    const syncLenis = () => {
      if (path === '/' && desktopBreakpoint.matches) {
        createLenis()
        return
      }

      destroyLenis()
    }

    syncLenis()
    desktopBreakpoint.addEventListener('change', syncLenis)

    return () => {
      desktopBreakpoint.removeEventListener('change', syncLenis)
      destroyLenis()
    }
  }, [path])

  // Defer the 15 MB demo MP4 until the video panel nears the viewport.
  useEffect(() => {
    if (path !== '/') return
    const targets = [demoContainerRef.current, demoMobileSectionRef.current].filter(Boolean)
    if (!targets.length) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setDemoVideoReady(true)
          observer.disconnect()
        }
      },
      { rootMargin: '240px' },
    )

    targets.forEach((node) => observer.observe(node))
    return () => observer.disconnect()
  }, [path])

  useEffect(() => {
    if (!demoVideoReady) return
    for (const ref of [demoVideoRef, demoVideoMobileRef]) {
      const video = ref.current
      if (video) void video.play().catch(() => {})
    }
  }, [demoVideoReady])

  // Auto-scroll to the typing playground on initial page load when the user
  // has opted in via NavSettingsDropdown. Skipped if the URL has a hash
  // (deep-link wins) or if we're not on the home route. Runs once per mount.
  useEffect(() => {
    if (path !== '/') return
    if (!getAutoScrollPlayground()) return
    if (window.location.hash) return
    let raf1 = 0, raf2 = 0
    const t = window.setTimeout(() => {
      raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => doScrollToPlayground())
      })
    }, 350)
    return () => {
      clearTimeout(t)
      if (raf1) cancelAnimationFrame(raf1)
      if (raf2) cancelAnimationFrame(raf2)
    }
  }, [path, doScrollToPlayground])

  useEffect(() => {
    const origin = window.location.origin
    const setMeta = (sel, attr, val) => { const el = document.querySelector(sel); if (el) el.setAttribute(attr, val) }

    const isPrivacy = path === '/privacy'
    const isSupport = path === '/support'
    const title = isPrivacy
      ? 'Privacy Policy - Keeby'
      : isSupport
        ? 'Support - Keeby'
        : 'Keeby - Mechanical Keyboard Sounds for Mac'
    const desc = isPrivacy
      ? 'Keeby privacy policy. No data collected, no network access, fully offline.'
      : isSupport
        ? 'Get help with Keeby. Troubleshoot permissions, find the menu bar icon, and contact support.'
        : 'Satisfying mechanical keyboard sounds for your Mac. Spatial audio, reactive visualizer, customizable switch profiles.'
    const url = isPrivacy ? `${origin}/privacy` : isSupport ? `${origin}/support` : origin

    document.title = title
    setMeta('link[rel="canonical"]', 'href', url)
    setMeta('meta[name="description"]', 'content', desc)
    setMeta('meta[property="og:title"]', 'content', title)
    setMeta('meta[property="og:description"]', 'content', desc)
    setMeta('meta[property="og:url"]', 'content', url)
    setMeta('meta[property="og:image"]', 'content', `${origin}/opengraph-image.png`)
    setMeta('meta[name="twitter:title"]', 'content', title)
    setMeta('meta[name="twitter:description"]', 'content', desc)
    setMeta('meta[name="twitter:image"]', 'content', `${origin}/opengraph-image.png`)
  }, [path])

  // Defer the 15 MB demo MP4 until the video panel nears the viewport.
  useEffect(() => {
    if (path !== '/') return
    const targets = [demoContainerRef.current, demoMobileSectionRef.current].filter(Boolean)
    if (!targets.length) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setDemoVideoReady(true)
          observer.disconnect()
        }
      },
      { rootMargin: '240px' },
    )

    targets.forEach((node) => observer.observe(node))
    return () => observer.disconnect()
  }, [path])

  useEffect(() => {
    if (!demoVideoReady) return
    for (const ref of [demoVideoRef, demoVideoMobileRef]) {
      const video = ref.current
      if (video) void video.play().catch(() => {})
    }
  }, [demoVideoReady])

  useEffect(() => {
    let cancelled = false
    let primed = false
    let context = null

    const cleanup = () => {
      cancelled = true
      clickAudioContext.current = null
      clickAudioBuffers.current = { down: null, up: null }
      clickAudioFallback.current = { down: null, up: null }
      thockAudioBuffers.current = { down: null, up: null }
      thockAudioFallback.current = { down: null, up: null }
      context?.close().catch(() => {})
    }

    const prime = () => {
      if (primed || cancelled) return
      primed = true

      const mkAudio = (cfg) => {
        const a = new Audio(cfg.src)
        a.preload = 'auto'
        a.volume = cfg.volume
        a.load()
        return a
      }
      clickAudioFallback.current = {
        down: mkAudio(tapSoundConfig.down),
        up: mkAudio(tapSoundConfig.up),
      }
      thockAudioFallback.current = {
        down: mkAudio(thockSoundConfig.down),
        up: mkAudio(thockSoundConfig.up),
      }

      const AudioContextImpl = window.AudioContext || window.webkitAudioContext
      if (!AudioContextImpl) return

      context = new AudioContextImpl({ latencyHint: 'interactive' })
      clickAudioContext.current = context

      void (async () => {
        try {
          const fetchOne = (cfg) =>
            fetch(cfg.src, { cache: 'force-cache' }).then((r) => {
              if (!r.ok) throw new Error(`fetch ${cfg.src} ${r.status}`)
              return r.arrayBuffer()
            })
          const [tapDownBuf, tapUpBuf, thockDownBuf, thockUpBuf] = await Promise.all([
            fetchOne(tapSoundConfig.down),
            fetchOne(tapSoundConfig.up),
            fetchOne(thockSoundConfig.down),
            fetchOne(thockSoundConfig.up),
          ])
          const [tapDown, tapUp, thockDown, thockUp] = await Promise.all([
            context.decodeAudioData(tapDownBuf.slice(0)),
            context.decodeAudioData(tapUpBuf.slice(0)),
            context.decodeAudioData(thockDownBuf.slice(0)),
            context.decodeAudioData(thockUpBuf.slice(0)),
          ])
          if (cancelled) return
          clickAudioBuffers.current = { down: tapDown, up: tapUp }
          thockAudioBuffers.current = { down: thockDown, up: thockUp }
        } catch {
          // Preload failed; the HTML audio fallback in playClickSound handles it.
        }
      })()
    }

    window.addEventListener('pointerdown', prime, { once: true, passive: true })
    window.addEventListener('keydown', prime, { once: true })

    return () => {
      window.removeEventListener('pointerdown', prime)
      window.removeEventListener('keydown', prime)
      if (primed) cleanup()
      else cancelled = true
    }
  }, [])

  useEffect(() => {
    if (path === '/privacy' || path === '/support' || path === '/backdrop' || path === '/soundpad') return
    const obs = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add('visible') }),
      { threshold: 0.15 }
    )
    document.querySelectorAll('.reveal').forEach((el) => obs.observe(el))
    return () => obs.disconnect()
  }, [path])

  // Subscribe to lastKey only while the egg toast is up — avoids re-rendering App
  // on every keystroke.
  useEffect(() => {
    if (!eggToast) return
    return subscribeLastKey((val) => { if (val) setEggToast(false) })
  }, [eggToast])

  useEffect(() => {
    if (!keyboardSounds.activated) setEggToast(false)
  }, [keyboardSounds.activated])

  const primeAudioContext = useCallback(() => {
    const context = clickAudioContext.current
    if (context && context.state === 'suspended') {
      context.resume().catch(() => {})
    }
  }, [])

  const playTapSound = useCallback((direction) => {
    if (direction === 'down') {
      incrementThock()
      // Notify the globe immediately — clicks aren't keydowns, so the keyboard
      // subscription doesn't pick them up. This gives instant local feedback
      // before the round-trip broadcast comes back ~2s later.
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('keeby:user-thock'))
      }
    }

    const context = clickAudioContext.current
    const buffer = clickAudioBuffers.current[direction]

    if (context && buffer) {
      try {
        if (context.state === 'suspended') {
          context.resume().catch(() => {})
        }

        const source = context.createBufferSource()
        const gain = context.createGain()
        source.buffer = buffer
        gain.gain.value = tapSoundConfig[direction].volume
        source.connect(gain)
        gain.connect(context.destination)
        source.start()
        return
      } catch {
        // Web Audio path failed; fall through to the HTML audio fallback below.
      }
    }

    const fallback = clickAudioFallback.current[direction]
    const src = fallback?.src || tapSoundConfig[direction].src
    const audio = new Audio(src)
    audio.preload = 'auto'
    audio.volume = tapSoundConfig[direction].volume
    audio.play().catch(() => {})
  }, [incrementThock])

  // Plays the keyboard-switch sample (NovelKeys Cream alpha) for keeby-logo
  // "tap to thock" presses. Mirrors playTapSound — same AudioContext, same
  // side effects on 'down' (thock counter + globe sticker event), just a
  // different sample so the press feels like a mech key rather than a mouse.
  const playThockSound = useCallback((direction) => {
    if (direction === 'down') {
      incrementThock()
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('keeby:user-thock'))
      }
    }

    const context = clickAudioContext.current
    const buffer = thockAudioBuffers.current[direction]

    if (context && buffer) {
      try {
        if (context.state === 'suspended') {
          context.resume().catch(() => {})
        }
        const source = context.createBufferSource()
        const gain = context.createGain()
        source.buffer = buffer
        gain.gain.value = thockSoundConfig[direction].volume
        source.connect(gain)
        gain.connect(context.destination)
        source.start()
        return
      } catch {
        // Web Audio path failed; fall through to the HTML audio fallback below.
      }
    }

    const fallback = thockAudioFallback.current[direction]
    const src = fallback?.src || thockSoundConfig[direction].src
    const audio = new Audio(src)
    audio.preload = 'auto'
    audio.volume = thockSoundConfig[direction].volume
    audio.play().catch(() => {})
  }, [incrementThock])

  // `thock: true` swaps the button's press sound from the mouse-click sample
  // (Sibat) to a keyboard-switch sample (NovelKeys Cream alpha) — used by the
  // keeby-logo "tap to thock" buttons so they feel like pressing a key.
  // Buttons should also carry [data-keeby-thock] so the easter-egg's global
  // mousedown listener (in useKeyboardSounds) skips them too.
  const makePressHandlers = useCallback((setPressed, { thock = false } = {}) => {
    const playDown = thock ? () => playThockSound('down') : () => playTapSound('down')
    const playUp   = thock ? () => playThockSound('up')   : () => playTapSound('up')

    if (supportsPointerEvents) {
      return {
        onPointerDown: (event) => {
          if (event.button != null && event.button !== 0) return
          primeAudioContext()
          try {
            event.currentTarget.setPointerCapture?.(event.pointerId)
          } catch (error) {
            void error
          }
          setPressed(true)
          playDown()
        },
        onPointerUp: (event) => {
          setPressed(false)
          try {
            event.currentTarget.releasePointerCapture?.(event.pointerId)
          } catch (error) {
            void error
          }
          playUp()
        },
        onPointerCancel: (event) => {
          setPressed(false)
          try {
            event.currentTarget.releasePointerCapture?.(event.pointerId)
          } catch (error) {
            void error
          }
          playUp()
        },
        onClick: (event) => {
          if (event.detail === 0) {
            primeAudioContext()
            playDown()
          }
        },
      }
    }

    return {
      onMouseDown: (event) => {
        if (event.button !== 0) return
        primeAudioContext()
        setPressed(true)
        playDown()
      },
      onMouseUp: () => {
        setPressed(false)
        playUp()
      },
      onMouseLeave: () => {
        setPressed(false)
        playUp()
      },
      onTouchStart: () => {
        primeAudioContext()
        setPressed(true)
        playDown()
      },
      onTouchEnd: () => {
        setPressed(false)
        playUp()
      },
      onTouchCancel: () => {
        setPressed(false)
        playUp()
      },
      onClick: (event) => {
        if (event.detail === 0) {
          primeAudioContext()
          playDown()
        }
      },
    }
  }, [playTapSound, playThockSound, primeAudioContext, supportsPointerEvents])

  // Macbook dock Keeby icon — plays the hero gallery switch when typable,
  // otherwise falls back to the default thock sample.
  const makeHeroDockPressHandlers = useCallback((setPressed) => {
    const playDown = () => {
      if (!keyboardSounds.playHeroClick('down')) playThockSound('down')
    }
    const playUp = () => {
      if (!keyboardSounds.playHeroClick('up')) playThockSound('up')
    }

    if (supportsPointerEvents) {
      return {
        onPointerDown: (event) => {
          if (event.button != null && event.button !== 0) return
          primeAudioContext()
          try {
            event.currentTarget.setPointerCapture?.(event.pointerId)
          } catch (error) {
            void error
          }
          setPressed(true)
          playDown()
        },
        onPointerUp: (event) => {
          setPressed(false)
          try {
            event.currentTarget.releasePointerCapture?.(event.pointerId)
          } catch (error) {
            void error
          }
          playUp()
        },
        onPointerCancel: (event) => {
          setPressed(false)
          try {
            event.currentTarget.releasePointerCapture?.(event.pointerId)
          } catch (error) {
            void error
          }
          playUp()
        },
        onClick: (event) => {
          if (event.detail === 0) {
            primeAudioContext()
            playDown()
          }
        },
      }
    }

    return {
      onMouseDown: (event) => {
        if (event.button !== 0) return
        primeAudioContext()
        setPressed(true)
        playDown()
      },
      onMouseUp: () => {
        setPressed(false)
        playUp()
      },
      onMouseLeave: () => {
        setPressed(false)
        playUp()
      },
      onTouchStart: () => {
        primeAudioContext()
        setPressed(true)
        playDown()
      },
      onTouchEnd: () => {
        setPressed(false)
        playUp()
      },
      onTouchCancel: () => {
        setPressed(false)
        playUp()
      },
      onClick: (event) => {
        if (event.detail === 0) {
          primeAudioContext()
          playDown()
        }
      },
    }
  }, [keyboardSounds, playThockSound, primeAudioContext, supportsPointerEvents])

  const navigate = useCallback((to) => (e) => {
    e.preventDefault()
    window.history.pushState({}, '', to)
    setPath(to)
    scrollToTop()
  }, [scrollToTop])

  return (
    <div className="min-h-screen overflow-x-clip">
      <NotchVisualizer />
      <header className={`fixed top-0 left-0 right-0 z-50 px-4 pt-3 sm:px-5 sm:pt-4 md:px-10 ${path === '/pubmat' || path === '/backdrop' || path === '/soundpad' ? 'hidden' : ''}`}>
        <nav className="relative mx-auto flex w-full max-w-[1400px] items-center justify-between gap-3" aria-label="Main">
          <div className="flex items-center gap-5 sm:gap-6">
            <a href="/" onClick={navigate('/')} className="no-underline">
              <img src="/logo-text.webp" alt="Keeby" width="384" height="141" className="h-6 w-auto max-w-[40vw] sm:h-7 sm:max-w-none" />
            </a>
            <NavTopPaidLaurel />
          </div>
          {path !== '/windows' && <NavThockCounter />}
          <div className={`flex items-center gap-2 sm:gap-2.5 ${path === '/windows' ? 'hidden' : ''}`}>
          <div className="hidden sm:inline-flex">
            <NavSettingsDropdown />
          </div>
          <button
            type="button"
            onClick={scrollToPlayground}
            className="group relative overflow-hidden rounded-full bg-white text-[11px] font-semibold text-neutral-700 no-underline hidden sm:inline-flex sm:px-5 sm:py-2.5 sm:text-sm"
          >
            <span className="flex items-center gap-1.5 transition-all duration-300 group-hover:-translate-y-full group-hover:opacity-0 group-hover:blur-[6px] sm:gap-2">
              <svg className="h-3.5 w-3.5 text-neutral-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="12" rx="2.5"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M6 14h.01M8 14h8"/></svg>
              <span className="whitespace-nowrap">Try it</span>
            </span>
            <span className="absolute inset-0 flex items-center justify-center gap-1.5 translate-y-full transition-transform duration-300 group-hover:translate-y-0 sm:gap-2">
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>
              <span className="whitespace-nowrap">Try it</span>
            </span>
          </button>
          <DownloadButton variant="navbar" location="navbar" navigate={navigate} />
          </div>
        </nav>
      </header>

      <main>
      {path === '/pubmat' ? (
        <PubmatPage />
      ) : path === '/privacy' ? (
        <PrivacyPage />
      ) : path === '/support' ? (
        <SupportPage />
      ) : path === '/backdrop' ? (
        <BackdropPage />
      ) : path === '/soundpad' ? (
        <SoundPadPage />
      ) : path === '/windows' ? (
        <BuyPage />
      ) : (
        <>
      {/* Desktop: Horizontal scroll via vertical scrolling */}
      <HorizontalScroll panels={6} className="hidden lg:block">
      {/* Panel 1: Hero */}
      <section className="relative flex-shrink-0 w-full min-w-full h-full overflow-hidden flex items-center">
        {/* Hero - horizontal on desktop */}
        <div className="flex flex-col items-center text-center lg:flex-row lg:items-center lg:text-left w-full mx-auto [@media(min-width:1920px)]:max-w-[1400px]">
          {/* Right side - text (order-2 on desktop) */}
          <div className="flex flex-col items-center px-5 lg:px-0 lg:flex-1 lg:order-2 text-center">
            <div className="relative mb-10 -mt-2 fade-1 flex flex-col items-center gap-10">
              <span className="inline-flex items-center gap-2 text-base text-neutral-600">
                {EU_AVAILABILITY_LABEL}
                <span className="relative inline-flex h-2 w-2">
                  <span className="absolute inset-0 rounded-full bg-green-400 opacity-75 animate-ping" />
                  <span className="relative inline-block h-2 w-2 rounded-full bg-green-500" />
                </span>
              </span>
              <div className="flex flex-col items-center gap-2">
                <button
                  type="button"
                  {...makePressHandlers(noopSetPressed, { thock: true })}
              data-keeby-thock="true"
                  onClick={(e) => {
                    // Easter egg: tap logo 3 times to unlock
                    if (keyboardSounds.activated) return
                    eggTaps.current++
                    clearTimeout(eggTapTimer.current)
                    if (eggTaps.current >= 3) {
                      eggTaps.current = 0
                      keyboardSounds.activate()
                      capture('easter_egg_activated')
                      setEggToast(true)
                    } else {
                      eggTapTimer.current = setTimeout(() => { eggTaps.current = 0 }, 1500)
                    }
                  }}
                  className="tap-manipulation select-none w-20 h-auto cursor-pointer overflow-visible transition-transform duration-100 origin-bottom scale-100 active:scale-95"
                >
                  <img src="/keeby-logo.webp" alt="Keeby" width="312" height="312" className="pointer-events-none select-none w-full h-auto" draggable="false" />
                </button>
                <div className="flex items-center gap-1">
                  <DragAirplane
                    onGrab={() => { primeAudioContext(); playTapSound('down') }}
                    onRelease={() => playTapSound('up')}
                  />
                  <img src="/click-me.svg" alt="click me" width={120} height={36} className="h-9 w-auto opacity-40 select-none pointer-events-none" draggable="false" />
                </div>
              </div>
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-[-2px] leading-[1.05] max-w-lg mb-4 text-neutral-900 fade-2">
              Your keyboard,<br />but better.
            </h1>
            <p className="text-base text-neutral-600 max-w-xs leading-relaxed mb-8 fade-3">
              Mechanical keyboard sounds for Mac.
            </p>
            <DownloadButton variant="hero" location="hero" navigate={navigate} fadeClass="fade-3" />
            <p className="text-xs text-neutral-600 fade-4">{PRICE} · One-time purchase</p>
          </div>


          {/* MacBook - 10% bleed off left on smaller screens; flush next to text at 1920px+ (FHD and larger). Uses margin-left so the text column reclaims the bled space and stays balanced. On short viewports, lg:max-w caps the width so the aspect-locked MacBook shrinks vertically instead of covering the navbar (~140px buffer: navbar + breathing room + bottom bezel/shadow). */}
          <div className="relative w-full fade-5 mt-8 px-4 lg:order-1 lg:w-[65%] lg:max-w-[calc((100dvh_-_140px)_*_1.6)] lg:self-end lg:px-0 lg:ml-[-6.5vw] [@media(min-width:1920px)]:ml-0 [--macbook-radius:12px] [--macbook-bezel:4px] sm:[--macbook-radius:14px] sm:[--macbook-bezel:6px] md:[--macbook-radius:16px] md:[--macbook-bezel:8px] lg:[--macbook-radius:20px] lg:[--macbook-bezel:10px]">
          <div className="relative bg-black" style={{ ...macBookTopRadiusStyle, padding: 'var(--macbook-bezel)', paddingBottom: 0 }}>
            {/* Notch SVG - same height as menu bar (30px) */}
            <div className="absolute left-1/2 z-30 h-[16px] w-[96px] -translate-x-1/2 sm:h-[30px] sm:w-[198px]" style={{ top: 'calc(var(--macbook-bezel) - 1px)' }}>
              <img src="/notch.svg" alt="" className="w-full h-full" />
              {/* Notch indicator — switch dot + typed key. Dot tracks the hero
                  gallery selection (heroSwitchIndex), independent of the typing
                  playground's profileIndex. */}
              <div className="absolute inset-0 flex items-center justify-between px-1.5 sm:px-4">
                <HeroNotchSwitchDot />
                <div className="hidden sm:flex items-center justify-center shrink-0">
                  <NotchKeyCap />
                </div>
              </div>
            </div>
            <div
              className="relative overflow-hidden"
              style={{
                aspectRatio: '16/10',
                borderTopLeftRadius: macBookInnerRadius,
                borderTopRightRadius: macBookInnerRadius,
              }}
            >
              <img src="/macos-wallpaper.webp" alt="" width={1200} height={800} fetchPriority="high" decoding="sync" className="absolute inset-0 w-full h-full object-cover object-[34%_center]" />

              {/* Menu bar - clean mock */}
              <div className="relative z-10 flex h-[18px] items-center justify-between bg-black/25 px-2 backdrop-blur-[22px] sm:h-[30px] sm:px-5 sm:backdrop-blur-[40px]">
                <div className="flex items-center gap-2 sm:gap-5">
                  <svg className="h-[10px] w-[8px] opacity-80 sm:h-[15px] sm:w-[13px]" viewBox="0 0 17 20" fill="white"><path d="M12.15 0c.12 1.17-.35 2.33-1.05 3.17-.71.84-1.85 1.5-2.97 1.41-.14-1.13.36-2.33 1.03-3.07C9.87.67 11.06.06 12.15 0zm3.56 6.82c-.09.05-2.12 1.22-2.1 3.63.02 2.88 2.54 3.87 2.57 3.88-.02.07-.4 1.37-1.33 2.72-.82 1.17-1.67 2.34-3.01 2.36-1.32.02-1.74-.78-3.25-.78s-1.99.76-3.24.8c-1.29.04-2.27-1.27-3.1-2.43C.55 14.72-.73 10.2 1.03 7.14c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.49.87 3.27.87.78 0 2.24-1.07 3.77-.91.64.03 2.45.26 3.61 1.95l-.09.08z"/></svg>
                  <div className="h-[3px] w-[16px] rounded-full bg-white/30 sm:h-[5px] sm:w-[28px]" />
                  <div className="h-[3px] w-[11px] rounded-full bg-white/20 sm:h-[5px] sm:w-[18px]" />
                  <div className="h-[3px] w-[14px] rounded-full bg-white/20 sm:h-[5px] sm:w-[22px]" />
                  <div className="h-[3px] w-[9px] rounded-full bg-white/20 sm:h-[5px] sm:w-[16px]" />
                </div>
                <div className="flex items-center gap-1.5 sm:gap-3">
                  <div className="h-[2.5px] w-[2.5px] rounded-full bg-white/30 sm:h-[5px] sm:w-[5px]" />
                  <div className="h-[2.5px] w-[2.5px] rounded-full bg-white/30 sm:h-[5px] sm:w-[5px]" />
                  <div className="h-[2.5px] w-[12px] rounded-full bg-white/25 sm:h-[5px] sm:w-[20px]" />
                  {/* Keeby tray icon */}
                  <img src="/keeby-icon.svg" alt="" className={`h-[11px] w-[11px] rounded-[3px] sm:h-[16px] sm:w-[16px] transition-all duration-500 ${keyboardSounds.activated ? '' : 'brightness-0 invert opacity-70'}`} />
                  <div className="h-[2.5px] w-[20px] rounded-full bg-white/30 sm:h-[5px] sm:w-[36px]" />
                </div>
              </div>


              {/* Dock - just Keeby + placeholders */}
              <div className="absolute bottom-1 left-1/2 z-10 -translate-x-1/2 sm:bottom-3">
                <div className="flex items-center gap-0 rounded-[8px] border border-white/15 bg-white/12 px-0.5 py-0.5 shadow-[0_4px_24px_rgba(0,0,0,0.2)] backdrop-blur-[18px] sm:gap-0 sm:rounded-[14px] sm:px-0.5 sm:py-0.5 sm:backdrop-blur-[40px]">
                  {/* Finder */}
                  <img src="/finder-icon.webp" alt="Finder" width={144} height={144} className="h-10 w-10 sm:h-12 sm:w-12 rounded-[8px] sm:rounded-[12px] pointer-events-none select-none object-contain" draggable="false" />
                  {/* Safari */}
                  <img src="/safari-icon.webp" alt="Safari" width={144} height={144} className="h-10 w-10 sm:h-12 sm:w-12 rounded-[8px] sm:rounded-[12px] pointer-events-none select-none object-contain scale-[0.9]" draggable="false" />
                  {/* Settings */}
                  <img src="/settings-icon.webp" alt="Settings" width={144} height={144} className="h-10 w-10 sm:h-12 sm:w-12 rounded-[8px] sm:rounded-[12px] pointer-events-none select-none object-contain" draggable="false" />
                  {/* Divider */}
                  <div className="mx-0.5 h-8 w-px bg-white/15 sm:mx-1 sm:h-10" />
                  {/* Keeby - clickable */}
                  <button
                    type="button"
                    {...makeHeroDockPressHandlers(setKeyPressed)}
                    data-keeby-thock="true"
                    className={`tap-manipulation select-none h-10 w-10 overflow-hidden rounded-[8px] sm:h-12 sm:w-12 sm:rounded-[12px] transition-transform duration-100 cursor-pointer scale-[0.9] ${keyPressed ? '!scale-[0.85]' : 'hover:!scale-[0.95]'}`}
                    title="Press to hear a key click"
                  >
                    <img src="/keeby-logo.webp" alt="Keeby" width={312} height={312} className="pointer-events-none select-none h-full w-full object-cover" draggable="false" />
                  </button>
                </div>
              </div>
            </div>
          </div>
          {/* MacBook base */}
          <div className="relative h-4 -mx-6 bg-gradient-to-b from-[#d6d6d6] to-[#bbb] sm:h-4 sm:-mx-10" style={macBookBottomRadiusStyle}>
            <div className="absolute left-1/2 top-0 h-[2px] w-24 -translate-x-1/2 rounded-b bg-black/[0.05] sm:h-[3px] sm:w-36" />
          </div>
          <div className="mx-auto h-4 w-[75%] bg-[radial-gradient(ellipse,rgba(0,0,0,0.05),transparent_70%)] sm:h-5" />

          {/* Mobile dropdown intro */}
          <div className="mt-8 mb-4 px-4 text-center sm:hidden">
            <h2 className="text-[15px] font-bold text-neutral-900 mb-1">All from your menu bar</h2>
            <p className="text-[13px] text-neutral-600 leading-snug max-w-[260px] mx-auto">Switch profiles, tweak the tone, and toggle the visualizer in one click.</p>
          </div>

          {/* Keeby dropdown menu */}
          <div className="relative overflow-hidden rounded-2xl mt-4 mx-4 sm:contents">
            {/* Mobile showcase background */}
            <div className="absolute inset-0 sm:hidden">
              <img src="/macos-wallpaper.webp" alt="" width={1200} height={800} loading="lazy" decoding="async" className="h-full w-full object-cover object-[34%_center]" />
              <div className="absolute inset-0 bg-black/70" />
            </div>
            {/* Mini menu bar - mobile only */}
            <div className="relative z-10 flex h-7 items-center justify-between bg-black/30 px-3 backdrop-blur-md sm:hidden">
              <div className="flex items-center gap-2.5">
                <svg className="h-[10px] w-[9px] opacity-70" viewBox="0 0 17 20" fill="white"><path d="M12.15 0c.12 1.17-.35 2.33-1.05 3.17-.71.84-1.85 1.5-2.97 1.41-.14-1.13.36-2.33 1.03-3.07C9.87.67 11.06.06 12.15 0zm3.56 6.82c-.09.05-2.12 1.22-2.1 3.63.02 2.88 2.54 3.87 2.57 3.88-.02.07-.4 1.37-1.33 2.72-.82 1.17-1.67 2.34-3.01 2.36-1.32.02-1.74-.78-3.25-.78s-1.99.76-3.24.8c-1.29.04-2.27-1.27-3.1-2.43C.55 14.72-.73 10.2 1.03 7.14c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.49.87 3.27.87.78 0 2.24-1.07 3.77-.91.64.03 2.45.26 3.61 1.95l-.09.08z"/></svg>
                <div className="h-[4px] w-[16px] rounded-full bg-white/25" />
                <div className="h-[4px] w-[12px] rounded-full bg-white/18" />
                <div className="h-[4px] w-[10px] rounded-full bg-white/18" />
              </div>
              <div className="flex items-center gap-2">
                <div className="h-[3.5px] w-[3.5px] rounded-full bg-white/25" />
                <div className="h-[3.5px] w-[3.5px] rounded-full bg-white/25" />
                <div className="h-[4px] w-[12px] rounded-full bg-white/18" />
                <img src="/keeby-icon.svg" alt="" className="h-[14px] w-[14px] rounded-[3px]" />
                <div className="h-[4px] w-[16px] rounded-full bg-white/25" />
              </div>
            </div>
            <div className="relative z-20 flex w-full flex-col items-center gap-1.5 px-4 py-3 text-left sm:absolute sm:left-auto sm:right-[67px] sm:top-[37px] sm:block sm:w-[210px] sm:p-0">
            {/* Main dropdown */}
            <div className={`${menuPanelFrame} ${menuPanelMain} h-fit w-full max-w-[220px] sm:w-[210px]`} style={menuPanelBlurStyle}>
              <div className={menuPanelGloss} />
              <div className={menuContent}>
                <div className={menuSection}>Control</div>
                <div className={menuRow}>
                  <CircleCheckBig className="w-[14px] h-[14px] text-white/60" />
                  <span>Enable Keeby</span>
                </div>
                <div className={menuDivider} />
                <div className={menuSection}>Configure</div>
                <div className={menuRow}>
                  <SlidersHorizontal className="w-[14px] h-[14px] text-white/55" />
                  <span>Sound</span>
                </div>
                <div className={`${menuRow} ${menuRowSelected}`}>
                  <Keyboard className="w-[14px] h-[14px]" />
                  <span>Switches</span>
                  <ChevronRight className="ml-auto w-3 h-3 opacity-70" />
                </div>
                <div className={menuRow}>
                  <CircleCheckBig className="w-[14px] h-[14px] text-white/60" />
                  <span>Enable Visualizer</span>
                </div>
                <div className={menuRow}>
                  <LayoutGrid className="w-[14px] h-[14px] text-white/55" />
                  <span>Position</span>
                  <ChevronRight className="ml-auto w-3 h-3 text-white/25" />
                </div>
                <div className={menuDivider} />
                <div className={menuSection}>App</div>
                <div className={menuRow}>
                  <Settings className="w-[14px] h-[14px] text-white/55" />
                  <span>Settings...</span>
                  <span className={menuShortcut}>⌘,</span>
                </div>
                <div className={menuRow}>
                  <XCircle className="w-[14px] h-[14px] text-white/55" />
                  <span>Quit Keeby</span>
                  <span className={menuShortcut}>⌘Q</span>
                </div>
              </div>
            </div>

            {/* Notes window — left of Switches */}
            <NotesWindow />

            {/* Switches submenu */}
            <div className="sm:absolute sm:right-[calc(100%+6px)] sm:top-[52px] sm:w-[220px] w-full max-w-[220px]">
            <div className={`${menuPanelFrame} ${menuPanelSub} h-fit w-full`} style={menuPanelBlurStyle}>
              <div className={menuPanelGloss} />
              <div className={menuContent}>
                <HeroSwitchSubmenu
                  activated={keyboardSounds.activated}
                  onSelect={handleHeroSwitchSelect}
                />
              </div>
            </div>
            <img src="/select-switches.svg" alt="select switches" className="mt-2 h-9 w-auto mx-auto select-none pointer-events-none opacity-40" draggable="false" />
            </div>
          </div>
          </div>
        </div>
        </div>
      </section>

      {/* Panel 2: Features */}
      <section className="flex-shrink-0 w-full min-w-full h-full snap-start flex items-center" id="features">
        <div className="grid grid-cols-5 grid-rows-2 gap-4 w-full mx-auto [@media(min-width:1920px)]:max-w-[1400px]">

          {/* Spatial Audio */}
          <div className="bg-white rounded-3xl p-8 border border-black/[0.04] text-center reveal">
            <div className="h-24 flex items-center justify-center gap-4 mb-5">
              {['L', 'R'].map((label, si) => (
                <div key={label} className="flex flex-col items-center gap-1">
                  <div className="relative">
                    <svg width="52" height="68" viewBox="0 0 52 68" fill="none">
                      <rect x="1" y="1" width="50" height="66" rx="8" fill="#e8e8e8" stroke="#ddd" strokeWidth="1"/>
                      <circle cx="26" cy="20" r="7" fill="#ddd"/><circle cx="26" cy="20" r="3.5" fill="#e3e3e3"/><circle cx="26" cy="20" r="1.2" fill="#d0d0d0"/>
                      <circle cx="26" cy="46" r="13" fill="#d4d4d4"/><circle cx="26" cy="46" r="9" fill="#ddd"/><circle cx="26" cy="46" r="4.5" fill="#e2e2e2"/><circle cx="26" cy="46" r="2" fill="#d0d0d0"/>
                    </svg>
                    {[0, 1, 2].map(i => (
                      <div key={i} className="absolute rounded-full border-[1.5px] border-[#FF8C17] pointer-events-none z-20"
                        style={{ top: '50%', left: '50%', width: 52, height: 52, transform: 'translate(-50%, -50%)',
                          animation: `ringAlt${si === 0 ? 'L' : 'R'} 3.2s ease-out ${i * 0.25}s infinite`, opacity: 0 }} />
                    ))}
                  </div>
                  <span className="text-[10px] font-semibold text-neutral-300 tracking-wide">{label}</span>
                </div>
              ))}
            </div>
            <h2 className="text-[15px] font-bold text-neutral-900 mb-1">Spatial Audio</h2>
            <p className="text-[13px] text-neutral-600 leading-snug">Left keys play from your left speaker, right from right.</p>
          </div>

          {/* Reactive Visualizer */}
          <div className="bg-white rounded-3xl p-8 border border-black/[0.04] text-center reveal" style={{ transitionDelay: '0.05s' }}>
            <div className="h-24 flex items-center justify-center mb-5">
              <VisualizerIllustration />
            </div>
            <h2 className="text-[15px] font-bold text-neutral-900 mb-1">Reactive Visualizer</h2>
            <p className="text-[13px] text-neutral-600 leading-snug">A mini keyboard follows your cursor, lighting up keys.</p>
          </div>

          {/* Low Latency */}
          <div className="bg-white rounded-3xl p-8 border border-black/[0.04] text-center reveal" style={{ transitionDelay: '0.1s' }}>
            <div className="h-24 flex items-center justify-center mb-5">
              <LatencyIllustration />
            </div>
            <h2 className="text-[15px] font-bold text-neutral-900 mb-1">Low Latency</h2>
            <p className="text-[13px] text-neutral-600 leading-snug">Lock-free audio engine with 128-frame buffer playback.</p>
          </div>

          {/* Real Recordings */}
          <div className="bg-white rounded-3xl border border-black/[0.04] text-center reveal overflow-hidden" style={{ transitionDelay: '0.15s' }}>
            <div className="h-24 flex items-center justify-center mt-8">
              <div className="relative w-full h-[60px] overflow-hidden">
                <div className="absolute left-1/2 top-0 bottom-0 w-[2px] bg-[#FF8C17] z-10 -translate-x-1/2 rounded-full" />
                <div className="absolute top-0 bottom-0 flex items-center animate-[waveMarquee_18s_linear_infinite]">
                  {[0, 1].map(copy => {
                    const wave = [4,12,24,8,32,14,6,20,36,10,4,18,28,6,14,26,8,4,16,38,12,6,22,8,4,10,20,34,14,6,18,30,10,4,24,12,8,16,26,6,8,30,18,4,10,22,36,6,14,28,8,4,20,32,12,6,16,24,10,4,38,8,14,26,6,18,34,4,12,22,30,8,10,6,20,28,16,4,36,14,8,24,12,6,32,10,18,4,26,22,8,14,38,6,20,30,4,12,16,10,4,8,28,18,6,34,12,24,14,4,36,10,22,8,20,6,32,16,26,4,14,30,12,8,18,38,6,10,24,4,28,20,14,8,34,6,16,22,12,4]
                    return (
                      <div key={copy} className="flex items-center gap-[2px] shrink-0 pr-[2px]">
                        {wave.map((h, i) => (
                          <div key={i} className="w-[2px] rounded-full shrink-0" style={{ height: h, background: '#ddd' }} />
                        ))}
                      </div>
                    )
                  })}
                </div>
                <div className="absolute inset-0 z-[5] pointer-events-none" style={{ background: 'linear-gradient(to right, white 0%, transparent 12%, rgba(255,255,255,0.3) 45%, rgba(255,255,255,0.65) 65%, rgba(255,255,255,0.85) 80%, white 100%)' }} />
              </div>
            </div>
            <div className="px-8 pb-8 pt-5">
              <h2 className="text-[15px] font-bold text-neutral-900 mb-1">Real Recordings</h2>
              <p className="text-[13px] text-neutral-600 leading-snug">Captured from actual mechanical switches, not synthesized.</p>
            </div>
          </div>

          {/* Up/Down Keystrokes */}
          <div className="bg-white rounded-3xl p-8 border border-black/[0.04] text-center reveal" style={{ transitionDelay: '0.2s' }}>
            <div className="h-24 flex items-center justify-center gap-2 mb-5">
              {/* Key down */}
              <div className="flex flex-col items-center gap-1">
                <svg width="48" height="56" viewBox="0 0 48 56" fill="none">
                  <rect x="4" y="16" width="40" height="36" rx="8" fill="#d4d4d4"/>
                  <rect x="4" y="8" width="40" height="36" rx="8" fill="#e8e8e8" stroke="#ddd" strokeWidth="1" className="animate-[keyDown_1.6s_ease-in-out_infinite]"/>
                  <path d="M24 19v14M17 27l7 7 7-7" stroke="#ccc" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-[keyDown_1.6s_ease-in-out_infinite]"/>
                </svg>
                <span className="text-[9px] font-semibold text-neutral-300 uppercase tracking-wider">Down</span>
              </div>
              {/* Key up */}
              <div className="flex flex-col items-center gap-1">
                <svg width="48" height="56" viewBox="0 0 48 56" fill="none">
                  <rect x="4" y="16" width="40" height="36" rx="8" fill="#d4d4d4"/>
                  <rect x="4" y="8" width="40" height="36" rx="8" fill="#e8e8e8" stroke="#ddd" strokeWidth="1" className="animate-[keyUp_1.6s_ease-in-out_0.8s_infinite]"/>
                  <path d="M24 33V19M17 25l7-7 7 7" stroke="#FF8C17" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.5" className="animate-[keyUp_1.6s_ease-in-out_0.8s_infinite]"/>
                </svg>
                <span className="text-[9px] font-semibold text-neutral-300 uppercase tracking-wider">Up</span>
              </div>
            </div>
            <h2 className="text-[15px] font-bold text-neutral-900 mb-1">Up/Down Keystrokes</h2>
            <p className="text-[13px] text-neutral-600 leading-snug">Separate sounds for every key press and key release.</p>
          </div>

          {/* Tone Control */}
          <div className="bg-white rounded-3xl p-8 border border-black/[0.04] text-center reveal" style={{ transitionDelay: '0.25s' }}>
            <div className="h-24 flex items-center justify-center mb-5">
              <svg width="160" height="56" viewBox="0 0 80 56" fill="none">
                <line x1="8" y1="14" x2="72" y2="14" stroke="#e8e8e8" strokeWidth="3" strokeLinecap="round"/>
                <line x1="8" y1="28" x2="72" y2="28" stroke="#e8e8e8" strokeWidth="3" strokeLinecap="round"/>
                <line x1="8" y1="42" x2="72" y2="42" stroke="#e8e8e8" strokeWidth="3" strokeLinecap="round"/>
                <circle cx="28" cy="14" r="5.5" fill="#ddd" className="animate-[sliderDrift_3s_ease-in-out_infinite]"/>
                <circle cx="52" cy="28" r="5.5" fill="#FF8C17" opacity="0.5" className="animate-[sliderDrift_3.5s_ease-in-out_0.4s_infinite]"/>
                <circle cx="36" cy="42" r="5.5" fill="#ddd" className="animate-[sliderDrift_2.8s_ease-in-out_0.8s_infinite]"/>
              </svg>
            </div>
            <h2 className="text-[15px] font-bold text-neutral-900 mb-1">Tone Control</h2>
            <p className="text-[13px] text-neutral-600 leading-snug">Drag between thock and clack with the 2D tone pad.</p>
          </div>

          {/* Randomized Pitching */}
          <div className="bg-white rounded-3xl border border-black/[0.04] text-center reveal overflow-hidden" style={{ transitionDelay: '0.3s' }}>
            <div className="h-24 flex items-center justify-center mt-8">
              <PitchIllustration />
            </div>
            <div className="px-8 pb-8 pt-5">
              <h2 className="text-[15px] font-bold text-neutral-900 mb-1">Randomized Pitching</h2>
              <p className="text-[13px] text-neutral-600 leading-snug">Subtle pitch variation ensures no two clicks sound same.</p>
            </div>
          </div>

          {/* Menu Bar App */}
          <div className="bg-white rounded-3xl p-8 border border-black/[0.04] text-center reveal" style={{ transitionDelay: '0.35s' }}>
            <div className="h-24 flex items-center justify-center mb-5">
              <div className="w-full max-w-[200px]">
                <div className="flex items-center h-[32px] bg-[#e8e8e8] rounded-[8px] px-3 gap-[10px]">
                  {/* Apple logo */}
                  <svg width="10" height="12" viewBox="0 0 17 20" fill="#ccc"><path d="M12.15 0c.12 1.17-.35 2.33-1.05 3.17-.71.84-1.85 1.5-2.97 1.41-.14-1.13.36-2.33 1.03-3.07C9.87.67 11.06.06 12.15 0zm3.56 6.82c-.09.05-2.12 1.22-2.1 3.63.02 2.88 2.54 3.87 2.57 3.88-.02.07-.4 1.37-1.33 2.72-.82 1.17-1.67 2.34-3.01 2.36-1.32.02-1.74-.78-3.25-.78s-1.99.76-3.24.8c-1.29.04-2.27-1.27-3.1-2.43C.55 14.72-.73 10.2 1.03 7.14c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.49.87 3.27.87.78 0 2.24-1.07 3.77-.91.64.03 2.45.26 3.61 1.95l-.09.08z"/></svg>
                  {/* Menu items */}
                  <div className="w-[16px] h-[4px] rounded-full bg-[#d4d4d4]" />
                  <div className="w-[12px] h-[4px] rounded-full bg-[#d4d4d4]" />
                  <div className="w-[14px] h-[4px] rounded-full bg-[#d4d4d4]" />
                  <div className="flex-1" />
                  {/* Tray icons */}
                  <div className="w-[4px] h-[4px] rounded-full bg-[#d4d4d4]" />
                  <div className="w-[4px] h-[4px] rounded-full bg-[#d4d4d4]" />
                  <div className="w-[10px] h-[4px] rounded-full bg-[#d4d4d4]" />
                  {/* Keeby icon in tray */}
                  <img src="/keeby-icon.svg" alt="" className="w-[18px] h-[18px] rounded-[4px] animate-[pulse_3s_ease-in-out_infinite]" />
                </div>
              </div>
            </div>
            <h2 className="text-[15px] font-bold text-neutral-900 mb-1">Menu Bar App</h2>
            <p className="text-[13px] text-neutral-600 leading-snug">Lives quietly in your menu bar, one click to control.</p>
          </div>

          {/* Mouse Click Sounds */}
          <div className="bg-white rounded-3xl p-8 border border-black/[0.04] text-center reveal" style={{ transitionDelay: '0.4s' }}>
            <div className="h-24 flex items-center justify-center mb-5">
              <svg width="56" height="88" viewBox="0 0 56 88" fill="none">
                <rect x="4" y="4" width="48" height="80" rx="24" fill="#e8e8e8" stroke="#ddd" strokeWidth="1"/>
                <line x1="28" y1="4" x2="28" y2="38" stroke="#ddd" strokeWidth="1"/>
                <rect x="5" y="5" width="23" height="32" rx="12" className="animate-[mouseClick_2s_ease-in-out_infinite]" style={{ fill: '#e0e0e0' }}/>
                <rect x="28" y="5" width="23" height="32" rx="12" className="animate-[mouseClick_2s_ease-in-out_1s_infinite]" style={{ fill: '#e0e0e0' }}/>
                <rect x="25" y="14" width="6" height="12" rx="3" fill="#d4d4d4"/>
              </svg>
            </div>
            <h2 className="text-[15px] font-bold text-neutral-900 mb-1">Mouse Click Sounds</h2>
            <p className="text-[13px] text-neutral-600 leading-snug">Satisfying clicks on every left, right, and middle press.</p>
          </div>

          {/* Completely Private */}
          <div className="bg-white rounded-3xl p-8 border border-black/[0.04] text-center reveal" style={{ transitionDelay: '0.45s' }}>
            <div className="h-24 flex items-center justify-center mb-5">
              <svg width="78" height="102" viewBox="0 0 52 68" fill="none">
                {/* Shackle - behind lock body, starts lower */}
                <path d="M14 36V22a12 12 0 1124 0v14" stroke="#d4d4d4" strokeWidth="4" strokeLinecap="round" fill="none" className="animate-[shackleJiggle_3s_ease-in-out_infinite]"/>
                {/* Lock body - on top */}
                <rect x="6" y="32" width="40" height="32" rx="8" fill="#e5e5e5"/>
                {/* Keyhole */}
                <circle cx="26" cy="46" r="4.5" fill="#FF8C17" opacity="0.4" className="animate-[pulse_2s_ease-in-out_infinite]"/>
                <circle cx="26" cy="46" r="2.5" fill="#FF8C17" opacity="0.6"/>
                <line x1="26" y1="50.5" x2="26" y2="56" stroke="#FF8C17" strokeWidth="2.5" strokeLinecap="round" opacity="0.4"/>
              </svg>
            </div>
            <h2 className="text-[15px] font-bold text-neutral-900 mb-1">Completely Private</h2>
            <p className="text-[13px] text-neutral-600 leading-snug">No data collected, no network access, fully offline app.</p>
          </div>
        </div>
      </section>

      {/* Panel 3: Typing Playground */}
      <section
        id="playground"
        className="flex-shrink-0 w-full min-w-full h-full snap-start flex items-center justify-center px-6 lg:px-10"
      >
        <Suspense fallback={<LazySectionFallback />}>
          <TypingPlayground keyboardSounds={keyboardSounds} onCenterInView={doScrollToPlayground} hideSwitchPicker={hideSwitchPicker} zenMode={zenMode} />
        </Suspense>
      </section>

      {/* Panel 4: Video Demo */}
      <section className="flex-shrink-0 w-full min-w-full h-full snap-start flex flex-col items-center justify-center">
        <div
          ref={demoContainerRef}
          className="relative w-full max-w-[780px] [--macbook-radius:16px] [--macbook-bezel:8px]"
          onMouseMove={(e) => {
            const rect = demoContainerRef.current?.getBoundingClientRect()
            if (rect) {
              demoCursorTarget.current.x = e.clientX - rect.left
              demoCursorTarget.current.y = e.clientY - rect.top
              if (!demoCursorVisible.current) {
                demoCursorVisible.current = true
                demoCursorPos.current.x = demoCursorTarget.current.x
                demoCursorPos.current.y = demoCursorTarget.current.y
                const el = demoCapsuleRef.current
                if (el) { el.style.opacity = '1'; el.style.filter = 'blur(0px)'; el.style.transform = 'translate(-50%, -50%) scale(1)' }
              }
            }
          }}
          onMouseEnter={() => {
            demoCursorVisible.current = true
            const el = demoCapsuleRef.current
            if (el) { el.style.opacity = '1'; el.style.filter = 'blur(0px)'; el.style.transform = 'translate(-50%, -50%) scale(1)' }
          }}
          onMouseLeave={() => {
            demoCursorVisible.current = false
            const el = demoCapsuleRef.current
            if (el) { el.style.opacity = '0'; el.style.filter = 'blur(8px)'; el.style.transform = 'translate(-50%, -50%) scale(0.85)' }
          }}
          onClick={() => { const v = demoVideoRef.current; if (v) { v.muted = !v.muted; setDemoMuted(v.muted) } }}
        >
          {/* Floating caption — sits off the left edge of the macbook, same
              absolute-offset idiom as the Himanshu credit beside the visual
              keyboard in the playground. */}
          <div className="absolute right-full top-1/2 mr-8 w-[220px] text-right pointer-events-none tracking-tight" style={{ transform: 'translateY(calc(-50% - 40px))' }}>
            <div className="flex items-center justify-end gap-0.5 mb-7">
              {[0, 0.18, 0.36, 0.54].map((delay, i) => (
                <img
                  key={i}
                  src="/keeby-logo.webp"
                  alt=""
                  aria-hidden="true"
                  width={312}
                  height={312}
                  className="keeby-loader-dot h-5 w-5"
                  style={{ animationDelay: `${delay}s` }}
                />
              ))}
            </div>
            <h2 className="text-2xl lg:text-3xl font-extrabold tracking-[-1.5px] text-neutral-900 leading-[1.05] whitespace-nowrap">See it in action</h2>
            <p className="mt-2 text-[13px] lg:text-sm text-neutral-600 leading-[1.3]">Unmute it. Every click, every keystroke is Keeby running quietly underneath.</p>
          </div>

          {/* Floating SoundPad on the right edge of the macbook — mirrors the
              caption's `right-full ... mr-8` idiom on the left. Desktop only;
              the mobile demo panel stacks vertically and a side-mounted pad
              would crowd the layout. The "Shape the sound" heading sits above
              the pad to invite interaction, mirroring the "See it in action"
              caption on the opposite side. */}
          <div className="absolute left-full top-1/2 ml-8 hidden lg:block z-30 pointer-events-none flex flex-col items-start" style={{ transform: 'translateY(-50%)' }}>
            <div className="mb-4 w-[260px] tracking-tight">
              <h2 className="text-2xl lg:text-3xl font-extrabold tracking-[-1.5px] text-neutral-900 leading-[1.05] whitespace-nowrap">Shape the sound</h2>
              <p className="mt-2 text-[13px] lg:text-sm text-neutral-600 leading-[1.3]">Drag the knob to tune Thock and Clack. Pick a switch and try it out.</p>
              <p className="mt-2 text-[11px] lg:text-xs text-neutral-400 leading-[1.3]">Note: the recorded switch sound profiles ship with the commercial app and are not included in this public sample, so the pad is silent here.</p>
            </div>
            <div className="pointer-events-auto" onClick={(e) => e.stopPropagation()}>
              <Suspense fallback={<LazySectionFallback />}>
                <SoundPad />
              </Suspense>
            </div>
          </div>
          <div className="relative bg-black lg:cursor-none" style={{ ...macBookTopRadiusStyle, padding: 'var(--macbook-bezel)', paddingBottom: 0 }}>
            <div className="relative overflow-hidden" style={{ aspectRatio: '2560/1664', borderTopLeftRadius: macBookInnerRadius, borderTopRightRadius: macBookInnerRadius }}>
              <video
                ref={demoVideoRef}
                src={demoVideoReady ? '/keeby-demo.mp4' : undefined}
                poster="/demo-poster.webp"
                preload="none"
                autoPlay
                loop
                muted
                playsInline
                className="absolute inset-0 w-full h-full object-cover"
              />
              {/* Floating capsule cursor — clipped to screen area */}
              <div
                ref={demoCapsuleRef}
                className="pointer-events-none absolute z-50 hidden lg:flex items-center gap-1.5 rounded-full bg-black/80 backdrop-blur-md px-4 py-2 text-[12px] font-medium text-white shadow-lg will-change-transform whitespace-nowrap"
                style={{
                  left: 0,
                  top: 0,
                  transform: 'translate(-50%, -50%) scale(0.85)',
                  opacity: 0,
                  filter: 'blur(8px)',
                  transition: 'opacity 0.25s ease, transform 0.25s ease, filter 0.25s ease',
                }}
              >
                {demoMuted ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07"/></svg>
                )}
                {demoMuted ? 'Click to unmute' : 'Click to mute'}
              </div>
            </div>
          </div>
          <div className="relative h-4 -mx-10 bg-gradient-to-b from-[#d6d6d6] to-[#bbb]" style={macBookBottomRadiusStyle}>
            <div className="absolute left-1/2 top-0 h-[3px] w-36 -translate-x-1/2 rounded-b bg-black/[0.05]" />
          </div>
          <div className="flex justify-between items-start mt-6">
            <span className="block text-xs text-neutral-600 max-w-[280px] leading-[1.3] tracking-tight">This .com exists because <a href="https://x.com/emirayaaz" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 align-middle text-neutral-600 underline decoration-neutral-300 hover:text-neutral-900 transition-colors"><img src="/emir.webp" alt="Emir Ayaz" width={32} height={32} className="h-4 w-4 rounded-full object-cover" />Emir</a> from <a href="https://x.com/witharc_co" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 align-middle text-neutral-600 underline decoration-neutral-300 hover:text-neutral-900 transition-colors"><img src="/arc.webp" alt="Arc" width={32} height={32} className="h-4 w-4 rounded-full object-cover" />Arc</a> believed in the thock. Legend.</span>
            <div className="flex items-center gap-2">
            {demoMuted && <span className="text-[12px] text-neutral-600 animate-[nudgeRight_0.8s_ease-in-out_infinite]">Listen to it &rarr;</span>}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); const v = demoVideoRef.current; if (v) { v.muted = !v.muted; setDemoMuted(v.muted) } }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-neutral-100 hover:bg-neutral-200 transition-colors text-[12px] font-medium text-neutral-600 cursor-pointer"
            >
              {demoMuted ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07"/></svg>
              )}
              {demoMuted ? 'Unmute' : 'Mute'}
            </button>
            </div>
          </div>
        </div>
      </section>

      {/* Panel 5: Global Thocks */}
      <section className="flex-shrink-0 w-full min-w-full h-full snap-start flex items-center justify-center px-10">
        <div className="flex items-center gap-12 lg:gap-20 max-w-[1140px] w-full">
          <div className="flex flex-col items-start gap-5 flex-1">
            <div className="relative mb-4">
              {/* Floating arrow indicator hovering above the keeby-logo.
                  Inlined SVG (via the ArrowIndicator component) so width AND
                  height are honored exactly — no <img> intrinsic-size quirks.
                  fill="#1e1e1e" + opacity-40 matches click-me.svg in the hero. */}
              <ArrowIndicator className="pointer-events-none select-none absolute left-[calc(50%+6px)] -translate-x-1/2 -top-16 w-20 h-12 opacity-40" />
              <button
                type="button"
                {...makePressHandlers(noopSetPressed, { thock: true })}
                data-keeby-thock="true"
                onClick={scrollToGlobe}
                aria-label="Tap to thock"
                title="Tap to thock"
                className="tap-manipulation select-none cursor-pointer transition-transform duration-100 will-change-transform hover:scale-[0.96] active:scale-[0.9]"
              >
                <img src="/keeby-logo.webp" alt="Keeby" width={312} height={312} draggable={false} className="h-12 w-12 rounded-[12px] pointer-events-none" />
              </button>
            </div>
            <h2 className="text-4xl lg:text-5xl font-extrabold tracking-[-1.5px] leading-[1.05] text-neutral-900">
              Thocks around<br />the world
            </h2>
            <p className="text-base text-neutral-600 max-w-md tracking-tight text-balance">
              Every tap and keystroke pings a city in real time. Drag the globe to look around.
            </p>
          </div>
          <div className="flex-1 flex justify-end">
            <Suspense fallback={<LazySectionFallback />}>
              <Globe />
            </Suspense>
          </div>
        </div>
      </section>

      {/* Panel 5.5: Feedback */}
      <section className="flex-shrink-0 w-full min-w-full h-full snap-start flex items-center justify-center px-10">
        <Suspense fallback={<LazySectionFallback />}>
          <FeedbackSection makePressHandlers={makePressHandlers} noopSetPressed={noopSetPressed} onCenterInView={doScrollToFeedback} />
        </Suspense>
      </section>

      {/* Panel 6: CTA + Footer side by side */}
      <section className="flex-shrink-0 w-full min-w-full h-full flex items-center justify-center px-10">
        <div className="flex items-center gap-20 max-w-5xl w-full">
          {/* CTA */}
          <div className="flex flex-col items-start gap-6 flex-1">
            <h2 className="text-5xl md:text-6xl font-extrabold tracking-[-2px] leading-[1.05] text-neutral-900">
              Try it.<br />You'll hear the difference.
            </h2>
            <p className="text-base text-neutral-600 leading-relaxed">
              {PRICE} one-time. No subscription, no data collected.
            </p>
            <DownloadButton variant="cta" location="bottom_cta" navigate={navigate} />
            <SystemRequirementsLabel />
          </div>
          {/* Footer */}
          <div className="flex flex-col items-end gap-4 text-[13px] text-neutral-600">
            <span>&copy; {new Date().getFullYear()} Keeby</span>
            <a href="/privacy" onClick={navigate('/privacy')} className="text-neutral-600 transition-colors hover:text-neutral-900 no-underline">Privacy</a>
            <a href="/support" onClick={navigate('/support')} className="text-neutral-600 transition-colors hover:text-neutral-900 no-underline">Support</a>
            {APP_LIVE && (
              <a href={APP_STORE} target="_blank" rel="noopener noreferrer" onClick={() => capture('download_clicked', { location: 'footer' })} className="text-neutral-600 transition-colors hover:text-neutral-900 no-underline">App Store</a>
            )}
          </div>
        </div>
      </section>
      </HorizontalScroll>

      {/* Mobile: original vertical layout */}
      <div className="hidden max-lg:block pt-14">
      {/* Hero */}
      <section className="relative flex flex-col items-center px-5 pb-16 pt-16 text-center md:px-10 md:pt-20">
        <div className="relative mb-10 -mt-2 fade-1 flex flex-col items-center gap-10">
          <span className="inline-flex items-center gap-2 text-base text-neutral-600">
            {EU_AVAILABILITY_LABEL}
            <span className="relative inline-flex h-2 w-2">
              <span className="absolute inset-0 rounded-full bg-green-400 opacity-75 animate-ping" />
              <span className="relative inline-block h-2 w-2 rounded-full bg-green-500" />
            </span>
          </span>
          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              {...makePressHandlers(noopSetPressed, { thock: true })}
              data-keeby-thock="true"
              onClick={(e) => {
                if (keyboardSounds.activated) return
                eggTaps.current++
                clearTimeout(eggTapTimer.current)
                if (eggTaps.current >= 3) {
                  eggTaps.current = 0
                  keyboardSounds.activate()
                  capture('easter_egg_activated')
                  setEggToast(true)
                } else {
                  eggTapTimer.current = setTimeout(() => { eggTaps.current = 0 }, 1500)
                }
              }}
              className="tap-manipulation select-none w-20 h-auto cursor-pointer overflow-visible transition-transform duration-100 origin-bottom scale-100 active:scale-95"
            >
              <img src="/keeby-logo.webp" alt="Keeby" width="312" height="312" className="pointer-events-none select-none w-full h-auto" draggable="false" />
            </button>
            <div className="flex items-center gap-1">
              <DragAirplane
                onGrab={() => { primeAudioContext(); playTapSound('down') }}
                onRelease={() => playTapSound('up')}
              />
              <img src="/click-me.svg" alt="click me" width={120} height={36} className="h-9 w-auto opacity-40 select-none pointer-events-none" draggable="false" />
            </div>
          </div>
        </div>
        <h1 className="text-4xl md:text-6xl font-extrabold tracking-[-2px] leading-[1.05] max-w-lg mb-4 text-neutral-900 fade-2">
          Your keyboard,<br />but better.
        </h1>
        <p className="text-base text-neutral-600 max-w-xs leading-relaxed mb-8 fade-3">
          Mechanical keyboard sounds for Mac.
        </p>
        <DownloadButton variant="hero" location="hero" navigate={navigate} fadeClass="fade-3" />
        <p className="text-xs text-neutral-600 mb-14 fade-4">{PRICE} · One-time purchase</p>

        {/* MacBook */}
        <div className="relative mx-auto w-full fade-5 [--macbook-radius:12px] [--macbook-bezel:4px] sm:max-w-[720px] sm:[--macbook-radius:18px] sm:[--macbook-bezel:8px] md:max-w-[900px] md:[--macbook-radius:22px] md:[--macbook-bezel:10px]">
          <div className="relative bg-black" style={{ ...macBookTopRadiusStyle, padding: 'var(--macbook-bezel)', paddingBottom: 0 }}>
            <div className="absolute left-1/2 z-30 h-[16px] w-[96px] -translate-x-1/2 sm:h-[30px] sm:w-[198px]" style={{ top: 'calc(var(--macbook-bezel) - 1px)' }}>
              <img src="/notch.svg" alt="" className="w-full h-full" />
              <div className="absolute inset-0 flex items-center justify-between px-1.5 sm:px-4">
                <HeroNotchSwitchDot />
                <div className="hidden sm:flex items-center justify-center shrink-0">
                  <NotchKeyCap />
                </div>
              </div>
            </div>
            <div className="relative overflow-hidden" style={{ aspectRatio: '16/10', borderTopLeftRadius: macBookInnerRadius, borderTopRightRadius: macBookInnerRadius }}>
              <img src="/macos-wallpaper.webp" alt="" width={1200} height={800} fetchPriority="high" decoding="sync" className="absolute inset-0 w-full h-full object-cover object-[34%_center]" />
              <div className="relative z-10 flex h-[18px] items-center justify-between bg-black/25 px-2 backdrop-blur-[22px] sm:h-[30px] sm:px-5 sm:backdrop-blur-[40px]">
                <div className="flex items-center gap-2 sm:gap-5">
                  <svg className="h-[10px] w-[8px] opacity-80 sm:h-[15px] sm:w-[13px]" viewBox="0 0 17 20" fill="white"><path d="M12.15 0c.12 1.17-.35 2.33-1.05 3.17-.71.84-1.85 1.5-2.97 1.41-.14-1.13.36-2.33 1.03-3.07C9.87.67 11.06.06 12.15 0zm3.56 6.82c-.09.05-2.12 1.22-2.1 3.63.02 2.88 2.54 3.87 2.57 3.88-.02.07-.4 1.37-1.33 2.72-.82 1.17-1.67 2.34-3.01 2.36-1.32.02-1.74-.78-3.25-.78s-1.99.76-3.24.8c-1.29.04-2.27-1.27-3.1-2.43C.55 14.72-.73 10.2 1.03 7.14c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.49.87 3.27.87.78 0 2.24-1.07 3.77-.91.64.03 2.45.26 3.61 1.95l-.09.08z"/></svg>
                  <div className="h-[3px] w-[16px] rounded-full bg-white/30 sm:h-[5px] sm:w-[28px]" />
                  <div className="h-[3px] w-[11px] rounded-full bg-white/20 sm:h-[5px] sm:w-[18px]" />
                  <div className="h-[3px] w-[14px] rounded-full bg-white/20 sm:h-[5px] sm:w-[22px]" />
                  <div className="h-[3px] w-[9px] rounded-full bg-white/20 sm:h-[5px] sm:w-[16px]" />
                </div>
                <div className="flex items-center gap-1.5 sm:gap-3">
                  <div className="h-[2.5px] w-[2.5px] rounded-full bg-white/30 sm:h-[5px] sm:w-[5px]" />
                  <div className="h-[2.5px] w-[2.5px] rounded-full bg-white/30 sm:h-[5px] sm:w-[5px]" />
                  <div className="h-[2.5px] w-[12px] rounded-full bg-white/25 sm:h-[5px] sm:w-[20px]" />
                  <img src="/keeby-icon.svg" alt="" className={`h-[11px] w-[11px] rounded-[3px] sm:h-[16px] sm:w-[16px] transition-all duration-500 ${keyboardSounds.activated ? '' : 'brightness-0 invert opacity-70'}`} />
                  <div className="h-[2.5px] w-[20px] rounded-full bg-white/30 sm:h-[5px] sm:w-[36px]" />
                </div>
              </div>
              <div className="absolute bottom-1 left-1/2 z-10 -translate-x-1/2 sm:bottom-3">
                <div className="inline-flex items-center gap-0 rounded-[8px] border border-white/15 bg-white/12 px-0.5 py-0.5 shadow-[0_4px_24px_rgba(0,0,0,0.2)] backdrop-blur-[18px] sm:gap-0 sm:rounded-[14px] sm:px-0.5 sm:py-0.5 sm:backdrop-blur-[40px]">
                  <img src="/finder-icon.webp" alt="Finder" width={144} height={144} className="h-10 w-10 shrink-0 sm:h-12 sm:w-12 rounded-[8px] sm:rounded-[12px] pointer-events-none select-none object-contain" draggable="false" />
                  <img src="/safari-icon.webp" alt="Safari" width={144} height={144} className="h-10 w-10 shrink-0 sm:h-12 sm:w-12 rounded-[8px] sm:rounded-[12px] pointer-events-none select-none object-contain scale-[0.9]" draggable="false" />
                  <img src="/settings-icon.webp" alt="Settings" width={144} height={144} className="h-10 w-10 shrink-0 sm:h-12 sm:w-12 rounded-[8px] sm:rounded-[12px] pointer-events-none select-none object-contain" draggable="false" />
                  <div className="mx-0.5 h-8 w-px shrink-0 bg-white/15 sm:mx-1 sm:h-10" />
                  <button type="button" {...makeHeroDockPressHandlers(setKeyPressed)} data-keeby-thock="true" className={`tap-manipulation select-none h-10 w-10 overflow-visible rounded-[8px] sm:h-12 sm:w-12 sm:rounded-[12px] transition-transform duration-100 cursor-pointer scale-[0.9] shrink-0 ${keyPressed ? '!scale-[0.85]' : 'hover:!scale-[0.95]'}`} title="Press to hear a key click">
                    <img src="/keeby-logo.webp" alt="Keeby" width={312} height={312} className="pointer-events-none select-none h-full w-full object-contain" draggable="false" />
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="relative h-4 -mx-6 bg-gradient-to-b from-[#d6d6d6] to-[#bbb] sm:h-4 sm:-mx-10" style={macBookBottomRadiusStyle}>
            <div className="absolute left-1/2 top-0 h-[2px] w-24 -translate-x-1/2 rounded-b bg-black/[0.05] sm:h-[3px] sm:w-36" />
          </div>
          <div className="mx-auto h-4 w-[75%] bg-[radial-gradient(ellipse,rgba(0,0,0,0.05),transparent_70%)] sm:h-5" />

          <div className="mt-8 mb-4 px-4 text-center sm:hidden">
            <h2 className="text-[15px] font-bold text-neutral-900 mb-1">All from your menu bar</h2>
            <p className="text-[13px] text-neutral-600 leading-snug max-w-[260px] mx-auto">Switch profiles, tweak the tone, and toggle the visualizer in one click.</p>
          </div>

          <div className="relative overflow-hidden rounded-2xl sm:contents">
            <div className="absolute inset-0 sm:hidden">
              <img src="/macos-wallpaper.webp" alt="" width={1200} height={800} loading="lazy" decoding="async" className="h-full w-full object-cover object-[34%_center]" />
              <div className="absolute inset-0 bg-black/70" />
            </div>
            <div className="relative z-10 flex h-7 items-center justify-between bg-black/30 px-3 backdrop-blur-md sm:hidden">
              <div className="flex items-center gap-2.5">
                <svg className="h-[10px] w-[9px] opacity-70" viewBox="0 0 17 20" fill="white"><path d="M12.15 0c.12 1.17-.35 2.33-1.05 3.17-.71.84-1.85 1.5-2.97 1.41-.14-1.13.36-2.33 1.03-3.07C9.87.67 11.06.06 12.15 0zm3.56 6.82c-.09.05-2.12 1.22-2.1 3.63.02 2.88 2.54 3.87 2.57 3.88-.02.07-.4 1.37-1.33 2.72-.82 1.17-1.67 2.34-3.01 2.36-1.32.02-1.74-.78-3.25-.78s-1.99.76-3.24.8c-1.29.04-2.27-1.27-3.1-2.43C.55 14.72-.73 10.2 1.03 7.14c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.49.87 3.27.87.78 0 2.24-1.07 3.77-.91.64.03 2.45.26 3.61 1.95l-.09.08z"/></svg>
                <div className="h-[4px] w-[16px] rounded-full bg-white/25" />
                <div className="h-[4px] w-[12px] rounded-full bg-white/18" />
                <div className="h-[4px] w-[10px] rounded-full bg-white/18" />
              </div>
              <div className="flex items-center gap-2">
                <div className="h-[3.5px] w-[3.5px] rounded-full bg-white/25" />
                <div className="h-[3.5px] w-[3.5px] rounded-full bg-white/25" />
                <div className="h-[4px] w-[12px] rounded-full bg-white/18" />
                <img src="/keeby-icon.svg" alt="" className="h-[14px] w-[14px] rounded-[3px]" />
                <div className="h-[4px] w-[16px] rounded-full bg-white/25" />
              </div>
            </div>
            <div className="relative z-20 flex w-full flex-col items-center gap-1.5 px-4 py-3 text-left sm:absolute sm:left-auto sm:right-[67px] sm:top-[37px] sm:block sm:w-[210px] sm:p-0">
            <div className={`${menuPanelFrame} ${menuPanelMain} h-fit w-full max-w-[220px] sm:w-[210px]`} style={menuPanelBlurStyle}>
              <div className={menuPanelGloss} />
              <div className={menuContent}>
                <div className={menuSection}>Control</div>
                <div className={menuRow}><CircleCheckBig className="w-[14px] h-[14px] text-white/60" /><span>Enable Keeby</span></div>
                <div className={menuDivider} />
                <div className={menuSection}>Configure</div>
                <div className={menuRow}><SlidersHorizontal className="w-[14px] h-[14px] text-white/55" /><span>Sound</span></div>
                <div className={`${menuRow} ${menuRowSelected}`}><Keyboard className="w-[14px] h-[14px]" /><span>Switches</span><ChevronRight className="ml-auto w-3 h-3 opacity-70" /></div>
                <div className={menuRow}><CircleCheckBig className="w-[14px] h-[14px] text-white/60" /><span>Enable Visualizer</span></div>
                <div className={menuRow}><LayoutGrid className="w-[14px] h-[14px] text-white/55" /><span>Position</span><ChevronRight className="ml-auto w-3 h-3 text-white/25" /></div>
                <div className={menuDivider} />
                <div className={menuSection}>App</div>
                <div className={menuRow}><Settings className="w-[14px] h-[14px] text-white/55" /><span>Settings...</span><span className={menuShortcut}>⌘,</span></div>
                <div className={menuRow}><XCircle className="w-[14px] h-[14px] text-white/55" /><span>Quit Keeby</span><span className={menuShortcut}>⌘Q</span></div>
              </div>
            </div>
            <div className={`${menuPanelFrame} ${menuPanelSub} mt-0 h-fit w-full max-w-[220px] sm:absolute sm:right-[calc(100%+6px)] sm:top-[52px] sm:mt-0 sm:w-[220px]`} style={menuPanelBlurStyle}>
              <div className={menuPanelGloss} />
              <div className={menuContent}>
                <HeroSwitchSubmenu
                  activated={keyboardSounds.activated}
                  onSelect={handleHeroSwitchSelect}
                />
              </div>
            </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-[1060px] px-4 py-20 sm:px-5 sm:py-24 md:px-10" id="features">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
          <div className="bg-white rounded-3xl p-8 border border-black/[0.04] text-center reveal">
            <div className="h-24 flex items-center justify-center gap-4 mb-5">
              {['L', 'R'].map((label, si) => (
                <div key={label} className="flex flex-col items-center gap-1">
                  <div className="relative">
                    <svg width="52" height="68" viewBox="0 0 52 68" fill="none">
                      <rect x="1" y="1" width="50" height="66" rx="8" fill="#e8e8e8" stroke="#ddd" strokeWidth="1"/>
                      <circle cx="26" cy="20" r="7" fill="#ddd"/><circle cx="26" cy="20" r="3.5" fill="#e3e3e3"/><circle cx="26" cy="20" r="1.2" fill="#d0d0d0"/>
                      <circle cx="26" cy="46" r="13" fill="#d4d4d4"/><circle cx="26" cy="46" r="9" fill="#ddd"/><circle cx="26" cy="46" r="4.5" fill="#e2e2e2"/><circle cx="26" cy="46" r="2" fill="#d0d0d0"/>
                    </svg>
                    {[0, 1, 2].map(i => (
                      <div key={i} className="absolute rounded-full border-[1.5px] border-[#FF8C17] pointer-events-none z-20"
                        style={{ top: '50%', left: '50%', width: 52, height: 52, transform: 'translate(-50%, -50%)',
                          animation: `ringAlt${si === 0 ? 'L' : 'R'} 3.2s ease-out ${i * 0.25}s infinite`, opacity: 0 }} />
                    ))}
                  </div>
                  <span className="text-[10px] font-semibold text-neutral-300 tracking-wide">{label}</span>
                </div>
              ))}
            </div>
            <h2 className="text-[15px] font-bold text-neutral-900 mb-1">Spatial Audio</h2>
            <p className="text-[13px] text-neutral-600 leading-snug">Left keys play from your left speaker, right from right.</p>
          </div>
          <div className="bg-white rounded-3xl p-8 border border-black/[0.04] text-center reveal" style={{ transitionDelay: '0.05s' }}>
            <div className="h-24 flex items-center justify-center mb-5"><VisualizerIllustration /></div>
            <h2 className="text-[15px] font-bold text-neutral-900 mb-1">Reactive Visualizer</h2>
            <p className="text-[13px] text-neutral-600 leading-snug">A mini keyboard follows your cursor, lighting up keys.</p>
          </div>
          <div className="bg-white rounded-3xl p-8 border border-black/[0.04] text-center reveal" style={{ transitionDelay: '0.1s' }}>
            <div className="h-24 flex items-center justify-center mb-5"><LatencyIllustration /></div>
            <h2 className="text-[15px] font-bold text-neutral-900 mb-1">Low Latency</h2>
            <p className="text-[13px] text-neutral-600 leading-snug">Lock-free audio engine with 128-frame buffer playback.</p>
          </div>
          <div className="bg-white rounded-3xl p-8 border border-black/[0.04] text-center reveal" style={{ transitionDelay: '0.15s' }}>
            <div className="h-24 flex items-center justify-center mb-5">
              <svg width="64" height="80" viewBox="0 0 64 80" fill="none">
                <rect x="10" y="12" width="44" height="60" rx="22" fill="#e8e8e8" stroke="#ddd" strokeWidth="1"/>
                <line x1="32" y1="12" x2="32" y2="42" stroke="#ddd" strokeWidth="1"/>
                <rect x="11" y="13" width="21" height="28" rx="10" fill="#e0e0e0" className="animate-[mouseClickL_2.4s_ease-in-out_infinite]"/>
                <rect x="32" y="13" width="21" height="28" rx="10" fill="#e0e0e0" className="animate-[mouseClickR_2.4s_ease-in-out_0.6s_infinite]"/>
                <rect x="29" y="20" width="6" height="10" rx="3" fill="#d4d4d4"/>
              </svg>
            </div>
            <h2 className="text-[15px] font-bold text-neutral-900 mb-1">Mouse Click Sounds</h2>
            <p className="text-[13px] text-neutral-600 leading-snug">Satisfying clicks on every left, right, and middle press.</p>
          </div>
          <div className="bg-white rounded-3xl p-8 border border-black/[0.04] text-center reveal" style={{ transitionDelay: '0.2s' }}>
            <div className="h-24 flex items-center justify-center mb-5">
              <svg width="78" height="102" viewBox="0 0 52 68" fill="none">
                <path d="M14 36V22a12 12 0 1124 0v14" stroke="#d4d4d4" strokeWidth="4" strokeLinecap="round" fill="none" className="animate-[shackleJiggle_3s_ease-in-out_infinite]"/>
                <rect x="6" y="32" width="40" height="32" rx="8" fill="#e5e5e5"/>
                <circle cx="26" cy="46" r="4.5" fill="#FF8C17" opacity="0.4" className="animate-[pulse_2s_ease-in-out_infinite]"/>
                <circle cx="26" cy="46" r="2.5" fill="#FF8C17" opacity="0.6"/>
                <line x1="26" y1="50.5" x2="26" y2="56" stroke="#FF8C17" strokeWidth="2.5" strokeLinecap="round" opacity="0.4"/>
              </svg>
            </div>
            <h2 className="text-[15px] font-bold text-neutral-900 mb-1">Completely Private</h2>
            <p className="text-[13px] text-neutral-600 leading-snug">No data collected, no network access, fully offline app.</p>
          </div>
        </div>
      </section>

      {/* Typing Playground */}
      <section id="playground-mobile" className="px-0 py-16 sm:py-20 scroll-mt-20">
        <Suspense fallback={<LazySectionFallback />}>
          <TypingPlayground keyboardSounds={keyboardSounds} onCenterInView={doScrollToPlayground} hideSwitchPicker={hideSwitchPicker} zenMode={zenMode} />
        </Suspense>
      </section>

      {/* Video Demo */}
      <section className="px-4 py-16 sm:px-5 sm:py-20 md:px-10">
        <div className="mx-auto w-full max-w-[640px] flex items-baseline justify-between mb-6">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-[-1.5px] text-neutral-900">See it in action</h2>
          <p className="text-[13px] sm:text-base text-neutral-600">Every keystroke, perfected.</p>
        </div>
        <div ref={demoMobileSectionRef} className="mx-auto w-full max-w-[640px] [--macbook-radius:12px] [--macbook-bezel:5px] sm:[--macbook-radius:14px] sm:[--macbook-bezel:6px] md:[--macbook-radius:16px] md:[--macbook-bezel:8px]">
          <div className="relative bg-black" style={{ ...macBookTopRadiusStyle, padding: 'var(--macbook-bezel)', paddingBottom: 0 }}>
            <div className="relative overflow-hidden" style={{ aspectRatio: '2560/1664', borderTopLeftRadius: macBookInnerRadius, borderTopRightRadius: macBookInnerRadius }}>
              <video
                ref={demoVideoMobileRef}
                src={demoVideoReady ? '/keeby-demo.mp4' : undefined}
                poster="/demo-poster.webp"
                preload="none"
                autoPlay
                loop
                muted
                playsInline
                className="absolute inset-0 w-full h-full object-cover"
              />
            </div>
          </div>
          <div className="relative h-3 bg-gradient-to-b from-[#d6d6d6] to-[#bbb] sm:h-4" style={macBookBottomRadiusStyle}>
            <div className="absolute left-1/2 top-0 h-[2px] w-12 -translate-x-1/2 rounded-b bg-black/[0.05] sm:h-[2px] sm:w-16" />
          </div>
          <div className="flex justify-between items-center mt-2">
            <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
              {demoMobileMuted && <span className="text-[12px] text-neutral-600 animate-[nudgeRight_0.8s_ease-in-out_infinite]">Listen to it &rarr;</span>}
              <button
                type="button"
                onClick={() => { const v = demoVideoMobileRef.current; if (v) { v.muted = !v.muted; setDemoMobileMuted(v.muted) } }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-neutral-100 hover:bg-neutral-200 transition-colors text-[12px] font-medium text-neutral-600 cursor-pointer"
              >
                {demoMobileMuted ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07"/></svg>
                )}
                {demoMobileMuted ? 'Unmute' : 'Mute'}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Global Thocks */}
      <section id="globe-mobile" className="px-4 py-20 sm:px-5 sm:py-24 md:px-10 scroll-mt-20">
        <div className="mx-auto w-full max-w-[1060px] flex flex-col items-center text-center gap-5">
          <div className="relative mb-4">
            {/* Same floating arrow indicator as the desktop Thocks panel.
                Centered on the button (no right-nudge) since the mobile column
                is items-center. Matches the desktop size + offset. */}
            <ArrowIndicator className="pointer-events-none select-none absolute left-[calc(50%+6px)] -translate-x-1/2 -top-16 w-20 h-12 opacity-40" />
            <button
              type="button"
              {...makePressHandlers(noopSetPressed, { thock: true })}
              data-keeby-thock="true"
              onClick={scrollToGlobe}
              aria-label="Tap to thock"
              title="Tap to thock"
              className="tap-manipulation select-none cursor-pointer transition-transform duration-100 will-change-transform hover:scale-[0.96] active:scale-[0.9]"
            >
              <img src="/keeby-logo.webp" alt="Keeby" width={312} height={312} draggable={false} className="h-12 w-12 rounded-[12px] pointer-events-none" />
            </button>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-[-1.5px] leading-[1.05] text-neutral-900">
            Thocks around<br />the world
          </h2>
          <p className="text-[13px] sm:text-base text-neutral-600 max-w-md tracking-tight text-balance">
            Every tap and keystroke pings a city in real time.
          </p>
          <Suspense fallback={<LazySectionFallback />}>
            <Globe />
          </Suspense>
        </div>
      </section>

      {/* Feedback */}
      <section id="feedback" className="px-4 py-20 sm:px-5 sm:py-24 md:px-10 md:py-28 scroll-mt-20">
        <Suspense fallback={<LazySectionFallback />}>
          <FeedbackSection makePressHandlers={makePressHandlers} noopSetPressed={noopSetPressed} onCenterInView={doScrollToFeedback} />
        </Suspense>
      </section>

      {/* CTA */}
      <section className="px-4 py-20 sm:px-5 sm:py-24 md:px-10 md:py-32">
        <div className="max-w-[1000px] mx-auto flex flex-col items-center text-center gap-6">
          <h2 className="text-4xl md:text-5xl font-extrabold tracking-[-2px] leading-[1.05] text-neutral-900">
            Try it.<br />You'll hear the difference.
          </h2>
          <p className="text-base text-neutral-600">{PRICE} one-time. No subscription, no data collected.</p>
          <DownloadButton variant="cta" location="bottom_cta" navigate={navigate} />
          <SystemRequirementsLabel />
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-black/[0.04] px-5 py-6">
        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center gap-3">
            <img src="/keeby-logo.webp" alt="Keeby" width={312} height={312} className="h-6 w-6 rounded-[6px]" />
            <span className="text-[13px] text-neutral-600">&copy; {new Date().getFullYear()} Keeby</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-[13px]">
            <a href="/privacy" onClick={navigate('/privacy')} className="text-neutral-600 transition-colors hover:text-neutral-900 no-underline">Privacy</a>
            <a href="/support" onClick={navigate('/support')} className="text-neutral-600 transition-colors hover:text-neutral-900 no-underline">Support</a>
            {APP_LIVE && <a href={APP_STORE} target="_blank" rel="noopener noreferrer" onClick={() => capture('download_clicked', { location: 'footer' })} className="text-neutral-600 transition-colors hover:text-neutral-900 no-underline">App Store</a>}
          </div>
          <span className="hidden lg:flex text-[11px] text-neutral-600 items-center gap-1">.com powered by <a href="https://x.com/emirayaaz" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-neutral-600 hover:text-neutral-900 transition-colors no-underline"><img src="/emir.webp" alt="Emir Ayaz" width={28} height={28} className="h-3.5 w-3.5 rounded-full object-cover" />Emir</a> from <a href="https://x.com/witharc_co" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-neutral-600 hover:text-neutral-900 transition-colors no-underline"><img src="/arc.webp" alt="Arc" width={28} height={28} className="h-3.5 w-3.5 rounded-full object-cover" />Arc</a></span>
        </div>
      </footer>
      </div>
        </>
      )}
      </main>

      {/* Footer */}
      {/* Coming Soon Dialog */}
      <div
        className={`fixed inset-0 z-50 flex items-center justify-center transition-all duration-300 ease-out ${showComingSoon ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        style={{ backdropFilter: showComingSoon ? 'blur(8px)' : 'blur(0px)', WebkitBackdropFilter: showComingSoon ? 'blur(8px)' : 'blur(0px)', backgroundColor: showComingSoon ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0)' }}
        onClick={() => setShowComingSoon(false)}
      >
        <div
          className={`relative mx-4 w-full max-w-sm rounded-2xl border border-black/[0.06] bg-white p-8 shadow-2xl text-center transition-all duration-300 ease-out ${showComingSoon ? 'scale-100 opacity-100 translate-y-0 blur-0' : 'scale-95 opacity-0 translate-y-4 blur-[4px]'}`}
          onClick={e => e.stopPropagation()}
        >
          <img src="/keeby-logo.webp" alt="Keeby" width={312} height={312} className="mx-auto mb-4 h-14 w-14 rounded-[14px] shadow-md" />
          <h3 className="text-[18px] font-bold text-neutral-900 mb-2">Almost there!</h3>
          <p className="text-[13px] text-neutral-600 leading-relaxed mb-6">
            Keeby is currently being reviewed by Apple. It'll be available on the App Store very soon.
          </p>
          <button onClick={() => setShowComingSoon(false)} className="w-full rounded-full bg-gradient-to-b from-[#2a2a2a] to-[#0a0a0a] px-6 py-3 text-[13px] font-semibold text-white transition-colors duration-300 hover:from-[#3a3a3a] hover:to-[#1a1a1a] cursor-pointer">
            Got it
          </button>
        </div>
      </div>


    </div>
  )
}

export default App
