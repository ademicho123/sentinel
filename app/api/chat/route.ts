import { NextRequest, NextResponse } from 'next/server'
import { getOpenAI, OPENAI_MODEL } from '../../lib/openai'
import { PARENT, type Conversation } from '../../lib/sentinel'

export const runtime = 'nodejs'

const SYSTEM = `You are Sentinel's assistant for a family caregiver. You answer questions about the caregiver's older parent using ONLY the structured conversation history provided as JSON. Be warm and concise (2-4 sentences). Cite concrete numbers and trends (e.g. "3 of the last 7 calls"). Always frame vocal and appetite changes as compared with the parent's OWN baseline. You never diagnose disease or give medical advice — these are gentle observations. If the provided data does not answer the question, say so plainly.`

// Compact the stored conversations to the fields the model needs, keeping the
// prompt small.
function compact(conversations: Conversation[]) {
  return conversations.slice(0, 14).map(c => ({
    date: c.date,
    label: c.label,
    durationMin: c.durationMin,
    wellbeingScore: c.wellbeingScore,
    riskLevel: c.riskLevel,
    nutrition: { appetite: c.nutrition.appetite, meals: c.nutrition.meals, skippedMeals: c.nutrition.skippedMeals, proteinNote: c.nutrition.proteinNote },
    hydration: c.hydration,
    medication: { confirmed: c.medication.confirmed, missed: c.medication.missed, timingNote: c.medication.timingNote },
    vocal: c.vocal,
    summary: c.summary,
  }))
}

export async function POST(req: NextRequest) {
  const client = getOpenAI()
  if (!client) return NextResponse.json({ error: 'OPENAI_API_KEY not set' }, { status: 501 })

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 }) }
  const question = typeof body?.question === 'string' ? body.question.trim() : ''
  const conversations = Array.isArray(body?.conversations) ? (body.conversations as Conversation[]) : []
  if (!question) return NextResponse.json({ error: 'question required' }, { status: 400 })

  try {
    const completion = await client.chat.completions.create({
      model: OPENAI_MODEL,
      temperature: 0.4,
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: `Parent: ${PARENT.name} (referred to as ${PARENT.shortName}).\nConversation history (newest first) as JSON:\n${JSON.stringify(compact(conversations))}\n\nCaregiver question: ${question}` },
      ],
    })
    const answer = completion.choices[0]?.message?.content?.trim()
    if (!answer) return NextResponse.json({ error: 'empty answer' }, { status: 502 })
    return NextResponse.json({ answer })
  } catch (e) {
    console.error('[chat] OpenAI error', e)
    return NextResponse.json({ error: 'chat failed' }, { status: 502 })
  }
}
