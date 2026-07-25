import OpenAI from 'openai'

// Model is overridable via env; gpt-4o-mini is fast + cheap and supports JSON
// mode, which is ideal for a hackathon demo.
export const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini'

// Speech-to-text model for /api/transcribe. gpt-4o-mini-transcribe is fast and
// accurate; set OPENAI_TRANSCRIBE_MODEL=whisper-1 if you prefer classic Whisper.
export const OPENAI_TRANSCRIBE_MODEL = process.env.OPENAI_TRANSCRIBE_MODEL || 'gpt-4o-mini-transcribe'

/** Returns an OpenAI client, or null when no API key is configured so callers
 *  can fall back to the deterministic local logic. */
export function getOpenAI(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return null
  return new OpenAI({ apiKey })
}
