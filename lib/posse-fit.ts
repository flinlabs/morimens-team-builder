/** Posse purpose tags and team fit.

Derives what each posse actually DOES from its effect text, then scores how
well it serves a given lineup. This is the posse-side counterpart to
wheel-fit.ts and exists for the same reason: without it, the only posses the
engine could reach were the ones a teammate's annotation named by hand, plus
whatever happened to share a realm with someone on the board.

That realm gate was the real problem. Thirteen of the sixty-one posses sit in
realms no team can field — seven in FADED_LEGACY and six in OTHER — so they
were structurally unreachable no matter how well they fit. Encounter in Pure
White is the clearest casualty: it discards your hand and draws that many cards
plus two, which is the single best draw engine available to a discard team, and
it could only ever surface when Corposant or Saya happened to be on the board,
because those are the only two annotations that name it.

Derivation is automatic so new posses work without maintenance. Pure functions,
no fs, so both the server assigner and any later client autofill can use it. **/

import type { EnrichedPosse, EnrichedAwakener, TeamRole, SynergyTag } from './types'

export type PossePurpose =
  | 'draw' // card draw, discard, hand manipulation, discard-pile recovery
  | 'arithmetica'
  | 'aliemus'
  | 'keyflare'
  | 'str'
  | 'crit'
  | 'dmg_amp'
  | 'shield'
  | 'heal'
  | 'debuff' // Weakness / Vulnerable / STR down / Spellbound
  | 'poison'
  | 'counter'
  | 'embryo'
  | 'tentacle'
  | 'direct_damage'

// Effect-text patterns, checked against descriptionTemplate. A posse usually
// does two or three of these at once, which is fine — fit is scored on overlap,
// not on a single dominant purpose.
const TEXT_PURPOSE: [RegExp, PossePurpose][] = [
  [/[Dd]raw \d|[Dd]raw that many|Discard|Discover|from the Discard pile|add a copy|add one|add all|into your hand|Hand Limit/i, 'draw'],
  [/Arithmetica/i, 'arithmetica'],
  [/Aliemus/i, 'aliemus'],
  [/Keyflare/i, 'keyflare'],
  [/\bSTR\b(?!\s*[\u25bc\u2bc6])|Temporary \{?STR/i, 'str'],
  [/Crit\.? (Rate|DMG)/i, 'crit'],
  [/DMG Amplification/i, 'dmg_amp'],
  [/Shield/i, 'shield'],
  [/recover .*HP|HP Recovery|Heal/i, 'heal'],
  [/\{?Weakness\}?|\{?Vulnerable\}?|STR\s*[\u25bc\u2bc6]|reduce .*STR|Spellbound|\{?Steal\}?/i, 'debuff'],
  [/Poison/i, 'poison'],
  [/Counter/i, 'counter'],
  [/Embryo/i, 'embryo'],
  [/Tentacle/i, 'tentacle'],
  [/deal .*(DMG|damage)|Fixed DMG|Ancient Ember/i, 'direct_damage'],
]

/** Everything a posse does, read from its effect text. */
export function derivePossePurposes(posse: Pick<EnrichedPosse, 'descriptionTemplate'>): Set<PossePurpose> {
  const purposes = new Set<PossePurpose>()
  const desc = posse.descriptionTemplate ?? ''
  for (const [re, p] of TEXT_PURPOSE) {
    if (re.test(desc)) purposes.add(p)
  }
  return purposes
}

// What a team containing this role wants out of its posse slot. Deliberately
// narrow — a role only claims a purpose when the payoff is mechanical rather
// than merely nice, or every posse fits every team and the ranking says nothing.
const ROLE_WANTS: Partial<Record<TeamRole, PossePurpose[]>> = {
  card_cycler: ['draw', 'arithmetica'],
  main_dps: ['crit', 'dmg_amp', 'str'],
  sub_dps: ['crit', 'dmg_amp', 'str'],
  aliemus_battery: ['aliemus'],
  keyflare_support: ['keyflare', 'aliemus'],
  str_support: ['str'],
  shielder: ['shield', 'heal'],
  healer: ['heal', 'shield'],
  death_resist: ['shield', 'heal'],
  vuln_applier: ['debuff'],
  weak_applier: ['debuff'],
  poison_stacker: ['poison', 'debuff'],
  corrosion_applier: ['draw', 'debuff'],
  embryo_gen: ['embryo', 'aliemus'],
  tentacle_enabler: ['tentacle', 'str'],
  strike_enabler: ['draw', 'str'],
  relic_gen: ['draw', 'arithmetica'],
  sacrifice_engine: ['heal', 'shield'],
  leap_support: ['aliemus', 'arithmetica'],
}

const TAG_WANTS: Partial<Record<SynergyTag, PossePurpose[]>> = {
  aliemus_hungry: ['aliemus'],
  high_aliemus_cost: ['aliemus'],
  keyflare_hungry: ['keyflare'],
  counter_scaling: ['counter'],
  poison_stacker: ['poison'],
  bleed_stacker: ['debuff'],
  tentacle_scaling: ['tentacle'],
  embryo_consumer: ['embryo'],
  strike_synergy: ['draw', 'str'],
  creativity_engine: ['draw'],
}

/** Every purpose the lineup has a mechanical use for. */
export function teamWants(
  teamIds: string[],
  awakeners: Record<string, EnrichedAwakener>
): Set<PossePurpose> {
  const wants = new Set<PossePurpose>()
  for (const id of teamIds) {
    const ann = awakeners[id]?.annotation
    if (!ann) continue
    for (const role of ann.teamRoles ?? []) {
      for (const p of ROLE_WANTS[role] ?? []) wants.add(p)
    }
    for (const tag of ann.synergyTags ?? []) {
      for (const p of TAG_WANTS[tag] ?? []) wants.add(p)
    }
  }
  return wants
}

/**
 * How many of the team's wanted purposes this posse serves. Used to order the
 * situational tier, so a discard team sees a draw engine before a shield posse
 * rather than whatever happened to come first in the db's key order — which is
 * what the previous implementation effectively ranked by.
 */
export function posseFitScore(
  posse: Pick<EnrichedPosse, 'descriptionTemplate'>,
  wants: Set<PossePurpose>
): number {
  const purposes = derivePossePurposes(posse)
  let score = 0
  for (const p of purposes) if (wants.has(p)) score += 1
  return score
}

/** Short human-readable reason naming the overlap, for the recommendation card. */
export function posseFitReason(
  posse: Pick<EnrichedPosse, 'descriptionTemplate'>,
  wants: Set<PossePurpose>
): string | null {
  const LABEL: Record<PossePurpose, string> = {
    draw: 'card draw',
    arithmetica: 'Arithmetica',
    aliemus: 'Aliemus',
    keyflare: 'Keyflare',
    str: 'STR',
    crit: 'crit',
    dmg_amp: 'DMG Amplification',
    shield: 'shields',
    heal: 'healing',
    debuff: 'enemy debuffs',
    poison: 'Poison',
    counter: 'Counter',
    embryo: 'Embryo Fusion',
    tentacle: 'Tentacles',
    direct_damage: 'direct damage',
  }
  const matched = [...derivePossePurposes(posse)].filter((p) => wants.has(p))
  if (!matched.length) return null
  return matched.map((p) => LABEL[p]).join(', ')
}
