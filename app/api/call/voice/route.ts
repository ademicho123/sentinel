import { NextRequest } from 'next/server'
import { getTwilioConfig } from '../../../lib/twilio'
import { createCall } from '../../../lib/callStore'

export const runtime = 'nodejs'

/**
 * TwiML App Voice URL. Twilio hits this when the browser SDK places a call. It
 * dials the parent (the `To` param the client passed), records the two-party
 * conversation, and registers the call so the recording result can be found by
 * CallSid. When the recording is ready Twilio calls /api/call/recording.
 */
export async function POST(req: NextRequest) {
  const cfg = getTwilioConfig()
  const form = await req.formData().catch(() => null)
  const to = ((form?.get('To') as string) || '').trim()
  const callSid = (form?.get('CallSid') as string) || ''

  if (!cfg) return xml(`<Response><Say>Sentinel is not configured for calls.</Say><Hangup/></Response>`)
  if (!to) return xml(`<Response><Say>No parent number was provided.</Say><Hangup/></Response>`)

  if (callSid) createCall(callSid)
  const recordingCb = `${cfg.publicBaseUrl}/api/call/recording?callSid=${encodeURIComponent(callSid)}`

  const body =
    `<Response>` +
    `<Say voice="alice">Connecting your Sentinel family call. This call will be recorded for wellbeing analysis.</Say>` +
    `<Dial callerId="${cfg.from}" answerOnBridge="true" record="record-from-answer-dual" recordingStatusCallback="${recordingCb}" recordingStatusCallbackEvent="completed" recordingStatusCallbackMethod="POST">` +
    `<Number>${to}</Number>` +
    `</Dial>` +
    `</Response>`
  return xml(body)
}

export async function GET(req: NextRequest) { return POST(req) }

function xml(body: string): Response {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>${body}`, { status: 200, headers: { 'Content-Type': 'text/xml' } })
}
