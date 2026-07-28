"use client";

/* Meta tab — deterministic investment and acquisition advice.

   Answers "where do I stop investing", "who do I pull next", "which wheel do I
   need", and "how close am I to a known team" from the annotations, the BiS
   tables, and the curated meta compositions. Everything shown here is computed
   server-side by lib/pull-advice.ts; this component only renders it, so a wrong
   number is a data fix rather than a UI one. */

import { useEffect, useState } from "react";
import type { MetaAdvice, InvestmentStatus } from "@/lib/pull-advice";
import { useRosterStore } from "@/lib/store";
import { REALM_COLOR } from "@/components/realm";

type Section = "pulls" | "breakpoints" | "wheels" | "lineups";

const SECTIONS: [Section, string][] = [
  ["pulls", "Who to Pull"],
  ["breakpoints", "Stopping Points"],
  ["wheels", "Wheels to Chase"],
  ["lineups", "Meta Lineups"],
];

const STATUS_STYLE: Record<InvestmentStatus, { label: string; className: string }> = {
  below_floor: {
    label: "Under-invested",
    className: "border-[var(--danger)]/40 bg-[var(--danger)]/10 text-[var(--danger)]",
  },
  climbing: {
    label: "Climbing",
    className: "border-[var(--gold)]/40 bg-[var(--gold)]/10 text-[var(--gold-bright)]",
  },
  at_stopping_point: {
    label: "Done",
    className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
  },
  past_stopping_point: {
    label: "Over-invested",
    className: "border-[var(--border)] bg-[var(--bg-3)] text-[var(--text-dim)]",
  },
  not_owned: {
    label: "Not owned",
    className: "border-[var(--border)] bg-[var(--bg-3)] text-[var(--text-dim)]",
  },
};

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-2)]/60 p-3">
      {children}
    </div>
  );
}

function Chip({ children, tone = "dim" }: { children: React.ReactNode; tone?: "dim" | "gold" }) {
  return (
    <span
      className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
        tone === "gold"
          ? "border-[var(--gold)]/40 bg-[var(--gold)]/10 text-[var(--gold-bright)]"
          : "border-[var(--border)] bg-[var(--bg-3)] text-[var(--text-dim)]"
      }`}
    >
      {children}
    </span>
  );
}

export default function MetaPanel({
  onOpenDetail,
}: {
  onOpenDetail?: (awakenerId: string) => void;
}) {
  const roster = useRosterStore((s) => s.roster);
  const [section, setSection] = useState<Section>("pulls");
  const [advice, setAdvice] = useState<MetaAdvice | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showOwnedOnly, setShowOwnedOnly] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch("/api/meta-advice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roster }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) setError(data.error ?? "Could not build advice.");
        else setAdvice(data as MetaAdvice);
      })
      .catch(() => {
        if (!cancelled) setError("Network error — please try again.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [roster]);

  if (loading && !advice) {
    return (
      <p className="py-10 text-center text-sm text-[var(--text-dim)]">
        Reading your collection…
      </p>
    );
  }
  if (error) {
    return <p className="py-10 text-center text-sm text-[var(--danger)]">{error}</p>;
  }
  if (!advice) return null;

  const breakpoints = showOwnedOnly
    ? advice.breakpoints.filter((b) => b.owned)
    : advice.breakpoints;

  return (
    <div className="space-y-5">
      <p className="text-xs leading-relaxed text-[var(--text-dim)]">
        Everything here is read from the annotation data rather than generated — stopping
        points are the last Enlighten rung that changes how a character plays, and pull
        rankings weigh what your collection is missing above raw power.
      </p>

      {advice.roleGaps.length > 0 && (
        <div className="rounded-lg border border-[var(--danger)]/40 bg-[var(--danger)]/5 p-3">
          <div className="font-title mb-1 text-xs font-semibold uppercase tracking-wider text-[var(--danger)]">
            Roster gaps
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            Nothing you own and have built covers:{" "}
            {advice.roleGaps.map((g) => g.label).join(", ")}. Pulls that fill these are
            ranked first below.
          </p>
        </div>
      )}

      <nav className="flex flex-wrap items-center gap-2">
        {SECTIONS.map(([key, label]) => (
          <button
            key={key}
            onClick={() => setSection(key)}
            className={`font-title rounded-lg border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider transition ${
              section === key
                ? "border-[var(--gold)] bg-[var(--gold)]/10 text-[var(--gold-bright)]"
                : "border-[var(--border)] text-[var(--text-dim)] hover:border-[var(--border-bright)] hover:text-[var(--text-muted)]"
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      {section === "pulls" && (
        <div className="grid gap-2 md:grid-cols-2">
          {advice.pullTargets.map((t) => (
            <Card key={t.awakenerId}>
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <button
                  onClick={() => onOpenDetail?.(t.awakenerId)}
                  className="font-title text-sm text-[var(--text)] hover:text-[var(--gold-bright)]"
                >
                  {t.name}
                </button>
                <span
                  className="text-[10px] uppercase tracking-wider"
                  style={{ color: REALM_COLOR[t.realm] ?? "var(--text-dim)" }}
                >
                  {t.realm}
                </span>
                <Chip tone="gold">Tier {t.tier}</Chip>
                <Chip>From {t.entryPoint}</Chip>
                {t.stoppingPoint && t.stoppingPoint !== t.entryPoint && (
                  <Chip>Stop at {t.stoppingPoint}</Chip>
                )}
              </div>
              <ul className="space-y-0.5 text-xs text-[var(--text-muted)]">
                {t.reasons.map((r, i) => (
                  <li key={i}>· {r}</li>
                ))}
              </ul>
            </Card>
          ))}
          {advice.pullTargets.length === 0 && (
            <p className="text-sm text-[var(--text-dim)]">
              You own every annotated character — nothing left to chase.
            </p>
          )}
        </div>
      )}

      {section === "breakpoints" && (
        <div className="space-y-2">
          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-[var(--text-muted)]">
            <input
              type="checkbox"
              checked={showOwnedOnly}
              onChange={(e) => setShowOwnedOnly(e.target.checked)}
              className="accent-[var(--gold)]"
            />
            Only characters I own
          </label>
          {breakpoints.map((b) => {
            const style = STATUS_STYLE[b.status];
            return (
              <Card key={b.awakenerId}>
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => onOpenDetail?.(b.awakenerId)}
                    className="font-title text-sm text-[var(--text)] hover:text-[var(--gold-bright)]"
                  >
                    {b.name}
                  </button>
                  <span
                    className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${style.className}`}
                  >
                    {style.label}
                  </span>
                  <Chip tone="gold">Tier {b.tier}</Chip>
                  <Chip>Floor {b.viabilityFloor}</Chip>
                  {b.stoppingPoint && <Chip>Stop {b.stoppingPoint}</Chip>}
                </div>
                <p className="text-xs text-[var(--text-muted)]">{b.note}</p>
                {(b.keySkillSlots.length > 0 || b.keyTalents.length > 0) && (
                  <p className="mt-1 text-[11px] text-[var(--text-dim)]">
                    {b.keySkillSlots.length > 0 && `Level first: ${b.keySkillSlots.join(", ")}. `}
                    {b.keyTalents.length > 0 &&
                      `Talents: ${b.keyTalents.map((t) => t.replace(/_/g, " ")).join(", ")}.`}
                  </p>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {section === "wheels" && (
        <div className="grid gap-2 md:grid-cols-2">
          {advice.wheelTargets.map((w) => (
            <Card key={w.wheelId}>
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className="font-title text-sm text-[var(--text)]">{w.name}</span>
                <Chip tone="gold">{w.rarity}</Chip>
                {w.recommendedStarFloor !== undefined && (
                  <Chip>Wants E{w.recommendedStarFloor}+</Chip>
                )}
              </div>
              <p className="text-xs text-[var(--text-muted)]">{w.reason}</p>
            </Card>
          ))}
          {advice.wheelTargets.length === 0 && (
            <p className="text-sm text-[var(--text-dim)]">
              Every best-in-slot wheel for the characters you run is already covered.
            </p>
          )}
        </div>
      )}

      {section === "lineups" && (
        <div className="space-y-2">
          {advice.metaLineups.map((l) => (
            <Card key={l.name}>
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className="font-title text-sm text-[var(--text)]">{l.name}</span>
                <span
                  className="text-[10px] uppercase tracking-wider"
                  style={{ color: REALM_COLOR[l.realm] ?? "var(--text-dim)" }}
                >
                  {l.realm}
                </span>
                {l.complete ? (
                  <Chip tone="gold">Ready to run</Chip>
                ) : (
                  <Chip>
                    {l.ownedCount}/{l.awakenerIds.length} owned
                  </Chip>
                )}
              </div>
              <p className="mb-1 text-xs text-[var(--text-muted)]">
                {l.awakenerNames.join(" · ")}
              </p>
              {l.missing.length > 0 && (
                <p className="text-xs text-[var(--danger)]">
                  Missing: {l.missing.map((m) => m.name).join(", ")}
                </p>
              )}
              {l.belowFloor.length > 0 && (
                <p className="text-xs text-[var(--gold-bright)]">
                  Under-invested:{" "}
                  {l.belowFloor.map((m) => `${m.name} (${m.current}, wants ${m.floor})`).join(", ")}
                </p>
              )}
              {l.notes && (
                <p className="mt-1 text-[11px] leading-relaxed text-[var(--text-dim)]">{l.notes}</p>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
