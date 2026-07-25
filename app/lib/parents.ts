// Parent contacts are managed by the person using the app, in Settings, and
// stored locally (no server, no env). More than one parent can be added.

export interface Parent {
  id: string
  name: string
  phone: string // E.164, e.g. +44...
}

const KEY = 'sentinel.parents'

// The dashboard demo subject; seeded so there's always at least one entry.
export const DEFAULT_PARENTS: Parent[] = [{ id: 'p-eleanor', name: 'Eleanor Wilson', phone: '' }]

export function loadParents(): Parent[] {
  if (typeof window === 'undefined') return DEFAULT_PARENTS
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return DEFAULT_PARENTS
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed) || !parsed.length) return DEFAULT_PARENTS
    return parsed.filter((p): p is Parent => p && typeof p.id === 'string' && typeof p.name === 'string' && typeof p.phone === 'string')
  } catch {
    return DEFAULT_PARENTS
  }
}

export function saveParents(parents: Parent[]): void {
  if (typeof window === 'undefined') return
  try { window.localStorage.setItem(KEY, JSON.stringify(parents)) } catch { /* ignore quota */ }
}

export function newParentId(): string {
  return `p-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

/** Light validation/normalisation for a phone number in E.164-ish form. */
export function normalisePhone(raw: string): string {
  const t = raw.trim().replace(/[^\d+]/g, '')
  return t
}

export function isValidPhone(raw: string): boolean {
  return /^\+\d{7,15}$/.test(normalisePhone(raw))
}
