// Analytics is disabled in this public sample. The production site wires these
// same entry points to PostHog via an env-provided project key; here they are
// intentionally no-ops so the sample ships no tracking and no keys.

/** Fire-and-forget event. No-op in the public sample. */
export function capture(_event, _properties) {}

/** No-op in the public sample. */
export function scheduleAnalytics() {}
