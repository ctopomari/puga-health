export const NAIC_VALIDATION_TARGET = 50

export function isValidationConsentComplete({ participantId = '', consent = false } = {}) {
  return Boolean(String(participantId).trim() && consent === true)
}

export function createValidationRecord(input = {}, now = () => new Date().toISOString()) {
  const participantId = String(input.participantId || '').trim().slice(0, 64)
  const transcript = String(input.transcript || '').trim().slice(0, 4000)
  return {
    interactionId: input.interactionId || `NAI-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    participantId,
    language: input.language || 'en-NG',
    channel: input.channel || 'web-voice',
    transcript,
    confidence: typeof input.confidence === 'number' ? input.confidence : null,
    conversationId: input.conversationId || null,
    messageId: input.messageId || null,
    responseCategory: input.responseCategory || 'primary-health-information',
    feedback: input.feedback || null,
    status: input.status || 'completed',
    createdAt: now(),
  }
}

export function summarizeValidation(records = [], target = NAIC_VALIDATION_TARGET) {
  const list = Array.isArray(records) ? records : []
  const completed = list.filter((record) => record?.status === 'completed')
  const languages = {}
  for (const record of list) {
    const language = record?.language || 'unknown'
    languages[language] = (languages[language] || 0) + 1
  }
  const uniqueParticipants = new Set(completed.map((record) => record?.participantId).filter(Boolean)).size
  return {
    total: list.length,
    completed: completed.length,
    uniqueParticipants,
    target,
    remaining: Math.max(target - completed.length, 0),
    languages,
  }
}
