import { describe, it, expect } from 'vitest'
import {
  buildBreakpointAdvice,
  buildPullTargets,
  buildWheelTargets,
  buildMetaLineupStatus,
  findRoleGaps,
} from '@/lib/pull-advice'
import {
  getAwakeners,
  getWheels,
  getBisData,
  getMetaTeams,
  getWheelStarFloors,
  getPosses,
} from '@/lib/db'
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

  it('names the team the pull would slot into, drawn from units already owned', () => {
    // The point of the rewrite: recommendations are about THIS collection, so
    // every target has to show which owned characters it would play with.
    const owned = ['Kathigu-Ra', 'Clementine', 'Tinct', 'Horla', 'Thais']
    const roster = rosterOwning(owned)
    // Horla and Thais need to actually be built to count as fieldable.
    roster.awakeners[awakenerIdByName('Horla')].enlightenSlot = 'E1'

    const targets = buildPullTargets(awakeners, roster, 5)
    expect(targets.length).toBeGreaterThan(0)
    for (const t of targets) {
      expect(t.bestTeam, `${t.name} has no projected team`).toBeDefined()
      expect(t.bestTeam!.awakenerIds).toContain(t.awakenerId)
      expect(t.bestTeam!.awakenerIds).toHaveLength(4)
      // Every teammate must be someone the player owns.
      for (const id of t.bestTeam!.awakenerIds) {
        if (id === t.awakenerId) continue
        expect(roster.awakeners[id].owned, `${awakeners[id].name} is not owned`).toBe(true)
      }
    }
  })

  it('ranks the same character differently for two different collections', () => {
    // The old scoring was collection-blind — tier plus a role-gap bonus gave
    // every player the same list. Two rosters with disjoint cores should not
    // produce the same ordering.
    const ultra = rosterOwning(['Clementine', 'Tinct', 'Horla', 'Casiah'])
    ultra.awakeners[awakenerIdByName('Horla')].enlightenSlot = 'E1'
    const caro = rosterOwning(['Thais', 'Agrippa', 'Aigis', 'Pickman'])

    const a = buildPullTargets(awakeners, ultra, 6).map((t) => t.name)
    const b = buildPullTargets(awakeners, caro, 6).map((t) => t.name)
    expect(a).not.toEqual(b)
  })

  it('says what it is asking you to pull to, not just who', () => {
    const targets = buildPullTargets(awakeners, rosterOwning(['Kathigu-Ra', 'Clementine', 'Tinct', 'Thais']))
    for (const t of targets) {
      expect(t.entryPoint).toBeTruthy()
      expect(t.reasons.length).toBeGreaterThan(0)
    }
  })
})

describe('wheel targets', () => {
  it('asks for nothing when the collection is complete', () => {
    expect(
      buildWheelTargets(awakeners, wheels, bis, fullRoster(), getWheelStarFloors())
    ).toHaveLength(0)
  })

  it('only chases wheels for characters the roster actually fields', () => {
    const owned = ['Thais', 'Clementine', 'Tinct', 'Horla']
    const roster = rosterOwning(owned)
    // Horla's floor is E1; the rest are E0, so all four count as fieldable.
    roster.awakeners[awakenerIdByName('Horla')].enlightenSlot = 'E1'
    for (const id of Object.keys(roster.wheels)) {
      roster.wheels[id] = { ...roster.wheels[id], owned: false }
    }

    const targets = buildWheelTargets(awakeners, wheels, bis, roster, getWheelStarFloors())
    expect(targets.length).toBeGreaterThan(0)
    const ownedIds = new Set(owned.map(awakenerIdByName))
    for (const t of targets) {
      for (const u of t.wantedBy) {
        expect(ownedIds.has(u.id), `${u.name} is not in the roster`).toBe(true)
      }
    }
  })

  it('flags an owned wheel sitting below its recorded ascension floor', () => {
    const floors = getWheelStarFloors()
    const [wheelId] = Object.keys(floors)
    expect(wheelId, 'wheel-floors.json should seed at least one entry').toBeTruthy()

    const owner = wheels[wheelId].ownerAwakenerId!
    // Own the wheel's character and enough teammates to form a team, so the
    // owner is genuinely fielded rather than merely present in the collection.
    const roster = rosterOwning([
      awakeners[owner].name,
      'Clementine',
      'Tinct',
      'Horla',
    ])
    roster.awakeners[awakenerIdByName('Horla')].enlightenSlot = 'E1'
    roster.wheels[wheelId] = { ...roster.wheels[wheelId], owned: true, starLevel: 0 }

    const targets = buildWheelTargets(awakeners, wheels, bis, roster, floors)
    const hit = targets.find((t) => t.wheelId === wheelId)
    expect(hit?.owned).toBe(true)
    expect(hit?.recommendedStarFloor).toBe(floors[wheelId].starFloor)
    expect(hit?.wantedBy.some((u) => u.id === owner)).toBe(true)
  })
})

describe('meta lineups', () => {
  it('renders every curated comp through the generated-team format', () => {
    // The Meta tab reuses TeamFormation, so a curated comp has to arrive as a
    // real TeamRecommendation — gear, posse, and analysis included — rather
    // than as a name list the UI would have to render some other way.
    const status = buildMetaLineupStatus(metaTeams, awakeners, fullRoster(), getPosses(), wheels)
    for (const s of status) {
      expect(s.recommendation.composition.length).toBeGreaterThan(0)
      expect(s.recommendation.analysis).toBeDefined()
      expect(s.recommendation.composition[0].wheelAssignments).toBeDefined()
    }
  })

  it('always renders a fully geared comp, whatever the player owns', () => {
    // This section is a reference for the finished composition, so an empty
    // collection must still show every unit with two wheels and a covenant —
    // no "X is not owned" / "X is missing recommended wheels" noise under the
    // card. Ownership is reported in `missing` instead.
    const status = buildMetaLineupStatus(metaTeams, awakeners, emptyRoster(), getPosses(), wheels)
    for (const s of status) {
      expect(s.recommendation.investmentWarnings).toEqual([])
      expect(s.recommendation.composition).toHaveLength(4)
      for (const member of s.recommendation.composition) {
        expect(member.wheelAssignments, `${member.awakenerId} has no wheels`).toHaveLength(2)
        for (const w of member.wheelAssignments) {
          expect(w.tier, `${member.awakenerId} has an unfilled wheel slot`).not.toBe('FALLBACK')
        }
        expect(member.covenantRecommendation).toBeDefined()
      }
      expect(s.recommendation.posseRecommendations.length).toBeGreaterThan(0)
    }
  })

  it('still reports what the player is missing, separately from the card', () => {
    const roster = rosterOwning(['Kathigu-Ra'])
    const status = buildMetaLineupStatus(metaTeams, awakeners, roster, getPosses(), wheels)
    const partial = status.find((s) => s.missing.length > 0)!
    expect(partial.missing.length).toBeGreaterThan(0)
    expect(partial.recommendation.investmentWarnings).toEqual([])
  })

  it('shows nothing missing on a full roster, but still flags unbuilt members', () => {
    // fullRoster() owns every character at E0, which is not the same as having
    // built them: several curated comps contain units whose floor is E1 or
    // higher (Horla, Pollux). Owning the comp and being able to run it are
    // different questions and the tab answers both.
    const status = buildMetaLineupStatus(metaTeams, awakeners, fullRoster(), getPosses(), wheels)
    expect(status.length).toBe(metaTeams.length)
    expect(status.every((s) => s.missing.length === 0)).toBe(true)
    for (const s of status) {
      if (!s.complete) expect(s.belowFloor.length).toBeGreaterThan(0)
    }
  })

  it('counts what is missing and puts the closest comps first', () => {
    const roster = rosterOwning(['Kathigu-Ra', 'Clementine', 'Tinct'])
    const status = buildMetaLineupStatus(metaTeams, awakeners, roster, getPosses(), wheels)
    expect(status[0].missing.length).toBeLessThanOrEqual(status[status.length - 1].missing.length)
    const partial = status.find((s) => s.ownedCount > 0 && s.missing.length > 0)
    expect(partial?.missing.length).toBeGreaterThan(0)
  })
})
