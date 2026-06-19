"use client";

import { useEffect, useMemo, useState } from "react";
import { useRosterStore } from "@/lib/store";
import type { Realm, EnlightenSlot, CharacterAssignment, TeamRecommendation } from "@/lib/types";
import type { GenerateResult } from "@/lib/generate";
import { RealmSigil, REALMS, REALM_RANK, RARITY_RANK } from "./realm";
import DetailModal, { type DetailTarget } from "./DetailModal";
import FormationBoard, { type SlotPlan } from "./FormationBoard";
import { keeperHpMultiplier } from "@/lib/stats";

const ROLE_LABEL: Record<string, string> = {
  main_dps: "Main DPS",
  sub_dps: "Sub DPS",
  embryo_gen: "Embryo generator",
  aliemus_battery: "Aliemus battery",
  vuln_applier: "Vulnerable applier",
  weak_applier: "Weakness applier",
  shielder: "Shielder",
  healer: "Healer",
  death_resist: "Death-resist support",
  str_support: "STR support",
  keyflare_support: "Keyflare support",
  card_cycler: "Card cycler",
  tentacle_enabler: "Tentacle enabler",
  leap_support: "Leap support",
  annihilation_support: "Annihilation support",
  ultra_space_manager: "Ultra-space manager",
  sacrifice_engine: "Sacrifice engine",
  birth_ritual_stacker: "Birth Ritual stacker",
  corrosion_applier: "Corrosion applier",
  strike_enabler: "Strike enabler",
  relic_gen: "Relic generator",
  poison_stacker: "Poison stacker",
};
const humanRole = (r: string) => ROLE_LABEL[r] ?? r.replace(/_/g, " ");

/* ---------------------------------------------------------------------------
   Catalog projection (sent from the server page)
--------------------------------------------------------------------------- */

export interface Catalog {
  awakeners: {
    id: string;
    name: string;
    realm: Realm;
    rarity: string;
    type?: string;
    roles?: string[];
    isDivineRealm: boolean;
    isLemurian: boolean;
  }[];
  wheels: { id: string; name: string; realm: string; rarity: string }[];
  covenants: { id: string; name: string }[];
  posses: { id: string; name: string; realm: string; hasCharacterBonus: boolean }[];
}

const ENLIGHTEN: EnlightenSlot[] = ["E0", "E1", "E2", "E3", "OE", "AA"];
/* ---------------------------------------------------------------------------
   Small UI atoms
--------------------------------------------------------------------------- */

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

function Select<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <label className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
      <span className="uppercase tracking-wider text-[var(--text-dim)]">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="rounded border border-[var(--border)] bg-[var(--panel)] px-2 py-1.5 text-sm text-[var(--text)] focus:border-[var(--gold)] focus:outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function DetailButton({ onClick }: { onClick: (e: React.MouseEvent) => void }) {
  return (
    <button
      onClick={onClick}
      title="Customize / view details"
      className="flex h-5 w-5 items-center justify-center rounded-full bg-black/55 text-[11px] leading-none text-[var(--silver)] backdrop-blur-sm transition hover:bg-black/80 hover:text-white"
    >
      ⋯
    </button>
  );
}

/* ---------------------------------------------------------------------------
   Awakener card
--------------------------------------------------------------------------- */

function AwakenerCard({
  item,
  owned,
  enlighten,
  onToggle,
  onEnlighten,
  onDetails,
}: {
  item: Catalog["awakeners"][number];
  owned: boolean;
  enlighten: EnlightenSlot;
  onToggle: () => void;
  onEnlighten: (slot: EnlightenSlot) => void;
  onDetails: () => void;
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

        {/* top-right cluster: owned tick + details */}
        <div className="absolute right-1.5 top-1.5 flex items-center gap-1">
          {owned && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--gold)] text-[11px] font-bold text-[#1b150a]">
              ✓
            </span>
          )}
          <DetailButton
            onClick={(e) => {
              e.stopPropagation();
              onDetails();
            }}
          />
        </div>

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

      {/* compact enlighten selector — only when owned */}
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

/* ---------------------------------------------------------------------------
   Generic owned-toggle tile (wheels / covenants / posses)
--------------------------------------------------------------------------- */

function GearTile({
  id,
  name,
  category,
  realm,
  owned,
  badge,
  badgeColor,
  onToggle,
  onDetails,
}: {
  id: string;
  name: string;
  category: "wheels" | "covenants" | "posses";
  realm?: string;
  owned: boolean;
  badge?: string;
  badgeColor?: string;
  onToggle: () => void;
  onDetails?: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onToggle();
      }}
      title={name}
      className={`flex cursor-pointer items-center gap-2 rounded-md border p-1.5 text-left transition ${
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
        {realm && realm !== "NEUTRAL" && (
          <div className="absolute left-0 top-0">
            <RealmSigil realm={realm} size={11} />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs text-[var(--text)]">{name}</div>
        {badge && (
          <div className="text-[10px]" style={{ color: badgeColor }}>
            {badge}
          </div>
        )}
      </div>
      {owned && <span className="text-xs text-[var(--gold)]">✓</span>}
      {onDetails && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDetails();
          }}
          title="Customize / view details"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sm text-[var(--text-dim)] hover:bg-black/30 hover:text-[var(--text)]"
        >
          ⋯
        </button>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Results
--------------------------------------------------------------------------- */

interface NameMaps {
  awk: Record<string, { name: string; realm: Realm }>;
  wheel: Record<string, string>;
  covenant: Record<string, string>;
  posse: Record<string, string>;
}

function TeamFormation({
  team,
  awakeners,
  maps,
  planFor,
}: {
  team: TeamRecommendation;
  awakeners: Catalog["awakeners"];
  maps: NameMaps;
  planFor: (c: CharacterAssignment) => SlotPlan;
}) {
  const initialSlots = useMemo(() => {
    const s: (string | null)[] = [null, null, null, null];
    team.composition.slice(0, 4).forEach((c, i) => (s[i] = c.awakenerId));
    return s;
  }, [team]);
  const initialPlans = useMemo(() => {
    const p: Record<string, SlotPlan> = {};
    for (const c of team.composition) p[c.awakenerId] = planFor(c);
    return p;
  }, [team, planFor]);

  const [slots, setSlots] = useState<(string | null)[]>(initialSlots);
  const posseName = team.posseRecommendations?.[0]
    ? maps.posse[team.posseRecommendations[0].posseId]
    : undefined;

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--panel)]/40 p-3 sm:p-4">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h3 className="font-title text-sm text-[var(--gold-bright)]">Team {team.rank}</h3>
        {team.realmNote && (
          <span className="text-xs text-[var(--realm-caro)]">{team.realmNote}</span>
        )}
      </div>
      <p className="font-display mb-3 text-[15px] leading-snug text-[var(--text)]">
        {team.compositionNote}
      </p>

      <FormationBoard
        awakeners={awakeners}
        slots={slots}
        plans={initialPlans}
        posseName={posseName}
        onChangeSlots={setSlots}
      />

      {team.investmentWarnings.length > 0 && (
        <ul className="mt-2.5 space-y-0.5 text-[11px] text-[var(--realm-chaos)]">
          {team.investmentWarnings.map((w, i) => (
            <li key={i}>• {w}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------------
   Main
--------------------------------------------------------------------------- */

type Tab = "awakeners" | "wheels" | "covenants" | "posses";
type AwakenerSort = "realm" | "name" | "rarity" | "owned";
type WheelSort = "rarity" | "realm" | "name";
type WheelRarity = "ALL" | "MYTHIC" | "SSR" | "SR" | "R" | "N";

const WHEEL_RARITY_GROUPS: { key: Exclude<WheelRarity, "ALL">; label: string }[] = [
  { key: "MYTHIC", label: "Mythic" },
  { key: "SSR", label: "SSR" },
  { key: "SR", label: "SR" },
  { key: "R", label: "R" },
  { key: "N", label: "N" },
];

/* Own all / own none control shared by every roster tab. */
function OwnControl({
  count,
  total,
  onAll,
  onNone,
}: {
  count: number;
  total: number;
  onAll: () => void;
  onNone: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-[var(--text-dim)]">
        <span className="text-[var(--text-muted)]">{count}</span> / {total}
      </span>
      <button
        onClick={onAll}
        className="rounded border border-[var(--border)] px-2 py-1 text-xs text-[var(--text-muted)] transition hover:border-[var(--gold)] hover:text-[var(--gold-bright)]"
      >
        Own all
      </button>
      <button
        onClick={onNone}
        className="rounded border border-[var(--border)] px-2 py-1 text-xs text-[var(--text-muted)] transition hover:border-[var(--realm-caro)] hover:text-[var(--realm-caro)]"
      >
        Own none
      </button>
    </div>
  );
}

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
  const setAllAwakenersOwned = useRosterStore((s) => s.setAllAwakenersOwned);
  const setAllWheelsOwned = useRosterStore((s) => s.setAllWheelsOwned);
  const setAllCovenantsOwned = useRosterStore((s) => s.setAllCovenantsOwned);
  const setAllPossesUnlocked = useRosterStore((s) => s.setAllPossesUnlocked);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    hydrate();
    setMounted(true);
  }, [hydrate]);

  const [tab, setTab] = useState<Tab>("awakeners");
  const [realmFilter, setRealmFilter] = useState<Realm | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<"single" | "dtide">("single");
  const [awakenerSort, setAwakenerSort] = useState<AwakenerSort>("realm");
  const [wheelSort, setWheelSort] = useState<WheelSort>("rarity");
  const [ownedOnly, setOwnedOnly] = useState(false);
  const [detail, setDetail] = useState<DetailTarget | null>(null);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [wheelRarity, setWheelRarity] = useState<WheelRarity>("ALL");
  const [slots, setSlots] = useState<(string | null)[]>([null, null, null, null]);
  const [plans, setPlans] = useState<Record<string, SlotPlan>>({});
  const [posseName, setPosseName] = useState<string | undefined>(undefined);
  // Slots the player placed by hand — preserved when Generate fills the board.
  const [pinned, setPinned] = useState<boolean[]>([false, false, false, false]);
  // Bumped every successful generation so the per-team boards remount with fresh state.
  const [genId, setGenId] = useState(0);
  // Top-level view: inventory customization vs team generation.
  const [view, setView] = useState<"inventory" | "teams">("teams");
  // D-Tide always fields five teams of four; these boards are independently editable.
  const [dtideSlots, setDtideSlots] = useState<(string | null)[][]>(() =>
    Array.from({ length: 5 }, () => [null, null, null, null])
  );
  const [dtidePlans, setDtidePlans] = useState<Record<string, SlotPlan>>({});
  const [dtidePosses, setDtidePosses] = useState<(string | undefined)[]>(() =>
    Array(5).fill(undefined)
  );

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
    const list = catalog.awakeners
      .filter((a) => (realmFilter === "ALL" ? true : a.realm === realmFilter))
      .filter((a) => (q ? a.name.toLowerCase().includes(q) : true))
      .filter((a) => (ownedOnly ? !!roster.awakeners[a.id]?.owned : true));
    const byName = (x: { name: string }, y: { name: string }) =>
      x.name.localeCompare(y.name);
    return [...list].sort((a, b) => {
      switch (awakenerSort) {
        case "name":
          return byName(a, b);
        case "rarity":
          return (RARITY_RANK[a.rarity] ?? 9) - (RARITY_RANK[b.rarity] ?? 9) || byName(a, b);
        case "owned": {
          const ao = roster.awakeners[a.id]?.owned ? 0 : 1;
          const bo = roster.awakeners[b.id]?.owned ? 0 : 1;
          return ao - bo || (REALM_RANK[a.realm] ?? 9) - (REALM_RANK[b.realm] ?? 9) || byName(a, b);
        }
        case "realm":
        default:
          return (REALM_RANK[a.realm] ?? 9) - (REALM_RANK[b.realm] ?? 9) || byName(a, b);
      }
    });
  }, [catalog.awakeners, realmFilter, search, ownedOnly, awakenerSort, roster]);

  const filteredWheels = useMemo(() => {
    const q = search.trim().toLowerCase();
    // Realm filter is only meaningful for SSR wheels — every other rarity is
    // realm-neutral, so applying a realm pill to them would empty the grid.
    const realmApplies = wheelRarity === "SSR" || wheelRarity === "ALL";
    const list = catalog.wheels
      .filter((w) => (wheelRarity === "ALL" ? true : w.rarity === wheelRarity))
      .filter((w) =>
        realmFilter === "ALL" || !realmApplies ? true : w.realm === realmFilter
      )
      .filter((w) => (q ? w.name.toLowerCase().includes(q) : true))
      .filter((w) => (ownedOnly ? !!roster.wheels[w.id]?.owned : true));
    const byName = (x: { name: string }, y: { name: string }) =>
      x.name.localeCompare(y.name);
    return [...list].sort((a, b) => {
      switch (wheelSort) {
        case "name":
          return byName(a, b);
        case "realm":
          return (REALM_RANK[a.realm] ?? 9) - (REALM_RANK[b.realm] ?? 9) || byName(a, b);
        case "rarity":
        default:
          return (
            (RARITY_RANK[a.rarity] ?? 9) - (RARITY_RANK[b.rarity] ?? 9) ||
            (REALM_RANK[a.realm] ?? 9) - (REALM_RANK[b.realm] ?? 9) ||
            byName(a, b)
          );
      }
    });
  }, [catalog.wheels, realmFilter, search, ownedOnly, wheelSort, wheelRarity, roster]);

  const filteredCovenants = useMemo(() => {
    const q = search.trim().toLowerCase();
    return catalog.covenants
      .filter((c) => (q ? c.name.toLowerCase().includes(q) : true))
      .filter((c) => (ownedOnly ? !!roster.covenants[c.id]?.owned : true))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [catalog.covenants, search, ownedOnly, roster]);

  const filteredPosses = useMemo(() => {
    const q = search.trim().toLowerCase();
    return catalog.posses
      .filter((p) => (realmFilter === "ALL" ? true : p.realm === realmFilter))
      .filter((p) => (q ? p.name.toLowerCase().includes(q) : true))
      .filter((p) => (ownedOnly ? !!roster.posses[p.id]?.unlocked : true))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [catalog.posses, realmFilter, search, ownedOnly, roster]);

  async function generate() {
    setGenerating(true);
    setError(null);
    try {
      const pinnedIds = slots.filter((id, i): id is string => !!id && pinned[i]);
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          roster,
          mode,
          options:
            mode === "single"
              ? { maxResults: 3, pinnedIds: pinnedIds.length ? pinnedIds : undefined }
              : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Generation failed.");
        setResult(null);
      } else {
        const gen = json as GenerateResult;
        setResult(gen);
        setGenId((g) => g + 1);
        setError(null);
        if (mode === "dtide") applyDtide(gen);
        else applyTeamToFormation(gen);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error.");
    } finally {
      setGenerating(false);
    }
  }

  // Map the AI's top-ranked team onto the editable formation template. The
  // recommendation simply "fills out" the four deploy slots; users can still
  // swap anyone afterward via the board's own picker.
  // Build a SlotPlan from one AI character assignment (shared by the working
  // board and the per-team boards below).
  function planFromAssignment(c: CharacterAssignment): SlotPlan {
    return {
      role: humanRole(c.roleInThisTeam),
      blurb: c.skillNote || c.talentNote || undefined,
      wheelNames: c.wheelAssignments
        .map((w) => maps.wheel[w.wheelId])
        .filter((n): n is string => !!n),
      covenantName: maps.covenant[c.covenantRecommendation?.covenantId] ?? undefined,
    };
  }

  // The board calls this on every manual deploy / clear. A slot the player sets
  // by hand becomes pinned; clearing a slot unpins it. Generate then keeps the
  // pinned slots and only fills the rest.
  function handleSlotsChange(next: (string | null)[]) {
    setPinned((prev) =>
      next.map((id, i) => (id ? (slots[i] !== id ? true : prev[i]) : false))
    );
    setSlots(next);
  }

  function applyTeamToFormation(gen: GenerateResult) {
    const top = gen.teams?.[0];
    if (!top) return;
    const nextPlans: Record<string, SlotPlan> = { ...plans };
    // Keep whatever the player pinned.
    const result: (string | null)[] = slots.map((id, i) => (pinned[i] ? id : null));
    const taken = new Set(result.filter((x): x is string => !!x));
    // Fill the open slots from the recommendation, skipping anyone already kept.
    const queue = top.composition.filter((c) => !taken.has(c.awakenerId));
    let qi = 0;
    for (let i = 0; i < 4; i++) {
      if (result[i]) continue;
      const c = queue[qi++];
      if (!c) continue;
      result[i] = c.awakenerId;
      nextPlans[c.awakenerId] = planFromAssignment(c);
    }
    setSlots(result);
    setPlans(nextPlans);
    setPosseName(
      top.posseRecommendations?.[0]
        ? maps.posse[top.posseRecommendations[0].posseId]
        : undefined
    );
  }

  // Fill the five D-Tide boards from a generated lineup.
  function applyDtide(gen: GenerateResult) {
    const next = Array.from({ length: 5 }, () => [null, null, null, null] as (string | null)[]);
    const nextPlans: Record<string, SlotPlan> = {};
    const posses: (string | undefined)[] = Array(5).fill(undefined);
    gen.teams.slice(0, 5).forEach((t, ti) => {
      t.composition.slice(0, 4).forEach((c, si) => {
        next[ti][si] = c.awakenerId;
        nextPlans[c.awakenerId] = planFromAssignment(c);
      });
      posses[ti] = t.posseRecommendations?.[0]
        ? maps.posse[t.posseRecommendations[0].posseId]
        : undefined;
    });
    setDtideSlots(next);
    setDtidePlans(nextPlans);
    setDtidePosses(posses);
  }

  // Drives the Own all / Own none control for whichever tab is active. It acts
  // on the currently filtered set, so a realm or rarity filter narrows what the
  // bulk buttons touch.
  const ownControl = useMemo(() => {
    if (tab === "wheels") {
      const ids = filteredWheels.map((w) => w.id);
      return {
        total: ids.length,
        count: ids.filter((id) => roster.wheels[id]?.owned).length,
        onAll: () => setAllWheelsOwned(ids, true),
        onNone: () => setAllWheelsOwned(ids, false),
      };
    }
    if (tab === "covenants") {
      const ids = filteredCovenants.map((c) => c.id);
      return {
        total: ids.length,
        count: ids.filter((id) => roster.covenants[id]?.owned).length,
        onAll: () => setAllCovenantsOwned(ids, true),
        onNone: () => setAllCovenantsOwned(ids, false),
      };
    }
    if (tab === "posses") {
      const ids = filteredPosses.map((p) => p.id);
      return {
        total: ids.length,
        count: ids.filter((id) => roster.posses[id]?.unlocked).length,
        onAll: () => setAllPossesUnlocked(ids, true),
        onNone: () => setAllPossesUnlocked(ids, false),
      };
    }
    const ids = filteredAwakeners.map((a) => a.id);
    return {
      total: ids.length,
      count: ids.filter((id) => roster.awakeners[id]?.owned).length,
      onAll: () => setAllAwakenersOwned(ids, true),
      onNone: () => setAllAwakenersOwned(ids, false),
    };
  }, [
    tab,
    filteredAwakeners,
    filteredWheels,
    filteredCovenants,
    filteredPosses,
    roster,
    setAllAwakenersOwned,
    setAllWheelsOwned,
    setAllCovenantsOwned,
    setAllPossesUnlocked,
  ]);

  // Realm filter applies on awakeners and posses always, and on wheels only
  // when viewing SSR (the one wheel rarity that carries a realm) or All.
  const showRealmFilter =
    tab === "awakeners" ||
    tab === "posses" ||
    (tab === "wheels" && (wheelRarity === "ALL" || wheelRarity === "SSR"));

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

      {/* Top-level view tabs */}
      <nav className="mb-5 flex items-center gap-2">
        {(
          [
            ["teams", "Teams"],
            ["inventory", "Inventory"],
          ] as ["inventory" | "teams", string][]
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setView(key)}
            className={`font-title rounded-lg border px-4 py-2 text-xs font-semibold uppercase tracking-wider transition ${
              view === key
                ? "border-[var(--gold)] bg-[var(--gold)]/10 text-[var(--gold-bright)]"
                : "border-[var(--border)] text-[var(--text-dim)] hover:border-[var(--border-bright)] hover:text-[var(--text-muted)]"
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      {view === "teams" && (
        <>
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

      {/* Lineup — single working board, or five D-Tide boards */}
      {mode === "single" ? (
        <section className="mb-6">
          <FormationBoard
            title="Your Lineup"
            awakeners={catalog.awakeners}
            slots={slots}
            plans={plans}
            posseName={posseName}
            onChangeSlots={handleSlotsChange}
          />
          {pinned.some(Boolean) && (
            <p className="mt-1.5 text-[11px] text-[var(--text-dim)]">
              Pinned characters are kept when you generate — only the empty slots get filled.
            </p>
          )}
        </section>
      ) : (
        <section className="mb-6 space-y-4">
          <p className="text-[11px] text-[var(--text-dim)]">
            D-Tide fields five teams with no unit or wheel shared between them. Generate fills all
            five; you can edit any board afterward.
          </p>
          {dtideSlots.map((s, i) => (
            <FormationBoard
              key={i}
              title={`Team ${i + 1}`}
              awakeners={catalog.awakeners}
              slots={s}
              plans={dtidePlans}
              posseName={dtidePosses[i]}
              onChangeSlots={(n) =>
                setDtideSlots((prev) => prev.map((x, xi) => (xi === i ? n : x)))
              }
            />
          ))}
        </section>
      )}

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
              {result.teams.length > 0 && mode === "single" && (
                <div className="space-y-5">
                  <h2 className="font-title text-xs uppercase tracking-wider text-[var(--text-dim)]">
                    Alternate Teams
                  </h2>
                  {result.teams.map((t) => (
                    <TeamFormation
                      key={`${genId}-${t.rank}`}
                      team={t}
                      awakeners={catalog.awakeners}
                      maps={maps}
                      planFor={planFromAssignment}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </section>
      )}
        </>
      )}

      {view === "inventory" && (
        <>
      {/* Keeper level */}
      <section className="mb-5 rounded-xl border border-[var(--border)] bg-[var(--bg-2)]/85 p-3">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <label className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
            <span className="uppercase tracking-wider text-[var(--text-dim)]">Keeper Lv</span>
            <input
              type="number"
              min={1}
              max={100}
              value={roster.keeperLevel}
              onChange={(e) =>
                setKeeperLevel(Math.max(1, Math.min(100, Number(e.target.value) || 1)))
              }
              className="w-16 rounded border border-[var(--border)] bg-[var(--panel)] px-2 py-1.5 text-sm text-[var(--text)] focus:border-[var(--gold)] focus:outline-none"
            />
          </label>
          <span className="text-xs text-[var(--text-dim)]">
            Max HP ×
            <span className="ml-1 tabular-nums text-[var(--gold-bright)]">
              {keeperHpMultiplier(roster.keeperLevel).toFixed(2)}
            </span>
          </span>
          <span className="text-xs text-[var(--text-dim)]">
            Caps character level at
            <span className="ml-1 tabular-nums text-[var(--gold-bright)]">
              {Math.min(roster.keeperLevel, 90)}
            </span>
            <span className="ml-1">(before dupe cap)</span>
          </span>
        </div>
      </section>


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

      {/* Sort + filter row */}
      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        {tab === "awakeners" && (
          <Select
            label="Sort"
            value={awakenerSort}
            onChange={setAwakenerSort}
            options={[
              { value: "realm", label: "Realm" },
              { value: "name", label: "Name" },
              { value: "rarity", label: "Rarity" },
              { value: "owned", label: "Owned first" },
            ]}
          />
        )}
        {tab === "wheels" && (
          <Select
            label="Sort"
            value={wheelSort}
            onChange={setWheelSort}
            options={[
              { value: "rarity", label: "Rarity → Realm" },
              { value: "realm", label: "Realm" },
              { value: "name", label: "Name" },
            ]}
          />
        )}
        {tab === "wheels" && (
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setWheelRarity("ALL")}
              className={`rounded-full border px-3 py-1 text-xs transition ${
                wheelRarity === "ALL"
                  ? "border-[var(--silver)] text-[var(--text)]"
                  : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border-bright)]"
              }`}
            >
              All
            </button>
            {WHEEL_RARITY_GROUPS.map((g) => (
              <button
                key={g.key}
                onClick={() => setWheelRarity(g.key)}
                className={`rounded-full border px-3 py-1 text-xs transition ${
                  wheelRarity === g.key
                    ? "border-[var(--gold)] text-[var(--gold-bright)]"
                    : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border-bright)]"
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>
        )}

        <label className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
          <input
            type="checkbox"
            checked={ownedOnly}
            onChange={(e) => setOwnedOnly(e.target.checked)}
            className="accent-[var(--gold)]"
          />
          Owned only
        </label>

        {showRealmFilter && (
          <div className="flex flex-wrap gap-1.5">
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

        <div className="ml-auto">
          <OwnControl
            count={ownControl.count}
            total={ownControl.total}
            onAll={ownControl.onAll}
            onNone={ownControl.onNone}
          />
        </div>
      </div>

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
                onDetails={() =>
                  setDetail({
                    kind: "awakener",
                    id: a.id,
                    name: a.name,
                    realm: a.realm,
                    rarity: a.rarity,
                    isDivineRealm: a.isDivineRealm,
                    isLemurian: a.isLemurian,
                  })
                }
              />
            );
          })}
        </div>
      )}

      {/* Wheels */}
      {tab === "wheels" && (() => {
        const renderTile = (w: (typeof filteredWheels)[number]) => {
          const owned = mounted ? !!roster.wheels[w.id]?.owned : false;
          return (
            <GearTile
              key={w.id}
              id={w.id}
              name={w.name}
              category="wheels"
              realm={w.realm}
              owned={owned}
              badge={w.rarity}
              badgeColor="var(--text-dim)"
              onToggle={() => setWheelOwned(w.id, !owned)}
              onDetails={() =>
                setDetail({ kind: "wheel", id: w.id, name: w.name, realm: w.realm, rarity: w.rarity })
              }
            />
          );
        };
        const grouped = wheelSort === "rarity" && wheelRarity === "ALL";
        if (!grouped) {
          return (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredWheels.map(renderTile)}
            </div>
          );
        }
        return (
          <div className="space-y-6">
            {WHEEL_RARITY_GROUPS.map((g) => {
              const inGroup = filteredWheels.filter((w) => w.rarity === g.key);
              if (inGroup.length === 0) return null;
              return (
                <div key={g.key}>
                  <div className="mb-2 flex items-center gap-2">
                    <h4 className="font-title text-xs uppercase tracking-wider text-[var(--gold-bright)]">
                      {g.label}
                    </h4>
                    <span className="text-xs text-[var(--text-dim)]">{inGroup.length}</span>
                    <div className="gold-rule ml-1 flex-1" />
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {inGroup.map(renderTile)}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* Covenants */}
      {tab === "covenants" && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredCovenants.map((c) => {
            const owned = mounted ? !!roster.covenants[c.id]?.owned : false;
            return (
              <GearTile
                key={c.id}
                id={c.id}
                name={c.name}
                category="covenants"
                owned={owned}
                onToggle={() => setCovenantOwned(c.id, !owned)}
                onDetails={() => setDetail({ kind: "covenant", id: c.id, name: c.name })}
              />
            );
          })}
        </div>
      )}

      {/* Posses */}
      {tab === "posses" && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredPosses.map((p) => {
            const unlocked = mounted ? !!roster.posses[p.id]?.unlocked : false;
            return (
              <GearTile
                key={p.id}
                id={p.id}
                name={p.name}
                category="posses"
                realm={p.realm}
                owned={unlocked}
                badge={p.hasCharacterBonus ? "Character bonus" : undefined}
                badgeColor="var(--gold)"
                onToggle={() => setPosseUnlocked(p.id, !unlocked)}
              />
            );
          })}
        </div>
      )}
        </>
      )}

      {detail && <DetailModal target={detail} onClose={() => setDetail(null)} />}
    </main>
  );
}