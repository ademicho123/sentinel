import { NextResponse } from 'next/server'
import { getTwilioConfig, createVoiceToken } from '../../lib/twilio'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Issues a Twilio Voice access token for the browser SDK. Returns 501 when
 * Twilio isn't configured so the client falls back to the simulated call.
 */
export async function GET() {
  const cfg = getTwilioConfig()
  if (!cfg) return NextResponse.json({ error: 'Twilio not configured' }, { status: 501 })
  try {
    const identity = `sentinel-app`
    const token = createVoiceToken(cfg, identity)
    return NextResponse.json({ token, identity })
  } catch (e) {
    console.error('[token] error', e)
    return NextResponse.json({ error: 'could not mint token' }, { status: 502 })
  }
}
