import { describe, it, expect } from 'vitest'
import {
  createEmptyRoster,
  migrateRoster,
  STARTER_AWAKENER_IDS,
  getAwakenerEntry,
  ROSTER_VERSION,
} from '@/lib/roster'
import type { UserRoster } from '@/lib/types'
import { getAwakeners } from '@/lib/db'

/* ---------------------------------------------------------------------------
   Starter characters.

   Doll, Lotan, Ogier and Ramona are handed out through the story, so a fresh
   roster should already have them. The list is hardcoded in lib/roster.ts
   because that module runs on the client and cannot read db/awakeners.json —
   these tests are what keep the hardcoded list honest.
--------------------------------------------------------------------------- */

const awakeners = getAwakeners()

describe('starter roster', () => {
  it('is exactly the SR set, so a fifth SR cannot ship unnoticed', () => {
    // The derivation the hardcoded list stands in for. If this fails, either a
    // new SR was added and belongs in STARTER_AWAKENER_IDS, or one of these is
    // no longer SR and should come out.
    const srIds = Object.values(awakeners)
      .filter((a) => a.rarity === 'SR')
      .map((a) => a.id)
      .sort()
    expect([...STARTER_AWAKENER_IDS].sort()).toEqual(srIds)
  })

  it('names the characters we think it names', () => {
    const names = STARTER_AWAKENER_IDS.map((id) => awakeners[id]?.name).sort()
    expect(names).toEqual(['Doll', 'Lotan', 'Ogier', 'Ramona'])
  })

  it('only covers the base forms, not their EX variants', () => {
    // Doll: Inferno, Lotan: Cetarchon and Ramona: Timeworn are separate limited
    // characters. Handing them out free would badly distort every score.
    for (const id of STARTER_AWAKENER_IDS) {
      expect(awakeners[id].name).not.toContain(':')
      expect(awakeners[id].availabilityType).toBe('WELFARE')
    }
  })

  it('starts a new roster owning all four and nothing else', () => {
    const roster = createEmptyRoster()
    for (const id of STARTER_AWAKENER_IDS) {
      expect(getAwakenerEntry(roster, id).owned, `${awakeners[id].name} not owned`).toBe(true)
    }
    const owned = Object.entries(roster.awakeners).filter(([, e]) => e.owned)
    expect(owned).toHaveLength(STARTER_AWAKENER_IDS.length)
  })

  it('leaves the starters at E0 and level 1, owned but uninvested', () => {
    const roster = createEmptyRoster()
    for (const id of STARTER_AWAKENER_IDS) {
      const entry = getAwakenerEntry(roster, id)
      expect(entry.enlightenSlot).toBe('E0')
      expect(entry.characterLevel).toBe(1)
    }
  })
})

describe('migration of existing rosters', () => {
  function v1Roster(awakeners: UserRoster['awakeners'] = {}): UserRoster {
    return { ...createEmptyRoster(), version: 1, awakeners }
  }

  it('seeds the starters into a roster saved before they were defaulted', () => {
    const migrated = migrateRoster(v1Roster())
    for (const id of STARTER_AWAKENER_IDS) {
      expect(getAwakenerEntry(migrated, id).owned).toBe(true)
    }
    expect(migrated.version).toBe(ROSTER_VERSION)
  })

  it('respects a starter the player deliberately unticked', () => {
    // Entries are sparse, so an explicit `owned: false` can only have got there
    // by the player setting it. Overwriting that would be the app arguing with
    // someone about their own collection.
    const doll = STARTER_AWAKENER_IDS[0]
    const migrated = migrateRoster(
      v1Roster({ [doll]: { ...getAwakenerEntry(createEmptyRoster(), doll), owned: false } })
    )
    expect(getAwakenerEntry(migrated, doll).owned).toBe(false)
    // The others still get seeded.
    expect(getAwakenerEntry(migrated, STARTER_AWAKENER_IDS[1]).owned).toBe(true)
  })

  it('preserves investment already recorded on a starter', () => {
    const lotan = STARTER_AWAKENER_IDS[1]
    const built = { ...getAwakenerEntry(createEmptyRoster(), lotan), owned: true, characterLevel: 80 }
    const migrated = migrateRoster(v1Roster({ [lotan]: built }))
    expect(getAwakenerEntry(migrated, lotan).characterLevel).toBe(80)
  })

  it('is idempotent and leaves a current roster untouched', () => {
    const current = createEmptyRoster()
    expect(migrateRoster(current)).toBe(current)
    expect(migrateRoster(migrateRoster(v1Roster())).version).toBe(ROSTER_VERSION)
  })
})
