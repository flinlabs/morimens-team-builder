/** Deterministic investment and acquisition advice.

Answers the questions a newer player actually asks — where do I stop investing
in this character, who should I pull next, which wheel do I need, how close am I
to a known team — using only the hand-maintained annotations, the BiS tables,
and the curated meta compositions. No AI: every number here traces back to a
field someone wrote down deliberately, so a wrong answer is a data fix rather
than a prompt tweak.

Read as: `viabilityFloor` is the cheapest point a unit is worth fielding at,
`enlightenBreakpoints` are the rungs above it that actually change how they
play, and the last breakpoint is the stopping point past which further copies
are a luxury. **/

import type {
  EnrichedAwakener,
  EnrichedWheel,
  UserRoster,
  EnlightenSlot,
  TeamRole,
  MetaTeam,
  CandidateTeam,
  TeamRecommendation,
  EnrichedPosse,
} from './types'
import { getAwakenerEntry, getWheelEntry } from './roster'
import { buildCandidateTeam } from './filter'
import { buildTeamRecommendation } from './assign'
import type { BisEntry } from './db'

// Investment ladder, cheapest first. E0 is "owned, no copies".
const SLOT_ORDER: EnlightenSlot[] = ['E0', 'E1', 'E2', 'E3', 'OE', 'AA']

function slotIndex(slot: EnlightenSlot | undefined): number {
  const i = slot ? SLOT_ORDER.indexOf(slot) : -1
  return i === -1 ? 0 : i
}

// Roles a team genuinely cannot do without. A roster missing one of these has a
// real hole; missing a niche role (leap_support, relic_gen) is a preference.
const CORE_ROLES: TeamRole[] = [
  'main_dps',
  'keyflare_support',
  'aliemus_battery',
  'shielder',
  'healer',
  'vuln_applier',
  'weak_applier',
]

const ROLE_LABEL: Partial<Record<TeamRole, string>> = {
  main_dps: 'main DPS',
  keyflare_support: 'Keyflare bot',
  aliemus_battery: 'Aliemus battery',
  shielder: 'shielder',
  healer: 'healer',
  vuln_applier: 'Vulnerable applier',
  weak_applier: 'Weakness applier',
}

const TIER_SCORE: Record<string, number> = { S: 4, A: 3, B: 2, C: 1 }

// The community publishes two separate newbie tier lists — how well a character
// carries, and how much they improve a team as support — because the two
// answers routinely diverge. Kathigu-Ra is A as a DPS and C as a support;
// Clementine is C and S. Reporting one grade for a pull recommendation would
// hide exactly the information the player needs.
const DPS_RANK_SCORE: Record<string, number> = { S: 5, A: 4, 'B+': 3, B: 2, C: 1 }
const SUPPORT_RANK_SCORE: Record<string, number> = { S: 5, A: 4, B: 3, 'C+': 2, C: 1 }

/**
 * The grade that matters for how this character would actually be used, chosen
 * by whichever role they score higher in rather than by their declared
 * teamRoles — a unit fielded as a carry because nothing better is owned is
 * still being judged on its carry grade.
 */
export function bestRankFor(ann: {
  dpsRank?: string
  supportRank?: string
  dpsFloor?: string
  supportFloor?: string
}): { role: 'DPS' | 'Support'; rank: string; floor?: string } | null {
  const dps = ann.dpsRank ? DPS_RANK_SCORE[ann.dpsRank] ?? 0 : -1
  const sup = ann.supportRank ? SUPPORT_RANK_SCORE[ann.supportRank] ?? 0 : -1
  if (dps < 0 && sup < 0) return null
  return dps >= sup
    ? { role: 'DPS', rank: ann.dpsRank!, floor: ann.dpsFloor }
    : { role: 'Support', rank: ann.supportRank!, floor: ann.supportFloor }
}

export type InvestmentStatus =
  | 'not_owned'
  | 'below_floor'
  | 'climbing'
  | 'at_stopping_point'
  | 'past_stopping_point'

export interface BreakpointAdvice {
  awakenerId: string
  name: string
  realm: string
  tier: string
  owned: boolean
  currentSlot: EnlightenSlot
  viabilityFloor: EnlightenSlot
  breakpoints: EnlightenSlot[]
  /** Last breakpoint — past this, extra copies stop changing how they play. */
  stoppingPoint?: EnlightenSlot
  /** Cheapest rung above where the player currently sits. */
  nextBreakpoint?: EnlightenSlot
  status: InvestmentStatus
  note: string
  dpsRank?: string
  supportRank?: string
  dpsFloor?: string
  supportFloor?: string
  keySkillSlots: string[]
  keyTalents: string[]
}

export interface MetaLineupStatus {
  name: string
  realm: string
  source?: string
  notes: string
  awakenerIds: string[]
  awakenerNames: string[]
  ownedCount: number
  missing: { id: string; name: string }[]
  belowFloor: { id: string; name: string; current: EnlightenSlot; floor: EnlightenSlot }[]
  complete: boolean
}

export interface MetaAdvice {
  breakpoints: BreakpointAdvice[]
  pullTargets: PullTarget[]
  wheelTargets: WheelTarget[]
  metaLineups: MetaLineupStatus[]
  roleGaps: { role: TeamRole; label: string }[]
}

// ---------------------------------------------------------------------------
// Breakpoints — where to stop investing
// ---------------------------------------------------------------------------

export function buildBreakpointAdvice(
  awakeners: Record<string, EnrichedAwakener>,
  roster: UserRoster
): BreakpointAdvice[] {
  const out: BreakpointAdvice[] = []

  for (const awakener of Object.values(awakeners)) {
    const ann = awakener.annotation
    if (!ann) continue

    const entry = getAwakenerEntry(roster, awakener.id)
    const current = entry.enlightenSlot ?? 'E0'
    const floor = ann.viabilityFloor ?? 'E0'
    const breakpoints = [...(ann.enlightenBreakpoints ?? [])].sort(
      (a, b) => slotIndex(a) - slotIndex(b)
    )
    const stoppingPoint = breakpoints[breakpoints.length - 1]
    const nextBreakpoint = breakpoints.find((b) => slotIndex(b) > slotIndex(current))

    let status: InvestmentStatus
    if (!entry.owned) status = 'not_owned'
    else if (slotIndex(current) < slotIndex(floor)) status = 'below_floor'
    else if (stoppingPoint && slotIndex(current) > slotIndex(stoppingPoint))
      status = 'past_stopping_point'
    else if (stoppingPoint && slotIndex(current) >= slotIndex(stoppingPoint))
      status = 'at_stopping_point'
    else status = 'climbing'

    let note: string
    switch (status) {
      case 'not_owned':
        note = `Not owned. Worth fielding from ${floor}${
          stoppingPoint && stoppingPoint !== floor ? `, stopping point ${stoppingPoint}` : ''
        }.`
        break
      case 'below_floor':
        note = `At ${current}, below the ${floor} they need to pull their weight. Copies here are the highest-value ones you can spend.`
        break
      case 'climbing':
        note = nextBreakpoint
          ? `At ${current}. Next rung that changes anything is ${nextBreakpoint}.`
          : `At ${current} and functional; no further breakpoint recorded.`
        break
      case 'at_stopping_point':
        note = `At ${current} — the stopping point. Further copies are a luxury; spend elsewhere.`
        break
      default:
        note = `At ${current}, past the ${stoppingPoint} stopping point. Nothing left to gain here.`
    }

    out.push({
      awakenerId: awakener.id,
      name: awakener.name,
      realm: awakener.realm,
      tier: ann.tier ?? 'C',
      owned: !!entry.owned,
      currentSlot: current,
      viabilityFloor: floor,
      breakpoints,
      stoppingPoint,
      nextBreakpoint,
      status,
      note,
      dpsRank: ann.dpsRank,
      supportRank: ann.supportRank,
      dpsFloor: ann.dpsFloor,
      supportFloor: ann.supportFloor,
      keySkillSlots: ann.keySkillSlots ?? [],
      keyTalents: ann.keyTalents ?? [],
    })
  }

  // Owned-and-underinvested first (that is where copies are worth most), then
  // by tier, then alphabetically so the list is stable between renders.
  const statusRank: Record<InvestmentStatus, number> = {
    below_floor: 0,
    climbing: 1,
    at_stopping_point: 2,
    past_stopping_point: 3,
    not_owned: 4,
  }
  return out.sort((a, b) => {
    if (statusRank[a.status] !== statusRank[b.status])
      return statusRank[a.status] - statusRank[b.status]
    const ta = TIER_SCORE[a.tier] ?? 0
    const tb = TIER_SCORE[b.tier] ?? 0
    if (ta !== tb) return tb - ta
    return a.name.localeCompare(b.name)
  })
}

// ---------------------------------------------------------------------------
// Role gaps and pull targets
// ---------------------------------------------------------------------------

/** Core roles no owned, at-floor unit currently covers. */
export function findRoleGaps(
  awakeners: Record<string, EnrichedAwakener>,
  roster: UserRoster
): { role: TeamRole; label: string }[] {
  const covered = new Set<TeamRole>()
  for (const awakener of Object.values(awakeners)) {
    const ann = awakener.annotation
    if (!ann) continue
    const entry = getAwakenerEntry(roster, awakener.id)
    if (!entry.owned) continue
    // A unit below its floor does not really cover the role yet.
    if (slotIndex(entry.enlightenSlot ?? 'E0') < slotIndex(ann.viabilityFloor ?? 'E0')) continue
    for (const role of ann.teamRoles ?? []) covered.add(role)
  }
  return CORE_ROLES.filter((r) => !covered.has(r)).map((r) => ({
    role: r,
    label: ROLE_LABEL[r] ?? r,
  }))
}

/** Owned characters built to at least their own comfort floor. */
function fieldablePool(
  awakeners: Record<string, EnrichedAwakener>,
  roster: UserRoster
): string[] {
  return Object.values(awakeners)
    .filter((a) => {
      if (!a.annotation) return false
      const entry = getAwakenerEntry(roster, a.id)
      if (!entry.owned) return false
      return slotIndex(entry.enlightenSlot ?? 'E0') >= slotIndex(a.annotation.viabilityFloor ?? 'E0')
    })
    .map((a) => a.id)
}

// Search width for the "best team containing X" beam. buildCandidateTeam costs
// roughly 0.15ms, so a beam of 3 over a pool capped at 28 is a few hundred
// scoring calls per candidate — cheap enough to run for every unowned character
// inside a single request.
const BEAM_WIDTH = 3
const POOL_CAP = 28

/**
 * Best four-unit team that can be built from `pool`, optionally forced to
 * include `required`. Greedy beam rather than exhaustive: C(28,3) per candidate
 * across forty candidates would be ~45k scoring calls, which is too slow for a
 * request, and the beam lands on the same team in almost every case because
 * team score is dominated by the carry plus its two best enablers.
 */
function bestTeamFrom(
  pool: string[],
  awakeners: Record<string, EnrichedAwakener>,
  roster: UserRoster,
  required?: string
): CandidateTeam | null {
  const candidates = pool.filter((id) => id !== required).slice(0, POOL_CAP)
  if (candidates.length + (required ? 1 : 0) < 4) return null

  let beam: string[][] = required ? [[required]] : candidates.map((id) => [id]).slice(0, BEAM_WIDTH)

  while (beam[0].length < 4) {
    const next: { ids: string[]; score: number }[] = []
    for (const partial of beam) {
      for (const id of candidates) {
        if (partial.includes(id)) continue
        const ids = [...partial, id]
        // Partial teams are scored the same way full ones are; the relative
        // ordering is what the beam needs, not an absolute value.
        next.push({ ids, score: buildCandidateTeam(ids, awakeners, roster).score })
      }
    }
    if (!next.length) return null
    next.sort((a, b) => b.score - a.score)
    const seen = new Set<string>()
    beam = []
    for (const cand of next) {
      const key = [...cand.ids].sort().join('|')
      if (seen.has(key)) continue
      seen.add(key)
      beam.push(cand.ids)
      if (beam.length >= BEAM_WIDTH) break
    }
  }

  return buildCandidateTeam(beam[0], awakeners, roster)
}

export interface PullTargetTeam {
  awakenerIds: string[]
  awakenerNames: string[]
  score: number
}

export interface PullTarget {
  awakenerId: string
  name: string
  realm: string
  type: string
  tier: string
  dpsRank?: string
  supportRank?: string
  dpsFloor?: string
  supportFloor?: string
  /** How much the best fieldable team improves if you acquire them. */
  delta: number
  /** Cheapest point they are worth fielding — what you are actually pulling to. */
  entryPoint: EnlightenSlot
  stoppingPoint?: EnlightenSlot
  /** The team they would slot into, drawn from characters already owned. */
  bestTeam?: PullTargetTeam
  reasons: string[]
}

/**
 * Rank unowned characters by what they would actually do for THIS collection.
 *
 * The previous version scored on tier plus a role-gap bonus, which recommended
 * the same handful of strong characters to everyone regardless of what they
 * owned. This instead measures the thing the player cares about: build the best
 * team the roster can field today, then build the best team it could field with
 * each candidate added, and rank by the difference. A character who slots into
 * an existing core beats a stronger one who has nobody to play with.
 */
export function buildPullTargets(
  awakeners: Record<string, EnrichedAwakener>,
  roster: UserRoster,
  limit = 12
): PullTarget[] {
  const pool = fieldablePool(awakeners, roster)
  const baseline = bestTeamFrom(pool, awakeners, roster)
  const baselineScore = baseline?.score ?? 0

  const gaps = new Set(findRoleGaps(awakeners, roster).map((g) => g.role))
  const gapLabels = new Map(findRoleGaps(awakeners, roster).map((g) => [g.role, g.label] as const))

  const targets: PullTarget[] = []

  for (const awakener of Object.values(awakeners)) {
    const ann = awakener.annotation
    if (!ann) continue
    if (getAwakenerEntry(roster, awakener.id).owned) continue

    // Score them as if acquired at their comfort floor — that is the pull the
    // player is actually considering, not a hypothetical maxed copy.
    const hypothetical: UserRoster = {
      ...roster,
      awakeners: {
        ...roster.awakeners,
        [awakener.id]: {
          ...(roster.awakeners[awakener.id] ?? {}),
          owned: true,
          enlightenSlot: ann.viabilityFloor ?? 'E0',
          enlightenCopies: 0,
          characterLevel: roster.keeperLevel ?? 80,
          skillLevels: roster.awakeners[awakener.id]?.skillLevels ?? {
            Strike: 1, Defense: 1, Skill1: 1, Skill2: 1, Rouse: 1, Exalt: 1, OverExalt: 0,
          },
          talentLevels: roster.awakeners[awakener.id]?.talentLevels ?? {
            madnessOmen: 0, soulforgeAptitude: 0, gnosticPotential: 0,
          },
        },
      },
    }

    const withThem = bestTeamFrom([awakener.id, ...pool], awakeners, hypothetical, awakener.id)
    if (!withThem) continue
    const delta = Math.round((withThem.score - baselineScore) * 100) / 100

    const reasons: string[] = []
    const teammates = withThem.awakenerIds.filter((id) => id !== awakener.id)
    if (teammates.length) {
      reasons.push(
        `Slots straight into a team with ${teammates.map((id) => awakeners[id].name).join(', ')}`
      )
    }
    const filled = (ann.teamRoles ?? []).filter((r) => gaps.has(r))
    if (filled.length) {
      reasons.push(`Covers ${filled.map((r) => gapLabels.get(r) ?? r).join(', ')}, which nothing you have built does`)
    }
    const best = bestRankFor(ann)
    if (best) {
      reasons.push(
        `Community rank ${best.rank} as ${best.role.toLowerCase()}` +
          (best.floor ? `, at ${best.floor}` : '')
      )
    }

    const floor = ann.viabilityFloor ?? 'E0'
    reasons.push(
      floor === 'E0'
        ? 'Works straight from E0'
        : `Needs ${floor} before they pull their weight`
    )

    const breakpoints = [...(ann.enlightenBreakpoints ?? [])].sort((a, b) => slotIndex(a) - slotIndex(b))

    targets.push({
      awakenerId: awakener.id,
      name: awakener.name,
      realm: awakener.realm,
      type: awakener.type,
      tier: ann.tier ?? 'C',
      dpsRank: ann.dpsRank,
      supportRank: ann.supportRank,
      dpsFloor: ann.dpsFloor,
      supportFloor: ann.supportFloor,
      delta,
      entryPoint: floor,
      stoppingPoint: breakpoints[breakpoints.length - 1],
      bestTeam: {
        awakenerIds: withThem.awakenerIds,
        awakenerNames: withThem.awakenerIds.map((id) => awakeners[id].name),
        score: Math.round(withThem.score * 100) / 100,
      },
      reasons,
    })
  }

  return targets
    .sort((a, b) => (b.delta !== a.delta ? b.delta - a.delta : a.name.localeCompare(b.name)))
    .slice(0, limit)
}

// ---------------------------------------------------------------------------
// Wheel targets
// ---------------------------------------------------------------------------

export interface WheelTarget {
  wheelId: string
  name: string
  rarity: string
  owned: boolean
  starLevel: number
  recommendedStarFloor?: number
  /** Characters the player already fields who want this wheel. */
  wantedBy: { id: string; name: string }[]
  /** How many of the player's strongest fieldable teams contain a wanted-by unit. */
  teamsAffected: number
  reason: string
}

/**
 * Wheels ranked by how much they would improve teams the player can already
 * field, rather than by a flat walk of every BiS row. A wheel wanted by three
 * characters who all appear in the rosters's best teams is a better pull than a
 * best-in-slot for someone who has nobody to play with.
 */
export function buildWheelTargets(
  awakeners: Record<string, EnrichedAwakener>,
  wheels: Record<string, EnrichedWheel>,
  bis: Record<string, BisEntry>,
  roster: UserRoster,
  starFloors: Record<string, { starFloor: number; note?: string }> = {},
  limit = 16
): WheelTarget[] {
  const pool = fieldablePool(awakeners, roster)

  // The characters that actually show up when this roster builds teams. Units
  // sitting in the collection but never fielded should not drive wheel advice.
  const fielded = new Set<string>()
  const best = bestTeamFrom(pool, awakeners, roster)
  if (best) best.awakenerIds.forEach((id) => fielded.add(id))
  // One team per carry the player can field: a carry is what defines a team, so
  // anchoring on each of them covers the compositions this roster would
  // actually build rather than an arbitrary slice of the collection.
  const carries = pool.filter((id) =>
    (awakeners[id].annotation?.teamRoles ?? []).includes('main_dps')
  )
  for (const anchor of (carries.length ? carries : pool).slice(0, 10)) {
    const team = bestTeamFrom(pool, awakeners, roster, anchor)
    if (team) team.awakenerIds.forEach((id) => fielded.add(id))
  }
  // A roster too thin to form a team still deserves wheel advice for the
  // characters it does have built.
  if (fielded.size === 0) pool.forEach((id) => fielded.add(id))

  const byWheel = new Map<string, WheelTarget>()

  for (const awakenerId of fielded) {
    const awakener = awakeners[awakenerId]
    if (!awakener) continue
    for (const variant of bis[awakenerId]?.variants ?? []) {
      for (const rec of variant.wheels) {
        if (rec.tier !== 'BIS_SSR' && rec.tier !== 'BIS_SR') continue
        const wheel = wheels[rec.wheelId]
        if (!wheel) continue
        const entry = getWheelEntry(roster, rec.wheelId)
        const floor = starFloors[rec.wheelId]
        const underAscended = entry.owned && floor && (entry.starLevel ?? 0) < floor.starFloor
        if (entry.owned && !underAscended) continue

        const existing = byWheel.get(rec.wheelId)
        if (existing) {
          existing.wantedBy.push({ id: awakenerId, name: awakener.name })
          existing.teamsAffected += 1
          continue
        }
        byWheel.set(rec.wheelId, {
          wheelId: rec.wheelId,
          name: wheel.name,
          rarity: wheel.rarity,
          owned: !!entry.owned,
          starLevel: entry.starLevel ?? 0,
          recommendedStarFloor: floor?.starFloor,
          wantedBy: [{ id: awakenerId, name: awakener.name }],
          teamsAffected: 1,
          reason: '',
        })
      }
    }
  }

  const out = [...byWheel.values()]
  for (const t of out) {
    const names = t.wantedBy.map((w) => w.name)
    const floorNote = starFloors[t.wheelId]?.note
    t.reason = t.owned
      ? `Owned at E${t.starLevel}, but ${names.join(' and ')} want at least E${t.recommendedStarFloor}.${floorNote ? ` ${floorNote}` : ''}`
      : `Best-in-slot for ${names.join(', ')}, who you already field.${floorNote ? ` ${floorNote}` : ''}`
  }

  return out
    .sort((a, b) =>
      b.wantedBy.length !== a.wantedBy.length
        ? b.wantedBy.length - a.wantedBy.length
        : a.name.localeCompare(b.name)
    )
    .slice(0, limit)
}

// ---------------------------------------------------------------------------
// Meta lineups
// ---------------------------------------------------------------------------

export interface MetaLineupStatus {
  name: string
  realm: string
  source?: string
  notes: string
  awakenerIds: string[]
  awakenerNames: string[]
  ownedCount: number
  missing: { id: string; name: string }[]
  belowFloor: { id: string; name: string; current: EnlightenSlot; floor: EnlightenSlot }[]
  complete: boolean
  /**
   * The comp rendered exactly as a generated one — same gear, posse, archetype
   * chips, and breakdown. Deliberately built against an IDEAL roster rather
   * than the player's: this section is a reference for what the composition
   * looks like when finished, so every wheel, covenant, and posse is present
   * and no member is ever missing. What the player actually owns is reported
   * separately in `missing` / `belowFloor`, which is the honest place for it —
   * repeating it as a warning under every card just buried the teams.
   */
  recommendation: TeamRecommendation
}

/**
 * A roster that owns and has built everything, used only to render the curated
 * comps. Enlighten is pushed to each unit's own stopping point rather than
 * blanket-maxed, so the gearing shown is the build the guides actually
 * describe, not a whale's.
 */
function idealRoster(
  awakeners: Record<string, EnrichedAwakener>,
  base: UserRoster,
  wheels: Record<string, EnrichedWheel>
): UserRoster {
  const awakenerEntries: UserRoster['awakeners'] = {}
  for (const awakener of Object.values(awakeners)) {
    const ann = awakener.annotation
    const breakpoints = [...(ann?.enlightenBreakpoints ?? [])].sort(
      (a, b) => slotIndex(a) - slotIndex(b)
    )
    awakenerEntries[awakener.id] = {
      owned: true,
      enlightenSlot: breakpoints[breakpoints.length - 1] ?? ann?.viabilityFloor ?? 'E0',
      enlightenCopies: 0,
      characterLevel: 80,
      skillLevels: { Strike: 6, Defense: 6, Skill1: 6, Skill2: 6, Rouse: 6, Exalt: 6, OverExalt: 1 },
      talentLevels: { madnessOmen: 5, soulforgeAptitude: 5, gnosticPotential: 5 },
    }
  }

  const wheelEntries: UserRoster['wheels'] = {}
  for (const id of Object.keys(wheels)) {
    wheelEntries[id] = { owned: true, starLevel: 3, stackLevel: 12 }
  }

  const covenantEntries: UserRoster['covenants'] = {}
  for (const id of Object.keys(base.covenants)) {
    covenantEntries[id] = {
      owned: true,
      threePieceComplete: true,
      sixPieceComplete: true,
      completionPercent: 100,
    }
  }

  const posseEntries: UserRoster['posses'] = {}
  for (const id of Object.keys(base.posses)) posseEntries[id] = { unlocked: true }

  return {
    ...base,
    awakeners: awakenerEntries,
    wheels: wheelEntries,
    covenants: covenantEntries,
    posses: posseEntries,
  }
}

export function buildMetaLineupStatus(
  teams: MetaTeam[],
  awakeners: Record<string, EnrichedAwakener>,
  roster: UserRoster,
  posses?: Record<string, EnrichedPosse>,
  wheels: Record<string, EnrichedWheel> = {}
): MetaLineupStatus[] {
  const ideal = idealRoster(awakeners, roster, wheels)
  return teams
    .map((team, i) => {
      const missing: { id: string; name: string }[] = []
      const belowFloor: MetaLineupStatus['belowFloor'] = []
      let ownedCount = 0

      team.awakenerIds.forEach((id, idx) => {
        const name = team.awakenerNames[idx] ?? awakeners[id]?.name ?? id
        const entry = getAwakenerEntry(roster, id)
        if (!entry.owned) {
          missing.push({ id, name })
          return
        }
        ownedCount += 1
        const floor = awakeners[id]?.annotation?.viabilityFloor ?? 'E0'
        const current = entry.enlightenSlot ?? 'E0'
        if (slotIndex(current) < slotIndex(floor)) belowFloor.push({ id, name, current, floor })
      })

      const candidate = buildCandidateTeam(team.awakenerIds, awakeners, ideal)
      candidate.metaName = team.name
      candidate.metaSource = team.source
      const recommendation = buildTeamRecommendation(
        candidate,
        i + 1,
        ideal,
        awakeners,
        posses
      )
      // Nothing is missing on the ideal roster, so anything left here would be
      // noise rather than signal.
      recommendation.investmentWarnings = []

      return {
        name: team.name,
        realm: team.realm,
        source: team.source,
        notes: team.notes,
        awakenerIds: team.awakenerIds,
        awakenerNames: team.awakenerNames,
        ownedCount,
        missing,
        belowFloor,
        complete: missing.length === 0 && belowFloor.length === 0,
        recommendation,
      }
    })
    // Closest to finished first — those are the ones worth one more pull.
    .sort((a, b) => {
      if (a.complete !== b.complete) return a.complete ? -1 : 1
      if (a.missing.length !== b.missing.length) return a.missing.length - b.missing.length
      return a.name.localeCompare(b.name)
    })
}

// ---------------------------------------------------------------------------

export interface MetaAdvice {
  breakpoints: BreakpointAdvice[]
  pullTargets: PullTarget[]
  wheelTargets: WheelTarget[]
  metaLineups: MetaLineupStatus[]
  roleGaps: { role: TeamRole; label: string }[]
}

export function buildMetaAdvice(
  awakeners: Record<string, EnrichedAwakener>,
  wheels: Record<string, EnrichedWheel>,
  bis: Record<string, BisEntry>,
  metaTeams: MetaTeam[],
  roster: UserRoster,
  starFloors: Record<string, { starFloor: number; note?: string }> = {},
  posses?: Record<string, EnrichedPosse>
): MetaAdvice {
  return {
    breakpoints: buildBreakpointAdvice(awakeners, roster),
    pullTargets: buildPullTargets(awakeners, roster),
    wheelTargets: buildWheelTargets(awakeners, wheels, bis, roster, starFloors),
    metaLineups: buildMetaLineupStatus(metaTeams, awakeners, roster, posses, wheels),
    roleGaps: findRoleGaps(awakeners, roster),
  }
}
