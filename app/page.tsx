'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  PARENT, CAREGIVER, Conversation, HealthSignal, TranscriptLine,
  seedHistory, simulateTodaysCall, analyzeCall, chatAsk, SUGGESTED_QUESTIONS,
  toMealRoasterRequest, mealRoasterRecommendations, fetchCallStatus,
} from './lib/sentinel'
import { VoiceCallController } from './lib/voiceCall'
import { Parent, loadParents, saveParents, newParentId, normalisePhone, isValidPhone } from './lib/parents'

const menu = ['Overview', 'Conversations', 'AI Chat', 'Nutrition', 'Medications', 'Trends']
const menuIcon = ['O', 'C', 'AI', 'N', 'M', 'T']

type CallState = 'ready' | 'connecting' | 'live' | 'processing'
type CallMode = 'sim' | 'twilio'

export default function Home() {
  const [tab, setTab] = useState('Overview')
  const [conversations, setConversations] = useState<Conversation[]>(seedHistory)
  const [callOpen, setCallOpen] = useState(false)
  const [callState, setCallState] = useState<CallState>('ready')
  const [seconds, setSeconds] = useState(0)
  const [pending, setPending] = useState<Conversation | null>(null)
  const [justCompleted, setJustCompleted] = useState(false)
  const [analysisSource, setAnalysisSource] = useState<'openai' | 'fallback'>('fallback')
  const [callMode, setCallMode] = useState<CallMode>('sim')
  const [callSid, setCallSid] = useState<string | null>(null)
  const [callError, setCallError] = useState<string | null>(null)
  const [parents, setParents] = useState<Parent[]>([])
  const [selectedParentId, setSelectedParentId] = useState<string>('')
  // Real (Twilio) transcript once the recording is transcribed; null for the
  // simulated flow. Held in a ref so the processing effect always reads latest.
  const realRef = useRef<{ transcript: TranscriptLine[]; durationMin: number } | null>(null)
  const ctrlRef = useRef<VoiceCallController | null>(null)

  const latest = conversations[0]

  // Parent contacts are managed in Settings and stored locally.
  useEffect(() => {
    const p = loadParents()
    setParents(p)
    setSelectedParentId(p[0]?.id ?? '')
  }, [])

  const updateParents = (next: Parent[]) => {
    setParents(next)
    saveParents(next)
    if (!next.find(p => p.id === selectedParentId)) setSelectedParentId(next[0]?.id ?? '')
  }
  const selectedParent = parents.find(p => p.id === selectedParentId) ?? parents[0]

  // Live timer.
  useEffect(() => {
    if (callState !== 'live') return
    const timer = window.setInterval(() => setSeconds(n => n + 1), 1000)
    return () => window.clearInterval(timer)
  }, [callState])

  // Processing: a real call polls for its recording's transcription, then
  // analyses; a simulated call analyses immediately. Both persist the record and
  // open the refreshed dashboard.
  useEffect(() => {
    if (callState !== 'processing') return
    let cancelled = false
    let timer = 0
    const started = Date.now()

    const finish = (real: { transcript: TranscriptLine[]; durationMin: number } | null) => {
      analyzeCall(conversations, real ?? undefined).then(({ conversation, source }) => {
        const wait = Math.max(0, 2600 - (Date.now() - started)) // let the steps animate
        timer = window.setTimeout(() => {
          if (cancelled) return
          setConversations(prev => [conversation, ...prev])
          setAnalysisSource(source)
          setCallOpen(false)
          setJustCompleted(true)
          setTab('Overview')
        }, wait)
      })
    }

    if (callMode === 'twilio' && callSid) {
      const startedPoll = Date.now()
      const tick = async () => {
        if (cancelled) return
        const s = await fetchCallStatus(callSid)
        if (cancelled) return
        if (s.status === 'ready') { finish({ transcript: s.transcript ?? [], durationMin: s.durationMin ?? Math.max(1, Math.round(seconds / 60)) }); return }
        if (s.status === 'error' || Date.now() - startedPoll > 3 * 60 * 1000) { setCallError(s.error ?? 'Could not retrieve the recording.'); finish(null); return }
        timer = window.setTimeout(tick, 3000)
      }
      tick()
    } else {
      finish(realRef.current)
    }
    return () => { cancelled = true; window.clearTimeout(timer) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callState])

  const openCall = () => {
    setPending(simulateTodaysCall(conversations))
    setSeconds(0)
    setCallMode('sim')
    setCallSid(null)
    setCallError(null)
    realRef.current = null
    setCallState('ready')
    setCallOpen(true)
  }

  // Place a real call through the browser Voice SDK; fall back to the simulated
  // flow when Twilio isn't configured or no number is set for this parent.
  const beginCall = async () => {
    setCallError(null)
    setSeconds(0)
    setCallSid(null)
    realRef.current = null
    const phone = selectedParent?.phone?.trim()
    if (!phone) { setCallMode('sim'); setCallState('live'); return }

    setCallState('connecting')
    const ctrl = new VoiceCallController()
    ctrlRef.current = ctrl
    const mode = await ctrl.start(phone, {
      onConnected: sid => setCallSid(sid || null),
      onEnded: () => setCallState('processing'),
      onError: msg => { setCallError(msg); setCallState('processing') },
    })
    setCallMode(mode)
    setSeconds(0)
    setCallState('live')
  }

  // End button: hang up a real call (its onEnded moves to processing); a
  // simulated call goes straight to processing.
  const endCall = () => {
    if (callMode === 'twilio') ctrlRef.current?.hangup()
    else setCallState('processing')
  }

  return <main className="shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">S</div><span>sentinel</span></div>
      <div className="family-label">YOUR FAMILY</div>
      <button className="person-card" onClick={() => setTab('Overview')}><div className="avatar el">{PARENT.initial}</div><div><b>{PARENT.name}</b><small>{justCompleted ? 'Call summary ready' : 'Ready for a family call'}</small></div><span className="dot" /></button>
      <nav className="nav">{menu.map((name, i) => <button key={name} onClick={() => setTab(name)} className={tab === name ? 'active' : ''}><span>{menuIcon[i]}</span>{name}</button>)}</nav>
      <div className="sidebar-bottom"><button onClick={() => setTab('Help')}><span>?</span> Help &amp; support</button><button onClick={() => setTab('Settings')}><span>*</span> Settings</button><div className="profile"><div className="avatar me">{CAREGIVER.initial}</div><div><b>{CAREGIVER.label}</b><small>Family check-ins</small></div></div></div>
    </aside>
    <section className="content">
      <header><div><p className="eyebrow">AI-ASSISTED FAMILY CALLS</p><h1>{tab === 'Overview' ? 'Good morning' : tab}</h1><p className="sub">{tab === 'Overview' ? `A calmer view of ${PARENT.shortName}’s wellbeing.` : `${PARENT.shortName}’s information, presented with care.`}</p></div><div className="header-actions"><button className="bell" aria-label="Notifications">o<i /></button><button className="checkin" onClick={openCall}><span>📞</span> Call Parent</button></div></header>
      {tab === 'Overview' && <Overview latest={latest} conversations={conversations} openCall={openCall} completed={justCompleted} source={analysisSource} setTab={setTab} />}
      {tab === 'Conversations' && <ConversationsView conversations={conversations} openCall={openCall} />}
      {tab === 'AI Chat' && <AIChat conversations={conversations} />}
      {tab === 'Nutrition' && <NutritionView latest={latest} />}
      {tab === 'Medications' && <MedicationsView conversations={conversations} />}
      {tab === 'Trends' && <TrendsView conversations={conversations} />}
      {!menu.includes(tab) && <SettingsView tab={tab} parents={parents} onChange={updateParents} />}
      <footer>Sentinel is for wellbeing awareness only. You make the call; Sentinel listens to help, never calls on its own, and never provides medical advice or diagnoses. <a>Learn more</a></footer>
    </section>
    {callOpen && pending && <FamilyCall state={callState} mode={callMode} seconds={seconds} pending={pending} error={callError} parents={parents} selectedParentId={selectedParentId} selectedParent={selectedParent} onSelectParent={setSelectedParentId} onBegin={beginCall} onEnd={endCall} onClose={() => setCallOpen(false)} />}
  </main>
}

// --------------------------------------------------------------------------

function Overview({ latest, conversations, openCall, completed, source, setTab }: { latest: Conversation; conversations: Conversation[]; openCall: () => void; completed: boolean; source: 'openai' | 'fallback'; setTab: (v: string) => void }) {
  const m = deriveMetrics(latest)
  return <>
    {completed
      ? <section className="completed-banner"><span>✓</span><div><b>Call summary added to {PARENT.shortName}’s dashboard</b><p>Your family call was analysed privately and the latest wellbeing signals are ready to review below.</p></div><span className={`analysis-tag ${source}`}>{source === 'openai' ? 'Analysed by OpenAI' : 'Offline analysis'}</span></section>
      : <section className="call-hero"><div><p className="eyebrow">STAY CONNECTED, WITH A LITTLE MORE CLARITY</p><h2>You make the call. Sentinel gives you gentle feedback afterwards.</h2><p>Sentinel never calls on its own, and it never replaces hearing a loved one’s voice — that connection is part of care. You start the call from the app and talk as you always would; afterwards Sentinel turns it into a clear summary and wellbeing signals, here.</p><button className="hero-call" onClick={openCall}>📞 Call Parent <span>-&gt;</span></button></div><div className="hero-orb"><span>AI</span><i /><i /><i /></div></section>}

    <section className="quick-actions"><button onClick={() => setTab('Overview')}>View dashboard</button><button onClick={() => setTab('Conversations')}>Recent conversations</button><button onClick={() => setTab('Trends')}>Trends</button><button onClick={() => setTab('AI Chat')}>AI Chat</button></section>

    <section className="summary-card"><div className="panel-title"><div><p className="eyebrow">YOUR CALL SUMMARY</p><h2>Today, in a few words</h2></div><span className={`risk-pill ${latest.riskLevel.toLowerCase()}`}>{latest.riskLevel}</span></div><p className="summary-text">{latest.summary}</p></section>

    <section className="today-head"><div><p className="eyebrow">LATEST FAMILY CALL</p><h2>{completed ? 'Today’s call is ready to review' : 'A steady, connected day'}</h2></div><div className="complete"><span>✓</span> {latest.label} · {latest.durationMin} min</div></section>

    <section className="metrics">
      <Metric tone="coral" title="Nutrition" value={m.nutrition.value} detail={m.nutrition.detail} badge={m.nutrition.score} />
      <Metric tone="purple" title="Voice & energy" value={m.voice.value} detail={m.voice.detail} badge={m.voice.score} />
      <Metric tone="blue" title="Hydration" value={m.hydration.value} detail={m.hydration.detail} badge={m.hydration.score} />
      <Metric tone="green" title="Medication" value={m.medication.value} detail={m.medication.detail} badge={m.medication.score} />
    </section>

    <section className="grid-main">
      <article className="panel signals"><div className="panel-title"><div><p className="eyebrow">AI HEALTH SIGNALS</p><h2>What we’re noticing</h2></div><span className="wellbeing-score">Wellbeing {latest.wellbeingScore}</span></div>{latest.signals.length ? latest.signals.map((s, i) => <SignalCard key={i} signal={s} />) : <p className="empty-note">No notable changes from {PARENT.shortName}’s baseline on this call.</p>}</article>
      <article className="panel conversation"><div className="panel-title"><div><p className="eyebrow">RECENT FAMILY CALL</p><h2>A lovely conversation</h2></div><button onClick={openCall}>Call Parent -&gt;</button></div><div className="conversation-body"><div className="orb"><div className="sound"><i /><i /><i /><i /><i /></div></div><div><h3>{latest.durationMin} min conversation</h3><p>Sentinel listened silently in the background and turned your chat into the signals on the left.</p><div className="tags">{conversationTags(latest).map(t => <span key={t}>{t}</span>)}</div></div></div><div className="quote">“{latest.transcript.find(l => l.speaker === PARENT.name.split(' ')[0])?.text || latest.transcript[1]?.text}”</div></article>
    </section>

    <TrendPanel conversations={conversations} />
  </>
}

function deriveMetrics(c: Conversation) {
  const appetiteMap = { good: { value: 'Healthy appetite', score: 90 }, fair: { value: 'A little lower', score: 72 }, low: { value: 'Lower than usual', score: 60 } }
  const a = appetiteMap[c.nutrition.appetite]
  const paceDelta = 100 - c.vocal.speechPace
  const hydrationScore = Math.min(100, Math.round((c.hydration.glasses / c.hydration.target) * 100))
  return {
    nutrition: { value: a.value, detail: c.nutrition.skippedMeals.length ? `skipped ${c.nutrition.skippedMeals.join(', ')}` : `${c.nutrition.meals.join(', ') || 'few meals'} mentioned`, score: String(a.score) },
    voice: { value: Math.abs(paceDelta) >= 5 ? `Slightly ${paceDelta > 0 ? 'quieter' : 'brighter'}` : 'Close to baseline', detail: `pace ${c.vocal.speechPace}% · energy ${c.vocal.vocalEnergy}%`, score: String(Math.round((c.vocal.vocalEnergy + c.vocal.engagement) / 2)) },
    hydration: { value: c.hydration.glasses < c.hydration.target ? 'A little low' : 'Looking good', detail: `${c.hydration.glasses} of ${c.hydration.target} glasses mentioned`, score: String(hydrationScore) },
    medication: { value: c.medication.missed.length ? 'Needs a check' : 'All on track', detail: c.medication.missed.length ? `${c.medication.missed.join(', ')} not confirmed` : `${c.medication.confirmed.join(', ') || 'medication'} confirmed`, score: c.medication.missed.length ? '55' : '100' },
  }
}

function conversationTags(c: Conversation): string[] {
  const tags: string[] = []
  tags.push(c.vocal.emotionalTone >= 100 ? 'Cheerful' : 'Settled')
  tags.push(c.vocal.engagement >= 100 ? 'Engaged' : 'Quieter')
  if (c.nutrition.meals.length) tags.push(c.nutrition.meals[0])
  return tags.slice(0, 3)
}

function Metric({ tone, title, value, detail, badge }: { tone: string; title: string; value: string; detail: string; badge: string }) {
  const n = Number(badge)
  const scoreTone = n >= 85 ? 'good' : n >= 68 ? 'amber' : 'low'
  return <article className="metric"><div className={`metric-icon ${tone}`}>+</div><div className="metric-top"><p>{title}</p><span className={`score ${scoreTone}`}>{badge}</span></div><h3>{value}</h3><small>{detail}</small></article>
}

function SignalCard({ signal }: { signal: HealthSignal }) {
  const [open, setOpen] = useState(false)
  return <div className="signal">
    <span className={`signal-dot ${signal.tone}`} />
    <div className="signal-main">
      <div className="signal-head"><h3>{signal.title}</h3><span className="confidence">{signal.confidence}% confidence</span></div>
      <p>{signal.observation}</p>
      <button className="signal-toggle" onClick={() => setOpen(o => !o)}>{open ? 'Hide detail' : 'Why we noticed this'} {open ? '▲' : '▼'}</button>
      {open && <div className="signal-detail"><p><b>Supporting evidence.</b> {signal.evidence}</p><p><b>Reason for generation.</b> {signal.reason}</p><small>Compared with {PARENT.shortName}’s own baseline. An observation, not a diagnosis.</small></div>}
    </div>
    <span className={`signal-cat ${signal.tone}`}>{signal.category}</span>
  </div>
}

// --------------------------------------------------------------------------

function TrendPanel({ conversations }: { conversations: Conversation[] }) {
  const [range, setRange] = useState('7 days')
  const n = range === '7 days' ? 7 : range === '14 days' ? 14 : 30
  const series = useMemo(() => [...conversations].slice(0, n).reverse(), [conversations, n])
  const { path, area, last } = buildChart(series.map(c => c.wellbeingScore))
  const dip = series.length > 1 && series[series.length - 1].wellbeingScore < series[0].wellbeingScore
  return <section className="panel trend-panel"><div className="panel-title"><div><p className="eyebrow">WELLBEING TRENDS</p><h2>Small changes, over time</h2></div><div className="ranges">{['7 days', '14 days', '30 days'].map(r => <button key={r} onClick={() => setRange(r)} className={range === r ? 'selected' : ''}>{r}</button>)}</div></div>
    <div className="chart-labels"><span>Overall wellbeing</span><span>Selected period: {range}</span></div>
    <div className="chart"><div className="ylabels"><span>100</span><span>75</span><span>50</span><span>25</span></div><svg viewBox="0 0 700 190" preserveAspectRatio="none"><defs><linearGradient id="area" x1="0" x2="0" y1="0" y2="1"><stop stopColor="#8c75c8" stopOpacity=".25" /><stop offset="1" stopColor="#8c75c8" stopOpacity="0" /></linearGradient></defs><path d={area} fill="url(#area)" /><path d={path} fill="none" stroke="#8065b9" strokeWidth="3" /><circle cx={last.x} cy={last.y} r="5" fill="#8065b9" /></svg><div className="xlabels">{series.map((c, i) => <span key={c.id}>{shortDay(c.date, i)}</span>)}</div></div>
    <div className="chart-note"><span>{dip ? '-' : '+'}</span><div><b>{dip ? 'A gentle dip this period' : 'Holding steady'}</b><p>Mostly related to appetite and hydration. We’ll keep watching together.</p></div></div>
  </section>
}

function buildChart(values: number[]) {
  if (!values.length) return { path: '', area: '', last: { x: 700, y: 95 } }
  const w = 700, h = 154
  const step = values.length > 1 ? w / (values.length - 1) : 0
  const pts = values.map((v, i) => ({ x: Math.round(i * step), y: Math.round(h - (v / 100) * h) }))
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join(' ')
  const area = `${line} L${pts[pts.length - 1].x} 190 L${pts[0].x} 190 Z`
  return { path: line, area, last: pts[pts.length - 1] }
}

function shortDay(iso: string, i: number) {
  const d = new Date(iso)
  // Pin to UTC so the label is identical on the server and the client — the
  // seed dates are date-only ISO strings, and a local timezone would otherwise
  // shift the weekday and trigger a React hydration mismatch.
  return isNaN(d.getTime()) ? `#${i + 1}` : d.toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' })
}

// --------------------------------------------------------------------------

function ConversationsView({ conversations, openCall }: { conversations: Conversation[]; openCall: () => void }) {
  const [selected, setSelected] = useState(conversations[0]?.id)
  const active = conversations.find(c => c.id === selected) || conversations[0]
  return <section className="section-view convo-view">
    <article className="panel view-lead"><p className="eyebrow">{PARENT.name.toUpperCase()}’S CALL HISTORY</p><h2>Recent conversations</h2><p>Every completed call is stored privately with its transcript, extractions and AI signals. Select one to read it back.</p><button className="checkin" onClick={openCall}>📞 Call Parent</button></article>
    <div className="convo-grid">
      <article className="panel convo-list">{conversations.map(c => <button key={c.id} onClick={() => setSelected(c.id)} className={`convo-row ${c.id === selected ? 'sel' : ''}`}><div><b>{c.label}</b><small>{c.durationMin} min · wellbeing {c.wellbeingScore}</small></div><span className={`risk-dot ${c.riskLevel.toLowerCase()}`} /></button>)}</article>
      {active && <article className="panel convo-detail"><div className="panel-title"><div><p className="eyebrow">TRANSCRIPT · {active.label.toUpperCase()}</p><h2>{active.durationMin} minute conversation</h2></div><span className={`risk-pill ${active.riskLevel.toLowerCase()}`}>{active.riskLevel}</span></div>
        <p className="summary-text small">{active.summary}</p>
        <div className="transcript-scroll">{active.transcript.map((l, i) => <p key={i} className={l.speaker === PARENT.name.split(' ')[0] ? 'them' : 'you'}><b>{l.speaker}</b> {l.text}</p>)}</div>
        <div className="signal-chips">{active.signals.map((s, i) => <span key={i} className={`chip ${s.tone}`}>{s.category}: {s.title}</span>)}</div>
      </article>}
    </div>
  </section>
}

// --------------------------------------------------------------------------

function AIChat({ conversations }: { conversations: Conversation[] }) {
  const [messages, setMessages] = useState<{ role: 'user' | 'ai'; text: string }[]>([
    { role: 'ai', text: `Hi. I can answer questions from your ${conversations.length} recorded calls with ${PARENT.shortName} — her eating, hydration, medication, speech and how things are trending. What would you like to know?` },
  ])
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, thinking])

  const ask = async (question: string) => {
    if (!question.trim() || thinking) return
    setMessages(prev => [...prev, { role: 'user', text: question }])
    setInput('')
    setThinking(true)
    const answer = await chatAsk(question, conversations)
    setMessages(prev => [...prev, { role: 'ai', text: answer }])
    setThinking(false)
  }

  return <section className="section-view chat-view">
    <article className="panel chat-panel">
      <div className="panel-title"><div><p className="eyebrow">AI CHAT</p><h2>Ask about {PARENT.shortName}</h2></div></div>
      <div className="chat-thread">
        {messages.map((m, i) => <div key={i} className={`bubble ${m.role}`}>{m.text}</div>)}
        {thinking && <div className="bubble ai typing-bubble"><i /><i /><i /></div>}
        <div ref={endRef} />
      </div>
      <div className="chat-suggestions">{SUGGESTED_QUESTIONS.map(q => <button key={q} onClick={() => ask(q)} disabled={thinking}>{q}</button>)}</div>
      <form className="chat-input" onSubmit={e => { e.preventDefault(); ask(input) }}>
        <input value={input} onChange={e => setInput(e.target.value)} placeholder={`Ask about ${PARENT.shortName}’s week…`} />
        <button type="submit" disabled={thinking}>{thinking ? '…' : 'Ask'}</button>
      </form>
      <small className="chat-note">Answers reference stored conversations, trends and AI observations. Not medical advice.</small>
    </article>
  </section>
}

// --------------------------------------------------------------------------

function NutritionView({ latest }: { latest: Conversation }) {
  const recs = mealRoasterRecommendations(toMealRoasterRequest(latest))
  return <section className="section-view">
    <article className="panel view-lead"><p className="eyebrow">FOOD &amp; HYDRATION</p><h2>Nutrition intelligence</h2><p>Drawn from what {PARENT.shortName} mentioned during recent calls.</p>
      <div className="fact-grid">
        <div><small>Appetite</small><b>{latest.nutrition.appetite}</b></div>
        <div><small>Meals mentioned</small><b>{latest.nutrition.meals.join(', ') || '—'}</b></div>
        <div><small>Hydration</small><b>{latest.hydration.glasses}/{latest.hydration.target} glasses</b></div>
        <div><small>Protein</small><b>{latest.nutrition.proteinNote}</b></div>
        <div><small>Skipped</small><b>{latest.nutrition.skippedMeals.join(', ') || 'none'}</b></div>
        <div><small>Weight</small><b>{latest.nutrition.weightNote}</b></div>
      </div>
    </article>
    <article className="panel mealroaster"><div className="panel-title"><div><p className="eyebrow">MEALROASTER · PERSONALISED IDEAS</p><h2>Gentle meal suggestions</h2></div><span className="chip blue">Preview integration</span></div>
      {recs.map((r, i) => <div className="meal-rec" key={i}><span className="meal-num">{i + 1}</span><div><b>{r.meal}</b><p>{r.why}</p></div></div>)}
      <small className="chat-note">Sentinel’s structured nutrition signals are ready to drive personalised plans once MealRoaster is connected.</small>
    </article>
  </section>
}

// --------------------------------------------------------------------------

function MedicationsView({ conversations }: { conversations: Conversation[] }) {
  const week = conversations.slice(0, 7)
  const confirmedDays = week.filter(c => c.medication.confirmed.length && !c.medication.missed.length).length
  const latest = conversations[0]
  return <section className="section-view">
    <article className="panel view-lead"><p className="eyebrow">MEDICATION ANALYSIS</p><h2>Medication routine</h2><p>Practical observations from confirmed conversation details — never a substitute for medical guidance.</p>
      <div className="fact-grid">
        <div><small>Adherence (7 calls)</small><b>{confirmedDays}/{week.length} confirmed</b></div>
        <div><small>Latest</small><b>{latest.medication.confirmed.join(', ') || 'not confirmed'}</b></div>
        <div><small>Timing</small><b>{latest.medication.timingNote}</b></div>
        <div><small>Supplements</small><b>{latest.medication.supplements.join(', ') || 'none mentioned'}</b></div>
      </div>
    </article>
    <article className="panel view-list">{week.map(c => <div className="view-item" key={c.id}><span className={`view-number ${c.medication.missed.length ? 'n3' : 'n2'}`}>{c.medication.missed.length ? '!' : '✓'}</span><span><b>{c.label}</b> — {c.medication.missed.length ? `${c.medication.missed.join(', ')} not confirmed` : `${c.medication.confirmed.join(', ') || 'medication'} confirmed`}</span></div>)}</article>
  </section>
}

// --------------------------------------------------------------------------

function TrendsView({ conversations }: { conversations: Conversation[] }) {
  return <section className="section-view">
    <article className="panel view-lead"><p className="eyebrow">PATTERNS OVER TIME</p><h2>Trends</h2><p>Sentinel focuses on meaningful changes rather than day-to-day fluctuations.</p></article>
    <TrendPanel conversations={conversations} />
    <article className="panel"><div className="panel-title"><div><p className="eyebrow">VOCAL BIOMARKERS</p><h2>Voice vs baseline</h2></div></div>
      <div className="fact-grid">{Object.entries(conversations[0].vocal).map(([k, v]) => <div key={k}><small>{k.replace(/([A-Z])/g, ' $1')}</small><b className={v < 95 ? 'below' : v > 105 ? 'above' : ''}>{v}%</b></div>)}</div>
      <small className="chat-note">Each value is a percentage of {PARENT.shortName}’s own historical baseline (100% = on baseline).</small>
    </article>
  </section>
}

// --------------------------------------------------------------------------

function SettingsView({ tab, parents, onChange }: { tab: string; parents: Parent[]; onChange: (next: Parent[]) => void }) {
  if (tab === 'Settings') return <section className="section-view"><ParentsSettings parents={parents} onChange={onChange} /></section>
  const items = ['How Sentinel listens during calls', 'Privacy & data storage', 'Contact support']
  return <section className="section-view"><article className="panel view-lead"><p className="eyebrow">SENTINEL</p><h2>{tab}</h2><p>Manage your Sentinel experience.</p></article><article className="panel view-list">{items.map((line, i) => <button className="view-item" key={line}><span className={`view-number n${(i % 3) + 1}`}>{i + 1}</span><span>{line}</span><b>&gt;</b></button>)}</article></section>
}

function ParentsSettings({ parents, onChange }: { parents: Parent[]; onChange: (next: Parent[]) => void }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')

  const add = () => {
    const trimmed = name.trim()
    const p = normalisePhone(phone)
    if (!trimmed) { setError('Add a name.'); return }
    if (!isValidPhone(p)) { setError('Enter a phone number in international format, e.g. +447700900123.'); return }
    onChange([...parents, { id: newParentId(), name: trimmed, phone: p }])
    setName(''); setPhone(''); setError('')
  }
  const remove = (id: string) => onChange(parents.filter(p => p.id !== id))
  const setPhoneFor = (id: string, value: string) => onChange(parents.map(p => p.id === id ? { ...p, phone: normalisePhone(value) } : p))

  return <>
    <article className="panel view-lead">
      <p className="eyebrow">SETTINGS</p><h2>Parents &amp; phone numbers</h2>
      <p>Add the people you check on and the phone number Sentinel should call. You can add more than one. Numbers are stored on this device and used to place the call — you talk through the app, so you don’t need a phone.</p>
    </article>
    <article className="panel">
      <div className="panel-title"><div><p className="eyebrow">YOUR PARENTS</p><h2>{parents.length} saved</h2></div></div>
      <div className="parent-list">
        {parents.map(p => <div className="parent-row" key={p.id}>
          <div className="parent-avatar">{(p.name[0] || '?').toUpperCase()}</div>
          <div className="parent-meta"><b>{p.name}</b><input className="parent-phone-input" value={p.phone} placeholder="+44 7700 900123" onChange={e => setPhoneFor(p.id, e.target.value)} aria-label={`Phone number for ${p.name}`} /></div>
          <div className="parent-tag">{isValidPhone(p.phone) ? <span className="ok">Callable</span> : <span className="warn">No number</span>}</div>
          <button className="parent-remove" onClick={() => remove(p.id)} disabled={parents.length <= 1} aria-label={`Remove ${p.name}`}>Remove</button>
        </div>)}
      </div>
    </article>
    <article className="panel">
      <div className="panel-title"><div><p className="eyebrow">ADD A PARENT</p><h2>New contact</h2></div></div>
      <div className="parent-add">
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Name (e.g. Dad)" aria-label="Parent name" />
        <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone, e.g. +447700900123" aria-label="Parent phone number" />
        <button onClick={add}>Add parent</button>
      </div>
      {error && <p className="parent-error">{error}</p>}
      <small className="chat-note">International format (starts with +). Numbers never leave this device except to place the call.</small>
    </article>
  </>
}

// --------------------------------------------------------------------------

const PROCESS_STEPS = ['Transcript completed', 'Nutrition extracted', 'Medication analysed', 'Vocal biomarkers generated', 'Health signals detected', 'Caregiver summary created']

function FamilyCall({ state, mode, seconds, pending, error, parents, selectedParentId, selectedParent, onSelectParent, onBegin, onEnd, onClose }: { state: CallState; mode: CallMode; seconds: number; pending: Conversation; error: string | null; parents: Parent[]; selectedParentId: string; selectedParent: Parent | undefined; onSelectParent: (id: string) => void; onBegin: () => void; onEnd: () => void; onClose: () => void }) {
  const time = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
  // Simulated mode: reveal the transcript progressively as the "call" unfolds.
  const shown = Math.min(pending.transcript.length, Math.floor(seconds / 2) + 1)
  const [step, setStep] = useState(0)
  useEffect(() => {
    if (state !== 'processing') { setStep(0); return }
    const t = window.setInterval(() => setStep(s => Math.min(PROCESS_STEPS.length, s + 1)), 480)
    return () => window.clearInterval(t)
  }, [state])

  const parentName = selectedParent?.name ?? PARENT.name
  const parentPhone = selectedParent?.phone?.trim()
  const hasNumber = !!parentPhone

  const eyebrow = state === 'connecting' ? 'PLACING YOUR CALL'
    : state === 'live' ? 'FAMILY CALL IN PROGRESS'
    : state === 'processing' ? 'ANALYSING CONVERSATION' : 'AI-ASSISTED FAMILY CALL'
  const heading = state === 'ready' ? `Call ${parentName}`
    : state === 'connecting' ? 'Connecting…'
    : state === 'live' ? parentName : 'Analysing your conversation'

  return <div className="call-backdrop" role="dialog" aria-modal="true"><section className="call-modal family-call">
    {state !== 'processing' && <button className="modal-close" onClick={onClose} aria-label="Close">x</button>}
    <div className="call-avatar">{(parentName[0] || 'P').toUpperCase()}</div>
    <p className="eyebrow">{eyebrow}</p>
    <h2>{heading}</h2>

    {state === 'ready' && <>
      {parents.length > 1 && <select className="parent-select" value={selectedParentId} onChange={e => onSelectParent(e.target.value)} aria-label="Choose who to call">{parents.map(p => <option key={p.id} value={p.id}>{p.name}{p.phone ? ` · ${p.phone}` : ' · no number'}</option>)}</select>}
      <p className="phone-number">{hasNumber ? parentPhone : 'No number set'}</p>
      <p className="call-copy">You start the call and talk through the app; {parentName} answers on their normal phone — nothing to install. Sentinel just listens in and turns the conversation into gentle wellbeing signals after you hang up. It never calls on its own.</p>
      {!hasNumber && <p className="call-hint">No phone number for {parentName} yet — this will run a simulated call. Add a number in Settings to place a real one.</p>}
    </>}

    {state === 'connecting' && <><p className="phone-number">{parentPhone}</p><div className="call-spinner" aria-hidden="true"><i /></div><p className="call-copy">Connecting to {parentName}. Allow microphone access if your browser asks.</p></>}

    {/* Simulated live call: no telephony configured / no number. */}
    {state === 'live' && mode === 'sim' && <>
      <p className="phone-number">{hasNumber ? parentPhone : 'Simulated call'}</p>
      <div className="call-timer">LIVE {time} <span>AI LISTENING</span></div>
      <div className="call-transcript">{pending.transcript.slice(0, shown).map((l, i) => <p key={i}><b>{l.speaker}</b> {l.text}</p>)}{shown < pending.transcript.length && <p className="typing"><i /><i /><i /></p>}</div>
      <div className="listening-status"><span>✓ Nutrition</span><span>✓ Medication</span><span>✓ Vocal biomarkers</span><span>✓ Hydration</span></div>
    </>}

    {/* Real Twilio call in progress: you talk in the browser, we record. */}
    {state === 'live' && mode === 'twilio' && <>
      <p className="phone-number">{parentPhone}</p>
      <div className="call-timer">ON CALL {time} <span>RECORDING</span></div>
      <div className="call-live-note"><div className="call-spinner"><i /></div><p>You’re connected to {parentName} and the call is recording. Talk naturally — when you press End, Sentinel transcribes the recording with OpenAI and updates the dashboard.</p></div>
      <div className="listening-status"><span>✓ Nutrition</span><span>✓ Medication</span><span>✓ Vocal biomarkers</span><span>✓ Hydration</span></div>
    </>}

    {state === 'processing' && <>
      {error && <p className="call-error">{error} Showing the best analysis Sentinel could produce.</p>}
      <div className="processing-list">{PROCESS_STEPS.map((label, i) => <p key={label} className={i < step ? 'done' : ''}>{label} <b>{i < step ? '✓' : '…'}</b></p>)}</div>
    </>}

    <div className="call-actions">
      {state === 'ready' && <button className="begin-call" onClick={onBegin}>📞 Call {parentName.split(' ')[0]}</button>}
      {state === 'live' && <button className="end-call" onClick={onEnd}>End call</button>}
    </div>
    {(state === 'ready' || state === 'connecting') && <small className="call-note">You place the call from the app and speak through it — Sentinel never calls on its own. With Twilio configured this is a real call; without it, a simulated call lets you explore the flow.</small>}
  </section></div>
}
