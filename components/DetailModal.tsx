"use client";

import { useEffect, useState } from "react";
import { useRosterStore } from "@/lib/store";
import type { EnlightenSlot, SkillSlot, Realm, DescriptionArg, SkeySkillUpgrade } from "@/lib/types";
import { RealmSigil, REALM_COLOR } from "./realm";
import { ScaledText, maxScalingIndex, applySkillUpgrades, type StatResolver } from "@/lib/template";
import { resolvePrimaryStat, gnosticBonusLevels, wheelMainStat } from "@/lib/stats";
import {
  ENLIGHTEN_MILESTONES,
  ENLIGHTEN_MAX,
  ENLIGHTEN_MIN,
  toTotal,
  fromTotal,
  isSlotUnlocked,
  plusCount,
  trackLabel,
} from "@/lib/enlighten";

/* ---------------------------------------------------------------------------
   Detail modal — open up and customize / view any entity.

   The grid only knows names; the rich, scaling effect text is fetched on open
   from /api/detail. Everything the player can invest in (enlighten track,
   character + skill + talent levels, wheel star/stack, covenant pieces) is
   edited here, and every description re-renders at the chosen investment level.
--------------------------------------------------------------------------- */

export type DetailTarget =
  | {
      kind: "awakener";
      id: string;
      name: string;
      realm: Realm;
      rarity: string;
      isDivineRealm?: boolean;
      isLemurian?: boolean;
    }
  | { kind: "wheel"; id: string; name: string; realm: string; rarity: string }
  | { kind: "covenant"; id: string; name: string }
  | { kind: "posse"; id: string; name: string; realm: string; hasCharacterBonus?: boolean };

const SKILLS: { slot: SkillSlot; label: string }[] = [
  { slot: "Strike", label: "Strike" },
  { slot: "Defense", label: "Defense" },
  { slot: "Skill1", label: "Skill 1" },
  { slot: "Skill2", label: "Skill 2" },
  { slot: "Rouse", label: "Rouse" },
  { slot: "Exalt", label: "Exalt" },
];
const SKILL_LABEL: Record<string, string> = Object.fromEntries(
  SKILLS.map((s) => [s.slot, s.label])
);

// The eight covenant substat categories (mirrors the in-game Attributes panel).
const COVENANT_SUBSTATS: { key: string; label: string; suffix?: string }[] = [
  { key: "CRIT_RATE", label: "Crit Rate", suffix: "%" },
  { key: "CRIT_DMG", label: "Crit DMG", suffix: "%" },
  { key: "DMG_AMP", label: "DMG Amplification", suffix: "%" },
  { key: "DEATH_RESISTANCE", label: "Death Resistance", suffix: "%" },
  { key: "REALM_MASTERY", label: "Realm Mastery" },
  { key: "SIGIL_YIELD", label: "Sigil Yield", suffix: "%" },
  { key: "ALIEMUS_REGEN", label: "Aliemus Regen Lv" },
  { key: "KEYFLARE_REGEN", label: "Keyflare Regen Lv" },
];

const ASSET_DIR: Record<DetailTarget["kind"], string> = {
  awakener: "portraits",
  wheel: "wheels",
  covenant: "covenants",
  posse: "posses",
};

const MAINSTAT_LABEL: Record<string, string> = {
  CRIT_RATE: "Crit Rate",
  CRIT_DMG: "Crit DMG",
  DMG_AMP: "DMG Amplification",
  ALIEMUS_REGEN: "Aliemus Regen",
  KEYFLARE_REGEN: "Keyflare Regen",
  REALM_MASTERY: "Realm Mastery",
  DEATH_RESISTANCE: "Death Resistance",
  SIGIL_YIELD: "Sigil Yield",
};

/* ---- detail payload shapes (mirrors /api/detail) ------------------------- */

interface EffectBlock {
  id?: string;
  name?: string;
  slot?: string;
  cost?: number | null;
  descriptionTemplate: string;
  descriptionArgs: Record<string, DescriptionArg>;
  upgrades?: SkeySkillUpgrade[];
}
interface AwakenerDetail {
  kind: "awakener";
  type?: string;
  faction?: string;
  annotationNotes?: string | null;
  teamRoles?: string[];
  enlightens: (EffectBlock & { slot: EnlightenSlot })[];
  skills: (EffectBlock & { slot: SkillSlot })[];
  talents: (EffectBlock & { family: string; maxLevel: number; defaultMaxed: boolean })[];
  primaryScalingBase?: number | null;
  statScaling?: { CON: number; ATK: number; DEF: number } | null;
  baseStatsLv1?: { CON: number; ATK: number; DEF: number } | null;
}
interface WheelDetail {
  kind: "wheel";
  mainstatKey: string;
  ownerAwakenerName?: string | null;
  isMythic: boolean;
  isNWheel: boolean;
  hasCombatEffect: boolean;
  descriptionTemplate: string;
  descriptionArgs: Record<string, DescriptionArg>;
  lore?: string | null;
}
interface CovenantDetail {
  kind: "covenant";
  acquisitionSource?: string | null;
  lore?: string | null;
  setEffects: { set: number; descriptionTemplate: string; descriptionArgs: Record<string, DescriptionArg> }[];
}
interface PosseDetail {
  kind: "posse";
  acquisitionSource?: string | null;
  lore?: string | null;
  hasCharacterBonus: boolean;
  characterBonusFor?: string | null;
  descriptionTemplate: string;
  descriptionArgs: Record<string, DescriptionArg>;
}
type Detail = AwakenerDetail | WheelDetail | CovenantDetail | PosseDetail;

/* ---- UI atoms ------------------------------------------------------------ */

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--bg-2)] px-3 py-2.5"
    >
      <span className="text-sm text-[var(--text)]">{label}</span>
      <span
        className={`relative h-5 w-9 rounded-full transition ${
          checked ? "bg-[var(--gold)]" : "bg-[var(--panel-2)]"
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${
            checked ? "left-[18px]" : "left-0.5"
          }`}
        />
      </span>
    </button>
  );
}

function Stepper({
  label,
  value,
  min,
  max,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  suffix?: string;
  onChange: (v: number) => void;
}) {
  const clamp = (v: number) => Math.max(min, Math.min(max, v));
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-2)] px-3 py-2">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-sm text-[var(--text)]">{label}</span>
        <span className="tabular-nums text-xs text-[var(--text-dim)]">
          {value}
          {suffix ?? ""} / {max}
          {suffix ?? ""}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onChange(clamp(value - 1))}
          className="h-7 w-7 shrink-0 rounded border border-[var(--border)] bg-[var(--panel)] text-[var(--text-muted)] hover:text-[var(--text)]"
        >
          −
        </button>
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(clamp(Number(e.target.value)))}
          className="flex-1 accent-[var(--gold)]"
        />
        <button
          onClick={() => onChange(clamp(value + 1))}
          className="h-7 w-7 shrink-0 rounded border border-[var(--border)] bg-[var(--panel)] text-[var(--text-muted)] hover:text-[var(--text)]"
        >
          +
        </button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="font-title mb-2 text-[12.5px] uppercase tracking-wider text-[var(--text-dim)]">
        {title}
      </h4>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

/* Enlighten track — one slider 0..16 with milestone ticks + timeline labels. */
function EnlightenTrack({
  total,
  onChange,
}: {
  total: number;
  onChange: (total: number) => void;
}) {
  // The slider spans 1..16 (E0..+12). Position 1 is the owned base, so the
  // track is laid out across (MIN..MAX) rather than 0..MAX.
  const span = ENLIGHTEN_MAX - ENLIGHTEN_MIN;
  const pct = (t: number) => ((t - ENLIGHTEN_MIN) / span) * 100;
  const plus = plusCount(total);
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-2)] px-3 pb-3 pt-2">
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-sm text-[var(--text)]">Enlightenment</span>
        <span className="tabular-nums text-sm font-semibold text-[var(--gold-bright)]">
          {trackLabel(total)}
          <span className="ml-1.5 text-[12px] font-normal text-[var(--text-dim)]">
            {total} {total === 1 ? "copy" : "copies"}
          </span>
        </span>
      </div>

      {/* milestone labels above the track */}
      <div className="relative mb-1 h-4">
        {ENLIGHTEN_MILESTONES.map((m) => (
          <span
            key={m.slot}
            className={`absolute -translate-x-1/2 text-[12px] font-medium ${
              total >= m.copies ? "text-[var(--gold-bright)]" : "text-[var(--text-dim)]"
            }`}
            style={{ left: `${pct(m.copies)}%` }}
            title={m.full}
          >
            {m.label}
          </span>
        ))}
      </div>

      <input
        type="range"
        min={ENLIGHTEN_MIN}
        max={ENLIGHTEN_MAX}
        value={total}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[var(--gold)]"
      />

      {/* tick marks for every milestone, including E0 */}
      <div className="relative mt-0.5 h-2">
        {ENLIGHTEN_MILESTONES.map((m) => (
          <span
            key={m.slot}
            className={`absolute h-2 w-px -translate-x-1/2 ${
              total >= m.copies ? "bg-[var(--gold)]" : "bg-[var(--border-bright)]"
            }`}
            style={{ left: `${pct(m.copies)}%` }}
          />
        ))}
      </div>
      {plus > 0 && (
        <p className="mt-1.5 text-[12px] text-[var(--text-dim)]">
          {plus >= 4 && plus < 12 && "Over-Exalt active. "}
          {plus >= 12 && "Absolute Axiom active. "}
          {plus} dupe{plus === 1 ? "" : "s"} past Enlighten III.
        </p>
      )}
    </div>
  );
}

/* Scaling skill card — name, cost, level stepper, live-scaled description. */
function SkillCard({
  block,
  level,
  onLevel,
  resolveStat,
}: {
  block: EffectBlock & { slot: SkillSlot };
  level: number;
  onLevel: (v: number) => void;
  resolveStat?: StatResolver;
}) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-2)] p-2.5">
      <div className="mb-1 flex items-center gap-2">
        <span className="font-title rounded bg-[var(--panel-2)] px-1.5 py-0.5 text-[12px] uppercase tracking-wider text-[var(--text-dim)]">
          {SKILL_LABEL[block.slot] ?? block.slot}
        </span>
        <span className="font-display truncate text-sm font-semibold text-[var(--text)]">
          {block.name}
        </span>
        {typeof block.cost === "number" && block.cost > 0 && (
          <span className="ml-auto shrink-0 rounded bg-[var(--panel)] px-1.5 py-0.5 text-[12px] text-[var(--gold-bright)]">
            Cost {block.cost}
          </span>
        )}
      </div>
      <div className="mb-2 flex items-center gap-2">
        <span className="text-[12px] uppercase tracking-wider text-[var(--text-dim)]">Lv</span>
        <input
          type="range"
          min={1}
          max={6}
          value={level}
          onChange={(e) => onLevel(Number(e.target.value))}
          className="flex-1 accent-[var(--gold)]"
        />
        <span className="tabular-nums text-xs text-[var(--text-muted)]">{level}/6</span>
      </div>
      <ScaledText
        template={block.descriptionTemplate}
        args={block.descriptionArgs}
        index={level - 1}
        resolveStat={resolveStat}
        className="text-[13.5px] leading-relaxed text-[var(--text-muted)]"
      />
    </div>
  );
}

/* ---- main ---------------------------------------------------------------- */

export default function DetailModal({
  target,
  onClose,
}: {
  target: DetailTarget;
  onClose: () => void;
}) {
  const roster = useRosterStore((s) => s.roster);
  const setAwakenerOwned = useRosterStore((s) => s.setAwakenerOwned);
  const setEnlightenLevel = useRosterStore((s) => s.setEnlightenLevel);
  const setCharacterLevel = useRosterStore((s) => s.setCharacterLevel);
  const setSkillLevel = useRosterStore((s) => s.setSkillLevel);
  const setTalentLevel = useRosterStore((s) => s.setTalentLevel);
  const setWheelOwned = useRosterStore((s) => s.setWheelOwned);
  const setWheelStarLevel = useRosterStore((s) => s.setWheelStarLevel);
  const setWheelStackLevel = useRosterStore((s) => s.setWheelStackLevel);
  const setCovenantOwned = useRosterStore((s) => s.setCovenantOwned);
  const setCovenantThreePiece = useRosterStore((s) => s.setCovenantThreePiece);
  const setCovenantSixPiece = useRosterStore((s) => s.setCovenantSixPiece);
  const setCovenantCompletion = useRosterStore((s) => s.setCovenantCompletion);
  const setCovenantSubstat = useRosterStore((s) => s.setCovenantSubstat);
  const setPosseUnlocked = useRosterStore((s) => s.setPosseUnlocked);

  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);

  // Esc to close; lock body scroll while open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  // Fetch full effect data on open.
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setDetail(null);
    fetch(`/api/detail?kind=${target.kind}&id=${encodeURIComponent(target.id)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && d && !d.error) setDetail(d as Detail);
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [target.kind, target.id]);

  const realm = "realm" in target ? target.realm : undefined;
  const rarity = "rarity" in target ? target.rarity : undefined;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative z-10 max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[var(--gold)]/40 bg-[var(--panel)] shadow-[0_20px_60px_rgba(0,0,0,0.6)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-start gap-4 border-b border-[var(--border)] bg-[var(--panel)] p-4">
          <div className="relative h-28 w-20 shrink-0 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--bg-2)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/assets/${ASSET_DIR[target.kind]}/${target.id}.webp`}
              alt={target.name}
              className="h-full w-full object-cover object-top"
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {realm && realm !== "NEUTRAL" && <RealmSigil realm={realm} size={18} />}
              <span className="font-title text-[12px] uppercase tracking-wider text-[var(--text-dim)]">
                {target.kind}
                {detail && detail.kind === "awakener" && detail.type
                  ? ` · ${detail.type.toLowerCase()}`
                  : ""}
              </span>
            </div>
            <h3 className="font-display mt-1 text-2xl font-semibold leading-tight text-[var(--text)]">
              {target.name}
            </h3>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {rarity && (
                <span className="rounded border border-[var(--border)] px-1.5 py-0.5 text-[12px] uppercase tracking-wide text-[var(--text-muted)]">
                  {rarity}
                </span>
              )}
              {realm && realm !== "NEUTRAL" && (
                <span
                  className="rounded px-1.5 py-0.5 text-[12px] uppercase tracking-wide"
                  style={{ color: REALM_COLOR[realm] ?? "var(--text-dim)" }}
                >
                  {realm}
                </span>
              )}
              {target.kind === "awakener" && target.isDivineRealm && (
                <span className="rounded px-1.5 py-0.5 text-[12px] uppercase tracking-wide text-[var(--silver)]">
                  Divine
                </span>
              )}
              {target.kind === "awakener" && target.isLemurian && (
                <span className="rounded px-1.5 py-0.5 text-[12px] uppercase tracking-wide text-[var(--silver)]">
                  Lemurian
                </span>
              )}
              {detail &&
                detail.kind === "awakener" &&
                (detail.teamRoles ?? []).slice(0, 3).map((r) => (
                  <span
                    key={r}
                    className="rounded bg-[var(--panel-2)] px-1.5 py-0.5 text-[12px] text-[var(--text-muted)]"
                  >
                    {r.replace(/_/g, " ")}
                  </span>
                ))}
            </div>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-full border border-[var(--border)] px-2.5 py-1 text-sm text-[var(--text-muted)] hover:text-[var(--text)]"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="space-y-5 p-4">
          {loading && (
            <p className="py-6 text-center text-sm text-[var(--text-dim)]">
              Consulting the archives…
            </p>
          )}

          {/* ---- AWAKENER ---- */}
          {target.kind === "awakener" &&
            (() => {
              const e = roster.awakeners[target.id];
              const owned = !!e?.owned;
              const slot = e?.enlightenSlot ?? "E0";
              const copies = e?.enlightenCopies ?? 0;
              const total = toTotal(slot, copies);
              const d = detail && detail.kind === "awakener" ? detail : null;
              const passives = d?.talents.filter((t) => t.family === "passive") ?? [];
              // Resolve ATK/DEF/CON at the character's current level so skill cards
              // can show real numbers instead of percentages. Gnostic Potential
              // ("+N Levels of Base Attributes") raises the effective level — for
              // defaultMaxed units it's always maxed, matching the live game.
              const charLevel = e?.characterLevel ?? 1;
              const gnosticTalent = d?.talents.find(
                (t) => t.family === "gnostic_potential"
              );
              const gnosticLevel = gnosticTalent
                ? gnosticTalent.defaultMaxed
                  ? gnosticTalent.maxLevel ?? 0
                  : e?.talentLevels?.gnosticPotential ?? 0
                : 0;
              const gnosticBonus = gnosticBonusLevels(
                gnosticTalent?.descriptionArgs?.Arg1 as
                  | { kind?: string; base?: string | number; gainPerLevel?: string | number }
                  | undefined,
                gnosticLevel
              );
              const resolveStat: StatResolver | undefined =
                d?.statScaling && d.primaryScalingBase != null
                  ? (statKey) => {
                      const k = statKey.toUpperCase();
                      if (k !== "ATK" && k !== "DEF" && k !== "CON") return null;
                      return resolvePrimaryStat(
                        d.primaryScalingBase as number,
                        (d.statScaling as { CON: number; ATK: number; DEF: number })[
                          k as "CON" | "ATK" | "DEF"
                        ],
                        charLevel,
                        gnosticBonus
                      );
                    }
                  : undefined;
              return (
                <>
                  <Toggle label="Owned" checked={owned} onChange={(v) => setAwakenerOwned(target.id, v)} />

                  <Section title="Enlighten">
                    <EnlightenTrack
                      total={total}
                      onChange={(t) => {
                        const next = fromTotal(t);
                        setEnlightenLevel(target.id, next.slot, next.copies);
                      }}
                    />
                    {d &&
                      d.enlightens.map((node) => {
                        const lit = isSlotUnlocked(node.slot, total);
                        return (
                          <div
                            key={node.id ?? node.slot}
                            className={`rounded-lg border px-3 py-2 transition ${
                              lit
                                ? "border-[var(--gold)]/40 bg-[var(--bg-2)]"
                                : "border-[var(--border)] bg-transparent opacity-50"
                            }`}
                          >
                            <div className="mb-0.5 flex items-center gap-2">
                              <span className="font-title rounded bg-[var(--panel-2)] px-1.5 py-0.5 text-[12px] uppercase tracking-wider text-[var(--text-dim)]">
                                {node.slot}
                              </span>
                              <span className="font-display text-sm font-semibold text-[var(--text)]">
                                {node.name}
                              </span>
                              {!lit && (
                                <span className="ml-auto text-[12px] text-[var(--text-dim)]">
                                  locked
                                </span>
                              )}
                            </div>
                            <ScaledText
                              template={node.descriptionTemplate}
                              args={node.descriptionArgs}
                              index={0}
                              className="text-[13.5px] leading-relaxed text-[var(--text-muted)]"
                            />
                          </div>
                        );
                      })}
                  </Section>

                  <Section title="Level">
                    <Stepper
                      label="Character level"
                      value={e?.characterLevel ?? 1}
                      min={1}
                      max={90}
                      onChange={(v) => setCharacterLevel(target.id, v)}
                    />
                  </Section>

                  <Section title="Skills">
                    {d && d.skills.length > 0
                      ? d.skills
                          .filter((sk) => sk.slot !== "OverExalt")
                          .map((sk) => {
                            const up = applySkillUpgrades(
                              sk.descriptionTemplate,
                              sk.descriptionArgs,
                              sk.upgrades,
                              total
                            );
                            return (
                              <SkillCard
                                key={sk.id ?? sk.slot}
                                block={{
                                  ...sk,
                                  descriptionTemplate: up.template ?? sk.descriptionTemplate,
                                  descriptionArgs: up.args ?? sk.descriptionArgs,
                                }}
                                level={e?.skillLevels?.[sk.slot] ?? 1}
                                onLevel={(v) => setSkillLevel(target.id, sk.slot, v)}
                                resolveStat={resolveStat}
                              />
                            );
                          })
                      : SKILLS.map(({ slot: sk, label }) => (
                          <Stepper
                            key={sk}
                            label={label}
                            value={e?.skillLevels?.[sk] ?? 1}
                            min={1}
                            max={6}
                            onChange={(v) => setSkillLevel(target.id, sk, v)}
                          />
                        ))}
                    {(() => {
                      const oe = d?.skills.find((sk) => sk.slot === "OverExalt");
                      if (!oe) return null;
                      // Over-Exalt is a single effect layered on Exalt at 200 Aliemus.
                      // It has no level of its own — it follows the Exalt level and is
                      // unlocked by the Over-Exalt enlighten milestone (+4 / 8 copies).
                      const exaltLevel = e?.skillLevels?.Exalt ?? 1;
                      const unlocked = total >= 8;
                      const oeUp = applySkillUpgrades(
                        oe.descriptionTemplate,
                        oe.descriptionArgs,
                        oe.upgrades,
                        total
                      );
                      return (
                        <div
                          className={`rounded-lg border p-2.5 ${
                            unlocked
                              ? "border-[var(--gold)]/40 bg-[var(--bg-2)]"
                              : "border-[var(--border)] bg-transparent opacity-70"
                          }`}
                        >
                          <div className="mb-1 flex items-center gap-2">
                            <span className="font-title rounded bg-[var(--panel-2)] px-1.5 py-0.5 text-[12px] uppercase tracking-wider text-[var(--gold-bright)]">
                              Over-Exalt
                            </span>
                            <span className="text-[12px] text-[var(--text-dim)]">
                              follows Exalt Lv{exaltLevel} · fires at 200 Aliemus
                            </span>
                            {!unlocked && (
                              <span className="ml-auto text-[12px] text-[var(--text-dim)]">
                                unlocks at OE (+4)
                              </span>
                            )}
                          </div>
                          <ScaledText
                            template={oeUp.template ?? oe.descriptionTemplate}
                            args={oeUp.args ?? oe.descriptionArgs}
                            index={exaltLevel - 1}
                            resolveStat={resolveStat}
                            className="text-[13.5px] leading-relaxed text-[var(--text-muted)]"
                          />
                        </div>
                      );
                    })()}
                  </Section>

                  {passives.length > 0 && (
                    <Section title="Passive">
                      {passives.map((p) => (
                        <div
                          key={p.id ?? p.name}
                          className="rounded-lg border border-[var(--silver)]/30 bg-[var(--bg-2)] px-3 py-2"
                        >
                          <div className="mb-0.5 flex items-center gap-2">
                            <span className="font-display text-sm font-semibold text-[var(--text)]">
                              {p.name}
                            </span>
                            <span className="ml-auto text-[12px] uppercase tracking-wider text-[var(--silver)]">
                              always active
                            </span>
                          </div>
                          <ScaledText
                            template={p.descriptionTemplate}
                            args={p.descriptionArgs}
                            index={0}
                            className="text-[13.5px] leading-relaxed text-[var(--text-muted)]"
                          />
                        </div>
                      ))}
                    </Section>
                  )}

                  <Section title="Talents">
                    {(() => {
                      const fam = (name: string) =>
                        d?.talents.find((t) => t.family === name) ?? null;
                      const rows: {
                        key: "madnessOmen" | "soulforgeAptitude" | "gnosticPotential";
                        family: string;
                        label: string;
                        max: number;
                        value: number;
                      }[] = [
                        {
                          key: "madnessOmen",
                          family: "madness_omen",
                          label: "Madness Omen",
                          max: fam("madness_omen")?.maxLevel ?? 12,
                          value: e?.talentLevels?.madnessOmen ?? 0,
                        },
                        {
                          key: "soulforgeAptitude",
                          family: "soulforge_aptitude",
                          label: "Soulforge Aptitude",
                          max: fam("soulforge_aptitude")?.maxLevel ?? 10,
                          value: e?.talentLevels?.soulforgeAptitude ?? 0,
                        },
                        {
                          key: "gnosticPotential",
                          family: "gnostic_potential",
                          label: "Gnostic Potential",
                          max: fam("gnostic_potential")?.maxLevel ?? 5,
                          value: e?.talentLevels?.gnosticPotential ?? 0,
                        },
                      ];
                      return rows.map((row) => {
                        const t = fam(row.family);
                        const active = row.value >= 1;
                        return (
                          <div key={row.key} className="space-y-1">
                            <Stepper
                              label={row.label}
                              value={row.value}
                              min={0}
                              max={row.max}
                              onChange={(v) => setTalentLevel(target.id, row.key, v)}
                            />
                            {t && active && (
                              <div className="px-1">
                                <ScaledText
                                  template={t.descriptionTemplate}
                                  args={t.descriptionArgs}
                                  index={row.value - 1}
                                  className="text-[13px] leading-relaxed text-[var(--text-dim)]"
                                />
                              </div>
                            )}
                            {t && !active && (
                              <p className="px-1 text-[12.5px] italic text-[var(--text-dim)]">
                                Not unlocked — raise to Lv 1 to activate.
                              </p>
                            )}
                          </div>
                        );
                      });
                    })()}
                  </Section>

                  {d?.annotationNotes && (
                    <Section title="Notes">
                      <p className="rounded-lg border border-[var(--border)] bg-[var(--bg-2)] px-3 py-2 text-[13.5px] leading-relaxed text-[var(--text-muted)]">
                        {d.annotationNotes}
                      </p>
                    </Section>
                  )}
                </>
              );
            })()}

          {/* ---- WHEEL ---- */}
          {target.kind === "wheel" &&
            (() => {
              const e = roster.wheels[target.id];
              const owned = !!e?.owned;
              const star = e?.starLevel ?? 0;
              const stack = e?.stackLevel ?? 0;
              const d = detail && detail.kind === "wheel" ? detail : null;
              const arc = roster.settings.arcRuleset;
              return (
                <>
                  <Toggle label="Owned" checked={owned} onChange={(v) => setWheelOwned(target.id, v)} />

                  {d && (
                    <div className="rounded-lg border border-[var(--gold)]/30 bg-[var(--bg-2)] px-3 py-2.5">
                      <div className="flex items-baseline justify-between">
                        <span className="text-[12px] uppercase tracking-wider text-[var(--text-dim)]">
                          Main Stat
                        </span>
                        <span className="tabular-nums text-xs text-[var(--text-dim)]">
                          {stack > 0 ? `+${stack}` : "3★ base"}
                        </span>
                      </div>
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-display text-base font-semibold text-[var(--text)]">
                          {MAINSTAT_LABEL[d.mainstatKey] ?? d.mainstatKey}
                        </span>
                        {(() => {
                          const ms = wheelMainStat(rarity ?? "SSR", d.mainstatKey, stack);
                          return ms ? (
                            <span className="font-display tabular-nums text-lg font-bold text-[var(--gold-bright)]">
                              {ms.display}
                            </span>
                          ) : null;
                        })()}
                      </div>
                      <p className="mt-0.5 text-[12.5px] text-[var(--text-dim)]">
                        Grows with each +X stack past 3★ (up to +12).
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                        {d.ownerAwakenerName && (
                          <span className="text-[var(--text-dim)]">
                            Affinity:{" "}
                            <span className="text-[var(--gold-bright)]">{d.ownerAwakenerName}</span>
                          </span>
                        )}
                        {d.isMythic && <span className="text-[var(--realm-ultra)]">Mythic</span>}
                      </div>
                    </div>
                  )}

                  <Section title="Ascension">
                    <Stepper
                      label="Star level (sub-properties)"
                      value={star}
                      min={0}
                      max={3}
                      suffix="★"
                      onChange={(v) => setWheelStarLevel(target.id, v)}
                    />
                    <Stepper
                      label="Stack level (main stat)"
                      value={stack}
                      min={0}
                      max={12}
                      onChange={(v) => setWheelStackLevel(target.id, v)}
                    />
                    {stack >= 12 && (
                      <p className="text-[12.5px] text-[var(--realm-aequor)]">
                        Stack +12 unlocks the dual-SSR exception — a second SSR/Mythic wheel may be
                        equipped alongside this one.
                      </p>
                    )}
                  </Section>

                  {d && d.descriptionTemplate ? (
                    <Section title={`Effect at ${star}★`}>
                      <div className="rounded-lg border border-[var(--gold)]/30 bg-[var(--bg-2)] px-3 py-2.5">
                        <ScaledText
                          template={d.descriptionTemplate}
                          args={d.descriptionArgs}
                          index={star}
                          className="text-[13.5px] leading-relaxed text-[var(--text-muted)]"
                        />
                      </div>
                      {maxScalingIndex(d.descriptionArgs) > 0 && (
                        <p className="text-[12.5px] text-[var(--text-dim)]">
                          Values shown at {star}★; raise the star level to scale sub-properties.
                        </p>
                      )}
                      {rarity === "R" && arc === "ASTRAL_REIGN" && (
                        <p className="text-[12.5px] text-[var(--realm-caro)]">
                          Astral Reign: Common (R) secondary effects are disabled — only the main
                          stat applies.
                        </p>
                      )}
                    </Section>
                  ) : (
                    d && (
                      <p className="rounded-lg border border-[var(--border)] bg-[var(--bg-2)] px-3 py-2 text-[13px] text-[var(--text-dim)]">
                        This wheel has no combat effect — it contributes its main stat only.
                      </p>
                    )
                  )}
                </>
              );
            })()}

          {/* ---- COVENANT ---- */}
          {target.kind === "covenant" &&
            (() => {
              const e = roster.covenants[target.id];
              const d = detail && detail.kind === "covenant" ? detail : null;
              const three = !!e?.threePieceComplete;
              const six = !!e?.sixPieceComplete;
              const completion = e?.completionPercent ?? 0;
              return (
                <>
                  <Toggle label="Owned" checked={!!e?.owned} onChange={(v) => setCovenantOwned(target.id, v)} />
                  <Toggle
                    label="3-piece set active"
                    checked={three}
                    onChange={(v) => setCovenantThreePiece(target.id, v)}
                  />
                  <Toggle
                    label="6-piece set complete"
                    checked={six}
                    onChange={(v) => setCovenantSixPiece(target.id, v)}
                  />

                  <Section title="Completion">
                    <div className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-2)] px-3 py-2">
                      <span className="text-sm text-[var(--text)]">Completion %</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.1"
                        min={0}
                        max={100}
                        value={completion}
                        onChange={(ev) => {
                          const raw = parseFloat(ev.target.value);
                          const v = Number.isFinite(raw) ? Math.max(0, Math.min(100, raw)) : 0;
                          setCovenantCompletion(target.id, v);
                        }}
                        className="ml-auto w-24 rounded border border-[var(--border)] bg-[var(--panel)] px-2 py-1 text-right text-sm tabular-nums text-[var(--text)] focus:border-[var(--gold)] focus:outline-none"
                      />
                      <span className="text-sm text-[var(--text-dim)]">%</span>
                    </div>
                    <p className="text-[12.5px] text-[var(--text-dim)]">
                      Well-rolled priority substats at lower completion can beat scattered substats
                      at higher completion.
                    </p>
                  </Section>

                  <Section title="Substats">
                    <div className="grid grid-cols-2 gap-2">
                      {COVENANT_SUBSTATS.map((s) => {
                        const val = e?.substatTotals?.[s.key] ?? 0;
                        return (
                          <label
                            key={s.key}
                            className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg-2)] px-2.5 py-1.5"
                          >
                            <span className="min-w-0 flex-1 truncate text-[13px] text-[var(--text-muted)]">
                              {s.label}
                            </span>
                            <input
                              type="number"
                              inputMode="decimal"
                              step="0.1"
                              min={0}
                              value={val || ""}
                              placeholder="0"
                              onChange={(ev) => {
                                const raw = parseFloat(ev.target.value);
                                setCovenantSubstat(
                                  target.id,
                                  s.key,
                                  Number.isFinite(raw) ? Math.max(0, raw) : 0
                                );
                              }}
                              className="w-16 rounded border border-[var(--border)] bg-[var(--panel)] px-1.5 py-1 text-right text-[13px] tabular-nums text-[var(--text)] focus:border-[var(--gold)] focus:outline-none"
                            />
                            {s.suffix && (
                              <span className="text-[12.5px] text-[var(--text-dim)]">{s.suffix}</span>
                            )}
                          </label>
                        );
                      })}
                    </div>
                    <p className="text-[12.5px] text-[var(--text-dim)]">
                      Record your rolled substat totals across the set (optional).
                    </p>
                  </Section>

                  {d && (
                    <Section title="Set Effects">
                      {d.setEffects
                        .sort((a, b) => a.set - b.set)
                        .map((se) => {
                          const active = se.set === 3 ? three || six : six;
                          return (
                            <div
                              key={se.set}
                              className={`rounded-lg border px-3 py-2 transition ${
                                active
                                  ? "border-[var(--gold)]/40 bg-[var(--bg-2)]"
                                  : "border-[var(--border)] opacity-60"
                              }`}
                            >
                              <div className="mb-0.5 flex items-center gap-2">
                                <span className="font-title rounded bg-[var(--panel-2)] px-1.5 py-0.5 text-[12px] uppercase tracking-wider text-[var(--text-dim)]">
                                  {se.set}-piece
                                </span>
                                {active && (
                                  <span className="text-[12px] text-[var(--gold-bright)]">active</span>
                                )}
                              </div>
                              <ScaledText
                                template={se.descriptionTemplate}
                                args={se.descriptionArgs}
                                index={0}
                                className="text-[13.5px] leading-relaxed text-[var(--text-muted)]"
                              />
                            </div>
                          );
                        })}
                      {d.acquisitionSource && (
                        <p className="text-[12.5px] text-[var(--text-dim)]">
                          Source: {d.acquisitionSource}
                        </p>
                      )}
                    </Section>
                  )}
                </>
              );
            })()}

          {/* ---- POSSE ---- */}
          {target.kind === "posse" &&
            (() => {
              const e = roster.posses[target.id];
              const d = detail && detail.kind === "posse" ? detail : null;
              return (
                <>
                  <Toggle
                    label="Unlocked"
                    checked={!!e?.unlocked}
                    onChange={(v) => setPosseUnlocked(target.id, v)}
                  />
                  {d && d.descriptionTemplate && (
                    <Section title="Effect">
                      <div className="rounded-lg border border-[var(--gold)]/30 bg-[var(--bg-2)] px-3 py-2.5">
                        <ScaledText
                          template={d.descriptionTemplate}
                          args={d.descriptionArgs}
                          index={0}
                          className="text-[13.5px] leading-relaxed text-[var(--text-muted)]"
                        />
                      </div>
                    </Section>
                  )}
                  {d && (d.hasCharacterBonus || d.acquisitionSource) && (
                    <Section title="Details">
                      {d.hasCharacterBonus && (
                        <p className="rounded-lg border border-[var(--gold)]/30 bg-[var(--bg-2)] px-3 py-2 text-[13px] text-[var(--gold-bright)]">
                          Grants a personal bonus to its affiliated awakener.
                        </p>
                      )}
                      {d.acquisitionSource && (
                        <p className="text-[12.5px] text-[var(--text-dim)]">
                          Source: {d.acquisitionSource}
                        </p>
                      )}
                    </Section>
                  )}
                </>
              );
            })()}
        </div>
      </div>
    </div>
  );
}