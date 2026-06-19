// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

import type { TeamAnalysis } from './team-analysis'

export type Realm = 'CHAOS' | 'CARO' | 'AEQUOR' | 'ULTRA'
export type AwakenerType = 'ASSAULT' | 'WARDEN' | 'CHORUS'

// Raw awakener rarities: SSR | SR | Genesis (alt/anniversary units).
// Raw wheel rarities: R | SR | SSR | N. 'MYTHIC' is a DERIVED wheel value the
// sync assigns to ownerless SSR wheels (campaign/battlepass/Sediment, black
// border) — confirmed against the Wheel Guide. SKeyDB stores these as SSR with
// no ownerAwakenerId.
export type Rarity = 'R' | 'SR' | 'SSR' | 'MYTHIC' | 'N' | 'Genesis'

export type EnlightenSlot = 'E0' | 'E1' | 'E2' | 'E3' | 'OE' | 'AA'
export type SkillSlot = 'Strike' | 'Defense' | 'Skill1' | 'Skill2' | 'Rouse' | 'Exalt' | 'OverExalt'
export type ArcRuleset = 'FADED_LEGACY' | 'ASTRAL_REIGN'
export type ViabilityTier = 1 | 2 | 3 | 4

// Wheel build tiers as they actually appear in SKeyDB awakener-builds.
// There is no MYTHIC build tier — a Mythic-rarity wheel recommended as BIS is
// tagged BIS_SSR; its Mythic-ness is conveyed by the wheel's `rarity` field.
export type WheelTier = 'BIS_SSR' | 'ALT_SSR' | 'BIS_SR' | 'GOOD'

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
// Scaling-argument shape used inside descriptionArgs (SKeyDB v3)
// ---------------------------------------------------------------------------

export type DescriptionArg =
  | { kind: 'fixed'; value: string; suffix?: string }
  | { kind: 'linear'; base: string; gainPerLevel: string; suffix?: string }
  | { kind: 'scaling'; values: string[]; suffix?: string }
  | Record<string, unknown>

// ---------------------------------------------------------------------------
// SKeyDB base types (as they come from the per-record files)
// ---------------------------------------------------------------------------

export interface SkeyEnlighten {
  id: string
  name: string
  slot: 'E1' | 'E2' | 'E3' | 'OverExalt' | 'AbsoluteAxiom'
  ownerAwakenerId: string
  ownerAwakenerName: string
  descriptionTemplate: string
  descriptionArgs: Record<string, DescriptionArg>
  route: { slug: string; canonicalPath: string }
}

export interface SkeySkillUpgrade {
  upgraderType?: string
  upgraderSlot?: string
  operation?: string
  patch?: {
    descriptionTemplate?: string
    descriptionArgs?: Record<string, DescriptionArg>
  }
}

export interface SkeySkill {
  id: string
  name: string
  slot: SkillSlot
  cost?: number | null
  cardKeywords?: string[]
  ownerAwakenerId: string
  ownerAwakenerName: string
  descriptionTemplate: string
  descriptionArgs: Record<string, DescriptionArg>
  upgrades?: SkeySkillUpgrade[]
  route: { slug: string; canonicalPath: string }
}

export interface SkeyTalent {
  id: string
  name: string
  family: 'madness_omen' | 'soulforge_aptitude' | 'gnostic_potential' | 'passive'
  maxLevel: number
  defaultMaxed?: boolean
  ownerAwakenerId: string
  ownerAwakenerName: string
  descriptionTemplate: string
  descriptionArgs: Record<string, DescriptionArg>
}

// SKeyDB awakener-builds: each awakener has one build record containing one or
// more named build variants (DPS, Support, Core, Tank, ...).
export interface SkeyBuildVariant {
  id: string
  label: string
  recommendedCovenantIds: string[]
  recommendedWheels: Array<{ wheelIds: string[]; tier: WheelTier }>
  substatPriorityGroups: string[][]
  recommendedWheelMainstats: string[]
}

export interface SkeyBuild {
  awakenerId: string
  primaryBuildId: string
  builds: SkeyBuildVariant[]
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

  // Optional descriptive fields carried through from the record (useful for
  // the AI prompt; all optional so older DB files stay valid)
  availabilityType?: string
  aliases?: string[]
  ingameId?: string
  numericId?: number
  lineupToken?: string
  primaryScalingBase?: number
  baseStatsLv1?: Record<string, number>
  substatsLv1?: Record<string, number>
  statScaling?: { CON: number; ATK: number; DEF: number }
  substatScaling?: Record<string, number>

  // Derived in the sync from searchTags (authoritative; not hand-maintained):
  // Divine units = Arachne/Saya/Vortice/Murphy: Fauxborn; Lemurians = the 5 with
  // the 'Lemurian' searchTag.
  isDivineRealm?: boolean
  isLemurian?: boolean

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
  descriptionTemplate?: string
  descriptionArgs?: Record<string, DescriptionArg>
  lore?: string
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
  descriptionArgs?: Record<string, DescriptionArg>
}

export interface EnrichedCovenant {
  id: string
  name: string
  setEffects: CovenantSetEffect[]
  setBonuses?: number[]
  acquisitionSource?: string
  lineupToken?: string
  lore?: string
  assets?: Record<string, string>
  route: { slug: string; canonicalPath: string }
}

// ---------------------------------------------------------------------------
// Posse
// ---------------------------------------------------------------------------

export interface EnrichedPosse {
  id: string
  name: string
  realm: string
  descriptionTemplate?: string
  descriptionArgs?: Record<string, DescriptionArg>
  acquisitionSource?: string
  lore?: string
  hasCharacterBonus: boolean
  characterBonusFor: string | null
  assets?: Record<string, string>
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
  threePieceComplete: boolean
  sixPieceComplete: boolean
  completionPercent: number
  pieces?: CovenantPiece[]
  /** Aggregate rolled substats the player wants to record (by stat key). */
  substatTotals?: Record<string, number>
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
  // Set when this team comes from the curated meta library rather than search.
  metaName?: string
  metaSource?: string
}

// ---------------------------------------------------------------------------
// AI output
// ---------------------------------------------------------------------------

export interface WheelAssignment {
  slot: 1 | 2
  wheelId: string
  tier: WheelTier | 'FALLBACK'
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
  // Present when the team is a curated meta composition.
  metaName?: string
  metaSource?: string
  // Deterministic explanation of what the composition is doing.
  analysis?: TeamAnalysis
}

export interface AITeamResponse {
  teams: TeamRecommendation[]
}

// ---------------------------------------------------------------------------
// Meta-team reference (app/admin/annotations/meta-teams.json)
// Curated example compositions the prompt-builder feeds to the AI as reference.
// ---------------------------------------------------------------------------

export interface MetaTeam {
  name: string
  awakenerIds: string[]
  awakenerNames: string[]
  realm: Realm
  tier?: 'S' | 'A' | 'B' | 'C'
  arcContext?: 'arc1' | 'arc2'
  source?: string
  notes: string
}

export interface MetaTeamsFile {
  _note: string
  teams: MetaTeam[]
}