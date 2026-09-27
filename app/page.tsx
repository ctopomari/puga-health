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
            {showNotifications && <div className="notification-popover" role="dialog" aria-label="Notifications"><strong>Notifications</strong><p>Your teleconsultation with Dr. Amaka is tomorrow at 10:30 AM.</p><button onClick={() => { setShowNotifications(false); notify('Notifications marked as read') }}>Mark as read</button></div>}
            {showHelp && <div className="help-popover" role="tooltip"><strong>Need urgent help?</strong><p>For emergencies, call your local emergency service. PugaAI provides information, not a diagnosis.</p></div>}
          </div>
        </header>

        {activeTab === 'home' && <>
          <section className="welcome-block">
            <div>
              <p className="eyebrow">TUESDAY, SEPTEMBER 24</p>
              <h1>Good morning, <em>Amaka</em></h1>
              <p className="intro">Your everyday health companion, right here.</p>
            </div>
            <div className="avatar" aria-label="Amaka profile">A</div>
          </section>

          <section className="hero-card">
            <div className="hero-copy"><div className="sparkle"><Sparkles /></div><p className="eyebrow light">YOUR HEALTH COMPANION</p><h2>How can Puga help you today?</h2><p>Ask a question, understand your symptoms, or find the right care.</p><button className="hero-button" onClick={() => startConversation()}>Talk to PugaAI <ArrowRight /></button></div>
            <div className="hero-orb"><div className="orb-ring"><div className="orb-core"><HeartPulse /></div></div></div>
          </section>

          <section className="section-block">
            <div className="section-heading"><div><p className="eyebrow">EXPLORE</p><h2>What can I help with?</h2></div><button className="text-button" onClick={() => setShowAllTopics(!showAllTopics)}>{showAllTopics ? 'Show less' : 'See all'}</button></div>
            <div className="topic-grid">{(showAllTopics ? [...topics, { label: 'Find care', icon: Search, tone: 'peach' }, { label: 'Nutrition', icon: Activity, tone: 'mint' }] : topics).map((topic) => { const Icon = topic.icon; return <button className="topic-card" key={topic.label} onClick={() => startConversation(topic.label)}><span className={`topic-icon ${topic.tone}`}><Icon /></span><span>{topic.label}</span><ChevronRight /></button> })}</div>
          </section>

          <section className="section-block"><div className="section-heading"><div><p className="eyebrow">UP NEXT</p><h2>Your care plan</h2></div><button className="text-button" onClick={() => setActiveTab('care')}>View all</button></div><div className="appointment-card"><div className="date-tile"><strong>{appointments[0].day}</strong><span>{appointments[0].month}</span></div><div className="appointment-copy"><strong>{appointments[0].title}</strong><span>{appointments[0].provider}</span><small>{appointments[0].type}</small></div><button className="more-button" aria-label="More appointment options" onClick={() => notify('Appointment options opened')}><MoreHorizontal /></button></div></section>
        </>}

        {activeTab === 'talk' && <TalkPanel query={query} setQuery={setQuery} onSend={() => { notify(query ? 'PugaAI is thinking…' : 'Try asking a health question'); setQuery('') }} />}
        {activeTab === 'care' && <CarePanel onBook={() => notify('Care finder opened')} />}
        {activeTab === 'health' && <HealthPanel />}
        {activeTab === 'id' && <HealthIdPanel onAction={notify} />}
        {activeTab === 'access' && <AccessPanel onAction={notify} />}

        <nav className="bottom-nav" aria-label="Primary navigation">{[{ id: 'home', label: 'Home', Icon: Home }, { id: 'talk', label: 'Ask Puga', Icon: MessageCircle }, { id: 'care', label: 'Care', Icon: CalendarDays }, { id: 'id', label: 'Health ID', Icon: FileHeart }, { id: 'health', label: 'My health', Icon: UserRound }].map(({ id, label, Icon }) => <button key={id} className={activeTab === id ? 'nav-item active' : 'nav-item'} onClick={() => setActiveTab(id)}><Icon /><span>{label}</span></button>)}</nav>
        {toast && <div className="toast" role="status">{toast}</div>}
      </div>
    </main>
  )
}

function TalkPanel({ query, setQuery, onSend }: { query: string; setQuery: (value: string) => void; onSend: () => void }) {
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

  return <section className="talk-panel voice-first-panel"><div className="talk-intro"><span className="puga-avatar"><Sparkles /></span><p className="eyebrow">PUGAAI HEALTH · PHASE 1</p><h1>Speak to learn about your health.</h1><p>PugaAI shares primary healthcare information and education using N-ATLAS. It does not diagnose or replace a clinician.</p></div><div className={`voice-orb ${listening ? 'is-listening' : ''}`}><div className="voice-wave"><span /><span /><span /><span /><span /></div><button className="voice-main-button" onClick={toggleVoice} aria-label={listening ? 'Stop listening' : 'Start voice command'}><Mic /></button><strong>{listening ? 'Listening' : 'Tap to speak'}</strong><small>{listening ? 'Say a health question' : 'Voice command only'}</small></div><div className="language-row"><span>Response language</span><button onClick={() => setTranscript('Language set to English')} aria-label="English response language">English <ChevronRight /></button></div>{transcript && <div className="transcript-card"><span className="eyebrow">TRANSCRIPT</span><p>{transcript}</p></div>}<div className="suggestions">{['What are malaria symptoms?', 'How can I prevent malaria?', 'What should I know about pregnancy?'].map((item) => <button key={item} onClick={() => { setQuery(item); setTranscript(item) }}>{item}<ArrowRight /></button>)}</div><div className="composer"><textarea value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Type a question to test N-ATLAS…" aria-label="Health question" rows={2} /><div className="composer-actions"><button className="mic-button" onClick={toggleVoice} aria-label="Use voice input"><Mic /></button><button className="send-button" onClick={respond} aria-label="Get health education response"><ArrowRight /></button></div></div>{response && <div className="response-card"><div className="response-heading"><Sparkles /><strong>Primary healthcare information</strong></div><p>{response}</p><small>Educational information from PugaAI Health · N-ATLAS phase 1</small></div>}<div className="privacy-note"><ShieldCheck /> No care linkage in phase 1. Your conversation stays educational.</div></section>
}

function CarePanel({ onBook }: { onBook: () => void }) { return <section className="page-panel"><p className="eyebrow">CARE NAVIGATION</p><h1>Care that fits your life.</h1><p className="panel-lede">Find trusted providers, manage appointments, and keep every next step in one place.</p><div className="care-feature"><span className="feature-icon"><Stethoscope /></span><div><strong>Find care near you</strong><p>Search clinics, pharmacies, and labs around Lagos.</p></div><ChevronRight /></div><div className="care-feature"><span className="feature-icon"><CalendarDays /></span><div><strong>Upcoming appointments</strong><p>{appointments.length} visits planned this month.</p></div><ChevronRight /></div><button className="primary-cta" onClick={onBook}>Find a provider <ArrowRight /></button></section> }

function HealthPanel() { return <section className="page-panel"><p className="eyebrow">MY HEALTH</p><h1>Your health, in view.</h1><p className="panel-lede">Small steps add up. Here&apos;s a gentle snapshot of your recent activity.</p><div className="health-score"><div><span className="eyebrow">WELLNESS CHECK-IN</span><strong>Looking good</strong><p>Keep your routine going this week.</p></div><div className="score">82</div></div><div className="metric-row"><div><Activity /><strong>7,420</strong><span>Steps this week</span></div><div><HeartPulse /><strong>3</strong><span>Check-ins</span></div><div><CircleHelp /><strong>2</strong><span>Care actions</span></div></div><div className="reference-list"><strong>More from your health space</strong><button><WalletCards /> Payments <ChevronRight /></button><button><Settings2 /> Privacy &amp; access <ChevronRight /></button></div></section> }

function HealthIdPanel({ onAction }: { onAction: (message: string) => void }) { return <section className="page-panel"><p className="eyebrow">PROTECTED HEALTH ID</p><h1>Your care identity, ready when you need it.</h1><p className="panel-lede">Share the right information with trusted providers while keeping your health data private.</p><div className="health-id-card"><div><span>PUGA HEALTH ID</span><strong>AMAKA OKAFOR</strong><small>PHI-••••-4829</small></div><ShieldCheck /></div><div className="privacy-card"><LockKeyhole /><div><strong>Private by default</strong><p>Your Health ID is protected and only shared with your permission.</p></div></div><button className="primary-cta" onClick={() => onAction('Health ID sharing options opened')}>Manage access <ArrowRight /></button></section> }

function AccessPanel({ onAction }: { onAction: (message: string) => void }) { return <section className="page-panel"><p className="eyebrow">MY ACCESS</p><h1>Stay in control of who helps you.</h1><p className="panel-lede">Review trusted people and services with permission to support your care.</p><div className="access-card"><div className="access-row"><span className="access-avatar">DR</span><div><strong>Dr. Amaka Okafor</strong><small>Teleconsultation provider</small></div><span className="status-badge">Allowed</span><MoreHorizontal /></div><div className="access-row"><span className="access-avatar">LI</span><div><strong>Lagos Island Clinic</strong><small>Appointment coordination</small></div><span className="status-badge">Allowed</span><MoreHorizontal /></div></div><button className="secondary-cta" onClick={() => onAction('Access settings opened')}><Info /> Learn about privacy</button></section> }
