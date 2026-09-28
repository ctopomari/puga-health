'use client'

import { useEffect, useState } from 'react'
import { Activity, ArrowRight, Bell, CalendarDays, ChevronRight, CircleHelp, FileHeart, HeartPulse, Home, Info, LockKeyhole, MessageCircle, Mic, MoreHorizontal, Search, Settings2, ShieldCheck, Sparkles, Stethoscope, UserRound, UsersRound, WalletCards } from 'lucide-react'

const topics = [
  { label: 'Malaria prevention', icon: ShieldCheck, tone: 'mint' },
  { label: 'Child health', icon: UsersRound, tone: 'peach' },
  { label: 'Pregnancy', icon: HeartPulse, tone: 'lavender' },
  { label: 'Blood pressure', icon: Activity, tone: 'sky' },
]

const appointments = [
  { day: '24', month: 'SEP', title: 'Teleconsultation', provider: 'Dr. Amaka Okafor · 10:30 AM', type: 'Video visit' },
  { day: '03', month: 'OCT', title: 'Blood pressure check', provider: 'Lagos Island Clinic · 2:00 PM', type: 'In-person' },
]

export default function Page() {
  const [activeTab, setActiveTab] = useState('home')
  const [query, setQuery] = useState('')
  const [showAllTopics, setShowAllTopics] = useState(false)
  const [toast, setToast] = useState('')
  const [showNotifications, setShowNotifications] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [modal, setModal] = useState<'emergency' | 'consent' | 'appointment' | 'language' | 'settings' | 'signout' | 'care' | 'healthId' | 'privacy' | null>(null)
  const [onboarding, setOnboarding] = useState<'splash' | 'welcome' | 'auth' | 'app'>('splash')
  const [onboardingSlide, setOnboardingSlide] = useState(0)
  const [authMode, setAuthMode] = useState<'welcome' | 'signin' | 'signup'>('welcome')
  const [authName, setAuthName] = useState('Amaka Okafor')
  const routeByTab: Record<string, string> = { home: '/', talk: '/talk', care: '/care', id: '/health-id', health: '/my-health', access: '/my-access', more: '/features', 'health-info': '/health-information', appointments: '/appointments', services: '/lab-medication', payments: '/payments', 'health-dashboard': '/health-dashboard', family: '/family-health', history: '/conversations', journey: '/health-journey', privacy: '/privacy-access', settings: '/settings', notifications: '/notifications' }
  const setTab = (tab: string) => {
    setActiveTab(tab)
    window.history.pushState({}, '', routeByTab[tab] || '/')
  }
  useEffect(() => {
    const route = window.location.pathname
    const tab = Object.entries(routeByTab).find(([, path]) => path === route)?.[0]
    if (tab) setActiveTab(tab)
    const onPopState = () => {
      const nextTab = Object.entries(routeByTab).find(([, path]) => path === window.location.pathname)?.[0]
      if (nextTab) setActiveTab(nextTab)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])
  const notifications = ['appointment']
  const onboardingSlides = [
    { title: 'Your health, understood.', body: 'PugaAI Health gives you clear, trusted primary healthcare information in a voice-first experience.', icon: Sparkles },
    { title: 'Ask naturally.', body: 'Speak your health question and receive simple education designed for everyday decisions.', icon: Mic },
    { title: 'Learn with confidence.', body: 'Explore helpful guidance about prevention, symptoms, pregnancy, child health, and more.', icon: HeartPulse },
    { title: 'Know your next step.', body: 'Understand when self-care may help and when it is important to seek professional care.', icon: Stethoscope },
    { title: 'Your privacy matters.', body: 'Your Phase 1 experience is private by default and focused on education, not diagnosis.', icon: ShieldCheck },
    { title: 'Welcome to PugaAI.', body: 'Start learning about your health with N-ATLAS. Care connections arrive in Phase 2.', icon: Activity },
  ]

  const notify = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 2800)
  }

  const startConversation = (prompt = '') => {
    setTab('talk')
    if (prompt) notify(`Opening PugaAI on “${prompt}”`)
  }

  return (
    <main className="app-shell">
      <div className="app-frame">
        {onboarding !== 'app' && <OnboardingScreen stage={onboarding} slide={onboardingSlides[onboardingSlide]} slideIndex={onboardingSlide} slideCount={onboardingSlides.length} authMode={authMode} authName={authName} setAuthName={setAuthName} onNext={() => { if (onboarding === 'splash') setOnboarding('welcome'); else if (onboardingSlide < onboardingSlides.length - 1) setOnboardingSlide((value) => value + 1); else setOnboarding('auth') }} onBack={() => onboardingSlide > 0 ? setOnboardingSlide((value) => value - 1) : setOnboarding('welcome')} onAuthMode={setAuthMode} onComplete={() => setOnboarding('app')} />}
        {onboarding === 'app' && <>
        <header className="topbar">
          <div className="brand-lockup">
            <img src="/puga-trinicare-compact.png" alt="Puga TriniCare" className="brand-mark" />
            <div><span className="brand-name">Puga</span><span className="brand-sub">AI Health</span></div>
          </div>
          <div className="header-actions">
            <button className="icon-button tooltip-trigger" aria-label="Help and safety" data-tooltip="Health information and safety help" onClick={() => setShowHelp(!showHelp)}><CircleHelp /></button>
            <button className="icon-button notification-trigger" aria-label="Notifications" data-tooltip="Notifications" onClick={() => setShowNotifications(!showNotifications)}><Bell />{notifications.length > 0 && <span className="notification-dot" />}</button>
            <div className="profile-menu-wrap header-profile">
              <button className="avatar tooltip-trigger" aria-label={`Open ${authName || 'your'} profile`} aria-expanded={showProfile} data-tooltip="Profile and session controls" onClick={() => setShowProfile(!showProfile)}>A</button>
              {showProfile && <div className="profile-dropdown" role="menu" aria-label="Profile menu">
                <div className="profile-dropdown-header"><div className="profile-avatar">{(authName || 'A').charAt(0).toUpperCase()}</div><div><strong>{authName || 'Amaka Okafor'}</strong><span>Patient account</span></div></div>
                <button role="menuitem" onClick={() => { setShowProfile(false); setModal('consent') }}><ShieldCheck /> Privacy and permissions <ChevronRight /></button>
                <button role="menuitem" onClick={() => { setShowProfile(false); setModal('settings') }}><Settings2 /> Account settings <ChevronRight /></button>
                <button role="menuitem" onClick={() => { setShowProfile(false); setModal('signout') }}><UserRound /> Sign out <ChevronRight /></button>
              </div>}
            </div>
            {showNotifications && <div className="notification-popover" role="dialog" aria-label="Notifications"><strong>Notifications</strong><p>Your teleconsultation with Dr. Amaka is tomorrow at 10:30 AM.</p><button onClick={() => { setShowNotifications(false); notify('Notifications marked as read') }}>Mark as read</button></div>}
            {showHelp && <div className="help-popover" role="tooltip"><strong>Need urgent help?</strong><p>For emergencies, call your local emergency service. PugaAI provides information, not a diagnosis.</p><button className="text-button" onClick={() => setModal('emergency')}>Read urgent care guidance</button></div>}
          </div>
        </header>

        {activeTab === 'home' && <>
          <section className="welcome-block">
            <div>
              <p className="eyebrow">TUESDAY, SEPTEMBER 24</p>
              <h1>Good morning, <em>{(authName || 'Amaka').split(' ')[0]}</em></h1>
              <p className="intro">Your everyday health companion, right here.</p>
            </div>

          </section>

          <section className="hero-card">
            <div className="hero-copy"><div className="sparkle"><Sparkles /></div><p className="eyebrow light">YOUR HEALTH COMPANION</p><h2>How can Puga help you today?</h2><p>Ask a question, understand your symptoms, or find the right care.</p><button className="hero-button" onClick={() => startConversation()}>Talk to PugaAI <ArrowRight /></button></div>
            <div className="hero-orb"><div className="orb-ring"><div className="orb-core"><HeartPulse /></div></div></div>
          </section>

          <section className="section-block">
            <div className="section-heading"><div><p className="eyebrow">EXPLORE</p><h2>What can I help with?</h2></div><button className="text-button" onClick={() => setShowAllTopics(!showAllTopics)}>{showAllTopics ? 'Show less' : 'See all'}</button></div>
            <div className="topic-grid">{(showAllTopics ? [...topics, { label: 'Find care', icon: Search, tone: 'peach' }, { label: 'Nutrition', icon: Activity, tone: 'mint' }] : topics).map((topic) => { const Icon = topic.icon; return <button className="topic-card" key={topic.label} onClick={() => startConversation(topic.label)}><span className={`topic-icon ${topic.tone}`}><Icon /></span><span>{topic.label}</span><ChevronRight /></button> })}</div>
          </section>

          <section className="section-block"><div className="section-heading"><div><p className="eyebrow">UP NEXT</p><h2>Your care plan</h2></div><button className="text-button" onClick={() => setTab('care')}>View all</button></div><div className="appointment-card"><div className="date-tile"><strong>{appointments[0].day}</strong><span>{appointments[0].month}</span></div><div className="appointment-copy"><strong>{appointments[0].title}</strong><span>{appointments[0].provider}</span><small>{appointments[0].type}</small></div><button className="more-button" aria-label="More appointment options" onClick={() => setModal('appointment')}><MoreHorizontal /></button></div></section>
        </>}

        {activeTab === 'talk' && <TalkPanel query={query} setQuery={setQuery} onLanguage={() => setModal('language')} onSend={() => { notify(query ? 'PugaAI is thinking…' : 'Try asking a health question'); setQuery('') }} />}
        {activeTab === 'care' && <CarePanel onBook={() => setModal('care')} />}
        {activeTab === 'health' && <HealthPanel onPrivacy={() => setModal('privacy')} />}
        {activeTab === 'id' && <HealthIdPanel onAction={() => setModal('healthId')} />}
        {activeTab === 'access' && <AccessPanel onAction={notify} />}\n        {activeTab === 'more' && <FeaturePanel onOpen={(tab) => setTab(tab)} />}\n        {['health-info', 'appointments', 'services', 'payments', 'health-dashboard', 'family', 'history', 'journey', 'privacy', 'settings', 'notifications'].includes(activeTab) && <FeatureDetailPanel page={activeTab} onAction={notify} onOpen={(tab) => setTab(tab)} />}

        {modal === 'emergency' && <Modal title="Urgent health concern?" onClose={() => setModal(null)}><div className="alert-icon">!</div><p className="modal-copy">PugaAI Health is not an emergency service. If you or someone else may be in immediate danger, seek urgent medical attention or go to the nearest appropriate healthcare facility.</p><div className="modal-actions"><button className="secondary-cta" onClick={() => setModal(null)}>Close</button><button className="primary-cta" onClick={() => { setModal(null); notify('Emergency guidance acknowledged') }}>I understand <ArrowRight /></button></div></Modal>}
        {modal === 'consent' && <Modal title="Permission before protected data" onClose={() => setModal(null)}><div className="permission-card"><LockKeyhole /><div><strong>Purpose-limited access</strong><p>PugaAI Health should only receive the minimum health information needed for the task you approve.</p></div></div><div className="modal-actions"><button className="secondary-cta" onClick={() => setModal(null)}>Not now</button><button className="primary-cta" onClick={() => { setModal(null); notify('Permission granted for this session') }}>Continue <ArrowRight /></button></div></Modal>}
        {modal === 'appointment' && <Modal title="Appointment details" onClose={() => setModal(null)}><div className="appointment-detail"><span className="status-badge">Upcoming</span><h3>Teleconsultation</h3><p><strong>Dr. Amaka Okafor</strong><br />Lagos Island Clinic</p><div className="detail-grid"><div><small>Date</small><strong>24 September</strong></div><div><small>Time</small><strong>10:30 AM</strong></div></div></div><div className="modal-actions"><button className="secondary-cta" onClick={() => setModal(null)}>Close</button><button className="primary-cta" onClick={() => { setModal(null); notify('Teleconsultation details opened') }}>View care plan <ArrowRight /></button></div></Modal>}
        {modal === 'language' && <Modal title="Choose response language" onClose={() => setModal(null)}><p className="modal-copy">Choose the language PugaAI should use for health education responses.</p><button className="modal-list-button selected" onClick={() => { setModal(null); notify('English selected') }}>English (Nigeria) <span>Selected</span></button><button className="modal-list-button" onClick={() => { setModal(null); notify('Nigerian Pidgin selected') }}>Nigerian Pidgin <ChevronRight /></button><button className="modal-list-button" onClick={() => { setModal(null); notify('Yorùbá selected') }}>Yorùbá <ChevronRight /></button></Modal>}
        {modal === 'settings' && <Modal title="Account settings" onClose={() => setModal(null)}><p className="modal-copy">Your Phase 1 profile controls are ready. Authentication and linked care services will be added in Phase 2.</p><div className="settings-list"><div><strong>Education language</strong><span>English (Nigeria)</span></div><div><strong>Health information</strong><span>Private by default</span></div><div><strong>Care connections</strong><span>Not connected in Phase 1</span></div></div><div className="modal-actions"><button className="primary-cta" onClick={() => { setModal(null); notify('Settings saved') }}>Done <ArrowRight /></button></div></Modal>}
        {modal === 'signout' && <Modal title="Sign out of this session?" onClose={() => setModal(null)}><p className="modal-copy">You will return to the welcome carousel. Your local profile details will be cleared from this session.</p><div className="modal-actions"><button className="secondary-cta" onClick={() => setModal(null)}>Cancel</button><button className="primary-cta" onClick={() => { setModal(null); setShowProfile(false); setOnboardingSlide(0); setAuthMode('welcome'); setOnboarding('welcome'); notify('You have been signed out') }}>End session <ArrowRight /></button></div></Modal>}
        {modal === 'care' && <Modal title="Find care near you" onClose={() => setModal(null)}><p className="modal-copy">Care navigation is prepared for Phase 2. PugaAI will connect you with PigaCare, PugaAccess, and PugaCure after the linkage phase is enabled.</p><div className="settings-list"><div><strong>Clinics</strong><span>Trusted primary care</span></div><div><strong>Pharmacies</strong><span>Medication support</span></div><div><strong>Labs</strong><span>Diagnostic services</span></div></div><div className="modal-actions"><button className="primary-cta" onClick={() => { setModal(null); notify('Care options saved for Phase 2') }}>Got it <ArrowRight /></button></div></Modal>}
        {modal === 'healthId' && <Modal title="Manage Health ID access" onClose={() => setModal(null)}><div className="permission-card"><ShieldCheck /><div><strong>Private by default</strong><p>No provider or service can access your Health ID without your permission.</p></div></div><p className="modal-copy">Access management will become active when linked care services are introduced in Phase 2.</p><div className="modal-actions"><button className="secondary-cta" onClick={() => setModal(null)}>Close</button><button className="primary-cta" onClick={() => { setModal(null); notify('Health ID access reviewed') }}>Review access <ArrowRight /></button></div></Modal>}
        {modal === 'privacy' && <Modal title="Privacy and access" onClose={() => setModal(null)}><p className="modal-copy">PugaAI Health uses your questions only to provide Phase 1 primary healthcare information and education. It does not diagnose, prescribe, or connect to OpenAI in this phase.</p><div className="settings-list"><div><strong>Data sharing</strong><span>Off by default</span></div><div><strong>AI service</strong><span>N-ATLAS only</span></div><div><strong>Care linkage</strong><span>Planned for Phase 2</span></div></div><div className="modal-actions"><button className="primary-cta" onClick={() => { setModal(null); notify('Privacy settings confirmed') }}>Done <ArrowRight /></button></div></Modal>}

        <nav className="bottom-nav" aria-label="Primary navigation">{[{ id: 'home', label: 'Home', Icon: Home }, { id: 'talk', label: 'Ask Puga', Icon: MessageCircle }, { id: 'care', label: 'Care', Icon: CalendarDays }, { id: 'id', label: 'Health ID', Icon: FileHeart }, { id: 'more', label: 'More', Icon: MoreHorizontal }].map(({ id, label, Icon }) => <button key={id} className={activeTab === id ? 'nav-item active' : 'nav-item'} onClick={() => setTab(id)}><Icon /><span>{label}</span></button>)}</nav>
        {toast && <div className="toast" role="status">{toast}</div>}
        </>}
      </div>
    </main>
  )
}

function OnboardingScreen({ stage, slide, slideIndex, slideCount, authMode, authName, setAuthName, onNext, onBack, onAuthMode, onComplete }: { stage: 'splash' | 'welcome' | 'auth'; slide: { title: string; body: string; icon: typeof Sparkles }; slideIndex: number; slideCount: number; authMode: 'welcome' | 'signin' | 'signup'; authName: string; setAuthName: (value: string) => void; onNext: () => void; onBack: () => void; onAuthMode: (mode: 'welcome' | 'signin' | 'signup') => void; onComplete: () => void }) {
  if (stage === 'splash') return <section className="splash-screen" aria-label="PugaAI Health splash screen"><div className="splash-glow" /><img src="/puga-trinicare-compact.png" alt="PugaAI Health" className="splash-logo" /><p className="splash-kicker">PUGAAI HEALTH</p><h1>Care starts with<br /><em>understanding.</em></h1><p className="splash-note">Primary healthcare information, made human.</p><button className="splash-start" onClick={onNext} aria-label="Start PugaAI Health"><ArrowRight /></button></section>
  if (stage === 'auth') return <section className="auth-screen" aria-label="PugaAI Health sign in"><div className="auth-brand"><img src="/puga-trinicare-compact.png" alt="PugaAI Health" /><span>PugaAI <strong>Health</strong></span></div>{authMode === 'welcome' ? <><div className="auth-hero"><p className="eyebrow">WELCOME</p><h1>Your health journey starts here.</h1><p>Sign in to keep your conversations and preferences together, or continue with a local Phase 1 profile.</p></div><div className="auth-actions"><button className="primary-cta" onClick={() => onAuthMode('signin')}>Sign in <ArrowRight /></button><button className="secondary-cta" onClick={() => onAuthMode('signup')}>Create profile</button><button className="text-button" onClick={onComplete}>Continue without account</button></div></> : <div className="auth-form"><button className="back-link" onClick={() => onAuthMode('welcome')}><ArrowRight /> Back</button><p className="eyebrow">{authMode === 'signin' ? 'SIGN IN' : 'CREATE PROFILE'}</p><h1>{authMode === 'signin' ? 'Welcome back.' : 'Meet PugaAI Health.'}</h1><p>{authMode === 'signin' ? 'Your profile stays private by default.' : 'Create a simple local profile for this Phase 1 experience.'}</p>{authMode === 'signup' && <input value={authName} onChange={(event) => setAuthName(event.target.value)} placeholder="Your name" aria-label="Your name" />}{authMode === 'signin' && <input placeholder="Email address" aria-label="Email address" type="email" />}<input placeholder="Password" aria-label="Password" type="password" /><button className="primary-cta" onClick={onComplete}>{authMode === 'signin' ? 'Sign in' : 'Create profile'} <ArrowRight /></button><small>Phase 1 uses N-ATLAS for primary healthcare education. No OpenAI API is connected.</small></div>}</section>
  const Icon = slide.icon
  return <section className="onboarding-screen" aria-label={`Welcome slide ${slideIndex + 1} of ${slideCount}`}><div className="onboarding-topline"><span>PUGAAI HEALTH</span><button className="skip-button" onClick={() => onComplete()}>Skip</button></div><div className="onboarding-art"><div className="art-halo" /><div className="art-icon"><Icon /></div><span className="art-orbit orbit-one" /><span className="art-orbit orbit-two" /></div><div className="onboarding-copy"><div className="slide-dots" aria-label="Onboarding progress">{Array.from({ length: slideCount }, (_, index) => <span key={index} className={index === slideIndex ? 'active' : ''} />)}</div><h1>{slide.title}</h1><p>{slide.body}</p></div><div className="onboarding-actions"><button className="back-link" onClick={onBack} disabled={slideIndex === 0}><ArrowRight /> Back</button><button className="primary-cta" onClick={onNext}>{slideIndex === slideCount - 1 ? 'Continue' : 'Next'} <ArrowRight /></button></div></section>
}

function TalkPanel({ query, setQuery, onLanguage, onSend }: { query: string; setQuery: (value: string) => void; onLanguage: () => void; onSend: () => void }) {
  const [listening, setListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [response, setResponse] = useState('')

  const toggleVoice = () => {
    if (listening) {
      setListening(false)
      setTranscript(query || 'I have a headache')
      setQuery(query || 'I have a headache')
      return
    }
    setListening(true)
    setTranscript('Listening… speak naturally')
  }

  const respond = () => {
    const prompt = query.trim() || transcript
    if (!prompt || listening) return
    setResponse('Headaches can have many causes, including dehydration, stress, poor sleep, or an infection. Rest, drink water, and seek urgent care for a sudden severe headache, weakness, confusion, fever with a stiff neck, or vision changes.')
    onSend()
  }

  return <section className="talk-panel voice-first-panel"><div className="talk-intro"><span className="puga-avatar"><Sparkles /></span><p className="eyebrow">PUGAAI HEALTH · PHASE 1</p><h1>Speak to learn about your health.</h1><p>PugaAI shares primary healthcare information and education using N-ATLAS. It does not diagnose or replace a clinician.</p></div><div className={`voice-orb ${listening ? 'is-listening' : ''}`}><div className="voice-wave"><span /><span /><span /><span /><span /></div><button className="voice-main-button" onClick={toggleVoice} aria-label={listening ? 'Stop listening' : 'Start voice command'}><Mic /></button><strong>{listening ? 'Listening' : 'Tap to speak'}</strong><small>{listening ? 'Say a health question' : 'Voice command only'}</small></div><div className="language-row"><span>Response language</span><button onClick={onLanguage} aria-label="Choose response language">English <ChevronRight /></button></div>{transcript && <div className="transcript-card"><span className="eyebrow">TRANSCRIPT</span><p>{transcript}</p></div>}<div className="suggestions">{['What are malaria symptoms?', 'How can I prevent malaria?', 'What should I know about pregnancy?'].map((item) => <button key={item} onClick={() => { setQuery(item); setTranscript(item) }}>{item}<ArrowRight /></button>)}</div>{response && <div className="response-card"><div className="response-heading"><Sparkles /><strong>Primary healthcare information</strong></div><p>{response}</p><small>Educational information from PugaAI Health · N-ATLAS phase 1</small></div>}<div className="composer"><textarea value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Type a question to test N-ATLAS…" aria-label="Health question" rows={2} /><div className="composer-actions"><button className="mic-button" onClick={toggleVoice} aria-label="Use voice input"><Mic /></button><button className="send-button" onClick={respond} aria-label="Get health education response"><ArrowRight /></button></div></div><div className="privacy-note"><ShieldCheck /> No care linkage in phase 1. Your conversation stays educational.</div></section>
}

function CarePanel({ onBook }: { onBook: () => void }) { return <section className="page-panel"><p className="eyebrow">CARE NAVIGATION</p><h1>Care that fits your life.</h1><p className="panel-lede">Find trusted providers, manage appointments, and keep every next step in one place.</p><div className="care-feature"><span className="feature-icon"><Stethoscope /></span><div><strong>Find care near you</strong><p>Search clinics, pharmacies, and labs around Lagos.</p></div><ChevronRight /></div><div className="care-feature"><span className="feature-icon"><CalendarDays /></span><div><strong>Upcoming appointments</strong><p>{appointments.length} visits planned this month.</p></div><ChevronRight /></div><button className="primary-cta" onClick={onBook}>Find a provider <ArrowRight /></button></section> }

function HealthPanel({ onPrivacy }: { onPrivacy: () => void }) { return <section className="page-panel"><p className="eyebrow">MY HEALTH</p><h1>Your health, in view.</h1><p className="panel-lede">Small steps add up. Here&apos;s a gentle snapshot of your recent activity.</p><div className="health-score"><div><span className="eyebrow">WELLNESS CHECK-IN</span><strong>Looking good</strong><p>Keep your routine going this week.</p></div><div className="score">82</div></div><div className="metric-row"><div><Activity /><strong>7,420</strong><span>Steps this week</span></div><div><HeartPulse /><strong>3</strong><span>Check-ins</span></div><div><CircleHelp /><strong>2</strong><span>Care actions</span></div></div><div className="reference-list"><strong>More from your health space</strong><button><WalletCards /> Payments <ChevronRight /></button><button onClick={onPrivacy}><Settings2 /> Privacy &amp; access <ChevronRight /></button></div></section> }

function HealthIdPanel({ onAction }: { onAction: (message: string) => void }) { return <section className="page-panel"><p className="eyebrow">PROTECTED HEALTH ID</p><h1>Your care identity, ready when you need it.</h1><p className="panel-lede">Share the right information with trusted providers while keeping your health data private.</p><div className="health-id-card"><div><span>PUGA HEALTH ID</span><strong>AMAKA OKAFOR</strong><small>PHI-••••-4829</small></div><ShieldCheck /></div><div className="privacy-card"><LockKeyhole /><div><strong>Private by default</strong><p>Your Health ID is protected and only shared with your permission.</p></div></div><button className="primary-cta" onClick={() => onAction('Health ID sharing options opened')}>Manage access <ArrowRight /></button></section> }

function AccessPanel({ onAction }: { onAction: (message: string) => void }) { return <section className="page-panel"><p className="eyebrow">MY ACCESS</p><h1>Stay in control of who helps you.</h1><p className="panel-lede">Review trusted people and services with permission to support your care.</p><div className="access-card"><div className="access-row"><span className="access-avatar">DR</span><div><strong>Dr. Amaka Okafor</strong><small>Teleconsultation provider</small></div><span className="status-badge">Allowed</span><MoreHorizontal /></div><div className="access-row"><span className="access-avatar">LI</span><div><strong>Lagos Island Clinic</strong><small>Appointment coordination</small></div><span className="status-badge">Allowed</span><MoreHorizontal /></div></div><button className="secondary-cta" onClick={() => onAction('Access settings opened')}><Info /> Learn about privacy</button></section> }

const featureCards = [
  { id: 'health-info', title: 'Health information', body: 'Browse trusted primary healthcare education across prevention, family health, and everyday wellness.', icon: Info },
  { id: 'appointments', title: 'Appointments', body: 'Review upcoming visits, teleconsultations, and your next care steps.', icon: CalendarDays },
  { id: 'services', title: 'Lab & medication', body: 'Keep diagnostic services and medication support in one connected place.', icon: Stethoscope },
  { id: 'payments', title: 'Payments', body: 'View care-related payment activity and saved payment preferences.', icon: WalletCards },
  { id: 'health-dashboard', title: 'Health dashboard', body: 'See a calm overview of your wellbeing check-ins and health activity.', icon: Activity },
  { id: 'family', title: 'Family health', body: 'Organize health education and care planning for the people you support.', icon: UsersRound },
  { id: 'history', title: 'My conversations', body: 'Return to previous questions and continue learning where you stopped.', icon: MessageCircle },
  { id: 'journey', title: 'My health journey', body: 'Follow personal health goals, milestones, and practical next steps.', icon: HeartPulse },
  { id: 'privacy', title: 'Privacy & access', body: 'Review what you share and keep your protected health information private.', icon: LockKeyhole },
  { id: 'settings', title: 'Settings', body: 'Manage language, notifications, and account preferences.', icon: Settings2 },
  { id: 'notifications', title: 'Notifications', body: 'Keep up with reminders, care updates, and important account activity.', icon: Bell },
]

function FeaturePanel({ onOpen }: { onOpen: (tab: string) => void }) { return <section className="page-panel feature-panel"><p className="eyebrow">PUGAAI HEALTH FEATURES</p><h1>Everything in one place.</h1><p className="panel-lede">Explore the care, health, access, and account flows from the PugaAI Health experience.</p><div className="feature-grid">{featureCards.map(({ id, title, body, icon: Icon }) => <button className="feature-page-card" key={id} onClick={() => onOpen(id)}><span className="feature-icon"><Icon /></span><span><strong>{title}</strong><small>{body}</small></span><ChevronRight /></button>)}</div></section> }

function FeatureDetailPanel({ page, onAction, onOpen }: { page: string; onAction: (message: string) => void; onOpen: (tab: string) => void }) { const feature = featureCards.find((item) => item.id === page) || featureCards[0]; const Icon = feature.icon; return <section className="page-panel feature-detail"><button className="back-link" onClick={() => onOpen('more')}><ArrowRight /> All features</button><span className="feature-icon large"><Icon /></span><p className="eyebrow">{feature.title.toUpperCase()}</p><h1>{feature.title}</h1><p className="panel-lede">{feature.body}</p><div className="feature-detail-card"><strong>Ready for your next step</strong><p>This flow is available in the PugaAI Health app experience. Actions remain private by default and are designed to connect you with the right information or care pathway.</p><button className="primary-cta" onClick={() => onAction(`${feature.title} opened`)}>Open {feature.title} <ArrowRight /></button></div><div className="settings-list"><div><strong>Privacy</strong><span>Private by default</span></div><div><strong>Connected ecosystem</strong><span>PugaCare · PugaCure · PugaAccess</span></div><div><strong>Support</strong><span>PugaAI Health education and navigation</span></div></div></section> }

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) { return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><button className="modal-close" aria-label="Close dialog" onClick={onClose}>×</button><h2 id="modal-title">{title}</h2>{children}</section></div> }
