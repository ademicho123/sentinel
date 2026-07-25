import OpenAI from 'openai'

// Model is overridable via env; gpt-4o-mini is fast + cheap and supports JSON
// mode, which is ideal for a hackathon demo.
export const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini'

/** Returns an OpenAI client, or null when no API key is configured so callers
 *  can fall back to the deterministic local logic. */
export function getOpenAI(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return null
  return new OpenAI({ apiKey })
}
