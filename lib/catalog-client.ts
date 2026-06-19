// Client-side catalog resolution. Imports the db JSON directly (bundled at
// build time, exactly like bis.json) and resolves the tile subtitles — wheel
// main-stat, covenant 3-piece stat category, and posse/wheel effect text —
// without depending on the server `page.tsx` projection. Account-scaled posse
// values resolve here too, since the roster (keeper level) is on the client.
import wheelsData from "@/db/wheels.json";
import covenantsData from "@/db/covenants.json";
import possesData from "@/db/posses.json";
import { segmentTemplate } from "./template";
import { wheelMainStat } from "./stats";

interface WheelRec {
  id: string;
  rarity: string;
  realm?: string;
  mainstatKey?: string;
  hasCombatEffect?: boolean;
  descriptionTemplate?: string;
  descriptionArgs?: Record<string, unknown>;
  ownerAwakenerId?: string;
}
interface SetEffect {
  set: number;
  descriptionTemplate?: string;
  descriptionArgs?: Record<string, unknown>;
}
interface CovRec {
  id: string;
  setEffects?: SetEffect[];
}
interface PosseRec {
  id: string;
  descriptionTemplate?: string;
  descriptionArgs?: Record<string, unknown>;
}

const WHEELS = wheelsData as unknown as Record<string, WheelRec>;
const COVENANTS = covenantsData as unknown as Record<string, CovRec>;
const POSSES = possesData as unknown as Record<string, PosseRec>;

// Each limited awakener has a signature SSR + SR wheel (linked via
// ownerAwakenerId in the source data). Build owner -> {ssr, sr} once.
const SIGNATURE: Record<string, { ssr?: string; sr?: string }> = (() => {
  const m: Record<string, { ssr?: string; sr?: string }> = {};
  for (const w of Object.values(WHEELS)) {
    if (!w.ownerAwakenerId) continue;
    const slot = m[w.ownerAwakenerId] ?? (m[w.ownerAwakenerId] = {});
    if (w.rarity === "SSR" && !slot.ssr) slot.ssr = w.id;
    else if (w.rarity === "SR" && !slot.sr) slot.sr = w.id;
  }
  return m;
})();

/** Signature SSR/SR wheel ids for a limited awakener (empty for permanents). */
export function signatureWheelIds(awakenerId: string): { ssr?: string; sr?: string } {
  return SIGNATURE[awakenerId] ?? {};
}

const MAINSTAT_LABEL: Record<string, string> = {
  CRIT_RATE: "Crit Rate",
  CRIT_DMG: "Crit DMG",
  DMG_AMP: "DMG Amp",
  ALIEMUS_REGEN: "Aliemus Regen",
  KEYFLARE_REGEN: "Keyflare Regen",
  REALM_MASTERY: "Realm Mastery",
  DEATH_RESISTANCE: "Death Resistance",
  SIGIL_YIELD: "Sigil Yield",
};

function plain(
  template?: string,
  args?: Record<string, unknown>,
  accountLevel?: number
): string {
  if (!template) return "";
  try {
    return segmentTemplate(template, (args ?? {}) as never, 0, undefined, accountLevel)
      .map((s) => s.text)
      .join("")
      .replace(/%%/g, "%")
      .replace(/\s+/g, " ")
      .trim();
  } catch {
    return "";
  }
}

/** Wheel subtitle, e.g. "Aliemus Regen 7.2" at the wielder's current stack. */
export function wheelMainstatText(id: string, stackLevel = 0): string | undefined {
  const w = WHEELS[id];
  if (!w?.mainstatKey) return undefined;
  const label = MAINSTAT_LABEL[w.mainstatKey] ?? w.mainstatKey;
  const stat = wheelMainStat(w.rarity, w.mainstatKey, stackLevel);
  return stat ? `${label} ${stat.display}` : label;
}

/** Combat-effect wheels carry an effect line; mainstat-only wheels don't. */
export function wheelEffectText(id: string, accountLevel?: number): string | undefined {
  const w = WHEELS[id];
  if (!w?.hasCombatEffect) return undefined;
  return plain(w.descriptionTemplate, w.descriptionArgs, accountLevel) || undefined;
}

/** Covenant 3-piece stat category only (no number), e.g. "Death Resistance". */
export function covenantCategoryText(id: string): string | undefined {
  const three = COVENANTS[id]?.setEffects?.find((s) => s.set === 3);
  if (!three) return undefined;
  const full = plain(three.descriptionTemplate, three.descriptionArgs);
  const cat = full.split("+")[0].trim();
  return cat && cat.length <= 28 ? cat : undefined;
}

/** Posse effect, with account-scaled values resolved at the keeper level. */
export function posseEffectText(id: string, accountLevel?: number): string | undefined {
  const p = POSSES[id];
  if (!p) return undefined;
  return plain(p.descriptionTemplate, p.descriptionArgs, accountLevel) || undefined;
}

/** Hover tooltip for a wheel: main-stat plus combat effect if any. */
export function wheelTooltip(id: string, stackLevel = 0, accountLevel?: number): string | undefined {
  const ms = wheelMainstatText(id, stackLevel);
  const ef = wheelEffectText(id, accountLevel);
  return [ms, ef].filter(Boolean).join(" — ") || undefined;
}

/** Hover tooltip for a covenant: 3-piece and 6-piece set effects. */
export function covenantTooltip(id: string): string | undefined {
  const sets = COVENANTS[id]?.setEffects;
  if (!sets) return undefined;
  const three = sets.find((s) => s.set === 3);
  const six = sets.find((s) => s.set === 6) ?? sets[sets.length - 1];
  const t3 = three ? plain(three.descriptionTemplate, three.descriptionArgs) : "";
  const t6 = six ? plain(six.descriptionTemplate, six.descriptionArgs) : "";
  const parts: string[] = [];
  if (t3) parts.push(`3-Piece: ${t3}`);
  if (t6 && t6 !== t3) parts.push(`6-Piece: ${t6}`);
  return parts.join("\n") || undefined;
}