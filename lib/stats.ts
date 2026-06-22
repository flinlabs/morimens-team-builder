import gameplayMath from "@/db/gameplay-math.json";

/* ---------------------------------------------------------------------------
   Stat math — turns the dataset's per-level coefficients into the real numbers
   the game shows.

   Primary stats (CON/ATK/DEF) follow SKeyDB's documented curve:
     stat(level) = ceil( (primaryScalingBase + level + bonusLevels) * growth )
   then an optional Soulforge %% bonus (ceil). This reproduces baseStatsLv1
   exactly at level 1.

   A command-card number is simply stat(level) * skill%% / 100, which is why a
   fixed %%-per-level step shows up as a fixed flat increase on the card.

   Wheel main stats use the metadata's per-rarity series: a base value at 3★ that
   grows perLevel for each +X breakpoint (0..12). Mythic wheels reuse SSR values.

   Keeper (account) level drives the HP multiplier via a 1..100 curve, and gates
   the character level cap together with the dupe cap (80 → 85 at +8 → 90 at +12).
--------------------------------------------------------------------------- */

const EPS = 1e-9;

export const CHAR_MIN_LEVEL = 1;
export const CHAR_HARD_MAX_LEVEL = 90;
export const KEEPER_MIN = 1;
export const KEEPER_MAX = 100;

export type PrimaryStatKey = "CON" | "ATK" | "DEF";

export interface StatScaling {
  CON: number;
  ATK: number;
  DEF: number;
}

/** stat(level) per the documented growth curve. */
export function resolvePrimaryStat(
  primaryScalingBase: number,
  growthPerLevel: number,
  level: number,
  bonusLevels = 0,
  soulforgeBonusPercent = 0
): number {
  if (!Number.isFinite(primaryScalingBase) || !Number.isFinite(growthPerLevel)) {
    return 0;
  }
  const lvl = clampCharLevel(level);
  const base = Math.ceil((primaryScalingBase + lvl + bonusLevels) * growthPerLevel - EPS);
  if (!soulforgeBonusPercent) return base;
  return Math.ceil(base * (1 + soulforgeBonusPercent / 100) - EPS);
}

/** A character's effective Gnostic Potential level. Permanent and limited units
 *  have it fully unlocked the moment you own them (`defaultMaxed`), so they sit
 *  at max regardless of any stored value; welfare units must level it manually,
 *  so their stored level is used. */
export function effectiveGnosticLevel(
  awakener:
    | { talents?: Array<{ family: string; defaultMaxed?: boolean; maxLevel?: number }> }
    | undefined,
  storedLevel: number | undefined
): number {
  const g = awakener?.talents?.find((t) => t.family === "gnostic_potential");
  if (g?.defaultMaxed) return g.maxLevel ?? 5;
  return storedLevel ?? 0;
}

/** Gnostic Potential grants "+N Levels of Base Attributes", applied equally to
 *  CON/ATK/DEF. N is the talent's linear Arg1 evaluated at the talent's level
 *  (index = level − 1), matching how the game raises a maxed unit's stats. */
export function gnosticBonusLevels(
  arg1:
    | { kind?: string; base?: string | number; gainPerLevel?: string | number }
    | undefined,
  gnosticLevel: number
): number {
  if (!arg1 || arg1.kind !== "linear" || gnosticLevel <= 0) return 0;
  const base = Number(arg1.base ?? 0);
  const gain = Number(arg1.gainPerLevel ?? 0);
  if (!Number.isFinite(base) || !Number.isFinite(gain)) return 0;
  return base + gain * (gnosticLevel - 1);
}

/** Resolve all three primary stats at a level. */
export function resolvePrimaryStats(
  primaryScalingBase: number,
  scaling: StatScaling,
  level: number,
  opts: { soulforgeLevel?: number } = {}
): StatScaling {
  // Soulforge gives +3% CON/ATK/DEF per level (Astral Reign only); callers opt in.
  const soulforgePct = (opts.soulforgeLevel ?? 0) * 3;
  return {
    CON: resolvePrimaryStat(primaryScalingBase, scaling.CON, level, 0, soulforgePct),
    ATK: resolvePrimaryStat(primaryScalingBase, scaling.ATK, level, 0, soulforgePct),
    DEF: resolvePrimaryStat(primaryScalingBase, scaling.DEF, level, 0, soulforgePct),
  };
}

/** The concrete card number: stat * percent / 100, rounded the way the card shows it. */
export function cardNumber(statValue: number, percent: number): number {
  return Math.round((statValue * percent) / 100);
}

export function clampCharLevel(level: number): number {
  if (!Number.isFinite(level)) return CHAR_MIN_LEVEL;
  return Math.max(CHAR_MIN_LEVEL, Math.min(CHAR_HARD_MAX_LEVEL, Math.round(level)));
}

export function clampKeeperLevel(level: number): number {
  if (!Number.isFinite(level)) return KEEPER_MIN;
  return Math.max(KEEPER_MIN, Math.min(KEEPER_MAX, Math.floor(level)));
}

/* ---- Keeper level -------------------------------------------------------- */

const HP_CURVE: number[] = gameplayMath.accountLevelCurve.hpMultiplier;

/** Max-HP multiplier granted by the keeper (account) level. */
export function keeperHpMultiplier(keeperLevel: number): number {
  const lvl = clampKeeperLevel(keeperLevel);
  return HP_CURVE[lvl - 1] ?? HP_CURVE[HP_CURVE.length - 1];
}

/**
 * Highest level a character can be raised to: the lesser of the keeper level
 * and the dupe cap (base 80, +5 at +4 over-enlighten i.e. +8 dupes, +5 at +12).
 */
export function dupeLevelCap(plusCount: number): number {
  let cap = 80;
  if (plusCount >= 8) cap += 5;
  if (plusCount >= 12) cap += 5;
  return cap;
}

export function maxCharLevel(keeperLevel: number, plusCount = 0): number {
  return Math.min(clampKeeperLevel(keeperLevel), dupeLevelCap(plusCount));
}

/* ---- Wheel main stat ----------------------------------------------------- */

interface MainstatSeries {
  seriesKey: string;
  rarity: string;
  mainstatKey: string;
  baseValue: string; // e.g. "14.4%" or "36"
  perLevel: string; // e.g. "1.2%" or "3"
}

const WHEEL_SERIES: MainstatSeries[] = gameplayMath.wheelMainstatScaling.series;

function parseNumeric(raw: string): { value: number; suffix: string } {
  const m = /^(-?\d+(?:\.\d+)?)(%)?$/.exec(String(raw).trim());
  if (!m) return { value: 0, suffix: "" };
  return { value: Number(m[1]), suffix: m[2] ?? "" };
}

export interface WheelMainStat {
  value: number;
  suffix: string;
  display: string;
}

/**
 * Main-stat value for a wheel of the given rarity + stat at a +X breakpoint
 * (0 = 3★ base, up to +12). Mythic reuses the SSR series.
 */
export function wheelMainStat(
  rarity: string,
  mainstatKey: string,
  plus: number
): WheelMainStat | null {
  const lookupRarity = rarity === "MYTHIC" ? "SSR" : rarity;
  const series =
    WHEEL_SERIES.find((s) => s.rarity === lookupRarity && s.mainstatKey === mainstatKey) ??
    WHEEL_SERIES.find((s) => s.rarity === "SSR" && s.mainstatKey === mainstatKey);
  if (!series) return null;
  const base = parseNumeric(series.baseValue);
  const per = parseNumeric(series.perLevel);
  const steps = Math.max(0, Math.min(12, Math.round(plus)));
  const value = Math.round((base.value + per.value * steps) * 10) / 10;
  const suffix = base.suffix || per.suffix;
  return { value, suffix, display: `${value}${suffix}` };
}