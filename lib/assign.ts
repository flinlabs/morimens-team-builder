/** Deterministic gear / posse / covenant assignment.
Turns a CandidateTeam (who is on the team) into a fully-geared TeamRecommendation
(what each unit equips, which posse the team runs, what to level). This is the
second half of the algorithm: generateCandidateTeams / solveDtide pick the
members, and this module assigns their kit from the player's owned inventory.

Everything here is deterministic — it reads the build data (recommended wheels,
covenants, mainstats, substats) and the roster, and resolves the best owned
option per slot. No AI is involved; the AI layer (if any) only narrates the
result. Source data verified present for 56/57 awakeners' builds. **/

import type {
  EnrichedAwakener,
  EnrichedPosse,
  UserRoster,
  CandidateTeam,
  SkeyBuildVariant,
  WheelTier,
  WheelAssignment,
  CovenantRecommendation,
  PosseRecommendation,
  CharacterAssignment,
  TeamRecommendation,
} from './types'
import {
  getAwakenerEntry,
  getWheelEntry,
  isDualSSRUnlocked,
  getCovenantEntry,
  getPosseEntry,
} from './roster'
import { getBisData, getWheels, type BisVariant } from './db'

// Best-to-worst wheel tier order.
const WHEEL_TIER_ORDER: WheelTier[] = ['BIS_SSR', 'ALT_SSR', 'BIS_SR', 'GOOD']

// Normalise a BiS tier ("SR_SHOP") to the assigner's tier vocabulary.
function normTier(tier: string): WheelTier {
  if (tier === 'BIS_SSR' || tier === 'ALT_SSR' || tier === 'BIS_SR' || tier === 'GOOD') {
    return tier
  }
  return 'GOOD' // SR_SHOP and anything else
}

// Choose the BiS variant that best matches how the unit is being used. A
// damage role prefers a "dps"/"carry" variant; otherwise a support/standard one.
function pickBisVariant(awakenerId: string, role?: string): BisVariant | null {
  const entry = getBisData()[awakenerId]
  if (!entry || !entry.variants.length) return null
  if (entry.variants.length === 1) return entry.variants[0]
  const wantsDps = !!role && /dps|carry/i.test(role)
  const dps = entry.variants.find((v) => /dps|carry/i.test(v.variant))
  const sup = entry.variants.find((v) => /sup|support|tank|defen|standard/i.test(v.variant))
  if (wantsDps && dps) return dps
  if (!wantsDps && sup) return sup
  return entry.variants[0]
}

// Recommended wheels for a unit, tier-grouped, sourced from BiS data first and
// falling back to the awakener's build record.
function recommendedWheelsFor(
  awakener: EnrichedAwakener,
  role?: string
): { tier: WheelTier; wheelIds: string[] }[] {
  const bis = pickBisVariant(awakener.id, role)
  if (bis && bis.wheels.length) {
    return bis.wheels.map((w) => ({ tier: normTier(w.tier), wheelIds: [w.wheelId] }))
  }
  const variant = primaryVariant(awakener)
  return (variant?.recommendedWheels ?? []).map((r) => ({
    tier: r.tier,
    wheelIds: r.wheelIds,
  }))
}

// Recommended covenant ids for a unit, BiS-first.
function recommendedCovenantsFor(awakener: EnrichedAwakener, role?: string): string[] {
  const bis = pickBisVariant(awakener.id, role)
  if (bis && bis.covenants.length) return bis.covenants.map((c) => c.covenantId)
  return primaryVariant(awakener)?.recommendedCovenantIds ?? []
}

// The build variant the player should follow (its designated primary, else the
// first listed).
function primaryVariant(awakener: EnrichedAwakener): SkeyBuildVariant | null {
  const build = awakener.build
  if (!build || !build.builds.length) return null
  return build.builds.find(v => v.id === build.primaryBuildId) ?? build.builds[0]
}

// ---------------------------------------------------------------------------
// Wheel assignment
// ---------------------------------------------------------------------------

// Assign up to 2 wheels to a unit, best-tier-first, from owned inventory.
// A wheel is a physical item: it cannot sit on two units at once unless its
// Dual-SSR copy is unlocked (stackLevel 12). `usedWheelIds` is mutated so the
// same wheel is not double-assigned across a multi-team D-Tide solution.
// Slots that cannot be filled from inventory emit a FALLBACK entry pointing at
// the best recommended wheel as an acquisition target.
export function assignWheels(
  awakener: EnrichedAwakener,
  roster: UserRoster,
  usedWheelIds: Set<string> = new Set(),
  role?: string,
  allowDualSSR = true
): WheelAssignment[] {
  const ranked = [...recommendedWheelsFor(awakener, role)].sort(
    (a, b) => WHEEL_TIER_ORDER.indexOf(a.tier) - WHEEL_TIER_ORDER.indexOf(b.tier)
  )
  if (!ranked.length) return []

  const wheels = getWheels()
  const isHighRarity = (id: string): boolean => {
    const r = wheels[id]?.rarity
    return r === 'SSR' || r === 'MYTHIC'
  }
  // Overlimit Causality: a character may field two SSR/Mythic wheels only if at
  // least one equipped wheel is +12. Otherwise the second wheel must be lower
  // rarity (SR/R/N are strong fillers).
  const breaksOverlimit = (candidate: string): boolean =>
    out.length === 1 &&
    isHighRarity(candidate) &&
    isHighRarity(out[0].wheelId) &&
    !isDualSSRUnlocked(roster, candidate) &&
    !isDualSSRUnlocked(roster, out[0].wheelId)

  const out: WheelAssignment[] = []

  // Pass 1 — fill from owned wheels, honouring the physical-item + Overlimit constraints.
  for (const rec of ranked) {
    if (out.length >= 2) break
    for (const wheelId of rec.wheelIds) {
      if (out.some(a => a.wheelId === wheelId)) continue
      const entry = getWheelEntry(roster, wheelId)
      if (!entry.owned) continue
      const inUse = usedWheelIds.has(wheelId)
      if (inUse && (!allowDualSSR || !isDualSSRUnlocked(roster, wheelId))) continue
      if (breaksOverlimit(wheelId)) continue

      const assignment: WheelAssignment = {
        slot: (out.length + 1) as 1 | 2,
        wheelId,
        tier: rec.tier,
      }
      if (inUse && allowDualSSR && isDualSSRUnlocked(roster, wheelId)) {
        assignment.dualSSRNote = 'Second copy fielded via unlocked Dual-SSR (+12)'
      }
      out.push(assignment)
      usedWheelIds.add(wheelId)
      break
    }
  }

  // Pass 2 — fill any remaining slot from an owned SR/R/N wheel. These are
  // strong, plentiful fillers and never trip the Overlimit rule. Honours the
  // shared used-pool so D-Tide stays unique; prefers the awakener's realm.
  if (out.length < 2) {
    const fillers = Object.values(wheels)
      .filter((w) => {
        const r = w.rarity
        return r === 'SR' || r === 'R' || r === 'N'
      })
      .filter((w) => getWheelEntry(roster, w.id).owned)
      .filter((w) => !usedWheelIds.has(w.id) && !out.some((a) => a.wheelId === w.id))
      .sort((a, b) => {
        const ra = a.realm === awakener.realm ? 0 : 1
        const rb = b.realm === awakener.realm ? 0 : 1
        if (ra !== rb) return ra - rb
        const rank: Record<string, number> = { SR: 0, R: 1, N: 2 }
        return (rank[a.rarity] ?? 3) - (rank[b.rarity] ?? 3)
      })
    for (const w of fillers) {
      if (out.length >= 2) break
      out.push({ slot: (out.length + 1) as 1 | 2, wheelId: w.id, tier: 'GOOD' })
      usedWheelIds.add(w.id)
    }
  }

  // Pass 3 — recommend acquisition targets for any still-unfilled slot. Respects
  // the shared used-pool (so D-Tide never repeats a wheel) and the Overlimit rule.
  for (const rec of ranked) {
    if (out.length >= 2) break
    for (const target of rec.wheelIds) {
      if (out.some(a => a.wheelId === target)) continue
      if (usedWheelIds.has(target)) continue
      if (breaksOverlimit(target)) continue
      out.push({ slot: (out.length + 1) as 1 | 2, wheelId: target, tier: 'FALLBACK' })
      usedWheelIds.add(target)
      break
    }
  }

  return out
}

// ---------------------------------------------------------------------------
// Covenant recommendation
// ---------------------------------------------------------------------------

// Pick the best owned recommended covenant (or the top recommendation as a
// target if none are owned), with completion info and priority substats.
export function recommendCovenant(
  awakener: EnrichedAwakener,
  roster: UserRoster,
  role?: string,
  usedCovenantIds: Set<string> = new Set()
): CovenantRecommendation {
  const variant = primaryVariant(awakener)
  const ids = recommendedCovenantsFor(awakener, role)
  const prioritySubstats = (variant?.substatPriorityGroups ?? []).flat()

  // A covenant set is a physical item: two characters can't run the same set,
  // so skip anything a teammate already took and fall to the next recommendation.
  for (const covenantId of ids) {
    if (usedCovenantIds.has(covenantId)) continue
    const entry = getCovenantEntry(roster, covenantId)
    if (entry.owned) {
      usedCovenantIds.add(covenantId)
      return {
        covenantId,
        sixPieceAvailable: entry.sixPieceComplete,
        completionPercent: entry.completionPercent,
        prioritySubstats,
      }
    }
  }

  for (const target of ids) {
    if (usedCovenantIds.has(target)) continue
    usedCovenantIds.add(target)
    return {
      covenantId: target,
      sixPieceAvailable: false,
      prioritySubstats,
      acquisitionNote: 'Not owned — recommended covenant to build toward.',
    }
  }

  return {
    covenantId: '',
    sixPieceAvailable: false,
    prioritySubstats,
    note: 'No covenant recommendation in build data.',
  }
}

// ---------------------------------------------------------------------------
// Posse recommendation (one posse per team)
// ---------------------------------------------------------------------------

// Rank the posses worth running on this team:
//   anchor      — a teammate's character-bonus posse that is unlocked
//   strong      — a handbook-recommended posse for a teammate, unlocked
//   situational — any unlocked posse matching a team realm
// Only unlocked posses are returned. `posses` (the DB) is optional; without it,
// situational realm picks are skipped.
export function recommendPosses(
  teamIds: string[],
  awakeners: Record<string, EnrichedAwakener>,
  roster: UserRoster,
  posses?: Record<string, EnrichedPosse>
): PosseRecommendation[] {
  const out: PosseRecommendation[] = []
  const seen = new Set<string>()

  const addIfUnlocked = (
    posseId: string,
    priority: PosseRecommendation['priority'],
    reason: string,
    characterBonusActive?: string
  ) => {
    if (!posseId || seen.has(posseId)) return
    if (!getPosseEntry(roster, posseId).unlocked) return
    out.push({ posseId, priority, reason, characterBonusActive })
    seen.add(posseId)
  }

  // Anchors — character-bonus posses for units on the team.
  for (const id of teamIds) {
    const ann = awakeners[id]?.annotation
    if (ann?.anchorPosse) {
      addIfUnlocked(
        ann.anchorPosse,
        'anchor',
        `Character-bonus posse for ${awakeners[id].name}`,
        awakeners[id].name
      )
    }
  }

  // Strong — handbook-recommended posses for units on the team.
  for (const id of teamIds) {
    const ann = awakeners[id]?.annotation
    for (const posseId of ann?.recommendedPosses ?? []) {
      addIfUnlocked(posseId, 'strong', `Recommended for ${awakeners[id].name}`)
    }
  }

  // Situational — any unlocked posse matching a realm present on the team.
  if (posses) {
    const teamRealms = new Set<string>()
    for (const id of teamIds) {
      const realm = awakeners[id]?.realm
      if (realm) teamRealms.add(realm)
    }
    for (const posse of Object.values(posses)) {
      if (seen.has(posse.id)) continue
      if (teamRealms.has(posse.realm)) {
        addIfUnlocked(posse.id, 'situational', `Realm-appropriate (${posse.realm})`)
      }
    }
  }

  return out
}

// ---------------------------------------------------------------------------
// Skill / talent investment notes
// ---------------------------------------------------------------------------

function skillNoteFor(
  awakener: EnrichedAwakener,
  roster: UserRoster
): string | undefined {
  const ann = awakener.annotation
  const entry = getAwakenerEntry(roster, awakener.id)
  const low = (ann?.keySkillSlots ?? []).filter(s => (entry.skillLevels[s] ?? 1) < 4)
  return low.length ? `Level key skill(s): ${low.join(', ')} (currently below 4/6)` : undefined
}

function talentNoteFor(
  awakener: EnrichedAwakener,
  roster: UserRoster,
  arc: UserRoster['settings']['arcRuleset']
): string | undefined {
  const ann = awakener.annotation
  const entry = getAwakenerEntry(roster, awakener.id)
  const kt = ann?.keyTalents ?? []
  const msgs: string[] = []
  if (kt.includes('madness_omen') && entry.talentLevels.madnessOmen < 6) {
    msgs.push(`Madness Omen ${entry.talentLevels.madnessOmen}/12 (more starting Aliemus)`)
  }
  if (kt.includes('soulforge_aptitude') && arc === 'ASTRAL_REIGN' && entry.talentLevels.soulforgeAptitude < 3) {
    msgs.push(`Soulforge ${entry.talentLevels.soulforgeAptitude} — key in Astral Reign`)
  }
  return msgs.length ? msgs.join('; ') : undefined
}

// ---------------------------------------------------------------------------
// Composition note
// ---------------------------------------------------------------------------

function compositionNote(
  candidate: CandidateTeam,
  awakeners: Record<string, EnrichedAwakener>
): string {
  const realmLabel = candidate.realmComposition.join(' + ') || 'mixed'
  const dps = candidate.awakenerIds.filter(id =>
    awakeners[id]?.annotation?.teamRoles?.includes('main_dps')
  )
  const dpsNames = dps.map(id => awakeners[id].name)
  const supportNames = candidate.awakenerIds
    .filter(id => !dps.includes(id))
    .map(id => awakeners[id].name)

  const lead = dpsNames.length
    ? `${realmLabel} team built around ${dpsNames.join(' & ')}`
    : `${realmLabel} support-oriented team`
  const support = supportNames.length ? `, supported by ${supportNames.join(', ')}` : ''
  return `${lead}${support}.`
}

// ---------------------------------------------------------------------------
// Assemblers
// ---------------------------------------------------------------------------

// Turn one CandidateTeam into a fully-geared TeamRecommendation. `usedWheelIds`
// can be shared across calls (D-Tide) so wheels are not double-assigned.
export function buildTeamRecommendation(
  candidate: CandidateTeam,
  rank: number,
  roster: UserRoster,
  awakeners: Record<string, EnrichedAwakener>,
  posses?: Record<string, EnrichedPosse>,
  usedWheelIds: Set<string> = new Set(),
  allowDualSSR = true
): TeamRecommendation {
  const arc = roster.settings.arcRuleset
  const composition: CharacterAssignment[] = []
  const investmentWarnings: string[] = []
  // Covenants are per-team unique — a set can't be worn by two characters.
  const usedCovenantIds = new Set<string>()

  for (const id of candidate.awakenerIds) {
    const awakener = awakeners[id]
    if (!awakener) continue
    const ann = awakener.annotation
    const role = ann?.teamRoles?.[0] ?? 'flex'
    const wheelAssignments = assignWheels(awakener, roster, usedWheelIds, role, allowDualSSR)
    const covenantRecommendation = recommendCovenant(awakener, roster, role, usedCovenantIds)

    if (wheelAssignments.some(w => w.tier === 'FALLBACK')) {
      investmentWarnings.push(`${awakener.name} is missing recommended wheels.`)
    }
    if (!getAwakenerEntry(roster, id).owned) {
      investmentWarnings.push(`${awakener.name} is not owned.`)
    }

    composition.push({
      awakenerId: id,
      roleInThisTeam: ann?.teamRoles?.[0] ?? 'flex',
      wheelAssignments,
      covenantRecommendation,
      skillNote: skillNoteFor(awakener, roster),
      talentNote: talentNoteFor(awakener, roster, arc),
    })
  }

  return {
    rank,
    composition,
    posseRecommendations: recommendPosses(candidate.awakenerIds, awakeners, roster, posses),
    compositionNote: candidate.metaName
      ? `${candidate.metaName} — ${compositionNote(candidate, awakeners)}`
      : compositionNote(candidate, awakeners),
    coverageGaps: candidate.coverageGaps,
    realmNote: candidate.mixingNote,
    investmentWarnings,
    metaName: candidate.metaName,
    metaSource: candidate.metaSource,
  }
}

// Assemble a full D-Tide recommendation: rank the 5 teams and thread a single
// usedWheelIds set across all of them so no wheel is assigned twice.
export function buildDtideRecommendation(
  teams: CandidateTeam[],
  roster: UserRoster,
  awakeners: Record<string, EnrichedAwakener>,
  posses?: Record<string, EnrichedPosse>
): TeamRecommendation[] {
  const usedWheelIds = new Set<string>()
  // D-Tide fields all five teams at once, so every wheel must be unique across
  // the lineup — no second copy even when Dual-SSR is unlocked.
  return teams.map((team, i) =>
    buildTeamRecommendation(team, i + 1, roster, awakeners, posses, usedWheelIds, false)
  )
}