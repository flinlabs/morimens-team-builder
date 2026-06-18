"use client";

import { useEffect, useMemo, useState } from "react";
import { useRosterStore } from "@/lib/store";
import type { Realm, EnlightenSlot } from "@/lib/types";
import type { GenerateResult } from "@/lib/generate";

export interface Catalog {
  awakeners: {
    id: string;
    name: string;
    realm: Realm;
    rarity: string;
    isDivineRealm: boolean;
    isLemurian: boolean;
  }[];
  wheels: { id: string; name: string; rarity: string }[];
  covenants: { id: string; name: string }[];
  posses: { id: string; name: string; realm: string; hasCharacterBonus: boolean }[];
}

// Realm system — sigil + colour, the visual through-line
const REALMS: { key: Realm; label: string; color: string }[] = [
  { key: "CHAOS", label: "Chaos", color: "var(--realm-chaos)" },
  { key: "CARO", label: "Caro", color: "var(--realm-caro)" },
  { key: "AEQUOR", label: "Aequor", color: "var(--realm-aequor)" },
  { key: "ULTRA", label: "Ultra", color: "var(--realm-ultra)" },
];

const REALM_COLOR: Record<string, string> = {
  CHAOS: "var(--realm-chaos)",
  CARO: "var(--realm-caro)",
  AEQUOR: "var(--realm-aequor)",
  ULTRA: "var(--realm-ultra)",
};

function RealmSigil({ realm, size = 18 }: { realm: Realm; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "currentColor",
    style: { color: REALM_COLOR[realm] },
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
  }
}

// Small UI atoms
function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded-md border border-[var(--border)] bg-[var(--bg-2)] p-0.5">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className={`rounded px-3 py-1.5 text-sm transition-colors ${
              active
                ? "bg-[var(--panel-2)] text-[var(--text)] shadow-sm"
                : "text-[var(--text-muted)] hover:text-[var(--text)]"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

const ENLIGHTEN: EnlightenSlot[] = ["E0", "E1", "E2", "E3", "OE", "AA"];
const WHEEL_TIER_LABEL: Record<string, string> = {
  BIS_SSR: "BiS",
  ALT_SSR: "Alt SSR",
  BIS_SR: "BiS SR",
  GOOD: "Good",
  FALLBACK: "Target",
};

// Awakener card
function AwakenerCard({
  item,
  owned,
  enlighten,
  onToggle,
  onEnlighten,
}: {
  item: Catalog["awakeners"][number];
  owned: boolean;
  enlighten: EnlightenSlot;
  onToggle: () => void;
  onEnlighten: (slot: EnlightenSlot) => void;
}) {
  return (
    <div
      onClick={onToggle}
      className={`awk-card group relative cursor-pointer overflow-hidden rounded-lg border bg-[var(--panel)] ${
        owned
          ? "border-[var(--gold)] shadow-[0_0_0_1px_rgba(198,163,82,0.25)]"
          : "border-[var(--border)] hover:border-[var(--border-bright)]"
      }`}
    >
      <div className="relative aspect-[3/4] overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/assets/portraits/${item.id}.webp`}
          alt={item.name}
          loading="lazy"
          className={`h-full w-full object-cover object-top transition ${
            owned ? "" : "opacity-45 grayscale group-hover:opacity-70"
          }`}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/30" />

        {/* realm sigil */}
        <div className="absolute left-1.5 top-1.5 rounded bg-black/45 p-1 backdrop-blur-sm">
          <RealmSigil realm={item.realm} size={16} />
        </div>

        {/* owned tick */}
        {owned && (
          <div className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--gold)] text-[11px] font-bold text-[#1b150a]">
            ✓
          </div>
        )}

        {/* divine / lemurian tag */}
        {(item.isDivineRealm || item.isLemurian) && (
          <div className="absolute bottom-9 left-1.5 rounded bg-black/55 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-[var(--silver)] backdrop-blur-sm">
            {item.isDivineRealm ? "Divine" : "Lemurian"}
          </div>
        )}

        <div className="absolute inset-x-0 bottom-0 px-2 pb-1.5">
          <div className="font-display truncate text-[15px] font-semibold leading-tight text-white">
            {item.name}
          </div>
        </div>
      </div>

      {/* enlighten selector — only when owned */}
      {owned && (
        <div className="flex items-center gap-1 border-t border-[var(--border)] bg-[var(--bg-2)] px-2 py-1.5">
          <span className="text-[10px] uppercase tracking-wider text-[var(--text-dim)]">
            Enl.
          </span>
          <select
            value={enlighten}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => onEnlighten(e.target.value as EnlightenSlot)}
            className="ml-auto rounded border border-[var(--border)] bg-[var(--panel)] px-1.5 py-0.5 text-xs text-[var(--text)] focus:border-[var(--gold)] focus:outline-none"
          >
            {ENLIGHTEN.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

// Generic owned-toggle tile (wheels / covenants / posses)
function GearTile({
  id,
  name,
  category,
  owned,
  badge,
  badgeColor,
  onToggle,
}: {
  id: string;
  name: string;
  category: "wheels" | "covenants" | "posses";
  owned: boolean;
  badge?: string;
  badgeColor?: string;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      title={name}
      className={`flex items-center gap-2 rounded-md border p-1.5 text-left transition ${
        owned
          ? "border-[var(--gold)] bg-[var(--panel-2)]"
          : "border-[var(--border)] bg-[var(--panel)] hover:border-[var(--border-bright)]"
      }`}
    >
      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded bg-[var(--bg-2)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/assets/${category}/${id}.webp`}
          alt={name}
          loading="lazy"
          className={`h-full w-full object-cover ${owned ? "" : "opacity-50 grayscale"}`}
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs text-[var(--text)]">{name}</div>
        {badge && (
          <div className="text-[10px]" style={{ color: badgeColor }}>
            {badge}
          </div>
        )}
      </div>
      {owned && <span className="pr-1 text-xs text-[var(--gold)]">✓</span>}
    </button>
  );
}

// Results
interface NameMaps {
  awk: Record<string, { name: string; realm: Realm }>;
  wheel: Record<string, string>;
  covenant: Record<string, string>;
  posse: Record<string, string>;
}

function TeamCard({
  team,
  maps,
}: {
  team: GenerateResult["teams"][number];
  maps: NameMaps;
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--panel)]/70 p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h3 className="font-title text-sm text-[var(--gold-bright)]">
          Team {team.rank}
        </h3>
        {team.realmNote && (
          <span className="text-xs text-[var(--realm-caro)]">{team.realmNote}</span>
        )}
      </div>

      <p className="font-display mb-3 text-[15px] text-[var(--text)]">
        {team.compositionNote}
      </p>

      <div className="grid gap-2 sm:grid-cols-2">
        {team.composition.map((c) => {
          const meta = maps.awk[c.awakenerId];
          return (
            <div
              key={c.awakenerId}
              className="flex gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-2)] p-2"
            >
              <div className="relative h-16 w-12 shrink-0 overflow-hidden rounded bg-[var(--panel)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/assets/portraits/${c.awakenerId}.webp`}
                  alt={meta?.name ?? c.awakenerId}
                  loading="lazy"
                  className="h-full w-full object-cover object-top"
                />
                {meta && (
                  <div className="absolute left-0.5 top-0.5">
                    <RealmSigil realm={meta.realm} size={12} />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-display text-sm font-semibold text-[var(--text)]">
                    {meta?.name ?? c.awakenerId}
                  </span>
                  <span className="text-[10px] uppercase tracking-wide text-[var(--text-dim)]">
                    {c.roleInThisTeam.replace(/_/g, " ")}
                  </span>
                </div>
                <div className="mt-1 space-y-0.5 text-[var(--text-muted)]">
                  {c.wheelAssignments.map((w, i) => (
                    <div key={i} className="flex justify-between gap-2">
                      <span className="truncate">{maps.wheel[w.wheelId] ?? w.wheelId}</span>
                      <span
                        className={`shrink-0 ${
                          w.tier === "FALLBACK"
                            ? "text-[var(--text-dim)]"
                            : "text-[var(--realm-aequor)]"
                        }`}
                      >
                        {WHEEL_TIER_LABEL[w.tier] ?? w.tier}
                      </span>
                    </div>
                  ))}
                  <div className="flex justify-between gap-2">
                    <span className="truncate">
                      {maps.covenant[c.covenantRecommendation.covenantId] ??
                        "—"}
                    </span>
                    <span className="shrink-0 text-[var(--text-dim)]">
                      {c.covenantRecommendation.acquisitionNote ? "target" : "covenant"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* posses */}
      {team.posseRecommendations.length > 0 && (
        <div className="mt-3">
          <div className="mb-1 text-[10px] uppercase tracking-wider text-[var(--text-dim)]">
            Posse
          </div>
          <div className="flex flex-wrap gap-1.5">
            {team.posseRecommendations.slice(0, 4).map((p) => (
              <span
                key={p.posseId}
                className={`rounded-full border px-2 py-0.5 text-[11px] ${
                  p.priority === "anchor"
                    ? "border-[var(--gold)] text-[var(--gold-bright)]"
                    : "border-[var(--border)] text-[var(--text-muted)]"
                }`}
                title={p.reason}
              >
                {maps.posse[p.posseId] ?? p.posseId}
                {p.priority === "anchor" ? " ★" : ""}
              </span>
            ))}
          </div>
        </div>
      )}

      {team.investmentWarnings.length > 0 && (
        <ul className="mt-3 space-y-0.5 text-[11px] text-[var(--realm-chaos)]">
          {team.investmentWarnings.map((w, i) => (
            <li key={i}>• {w}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Main
type Tab = "awakeners" | "wheels" | "covenants" | "posses";

export default function RosterBuilder({ catalog }: { catalog: Catalog }) {
  const roster = useRosterStore((s) => s.roster);
  const hydrate = useRosterStore((s) => s.hydrate);
  const setAwakenerOwned = useRosterStore((s) => s.setAwakenerOwned);
  const setEnlightenLevel = useRosterStore((s) => s.setEnlightenLevel);
  const setWheelOwned = useRosterStore((s) => s.setWheelOwned);
  const setCovenantOwned = useRosterStore((s) => s.setCovenantOwned);
  const setPosseUnlocked = useRosterStore((s) => s.setPosseUnlocked);
  const setArcRuleset = useRosterStore((s) => s.setArcRuleset);
  const setKeeperLevel = useRosterStore((s) => s.setKeeperLevel);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    hydrate();
    setMounted(true);
  }, [hydrate]);

  const [tab, setTab] = useState<Tab>("awakeners");
  const [realmFilter, setRealmFilter] = useState<Realm | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<"single" | "dtide">("single");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const maps: NameMaps = useMemo(() => {
    const awk: NameMaps["awk"] = {};
    for (const a of catalog.awakeners) awk[a.id] = { name: a.name, realm: a.realm };
    const wheel: Record<string, string> = {};
    for (const w of catalog.wheels) wheel[w.id] = w.name;
    const covenant: Record<string, string> = {};
    for (const c of catalog.covenants) covenant[c.id] = c.name;
    const posse: Record<string, string> = {};
    for (const p of catalog.posses) posse[p.id] = p.name;
    return { awk, wheel, covenant, posse };
  }, [catalog]);

  const ownedCount = mounted
    ? catalog.awakeners.filter((a) => roster.awakeners[a.id]?.owned).length
    : 0;

  const filteredAwakeners = useMemo(() => {
    const q = search.trim().toLowerCase();
    return catalog.awakeners
      .filter((a) => (realmFilter === "ALL" ? true : a.realm === realmFilter))
      .filter((a) => (q ? a.name.toLowerCase().includes(q) : true))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [catalog.awakeners, realmFilter, search]);

  const gearList = useMemo(() => {
    const q = search.trim().toLowerCase();
    const src =
      tab === "wheels"
        ? catalog.wheels
        : tab === "covenants"
        ? catalog.covenants
        : tab === "posses"
        ? catalog.posses
        : [];
    return src
      .filter((x) => (q ? x.name.toLowerCase().includes(q) : true))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [tab, catalog, search]);

  async function generate() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          roster,
          mode,
          options: mode === "single" ? { maxResults: 3 } : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Generation failed.");
        setResult(null);
      } else {
        setResult(json as GenerateResult);
        setError(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error.");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <main className="mx-auto max-w-[1400px] px-4 pb-16 pt-6 sm:px-6">
      {/* Header */}
      <header className="mb-5 flex items-center justify-between">
        <div>
          <div className="font-title text-[11px] uppercase tracking-[0.35em] text-[var(--gold)]">
            Morimens
          </div>
          <h1 className="font-display text-3xl font-semibold leading-none text-[var(--text)]">
            Team Builder
          </h1>
        </div>
        <div className="font-display text-right text-xs italic text-[var(--text-dim)]">
          consult the Silver Key
        </div>
      </header>

      {/* Controls */}
      <section className="sticky top-0 z-20 mb-5 rounded-xl border border-[var(--border)] bg-[var(--bg-2)]/85 p-3 backdrop-blur-md">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <label className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <span className="uppercase tracking-wider text-[var(--text-dim)]">Arc</span>
            <Segmented
              value={roster.settings.arcRuleset}
              onChange={(v) => setArcRuleset(v)}
              options={[
                { value: "FADED_LEGACY", label: "Faded Legacy" },
                { value: "ASTRAL_REIGN", label: "Astral Reign" },
              ]}
            />
          </label>

          <label className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <span className="uppercase tracking-wider text-[var(--text-dim)]">Mode</span>
            <Segmented
              value={mode}
              onChange={(v) => setMode(v)}
              options={[
                { value: "single", label: "Single Team" },
                { value: "dtide", label: "D-Tide ×5" },
              ]}
            />
          </label>

          <label className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <span className="uppercase tracking-wider text-[var(--text-dim)]">Keeper Lv</span>
            <input
              type="number"
              min={1}
              max={80}
              value={roster.keeperLevel}
              onChange={(e) => setKeeperLevel(Number(e.target.value) || 1)}
              className="w-16 rounded border border-[var(--border)] bg-[var(--panel)] px-2 py-1.5 text-sm text-[var(--text)] focus:border-[var(--gold)] focus:outline-none"
            />
          </label>

          <div className="ml-auto flex items-center gap-4">
            <span className="text-sm text-[var(--text-muted)]">
              <span className="font-semibold text-[var(--text)]">{ownedCount}</span>
              <span className="text-[var(--text-dim)]"> / {catalog.awakeners.length} owned</span>
            </span>
            <button
              onClick={generate}
              disabled={generating || ownedCount < 4}
              className="btn-key font-title rounded-md px-5 py-2 text-sm font-semibold uppercase tracking-wider"
            >
              {generating ? "Consulting…" : "Generate Teams"}
            </button>
          </div>
        </div>
        {ownedCount < 4 && mounted && (
          <p className="mt-2 text-xs text-[var(--text-dim)]">
            Mark at least 4 owned awakeners to generate a team.
          </p>
        )}
      </section>

      {/* Results */}
      {(result || error) && (
        <section className="mb-6">
          {error && (
            <div className="rounded-lg border border-[var(--realm-caro)]/50 bg-[var(--realm-caro)]/10 p-3 text-sm text-[var(--realm-caro)]">
              {error}
            </div>
          )}
          {result && (
            <>
              {result.meta.warnings.length > 0 && (
                <ul className="mb-3 space-y-1 text-xs text-[var(--realm-chaos)]">
                  {result.meta.warnings.map((w, i) => (
                    <li key={i}>• {w}</li>
                  ))}
                </ul>
              )}
              <div className="grid gap-4 lg:grid-cols-2">
                {result.teams.map((t) => (
                  <TeamCard key={t.rank} team={t} maps={maps} />
                ))}
              </div>
            </>
          )}
        </section>
      )}

      {/* Roster tabs */}
      <nav className="mb-3 flex items-center gap-1 border-b border-[var(--border)]">
        {(
          [
            ["awakeners", "Awakeners"],
            ["wheels", "Wheels"],
            ["covenants", "Covenants"],
            ["posses", "Posses"],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`font-title -mb-px border-b-2 px-3 py-2 text-xs uppercase tracking-wider transition-colors ${
              tab === key
                ? "border-[var(--gold)] text-[var(--gold-bright)]"
                : "border-transparent text-[var(--text-dim)] hover:text-[var(--text-muted)]"
            }`}
          >
            {label}
          </button>
        ))}
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search…"
          className="ml-auto mb-1.5 w-40 rounded border border-[var(--border)] bg-[var(--panel)] px-3 py-1.5 text-sm text-[var(--text)] placeholder-[var(--text-dim)] focus:border-[var(--gold)] focus:outline-none"
        />
      </nav>

      {/* Realm filter (awakeners only) */}
      {tab === "awakeners" && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          <button
            onClick={() => setRealmFilter("ALL")}
            className={`rounded-full border px-3 py-1 text-xs transition ${
              realmFilter === "ALL"
                ? "border-[var(--silver)] text-[var(--text)]"
                : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border-bright)]"
            }`}
          >
            All Realms
          </button>
          {REALMS.map((r) => (
            <button
              key={r.key}
              onClick={() => setRealmFilter(r.key)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition ${
                realmFilter === r.key
                  ? "text-[var(--text)]"
                  : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border-bright)]"
              }`}
              style={realmFilter === r.key ? { borderColor: r.color } : undefined}
            >
              <RealmSigil realm={r.key} size={14} />
              {r.label}
            </button>
          ))}
        </div>
      )}

      {/* Awakener grid */}
      {tab === "awakeners" && (
        <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
          {filteredAwakeners.map((a) => {
            const entry = roster.awakeners[a.id];
            return (
              <AwakenerCard
                key={a.id}
                item={a}
                owned={mounted ? !!entry?.owned : false}
                enlighten={(entry?.enlightenSlot as EnlightenSlot) ?? "E0"}
                onToggle={() => setAwakenerOwned(a.id, !entry?.owned)}
                onEnlighten={(slot) => setEnlightenLevel(a.id, slot, entry?.enlightenCopies ?? 0)}
              />
            );
          })}
        </div>
      )}

      {/* Gear grids */}
      {tab !== "awakeners" && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {gearList.map((x) => {
            if (tab === "wheels") {
              const owned = mounted ? !!roster.wheels[x.id]?.owned : false;
              return (
                <GearTile
                  key={x.id}
                  id={x.id}
                  name={x.name}
                  category="wheels"
                  owned={owned}
                  onToggle={() => setWheelOwned(x.id, !owned)}
                />
              );
            }
            if (tab === "covenants") {
              const owned = mounted ? !!roster.covenants[x.id]?.owned : false;
              return (
                <GearTile
                  key={x.id}
                  id={x.id}
                  name={x.name}
                  category="covenants"
                  owned={owned}
                  onToggle={() => setCovenantOwned(x.id, !owned)}
                />
              );
            }
            // posses
            const p = x as Catalog["posses"][number];
            const unlocked = mounted ? !!roster.posses[p.id]?.unlocked : false;
            return (
              <GearTile
                key={p.id}
                id={p.id}
                name={p.name}
                category="posses"
                owned={unlocked}
                badge={p.hasCharacterBonus ? "Character bonus" : undefined}
                badgeColor="var(--gold)"
                onToggle={() => setPosseUnlocked(p.id, !unlocked)}
              />
            );
          })}
        </div>
      )}
    </main>
  );
}