/** Generation orchestration.
The single entry point that turns a roster into ranked, fully-geared team
recommendations. It wires the deterministic pipeline end to end: select members
(generateCandidateTeams / solveDtide) → gear them and pick posses (assign.ts).

This is intentionally AI-free. The algorithm makes every decision; any AI layer
added later only narrates the result this returns. Kept as a plain function (no
Next.js dependency) so it is unit-testable and reusable by a route handler or a
server action. **/

import type { UserRoster, TeamRecommendation, CandidateTeam, EnrichedAwakener } from './types'
import { getAwakeners, getPosses, getMetaTeams } from './db'
import {
  generateCandidateTeams,
  solveDtide,
  buildCandidateTeam,
  getRealmsInTeam,
  type FilterOptions,
} from './filter'
import { buildTeamRecommendation, buildDtideRecommendation } from './assign'
import { getRosterSummary, getAwakenerEntry } from './roster'

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

const teamKey = (ids: string[]): string => [...ids].sort().join('|')

/**
 * Curated meta compositions that the player can actually field: every member
 * owned, all pinned units present, and (if set) matching the preferred realm.
 * These are returned ahead of searched teams — a known-good comp beats a
 * heuristic one. A small score bump keeps them on top when merged.
 */
function metaCandidates(
  roster: UserRoster,
  awakeners: Record<string, EnrichedAwakener>,
  options: FilterOptions
): CandidateTeam[] {
  const pins = options.pinnedIds ?? []
  const out: CandidateTeam[] = []
  for (const t of getMetaTeams().teams) {
    const ids = t.awakenerIds ?? []
    if (ids.length !== 4) continue
    if (!ids.every((id) => awakeners[id] && getAwakenerEntry(roster, id).owned)) continue
    if (pins.length && !pins.every((p) => ids.includes(p))) continue
    if (options.preferredRealm) {
      const realms = getRealmsInTeam(ids, awakeners)
      if (!realms.includes(options.preferredRealm)) continue
    }
    const cand = buildCandidateTeam(ids, awakeners, roster)
    cand.metaName = t.name
    cand.metaSource = t.source
    cand.score = Math.round((cand.score + 1) * 100) / 100 // meta priority
    out.push(cand)
  }
  out.sort((a, b) => b.score - a.score)
  return out
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
    // Seed the solver with owned, non-overlapping meta comps so D-Tide is also
    // meta-first; the greedy solver fills the remaining teams around them.
    const metaAnchors: string[][] = []
    const used = new Set<string>()
    for (const c of metaCandidates(req.roster, awakeners, {})) {
      if (metaAnchors.length >= 5) break
      if (c.awakenerIds.some((id) => used.has(id))) continue
      c.awakenerIds.forEach((id) => used.add(id))
      metaAnchors.push(c.awakenerIds)
    }
    const solution = solveDtide(req.roster, awakeners, metaAnchors)
    if (solution && solution.teams.length) {
      if (solution.teams.length < 5) {
        warnings.push(
          `Only ${solution.teams.length}/5 D-Tide teams could be formed from the owned roster.`
        )
      }
      teams = buildDtideRecommendation(solution.teams, req.roster, awakeners, posses)
    } else {
      warnings.push('Could not assemble a D-Tide lineup from the owned roster.')
    }
  } else {
    const options = req.options ?? {}
    const maxResults = options.maxResults ?? 4
    // Meta comps first, then searched teams, de-duplicated by member set.
    const metaCands = metaCandidates(req.roster, awakeners, options)
    const searchCands = generateCandidateTeams(req.roster, awakeners, options)
    const seen = new Set<string>()
    const merged: CandidateTeam[] = []
    for (const c of [...metaCands, ...searchCands]) {
      const k = teamKey(c.awakenerIds)
      if (seen.has(k)) continue
      seen.add(k)
      merged.push(c)
    }
    if (merged.length) {
      teams = merged
        .slice(0, maxResults)
        .map((candidate, i) =>
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