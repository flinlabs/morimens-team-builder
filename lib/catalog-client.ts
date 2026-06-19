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
  mainstatKey?: string;
  hasCombatEffect?: boolean;
  descriptionTemplate?: string;
  descriptionArgs?: Record<string, unknown>;
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