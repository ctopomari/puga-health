'use client'

import { useState } from 'react'
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
  const [modal, setModal] = useState<'emergency' | 'consent' | 'appointment' | 'language' | 'settings' | 'signout' | null>(null)
  const notifications = ['appointment']

  const notify = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 2800)
  }

  const startConversation = (prompt = '') => {
    setActiveTab('talk')
    if (prompt) notify(`Opening PugaAI on “${prompt}”`)
  }

  return (
    <main className="app-shell">
      <div className="app-frame">
        <header className="topbar">
          <div className="brand-lockup">
            <img src="/puga-trinicare-compact.png" alt="Puga TriniCare" className="brand-mark" />
            <div><span className="brand-name">Puga</span><span className="brand-sub">AI Health</span></div>
          </div>
          <div className="header-actions">
            <button className="icon-button tooltip-trigger" aria-label="Help and safety" data-tooltip="Health information and safety help" onClick={() => setShowHelp(!showHelp)}><CircleHelp /></button>
            <button className="icon-button notification-trigger" aria-label="Notifications" data-tooltip="Notifications" onClick={() => setShowNotifications(!showNotifications)}><Bell />{notifications.length > 0 && <span className="notification-dot" />}</button>
            <div className="profile-menu-wrap header-profile">
              <button className="avatar tooltip-trigger" aria-label="Open your profile" aria-expanded={showProfile} data-tooltip="Profile and session controls" onClick={() => setShowProfile(!showProfile)}>A</button>
              {showProfile && <div className="profile-dropdown" role="menu" aria-label="Profile menu">
                <div className="profile-dropdown-header"><div className="profile-avatar">A</div><div><strong>Amaka Okafor</strong><span>Patient account</span></div></div>
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
              <h1>Good morning, <em>Amaka</em></h1>
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

          <section className="section-block"><div className="section-heading"><div><p className="eyebrow">UP NEXT</p><h2>Your care plan</h2></div><button className="text-button" onClick={() => setActiveTab('care')}>View all</button></div><div className="appointment-card"><div className="date-tile"><strong>{appointments[0].day}</strong><span>{appointments[0].month}</span></div><div className="appointment-copy"><strong>{appointments[0].title}</strong><span>{appointments[0].provider}</span><small>{appointments[0].type}</small></div><button className="more-button" aria-label="More appointment options" onClick={() => setModal('appointment')}><MoreHorizontal /></button></div></section>
        </>}

        {activeTab === 'talk' && <TalkPanel query={query} setQuery={setQuery} onLanguage={() => setModal('language')} onSend={() => { notify(query ? 'PugaAI is thinking…' : 'Try asking a health question'); setQuery('') }} />}
        {activeTab === 'care' && <CarePanel onBook={() => notify('Care finder opened')} />}
        {activeTab === 'health' && <HealthPanel />}
        {activeTab === 'id' && <HealthIdPanel onAction={notify} />}
        {activeTab === 'access' && <AccessPanel onAction={notify} />}

        {modal === 'emergency' && <Modal title="Urgent health concern?" onClose={() => setModal(null)}><div className="alert-icon">!</div><p className="modal-copy">PugaAI Health is not an emergency service. If you or someone else may be in immediate danger, seek urgent medical attention or go to the nearest appropriate healthcare facility.</p><div className="modal-actions"><button className="secondary-cta" onClick={() => setModal(null)}>Close</button><button className="primary-cta" onClick={() => { setModal(null); notify('Emergency guidance acknowledged') }}>I understand <ArrowRight /></button></div></Modal>}
        {modal === 'consent' && <Modal title="Permission before protected data" onClose={() => setModal(null)}><div className="permission-card"><LockKeyhole /><div><strong>Purpose-limited access</strong><p>PugaAI Health should only receive the minimum health information needed for the task you approve.</p></div></div><div className="modal-actions"><button className="secondary-cta" onClick={() => setModal(null)}>Not now</button><button className="primary-cta" onClick={() => { setModal(null); notify('Permission granted for this session') }}>Continue <ArrowRight /></button></div></Modal>}
        {modal === 'appointment' && <Modal title="Appointment details" onClose={() => setModal(null)}><div className="appointment-detail"><span className="status-badge">Upcoming</span><h3>Teleconsultation</h3><p><strong>Dr. Amaka Okafor</strong><br />Lagos Island Clinic</p><div className="detail-grid"><div><small>Date</small><strong>24 September</strong></div><div><small>Time</small><strong>10:30 AM</strong></div></div></div><div className="modal-actions"><button className="secondary-cta" onClick={() => setModal(null)}>Close</button><button className="primary-cta" onClick={() => { setModal(null); notify('Teleconsultation details opened') }}>View care plan <ArrowRight /></button></div></Modal>}
        {modal === 'language' && <Modal title="Choose response language" onClose={() => setModal(null)}><p className="modal-copy">Choose the language PugaAI should use for health education responses.</p><button className="modal-list-button selected" onClick={() => { setModal(null); notify('English selected') }}>English (Nigeria) <span>Selected</span></button><button className="modal-list-button" onClick={() => { setModal(null); notify('Nigerian Pidgin selected') }}>Nigerian Pidgin <ChevronRight /></button><button className="modal-list-button" onClick={() => { setModal(null); notify('Yorùbá selected') }}>Yorùbá <ChevronRight /></button></Modal>}
        {modal === 'settings' && <Modal title="Account settings" onClose={() => setModal(null)}><p className="modal-copy">Your Phase 1 profile controls are ready. Authentication and linked care services will be added in Phase 2.</p><div className="settings-list"><div><strong>Education language</strong><span>English (Nigeria)</span></div><div><strong>Health information</strong><span>Private by default</span></div><div><strong>Care connections</strong><span>Not connected in Phase 1</span></div></div><div className="modal-actions"><button className="primary-cta" onClick={() => { setModal(null); notify('Settings saved') }}>Done <ArrowRight /></button></div></Modal>}
        {modal === 'signout' && <Modal title="Sign out of this session?" onClose={() => setModal(null)}><p className="modal-copy">Signing out is not enabled in Phase 1 because this experience uses a local demo profile. Your health questions remain on this device session.</p><div className="modal-actions"><button className="secondary-cta" onClick={() => setModal(null)}>Cancel</button><button className="primary-cta" onClick={() => { setModal(null); notify('Session ended') }}>End session <ArrowRight /></button></div></Modal>}

        <nav className="bottom-nav" aria-label="Primary navigation">{[{ id: 'home', label: 'Home', Icon: Home }, { id: 'talk', label: 'Ask Puga', Icon: MessageCircle }, { id: 'care', label: 'Care', Icon: CalendarDays }, { id: 'id', label: 'Health ID', Icon: FileHeart }, { id: 'health', label: 'My health', Icon: UserRound }].map(({ id, label, Icon }) => <button key={id} className={activeTab === id ? 'nav-item active' : 'nav-item'} onClick={() => setActiveTab(id)}><Icon /><span>{label}</span></button>)}</nav>
        {toast && <div className="toast" role="status">{toast}</div>}
      </div>
    </main>
  )
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

  return <section className="talk-panel voice-first-panel"><div className="talk-intro"><span className="puga-avatar"><Sparkles /></span><p className="eyebrow">PUGAAI HEALTH · PHASE 1</p><h1>Speak to learn about your health.</h1><p>PugaAI shares primary healthcare information and education using N-ATLAS. It does not diagnose or replace a clinician.</p></div><div className={`voice-orb ${listening ? 'is-listening' : ''}`}><div className="voice-wave"><span /><span /><span /><span /><span /></div><button className="voice-main-button" onClick={toggleVoice} aria-label={listening ? 'Stop listening' : 'Start voice command'}><Mic /></button><strong>{listening ? 'Listening' : 'Tap to speak'}</strong><small>{listening ? 'Say a health question' : 'Voice command only'}</small></div><div className="language-row"><span>Response language</span><button onClick={onLanguage} aria-label="Choose response language">English <ChevronRight /></button></div>{transcript && <div className="transcript-card"><span className="eyebrow">TRANSCRIPT</span><p>{transcript}</p></div>}<div className="suggestions">{['What are malaria symptoms?', 'How can I prevent malaria?', 'What should I know about pregnancy?'].map((item) => <button key={item} onClick={() => { setQuery(item); setTranscript(item) }}>{item}<ArrowRight /></button>)}</div><div className="composer"><textarea value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Type a question to test N-ATLAS…" aria-label="Health question" rows={2} /><div className="composer-actions"><button className="mic-button" onClick={toggleVoice} aria-label="Use voice input"><Mic /></button><button className="send-button" onClick={respond} aria-label="Get health education response"><ArrowRight /></button></div></div>{response && <div className="response-card"><div className="response-heading"><Sparkles /><strong>Primary healthcare information</strong></div><p>{response}</p><small>Educational information from PugaAI Health · N-ATLAS phase 1</small></div>}<div className="privacy-note"><ShieldCheck /> No care linkage in phase 1. Your conversation stays educational.</div></section>
}

function CarePanel({ onBook }: { onBook: () => void }) { return <section className="page-panel"><p className="eyebrow">CARE NAVIGATION</p><h1>Care that fits your life.</h1><p className="panel-lede">Find trusted providers, manage appointments, and keep every next step in one place.</p><div className="care-feature"><span className="feature-icon"><Stethoscope /></span><div><strong>Find care near you</strong><p>Search clinics, pharmacies, and labs around Lagos.</p></div><ChevronRight /></div><div className="care-feature"><span className="feature-icon"><CalendarDays /></span><div><strong>Upcoming appointments</strong><p>{appointments.length} visits planned this month.</p></div><ChevronRight /></div><button className="primary-cta" onClick={onBook}>Find a provider <ArrowRight /></button></section> }

function HealthPanel() { return <section className="page-panel"><p className="eyebrow">MY HEALTH</p><h1>Your health, in view.</h1><p className="panel-lede">Small steps add up. Here&apos;s a gentle snapshot of your recent activity.</p><div className="health-score"><div><span className="eyebrow">WELLNESS CHECK-IN</span><strong>Looking good</strong><p>Keep your routine going this week.</p></div><div className="score">82</div></div><div className="metric-row"><div><Activity /><strong>7,420</strong><span>Steps this week</span></div><div><HeartPulse /><strong>3</strong><span>Check-ins</span></div><div><CircleHelp /><strong>2</strong><span>Care actions</span></div></div><div className="reference-list"><strong>More from your health space</strong><button><WalletCards /> Payments <ChevronRight /></button><button><Settings2 /> Privacy &amp; access <ChevronRight /></button></div></section> }

function HealthIdPanel({ onAction }: { onAction: (message: string) => void }) { return <section className="page-panel"><p className="eyebrow">PROTECTED HEALTH ID</p><h1>Your care identity, ready when you need it.</h1><p className="panel-lede">Share the right information with trusted providers while keeping your health data private.</p><div className="health-id-card"><div><span>PUGA HEALTH ID</span><strong>AMAKA OKAFOR</strong><small>PHI-••••-4829</small></div><ShieldCheck /></div><div className="privacy-card"><LockKeyhole /><div><strong>Private by default</strong><p>Your Health ID is protected and only shared with your permission.</p></div></div><button className="primary-cta" onClick={() => onAction('Health ID sharing options opened')}>Manage access <ArrowRight /></button></section> }

function AccessPanel({ onAction }: { onAction: (message: string) => void }) { return <section className="page-panel"><p className="eyebrow">MY ACCESS</p><h1>Stay in control of who helps you.</h1><p className="panel-lede">Review trusted people and services with permission to support your care.</p><div className="access-card"><div className="access-row"><span className="access-avatar">DR</span><div><strong>Dr. Amaka Okafor</strong><small>Teleconsultation provider</small></div><span className="status-badge">Allowed</span><MoreHorizontal /></div><div className="access-row"><span className="access-avatar">LI</span><div><strong>Lagos Island Clinic</strong><small>Appointment coordination</small></div><span className="status-badge">Allowed</span><MoreHorizontal /></div></div><button className="secondary-cta" onClick={() => onAction('Access settings opened')}><Info /> Learn about privacy</button></section> }

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) { return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><button className="modal-close" aria-label="Close dialog" onClick={onClose}>×</button><h2 id="modal-title">{title}</h2>{children}</section></div> }
