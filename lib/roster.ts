import type {
  UserRoster,
  AwakenerEntry,
  WheelEntry,
  CovenantEntry,
  CovenantCopy,
  PosseEntry,
  AppSettings,
  EnlightenSlot,
  SkillSlot,
  ArcRuleset,
} from './types'

const ROSTER_KEY = 'morimens_roster_v1'

// ---------------------------------------------------------------------------
// Default values
// ---------------------------------------------------------------------------

const DEFAULT_SKILL_LEVELS: Record<SkillSlot, number> = {
  Strike: 1,
  Defense: 1,
  Skill1: 1,
  Skill2: 1,
  Rouse: 1,
  Exalt: 1,
  OverExalt: 1,
}

const DEFAULT_AWAKENER_ENTRY: AwakenerEntry = {
  owned: false,
  enlightenSlot: 'E0',
  enlightenCopies: 0,
  characterLevel: 1,
  skillLevels: { ...DEFAULT_SKILL_LEVELS },
  talentLevels: {
    madnessOmen: 0,
    soulforgeAptitude: 0,
    gnosticPotential: 0,
  },
}

const DEFAULT_WHEEL_ENTRY: WheelEntry = {
  owned: false,
  starLevel: 0,
  stackLevel: 0,
}

const DEFAULT_COVENANT_ENTRY: CovenantEntry = {
  owned: false,
  threePieceComplete: false,
  sixPieceComplete: false,
  completionPercent: 0,
}

const DEFAULT_POSSE_ENTRY: PosseEntry = {
  unlocked: false,
}

const DEFAULT_SETTINGS: AppSettings = {
  arcRuleset: 'FADED_LEGACY',
}

/** Current roster schema version. Bump when a migration is added below. */
export const ROSTER_VERSION = 3

/**
 * Characters every account has without pulling for them.
 *
 * These are exactly the four SR awakeners — Doll, Lotan, Ogier and Ramona, all
 * Chaos, all WELFARE availability — handed out through the story, so starting
 * a roster with them unowned makes every new player's first job to tick four
 * boxes they could never not have.
 *
 * Listed by id rather than derived at runtime because this module is loaded on
 * the client and cannot read db/awakeners.json. tests/starter-roster.test.ts
 * asserts the list is identical to the SR set, so shipping a fifth SR fails the
 * suite rather than silently leaving them out.
 */
export const STARTER_AWAKENER_IDS = [
  'awakener-0013', // Doll
  'awakener-0031', // Lotan
  'awakener-0038', // Ogier
  'awakener-0042', // Ramona
] as const

/**
 * Bring a roster from any earlier schema version up to the current one.
 *
 * Shared by loadRoster and importRoster so a file exported before a migration
 * existed is upgraded on the way in — otherwise importing an old backup would
 * quietly hand the player a roster in a state the app no longer produces.
 */
export function migrateRoster(roster: UserRoster): UserRoster {
  if ((roster.version ?? 1) >= ROSTER_VERSION) return roster
  return {
    ...roster,
    // v1 → v2: seed the free story characters.
    awakeners: withStarters(roster.awakeners ?? {}),
    // v2 → v3: lift each owned covenant's single completion record into the
    // per-copy array 2.6.0 needs. Nothing is bound, since binding did not
    // exist yet, so a migrated roster behaves exactly as it did before.
    covenants: withCovenantCopies(roster.covenants ?? {}),
    version: ROSTER_VERSION,
  }
}

function withCovenantCopies(
  covenants: Record<string, CovenantEntry>
): Record<string, CovenantEntry> {
  const next: Record<string, CovenantEntry> = {}
  for (const [id, entry] of Object.entries(covenants)) {
    next[id] = entry.copies?.length ? entry : { ...entry, copies: covenantCopies(entry) }
  }
  return next
}

function withStarters(
  awakeners: Record<string, AwakenerEntry>
): Record<string, AwakenerEntry> {
  const next = { ...awakeners }
  for (const id of STARTER_AWAKENER_IDS) {
    // Only fill in a starter the roster has never recorded. Entries are sparse
    // — a key exists only once the player has touched that character — so an
    // explicit `owned: false` is a deliberate choice and is left alone.
    if (!next[id]) next[id] = { ...DEFAULT_AWAKENER_ENTRY, owned: true }
  }
  return next
}

export function createEmptyRoster(): UserRoster {
  return {
    version: ROSTER_VERSION,
    lastUpdated: new Date().toISOString(),
    keeperLevel: 1,
    currencies: {},
    awakeners: withStarters({}),
    wheels: {},
    covenants: {},
    posses: {},
    settings: DEFAULT_SETTINGS,
  }
}

// ---------------------------------------------------------------------------
// Load / Save
// ---------------------------------------------------------------------------

export function loadRoster(): UserRoster {
  if (typeof window === 'undefined') return createEmptyRoster()
  try {
    const raw = localStorage.getItem(ROSTER_KEY)
    if (!raw) return createEmptyRoster()
    // Applied to existing rosters as well as new ones: a player who never
    // ticked Doll almost certainly owns her. withStarters only fills entries
    // that do not exist, so anyone who deliberately unticked one keeps that.
    return migrateRoster(JSON.parse(raw) as UserRoster)
  } catch {
    return createEmptyRoster()
  }
}

export function saveRoster(roster: UserRoster): void {
  if (typeof window === 'undefined') return
  const updated = { ...roster, lastUpdated: new Date().toISOString() }
  localStorage.setItem(ROSTER_KEY, JSON.stringify(updated))
}

// ---------------------------------------------------------------------------
// Awakener helpers
// ---------------------------------------------------------------------------

export function getAwakenerEntry(
  roster: UserRoster,
  awakenerId: string
): AwakenerEntry {
  return roster.awakeners[awakenerId] ?? { ...DEFAULT_AWAKENER_ENTRY }
}

export function setAwakenerEntry(
  roster: UserRoster,
  awakenerId: string,
  entry: Partial<AwakenerEntry>
): UserRoster {
  const current = getAwakenerEntry(roster, awakenerId)
  return {
    ...roster,
    awakeners: {
      ...roster.awakeners,
      [awakenerId]: { ...current, ...entry },
    },
  }
}

export function setAwakenerOwned(
  roster: UserRoster,
  awakenerId: string,
  owned: boolean
): UserRoster {
  return setAwakenerEntry(roster, awakenerId, { owned })
}

export function setEnlightenLevel(
  roster: UserRoster,
  awakenerId: string,
  slot: EnlightenSlot,
  copies: number
): UserRoster {
  return setAwakenerEntry(roster, awakenerId, {
    enlightenSlot: slot,
    enlightenCopies: copies,
  })
}

export function setSkillLevel(
  roster: UserRoster,
  awakenerId: string,
  skillSlot: SkillSlot,
  level: number
): UserRoster {
  const current = getAwakenerEntry(roster, awakenerId)
  return setAwakenerEntry(roster, awakenerId, {
    skillLevels: { ...current.skillLevels, [skillSlot]: level },
  })
}

export function setTalentLevel(
  roster: UserRoster,
  awakenerId: string,
  talent: 'madnessOmen' | 'soulforgeAptitude' | 'gnosticPotential',
  level: number
): UserRoster {
  const current = getAwakenerEntry(roster, awakenerId)
  return setAwakenerEntry(roster, awakenerId, {
    talentLevels: { ...current.talentLevels, [talent]: level },
  })
}

export function getOwnedAwakenerIds(roster: UserRoster): string[] {
  return Object.entries(roster.awakeners)
    .filter(([, entry]) => entry.owned)
    .map(([id]) => id)
}

// ---------------------------------------------------------------------------
// Wheel helpers
// ---------------------------------------------------------------------------

export function getWheelEntry(
  roster: UserRoster,
  wheelId: string
): WheelEntry {
  return roster.wheels[wheelId] ?? { ...DEFAULT_WHEEL_ENTRY }
}

export function setWheelEntry(
  roster: UserRoster,
  wheelId: string,
  entry: Partial<WheelEntry>
): UserRoster {
  const current = getWheelEntry(roster, wheelId)
  return {
    ...roster,
    wheels: {
      ...roster.wheels,
      [wheelId]: { ...current, ...entry },
    },
  }
}

export function setWheelOwned(
  roster: UserRoster,
  wheelId: string,
  owned: boolean
): UserRoster {
  return setWheelEntry(roster, wheelId, { owned })
}

export function isDualSSRUnlocked(
  roster: UserRoster,
  wheelId: string
): boolean {
  const entry = getWheelEntry(roster, wheelId)
  return entry.owned && entry.stackLevel >= 12
}

export function getOwnedWheelIds(roster: UserRoster): string[] {
  return Object.entries(roster.wheels)
    .filter(([, entry]) => entry.owned)
    .map(([id]) => id)
}

// ---------------------------------------------------------------------------
// Covenant helpers
// ---------------------------------------------------------------------------

export function getCovenantEntry(
  roster: UserRoster,
  covenantId: string
): CovenantEntry {
  return roster.covenants[covenantId] ?? { ...DEFAULT_COVENANT_ENTRY }
}

/** Investigation Level at which the Awakener-Covenant binding menu unlocks. */
export const COVENANT_BINDING_LEVEL = 60

export function canBindCovenants(roster: UserRoster): boolean {
  return (roster.keeperLevel ?? 0) >= COVENANT_BINDING_LEVEL
}

/**
 * Every copy of a set the player holds, normalised.
 *
 * An entry written before 2.6.0 has no `copies` array and describes one copy
 * through the legacy top-level fields; an entry written after has the array
 * and the legacy fields are stale. This is the only place that difference is
 * allowed to matter — everything else reads through here.
 *
 * An unowned set has no copies at all, so callers can treat length as the
 * count of physical sets available to assign.
 */
export function covenantCopies(entry: CovenantEntry): CovenantCopy[] {
  if (!entry.owned) return []
  if (entry.copies?.length) return entry.copies
  return [
    {
      id: 'copy-1',
      threePieceComplete: entry.threePieceComplete,
      sixPieceComplete: entry.sixPieceComplete,
      completionPercent: entry.completionPercent,
      pieces: entry.pieces,
      substatTotals: entry.substatTotals,
    },
  ]
}

/** Copies of a set that `awakenerId` is allowed to wear. */
export function copiesAvailableTo(
  entry: CovenantEntry,
  awakenerId: string
): CovenantCopy[] {
  return covenantCopies(entry).filter((c) => !c.boundTo || c.boundTo === awakenerId)
}

/**
 * Best-first ordering for a given wearer.
 *
 * A copy bound to this awakener is Prismatic (+50% main attribute) and can
 * never be taken by anyone else, so it outranks a better-rolled free copy —
 * the alternative is leaving a strictly stronger item unworn. Below that it is
 * 6-piece, then 3-piece, then raw completion.
 */
export function rankCopiesFor(
  entry: CovenantEntry,
  awakenerId: string
): CovenantCopy[] {
  return [...copiesAvailableTo(entry, awakenerId)].sort((a, b) => {
    const bound = Number(b.boundTo === awakenerId) - Number(a.boundTo === awakenerId)
    if (bound) return bound
    const six = Number(b.sixPieceComplete) - Number(a.sixPieceComplete)
    if (six) return six
    const three = Number(b.threePieceComplete) - Number(a.threePieceComplete)
    if (three) return three
    return (b.completionPercent ?? 0) - (a.completionPercent ?? 0)
  })
}

/** Add an empty copy of a set (the player pulled a duplicate). */
export function addCovenantCopy(roster: UserRoster, covenantId: string): UserRoster {
  const entry = getCovenantEntry(roster, covenantId)
  const copies = covenantCopies(entry)
  const next: CovenantCopy = {
    id: `copy-${nextCopyOrdinal(copies)}`,
    threePieceComplete: false,
    sixPieceComplete: false,
    completionPercent: 0,
  }
  return setCovenantEntry(roster, covenantId, { owned: true, copies: [...copies, next] })
}

export function removeCovenantCopy(
  roster: UserRoster,
  covenantId: string,
  copyId: string
): UserRoster {
  const entry = getCovenantEntry(roster, covenantId)
  const copies = covenantCopies(entry).filter((c) => c.id !== copyId)
  return setCovenantEntry(roster, covenantId, { copies, owned: copies.length > 0 })
}

export function updateCovenantCopy(
  roster: UserRoster,
  covenantId: string,
  copyId: string,
  patch: Partial<CovenantCopy>
): UserRoster {
  const entry = getCovenantEntry(roster, covenantId)
  const copies = covenantCopies(entry).map((c) => (c.id === copyId ? { ...c, ...patch } : c))
  return setCovenantEntry(roster, covenantId, { copies })
}

/**
 * Bind a copy to an awakener, or unbind it when `awakenerId` is undefined.
 *
 * One awakener can hold at most one bound copy of a given set — binding a
 * second would leave the first permanently deactivated for no benefit — so any
 * existing binding to the same awakener within this set is released first.
 * Binding across different sets is unrestricted, matching the game.
 */
export function bindCovenantCopy(
  roster: UserRoster,
  covenantId: string,
  copyId: string,
  awakenerId?: string
): UserRoster {
  const entry = getCovenantEntry(roster, covenantId)
  const copies = covenantCopies(entry).map((c) => {
    if (c.id === copyId) return { ...c, boundTo: awakenerId }
    if (awakenerId && c.boundTo === awakenerId) return { ...c, boundTo: undefined }
    return c
  })
  return setCovenantEntry(roster, covenantId, { copies })
}

function nextCopyOrdinal(copies: CovenantCopy[]): number {
  const used = copies
    .map((c) => Number(/copy-(\d+)$/.exec(c.id)?.[1] ?? 0))
    .filter((n) => Number.isFinite(n))
  return (used.length ? Math.max(...used) : 0) + 1
}

export function setCovenantEntry(
  roster: UserRoster,
  covenantId: string,
  entry: Partial<CovenantEntry>
): UserRoster {
  const current = getCovenantEntry(roster, covenantId)
  return {
    ...roster,
    covenants: {
      ...roster.covenants,
      [covenantId]: { ...current, ...entry },
    },
  }
}

export function getOwnedCovenantIds(roster: UserRoster): string[] {
  return Object.entries(roster.covenants)
    .filter(([, entry]) => entry.owned)
    .map(([id]) => id)
}

// ---------------------------------------------------------------------------
// Posse helpers
// ---------------------------------------------------------------------------

export function getPosseEntry(
  roster: UserRoster,
  posseId: string
): PosseEntry {
  return roster.posses[posseId] ?? { ...DEFAULT_POSSE_ENTRY }
}

export function setPosseEntry(
  roster: UserRoster,
  posseId: string,
  entry: Partial<PosseEntry>
): UserRoster {
  const current = getPosseEntry(roster, posseId)
  return {
    ...roster,
    posses: {
      ...roster.posses,
      [posseId]: { ...current, ...entry },
    },
  }
}

export function setPosseUnlocked(
  roster: UserRoster,
  posseId: string,
  unlocked: boolean
): UserRoster {
  return setPosseEntry(roster, posseId, { unlocked })
}

export function getUnlockedPosseIds(roster: UserRoster): string[] {
  return Object.entries(roster.posses)
    .filter(([, entry]) => entry.unlocked)
    .map(([id]) => id)
}

export function getUnlockedPosseCount(roster: UserRoster): number {
  return getUnlockedPosseIds(roster).length
}

// ---------------------------------------------------------------------------
// Settings helpers
// ---------------------------------------------------------------------------

export function setArcRuleset(
  roster: UserRoster,
  arcRuleset: ArcRuleset
): UserRoster {
  return {
    ...roster,
    settings: { ...roster.settings, arcRuleset },
  }
}

export function setKeeperLevel(
  roster: UserRoster,
  keeperLevel: number
): UserRoster {
  return { ...roster, keeperLevel }
}

/** Set how many of an acquisition item the player holds. */
export function setCurrency(
  roster: UserRoster,
  slug: string,
  count: number
): UserRoster {
  const next = { ...(roster.currencies ?? {}) }
  // Drop zeroes rather than storing them, so an exported roster stays small
  // and a future rename of a slug leaves no dead keys behind.
  if (count > 0) next[slug] = count
  else delete next[slug]
  return { ...roster, currencies: next }
}

// ---------------------------------------------------------------------------
// Stats / summary
// ---------------------------------------------------------------------------

export function getRosterSummary(roster: UserRoster) {
  const ownedAwakeners = getOwnedAwakenerIds(roster).length
  const ownedWheels = getOwnedWheelIds(roster).length
  const ownedCovenants = getOwnedCovenantIds(roster).length
  const unlockedPosses = getUnlockedPosseCount(roster)

  return {
    ownedAwakeners,
    ownedWheels,
    ownedCovenants,
    unlockedPosses,
  }
}
// ---------------------------------------------------------------------------
// Bulk ownership (own all / own none) — used by the roster tab toggles.
// Set `owned` for an explicit list of ids, leaving every other field intact.
// ---------------------------------------------------------------------------

export function setAllAwakenersOwned(
  roster: UserRoster,
  ids: string[],
  owned: boolean
): UserRoster {
  const awakeners = { ...roster.awakeners }
  for (const id of ids) {
    awakeners[id] = { ...getAwakenerEntry(roster, id), owned }
  }
  return { ...roster, awakeners }
}

export function setAllWheelsOwned(
  roster: UserRoster,
  ids: string[],
  owned: boolean
): UserRoster {
  const wheels = { ...roster.wheels }
  for (const id of ids) {
    wheels[id] = { ...getWheelEntry(roster, id), owned }
  }
  return { ...roster, wheels }
}

export function setAllCovenantsOwned(
  roster: UserRoster,
  ids: string[],
  owned: boolean
): UserRoster {
  const covenants = { ...roster.covenants }
  for (const id of ids) {
    covenants[id] = { ...getCovenantEntry(roster, id), owned }
  }
  return { ...roster, covenants }
}

export function setAllPossesUnlocked(
  roster: UserRoster,
  ids: string[],
  unlocked: boolean
): UserRoster {
  const posses = { ...roster.posses }
  for (const id of ids) {
    posses[id] = { ...getPosseEntry(roster, id), unlocked }
  }
  return { ...roster, posses }
}