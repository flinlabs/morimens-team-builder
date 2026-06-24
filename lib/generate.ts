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
import { scoreViability } from './viability'

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
    // A curated comp is known-good, but that edge should track how built the
    // team actually is. We scale the bonus by the team's average viability, so a
    // fully-invested meta comp still leads while an owned-but-unleveled one (a
    // barely-built Tawil, say) no longer leapfrogs a well-invested engine team.
    const arc = roster.settings.arcRuleset
    const avgViab =
      ids.reduce((s, id) => {
        const v = scoreViability(id, getAwakenerEntry(roster, id), awakeners[id], roster, arc)
        return s + Math.max(0, Math.min(1, v.score))
      }, 0) / ids.length
    cand.score = Math.round((cand.score + 0.6 * avgViab) * 100) / 100
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
    const maxResults = options.maxResults ?? 6
    const metaCands = metaCandidates(req.roster, awakeners, options)
    // Pull a deeper slice of engine-built teams so the reserve below has real
    // variety to choose from, not just the top three.
    // Pull a generous slice so the novelty-preferring reserve below can reach
    // synergy-dense comps that tie-break just under the top cluster. A unit like
    // Saya, whose ideal poison comp scores a hundredth below the densest Ultra
    // teams, otherwise sits outside a shallow slice and never gets considered
    // despite being a distinct, guide-sanctioned team worth showing.
    const searchCands = generateCandidateTeams(req.roster, awakeners, {
      ...options,
      maxResults: Math.max(options.maxResults ?? 0, 30),
    })

    const seen = new Set<string>()
    const usedUnits = new Set<string>()
    const picked: CandidateTeam[] = []
    const push = (c: CandidateTeam): boolean => {
      const k = teamKey(c.awakenerIds)
      if (seen.has(k)) return false
      seen.add(k)
      picked.push(c)
      c.awakenerIds.forEach((id) => usedUnits.add(id))
      return true
    }

    // Curated meta comps lead (a known-good comp beats a heuristic one), but
    // reserve roughly a third of the slots for engine-built teams. Without this
    // the meta library crowds the algorithm out entirely on a full roster, so
    // strong units whose ideal comps aren't curated meta (e.g. Saya's poison or
    // counter teams) would never surface despite the engine building them well.
    const algoReserve = Math.min(searchCands.length, Math.max(1, Math.round(maxResults / 3)))
    const metaSlots = maxResults - algoReserve

    // Cap how many displayed meta teams may share any one unit. A carry like
    // Tawil sits in four curated comps, and without this he'd monopolise every
    // meta slot with near-identical teams instead of leaving room for variety.
    const META_CAP_PER_UNIT = 1
    const metaUnitUses = new Map<string, number>()
    const metaUnitsFull = (c: CandidateTeam): boolean =>
      c.awakenerIds.some((id) => (metaUnitUses.get(id) ?? 0) >= META_CAP_PER_UNIT)
    const pushMeta = (c: CandidateTeam): void => {
      if (metaUnitsFull(c)) return
      if (push(c)) c.awakenerIds.forEach((id) => metaUnitUses.set(id, (metaUnitUses.get(id) ?? 0) + 1))
    }

    for (const c of metaCands) {
      if (picked.length >= metaSlots) break
      pushMeta(c)
    }

    // Fill the reserve with engine-built teams. We pick the highest-scoring
    // comp that still introduces at least one unit not already on screen — a
    // novelty gate, not a novelty maximiser. Maximising raw new-unit count would
    // let a mediocre all-fresh comp beat an excellent comp that happens to share
    // a universal support (Thais) with a meta pick, which is how niche carries
    // like Saya got starved out.
    let reserved = 0
    while (reserved < algoReserve) {
      let best: CandidateTeam | null = null
      let bestScore = -Infinity
      let fallback: CandidateTeam | null = null
      let fallbackScore = -Infinity
      for (const c of searchCands) {
        if (seen.has(teamKey(c.awakenerIds))) continue
        if (c.score > fallbackScore) {
          fallback = c
          fallbackScore = c.score
        }
        const novel = c.awakenerIds.filter((id) => !usedUnits.has(id)).length
        if (novel >= 1 && c.score > bestScore) {
          best = c
          bestScore = c.score
        }
      }
      const pick = best ?? fallback
      if (!pick || !push(pick)) break
      reserved++
    }

    // Backfill any open slots (meta ran short under the per-unit cap, or fewer
    // engine teams than reserved). Engine teams go first for variety, then any
    // remaining meta still within the cap.
    for (const c of searchCands) {
      if (picked.length >= maxResults) break
      push(c)
    }
    for (const c of metaCands) {
      if (picked.length >= maxResults) break
      pushMeta(c)
    }

    if (picked.length) {
      teams = picked.map((candidate, i) =>
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