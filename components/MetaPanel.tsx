"use client";

/* Meta tab — inventory-driven investment and acquisition advice.

   Every recommendation here is measured against what the player already owns:
   pull targets are ranked by how much the best team they can field improves if
   that character joins it, wheel targets by how many of their fielded units
   want the wheel, and curated comps are rendered through the same TeamFormation
   card as generated ones so a meta lineup and a generated lineup look and read
   identically. Computation lives in lib/pull-advice.ts; this only renders. */

import { useEffect, useState } from "react";
import type { MetaAdvice, InvestmentStatus } from "@/lib/pull-advice";
import { useRosterStore } from "@/lib/store";
import { REALM_COLOR, RealmSigil } from "./realm";
import TeamFormation from "./TeamFormation";
import type { Catalog } from "./RosterBuilder";
import type { SlotPlan, PosseInfo } from "./FormationBoard";
import type { CharacterAssignment, Realm } from "@/lib/types";

type Section = "pulls" | "breakpoints" | "wheels" | "lineups";

const SECTIONS: [Section, string][] = [
  ["pulls", "Who to Pull"],
  ["breakpoints", "Stopping Points"],
  ["wheels", "Wheels to Chase"],
  ["lineups", "Meta Lineups"],
];

const LADDER = ["E0", "E1", "E2", "E3", "OE", "AA"] as const;

const STATUS_STYLE: Record<InvestmentStatus, { label: string; className: string }> = {
  below_floor: {
    label: "Under-invested",
    className: "border-[var(--realm-caro)]/50 bg-[var(--realm-caro)]/10 text-[var(--realm-caro)]",
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

/* Square portrait chip — the same art the roster grid uses, at list scale. */
function Portrait({
  id,
  name,
  size = 44,
  dim = false,
  onClick,
}: {
  id: string;
  name: string;
  size?: number;
  dim?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={name}
      disabled={!onClick}
      className="relative shrink-0 overflow-hidden rounded border border-[var(--border)] transition hover:border-[var(--gold)] disabled:cursor-default"
      style={{ width: size, height: size }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/assets/portraits/${id}.webp`}
        alt={name}
        loading="lazy"
        className={`h-full w-full object-cover object-top ${dim ? "opacity-40 grayscale" : ""}`}
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
        }}
      />
    </button>
  );
}

function GearIcon({ id, name }: { id: string; name: string }) {
  return (
    <span
      title={name}
      className="inline-flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded border border-[var(--border)]"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/assets/wheels/${id}.webp`}
        alt={name}
        loading="lazy"
        className="h-full w-full object-cover"
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.visibility = "hidden";
        }}
      />
    </span>
  );
}

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

/* Read-only mirror of the ladder on the inventory card, so the same shape means
   the same thing in both places. */
function Ladder({
  current,
  floor,
  breakpoints,
  owned,
  belowFloor,
}: {
  current: string;
  floor: string;
  breakpoints: string[];
  owned: boolean;
  belowFloor: boolean;
}) {
  return (
    <div className="flex items-center gap-0.5">
      {LADDER.map((slot) => {
        const isCurrent = owned && slot === current;
        const isRec = slot === floor || breakpoints.includes(slot);
        return (
          <span
            key={slot}
            title={slot === floor ? `${slot} — comfort floor` : isRec ? `${slot} — breakpoint` : slot}
            className={`rounded px-1 py-0.5 text-[10px] font-semibold leading-none ${
              isCurrent
                ? belowFloor
                  ? "bg-[var(--realm-caro)] text-black"
                  : "bg-[var(--gold)] text-[#1b150a]"
                : isRec
                  ? "border border-[var(--gold)]/60 text-[var(--gold-bright)]"
                  : "border border-transparent text-[var(--text-dim)]"
            }`}
          >
            {slot}
          </span>
        );
      })}
    </div>
  );
}

export default function MetaPanel({
  catalog,
  planFor,
  wheelMeta,
  covenantMeta,
  posseMeta,
  onOpenDetail,
}: {
  catalog: Catalog;
  planFor: (c: CharacterAssignment) => SlotPlan;
  wheelMeta?: Record<string, { name: string }>;
  covenantMeta?: Record<string, { name: string }>;
  posseMeta?: Record<string, PosseInfo>;
  onOpenDetail?: (awakenerId: string) => void;
}) {
  const roster = useRosterStore((s) => s.roster);
  const [section, setSection] = useState<Section>("pulls");
  const [advice, setAdvice] = useState<MetaAdvice | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showOwnedOnly, setShowOwnedOnly] = useState(true);

  const nameOf = (id: string) => catalog.awakeners.find((a) => a.id === id)?.name ?? id;

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
      <p className="py-10 text-center text-sm text-[var(--text-dim)]">Reading your collection…</p>
    );
  }
  if (error) return <p className="py-10 text-center text-sm text-[var(--realm-caro)]">{error}</p>;
  if (!advice) return null;

  const breakpoints = showOwnedOnly
    ? advice.breakpoints.filter((b) => b.owned)
    : advice.breakpoints;

  return (
    <div className="space-y-5">
      <p className="text-xs leading-relaxed text-[var(--text-dim)]">
        Ranked against your collection rather than in the abstract. A pull is scored by how
        much it improves the best team you could actually field, so a character who slots
        into a core you already own outranks a stronger one with nobody to play with.
      </p>

      {advice.roleGaps.length > 0 && (
        <div className="rounded-lg border border-[var(--realm-caro)]/40 bg-[var(--realm-caro)]/5 p-3">
          <div className="font-title mb-1 text-xs font-semibold uppercase tracking-wider text-[var(--realm-caro)]">
            Roster gaps
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            Nothing you own and have built covers: {advice.roleGaps.map((g) => g.label).join(", ")}.
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
        <div className="space-y-2">
          {advice.pullTargets.map((t) => (
            <Card key={t.awakenerId}>
              <div className="flex gap-3">
                <Portrait
                  id={t.awakenerId}
                  name={t.name}
                  size={64}
                  onClick={() => onOpenDetail?.(t.awakenerId)}
                />
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => onOpenDetail?.(t.awakenerId)}
                      className="font-title text-sm text-[var(--text)] hover:text-[var(--gold-bright)]"
                    >
                      {t.name}
                    </button>
                    <RealmSigil realm={t.realm as Realm} size={14} />
                    <Chip tone="gold">Tier {t.tier}</Chip>
                    <Chip>Pull to {t.entryPoint}</Chip>
                    {t.stoppingPoint && t.stoppingPoint !== t.entryPoint && (
                      <Chip>Stop at {t.stoppingPoint}</Chip>
                    )}
                    {t.delta > 0 && (
                      <span className="ml-auto text-[11px] tabular-nums text-[var(--gold-bright)]">
                        +{t.delta.toFixed(2)} team score
                      </span>
                    )}
                  </div>

                  {t.bestTeam && (
                    <div className="mb-1.5 flex items-center gap-1">
                      {t.bestTeam.awakenerIds.map((id) => (
                        <Portrait
                          key={id}
                          id={id}
                          name={nameOf(id)}
                          size={34}
                          dim={id !== t.awakenerId}
                          onClick={() => onOpenDetail?.(id)}
                        />
                      ))}
                    </div>
                  )}

                  <ul className="space-y-0.5 text-xs text-[var(--text-muted)]">
                    {t.reasons.map((r, i) => (
                      <li key={i}>· {r}</li>
                    ))}
                  </ul>
                </div>
              </div>
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
                <div className="flex gap-3">
                  <Portrait
                    id={b.awakenerId}
                    name={b.name}
                    dim={!b.owned}
                    onClick={() => onOpenDetail?.(b.awakenerId)}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => onOpenDetail?.(b.awakenerId)}
                        className="font-title text-sm text-[var(--text)] hover:text-[var(--gold-bright)]"
                      >
                        {b.name}
                      </button>
                      <RealmSigil realm={b.realm as Realm} size={14} />
                      <span
                        className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${style.className}`}
                      >
                        {style.label}
                      </span>
                      <Chip tone="gold">Tier {b.tier}</Chip>
                    </div>

                    <div className="mb-1">
                      <Ladder
                        current={b.currentSlot}
                        floor={b.viabilityFloor}
                        breakpoints={b.breakpoints}
                        owned={b.owned}
                        belowFloor={b.status === "below_floor"}
                      />
                    </div>

                    <p className="text-xs text-[var(--text-muted)]">{b.note}</p>
                    {(b.keySkillSlots.length > 0 || b.keyTalents.length > 0) && (
                      <p className="mt-1 text-[11px] text-[var(--text-dim)]">
                        {b.keySkillSlots.length > 0 &&
                          `Level first: ${b.keySkillSlots.join(", ")}. `}
                        {b.keyTalents.length > 0 &&
                          `Talents: ${b.keyTalents.map((t) => t.replace(/_/g, " ")).join(", ")}.`}
                      </p>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {section === "wheels" && (
        <div className="space-y-2">
          {advice.wheelTargets.map((w) => (
            <Card key={w.wheelId}>
              <div className="flex gap-3">
                <GearIcon id={w.wheelId} name={w.name} />
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className="font-title text-sm text-[var(--text)]">{w.name}</span>
                    <Chip tone="gold">{w.rarity}</Chip>
                    {w.recommendedStarFloor !== undefined && (
                      <Chip>Wants E{w.recommendedStarFloor}+</Chip>
                    )}
                    <span className="ml-auto flex items-center gap-1">
                      {w.wantedBy.map((u) => (
                        <Portrait
                          key={u.id}
                          id={u.id}
                          name={u.name}
                          size={28}
                          onClick={() => onOpenDetail?.(u.id)}
                        />
                      ))}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--text-muted)]">{w.reason}</p>
                </div>
              </div>
            </Card>
          ))}
          {advice.wheelTargets.length === 0 && (
            <p className="text-sm text-[var(--text-dim)]">
              Every best-in-slot wheel for the characters you field is already covered.
            </p>
          )}
        </div>
      )}

      {section === "lineups" && (
        <div className="space-y-5">
          {advice.metaLineups.map((l) => (
            <div key={l.name}>
              <div className="mb-1.5 flex flex-wrap items-center gap-2">
                <span className="font-title text-sm text-[var(--gold-bright)]">{l.name}</span>
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
                {l.missing.length > 0 && (
                  <span className="text-[11px] text-[var(--realm-caro)]">
                    Missing {l.missing.map((m) => m.name).join(", ")}
                  </span>
                )}
                {l.belowFloor.length > 0 && (
                  <span className="text-[11px] text-[var(--gold-bright)]">
                    {l.belowFloor
                      .map((m) => `${m.name} at ${m.current}, wants ${m.floor}`)
                      .join(" · ")}
                  </span>
                )}
              </div>
              <TeamFormation
                team={l.recommendation}
                awakeners={catalog.awakeners}
                planFor={planFor}
                wheelMeta={wheelMeta}
                covenantMeta={covenantMeta}
                posseMeta={posseMeta}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
