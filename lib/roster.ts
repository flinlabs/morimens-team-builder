import type {
  UserRoster,
  AwakenerEntry,
  WheelEntry,
  CovenantEntry,
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
  sixPieceComplete: false,
  completionPercent: 0,
}

const DEFAULT_POSSE_ENTRY: PosseEntry = {
  unlocked: false,
}

const DEFAULT_SETTINGS: AppSettings = {
  arcRuleset: 'FADED_LEGACY',
}

export function createEmptyRoster(): UserRoster {
  return {
    version: 1,
    lastUpdated: new Date().toISOString(),
    keeperLevel: 1,
    awakeners: {},
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
    const parsed = JSON.parse(raw) as UserRoster
    // Future: handle version migrations here
    return parsed
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