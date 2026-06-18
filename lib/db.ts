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
  return readDB<Record<string, EnrichedAwakener>>('awakeners.json')
}

export function getWheels(): Record<string, EnrichedWheel> {
  return readDB<Record<string, EnrichedWheel>>('wheels.json')
}

export function getCovenants(): Record<string, EnrichedCovenant> {
  return readDB<Record<string, EnrichedCovenant>>('covenants.json')
}

export function getPosses(): Record<string, EnrichedPosse> {
  return readDB<Record<string, EnrichedPosse>>('posses.json')
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