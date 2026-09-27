// @ts-nocheck
export function getUserFacingError(error, fallback = 'Something went wrong. Please try again.') {
  if (!error) return fallback
  if (error.code === 'SESSION_EXPIRED' || error.status === 401) return 'Your session has expired. Please sign in again.'
  if (error.code === 'TIMEOUT') return 'The request took too long. Check your connection and try again.'
  if (error.status === 429) return 'Too many requests. Please wait a moment and try again.'
  if (error.status >= 500) return 'The service is temporarily unavailable. Please try again shortly.'
  if (!navigator.onLine) return 'You appear to be offline. Reconnect and try again.'
  return error.message || fallback
}

export function canRetry(error) {
  if (!error) return true
  if (error.code === 'SESSION_EXPIRED') return false
  if (error.status === 401 || error.status === 403 || error.status === 404) return false
  return error.retryable !== false
}

export function getLoadingLabel(resource = 'content') {
  return `Loading ${resource}…`
}
