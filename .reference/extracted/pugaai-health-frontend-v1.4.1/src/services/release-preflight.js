/** Public frontend configuration validation; never put API secrets in VITE_ variables. */
export function validateReleaseConfig(config) {
  const errors = []
  const warnings = []
  const mode = config.apiMode || 'mock'
  const environment = config.appEnv || 'development'
  const allowedChannels = ['web','mobile','pugaaccess-ivr','pugaaccess-ussd','pugaaccess-sms']
  if (!['mock','live'].includes(mode)) errors.push('VITE_API_MODE must be mock or live.')
  if (!allowedChannels.includes(config.channel || 'web')) errors.push('VITE_CHANNEL is not supported.')
  if (!Number.isFinite(config.requestTimeoutMs) || config.requestTimeoutMs < 1000 || config.requestTimeoutMs > 120000) errors.push('Request timeout must be between 1000 and 120000 ms.')
  if (environment === 'production' && mode !== 'live') errors.push('Production must use live API mode; demo/mock responses are not acceptable.')
  if (mode === 'live') {
    if (!config.apiBaseUrl) errors.push('Live API mode requires VITE_API_BASE_URL.')
    else {
      try {
        const url = new URL(config.apiBaseUrl)
        if (url.protocol !== 'https:' && !(environment !== 'production' && url.hostname === 'localhost')) errors.push('Live API URL must use HTTPS (except local development).')
        if (url.username || url.password || url.search || url.hash) errors.push('API URL must not embed credentials, query parameters or fragments.')
      } catch { errors.push('VITE_API_BASE_URL must be an absolute URL.') }
    }
  }
  if (environment === 'production' && !config.pugaAccessUrl) warnings.push('PugaAccess deep link is not configured.')
  if (config.pugaAccessUrl && !/^https:\/\//.test(config.pugaAccessUrl)) errors.push('PugaAccess URL must use HTTPS.')
  if (config.nAtlasEndpoint && !/^https:\/\//.test(config.nAtlasEndpoint)) errors.push('N-ATLAS endpoint must use HTTPS.')
  return { ok: errors.length === 0, errors, warnings, mode, environment }
}
