// Client-safe best-in-slot lookup. Imports the derived bis.json so the lineup
// board can auto-fill recommended gear the moment a character is placed, with
// no round-trip. Owned-filtering is done by the caller-supplied predicates.
import bisData from "@/db/bis.json";

interface BisWheel {
  tier: string;
  wheelId: string;
  wheelName: string;
}
interface BisVariant {
  variant: string;
  wheels: BisWheel[];
  covenants: { covenantId: string; covenantName: string }[];
}
interface BisEntry {
  awakenerId: string;
  variants: BisVariant[];
}

const DATA = bisData as unknown as Record<string, BisEntry>;
const TIER_ORDER = ["BIS_SSR", "ALT_SSR", "BIS_SR", "SR_SHOP", "GOOD"];

function pickVariant(entry: BisEntry, role?: string): BisVariant | null {
  if (!entry.variants.length) return null;
  if (entry.variants.length === 1) return entry.variants[0];
  const wantsDps = !!role && /dps|carry/i.test(role);
  const dps = entry.variants.find((v) => /dps|carry/i.test(v.variant));
  const sup = entry.variants.find((v) => /sup|support|tank|defen|standard|heal/i.test(v.variant));
  if (wantsDps && dps) return dps;
  if (!wantsDps && sup) return sup;
  return entry.variants[0];
}

/**
 * Recommended owned gear for an awakener: up to two owned wheels (best tier
 * first) and the first owned covenant. Returns empty when nothing is owned.
 */
export function recommendGearFor(
  awakenerId: string,
  role: string | undefined,
  ownsWheel: (id: string) => boolean,
  ownsCovenant: (id: string) => boolean
): { wheelIds: string[]; covenantId?: string } {
  const entry = DATA[awakenerId];
  const variant = entry ? pickVariant(entry, role) : null;
  if (!variant) return { wheelIds: [] };

  const ranked = [...variant.wheels].sort(
    (a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier)
  );
  const wheelIds: string[] = [];
  for (const w of ranked) {
    if (wheelIds.length >= 2) break;
    if (!wheelIds.includes(w.wheelId) && ownsWheel(w.wheelId)) wheelIds.push(w.wheelId);
  }
  const covenantId = variant.covenants.find((c) => ownsCovenant(c.covenantId))?.covenantId;
  return { wheelIds, covenantId };
}