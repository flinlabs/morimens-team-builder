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
const HIGH = new Set(["SSR", "MYTHIC"]);

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

export interface GearContext {
  ownsWheel: (id: string) => boolean;
  ownsCovenant: (id: string) => boolean;
  /** 'SSR' | 'MYTHIC' | 'SR' | 'R' | 'N' */
  wheelRarity: (id: string) => string;
  /** stackLevel >= 12 (Overlimit / Dual-SSR unlocked). */
  isPlus12: (id: string) => boolean;
  /** All owned SR/R/N wheels available as fillers. */
  ownedFillerWheels: () => { id: string; rarity: string; realm: string }[];
  awakenerRealm?: string;
  /** Signature SSR/SR wheel ids for this awakener (limited characters). */
  signatureWheels?: { ssr?: string; sr?: string };
  /** Wheels already used elsewhere on the board (kept unique). */
  usedWheelIds?: Set<string>;
  /** Covenant sets already used by teammates (kept unique). */
  usedCovenantIds?: Set<string>;
}

/**
 * Recommended owned gear for an awakener, mirroring the generator's rules:
 *  - two wheels max; a second SSR/Mythic only if one equipped wheel is +12;
 *  - otherwise the second slot is filled from owned SR/R/N (strong fillers);
 *  - wheels and covenant sets stay unique across the board.
 */
export function recommendGearFor(
  awakenerId: string,
  role: string | undefined,
  ctx: GearContext
): { wheelIds: string[]; covenantId?: string } {
  const entry = DATA[awakenerId];
  const variant = entry ? pickVariant(entry, role) : null;

  const used = ctx.usedWheelIds ?? new Set<string>();
  const wheelIds: string[] = [];
  const isHigh = (id: string) => HIGH.has(ctx.wheelRarity(id));
  const breaksOverlimit = (cand: string) =>
    wheelIds.length === 1 &&
    isHigh(cand) &&
    isHigh(wheelIds[0]) &&
    !ctx.isPlus12(cand) &&
    !ctx.isPlus12(wheelIds[0]);

  // Pass 0 — a limited character's signature SSR + SR are their canonical gear.
  const sig = ctx.signatureWheels;
  if (sig) {
    for (const id of [sig.ssr, sig.sr]) {
      if (!id || wheelIds.length >= 2) continue;
      if (wheelIds.includes(id) || used.has(id)) continue;
      if (!ctx.ownsWheel(id)) continue;
      if (breaksOverlimit(id)) continue;
      wheelIds.push(id);
      used.add(id);
    }
  }

  // Pass 1 — owned BiS wheels, honouring Overlimit + uniqueness.
  if (variant) {
    const ranked = [...variant.wheels].sort(
      (a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier)
    );
    for (const w of ranked) {
      if (wheelIds.length >= 2) break;
      const id = w.wheelId;
      if (wheelIds.includes(id) || used.has(id)) continue;
      if (!ctx.ownsWheel(id)) continue;
      if (breaksOverlimit(id)) continue;
      wheelIds.push(id);
      used.add(id);
    }
  }

  // Pass 2 — fill any remaining slot from owned SR/R/N (never trips Overlimit).
  if (wheelIds.length < 2) {
    const fillers = ctx
      .ownedFillerWheels()
      .filter((w) => !wheelIds.includes(w.id) && !used.has(w.id))
      .sort((a, b) => {
        const ra = a.realm === ctx.awakenerRealm ? 0 : 1;
        const rb = b.realm === ctx.awakenerRealm ? 0 : 1;
        if (ra !== rb) return ra - rb;
        const rank: Record<string, number> = { SR: 0, R: 1, N: 2 };
        return (rank[a.rarity] ?? 3) - (rank[b.rarity] ?? 3);
      });
    for (const w of fillers) {
      if (wheelIds.length >= 2) break;
      wheelIds.push(w.id);
      used.add(w.id);
    }
  }

  // Covenant — first owned recommendation not already worn by a teammate.
  const usedCov = ctx.usedCovenantIds ?? new Set<string>();
  let covenantId: string | undefined;
  if (variant) {
    for (const c of variant.covenants) {
      if (usedCov.has(c.covenantId)) continue;
      if (ctx.ownsCovenant(c.covenantId)) {
        covenantId = c.covenantId;
        usedCov.add(c.covenantId);
        break;
      }
    }
  }
  return { wheelIds, covenantId };
}