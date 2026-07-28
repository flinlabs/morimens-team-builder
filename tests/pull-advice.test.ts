import { describe, it, expect } from 'vitest'
import {
  buildBreakpointAdvice,
  buildPullTargets,
  buildWheelTargets,
  buildMetaLineupStatus,
  findRoleGaps,
} from '@/lib/pull-advice'
import { getAwakeners, getWheels, getBisData, getMetaTeams, getWheelStarFloors } from '@/lib/db'
import { fullRoster, awakenerIdByName } from './helpers'
import type { UserRoster } from '@/lib/types'

/* ---------------------------------------------------------------------------
   Meta tab advice.

   Every number here traces back to a hand-written annotation field, so these
   tests double as a check that the annotation data says what the guides say.
--------------------------------------------------------------------------- */

const awakeners = getAwakeners()
const wheels = getWheels()
const bis = getBisData()
const metaTeams = getMetaTeams().teams

/** A roster owning nobody — the new-player case the tab is aimed at. */
function emptyRoster(): UserRoster {
  const roster = fullRoster()
  const owned: UserRoster['awakeners'] = {}
  for (const [id, entry] of Object.entries(roster.awakeners)) {
    owned[id] = { ...entry, owned: false }
  }
  return { ...roster, awakeners: owned }
}

/** A roster owning exactly the named characters, each at E0. */
function rosterOwning(names: string[]): UserRoster {
  const roster = emptyRoster()
  for (const name of names) {
    const id = awakenerIdByName(name)
    roster.awakeners[id] = { ...roster.awakeners[id], owned: true, enlightenSlot: 'E0' }
  }
  return roster
}

describe('breakpoint advice', () => {
  const advice = buildBreakpointAdvice(awakeners, fullRoster())
  const byName = (name: string) => advice.find((a) => a.name === name)!

  it('reads Horla as done at E1, her recorded floor', () => {
    // Cheri lists E1 as her stopping point and the annotation agrees.
    const horla = byName('Horla')
    expect(horla.viabilityFloor).toBe('E1')
    expect(horla.breakpoints[0]).toBe('E1')
  })

  it('names the last breakpoint as the stopping point', () => {
    const thais = byName('Thais')
    expect(thais.breakpoints).toContain('E2')
    expect(thais.stoppingPoint).toBe(thais.breakpoints[thais.breakpoints.length - 1])
  })

  it('flags a character sitting below their floor as the best place to spend', () => {
    // Pollux needs E1; a roster owning him at E0 should say so.
    const roster = rosterOwning(['Pollux'])
    const pollux = buildBreakpointAdvice(awakeners, roster).find((a) => a.name === 'Pollux')!
    expect(pollux.status).toBe('below_floor')
    expect(pollux.note).toMatch(/E1/)
  })

  it('sorts under-invested owned characters above everything else', () => {
    const roster = rosterOwning(['Pollux', 'Horla'])
    const sorted = buildBreakpointAdvice(awakeners, roster)
    expect(sorted[0].status).toBe('below_floor')
  })
})

describe('pull targets', () => {
  it('recommends nobody when everything is owned', () => {
    expect(buildPullTargets(awakeners, fullRoster())).toHaveLength(0)
  })

  it('ranks a gap-filler above a stronger character who fills no gap', () => {
    // A roster of four carries and nothing else has no Keyflare bot, no
    // shielder, no appliers. Whoever tops the list must cover one of those.
    const roster = rosterOwning(['Pollux', 'Mouchette', 'Kathigu-Ra', 'Lotan'])
    const gaps = new Set(findRoleGaps(awakeners, roster).map((g) => g.role))
    expect(gaps.size).toBeGreaterThan(0)

    const top = buildPullTargets(awakeners, roster)[0]
    const roles = awakeners[top.awakenerId].annotation?.teamRoles ?? []
    expect(roles.some((r) => gaps.has(r))).toBe(true)
  })

  it('says what it is asking you to pull to, not just who', () => {
    const targets = buildPullTargets(awakeners, emptyRoster())
    for (const t of targets) {
      expect(t.entryPoint).toBeTruthy()
      expect(t.reasons.length).toBeGreaterThan(0)
    }
  })

  it('penalises characters that need heavy investment before they work', () => {
    const targets = buildPullTargets(awakeners, emptyRoster(), 60)
    const expensive = targets.filter((t) => t.entryPoint === 'E3')
    for (const t of expensive) {
      expect(t.reasons.some((r) => /Needs E3/.test(r))).toBe(true)
    }
  })
})

describe('wheel targets', () => {
  it('asks for nothing when the collection is complete', () => {
    expect(
      buildWheelTargets(awakeners, wheels, bis, fullRoster(), getWheelStarFloors())
    ).toHaveLength(0)
  })

  it('chases a BiS wheel for a character you run but not for one you do not', () => {
    const roster = rosterOwning(['Horla'])
    // Horla needs E1; give it to her so she counts as fielded.
    roster.awakeners[awakenerIdByName('Horla')].enlightenSlot = 'E1'
    for (const id of Object.keys(roster.wheels)) roster.wheels[id] = { ...roster.wheels[id], owned: false }

    const targets = buildWheelTargets(awakeners, wheels, bis, roster, getWheelStarFloors())
    expect(targets.every((t) => t.forAwakenerName === 'Horla')).toBe(true)
    expect(targets.length).toBeGreaterThan(0)
  })

  it('flags an owned wheel sitting below its recorded ascension floor', () => {
    const floors = getWheelStarFloors()
    const [wheelId] = Object.keys(floors)
    expect(wheelId, 'wheel-floors.json should seed at least one entry').toBeTruthy()

    const owner = wheels[wheelId].ownerAwakenerId!
    const roster = fullRoster()
    roster.wheels[wheelId] = { ...roster.wheels[wheelId], owned: true, starLevel: 0 }

    const targets = buildWheelTargets(awakeners, wheels, bis, roster, floors)
    const hit = targets.find((t) => t.wheelId === wheelId)
    expect(hit?.owned).toBe(true)
    expect(hit?.recommendedStarFloor).toBe(floors[wheelId].starFloor)
    expect(awakeners[owner]).toBeDefined()
  })
})

describe('meta lineups', () => {
  it('shows nothing missing on a full roster, but still flags unbuilt members', () => {
    // fullRoster() owns every character at E0, which is not the same as having
    // built them: several curated comps contain units whose floor is E1 or
    // higher (Horla, Pollux). Owning the comp and being able to run it are
    // different questions and the tab answers both.
    const status = buildMetaLineupStatus(metaTeams, awakeners, fullRoster())
    expect(status.length).toBe(metaTeams.length)
    expect(status.every((s) => s.missing.length === 0)).toBe(true)
    for (const s of status) {
      if (!s.complete) expect(s.belowFloor.length).toBeGreaterThan(0)
    }
  })

  it('counts what is missing and puts the closest comps first', () => {
    const roster = rosterOwning(['Kathigu-Ra', 'Clementine', 'Tinct'])
    const status = buildMetaLineupStatus(metaTeams, awakeners, roster)
    expect(status[0].missing.length).toBeLessThanOrEqual(status[status.length - 1].missing.length)
    const partial = status.find((s) => s.ownedCount > 0 && s.missing.length > 0)
    expect(partial?.missing.length).toBeGreaterThan(0)
  })
})
