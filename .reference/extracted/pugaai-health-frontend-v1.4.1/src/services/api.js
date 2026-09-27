import { runtimeConfig, isLive, getStoredAccessToken, setStoredAccessToken } from './runtime'
import { safeErrorMessage } from './security'

const API_BASE_URL = runtimeConfig.apiBaseUrl
const API_MODE = runtimeConfig.apiMode

async function request(path, options = {}) {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), runtimeConfig.requestTimeoutMs)
  const token = getStoredAccessToken()
  const method = options.method || 'GET'
  const maxRetries = Number.isInteger(options.retries) ? options.retries : (method === 'GET' ? 1 : 0)
  const { retries: _retries, ...fetchOptions } = options
  let attempt = 0
  try {
    while (true) {
      try {
        const response = await fetch(`${API_BASE_URL}${path}`, {
          headers: {
            Accept: 'application/json',
            ...(fetchOptions.body ? { 'Content-Type': 'application/json' } : {}),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            'X-Puga-Channel': runtimeConfig.channel,
            ...(fetchOptions.headers || {})
          },
          signal: controller.signal,
          ...fetchOptions
        })
        if (response.status === 401) {
          setStoredAccessToken('')
          const error = new Error('Your session has expired. Please sign in again.')
          error.status = 401
          error.code = 'SESSION_EXPIRED'
          throw error
        }
        if (!response.ok) {
          let message = `Request failed (${response.status})`
          try {
            const body = await response.json()
            message = safeErrorMessage(body?.error?.message || body?.message || message)
          } catch {}
          const error = new Error(message)
          error.status = response.status
          error.retryable = response.status >= 500 || response.status === 429
          throw error
        }
        if (response.status === 204) return null
        const contentType = response.headers.get('content-type') || ''
        if (!contentType.includes('application/json')) return null
        return response.json()
      } catch (error) {
        if (error?.name === 'AbortError') {
          const timeoutError = new Error('The request timed out. Please check your connection and try again.')
          timeoutError.code = 'TIMEOUT'
          timeoutError.retryable = true
          throw timeoutError
        }
        const retryableNetwork = !error?.status && error?.code !== 'SESSION_EXPIRED'
        if (attempt < maxRetries && (error?.retryable || retryableNetwork)) {
          attempt += 1
          await new Promise((resolve) => window.setTimeout(resolve, 350 * attempt))
          continue
        }
        throw error
      }
    }
  } finally {
    window.clearTimeout(timer)
  }
}

async function requestNaicAdmin(path, options = {}) {
  const adminToken = sessionStorage.getItem('pugaai-naic-admin-token') || ''
  if (!adminToken && isLive) {
    const error = new Error('NAIC administrator authentication is required.')
    error.status = 401
    error.code = 'NAIC_ADMIN_REQUIRED'
    throw error
  }
  return request(path, { ...options, headers: { ...(options.headers || {}), ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {}) } })
}

const mockDelay = (ms = 550) => new Promise((resolve) => setTimeout(resolve, ms))

export const aiHealthApi = {

  async logNaicInteraction(record) {
    if (API_MODE === 'mock' || !API_BASE_URL) {
      await mockDelay(90)
      const current = JSON.parse(sessionStorage.getItem('pugaai-naic-interactions') || '[]')
      const next = [record, ...current.filter((item) => item.interactionId !== record.interactionId)].slice(0, 500)
      sessionStorage.setItem('pugaai-naic-interactions', JSON.stringify(next))
      return { success: true, interaction: record, demo: true }
    }
    return request('/api/v1/naic/interactions', { method: 'POST', body: JSON.stringify(record) })
  },

  async getNaicValidation() {
    if (API_MODE === 'mock' || !API_BASE_URL) {
      await mockDelay(120)
      return { interactions: JSON.parse(sessionStorage.getItem('pugaai-naic-interactions') || '[]'), demo: true }
    }
    return requestNaicAdmin('/api/v1/naic/validation')
  },

  async loginNaicAdmin({ identifier, password }) {
    if (API_MODE === 'mock' || !API_BASE_URL) {
      await mockDelay(300)
      if (identifier.trim().toLowerCase() !== 'naic-admin' || password !== 'demo-admin') {
        const error = new Error('Invalid NAIC administrator credentials.')
        error.status = 401
        throw error
      }
      const token = `demo-naic-admin-${Date.now()}`
      sessionStorage.setItem('pugaai-naic-admin-token', token)
      sessionStorage.setItem('pugaai-naic-admin-state', 'authenticated')
      sessionStorage.setItem('pugaai-naic-admin-role', 'naic_admin')
      return { demo: true, token, status: 'authenticated', role: 'naic_admin' }
    }
    const body = await request('/api/v1/admin/auth/login', { method: 'POST', body: JSON.stringify({ identifier, password, scope: 'naic_validation' }) })
    const token = body?.access_token || body?.token
    if (token) sessionStorage.setItem('pugaai-naic-admin-token', token)
    sessionStorage.setItem('pugaai-naic-admin-state', body?.status || 'authenticated')
    sessionStorage.setItem('pugaai-naic-admin-role', body?.user?.role || body?.role || '')
    return { demo: false, token, status: body?.status || 'authenticated', role: body?.user?.role || body?.role || null, user: body?.user || null }
  },

  async logoutNaicAdmin() {
    const token = sessionStorage.getItem('pugaai-naic-admin-token') || ''
    if (isLive && token) {
      try { await requestNaicAdmin('/api/v1/admin/auth/logout', { method: 'POST' }) } catch {}
    }
    sessionStorage.removeItem('pugaai-naic-admin-token')
    sessionStorage.removeItem('pugaai-naic-admin-state')
    sessionStorage.removeItem('pugaai-naic-admin-role')
    return { status: 'signed-out' }
  },

  async getRuntimeHealth() {
    if (API_MODE === 'mock' || !API_BASE_URL) return { ok: false, mode: 'mock', environment: runtimeConfig.appEnv, channel: runtimeConfig.channel }
    const started = Date.now()
    try {
      const body = await request('/api/v1/health', { retries: 1 })
      return { ok: true, mode: 'live', environment: runtimeConfig.appEnv, channel: runtimeConfig.channel, latencyMs: Date.now() - started, data: body }
    } catch (error) {
      return { ok: false, mode: 'live', environment: runtimeConfig.appEnv, channel: runtimeConfig.channel, latencyMs: Date.now() - started, error: safeErrorMessage(error.message), code: error.code, status: error.status }
    }
  },

  async createConversation() {
    if (API_MODE === 'mock' || !API_BASE_URL) {
      await mockDelay(180)
      return { conversationId: `demo-${Date.now()}`, status: 'active' }
    }
    const body = await request('/api/v1/conversations', { method: 'POST', body: JSON.stringify({ channel: 'web' }) })
    return { conversationId: body?.conversation?.id || body?.id, status: body?.conversation?.status || 'active' }
  },

  async sendMessage({ conversationId, message, sessionMode = 'standard', language = 'English (Nigeria)' }) {
    if (API_MODE === 'mock' || !API_BASE_URL) {
      await mockDelay(650)
      return {
        demo: true,
        id: `demo-message-${Date.now()}`,
        text: `I can help with general information about “${message}”. In the production version, this conversation will be handled by the PugaAI Health backend using approved health knowledge and configured safety policies.`,
        safety: { riskLevel: 'low', label: 'General information only — clinical decisions should be confirmed by an appropriate healthcare professional.' },
        careActions: [],
        sessionMode
      }
    }
    const body = await request(`/api/v1/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ input: { type: 'text', text: message }, session: { mode: sessionMode, language } })
    })
    return {
      demo: false,
      id: body?.message?.id || body?.id,
      text: body?.response?.text || body?.text || 'The service returned no response text.',
      safety: body?.safety || null,
      careActions: body?.care_actions || [],
      sessionMode,
      language
    }
  },

  async transcribeAudio({ conversationId, audioBlob, mimeType }) {
    if (API_MODE === 'mock' || !API_BASE_URL) {
      await mockDelay(800)
      return {
        demo: true,
        text: 'Voice capture received. Production transcription will be handled through the configured N-ATLAS voice pipeline.',
        mimeType
      }
    }
    const form = new FormData()
    form.append('audio', audioBlob, `pugaai-voice.${mimeType.includes('webm') ? 'webm' : 'audio'}`)
    form.append('conversation_id', conversationId)
    form.append('channel', 'web')
    const response = await fetch(`${API_BASE_URL}/api/v1/voice/transcriptions`, { method: 'POST', body: form, headers: { Accept: 'application/json' } })
    if (!response.ok) throw new Error(`Voice transcription failed (${response.status})`)
    const body = await response.json()
    return { demo: false, text: body?.transcript?.text || body?.text || '', mimeType }
  },

  async getHealthTopics() {
    if (API_MODE === 'mock' || !API_BASE_URL) {
      await mockDelay(220)
      return { topics: [
        { id: 'malaria', title: 'Malaria prevention', category: 'Prevention', summary: 'Mosquito-bite prevention, early testing and when to seek care.' },
        { id: 'maternal', title: 'Pregnancy & maternal health', category: 'Maternal', summary: 'Antenatal care, warning signs and preparation for skilled care.' },
        { id: 'child', title: 'Child health', category: 'Family', summary: 'Immunization, nutrition, fever awareness and preventive care.' },
        { id: 'blood-pressure', title: 'Blood pressure', category: 'Chronic care', summary: 'Understanding hypertension, monitoring and care navigation.' },
        { id: 'nutrition', title: 'Nutrition', category: 'Wellness', summary: 'Practical nutrition education for individuals and families.' },
        { id: 'prevention', title: 'Preventive health', category: 'Wellness', summary: 'Everyday actions that can support healthier choices.' }
      ] }
    }
    const body = await request('/api/v1/health/topics')
    return { topics: body?.topics || [] }
  },

  async getConversationHistory() {
    if (API_MODE === 'mock' || !API_BASE_URL) {
      await mockDelay(240)
      return { conversations: JSON.parse(localStorage.getItem('pugaai-history') || '[]') }
    }
    const body = await request('/api/v1/ai/conversations')
    return { conversations: body?.conversations || [] }
  },




  async transcribeVoice(blob, { language = 'en-NG' } = {}) {
    if (API_MODE === 'mock' || !API_BASE_URL) {
      await mockDelay(650)
      return { transcript: 'I would like help finding the right healthcare service.', language, confidence: 0.94, demo: true }
    }
    const form = new FormData()
    form.append('audio', blob, 'pugaai-voice.webm')
    form.append('language', language)
    return request('/api/v1/voice/transcriptions', { method: 'POST', body: form, isFormData: true })
  },

  async submitConversationFeedback({ conversationId, messageId, feedback }) {
    if (API_MODE === 'mock' || !API_BASE_URL) {
      await mockDelay(160)
      return { success: true, conversationId, messageId, feedback, demo: true }
    }
    return request(`/api/v1/conversations/${conversationId}/feedback`, {
      method: 'POST',
      body: JSON.stringify({ message_id: messageId, feedback }),
    })
  },

  async sendConversationMessage(conversationId, message, context = {}) {
    if (API_MODE === 'mock' || !API_BASE_URL) {
      await mockDelay(500)
      return {
        message: {
          id: `demo-${Date.now()}`,
          role: 'assistant',
          content: 'I can help you understand your options and connect you to the appropriate Puga service.',
          safety: { medicalDisclaimer: true },
          demo: true,
        },
        conversationId,
        context,
      }
    }
    return request(`/api/v1/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ message, context }),
    })
  },

  async getConsentStatus() {
    if (API_MODE === 'mock' || !API_BASE_URL) {
      await mockDelay(220)
      return {
        consent: {
          healthDataAccess: { status: 'granted', purpose: 'Care navigation and authorized service delivery', updatedAt: 'Today' },
          aiPersonalization: { status: 'not-granted', purpose: 'Personalized PugaAI Health support', updatedAt: 'Not enabled' },
          careHandoff: { status: 'granted', purpose: 'Connect you to PugaCare services', updatedAt: 'Today' },
        },
      }
    }
    const body = await request('/api/v1/consent')
    return { consent: body?.consent || {} }
  },

  async updateConsent({ key, status }) {
    if (API_MODE === 'mock' || !API_BASE_URL) {
      await mockDelay(350)
      return { success: true, key, status, updatedAt: 'Just now' }
    }
    const body = await request('/api/v1/consent', {
      method: 'PATCH',
      body: JSON.stringify({ key, status }),
    })
    return { success: body?.success !== false, key, status, updatedAt: body?.updated_at || 'Just now' }
  },

  async getProtectedHealthId() {
    if (API_MODE === 'mock' || !API_BASE_URL) {
      await mockDelay(220)
      return {
        healthId: 'PUGA-••••-4821',
        cardStatus: 'active',
        qrAvailable: true,
        verified: false,
      }
    }
    const body = await request('/api/v1/me/health-id')
    return body
  },

  async getFacilities({ query = '', service = '' } = {}) {
    if (API_MODE === 'mock' || !API_BASE_URL) {
      await mockDelay(280)
      const facilities = [
        { id: 'fac-1', name: 'PugaCare Partner Clinic — Yenagoa', location: 'Yenagoa, Bayelsa', distance: '2.4 km', services: ['Teleconsultation', 'Laboratory', 'General consultation'], availability: 'Available today', initials: 'PC' },
        { id: 'fac-2', name: 'Puga TriniCare Network Facility', location: 'Yenagoa, Bayelsa', distance: '5.1 km', services: ['General consultation', 'Laboratory', 'Prescription & refill'], availability: 'Next available tomorrow', initials: 'PT' },
        { id: 'fac-3', name: 'Participating Community Health Facility', location: 'Ogbia, Bayelsa', distance: '—', services: ['General consultation', 'Maternal health'], availability: 'Check availability', initials: 'CH' }
      ]
      const q = query.toLowerCase().trim()
      return { facilities: facilities.filter((facility) => !q || `${facility.name} ${facility.location} ${facility.services.join(' ')}`.toLowerCase().includes(q)).filter((facility) => !service || facility.services.includes(service)) }
    }
    const params = new URLSearchParams()
    if (query) params.set('query', query)
    if (service) params.set('service', service)
    const body = await request(`/api/v1/care/facilities?${params.toString()}`)
    return { facilities: body?.facilities || [] }
  },

  async getProviders({ facilityId = '', service = '' } = {}) {
    if (API_MODE === 'mock' || !API_BASE_URL) {
      await mockDelay(260)
      return { providers: [
        { id: 'prov-1', name: 'Available healthcare professional', specialty: service || 'Primary care', facilityId: facilityId || 'fac-1', mode: 'Teleconsultation', nextSlot: 'Today · 16:30' },
        { id: 'prov-2', name: 'Participating provider', specialty: 'Family health', facilityId: facilityId || 'fac-1', mode: 'In-person', nextSlot: 'Tomorrow · 09:00' }
      ] }
    }
    const params = new URLSearchParams()
    if (facilityId) params.set('facility_id', facilityId)
    if (service) params.set('service', service)
    const body = await request(`/api/v1/care/providers?${params.toString()}`)
    return { providers: body?.providers || [] }
  },

  async createAppointmentRequest({ facilityId, providerId, service, mode, preferredTime, context = '' }) {
    if (API_MODE === 'mock' || !API_BASE_URL) {
      await mockDelay(500)
      return { demo: true, appointmentId: `demo-appt-${Date.now()}`, status: 'requested', facilityId, providerId, service, mode, preferredTime, context }
    }
    const body = await request('/api/v1/care/appointments', { method: 'POST', body: JSON.stringify({ facility_id: facilityId, provider_id: providerId, service, mode, preferred_time: preferredTime, context }) })
    return { demo: false, appointmentId: body?.appointment?.id || body?.id, status: body?.appointment?.status || 'requested' }
  },

  async getLaboratoryServices() {
    if (API_MODE === 'mock' || !API_BASE_URL) {
      await mockDelay(260)
      return { services: [
        { id: 'lab-1', name: 'Malaria test', description: 'Digital request pathway for malaria testing at a participating laboratory.', facility: 'PugaCare Partner Clinic — Yenagoa', facilityId: 'fac-1', turnaround: 'Same day where available' },
        { id: 'lab-2', name: 'Full blood count', description: 'Laboratory request pathway for a full blood count.', facility: 'Puga TriniCare Network Facility', facilityId: 'fac-2', turnaround: '24 hours indicative' },
        { id: 'lab-3', name: 'Blood glucose test', description: 'Request pathway for supported blood glucose testing.', facility: 'Participating Community Health Facility', facilityId: 'fac-3', turnaround: 'Check facility' }
      ] }
    }
    const body = await request('/api/v1/care/laboratory/services')
    return { services: body?.services || [] }
  },

  async createLaboratoryRequest({ serviceId, serviceName, facilityId }) {
    if (API_MODE === 'mock' || !API_BASE_URL) {
      await mockDelay(500)
      return { demo: true, requestId: `demo-lab-${Date.now()}`, status: 'requested', serviceId, serviceName, facilityId }
    }
    const body = await request('/api/v1/care/laboratory/requests', { method: 'POST', body: JSON.stringify({ service_id: serviceId, service_name: serviceName, facility_id: facilityId }) })
    return { demo: false, requestId: body?.request?.id || body?.id, status: body?.request?.status || 'requested' }
  },

  async getMedicationServices() {
    if (API_MODE === 'mock' || !API_BASE_URL) {
      await mockDelay(260)
      return { services: [
        { id: 'med-1', name: 'Approved medication refill', description: 'Continue a refill workflow for an existing approved prescription.', pharmacy: 'PugaCare Partner Pharmacy — Yenagoa', pharmacyId: 'pharm-1', fulfillment: 'Pickup or supported delivery' },
        { id: 'med-2', name: 'Prescription verification', description: 'Submit an existing prescription for pharmacy verification.', pharmacy: 'Puga TriniCare Network Pharmacy', pharmacyId: 'pharm-2', fulfillment: 'Availability confirmed by pharmacy' }
      ] }
    }
    const body = await request('/api/v1/care/medications/services')
    return { services: body?.services || [] }
  },

  async createMedicationRefillRequest({ medicationId, medicationName, pharmacyId }) {
    if (API_MODE === 'mock' || !API_BASE_URL) {
      await mockDelay(500)
      return { demo: true, requestId: `demo-refill-${Date.now()}`, status: 'requested', medicationId, medicationName, pharmacyId }
    }
    const body = await request('/api/v1/care/medications/refill-requests', { method: 'POST', body: JSON.stringify({ medication_id: medicationId, medication_name: medicationName, pharmacy_id: pharmacyId }) })
    return { demo: false, requestId: body?.request?.id || body?.id, status: body?.request?.status || 'requested' }
  },

  async getPaymentTransactions() {
    if (API_MODE === 'mock' || !API_BASE_URL) {
      await mockDelay(260)
      return { transactions: [
        { id: 'tx-1', type: 'service', service: 'Teleconsultation', provider: 'PugaCare Partner Clinic — Yenagoa', dateLabel: 'Today · 16:30', status: 'pending', statusLabel: 'Payment pending', reference: 'PAY-2401', serviceAmount: 3000, platformFee: 200, amount: 3200 },
        { id: 'tx-2', type: 'service', service: 'Laboratory service', provider: 'Puga TriniCare Network Facility', dateLabel: 'Sep 24 · 10:20', status: 'paid', statusLabel: 'Paid', reference: 'PAY-2396', serviceAmount: 4500, platformFee: 200, amount: 4700 },
        { id: 'tx-3', type: 'platform-fee', service: 'Completed care transaction', provider: 'PugaPay', dateLabel: 'Sep 20 · 14:05', status: 'paid', statusLabel: 'Paid', reference: 'PAY-2388', serviceAmount: 1800, platformFee: 200, amount: 2000 }
      ] }
    }
    const body = await request('/api/v1/payments/transactions')
    return { transactions: body?.transactions || [] }
  },

  async initiatePayment({ transactionId, method = 'paystack' }) {
    if (API_MODE === 'mock' || !API_BASE_URL) {
      await mockDelay(550)
      return { demo: true, transactionId, method, status: 'handoff_ready', checkoutUrl: null }
    }
    const body = await request('/api/v1/payments/checkout', { method: 'POST', body: JSON.stringify({ transaction_id: transactionId, method }) })
    return { demo: false, transactionId: body?.transaction?.id || transactionId, status: body?.transaction?.status || 'handoff_ready', checkoutUrl: body?.checkout_url || body?.payment_url || null }
  },

  async getAppointments() {
    if (API_MODE === 'mock' || !API_BASE_URL) {
      await mockDelay(260)
      return { appointments: [
        { id: 'appt-1', service: 'Teleconsultation', provider: 'Participating primary-care provider', facility: 'PugaCare Partner Clinic — Yenagoa', dateLabel: 'Today', time: '16:30', mode: 'Teleconsultation', status: 'confirmed', statusLabel: 'Confirmed', reference: 'PGA-2401' },
        { id: 'appt-2', service: 'General consultation', provider: 'Participating provider', facility: 'Puga TriniCare Network Facility', dateLabel: 'Tomorrow', time: '09:00', mode: 'In-person', status: 'requested', statusLabel: 'Request pending', reference: 'PGA-2402' },
        { id: 'appt-3', service: 'Laboratory follow-up', provider: 'Laboratory service', facility: 'Participating Community Health Facility', dateLabel: 'Sep 28', time: '11:00', mode: 'In-person', status: 'completed', statusLabel: 'Completed', reference: 'PGA-2390' }
      ] }
    }
    const body = await request('/api/v1/care/appointments')
    return { appointments: body?.appointments || [] }
  },

  async updateAppointment({ appointmentId, action, preferredTime = '' }) {
    if (API_MODE === 'mock' || !API_BASE_URL) {
      await mockDelay(350)
      return { demo: true, appointmentId, action, status: action === 'cancel' ? 'cancellation_requested' : 'reschedule_requested', preferredTime }
    }
    const body = await request(`/api/v1/care/appointments/${appointmentId}`, { method: 'PATCH', body: JSON.stringify({ action, preferred_time: preferredTime }) })
    return body?.appointment || body
  },

  async createTeleconsultationSession({ appointmentId }) {
    if (API_MODE === 'mock' || !API_BASE_URL) {
      await mockDelay(450)
      return { demo: true, appointmentId, sessionId: `demo-session-${Date.now()}`, status: 'ready' }
    }
    const body = await request(`/api/v1/care/appointments/${appointmentId}/teleconsultation`, { method: 'POST', body: JSON.stringify({ channel: 'pugaai-health' }) })
    return body?.session || body
  },

  async createCareHandoff({ service, context }) {
    if (API_MODE === 'mock' || !API_BASE_URL) {
      await mockDelay(500)
      return { demo: true, handoffId: `demo-handoff-${Date.now()}`, status: 'prepared', service, context }
    }
    const body = await request('/api/v1/puga-care/handoff', { method: 'POST', body: JSON.stringify({ service, context }) })
    return { demo: false, handoffId: body?.handoff?.id || body?.id, status: body?.handoff?.status || 'prepared', service }
  },


  async getFamilyMembers() {
    if (API_MODE === 'mock' || !API_BASE_URL) {
      await mockDelay(240)
      return { family: [
        { id: 'member-self', name: 'You', relationship: 'Self', initials: 'YO', healthId: 'PUGA-••••-4821', authorization: 'owner', status: 'active', nextCare: 'No immediate action' },
        { id: 'member-ama', name: 'Ama Kingdom', relationship: 'Child', initials: 'AK', healthId: 'PUGA-••••-1934', authorization: 'authorized', status: 'active', nextCare: 'Appointment · Tomorrow · 10:00' },
        { id: 'member-eli', name: 'Elijah Kingdom', relationship: 'Child', initials: 'EK', healthId: 'PUGA-••••-7750', authorization: 'authorized', status: 'active', nextCare: 'Medication refill · Due soon' }
      ], demo: true }
    }
    const body = await request('/api/v1/me/family')
    return { family: body?.family || body?.members || [], demo: false }
  },

  async addFamilyMember(input) {
    if (API_MODE === 'mock' || !API_BASE_URL) {
      await mockDelay(280)
      return { member: { id: `demo-member-${Date.now()}`, ...input, initials: (input.name || 'FM').split(' ').map((x) => x[0]).join('').slice(0,2).toUpperCase(), healthId: 'Pending identity', authorization: 'pending', status: 'pending', nextCare: 'Complete identity and authorization' }, demo: true }
    }
    const body = await request('/api/v1/me/family/members', { method: 'POST', body: JSON.stringify(input) })
    return { member: body?.member || body, demo: false }
  },

  async getFamilyMemberAuthorization(memberId) {
    if (API_MODE === 'mock' || !API_BASE_URL) {
      await mockDelay(180)
      return { memberId, status: memberId === 'member-self' ? 'owner' : 'authorized', scope: 'care-navigation', updated: 'Today', demo: true }
    }
    const body = await request(`/api/v1/me/family/members/${encodeURIComponent(memberId)}/authorization`)
    return { authorization: body?.authorization || body, demo: false }
  },

  async updateFamilyMemberAuthorization({ memberId, status, scope }) {
    if (API_MODE === 'mock' || !API_BASE_URL) {
      await mockDelay(220)
      return { authorization: { memberId, status, scope: scope || 'care-navigation', updated: 'Just now' }, demo: true }
    }
    const body = await request(`/api/v1/me/family/members/${encodeURIComponent(memberId)}/authorization`, { method: 'POST', body: JSON.stringify({ status, scope }) })
    return { authorization: body?.authorization || body, demo: false }
  },

  async getHealthDashboard() {
    if (API_MODE === 'mock' || !API_BASE_URL) {
      await mockDelay(260)
      return { dashboard: {
        healthId: { status: 'Active', identifier: 'PUGA-••••-4821' },
        careJourney: { completed: 2, active: 1, next: 'Continue with PugaCare' },
        appointments: { upcoming: 1, next: 'Care appointment · Today · 16:30' },
        consultations: { recent: 1, latest: 'PugaAI Health guidance · Today' },
        laboratory: { pending: 1, latest: 'Result delivery · Awaiting provider result' },
        medications: { active: 2, refillDue: 1, next: 'Medication refill · Review when due' },
        payments: { recent: 1, status: 'Receipt available' },
        conversations: { recent: 3, latest: 'Malaria prevention' },
        notifications: { unread: 2 },
        indicators: [
          { label: 'Care continuity', value: 'Active', context: 'Journey has a next step available.' },
          { label: 'Privacy access', value: 'Protected', context: 'Review permissions and access history anytime.' },
          { label: 'PugaAccess', value: 'Available', context: 'IVR, USSD and SMS continuity is supported.' }
        ]
      }, demo: true }
    }
    const body = await request('/api/v1/me/health-dashboard')
    return { dashboard: body?.dashboard || body, demo: false }
  },

  async getHealthJourney() {
    if (API_MODE === 'mock' || !API_BASE_URL) {
      await mockDelay(260)
      return { completed: 2, active: 1, nextSteps: 2, events: [
        { id: 'journey-1', title: 'PugaAI Health conversation', status: 'completed', description: 'Health-information guidance was provided through a PugaAI Health conversation.', date: 'Today · Completed' },
        { id: 'journey-2', title: 'Care option selected', status: 'completed', description: 'A care pathway was selected for follow-up.', date: 'Today · Completed' },
        { id: 'journey-3', title: 'Continue with PugaCare', status: 'active', description: 'Continue to the appropriate patient-care workflow when you are ready.', date: 'Next step', action: { label: 'Open care', page: 'care', message: 'Care navigation opened.' } }
      ] }
    }
    const body = await request('/api/v1/me/health-journey')
    return body?.journey || body
  },

  async getPermissions() {
    if (API_MODE === 'mock' || !API_BASE_URL) {
      await mockDelay(240)
      return { permissions: [
        { id: 'perm-1', icon: 'PC', name: 'PugaCure · Care access', purpose: 'Authorized provider workflows may access permitted information for care delivery.', status: 'active', updated: 'Today' },
        { id: 'perm-2', icon: 'AI', name: 'PugaAI Health · Protected session', purpose: 'PugaAI may use minimum necessary information for an explicitly approved protected task.', status: 'active', updated: 'Today' },
        { id: 'perm-3', icon: 'PA', name: 'PugaCare · Service navigation', purpose: 'PugaCare may receive the context needed to continue a patient service workflow.', status: 'active', updated: 'Yesterday' }
      ] }
    }
    const body = await request('/api/v1/me/permissions')
    return { permissions: body?.permissions || [] }
  },

  async updatePermission({ permissionId, status }) {
    if (API_MODE === 'mock' || !API_BASE_URL) {
      await mockDelay(220)
      return { id: permissionId, status, demo: true }
    }
    const body = await request(`/api/v1/me/permissions/${permissionId}`, { method: 'PATCH', body: JSON.stringify({ status }) })
    return body?.permission || body
  },

  async getAccessLog() {
    if (API_MODE === 'mock' || !API_BASE_URL) {
      await mockDelay(250)
      return { entries: [
        { id: 'access-1', initials: 'PC', actor: 'PugaCure · Provider', purpose: 'Consultation preparation', time: 'Today · 10:42', status: 'Allowed' },
        { id: 'access-2', initials: 'PA', actor: 'PugaCare', purpose: 'Teleconsultation handoff', time: 'Yesterday · 16:08', status: 'Allowed' },
        { id: 'access-3', initials: 'PC', actor: 'PugaCure · Facility', purpose: 'Patient identity lookup', time: 'Sep 23 · 09:14', status: 'Allowed' }
      ] }
    }
    const body = await request('/api/v1/me/access-log')
    return { entries: body?.entries || [] }
  },
  async getNotifications() {
    if (!isLive) {
      await mockDelay(180)
      return { notifications: [
        { id: 'notif-1', type: 'care', title: 'Appointment reminder', text: 'Your upcoming care appointment is ready to review.', time: 'Today · 09:20', unread: true, page: 'appointments' },
        { id: 'notif-2', type: 'payment', title: 'Payment receipt available', text: 'A recent PugaPay transaction has a receipt ready to view.', time: 'Yesterday · 18:42', unread: true, page: 'payments' },
        { id: 'notif-3', type: 'security', title: 'Privacy access reviewed', text: 'Your health-information access controls are available in Privacy & access.', time: 'Sep 24 · 12:10', unread: false, page: 'privacy' },
        { id: 'notif-4', type: 'system', title: 'PugaAccess continuity', text: 'You can continue supported PugaAI Health journeys through IVR, USSD or SMS.', time: 'Sep 23 · 08:15', unread: false, page: 'access' }
      ] }
    }
    const body = await request('/api/v1/notifications')
    return { notifications: body?.notifications || [] }
  },

  async markNotificationRead(notificationId) {
    if (!isLive) { await mockDelay(120); return { id: notificationId, unread: false, demo: true } }
    const body = await request(`/api/v1/notifications/${notificationId}/read`, { method: 'POST' })
    return body?.notification || body
  },

  async markAllNotificationsRead() {
    if (!isLive) { await mockDelay(120); return { unread: 0, demo: true } }
    return request('/api/v1/notifications/read-all', { method: 'POST' })
  },

  async getRuntimeStatus() {
    if (!isLive) return { mode: 'mock', environment: runtimeConfig.appEnv, channel: runtimeConfig.channel, connected: false, reason: 'Mock mode is active.' }
    const body = await request('/api/v1/health')
    return { mode: 'live', environment: runtimeConfig.appEnv, channel: runtimeConfig.channel, connected: true, ...body }
  },

  async login({ identifier, otp }) {
    if (!isLive) {
      await mockDelay(300)
      const token = `demo-token-${Date.now()}`
      setStoredAccessToken(token)
      return { demo: true, token, status: 'authenticated' }
    }
    const body = await request('/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ identifier, otp }) })
    const token = body?.access_token || body?.token
    if (token) setStoredAccessToken(token)
    return { demo: false, token, status: body?.status || 'authenticated', user: body?.user || null }
  },

  async logout() {
    if (isLive) {
      try { await request('/api/v1/auth/logout', { method: 'POST' }) } finally { setStoredAccessToken('') }
    } else setStoredAccessToken('')
    return { status: 'signed-out' }
  },

  async getHealthId() {
    if (!isLive) {
      await mockDelay(180)
      return { healthId: 'PUGA-DEMO-001', cardStatus: 'active', qrAvailable: true, demo: true }
    }
    const body = await request('/api/v1/me/health-id')
    return { ...(body?.health_id || body), demo: false }
  },

  async createPugaAccessSession({ channel = 'web', destination = 'voice' } = {}) {
    if (!isLive) {
      await mockDelay(220)
      return { demo: true, sessionId: `demo-access-${Date.now()}`, channel, destination, status: 'prepared', accessUrl: runtimeConfig.pugaAccessUrl || null }
    }
    const body = await request('/api/v1/puga-access/sessions', { method: 'POST', body: JSON.stringify({ source_channel: channel, destination }) })
    return { demo: false, ...(body?.session || body) }
  },

  async getNatlasStatus() {
    if (!runtimeConfig.nAtlasEndpoint) return { configured: false, connected: false, mode: 'unconfigured' }
    try {
      const response = await fetch(`${runtimeConfig.nAtlasEndpoint}/health`, { headers: { Accept: 'application/json' } })
      return { configured: true, connected: response.ok, mode: 'configured' }
    } catch { return { configured: true, connected: false, mode: 'unreachable' } }
  },

}
