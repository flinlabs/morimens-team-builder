import type {
  EnrichedAwakener,
  AwakenerEntry,
  WheelEntry,
  UserRoster,
  ViabilityResult,
  ViabilityTier,
  EnlightenSlot,
  SkillSlot,
} from './types'
import { getWheelEntry } from './roster'

// ---------------------------------------------------------------------------
// Enlighten slot ordering
// ---------------------------------------------------------------------------

const ENLIGHTEN_ORDER: EnlightenSlot[] = ['E0', 'E1', 'E2', 'E3', 'OE', 'AA']

export function enlightenRank(slot: EnlightenSlot): number {
  return ENLIGHTEN_ORDER.indexOf(slot)
}

export function meetsFloor(slot: EnlightenSlot, floor: EnlightenSlot): boolean {
  return enlightenRank(slot) >= enlightenRank(floor)
}

// ---------------------------------------------------------------------------
// Keeper level → expected character level
// ---------------------------------------------------------------------------

function expectedCharacterLevel(keeperLevel: number): number {
  // Rough mapping: keeper level drives the level cap
  // Level cap increases every ~10 keeper levels
  return Math.min(90, 10 + keeperLevel * 2)
}

// ---------------------------------------------------------------------------
// Subscores (each 0.0 – 1.0)
// ---------------------------------------------------------------------------

function enlightenScore(
  entry: AwakenerEntry,
  awakener: EnrichedAwakener
): number {
  const floor = awakener.annotation?.viabilityFloor ?? 'E0'
  const breakpoints = awakener.annotation?.enlightenBreakpoints ?? []

  if (!meetsFloor(entry.enlightenSlot, floor)) return 0

  const floorRank = enlightenRank(floor)
  const currentRank = enlightenRank(entry.enlightenSlot)
  const maxRank = enlightenRank('AA')

  // Base score from how far above floor we are
  const baseScore = floorRank === maxRank
    ? 1.0
    : 0.5 + 0.5 * ((currentRank - floorRank) / (maxRank - floorRank))

  // Bonus for hitting annotated breakpoints
  const breakpointBonus = breakpoints.length > 0
    ? breakpoints.filter(bp => meetsFloor(entry.enlightenSlot, bp)).length / breakpoints.length * 0.1
    : 0

  return Math.min(1.0, baseScore + breakpointBonus)
}

function skillScore(
  entry: AwakenerEntry,
  awakener: EnrichedAwakener
): number {
  const keySlots: SkillSlot[] = awakener.annotation?.keySkillSlots ?? []
  const skillLevels = entry.skillLevels
  const hasOE = enlightenRank(entry.enlightenSlot) >= enlightenRank('OE')

  const slots: SkillSlot[] = [
    'Strike', 'Defense', 'Skill1', 'Skill2', 'Rouse', 'Exalt',
    ...(hasOE ? ['OverExalt' as SkillSlot] : []),
  ]

  let weightedSum = 0
  let totalWeight = 0

  for (const slot of slots) {
    const level = skillLevels[slot] ?? 1
    const isKey = keySlots.includes(slot)
    const weight = isKey ? 2 : 1
    weightedSum += (level / 6) * weight
    totalWeight += weight
  }

  return totalWeight > 0 ? weightedSum / totalWeight : 0
}

function talentMax(
  awakener: EnrichedAwakener,
  family: 'madness_omen' | 'soulforge_aptitude' | 'gnostic_potential',
  fallback: number
): number {
  const t = awakener.talents?.find(tl => tl.family === family)
  return t?.maxLevel && t.maxLevel > 0 ? t.maxLevel : fallback
}

function talentScore(
  entry: AwakenerEntry,
  awakener: EnrichedAwakener,
  arcRuleset: 'FADED_LEGACY' | 'ASTRAL_REIGN'
): number {
  const keyTalents = awakener.annotation?.keyTalents ?? []
  const { madnessOmen, soulforgeAptitude, gnosticPotential } = entry.talentLevels

  // Weight soulforge higher in Arc 2 (it is inert in Faded Legacy / Arc 1)
  const soulforgeWeight = arcRuleset === 'ASTRAL_REIGN' ? 1.5 : 0.5

  // Use each talent's real maxLevel from SKeyDB rather than hardcoded divisors
  const clamp01 = (x: number) => Math.max(0, Math.min(1, x))
  const moScore = clamp01(madnessOmen / talentMax(awakener, 'madness_omen', 12))
  const saScore = clamp01(soulforgeAptitude / talentMax(awakener, 'soulforge_aptitude', 10))
  const gpScore = clamp01(gnosticPotential / talentMax(awakener, 'gnostic_potential', 5))

  // Base weighted average
  const baseScore = (
    moScore * (keyTalents.includes('madness_omen') ? 2 : 1) +
    saScore * soulforgeWeight * (keyTalents.includes('soulforge_aptitude') ? 2 : 1) +
    gpScore * (keyTalents.includes('gnostic_potential') ? 2 : 1)
  ) / (
    (keyTalents.includes('madness_omen') ? 2 : 1) +
    soulforgeWeight * (keyTalents.includes('soulforge_aptitude') ? 2 : 1) +
    (keyTalents.includes('gnostic_potential') ? 2 : 1)
  )

  return baseScore
}

function wheelScore(
  awakenerId: string,
  roster: UserRoster,
  awakener: EnrichedAwakener
): number {
  const build = awakener.build
  if (!build || !build.builds || build.builds.length === 0) return 0.5 // neutral if no data

  const tierScores: Record<string, number> = {
    BIS_SSR: 1.0,
    ALT_SSR: 0.75,
    BIS_SR: 0.5,
    GOOD: 0.25,
  }

  // A recommended "slot" lists one or more interchangeable wheelIds; it counts
  // as owned if the player owns any of them. Score each build variant by its
  // best-two owned slots, and return the best variant the player can field.
  let bestVariantScore = 0

  for (const variant of build.builds) {
    let best1 = 0
    let best2 = 0
    for (const rec of variant.recommendedWheels ?? []) {
      const owned = (rec.wheelIds ?? []).some(
        wid => getWheelEntry(roster, wid).owned
      )
      if (!owned) continue
      const score = tierScores[rec.tier] ?? 0.1
      if (score > best1) {
        best2 = best1
        best1 = score
      } else if (score > best2) {
        best2 = score
      }
    }
    const variantScore = (best1 + best2) / 2
    if (variantScore > bestVariantScore) bestVariantScore = variantScore
  }

  return bestVariantScore
}

// ---------------------------------------------------------------------------
// Level flag
// ---------------------------------------------------------------------------

function isLevelAppropriate(
  entry: AwakenerEntry,
  keeperLevel: number
): boolean {
  const expected = expectedCharacterLevel(keeperLevel)
  // Allow 10 levels below expected without penalizing
  return entry.characterLevel >= expected - 10
}

// ---------------------------------------------------------------------------
// Main viability scorer
// ---------------------------------------------------------------------------

export function scoreViability(
  awakenerId: string,
  entry: AwakenerEntry,
  awakener: EnrichedAwakener,
  roster: UserRoster,
  arcRuleset: 'FADED_LEGACY' | 'ASTRAL_REIGN' = 'FADED_LEGACY'
): ViabilityResult {
  const flags: string[] = []
  const annotation = awakener.annotation

  // Hard exclusion: below viability floor
  const floor = annotation?.viabilityFloor ?? 'E0'
  if (!meetsFloor(entry.enlightenSlot, floor)) {
    return {
      tier: 1,
      label: 'Not Ready',
      score: 0,
      subscores: { enlighten: 0, skill: 0, talent: 0, wheel: 0 },
      flags: [`Below viability floor (needs ${floor})`],
    }
  }

  // Character not owned
  if (!entry.owned) {
    return {
      tier: 1,
      label: 'Not Ready',
      score: 0,
      subscores: { enlighten: 0, skill: 0, talent: 0, wheel: 0 },
      flags: ['Not owned'],
    }
  }

  // Level check
  if (!isLevelAppropriate(entry, roster.keeperLevel)) {
    flags.push(`Character level ${entry.characterLevel} may be low for Keeper level ${roster.keeperLevel}`)
  }

  // Annotation pending
  if (!annotation) {
    flags.push('Annotation pending — viability estimate only')
  }

  // Key skill check
  const keySlots = annotation?.keySkillSlots ?? []
  for (const slot of keySlots) {
    const level = entry.skillLevels[slot] ?? 1
    if (level < 4) {
      flags.push(`Key skill ${slot} is level ${level}/6`)
    }
  }

  // Key talent check
  const keyTalents = annotation?.keyTalents ?? []
  if (keyTalents.includes('madness_omen') && entry.talentLevels.madnessOmen < 6) {
    flags.push(`Madness Omen at ${entry.talentLevels.madnessOmen}/12`)
  }

  // Compute subscores
  const eScore = enlightenScore(entry, awakener)
  const sScore = skillScore(entry, awakener)
  const tScore = talentScore(entry, awakener, arcRuleset)
  const wScore = wheelScore(awakenerId, roster, awakener)

  // Weighted total
  const totalScore =
    eScore * 0.35 +
    sScore * 0.35 +
    tScore * 0.15 +
    wScore * 0.15

  // Determine tier
  let tier: ViabilityTier
  let label: ViabilityResult['label']

  if (totalScore >= 0.75 && flags.filter(f => f.startsWith('Key skill') || f.startsWith('Below')).length === 0) {
    tier = 4
    label = 'Raid-Ready'
  } else if (totalScore >= 0.5) {
    tier = 3
    label = 'Functional'
  } else if (totalScore >= 0.25 && meetsFloor(entry.enlightenSlot, floor)) {
    tier = 2
    label = 'Underinvested'
  } else {
    tier = 1
    label = 'Not Ready'
  }

  return {
    tier,
    label,
    score: Math.round(totalScore * 100) / 100,
    subscores: {
      enlighten: Math.round(eScore * 100) / 100,
      skill: Math.round(sScore * 100) / 100,
      talent: Math.round(tScore * 100) / 100,
      wheel: Math.round(wScore * 100) / 100,
    },
    flags,
  }
}

// ---------------------------------------------------------------------------
// Batch scorer — scores all owned awakeners in the roster
// ---------------------------------------------------------------------------

export function scoreAllViability(
  roster: UserRoster,
  awakeners: Record<string, EnrichedAwakener>
): Record<string, ViabilityResult> {
  const results: Record<string, ViabilityResult> = {}
  const arc = roster.settings.arcRuleset

  for (const [id, entry] of Object.entries(roster.awakeners)) {
    const awakener = awakeners[id]
    if (!awakener) continue
    results[id] = scoreViability(id, entry, awakener, roster, arc)
  }

  return results
}

// ---------------------------------------------------------------------------
// Helpers for generation layer
// ---------------------------------------------------------------------------

export function getViableAwakenerIds(
  roster: UserRoster,
  awakeners: Record<string, EnrichedAwakener>,
  minTier: ViabilityTier = 2
): string[] {
  const scores = scoreAllViability(roster, awakeners)
  return Object.entries(scores)
    .filter(([, result]) => result.tier >= minTier)
    .map(([id]) => id)
}

export function getViabilityLabel(tier: ViabilityTier): string {
  const labels: Record<ViabilityTier, string> = {
    1: 'Not Ready',
    2: 'Underinvested',
    3: 'Functional',
    4: 'Raid-Ready',
  }
  return labels[tier]
}

export function getViabilityColor(tier: ViabilityTier): string {
  const colors: Record<ViabilityTier, string> = {
    1: 'text-gray-500',
    2: 'text-orange-400',
    3: 'text-yellow-400',
    4: 'text-green-400',
  }
  return colors[tier]
}

export function getViabilityDotColor(tier: ViabilityTier): string {
  const colors: Record<ViabilityTier, string> = {
    1: 'bg-gray-600',
    2: 'bg-orange-400',
    3: 'bg-yellow-400',
    4: 'bg-green-400',
  }
  return colors[tier]
}