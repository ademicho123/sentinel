import { NextRequest, NextResponse } from 'next/server'
import { toFile } from 'openai'
import { getOpenAI, OPENAI_TRANSCRIBE_MODEL } from '../../../lib/openai'
import { getTwilioConfig, twilioAuthHeader } from '../../../lib/twilio'
import { setCallReady, setCallError } from '../../../lib/callStore'
import type { TranscriptLine } from '../../../lib/sentinel'

export const runtime = 'nodejs'
export const maxDuration = 120

/**
 * Twilio recording-status webhook. Fires once the call recording is ready.
 * Downloads the audio, transcribes it with OpenAI, and stores the transcript
 * for the client to pick up via /api/call/status.
 *
 * OpenAI transcription returns plain text (no speaker labels), so the whole
 * conversation is stored as a single transcript line.
 */
export async function POST(req: NextRequest) {
  const callSid = req.nextUrl.searchParams.get('callSid') || ''
  const cfg = getTwilioConfig()
  const client = getOpenAI()

  const form = await req.formData().catch(() => null)
  const recordingUrl = (form?.get('RecordingUrl') as string) || ''
  const durationSec = Number(form?.get('RecordingDuration')) || 0

  if (!callSid || !cfg || !client || !recordingUrl) {
    if (callSid) setCallError(callSid, 'missing recording, config, or OpenAI key')
    return NextResponse.json({ ok: false }, { status: 200 }) // ack Twilio regardless
  }

  try {
    const res = await fetch(`${recordingUrl}.mp3`, { headers: { Authorization: twilioAuthHeader(cfg) } })
    if (!res.ok) throw new Error(`recording download ${res.status}`)
    const buf = Buffer.from(await res.arrayBuffer())

    const file = await toFile(buf, 'call.mp3', { type: 'audio/mpeg' })
    const result = await client.audio.transcriptions.create({ file, model: OPENAI_TRANSCRIBE_MODEL, response_format: 'text' })
    const text = (typeof result === 'string' ? result : (result as { text?: string }).text || '').trim()

    const transcript: TranscriptLine[] = text ? [{ speaker: 'Call', text }] : []
    setCallReady(callSid, transcript, Math.max(1, Math.round(durationSec / 60)))
    return NextResponse.json({ ok: true }, { status: 200 })
  } catch (e) {
    console.error('[recording] error', e)
    setCallError(callSid, 'transcription failed')
    return NextResponse.json({ ok: false }, { status: 200 }) // still ack Twilio
  }
}
