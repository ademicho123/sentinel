import { NextRequest, NextResponse } from 'next/server'
import { toFile } from 'openai'
import { getOpenAI, OPENAI_TRANSCRIBE_MODEL } from '../../lib/openai'

export const runtime = 'nodejs'
// Audio blobs can be a few MB; allow the body through.
export const maxDuration = 60

/**
 * Speech-to-text. Accepts an audio blob (multipart form field `audio`) captured
 * from the browser microphone or a call recording, and returns the OpenAI
 * transcription. Reusable by any capture source — browser mic today, a Twilio
 * call recording later.
 */
export async function POST(req: NextRequest) {
  const client = getOpenAI()
  if (!client) return NextResponse.json({ error: 'OPENAI_API_KEY not set' }, { status: 501 })

  let form: FormData
  try { form = await req.formData() } catch { return NextResponse.json({ error: 'expected multipart/form-data' }, { status: 400 }) }

  const audio = form.get('audio')
  if (!(audio instanceof Blob) || audio.size === 0) return NextResponse.json({ error: 'audio field required' }, { status: 400 })

  const name = (audio instanceof File && audio.name) || 'audio.webm'
  const type = audio.type || 'audio/webm'

  try {
    const file = await toFile(Buffer.from(await audio.arrayBuffer()), name, { type })
    const result = await client.audio.transcriptions.create({
      file,
      model: OPENAI_TRANSCRIBE_MODEL,
      // response_format text keeps it simple and works across transcribe models.
      response_format: 'text',
    })
    // With response_format 'text' the SDK returns a string; be defensive.
    const text = (typeof result === 'string' ? result : (result as { text?: string }).text || '').trim()
    return NextResponse.json({ text })
  } catch (e) {
    console.error('[transcribe] OpenAI error', e)
    return NextResponse.json({ error: 'transcription failed' }, { status: 502 })
  }
}
