import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'
import { aiHealthApi } from './services/api'
import { runtimeConfig, isLive, isBrowserOnline, clearSession, getAuthState } from './services/runtime'
import { VOICE_STATES, requestMicrophonePermission, createRecorder, speak, stopSpeaking, getSupportedVoiceCapabilities } from './services/voice'
import { getUserFacingError } from './services/resilience'
import { normalizeConversationText, deriveConversationTitle, getFeedbackLabel } from './services/conversation'
import { PUGA_ACCESS_CHANNELS, getPugaAccessChannelMeta, normalizePugaAccessSession, isPugaAccessSessionExpired, getPugaAccessStatusLabel } from './services/pugaaccess'
import { createValidationRecord, summarizeValidation, isValidationConsentComplete, NAIC_VALIDATION_TARGET } from './services/naic-validation'
import { isNaicAdminSession, canAccessNaicConsole } from './services/naic-admin'

const navItems = [
  { id: 'home', label: 'Home', icon: '⌂' },
  { id: 'talk', label: 'Talk to PugaAI', icon: '◉' },
  { id: 'care', label: 'Care', icon: '＋' },
  { id: 'health-id', label: 'Health ID', icon: '▣' },
  { id: 'access', label: 'My Access', icon: '◌' },
]

const quickTopics = [
  ['Malaria prevention', '＋', 'Prevention'], ['Child health', '♡', 'Family'], ['Pregnancy', '⌁', 'Maternal'],
  ['Blood pressure', '◈', 'Chronic care'], ['Nutrition', '◌', 'Wellness'], ['Find care', '⌖', 'Navigation'],
]
const healthInfoNav = { id: 'health-info', label: 'Health information', icon: '◇' }
const appointmentNav = { id: 'appointments', label: 'Appointments', icon: '◷' }
const serviceNav = { id: 'services', label: 'Lab & medication', icon: '▤' }
const paymentNav = { id: 'payments', label: 'Payments', icon: '₦' }
const healthDashboardNav = { id: 'health-dashboard', label: 'Health Dashboard', icon: '♥' }
const familyNav = { id: 'family', label: 'Family Health', icon: '♧' }
const trustNav = [
  { id: 'journey', label: 'My health journey', icon: '◫' },
  { id: 'privacy', label: 'Privacy & access', icon: '⌁' },
]
const starterPrompts = [
  'How can I prevent malaria?', 'Where can I find healthcare near me?',
  'What should I know about high blood pressure?', 'How do I book a teleconsultation?',
]

class AppErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null } }
  static getDerivedStateFromError(error) { return { hasError: true, error } }
  componentDidCatch(error) { console.error('PugaAI Health UI error') }
  render() {
    if (this.state.hasError) return <div className="fatal-error"><img src="/puga-trinicare-compact.png" alt="Puga TriniCare" /><h1>Something went wrong</h1><p>The PugaAI Health interface encountered an unexpected error. Your account and protected health data are not exposed by this screen.</p><button className="button primary" onClick={() => window.location.reload()}>Reload PugaAI Health</button></div>
    return this.props.children
  }
}

function App() {
  const [page, setPage] = useState('home')
  const [message, setMessage] = useState('')
  const [messages, setMessages] = useState([])
  const [showEmergency, setShowEmergency] = useState(false)
  const [showConsent, setShowConsent] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [showAuth, setShowAuth] = useState(false)
  const [sessionProtected, setSessionProtected] = useState(false)
  const [authState, setAuthState] = useState(getAuthState())
  const [naicAdminSession, setNaicAdminSession] = useState(() => ({
    status: sessionStorage.getItem('pugaai-naic-admin-state') || 'signed-out',
    role: sessionStorage.getItem('pugaai-naic-admin-role') || '',
  }))
  const [consentState, setConsentState] = useState(null)
  const [consentLoading, setConsentLoading] = useState(false)
  const [showConsentCenter, setShowConsentCenter] = useState(false)
  const [protectedNotice, setProtectedNotice] = useState('')
  const [healthIdData, setHealthIdData] = useState(null)
  const [voiceState, setVoiceState] = useState(VOICE_STATES.IDLE)
  const [voiceTranscript, setVoiceTranscript] = useState('')
  const [voiceConfidence, setVoiceConfidence] = useState(null)
  const [voiceError, setVoiceError] = useState('')
  const [voiceLanguage, setVoiceLanguage] = useState('en-NG')
  const [voiceSupported, setVoiceSupported] = useState({ mediaRecorder: false, speechSynthesis: false })
  const [voiceRecorder, setVoiceRecorder] = useState(null)
  const [accessChannel, setAccessChannel] = useState('ivr')
  const [accessSession, setAccessSession] = useState(null) // continuitySupported
  const [accessLoading, setAccessLoading] = useState(false)
  const [accessError, setAccessError] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [conversationId, setConversationId] = useState(null)
  const [feedbackByMessage, setFeedbackByMessage] = useState({})
  const [copiedMessageId, setCopiedMessageId] = useState(null)
  const [speakingMessageId, setSpeakingMessageId] = useState(null)
  const [toast, setToast] = useState('')
  const [careSelection, setCareSelection] = useState(null)
  const [handoff, setHandoff] = useState(null)
  const [appointmentRequest, setAppointmentRequest] = useState(null)
  const [teleconsultation, setTeleconsultation] = useState(null)
  const [naicValidationSession, setNaicValidationSession] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('pugaai-naic-session') || 'null') } catch { return null }
  })
  const naicVoiceContextRef = useRef(null)
  const [selectedLanguage, setSelectedLanguage] = useState(localStorage.getItem('pugaai-language') || 'English (Nigeria)')
  const [notificationCount, setNotificationCount] = useState(2)
  const [showNotifications, setShowNotifications] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [notificationFilter, setNotificationFilter] = useState('all')
  const [notificationsLoading, setNotificationsLoading] = useState(false)
  const [online, setOnline] = useState(isBrowserOnline())
  const [backendHealth, setBackendHealth] = useState(null)
  const recorderRef = useRef(null)
  const streamRef = useRef(null)
  const chunksRef = useRef([])
  const toastTimerRef = useRef(null)

  const greeting = useMemo(() => 'I can help you understand health information, navigate to appropriate care, and connect you with Puga services.', [])

  useEffect(() => {
    const onOnline = () => { setOnline(true); notify('Connection restored.') }
    const onOffline = () => { setOnline(false); notify('You are offline. Text guidance may remain available, but live services require a connection.') }
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline) }
  }, [])

  useEffect(() => () => {
    if (streamRef.current) streamRef.current.getTracks().forEach((track) => track.stop())
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
  }, [])

  useEffect(() => { setVoiceSupported(getSupportedVoiceCapabilities()) }, [])

  useEffect(() => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {})
  }, [])

  useEffect(() => {
    let cancelled = false
    setNotificationsLoading(true)
    aiHealthApi.getNotifications().then((result) => {
      if (!cancelled) {
        const next = result.notifications || []
        setNotifications(next)
        setNotificationCount(next.filter((item) => item.unread).length)
      }
    }).catch(() => { if (!cancelled) notify('Notifications could not be loaded. Please retry.') })
      .finally(() => { if (!cancelled) setNotificationsLoading(false) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    if (isLive) aiHealthApi.getRuntimeHealth().then((result) => { if (!cancelled) setBackendHealth(result) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    if (authState === 'authenticated') {
      setConsentLoading(true)
      Promise.all([aiHealthApi.getConsentStatus(), aiHealthApi.getProtectedHealthId()])
        .then(([consentResult, healthIdResult]) => {
          if (!cancelled) {
            setConsentState(consentResult.consent)
            setHealthIdData(healthIdResult)
          }
        })
        .catch(() => { if (!cancelled) notify('Protected account data could not be loaded. Please retry.') })
        .finally(() => { if (!cancelled) setConsentLoading(false) })
    } else {
      setConsentState(null)
      setHealthIdData(null)
    }
    return () => { cancelled = true }
  }, [authState])

  const notify = (text) => {
    setToast(text)
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current)
    toastTimerRef.current = window.setTimeout(() => setToast(''), 3500)
  }

  const persistConversation = (id, text) => {
    try {
      const current = JSON.parse(sessionStorage.getItem('pugaai-history') || '[]')
      const existing = current.find((item) => item.id === id)
      const entry = { id, title: existing?.title || deriveConversationTitle(text), preview: normalizeConversationText(text), updatedAt: new Date().toISOString() }
      const next = existing ? current.map((item) => item.id === id ? { ...item, ...entry } : item) : [entry, ...current]
      sessionStorage.setItem('pugaai-history', JSON.stringify(next.slice(0, 20)))
    } catch {}
  }

  const startNewConversation = () => {
    stopSpeaking()
    setMessages([])
    setMessage('')
    setConversationId(null)
    setFeedbackByMessage({})
    setCopiedMessageId(null)
    setSpeakingMessageId(null)
    setVoiceState(VOICE_STATES.IDLE)
    setPage('talk')
    notify('New PugaAI Health conversation started.')
  }

  const copyAssistantMessage = async (item) => {
    const text = normalizeConversationText(item?.text)
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      setCopiedMessageId(item.id || text)
      notify('Response copied to clipboard.')
      window.setTimeout(() => setCopiedMessageId(null), 1800)
    } catch {
      notify('Copy is unavailable in this browser. You can select the response text manually.')
    }
  }

  const speakAssistantMessage = async (item) => {
    const id = item.id || item.text
    if (speakingMessageId === id) {
      stopSpeaking()
      setSpeakingMessageId(null)
      return
    }
    try {
      setSpeakingMessageId(id)
      await speak(item.text, {
        lang: voiceLanguage,
        onStart: () => setSpeakingMessageId(id),
        onEnd: () => setSpeakingMessageId(null),
        onError: () => { setSpeakingMessageId(null); notify('Voice playback failed. Text response remains available.') },
      })
    } catch {
      setSpeakingMessageId(null)
      notify('Voice playback is unavailable.')
    }
  }

  const giveMessageFeedback = async (item, value) => {
    const id = item.id || item.text
    setFeedbackByMessage((prev) => ({ ...prev, [id]: value }))
    try {
      await aiHealthApi.submitConversationFeedback({ conversationId, messageId: item.id, feedback: value })
      notify(`${getFeedbackLabel(value)} feedback recorded.`)
    } catch {
      notify('Feedback could not be sent. Your local selection remains visible.')
    }
  }

  const ensureConversation = async () => {
    if (conversationId) return conversationId
    const result = await aiHealthApi.createConversation()
    setConversationId(result.conversationId)
    return result.conversationId
  }

  const sendMessage = async (value = message) => {
    const clean = value.trim()
    if (!clean || isSending) return
    setIsSending(true)
    setPage('talk')
    setMessages((prev) => [...prev, { role: 'user', text: clean, status: 'sent' }])
    setMessage('')
    const voiceContext = naicVoiceContextRef.current && naicVoiceContextRef.current.transcript === clean ? naicVoiceContextRef.current : null
    try {
      const id = await ensureConversation()
      persistConversation(id, clean)
      const response = await aiHealthApi.sendMessage({ conversationId: id, message: clean, sessionMode: sessionProtected ? 'protected' : 'standard', language: selectedLanguage })
      setMessages((prev) => [...prev, { role: 'ai', id: response.id, text: response.text, demo: response.demo, safety: response.safety, careActions: response.careActions || [] }])
      if (voiceContext && isValidationConsentComplete(naicValidationSession || {})) {
        const record = createValidationRecord({
          participantId: naicValidationSession.participantId,
          language: voiceContext.language || voiceLanguage,
          channel: 'web-voice',
          transcript: clean,
          confidence: voiceContext.confidence,
          conversationId: id,
          messageId: response.id,
          responseCategory: 'primary-health-information',
          status: response?.demo ? 'demo' : 'completed',
        })
        if (record.status === 'completed') {
          try { await aiHealthApi.logNaicInteraction(record); notify('NAIC validation interaction recorded.') } catch { notify('The response completed, but the NAIC validation record could not be saved.') }
        }
      }
      naicVoiceContextRef.current = null
    } catch (error) {
      if (voiceContext && isValidationConsentComplete(naicValidationSession || {})) {
        try {
          await aiHealthApi.logNaicInteraction(createValidationRecord({
            participantId: naicValidationSession.participantId, language: voiceContext.language || voiceLanguage, channel: 'web-voice', transcript: clean, confidence: voiceContext.confidence, conversationId: conversationId, status: 'failed'
          }))
        } catch {}
      }
      setMessages((prev) => [...prev, { role: 'system', text: getUserFacingError(error, 'PugaAI Health could not complete that request. Please retry.'), retry: clean }])
    } finally { setIsSending(false) }
  }

  const stopRecording = () => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop()
  }

  const handleVoice = async () => {
    if (voiceState === 'recording') { stopRecording(); return }
    if (voiceState === 'processing') return
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      notify('Voice capture is not supported here. You can continue with text.')
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      chunksRef.current = []
      const mimeCandidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
      const mimeType = mimeCandidates.find((type) => MediaRecorder.isTypeSupported(type)) || ''
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      recorderRef.current = recorder
      recorder.ondataavailable = (event) => { if (event.data.size > 0) chunksRef.current.push(event.data) }
      recorder.onerror = () => { setVoiceState('idle'); notify('Voice capture encountered an error. Please try again or use text.') }
      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        stream.getTracks().forEach((track) => track.stop())
        streamRef.current = null
        recorderRef.current = null
        setVoiceState('processing')
        try {
          const id = await ensureConversation()
          const result = await aiHealthApi.transcribeAudio({ conversationId: id, audioBlob: blob, mimeType: blob.type })
          if (result.text) naicVoiceContextRef.current = { transcript: result.text, confidence: result.confidence ?? null, language: result.language || voiceLanguage }
          setMessage(result.text)
          setPage('talk')
          notify(result.demo ? 'Demo transcription path completed.' : 'Voice transcription received.')
        } catch (error) {
          notify(error?.message || 'Voice transcription failed. Please use text instead.')
        } finally { setVoiceState('idle') }
      }
      recorder.start()
      setVoiceState('recording')
    } catch {
      setVoiceState('idle')
      notify('Microphone permission was not granted. You can continue with text.')
    }
  }

  const startVoiceCapture = async () => {
    setVoiceError('')
    setVoiceTranscript('')
    setVoiceConfidence(null)
    setVoiceState(VOICE_STATES.REQUESTING_PERMISSION)
    try {
      const stream = await requestMicrophonePermission()
      const recorder = createRecorder(stream, {
        onStart: () => setVoiceState(VOICE_STATES.LISTENING),
        onError: () => {
          setVoiceState(VOICE_STATES.ERROR)
          setVoiceError('Microphone capture failed. Please try again or use text.')
        },
        onStop: async (blob) => {
          setVoiceState(VOICE_STATES.TRANSCRIBING)
          try {
            const result = await aiHealthApi.transcribeVoice(blob, { language: voiceLanguage })
            naicVoiceContextRef.current = { transcript: result.transcript || '', confidence: result.confidence ?? null, language: result.language || voiceLanguage }
            setVoiceTranscript(result.transcript || '')
            setVoiceConfidence(result.confidence ?? null)
            setVoiceState(VOICE_STATES.IDLE)
          } catch (error) {
            setVoiceState(VOICE_STATES.ERROR)
            setVoiceError(error?.message || 'Voice transcription failed. Please use text or retry.')
          }
        },
      })
      setVoiceRecorder(recorder)
      recorder.start()
    } catch (error) {
      setVoiceState(VOICE_STATES.ERROR)
      setVoiceError(error?.message || 'Microphone access was not granted.')
    }
  }

  const stopVoiceCapture = () => {
    if (voiceRecorder && voiceRecorder.state !== 'inactive') {
      setVoiceState(VOICE_STATES.PROCESSING)
      voiceRecorder.stop()
    }
  }

  const playVoiceResponse = (text) => {
    try {
      setVoiceState(VOICE_STATES.RESPONDING)
      speak(text, {
        lang: voiceLanguage,
        onStart: () => setVoiceState(VOICE_STATES.PLAYING),
        onEnd: () => setVoiceState(VOICE_STATES.IDLE),
        onError: () => { setVoiceState(VOICE_STATES.ERROR); setVoiceError('Voice playback failed. Text response remains available.') },
      })
    } catch (error) {
      setVoiceState(VOICE_STATES.ERROR)
      setVoiceError(error?.message || 'Voice playback is unavailable.')
    }
  }


  const startPugaAccessSession = async () => {
    setAccessLoading(true)
    setAccessError('')
    try {
      const result = await aiHealthApi.createPugaAccessSession({
        channel: accessChannel,
        language: voiceLanguage,
      })
      setAccessSession(result)
      notify(`PugaAccess ${accessChannel.toUpperCase()} session ready.`)
    } catch (error) {
      setAccessError(error?.message || 'PugaAccess session could not be started.')
    } finally {
      setAccessLoading(false)
    }
  }

  const requireAuth = (targetPage) => {
    if (authState !== 'authenticated') {
      setProtectedNotice('Sign in is required to access protected health information.')
      setShowAuth(true)
      return false
    }
    setPage(targetPage)
    return true
  }

  const updateConsent = async (key, status) => {
    if (authState !== 'authenticated') return requireAuth('privacy')
    setConsentLoading(true)
    try {
      await aiHealthApi.updateConsent({ key, status })
      const refreshed = await aiHealthApi.getConsentStatus()
      setConsentState(refreshed.consent)
      notify(status === 'granted' ? 'Permission enabled.' : 'Permission revoked.')
    } catch (error) {
      notify(error?.message || 'Permission update failed. Please retry.')
    } finally {
      setConsentLoading(false)
    }
  }

  const markNotificationRead = async (notificationId) => {
    try { await aiHealthApi.markNotificationRead(notificationId); setNotifications((items) => items.map((item) => item.id === notificationId ? { ...item, unread: false } : item)); setNotificationCount((count) => Math.max(0, count - 1)) }
    catch (error) { notify(error?.message || 'Could not update notification.') }
  }

  const markAllNotificationsRead = async () => {
    try { await aiHealthApi.markAllNotificationsRead(); setNotifications((items) => items.map((item) => ({ ...item, unread: false }))); setNotificationCount(0); notify('All notifications marked as read.') }
    catch (error) { notify(error?.message || 'Could not update notifications.') }
  }

  const handleAuth = (next) => {
    setAuthState(next)
    localStorage.setItem('pugaai-auth-state', next)
    if (next === 'authenticated') { setShowAuth(false); notify('Authenticated session is active.') }
  }

  return <div className="app-shell">
    <a className="skip-link" href="#main-content">Skip to main content</a>
    <div className={`connection-banner ${online ? 'online' : 'offline'}`} role="status" aria-live="polite">
      <span className="connection-dot" aria-hidden="true" />
      {online ? 'Connected' : 'Offline — live services may be unavailable'}
    </div>
    <header className="topbar">
      <button className="brand-button" onClick={() => setPage('home')} aria-label="Go to PugaAI Health home"><img src="/puga-trinicare-compact.png" alt="Puga TriniCare" /></button>
      <div className="topbar-center"><span className="product-mark">PUGAAI HEALTH</span><span className="product-tagline">Your AI-powered voice health navigator</span></div>
      <div className="top-actions"><span className={`online-chip ${online ? '' : 'offline-chip'}`}><span className="online-dot" /> {online ? 'Ready' : 'Offline'}</span><button className="notification-button" onClick={() => { setShowNotifications(true); setNotificationCount(0) }} aria-label={`Notifications${notificationCount ? `, ${notificationCount} unread` : ''}`}><span>◔</span>{notificationCount > 0 && <b>{notificationCount}</b>}</button><button className="profile-button" onClick={() => setShowProfile(true)} aria-label="Open profile">KM</button></div>
    </header>
    <div className="app-body">
      <aside className="sidebar">
        <div className="sidebar-product"><div className="sidebar-eyebrow">PUGAAI HEALTH</div><strong>Your AI-powered voice health navigator</strong></div>
        <nav className="main-nav" aria-label="Primary navigation">{navItems.map((item) => <button key={item.id} className={`nav-item ${page === item.id ? 'active' : ''}`} onClick={() => (['health-id','access','journey','privacy','appointments','services','payments'].includes(item.id) ? requireAuth(item.id) : setPage(item.id))}><span className="nav-icon">{item.icon}</span><span>{item.label}</span></button>)}</nav>
        <div className="secondary-nav">
          <button className={`nav-item compact ${page === healthDashboardNav.id ? 'active' : ''}`} onClick={() => requireAuth(healthDashboardNav.id)}><span className="nav-icon">{healthDashboardNav.icon}</span><span>{healthDashboardNav.label}</span></button>
          <button className={`nav-item compact ${page === familyNav.id ? 'active' : ''}`} onClick={() => requireAuth(familyNav.id)}><span className="nav-icon">{familyNav.icon}</span><span>{familyNav.label}</span></button>
          <button className={`nav-item compact ${page === 'health-info' ? 'active' : ''}`} onClick={() => setPage('health-info')}><span className="nav-icon">◇</span><span>Health information</span></button>
          <button className={`nav-item compact ${page === 'appointments' ? 'active' : ''}`} onClick={() => setPage('appointments')}><span className="nav-icon">◷</span><span>Appointments</span></button>
          <button className={`nav-item compact ${page === 'services' ? 'active' : ''}`} onClick={() => setPage('services')}><span className="nav-icon">▤</span><span>Lab & medication</span></button>
          <button className={`nav-item compact ${page === 'history' ? 'active' : ''}`} onClick={() => setPage('history')}><span className="nav-icon">◷</span><span>My conversations</span></button>
          <button className={`nav-item compact ${page === 'payments' ? 'active' : ''}`} onClick={() => setPage('payments')}><span className="nav-icon">₦</span><span>Payments</span></button>
          {trustNav.map((item) => <button key={item.id} className={`nav-item compact ${page === item.id ? 'active' : ''}`} onClick={() => (['health-id','access','journey','privacy','appointments','services','payments'].includes(item.id) ? requireAuth(item.id) : setPage(item.id))}><span className="nav-icon">{item.icon}</span><span>{item.label}</span></button>)}
          <button className={`nav-item compact ${page === 'notifications' ? 'active' : ''}`} onClick={() => setPage('notifications')}><span className="nav-icon">◔</span><span>Notifications{notificationCount > 0 ? ` · ${notificationCount}` : ''}</span></button>
          <button className={`nav-item compact ${page === 'naic-validation' ? 'active' : ''}`} onClick={() => setPage('naic-validation')}><span className="nav-icon">NA</span><span>NAIC validation</span></button>
          <button className={`nav-item compact ${page === 'settings' ? 'active' : ''}`} onClick={() => setPage('settings')}><span className="nav-icon">⚙</span><span>Settings</span></button>
        </div>
        <div className="sidebar-spacer" />
        <button className="urgent-button" onClick={() => setShowEmergency(true)}><span>!</span>Urgent help</button>
        <div className="ecosystem-card"><div className="sidebar-eyebrow">PUGA TRINICARE</div><p>One connected ecosystem for patients, providers and healthcare infrastructure.</p><div className="ecosystem-pills"><span>PugaCare</span><span>PugaCure</span><span>PugaAccess</span></div></div>
      </aside>
      <main id="main-content" className="main-content" tabIndex="-1" aria-label="PugaAI Health main content">
        {page === 'home' && <Home message={message} setMessage={setMessage} sendMessage={sendMessage} handleVoice={handleVoice} voiceState={voiceState} setPage={setPage} greeting={greeting} setShowConsent={setShowConsent} voiceLanguage={voiceLanguage} setVoiceLanguage={setVoiceLanguage} voiceSupported={voiceSupported} voiceTranscript={voiceTranscript} voiceConfidence={voiceConfidence} voiceError={voiceError} startVoiceCapture={startVoiceCapture} stopVoiceCapture={stopVoiceCapture} playVoiceResponse={playVoiceResponse} />}
        {page === 'talk' && <Talk messages={messages} message={message} setMessage={setMessage} sendMessage={sendMessage} handleVoice={handleVoice} voiceState={voiceState} greeting={greeting} isSending={isSending} sessionProtected={sessionProtected} setSessionProtected={setSessionProtected} authState={authState} setShowAuth={setShowAuth} onNewConversation={startNewConversation} onCopy={copyAssistantMessage} onSpeak={speakAssistantMessage} speakingMessageId={speakingMessageId} copiedMessageId={copiedMessageId} onFeedback={giveMessageFeedback} feedbackByMessage={feedbackByMessage} />}
        {page === 'care' && <Care setPage={setPage} selection={careSelection} setSelection={setCareSelection} onHandoff={(value) => setHandoff(value)} onAppointment={(value) => setAppointmentRequest(value)} />}
        {page === 'appointments' && <Appointments setPage={setPage} notify={notify} onTeleconsult={(appointment) => setTeleconsultation(appointment)} />}
        {page === 'services' && <ServiceTransactions notify={notify} />}
        {page === 'payments' && <Payments notify={notify} setPage={setPage} />}
        {page === 'health-id' && <HealthId setShowConsent={setShowConsent} notify={notify} />}
        {page === 'access' && <Access notify={notify} />}
        {page === 'health-dashboard' && <HealthDashboard setPage={setPage} notify={notify} />}
        {page === 'family' && <FamilyHealth setPage={setPage} notify={notify} />}
        {page === 'health-info' && <HealthInfo setPage={setPage} setMessage={setMessage} />}
        {page === 'history' && <History setPage={setPage} setMessage={setMessage} />}
        {page === 'journey' && <HealthJourney setPage={setPage} notify={notify} />}
        {page === 'privacy' && <PrivacyCenter notify={notify} setShowConsent={setShowConsent} />}
        {page === 'settings' && <Settings authState={authState} selectedLanguage={selectedLanguage} setSelectedLanguage={(value) => { setSelectedLanguage(value); localStorage.setItem('pugaai-language', value); notify(`Language set to ${value}.`) }} backendHealth={backendHealth} online={online} />}
        {page === 'naic-validation' && <NaicValidation adminSession={naicAdminSession} setAdminSession={setNaicAdminSession} session={naicValidationSession} setSession={(session) => { setNaicValidationSession(session); if (session) sessionStorage.setItem('pugaai-naic-session', JSON.stringify(session)); else sessionStorage.removeItem('pugaai-naic-session') }} notify={notify} />}
        {page === 'notifications' && <NotificationsCenter notifications={notifications} filter={notificationFilter} setFilter={setNotificationFilter} loading={notificationsLoading} onRead={markNotificationRead} onReadAll={markAllNotificationsRead} onOpen={(item) => { setPage(item.page); markNotificationRead(item.id) }} notify={notify} />}
      </main>
    </div>
    <nav className="mobile-nav" aria-label="Mobile navigation">{navItems.map((item) => <button key={item.id} className={page === item.id ? 'active' : ''} onClick={() => (['health-id','access','journey','privacy','appointments','services','payments'].includes(item.id) ? requireAuth(item.id) : setPage(item.id))}><span>{item.icon}</span><small>{item.label.replace('Talk to PugaAI', 'Talk')}</small></button>)}</nav>

    {showEmergency && <Modal title="Urgent health concern?" onClose={() => setShowEmergency(false)}><div className="alert-icon">!</div><p className="modal-copy">PugaAI Health is not an emergency service. If you or someone else may be in immediate danger, seek urgent medical attention or go to the nearest appropriate healthcare facility.</p><div className="modal-actions"><button className="button secondary" onClick={() => setShowEmergency(false)}>Go back</button><button className="button danger" onClick={() => setShowEmergency(false)}>I understand</button></div></Modal>}
    {showConsent && <Modal title="Permission before protected data" onClose={() => setShowConsent(false)}><div className="permission-card"><div className="permission-icon">⌁</div><div><strong>Purpose-limited access</strong><p>PugaAI Health should only receive the minimum health information needed for the task you approve.</p></div></div><div className="modal-actions"><button className="button secondary" onClick={() => setShowConsent(false)}>Cancel</button><button className="button primary" onClick={() => { setSessionProtected(true); setShowConsent(false); notify('Protected session enabled for this session.') }}>Allow for this session</button></div></Modal>}
    {showAuth && <AuthModal authState={authState} onClose={() => setShowAuth(false)} onChange={handleAuth} />}
    {showNotifications && <Notifications onClose={() => setShowNotifications(false)} setPage={setPage} />}
    {showProfile && <Modal title="Your PugaAI Health profile" onClose={() => setShowProfile(false)}><div className="profile-panel"><div className="profile-avatar">KM</div><div><strong>{authState === 'authenticated' ? 'Authenticated patient account' : 'Patient account'}</strong><span>{authState === 'session-expired' ? 'Session expired — sign in again' : 'Protected session controls available'}</span></div></div><div className="profile-links"><button onClick={() => { setShowProfile(false); setPage('settings') }}>Privacy & settings →</button><button onClick={() => { setShowProfile(false); setPage('health-id') }}>Puga Universal Health ID →</button><button onClick={() => { setShowProfile(false); setShowAuth(true) }}>{authState === 'authenticated' ? 'Session & authentication →' : 'Sign in →'}</button></div></Modal>}
    {handoff && <HandoffModal handoff={handoff} onClose={() => setHandoff(null)} notify={notify} />}
    {appointmentRequest && <AppointmentModal request={appointmentRequest} onClose={() => setAppointmentRequest(null)} notify={notify} />}
    {teleconsultation && <TeleconsultationModal appointment={teleconsultation} onClose={() => setTeleconsultation(null)} notify={notify} />}
    {toast && <div className="toast" role="status" aria-live="polite">{toast}</div>}
  </div>
}

function voiceStateLabel(state) {
  const labels = {
    [VOICE_STATES.IDLE]: 'Ready to listen',
    [VOICE_STATES.REQUESTING_PERMISSION]: 'Microphone permission',
    [VOICE_STATES.LISTENING]: 'Listening',
    [VOICE_STATES.PROCESSING]: 'Processing audio',
    [VOICE_STATES.TRANSCRIBING]: 'Transcribing',
    [VOICE_STATES.RESPONDING]: 'Preparing response',
    [VOICE_STATES.PLAYING]: 'Speaking',
    [VOICE_STATES.ERROR]: 'Voice needs attention',
  }
  return labels[state] || 'Voice ready'
}

function voiceStateHint(state, supported) {
  if (!supported) return 'Voice capture is unavailable in this browser. Text chat remains available.'
  const hints = {
    [VOICE_STATES.IDLE]: 'Tap the microphone and speak naturally.',
    [VOICE_STATES.REQUESTING_PERMISSION]: 'Allow microphone access to continue.',
    [VOICE_STATES.LISTENING]: 'Speak naturally. Tap again when you are finished.',
    [VOICE_STATES.PROCESSING]: 'Preparing your audio securely for transcription.',
    [VOICE_STATES.TRANSCRIBING]: 'Converting your speech into text.',
    [VOICE_STATES.RESPONDING]: 'Preparing a PugaAI Health response.',
    [VOICE_STATES.PLAYING]: 'PugaAI Health is speaking. You can stop playback anytime.',
    [VOICE_STATES.ERROR]: 'Voice did not complete. You can retry or use text.',
  }
  return hints[state] || 'Tap the microphone and speak naturally.'
}

function voiceLanguageLabel(language) {
  return ({ 'en-NG': 'English (Nigeria)', 'yo-NG': 'Yorùbá', 'ig-NG': 'Igbo', 'ha-NG': 'Hausa' })[language] || language
}

function Home({ message, setMessage, sendMessage, handleVoice, voiceState, setPage, greeting, setShowConsent, voiceLanguage, setVoiceLanguage, voiceSupported, voiceTranscript, voiceConfidence, voiceError, startVoiceCapture, stopVoiceCapture, playVoiceResponse }) {
  return <div className="page home-page">
    <section className="hero"><div className="hero-copy"><div className="section-label purple">PUGAAI HEALTH</div><h1>Healthcare guidance that starts with a conversation.</h1><p>{greeting}</p><div className="hero-actions"><button className="button primary large" onClick={handleVoice}><span className="mic-symbol">{voiceState === 'recording' ? '■' : '●'}</span>{voiceState === 'recording' ? 'Stop listening' : voiceState === 'processing' ? 'Processing…' : 'Talk to PugaAI Health'}</button><button className="button secondary large" onClick={() => setPage('talk')}>Open text chat</button></div><div className="hero-trust"><span>✓ Health information & navigation</span><span>✓ Permissioned data access</span><span>✓ Human-in-the-loop care</span></div></div><div className="hero-visual"><div className="voice-orb"><div className="orb-wave wave-one" /><div className="orb-wave wave-two" /><div className="orb-core"><span>AI</span><small>LISTEN</small></div></div><div className="visual-caption">Voice-first • Low-bandwidth ready</div></div></section>
    <section className="composer-card"><section className="voice-panel" aria-label="PugaAI Health voice interaction">
      <div className="voice-panel-top">
        <div>
          <span className="eyebrow">Voice-first</span>
          <strong>Talk to PugaAI Health</strong>
          <p className="muted">Speak naturally. Text remains available if voice is unavailable.</p>
        </div>
        <select value={voiceLanguage} onChange={(e) => setVoiceLanguage(e.target.value)} aria-label="Voice language">
          <option value="en-NG">English (Nigeria)</option>
          <option value="yo-NG">Yorùbá</option>
          <option value="ig-NG">Igbo</option>
          <option value="ha-NG">Hausa</option>
        </select>
      </div>
      <div className={`voice-stage voice-stage-${voiceState}`} aria-live="polite">
        <div className="voice-visualizer" aria-hidden="true">{Array.from({ length: 9 }, (_, i) => <span key={i} style={{ '--bar': `${2 + ((i * 7) % 8)}px` }} />)}</div>
        <button className={`voice-orb voice-orb-large ${voiceState !== VOICE_STATES.IDLE ? 'active' : ''}`} onClick={voiceState === VOICE_STATES.LISTENING ? stopVoiceCapture : startVoiceCapture} disabled={!voiceSupported.mediaRecorder || [VOICE_STATES.PROCESSING, VOICE_STATES.TRANSCRIBING, VOICE_STATES.RESPONDING].includes(voiceState)} aria-label={voiceState === VOICE_STATES.LISTENING ? 'Stop recording' : 'Start voice recording'}>
          <span>{voiceState === VOICE_STATES.LISTENING ? '■' : '●'}</span>
        </button>
        <div className="voice-state-copy">
          <strong>{voiceStateLabel(voiceState)}</strong>
          <p className="muted">{voiceError || voiceStateHint(voiceState, voiceSupported.mediaRecorder)}</p>
          <small className="voice-language-pill">{voiceLanguageLabel(voiceLanguage)}</small>
        </div>
      </div>
      {voiceTranscript && <div className="transcript-card transcript-review"><div className="transcript-heading"><span className="eyebrow">Transcript review</span>{voiceConfidence !== null && <small>{Math.round(voiceConfidence * 100)}% confidence</small>}</div><p>{voiceTranscript}</p><div className="voice-actions"><button className="button secondary" onClick={() => setMessage(voiceTranscript)}>Use in chat</button><button className="button secondary" onClick={() => playVoiceResponse(voiceTranscript)} disabled={!voiceSupported.speechSynthesis}>Preview voice</button></div></div>}
      {voiceError && <button className="button secondary" onClick={startVoiceCapture}>Retry voice</button>}
    </section>

    <div className="composer-heading"><div><span className="composer-title">What would you like help with?</span><span className="composer-subtitle">Start with a question. You can switch to voice anytime.</span></div><span className="privacy-badge">Private by design</span></div><div className="composer"><input value={message} onChange={(event) => setMessage(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && sendMessage()} placeholder="Ask a health question…" aria-label="Ask PugaAI Health" /><button className={`voice-button ${voiceState === 'recording' ? 'recording' : ''}`} onClick={handleVoice} aria-label="Use voice">{voiceState === 'processing' ? '…' : '●'}</button><button className="send-button" onClick={() => sendMessage()} aria-label="Send message">→</button></div></section>
    <section className="section-block"><div className="section-header"><div><span className="section-label">EXPLORE</span><h2>Popular health topics</h2></div><button className="link-button" onClick={() => setPage('talk')}>Open conversation →</button></div><div className="topic-grid">{quickTopics.map(([title, icon, category]) => <button className="topic-card" key={title} onClick={() => sendMessage(title)}><span className="topic-icon">{icon}</span><span className="topic-copy"><strong>{title}</strong><small>{category}</small></span><span className="arrow">›</span></button>)}</div></section>
    <section className="section-block"><div className="section-header"><div><span className="section-label">TRUST & CONTROL</span><h2>Designed around your health journey</h2></div></div><div className="feature-grid"><Feature icon="✓" title="Health information, not a diagnosis" text="PugaAI Health supports education and care navigation. Clinical decisions remain with qualified healthcare professionals." /><Feature icon="⌁" title="Your data stays permissioned" text="Protected health information is accessed only through the appropriate identity, authorization and consent controls." onClick={setShowConsent} /><Feature icon="▣" title="One Puga identity" text="Your Puga Universal Health ID can connect participating Puga services without becoming a master key to your records." /></div></section>
  </div>
}

function Talk({ messages, message, setMessage, sendMessage, handleVoice, voiceState, greeting, isSending, sessionProtected, setSessionProtected, authState, setShowAuth, onNewConversation, onCopy, onSpeak, speakingMessageId, copiedMessageId, onFeedback, feedbackByMessage }) {
  return <div className="page"><div className="page-header"><div><span className="section-label purple">CONVERSATION</span><h1>Talk to PugaAI Health</h1><p>Ask by voice or text. Move to PugaCare when you need care.</p></div><div className="talk-header-actions"><button className="button secondary compact" onClick={onNewConversation}>＋ New conversation</button><button className={`session-chip ${sessionProtected ? 'protected' : ''}`} onClick={() => sessionProtected ? setSessionProtected(false) : setShowAuth(true)}><span />{sessionProtected ? 'Protected session' : authState === 'authenticated' ? 'Enable protected session' : 'Standard session'}</button></div></div>
    <div className="conversation-card">{messages.length === 0 ? <div className="empty-conversation"><div className="ai-avatar">AI</div><h2>How can I help today?</h2><p>{greeting}</p><div className="starter-grid">{starterPrompts.map((prompt) => <button key={prompt} onClick={() => sendMessage(prompt)}>{prompt}<span>→</span></button>)}</div><div className="conversation-safety-strip">General information is available without protected health data. Care actions require appropriate confirmation.</div></div> : <div className="message-list">{messages.map((item, index) => <MessageItem key={`${item.role}-${item.id || index}`} item={item} onRetry={item.retry ? () => sendMessage(item.retry) : null} onCopy={onCopy} onSpeak={onSpeak} speakingMessageId={speakingMessageId} copiedMessageId={copiedMessageId} onFeedback={onFeedback} feedback={feedbackByMessage[item.id || item.text]} />)}{isSending && <div className="typing"><span /><span /><span /> PugaAI is preparing a response…</div>}</div>}</div>
    <div className="chat-composer"><input value={message} onChange={(event) => setMessage(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && sendMessage()} placeholder="Type your question…" aria-label="Type a message" /><button className={`voice-button ${voiceState === 'recording' ? 'recording' : ''}`} onClick={handleVoice} aria-label="Use voice">{voiceState === 'processing' ? '…' : '●'}</button><button className="send-button" onClick={() => sendMessage()} aria-label="Send">→</button></div>
    <div className="conversation-foot"><span>Protected health information is not required for general questions.</span><span>PugaAI Health does not replace a qualified healthcare professional.</span></div>
  </div>
}

function MessageItem({ item, onRetry, onCopy, onSpeak, speakingMessageId, copiedMessageId, onFeedback, feedback }) {
  const isAi = item.role === 'ai'
  const messageId = item.id || item.text
  return <div className={`message-row ${item.role}`}><div className="message-avatar">{item.role === 'user' ? 'You' : isAi ? 'AI' : '!'}</div><div className={`message-bubble ${item.role}`}><div className="message-meta">{item.role === 'user' ? 'You' : isAi ? 'PugaAI Health' : 'System'}</div><div className="message-text">{item.text}</div>{item.demo && <span className="demo-note">Demo response — backend response will replace this.</span>}{item.safety?.label && <span className="safety-note">{item.safety.label}</span>}{item.role === 'system' && onRetry && <button className="retry-button" onClick={onRetry}>Retry →</button>}{item.careActions?.length > 0 && <div className="inline-actions">{item.careActions.map((action, index) => <button key={action.id || index}>{action.label || 'Open care action'} →</button>)}</div>}{isAi && <div className="message-tools" aria-label="Response actions"><button onClick={() => onCopy(item)}>{copiedMessageId === messageId ? 'Copied' : 'Copy'}</button><button onClick={() => onSpeak(item)}>{speakingMessageId === messageId ? 'Stop' : 'Listen'}</button><button className={feedback === 'helpful' ? 'selected' : ''} onClick={() => onFeedback(item, 'helpful')} aria-label="Mark response helpful">👍</button><button className={feedback === 'not-helpful' ? 'selected' : ''} onClick={() => onFeedback(item, 'not-helpful')} aria-label="Mark response not helpful">👎</button></div>}</div></div>
}

const CARE_STAGES = [
  { id: 'find', label: 'Find care', icon: '1' },
  { id: 'facility', label: 'Choose facility', icon: '2' },
  { id: 'provider', label: 'Choose provider', icon: '3' },
  { id: 'appointment', label: 'Appointment', icon: '4' },
  { id: 'consultation', label: 'Consultation', icon: '5' },
  { id: 'services', label: 'Lab / medication', icon: '6' },
  { id: 'followup', label: 'Follow-up', icon: '7' },
]

function CareJourneyStrip({ currentStage = 'find', onStage }) {
  const index = Math.max(0, CARE_STAGES.findIndex((stage) => stage.id === currentStage))
  return <section className="care-journey-strip" aria-label="Care journey progress"><div className="care-journey-heading"><div><span className="section-label purple">CARE JOURNEY</span><h2>From finding care to follow-up</h2><p>Each step is explicit. PugaAI Health prepares navigation; authorized Puga services handle consequential actions.</p></div><span className="journey-progress-count">Step {index + 1} of {CARE_STAGES.length}</span></div><div className="care-journey-steps">{CARE_STAGES.map((stage, stageIndex) => { const status = stageIndex < index ? 'completed' : stageIndex === index ? 'current' : 'upcoming'; return <button type="button" key={stage.id} className={`care-journey-step ${status}`} onClick={() => onStage?.(stage.id)} aria-current={status === 'current' ? 'step' : undefined}><span className="care-journey-dot">{status === 'completed' ? '✓' : stage.icon}</span><span>{stage.label}</span></button> })}</div></section>
}

function Care({ selection, setSelection, onHandoff, onAppointment }) {
  const [mode, setMode] = useState('services')
  const [service, setService] = useState('')
  const [query, setQuery] = useState('')
  const [facilities, setFacilities] = useState([])
  const [state, setState] = useState('idle')
  const [selectedFacility, setSelectedFacility] = useState(null)
  const [providers, setProviders] = useState([])
  const [providerState, setProviderState] = useState('idle')
  const [journeyStage, setJourneyStage] = useState('find')
  const [journeyNotice, setJourneyNotice] = useState('')
  const cards = [
    ['Teleconsultation', 'Speak with an appropriate healthcare professional online.', 'PugaCare', 'Start'],
    ['Laboratory', 'Navigate to digital laboratory requests and results.', 'PugaCare', 'Explore'],
    ['Prescription & refill', 'Continue an approved prescription or refill workflow.', 'PugaCare', 'Open'],
    ['Find a facility', 'Discover participating facilities and available services.', 'Puga TriniCare', 'Find care']
  ]
  const discover = async () => {
    setState('loading')
    try { const result = await aiHealthApi.getFacilities({ query, service }); setFacilities(result.facilities); setState('ready'); setMode('finder') }
    catch { setState('error') }
  }
  const chooseFacility = async (facility) => {
    setSelectedFacility(facility); setProviderState('loading'); setMode('providers'); setJourneyStage('provider'); setJourneyNotice(`Facility selected: ${facility.name}`)
    try { const result = await aiHealthApi.getProviders({ facilityId: facility.id, service }); setProviders(result.providers); setProviderState('ready') }
    catch { setProviderState('error') }
  }
  const startService = (title) => {
    setSelection(title)
    setJourneyStage(title === 'Find a facility' ? 'find' : title === 'Teleconsultation' ? 'appointment' : 'services')
    setJourneyNotice('')
    if (title === 'Find a facility') { setService(''); discover(); return }
    setService(title)
    discover()
  }
  const jumpToStage = (stage) => {
    setJourneyStage(stage)
    if (stage === 'find') { setMode('finder'); discover(); return }
    if (stage === 'facility') { setMode('finder'); return }
    if (stage === 'provider' && selectedFacility) { chooseFacility(selectedFacility); return }
    if (stage === 'appointment' && selectedFacility) { setMode('providers'); return }
    if (stage === 'services') { setMode('services'); return }
    setJourneyNotice('This step becomes actionable when the authorized care workflow provides the required state.')
  }
  return <div className="page"><div className="page-header"><div><span className="section-label purple">CARE NAVIGATION</span><h1>Connect to care</h1><p>Move from information to the appropriate Puga service, then review the next action before it is requested.</p></div></div><CareJourneyStrip currentStage={journeyStage} onStage={jumpToStage} />{journeyNotice && <div className="journey-context"><span>✓</span><div><strong>{journeyNotice}</strong><p>Your care journey state is a frontend navigation aid. Production milestones will be authoritative only when returned by the connected Puga service.</p></div></div>}
    {mode === 'services' && <><div className="care-grid">{cards.map(([title, text, badge, action]) => <article className={`care-card ${selection === title ? 'selected' : ''}`} key={title}><span className="service-badge">{badge}</span><h2>{title}</h2><p>{text}</p><button className="button secondary" onClick={() => startService(title)}>{action} →</button></article>)}</div><div className="care-finder-launch"><div><span className="section-label">CARE FINDER</span><h2>Find a participating facility</h2><p>Search by facility, location or service. Availability shown here is illustrative in demo mode until connected to the production network.</p></div><button className="button primary" onClick={() => { setMode('finder'); discover() }}>Open care finder →</button></div></>}
    {mode === 'finder' && <><div className="finder-toolbar"><button className="button secondary" onClick={() => setMode('services')}>← Services</button><div className="finder-search"><input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && discover()} placeholder="Search facility or location…" aria-label="Search facilities" /><select value={service} onChange={(e) => { setService(e.target.value); setTimeout(discover, 0) }} aria-label="Filter by service"><option value="">All services</option><option>Teleconsultation</option><option>Laboratory</option><option>Prescription & refill</option><option>General consultation</option></select><button className="button primary" onClick={discover}>Search</button></div></div>{state === 'loading' && <div className="state-box">Finding participating facilities…</div>}{state === 'error' && <div className="state-box error"><strong>Care network is temporarily unavailable.</strong><button className="retry-button" onClick={discover}>Retry →</button></div>}{state === 'ready' && <div className="facility-grid">{facilities.map((facility) => <article className="facility-card" key={facility.id}><div className="facility-top"><div className="facility-avatar">{facility.initials}</div><span className="availability-pill">{facility.availability}</span></div><h2>{facility.name}</h2><p>{facility.location} · {facility.distance}</p><div className="facility-services">{facility.services.map((item) => <span key={item}>{item}</span>)}</div><button className="button secondary" onClick={() => chooseFacility(facility)}>View care options →</button></article>)}{facilities.length === 0 && <div className="state-box">No participating facilities matched your search.</div>}</div>}</>}
    {mode === 'providers' && <><div className="finder-toolbar"><button className="button secondary" onClick={() => setMode('finder')}>← Facilities</button><div><span className="section-label">SELECTED FACILITY</span><strong className="toolbar-title">{selectedFacility?.name}</strong></div></div>{providerState === 'loading' && <div className="state-box">Loading available care options…</div>}{providerState === 'error' && <div className="state-box error"><strong>Provider availability is temporarily unavailable.</strong><button className="retry-button" onClick={() => chooseFacility(selectedFacility)}>Retry →</button></div>}{providerState === 'ready' && <div className="provider-grid">{providers.map((provider) => <article className="provider-card" key={provider.id}><div className="provider-avatar">◉</div><div className="provider-copy"><h2>{provider.name}</h2><p>{provider.specialty} · {provider.mode}</p><span>Next slot: {provider.nextSlot}</span></div><button className="button primary" onClick={() => { setJourneyStage('appointment'); setJourneyNotice(`Appointment step prepared for ${provider.name}.`); onAppointment({ facility: selectedFacility, provider, service: service || provider.specialty, mode: provider.mode }) }}>Request appointment →</button></article>)}</div>}</>}
    <div className="handoff-banner"><div className="banner-icon">✓</div><div><strong>Human-in-the-loop care</strong><p>PugaAI Health can prepare care navigation and appointment requests. Consequential clinical or payment actions require the appropriate authorization and confirmation.</p></div></div></div>
}

function AppointmentModal({ request, onClose, notify }) {
  const [preferredTime, setPreferredTime] = useState('')
  const [state, setState] = useState('review')
  const [result, setResult] = useState(null)
  const submit = async () => {
    setState('sending')
    try {
      const response = await aiHealthApi.createAppointmentRequest({ facilityId: request.facility.id, providerId: request.provider.id, service: request.service, mode: request.mode, preferredTime, context: 'Appointment request initiated from PugaAI Health care navigation.' })
      setResult(response); setState('ready'); notify(response.demo ? 'Demo appointment request prepared.' : 'Appointment request submitted.')
    } catch (error) { setState('error'); notify(error?.message || 'Appointment request could not be submitted.') }
  }
  return <Modal title={state === 'ready' ? 'Appointment request prepared' : 'Review appointment request'} onClose={onClose}>
    {state === 'review' && <><div className="appointment-summary"><span className="service-badge">{request.service}</span><h3>{request.facility.name}</h3><p>{request.provider.name} · {request.provider.specialty}</p><p>{request.provider.mode} · Suggested next slot: {request.provider.nextSlot}</p><label htmlFor="preferred-time">Preferred time (optional)</label><input id="preferred-time" value={preferredTime} onChange={(e) => setPreferredTime(e.target.value)} placeholder="e.g. Tomorrow morning" /><div className="handoff-checks"><span>✓ Request only — not yet confirmed</span><span>✓ No clinical decision is made here</span><span>✓ Payment, if required, is separate</span></div></div><div className="modal-actions"><button className="button secondary" onClick={onClose}>Cancel</button><button className="button primary" onClick={submit}>Submit request</button></div></>}
    {state === 'sending' && <div className="state-box">Submitting appointment request…</div>}
    {state === 'error' && <><div className="state-box error"><strong>Appointment request could not be submitted.</strong></div><div className="modal-actions"><button className="button secondary" onClick={onClose}>Close</button><button className="button primary" onClick={submit}>Retry</button></div></>}
    {state === 'ready' && <><div className="success-card"><span className="success-mark">✓</span><div><strong>{request.service}</strong><p>Request reference: {result?.appointmentId || 'Pending production reference'}</p><small>Next journey step: appointment status → consultation when the authorized scheduling workflow confirms the request.</small><span>{result?.demo ? 'Demo mode — no appointment was actually booked.' : 'The production scheduling service will continue the authorized workflow.'}</span></div></div><div className="modal-actions"><button className="button primary" onClick={onClose}>Done</button></div></>}
  </Modal>
}


function Appointments({ setPage, notify, onTeleconsult }) {
  const [appointments, setAppointments] = useState([])
  const [state, setState] = useState('loading')
  const [selected, setSelected] = useState(null)
  const [action, setAction] = useState(null)
  const load = async () => {
    setState('loading')
    try { const result = await aiHealthApi.getAppointments(); setAppointments(result.appointments || []); setState('ready') }
    catch { setState('error') }
  }
  useEffect(() => { if (canAccessNaicConsole(adminSession)) load() }, [adminSession.status, adminSession.role])
  const runAction = async (type) => {
    if (!selected) return
    setAction(type)
    try {
      if (type === 'cancel') await aiHealthApi.updateAppointment({ appointmentId: selected.id, action: 'cancel' })
      if (type === 'reschedule') await aiHealthApi.updateAppointment({ appointmentId: selected.id, action: 'reschedule', preferredTime: 'Tomorrow · 10:00' })
      notify(type === 'cancel' ? 'Cancellation request submitted.' : 'Rescheduling request submitted.')
      await load(); setSelected(null)
    } catch { notify('The appointment action could not be completed. Please retry.') }
    finally { setAction(null) }
  }
  return <div className="page"><div className="page-header"><div><span className="section-label purple">CARE MANAGEMENT</span><h1>My appointments</h1><p>Review appointment status and continue to authorized care workflows.</p></div><button className="button primary" onClick={() => setPage('care')}>Find care →</button></div>
    {state === 'loading' && <div className="state-box">Loading your appointments…</div>}
    {state === 'error' && <div className="state-box error"><strong>Appointments are temporarily unavailable.</strong><button className="retry-button" onClick={load}>Retry →</button></div>}
    {state === 'ready' && <div className="appointment-list">{appointments.map((appointment) => <article className="appointment-row" key={appointment.id}><div className="appointment-date"><strong>{appointment.dateLabel}</strong><small>{appointment.time}</small></div><div className="appointment-copy"><div><h2>{appointment.service}</h2><span className={`appointment-status ${appointment.status}`}>{appointment.statusLabel}</span></div><p>{appointment.provider} · {appointment.facility}</p><small>{appointment.mode} · Ref {appointment.reference}</small></div><div className="appointment-actions"><button className="button secondary" onClick={() => setSelected(appointment)}>Details</button>{appointment.status === 'confirmed' && appointment.mode === 'Teleconsultation' && <button className="button primary" onClick={() => onTeleconsult(appointment)}>Enter teleconsultation</button>}</div></article>)}{appointments.length === 0 && <div className="state-box">No appointments found. You can find care and request an appointment from Care.</div>}</div>}
    {selected && <Modal title="Appointment details" onClose={() => setSelected(null)}><div className="appointment-detail"><span className={`appointment-status ${selected.status}`}>{selected.statusLabel}</span><h3>{selected.service}</h3><p><strong>{selected.provider}</strong><br />{selected.facility}</p><div className="detail-grid"><div><small>Date</small><strong>{selected.dateLabel}</strong></div><div><small>Time</small><strong>{selected.time}</strong></div><div><small>Mode</small><strong>{selected.mode}</strong></div><div><small>Reference</small><strong>{selected.reference}</strong></div></div><div className="appointment-note">Status changes are requests to the scheduling service. PugaAI Health does not silently cancel, reschedule or confirm clinical care.</div></div><div className="modal-actions">{selected.status === 'confirmed' && selected.mode === 'Teleconsultation' && <button className="button primary" onClick={() => { onTeleconsult(selected); setSelected(null) }}>Enter teleconsultation</button>}{['requested','confirmed'].includes(selected.status) && <button className="button secondary" disabled={action==='reschedule'} onClick={() => runAction('reschedule')}>{action==='reschedule'?'Submitting…':'Request reschedule'}</button>}{['requested','confirmed'].includes(selected.status) && <button className="button danger" disabled={action==='cancel'} onClick={() => runAction('cancel')}>{action==='cancel'?'Submitting…':'Request cancellation'}</button>}</div></Modal>}
  </div>
}

function TeleconsultationModal({ appointment, onClose, notify }) {
  const [state, setState] = useState('ready')
  const join = async () => { setState('connecting'); try { const result = await aiHealthApi.createTeleconsultationSession({ appointmentId: appointment.id }); setState(result); } catch { setState('error') } }
  return <Modal title="Teleconsultation" onClose={onClose}><div className="teleconsult-card"><div className="teleconsult-icon">◎</div><span className="appointment-status confirmed">Confirmed appointment</span><h3>{appointment.provider}</h3><p>{appointment.service} · {appointment.facility}</p><div className="teleconsult-state">{state === 'ready' && <><strong>Ready to join when your appointment window opens.</strong><span>Allow microphone/camera access only when you are ready to connect.</span></>}{state === 'connecting' && <strong>Preparing the secure consultation session…</strong>}{state === 'error' && <><strong>We could not prepare the consultation.</strong><button className="retry-button" onClick={join}>Retry →</button></>}{typeof state === 'object' && <><strong>Secure consultation session prepared.</strong><span>{state.demo ? 'Demo mode — no real video session was created.' : 'Production consultation session is ready.'}</span></>}</div></div><div className="modal-actions">{state === 'ready' && <button className="button primary" onClick={join}>Prepare consultation</button>}{typeof state === 'object' && <button className="button primary" onClick={() => notify(state.demo ? 'Demo consultation entry prepared.' : 'Opening secure consultation session.')}>Enter secure consultation →</button>}<button className="button secondary" onClick={onClose}>Close</button></div></Modal>
}

function HealthId({ setShowConsent, notify }) {
  const [state, setState] = useState('loading')
  const [data, setData] = useState(null)
  const load = async () => {
    setState('loading')
    try { const result = await aiHealthApi.getProtectedHealthId(); setData(result); setState('ready') }
    catch { setState('error') }
  }
  useEffect(() => { load() }, [])
  const healthId = data?.healthId || 'PUGA-••••-••••'
  const verified = Boolean(data?.verified)
  return <div className="page"><div className="page-header"><div><span className="section-label purple">IDENTITY</span><h1>Puga Universal Health ID</h1><p>One identity layer for participating Puga services — not a master key to your records.</p></div><span className={`identity-status ${verified ? 'verified' : 'active'}`}>{verified ? 'Verified identity' : 'Identity active'}</span></div>
    {state === 'loading' && <div className="state-box">Loading your protected identity…</div>}
    {state === 'error' && <div className="state-box error"><strong>Your Health ID could not be loaded.</strong><button className="retry-button" onClick={load}>Retry →</button></div>}
    {state === 'ready' && <div className="health-id-grid"><div className="health-card"><div className="health-card-top"><img src="/puga-trinicare-transparent.png" alt="Puga TriniCare" /><span>HEALTH ID</span></div><div className="health-card-body"><div><small>PUGA UNIVERSAL HEALTH ID</small><strong>{healthId}</strong><span className="health-id-caption">Identity credential · {data?.cardStatus || 'active'}</span></div><div className="qr-placeholder" aria-label="Puga Universal Health ID QR placeholder"><div className="qr-pattern">▦</div><span>{data?.qrAvailable ? 'SCAN' : 'QR'}</span></div></div><div className="health-card-status"><span /> {data?.cardStatus === 'active' ? 'Active identity' : 'Verification required'}</div></div><div className="info-panel"><span className="section-label">IDENTITY FLOW</span><h2>Identify → authenticate → authorize → permit</h2><div className="steps"><Step n="01" title="Identify" text="Use your Puga Health ID or QR card at participating Puga services." /><Step n="02" title="Authenticate" text="Verify the person or account before protected information is accessed." /><Step n="03" title="Authorize" text="The system checks role, purpose and permissions before a request proceeds." /><Step n="04" title="Permit" text="Only the minimum information permitted for the task is shared." /></div><div className="panel-actions"><button className="button secondary" onClick={() => notify('ID-card download will connect to the production identity service.')}>Download ID card</button><button className="button primary" onClick={() => setShowConsent(true)}>Manage permission</button></div><div className="identity-boundary"><strong>Important:</strong> the Health ID identifies the account. It does not itself grant access to medical records.</div></div></div>}
  </div>
}

function Access({ notify }) {
  const [entries, setEntries] = useState([])
  const [state, setState] = useState('loading')
  const [selectedAccessEntry, setSelectedAccessEntry] = useState(null)
  const [channel, setChannel] = useState('ivr')
  const [language, setLanguage] = useState('en-NG')
  const [session, setSession] = useState(null)
  const [sessionState, setSessionState] = useState('idle')
  const [sessionError, setSessionError] = useState('')
  const [switching, setSwitching] = useState(false)

  const load = async () => { setState('loading'); try { const result = await aiHealthApi.getAccessLog(); setEntries(result.entries || []); setState('ready') } catch { setState('error') } }
  useEffect(() => { load() }, [])

  const startSession = async (nextChannel = channel) => {
    setSessionState('loading'); setSessionError('')
    try {
      const result = await aiHealthApi.createPugaAccessSession({ channel: nextChannel, language })
      setSession(normalizePugaAccessSession(result))
      setSessionState('ready')
      notify(`${getPugaAccessChannelMeta(nextChannel).label} continuity is ready.`)
    } catch (error) {
      setSessionState('error')
      setSessionError(error?.message || 'PugaAccess could not be prepared.')
    }
  }

  const switchChannel = async (nextChannel) => {
    setChannel(nextChannel)
    setSwitching(true)
    try { await startSession(nextChannel) } finally { setSwitching(false) }
  }

  const refreshSession = async () => {
    if (!session?.sessionId) return
    setSessionState('refreshing')
    try {
      const result = await aiHealthApi.getPugaAccessSession(session.sessionId)
      setSession(normalizePugaAccessSession(result))
      setSessionState('ready')
    } catch (error) {
      setSessionState('error')
      setSessionError(error?.message || 'The PugaAccess session could not be refreshed.')
    }
  }

  const activeMeta = getPugaAccessChannelMeta(channel)
  const expired = isPugaAccessSessionExpired(session)
  const statusLabel = getPugaAccessStatusLabel(session)

  return <div className="page">
    <div className="page-header"><div><span className="section-label purple">LOW-BANDWIDTH ACCESS</span><h1>Continue with PugaAccess</h1><p>Keep PugaAI Health available through IVR, USSD or SMS when data access is limited.</p></div><span className="access-continuity-badge">One PugaAI service</span></div>

    <div className="pugaaccess-hero">
      <div className="pugaaccess-hero-icon">PA</div>
      <div><strong>PugaAccess is a channel, not a separate AI.</strong><p>Your conversation and care context can continue through the selected low-bandwidth channel when the production service supports continuity.</p></div>
    </div>

    <div className="access-channel-grid" aria-label="PugaAccess channels">
      {Object.entries(PUGA_ACCESS_CHANNELS).map(([key, meta]) => <button key={key} className={`access-channel-card ${channel === key ? 'selected' : ''}`} onClick={() => switchChannel(key)} disabled={switching || sessionState === 'loading'} aria-pressed={channel === key}>
        <span className="access-channel-icon">{meta.shortLabel}</span><strong>{meta.label}</strong><p>{meta.description}</p><span className="access-channel-state">{channel === key ? 'Selected' : 'Use this channel'} →</span>
      </button>)}
    </div>

    <div className="access-session-panel">
      <div className="access-session-heading"><div><span className="section-label">SESSION CONTINUITY</span><h2>{activeMeta.label}</h2><p>{activeMeta.description}</p></div><span className={`access-session-status ${expired ? 'expired' : statusLabel.toLowerCase()}`}>{statusLabel}</span></div>
      {!session && sessionState === 'idle' && <div className="access-session-empty"><strong>Start a PugaAccess session</strong><p>Create a channel session when you need to continue PugaAI Health outside a full web experience.</p><button className="button primary" onClick={() => startSession()}>Continue with {activeMeta.shortLabel} →</button></div>}
      {sessionState === 'loading' && <div className="state-box">Preparing your {activeMeta.label} session…</div>}
      {sessionState === 'refreshing' && <div className="state-box">Refreshing session continuity…</div>}
      {sessionState === 'error' && <div className="state-box error"><strong>{sessionError || 'PugaAccess is temporarily unavailable.'}</strong><button className="retry-button" onClick={() => startSession(channel)}>Retry →</button></div>}
      {session && sessionState !== 'loading' && sessionState !== 'refreshing' && <div className="access-session-details">
        <div className="access-session-code"><small>SESSION ID</small><strong>{session.sessionId || 'Pending production reference'}</strong><span>{session.demo ? 'Demo mode' : 'Production session reference'}</span></div>
        <div className="access-detail-grid"><div><small>Channel</small><strong>{activeMeta.label}</strong></div><div><small>Language</small><strong>{session.language}</strong></div><div><small>Continuity</small><strong>{session.continuitySupported ? 'Supported' : 'Backend pending'}</strong></div><div><small>Expiry</small><strong>{session.expiresAt ? new Date(session.expiresAt).toLocaleString() : 'Managed by service'}</strong></div></div>
        <div className={`access-continuity-note ${session.continuitySupported && !expired ? 'supported' : 'pending'}`}><span>✓</span><div><strong>{expired ? 'Session expired' : session.continuitySupported ? 'Conversation continuity enabled' : 'Continuity awaiting production capability'}</strong><p>{expired ? 'Start a new session to continue.' : session.continuitySupported ? 'The production service can use the same PugaAI Health identity/session boundary across supported channels.' : 'The frontend is ready for continuity, but the backend must return an authoritative continuity state.'}</p></div></div>
        <div className="access-session-actions"><button className="button secondary" onClick={refreshSession} disabled={expired || !session.sessionId}>Refresh session</button><button className="button primary" onClick={() => startSession(channel)}>{expired ? 'Start new session →' : 'Renew / continue →'}</button></div>
      </div>}
    </div>

    <div className="access-language-panel"><div><strong>Preferred access language</strong><p>Use the same language preference when the selected channel supports it.</p></div><select value={language} onChange={(e) => setLanguage(e.target.value)} aria-label="PugaAccess language"><option value="en-NG">English (Nigeria)</option><option value="yo-NG">Yorùbá</option><option value="ig-NG">Igbo</option><option value="ha-NG">Hausa</option></select></div>

    <div className="access-flow"><div><b>01</b><strong>Start</strong><span>Select IVR, USSD or SMS.</span></div><div><b>02</b><strong>Continue</strong><span>Use the same PugaAI Health service.</span></div><div><b>03</b><strong>Return</strong><span>Come back to web when connectivity improves.</span></div></div>

    <div className="access-explainer"><div className="access-explainer-icon">⌁</div><div><strong>Low-bandwidth does not mean lower privacy.</strong><p>Protected health information remains governed by authentication, authorization, consent and purpose-limited access. The channel itself does not grant access to medical records.</p></div></div>

    <div className="access-panel"><div className="access-history-heading"><div><span className="section-label">ACCESS TRANSPARENCY</span><h2>Recent health-information access</h2></div><button className="button secondary compact" onClick={load}>Refresh</button></div>{state === 'loading' && <div className="state-box">Loading access history…</div>}{state === 'error' && <div className="state-box error"><strong>Access history unavailable.</strong><button className="retry-button" onClick={load}>Retry →</button></div>}{state === 'ready' && entries.map((entry) => <button className="access-row access-row-button" key={entry.id} onClick={() => setSelectedAccessEntry(entry)} aria-label={`View access details for ${entry.actor}`}><div className="access-avatar">{entry.initials}</div><div><strong>{entry.actor}</strong><span>{entry.purpose}</span></div><span className="access-time">{entry.time}</span><span className="allowed">{entry.status}</span><span className="more-button">•••</span></button>)}{state === 'ready' && entries.length === 0 && <div className="state-box">No access events are available for this account.</div>}</div>

    <div className="info-card wide"><div className="feature-icon">✓</div><div><strong>You remain the decision-maker for protected access.</strong><p>The backend provides the authoritative audit record and session state. This interface does not invent, authorize or execute protected access.</p></div></div>
    {selectedAccessEntry && <Modal title="Access event details" onClose={() => setSelectedAccessEntry(null)}><div className="access-detail-card"><span className="service-badge">{selectedAccessEntry.status}</span><h3>{selectedAccessEntry.actor}</h3><p>{selectedAccessEntry.purpose}</p><div className="detail-grid"><div><small>When</small><strong>{selectedAccessEntry.time}</strong></div><div><small>Event ID</small><strong>{selectedAccessEntry.id}</strong></div><div><small>Status</small><strong>{selectedAccessEntry.status}</strong></div><div><small>Scope</small><strong>Authoritative backend record</strong></div></div></div><div className="modal-actions"><button className="button secondary" onClick={() => setSelectedAccessEntry(null)}>Close</button><button className="button primary" onClick={() => { setSelectedAccessEntry(null); notify('Open Privacy & Access to review current permissions.') }}>Review permissions →</button></div></Modal>}
  </div>
}
function FamilyHealth({ setPage, notify }) {
  const [state, setState] = useState('loading')
  const [members, setMembers] = useState([])
  const [selected, setSelected] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [name, setName] = useState('')
  const [relationship, setRelationship] = useState('Child')
  const [saving, setSaving] = useState(false)
  const load = async () => {
    setState('loading')
    try { const result = await aiHealthApi.getFamilyMembers(); setMembers(result.family || []); setState('ready') }
    catch { setState('error'); notify('Family health data could not be loaded.') }
  }
  useEffect(() => { load() }, [])
  const add = async () => {
    if (!name.trim()) return notify('Enter the family member name.')
    setSaving(true)
    try { const result = await aiHealthApi.addFamilyMember({ name: name.trim(), relationship }); setMembers((items) => [...items, result.member]); setShowAdd(false); setName(''); notify('Family member added. Complete authorization before viewing protected information.') }
    catch (error) { notify(error?.message || 'Family member could not be added.') }
    finally { setSaving(false) }
  }
  const openMember = async (member) => {
    setSelected({ ...member, authorizationLoading: true })
    try { const result = await aiHealthApi.getFamilyMemberAuthorization(member.id); setSelected((current) => current ? { ...current, authorization: result.authorization?.status || current.authorization, authorizationScope: result.authorization?.scope } : current) }
    catch { notify('Authorization details could not be loaded.') }
    finally { setSelected((current) => current ? { ...current, authorizationLoading: false } : current) }
  }
  const updateAuthorization = async (status) => {
    if (!selected || selected.authorization === 'owner') return
    try { const result = await aiHealthApi.updateFamilyMemberAuthorization({ memberId: selected.id, status, scope: 'care-navigation' }); const next = result.authorization?.status || status; setSelected((current) => ({ ...current, authorization: next })); setMembers((items) => items.map((item) => item.id === selected.id ? { ...item, authorization: next } : item)); notify(status === 'authorized' ? 'Family access authorized for the selected scope.' : 'Family access revoked.') }
    catch (error) { notify(error?.message || 'Authorization could not be updated.') }
  }
  if (state === 'loading') return <section className="page family-health"><div className="page-header"><div><span className="section-label purple">FAMILY HEALTH</span><h1>Family health</h1><p>Loading your household members…</p></div></div><div className="family-loading"><span /><span /><span /></div></section>
  if (state === 'error') return <section className="page family-health"><div className="page-header"><div><span className="section-label purple">FAMILY HEALTH</span><h1>Family health</h1><p>Your household view is temporarily unavailable.</p></div></div><div className="state-box error"><strong>Family health could not be loaded.</strong><button className="button secondary" onClick={load}>Retry →</button></div></section>
  return <section className="page family-health">
    <div className="page-header family-header"><div><span className="section-label purple">FAMILY HEALTH</span><h1>Your household</h1><p>Manage care access for family members while keeping each person's health identity and permissions separate.</p></div><div className="family-header-actions"><button className="button secondary" onClick={load}>Refresh</button><button className="button primary" onClick={() => setShowAdd(true)}>+ Add family member</button></div></div>
    <div className="family-privacy-banner"><span>⌁</span><div><strong>Separate health identities</strong><p>Family membership does not create a shared medical record. Each member has an independent Puga Universal Health ID, authorization and consent boundary.</p></div><button className="button secondary" onClick={() => setPage('privacy')}>Privacy & access</button></div>
    <div className="family-grid">{members.map((member) => <article className="family-member-card" key={member.id}><div className="family-member-top"><div className="family-avatar">{member.initials}</div><span className={`family-auth-badge ${member.authorization}`}>{member.authorization === 'owner' ? 'Owner' : member.authorization === 'authorized' ? 'Authorized' : 'Pending'}</span></div><h2>{member.name}</h2><p className="family-relationship">{member.relationship}</p><div className="family-member-detail"><span>Health ID</span><strong>{member.healthId}</strong></div><div className="family-member-detail"><span>Next care</span><strong>{member.nextCare}</strong></div><div className="family-card-actions"><button className="button primary" onClick={() => openMember(member)}>View member</button><button className="button secondary" onClick={() => { setSelected(member); notify('Select the member to review their authorization scope.') }}>Access</button></div></article>)}</div>
    <div className="family-footer-grid"><div className="family-info-card"><strong>What you can do</strong><p>With appropriate authorization, you can navigate care, appointments, services and payments for a family member. Protected clinical information remains purpose-limited.</p></div><div className="family-info-card"><strong>Guardian & caregiver principle</strong><p>For children or supported adults, the backend must establish the legal/authorized relationship before protected data is returned to this interface.</p></div></div>
    {selected && <Modal title="Family member access" onClose={() => setSelected(null)}><div className="family-detail-modal"><div className="family-modal-head"><div className="family-avatar large">{selected.initials}</div><div><h3>{selected.name}</h3><p>{selected.relationship}</p></div></div><div className="detail-grid"><div><small>Health ID</small><strong>{selected.healthId}</strong></div><div><small>Authorization</small><strong>{selected.authorizationLoading ? 'Checking…' : selected.authorization}</strong></div><div><small>Scope</small><strong>{selected.authorizationScope || 'Care navigation'}</strong></div><div><small>Boundary</small><strong>Member-specific</strong></div></div><div className="family-protected-note"><strong>Protected information</strong><span>Viewing medical records requires authoritative authorization and consent. This screen does not grant itself access.</span></div></div><div className="modal-actions"><button className="button secondary" onClick={() => { setSelected(null); setPage('care') }}>Navigate care</button>{selected.authorization !== 'owner' && selected.authorization !== 'authorized' && <button className="button primary" onClick={() => updateAuthorization('authorized')}>Authorize care access</button>}{selected.authorization === 'authorized' && <button className="button danger" onClick={() => updateAuthorization('revoked')}>Revoke access</button>}<button className="button secondary" onClick={() => setSelected(null)}>Close</button></div></Modal>}
    {showAdd && <Modal title="Add family member" onClose={() => setShowAdd(false)}><div className="family-add-form"><label>Name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" autoFocus /></label><label>Relationship<select value={relationship} onChange={(e) => setRelationship(e.target.value)}><option>Child</option><option>Spouse</option><option>Parent</option><option>Sibling</option><option>Dependent</option><option>Care recipient</option></select></label><div className="family-protected-note"><strong>Important</strong><span>Adding a member does not automatically authorize access to their medical information.</span></div></div><div className="modal-actions"><button className="button secondary" onClick={() => setShowAdd(false)}>Cancel</button><button className="button primary" disabled={saving} onClick={add}>{saving ? 'Adding…' : 'Add member'}</button></div></Modal>}
  </section>
}

function HealthDashboard({ setPage, notify }) {
  const [state, setState] = useState('loading')
  const [dashboard, setDashboard] = useState(null)
  const load = async () => {
    setState('loading')
    try {
      const result = await aiHealthApi.getHealthDashboard()
      setDashboard(result.dashboard || {})
      setState('ready')
    } catch (error) {
      setState('error')
      notify(error?.message || 'Your health dashboard could not be loaded.')
    }
  }
  useEffect(() => { load() }, [])
  if (state === 'loading') return <section className="page health-dashboard"><div className="page-header"><div><span className="section-label purple">MY HEALTH</span><h1>Health dashboard</h1><p>Loading your connected health experience…</p></div></div><div className="dashboard-loading"><span className="loading-pulse" /><span className="loading-pulse" /><span className="loading-pulse" /></div></section>
  if (state === 'error') return <section className="page health-dashboard"><div className="page-header"><div><span className="section-label purple">MY HEALTH</span><h1>Health dashboard</h1><p>Your dashboard could not be loaded.</p></div></div><div className="state-box error"><strong>Health dashboard temporarily unavailable.</strong><p>Retry to request the latest authorized dashboard data.</p><button className="button secondary" onClick={load}>Retry →</button></div></section>

  const cards = [
    { icon: '▣', title: 'Health ID', value: dashboard.healthId?.status || '—', detail: dashboard.healthId?.identifier || 'Protected identity', page: 'health-id' },
    { icon: '◫', title: 'Care journey', value: `${dashboard.careJourney?.completed ?? 0} completed`, detail: dashboard.careJourney?.next || 'No next step', page: 'journey' },
    { icon: '◷', title: 'Appointments', value: `${dashboard.appointments?.upcoming ?? 0} upcoming`, detail: dashboard.appointments?.next || 'No upcoming appointment', page: 'appointments' },
    { icon: '⌁', title: 'Consultations', value: `${dashboard.consultations?.recent ?? 0} recent`, detail: dashboard.consultations?.latest || 'No recent consultation', page: 'history' },
    { icon: '▤', title: 'Laboratory', value: `${dashboard.laboratory?.pending ?? 0} pending`, detail: dashboard.laboratory?.latest || 'No pending result', page: 'services' },
    { icon: 'Rx', title: 'Medications', value: `${dashboard.medications?.active ?? 0} active`, detail: dashboard.medications?.next || 'No refill action due', page: 'services' },
    { icon: '₦', title: 'Payments', value: `${dashboard.payments?.recent ?? 0} recent`, detail: dashboard.payments?.status || 'No recent payment', page: 'payments' },
    { icon: '◉', title: 'PugaAI conversations', value: `${dashboard.conversations?.recent ?? 0} recent`, detail: dashboard.conversations?.latest || 'Start a conversation', page: 'talk' },
  ]
  return <section className="page health-dashboard">
    <div className="page-header dashboard-header"><div><span className="section-label purple">MY HEALTH</span><h1>Your health dashboard</h1><p>A single patient-facing view of your connected PugaAI Health journey.</p></div><div className="dashboard-header-actions"><button className="button secondary" onClick={load}>Refresh</button><button className="button primary" onClick={() => setPage('talk')}>Talk to PugaAI →</button></div></div>
    <div className="dashboard-privacy-banner"><span>⌁</span><div><strong>Patient-controlled, permission-aware</strong><p>This dashboard summarizes authorized service data. It does not grant access to clinical records by itself.</p></div><button className="button secondary" onClick={() => setPage('privacy')}>Privacy & access</button></div>
    <div className="dashboard-overview-grid">{cards.map((card) => <button key={card.title} className="dashboard-card" onClick={() => setPage(card.page)}><span className="dashboard-card-icon">{card.icon}</span><span className="dashboard-card-copy"><small>{card.title}</small><strong>{card.value}</strong><em>{card.detail}</em></span><span className="dashboard-card-arrow">→</span></button>)}</div>
    <div className="dashboard-lower-grid">
      <section className="dashboard-panel"><div className="dashboard-panel-heading"><div><span className="section-label purple">HEALTH INDICATORS</span><h2>Service & continuity indicators</h2></div><span className="dashboard-badge">Informational</span></div><div className="indicator-list">{(dashboard.indicators || []).map((item) => <div className="indicator-row" key={item.label}><span className="indicator-icon">✓</span><div><strong>{item.label}</strong><p>{item.context}</p></div><b>{item.value}</b></div>)}</div><p className="dashboard-disclaimer">These are service-level indicators, not diagnoses or clinical assessments.</p></section>
      <section className="dashboard-panel"><div className="dashboard-panel-heading"><div><span className="section-label purple">QUICK ACTIONS</span><h2>Continue your journey</h2></div></div><div className="dashboard-actions"><button className="button primary" onClick={() => setPage('care')}>Find care</button><button className="button secondary" onClick={() => setPage('appointments')}>View appointments</button><button className="button secondary" onClick={() => setPage('services')}>Lab & medication</button><button className="button secondary" onClick={() => setPage('access')}>Use PugaAccess</button></div><div className="dashboard-note"><strong>Low-bandwidth access</strong><p>Supported journeys can continue through PugaAccess using IVR, USSD or SMS.</p></div></section>
    </div>
    <div className="dashboard-footer-note"><strong>Data boundary:</strong> The frontend displays data returned by the authorized Puga services. It does not independently diagnose, prescribe, approve clinical decisions or create authoritative medical records.</div>
  </section>
}

function HealthInfo({ setPage, setMessage }) {
  const [topics, setTopics] = useState([])
  const [state, setState] = useState('loading')
  const [query, setQuery] = useState('')
  useEffect(() => { let active = true; aiHealthApi.getHealthTopics().then((result) => { if (active) { setTopics(result.topics); setState('ready') } }).catch(() => active && setState('error')); return () => { active = false } }, [])
  const filtered = topics.filter((topic) => `${topic.title} ${topic.category} ${topic.summary}`.toLowerCase().includes(query.toLowerCase()))
  return <div className="page"><div className="page-header"><div><span className="section-label purple">HEALTH INFORMATION</span><h1>Learn in plain language</h1><p>Explore approved primary-health information and use it as a starting point for care navigation.</p></div></div><div className="search-panel"><label htmlFor="health-search">Search health topics</label><input id="health-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Try malaria, pregnancy, nutrition…" /></div>{state === 'loading' && <div className="state-box">Loading health topics…</div>}{state === 'error' && <div className="state-box error"><strong>Health information is temporarily unavailable.</strong><button className="retry-button" onClick={() => window.location.reload()}>Retry →</button></div>}{state === 'ready' && <div className="health-topic-grid">{filtered.map((topic) => <article className="health-topic" key={topic.id}><span className="service-badge">{topic.category}</span><h2>{topic.title}</h2><p>{topic.summary}</p><div className="topic-actions"><button className="button secondary" onClick={() => { setMessage(`Tell me about ${topic.title}.`); setPage('talk') }}>Ask PugaAI →</button></div></article>)}{filtered.length === 0 && <div className="state-box">No matching topics. Try another search.</div>}</div>}<div className="info-card wide"><div className="feature-icon">i</div><div><strong>Information is not a diagnosis.</strong><p>PugaAI Health provides general health information and navigation. When symptoms may require professional assessment, use the care pathways available in Puga TriniCare.</p></div></div></div>
}

function History({ setPage, setMessage }) {
  const [items, setItems] = useState([])
  const [state, setState] = useState('loading')
  useEffect(() => { let active = true; aiHealthApi.getConversationHistory().then((result) => { if (active) { setItems(result.conversations); setState('ready') } }).catch(() => active && setState('error')); return () => { active = false } }, [])
  return <div className="page"><div className="page-header"><div><span className="section-label purple">CONVERSATIONS</span><h1>My conversations</h1><p>Continue a previous PugaAI Health topic without treating the AI conversation as a clinical record.</p></div></div><div className="history-panel">{state === 'loading' && <div className="state-box">Loading conversations…</div>}{state === 'error' && <div className="state-box error"><strong>Conversation history is unavailable.</strong><button className="retry-button" onClick={() => window.location.reload()}>Retry →</button></div>}{state === 'ready' && items.length === 0 && <div className="state-box">No saved conversations yet. Start by asking PugaAI Health a question.</div>}{state === 'ready' && items.map((item) => <button className="history-row" key={item.id} onClick={() => { setMessage(item.title || item.preview || 'Continue this conversation.'); setPage('talk') }}><span className="history-icon">◷</span><span><strong>{item.title || 'PugaAI Health conversation'}</strong><small>{item.preview || 'Saved conversation'} · {item.updatedAt ? new Date(item.updatedAt).toLocaleString() : 'Recent'}</small></span><span>→</span></button>)}</div><div className="info-card wide"><div className="feature-icon">i</div><div><strong>Conversation data is separate from the clinical record.</strong><p>Formal clinical documentation remains governed by the appropriate PugaCure and healthcare-provider workflows.</p></div></div></div>
}

function HandoffModal({ handoff, onClose, notify }) {
  const [state, setState] = useState('review')
  const [result, setResult] = useState(null)
  const confirm = async () => { setState('sending'); try { const response = await aiHealthApi.createCareHandoff({ service: handoff.service, context: handoff.context }); setResult(response); setState('ready'); notify(response.demo ? 'Demo handoff prepared.' : 'Care handoff prepared.') } catch (error) { setState('error'); notify(error?.message || 'Care handoff could not be prepared.') } }
  return <Modal title={state === 'ready' ? 'Care handoff prepared' : 'Review care handoff'} onClose={onClose}>{state === 'review' && <><div className="handoff-review"><span className="service-badge">{handoff.service}</span><h3>Continue to the appropriate Puga service?</h3><p>PugaAI Health will prepare a handoff with only the context necessary for this service. You will remain in control of consequential actions.</p><div className="handoff-checks"><span>✓ Purpose-limited context</span><span>✓ No automatic clinical decision</span><span>✓ Payment requires separate confirmation</span></div></div><div className="modal-actions"><button className="button secondary" onClick={onClose}>Cancel</button><button className="button primary" onClick={confirm}>Confirm handoff</button></div></>}{state === 'sending' && <div className="state-box">Preparing your care handoff…</div>}{state === 'error' && <><div className="state-box error"><strong>Handoff could not be prepared.</strong></div><div className="modal-actions"><button className="button secondary" onClick={onClose}>Close</button><button className="button primary" onClick={confirm}>Retry</button></div></>}{state === 'ready' && <><div className="success-card"><span className="success-mark">✓</span><div><strong>{result?.service || handoff.service}</strong><p>Handoff reference: {result?.handoffId || 'Pending production reference'}</p><span>{result?.demo ? 'Demo mode — no external service action was executed.' : 'The production service will now continue the authorized workflow.'}</span></div></div><div className="modal-actions"><button className="button primary" onClick={onClose}>Continue</button></div></>}</Modal>
}



function ServiceTransactions({ notify }) {
  const [tab, setTab] = useState('laboratory')
  const [state, setState] = useState('loading')
  const [services, setServices] = useState([])
  const [selected, setSelected] = useState(null)
  const [requestState, setRequestState] = useState('idle')
  const [result, setResult] = useState(null)

  const load = async (nextTab = tab) => {
    setState('loading'); setSelected(null); setRequestState('idle')
    try {
      const response = nextTab === 'laboratory' ? await aiHealthApi.getLaboratoryServices() : await aiHealthApi.getMedicationServices()
      setServices(response.services || []); setState('ready')
    } catch { setState('error') }
  }
  useEffect(() => { load(tab) }, [tab])

  const submit = async () => {
    if (!selected) return
    setRequestState('sending')
    try {
      const response = tab === 'laboratory'
        ? await aiHealthApi.createLaboratoryRequest({ serviceId: selected.id, serviceName: selected.name, facilityId: selected.facilityId })
        : await aiHealthApi.createMedicationRefillRequest({ medicationId: selected.id, medicationName: selected.name, pharmacyId: selected.pharmacyId })
      setResult(response); setRequestState('ready')
      notify(response.demo ? 'Demo service request prepared.' : 'Service request submitted.')
    } catch (error) { setRequestState('error'); notify(error?.message || 'Service request could not be submitted.') }
  }

  return <div className="page"><div className="page-header"><div><span className="section-label purple">HEALTH SERVICES</span><h1>Laboratory & medication</h1><p>Request supported healthcare services through a controlled review-and-confirm workflow.</p></div><span className="session-chip"><span />User confirmation required</span></div>
    <div className="service-tabs"><button className={tab === 'laboratory' ? 'active' : ''} onClick={() => setTab('laboratory')}>Laboratory</button><button className={tab === 'medication' ? 'active' : ''} onClick={() => setTab('medication')}>Medication refill</button></div>
    {state === 'loading' && <div className="state-box">Loading {tab === 'laboratory' ? 'laboratory services' : 'medication services'}…</div>}
    {state === 'error' && <div className="state-box error"><strong>Service network is temporarily unavailable.</strong><button className="retry-button" onClick={() => load(tab)}>Retry →</button></div>}
    {state === 'ready' && <div className="service-list">{services.map((item) => <article className={`service-row ${selected?.id === item.id ? 'selected' : ''}`} key={item.id}><div className="service-row-icon">{tab === 'laboratory' ? 'LAB' : 'RX'}</div><div className="service-row-copy"><strong>{item.name}</strong><p>{item.description}</p><small>{tab === 'laboratory' ? `${item.facility} · ${item.turnaround}` : `${item.pharmacy} · ${item.fulfillment}`}</small></div><button className="button secondary" onClick={() => setSelected(item)}>{selected?.id === item.id ? 'Selected' : 'Select'} →</button></article>)}</div>}
    {selected && requestState === 'idle' && <div className="transaction-review"><span className="section-label">REVIEW BEFORE REQUEST</span><h2>{selected.name}</h2><p>{tab === 'laboratory' ? `Facility: ${selected.facility}. This request will be sent to the authorized laboratory workflow.` : `Pharmacy: ${selected.pharmacy}. This request is for an approved medication refill workflow.`}</p><div className="handoff-checks"><span>✓ You confirm before submission</span><span>✓ No prescription is created by PugaAI Health</span><span>✓ Payment, if required, is separate</span></div><div className="modal-actions"><button className="button secondary" onClick={() => setSelected(null)}>Cancel</button><button className="button primary" onClick={submit}>Submit request</button></div></div>}
    {requestState === 'sending' && <div className="state-box">Submitting authorized service request…</div>}
    {requestState === 'error' && <div className="state-box error"><strong>The request could not be submitted.</strong><button className="button primary" onClick={submit}>Retry</button></div>}
    {requestState === 'ready' && <div className="success-card"><span className="success-mark">✓</span><div><strong>{tab === 'laboratory' ? 'Laboratory request prepared' : 'Medication refill request prepared'}</strong><p>Reference: {result?.requestId || 'Pending production reference'}</p><span>{result?.demo ? 'Demo mode — no external service request was executed.' : 'The production service will continue the authorized workflow.'}</span></div></div>}
    <div className="handoff-banner"><div className="banner-icon">✓</div><div><strong>Clinical boundary</strong><p>PugaAI Health can navigate a supported laboratory or refill workflow. It does not independently diagnose, prescribe, approve medication or alter a clinical record.</p></div></div>
  </div>
}

function Payments({ notify, setPage }) {
  const [state, setState] = useState('loading')
  const [transactions, setTransactions] = useState([])
  const [selected, setSelected] = useState(null)
  const [method, setMethod] = useState('paystack')
  const [paymentState, setPaymentState] = useState('idle')
  const [result, setResult] = useState(null)

  const load = async () => {
    setState('loading')
    try { const response = await aiHealthApi.getPaymentTransactions(); setTransactions(response.transactions || []); setState('ready') }
    catch { setState('error') }
  }
  useEffect(() => { load() }, [])

  const startPayment = async () => {
    if (!selected) return
    setPaymentState('processing')
    try {
      const response = await aiHealthApi.initiatePayment({ transactionId: selected.id, method })
      setResult(response)
      setPaymentState('ready')
      notify(response.demo ? 'Demo payment flow prepared.' : 'Payment flow initiated.')
    } catch (error) { setPaymentState('error'); notify(error?.message || 'Payment could not be initiated.') }
  }

  return <div className="page"><div className="page-header"><div><span className="section-label purple">PUGAPAY</span><h1>Payments & transactions</h1><p>Review healthcare charges and continue to an authorized PugaPay payment flow.</p></div><span className="session-chip"><span />Confirmation required</span></div>
    <div className="payment-status-banner"><strong>Pending payment</strong><span>Review the total before continuing to the authorized payment provider.</span></div><div className="payment-banner"><div className="payment-mark">₦</div><div><strong>PugaPay keeps payment separate from clinical decisions.</strong><p>PugaAI Health can explain a payable service and prepare the transaction. Payment credentials are handled by the authorized payment service, not by the AI conversation.</p></div></div>
    {state === 'loading' && <div className="state-box">Loading your transactions…</div>}
    {state === 'error' && <div className="state-box error"><strong>Transaction data is temporarily unavailable.</strong><button className="retry-button" onClick={load}>Retry →</button></div>}
    {state === 'ready' && <div className="transaction-list">{transactions.map((tx) => <article className={`transaction-row ${selected?.id === tx.id ? 'selected' : ''}`} key={tx.id}><div className="transaction-icon">{tx.type === 'platform-fee' ? 'P' : '₦'}</div><div className="transaction-copy"><div><strong>{tx.service}</strong><span className={`transaction-status ${tx.status}`}>{tx.statusLabel}</span></div><p>{tx.provider} · {tx.dateLabel}</p><small>Ref {tx.reference}</small></div><div className="transaction-amount"><strong>₦{Number(tx.amount).toLocaleString()}</strong><button className="button secondary" onClick={() => { setSelected(tx); setPaymentState('idle') }}>{selected?.id === tx.id ? 'Selected' : tx.status === 'pending' ? 'Continue payment' : 'Details'} →</button></div></article>)}</div>}
    {selected && selected.status === 'paid' && paymentState === 'idle' && <div className="payment-receipt"><div className="payment-status-banner paid"><span className="success-mark">✓</span><div><strong>Payment completed</strong><p>This transaction is recorded as paid. The authoritative receipt remains subject to the connected PugaPay/payment service.</p></div></div><div className="transaction-details"><div><span>Service</span><strong>{selected.service}</strong></div><div><span>Provider</span><strong>{selected.provider}</strong></div><div><span>Service amount</span><strong>₦{Number(selected.serviceAmount).toLocaleString()}</strong></div><div><span>Puga platform fee</span><strong>₦{Number(selected.platformFee).toLocaleString()}</strong></div><div><span>Total paid</span><strong>₦{Number(selected.amount).toLocaleString()}</strong></div><div><span>Reference</span><strong>{selected.reference}</strong></div></div><div className="modal-actions"><button className="button secondary" onClick={() => setSelected(null)}>Close</button><button className="button primary" onClick={() => notify('Receipt download will be supplied by the connected payment service.')}>Receipt →</button></div></div>}
    {selected && selected.status !== 'paid' && paymentState === 'idle' && <div className="payment-review"><span className="section-label">REVIEW BEFORE PAYMENT</span><h2>{selected.service}</h2><div className="payment-breakdown"><div><span>Healthcare service</span><strong>₦{Number(selected.serviceAmount).toLocaleString()}</strong></div><div><span>Puga platform fee</span><strong>₦{Number(selected.platformFee).toLocaleString()}</strong></div><div className="payment-total"><span>Total</span><strong>₦{Number(selected.amount).toLocaleString()}</strong></div></div><p className="payment-note">You will be redirected to the authorized PugaPay/payment provider flow. Do not enter card, PIN or OTP credentials into PugaAI Health.</p><label className="payment-method-label">Payment method<select value={method} onChange={(e) => setMethod(e.target.value)}><option value="paystack">Authorized payment gateway</option><option value="wallet">Puga health wallet (when enabled)</option></select></label><div className="modal-actions"><button className="button secondary" onClick={() => setSelected(null)}>Cancel</button><button className="button primary" onClick={startPayment}>Continue to payment →</button></div></div>}
    {paymentState === 'processing' && <div className="state-box">Preparing secure payment handoff…</div>}
    {paymentState === 'error' && <div className="state-box error"><strong>Payment handoff could not be prepared.</strong><button className="button primary" onClick={startPayment}>Retry</button></div>}
    {paymentState === 'ready' && <div className="success-card payment-handoff-ready"><span className="success-mark">✓</span><div><strong>Payment handoff ready</strong><p>Transaction reference: {result?.transactionId || selected?.reference || 'Pending production reference'}</p><span>{result?.demo ? 'Demo mode — no money was charged.' : 'Continue in the authorized payment provider to complete payment.'}</span>{result?.checkoutUrl && <button className="button primary" onClick={() => window.open(result.checkoutUrl, '_blank', 'noopener,noreferrer')}>Open secure checkout →</button>}</div><button className="button secondary" onClick={() => { setSelected(null); setPaymentState('idle'); load() }}>Done</button></div>}
    <div className="handoff-banner"><div className="banner-icon">✓</div><div><strong>Payment safety boundary</strong><p>PugaAI Health never asks for card PINs, OTPs, passwords or wallet credentials. Payment execution belongs to the authorized PugaPay/payment provider workflow.</p></div></div>
  </div>
}

function HealthJourney({ setPage, notify }) {
  const [state, setState] = useState('loading')
  const [journey, setJourney] = useState(null)
  useEffect(() => { let active = true; aiHealthApi.getHealthJourney().then((result) => { if (active) { setJourney(result); setState('ready') } }).catch(() => active && setState('error')); return () => { active = false } }, [])
  if (state === 'loading') return <div className="page"><div className="page-header"><div><span className="section-label purple">MY HEALTH JOURNEY</span><h1>Your care journey</h1><p>See the healthcare actions and milestones that you have chosen to track.</p></div></div><div className="state-box">Loading your journey…</div></div>
  if (state === 'error') return <div className="page"><div className="page-header"><div><span className="section-label purple">MY HEALTH JOURNEY</span><h1>Your care journey</h1><p>Journey data is temporarily unavailable.</p></div></div><div className="state-box error"><strong>We could not load your journey.</strong><button className="retry-button" onClick={() => window.location.reload()}>Retry →</button></div></div>
  return <div className="page"><div className="page-header"><div><span className="section-label purple">MY HEALTH JOURNEY</span><h1>Your care journey</h1><p>Track service steps without turning AI conversations into formal clinical records.</p></div><button className="button secondary" onClick={() => setPage('care')}>Continue care journey →</button></div><div className="journey-summary"><div><span className="journey-number">{journey.completed}</span><small>Completed</small></div><div><span className="journey-number">{journey.active}</span><small>In progress</small></div><div><span className="journey-number">{journey.nextSteps}</span><small>Next steps</small></div></div><div className="journey-panel">{journey.events.map((event, index) => <div className="journey-event" key={event.id}><div className={`journey-marker ${event.status}`}><span>{event.status === 'completed' ? '✓' : index + 1}</span></div><div className="journey-event-copy"><div><strong>{event.title}</strong><span className={`journey-status ${event.status}`}>{event.status}</span></div><p>{event.description}</p><small>{event.date}</small></div>{event.action && <button className="link-button" onClick={() => { notify(event.action.message); if (event.action.page) setPage(event.action.page) }}>{event.action.label} →</button>}</div>)}</div><div className="info-card wide"><div className="feature-icon">i</div><div><strong>Your journey is user-controlled.</strong><p>Only supported service events are shown here. Clinical records remain governed by the appropriate provider and PugaCure workflows.</p></div></div></div>
}

function PrivacyCenter({ notify, setShowConsent }) {
  const [state, setState] = useState('loading')
  const [permissions, setPermissions] = useState([])
  const [selected, setSelected] = useState(null)
  const load = async () => { setState('loading'); try { const result = await aiHealthApi.getPermissions(); setPermissions(result.permissions || []); setState('ready') } catch { setState('error') } }
  useEffect(() => { load() }, [])
  const revoke = async (permission) => { try { await aiHealthApi.updatePermission({ permissionId: permission.id, status: 'revoked' }); setPermissions((items) => items.map((item) => item.id === permission.id ? { ...item, status: 'revoked', updated: 'Just now' } : item)); notify(`${permission.name} permission revoked.`); setSelected(null) } catch (error) { notify(error?.message || 'Permission could not be updated.') } }
  return <div className="page"><div className="page-header"><div><span className="section-label purple">PRIVACY & ACCESS</span><h1>Privacy & Access Center</h1><p>Review identity, consent, purpose-limited permissions and recent access controls.</p></div><button className="button primary" onClick={() => setShowConsent(true)}>Review protected access</button></div>
    <div className="privacy-banner"><div className="privacy-shield">⌁</div><div><strong>Identity is not authorization.</strong><p>Your Puga Universal Health ID identifies your account. Consent and permissions determine what an approved service may access for a specific purpose.</p></div></div>
    <div className="privacy-flow"><div><b>01</b><strong>Identify</strong><span>Who you are</span></div><div><b>02</b><strong>Authenticate</strong><span>Verify account</span></div><div><b>03</b><strong>Authorize</strong><span>Check role & purpose</span></div><div><b>04</b><strong>Permit</strong><span>Minimum necessary data</span></div></div>
    {state === 'loading' && <div className="state-box">Loading permissions…</div>}{state === 'error' && <div className="state-box error"><strong>Permission data is temporarily unavailable.</strong><button className="retry-button" onClick={load}>Retry →</button></div>}{state === 'ready' && <div className="permission-list">{permissions.map((permission) => <button className="permission-row permission-row-button" key={permission.id} onClick={() => setSelected(permission)}><div className="permission-row-icon">{permission.icon}</div><div className="permission-row-copy"><strong>{permission.name}</strong><p>{permission.purpose}</p><small>Last updated: {permission.updated}</small></div><span className={`permission-status ${permission.status}`}>{permission.status}</span><span className="permission-chevron">→</span></button>)}</div>}
    <div className="privacy-actions"><button className="button secondary" onClick={load}>Refresh permissions</button><button className="button secondary" onClick={() => notify('Access history is available from My Access.')}>View access history</button></div>
    <div className="info-card wide"><div className="feature-icon">✓</div><div><strong>Access should be purposeful, permissioned and auditable.</strong><p>The authoritative production permission state will come from the Puga authorization service. This interface never grants itself access to clinical records.</p></div></div>
    {selected && <Modal title="Permission details" onClose={() => setSelected(null)}><div className="permission-detail"><div className="permission-detail-icon">{selected.icon}</div><span className={`permission-status ${selected.status}`}>{selected.status}</span><h3>{selected.name}</h3><p>{selected.purpose}</p><div className="detail-grid"><div><small>Permission ID</small><strong>{selected.id}</strong></div><div><small>Last updated</small><strong>{selected.updated}</strong></div><div><small>Scope</small><strong>Purpose-limited</strong></div><div><small>Data principle</small><strong>Minimum necessary</strong></div></div></div><div className="modal-actions">{selected.status === 'active' && <button className="button danger" onClick={() => revoke(selected)}>Revoke permission</button>}<button className="button secondary" onClick={() => setSelected(null)}>Close</button></div></Modal>}
  </div>
}

function Notifications({ onClose, setPage }) {
  const notifications = [
    { id: 'notif-1', title: 'Appointment reminder', text: 'Your upcoming care appointment is ready to review.', page: 'appointments' },
    { id: 'notif-2', title: 'Payment receipt available', text: 'A recent PugaPay transaction has a receipt ready to view.', page: 'payments' },
    { id: 'notif-3', title: 'Privacy access reviewed', text: 'Review your health-information access controls.', page: 'privacy' }
  ]
  return <Modal title="Notifications" onClose={onClose}><div className="notification-list">{notifications.map((item) => <button className="notification-row" key={item.id} onClick={() => { onClose(); setPage(item.page) }}><span className="notification-icon">◔</span><span><strong>{item.title}</strong><small>{item.text}</small></span><b>→</b></button>)}</div><div className="modal-actions"><button className="button secondary" onClick={() => { onClose(); setPage('notifications') }}>Open notification center</button></div></Modal>
}

function NotificationsCenter({ notifications, filter, setFilter, loading, onRead, onReadAll, onOpen, notify }) {
  const filtered = filter === 'all' ? notifications : notifications.filter((item) => item.type === filter)
  const unread = notifications.filter((item) => item.unread).length
  const icon = { care: '＋', payment: '₦', security: '⌁', system: '◌' }
  return <section className="page notifications-center">
    <div className="page-header"><div><span className="eyebrow">COMMUNICATION CENTER</span><h1>Notifications</h1><p>Care, payment, security and PugaAccess updates in one place.</p></div><button className="button secondary" onClick={onReadAll} disabled={!unread}>Mark all as read</button></div>
    <div className="notification-summary"><div><strong>{unread}</strong><span>Unread</span></div><div><strong>{notifications.length}</strong><span>Total</span></div><div><strong>4</strong><span>Categories</span></div></div>
    <div className="notification-filter" role="tablist" aria-label="Notification filters">{[['all','All notifications'],['care','Care'],['payment','Payments'],['security','Security'],['system','System']].map(([id,label]) => <button key={id} role="tab" aria-selected={filter === id} className={filter === id ? 'active' : ''} onClick={() => setFilter(id)}>{label}</button>)}</div>
    {loading ? <div className="empty-state"><strong>Loading notifications…</strong><p>Checking your communication center.</p></div> : filtered.length ? <div className="notification-center-list">{filtered.map((item) => <article className={`notification-center-card ${item.unread ? 'unread' : ''}`} key={item.id}><span className="notification-center-icon">{icon[item.type] || '◔'}</span><div className="notification-center-body"><div className="notification-center-top"><span className="notification-category">{item.type}</span><time>{item.time}</time></div><h2>{item.title}</h2><p>{item.text}</p><div className="notification-center-actions">{item.page && <button className="button primary" onClick={() => onOpen(item)}>Open</button>}{item.unread && <button className="button secondary" onClick={() => onRead(item.id)}>Mark read</button>}</div></div>{item.unread && <span className="unread-dot" aria-label="Unread" />}</article>)}</div> : <div className="empty-state"><strong>No notifications here.</strong><p>New updates will appear when they are available.</p><button className="button secondary" onClick={() => setFilter('all')}>View all</button></div>}
    <div className="notification-privacy-note"><strong>Privacy note</strong><span>Notification previews should not contain sensitive clinical details. Authoritative records remain in the relevant protected service.</span></div>
  </section>
}



function NaicAdminLogin({ onAuthenticated, notify }) {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const submit = async (event) => {
    event.preventDefault(); setError(''); setBusy(true)
    try {
      const result = await aiHealthApi.loginNaicAdmin({ identifier, password })
      const next = { status: result.status || 'authenticated', role: result.role || '' }
      if (!isNaicAdminSession(next)) throw new Error('This account is not authorized for the NAIC validation console.')
      onAuthenticated(next); notify('NAIC administrator session authenticated.')
    } catch (err) { setError(err?.message || 'Administrator sign-in failed.') }
    finally { setBusy(false) }
  }
  return <div className="page"><div className="page-header"><div><span className="section-label purple">RESTRICTED AREA</span><h1>NAIC Validation Console</h1><p>Administrator authentication is required to view documented voice interactions and validation evidence.</p></div></div><section className="admin-login card"><div className="feature-icon">NA</div><h2>Administrator sign in</h2><p className="muted">Only authorized <strong>naic_admin</strong> or <strong>super_admin</strong> accounts can access this console.</p><form onSubmit={submit}><label htmlFor="naic-admin-identifier">Administrator ID</label><input id="naic-admin-identifier" autoComplete="username" value={identifier} onChange={(event) => setIdentifier(event.target.value)} placeholder="Administrator ID" required /><label htmlFor="naic-admin-password">Password</label><input id="naic-admin-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Password" required />{error && <div className="state-box error" role="alert">{error}</div>}<button className="button primary" type="submit" disabled={busy}>{busy ? 'Authenticating…' : 'Sign in to validation console'}</button></form><div className="handoff-banner"><div className="banner-icon">!</div><div><strong>Security boundary</strong><p>Live mode must enforce the admin role on the Express backend. The frontend route is not an authorization boundary.</p></div></div></section></div>
}

function NaicValidation({ adminSession, setAdminSession, session, setSession, notify }) {
  if (!canAccessNaicConsole(adminSession)) return <NaicAdminLogin onAuthenticated={setAdminSession} notify={notify} />
  return <NaicValidationConsole adminSession={adminSession} setAdminSession={setAdminSession} session={session} setSession={setSession} notify={notify} />
}

function NaicValidationConsole({ adminSession, setAdminSession, session, setSession, notify }) {
  const [participantId, setParticipantId] = useState(session?.participantId || '')
  const [consent, setConsent] = useState(Boolean(session?.consent))
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    if (!canAccessNaicConsole(adminSession)) return
    setLoading(true); setError('')
    try { const result = await aiHealthApi.getNaicValidation(); setRecords(result.interactions || result.records || []) }
    catch (err) { setError(err?.message || 'Validation records could not be loaded.') }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const summary = summarizeValidation(records, NAIC_VALIDATION_TARGET)
  const start = () => {
    if (!isValidationConsentComplete({ participantId, consent })) return
    setSession({ participantId: participantId.trim(), consent: true, startedAt: new Date().toISOString() })
    notify('NAIC validation session started.')
  }
  const end = () => { setSession(null); notify('NAIC validation session ended.') }
  const exportCsv = () => {
    const columns = ['interactionId','participantId','language','channel','transcript','confidence','conversationId','messageId','responseCategory','feedback','status','createdAt']
    const escape = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`
    const csv = [columns.join(','), ...records.map((row) => columns.map((column) => escape(row[column])).join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = 'PugaAI_NAIC_Validation_Interactions.csv'; link.click(); URL.revokeObjectURL(url)
  }

  return <div className="page"><div className="page-header"><div><span className="section-label purple">NAIC VALIDATION</span><h1>Voice-First validation console</h1><p>Document genuine PugaAI Health voice interactions for the NAIC Voice-First Access requirement.</p></div><div className="talk-header-actions"><button className="button secondary compact" onClick={load}>Refresh</button><button className="button secondary compact" onClick={async () => { await aiHealthApi.logoutNaicAdmin(); setAdminSession({ status: 'signed-out', role: '' }); notify('NAIC administrator session signed out.') }}>Sign out</button><button className="button primary compact" onClick={exportCsv} disabled={!records.length}>Export CSV</button></div></div>
    {!session ? <section className="validation-setup card"><div className="section-label">PARTICIPANT SESSION</div><h2>Start a documented test session</h2><p>Use a pseudonymous participant code. Do not enter a participant's name, phone number, address or unnecessary health identifiers here.</p><label htmlFor="naic-participant">Participant code</label><input id="naic-participant" value={participantId} onChange={(event) => setParticipantId(event.target.value)} placeholder="e.g. P-001" maxLength={64} /><label className="consent-check"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /> <span>I have obtained appropriate consent for this validation session and explained that the interaction will be used as anonymized product-testing evidence.</span></label><button className="button primary" onClick={start} disabled={!isValidationConsentComplete({ participantId, consent })}>Start validation session</button></section> : <section className="validation-active card"><div><span className="section-label">ACTIVE SESSION</span><h2>{session.participantId}</h2><p>Ask genuine health-information questions by voice in PugaAI Health. Completed voice interactions will be logged automatically after the response is returned.</p></div><button className="button secondary" onClick={end}>End session</button></section>}
    <section className="validation-summary-grid"><div className="info-card"><strong>{summary.completed} / {summary.target}</strong><span>Completed interactions</span><small>{summary.remaining ? `${summary.remaining} more needed to reach the stated minimum.` : 'Minimum reached.'}</small></div><div className="info-card"><strong>{summary.uniqueParticipants}</strong><span>Participants with completed interactions</span><small>Repeated genuine interactions can be documented per participant.</small></div><div className="info-card"><strong>{Object.keys(summary.languages).length}</strong><span>Languages recorded</span><small>{Object.entries(summary.languages).map(([language, count]) => `${language}: ${count}`).join(' · ') || 'No interactions yet.'}</small></div></section>
    <section className="section-block"><div className="section-header"><div><span className="section-label">EVIDENCE</span><h2>Documented interactions</h2></div></div>{loading && <div className="state-box">Loading validation records…</div>}{error && <div className="state-box error"><strong>{error}</strong><button className="retry-button" onClick={load}>Retry →</button></div>}{!loading && !error && <div className="validation-table-wrap"><table className="validation-table"><thead><tr><th>Interaction</th><th>Participant</th><th>Language</th><th>Transcript</th><th>Status</th><th>Date</th></tr></thead><tbody>{records.map((row) => <tr key={row.interactionId}><td>{row.interactionId}</td><td>{row.participantId}</td><td>{row.language}</td><td>{row.transcript}</td><td>{row.status}</td><td>{new Date(row.createdAt).toLocaleString()}</td></tr>)}</tbody></table>{!records.length && <div className="state-box">No validation interactions have been recorded yet.</div>}</div>}</section>
    <div className="handoff-banner"><div className="banner-icon">!</div><div><strong>Validation privacy boundary</strong><p>The default evidence record excludes raw voice audio. In live mode, the backend must enforce coordinator authorization for validation records; a hidden frontend page is not a security boundary.</p></div></div>
  </div>
}

function Settings({ authState, selectedLanguage, setSelectedLanguage, backendHealth, online }) {
  const [runtime, setRuntime] = useState({ mode: runtimeConfig.apiMode, environment: runtimeConfig.appEnv, channel: runtimeConfig.channel, connected: false })
  const [natlas, setNatlas] = useState({ configured: Boolean(runtimeConfig.nAtlasEndpoint), connected: false })
  const [accessState, setAccessState] = useState('idle')
  useEffect(() => { let active = true; Promise.all([aiHealthApi.getRuntimeStatus().catch((error) => ({ mode: 'live', connected: false, reason: error?.message || 'API unavailable' })), aiHealthApi.getNatlasStatus()]).then(([api, n]) => { if (active) { setRuntime(api); setNatlas(n) } }); return () => { active = false } }, [])
  const openPugaAccess = async () => {
    setAccessState('loading')
    try {
      const session = await aiHealthApi.createPugaAccessSession({ channel: runtimeConfig.channel, destination: 'voice' })
      setAccessState('ready')
      if (session.accessUrl) window.open(session.accessUrl, '_blank', 'noopener,noreferrer')
    } catch { setAccessState('error') }
  }
  const rows = [['Authentication', authState === 'authenticated' ? 'Authenticated session' : authState === 'session-expired' ? 'Session expired' : 'Signed out', 'Manage'], ['Language', selectedLanguage, 'Change'], ['Privacy', 'Permission controls enabled', 'Manage'], ['Notifications', 'Care and service updates', 'Manage'], ['Accessibility', 'Keyboard and reduced-motion support', 'Adjust']]
  return <div className="page"><div className="page-header"><div><span className="section-label purple">SETTINGS</span><h1>Privacy & preferences</h1><p>Control how PugaAI Health interacts with you.</p></div></div><div className="settings-panel">{rows.map(([title, detail, action]) => <div className="setting-row" key={title}><div><strong>{title}</strong><span>{detail}</span></div>{title === 'Language' ? <select value={selectedLanguage} onChange={(e) => setSelectedLanguage(e.target.value)} aria-label="Language"><option>English (Nigeria)</option><option>Yorùbá</option><option>Igbo</option><option>Hausa</option></select> : <button>{action} →</button>}</div>)}</div><div className="integration-status-grid"><div className="info-card wide"><div className="feature-icon">API</div><div><strong>Backend connection</strong><p>{runtime.connected ? `Connected · ${runtime.environment || 'production'} · ${runtime.channel || 'web'}` : `${runtime.mode === 'mock' ? 'Mock mode is active.' : online ? 'Backend health has not been confirmed.' : 'Browser is offline.'}`}</p><small>{backendHealth?.ok ? `Health check: OK · ${backendHealth.latencyMs} ms` : backendHealth?.error ? `Health check: ${backendHealth.error}` : isLive ? 'Health check pending…' : 'Live health check disabled in mock mode.'}</small><small>API: {runtimeConfig.apiBaseUrl || 'Not configured'}</small></div></div><div className="info-card wide"><div className="feature-icon">NA</div><div><strong>N-ATLAS boundary</strong><p>{natlas.connected ? 'Configured and reachable.' : natlas.configured ? 'Configured but not reachable.' : 'Endpoint not configured yet.'}</p></div></div></div><div className="info-card wide pugaaccess-bridge"><div className="feature-icon">PA</div><div><strong>PugaAccess channel bridge</strong><p>PugaAI Health uses the same service layer when a user needs IVR, USSD, SMS or another low-bandwidth access channel.</p><button className="button secondary" onClick={openPugaAccess} disabled={accessState === 'loading'}>{accessState === 'loading' ? 'Preparing PugaAccess…' : 'Open PugaAccess voice path →'}</button>{accessState === 'error' && <small className="error-text">The PugaAccess session could not be prepared. Try again.</small>}</div></div><div className="info-card wide"><div className="feature-icon">!</div><div><strong>Important</strong><p>Do not share passwords, one-time codes or payment credentials with PugaAI Health. Protected actions are handled through the appropriate Puga service.</p></div></div></div>
}

function AuthModal({ authState, onClose, onChange }) {
  const [busy, setBusy] = useState(false)
  const submit = () => { setBusy(true); window.setTimeout(() => { setBusy(false); onChange('authenticated') }, 650) }
  return <Modal title="Authentication & protected session" onClose={onClose}><div className="auth-state"><span className={`state-dot ${authState === 'authenticated' ? 'success' : ''}`} /><div><strong>{authState === 'authenticated' ? 'Authenticated' : authState === 'session-expired' ? 'Session expired' : 'Signed out'}</strong><p>{authState === 'authenticated' ? 'You can explicitly enable protected session access when a task requires it.' : 'Demo authentication state only. Production credentials must be handled by the approved identity service.'}</p></div></div><div className="modal-actions"><button className="button secondary" onClick={() => onChange('signed-out')}>Sign out</button><button className="button primary" disabled={busy || authState === 'authenticated'} onClick={submit}>{busy ? 'Signing in…' : authState === 'authenticated' ? 'Authenticated' : 'Demo sign in'}</button></div></Modal>
}

function Feature({ icon, title, text, onClick }) { return <button className="feature-card" onClick={onClick} disabled={!onClick}><span className="feature-icon">{icon}</span><span><strong>{title}</strong><small>{text}</small></span>{onClick && <span className="feature-arrow">→</span>}</button> }
function Step({ n, title, text }) { return <div className="step"><b>{n}</b><div><strong>{title}</strong><p>{text}</p></div></div> }
function Modal({ title, onClose, children }) {
  const closeOnEscape = (event) => { if (event.key === 'Escape') onClose() }
  useEffect(() => { window.addEventListener('keydown', closeOnEscape); return () => window.removeEventListener('keydown', closeOnEscape) }, [])
  return <div className="modal-backdrop" onClick={onClose}><div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" onClick={(event) => event.stopPropagation()}><button className="modal-close" onClick={onClose} aria-label="Close">×</button><h2 id="modal-title">{title}</h2>{children}</div></div> }

createRoot(document.getElementById('root')).render(<AppErrorBoundary><App /></AppErrorBoundary>)
