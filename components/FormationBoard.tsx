"use client";

import React, { useMemo, useState } from "react";
import { useRosterStore } from "@/lib/store";
import type { Realm, EnlightenSlot } from "@/lib/types";
import { RealmSigil, REALM_COLOR, REALM_RANK } from "./realm";
import { toTotal, overEnlighten, ENLIGHTEN_MILESTONES } from "@/lib/enlighten";

/* ---------------------------------------------------------------------------
   Formation board — the in-game Lineup screen, but editable.

   Four deploy slots the player fills by hand; "Generate" simply fills the same
   template. Each occupied slot mirrors the game card (portrait, level, enlighten
   diamonds, skill + talent rows, two wheel slots) and adds a role + "what they
   bring" line. A posse bar sits beneath the four slots.
--------------------------------------------------------------------------- */

export interface SlotPlan {
  role?: string;
  blurb?: string;
  wheelNames?: string[];
  covenantName?: string;
}

interface AwkLite {
  id: string;
  name: string;
  realm: Realm;
  rarity: string;
  type?: string;
  roles?: string[];
}

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

function humanRole(r: string): string {
  return ROLE_LABEL[r] ?? r.replace(/_/g, " ");
}

/* Enlighten diamonds — E1..AA filled by milestone, then a +N over badge. */
function Diamonds({ slot, copies }: { slot: EnlightenSlot; copies: number }) {
  const total = toTotal(slot, copies);
  const over = overEnlighten(total);
  const named = ENLIGHTEN_MILESTONES.filter((m) => m.slot !== "E0");
  return (
    <span className="inline-flex items-center gap-0.5">
      {named.map((m) => (
        <span
          key={m.slot}
          className="text-[9px] leading-none"
          style={{ color: total >= m.total ? "var(--gold-bright)" : "var(--border-bright)" }}
        >
          ◆
        </span>
      ))}
      {over > 0 && (
        <span className="ml-0.5 text-[10px] font-semibold text-[var(--gold-bright)]">+{over}</span>
      )}
    </span>
  );
}

function StatLine({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1 text-[10px] leading-tight text-white/85">
      <span className="text-[8px] uppercase tracking-wider text-white/45">{label}</span>
      <span className="tabular-nums">{children}</span>
    </div>
  );
}

/* Owned-character picker for one slot. */
function SlotPicker({
  awakeners,
  excludeIds,
  onPick,
  onClose,
}: {
  awakeners: AwkLite[];
  excludeIds: string[];
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return awakeners
      .filter((a) => !excludeIds.includes(a.id))
      .filter((a) => (term ? a.name.toLowerCase().includes(term) : true))
      .sort(
        (a, b) =>
          (REALM_RANK[a.realm] ?? 9) - (REALM_RANK[b.realm] ?? 9) ||
          a.name.localeCompare(b.name)
      );
  }, [awakeners, excludeIds, q]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative z-10 max-h-[80vh] w-full max-w-lg overflow-hidden rounded-2xl border border-[var(--gold)]/40 bg-[var(--panel)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-[var(--border)] p-3">
          <span className="font-title text-xs uppercase tracking-wider text-[var(--gold-bright)]">
            Deploy
          </span>
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search owned…"
            className="ml-auto w-48 rounded border border-[var(--border)] bg-[var(--panel-2)] px-2 py-1 text-sm text-[var(--text)] focus:border-[var(--gold)] focus:outline-none"
          />
          <button
            onClick={onClose}
            className="rounded-full border border-[var(--border)] px-2 py-0.5 text-sm text-[var(--text-muted)] hover:text-[var(--text)]"
          >
            ✕
          </button>
        </div>
        <div className="grid max-h-[64vh] grid-cols-4 gap-2 overflow-y-auto p-3 sm:grid-cols-5">
          {list.length === 0 && (
            <p className="col-span-full py-8 text-center text-sm text-[var(--text-dim)]">
              No owned awakeners available.
            </p>
          )}
          {list.map((a) => (
            <button
              key={a.id}
              onClick={() => onPick(a.id)}
              className="group relative overflow-hidden rounded-lg border border-[var(--border)] hover:border-[var(--gold)]"
              title={a.name}
            >
              <div className="aspect-[3/4]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/assets/portraits/${a.id}.webp`}
                  alt={a.name}
                  loading="lazy"
                  className="h-full w-full object-cover object-top"
                />
              </div>
              <div className="absolute left-1 top-1">
                <RealmSigil realm={a.realm} size={13} />
              </div>
              <div className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/90 to-transparent px-1 pb-1 pt-3 text-[10px] font-medium text-white">
                {a.name}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* A single deploy slot — empty placeholder or a filled lineup card. */
function Slot({
  awk,
  plan,
  onClick,
  onClear,
}: {
  awk: AwkLite | null;
  plan?: SlotPlan;
  onClick: () => void;
  onClear: () => void;
}) {
  const roster = useRosterStore((s) => s.roster);

  if (!awk) {
    return (
      <button
        onClick={onClick}
        className="group flex aspect-[5/9] flex-col items-center justify-center rounded-lg border border-dashed border-[var(--border-bright)] bg-[var(--bg-2)]/40 text-[var(--text-dim)] transition hover:border-[var(--gold)] hover:text-[var(--text-muted)]"
      >
        <span className="text-3xl leading-none">＋</span>
        <span className="mt-2 text-xs tracking-wide">Tap to Deploy</span>
      </button>
    );
  }

  const e = roster.awakeners[awk.id];
  const level = e?.characterLevel ?? 1;
  const slot = (e?.enlightenSlot as EnlightenSlot) ?? "E0";
  const copies = e?.enlightenCopies ?? 0;
  const sk = e?.skillLevels;
  const skillRow = sk
    ? [sk.Strike, sk.Defense, sk.Skill1, sk.Skill2, sk.Rouse, sk.Exalt].join("/")
    : "—";
  const tal = e?.talentLevels;
  const talRow = tal
    ? `${tal.madnessOmen}/${tal.soulforgeAptitude}/${tal.gnosticPotential}`
    : "—";
  const cov = e?.equippedCovenantId;
  const role =
    plan?.role ?? (awk.roles && awk.roles.length ? humanRole(awk.roles[0]) : undefined);
  const blurb =
    plan?.blurb ??
    (awk.roles && awk.roles.length
      ? awk.roles.slice(0, 3).map(humanRole).join(" · ")
      : undefined);

  return (
    <div className="relative flex aspect-[5/9] flex-col overflow-hidden rounded-lg border-b-2 border-[var(--gold)] bg-[var(--panel)]">
      {/* portrait */}
      <div className="absolute inset-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/assets/portraits/${awk.id}.webp`}
          alt={awk.name}
          loading="lazy"
          className="h-full w-full object-cover object-top"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/92 via-black/20 to-black/45" />
      </div>

      {/* top row: realm + name + clear */}
      <div className="relative flex items-start justify-between p-1.5">
        <div className="flex items-center gap-1 rounded bg-black/45 px-1 py-0.5 backdrop-blur-sm">
          <RealmSigil realm={awk.realm} size={13} />
          <span className="font-display max-w-[7rem] truncate text-[13px] font-semibold text-white">
            {awk.name}
          </span>
        </div>
        <button
          onClick={onClear}
          title="Remove"
          className="rounded-full bg-black/55 px-1.5 text-xs text-white/70 backdrop-blur-sm hover:text-white"
        >
          ✕
        </button>
      </div>

      {/* bottom stat block */}
      <div className="relative mt-auto space-y-0.5 p-1.5">
        {role && (
          <div className="mb-1 inline-block rounded bg-[var(--gold)]/85 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-[#1b150a]">
            {role}
          </div>
        )}
        <StatLine label="Lv">{level}</StatLine>
        <div className="flex items-center gap-1">
          <span className="text-[8px] uppercase tracking-wider text-white/45">Enl</span>
          <Diamonds slot={slot} copies={copies} />
        </div>
        <StatLine label="Skl">{skillRow}</StatLine>
        <StatLine label="Tal">{talRow}</StatLine>
        {plan?.wheelNames && plan.wheelNames.length > 0 && (
          <div className="truncate text-[9px] text-[var(--realm-aequor)]" title={plan.wheelNames.join(", ")}>
            ⊚ {plan.wheelNames.filter(Boolean).join(" · ")}
          </div>
        )}
        {(plan?.covenantName || cov) && (
          <div className="truncate text-[9px] text-white/60">
            ◇ {plan?.covenantName ?? "Equipped covenant"}
          </div>
        )}
        {blurb && (
          <p className="line-clamp-2 pt-0.5 text-[9.5px] leading-snug text-white/70">{blurb}</p>
        )}
      </div>
    </div>
  );
}

export default function FormationBoard({
  title,
  awakeners,
  slots,
  plans,
  posseName,
  onChangeSlots,
}: {
  title?: string;
  awakeners: AwkLite[];
  slots: (string | null)[]; // length 4
  plans?: Record<string, SlotPlan>;
  posseName?: string;
  onChangeSlots: (next: (string | null)[]) => void;
}) {
  const roster = useRosterStore((s) => s.roster);
  const [pickFor, setPickFor] = useState<number | null>(null);

  const byId = useMemo(() => {
    const m: Record<string, AwkLite> = {};
    for (const a of awakeners) m[a.id] = a;
    return m;
  }, [awakeners]);

  // Only owned awakeners are deployable.
  const ownedAwakeners = useMemo(
    () => awakeners.filter((a) => roster.awakeners[a.id]?.owned),
    [awakeners, roster]
  );

  const realms = slots
    .filter(Boolean)
    .map((id) => byId[id as string]?.realm)
    .filter(Boolean) as Realm[];
  const distinctRealms = Array.from(new Set(realms));
  const nonChaos = distinctRealms.filter((r) => r !== "CHAOS");
  const realmWarning = nonChaos.length > 2;

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--panel)]/60 p-3 sm:p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-title text-sm uppercase tracking-wider text-[var(--gold-bright)]">
          {title ?? "Formation"}
        </h3>
        {distinctRealms.length > 0 && (
          <div className="flex items-center gap-1.5">
            {distinctRealms.map((r) => (
              <span
                key={r}
                className="flex items-center gap-1 rounded-full border border-[var(--border)] px-2 py-0.5 text-[10px]"
                style={{ color: REALM_COLOR[r] }}
              >
                <RealmSigil realm={r} size={11} />
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-4 gap-2 sm:gap-3">
        {[0, 1, 2, 3].map((i) => {
          const id = slots[i] ?? null;
          const awk = id ? byId[id] ?? null : null;
          return (
            <Slot
              key={i}
              awk={awk}
              plan={id && plans ? plans[id] : undefined}
              onClick={() => setPickFor(i)}
              onClear={() => {
                const next = [...slots];
                next[i] = null;
                onChangeSlots(next);
              }}
            />
          );
        })}
      </div>

      {/* posse + warnings bar */}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[var(--border)] pt-2.5 text-xs">
        <span className="flex items-center gap-1.5 text-[var(--text-muted)]">
          <span className="text-[var(--gold)]">❀</span>
          {posseName ? (
            <span className="text-[var(--text)]">{posseName}</span>
          ) : (
            <span className="text-[var(--text-dim)]">Posse Not Equipped</span>
          )}
        </span>
        {realmWarning && (
          <span className="ml-auto text-[var(--realm-caro)]">
            Realm conflict — at most two non-Chaos realms per team.
          </span>
        )}
      </div>

      {pickFor !== null && (
        <SlotPicker
          awakeners={ownedAwakeners}
          excludeIds={slots.filter((s): s is string => !!s)}
          onPick={(id) => {
            const next = [...slots];
            next[pickFor] = id;
            onChangeSlots(next);
            setPickFor(null);
          }}
          onClose={() => setPickFor(null)}
        />
      )}
    </div>
  );
}