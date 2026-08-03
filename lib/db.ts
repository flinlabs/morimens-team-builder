import fs from 'fs'
import path from 'path'
import type {
  EnrichedAwakener,
  EnrichedWheel,
  EnrichedCovenant,
  EnrichedPosse,
  MetaTeamsFile,
} from './types'

const DB_DIR = path.join(process.cwd(), 'db')
const META_TEAMS_PATH = path.join(
  process.cwd(),
  'app',
  'admin',
  'annotations',
  'meta-teams.json'
)

function readDB<T>(filename: string): T {
  const filepath = path.join(DB_DIR, filename)
  const raw = fs.readFileSync(filepath, 'utf-8')
  return JSON.parse(raw) as T
}

// ---------------------------------------------------------------------------
// Getters — called server-side only (API routes, server components)
// ---------------------------------------------------------------------------

export function getAwakeners(): Record<string, EnrichedAwakener> {
  const all = readDB<Record<string, EnrichedAwakener>>('awakeners.json')
  // Merge the per-role tier grades onto the annotation so every consumer sees
  // them without a second lookup. Done at read time rather than baked into
  // db/awakeners.json so re-transcribing a republished tier list never touches
  // the hand-written annotations.
  const tiers = getTierLists()
  for (const [id, awakener] of Object.entries(all)) {
    const t = tiers[id]
    if (!t || !awakener.annotation) continue
    awakener.annotation.dpsRank = t.dpsRank as never
    awakener.annotation.supportRank = t.supportRank as never
    awakener.annotation.dpsFloor = t.dpsFloor as never
    awakener.annotation.supportFloor = t.supportFloor as never
  }
  return all
}

export function getWheels(): Record<string, EnrichedWheel> {
  return readDB<Record<string, EnrichedWheel>>('wheels.json')
}

export function getCovenants(): Record<string, EnrichedCovenant> {
  return readDB<Record<string, EnrichedCovenant>>('covenants.json')
}

/**
 * Player-equippable posses only.
 *
 * Lotan: Cetarchon's Primordial Breath replaces the team's Posse slot with
 * Primordia: Dual Recurrence / Triad Revelation, which discover from a pool of
 * eight "Primordial Memory" posses. Those are engine-internal: SKeyDB marks
 * them `equippable: false` and gives them no lineupToken, so they can never be
 * unlocked, picked, or written into a share code — the encoder would throw on
 * the missing token. Filtering here rather than at each call site means the
 * picker, the generator, the unlocked-posse count, and the codec all inherit
 * the exclusion. Records predating the field have no `equippable` key and stay
 * included.
 */
export function getPosses(): Record<string, EnrichedPosse> {
  const all = readDB<Record<string, EnrichedPosse>>('posses.json')
  return Object.fromEntries(
    Object.entries(all).filter(([, p]) => p.equippable !== false)
  )
}

/** Every posse including the engine-internal ones — for detail/reference views. */
export function getAllPosses(): Record<string, EnrichedPosse> {
  return readDB<Record<string, EnrichedPosse>>('posses.json')
}

export interface BisWheel {
  tier: string
  wheelId: string
  wheelName: string
}
export interface BisCovenant {
  covenantId: string
  covenantName: string
}
export interface BisVariant {
  variant: string
  wheels: BisWheel[]
  covenants: BisCovenant[]
  preferredStats: string[]
  notes: string
}
export interface BisEntry {
  awakenerId: string
  variants: BisVariant[]
}

let _bisCache: Record<string, BisEntry> | null = null
/** Per-character BiS wheels/covenants parsed from the Mythag Compendium tables. */
export function getBisData(): Record<string, BisEntry> {
  if (_bisCache) return _bisCache
  try {
    _bisCache = readDB<Record<string, BisEntry>>('bis.json')
  } catch {
    _bisCache = {}
  }
  return _bisCache
}

let _tierListCache: Record<string, TierListEntry> | null = null

export interface TierListEntry {
  name: string
  dpsRank?: string
  supportRank?: string
  dpsFloor?: string
  supportFloor?: string
  source?: string
}

/**
 * Per-role tier grades from annotations/tier-lists.json, merged onto each
 * awakener's annotation at load. Kept in its own file rather than inlined into
 * annotations/awakeners.json because the community re-publishes these lists as
 * a unit, and a separate file can be re-transcribed wholesale without touching
 * the hand-written notes and pairings.
 */
export function getTierLists(): Record<string, TierListEntry> {
  if (_tierListCache) return _tierListCache
  try {
    const raw = fs.readFileSync(
      path.join(process.cwd(), 'annotations', 'tier-lists.json'),
      'utf-8'
    )
    const parsed = JSON.parse(raw) as { ranks?: Record<string, TierListEntry> }
    _tierListCache = parsed.ranks ?? {}
  } catch {
    _tierListCache = {}
  }
  return _tierListCache
}

let _wheelFloorCache: Record<string, { starFloor: number; note?: string }> | null = null
/** Minimum useful ascension level per wheel, from annotations/wheel-floors.json. */
export function getWheelStarFloors(): Record<string, { starFloor: number; note?: string }> {
  if (_wheelFloorCache) return _wheelFloorCache
  try {
    const raw = fs.readFileSync(
      path.join(process.cwd(), 'annotations', 'wheel-floors.json'),
      'utf-8'
    )
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const out: Record<string, { starFloor: number; note?: string }> = {}
    for (const [id, value] of Object.entries(parsed)) {
      if (id.startsWith('_')) continue
      const v = value as { starFloor?: number; note?: string }
      if (typeof v?.starFloor === 'number') out[id] = { starFloor: v.starFloor, note: v.note }
    }
    _wheelFloorCache = out
  } catch {
    _wheelFloorCache = {}
  }
  return _wheelFloorCache
}

let _wheelPurposeCache: Record<string, string[]> | null = null
/** Hand-set purpose-tag overrides from annotations/wheels.json (see wheel-fit.ts). */
export function getWheelPurposeOverrides(): Record<string, string[]> {
  if (_wheelPurposeCache) return _wheelPurposeCache
  try {
    const raw = fs.readFileSync(
      path.join(process.cwd(), 'annotations', 'wheels.json'),
      'utf-8'
    )
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const out: Record<string, string[]> = {}
    for (const [k, v] of Object.entries(parsed)) {
      if (k.startsWith('_')) continue
      if (Array.isArray(v)) out[k] = v as string[]
    }
    _wheelPurposeCache = out
  } catch {
    _wheelPurposeCache = {}
  }
  return _wheelPurposeCache
}

// ---------------------------------------------------------------------------
// Convenience helpers
// ---------------------------------------------------------------------------

export function getAwakener(id: string): EnrichedAwakener | null {
  const awakeners = getAwakeners()
  return awakeners[id] ?? null
}

export function getWheel(id: string): EnrichedWheel | null {
  const wheels = getWheels()
  return wheels[id] ?? null
}

export function getCovenant(id: string): EnrichedCovenant | null {
  const covenants = getCovenants()
  return covenants[id] ?? null
}

export function getPosse(id: string): EnrichedPosse | null {
  const posses = getPosses()
  return posses[id] ?? null
}

export function getAnnotatedAwakeners(): Record<string, EnrichedAwakener> {
  const all = getAwakeners()
  return Object.fromEntries(
    Object.entries(all).filter(([, a]) => !a.annotationPending)
  )
}

export function getPendingAnnotationAwakeners(): EnrichedAwakener[] {
  const all = getAwakeners()
  return Object.values(all).filter(a => a.annotationPending)
}

export function getAwakenersByRealm(realm: string): EnrichedAwakener[] {
  const all = getAwakeners()
  return Object.values(all).filter(a => a.realm === realm)
}

export function getCombatWheels(): Record<string, EnrichedWheel> {
  const all = getWheels()
  return Object.fromEntries(
    Object.entries(all).filter(([, w]) => w.hasCombatEffect)
  )
}

// ---------------------------------------------------------------------------
// D-Tide / D-Effect Zone data (season list + enemy characteristics)
// ---------------------------------------------------------------------------

export interface DzoneData {
  seasons: unknown[]
  enemyCharacteristics: unknown
}

export function getDzones(): DzoneData {
  return readDB<DzoneData>('dzones.json')
}

// ---------------------------------------------------------------------------
// Meta-team reference (curated example compositions for the prompt-builder)
// ---------------------------------------------------------------------------

export function getMetaTeams(): MetaTeamsFile {
  const raw = fs.readFileSync(META_TEAMS_PATH, 'utf-8')
  return JSON.parse(raw) as MetaTeamsFile
}

// ---------------------------------------------------------------------------
// Generator-facing read helpers
// ---------------------------------------------------------------------------

export function getAwakenersByType(type: string): EnrichedAwakener[] {
  return Object.values(getAwakeners()).filter(a => a.type === type)
}

export function getDivineAwakeners(): EnrichedAwakener[] {
  return Object.values(getAwakeners()).filter(a => a.isDivineRealm)
}

export function getLemurians(): EnrichedAwakener[] {
  return Object.values(getAwakeners()).filter(a => a.isLemurian)
}

// Wheels tied to a specific awakener (excludes ownerless Mythic/standard wheels).
export function getWheelsForAwakener(awakenerId: string): EnrichedWheel[] {
  return Object.values(getWheels()).filter(w => w.ownerAwakenerId === awakenerId)
}

export function getMythicWheels(): EnrichedWheel[] {
  return Object.values(getWheels()).filter(w => w.isMythic)
}

export function getPossesByRealm(realm: string): EnrichedPosse[] {
  return Object.values(getPosses()).filter(p => p.realm === realm)
}

// Posses that grant a specific awakener a personal bonus (anchor-pick candidates).
export function getCharacterBonusPosses(): EnrichedPosse[] {
  return Object.values(getPosses()).filter(p => p.hasCharacterBonus)
}