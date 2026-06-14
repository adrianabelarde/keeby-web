import { useEffect, useState } from 'react'

// Module-level pubsub for two playground-related preferences. Same pattern as
// useVisualizerEnabled.js — local-storage backed, shared via a tiny listener
// set so the navbar dropdown and the playground itself stay in sync without
// prop-drilling.

function makePref(storageKey, defaultValue) {
  let _value = (() => {
    try {
      const v = localStorage.getItem(storageKey)
      if (v === null) return defaultValue
      return v === '1'
    } catch {
      return defaultValue
    }
  })()

  const _listeners = new Set()

  const get = () => _value
  const set = (v) => {
    const next = !!v
    if (next === _value) return
    _value = next
    try { localStorage.setItem(storageKey, _value ? '1' : '0') } catch { /* ignore */ }
    _listeners.forEach((fn) => fn(_value))
  }
  const useHook = () => {
    const [v, setV] = useState(_value)
    useEffect(() => {
      _listeners.add(setV)
      return () => { _listeners.delete(setV) }
    }, [])
    return v
  }

  return { get, set, useHook }
}

const hideSwitchPicker = makePref('keeby-hide-switch-picker', false)
const autoScrollPlayground = makePref('keeby-auto-scroll-playground', false)
const zenMode = makePref('keeby-zen-mode', false)

export const getHideSwitchPicker = hideSwitchPicker.get
export const setHideSwitchPicker = hideSwitchPicker.set
export const useHideSwitchPicker = hideSwitchPicker.useHook

export const getAutoScrollPlayground = autoScrollPlayground.get
export const setAutoScrollPlayground = autoScrollPlayground.set
export const useAutoScrollPlayground = autoScrollPlayground.useHook

export const getZenMode = zenMode.get
export const setZenMode = zenMode.set
export const useZenMode = zenMode.useHook
