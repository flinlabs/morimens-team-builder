import { describe, it, expect } from 'vitest'
import { generateCandidateTeams } from '@/lib/filter'
import { generateTeams } from '@/lib/generate'
import { getViableAwakenerIds } from '@/lib/viability'
import { getAwakeners } from '@/lib/db'
import { fullRoster } from './helpers'
import type { UserRoster } from '@/lib/types'

/* ---------------------------------------------------------------------------
   Every built character has to be reachable.

   The search used to trim the pool to the 40 best-scored units before it
   enumerated anything, so the bottom of a deep roster could never appear in a
   suggestion no matter how many times Generate was pressed — the cut was by
   absolute viability, so it discarded the same units every time. Being ranked
   low is fine; being unreachable is not.
--------------------------------------------------------------------------- */

const awakeners = getAwakeners()

/** Every character owned and built past the viability floor. */
function builtRoster(): UserRoster {
  const roster: any = fullRoster()
  for (const id of Object.keys(roster.awakeners)) {
    const e = roster.awakeners[id]
    e.enlightenSlot = 'E1'
    e.characterLevel = 90
    e.skillLevels = { Strike: 5, Defense: 5, Skill1: 5, Skill2: 5, Rouse: 5, Exalt: 5, OverExalt: 0 }
  }
  return roster as UserRoster
}

describe('search covers the whole roster', () => {
  const roster = builtRoster()

  it('every viable owned character appears in at least one candidate team', () => {
    const candidates = generateCandidateTeams(roster, awakeners, { maxResults: 80 })
    const represented = new Set(candidates.flatMap((c) => c.awakenerIds))
    const viable = getViableAwakenerIds(roster, awakeners, 2)
    const missing = viable.filter((id) => !represented.has(id)).map((id) => awakeners[id]?.name)
    expect(missing, `never suggested: ${missing.join(', ')}`).toEqual([])
  })

  it('no character is over-represented in the candidate slice', () => {
    const candidates = generateCandidateTeams(roster, awakeners, { maxResults: 80 })
    const counts = new Map<string, number>()
    for (const c of candidates) {
      for (const id of c.awakenerIds) counts.set(id, (counts.get(id) ?? 0) + 1)
    }
    // The greedy pass caps any unit at 8 of the slice. The representation pass
    // is allowed a little more room (8 + 4) so that introducing a rare
    // character is not blocked by whoever their best teammate happens to be —
    // but it is bounded, which it was not before. Corposant is the unit to
    // watch: he covers seven team roles and satisfies the minimum-coverage
    // gate on his own, so he rides along on more candidates than anyone.
    const worst = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]
    expect(worst[1], `${awakeners[worst[0]]?.name} appears ${worst[1]} times`).toBeLessThanOrEqual(12)
  })

  it('repeated Generate presses rotate through most of the roster', () => {
    const shown = new Set<string>()
    const excludeTeamKeys: string[] = []
    for (let press = 0; press < 8; press++) {
      const result = generateTeams({
        roster,
        mode: 'single',
        options: { excludeTeamKeys: [...excludeTeamKeys] },
      })
      for (const team of result.teams) {
        excludeTeamKeys.push(team.composition.map((c) => c.awakenerId).sort().join('|'))
        for (const c of team.composition) shown.add(c.awakenerId)
      }
    }
    // Eight presses show 48 team slots; on a 60-character roster that cannot
    // reach everyone, but it must reach well past the 40 the old pool cap
    // allowed to exist at all.
    expect(shown.size).toBeGreaterThanOrEqual(45)
  })
})
