import type {
  EnrichedAwakener,
  UserRoster,
  Realm,
  TeamRole,
  CandidateTeam,
  ViabilityTier,
} from './types'
import { getViableAwakenerIds, scoreViability } from './viability'
import { getAwakenerEntry } from './roster'

// ---------------------------------------------------------------------------
// Realm compatibility
// ---------------------------------------------------------------------------

export function getTeamRealms(awakenersInTeam: EnrichedAwakener[]): Realm[] {
  const realms = new Set<Realm>()
  for (const a of awakenersInTeam) realms.add(a.realm)
  return Array.from(realms)
}

export function isValidRealmComposition(realms: Realm[]): boolean {
  return realms.length <= 2
}

export function hasMixingPenalty(realms: Realm[]): boolean {
  // Ultra + Aequor or Ultra + Caro = 25% Ultra Turn debuff
  return (
    realms.includes('ULTRA') &&
    (realms.includes('AEQUOR') || realms.includes('CARO'))
  )
}

export function hasChaosMember(realms: Realm[]): boolean {
  return realms.includes('CHAOS')
}

export function getMixingNote(realms: Realm[]): string | undefined {
  if (!hasMixingPenalty(realms)) return undefined
  const other = realms.find(r => r !== 'ULTRA')
  return `Ultra + ${other} mix: all Ultra Turn effects reduced by 25% (Annihilation unaffected)`
}

// ---------------------------------------------------------------------------
// Role coverage
// ---------------------------------------------------------------------------

export function getTeamRoles(awakenersInTeam: EnrichedAwakener[]): TeamRole[] {
  const roles = new Set<TeamRole>()
  for (const a of awakenersInTeam) {
    for (const role of (a.annotation?.teamRoles ?? [])) {
      roles.add(role)
    }
  }
  return Array.from(roles)
}

export function getCoverageGaps(
  roles: TeamRole[],
  realms: Realm[]
): string[] {
  const gaps: string[] = []

  // Universal minimums
  const hasDPS = roles.includes('main_dps') || roles.includes('sub_dps')
  if (!hasDPS) gaps.push('No damage dealer')

  const hasSustain =
    roles.includes('shielder') ||
    roles.includes('healer') ||
    roles.includes('death_resist')
  if (!hasSustain) gaps.push('No sustain (shielder / healer / death resist)')

  // Caro-specific
  if (realms.includes('CARO')) {
    if (!roles.includes('embryo_gen')) gaps.push('No Embryo generation')
    const hasAliemus =
      roles.includes('aliemus_battery') || roles.includes('keyflare_support')
    if (!hasAliemus) gaps.push('No Aliemus support')
  }

  // Ultra-specific
  if (realms.includes('ULTRA')) {
    if (!roles.includes('aliemus_battery')) gaps.push('No Aliemus battery for Exalt cycling')
  }

  // Soft gaps (warnings, not blockers)
  if (!roles.includes('vuln_applier') && !roles.includes('weak_applier')) {
    gaps.push('No Weak or Vulnerable application')
  }

  return gaps
}

// ---------------------------------------------------------------------------
// Team scoring
// ---------------------------------------------------------------------------

function scoreCandidateTeam(
  ids: string[],
  awakeners: Record<string, EnrichedAwakener>,
  roster: UserRoster
): number {
  let score = 0

  // Sum individual viability scores
  for (const id of ids) {
    const awakener = awakeners[id]
    const entry = getAwakenerEntry(roster, id)
    if (!awakener) continue
    const result = scoreViability(id, entry, awakener, roster, roster.settings.arcRuleset)
    score += result.score
  }

  // Synergy bonus: check synergizesWith pairs
  for (const id of ids) {
    const annotation = awakeners[id]?.annotation
    if (!annotation) continue
    for (const synergyId of annotation.synergizesWith) {
      if (ids.includes(synergyId)) score += 0.15
    }
  }

  // Anchor posse bonus
  for (const id of ids) {
    const annotation = awakeners[id]?.annotation
    if (!annotation?.anchorPosse) continue
    const posseEntry = roster.posses[annotation.anchorPosse]
    if (posseEntry?.unlocked) score += 0.1
  }

  return score
}

// ---------------------------------------------------------------------------
// Realm preference filter
// ---------------------------------------------------------------------------

function matchesRealmPreference(
  realms: Realm[],
  preferredRealm?: Realm
): boolean {
  if (!preferredRealm) return true
  return realms.includes(preferredRealm)
}

// ---------------------------------------------------------------------------
// Combination generator (4 from N)
// ---------------------------------------------------------------------------

function combinations<T>(arr: T[], k: number): T[][] {
  if (k === 0) return [[]]
  if (arr.length < k) return []
  const [first, ...rest] = arr
  const withFirst = combinations(rest, k - 1).map(c => [first, ...c])
  const withoutFirst = combinations(rest, k)
  return [...withFirst, ...withoutFirst]
}

// ---------------------------------------------------------------------------
// Main candidate generator
// ---------------------------------------------------------------------------

export interface FilterOptions {
  pinnedIds?: string[]
  preferredRealm?: Realm
  minViabilityTier?: ViabilityTier
  maxCandidates?: number
  excludeIds?: string[]
}

export function generateCandidateTeams(
  roster: UserRoster,
  awakeners: Record<string, EnrichedAwakener>,
  options: FilterOptions = {}
): CandidateTeam[] {
  const {
    pinnedIds = [],
    preferredRealm,
    minViabilityTier = 2,
    maxCandidates = 3,
    excludeIds = [],
  } = options

  // Get all viable awakener IDs
  const viableIds = getViableAwakenerIds(roster, awakeners, minViabilityTier)
    .filter(id => !excludeIds.includes(id))

  // Validate pinned IDs are all viable
  for (const id of pinnedIds) {
    if (!viableIds.includes(id) && !excludeIds.includes(id)) {
      // Include pinned IDs even if below min tier (with a flag)
      viableIds.push(id)
    }
  }

  // Slots to fill
  const slotsToFill = 4 - pinnedIds.length
  if (slotsToFill < 0) return [] // too many pins

  // IDs available for fill slots
  const fillIds = viableIds.filter(id => !pinnedIds.includes(id))

  // Generate all combinations for fill slots
  const fillCombinations = slotsToFill === 0
    ? [[]]
    : combinations(fillIds, slotsToFill)

  const candidates: CandidateTeam[] = []

  for (const fillCombo of fillCombinations) {
    const teamIds = [...pinnedIds, ...fillCombo]
    const teamAwakeners = teamIds.map(id => awakeners[id]).filter(Boolean)

    // Check realm validity
    const realms = getTeamRealms(teamAwakeners)
    if (!isValidRealmComposition(realms)) continue

    // Check realm preference
    if (!matchesRealmPreference(realms, preferredRealm)) continue

    // Check role coverage
    const roles = getTeamRoles(teamAwakeners)
    const gaps = getCoverageGaps(roles, realms)

    // Hard gap blocker: no DPS or no sustain = skip
    const hasHardGap =
      gaps.includes('No damage dealer') ||
      gaps.includes('No sustain (shielder / healer / death resist)')
    if (hasHardGap) continue

    // Check GMurphy Lemurian condition
    const requiresConditionFlags: string[] = []
    for (const id of teamIds) {
      const annotation = awakeners[id]?.annotation
      if (annotation?.requiresCondition === 'lemurian_team_arc2') {
        const LEMURIAN_IDS = ['awakener-0034', 'awakener-0035', 'awakener-0052', 'awakener-0053']
        const lemuriansInTeam = teamIds.filter(tid => LEMURIAN_IDS.includes(tid))
        if (lemuriansInTeam.length < 3) {
          requiresConditionFlags.push(`${awakeners[id].name} prefers a full Lemurian team in Arc 2`)
        }
      }
    }

    // Score the team
    const score = scoreCandidateTeam(teamIds, awakeners, roster)

    const mixing = hasMixingPenalty(realms)

    candidates.push({
      awakenerIds: teamIds,
      realmComposition: realms,
      hasMixingPenalty: mixing,
      mixingNote: getMixingNote(realms),
      roleCoverage: roles,
      coverageGaps: [...gaps, ...requiresConditionFlags],
      score,
    })
  }

  // Sort by score descending, return top N
  candidates.sort((a, b) => b.score - a.score)
  return candidates.slice(0, maxCandidates)
}

// ---------------------------------------------------------------------------
// D-Tide five-team constraint solver
// ---------------------------------------------------------------------------

export interface DtideSolution {
  teams: CandidateTeam[]
  totalScore: number
  undeployedIds: string[]
}

export function solveDtide(
  roster: UserRoster,
  awakeners: Record<string, EnrichedAwakener>,
  anchorTeams: string[][] = [], // pre-built teams to lock in
  maxSolutions: number = 3
): DtideSolution[] {
  const viableIds = getViableAwakenerIds(roster, awakeners, 2)

  // Lock anchor teams
  const lockedIds = new Set(anchorTeams.flat())
  const remainingIds = viableIds.filter(id => !lockedIds.has(id))

  // Build anchor CandidateTeams
  const anchorCandidates: CandidateTeam[] = anchorTeams.map(ids => {
    const teamAwakeners = ids.map(id => awakeners[id]).filter(Boolean)
    const realms = getTeamRealms(teamAwakeners)
    const roles = getTeamRoles(teamAwakeners)
    const gaps = getCoverageGaps(roles, realms)
    return {
      awakenerIds: ids,
      realmComposition: realms,
      hasMixingPenalty: hasMixingPenalty(realms),
      mixingNote: getMixingNote(realms),
      roleCoverage: roles,
      coverageGaps: gaps,
      score: scoreCandidateTeam(ids, awakeners, roster),
    }
  })

  // We need to fill (5 - anchorTeams.length) more teams from remainingIds
  const teamsNeeded = 5 - anchorTeams.length
  if (teamsNeeded <= 0) {
    return [{
      teams: anchorCandidates,
      totalScore: anchorCandidates.reduce((s, t) => s + t.score, 0),
      undeployedIds: remainingIds,
    }]
  }

  // Greedy approach: repeatedly pick the best team from remaining IDs
  // Try a few different orderings to get variation
  const solutions: DtideSolution[] = []

  function buildTeamsGreedy(
    available: string[],
    built: CandidateTeam[],
    teamsLeft: number
  ): CandidateTeam[] | null {
    if (teamsLeft === 0) return built
    if (available.length < 4) return null

    const candidates = generateCandidateTeams(roster, awakeners, {
      minViabilityTier: 2,
      maxCandidates: 5,
      excludeIds: viableIds.filter(id => !available.includes(id)),
    })

    if (candidates.length === 0) return null

    const best = candidates[0]
    const nextAvailable = available.filter(id => !best.awakenerIds.includes(id))
    return buildTeamsGreedy(nextAvailable, [...built, best], teamsLeft - 1)
  }

  // Primary solution
  const primary = buildTeamsGreedy(remainingIds, anchorCandidates, teamsNeeded)
  if (primary) {
    const usedIds = new Set(primary.flatMap(t => t.awakenerIds))
    solutions.push({
      teams: primary,
      totalScore: primary.reduce((s, t) => s + t.score, 0),
      undeployedIds: viableIds.filter(id => !usedIds.has(id)),
    })
  }

  // Try a few alternate orderings by shuffling remaining IDs
  for (let attempt = 0; attempt < 5 && solutions.length < maxSolutions; attempt++) {
    const shuffled = [...remainingIds].sort(() => Math.random() - 0.5)
    const alt = buildTeamsGreedy(shuffled, anchorCandidates, teamsNeeded)
    if (!alt) continue

    const usedIds = new Set(alt.flatMap(t => t.awakenerIds))
    const altSolution: DtideSolution = {
      teams: alt,
      totalScore: alt.reduce((s, t) => s + t.score, 0),
      undeployedIds: viableIds.filter(id => !usedIds.has(id)),
    }

    // Only add if meaningfully different from existing solutions
    const isDuplicate = solutions.some(s =>
      JSON.stringify(s.teams.map(t => t.awakenerIds.sort())) ===
      JSON.stringify(alt.map(t => t.awakenerIds.sort()))
    )
    if (!isDuplicate) solutions.push(altSolution)
  }

  solutions.sort((a, b) => b.totalScore - a.totalScore)
  return solutions.slice(0, maxSolutions)
}

// ---------------------------------------------------------------------------
// Leap conflict detection
// ---------------------------------------------------------------------------

export function detectLeapConflicts(
  teamIds: string[],
  awakeners: Record<string, EnrichedAwakener>
): string | null {
  const highLeapChars = teamIds
    .map(id => awakeners[id])
    .filter(a => a?.annotation?.leapPriority === 'high')
    .map(a => a.name)

  if (highLeapChars.length > 2) {
    return `${highLeapChars.join(', ')} all want high Leap priority — consider Tinct or Wanda to enable a second Leap`
  }
  return null
}