import twilio from 'twilio'

/**
 * Twilio configuration for BROWSER (WebRTC) calling. The person using the app
 * talks through the browser — there is no caregiver phone. Twilio dials only the
 * parent, whose number is chosen in Settings and passed per-call (never env).
 *
 *   TWILIO_ACCOUNT_SID     – from the console
 *   TWILIO_AUTH_TOKEN      – used only to download the finished recording
 *   TWILIO_PHONE_NUMBER    – your Twilio number; the caller ID shown to the parent
 *   TWILIO_API_KEY_SID     – API key (Standard) for minting Voice access tokens
 *   TWILIO_API_KEY_SECRET  – the API key secret
 *   TWILIO_TWIML_APP_SID   – TwiML App whose Voice URL is {PUBLIC_BASE_URL}/api/call/voice
 *   PUBLIC_BASE_URL        – public https origin Twilio can reach for webhooks
 */
export interface TwilioConfig {
  accountSid: string
  authToken: string
  from: string
  apiKeySid: string
  apiKeySecret: string
  twimlAppSid: string
  publicBaseUrl: string
}

export function getTwilioConfig(): TwilioConfig | null {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_PHONE_NUMBER
  const apiKeySid = process.env.TWILIO_API_KEY_SID
  const apiKeySecret = process.env.TWILIO_API_KEY_SECRET
  const twimlAppSid = process.env.TWILIO_TWIML_APP_SID
  const publicBaseUrl = process.env.PUBLIC_BASE_URL
  if (!accountSid || !authToken || !from || !apiKeySid || !apiKeySecret || !twimlAppSid || !publicBaseUrl) return null
  return { accountSid, authToken, from, apiKeySid, apiKeySecret, twimlAppSid, publicBaseUrl: publicBaseUrl.replace(/\/$/, '') }
}

/** Mint a short-lived Voice access token the browser SDK uses to place calls. */
export function createVoiceToken(cfg: TwilioConfig, identity: string): string {
  const AccessToken = twilio.jwt.AccessToken
  const VoiceGrant = AccessToken.VoiceGrant
  const token = new AccessToken(cfg.accountSid, cfg.apiKeySid, cfg.apiKeySecret, { identity, ttl: 3600 })
  token.addGrant(new VoiceGrant({ outgoingApplicationSid: cfg.twimlAppSid, incomingAllow: false }))
  return token.toJwt()
}

/** Basic-auth header for downloading a recording from Twilio's media URL. */
export function twilioAuthHeader(cfg: TwilioConfig): string {
  return 'Basic ' + Buffer.from(`${cfg.accountSid}:${cfg.authToken}`).toString('base64')
}
