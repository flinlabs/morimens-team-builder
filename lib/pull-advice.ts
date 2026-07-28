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
} from './types'
import { getAwakenerEntry, getWheelEntry } from './roster'
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
  keySkillSlots: string[]
  keyTalents: string[]
}

export interface PullTarget {
  awakenerId: string
  name: string
  realm: string
  type: string
  tier: string
  score: number
  /** Cheapest point they are worth fielding — what you are actually pulling to. */
  entryPoint: EnlightenSlot
  stoppingPoint?: EnlightenSlot
  reasons: string[]
}

export interface WheelTarget {
  wheelId: string
  name: string
  rarity: string
  forAwakenerId: string
  forAwakenerName: string
  owned: boolean
  starLevel: number
  recommendedStarFloor?: number
  reason: string
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

export function buildPullTargets(
  awakeners: Record<string, EnrichedAwakener>,
  roster: UserRoster,
  limit = 12
): PullTarget[] {
  const gaps = new Set(findRoleGaps(awakeners, roster).map((g) => g.role))
  const gapLabels = new Map(
    findRoleGaps(awakeners, roster).map((g) => [g.role, g.label] as const)
  )

  const targets: PullTarget[] = []

  for (const awakener of Object.values(awakeners)) {
    const ann = awakener.annotation
    if (!ann) continue
    if (getAwakenerEntry(roster, awakener.id).owned) continue

    const reasons: string[] = []
    let score = TIER_SCORE[ann.tier ?? 'C'] ?? 1
    reasons.push(`Tier ${ann.tier ?? 'C'}`)

    // Filling a hole beats raw power — a second S-tier carry does less for a
    // roster with no Keyflare bot than a B-tier Keyflare bot does.
    const filled = (ann.teamRoles ?? []).filter((r) => gaps.has(r))
    if (filled.length) {
      score += 3
      reasons.push(
        `Fills a gap in your roster: ${filled.map((r) => gapLabels.get(r) ?? r).join(', ')}`
      )
    }

    // Synergy is only worth counting against units the player can actually
    // field, so partners must be owned and at their own floor.
    const partners = (ann.keyPairings ?? [])
      .map((p) => p.partnerId)
      .concat(ann.synergizesWith ?? [])
      .filter((id, i, arr) => arr.indexOf(id) === i)
      .filter((id) => {
        const partner = awakeners[id]
        if (!partner?.annotation) return false
        const e = getAwakenerEntry(roster, id)
        if (!e.owned) return false
        return slotIndex(e.enlightenSlot ?? 'E0') >= slotIndex(partner.annotation.viabilityFloor ?? 'E0')
      })
    if (partners.length) {
      score += Math.min(partners.length, 3)
      const names = partners.slice(0, 3).map((id) => awakeners[id].name)
      reasons.push(
        `Pairs with ${names.join(', ')}${partners.length > 3 ? ` and ${partners.length - 3} more` : ''} that you already run`
      )
    }

    // Cheap-to-use units are better pulls for a thin roster than ones that need
    // three copies before they do anything.
    const floor = ann.viabilityFloor ?? 'E0'
    if (floor === 'E0') {
      score += 1
      reasons.push('Works straight from E0')
    } else if (slotIndex(floor) >= slotIndex('E3')) {
      score -= 1
      reasons.push(`Needs ${floor} before they pull their weight`)
    }

    const breakpoints = [...(ann.enlightenBreakpoints ?? [])].sort(
      (a, b) => slotIndex(a) - slotIndex(b)
    )

    targets.push({
      awakenerId: awakener.id,
      name: awakener.name,
      realm: awakener.realm,
      type: awakener.type,
      tier: ann.tier ?? 'C',
      score,
      entryPoint: floor,
      stoppingPoint: breakpoints[breakpoints.length - 1],
      reasons,
    })
  }

  return targets
    .sort((a, b) => (b.score !== a.score ? b.score - a.score : a.name.localeCompare(b.name)))
    .slice(0, limit)
}

// ---------------------------------------------------------------------------
// Wheel targets
// ---------------------------------------------------------------------------

export function buildWheelTargets(
  awakeners: Record<string, EnrichedAwakener>,
  wheels: Record<string, EnrichedWheel>,
  bis: Record<string, BisEntry>,
  roster: UserRoster,
  starFloors: Record<string, { starFloor: number; note?: string }> = {},
  limit = 20
): WheelTarget[] {
  const out: WheelTarget[] = []

  for (const awakener of Object.values(awakeners)) {
    const ann = awakener.annotation
    if (!ann) continue
    const entry = getAwakenerEntry(roster, awakener.id)
    // Only advise on wheels for characters the player actually fields.
    if (!entry.owned) continue
    if (slotIndex(entry.enlightenSlot ?? 'E0') < slotIndex(ann.viabilityFloor ?? 'E0')) continue

    const variants = bis[awakener.id]?.variants ?? []
    for (const variant of variants) {
      for (const rec of variant.wheels) {
        if (rec.tier !== 'BIS_SSR' && rec.tier !== 'BIS_SR') continue
        const wheel = wheels[rec.wheelId]
        if (!wheel) continue
        const wheelEntry = getWheelEntry(roster, rec.wheelId)
        const floor = starFloors[rec.wheelId]

        if (!wheelEntry.owned) {
          out.push({
            wheelId: rec.wheelId,
            name: wheel.name,
            rarity: wheel.rarity,
            forAwakenerId: awakener.id,
            forAwakenerName: awakener.name,
            owned: false,
            starLevel: 0,
            recommendedStarFloor: floor?.starFloor,
            reason: `Best-in-slot for ${awakener.name}, who you already run.${floor?.note ? ` ${floor.note}` : ''}`,
          })
        } else if (floor && (wheelEntry.starLevel ?? 0) < floor.starFloor) {
          out.push({
            wheelId: rec.wheelId,
            name: wheel.name,
            rarity: wheel.rarity,
            forAwakenerId: awakener.id,
            forAwakenerName: awakener.name,
            owned: true,
            starLevel: wheelEntry.starLevel ?? 0,
            recommendedStarFloor: floor.starFloor,
            reason: `Owned at E${wheelEntry.starLevel ?? 0}, but wants at least E${floor.starFloor} for ${awakener.name}.${floor.note ? ` ${floor.note}` : ''}`,
          })
        }
      }
    }
  }

  // One row per wheel — a wheel wanted by three characters is still one pull.
  const seen = new Set<string>()
  return out
    .filter((t) => (seen.has(t.wheelId) ? false : (seen.add(t.wheelId), true)))
    .slice(0, limit)
}

// ---------------------------------------------------------------------------
// Meta lineups
// ---------------------------------------------------------------------------

export function buildMetaLineupStatus(
  teams: MetaTeam[],
  awakeners: Record<string, EnrichedAwakener>,
  roster: UserRoster
): MetaLineupStatus[] {
  return teams
    .map((team) => {
      const missing: { id: string; name: string }[] = []
      const belowFloor: MetaLineupStatus['belowFloor'] = []
      let ownedCount = 0

      team.awakenerIds.forEach((id, i) => {
        const name = team.awakenerNames[i] ?? awakeners[id]?.name ?? id
        const entry = getAwakenerEntry(roster, id)
        if (!entry.owned) {
          missing.push({ id, name })
          return
        }
        ownedCount += 1
        const floor = awakeners[id]?.annotation?.viabilityFloor ?? 'E0'
        const current = entry.enlightenSlot ?? 'E0'
        if (slotIndex(current) < slotIndex(floor)) {
          belowFloor.push({ id, name, current, floor })
        }
      })

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

export function buildMetaAdvice(
  awakeners: Record<string, EnrichedAwakener>,
  wheels: Record<string, EnrichedWheel>,
  bis: Record<string, BisEntry>,
  metaTeams: MetaTeam[],
  roster: UserRoster,
  starFloors: Record<string, { starFloor: number; note?: string }> = {}
): MetaAdvice {
  return {
    breakpoints: buildBreakpointAdvice(awakeners, roster),
    pullTargets: buildPullTargets(awakeners, roster),
    wheelTargets: buildWheelTargets(awakeners, wheels, bis, roster, starFloors),
    metaLineups: buildMetaLineupStatus(metaTeams, awakeners, roster),
    roleGaps: findRoleGaps(awakeners, roster),
  }
}
