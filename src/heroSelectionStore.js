import { useSyncExternalStore } from 'react'

const DEFAULT_PROFILE_ID = 'keychron-k2-max-red'
const DEFAULT_INDEX = 8

// Mirror of HERO_PREVIEW_ONLY_SWITCH_IDS — kept here so this module stays
// dependency-free and safe to import from useKeyboardSounds.
const PREVIEW_ONLY_PROFILE_IDS = new Set([
  'aflion-carrot',
  'akko-clicky-pink',
  'akko-v3-pro-cream-yellow',
  'akko-cs-jelly-black',
  'lofree-flow-2-surfer',
  'lofree-flow-2-void',
  'lofree-flow-2-pulse',
  'iqunix-mq80',
])

function isTypableProfileId(profileId) {
  return profileId && !PREVIEW_ONLY_PROFILE_IDS.has(profileId)
}

let _heroSwitchIndex = DEFAULT_INDEX
let _heroProfileId = DEFAULT_PROFILE_ID
let _lastTypableProfileId = DEFAULT_PROFILE_ID
const _listeners = new Set()

function emit() {
  for (const l of _listeners) l()
}

function subscribe(listener) {
  _listeners.add(listener)
  return () => _listeners.delete(listener)
}

export function getHeroSwitchIndex() {
  return _heroSwitchIndex
}

export function getHeroProfileId() {
  return _heroProfileId
}

export function setHeroSelection(index, profileId) {
  if (_heroSwitchIndex === index && _heroProfileId === profileId) return
  _heroSwitchIndex = index
  _heroProfileId = profileId
  if (isTypableProfileId(profileId)) _lastTypableProfileId = profileId
  emit()
}

/** Typable profile for playground UI — stays on last Type pick while Preview is active. */
export function getPlaygroundProfileId() {
  return isTypableProfileId(_heroProfileId) ? _heroProfileId : _lastTypableProfileId
}

export function useHeroSwitchIndex() {
  return useSyncExternalStore(subscribe, getHeroSwitchIndex, () => DEFAULT_INDEX)
}

export function useHeroProfileId() {
  return useSyncExternalStore(subscribe, getHeroProfileId, () => DEFAULT_PROFILE_ID)
}

export function usePlaygroundProfileId() {
  return useSyncExternalStore(subscribe, getPlaygroundProfileId, () => DEFAULT_PROFILE_ID)
}
