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
    const options = req.options ?? {}

    // Build the same candidate pool as single-team: meta comps (investment-
    // scaled) merged with engine-built teams, all ranked by score. Then greedily
    // pick 5 non-overlapping teams in score order — best-invested first.
    // This means user pins are respected, meta comps only win when the player
    // has actually built them, and a well-invested Arachne team beats a meta
    // comp the player owns but hasn't levelled.
    const metaCands = metaCandidates(req.roster, awakeners, options)
    const searchCands = generateCandidateTeams(req.roster, awakeners, {
      ...options,
      maxResults: 60, // deep pool so 5 non-overlapping teams can always be found
    })

    const seen = new Set<string>()
    const usedIds = new Set<string>()
    const picked: CandidateTeam[] = []
    const ranked = [...metaCands, ...searchCands].sort((a, b) => b.score - a.score)

    while (picked.length < 5) {
      const remaining = ranked.filter(
        (c) => !seen.has(teamKey(c.awakenerIds)) && !c.awakenerIds.some((id) => usedIds.has(id))
      )
      if (!remaining.length) break
      const best = remaining[0]
      seen.add(teamKey(best.awakenerIds))
      best.awakenerIds.forEach((id) => usedIds.add(id))
      picked.push(best)
    }

    if (picked.length) {
      if (picked.length < 5) {
        warnings.push(
          `Only ${picked.length}/5 D-Tide teams could be formed from the owned roster.`
        )
      }
      teams = buildDtideRecommendation(picked, req.roster, awakeners, posses)
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

    // Built first, meta second. Pool every candidate — curated and engine-built
    // alike — and rank by score, which is dominated by how invested the team's
    // units are; curated comps carry only a small, investment-scaled bonus. So a
    // well-built engine team outranks an underbuilt meta comp, and a carry's
    // curated teams surface only when the player has actually built them.
    //
    // Among teams within a small score band of the best remaining one, we prefer
    // the one introducing units not yet on screen. This is a tiebreak, not an
    // override: a clearly better-built team always wins, but a cluster of nearly
    // identical scores (a full E0 roster, say) gets variety instead of six
    // near-duplicate comps, so niche carries like Vortice still appear.
    const NOVELTY_BAND = 0.15
    const seen = new Set<string>()
    const usedUnits = new Set<string>()
    const picked: CandidateTeam[] = []
    const ranked = [...metaCands, ...searchCands].sort((a, b) => b.score - a.score)
    while (picked.length < maxResults) {
      const remaining = ranked.filter((c) => !seen.has(teamKey(c.awakenerIds)))
      if (!remaining.length) break
      const topScore = remaining[0].score
      let best = remaining[0]
      let bestNovel = -1
      for (const c of remaining) {
        if (c.score < topScore - NOVELTY_BAND) break // ranked desc — past the band
        const novel = c.awakenerIds.filter((id) => !usedUnits.has(id)).length
        if (novel > bestNovel) {
          best = c
          bestNovel = novel
        }
      }
      seen.add(teamKey(best.awakenerIds))
      best.awakenerIds.forEach((id) => usedUnits.add(id))
      picked.push(best)
    }

    if (picked.length) {
      // Thread a single usedWheelIds set across all teams so no wheel is
      // assigned to two different characters in the same output.
      const usedWheelIds = new Set<string>()
      teams = picked.map((candidate, i) =>
        buildTeamRecommendation(candidate, i + 1, req.roster, awakeners, posses, usedWheelIds)
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