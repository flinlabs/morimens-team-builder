/** Which items can actually obtain a given character copy or wheel.

The advice engine knows what a player *should* get. This module answers the
question that immediately follows — what do I spend to get it — because the
answer is frequently "nothing you hold", and a recommendation the player has no
route to act on is worse than no recommendation at all.

Constraints compose. An item grants either awakener copies or wheels; it either
lets the player choose or hands out something random from a pool; and it may be
limited by arc, by realm, or to things already owned. Wheel availability is
derived from the owning awakener, since db/wheels.json carries none of its own.
**/

import type { EnrichedAwakener, EnrichedWheel, UserRoster } from './types'

export type Grants = 'awakener' | 'wheel'
export type Selection = 'choose' | 'random'
export type LimitedArc = 'FADED_LEGACY' | 'ASTRAL_REIGN'

export interface AcquisitionItem {
  slug: string
  name: string
  grants: Grants
  selection: Selection
  /** Restricted to that arc's limited pool. Absent = no arc restriction. */
  arc?: LimitedArc
  /** Restricted to one realm. Absent = any realm. */
  realm?: string
  /** Can only duplicate something already in the collection. */
  ownedOnly?: boolean
  synthesis?: { from: string; count: number }
  note?: string
}

export interface AcquisitionCatalog {
  items: AcquisitionItem[]
}

/**
 * The arc a limited record belongs to, or null for anything permanently
 * available. Permanent and welfare characters are not in any limited pool, so
 * the arc-locked selectors cannot produce them.
 */
export function limitedArcOf(availabilityType?: string): LimitedArc | null {
  if (availabilityType === 'LIMITED_FADED_LEGACY') return 'FADED_LEGACY'
  if (availabilityType === 'LIMITED_ASTRAL_REIGN') return 'ASTRAL_REIGN'
  return null
}

/**
 * A wheel's limited arc, inherited from the awakener it belongs to.
 *
 * Exact for signature wheels — each limited awakener's SSR and SR carry that
 * awakener's arc. Ownerless wheels (the Mythic pool, plus R and N) have no
 * owner to inherit from and are treated as outside these items entirely, which
 * is the honest answer rather than a guess.
 */
export function wheelLimitedArc(
  wheel: Pick<EnrichedWheel, 'ownerAwakenerId'>,
  awakeners: Record<string, EnrichedAwakener>
): LimitedArc | null {
  if (!wheel.ownerAwakenerId) return null
  return limitedArcOf(awakeners[wheel.ownerAwakenerId]?.availabilityType)
}

function realmMatches(item: AcquisitionItem, realm: string | undefined): boolean {
  return !item.realm || item.realm === realm
}

/** Items that could grant a copy of this awakener, given what the player holds. */
export function itemsForAwakener(
  awakener: EnrichedAwakener,
  catalog: AcquisitionCatalog,
  roster: UserRoster,
  opts: { heldOnly?: boolean } = {}
): AcquisitionItem[] {
  const owned = !!roster.awakeners[awakener.id]?.owned
  const arc = limitedArcOf(awakener.availabilityType)
  const counts = roster.currencies ?? {}

  return catalog.items.filter((item) => {
    if (item.grants !== 'awakener') return false
    if (item.ownedOnly && !owned) return false
    if (item.arc && item.arc !== arc) return false
    if (!realmMatches(item, awakener.realm)) return false
    if (opts.heldOnly && !(counts[item.slug] > 0)) return false
    return true
  })
}

/** Items that could grant this wheel, given what the player holds. */
export function itemsForWheel(
  wheel: EnrichedWheel,
  catalog: AcquisitionCatalog,
  roster: UserRoster,
  awakeners: Record<string, EnrichedAwakener>,
  opts: { heldOnly?: boolean } = {}
): AcquisitionItem[] {
  const owned = !!roster.wheels[wheel.id]?.owned
  const arc = wheelLimitedArc(wheel, awakeners)
  // A signature wheel's realm follows its owner; the wheel's own realm field is
  // NEUTRAL for most of the catalogue and would defeat every realm-locked item.
  const realm = wheel.ownerAwakenerId
    ? awakeners[wheel.ownerAwakenerId]?.realm
    : wheel.realm
  const counts = roster.currencies ?? {}

  return catalog.items.filter((item) => {
    if (item.grants !== 'wheel') return false
    if (item.ownedOnly && !owned) return false
    if (item.arc && item.arc !== arc) return false
    if (!realmMatches(item, realm)) return false
    if (opts.heldOnly && !(counts[item.slug] > 0)) return false
    return true
  })
}

/**
 * One-line summary of how to act on a recommendation, preferring an item the
 * player actually holds. A "choose" item beats a "random" one of equal
 * availability because it is a guarantee rather than a roll.
 */
export function routeSummary(items: AcquisitionItem[], roster: UserRoster): string | null {
  if (!items.length) return null
  const counts = roster.currencies ?? {}
  const held = items.filter((i) => (counts[i.slug] ?? 0) > 0)
  const pool = held.length ? held : items
  const ranked = [...pool].sort((a, b) => {
    if (a.selection !== b.selection) return a.selection === 'choose' ? -1 : 1
    return (counts[b.slug] ?? 0) - (counts[a.slug] ?? 0)
  })
  const best = ranked[0]
  const n = counts[best.slug] ?? 0
  if (n > 0) {
    return `You hold ${n}× ${best.name}${best.selection === 'random' ? ' (random reward)' : ''}`
  }
  return `Obtainable with ${best.name}${best.selection === 'random' ? ' (random reward)' : ''}`
}
