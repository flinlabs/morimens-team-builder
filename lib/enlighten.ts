import type { EnlightenSlot } from "./types";

/* ---------------------------------------------------------------------------
   Enlighten track.

   Morimens dupes run E0–E3 then +1…+12 (see the in-game "Dupes" rules):
     • E0  = owned, a single copy (the base).
     • E1  = 2 copies, E2 = 3, E3 = 4.
     • +N  = copies past E3. Over-Exalt unlocks at +4 (8 copies total),
             and Absolute Axiom at +12 (16 copies total, the maximum —
             "15 dupes" on top of the base).
   The roster stores a named slot + copies-past-slot; the UI works in a single
   1…16 total-copy slider. These helpers convert between the two and label the
   position the way the game does ("E0".."E3", then "+1".."+12").
--------------------------------------------------------------------------- */

export const ENLIGHTEN_MIN = 1; // E0 — a single owned copy
export const ENLIGHTEN_MAX = 16; // +12 — Absolute Axiom, the max

export interface Milestone {
  slot: EnlightenSlot;
  copies: number; // total copies at which this node unlocks
  label: string;
  full: string;
}

// Total-copy count at which each named node unlocks.
export const ENLIGHTEN_MILESTONES: Milestone[] = [
  { slot: "E0", copies: 1, label: "E0", full: "Base (owned)" },
  { slot: "E1", copies: 2, label: "E1", full: "Enlighten I" },
  { slot: "E2", copies: 3, label: "E2", full: "Enlighten II" },
  { slot: "E3", copies: 4, label: "E3", full: "Enlighten III" },
  { slot: "OE", copies: 8, label: "OE", full: "Over-Exalt (+4)" },
  { slot: "AA", copies: 16, label: "AA", full: "Absolute Axiom (+12)" },
];

// Record-level slot names -> roster slot names.
export const RECORD_SLOT_TO_ROSTER: Record<string, EnlightenSlot> = {
  E1: "E1",
  E2: "E2",
  E3: "E3",
  OverExalt: "OE",
  AbsoluteAxiom: "AA",
};

function thresholdOf(slot: EnlightenSlot): number {
  return ENLIGHTEN_MILESTONES.find((m) => m.slot === slot)?.copies ?? ENLIGHTEN_MIN;
}

/** (slot, copies-past-slot) -> total copies (1..16). */
export function toTotal(slot: EnlightenSlot, copies: number): number {
  return Math.min(ENLIGHTEN_MAX, thresholdOf(slot) + Math.max(0, copies));
}

/** total copies (1..16) -> (slot, copies-past-slot), choosing the highest node reached. */
export function fromTotal(total: number): { slot: EnlightenSlot; copies: number } {
  const t = Math.max(ENLIGHTEN_MIN, Math.min(ENLIGHTEN_MAX, Math.round(total)));
  let chosen = ENLIGHTEN_MILESTONES[0];
  for (const m of ENLIGHTEN_MILESTONES) if (t >= m.copies) chosen = m;
  return { slot: chosen.slot, copies: t - chosen.copies };
}

/** Named nodes (E1..AA) reached at a given total-copy count, base excluded. */
export function unlockedSlots(total: number): EnlightenSlot[] {
  return ENLIGHTEN_MILESTONES.filter(
    (m) => m.copies <= total && m.slot !== "E0"
  ).map((m) => m.slot);
}

export function isSlotUnlocked(slot: EnlightenSlot, total: number): boolean {
  return total >= thresholdOf(slot);
}

export function slotLabel(slot: EnlightenSlot): string {
  return ENLIGHTEN_MILESTONES.find((m) => m.slot === slot)?.label ?? slot;
}

/** The "+N" dupe count past E3 (0 for E0..E3, up to 12 at the max). */
export function plusCount(total: number): number {
  return Math.max(0, Math.min(12, Math.round(total) - 4));
}

/** Back-compat alias — the dupe count past E3. */
export function overEnlighten(total: number): number {
  return plusCount(total);
}

/** Position label the way the game shows it: "E0".."E3", then "+1".."+12". */
export function trackLabel(total: number): string {
  const t = Math.max(ENLIGHTEN_MIN, Math.min(ENLIGHTEN_MAX, Math.round(total)));
  if (t <= 4) return ENLIGHTEN_MILESTONES[t - 1].label;
  return `+${t - 4}`;
}