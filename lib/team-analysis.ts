import type { EnrichedAwakener, TeamRole, SynergyTag, Realm } from "./types";

/* ---------------------------------------------------------------------------
   Deterministic team analysis.

   Turns a lineup into a structured explanation of what the composition is doing:
   an archetype read from the carry's scaling tags + the support roles present,
   an applier -> payoff "engine chain", and a one-line contribution per member.

   Everything here is read straight from the hand-maintained annotations
   (teamRoles + synergyTags), so it never invents mechanics. The output is kept
   as structured facts (archetypes / chain / contributions) so a prose layer can
   later rephrase the wording without touching the logic.
--------------------------------------------------------------------------- */

export interface TeamContribution {
  awakenerId: string;
  name: string;
  roleLabel: string; // short chip, e.g. "Carry", "Vuln applier"
  text: string; // one-line description of what they bring
}

export interface TeamAnalysis {
  archetypes: string[]; // ordered identity labels (chips)
  summary: string; // one-sentence overview
  chain: string[]; // applier -> payoff lines
  contributions: TeamContribution[];
}

// What a carry SCALES OFF — drives the team's identity. Keyed by synergy tag.
const TAG_PAYOFF: Partial<Record<SynergyTag, string>> = {
  counter_scaling: "Counters",
  tentacle_scaling: "Tentacle Assembly",
  embryo_consumer: "Embryo Fusion",
  infinite_devour: "Infinite Devour",
  low_hp_scaling: "low HP",
  kill_scaling: "kills",
  poison_stacker: "Poison",
  bleed_stacker: "Bleed",
  sin_stacker: "Sin stacks",
  leap_user: "Leap",
  quasar_user: "Quasar",
};

// Short chip label per role (most-salient role wins for a member).
const ROLE_LABEL: Partial<Record<TeamRole, string>> = {
  main_dps: "Carry",
  sub_dps: "Sub-DPS",
  vuln_applier: "Vuln applier",
  weak_applier: "Weakness applier",
  poison_stacker: "Poison",
  corrosion_applier: "Corrosion",
  embryo_gen: "Embryo gen",
  aliemus_battery: "Aliemus battery",
  keyflare_support: "Keyflare",
  str_support: "STR support",
  shielder: "Shielder",
  healer: "Healer",
  death_resist: "Death-resist",
  card_cycler: "Card cycler",
  tentacle_enabler: "Tentacle enabler",
  leap_support: "Leap support",
  annihilation_support: "Annihilation",
  ultra_space_manager: "Ultra space",
  sacrifice_engine: "Sacrifice",
  birth_ritual_stacker: "Birth Ritual",
  strike_enabler: "Strike enabler",
  relic_gen: "Relic gen",
};

// One-line phrase describing what a role contributes to the team.
const ROLE_PHRASE: Partial<Record<TeamRole, string>> = {
  main_dps: "the team's primary damage",
  sub_dps: "a second damage source",
  vuln_applier: "keeps enemies Vulnerable so the team's hits land amplified",
  weak_applier: "applies Weakness to soften enemy offense and enable the carry",
  poison_stacker: "stacks Poison for the team to ramp on",
  corrosion_applier: "applies Corrosion to enemies",
  embryo_gen: "builds Embryo Fusion for the Caro payoff",
  aliemus_battery: "feeds Aliemus so the carry's Exalt fires sooner",
  keyflare_support: "generates Keyflare for extra card plays",
  str_support: "feeds Temporary STR into the carry",
  shielder: "shields the team",
  healer: "keeps the team healed",
  death_resist: "provides Death Resistance to survive lethal hits",
  card_cycler: "cycles cards to keep the engine flowing",
  tentacle_enabler: "builds Tentacle Assembly for the carry to unleash",
  leap_support: "enables extra Leaps",
  annihilation_support: "supports Annihilation",
  ultra_space_manager: "manages Ultra Space and turn economy",
  sacrifice_engine: "drives the sacrifice loop",
  birth_ritual_stacker: "stacks Birth Ritual",
  strike_enabler: "enables extra Strikes",
  relic_gen: "generates Relics",
};

// Priority for picking a member's headline role (carry first, sustain last).
const ROLE_PRIORITY: TeamRole[] = [
  "main_dps",
  "sub_dps",
  "tentacle_enabler",
  "embryo_gen",
  "poison_stacker",
  "corrosion_applier",
  "sacrifice_engine",
  "vuln_applier",
  "weak_applier",
  "str_support",
  "aliemus_battery",
  "keyflare_support",
  "leap_support",
  "annihilation_support",
  "ultra_space_manager",
  "birth_ritual_stacker",
  "strike_enabler",
  "relic_gen",
  "card_cycler",
  "shielder",
  "healer",
  "death_resist",
];

function nameList(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

function realmLabel(ids: string[], awakeners: Record<string, EnrichedAwakener>): string {
  const realms = new Set<Realm>();
  for (const id of ids) {
    const r = awakeners[id]?.realm;
    if (r) realms.add(r);
  }
  const ordered = [...realms].sort((a, b) => (a === "CHAOS" ? -1 : b === "CHAOS" ? 1 : 0));
  return ordered.join(" + ") || "Mixed";
}

export function analyzeTeam(
  awakenerIds: string[],
  awakeners: Record<string, EnrichedAwakener>
): TeamAnalysis {
  const members = awakenerIds.map((id) => awakeners[id]).filter(Boolean);
  const rolesOf = (a: EnrichedAwakener): TeamRole[] => a.annotation?.teamRoles ?? [];
  const tagsOf = (a: EnrichedAwakener): SynergyTag[] => a.annotation?.synergyTags ?? [];
  const has = (a: EnrichedAwakener, r: TeamRole) => rolesOf(a).includes(r);

  // Members in a given role.
  const inRole = (r: TeamRole): EnrichedAwakener[] => members.filter((a) => has(a, r));
  const namesInRole = (r: TeamRole): string[] => inRole(r).map((a) => a.name);

  // Carries. Annotation role order is deliberate — the FIRST role is the
  // unit's primary identity. A unit that merely lists main_dps as a tertiary
  // option (Alva's E3 burst, say) is not this team's carry; treating any
  // main_dps mention as "the carry" is how Salvador-style tanks ended up
  // labelled primary damage. Fall back down the ladder only when no member
  // is a primary carry.
  const primaryRole = (a: EnrichedAwakener): TeamRole | undefined => rolesOf(a)[0];
  let carries = members.filter((a) => primaryRole(a) === "main_dps");
  if (carries.length === 0) carries = inRole("main_dps");
  if (carries.length === 0) carries = members.filter((a) => primaryRole(a) === "sub_dps");
  if (carries.length === 0) carries = inRole("sub_dps");
  const carryNames = carries.map((a) => a.name);
  const carryTags = new Set<SynergyTag>(carries.flatMap(tagsOf));
  const carryName = nameList(carryNames) || "the carry";

  const archetypes: string[] = [];
  const chain: string[] = [];
  const seen = new Set<string>();
  const push = (label: string, line?: string) => {
    if (seen.has(label)) return;
    seen.add(label);
    archetypes.push(label);
    if (line) chain.push(line);
  };

  // --- Identity archetypes (what the carry pays off on) ----------------------
  if (carryTags.has("counter_scaling")) {
    push("Counter", `${carryName} scales with Counters, so the team keeps Counter generation flowing into ${carries.length > 1 ? "them" : "it"}.`);
  }
  const tentEnablers = namesInRole("tentacle_enabler");
  if (tentEnablers.length || carryTags.has("tentacle_scaling")) {
    const src = tentEnablers.length ? nameList(tentEnablers) : "the Aequor core";
    const v = tentEnablers.length >= 2 ? "build" : "builds";
    push("Tentacle (Aequor)", `${src} ${v} Tentacle Assembly that ${carryName} unleashes for damage.`);
  }
  const embryoGens = namesInRole("embryo_gen");
  if (embryoGens.length || carryTags.has("embryo_consumer") || carryTags.has("infinite_devour")) {
    const src = embryoGens.length ? nameList(embryoGens) : "the Caro core";
    const v = embryoGens.length >= 2 ? "build" : "builds";
    push("Embryo Fusion (Caro)", `${src} ${v} Embryo Fusion for ${carryName} to consume.`);
  }
  const poisonAppliers = namesInRole("poison_stacker");
  if (poisonAppliers.length || carryTags.has("poison_stacker") || carryTags.has("bleed_stacker")) {
    const dot = carryTags.has("bleed_stacker") && !carryTags.has("poison_stacker") ? "Bleed" : "Poison";
    const src = poisonAppliers.length ? nameList(poisonAppliers) : "the team";
    const v = poisonAppliers.length >= 2 ? "stack" : "stacks";
    push(`${dot} stacking`, `${src} ${v} ${dot} and the team's damage ramps as those stacks build.`);
  }
  // Corrosion is its own mechanic (a damage-taken multiplier), not Poison —
  // Saya applying Corrosion must never read as "stacks Poison".
  const corrosionAppliers = namesInRole("corrosion_applier");
  if (corrosionAppliers.length) {
    const v = corrosionAppliers.length >= 2 ? "apply" : "applies";
    push(
      "Corrosion",
      `${nameList(corrosionAppliers)} ${v} Corrosion, multiplying the damage enemies take from every source.`
    );
  }
  if (namesInRole("sacrifice_engine").length || carryTags.has("sacrifice_synergy")) {
    push("Sacrifice", `${nameList(namesInRole("sacrifice_engine")) || carryName} drives a sacrifice loop the team converts into payoff.`);
  }
  if (carryTags.has("low_hp_scaling")) {
    push("Low-HP execution", `${carryName} hits hardest at low HP, so the team trades some sustain for damage and leans on Death Resistance to survive.`);
  }
  if (carryTags.has("kill_scaling")) {
    push("Kill-scaling", `${carryName} snowballs off kills, getting stronger as the fight goes on.`);
  }

  // --- Enabler archetypes (what feeds the carry) -----------------------------
  const vuln = namesInRole("vuln_applier");
  const weak = namesInRole("weak_applier");
  if (vuln.length || weak.length) {
    const debuffers = [...new Set([...vuln, ...weak])];
    const applied = [vuln.length ? "Vulnerable" : null, weak.length ? "Weakened" : null].filter(
      (x): x is string => Boolean(x)
    );
    const v = debuffers.length >= 2 ? "keep" : "keeps";
    push(
      "Vulnerable / Weakness",
      `${nameList(debuffers)} ${v} enemies ${applied.join(" and ")}, so ${carryName}'s hits land amplified.`
    );
  }
  const batteries = namesInRole("aliemus_battery");
  if (batteries.length && (carryTags.has("aliemus_hungry") || carryTags.has("high_aliemus_cost"))) {
    push("Aliemus battery", `${nameList(batteries)} feed${batteries.length === 1 ? "s" : ""} Aliemus so ${carryName}'s high-cost Exalt fires sooner and more often.`);
  } else if (batteries.length) {
    push("Aliemus battery");
  }
  const keyflare = namesInRole("keyflare_support");
  if (keyflare.length && carryTags.has("keyflare_hungry")) {
    push("Keyflare engine", `${nameList(keyflare)} generate${keyflare.length === 1 ? "s" : ""} Keyflare so ${carryName} can play extra cards each turn.`);
  } else if (keyflare.length) {
    push("Keyflare support");
  }
  const strSup = namesInRole("str_support").filter((n) => !carryNames.includes(n));
  if (strSup.length) {
    push("STR stacking", `${nameList(strSup)} feed${strSup.length === 1 ? "s" : ""} Temporary STR into ${carryName}.`);
  }
  if (namesInRole("leap_support").length || carryTags.has("leap_user") || carryTags.has("quasar_user")) {
    push("Leap");
  }

  // --- Sustain (always last) -------------------------------------------------
  const sustain = [...new Set([...namesInRole("shielder"), ...namesInRole("healer"), ...namesInRole("death_resist")])];
  if (sustain.length) {
    push("Sustain", `${nameList(sustain)} keep${sustain.length === 1 ? "s" : ""} the team alive while the engine runs.`);
  }

  // --- Per-character contributions -------------------------------------------
  const contributions: TeamContribution[] = members.map((a) => {
    const roles = rolesOf(a);
    // The first annotated role is the unit's primary identity; only fall back
    // to the global priority ladder when the annotation gives no ordering.
    const headline = roles[0] ?? ROLE_PRIORITY.find((r) => roles.includes(r));
    let text = (headline && ROLE_PHRASE[headline as TeamRole]) || "flex support";
    // For carries, append what they scale off so the "why" is explicit.
    if (headline === "main_dps" || headline === "sub_dps") {
      const payoffs = [...tagsOf(a)]
        .map((t) => TAG_PAYOFF[t])
        .filter((x): x is string => Boolean(x));
      if (payoffs.length) text += ` — scales off ${nameList(payoffs)}`;
    }
    return {
      awakenerId: a.id,
      name: a.name,
      roleLabel: (headline && ROLE_LABEL[headline as TeamRole]) || "Flex",
      text,
    };
  });

  // --- Summary ---------------------------------------------------------------
  const realm = realmLabel(awakenerIds, awakeners);
  const identity = archetypes[0];
  const article = identity && /^[aeiou]/i.test(identity) ? "an" : "a";
  const summary = carryNames.length
    ? `${realm} team built around ${nameList(carryNames)}${identity ? ` — ${article} ${identity.toLowerCase()} composition` : ""}.`
    : `${realm} support-oriented team.`;

  return { archetypes, summary, chain, contributions };
}