/** Wheel purpose tags and role fit.

Derives what each Wheel of Destiny is FOR (offense, shields, keyflare, …) from
its SKeyDB search tags, mainstat, and effect text, then scores how well a wheel
serves a unit's team role. This is what stops a keyflare bot walking off with
Blade of the Titan while the carry runs a sigil-economy wheel.

Derivation is automatic so new wheels work without maintenance, and
annotations/wheels.json can override any wheel whose derived purposes are
wrong — the same annotate-and-match model used for awakeners. Pure functions,
no fs, so both the server assigner and (later) client autofill can use it. **/

import type { EnrichedWheel, TeamRole } from './types'

export type WheelPurpose =
  | 'offense' // raises the wielder's damage output (base dmg, final dmg, dmg amp)
  | 'crit' // crit rate / crit dmg
  | 'str' // STR generation
  | 'shield'
  | 'heal'
  | 'death_resist'
  | 'keyflare'
  | 'aliemus'
  | 'card_economy' // draw, arithmetica, hand limit, discard payoffs
  | 'tentacle'
  | 'poison'
  | 'counter'
  | 'embryo'
  | 'economy' // sigils / shop — out-of-combat value

export interface WheelPurposeOverrides {
  [wheelId: string]: WheelPurpose[]
}

// searchTags → purposes (SKeyDB's tags are hand-set and reliable when present).
const TAG_PURPOSE: Record<string, WheelPurpose> = {
  'Crit DMG': 'crit',
  'Crit Rate': 'crit',
  'STR Up': 'str',
  Shield: 'shield',
  Heal: 'heal',
  'Death Resistance': 'death_resist',
  Keyflare: 'keyflare',
  Aliemus: 'aliemus',
  Draw: 'card_economy',
  Arithmetica: 'card_economy',
  'Hand Limit': 'card_economy',
  Discard: 'card_economy',
  'Tentacle DMG': 'tentacle',
  Poison: 'poison',
  Counter: 'counter',
  'Embryo Fusion': 'embryo',
  'Sigil Gain': 'economy',
  'Sigil Yield': 'economy',
}

// mainstat → weak purpose signal (only used when nothing stronger derives).
const MAINSTAT_PURPOSE: Record<string, WheelPurpose> = {
  CRIT_RATE: 'crit',
  CRIT_DMG: 'crit',
  DMG_AMP: 'offense',
  KEYFLARE_REGEN: 'keyflare',
  ALIEMUS_REGEN: 'aliemus',
  DEATH_RESISTANCE: 'death_resist',
  SIGIL_YIELD: 'economy',
}

// Effect-text patterns, checked against descriptionTemplate.
const TEXT_PURPOSE: [RegExp, WheelPurpose][] = [
  [/Base DMG|Final DMG|Active DMG|DMG Amplification|deal .*DMG|Exalt DMG|Pursuit/i, 'offense'],
  [/Crit\.? (Rate|DMG)/i, 'crit'],
  [/\bSTR\b|Temporary STR/i, 'str'],
  [/Shield/i, 'shield'],
  [/recover .*HP|HP Recovery|Healing|restore .*HP/i, 'heal'],
  [/Death Resistance/i, 'death_resist'],
  [/Keyflare/i, 'keyflare'],
  [/Aliemus/i, 'aliemus'],
  [/[Dd]raw \d|Arithmetica [Cc]ost|Hand Limit|Discard Pile|return it to your hand/i, 'card_economy'],
  [/Tentacle/i, 'tentacle'],
  [/Poison/i, 'poison'],
  [/Counter/i, 'counter'],
  [/Embryo/i, 'embryo'],
  [/Sigil|shop|stock/i, 'economy'],
]

/** All purposes a wheel serves. Overrides > searchTags/text > mainstat. */
export function deriveWheelPurposes(
  wheel: Pick<EnrichedWheel, 'id' | 'mainstatKey' | 'descriptionTemplate'> & {
    searchTags?: string[]
  },
  overrides?: WheelPurposeOverrides
): Set<WheelPurpose> {
  const override = overrides?.[wheel.id]
  if (override && override.length) return new Set(override)

  const purposes = new Set<WheelPurpose>()
  for (const t of wheel.searchTags ?? []) {
    const p = TAG_PURPOSE[t]
    if (p) purposes.add(p)
  }
  const desc = wheel.descriptionTemplate ?? ''
  for (const [re, p] of TEXT_PURPOSE) {
    if (re.test(desc)) purposes.add(p)
  }
  if (purposes.size === 0) {
    const p = wheel.mainstatKey ? MAINSTAT_PURPOSE[wheel.mainstatKey] : undefined
    if (p) purposes.add(p)
  }
  return purposes
}

// What each role WANTS from a wheel.
const ROLE_WANTS: Partial<Record<TeamRole, WheelPurpose[]>> = {
  main_dps: ['offense', 'crit', 'str', 'tentacle', 'poison', 'counter', 'embryo'],
  sub_dps: ['offense', 'crit', 'str', 'tentacle', 'poison', 'counter', 'embryo'],
  shielder: ['shield', 'death_resist', 'heal'],
  healer: ['heal', 'shield', 'death_resist'],
  death_resist: ['death_resist', 'shield', 'heal'],
  keyflare_support: ['keyflare', 'card_economy', 'aliemus'],
  aliemus_battery: ['aliemus', 'keyflare'],
  str_support: ['str', 'aliemus'],
  embryo_gen: ['embryo', 'aliemus', 'keyflare'],
  poison_stacker: ['poison', 'offense', 'aliemus'],
  corrosion_applier: ['aliemus', 'offense', 'crit'],
  card_cycler: ['card_economy', 'keyflare', 'aliemus'],
  tentacle_enabler: ['tentacle', 'str', 'aliemus'],
  leap_support: ['aliemus', 'card_economy'],
  vuln_applier: ['aliemus', 'keyflare'],
  weak_applier: ['aliemus', 'keyflare'],
  sacrifice_engine: ['heal', 'shield', 'aliemus'],
  relic_gen: ['aliemus', 'keyflare', 'card_economy'],
}

const DPS_ROLES = new Set<TeamRole>(['main_dps', 'sub_dps'])
const DAMAGE_PURPOSES = new Set<WheelPurpose>(['offense', 'crit'])
const SUPPORT_ONLY_PURPOSES = new Set<WheelPurpose>([
  'heal',
  'shield',
  'death_resist',
  'economy',
])

/**
 * 2 = the wheel serves this role; 1 = neutral (unknown wheel or unmapped
 * role); 0 = anti-fit — the wheel's every derived purpose points the other
 * way (a pure damage wheel on a keyflare bot, a pure sigil-economy wheel on
 * the carry). Anti-fit wheels are skipped whenever any alternative exists.
 */
export function wheelFitScore(
  wheel: Pick<EnrichedWheel, 'id' | 'mainstatKey' | 'descriptionTemplate'> & {
    searchTags?: string[]
  },
  role: TeamRole | string | undefined,
  overrides?: WheelPurposeOverrides
): number {
  const wants = role ? ROLE_WANTS[role as TeamRole] : undefined
  if (!wants) return 1
  const purposes = deriveWheelPurposes(wheel, overrides)
  if (purposes.size === 0) return 1
  if ([...purposes].some((p) => wants.includes(p))) return 2

  const isDps = DPS_ROLES.has(role as TeamRole)
  if (isDps) {
    // A wheel offering ONLY support-side value does nothing for a carry.
    return [...purposes].every((p) => SUPPORT_ONLY_PURPOSES.has(p)) ? 0 : 1
  }
  // A wheel offering ONLY the wielder's own damage does nothing for a support.
  return [...purposes].every((p) => DAMAGE_PURPOSES.has(p)) ? 0 : 1
}
