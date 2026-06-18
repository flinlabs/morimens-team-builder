// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export type Realm = 'CHAOS' | 'CARO' | 'AEQUOR' | 'ULTRA'
export type AwakenerType = 'ASSAULT' | 'WARDEN' | 'CHORUS'
export type Rarity = 'R' | 'SR' | 'SSR' | 'MYTHIC' | 'N'
export type EnlightenSlot = 'E0' | 'E1' | 'E2' | 'E3' | 'OE' | 'AA'
export type SkillSlot = 'Strike' | 'Defense' | 'Skill1' | 'Skill2' | 'Rouse' | 'Exalt' | 'OverExalt'
export type ArcRuleset = 'FADED_LEGACY' | 'ASTRAL_REIGN'
export type ViabilityTier = 1 | 2 | 3 | 4

export type TeamRole =
  | 'main_dps'
  | 'sub_dps'
  | 'embryo_gen'
  | 'aliemus_battery'
  | 'vuln_applier'
  | 'weak_applier'
  | 'shielder'
  | 'healer'
  | 'death_resist'
  | 'str_support'
  | 'keyflare_support'
  | 'card_cycler'
  | 'tentacle_enabler'
  | 'leap_support'
  | 'annihilation_support'
  | 'ultra_space_manager'
  | 'sacrifice_engine'
  | 'birth_ritual_stacker'
  | 'corrosion_applier'
  | 'strike_enabler'
  | 'relic_gen'
  | 'poison_stacker'

export type SynergyTag =
  | 'leap_user'
  | 'quasar_user'
  | 'embryo_consumer'
  | 'infinite_devour'
  | 'strike_synergy'
  | 'lemurian_preferred'
  | 'counter_scaling'
  | 'low_hp_scaling'
  | 'kill_scaling'
  | 'tentacle_scaling'
  | 'aliemus_hungry'
  | 'keyflare_hungry'
  | 'divine_realm'
  | 'high_aliemus_cost'
  | 'sacrifice_synergy'
  | 'bleed_stacker'
  | 'poison_stacker'
  | 'creativity_engine'
  | 'sin_stacker'

// ---------------------------------------------------------------------------
// SKeyDB base types (as they come from the DB files)
// ---------------------------------------------------------------------------

export interface SkeyEnlighten {
  id: string
  name: string
  slot: 'E1' | 'E2' | 'E3' | 'OverExalt' | 'AbsoluteAxiom'
  ownerAwakenerId: string
  ownerAwakenerName: string
  descriptionTemplate: string
  descriptionArgs: Record<string, unknown>
  route: { slug: string; canonicalPath: string }
}

export interface SkeySkill {
  id: string
  name: string
  slot: SkillSlot
  cost: number | null
  ownerAwakenerId: string
  ownerAwakenerName: string
  descriptionTemplate: string
  descriptionArgs: Record<string, unknown>
  route: { slug: string; canonicalPath: string }
}

export interface SkeyTalent {
  id: string
  name: string
  family: 'madness_omen' | 'soulforge_aptitude' | 'gnostic_potential' | 'passive'
  maxLevel: number
  ownerAwakenerId: string
  ownerAwakenerName: string
  descriptionTemplate: string
  descriptionArgs: Record<string, unknown>
}

export interface SkeyBuild {
  awakenerId: string
  recommendedWheels?: Array<{
    wheelId: string
    tier: 'BIS_SSR' | 'BIS_MYTHIC' | 'ALT_SSR' | 'ALT_MYTHIC' | 'BIS_SR' | 'GOOD'
  }>
  recommendedCovenants?: Array<{
    covenantId: string
    priority: number
  }>
  substatPriorityGroups?: string[][]
}

// ---------------------------------------------------------------------------
// Annotation type (hand-maintained)
// ---------------------------------------------------------------------------

export interface AwakenerAnnotation {
  id: string

  // Strategic identity
  teamRoles: TeamRole[]
  synergyTags: SynergyTag[]

  // Team compatibility
  requires: string[]
  synergizesWith: string[]
  conflictsWith: string[]
  requiresCondition?: string

  // Investment thresholds
  viabilityFloor: EnlightenSlot
  enlightenBreakpoints: EnlightenSlot[]
  keySkillSlots: SkillSlot[]
  keyTalents: Array<'madness_omen' | 'soulforge_aptitude' | 'gnostic_potential'>

  // Posse guidance
  anchorPosse?: string
  recommendedPosses: string[]

  // Known strong pairings with explanation
  keyPairings?: Array<{
    partnerId: string   // awakener ID
    reason: string      // why they work together
  }>
  
  // Ultra-specific
  leapPriority?: 'high' | 'mid' | 'low' | 'none'
  rousePriority?: 'high' | 'mid' | 'low'
  leapNote?: string

  // Divine Realm
  isDivineRealm: boolean
  divineRealmNote?: string

  // General
  tier: 'S' | 'A' | 'B' | 'C'
  notes: string
  contentNotes?: {
    arc1?: string
    arc2?: string
    dtide?: string
  }
}

// ---------------------------------------------------------------------------
// Enriched awakener (base + annotation merged)
// ---------------------------------------------------------------------------

export interface EnrichedAwakener {
  id: string
  name: string
  realm: Realm
  type: AwakenerType
  faction: string
  rarity: Rarity
  searchTags: string[]
  route: { slug: string; canonicalPath: string }
  assets: Record<string, string>

  enlightens: SkeyEnlighten[]
  skills: SkeySkill[]
  talents: SkeyTalent[]
  build: SkeyBuild | null

  annotation: AwakenerAnnotation | null
  annotationPending: boolean
}

// ---------------------------------------------------------------------------
// Wheel
// ---------------------------------------------------------------------------

export interface EnrichedWheel {
  id: string
  name: string
  rarity: Rarity
  realm: string
  mainstatKey: string
  ownerAwakenerId?: string
  ownerAwakenerName?: string
  searchTags: string[]
  descriptionTemplate: string
  isMythic: boolean
  isNWheel: boolean
  hasCombatEffect: boolean
  assets: Record<string, string>
  route: { slug: string; canonicalPath: string }
}

// ---------------------------------------------------------------------------
// Covenant
// ---------------------------------------------------------------------------

export interface CovenantSetEffect {
  set: number
  descriptionTemplate: string
}

export interface EnrichedCovenant {
  id: string
  name: string
  setEffects: CovenantSetEffect[]
  route: { slug: string; canonicalPath: string }
}

// ---------------------------------------------------------------------------
// Posse
// ---------------------------------------------------------------------------

export interface EnrichedPosse {
  id: string
  name: string
  realm: string
  descriptionTemplate: string
  hasCharacterBonus: boolean
  characterBonusFor: string | null
  route: { slug: string; canonicalPath: string }
}

// ---------------------------------------------------------------------------
// User roster (localStorage)
// ---------------------------------------------------------------------------

export interface AwakenerEntry {
  owned: boolean
  enlightenSlot: EnlightenSlot
  enlightenCopies: number
  characterLevel: number
  skillLevels: Record<SkillSlot, number>
  talentLevels: {
    madnessOmen: number
    soulforgeAptitude: number
    gnosticPotential: number
  }
  equippedCovenantId?: string
}

export interface WheelEntry {
  owned: boolean
  starLevel: number      // 0–3
  stackLevel: number     // 0–12
}

export interface CovenantEntry {
  owned: boolean
  sixPieceComplete: boolean
  completionPercent: number
  pieces?: CovenantPiece[]
}

export interface CovenantPiece {
  slot: 1 | 2 | 3 | 4 | 5 | 6
  mainStatKey: string
  mainStatValue: number
  substats: Array<{
    statKey: string
    value: number
    level: number
  }>
}

export interface PosseEntry {
  unlocked: boolean
}

export interface AppSettings {
  arcRuleset: ArcRuleset
  preferredRealm?: Realm
}

export interface UserRoster {
  version: number
  lastUpdated: string
  keeperLevel: number
  awakeners: Record<string, AwakenerEntry>
  wheels: Record<string, WheelEntry>
  covenants: Record<string, CovenantEntry>
  posses: Record<string, PosseEntry>
  settings: AppSettings
}

// ---------------------------------------------------------------------------
// Viability
// ---------------------------------------------------------------------------

export interface ViabilityResult {
  tier: ViabilityTier
  label: 'Raid-Ready' | 'Functional' | 'Underinvested' | 'Not Ready'
  score: number
  subscores: {
    enlighten: number
    skill: number
    talent: number
    wheel: number
  }
  flags: string[]
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

export type GenerationMode = 'preference' | 'build-around' | 'dtide'

export interface GenerationPreferences {
  priority: 'damage' | 'survivability' | 'balanced' | 'speed' | 'boss-kill'
  content: 'story' | 'phantasmal-dive' | 'dtide'
  preferredRealm?: Realm
}

export interface CandidateTeam {
  awakenerIds: string[]
  realmComposition: Realm[]
  hasMixingPenalty: boolean
  mixingNote?: string
  roleCoverage: TeamRole[]
  coverageGaps: string[]
  score: number
}

// ---------------------------------------------------------------------------
// AI output
// ---------------------------------------------------------------------------

export interface WheelAssignment {
  slot: 1 | 2
  wheelId: string
  tier: 'BIS_SSR' | 'BIS_MYTHIC' | 'ALT_SSR' | 'ALT_MYTHIC' | 'BIS_SR' | 'GOOD' | 'FALLBACK'
  dualSSRNote?: string
  arc2Note?: string
}

export interface CovenantRecommendation {
  covenantId: string
  sixPieceAvailable: boolean
  completionPercent?: number
  prioritySubstats: string[]
  acquisitionNote?: string
  note?: string
}

export interface PosseRecommendation {
  posseId: string
  priority: 'anchor' | 'strong' | 'situational' | 'chaos_memory_pick'
  reason: string
  characterBonusActive?: string
}

export interface CharacterAssignment {
  awakenerId: string
  roleInThisTeam: string
  wheelAssignments: WheelAssignment[]
  covenantRecommendation: CovenantRecommendation
  skillNote?: string
  talentNote?: string
}

export interface TeamRecommendation {
  rank: number
  composition: CharacterAssignment[]
  posseRecommendations: PosseRecommendation[]
  compositionNote: string
  coverageGaps: string[]
  realmNote?: string
  investmentWarnings: string[]
}

export interface AITeamResponse {
  teams: TeamRecommendation[]
}