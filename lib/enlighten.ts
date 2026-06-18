import type { EnlightenSlot } from "./types";

/* ---------------------------------------------------------------------------
   Enlighten track.

   The roster stores enlightenment as a named slot (E0..AA) plus over-enlighten
   copies, but the player thinks of it as one continuous track — the in-game
   slider that runs from base up through E1/E2/E3/OverExalt/AbsoluteAxiom and on
   into over-enlighten dupes. These helpers convert between the two so the UI
   can present a single 0..16 slider with milestone ticks while the store and
   generator keep their (slot, copies) shape.
--------------------------------------------------------------------------- */

export const ENLIGHTEN_MAX = 16;

export interface Milestone {
  slot: EnlightenSlot;
  total: number;
  label: string;
  full: string;
}

// total-copy index at which each named node unlocks.
export const ENLIGHTEN_MILESTONES: Milestone[] = [
  { slot: "E0", total: 0, label: "Base", full: "Base" },
  { slot: "E1", total: 1, label: "E1", full: "Enlighten I" },
  { slot: "E2", total: 2, label: "E2", full: "Enlighten II" },
  { slot: "E3", total: 3, label: "E3", full: "Enlighten III" },
  { slot: "OE", total: 4, label: "OE", full: "Over-Exalt" },
  { slot: "AA", total: 5, label: "AA", full: "Absolute Axiom" },
];

// Record-level slot names -> roster slot names.
export const RECORD_SLOT_TO_ROSTER: Record<string, EnlightenSlot> = {
  E1: "E1",
  E2: "E2",
  E3: "E3",
  OverExalt: "OE",
  AbsoluteAxiom: "AA",
};

/** (slot, copies) -> single 0..16 track index. */
export function toTotal(slot: EnlightenSlot, copies: number): number {
  const m = ENLIGHTEN_MILESTONES.find((x) => x.slot === slot);
  const base = m ? m.total : 0;
  // Over-enlighten dupes only stack past Absolute Axiom.
  if (slot === "AA") return Math.min(ENLIGHTEN_MAX, base + Math.max(0, copies));
  return base;
}

/** single 0..16 track index -> (slot, copies). */
export function fromTotal(total: number): {
  slot: EnlightenSlot;
  copies: number;
} {
  const t = Math.max(0, Math.min(ENLIGHTEN_MAX, Math.round(total)));
  if (t <= 5) return { slot: ENLIGHTEN_MILESTONES[t].slot, copies: 0 };
  return { slot: "AA", copies: t - 5 };
}

/** Named nodes (E1..AA) reached at a given track index, base excluded. */
export function unlockedSlots(total: number): EnlightenSlot[] {
  return ENLIGHTEN_MILESTONES.filter(
    (m) => m.total <= total && m.slot !== "E0"
  ).map((m) => m.slot);
}

export function isSlotUnlocked(slot: EnlightenSlot, total: number): boolean {
  const m = ENLIGHTEN_MILESTONES.find((x) => x.slot === slot);
  return m ? total >= m.total : false;
}

export function slotLabel(slot: EnlightenSlot): string {
  return ENLIGHTEN_MILESTONES.find((m) => m.slot === slot)?.label ?? slot;
}

/** Over-enlighten dupes past AA, for the "+N" badge. */
export function overEnlighten(total: number): number {
  return Math.max(0, Math.min(ENLIGHTEN_MAX - 5, total - 5));
}