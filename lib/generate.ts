/** Generation orchestration.
The single entry point that turns a roster into ranked, fully-geared team
recommendations. It wires the deterministic pipeline end to end: select members
(generateCandidateTeams / solveDtide) → gear them and pick posses (assign.ts).

This is intentionally AI-free. The algorithm makes every decision; any AI layer
added later only narrates the result this returns. Kept as a plain function (no
Next.js dependency) so it is unit-testable and reusable by a route handler or a
server action. **/

import type { UserRoster, TeamRecommendation } from './types'
import { getAwakeners, getPosses } from './db'
import { generateCandidateTeams, solveDtide, type FilterOptions } from './filter'
import { buildTeamRecommendation, buildDtideRecommendation } from './assign'
import { getRosterSummary } from './roster'

export type GenerateMode = 'single' | 'dtide'

export interface GenerateRequest {
  roster: UserRoster
  // 'single' returns the top-ranked alternative team(s); 'dtide' returns a
  // 5-team lineup with no unit or wheel reused across teams.
  mode?: GenerateMode
  // Single-mode tuning (pinned units, preferred realm, min tier, max results).
  options?: FilterOptions
}

export interface GenerateResult {
  mode: GenerateMode
  teams: TeamRecommendation[]
  meta: {
    ownedAwakeners: number
    ownedWheels: number
    ownedCovenants: number
    unlockedPosses: number
    teamsReturned: number
    generatedAt: string
    warnings: string[]
  }
}

export function generateTeams(req: GenerateRequest): GenerateResult {
  const mode: GenerateMode = req.mode ?? 'single'
  const awakeners = getAwakeners()
  const posses = getPosses()
  const summary = getRosterSummary(req.roster)
  const warnings: string[] = []

  if (summary.ownedAwakeners < 4) {
    warnings.push(
      `Only ${summary.ownedAwakeners} awakeners owned — at least 4 are needed to form a team.`
    )
  }

  let teams: TeamRecommendation[] = []

  if (mode === 'dtide') {
    const solution = solveDtide(req.roster, awakeners)
    if (solution && solution.teams.length) {
      if (solution.teams.length < 5) {
        warnings.push(
          `Only ${solution.teams.length}/5 D-Tide teams could be formed from the owned roster.`
        )
      }
      // One shared wheel pool across all teams — a wheel is a physical item.
      teams = buildDtideRecommendation(solution.teams, req.roster, awakeners, posses)
    } else {
      warnings.push('Could not assemble a D-Tide lineup from the owned roster.')
    }
  } else {
    const candidates = generateCandidateTeams(req.roster, awakeners, req.options ?? {})
    if (candidates.length) {
      // Each alternative is a standalone team the player might field, so gear
      // them independently (a fresh wheel pool per team).
      teams = candidates.map((candidate, i) =>
        buildTeamRecommendation(candidate, i + 1, req.roster, awakeners, posses)
      )
    } else {
      warnings.push(
        'No valid team could be formed. Try lowering the minimum viability tier, ' +
          'unpinning units, or widening the realm filter.'
      )
    }
  }

  return {
    mode,
    teams,
    meta: {
      ...summary,
      teamsReturned: teams.length,
      generatedAt: new Date().toISOString(),
      warnings,
    },
  }
}