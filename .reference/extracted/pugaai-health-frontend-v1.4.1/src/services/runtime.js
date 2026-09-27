export const runtimeConfig = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || '',
  apiMode: import.meta.env.VITE_API_MODE || 'mock',
  appEnv: import.meta.env.VITE_APP_ENV || 'development',
  pugaAccessUrl: import.meta.env.VITE_PUGAACCESS_URL || '',
  nAtlasEndpoint: import.meta.env.VITE_NATLAS_ENDPOINT || '',
  channel: import.meta.env.VITE_CHANNEL || 'web',
  requestTimeoutMs: Number(import.meta.env.VITE_REQUEST_TIMEOUT_MS || 15000),
}

export const isLive = runtimeConfig.apiMode === 'live' && Boolean(runtimeConfig.apiBaseUrl)

export function getStoredAccessToken() {
  try { return sessionStorage.getItem('pugaai-access-token') || '' } catch { return '' }
}

export function setStoredAccessToken(token) {
  try {
    if (token) sessionStorage.setItem('pugaai-access-token', token)
    else sessionStorage.removeItem('pugaai-access-token')
  } catch {}
}

export function isBrowserOnline() {
  return typeof navigator === 'undefined' ? true : navigator.onLine
}

export function getAuthState() {
  try {
    return sessionStorage.getItem('pugaai-auth-state') || 'signed-out'
  } catch {
    return 'signed-out'
  }
}

export function clearSession() {
  try {
    sessionStorage.removeItem('pugaai-access-token')
    sessionStorage.setItem('pugaai-auth-state', 'signed-out')
  } catch {}
}
