import { NextRequest, NextResponse } from 'next/server'
import { getCall } from '../../../lib/callStore'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Client poll target. Returns the current state of a placed call. */
export async function GET(req: NextRequest) {
  const callSid = req.nextUrl.searchParams.get('callSid') || ''
  if (!callSid) return NextResponse.json({ error: 'callSid required' }, { status: 400 })
  const record = getCall(callSid)
  if (!record) return NextResponse.json({ status: 'error', error: 'unknown call' }, { status: 404 })
  return NextResponse.json({ status: record.status, transcript: record.transcript, durationMin: record.durationMin, error: record.error })
}
