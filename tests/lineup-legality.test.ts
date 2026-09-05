import { describe, it, expect } from 'vitest'
import { buildPullTargets } from '@/lib/pull-advice'
import { generateTeams } from '@/lib/generate'
import { buildTeamRecommendation } from '@/lib/assign'
import { buildCandidateTeam, getRealmsInTeam, baseCharacterName } from '@/lib/filter'
import { getAwakeners, getPosses } from '@/lib/db'
import { fullRoster, awakenerIdByName } from './helpers'
import type { UserRoster } from '@/lib/types'

/* ---------------------------------------------------------------------------
   Two rules the game enforces that the tool was breaking.

   1. A team holds at most two distinct realms, and never two variants of one
      base character. The generator checked this; the Meta tab's "pull X and
      they'd slot into this team" beam did not, so it recommended pulling
      Mouchette (Chaos) into Aigis/Saya (Caro) + Pontos (Aequor) — three
      realms, unfieldable.

   2. A Wheel of Destiny is one physical item. Stacking copies merges them into
      one stronger wheel; +12 unlocks Overlimit Causality — two SSR wheels on a
      single character — not a second wheel to hand a teammate.
--------------------------------------------------------------------------- */

const awakeners = getAwakeners()
const posses = getPosses()

describe('Meta tab pull targets are fieldable lineups', () => {
  const roster = fullRoster()
  const targets = buildPullTargets(awakeners, roster, 20)

  it('returns recommendations to check', () => {
    expect(targets.length).toBeGreaterThan(0)
    expect(targets.some((t) => t.bestTeam)).toBe(true)
  })

  it('never proposes a team spanning three or more realms', () => {
    for (const target of targets) {
      if (!target.bestTeam) continue
      const realms = getRealmsInTeam(target.bestTeam.awakenerIds, awakeners)
      expect(
        realms.length,
        `${target.name} → ${target.bestTeam.awakenerNames.join(', ')} spans ${realms.join('/')}`
      ).toBeLessThanOrEqual(2)
    }
  })

  it('never proposes two variants of the same base character', () => {
    for (const target of targets) {
      if (!target.bestTeam) continue
      const bases = target.bestTeam.awakenerIds.map((id) => baseCharacterName(awakeners[id]))
      expect(
        new Set(bases).size,
        `${target.name} → ${target.bestTeam.awakenerNames.join(', ')}`
      ).toBe(bases.length)
    }
  })

  it('the specific report: Mouchette is never slotted beside Aigis, Saya and Pontos', () => {
    const mouchette = awakenerIdByName('Mouchette')
    const caroAequor = [
      awakenerIdByName('Aigis'),
      awakenerIdByName('Saya'),
      awakenerIdByName('Pontos'),
    ]
    const offender = targets.find(
      (t) =>
        t.bestTeam?.awakenerIds.includes(mouchette) &&
        caroAequor.every((id) => t.bestTeam!.awakenerIds.includes(id))
    )
    expect(offender).toBeUndefined()
  })
})

describe('a wheel is never worn by two characters at once', () => {
  // fullRoster() owns every wheel at +12, which is precisely the state that
  // used to unlock the bogus "second copy" path.
  const roster = fullRoster()

  it('single-team generation gives every slot a distinct wheel', () => {
    const result = generateTeams({ roster, mode: 'single' })
    expect(result.teams.length).toBeGreaterThan(0)
    for (const team of result.teams) {
      const ids = team.composition.flatMap((c) => c.wheelAssignments.map((w) => w.wheelId))
      const dupes = ids.filter((id, i) => ids.indexOf(id) !== i)
      expect(dupes, `duplicate wheel(s) in a generated team: ${dupes.join(', ')}`).toEqual([])
    }
  })

  it('the specific report: pinned Corposant with Helot: Catena, Salvador and Thais', () => {
    const ids = [
      awakenerIdByName('Corposant'),
      awakenerIdByName('Helot: Catena'),
      awakenerIdByName('Salvador'),
      awakenerIdByName('Thais'),
    ]
    const faded: UserRoster = {
      ...roster,
      settings: { ...roster.settings, arcRuleset: 'FADED_LEGACY' },
    }
    const candidate = buildCandidateTeam(ids, awakeners, faded)
    const rec = buildTeamRecommendation(candidate, 1, faded, awakeners, posses)
    const wheelIds = rec.composition.flatMap((c) => c.wheelAssignments.map((w) => w.wheelId))
    expect(new Set(wheelIds).size).toBe(wheelIds.length)
  })
})
