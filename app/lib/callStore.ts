import type { TranscriptLine } from './sentinel'

/**
 * Tiny in-memory store bridging Twilio's server-side recording webhook to the
 * client, which polls /api/call/status by callSid.
 *
 * Caveat: module-level state lives in one Node process. That's fine for a
 * single-instance hackathon demo (one `next dev` / one server), but would need
 * a shared store (Redis, a DB, etc.) behind multiple serverless instances.
 */
export type CallStatus = 'pending' | 'ready' | 'error'

export interface CallRecord {
  status: CallStatus
  createdAt: number
  transcript?: TranscriptLine[]
  durationMin?: number
  error?: string
}

// Survive Next.js dev hot-reloads by hanging the map off globalThis.
const g = globalThis as unknown as { __sentinelCalls?: Map<string, CallRecord> }
const store: Map<string, CallRecord> = g.__sentinelCalls ?? new Map()
g.__sentinelCalls = store

export function createCall(callSid: string): void {
  store.set(callSid, { status: 'pending', createdAt: Date.now() })
}

export function setCallReady(callSid: string, transcript: TranscriptLine[], durationMin: number): void {
  store.set(callSid, { status: 'ready', createdAt: store.get(callSid)?.createdAt ?? Date.now(), transcript, durationMin })
}

export function setCallError(callSid: string, error: string): void {
  store.set(callSid, { status: 'error', createdAt: store.get(callSid)?.createdAt ?? Date.now(), error })
}

export function getCall(callSid: string): CallRecord | undefined {
  return store.get(callSid)
}
