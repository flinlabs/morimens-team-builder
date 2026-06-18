/** Status / keyword glossary.
Authoritative definitions for the combat statuses, resources, realm
mechanics, and card keywords used throughout Morimens. Grounded in the Boss
Compendium Archive Glossary (status numbers), the Mythag Compendium "Morimens
Terms" glossary (resources / realm mechanics), and the Game Mechanics card
lexicon (card keywords).

Each entry optionally links to the annotation taxonomy (TeamRole / SynergyTag)
so the deterministic pipeline can answer questions like "this fight needs
Vulnerable → which roster units have the vuln_applier role?" It also doubles
as a reference block for the prompt-builder so generated explanations use
correct mechanics rather than guesses. **/

import type { TeamRole, SynergyTag, Realm } from './types'

export type StatusCategory =
  | 'enemy_debuff' // applied to enemies to weaken them / amplify damage
  | 'dot' // damage-over-time
  | 'team_buff' // buffs/states on your own awakeners
  | 'defensive' // survivability mechanics
  | 'resource' // meters that power cards/exalts/posses
  | 'realm_mechanic' // realm-specific systems
  | 'card_keyword' // keywords printed on cards
  | 'enemy_mechanic' // hazards bosses inflict on you

export interface StatusEntry {
  key: string
  name: string
  category: StatusCategory
  /** Precise mechanical effect. */
  effect: string
  /** Who it normally sits on. */
  appliedTo: 'enemy' | 'self' | 'team' | 'card' | 'varies'
  /** Stack decay, if any (e.g. "1 stack/turn"). */
  decays?: string
  relatedRoles?: TeamRole[]
  relatedTags?: SynergyTag[]
  /** Realms that specialize in this, if it is realm-flavoured. */
  realms?: Realm[]
  note?: string
}

export const STATUS_GLOSSARY: Record<string, StatusEntry> = {
  // ---- Enemy debuffs (offensive / control) --------------------------------
  weakness: {
    key: 'weakness',
    name: 'Weakness',
    category: 'enemy_debuff',
    effect: "Bearer's Active Damage dealt -25%.",
    appliedTo: 'enemy',
    decays: '1 stack/turn',
    relatedRoles: ['weak_applier'],
    note: 'Defensive debuff — reduces enemy damage output. Stacks for more.',
  },
  vulnerable: {
    key: 'vulnerable',
    name: 'Vulnerable',
    category: 'enemy_debuff',
    effect: 'All Active Damage taken +50%.',
    appliedTo: 'enemy',
    decays: '1 stack/turn',
    relatedRoles: ['vuln_applier'],
    note: 'Offensive debuff — multiplies damage the enemy takes. Multiplicative with Final DMG and unique debuffs.',
  },
  fragile: {
    key: 'fragile',
    name: 'Fragile',
    category: 'enemy_debuff',
    effect: 'Shield gained -25%.',
    appliedTo: 'enemy',
    decays: '1 stack/turn',
    note: 'Suppresses enemy shield generation.',
  },
  blighten: {
    key: 'blighten',
    name: 'Blighten',
    category: 'enemy_debuff',
    effect: 'HP recovered -25%.',
    appliedTo: 'enemy',
    decays: '1 stack/turn',
    note: 'Anti-heal debuff against self-sustaining enemies.',
  },
  blind: {
    key: 'blind',
    name: 'Blind',
    category: 'enemy_debuff',
    effect: 'Crit DMG -50%.',
    appliedTo: 'enemy',
  },
  void: {
    key: 'void',
    name: 'Void',
    category: 'enemy_debuff',
    effect: 'Aliemus gained automatically at end of turn -1 per stack.',
    appliedTo: 'enemy',
  },
  corrosion: {
    key: 'corrosion',
    name: 'Corrosion',
    category: 'enemy_debuff',
    effect:
      'Damage-amplifying debuff. Saya can apply huge Corrosion (up to ~4× damage); ' +
      'Crimson Corrosion scales with Crimson Furnace consumed (up to +100%, 5× vs "Empty Shell").',
    appliedTo: 'enemy',
    relatedRoles: ['corrosion_applier'],
    realms: ['CARO', 'ULTRA'],
    note: 'Saya (Propagation Caro) and Castor are the main appliers.',
  },
  petrify: {
    key: 'petrify',
    name: 'Petrify / Stun',
    category: 'enemy_debuff',
    effect: 'Prevents the enemy from acting, effectively granting you a free turn.',
    appliedTo: 'enemy',
    note: "Aigis's petrify is the premier source; Mouchette can stun.",
  },

  // ---- Damage over time ----------------------------------------------------
  poison: {
    key: 'poison',
    name: 'Poison',
    category: 'dot',
    effect: 'Suffer damage equal to Poison stacks at the end of every turn (does not self-remove).',
    appliedTo: 'enemy',
    relatedRoles: ['poison_stacker'],
    relatedTags: ['poison_stacker'],
    note: 'Needs triggers to ramp fast (Nymphaea/Xu). In Astral Reign the poison cap scales with team Max HP.',
  },
  bleed: {
    key: 'bleed',
    name: 'Bleed',
    category: 'dot',
    effect:
      'Suffer damage equal to Bleed stacks at end of turn, then all Bleed is removed. ' +
      'Healing on the bearer cleanses twice that amount of Bleed.',
    appliedTo: 'enemy',
    relatedTags: ['bleed_stacker'],
    note: 'GHelot (Caro) and Pollux (Ultra) are the main bleed carries.',
  },

  // ---- Team buffs ----------------------------------------------------------
  str: {
    key: 'str',
    name: 'STR (Strength)',
    category: 'team_buff',
    effect: 'Active Damage +1 per stack. Gaining STR also raises Tentacle Damage by 50% of the STR gained.',
    appliedTo: 'team',
    relatedRoles: ['str_support'],
    note: 'Core scaling for many DPS; Clementine is the best STR stacker.',
  },
  alert: {
    key: 'alert',
    name: 'Alert',
    category: 'team_buff',
    effect: 'Shield gained from Awakener effects +1 per stack of Alert.',
    appliedTo: 'team',
    relatedRoles: ['shielder'],
    note: 'Backbone of Castor stall — Agrippa/Erica stack Alert so each shield is larger.',
  },
  madness: {
    key: 'madness',
    name: 'Madness',
    category: 'team_buff',
    effect: 'Damage instances increase by 1 for each stack of Madness.',
    appliedTo: 'team',
    note: 'Adds hits, benefiting multihit/tentacle/counter payoffs.',
  },
  counter: {
    key: 'counter',
    name: 'Counter',
    category: 'team_buff',
    effect: 'Whenever you are attacked, the attacker takes damage equal to your Counter.',
    appliedTo: 'team',
    relatedTags: ['counter_scaling'],
    note: 'Caecus/Nautila/Daffodil/Pandia/Wanda enable counter teams; scales with STR and crits.',
  },

  // ---- Defensive mechanics -------------------------------------------------
  shield: {
    key: 'shield',
    name: 'Shield',
    category: 'defensive',
    effect: 'Absorbs incoming damage until depleted.',
    appliedTo: 'team',
    relatedRoles: ['shielder'],
  },
  barrier: {
    key: 'barrier',
    name: 'Barrier',
    category: 'defensive',
    effect: 'Each stack makes you immune to 1 instance of attack damage, then breaks. Does not block Bleed/Poison.',
    appliedTo: 'varies',
    note: 'Enemy Barriers must be popped (AOE/multihit) before real damage lands.',
  },
  fortress: {
    key: 'fortress',
    name: 'Fortress',
    category: 'defensive',
    effect: 'HP actually lost from any damage taken is reduced by (stacks)%.',
    appliedTo: 'team',
  },
  death_resistance: {
    key: 'death_resistance',
    name: 'Death Resistance (DR)',
    category: 'defensive',
    effect: 'Lets you survive lethal hits. Triggering it can fuel stacking buffs (e.g. Mouchette E1, Lily, Faint).',
    appliedTo: 'team',
    relatedRoles: ['death_resist'],
    note: 'Astral Reign\'s Existence Paradox cuts starting DR to 1/4 (excess over 400% unaffected).',
  },

  // ---- Resources -----------------------------------------------------------
  aliemus: {
    key: 'aliemus',
    name: 'Aliemus',
    category: 'resource',
    effect: "Resource used to charge each Awakener's Exalt.",
    appliedTo: 'team',
    relatedRoles: ['aliemus_battery'],
    relatedTags: ['aliemus_hungry', 'high_aliemus_cost'],
    note: 'In Astral Reign, aliemus-gen is halved and each Exalt costs +10 for the rest of the battle. Madness Omen grants 5 starting Aliemus per level.',
  },
  keyflare: {
    key: 'keyflare',
    name: 'Keyflare',
    category: 'resource',
    effect: "Charges your Posse; gained equal to an Awakener's Keyflare Regen per Arithmetica spent on their Command Cards.",
    appliedTo: 'team',
    relatedRoles: ['keyflare_support'],
    relatedTags: ['keyflare_hungry'],
    note: 'Critical in Astral Reign because Rouses are bought with Keyflare (Keyflare Rouse).',
  },
  arithmetica: {
    key: 'arithmetica',
    name: 'Arithmetica',
    category: 'resource',
    effect: 'Resource used to play Command Cards. Unused points do not carry over.',
    appliedTo: 'team',
    note: 'Astral Reign: playing >10 cards/turn costs extra (Arithmetica Harmony); capped at 12 (overflow → Keyflare).',
  },
  embryo_fusion: {
    key: 'embryo_fusion',
    name: 'Embryo Fusion',
    category: 'resource',
    effect:
      'Caro red meter generated by Command Cards, Chaos Exalts (+35% flat), and Posse. At 100% it resets and adds an "Embryo" to hand. Passive gain scales with % HP missing.',
    appliedTo: 'team',
    relatedRoles: ['embryo_gen'],
    realms: ['CARO'],
  },
  embryo: {
    key: 'embryo',
    name: 'Embryo',
    category: 'resource',
    effect:
      'Card added at 100% Embryo Fusion. Play it for 30 Aliemus + 10% temp Crit Rate, OR let a Caro Exalt consume it to trigger Devour. Destroyed if hand is full.',
    appliedTo: 'team',
    relatedRoles: ['embryo_gen'],
    relatedTags: ['embryo_consumer'],
    realms: ['CARO'],
    note: "Thais's Scion of Purity is a unique Embryo that triggers Devour twice.",
  },
  crimson_furnace: {
    key: 'crimson_furnace',
    name: 'Crimson Furnace',
    category: 'resource',
    effect:
      'Caro HP pool that accumulates 3%/6%-if-pure Max HP at turn start (+5% after battle), capped at 25% Max HP. Tap to heal the team for the stored amount.',
    appliedTo: 'team',
    realms: ['CARO'],
    note: 'Salvador converts it into a large shield (End of Suffering). "Blood Furnace" is the same system.',
  },

  // ---- Realm mechanics -----------------------------------------------------
  devour: {
    key: 'devour',
    name: 'Devour / Infinite Devour',
    category: 'realm_mechanic',
    effect:
      'A Caro Exalt effect: if an Embryo is in hand, the Exalt consumes it for bonus effects. Infinite Devour consumes ALL Embryos in hand.',
    appliedTo: 'self',
    relatedTags: ['infinite_devour', 'embryo_consumer'],
    realms: ['CARO'],
    note: 'Sorel and Salvador are key Devour DPS.',
  },
  ultra_space: {
    key: 'ultra_space',
    name: 'Ultra Space',
    category: 'realm_mechanic',
    effect:
      'Stores up to 5 cards. After the 1st Command Card each turn, a Base Copy (Fleeting + Exhaust) is banked here.',
    appliedTo: 'team',
    relatedRoles: ['ultra_space_manager'],
    realms: ['ULTRA'],
  },
  ultra_round: {
    key: 'ultra_round',
    name: 'Ultra Round (Ultra Turn)',
    category: 'realm_mechanic',
    effect:
      'If Ultra Space is full when you end your turn, take an extra turn; all banked cards go to hand. If the realm includes Aequor or Caro, ALL effects are reduced 25% during the Ultra Round.',
    appliedTo: 'team',
    realms: ['ULTRA'],
    note: 'The 25% reduction is the Ultra mixed-realm penalty — pure Ultra (+Chaos) avoids it.',
  },
  leap: {
    key: 'leap',
    name: 'Leap',
    category: 'realm_mechanic',
    effect: 'A card effect that triggers if the card enters Ultra Space OR during the Ultra Round.',
    appliedTo: 'self',
    relatedRoles: ['leap_support'],
    relatedTags: ['leap_user'],
    realms: ['ULTRA'],
  },
  quasar: {
    key: 'quasar',
    name: 'Quasar',
    category: 'realm_mechanic',
    effect:
      'A card effect that triggers only if the card enters Ultra Space (not during the Ultra Round; instead the card costs 1 less Arithmetica then).',
    appliedTo: 'self',
    relatedTags: ['quasar_user'],
    realms: ['ULTRA'],
  },
  annihilation: {
    key: 'annihilation',
    name: 'Annihilation',
    category: 'realm_mechanic',
    effect:
      'Once per turn, remove the leftmost (FIFO) card from Ultra Space and add 1 "Insight" to hand. Costs you a Leap/Ultra-Round slot.',
    appliedTo: 'self',
    relatedRoles: ['annihilation_support'],
    realms: ['ULTRA'],
    note: "Castor's wheel grants temp Crit DMG after an Annihilation; Arachne's Singularity reworks it.",
  },
  tentacle_gathering: {
    key: 'tentacle_gathering',
    name: 'Tentacle / Tentacle Gathering',
    category: 'realm_mechanic',
    effect:
      'Aequor. Tentacles attack the front enemy at end of turn. Tentacle Gathering: each stack (gained after Exalt) adds one extra tentacle attack that turn, cleared at turn end.',
    appliedTo: 'team',
    relatedRoles: ['tentacle_enabler'],
    relatedTags: ['tentacle_scaling'],
    realms: ['AEQUOR'],
    note: 'Stances: Surging Tides (gain tentacles), Tranquil Sea (shield, −50% tentacle DMG), Raging Waves (125% tentacle DMG + bonus attacks).',
  },
  sacrifice: {
    key: 'sacrifice',
    name: 'Sacrifice',
    category: 'realm_mechanic',
    effect: 'At turn end, take damage equal to the number of Sacrifice stacks, then halve them.',
    appliedTo: 'self',
    relatedRoles: ['sacrifice_engine'],
    relatedTags: ['sacrifice_synergy'],
    note: 'GMurphy self-inflicts Sacrifice for power; base Murphy can clear it.',
  },
  realm_mastery: {
    key: 'realm_mastery',
    name: 'Realm Mastery',
    category: 'realm_mechanic',
    effect: 'The Astral Reign scaling stat (rolled on covenants/wheels). Vortice and Miryam can stack it in combat.',
    appliedTo: 'team',
    note: 'Inert in Faded Legacy; central to Arc-2 DPS like Vortice.',
  },

  // ---- Enemy mechanics (hazards) ------------------------------------------
  sealed: {
    key: 'sealed',
    name: 'Sealed / Seal',
    category: 'enemy_mechanic',
    effect: 'A Sealed Exalt cannot be released; Sealed cards cannot be played. Stacks; lose 1 at end of turn.',
    appliedTo: 'self',
    decays: '1 stack/turn',
    note: 'Alva dispels Seal; Uvhash is immune while Roused.',
  },
  chains_of_resentment: {
    key: 'chains_of_resentment',
    name: 'Chains of Resentment',
    category: 'enemy_mechanic',
    effect: "When the enemy takes Active Damage, 1 stack is removed and the attacker's Exalt + current cards are Sealed for 1 turn.",
    appliedTo: 'enemy',
    note: 'Tank it with disposable AOE hits (e.g. Jenkin) before committing your DPS.',
  },
  conceal: {
    key: 'conceal',
    name: 'Conceal',
    category: 'enemy_mechanic',
    effect: 'Enemy takes (stacks)% less damage and cannot be targeted; removed when no other enemies remain.',
    appliedTo: 'enemy',
  },
  symptoms: {
    key: 'symptoms',
    name: 'Symptoms / Status Cards',
    category: 'enemy_mechanic',
    effect: 'Junk cards enemies stuff into your hand/deck to clog your turns.',
    appliedTo: 'self',
    note: 'Discarded/cleansed by Doll, Alva, Casiah.',
  },

  // ---- Card keywords -------------------------------------------------------
  prepare: {
    key: 'prepare',
    name: 'Prepare',
    category: 'card_keyword',
    effect: 'Card stays in hand and drops in cost by the listed number each turn; also re-triggers if discarded and drawn again.',
    appliedTo: 'card',
  },
  retain: {
    key: 'retain',
    name: 'Retain',
    category: 'card_keyword',
    effect: 'Remains in hand at end of turn instead of being discarded.',
    appliedTo: 'card',
  },
  exhaust: {
    key: 'exhaust',
    name: 'Exhaust',
    category: 'card_keyword',
    effect: 'Disappears forever after being played.',
    appliedTo: 'card',
  },
  aftershock: {
    key: 'aftershock',
    name: 'Aftershock',
    category: 'card_keyword',
    effect: 'Listed effect activates when the card is discarded.',
    appliedTo: 'card',
    note: 'Discard supports (Casiah, Corposant) build teams around triggering Aftershock.',
  },
  fleeting: {
    key: 'fleeting',
    name: 'Fleeting',
    category: 'card_keyword',
    effect: 'Disappears forever if still in hand at end of turn (before discard effects).',
    appliedTo: 'card',
  },
  stagnation: {
    key: 'stagnation',
    name: 'Stagnation',
    category: 'card_keyword',
    effect: 'Increases the card\'s cost by the listed number. As an enemy debuff it can be dispelled (Celeste, Karen, Arachne).',
    appliedTo: 'card',
  },
  mutation: {
    key: 'mutation',
    name: 'Mutation',
    category: 'card_keyword',
    effect: 'Reduces the card\'s cost, but playing it adds a random Distortion card to hand. Persists after battle.',
    appliedTo: 'card',
  },
}

export function getStatus(key: string): StatusEntry | null {
  return STATUS_GLOSSARY[key] ?? null
}

export function statusesByCategory(category: StatusCategory): StatusEntry[] {
  return Object.values(STATUS_GLOSSARY).filter(s => s.category === category)
}

/** Statuses whose application/payoff maps to a given team role. */
export function statusesForRole(role: TeamRole): StatusEntry[] {
  return Object.values(STATUS_GLOSSARY).filter(s => s.relatedRoles?.includes(role))
}

/** Statuses associated with a given synergy tag. */
export function statusesForTag(tag: SynergyTag): StatusEntry[] {
  return Object.values(STATUS_GLOSSARY).filter(s => s.relatedTags?.includes(tag))
}