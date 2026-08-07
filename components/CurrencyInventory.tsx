"use client";

/* Acquisition items the player is holding.

   Feeds the Meta tab: knowing someone has three Chaos Echoes turns "you should
   get Hameln" into "you can get Hameln right now with what's in your bag". A
   recommendation the player has no route to act on is close to useless, so this
   is the input that makes the advice actionable rather than aspirational.

   Grouped by what the item does rather than by arc, because the question being
   answered is "what can I spend" — the arc split matters only inside a group. */

import { useMemo, useState } from "react";
import { useRosterStore } from "@/lib/store";
import type { AcquisitionItem } from "@/lib/acquisition";
import Hint from "./Hint";

const GROUP_ORDER = [
  ["universal", "Universal"],
  ["awakener", "Awakener selectors"],
  ["wheel", "Wheel selectors"],
] as const;

type GroupKey = (typeof GROUP_ORDER)[number][0];

function groupOf(item: AcquisitionItem): GroupKey {
  // Duplicate tokens and synthesised cores work across the whole catalogue, so
  // they sit apart from the arc- and realm-locked selectors.
  if (item.ownedOnly || item.synthesis) return "universal";
  return item.grants === "awakener" ? "awakener" : "wheel";
}

export default function CurrencyInventory({ items }: { items: AcquisitionItem[] }) {
  const roster = useRosterStore((s) => s.roster);
  const setCurrency = useRosterStore((s) => s.setCurrency);
  const [open, setOpen] = useState(false);

  const counts = roster.currencies ?? {};
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  const grouped = useMemo(() => {
    const out: Record<GroupKey, AcquisitionItem[]> = {
      universal: [],
      awakener: [],
      wheel: [],
    };
    for (const item of items) out[groupOf(item)].push(item);
    return out;
  }, [items]);

  return (
    <section className="mb-5 rounded-xl border border-[var(--border)] bg-[var(--bg-2)]/85 p-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-title text-xs uppercase tracking-wider text-[var(--text-dim)]">
          Selectors
        </span>
        <button
          onClick={() => setOpen((v) => !v)}
          className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--text-muted)] transition hover:border-[var(--gold)] hover:text-[var(--gold-bright)]"
        >
          {open ? "Hide" : "Edit"} what I&apos;m holding
        </button>
        {total > 0 && (
          <span className="text-[11px] text-[var(--gold-bright)]">
            {total} item{total === 1 ? "" : "s"} tracked
          </span>
        )}
        <span className="flex items-center gap-1.5 text-[11px] text-[var(--text-dim)]">
          Optional — tell the Meta tab what you can spend and it will say which
          recommendations you can act on today.
          <Hint label="What are selectors?" align="left">
            Prototype Horizons and Timeloop Copies duplicate something you already own;
            the realm packs and Rewind Cores pull from a limited pool. Recording them lets
            the Meta tab route each recommendation to an item that can actually grant it,
            instead of just naming a character.
          </Hint>
        </span>
      </div>

      {open && (
        <div className="mt-3 space-y-4 border-t border-[var(--border)] pt-3">
          {GROUP_ORDER.map(([key, label]) => {
            const group = grouped[key];
            if (!group.length) return null;
            return (
              <div key={key}>
                <div className="font-title mb-1.5 text-[11px] uppercase tracking-wider text-[var(--text-dim)]">
                  {label}
                </div>
                <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                  {group.map((item) => (
                    <label
                      key={item.slug}
                      className="flex items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--panel)]/50 px-2 py-1.5"
                    >
                      <input
                        type="number"
                        min={0}
                        max={999}
                        value={counts[item.slug] ?? 0}
                        onChange={(e) =>
                          setCurrency(
                            item.slug,
                            Math.max(0, Math.min(999, Number(e.target.value) || 0))
                          )
                        }
                        className="w-14 rounded border border-[var(--border)] bg-[var(--bg-2)] px-1.5 py-0.5 text-right text-xs tabular-nums text-[var(--text)] focus:border-[var(--gold)] focus:outline-none"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[11px] text-[var(--text-muted)]">
                          {item.name}
                        </span>
                        <span className="block text-[10px] text-[var(--text-dim)]">
                          {item.selection === "random" ? "Random" : "Choose"}
                          {item.realm ? ` · ${item.realm}` : ""}
                          {item.ownedOnly ? " · owned only" : ""}
                          {item.synthesis
                            ? ` · ${item.synthesis.count}× ${item.synthesis.from}`
                            : ""}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
