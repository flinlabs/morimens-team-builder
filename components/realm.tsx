import type { Realm } from "@/lib/types";

/* Shared realm system — sigils, colours, and the sort ranks used across the
   roster grid, the gear tabs, and the detail modal. Kept in its own module so
   both RosterBuilder and DetailModal can import it without a circular dependency. */

export const REALMS: { key: Realm; label: string; color: string }[] = [
  { key: "CHAOS", label: "Chaos", color: "var(--realm-chaos)" },
  { key: "CARO", label: "Caro", color: "var(--realm-caro)" },
  { key: "AEQUOR", label: "Aequor", color: "var(--realm-aequor)" },
  { key: "ULTRA", label: "Ultra", color: "var(--realm-ultra)" },
];

export const REALM_COLOR: Record<string, string> = {
  CHAOS: "var(--realm-chaos)",
  CARO: "var(--realm-caro)",
  AEQUOR: "var(--realm-aequor)",
  ULTRA: "var(--realm-ultra)",
  NEUTRAL: "var(--text-dim)",
};

// Lower rank sorts first. Realms in canonical order; NEUTRAL (wheels) last.
export const REALM_RANK: Record<string, number> = {
  CHAOS: 0,
  CARO: 1,
  AEQUOR: 2,
  ULTRA: 3,
  NEUTRAL: 4,
};

// Lower rank = higher rarity, sorts first.
export const RARITY_RANK: Record<string, number> = {
  MYTHIC: 0,
  Genesis: 1,
  SSR: 2,
  SR: 3,
  R: 4,
  N: 5,
};

export function RealmSigil({ realm, size = 18 }: { realm: string; size?: number }) {
  const color = REALM_COLOR[realm] ?? "var(--text-dim)";
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "currentColor",
    style: { color },
  } as const;
  switch (realm) {
    case "ULTRA": // four-point star
      return (
        <svg {...common} aria-hidden>
          <path d="M12 1l2.4 8.1L23 12l-8.6 2.4L12 23l-2.4-8.6L1 12l8.6-2.9z" />
        </svg>
      );
    case "CARO": // fanged maw
      return (
        <svg {...common} aria-hidden>
          <path d="M3 6c3 1.8 6 2.6 9 2.6S18 7.8 21 6l-2.6 2.2L16.7 14l-1.7-5q-1.5.8-3 .8t-3-.8L7.3 14 5.6 8.2z" />
        </svg>
      );
    case "AEQUOR": // tide
      return (
        <svg {...common} aria-hidden>
          <path d="M2 8.5c2-2.4 4-2.4 6 0s4 2.4 6 0 4-2.4 6 0v3c-2 2.4-4 2.4-6 0s-4-2.4-6 0-4 2.4-6 0z" />
        </svg>
      );
    case "CHAOS": // mask with two eyes
      return (
        <svg {...common} aria-hidden fillRule="evenodd" clipRule="evenodd">
          <path d="M12 2.5c-5 0-8 3.4-8 8.4S8.2 21.5 12 21.5 20 16 20 10.9 17 2.5 12 2.5zM8.6 9.2c.9 0 1.6.9 1.6 2s-.7 2-1.6 2-1.6-.9-1.6-2 .7-2 1.6-2zm6.8 0c.9 0 1.6.9 1.6 2s-.7 2-1.6 2-1.6-.9-1.6-2 .7-2 1.6-2z" />
        </svg>
      );
    default:
      return null;
  }
}