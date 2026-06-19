import React from "react";
import type { DescriptionArg } from "./types";
import { cardNumber } from "./stats";

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

const TOKEN =
  /(\{plural:\[[^\]]+\]\|[^|]*\|[^}]*\})|(\[(?:[^\]:]+:)?[A-Za-z0-9_]+\])|(\{[^}]+\})/g;
const BRACKET = /^\[(?:([^\]:]+):)?([A-Za-z0-9_]+)\]$/;
const PLURAL = /\{plural:\[([^\]]+)\]\|([^|]*)\|([^}]*)\}/;

function resolveArg(
  arg: DescriptionArg | undefined,
  index: number,
  resolveStat?: StatResolver
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
  resolveStat?: StatResolver
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
        const val = parseFloat(resolveArg(a[pm[1]], index, resolveStat));
        pushText(val === 1 ? pm[2] : pm[3]);
      }
    } else if (m[2]) {
      const bm = BRACKET.exec(m[2]);
      if (bm) {
        const name = bm[1];
        const key = bm[2];
        const value = resolveArg(a[key], index, resolveStat);
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
          return (
            <span
              key={i}
              className="rounded-[3px] px-1 py-px text-[0.92em] font-medium"
              style={{
                color: "var(--gold-bright)",
                background: "rgba(198,163,82,0.10)",
              }}
            >
              {s.text}
            </span>
          );
        }
        if (s.kind === "value") {
          return (
            <span
              key={i}
              className="font-semibold tabular-nums"
              style={{ color: "var(--realm-aequor)" }}
            >
              {s.text}
            </span>
          );
        }
        return <React.Fragment key={i}>{s.text}</React.Fragment>;
      })}
    </span>
  );
}