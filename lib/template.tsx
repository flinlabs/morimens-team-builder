import React from "react";
import type { DescriptionArg, SkeySkillUpgrade } from "./types";
import { cardNumber } from "./stats";
import { researchDepthValue } from "./research-formula";

/** Resolves a primary stat key (ATK/DEF/CON) to the character's value at their
 *  current level, so percentage-of-stat args can render as real card numbers. */
export type StatResolver = (statKey: string) => number | null;

/* ---------------------------------------------------------------------------
   Scaling description renderer.

   Game effect text (skills, enlightens, talents, wheels, covenants, posses)
   ships as a `descriptionTemplate` peppered with placeholders plus a bag of
   `descriptionArgs`. The same template renders at every investment level — a
   skill at Lv.6, a wheel at 3★ — by indexing into each arg's scaling values.

   Placeholder grammar
     [Arg1]              bare arg            -> resolved value
     [Damage:Arg1]       typed arg           -> resolved value (type is a UI
                                                colour hint, not shown)
     [{Poison}:Arg1]     keyword + value     -> "Poison" chip then the value
     {Caro} {Bleed}      keyword             -> highlighted chip
     {plural:[Arg]|a|b}  pluraliser          -> "a" if arg==1 else "b"

   `index` is 0-based into an arg's scaling `values` array:
     skills    -> level - 1   (Lv.1..6)
     wheels    -> starLevel   (0..3)
     talents   -> level - 1
     covenants -> 0           (set effects are fixed)
--------------------------------------------------------------------------- */

type Args = Record<string, DescriptionArg> | undefined;

/* ---------------------------------------------------------------------------
 * Enlighten skill upgrades. A skill carries `upgrades` that, at a given
 * enlighten milestone (E1, E2, …), rewrite its template and/or args — adding
 * clauses ("If HP below 50%, deal 1 extra hit…") and bumping coefficients. We
 * apply every upgrade whose slot is unlocked at the character's enlighten total,
 * in milestone order, so the description matches what the game shows.
 * ------------------------------------------------------------------------- */
// Copy-threshold for an enlighten slot, keyed by the exact `upgraderSlot`
// values the data uses. E0=1, E1=2, E2=3, E3=4, then the "+N" dupes — OverExalt
// lands at +4 (total 8) and Absolute Axiom at +12 (total 16).
const SLOT_THRESHOLD: Record<string, number> = {
  E0: 1,
  E1: 2,
  E2: 3,
  E3: 4,
  OverExalt: 8,
  OE: 8,
  AbsoluteAxiom: 16,
  AA: 16,
};

export function applySkillUpgrades(
  template: string | undefined,
  args: Args,
  upgrades: SkeySkillUpgrade[] | undefined,
  enlightenTotal: number
): { template: string | undefined; args: Args } {
  if (!upgrades?.length) return { template, args };
  const active = upgrades
    .filter(
      (u) =>
        u.upgraderType === "enlighten" &&
        u.upgraderSlot != null &&
        (SLOT_THRESHOLD[u.upgraderSlot] ?? Infinity) <= enlightenTotal
    )
    .sort(
      (a, b) =>
        (SLOT_THRESHOLD[a.upgraderSlot ?? ""] ?? 0) -
        (SLOT_THRESHOLD[b.upgraderSlot ?? ""] ?? 0)
    );
  if (active.length === 0) return { template, args };
  let t = template;
  let a: Record<string, DescriptionArg> = { ...(args ?? {}) };
  for (const u of active) {
    if (u.patch?.descriptionTemplate) t = u.patch.descriptionTemplate;
    if (u.patch?.descriptionArgs) a = { ...a, ...u.patch.descriptionArgs };
  }
  return { template: t, args: a };
}

const TOKEN =
  /(\{plural:\[[^\]]+\]\|[^|]*\|[^}]*\})|(\[(?:[^\]:]+:)?[A-Za-z0-9_]+\])|(\{[^}]+\})/g;
const BRACKET = /^\[(?:([^\]:]+):)?([A-Za-z0-9_]+)\]$/;
const PLURAL = /\{plural:\[([^\]]+)\]\|([^|]*)\|([^}]*)\}/;

function resolveArg(
  arg: DescriptionArg | undefined,
  index: number,
  resolveStat?: StatResolver,
  accountLevel?: number
): string {
  if (!arg || typeof arg !== "object") return "?";
  const a = arg as Record<string, unknown>;
  const suffix = typeof a.suffix === "string" ? a.suffix : "";
  switch (a.kind) {
    case "fixed":
      return `${a.value ?? ""}${suffix}`;
    case "scaling": {
      const values = Array.isArray(a.values) ? (a.values as string[]) : [];
      if (values.length === 0) return "?";
      const i = Math.max(0, Math.min(values.length - 1, index));
      const raw = values[i] ?? "";
      // Percentage-of-a-stat -> show the real card number (ATK*%/100 etc.).
      if (resolveStat && suffix === "%" && typeof a.stat === "string") {
        const statVal = resolveStat(a.stat);
        if (statVal != null && Number.isFinite(Number(raw))) {
          return String(cardNumber(statVal, Number(raw)));
        }
      }
      return `${raw}${suffix}`;
    }
    case "linear": {
      const base = Number(a.base ?? 0);
      const gain = Number(a.gainPerLevel ?? 0);
      return `${base + gain * index}${suffix}`;
    }
    case "computed": {
      // Account-research-scaled value (esoteric/occult research depth). Needs the
      // player's account (keeper) level; without it we can't show a real number.
      // In-game these always round UP to a whole number (e.g. 39.6 shows as 40).
      if (accountLevel == null) return "?";
      const v = researchDepthValue(
        String(a.baseFormula ?? ""),
        accountLevel,
        typeof a.multiplier === "number" ? a.multiplier : undefined,
        typeof a.rounding === "string" ? a.rounding : undefined
      );
      if (v == null) return "?";
      return `${Math.ceil(v)}${suffix}`;
    }
    default:
      // Unknown shape: surface a stringy value if present, else a marker.
      if (typeof a.value === "string") return `${a.value}${suffix}`;
      return "?";
  }
}

/** The maximum index a template meaningfully scales to (longest values array). */
export function maxScalingIndex(args: Args): number {
  if (!args) return 0;
  let max = 0;
  for (const arg of Object.values(args)) {
    const a = arg as Record<string, unknown>;
    if (a.kind === "scaling" && Array.isArray(a.values)) {
      max = Math.max(max, (a.values as unknown[]).length - 1);
    }
  }
  return max;
}

export type Segment =
  | { kind: "text"; text: string }
  | { kind: "value"; text: string }
  | { kind: "keyword"; text: string };

/** Tokenise a template into typed segments at a given investment index. */
export function segmentTemplate(
  template: string | undefined,
  args: Args,
  index: number,
  resolveStat?: StatResolver,
  accountLevel?: number
): Segment[] {
  if (!template) return [];
  const a = args ?? {};
  const segs: Segment[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  TOKEN.lastIndex = 0;

  const pushText = (text: string) => {
    if (!text) return;
    const cleaned = text.replace(/%%/g, "%");
    segs.push({ kind: "text", text: cleaned });
  };

  while ((m = TOKEN.exec(template))) {
    if (m.index > last) pushText(template.slice(last, m.index));

    if (m[1]) {
      const pm = PLURAL.exec(m[1]);
      if (pm) {
        const val = parseFloat(resolveArg(a[pm[1]], index, resolveStat, accountLevel));
        pushText(val === 1 ? pm[2] : pm[3]);
      }
    } else if (m[2]) {
      const bm = BRACKET.exec(m[2]);
      if (bm) {
        const name = bm[1];
        const key = bm[2];
        const value = resolveArg(a[key], index, resolveStat, accountLevel);
        if (name && name.startsWith("{")) {
          segs.push({ kind: "keyword", text: name.slice(1, -1) });
          segs.push({ kind: "value", text: ` ${value}`.replace(/%%/g, "%") });
        } else {
          segs.push({ kind: "value", text: value.replace(/%%/g, "%") });
        }
      }
    } else if (m[3]) {
      segs.push({ kind: "keyword", text: m[3].slice(1, -1) });
    }
    last = TOKEN.lastIndex;
  }
  if (last < template.length) pushText(template.slice(last));

  // Collapse a stray "%" that immediately follows a value already ending in "%"
  // (templates sometimes carry a literal % after a token whose suffix is also %).
  for (let i = 1; i < segs.length; i++) {
    if (segs[i - 1].text.endsWith("%") && segs[i].text.startsWith("%")) {
      segs[i].text = segs[i].text.replace(/^%+/, "");
    }
  }
  return segs;
}

/** Plain-string render (for tooltips / prompt text). */
export function renderTemplateString(
  template: string | undefined,
  args: Args,
  index: number
): string {
  return segmentTemplate(template, args, index)
    .map((s) => s.text)
    .join("")
    .replace(/%%/g, "%");
}

/** React render with keyword chips and scaled-value highlighting. */
/* ---------------------------------------------------------------------------
 * Keyword colouring — mirrors the in-game palette so descriptions read like the
 * game. Stat names and "Team Unique" are bolded so they stand apart. Colours for
 * the less-certain mechanics are best-guess by icon class; nudge any that don't
 * match the in-game colour.
 * ------------------------------------------------------------------------- */
interface KwStyle {
  color?: string;
  bold?: boolean;
}

const KEYWORD_GROUPS: { terms: string[]; style: KwStyle }[] = [
  { terms: ["Team Unique"], style: { color: "var(--gold-bright)", bold: true } },

  // STR-down debuff — pink. The in-game token is the glyph "STR⯆" (not "STR Down"),
  // and longest-match-first colours it before the green "STR".
  { terms: ["STR⯆", "Weakness"], style: { color: "#a8549b" } },

  // Damage-over-time & damage-class debuffs — red.
  {
    terms: [
      "Vulnerability", "Vulnerable", "Bleed", "Corrosion", "Burn", "Combust",
      "Sin Mark", "Fragile", "Spellbound", "Sealed", "Dormancy",
      "Madness", "Fantasia", "Creativity", "Fiamma", "Gynoecium", "Corpse",
    ],
    style: { color: "#a13939" },
  },

  // Card / mechanic keywords — orange (triangle-icon class in-game).
  {
    terms: [
      "Rouse", "Retain", "Exhaust", "Fleeting", "Prepare", "Countdown", "Innate",
      "Insight", "Endure", "Steal", "Loop", "Alert", "Finale", "Resonance",
      "Quasar", "Leap", "Devour", "Discover", "Aftershock", "Destroy",
      "Fixed DMG", "Pierce DMG", "Tentacle DMG", "Decapitation Damage",
      "Scion of Purity",
    ],
    style: { color: "#af773b" },
  },

  // Buffs — green.
  { terms: ["Strength", "STR", "Counter", "Death Resistance", "Realm Mastery"], style: { color: "#358c53" } },

  // Stats & resources — bold amber. Longer forms (Embryo Fusion, Aliemus Regen)
  // are matched before their bare roots (Embryo, Aliemus) by the length sort.
  {
    terms: [
      "Aliemus Regen", "Keyflare Regen",
      "Crit. Rate", "Crit Rate", "Crit. DMG", "Crit DMG",
      "DMG Amplification", "DMG Amp",
      "Embryo Fusion", "Embryo", "Sigil Yield",
      "Crimson Furnace", "Emotion",
      "Arithmetica",
    ],
    style: { color: "#c79b4e", bold: true },
  },

  // Protection / Aequor Divine stances — blue.
  {
    terms: [
      "Shield", "Life Seal", "Birth Ritual", "Sacrifice",
      "Tranquil Sea", "Raging Waves", "Surging Tides", "Gland Division",
    ],
    style: { color: "#5697cd" },
  },

  // Status effects / Ultra mechanics / unique — purple.
  {
    terms: [
      "Poison", "Stagnation", "Void", "Singularity Warp", "Final Verdict",
      "Ultra Space", "Ultra Round", "Annihilation", "Symbiosis",
    ],
    style: { color: "#7056b9" },
  },

  // Realm names — tinted to their realm colour. (Single-term groups so each
  // realm keeps its own hue.) "Ultra Space"/"Ultra Round" win over bare "Ultra".
  { terms: ["Caro"], style: { color: "var(--realm-caro)" } },
  { terms: ["Aequor"], style: { color: "var(--realm-aequor)" } },
  { terms: ["Chaos"], style: { color: "var(--realm-chaos)" } },
  { terms: ["Ultra"], style: { color: "var(--realm-ultra)" } },
];

const KEYWORD_STYLE = new Map<string, KwStyle>();
for (const g of KEYWORD_GROUPS) for (const t of g.terms) KEYWORD_STYLE.set(t, g.style);

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// Alphanumeric lookarounds (instead of \b) so glyph-bearing tokens like "STR⯆"
// match — \b fails after a non-word symbol. A trailing "s?" lets plain-text
// plurals (Counters, Leaps) colour too. Longest terms first so multi-word
// keywords beat their substrings (e.g. "STR⯆" before "STR").
const KEYWORD_RE = new RegExp(
  "((?<![A-Za-z0-9])(?:" +
    [...KEYWORD_STYLE.keys()]
      .sort((a, b) => b.length - a.length)
      .map(escapeRe)
      .join("|") +
    ")s?(?![A-Za-z0-9]))",
  "g"
);

/** Semantic style for a single keyword term — also used to recolour the braced
 *  {keyword} segments so they match the in-game palette instead of plain gold.
 *  Falls back to the singular for a trailing-"s" plural (Counters -> Counter). */
export function keywordStyle(term: string): KwStyle | undefined {
  return (
    KEYWORD_STYLE.get(term) ??
    (term.length > 1 && term.endsWith("s") ? KEYWORD_STYLE.get(term.slice(0, -1)) : undefined)
  );
}

/** Colourises the special game keywords inside a plain description string. */
export function KeywordText({ text }: { text?: string | null }) {
  if (!text) return null;
  const parts = text.split(KEYWORD_RE);
  return (
    <>
      {parts.map((p, i) => {
        const st = keywordStyle(p);
        return st ? (
          <span
            key={i}
            style={{ color: st.color, fontWeight: st.bold ? 700 : undefined }}
          >
            {p}
          </span>
        ) : (
          <React.Fragment key={i}>{p}</React.Fragment>
        );
      })}
    </>
  );
}

export function ScaledText({
  template,
  args,
  index,
  className,
  resolveStat,
}: {
  template: string | undefined;
  args: Args;
  index: number;
  className?: string;
  resolveStat?: StatResolver;
}) {
  const segs = segmentTemplate(template, args, index, resolveStat);
  if (segs.length === 0) {
    return (
      <span className={className} style={{ color: "var(--text-dim)" }}>
        No effect text.
      </span>
    );
  }
  return (
    <span className={className} style={{ whiteSpace: "pre-wrap" }}>
      {segs.map((s, i) => {
        if (s.kind === "keyword") {
          const sem = keywordStyle(s.text);
          return (
            <span
              key={i}
              className="rounded-[3px] px-1 py-px text-[0.92em] font-medium"
              style={
                sem
                  ? {
                      color: sem.color,
                      fontWeight: sem.bold ? 700 : 500,
                      background: "rgba(255,255,255,0.05)",
                    }
                  : {
                      color: "var(--gold-bright)",
                      background: "rgba(198,163,82,0.10)",
                    }
              }
            >
              {s.text}
            </span>
          );
        }
        if (s.kind === "value") {
          // Colour a value by the resource it feeds: Aliemus values render
          // yellow and Keyflare values white, identified by the word trailing
          // the number (Keyflare is untyped, so the type hint can't be used).
          const after = segs[i + 1];
          const trailing =
            after && after.kind === "text" ? after.text.trimStart() : "";
          const valueColor = trailing.startsWith("Aliemus")
            ? "#f0cf52"
            : trailing.startsWith("Keyflare")
            ? "#ffffff"
            : "var(--realm-aequor)";
          return (
            <span
              key={i}
              className="font-semibold tabular-nums"
              style={{ color: valueColor }}
            >
              {s.text}
            </span>
          );
        }
        return <KeywordText key={i} text={s.text} />;
      })}
    </span>
  );
}