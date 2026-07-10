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
import { effectiveGnosticLevel } from './stats'
import { getArcViabilityModifier, getArcViabilityNote } from './arc-rules'

const ENLIGHTEN_ORDER: EnlightenSlot[] = ['E0', 'E1', 'E2', 'E3', 'OE', 'AA']

export function enlightenRank(slot: EnlightenSlot): number {
  return ENLIGHTEN_ORDER.indexOf(slot)
}

export function meetsFloor(slot: EnlightenSlot, floor: EnlightenSlot): boolean {
  return enlightenRank(slot) >= enlightenRank(floor)
}

function expectedCharacterLevel(keeperLevel: number): number {
  // Rough mapping: keeper level drives the level cap
  // Level cap increases every ~10 keeper levels
  return Math.min(90, 10 + keeperLevel * 2)
}

function enlightenScore(
  entry: AwakenerEntry,
  awakener: EnrichedAwakener
): number {
  const floor = awakener.annotation?.viabilityFloor ?? 'E0'
  const breakpoints = awakener.annotation?.enlightenBreakpoints ?? []

  // Below the comfort floor the unit is playable but far from its kit's
  // intent — small partial credit that grows as the floor approaches, so a
  // one-off-the-floor unit ranks above a fresh E0 copy.
  if (!meetsFloor(entry.enlightenSlot, floor)) {
    const progress = (enlightenRank(entry.enlightenSlot) + 1) / (enlightenRank(floor) + 1)
    return 0.25 * progress
  }

  const currentRank = enlightenRank(entry.enlightenSlot)
  const maxRank = enlightenRank('AA')

  // At or above the floor, credit ABSOLUTE dupes: two units at E3 hold the
  // same investment whatever their floors. Scoring relative to the floor made
  // a floor-E3 carry (Helot: Catena) permanently rank below a floor-E0 one
  // (Sorel) at identical enlighten, when the high-floor unit is the one whose
  // kit just came fully online — kit quality is the annotation tier's job.
  const baseScore = 0.5 + 0.5 * (currentRank / maxRank)

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
  const { madnessOmen, soulforgeAptitude } = entry.talentLevels
  // Permanent/limited units have Gnostic Potential maxed on acquisition; only
  // welfare units level it manually. Score the effective level, not the stored.
  const gnosticPotential = effectiveGnosticLevel(awakener, entry.talentLevels.gnosticPotential)

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

function isLevelAppropriate(
  entry: AwakenerEntry,
  keeperLevel: number
): boolean {
  const expected = expectedCharacterLevel(keeperLevel)
  // Allow 10 levels below expected without penalizing
  return entry.characterLevel >= expected - 10
}

export function scoreViability(
  awakenerId: string,
  entry: AwakenerEntry,
  awakener: EnrichedAwakener,
  roster: UserRoster,
  arcRuleset: 'FADED_LEGACY' | 'ASTRAL_REIGN' = 'FADED_LEGACY'
): ViabilityResult {
  const flags: string[] = []
  const annotation = awakener.annotation

  // Below the comfort floor a unit is deprioritized, not banned. Hard-zeroing
  // erased every starter (Ogier's floor is OE, Lotan's E3) and units like
  // Aurita (E1) from thin rosters entirely, when they are perfectly serviceable
  // filler — the tier cap below keeps them labelled Underinvested and ranked
  // behind properly-built units, while still fieldable.
  const floor = annotation?.viabilityFloor ?? 'E0'
  const belowFloor = !meetsFloor(entry.enlightenSlot, floor)
  if (belowFloor) {
    flags.push(`Below comfort floor (wants ${floor}) — usable, but deprioritized`)
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
  const baseScore =
    eScore * 0.35 +
    sScore * 0.35 +
    tScore * 0.15 +
    wScore * 0.15

  const arcMod = getArcViabilityModifier(awakenerId, arcRuleset)
  // Character strength matters, not just investment: an equally-invested
  // tier-A unit (GHelot) should outrank a tier-B one (Sorel). Small additive
  // term so investment still dominates and ties break toward the meta.
  const TIER_BONUS: Record<string, number> = { S: 0.08, A: 0.05, B: 0.02, C: 0 }
  const tierBonus = TIER_BONUS[annotation?.tier ?? ''] ?? 0
  const totalScore = Math.max(0, Math.min(1, baseScore + arcMod + tierBonus))
  if (arcMod !== 0) {
    const note = getArcViabilityNote(awakenerId, arcRuleset)
    flags.push(
      `${arcMod > 0 ? '+' : ''}${arcMod.toFixed(2)} ${arcRuleset === 'ASTRAL_REIGN' ? 'Astral Reign' : 'Faded Legacy'} adjustment${note ? ` — ${note}` : ''}`
    )
  }

  // Determine tier
  let tier: ViabilityTier
  let label: ViabilityResult['label']

  if (totalScore >= 0.75 && flags.filter(f => f.startsWith('Key skill') || f.startsWith('Below')).length === 0) {
    tier = 4
    label = 'Raid-Ready'
  } else if (totalScore >= 0.5) {
    tier = 3
    label = 'Functional'
  } else if (totalScore >= 0.25) {
    tier = 2
    label = 'Underinvested'
  } else {
    tier = 1
    label = 'Not Ready'
  }

  // A below-floor unit is never better than Underinvested, whatever the math
  // says — a level-90 E1 Lotan (floor E3) is filler, not a raid piece.
  if (belowFloor && tier > 2) {
    tier = 2
    label = 'Underinvested'
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