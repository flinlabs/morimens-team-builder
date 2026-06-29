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
import { analyzeTeam } from './team-analysis'

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

// MYTHIC wheels that are paid/event exclusives with niche team-specific effects.
// They should never be auto-assigned as generic filler — only equip them when
// they explicitly appear in a unit's BiS list.
const NICHE_MYTHIC_WHEEL_IDS = new Set([
  'wheel-0043', // Special Training — Posse-triggered crit, very situational
  'wheel-0044', // School Day — D-Mark/Ashen Ruins aliemus, highly mode-specific
  'wheel-0045', // Dear Papa Noel — event wheel, niche use
  'wheel-0046', // Countdown Moment — event wheel, niche use
  'wheel-0047', // Stakes of Wisdom — event wheel, niche use
  'wheel-0130', // Private Afternoon — event wheel, niche use
  'wheel-0165', // Sakura Reveries — paid event wheel
])

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
  // No early return on empty BiS — signature wheels (Pass 0) and owned SR/R
  // fillers (Pass 2) still apply (e.g. a limited character without a BiS row).

  const wheels = getWheels()
  const isHighRarity = (id: string): boolean => {
    const r = wheels[id]?.rarity
    return r === 'SSR' || r === 'MYTHIC'
  }

  // Overlimit Causality: a character may field two SSR/MYTHIC wheels only if at
  // least ONE of the two is an owned +12 (stackLevel 12). Either the already-
  // equipped first wheel OR the incoming candidate satisfies it — whichever is
  // +12 unlocks the pair. If both slots would be high-rarity but neither is +12,
  // the second slot must be filled with SR/R/N instead.
  // (MYTHIC counts as SSR for this rule.)
  const breaksOverlimit = (candidate: string): boolean => {
    if (out.length !== 1) return false
    if (!isHighRarity(candidate)) return false
    if (!isHighRarity(out[0].wheelId)) return false
    // Legal only if either wheel is an owned +12. isDualSSRUnlocked requires
    // owned, so an unowned FALLBACK target in slot 1 can never unlock the pair.
    return (
      !isDualSSRUnlocked(roster, out[0].wheelId) &&
      !isDualSSRUnlocked(roster, candidate)
    )
  }

  // Whether a wheel can be taken from the shared pool (not already in use, or
  // Dual-SSR unlocked AND single-team mode only — D-Tide never shares copies).
  // Dual-SSR sharing only applies to SSR/MYTHIC wheels; SR/R/N are always unique.
  const isAvailable = (id: string): boolean => {
    if (!usedWheelIds.has(id)) return true
    return allowDualSSR && isHighRarity(id) && isDualSSRUnlocked(roster, id)
  }

  const out: WheelAssignment[] = []

  // Assign from a set of BiS recommendations (owned only), honouring the
  // physical-item + Overlimit constraints.
  const assignFromRecs = (recs: { tier: WheelTier; wheelIds: string[] }[]): void => {
    for (const rec of recs) {
      if (out.length >= 2) break
      for (const wheelId of rec.wheelIds) {
        if (out.some(a => a.wheelId === wheelId)) continue
        const entry = getWheelEntry(roster, wheelId)
        if (!entry.owned) continue
        if (!isAvailable(wheelId)) continue
        if (breaksOverlimit(wheelId)) continue

        const assignment: WheelAssignment = {
          slot: (out.length + 1) as 1 | 2,
          wheelId,
          tier: rec.tier,
        }
        if (usedWheelIds.has(wheelId) && allowDualSSR) {
          assignment.dualSSRNote = 'Second copy fielded via unlocked Dual-SSR (+12)'
        }
        out.push(assignment)
        usedWheelIds.add(wheelId)
        break
      }
    }
  }

  const isSsrTier = (t: WheelTier): boolean => t === 'BIS_SSR' || t === 'ALT_SSR'

  // Pass 1 — owned BiS wheels of SSR/Mythic tier first.
  assignFromRecs(ranked.filter((r) => isSsrTier(r.tier)))

  // Pass 1.5 — when the unit's BiS SSR isn't owned, substitute the strongest
  // owned high-rarity wheel rather than dropping straight to a weak filler. A
  // player's idle +12 SSR is worth far more than a generic SR.
  // Rules for substitution candidates:
  //   • Must be owned and not already in use (usedWheelIds handles exclusivity).
  //   • Niche paid/event MYTHICs (School Day, Special Training, etc.) are
  //     excluded — they offer less value than most generic SR wheels and should
  //     only be assigned when they appear explicitly in a unit's BiS list.
  //   • Generic SSRs are preferred over signature SSRs.
  //   • Within each group, +12 wheels rank first, then star level.
  //   • A signature SSR belonging to a teammate is naturally blocked by
  //     usedWheelIds once that teammate has claimed it in their own Pass 0/1.
  //     We do NOT pre-emptively exclude unclaimed teammate signatures here —
  //     if a teammate hasn't taken their own SSR yet, it is fair game.
  if (out.length < 2) {
    const subs = Object.values(wheels)
      .filter((w) => isHighRarity(w.id))
      .filter((w) => !NICHE_MYTHIC_WHEEL_IDS.has(w.id))
      .filter((w) => getWheelEntry(roster, w.id).owned)
      .filter((w) => !usedWheelIds.has(w.id) && !out.some((a) => a.wheelId === w.id))
      .filter((w) => !breaksOverlimit(w.id))
      .sort((a, b) => {
        const ga = a.ownerAwakenerId ? 1 : 0
        const gb = b.ownerAwakenerId ? 1 : 0
        if (ga !== gb) return ga - gb // generic before signature
        const ra = a.realm === awakener.realm ? 0 : 1
        const rb = b.realm === awakener.realm ? 0 : 1
        if (ra !== rb) return ra - rb // prefer the unit's realm
        const ea = getWheelEntry(roster, a.id)
        const eb = getWheelEntry(roster, b.id)
        if ((eb.stackLevel ?? 0) !== (ea.stackLevel ?? 0))
          return (eb.stackLevel ?? 0) - (ea.stackLevel ?? 0) // +12 first
        return (eb.starLevel ?? 0) - (ea.starLevel ?? 0)
      })
    for (const w of subs) {
      if (out.length >= 2) break
      // Re-check overlimit per iteration: the .filter() above was evaluated
      // against the pre-loop state, so once the first SSR lands in slot 1 the
      // second iteration must re-validate the Overlimit rule against it.
      if (breaksOverlimit(w.id)) continue
      out.push({ slot: (out.length + 1) as 1 | 2, wheelId: w.id, tier: 'GOOD' })
      usedWheelIds.add(w.id)
    }
  }

  // Pass 1b — owned BiS wheels of SR tier, after the strong-SSR substitute, so a
  // player's idle +12 SSR is preferred over a lower-rarity BiS wheel. Also picks
  // up owned signature SR wheels for this unit if they weren't superseded above.
  assignFromRecs(ranked.filter((r) => !isSsrTier(r.tier)))

  // Pass 1c — signature SR wheel for this unit, if not yet assigned and not
  // superseded by a better option in prior passes.
  if (out.length < 2) {
    for (const w of Object.values(wheels)) {
      if (out.length >= 2) break
      if (w.ownerAwakenerId !== awakener.id) continue
      if (w.rarity !== 'SR' && w.rarity !== 'R') continue
      const id = w.id
      if (out.some(a => a.wheelId === id)) continue
      if (!getWheelEntry(roster, id).owned) continue
      if (!isAvailable(id)) continue
      if (breaksOverlimit(id)) continue
      out.push({ slot: (out.length + 1) as 1 | 2, wheelId: id, tier: 'BIS_SR' })
      usedWheelIds.add(id)
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

  // Lead DPS signature — the posse owned by the team's main carry comes first.
  // A teammate's character-bonus posse (often a support's) shouldn't override
  // the carry's own posse just because it happens to grant a character bonus;
  // that bonus is still offered below as a situational alternative.
  if (posses) {
    const ownerIndex: Record<string, EnrichedPosse> = {}
    for (const posse of Object.values(posses)) {
      if (posse.ownerAwakenerId) ownerIndex[posse.ownerAwakenerId] = posse
    }
    for (const id of teamIds) {
      if (!awakeners[id]?.annotation?.teamRoles?.includes('main_dps')) continue
      const owned = ownerIndex[id]
      if (!owned) continue
      addIfUnlocked(
        owned.id,
        'lead',
        `Signature posse for lead DPS ${awakeners[id].name}`,
        owned.hasCharacterBonus ? awakeners[id].name : undefined
      )
    }
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
  allowDualSSR = true,
  usedPosseIds?: Set<string>
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

  // Pick this team's posse. In D-Tide every posse is locked to a single team
  // for the whole season, so when a shared `usedPosseIds` set is threaded we
  // surface the best posse not already claimed and reserve it; without it
  // (normal single-team recommendations) the full ranked list stands.
  let posseRecommendations = recommendPosses(
    candidate.awakenerIds,
    awakeners,
    roster,
    posses
  )
  if (usedPosseIds) {
    const free = posseRecommendations.filter((p) => !usedPosseIds.has(p.posseId))
    const taken = posseRecommendations.filter((p) => usedPosseIds.has(p.posseId))
    posseRecommendations = [...free, ...taken]
    if (free[0]) usedPosseIds.add(free[0].posseId)
  }

  return {
    rank,
    composition,
    posseRecommendations,
    compositionNote: candidate.metaName
      ? `${candidate.metaName} — ${compositionNote(candidate, awakeners)}`
      : compositionNote(candidate, awakeners),
    coverageGaps: candidate.coverageGaps,
    realmNote: candidate.mixingNote,
    investmentWarnings,
    metaName: candidate.metaName,
    metaSource: candidate.metaSource,
    analysis: analyzeTeam(candidate.awakenerIds, awakeners),
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
  // the lineup — no second copy even when Dual-SSR is unlocked — and likewise
  // every posse is locked to one team for the season, so no team may reuse a
  // posse another already runs.
  const usedPosseIds = new Set<string>()
  return teams.map((team, i) =>
    buildTeamRecommendation(team, i + 1, roster, awakeners, posses, usedWheelIds, false, usedPosseIds)
  )
}