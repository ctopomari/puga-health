/**
 * PugaAI Health — frontend integration contract.
 *
 * This file defines the frontend's expected capability boundaries.
 * It does NOT implement or assume the production backend.
 * Backend developers should map these capabilities to the authoritative
 * Express/API contracts and preserve the response/error semantics below.
 */

export const INTEGRATION_VERSION = '1.0.8'

export const CHANNELS = ['web', 'mobile', 'pugaaccess-ivr', 'pugaaccess-ussd', 'pugaaccess-sms']

export const CAPABILITIES = Object.freeze({
  auth: {
    login: 'POST /api/v1/auth/login',
    logout: 'POST /api/v1/auth/logout',
  },
  identity: {
    healthId: 'GET /api/v1/me/health-id',
    profile: 'GET /api/v1/me',
  },
  consent: {
    status: 'GET /api/v1/consent',
    update: 'PATCH /api/v1/consent',
  },
  ai: {
    conversations: 'GET /api/v1/ai/conversations',
    createConversation: 'POST /api/v1/conversations',
    message: 'POST /api/v1/conversations/:conversationId/messages',
    voiceTranscription: 'POST /api/v1/voice/transcriptions',
  },
  care: {
    facilities: 'GET /api/v1/care/facilities',
    providers: 'GET /api/v1/care/providers',
    appointments: 'POST /api/v1/care/appointments',
    appointmentList: 'GET /api/v1/care/appointments',
    teleconsultation: 'POST /api/v1/care/appointments/:appointmentId/teleconsultation',
    laboratoryServices: 'GET /api/v1/care/laboratory/services',
    laboratoryRequest: 'POST /api/v1/care/laboratory/requests',
    medicationServices: 'GET /api/v1/care/medications/services',
    refillRequest: 'POST /api/v1/care/medications/refill-requests',
  },
  payments: {
    transactions: 'GET /api/v1/payments/transactions',
    checkout: 'POST /api/v1/payments/checkout',
  },
  pugaAccess: {
    session: 'POST /api/v1/puga-access/sessions',
    sessionStatus: 'GET /api/v1/puga-access/sessions/:sessionId',
  },
  health: {
    status: 'GET /api/v1/health',
  },
  naicValidation: {
    logInteraction: 'POST /api/v1/naic/interactions',
    validationSummary: 'GET /api/v1/naic/validation',
  },
})

export const ERROR_CODES = Object.freeze({
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  FORBIDDEN: 'FORBIDDEN',
  CONSENT_REQUIRED: 'CONSENT_REQUIRED',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  TIMEOUT: 'TIMEOUT',
  NETWORK_ERROR: 'NETWORK_ERROR',
  UNKNOWN: 'UNKNOWN',
})

export function normalizeApiError(error = {}) {
  const status = Number(error.status || 0)
  if (error.code === 'SESSION_EXPIRED' || status === 401) {
    return { code: ERROR_CODES.UNAUTHENTICATED, status, retryable: false, message: 'Your session has expired. Please sign in again.' }
  }
  if (status === 403) return { code: ERROR_CODES.FORBIDDEN, status, retryable: false, message: 'You are not authorized to perform this action.' }
  if (status === 409) return { code: ERROR_CODES.CONFLICT, status, retryable: false, message: error.message || 'This request conflicts with the current state.' }
  if (status === 429) return { code: ERROR_CODES.RATE_LIMITED, status, retryable: true, message: 'Too many requests. Please wait and try again.' }
  if (status >= 500) return { code: ERROR_CODES.SERVICE_UNAVAILABLE, status, retryable: true, message: 'The service is temporarily unavailable.' }
  if (error.code === 'TIMEOUT') return { code: ERROR_CODES.TIMEOUT, status, retryable: true, message: error.message || 'The request timed out.' }
  if (!status && error?.message) return { code: ERROR_CODES.NETWORK_ERROR, status: 0, retryable: true, message: 'A network connection is required. Please try again.' }
  return { code: error.code || ERROR_CODES.UNKNOWN, status, retryable: Boolean(error.retryable), message: error.message || 'Something went wrong. Please try again.' }
}

export const PROTECTED_CAPABILITIES = [
  'identity.healthId',
  'identity.profile',
  'consent.status',
  'consent.update',
  'ai.conversations',
  'care.appointments',
  'payments.transactions',
]

// Proposed backend capability, not implemented by this frontend adapter yet.
export const PLANNED_CAPABILITIES = Object.freeze({ authSession: 'GET /api/v1/auth/session' })
