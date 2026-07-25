import { NextRequest, NextResponse } from 'next/server'
import { getOpenAI, OPENAI_MODEL } from '../../lib/openai'
import { BASELINE, type CallExtraction, type TranscriptLine } from '../../lib/sentinel'

export const runtime = 'nodejs'

const SYSTEM = `You are Sentinel, an AI that quietly listens to a family phone call that a family member has started with their older parent, then extracts wellbeing signals from the transcript. Sentinel never places calls on its own and never replaces the conversation. You observe and analyse — you never diagnose disease or give medical advice. Return ONLY a JSON object matching the requested schema. Base every value strictly on what is said in the transcript; if something is not mentioned, use empty arrays or neutral defaults (do not invent).`

const SCHEMA = `Return JSON with exactly this shape:
{
  "nutrition": {
    "meals": string[],            // main meals mentioned, e.g. ["cereal","soup"]
    "snacks": string[],
    "drinks": string[],
    "appetite": "good" | "fair" | "low",
    "hydrationGlasses": number,   // estimated glasses of fluid today, 0-12
    "proteinNote": string,        // short note on protein intake
    "weightNote": string,         // short note; "Stable" if weight not mentioned
    "skippedMeals": string[]      // meals explicitly skipped, e.g. ["dinner"]
  },
  "medication": {
    "mentioned": string[],
    "confirmed": string[],        // medications the parent confirmed taking
    "missed": string[],           // medications indicated as missed/forgotten
    "supplements": string[],
    "timingNote": string          // e.g. "Taken with morning tea, on time"
  },
  "hydration": { "glasses": number, "target": 6, "note": string },
  "vocal": {
    // Estimate each as a percentage of the parent's NORMAL baseline where 100 = normal.
    // Infer from wording only (hesitation words, warmth, engagement, sentence length).
    // Range roughly 60-140. This is a text approximation, not audio measurement.
    "speechPace": number, "vocalEnergy": number, "confidence": number,
    "hesitation": number, "clarity": number, "emotionalTone": number,
    "engagement": number, "responseLatency": number
  }
}`

const num = (v: unknown, d: number) => (Number.isFinite(Number(v)) ? Number(v) : d)
const arr = (v: unknown): string[] => (Array.isArray(v) ? v.filter(x => typeof x === 'string' && x.trim()).map(String) : [])

function coerce(p: any): CallExtraction {
  const n = p?.nutrition ?? {}
  const m = p?.medication ?? {}
  const h = p?.hydration ?? {}
  const v = p?.vocal ?? {}
  const appetite = ['good', 'fair', 'low'].includes(n.appetite) ? n.appetite : 'fair'
  const glasses = Math.max(0, Math.round(num(h.glasses, num(n.hydrationGlasses, 4))))
  const cv = (x: unknown) => Math.max(40, Math.min(140, Math.round(num(x, 100))))
  return {
    nutrition: {
      meals: arr(n.meals), snacks: arr(n.snacks), drinks: arr(n.drinks), appetite,
      hydrationGlasses: glasses, proteinNote: String(n.proteinNote || 'Not mentioned'),
      weightNote: String(n.weightNote || 'Stable'), skippedMeals: arr(n.skippedMeals),
    },
    medication: {
      mentioned: arr(m.mentioned), confirmed: arr(m.confirmed), missed: arr(m.missed),
      supplements: arr(m.supplements), timingNote: String(m.timingNote || 'Not mentioned'),
    },
    hydration: { glasses, target: BASELINE.hydrationTarget, note: String(h.note || '') },
    vocal: {
      speechPace: cv(v.speechPace), vocalEnergy: cv(v.vocalEnergy), confidence: cv(v.confidence),
      hesitation: cv(v.hesitation), clarity: cv(v.clarity), emotionalTone: cv(v.emotionalTone),
      engagement: cv(v.engagement), responseLatency: cv(v.responseLatency),
    },
  }
}

export async function POST(req: NextRequest) {
  const client = getOpenAI()
  if (!client) return NextResponse.json({ error: 'OPENAI_API_KEY not set' }, { status: 501 })

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 }) }
  const transcript = body?.transcript as TranscriptLine[] | undefined
  if (!Array.isArray(transcript) || !transcript.length) return NextResponse.json({ error: 'transcript required' }, { status: 400 })

  const text = transcript.map(l => `${l.speaker}: ${l.text}`).join('\n')

  try {
    const completion = await client.chat.completions.create({
      model: OPENAI_MODEL,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: `${SCHEMA}\n\nTranscript:\n${text}` },
      ],
    })
    const raw = completion.choices[0]?.message?.content || '{}'
    return NextResponse.json(coerce(JSON.parse(raw)))
  } catch (e) {
    console.error('[analyze] OpenAI error', e)
    return NextResponse.json({ error: 'analysis failed' }, { status: 502 })
  }
}
