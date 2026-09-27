// @ts-nocheck
export function normalizeConversationText(value = '') {
  return String(value).replace(/\r\n/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{2,}/g, '\n').trim()
}

export function deriveConversationTitle(value = '') {
  const clean = normalizeConversationText(value).replace(/\n/g, ' ')
  if (!clean) return 'New PugaAI Health conversation'
  return clean.length > 64 ? `${clean.slice(0, 61).trimEnd()}…` : clean
}

export function getFeedbackLabel(value) {
  return value === 'helpful' ? 'Helpful' : value === 'not-helpful' ? 'Not helpful' : 'Feedback'
}
