/** Covenant substat priorities, shared by the engine and the UI.

Two sources say which substats a character wants on their covenants:

  db/bis.json `preferredStats`   hand-curated per BiS variant (Support, DPS…),
                                 free text: "Crit Rate", "DR", "AMP", "Any"…
  awakener.build (SKeyDB)        `substatPriorityGroups`, ordered stat keys

The BiS list is authoritative because it is variant-specific and curated, so
it wins whenever it names at least one real substat. SKeyDB fills the gap for
variants whose list is empty or just says "Any".

Copy fit is deliberately scale-free. Rolled totals are in different units
(Crit Rate is a percent, Keyflare Regen is a level) and there is no roll-size
table to normalise them against, so two copies are only ever compared stat by
stat, in the character's priority order. Client-safe: no fs imports. **/

export const SUBSTAT_KEYS = [
  'CRIT_RATE',
  'CRIT_DMG',
  'DMG_AMP',
  'DEATH_RESISTANCE',
  'REALM_MASTERY',
  'SIGIL_YIELD',
  'ALIEMUS_REGEN',
  'KEYFLARE_REGEN',
] as const

export type SubstatKey = (typeof SUBSTAT_KEYS)[number]

export const SUBSTAT_LABEL: Record<SubstatKey, string> = {
  CRIT_RATE: 'Crit Rate',
  CRIT_DMG: 'Crit DMG',
  DMG_AMP: 'DMG Amplification',
  DEATH_RESISTANCE: 'Death Resistance',
  REALM_MASTERY: 'Realm Mastery',
  SIGIL_YIELD: 'Sigil Yield',
  ALIEMUS_REGEN: 'Aliemus Regen',
  KEYFLARE_REGEN: 'Keyflare Regen',
}

// Every spelling that appears in db/bis.json, lowercased.
const ALIASES: Record<string, SubstatKey> = {
  'crit rate': 'CRIT_RATE',
  'crit dmg': 'CRIT_DMG',
  amp: 'DMG_AMP',
  'dmg amp': 'DMG_AMP',
  'dmg amplification': 'DMG_AMP',
  dr: 'DEATH_RESISTANCE',
  'death resistance': 'DEATH_RESISTANCE',
  rm: 'REALM_MASTERY',
  'realm mastery': 'REALM_MASTERY',
  sigil: 'SIGIL_YIELD',
  sigils: 'SIGIL_YIELD',
  bsigil: 'SIGIL_YIELD',
  bsigils: 'SIGIL_YIELD',
  'sigil yield': 'SIGIL_YIELD',
  aliemus: 'ALIEMUS_REGEN',
  'aliemus regen': 'ALIEMUS_REGEN',
  keyflare: 'KEYFLARE_REGEN',
  'keyflare regen': 'KEYFLARE_REGEN',
}

/** A stat name from either source as a substat key, or null ("Any", "Defense"). */
export function toSubstatKey(name: string): SubstatKey | null {
  const raw = name.trim()
  if ((SUBSTAT_KEYS as readonly string[]).includes(raw)) return raw as SubstatKey
  return ALIASES[raw.toLowerCase()] ?? null
}

/** Ordered, de-duplicated substat keys; unknown names dropped. */
export function normalizeSubstats(names: readonly string[] | undefined): SubstatKey[] {
  const out: SubstatKey[] = []
  for (const n of names ?? []) {
    const k = toSubstatKey(n)
    if (k && !out.includes(k)) out.push(k)
  }
  return out
}

/** BiS preferredStats when they name a real substat, else SKeyDB's groups. */
export function resolveSubstatPriority(
  bisPreferred: readonly string[] | undefined,
  skeyGroups: readonly (readonly string[])[] | undefined
): SubstatKey[] {
  const fromBis = normalizeSubstats(bisPreferred)
  if (fromBis.length) return fromBis
  return normalizeSubstats((skeyGroups ?? []).flat())
}

type Totals = Record<string, number> | undefined

/**
 * Sort comparator for two copies' rolled totals against one priority list.
 * Negative when `a` fits better. Walks the priority in order and the first
 * stat where the copies differ decides it.
 */
export function compareSubstatFit(a: Totals, b: Totals, priority: readonly string[]): number {
  for (const k of priority) {
    const d = (b?.[k] ?? 0) - (a?.[k] ?? 0)
    if (d) return d
  }
  return 0
}

/**
 * How well one copy matches a character, for ranking characters against a
 * copy. Presence-based (see the header): each wanted stat the copy has rolled
 * scores by its rank, so a character whose top stat is on the copy outranks
 * one who only shares their third.
 */
export function substatFit(
  totals: Totals,
  priority: readonly string[]
): { score: number; matched: SubstatKey[] } {
  const matched: SubstatKey[] = []
  let score = 0
  priority.forEach((k, i) => {
    if ((totals?.[k] ?? 0) > 0) {
      score += priority.length - i
      matched.push(k as SubstatKey)
    }
  })
  return { score, matched }
}

export function hasRecordedSubstats(totals: Totals): boolean {
  return !!totals && Object.values(totals).some((v) => v > 0)
}
