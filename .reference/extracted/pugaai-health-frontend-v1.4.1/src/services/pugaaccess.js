export const PUGA_ACCESS_CHANNELS = {
  ivr: { label: 'IVR / Voice', shortLabel: 'IVR', description: 'Voice access for hands-free, low-bandwidth conversations.', lowBandwidth: true },
  ussd: { label: 'USSD', shortLabel: 'USSD', description: 'Menu-based access for feature phones without data.', lowBandwidth: true },
  sms: { label: 'SMS', shortLabel: 'SMS', description: 'Text-based continuity for simple health navigation.', lowBandwidth: true },
}

export function getPugaAccessChannelMeta(channel = 'ivr') {
  return PUGA_ACCESS_CHANNELS[channel] || { label: 'PugaAccess', shortLabel: 'PugaAccess', description: 'Low-bandwidth access to PugaAI Health.', lowBandwidth: true }
}

export function normalizePugaAccessSession(input = {}) {
  return {
    sessionId: input.sessionId || input.id || null,
    channel: input.channel || 'ivr',
    language: input.language || 'en-NG',
    status: input.status || 'active',
    continuitySupported: Boolean(input.continuitySupported),
    expiresAt: input.expiresAt || input.expiry || null,
    demo: Boolean(input.demo),
  }
}

export function isPugaAccessSessionExpired(session) {
  if (!session?.expiresAt) return false
  const timestamp = Date.parse(session.expiresAt)
  return Number.isFinite(timestamp) && timestamp <= Date.now()
}

export function getPugaAccessStatusLabel(session) {
  if (!session) return 'Not connected'
  if (isPugaAccessSessionExpired(session)) return 'Expired'
  const status = String(session.status || '').toLowerCase()
  if (status === 'active' || status === 'ready') return 'Active'
  if (status === 'expired') return 'Expired'
  if (status === 'closed' || status === 'ended') return 'Ended'
  return session.status || 'Pending'
}
