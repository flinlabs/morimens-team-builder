// Forbidden-Lore "research depth" scaling, mirroring SKeyDB's public formula
// evaluator. Curves are embedded here (committed source) so resolution never
// depends on the gitignored db/gameplay-math.json being present or current.
//
//   esotericResearchDepth(level) = stageGrow(level)
//   occultResearchDepth(level)   = stageGrow(level) * accountDamagePower(level) / 100
//   value = base * (multiplier ?? 1)   [ceil if rounding === "ceil"]
//
// accountLevel === keeper level. Index 0 === account level 1.

// AUTO: from SKeyDB accountLevelCurve (index 0 = account level 1).
const STAGE_GROW = [
  62, 65, 69, 72, 75, 78, 81, 85, 88, 91,
  95, 98, 101, 105, 108, 113, 118, 123, 129, 134,
  139, 143, 148, 152, 157, 168, 179, 191, 203, 215,
  224, 233, 243, 252, 262, 274, 287, 301, 314, 329,
  344, 360, 376, 393, 411, 426, 443, 458, 474, 490,
  512, 534, 557, 581, 605, 638, 669, 701, 743, 768,
  787, 805, 824, 838, 858, 877, 897, 917, 938, 959,
  969, 980, 990, 1001, 1011, 1022, 1032, 1043, 1053, 1064,
  1074, 1085, 1095, 1106, 1116, 1127, 1137, 1148, 1158, 1169,
  1179, 1190, 1200, 1211, 1221, 1232, 1242, 1253, 1263, 1274,
];
const ACCOUNT_DAMAGE_POWER = [
  113, 113, 114, 115, 115, 115, 116, 116, 116, 117,
  118, 119, 120, 121, 122, 125, 126, 129, 131, 132,
  135, 139, 141, 144, 146, 148, 149, 150, 151, 153,
  154, 154, 155, 157, 158, 162, 165, 169, 174, 178,
  182, 184, 188, 192, 196, 197, 199, 202, 203, 206,
  209, 213, 217, 221, 238, 247, 257, 265, 272, 281,
  286, 292, 298, 306, 312, 318, 324, 332, 338, 344,
  346, 348, 350, 352, 354, 356, 358, 360, 362, 364,
  366, 368, 370, 372, 374, 376, 378, 380, 382, 384,
  386, 388, 390, 392, 394, 396, 398, 400, 402, 404,
];

function curveAt(curve: number[], accountLevel: number): number {
  const lvl = Math.max(1, Math.min(curve.length, Math.round(accountLevel || 1)));
  return curve[lvl - 1];
}

/** Base research-depth value before the per-effect multiplier. */
export function researchDepthBase(baseFormula: string, accountLevel: number): number | null {
  switch (baseFormula) {
    case "esotericResearchDepth":
      return curveAt(STAGE_GROW, accountLevel);
    case "occultResearchDepth":
      return curveAt(STAGE_GROW, accountLevel) * (curveAt(ACCOUNT_DAMAGE_POWER, accountLevel) / 100);
    default:
      return null;
  }
}

/** Full computed value for a `kind: "computed"` arg at the player's account level. */
export function researchDepthValue(
  baseFormula: string,
  accountLevel: number,
  multiplier?: number,
  rounding?: string
): number | null {
  const base = researchDepthBase(baseFormula, accountLevel);
  if (base == null) return null;
  const scaled = typeof multiplier === "number" && Number.isFinite(multiplier) ? base * multiplier : base;
  return rounding === "ceil" ? Math.ceil(scaled) : scaled;
}