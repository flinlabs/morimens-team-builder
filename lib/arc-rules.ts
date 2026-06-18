/** Arc 1 (Faded Legacy) vs Arc 2 (Astral Reign) ruleset reference.
Morimens has two storylines with different game rules. Astral Reign is used
in almost all endgame content (D-Effect Zone / D-Tide, Hectic Skybound Rail,
post-anniversary stages). Builds and team viability differ between them, so
the generator must reason about which arc the user is playing.

This module is the single source of truth for those rules. It is consumed by
the deterministic scoring/filtering pipeline (mechanic flags + per-unit
viability shifts) and is also structured to drop into the prompt-builder as a
reference block. Grounded in Cheri's New Player Handbook ("Faded Legacy &
Astral Reign" + "Summary of Rules Changes") and the Mythag Compendium. **/

import type { ArcRuleset } from './types'

export interface ArcMechanics {
  // Soulforge Aptitude grants stats + unique abilities (Arc 2 only).
  soulforgeActive: boolean
  // Rouses are bought with Keyflare mid-battle, so Keyflare Regen is critical.
  keyflareRouseActive: boolean
  // R wheels keep their abilities (Arc 1) vs. abilities stripped (Arc 2).
  rWheelsFullPower: boolean
  // Realm Mastery is a live scaling stat (covenants/wheels) in this arc.
  realmMasteryRelevant: boolean
  // Arithmetica Harmony: playing >10 command cards per turn costs extra.
  cardSoftCap: boolean
  // Aliemus Harmony: aliemus-gen effects halved; each Exalt costs +10 aliemus.
  aliemusHarmony: boolean
  // Existence Paradox: starting Death Resistance reduced to 1/4.
  existenceParadox: boolean
  // Bottomless Scar: healing >100% Max HP in a fight nerfs further healing.
  bottomlessScar: boolean
  // Archive Mark: relics/posses gain +1% per unlocked posse.
  archiveMark: boolean
}

export interface ArcRule {
  key: string
  name: string
  description: string
}

export interface ArcInfo {
  arc: ArcRuleset
  label: string
  community: string // "Arc 1" / "Arc 2"
  usedIn: string[]
  mechanics: ArcMechanics
  rulesChanges: ArcRule[]
}

export const ARC_RULES: Record<ArcRuleset, ArcInfo> = {
  FADED_LEGACY: {
    arc: 'FADED_LEGACY',
    label: 'Faded Legacy',
    community: 'Arc 1',
    usedIn: [
      'Faded Legacy story chapters (normal and hard)',
      'Awakener Trials',
      'Interludes (including Lightless Realm)',
      'Phantasmal Dive',
      'Side stories and events from the first year',
    ],
    mechanics: {
      soulforgeActive: false,
      keyflareRouseActive: false,
      rWheelsFullPower: true,
      realmMasteryRelevant: false,
      cardSoftCap: false,
      aliemusHarmony: false,
      existenceParadox: false,
      bottomlessScar: false,
      archiveMark: false,
    },
    rulesChanges: [
      {
        key: 'r_wheels',
        name: 'R Wheels',
        description:
          'The lowest-rarity (R) wheels keep their abilities and are extremely ' +
          'powerful here — often better than SR/SSR on supports. Reserve raw-stat ' +
          'SSR/SR wheels for the main DPS and shielder; put R wheels on everyone else.',
      },
      {
        key: 'rouse_source',
        name: 'Rouses at junctions',
        description:
          'Rouses are obtained at healing junctions / shops during exploration, ' +
          'not by spending Keyflare. Keyflare Regen matters far less than in Arc 2.',
      },
      {
        key: 'no_soulforge',
        name: 'Soulforge inert',
        description:
          'Soulforge Aptitude does nothing in Faded Legacy. Units that depend on ' +
          'Soulforge for their best teams are weaker here.',
      },
    ],
  },
  ASTRAL_REIGN: {
    arc: 'ASTRAL_REIGN',
    label: 'Astral Reign',
    community: 'Arc 2',
    usedIn: [
      'Astral Reign story chapters (normal and hard)',
      'D-Effect Zone / D-Tide',
      'Hectic Skybound Rail',
      'Side stories and events after the first anniversary',
    ],
    mechanics: {
      soulforgeActive: true,
      keyflareRouseActive: true,
      rWheelsFullPower: false,
      realmMasteryRelevant: true,
      cardSoftCap: true,
      aliemusHarmony: true,
      existenceParadox: true,
      bottomlessScar: true,
      archiveMark: true,
    },
    rulesChanges: [
      {
        key: 'soulforge',
        name: 'Soulforge Aptitude',
        description:
          'Every unit gains a Soulforge talent: +3% CON/ATK/DEF per level (≈5 ' +
          'character levels each) plus unique abilities. Most impactful on ' +
          'Kathigu-Ra, Pollux and Vortice, on Corposant (huge bonus damage to ' +
          'Aequor enemies), and on the Lemurians (Faros/Goliath/Miryam/GMurphy/Tulu) ' +
          'when teamed together. Soulforge is the top leveling priority in Arc 2.',
      },
      {
        key: 'keyflare_rouse',
        name: 'Keyflare Rouse',
        description:
          'You can no longer rouse at junctions. Once per turn you spend 1000 ' +
          'Keyflare (one full meter) to add a Rouse to hand, with the cost rising ' +
          '+1000 each subsequent use. Keyflare Regen is critical — without it your ' +
          'characters cannot rouse and do nothing.',
      },
      {
        key: 'arithmetica_harmony',
        name: 'Arithmetica Harmony (card soft cap)',
        description:
          'Playing more than 10 command cards in a turn costs extra Arithmetica. ' +
          'This nerfs near-infinite combo / card-spam strategies.',
      },
      {
        key: 'arithmetica_overflow',
        name: 'Arithmetica Overflow',
        description:
          'Arithmetica is capped at 12; any excess is converted into Keyflare.',
      },
      {
        key: 'aliemus_harmony',
        name: 'Aliemus Harmony',
        description:
          'Aliemus-generation effects (e.g. Incalculable Factor) are halved, and ' +
          'each Exalt costs +10 Aliemus for the rest of the battle. At end of turn, ' +
          'characters that did not Exalt grant Keyflare based on their Keyflare Regen.',
      },
      {
        key: 'existence_paradox',
        name: 'Existence Paradox',
        description:
          'Starting Death Resistance is reduced to 1/4 (with a small Max HP bonus); ' +
          'excess above 400% is not reduced. Each Death-Resistance trigger grants a ' +
          'Silver Key Gleam (a 0-cost card to activate one of 3 unlocked posses).',
      },
      {
        key: 'bottomless_scar',
        name: 'Bottomless Scar',
        description:
          'Healing more than 100% of Max HP in a battle reduces all further healing ' +
          'by 25% (stacks up to 3×, each granting some Death Resistance). Pure ' +
          'heal-stall is weaker here.',
      },
      {
        key: 'archive_mark',
        name: 'Archive Mark',
        description:
          'Relics and posses gain +1% to their numbers for each posse you have ' +
          'unlocked — unlocking more posses raises the power of all of them.',
      },
      {
        key: 'realm_mastery',
        name: 'Realm Mastery',
        description:
          'Realm Mastery is the Arc-2 scaling stat (rolled on covenants/wheels and ' +
          'used by Deus Ex Machina / Returnal Line and units like Vortice and Miryam).',
      },
    ],
  },
}

export interface ArcUnitShift {
  fadedLegacy?: number
  astralReign?: number
  reason: string
}

export const ARC_UNIT_SHIFTS: Record<string, ArcUnitShift> = {
  // "24" — her Ultra build was very strong in Faded Legacy; the Ultra build was
  // nerfed in Astral Reign (Chaos "24" remains fine, so no AR penalty).
  'awakener-0001': {
    fadedLegacy: 0.06,
    reason: 'Ultra "24" is very strong in Faded Legacy; her Ultra build was nerfed in Astral Reign (Chaos build still fine).',
  },
  // Hameln — near-infinite combo enabler in Arc 1; the >10-card soft cap
  // (Arithmetica Harmony) blunts him in Arc 2.
  'awakener-0022': {
    fadedLegacy: 0.06,
    astralReign: -0.06,
    reason: 'Sets up near-infinite combos in Faded Legacy; falls off in Astral Reign due to the per-turn card soft cap.',
  },
  // Pandia — caught in the Astral Reign Ultra-"24" counter nerf; unusable as a
  // DPS for most endgame Arc-2 content.
  'awakener-0039': {
    astralReign: -0.1,
    reason: 'Counter DPS nerfed in Astral Reign (Ultra-"24" rule change); mainly a niche counter-removal support in Arc 2.',
  },
  // Winkle — core of Ultra Retaliate teams in Arc 1.
  'awakener-0053': {
    fadedLegacy: 0.05,
    reason: 'Core member of Ultra Retaliate teams in Faded Legacy.',
  },
}

export function getArcRules(arc: ArcRuleset): ArcInfo {
  return ARC_RULES[arc]
}

export function mechanicActiveInArc(
  mechanic: keyof ArcMechanics,
  arc: ArcRuleset
): boolean {
  return ARC_RULES[arc].mechanics[mechanic]
}

export function getArcViabilityModifier(
  awakenerId: string,
  arc: ArcRuleset
): number {
  const shift = ARC_UNIT_SHIFTS[awakenerId]
  if (!shift) return 0
  return (arc === 'ASTRAL_REIGN' ? shift.astralReign : shift.fadedLegacy) ?? 0
}

export function getArcViabilityNote(
  awakenerId: string,
  arc: ArcRuleset
): string | null {
  const shift = ARC_UNIT_SHIFTS[awakenerId]
  if (!shift) return null
  const delta = arc === 'ASTRAL_REIGN' ? shift.astralReign : shift.fadedLegacy
  if (delta === undefined || delta === 0) return null
  return shift.reason
}