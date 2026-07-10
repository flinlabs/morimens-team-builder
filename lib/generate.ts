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
    const excludeKeys = new Set(options.excludeTeamKeys ?? [])

    // Per-board pins: dtidePins[i] locks those units to board i. Sanitize to
    // owned, known units, and drop repeats (a unit can only fight once per
    // D-Tide, so a second board pinning it loses the pin with a warning).
    const rawPins = (options.dtidePins ?? []).slice(0, 5)
    const pinnedByBoard: string[][] = Array.from({ length: 5 }, () => [])
    const pinnedAnywhere = new Set<string>()
    rawPins.forEach((ids, i) => {
      for (const id of ids ?? []) {
        if (!awakeners[id] || !getAwakenerEntry(req.roster, id).owned) continue
        if (pinnedAnywhere.has(id)) {
          warnings.push(
            `${awakeners[id].name} is pinned to more than one D-Tide board — kept on the first.`
          )
          continue
        }
        pinnedAnywhere.add(id)
        pinnedByBoard[i].push(id)
      }
    })
    const hasBoardPins = pinnedByBoard.some((p) => p.length > 0)

    // Shared candidate pool for the unpinned boards: meta comps (investment-
    // scaled) merged with engine-built teams, ranked by score. Board pins are
    // excluded from this pool so a pinned unit can't be poached by another team.
    const poolOptions: FilterOptions = {
      ...options,
      pinnedIds: undefined,
      excludeIds: [...(options.excludeIds ?? []), ...pinnedAnywhere],
    }

    const usedIds = new Set<string>(pinnedAnywhere)
    const seen = new Set<string>(excludeKeys)
    const picked: (CandidateTeam | null)[] = Array(5).fill(null)

    // Pass A — solve the pinned boards first (most constrained first), each
    // built around its own pins and excluding every other board's pins.
    const boardOrder = [0, 1, 2, 3, 4].sort(
      (a, b) => pinnedByBoard[b].length - pinnedByBoard[a].length
    )
    for (const bi of boardOrder) {
      const pins = pinnedByBoard[bi]
      if (!pins.length) continue
      const candidates = generateCandidateTeams(req.roster, awakeners, {
        ...options,
        pinnedIds: pins,
        excludeIds: [
          ...(options.excludeIds ?? []),
          ...[...usedIds].filter((id) => !pins.includes(id)),
        ],
        maxResults: 12,
      })
      const best = candidates.find((c) => !seen.has(teamKey(c.awakenerIds)))
      if (!best) {
        warnings.push(
          `Team ${bi + 1}: no valid team could be built around the pinned characters — board left for manual filling.`
        )
        continue
      }
      seen.add(teamKey(best.awakenerIds))
      best.awakenerIds.forEach((id) => usedIds.add(id))
      picked[bi] = best
    }

    // Pass B — fill the remaining boards greedily from the ranked pool,
    // best-invested first. If the strict pool (tier 2, full role coverage)
    // runs dry before all five boards are filled, relax in two steps so a
    // newer account that can clear the waves isn't refused a full lineup:
    // first admit underinvested-but-owned units, then drop the DPS+sustain
    // requirement entirely (gaps still show on the card).
    const relaxSteps: { opts: Partial<FilterOptions>; note?: string }[] = [
      { opts: {} },
      {
        opts: { minViabilityTier: 1 },
        note: 'Roster ran thin — later teams include underinvested units (stretch picks).',
      },
      {
        opts: { minViabilityTier: 1, relaxCoverage: true },
        note: 'Roster ran very thin — later teams may lack a dedicated DPS or sustain. Check each card\'s gaps.',
      },
    ]

    for (const step of relaxSteps) {
      if (!picked.some((p) => p === null)) break
      let filledThisStep = false
      for (let bi = 0; bi < 5; bi++) {
        if (picked[bi]) continue
        // The pool must exclude every unit already fielded — ranking a global
        // pool and skipping overlaps starves once used units dominate the top
        // slice, since candidate lists are score-sorted and capped.
        const excludeIds = [...(poolOptions.excludeIds ?? []), ...usedIds]
        const metaCands = (options.offMeta || step.opts.relaxCoverage
          ? []
          : metaCandidates(req.roster, awakeners, poolOptions)
        ).filter((c) => !c.awakenerIds.some((id) => usedIds.has(id)))
        const searchCands = generateCandidateTeams(req.roster, awakeners, {
          ...poolOptions,
          ...step.opts,
          excludeIds,
          maxResults: 12,
        })
        const ranked = [...metaCands, ...searchCands].sort((a, b) => b.score - a.score)
        const best = ranked.find((c) => !seen.has(teamKey(c.awakenerIds)))
        if (!best) break
        seen.add(teamKey(best.awakenerIds))
        best.awakenerIds.forEach((id) => usedIds.add(id))
        picked[bi] = best
        filledThisStep = true
      }
      if (filledThisStep && step.note) warnings.push(step.note)
    }

    const finalTeams = picked.filter((p): p is CandidateTeam => !!p)
    if (finalTeams.length) {
      if (finalTeams.length < 5) {
        warnings.push(
          `Only ${finalTeams.length}/5 D-Tide teams could be formed from the owned roster.`
        )
      }
      // Preserve board order for pinned boards: teams are emitted in picked
      // order so the client maps team i to board i. Unfillable boards are
      // skipped; the client leaves those boards untouched.
      teams = buildDtideRecommendation(finalTeams, req.roster, awakeners, posses)
      if (hasBoardPins) {
        // Re-tag ranks with their true board numbers so the UI maps correctly.
        let ti = 0
        for (let bi = 0; bi < 5; bi++) {
          if (!picked[bi]) continue
          teams[ti].rank = bi + 1
          ti++
        }
      }
    } else {
      warnings.push('Could not assemble a D-Tide lineup from the owned roster.')
    }
  } else {
    const options = req.options ?? {}
    const maxResults = options.maxResults ?? 6
    const excludeKeys = new Set(options.excludeTeamKeys ?? [])
    const metaCands = options.offMeta
      ? [] // curated comps skipped entirely in off-meta mode
      : metaCandidates(req.roster, awakeners, options)
    // Pull a generous slice so the novelty-preferring reserve below can reach
    // synergy-dense comps that tie-break just under the top cluster. A unit like
    // Saya, whose ideal poison comp scores a hundredth below the densest Ultra
    // teams, otherwise sits outside a shallow slice and never gets considered
    // despite being a distinct, guide-sanctioned team worth showing.
    const searchCands = generateCandidateTeams(req.roster, awakeners, {
      ...options,
      maxResults: Math.max(options.maxResults ?? 0, 30),
    })

    // In off-meta mode the engine may still rebuild a curated composition from
    // scratch (it is, after all, a good team) — drop those exact comps too so
    // the mode actually shows something different.
    const metaKeys = options.offMeta
      ? new Set(
          getMetaTeams().teams
            .filter((t) => (t.awakenerIds ?? []).length === 4)
            .map((t) => teamKey(t.awakenerIds))
        )
      : new Set<string>()

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
    const ranked = [...metaCands, ...searchCands]
      .filter((c) => !metaKeys.has(teamKey(c.awakenerIds)))
      .sort((a, b) => b.score - a.score)

    const pickFrom = (skipKeys: Set<string>): CandidateTeam[] => {
      const seen = new Set<string>(skipKeys)
      const usedUnits = new Set<string>()
      const out: CandidateTeam[] = []
      while (out.length < maxResults) {
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
        out.push(best)
      }
      return out
    }

    // First try honouring the rotation (skip compositions already shown this
    // session). If that exhausts every distinct team, start the cycle over so
    // "Generate" never comes back empty-handed.
    let picked = pickFrom(excludeKeys)
    if (!picked.length && excludeKeys.size) {
      picked = pickFrom(new Set())
      if (picked.length) {
        warnings.push('Every distinct team has been shown — starting the rotation over.')
      }
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

/** Stable identity for a composition, used by the client to rotate results. */
export function compositionKey(awakenerIds: string[]): string {
  return teamKey(awakenerIds)
}
