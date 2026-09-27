const SECRET_PATTERNS = [
  /bearer\s+[a-z0-9._~+\/-]+=*/gi,
  /(?:access[_-]?token|refresh[_-]?token|authorization|password|otp|secret)[\s:=]+[^\s,;]+/gi,
  /(?:PUGA[-_][A-Z0-9-]{4,})/gi,
]

export function safeErrorMessage(value, fallback = 'The request could not be completed. Please try again.') {
  if (!value || typeof value !== 'string') return fallback
  let message = value.replace(/[\r\n\t]+/g, ' ').trim().slice(0, 240)
  for (const pattern of SECRET_PATTERNS) message = message.replace(pattern, '[redacted]')
  return message || fallback
}

export function isTrustedCheckoutUrl(value, { currentOrigin = typeof window !== 'undefined' ? window.location.origin : '' } = {}) {
  try {
    const url = new URL(value, currentOrigin)
    if (!['https:', 'http:'].includes(url.protocol)) return false
    return url.origin === currentOrigin || url.protocol === 'https:'
  } catch { return false }
}

export function containsSensitiveStorageKey(key = '') {
  return /token|password|secret|otp|payment|clinical|medical|health[-_]?record/i.test(key)
}
