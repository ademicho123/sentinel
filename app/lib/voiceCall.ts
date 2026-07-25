// Browser-side controller for placing a real call through the Twilio Voice SDK.
// The app user talks through the browser (mic + speakers); Twilio dials the
// parent. Falls back to 'sim' when Twilio isn't configured.
//
// The SDK is imported dynamically so it never runs during SSR.

import type { Call, Device } from '@twilio/voice-sdk'

export interface VoiceCallHandlers {
  onConnected: (callSid: string) => void
  onEnded: () => void
  onError: (message: string) => void
}

export class VoiceCallController {
  private device: Device | null = null
  private call: Call | null = null

  /** Returns 'twilio' if a real call started, or 'sim' to use the simulated flow. */
  async start(parentPhone: string, handlers: VoiceCallHandlers): Promise<'twilio' | 'sim'> {
    let token: string
    try {
      const res = await fetch('/api/token')
      if (!res.ok) return 'sim'
      token = (await res.json()).token
      if (!token) return 'sim'
    } catch {
      return 'sim'
    }

    try {
      const { Device } = await import('@twilio/voice-sdk')
      const device = new Device(token, { logLevel: 1 })
      this.device = device
      const call = await device.connect({ params: { To: parentPhone } })
      this.call = call
      call.on('accept', () => handlers.onConnected(String(call.parameters?.CallSid || '')))
      call.on('disconnect', () => { handlers.onEnded(); this.cleanup() })
      call.on('cancel', () => { handlers.onEnded(); this.cleanup() })
      call.on('error', (e: { message?: string }) => { handlers.onError(e?.message || 'Call error'); this.cleanup() })
      return 'twilio'
    } catch (e) {
      handlers.onError(e instanceof Error ? e.message : 'Could not start the call')
      this.cleanup()
      return 'sim'
    }
  }

  hangup(): void {
    try { this.call?.disconnect() } catch { /* noop */ }
  }

  private cleanup(): void {
    try { this.device?.destroy() } catch { /* noop */ }
    this.device = null
    this.call = null
  }
}
