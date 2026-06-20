// Test fixtures. A "full roster" owns every awakener, wheel, and covenant and
// has every posse unlocked, all maxed — the engine's best-case input. Built
// straight from the committed db/ snapshot so it tracks real data, not stubs.
import { getAwakeners, getWheels, getCovenants, getPosses } from '@/lib/db'
import type {
  UserRoster,
  AwakenerEntry,
  WheelEntry,
  CovenantEntry,
  PosseEntry,
} from '@/lib/types'

function ownedAwakener(): AwakenerEntry {
  return {
    owned: true,
    enlightenSlot: 'E0',
    enlightenCopies: 0,
    characterLevel: 80,
    skillLevels: {
      Strike: 1,
      Defense: 1,
      Skill1: 1,
      Skill2: 1,
      Rouse: 1,
      Exalt: 1,
      OverExalt: 0,
    },
    talentLevels: { madnessOmen: 0, soulforgeAptitude: 0, gnosticPotential: 0 },
  }
}

export function fullRoster(): UserRoster {
  const awakeners: Record<string, AwakenerEntry> = {}
  for (const id of Object.keys(getAwakeners())) awakeners[id] = ownedAwakener()

  const wheels: Record<string, WheelEntry> = {}
  for (const id of Object.keys(getWheels())) {
    wheels[id] = { owned: true, starLevel: 3, stackLevel: 12 }
  }

  const covenants: Record<string, CovenantEntry> = {}
  for (const id of Object.keys(getCovenants())) {
    covenants[id] = {
      owned: true,
      threePieceComplete: true,
      sixPieceComplete: true,
      completionPercent: 100,
    }
  }

  const posses: Record<string, PosseEntry> = {}
  for (const id of Object.keys(getPosses())) posses[id] = { unlocked: true }

  return {
    version: 1,
    lastUpdated: new Date('2026-01-01T00:00:00Z').toISOString(),
    keeperLevel: 80,
    awakeners,
    wheels,
    covenants,
    posses,
    settings: { arcRuleset: 'ASTRAL_REIGN' },
  }
}

/** Resolve an awakener id by its display name (throws if absent). */
export function awakenerIdByName(name: string): string {
  const awk = getAwakeners()
  const id = Object.keys(awk).find((k) => awk[k].name === name)
  if (!id) throw new Error(`No awakener named "${name}" in db snapshot`)
  return id
}