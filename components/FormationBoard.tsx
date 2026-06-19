"use client";

import { useMemo, useState } from "react";
import { useRosterStore } from "@/lib/store";
import type { Realm, EnlightenSlot } from "@/lib/types";
import { RealmSigil, REALM_COLOR, REALM_RANK } from "./realm";
import { toTotal, plusCount, ENLIGHTEN_MILESTONES } from "@/lib/enlighten";

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
  wheelIds?: string[]; // up to two equipped wheels
  covenantId?: string;
}

export interface GearOptions {
  wheels: { id: string; name: string }[];
  covenants: { id: string; name: string }[];
  posses: { id: string; name: string }[];
}

/** Inline single-select picker used for editing wheels / covenant / posse on a board. */
function GearSelect({
  value,
  options,
  onChange,
  placeholder,
  valueClass,
}: {
  value?: string;
  options: { id: string; name: string }[];
  onChange: (name: string | undefined) => void;
  placeholder: string;
  valueClass?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative min-w-0 flex-1">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        title="Change"
        className={`max-w-full truncate text-left text-[11px] hover:underline ${
          value ? valueClass ?? "text-[var(--text)]" : "text-[var(--text-dim)]"
        }`}
      >
        {value ?? placeholder} <span className="text-[var(--text-dim)]">▾</span>
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-30"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
            }}
          />
          <div className="absolute left-0 z-40 mt-1 max-h-52 w-44 overflow-auto rounded-md border border-[var(--border-bright)] bg-[var(--panel)] py-1 shadow-xl">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onChange(undefined);
                setOpen(false);
              }}
              className="block w-full px-2 py-1 text-left text-[11px] text-[var(--text-dim)] hover:bg-black/30"
            >
              — None —
            </button>
            {options.map((o) => (
              <button
                key={o.id}
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(o.name);
                  setOpen(false);
                }}
                className="block w-full truncate px-2 py-1 text-left text-[11px] text-[var(--text-muted)] hover:bg-black/30 hover:text-[var(--text)]"
              >
                {o.name}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** Star diamonds (0–3) plus the stack/breakpoint number, the way the game shows a wheel. */
function WheelPips({ stars, stack }: { stars: number; stack: number }) {
  return (
    <span className="inline-flex items-center gap-0.5 leading-none">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="text-[8px]"
          style={{ color: i < stars ? "var(--gold-bright)" : "var(--border-bright)" }}
        >
          ◆
        </span>
      ))}
      {stack > 0 && (
        <span className="ml-0.5 text-[8px] font-semibold text-[var(--text-muted)]">{stack}</span>
      )}
    </span>
  );
}

/** A popover grid of framed art for picking a wheel or covenant. */
function ThumbPicker({
  kind,
  options,
  onSelect,
  trigger,
  cols = 4,
}: {
  kind: "wheels" | "covenants";
  options: { id: string; name: string }[];
  onSelect: (id: string | null) => void;
  trigger: React.ReactNode;
  cols?: number;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className="block w-full text-left"
        title="Change"
      >
        {trigger}
      </button>
      {open && (
        <>
          <div
            className="fixed inset-0 z-30"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
            }}
          />
          <div className="absolute left-0 z-40 mt-1 max-h-64 w-56 overflow-auto rounded-lg border border-[var(--border-bright)] bg-[var(--panel)] p-2 shadow-2xl">
            <div
              className="grid gap-1.5"
              style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(null);
                  setOpen(false);
                }}
                className="flex aspect-[3/4] items-center justify-center rounded border border-dashed border-[var(--border-bright)] text-[10px] text-[var(--text-dim)] hover:border-[var(--gold)]"
              >
                None
              </button>
              {options.map((o) => (
                <button
                  key={o.id}
                  title={o.name}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(o.id);
                    setOpen(false);
                  }}
                  className="overflow-hidden rounded border border-transparent hover:border-[var(--gold)]"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/assets/${kind}/${o.id}.webp`}
                    alt={o.name}
                    loading="lazy"
                    className={`w-full object-cover ${
                      kind === "covenants" ? "aspect-square" : "aspect-[3/4]"
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/** A framed wheel thumbnail with star/stack pips underneath. */
function WheelThumb({
  id,
  name,
  stars,
  stack,
}: {
  id?: string;
  name?: string;
  stars: number;
  stack: number;
}) {
  if (!id) {
    return (
      <div className="flex aspect-[3/4] items-center justify-center rounded border border-dashed border-[var(--border-bright)] text-base text-[var(--text-dim)]">
        ＋
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded border border-[var(--border)]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/assets/wheels/${id}.webp`}
        alt={name ?? "wheel"}
        loading="lazy"
        className="aspect-[3/4] w-full object-cover"
      />
      <div className="flex items-center justify-center bg-black/40 py-0.5">
        <WheelPips stars={stars} stack={stack} />
      </div>
    </div>
  );
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

/* Enlighten diamonds — E1..AA filled by milestone, then a +N badge. */
function Diamonds({ slot, copies }: { slot: EnlightenSlot; copies: number }) {
  const total = toTotal(slot, copies);
  const plus = plusCount(total);
  const named = ENLIGHTEN_MILESTONES.filter((m) => m.slot !== "E0");
  return (
    <span className="inline-flex items-center gap-0.5">
      {named.map((m) => (
        <span
          key={m.slot}
          className="text-[11px] leading-none"
          style={{ color: total >= m.copies ? "var(--gold-bright)" : "var(--border-bright)" }}
          title={m.full}
        >
          ◆
        </span>
      ))}
      {plus > 0 && (
        <span className="ml-0.5 text-[11px] font-semibold text-[var(--gold-bright)]">+{plus}</span>
      )}
    </span>
  );
}

function StatLine({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 leading-tight">
      <span className="w-7 shrink-0 text-[9px] uppercase tracking-wider text-[var(--text-dim)]">
        {label}
      </span>
      <span className="tabular-nums text-[12px] text-[var(--text)]">{children}</span>
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
  gear,
  onChangeGear,
  wheelMeta,
  covenantMeta,
}: {
  awk: AwkLite | null;
  plan?: SlotPlan;
  onClick: () => void;
  onClear: () => void;
  gear?: GearOptions;
  onChangeGear?: (patch: { wheelIds?: string[]; covenantId?: string }) => void;
  wheelMeta?: Record<string, { name: string }>;
  covenantMeta?: Record<string, { name: string }>;
}) {
  const roster = useRosterStore((s) => s.roster);
  const editable = !!gear && !!onChangeGear;

  if (!awk) {
    return (
      <button
        onClick={onClick}
        className="group flex min-h-[260px] flex-col items-center justify-center rounded-lg border border-dashed border-[var(--border-bright)] bg-[var(--bg-2)]/40 text-[var(--text-dim)] transition hover:border-[var(--gold)] hover:text-[var(--text-muted)]"
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
  const role =
    plan?.role ?? (awk.roles && awk.roles.length ? humanRole(awk.roles[0]) : undefined);
  const blurb =
    plan?.blurb ??
    (awk.roles && awk.roles.length
      ? awk.roles.slice(0, 3).map(humanRole).join(" · ")
      : undefined);
  // Two wheel slots and a covenant, resolved to ids for visual display.
  const wheelIds: (string | undefined)[] = [plan?.wheelIds?.[0], plan?.wheelIds?.[1]];
  const covenantId = plan?.covenantId;
  const wheelName = (id?: string) => (id ? wheelMeta?.[id]?.name ?? "Wheel" : undefined);
  const covenantName = covenantId ? covenantMeta?.[covenantId]?.name : undefined;
  const wheelStars = (id?: string) => (id ? roster.wheels[id]?.starLevel ?? 0 : 0);
  const wheelStack = (id?: string) => (id ? roster.wheels[id]?.stackLevel ?? 0 : 0);

  const setWheel = (index: number, id: string | null) => {
    const next = [wheelIds[0], wheelIds[1]];
    next[index] = id ?? undefined;
    onChangeGear?.({ wheelIds: next.filter((x): x is string => !!x) });
  };

  return (
    <div className="flex flex-col rounded-lg border border-[var(--border)] border-b-2 border-b-[var(--gold)] bg-[var(--panel)]">
      {/* portrait — smaller, name + realm overlaid */}
      <div className="relative aspect-[4/3] shrink-0 overflow-hidden rounded-t-lg">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/assets/portraits/${awk.id}.webp`}
          alt={awk.name}
          loading="lazy"
          className="h-full w-full object-cover object-top"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30" />
        <button
          onClick={onClear}
          title="Remove from lineup"
          className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-sm text-white/85 backdrop-blur-sm transition hover:bg-[var(--realm-caro)]/80 hover:text-white"
        >
          ✕
        </button>
        <div className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 p-1.5">
          <RealmSigil realm={awk.realm} size={15} />
          <span className="font-display truncate text-sm font-semibold text-white">
            {awk.name}
          </span>
        </div>
      </div>

      {/* solid info panel — readable */}
      <div className="flex flex-1 flex-col gap-1 p-2">
        {role && (
          <div className="self-start rounded bg-[var(--gold)]/90 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#1b150a]">
            {role}
          </div>
        )}
        <StatLine label="Lv">{level} / 90</StatLine>
        <div className="flex items-center gap-1.5 leading-tight">
          <span className="w-7 shrink-0 text-[9px] uppercase tracking-wider text-[var(--text-dim)]">
            Enl
          </span>
          <Diamonds slot={slot} copies={copies} />
        </div>
        <StatLine label="Skl">{skillRow}</StatLine>
        <StatLine label="Tal">{talRow}</StatLine>

        {/* covenant icon + name */}
        <div className="mt-1 flex items-center gap-2 border-t border-[var(--border)] pt-1.5">
          {editable ? (
            <ThumbPicker
              kind="covenants"
              cols={4}
              options={gear!.covenants}
              onSelect={(id) => onChangeGear!({ covenantId: id ?? undefined })}
              trigger={<CovIcon id={covenantId} />}
            />
          ) : (
            <CovIcon id={covenantId} />
          )}
          <span className="min-w-0 flex-1 truncate text-[11px] text-[var(--text-muted)]">
            {covenantName ?? (editable ? "Tap to set covenant" : "No covenant")}
          </span>
        </div>

        {/* two wheel thumbnails */}
        <div className="mt-1.5 grid grid-cols-2 gap-1.5">
          {[0, 1].map((wi) => {
            const id = wheelIds[wi];
            const thumb = (
              <WheelThumb
                id={id}
                name={wheelName(id)}
                stars={wheelStars(id)}
                stack={wheelStack(id)}
              />
            );
            return (
              <div key={wi} className="min-w-0">
                {editable ? (
                  <ThumbPicker
                    kind="wheels"
                    cols={4}
                    options={gear!.wheels}
                    onSelect={(pickId) => setWheel(wi, pickId)}
                    trigger={thumb}
                  />
                ) : (
                  thumb
                )}
                <div className="mt-0.5 truncate text-center text-[9px] leading-tight text-[var(--text-dim)]">
                  {wheelName(id) ?? "—"}
                </div>
              </div>
            );
          })}
        </div>

        {blurb && (
          <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-[var(--text-muted)]">
            {blurb}
          </p>
        )}
      </div>
    </div>
  );
}

/** Small framed covenant icon (or an empty placeholder). */
function CovIcon({ id }: { id?: string }) {
  if (!id) {
    return (
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-dashed border-[var(--border-bright)] text-xs text-[var(--text-dim)]">
        ◇
      </div>
    );
  }
  return (
    <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full border border-[var(--gold)]/40">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/assets/covenants/${id}.webp`}
        alt="covenant"
        loading="lazy"
        className="h-full w-full object-cover"
      />
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
  gear,
  onChangeSlotGear,
  onChangePosse,
  onClearAll,
  wheelMeta,
  covenantMeta,
}: {
  title?: string;
  awakeners: AwkLite[];
  slots: (string | null)[]; // length 4
  plans?: Record<string, SlotPlan>;
  posseName?: string;
  onChangeSlots: (next: (string | null)[]) => void;
  gear?: GearOptions;
  onChangeSlotGear?: (slotIndex: number, patch: { wheelIds?: string[]; covenantId?: string }) => void;
  onChangePosse?: (name: string | undefined) => void;
  onClearAll?: () => void;
  wheelMeta?: Record<string, { name: string }>;
  covenantMeta?: Record<string, { name: string }>;
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
        <div className="flex items-center gap-2">
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
          {onClearAll && slots.some(Boolean) && (
            <button
              onClick={onClearAll}
              className="rounded-md border border-[var(--border)] px-2.5 py-1 text-[10px] uppercase tracking-wider text-[var(--text-dim)] transition hover:border-[var(--realm-caro)] hover:text-[var(--realm-caro)]"
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
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
              gear={awk ? gear : undefined}
              onChangeGear={
                awk && onChangeSlotGear ? (patch) => onChangeSlotGear(i, patch) : undefined
              }
              wheelMeta={wheelMeta}
              covenantMeta={covenantMeta}
            />
          );
        })}
      </div>

      {/* posse + warnings bar */}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[var(--border)] pt-2.5 text-xs">
        <span className="flex items-center gap-1.5 text-[var(--text-muted)]">
          <span className="text-[var(--gold)]">❀</span>
          {gear && onChangePosse ? (
            <GearSelect
              value={posseName}
              options={gear.posses}
              onChange={(name) => onChangePosse(name)}
              placeholder="Posse Not Equipped"
              valueClass="text-[var(--text)]"
            />
          ) : posseName ? (
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