// Sentinel — AI-assisted family call domain model & analysis.
//
// Sentinel never calls on its own and never replaces hearing a loved one's
// voice — that connection is part of care. A family member starts the call
// themselves (through the app, over a provider such as Twilio); Sentinel just
// listens in, transcribes, and turns the conversation the family was already
// having into gentle wellbeing feedback. It observes and analyses — it never
// diagnoses.
//
// Every completed call is stored as a structured `Conversation` (see below),
// which is what the dashboard, trends and AI chat all read from. The shape is
// intentionally MealRoaster-friendly: `nutrition` carries enough detail for
// `mealRoasterRecommendations()` to later drive personalised meal plans.

export type RiskLevel = 'Green' | 'Amber' | 'Red'
export type SignalTone = 'green' | 'amber' | 'red' | 'purple' | 'blue'

/** A single AI observation. Never a diagnosis — always an observation with its
 *  own confidence, the evidence behind it, and why Sentinel surfaced it. */
export interface HealthSignal {
  category: 'Nutrition' | 'Hydration' | 'Medication' | 'Voice' | 'Overall'
  title: string
  observation: string
  confidence: number // 0–100
  evidence: string // supporting evidence drawn from the conversation / trend
  reason: string // why this signal was generated
  tone: SignalTone
}

export interface NutritionExtraction {
  meals: string[]
  snacks: string[]
  drinks: string[]
  appetite: 'good' | 'fair' | 'low'
  hydrationGlasses: number
  proteinNote: string
  weightNote: string
  skippedMeals: string[]
}

export interface MedicationExtraction {
  mentioned: string[]
  confirmed: string[]
  missed: string[]
  supplements: string[]
  timingNote: string
}

/** Vocal biomarkers, each expressed as % of the parent's own historical
 *  baseline (100 = exactly on baseline). Comparisons are personal, never
 *  population-based. */
export interface VocalBiomarkers {
  speechPace: number
  vocalEnergy: number
  confidence: number
  hesitation: number
  clarity: number
  emotionalTone: number
  engagement: number
  responseLatency: number
}

export interface TranscriptLine {
  speaker: string
  text: string
}

export interface Conversation {
  id: string
  date: string // ISO date
  label: string // human friendly, e.g. "Today, 9:42 am"
  durationMin: number
  transcript: TranscriptLine[]
  nutrition: NutritionExtraction
  medication: MedicationExtraction
  hydration: { glasses: number; target: number; note: string }
  vocal: VocalBiomarkers
  signals: HealthSignal[]
  summary: string
  wellbeingScore: number // 0–100
  riskLevel: RiskLevel
}

export const PARENT = {
  name: 'Eleanor Wilson',
  shortName: 'Eleanor',
  initial: 'E',
  phone: '+44 7700 900 412',
}

// The person using the app is simply someone checking on their parent — no
// name, no "caregiver" label. Their voice appears in transcripts as "You".
export const CAREGIVER = { label: 'You', initial: '·', speaker: 'You' }

/** The parent's personal baseline. Vocal biomarkers on each call are compared
 *  against this rather than against any population norm. */
export const BASELINE = {
  hydrationTarget: 6,
  vocalEnergy: 100,
  speechPace: 100,
  appetite: 'good' as const,
}

// ---------------------------------------------------------------------------
// Seed history — a few past calls so trends, recent-calls and AI chat have
// something to reason over on first load. Newest first.
// ---------------------------------------------------------------------------

export const seedHistory: Conversation[] = [
  {
    id: 'c-2026-07-24',
    date: '2026-07-24',
    label: 'Yesterday, 9:38 am',
    durationMin: 9,
    transcript: [
      { speaker: 'You', text: 'Morning, how did you sleep?' },
      { speaker: 'Eleanor', text: 'Not too bad love. I had some toast, but I wasn’t very hungry at teatime.' },
      { speaker: 'You', text: 'Did you manage your morning tablets?' },
      { speaker: 'Eleanor', text: 'Yes, took them with my tea as always.' },
    ],
    nutrition: { meals: ['toast'], snacks: [], drinks: ['tea'], appetite: 'low', hydrationGlasses: 4, proteinNote: 'Low protein day', weightNote: 'Stable', skippedMeals: ['dinner'] },
    medication: { mentioned: ['morning tablets'], confirmed: ['morning tablets'], missed: [], supplements: [], timingNote: 'Taken with tea, on time' },
    hydration: { glasses: 4, target: 6, note: 'Below usual' },
    vocal: { speechPace: 94, vocalEnergy: 96, confidence: 97, hesitation: 104, clarity: 99, emotionalTone: 98, engagement: 95, responseLatency: 106 },
    signals: [],
    summary: 'A short, warm call. Eleanor confirmed her morning medication but mentioned a low appetite at teatime and skipped dinner.',
    wellbeingScore: 74,
    riskLevel: 'Amber',
  },
  {
    id: 'c-2026-07-22',
    date: '2026-07-22',
    label: 'Tuesday, 9:45 am',
    durationMin: 7,
    transcript: [
      { speaker: 'You', text: 'Hiya, what have you been up to?' },
      { speaker: 'Eleanor', text: 'Been out in the garden with the daffodils. Had a nice bowl of soup for lunch.' },
      { speaker: 'You', text: 'Lovely. Drinking plenty?' },
      { speaker: 'Eleanor', text: 'I’ve had a few glasses of water today, feeling good.' },
    ],
    nutrition: { meals: ['soup'], snacks: ['biscuit'], drinks: ['water', 'tea'], appetite: 'fair', hydrationGlasses: 6, proteinNote: 'Moderate', weightNote: 'Stable', skippedMeals: [] },
    medication: { mentioned: ['morning tablets'], confirmed: ['morning tablets'], missed: [], supplements: ['vitamin D'], timingNote: 'On time' },
    hydration: { glasses: 6, target: 6, note: 'On target' },
    vocal: { speechPace: 99, vocalEnergy: 101, confidence: 100, hesitation: 98, clarity: 101, emotionalTone: 103, engagement: 104, responseLatency: 97 },
    signals: [],
    summary: 'A cheerful, engaged call. Eleanor was active in the garden, ate soup for lunch and hydration was on target.',
    wellbeingScore: 88,
    riskLevel: 'Green',
  },
  {
    id: 'c-2026-07-20',
    date: '2026-07-20',
    label: 'Sunday, 9:40 am',
    durationMin: 8,
    transcript: [
      { speaker: 'You', text: 'Morning.' },
      { speaker: 'Eleanor', text: 'Morning. I had porridge and a boiled egg, felt quite peckish today.' },
      { speaker: 'You', text: 'That’s great. Tablets done?' },
      { speaker: 'Eleanor', text: 'All done, and I had my water bottle by me all morning.' },
    ],
    nutrition: { meals: ['porridge', 'boiled egg'], snacks: ['fruit'], drinks: ['water', 'tea'], appetite: 'good', hydrationGlasses: 7, proteinNote: 'Good protein (egg)', weightNote: 'Stable', skippedMeals: [] },
    medication: { mentioned: ['morning tablets'], confirmed: ['morning tablets'], missed: [], supplements: ['vitamin D'], timingNote: 'On time' },
    hydration: { glasses: 7, target: 6, note: 'Above target' },
    vocal: { speechPace: 101, vocalEnergy: 103, confidence: 102, hesitation: 96, clarity: 102, emotionalTone: 104, engagement: 105, responseLatency: 95 },
    signals: [],
    summary: 'A bright, energetic call. Good appetite with a protein-rich breakfast and hydration above target.',
    wellbeingScore: 91,
    riskLevel: 'Green',
  },
]

// ---------------------------------------------------------------------------
// Analysis — turn a raw conversation (transcript + extractions) into signals,
// a wellbeing score and a natural-language caregiver summary.
// ---------------------------------------------------------------------------

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)))

/** Generate AI health signals by comparing this conversation to the parent's
 *  own recent history. Observations only — never diagnoses. */
export function generateSignals(
  current: Omit<Conversation, 'signals' | 'summary' | 'wellbeingScore' | 'riskLevel'>,
  history: Conversation[],
): HealthSignal[] {
  const signals: HealthSignal[] = []
  const recent = history.slice(0, 3)

  // Nutrition — consecutive low-appetite days.
  const lowStreak = 1 + recent.filter(c => c.nutrition.appetite === 'low').length
  if (current.nutrition.appetite === 'low') {
    signals.push({
      category: 'Nutrition',
      title: lowStreak > 1 ? `Appetite lower for ${lowStreak} consecutive days` : 'Appetite lower than usual',
      observation: current.nutrition.skippedMeals.length
        ? `${PARENT.shortName} skipped ${current.nutrition.skippedMeals.join(', ')} today.`
        : `${PARENT.shortName} ate less than her usual amount today.`,
      confidence: clamp(70 + lowStreak * 6),
      evidence: `Meals mentioned: ${current.nutrition.meals.join(', ') || 'few'}. Skipped: ${current.nutrition.skippedMeals.join(', ') || 'none'}.`,
      reason: 'Appetite was below her baseline and this continues a recent pattern of smaller meals.',
      tone: lowStreak > 1 ? 'amber' : 'blue',
    })
  }

  // Hydration — below personal target.
  if (current.hydration.glasses < current.hydration.target) {
    const gap = current.hydration.target - current.hydration.glasses
    signals.push({
      category: 'Hydration',
      title: 'Estimated fluid intake below target',
      observation: `About ${current.hydration.glasses} of ~${current.hydration.target} glasses mentioned today.`,
      confidence: clamp(58 + gap * 8),
      evidence: `Drinks mentioned: ${current.nutrition.drinks.join(', ') || 'few'}.`,
      reason: 'Hydration cues in the conversation were fewer than her typical daily pattern.',
      tone: gap >= 3 ? 'amber' : 'blue',
    })
  } else {
    signals.push({
      category: 'Hydration',
      title: 'Hydration on track',
      observation: `Around ${current.hydration.glasses} glasses mentioned — on or above target.`,
      confidence: 82,
      evidence: `Drinks mentioned: ${current.nutrition.drinks.join(', ') || 'water'}.`,
      reason: 'Hydration cues met her personal daily target.',
      tone: 'green',
    })
  }

  // Medication — confirmation or a possible miss.
  if (current.medication.missed.length) {
    signals.push({
      category: 'Medication',
      title: 'Possible missed medication',
      observation: `${PARENT.shortName} did not confirm ${current.medication.missed.join(', ')}.`,
      confidence: 72,
      evidence: `Mentioned: ${current.medication.mentioned.join(', ') || 'none'}. Confirmed: ${current.medication.confirmed.join(', ') || 'none'}.`,
      reason: 'Expected medication was not clearly confirmed during the conversation.',
      tone: 'red',
    })
  } else if (current.medication.confirmed.length) {
    signals.push({
      category: 'Medication',
      title: `${current.medication.confirmed[0][0].toUpperCase()}${current.medication.confirmed[0].slice(1)} confirmed`,
      observation: `${PARENT.shortName} confirmed taking her ${current.medication.confirmed.join(', ')}.`,
      confidence: 94,
      evidence: current.medication.timingNote,
      reason: 'Medication was explicitly confirmed in the conversation.',
      tone: 'green',
    })
  }

  // Voice — speech pace vs baseline.
  const paceDelta = 100 - current.vocal.speechPace
  if (Math.abs(paceDelta) >= 5) {
    signals.push({
      category: 'Voice',
      title: `Speech pace ${paceDelta > 0 ? paceDelta + '% slower' : Math.abs(paceDelta) + '% faster'} than baseline`,
      observation: `Vocal energy remained ${current.vocal.vocalEnergy >= 98 ? 'stable' : 'slightly lower'}.`,
      confidence: clamp(60 + Math.abs(paceDelta) * 2),
      evidence: `Speech pace ${current.vocal.speechPace}%, vocal energy ${current.vocal.vocalEnergy}%, engagement ${current.vocal.engagement}% of baseline.`,
      reason: 'Speech pace moved beyond the normal day-to-day range around her baseline.',
      tone: paceDelta >= 10 ? 'amber' : 'purple',
    })
  }

  // Overall — wellbeing status change.
  const prev = history[0]
  const score = scoreWellbeing(current)
  if (prev) {
    const prevLevel = prev.riskLevel
    const level = riskFromScore(score)
    if (level !== prevLevel) {
      signals.push({
        category: 'Overall',
        title: `Wellbeing status changed from ${prevLevel} to ${level}`,
        observation: `Overall wellbeing score is ${score}.`,
        confidence: 76,
        evidence: `Previous score ${prev.wellbeingScore} (${prevLevel}) → ${score} (${level}).`,
        reason: 'The combined nutrition, hydration, medication and voice signals shifted the overall band.',
        tone: level === 'Green' ? 'green' : level === 'Amber' ? 'amber' : 'red',
      })
    }
  }

  return signals
}

export function scoreWellbeing(c: Pick<Conversation, 'nutrition' | 'hydration' | 'medication' | 'vocal'>): number {
  const appetite = c.nutrition.appetite === 'good' ? 100 : c.nutrition.appetite === 'fair' ? 78 : 58
  const hydration = clamp((c.hydration.glasses / c.hydration.target) * 100)
  const meds = c.medication.missed.length ? 55 : c.medication.confirmed.length ? 100 : 80
  const voice = clamp((c.vocal.vocalEnergy + c.vocal.engagement + c.vocal.speechPace) / 3)
  return clamp(appetite * 0.3 + hydration * 0.2 + meds * 0.2 + voice * 0.3)
}

export function riskFromScore(score: number): RiskLevel {
  return score >= 85 ? 'Green' : score >= 68 ? 'Amber' : 'Red'
}

/** Compose the natural-language caregiver summary. */
export function buildSummary(c: Omit<Conversation, 'signals' | 'summary' | 'wellbeingScore' | 'riskLevel'>): string {
  const mood = c.vocal.emotionalTone >= 100 && c.vocal.engagement >= 100 ? 'cheerful and engaged' : c.vocal.emotionalTone >= 96 ? 'settled and warm' : 'a little quieter than usual'
  const ate = c.nutrition.meals.length ? `She mentioned eating ${c.nutrition.meals.join(' and ')}` : 'She didn’t mention eating much'
  const skipped = c.nutrition.skippedMeals.length ? ` but skipped ${c.nutrition.skippedMeals.join(', ')}` : ''
  const hydration = c.hydration.glasses < c.hydration.target ? 'Hydration appeared lower than usual.' : 'Hydration looked on track.'
  const med = c.medication.missed.length ? `${c.medication.missed.join(', ')} was not confirmed.` : c.medication.confirmed.length ? `${c.medication.confirmed[0][0].toUpperCase()}${c.medication.confirmed[0].slice(1)} was confirmed.` : ''
  const paceDelta = 100 - c.vocal.speechPace
  const voice = Math.abs(paceDelta) >= 5
    ? `Speech pace was slightly ${paceDelta > 0 ? 'slower' : 'faster'} than her normal baseline, although vocal energy remained ${c.vocal.vocalEnergy >= 98 ? 'stable' : 'a touch lower'}.`
    : 'Her voice sounded steady and close to her usual baseline.'
  const rec = recommend(c)
  return `Today's conversation lasted ${c.durationMin} minutes. ${PARENT.shortName} sounded ${mood}. ${ate}${skipped}. ${hydration} ${med} ${voice} ${rec}`.replace(/\s+/g, ' ').trim()
}

function recommend(c: Pick<Conversation, 'nutrition' | 'hydration'>): string {
  const parts: string[] = []
  if (c.nutrition.skippedMeals.length || c.nutrition.appetite === 'low') parts.push('encourage an evening meal')
  if (c.hydration.glasses < c.hydration.target) parts.push('remind her to drink more water tomorrow')
  return parts.length ? `Recommendation: ${parts.join(' and ')}.` : 'Recommendation: keep up the current routine.'
}

/** Assemble a full, stored Conversation record from raw extractions. This is
 *  what a completed live call produces and is persisted as structured JSON. */
export function finaliseConversation(
  raw: Omit<Conversation, 'signals' | 'summary' | 'wellbeingScore' | 'riskLevel'>,
  history: Conversation[],
): Conversation {
  const signals = generateSignals(raw, history)
  const wellbeingScore = scoreWellbeing(raw)
  return { ...raw, signals, summary: buildSummary(raw), wellbeingScore, riskLevel: riskFromScore(wellbeingScore) }
}

// ---------------------------------------------------------------------------
// A "today" call. The transcript is shown live; the extraction (nutrition,
// medication, hydration, vocal) is produced by OpenAI via /api/analyze and run
// through the same finalise() path. `fallbackExtraction` is known-good data
// used when the API key is missing or a call fails, so the demo never breaks.
// ---------------------------------------------------------------------------

/** Everything the AI analysis step is responsible for extracting from a call. */
export interface CallExtraction {
  nutrition: NutritionExtraction
  medication: MedicationExtraction
  hydration: { glasses: number; target: number; note: string }
  vocal: VocalBiomarkers
}

export const DEMO_CALL: { durationMin: number; transcript: TranscriptLine[]; fallbackExtraction: CallExtraction } = {
  durationMin: 11,
  transcript: [
    { speaker: 'You', text: 'Morning, how are you feeling today?' },
    { speaker: 'Eleanor', text: 'Hello love. I’m alright. I had some cereal for breakfast.' },
    { speaker: 'You', text: 'Lovely. Did you have any lunch?' },
    { speaker: 'Eleanor', text: 'I had a bit of soup, but I didn’t really fancy any dinner last night.' },
    { speaker: 'You', text: 'And your morning tablets?' },
    { speaker: 'Eleanor', text: 'Yes, took those with my tea first thing.' },
    { speaker: 'You', text: 'Have you been drinking enough water?' },
    { speaker: 'Eleanor', text: 'Ooh, maybe not so much today, I’ve been busy.' },
  ],
  fallbackExtraction: {
    nutrition: { meals: ['cereal', 'soup'], snacks: [], drinks: ['tea'], appetite: 'low', hydrationGlasses: 3, proteinNote: 'Low protein — encourage a protein snack', weightNote: 'Stable', skippedMeals: ['dinner'] },
    medication: { mentioned: ['morning tablets'], confirmed: ['morning tablets'], missed: [], supplements: [], timingNote: 'Taken with morning tea, on time' },
    hydration: { glasses: 3, target: 6, note: 'Lower than usual' },
    vocal: { speechPace: 88, vocalEnergy: 100, confidence: 98, hesitation: 106, clarity: 99, emotionalTone: 102, engagement: 101, responseLatency: 108 },
  },
}

/** Turn an AI (or fallback) extraction into a full, stored Conversation. */
export function finaliseFromExtraction(transcript: TranscriptLine[], durationMin: number, ex: CallExtraction, history: Conversation[]): Conversation {
  return finaliseConversation({
    id: `c-${Date.now()}`,
    date: new Date().toISOString().slice(0, 10),
    label: 'Today, just now',
    durationMin,
    transcript,
    nutrition: ex.nutrition,
    medication: ex.medication,
    hydration: ex.hydration,
    vocal: ex.vocal,
  }, history)
}

/** Synchronous demo call (no network) — used for the live transcript preview
 *  and as an immediate fallback. */
export function simulateTodaysCall(history: Conversation[]): Conversation {
  return finaliseFromExtraction(DEMO_CALL.transcript, DEMO_CALL.durationMin, DEMO_CALL.fallbackExtraction, history)
}

// ---------------------------------------------------------------------------
// Client helpers that call the OpenAI-backed API routes, each with a graceful
// fallback to the deterministic logic above so a missing key or a flaky
// network never breaks the demo.
// ---------------------------------------------------------------------------

export async function analyzeCall(
  history: Conversation[],
  opts?: { transcript?: TranscriptLine[]; durationMin?: number },
): Promise<{ conversation: Conversation; source: 'openai' | 'fallback' }> {
  const transcript = opts?.transcript?.length ? opts.transcript : DEMO_CALL.transcript
  const durationMin = opts?.durationMin ?? DEMO_CALL.durationMin
  try {
    const res = await fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ transcript, durationMin }) })
    if (!res.ok) throw new Error(`analyze ${res.status}`)
    const ex = (await res.json()) as CallExtraction
    return { conversation: finaliseFromExtraction(transcript, durationMin, ex, history), source: 'openai' }
  } catch {
    // Last-resort extraction (only accurate for the demo transcript, but keeps
    // the real transcript on the record).
    return { conversation: finaliseFromExtraction(transcript, durationMin, DEMO_CALL.fallbackExtraction, history), source: 'fallback' }
  }
}

// ---------------------------------------------------------------------------
// Real calls run through the browser Twilio Voice SDK (see lib/voiceCall.ts).
// Once a call ends, its recording is transcribed server-side; the client polls
// this endpoint for the result.
// ---------------------------------------------------------------------------

export interface CallStatusResult { status: 'pending' | 'ready' | 'error'; transcript?: TranscriptLine[]; durationMin?: number; error?: string }

export async function fetchCallStatus(callSid: string): Promise<CallStatusResult> {
  try {
    const res = await fetch(`/api/call/status?callSid=${encodeURIComponent(callSid)}`)
    if (!res.ok) return { status: 'error', error: `status ${res.status}` }
    return (await res.json()) as CallStatusResult
  } catch {
    return { status: 'error', error: 'network' }
  }
}

export async function chatAsk(question: string, conversations: Conversation[]): Promise<string> {
  try {
    const res = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question, conversations }) })
    if (!res.ok) throw new Error(`chat ${res.status}`)
    const data = await res.json()
    if (!data?.answer) throw new Error('no answer')
    return data.answer as string
  } catch {
    return answerQuestion(question, conversations)
  }
}

// ---------------------------------------------------------------------------
// AI Chat — answer caregiver questions from stored conversation history,
// trends and signals. Rule-based over the structured data (no diagnoses).
// ---------------------------------------------------------------------------

export function answerQuestion(question: string, history: Conversation[]): string {
  const q = question.toLowerCase()
  const week = history.slice(0, 7)
  const latest = history[0]
  if (!latest) return 'There are no recorded conversations yet. Start a family call and I’ll begin building a picture.'

  const has = (...k: string[]) => k.some(w => q.includes(w))

  if (has('eat', 'appetite', 'eating', 'food', 'meal', 'hungry')) {
    const lows = week.filter(c => c.nutrition.appetite === 'low').length
    const trend = lows >= 2 ? `appetite has been low on ${lows} of the last ${week.length} calls` : 'appetite has been mostly steady this week'
    const skipped = week.flatMap(c => c.nutrition.skippedMeals)
    return `Over the last ${week.length} conversations, ${PARENT.shortName}’s ${trend}. ${skipped.length ? `She’s skipped ${skipped.length} meal(s), most often ${mostCommon(skipped)}.` : 'No skipped meals were mentioned.'} Most recently she mentioned ${latest.nutrition.meals.join(', ') || 'little food'}.`
  }
  if (has('speech', 'voice', 'talk', 'sound', 'pace')) {
    const paces = week.map(c => c.vocal.speechPace)
    const avg = Math.round(paces.reduce((a, b) => a + b, 0) / paces.length)
    const delta = 100 - avg
    return `${PARENT.shortName}’s speech pace has averaged ${avg}% of her baseline this week (${delta > 0 ? delta + '% slower' : Math.abs(delta) + '% faster'}). On the latest call it was ${latest.vocal.speechPace}% with vocal energy at ${latest.vocal.vocalEnergy}%. These are observations compared with her own usual patterns, not a diagnosis.`
  }
  if (has('medication', 'tablet', 'pill', 'medicine', 'meds')) {
    const missed = week.filter(c => c.medication.missed.length).length
    return missed
      ? `Medication was not confirmed on ${missed} of the last ${week.length} calls. On the latest call: ${latest.medication.confirmed.length ? 'confirmed' : 'not confirmed'}.`
      : `${PARENT.shortName} has confirmed her medication on every one of the last ${week.length} calls, most recently her ${latest.medication.confirmed.join(', ') || 'morning tablets'} (${latest.medication.timingNote.toLowerCase()}).`
  }
  if (has('water', 'drink', 'hydrat', 'fluid')) {
    const avg = Math.round(week.reduce((a, c) => a + c.hydration.glasses, 0) / week.length)
    return `${PARENT.shortName} has averaged about ${avg} glasses a day this week against a target of ${latest.hydration.target}. The latest call suggested ${latest.hydration.glasses} — ${latest.hydration.glasses < latest.hydration.target ? 'a little below target, worth a gentle reminder.' : 'on target.'}`
  }
  if (has('last month', 'compared', 'change', 'trend', 'over time')) {
    const first = history[history.length - 1]
    const dir = latest.wellbeingScore > first.wellbeingScore ? 'improved' : latest.wellbeingScore < first.wellbeingScore ? 'dipped slightly' : 'held steady'
    return `Compared with the earliest recorded call (${first.wellbeingScore}), her overall wellbeing has ${dir} to ${latest.wellbeingScore} (${latest.riskLevel}). The main movers recently have been appetite and hydration.`
  }
  if (has('summary', 'how is', 'how’s', 'overall', 'today')) {
    return latest.summary
  }
  return `I can answer from ${history.length} recorded conversations. Try asking about ${PARENT.shortName}’s eating, hydration, medication, speech, or how things have changed over time.`
}

function mostCommon(arr: string[]): string {
  const counts: Record<string, number> = {}
  arr.forEach(x => (counts[x] = (counts[x] || 0) + 1))
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || ''
}

export const SUGGESTED_QUESTIONS = [
  `Has ${PARENT.shortName} been eating enough this week?`,
  'Has her speech changed recently?',
  'Has her appetite declined?',
  'Has she been taking her medication?',
  'What changed compared with last month?',
]

// ---------------------------------------------------------------------------
// MealRoaster integration (forward-looking). Nutrition signals are structured
// so they can drive personalised meal recommendations. This is a local stub of
// the contract Sentinel would send to MealRoaster.
// ---------------------------------------------------------------------------

export interface MealRoasterRequest {
  appetite: NutritionExtraction['appetite']
  proteinNote: string
  hydrationGap: number
  skippedMeals: string[]
  recentMeals: string[]
}

export interface MealSuggestion {
  meal: string
  why: string
}

export function toMealRoasterRequest(c: Conversation): MealRoasterRequest {
  return {
    appetite: c.nutrition.appetite,
    proteinNote: c.nutrition.proteinNote,
    hydrationGap: Math.max(0, c.hydration.target - c.hydration.glasses),
    skippedMeals: c.nutrition.skippedMeals,
    recentMeals: c.nutrition.meals,
  }
}

/** Stub for the MealRoaster service. Returns gentle, appetite-aware meal ideas.
 *  Swap this for a real API call when MealRoaster is connected. */
export function mealRoasterRecommendations(req: MealRoasterRequest): MealSuggestion[] {
  const out: MealSuggestion[] = []
  if (req.skippedMeals.includes('dinner')) out.push({ meal: 'A warm, easy dinner — cottage pie or an omelette', why: 'Dinner was skipped; something warm and familiar is more tempting.' })
  if (req.appetite === 'low') out.push({ meal: 'Small, frequent plates — cheese & crackers, yoghurt', why: 'Low appetite responds better to little-and-often than large meals.' })
  if (/low protein/i.test(req.proteinNote)) out.push({ meal: 'A protein-rich snack — boiled egg, Greek yoghurt or hummus', why: req.proteinNote })
  if (req.hydrationGap > 0) out.push({ meal: 'Hydrating foods — soup, melon, or a fruit smoothie', why: `Roughly ${req.hydrationGap} glasses below target; food can top up fluids too.` })
  if (!out.length) out.push({ meal: 'Keep to the current balanced routine', why: 'Nutrition and hydration are on track.' })
  return out
}
