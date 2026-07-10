import type {
  EnrichedAwakener,
  UserRoster,
  Realm,
  TeamRole,
  CandidateTeam,
  ViabilityTier,
  ArcRuleset,
} from './types'
import { getViableAwakenerIds, scoreViability } from './viability'
import { getAwakenerEntry } from './roster'

const REALM_ORDER: Realm[] = ['CHAOS', 'CARO', 'AEQUOR', 'ULTRA']

export function getRealmsInTeam(
  awakenersIds: string[],
  awakeners: Record<string, EnrichedAwakener>
): Realm[] {
  const realms = new Set<Realm>()
  for (const id of awakenersIds) {
    const realm = awakeners[id]?.realm
    if (realm) realms.add(realm as Realm)
  }
  return Array.from(realms)
}

export function getNonChaosRealms(
  awakenersIds: string[],
  awakeners: Record<string, EnrichedAwakener>
): Realm[] {
  const realms = new Set<Realm>()
  for (const id of awakenersIds) {
    const realm = awakeners[id]?.realm
    if (realm && realm !== 'CHAOS') realms.add(realm as Realm)
  }
  return Array.from(realms)
}

export function hasChaosMember(
  awakenerIds: string[],
  awakeners: Record<string, EnrichedAwakener>
): boolean {
  return awakenerIds.some(id => awakeners[id]?.realm === 'CHAOS')
}

export function isValidRealmComposition(
  awakenerIds: string[],
  awakeners: Record<string, EnrichedAwakener>
): boolean {
  // Cap counts ALL realms including Chaos: at most two distinct realms total.
  return getRealmsInTeam(awakenerIds, awakeners).length <= 2
}

/**
 * Base character behind a variant. "Ramona: Timeworn" and "Ramona" are the
 * same character in-game and can never share a team; likewise Doll / Doll:
 * Inferno, Helot / Helot: Catena, Murphy / Murphy: Fauxborn. SKeyDB encodes
 * variants as "<Base>: <Epithet>", so the name prefix is the identity.
 */
export function baseCharacterName(awakener: EnrichedAwakener | undefined): string {
  const name = awakener?.name ?? ''
  const idx = name.indexOf(':')
  return (idx === -1 ? name : name.slice(0, idx)).trim()
}

/** True when two team members are variants of the same base character. */
export function hasVariantConflict(
  awakenerIds: string[],
  awakeners: Record<string, EnrichedAwakener>
): boolean {
  const seen = new Set<string>()
  for (const id of awakenerIds) {
    const base = baseCharacterName(awakeners[id])
    if (!base) continue
    if (seen.has(base)) return true
    seen.add(base)
  }
  return false
}

// At most one ASSAULT-class unit per team. Each carry is so resource-hungry
// (hand size, Arithmetica, Keyflare) that two of them clash badly.
const MAX_ASSAULT_PER_TEAM = 1
export function withinClassLimits(
  awakenerIds: string[],
  awakeners: Record<string, EnrichedAwakener>
): boolean {
  const assault = awakenerIds.filter((id) => awakeners[id]?.type === 'ASSAULT').length
  return assault <= MAX_ASSAULT_PER_TEAM
}

// At most one unit whose PRIMARY role (first annotated role) is main_dps.
// Two dedicated carries starve each other of Arithmetica, buffs, and posse
// priority — a second damage source should be a primary sub-DPS, not another
// carry. Curated meta comps bypass this along with the other heuristics: when
// a guide fields two "DPS" units, one of them is playing enabler.
export function withinCarryLimit(
  awakenerIds: string[],
  awakeners: Record<string, EnrichedAwakener>
): boolean {
  const carries = awakenerIds.filter(
    (id) => awakeners[id]?.annotation?.teamRoles?.[0] === 'main_dps'
  ).length
  return carries <= 1
}

// Realm gates for units that only function in a specific mono-realm shell.
// Murphy: Fauxborn (the lone `lemurian_team_arc2` unit) only belongs on a team
// whose every non-Chaos member is Aequor.
export function withinRealmGates(
  awakenerIds: string[],
  awakeners: Record<string, EnrichedAwakener>
): boolean {
  const needsMonoAequor = awakenerIds.some(
    (id) => awakeners[id]?.annotation?.requiresCondition === 'lemurian_team_arc2'
  )
  if (!needsMonoAequor) return true
  return awakenerIds.every((id) => {
    const realm = awakeners[id]?.realm
    return realm === 'AEQUOR' || realm === 'CHAOS'
  })
}

export function getMixingPenalty(
  awakenerIds: string[],
  awakeners: Record<string, EnrichedAwakener>
): { hasPenalty: boolean; note: string } {
  const nonChaosRealms = getNonChaosRealms(awakenerIds, awakeners)
  const hasUltra = nonChaosRealms.includes('ULTRA')
  const hasAequor = nonChaosRealms.includes('AEQUOR')
  const hasCaro = nonChaosRealms.includes('CARO')

  if (hasUltra && (hasAequor || hasCaro)) {
    return {
      hasPenalty: true,
      note: 'Ultra mixed with Aequor/Caro — Ultra Turn effects reduced by 25% (damage, healing, shields, Aliemus gains, Poison/Counter/Bleed). Annihilation unaffected.',
    }
  }

  return { hasPenalty: false, note: '' }
}

export function getRealmBonuses(
  awakenerIds: string[],
  awakeners: Record<string, EnrichedAwakener>
): string[] {
  const bonuses: string[] = []
  const hasChaos = hasChaosMember(awakenerIds, awakeners)
  const nonChaosRealms = getNonChaosRealms(awakenerIds, awakeners)
  const chaosCount = awakenerIds.filter(id => awakeners[id]?.realm === 'CHAOS').length

  if (hasChaos && nonChaosRealms.includes('AEQUOR')) {
    bonuses.push(
      `Chaos+Aequor: Base Tentacle DMG +${chaosCount}% Max HP; ` +
      `Chaos Exalts +1 Tentacle Assembly and 10 Aliemus to Aequor teammates`
    )
  }

  if (hasChaos && nonChaosRealms.includes('CARO')) {
    bonuses.push('Chaos+Caro: Chaos Exalts grant +35% Embryo Fusion')
  }

  if (hasChaos && nonChaosRealms.includes('ULTRA')) {
    bonuses.push(
      `Chaos+Ultra: Enemy ATK permanently -${chaosCount * 0.5}% Max HP; ` +
      `team STR +${chaosCount}% Max HP; ` +
      `Ultra units +${chaosCount * 10}% Crit DMG per Chaos member`
    )
  }

  if (hasChaos) {
    bonuses.push('+100% Death Resistance from Chaos member (and the team is still treated as "pure" for realm-mechanic purposes)')
    bonuses.push('Chaos provides extra Keyflare and Aliemus generation for the team')
    bonuses.push('Chaos Memory active — a second posse can release in a turn, drawn from the full unlocked collection')
  }

  const isMonoNonChaos = nonChaosRealms.length === 1
  if (hasChaos && isMonoNonChaos && nonChaosRealms[0] === 'CARO') {
    bonuses.push('Pure Caro+Chaos — Blood Furnace fills at 6% Max HP per turn (doubled from 3%)')
  }

  // GMurphy Lemurian scaling note
  const gmurphy = awakenerIds.find(
    id => awakeners[id]?.annotation?.requiresCondition === 'lemurian_team_arc2'
  )
  if (gmurphy) {
    const otherLemurians = awakenerIds.filter(
      id => id !== gmurphy && isLemurian(awakeners[id])
    ).length
    const scaling = ['0%', '6%', '15%', '30%'][Math.min(otherLemurians, 3)]
    bonuses.push(
      `GMurphy Lemurian scaling: ${otherLemurians}/3 other Lemurians — Max HP +${scaling}`
    )
  }

  return bonuses
}

const REQUIRED_ROLES_ALL: TeamRole[] = ['main_dps']
const REQUIRED_SUSTAIN: TeamRole[] = ['shielder', 'healer', 'death_resist']

const REQUIRED_ROLES_CARO: TeamRole[] = ['embryo_gen']
const SOFT_ROLES_CARO: TeamRole[] = ['aliemus_battery', 'keyflare_support']

const REQUIRED_ROLES_ULTRA: TeamRole[] = ['aliemus_battery']
const SOFT_ROLES_ULTRA: TeamRole[] = ['leap_support']

function getTeamRoles(
  awakenerIds: string[],
  awakeners: Record<string, EnrichedAwakener>
): TeamRole[] {
  const roles = new Set<TeamRole>()
  for (const id of awakenerIds) {
    const annotation = awakeners[id]?.annotation
    if (!annotation) continue
    for (const role of annotation.teamRoles) {
      roles.add(role)
    }
  }
  return Array.from(roles)
}

export function checkRoleCoverage(
  awakenerIds: string[],
  awakeners: Record<string, EnrichedAwakener>
): { covered: TeamRole[]; gaps: string[] } {
  const roles = getTeamRoles(awakenerIds, awakeners)
  const nonChaosRealms = getNonChaosRealms(awakenerIds, awakeners)
  const gaps: string[] = []

  // All teams need a DPS
  const hasDPS = roles.includes('main_dps') || roles.includes('sub_dps')
  if (!hasDPS) gaps.push('No damage dealer (main_dps or sub_dps)')

  // All teams need sustain
  const hasSustain = REQUIRED_SUSTAIN.some(r => roles.includes(r))
  if (!hasSustain) gaps.push('No sustain (shielder, healer, or death_resist)')

  // Caro-specific
  if (nonChaosRealms.includes('CARO')) {
    if (!roles.includes('embryo_gen')) {
      gaps.push('Caro team missing embryo_gen')
    }
    const hasCasoSupport = SOFT_ROLES_CARO.some(r => roles.includes(r))
    if (!hasCasoSupport) {
      gaps.push('Caro team has no Aliemus battery or Keyflare support')
    }
  }

  // Ultra-specific
  if (nonChaosRealms.includes('ULTRA')) {
    if (!roles.includes('aliemus_battery')) {
      gaps.push('Ultra team missing aliemus_battery')
    }

    // Check for Leap priority conflicts
    const highLeapCount = awakenerIds.filter(id => {
      return awakeners[id]?.annotation?.leapPriority === 'high'
    }).length
    if (highLeapCount > 2) {
      gaps.push(`${highLeapCount} characters competing for Leap priority — consider Tinct or Wanda for second Leap`)
    }
  }

  // Soft gaps (warn but don't exclude)
  const softGaps: string[] = []
  if (!roles.includes('vuln_applier')) {
    softGaps.push('No Vulnerable applier')
  }
  if (!roles.includes('weak_applier')) {
    softGaps.push('No Weakness applier')
  }

  // Divine Realm without Aliemus support
  const hasDivineRealm = awakenerIds.some(id => awakeners[id]?.annotation?.isDivineRealm)
  if (hasDivineRealm && !roles.includes('aliemus_battery')) {
    softGaps.push('Divine Realm character present but no dedicated Aliemus battery')
  }

  // Saya note
  const hasSaya = awakenerIds.some(id => awakeners[id]?.name === 'Saya')
  if (hasSaya) {
    softGaps.push('Saya present — Propagation: Caro active. First-Devour shield/STR replaced by Propagation Fiesta stacks. Ensure team can survive without standard Devour sustain.')
  }

  return {
    covered: roles,
    gaps: [...gaps, ...softGaps],
  }
}

function synergScore(
  awakenerIds: string[],
  awakeners: Record<string, EnrichedAwakener>
): number {
  // Synergy is a property of the PAIR, not the direction of the annotation.
  // Guides describe teammates from their subject's side, so a well-documented
  // character (Vortice, whose guide names a dozen partners) would earn nothing
  // until every partner's annotation was edited to name her back. Mutual
  // listings score highest; a one-directional edge still counts.
  let bonus = 0
  const ann = (id: string) => awakeners[id]?.annotation
  for (let i = 0; i < awakenerIds.length; i++) {
    for (let j = i + 1; j < awakenerIds.length; j++) {
      const a = awakenerIds[i]
      const b = awakenerIds[j]
      const aLists = ann(a)?.synergizesWith?.includes(b) ?? false
      const bLists = ann(b)?.synergizesWith?.includes(a) ?? false
      if (aLists && bLists) bonus += 0.2
      else if (aLists || bLists) bonus += 0.12
      // Key pairings are iconic duos (Pollux+Castor, say) — extra credit so a
      // known-good pair a player owns surfaces instead of drowning under
      // denser generic clusters.
      if (
        ann(a)?.keyPairings?.some((p) => p.partnerId === b) ||
        ann(b)?.keyPairings?.some((p) => p.partnerId === a)
      ) {
        bonus += 0.15
      }
      // Anti-synergy: a flagged conflict (e.g. Saya kicking away Helot:Catena's
      // hoarded cards) costs more than a synergy is worth, so a team pairing
      // the two is actively demoted rather than merely unrewarded.
      if (
        ann(a)?.conflictsWith?.includes(b) ||
        ann(b)?.conflictsWith?.includes(a)
      ) {
        bonus -= 0.25
      }
    }
  }
  return Math.min(bonus, 0.7) // cap upside; conflicts can push below zero
}

export function isLemurian(awakener: EnrichedAwakener): boolean {
  // Prefer the flag the sync derives; fall back to searchTags for older DB files.
  return awakener.isLemurian ?? awakener.searchTags.includes('Lemurian')
}

export function countLemurians(
  awakenerIds: string[],
  awakeners: Record<string, EnrichedAwakener>
): number {
  return awakenerIds.filter(id => isLemurian(awakeners[id])).length
}

function checkRequiresConditions(
  awakenerIds: string[],
  awakeners: Record<string, EnrichedAwakener>,
  arc: ArcRuleset = 'FADED_LEGACY'
): string[] {
  const warnings: string[] = []

  for (const id of awakenerIds) {
    const annotation = awakeners[id]?.annotation
    if (!annotation?.requiresCondition) continue

    if (annotation.requiresCondition === 'lemurian_team_arc2') {
      // The Lemurian Soulforge scaling is inert in Faded Legacy — only gate it in Astral Reign, where it actually applies.
      if (arc !== 'ASTRAL_REIGN') continue
      // GMurphy is herself Lemurian — needs 3 *other* Lemurians for full scaling
      const otherLemurians = awakenerIds.filter(
        tid => tid !== id && isLemurian(awakeners[tid])
      )

      if (otherLemurians.length < 3) {
        const present = otherLemurians.map(tid => awakeners[tid].name)
        const missing = 3 - otherLemurians.length
        warnings.push(
          `${awakeners[id].name} wants 3 other Lemurian teammates for full Soulforge scaling ` +
          `(+30% Max HP, 250% DEF shield per Lemurian Exalt). ` +
          `Currently ${otherLemurians.length}/3 present${present.length ? ` (${present.join(', ')})` : ''}. ` +
          `Missing ${missing}. Lemurian options: Faros, Goliath, Miryam, Tulu.`
        )
      }
    }
  }

  return warnings
}

export function buildCandidateTeam(
  awakenerIds: string[],
  awakeners: Record<string, EnrichedAwakener>,
  roster: UserRoster
): CandidateTeam {
  const nonChaosRealms = getNonChaosRealms(awakenerIds, awakeners)
  const hasChaos = hasChaosMember(awakenerIds, awakeners)
  const realmComposition: Realm[] = [
    ...(hasChaos ? ['CHAOS' as Realm] : []),
    ...nonChaosRealms,
  ]

  const { hasPenalty, note } = getMixingPenalty(awakenerIds, awakeners)
  const { covered, gaps } = checkRoleCoverage(awakenerIds, awakeners)
  const conditionWarnings = checkRequiresConditions(awakenerIds, awakeners, roster.settings.arcRuleset)
  const realmBonuses = getRealmBonuses(awakenerIds, awakeners)

  // Viability score sum
  let viabilitySum = 0
  for (const id of awakenerIds) {
    const entry = getAwakenerEntry(roster, id)
    const awakener = awakeners[id]
    if (!awakener) continue
    const result = scoreViability(id, entry, awakener, roster, roster.settings.arcRuleset)
    viabilitySum += result.score
  }

  const synergyBonus = synergScore(awakenerIds, awakeners)
  const penaltyDeduction = hasPenalty ? 0.1 : 0

  // Chaos is the designed splash realm: a Chaos member brings team-wide
  // Keyflare/Aliemus generation, +100% Death Resistance, Chaos Memory (double
  // posse), and pair bonuses with every realm — real value the synergy graph
  // (mostly intra-realm edges) never credits, which skewed the ranking against
  // multi-realm comps. Small flat bonus so a good Chaos splash competes.
  const chaosSplashBonus = hasChaos && nonChaosRealms.length > 0 ? 0.05 : 0

  // Conditional-unit fit: a Lemurian-gated unit (Murphy: Fauxborn) only performs
  // with a full Lemurian core — she scales off 3 *other* Lemurians. Discount
  // teams that field her short of that so she isn't forced onto comps she can't
  // carry (e.g. with an off-realm Chaos slot taking a Lemurian seat).
  let conditionPenalty = 0
  for (const id of awakenerIds) {
    if (awakeners[id]?.annotation?.requiresCondition === 'lemurian_team_arc2') {
      const otherLemurians = awakenerIds.filter(
        (x) => x !== id && awakeners[x]?.isLemurian
      ).length
      conditionPenalty += (3 - Math.min(3, otherLemurians)) * 0.2
    }
  }

  const score =
    viabilitySum / awakenerIds.length +
    synergyBonus +
    chaosSplashBonus -
    penaltyDeduction -
    conditionPenalty

  const allGaps = [
    ...gaps,
    ...conditionWarnings,
  ]

  return {
    awakenerIds,
    realmComposition,
    hasMixingPenalty: hasPenalty,
    mixingNote: hasPenalty ? note : undefined,
    roleCoverage: covered,
    coverageGaps: allGaps,
    score: Math.round(score * 100) / 100,
  }
}

function combinations<T>(arr: T[], size: number): T[][] {
  if (size === 0) return [[]]
  if (arr.length < size) return []
  const [first, ...rest] = arr
  const withFirst = combinations(rest, size - 1).map(c => [first, ...c])
  const withoutFirst = combinations(rest, size)
  return [...withFirst, ...withoutFirst]
}

function hasMinimumCoverage(
  awakenerIds: string[],
  awakeners: Record<string, EnrichedAwakener>
): boolean {
  const roles = getTeamRoles(awakenerIds, awakeners)
  const hasDPS = roles.includes('main_dps') || roles.includes('sub_dps')
  const hasSustain = REQUIRED_SUSTAIN.some(r => roles.includes(r))
  return hasDPS && hasSustain
}

export interface FilterOptions {
  pinnedIds?: string[]
  preferredRealm?: Realm
  minViabilityTier?: ViabilityTier
  maxResults?: number
  excludeIds?: string[]
  // Skip curated meta comps and their exact compositions — surfaces engine-
  // built variety for players tired of seeing the same headline teams.
  offMeta?: boolean
  // Exact compositions (sorted ids joined by '|') to skip — lets "Generate"
  // rotate through fresh teams instead of returning the same set every press.
  excludeTeamKeys?: string[]
  // Last-resort D-Tide padding: drop the engine heuristics (DPS+sustain
  // requirement, one-ASSAULT cap) so a shallow roster can still field five
  // teams. Real game rules (realm mixing, variant exclusivity) always hold;
  // any gaps still show on the team card.
  relaxCoverage?: boolean
  // D-Tide only: per-board pins, index-aligned with the five teams. Each
  // team's pinned units are locked to that board and the engine fills around
  // them. Overrides pinnedIds in dtide mode.
  dtidePins?: string[][]
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
    maxResults = 3,
    excludeIds = [],
    relaxCoverage = false,
  } = options

  // Get viable pool. Ownership is enforced explicitly: at minViabilityTier 1
  // (the D-Tide relaxation pass) unowned units also score tier 1 and would
  // otherwise leak into the pool.
  const viableIds = getViableAwakenerIds(roster, awakeners, minViabilityTier)
    .filter(id => getAwakenerEntry(roster, id).owned)
    .filter(id => !excludeIds.includes(id))

  // Soft comfort floors made nearly every owned unit viable, and the
  // combination search is O(n^4) — cap the fill pool at the best-scored units
  // so a 58-unit roster stays fast. On a thin roster nothing is trimmed, so
  // starters and below-floor filler remain reachable exactly when needed.
  const POOL_CAP = 40
  let cappedIds = viableIds
  if (viableIds.length > POOL_CAP) {
    const arc = roster.settings.arcRuleset
    const scoreOf = (id: string) =>
      scoreViability(id, getAwakenerEntry(roster, id), awakeners[id], roster, arc).score
    cappedIds = [...viableIds].sort((a, b) => scoreOf(b) - scoreOf(a)).slice(0, POOL_CAP)
  }

  // Validate pinned characters
  for (const id of pinnedIds) {
    if (!awakeners[id]) continue
    const entry = getAwakenerEntry(roster, id)
    if (!entry.owned) continue
  }

  // Slots to fill
  const slotsToFill = 4 - pinnedIds.length
  if (slotsToFill < 0) return []

  // Fill candidates — exclude pinned
  const fillPool = cappedIds.filter(id => !pinnedIds.includes(id))

  // Generate combinations for fill slots
  const fillCombinations = slotsToFill > 0
    ? combinations(fillPool, slotsToFill)
    : [[]]

  const candidates: CandidateTeam[] = []

  for (const fillIds of fillCombinations) {
    const teamIds = [...pinnedIds, ...fillIds]
    if (teamIds.length !== 4) continue

    // Realm validity
    if (!isValidRealmComposition(teamIds, awakeners)) continue

    // Same base character twice (e.g. Ramona + Ramona: Timeworn) is illegal.
    if (hasVariantConflict(teamIds, awakeners)) continue

    // Class limits (no more than one ASSAULT unit). Like minimum coverage,
    // this is an engine heuristic rather than a game rule — the D-Tide
    // last-resort pass waives it so a roster of leftover carries can still
    // fill a board instead of leaving it empty.
    if (!relaxCoverage && !withinClassLimits(teamIds, awakeners)) continue

    // One primary carry per team (see withinCarryLimit). Also waived only by
    // the D-Tide last-resort pass.
    if (!relaxCoverage && !withinCarryLimit(teamIds, awakeners)) continue

    // Realm gates (e.g. Murphy: Fauxborn only on mono-Aequor teams)
    if (!withinRealmGates(teamIds, awakeners)) continue

    // Preferred realm filter (soft — don't exclude, just deprioritize)
    if (preferredRealm) {
      const realms = getRealmsInTeam(teamIds, awakeners)
      const hasChaos = hasChaosMember(teamIds, awakeners)
      const matchesPreferred =
        realms.includes(preferredRealm) ||
        (preferredRealm === 'CHAOS' && hasChaos)
      if (!matchesPreferred) continue
    }

    // Minimum role coverage (skipped only by the D-Tide last-resort pass;
    // any gaps still surface in the team card's coverageGaps).
    if (!relaxCoverage && !hasMinimumCoverage(teamIds, awakeners)) continue

    candidates.push(buildCandidateTeam(teamIds, awakeners, roster))
  }

  // Sort by score descending
  candidates.sort((a, b) => b.score - a.score)

  // Diversify the slice. Score-sorting alone lets permutations of one dense
  // cluster occupy every returned slot (thirty near-identical Ultra shuffles),
  // pushing distinct carries just past the cut even when they'd qualify for
  // the downstream novelty band. Cap how often any single unit appears in the
  // returned slice; pinned units are exempt since every candidate contains
  // them by construction.
  const PER_UNIT_SLICE_CAP = 8
  const pinnedSet = new Set(pinnedIds)
  const occurrences = new Map<string, number>()
  const sliced: CandidateTeam[] = []
  for (const c of candidates) {
    if (sliced.length >= maxResults) break
    if (
      c.awakenerIds.some(
        (id) => !pinnedSet.has(id) && (occurrences.get(id) ?? 0) >= PER_UNIT_SLICE_CAP
      )
    ) {
      continue
    }
    c.awakenerIds.forEach((id) => occurrences.set(id, (occurrences.get(id) ?? 0) + 1))
    sliced.push(c)
  }
  return sliced
}

export interface DtideSolution {
  teams: CandidateTeam[]
  usedAwakenerIds: Set<string>
  usedWheelIds: Set<string>
  totalScore: number
  weakestTeamIndex: number
}

export function solveDtide(
  roster: UserRoster,
  awakeners: Record<string, EnrichedAwakener>,
  anchorTeams: string[][] = [] // pre-built teams [[id,id,id,id], ...]
): DtideSolution | null {
  const usedIds = new Set<string>()

  // Lock in anchor teams
  const lockedTeams: CandidateTeam[] = []
  for (const team of anchorTeams) {
    team.forEach(id => usedIds.add(id))
    lockedTeams.push(buildCandidateTeam(team, awakeners, roster))
  }

  const remainingSlots = 5 - lockedTeams.length
  const remainingTeams: CandidateTeam[] = []

  // Fill remaining teams greedily
  for (let i = 0; i < remainingSlots; i++) {
    const candidates = generateCandidateTeams(roster, awakeners, {
      excludeIds: Array.from(usedIds),
      minViabilityTier: 2,
      maxResults: 1,
    })

    if (candidates.length === 0) break

    const best = candidates[0]
    remainingTeams.push(best)
    best.awakenerIds.forEach(id => usedIds.add(id))
  }

  const allTeams = [...lockedTeams, ...remainingTeams]
  if (allTeams.length === 0) return null

  const totalScore = allTeams.reduce((sum, t) => sum + t.score, 0)
  const weakestTeamIndex = allTeams.reduce(
    (minIdx, team, idx, arr) => team.score < arr[minIdx].score ? idx : minIdx,
    0
  )

  return {
    teams: allTeams,
    usedAwakenerIds: usedIds,
    usedWheelIds: new Set(), // wheel assignment handled separately
    totalScore: Math.round(totalScore * 100) / 100,
    weakestTeamIndex,
  }
}