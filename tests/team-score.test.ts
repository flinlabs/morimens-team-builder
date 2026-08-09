import { describe, it, expect } from 'vitest'
import { buildCandidateTeam } from '@/lib/filter'
import { buildTeamRecommendation } from '@/lib/assign'
import { getAwakeners, getMetaTeams, getPosses } from '@/lib/db'
import { fullRoster, awakenerIdByName } from './helpers'

/* ---------------------------------------------------------------------------
   Score transparency.

   The score is what the generator ranks by, so surfacing it is only useful if
   the displayed number and the ranking number are the same one, and if the
   breakdown actually adds up. Both are pinned here — a breakdown that drifted
   from the total would be worse than showing nothing, because it would look
   authoritative while misattributing whichever term is misbehaving.
--------------------------------------------------------------------------- */

const awakeners = getAwakeners()
const roster = fullRoster()
const metaTeams = getMetaTeams().teams

describe('score breakdown', () => {
  it('sums to the reported score for every curated comp', () => {
    for (const team of metaTeams) {
      const candidate = buildCandidateTeam(team.awakenerIds, awakeners, roster)
      const sum = (candidate.scoreBreakdown ?? []).reduce((a, c) => a + c.value, 0)
      // The score is rounded to two places, so half a cent of slack is exactly
      // right — plus a float epsilon, since a sum landing precisely on the
      // rounding boundary (1.065 → 1.07) is a real and common case.
      expect(
        Math.abs(sum - candidate.score),
        `${team.name}: components sum to ${sum} but score is ${candidate.score}`
      ).toBeLessThanOrEqual(0.005 + 1e-9)
    }
  })

  it('names every term, so nothing is hidden in an unlabelled remainder', () => {
    const candidate = buildCandidateTeam(metaTeams[0].awakenerIds, awakeners, roster)
    const labels = (candidate.scoreBreakdown ?? []).map((c) => c.label)
    expect(labels).toEqual([
      'Investment',
      'Synergy',
      'Chaos splash',
      'Realm mixing',
      'Unmet conditions',
      'Isolated carry',
    ])
    for (const c of candidate.scoreBreakdown ?? []) {
      expect(c.detail.length, `${c.label} has no explanation`).toBeGreaterThan(40)
    }
  })

  it('reports penalties as negative, so the arithmetic reads correctly', () => {
    // An Ultra carry with no Ultra support trips the isolated-carry penalty.
    const isolated = [
      awakenerIdByName('Pollux'),
      awakenerIdByName('Thais'),
      awakenerIdByName('Pickman'),
      awakenerIdByName('Faint'),
    ]
    const candidate = buildCandidateTeam(isolated, awakeners, roster)
    const penalty = candidate.scoreBreakdown!.find((c) => c.label === 'Isolated carry')!
    expect(penalty.value).toBeLessThan(0)
    // And it shows up in the player-facing gaps, not only in the arithmetic.
    // Realms are upper-case in the data; the note interpolates them verbatim.
    expect(candidate.coverageGaps.some((g) => /only ULTRA member/.test(g))).toBe(true)
  })

  it('scores a curated comp well above a thrown-together four', () => {
    // The calibration the explainer panel quotes. If this inverts, the numbers
    // in TeamScore.tsx are lying to the player.
    const curated = buildCandidateTeam(metaTeams[0].awakenerIds, awakeners, roster).score
    const arbitrary = buildCandidateTeam(
      Object.keys(awakeners).slice(0, 4),
      awakeners,
      roster
    ).score
    expect(curated).toBeGreaterThan(arbitrary)
    expect(curated).toBeGreaterThan(0.9)
  })
})

describe('score reaches the UI', () => {
  it('rides along on the recommendation rather than being recomputed', () => {
    // Same object, same number. A parallel calculation for display would be
    // free to disagree with the ranking, which is the one thing this feature
    // must not do.
    const candidate = buildCandidateTeam(metaTeams[0].awakenerIds, awakeners, roster)
    const rec = buildTeamRecommendation(candidate, 1, roster, awakeners, getPosses())
    expect(rec.score).toBe(candidate.score)
    expect(rec.scoreBreakdown).toEqual(candidate.scoreBreakdown)
  })

  it('still scores a partial board, since that is what a half-built team is', () => {
    const partial = [awakenerIdByName('Thais'), awakenerIdByName('Clementine')]
    const candidate = buildCandidateTeam(partial, awakeners, roster)
    expect(candidate.score).toBeGreaterThan(0)
    expect(candidate.scoreBreakdown?.length).toBe(6)
  })
})
