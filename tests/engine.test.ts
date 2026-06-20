// Invariant tests for the deterministic team engine. These assert the game
// rules hold for *any* generated team rather than freezing one exact output,
// so legitimate data updates (a new character, a re-tuned score) don't break
// them — but a rule regression does.
import { describe, it, expect } from 'vitest'
import { generateTeams } from '@/lib/generate'
import { generateCandidateTeams } from '@/lib/filter'
import { getAwakeners, getPosses } from '@/lib/db'
import { fullRoster } from './helpers'

const awakeners = getAwakeners()
const posses = getPosses()

const isAssault = (id: string) => awakeners[id]?.type === 'ASSAULT'
const realmOf = (id: string) => awakeners[id]?.realm
const isMainDps = (id: string) =>
  (awakeners[id]?.annotation?.teamRoles ?? []).includes('main_dps')
const needsLemurianTeam = (id: string) =>
  awakeners[id]?.annotation?.requiresCondition === 'lemurian_team_arc2'

// Posses keyed by the awakener that owns them.
const posseByOwner: Record<string, string> = {}
for (const p of Object.values(posses)) {
  if (p.ownerAwakenerId) posseByOwner[p.ownerAwakenerId] = p.id
}

describe('single-mode team generation', () => {
  const result = generateTeams({ roster: fullRoster(), mode: 'single' })

  it('returns at least one team', () => {
    expect(result.teams.length).toBeGreaterThan(0)
  })

  it('every team fields exactly four distinct awakeners', () => {
    for (const team of result.teams) {
      const ids = team.composition.map((c) => c.awakenerId)
      expect(ids).toHaveLength(4)
      expect(new Set(ids).size).toBe(4)
    }
  })

  it('the algorithmic builder never proposes more than one ASSAULT unit', () => {
    // The 1-ASSAULT cap is a generator heuristic (carries are resource-hungry),
    // not a hard game law. Curated meta teams are deliberately exempt — real
    // comps like Arachne Singularity field two — so this targets the builder
    // directly rather than the meta-first generated output.
    const cands = generateCandidateTeams(fullRoster(), awakeners, {})
    expect(cands.length).toBeGreaterThan(0)
    for (const c of cands) {
      const assaults = c.awakenerIds.filter(isAssault)
      expect(assaults.length).toBeLessThanOrEqual(1)
    }
  })

  it('never assigns the same covenant set to two units on a team', () => {
    for (const team of result.teams) {
      const cov = team.composition
        .map((c) => c.covenantRecommendation?.covenantId)
        .filter((id): id is string => !!id)
      expect(new Set(cov).size).toBe(cov.length)
    }
  })

  it('only fields the Lemurian-gated carry on an all-Aequor/Chaos team', () => {
    for (const team of result.teams) {
      const ids = team.composition.map((c) => c.awakenerId)
      if (!ids.some(needsLemurianTeam)) continue
      for (const id of ids) {
        expect(['AEQUOR', 'CHAOS']).toContain(realmOf(id))
      }
    }
  })

  it('leads with the carry’s own posse, not a support’s bonus posse', () => {
    for (const team of result.teams) {
      const ids = team.composition.map((c) => c.awakenerId)
      const carryPosseOwners = ids.filter(
        (id) => isMainDps(id) && posseByOwner[id]
      )
      if (carryPosseOwners.length === 0) continue // no carry owns a posse
      const top = team.posseRecommendations[0]
      expect(top).toBeTruthy()
      const ownerOfTop = posses[top.posseId]?.ownerAwakenerId
      // The chosen posse must belong to a main_dps that is on this team.
      expect(ownerOfTop && isMainDps(ownerOfTop) && ids.includes(ownerOfTop)).toBe(
        true
      )
      expect(top.priority).toBe('lead')
    }
  })
})

describe('D-Tide (five-board) generation', () => {
  const result = generateTeams({ roster: fullRoster(), mode: 'dtide' })

  it('fills boards without repeating an awakener across teams', () => {
    const seen = new Set<string>()
    for (const team of result.teams) {
      for (const c of team.composition) {
        expect(seen.has(c.awakenerId)).toBe(false)
        seen.add(c.awakenerId)
      }
    }
  })

  it('never equips the same real wheel on two units across all boards', () => {
    const seen = new Set<string>()
    for (const team of result.teams) {
      for (const c of team.composition) {
        for (const w of c.wheelAssignments) {
          if (w.tier === 'FALLBACK' || !w.wheelId) continue
          expect(seen.has(w.wheelId)).toBe(false)
          seen.add(w.wheelId)
        }
      }
    }
  })
})