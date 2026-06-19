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
  wheels: { id: string; name: string; rarity?: string; realm?: string; mainstat?: string }[];
  covenants: { id: string; name: string; effect?: string }[];
  posses: { id: string; name: string; realm?: string; effect?: string }[];
}

export interface PosseInfo {
  name: string;
  realm?: string;
  effect?: string;
}

type DrawerKind = "character" | "wheels" | "covenants" | "posses";

interface DrawerItem {
  id: string;
  name: string;
  realm?: string;
  rarity?: string;
  subtitle?: string;
}

const DRAWER_ASSET: Record<DrawerKind, string> = {
  character: "portraits",
  wheels: "wheels",
  covenants: "covenants",
  posses: "posses",
};

const WHEEL_RARITIES = ["MYTHIC", "SSR", "SR", "R", "N"];

/**
 * A right-hand side panel for selecting a character, wheel, covenant, or posse.
 * Has search, realm/rarity filters, and a roomy image grid — replaces the old
 * cramped popovers.
 */
function ItemDrawer({
  title,
  kind,
  items,
  currentId,
  allowNone,
  onSelect,
  onClose,
}: {
  title: string;
  kind: DrawerKind;
  items: DrawerItem[];
  currentId?: string;
  allowNone?: boolean;
  onSelect: (id: string | null) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [realm, setRealm] = useState<string | null>(null);
  const [rarity, setRarity] = useState<string | null>(null);

  const realms = useMemo(() => {
    const set = new Set<string>();
    for (const it of items) if (it.realm && it.realm !== "NEUTRAL") set.add(it.realm);
    return [...set].sort((a, b) => (REALM_RANK[a as Realm] ?? 9) - (REALM_RANK[b as Realm] ?? 9));
  }, [items]);
  const hasRarity = kind === "wheels" && items.some((it) => it.rarity);

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return items
      .filter((it) => (term ? it.name.toLowerCase().includes(term) : true))
      .filter((it) => (realm ? it.realm === realm : true))
      .filter((it) => (rarity ? it.rarity === rarity : true))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [items, q, realm, rarity]);

  const isIcon = kind === "covenants" || kind === "posses";
  const imgH = isIcon ? "h-24" : "h-36";
  const imgFit = isIcon ? "object-contain p-2" : "object-cover object-top";
  const cols = isIcon ? "grid-cols-2" : "grid-cols-3";

  return (
    <div className="fixed inset-0 z-[60]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-[var(--gold)]/30 bg-[var(--panel)] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-[var(--border)] p-3">
          <span className="font-title text-sm uppercase tracking-wider text-[var(--gold-bright)]">
            {title}
          </span>
          <button
            onClick={onClose}
            className="ml-auto flex h-7 w-7 items-center justify-center rounded-full border border-[var(--border)] text-sm text-[var(--text-muted)] hover:text-[var(--text)]"
          >
            ✕
          </button>
        </div>

        <div className="space-y-2 border-b border-[var(--border)] p-3">
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search…"
            className="w-full rounded border border-[var(--border)] bg-[var(--panel-2)] px-3 py-2 text-sm text-[var(--text)] placeholder-[var(--text-dim)] focus:border-[var(--gold)] focus:outline-none"
          />
          {(realms.length > 1 || hasRarity) && (
            <div className="flex flex-wrap gap-1.5">
              {hasRarity &&
                WHEEL_RARITIES.filter((r) => items.some((it) => it.rarity === r)).map((r) => (
                  <FilterChip
                    key={r}
                    active={rarity === r}
                    onClick={() => setRarity(rarity === r ? null : r)}
                    label={r}
                  />
                ))}
              {realms.map((r) => (
                <FilterChip
                  key={r}
                  active={realm === r}
                  onClick={() => setRealm(realm === r ? null : r)}
                  label={r[0] + r.slice(1).toLowerCase()}
                />
              ))}
            </div>
          )}
        </div>

        <div className={`grid flex-1 content-start gap-2 overflow-y-auto p-3 ${cols}`}>
          {allowNone && (
            <button
              onClick={() => onSelect(null)}
              className={`flex ${imgH} items-center justify-center rounded-lg border border-dashed border-[var(--border-bright)] text-xs text-[var(--text-dim)] hover:border-[var(--gold)]`}
            >
              — None —
            </button>
          )}
          {list.map((it) => (
            <button
              key={it.id}
              onClick={() => onSelect(it.id)}
              title={it.name}
              className={`group overflow-hidden rounded-lg border text-left transition ${
                it.id === currentId
                  ? "border-[var(--gold)] ring-1 ring-[var(--gold)]/50"
                  : "border-[var(--border)] hover:border-[var(--gold)]"
              }`}
            >
              <div className={`relative ${imgH} w-full bg-[var(--bg-2)]`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/assets/${DRAWER_ASSET[kind]}/${it.id}.webp`}
                  alt={it.name}
                  className={`h-full w-full ${imgFit}`}
                />
                {it.realm && it.realm !== "NEUTRAL" && (
                  <div className="absolute left-1 top-1">
                    <RealmSigil realm={it.realm as Realm} size={13} />
                  </div>
                )}
              </div>
              <div className="p-1.5">
                <div className="truncate text-[11px] font-medium text-[var(--text)]">{it.name}</div>
                {it.subtitle && (
                  <div className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-[var(--text-muted)]">
                    {it.subtitle}
                  </div>
                )}
              </div>
            </button>
          ))}
          {list.length === 0 && (
            <p className="col-span-full py-8 text-center text-sm text-[var(--text-dim)]">
              Nothing matches.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-2.5 py-0.5 text-[11px] transition ${
        active
          ? "border-[var(--gold)] text-[var(--gold-bright)]"
          : "border-[var(--border)] text-[var(--text-muted)] hover:border-[var(--border-bright)]"
      }`}
    >
      {label}
    </button>
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

/* A single deploy slot — empty placeholder or a filled lineup card. */
function Slot({
  awk,
  plan,
  onClick,
  onClear,
  editable,
  onEditWheel,
  onEditCovenant,
  wheelMeta,
  covenantMeta,
}: {
  awk: AwkLite | null;
  plan?: SlotPlan;
  onClick: () => void;
  onClear: () => void;
  editable?: boolean;
  onEditWheel?: (wheelIndex: number) => void;
  onEditCovenant?: () => void;
  wheelMeta?: Record<string, { name: string }>;
  covenantMeta?: Record<string, { name: string }>;
}) {
  const roster = useRosterStore((s) => s.roster);

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

  return (
    <div className="flex flex-col rounded-lg border border-[var(--border)] border-b-2 border-b-[var(--gold)] bg-[var(--panel)]">
      {/* portrait — taller, name + realm overlaid */}
      <div className="relative aspect-[3/4] shrink-0 overflow-hidden rounded-t-lg">
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
        <div className="flex gap-2">
          {/* stats column */}
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <StatLine label="Lv">{level} / 90</StatLine>
            <div className="flex items-center gap-1.5 leading-tight">
              <span className="w-7 shrink-0 text-[9px] uppercase tracking-wider text-[var(--text-dim)]">
                Enl
              </span>
              <Diamonds slot={slot} copies={copies} />
            </div>
            <StatLine label="Skl">{skillRow}</StatLine>
            <StatLine label="Tal">{talRow}</StatLine>
          </div>
          {/* covenant on the right */}
          <div className="flex w-16 shrink-0 flex-col items-center gap-0.5 border-l border-[var(--border)] pl-2">
            {editable ? (
              <button onClick={onEditCovenant} title="Change covenant">
                <CovIcon id={covenantId} />
              </button>
            ) : (
              <CovIcon id={covenantId} />
            )}
            <span className="w-full truncate text-center text-[9px] leading-tight text-[var(--text-muted)]">
              {covenantName ?? (editable ? "Set" : "—")}
            </span>
          </div>
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
                  <button
                    onClick={() => onEditWheel?.(wi)}
                    title="Change wheel"
                    className="block w-full"
                  >
                    {thumb}
                  </button>
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

type PickerState =
  | { kind: "character"; slotIndex: number }
  | { kind: "wheels"; slotIndex: number; wheelIndex: number }
  | { kind: "covenants"; slotIndex: number }
  | { kind: "posse" };

export default function FormationBoard({
  title,
  awakeners,
  slots,
  plans,
  posseId,
  onChangeSlots,
  gear,
  onChangeSlotGear,
  onChangePosse,
  onClearAll,
  wheelMeta,
  covenantMeta,
  posseMeta,
}: {
  title?: string;
  awakeners: AwkLite[];
  slots: (string | null)[]; // length 4
  plans?: Record<string, SlotPlan>;
  posseId?: string;
  onChangeSlots: (next: (string | null)[]) => void;
  gear?: GearOptions;
  onChangeSlotGear?: (slotIndex: number, patch: { wheelIds?: string[]; covenantId?: string }) => void;
  onChangePosse?: (id: string | undefined) => void;
  onClearAll?: () => void;
  wheelMeta?: Record<string, { name: string }>;
  covenantMeta?: Record<string, { name: string }>;
  posseMeta?: Record<string, PosseInfo>;
}) {
  const roster = useRosterStore((s) => s.roster);
  const editable = !!gear && !!onChangeSlotGear;
  const [picker, setPicker] = useState<PickerState | null>(null);

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

  const posse = posseId ? posseMeta?.[posseId] : undefined;

  // Build the drawer's item list + commit handler for the active picker.
  function drawerProps(): React.ComponentProps<typeof ItemDrawer> | null {
    if (!picker) return null;
    if (picker.kind === "character") {
      const taken = new Set(slots.filter((s): s is string => !!s));
      return {
        kind: "character",
        title: "Deploy Awakener",
        items: ownedAwakeners
          .filter((a) => !taken.has(a.id))
          .map((a) => ({ id: a.id, name: a.name, realm: a.realm, rarity: a.rarity })),
        currentId: slots[picker.slotIndex] ?? undefined,
        onSelect: (id) => {
          const next = [...slots];
          next[picker.slotIndex] = id;
          onChangeSlots(next);
          setPicker(null);
        },
        onClose: () => setPicker(null),
      };
    }
    if (picker.kind === "wheels" && gear) {
      const sid = slots[picker.slotIndex];
      const cur = sid && plans ? plans[sid]?.wheelIds ?? [] : [];
      return {
        kind: "wheels",
        title: `Wheel ${picker.wheelIndex + 1}`,
        allowNone: true,
        items: gear.wheels.map((w) => ({
          id: w.id,
          name: w.name,
          realm: w.realm,
          rarity: w.rarity,
          subtitle: w.mainstat,
        })),
        currentId: cur[picker.wheelIndex],
        onSelect: (id) => {
          const next: (string | undefined)[] = [cur[0], cur[1]];
          next[picker.wheelIndex] = id ?? undefined;
          onChangeSlotGear?.(picker.slotIndex, {
            wheelIds: next.filter((x): x is string => !!x),
          });
          setPicker(null);
        },
        onClose: () => setPicker(null),
      };
    }
    if (picker.kind === "covenants" && gear) {
      const sid = slots[picker.slotIndex];
      return {
        kind: "covenants",
        title: "Covenant",
        allowNone: true,
        items: gear.covenants.map((c) => ({ id: c.id, name: c.name, subtitle: c.effect })),
        currentId: sid && plans ? plans[sid]?.covenantId : undefined,
        onSelect: (id) => {
          onChangeSlotGear?.(picker.slotIndex, { covenantId: id ?? undefined });
          setPicker(null);
        },
        onClose: () => setPicker(null),
      };
    }
    if (picker.kind === "posse" && gear) {
      return {
        kind: "posses",
        title: "Posse",
        allowNone: true,
        items: gear.posses.map((p) => ({
          id: p.id,
          name: p.name,
          realm: p.realm,
          subtitle: p.effect,
        })),
        currentId: posseId,
        onSelect: (id) => {
          onChangePosse?.(id ?? undefined);
          setPicker(null);
        },
        onClose: () => setPicker(null),
      };
    }
    return null;
  }
  const dp = drawerProps();

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
              onClick={() => setPicker({ kind: "character", slotIndex: i })}
              onClear={() => {
                const next = [...slots];
                next[i] = null;
                onChangeSlots(next);
              }}
              editable={!!awk && editable}
              onEditWheel={(wheelIndex) => setPicker({ kind: "wheels", slotIndex: i, wheelIndex })}
              onEditCovenant={() => setPicker({ kind: "covenants", slotIndex: i })}
              wheelMeta={wheelMeta}
              covenantMeta={covenantMeta}
            />
          );
        })}
      </div>

      {/* posse bar — prominent, with its icon */}
      <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-[var(--border)] pt-3">
        <PosseBar
          posseId={posseId}
          info={posse}
          editable={editable}
          onEdit={() => setPicker({ kind: "posse" })}
        />
        {realmWarning && (
          <span className="ml-auto text-xs text-[var(--realm-caro)]">
            Realm conflict — at most two non-Chaos realms per team.
          </span>
        )}
      </div>

      {dp && <ItemDrawer {...dp} />}
    </div>
  );
}

/** The team's equipped posse, shown big with its icon and effect. */
function PosseBar({
  posseId,
  info,
  editable,
  onEdit,
}: {
  posseId?: string;
  info?: PosseInfo;
  editable?: boolean;
  onEdit: () => void;
}) {
  const inner = (
    <>
      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-[var(--gold)]/40 bg-[var(--bg-2)]">
        {posseId ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/assets/posses/${posseId}.webp`}
            alt={info?.name ?? "posse"}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-lg text-[var(--gold)]">
            ❀
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1 text-left">
        <div className="font-title text-[10px] uppercase tracking-wider text-[var(--text-dim)]">
          Posse
        </div>
        <div className="truncate text-sm font-medium text-[var(--text)]">
          {info?.name ?? (editable ? "Tap to equip a posse" : "Not equipped")}
        </div>
        {info?.effect && (
          <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-[var(--text-muted)]">
            {info.effect}
          </p>
        )}
      </div>
    </>
  );
  if (!editable) {
    return <div className="flex min-w-0 flex-1 items-center gap-3">{inner}</div>;
  }
  return (
    <button
      onClick={onEdit}
      title="Change posse"
      className="flex min-w-0 flex-1 items-center gap-3 rounded-lg border border-transparent p-1 text-left transition hover:border-[var(--border-bright)]"
    >
      {inner}
    </button>
  );
}