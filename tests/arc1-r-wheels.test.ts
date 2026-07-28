import { describe, it, expect } from 'vitest'
import { assignWheels } from '@/lib/assign'
import { getAwakeners, getWheels } from '@/lib/db'
import { fullRoster } from './helpers'
import { COSTCO_WHEEL_IDS, ARC1_PRIORITY_R_WHEEL_IDS } from '@/lib/arc-rules'
import type { UserRoster } from '@/lib/types'

/* ---------------------------------------------------------------------------
   Arc 1 wheel priorities.

   arc-rules.ts has always known that R wheels keep their abilities in Faded
   Legacy, but the flag never reached assignWheels: Pass 2 ranked SR above R
   unconditionally and Pass 1.5 handed out idle SSRs first, so the Costco wheels
   the guides call mandatory for Arc 1 exploration were the last thing the
   engine would ever equip.
--------------------------------------------------------------------------- */

const awakeners = getAwakeners()
const wheels = getWheels()

function rosterInArc(arc: UserRoster['settings']['arcRuleset']): UserRoster {
  const roster = fullRoster()
  return { ...roster, settings: { ...roster.settings, arcRuleset: arc } }
}

// A support with no damage-side role — the profile the guides say should be
// holding R wheels in Faded Legacy.
const supportId = Object.values(awakeners).find(
  (a) => a.annotation?.teamRoles?.[0] === 'keyflare_support'
)!.id

const carryId = Object.values(awakeners).find(
  (a) => a.annotation?.teamRoles?.[0] === 'main_dps'
)!.id

describe('Arc 1 R wheels', () => {
  it('names the Costco trio the Compendium groups together', () => {
    const names = [...COSTCO_WHEEL_IDS].map((id) => wheels[id]?.name).sort()
    expect(names).toEqual(['Emerge', 'Frenzy', 'Greed'])
  })

  it('every priority R wheel is really an R wheel that still exists', () => {
    for (const id of ARC1_PRIORITY_R_WHEEL_IDS) {
      expect(wheels[id], `${id} is not in the wheel db`).toBeDefined()
      expect(wheels[id].rarity, `${wheels[id].name} is not R rarity`).toBe('R')
    }
  })

  it('puts an R wheel on a support in Faded Legacy', () => {
    const assigned = assignWheels(
      awakeners[supportId],
      rosterInArc('FADED_LEGACY'),
      new Set(),
      'keyflare_support'
    )
    const rarities = assigned.map((a) => wheels[a.wheelId]?.rarity)
    expect(rarities).toContain('R')
  })

  it('does not put an R wheel on the carry, whose stats do matter', () => {
    const assigned = assignWheels(
      awakeners[carryId],
      rosterInArc('FADED_LEGACY'),
      new Set(),
      'main_dps'
    )
    const rarities = assigned.map((a) => wheels[a.wheelId]?.rarity)
    expect(rarities).not.toContain('R')
  })

  it('leaves Astral Reign gearing alone — R wheels lose their abilities there', () => {
    const assigned = assignWheels(
      awakeners[supportId],
      rosterInArc('ASTRAL_REIGN'),
      new Set(),
      'keyflare_support'
    )
    // Every priority R wheel is owned in a full roster, so if the arc gate were
    // leaking they would surface here too.
    const ids = assigned.map((a) => a.wheelId)
    expect(ids.some((id) => ARC1_PRIORITY_R_WHEEL_IDS.includes(id))).toBe(false)
  })

  it('spreads Team Unique R wheels across supports instead of stacking copies', () => {
    const roster = rosterInArc('FADED_LEGACY')
    const supports = Object.values(awakeners)
      .filter((a) => a.annotation?.teamRoles?.[0] === 'keyflare_support')
      .slice(0, 3)
    const used = new Set<string>()
    const picked: string[] = []
    for (const support of supports) {
      const assigned = assignWheels(support, roster, used, 'keyflare_support')
      picked.push(...assigned.map((a) => a.wheelId))
    }
    expect(new Set(picked).size).toBe(picked.length)
  })

  it('explains the Faded Legacy pick on the assignment', () => {
    const assigned = assignWheels(
      awakeners[supportId],
      rosterInArc('FADED_LEGACY'),
      new Set(),
      'keyflare_support'
    )
    const rWheel = assigned.find((a) => wheels[a.wheelId]?.rarity === 'R')
    expect(rWheel?.arcNote).toMatch(/Faded Legacy/)
  })
})
