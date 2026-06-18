"use client";

import { useEffect } from "react";
import { useRosterStore } from "@/lib/store";
import type { EnlightenSlot, SkillSlot, Realm } from "@/lib/types";
import { RealmSigil, REALM_COLOR } from "./realm";

/* Detail modal — the "open up and customize / view" menu for any entity.
   Houses the full granularity the quick grid can't: every enlighten slot plus
   copies, character + skill + talent levels for awakeners, and star/stack for
   wheels. */

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

const ENLIGHTEN: EnlightenSlot[] = ["E0", "E1", "E2", "E3", "OE", "AA"];
const SKILLS: { slot: SkillSlot; label: string }[] = [
  { slot: "Strike", label: "Strike" },
  { slot: "Defense", label: "Defense" },
  { slot: "Skill1", label: "Skill 1" },
  { slot: "Skill2", label: "Skill 2" },
  { slot: "Rouse", label: "Rouse" },
  { slot: "Exalt", label: "Exalt" },
  { slot: "OverExalt", label: "Over-Exalt" },
];
const ASSET_DIR: Record<DetailTarget["kind"], string> = {
  awakener: "portraits",
  wheel: "wheels",
  covenant: "covenants",
  posse: "posses",
};

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
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  const clamp = (v: number) => Math.max(min, Math.min(max, v));
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-2)] px-3 py-2">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-sm text-[var(--text)]">{label}</span>
        <span className="tabular-nums text-xs text-[var(--text-dim)]">
          {value} / {max}
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
      <h4 className="font-title mb-2 text-[11px] uppercase tracking-wider text-[var(--text-dim)]">
        {title}
      </h4>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

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
  const setCovenantSixPiece = useRosterStore((s) => s.setCovenantSixPiece);
  const setCovenantCompletion = useRosterStore((s) => s.setCovenantCompletion);
  const setPosseUnlocked = useRosterStore((s) => s.setPosseUnlocked);

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

  const realm = "realm" in target ? target.realm : undefined;
  const rarity = "rarity" in target ? target.rarity : undefined;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className="relative z-10 max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[var(--gold)]/40 bg-[var(--panel)] shadow-[0_20px_60px_rgba(0,0,0,0.6)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start gap-4 border-b border-[var(--border)] p-4">
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
              {realm && <RealmSigil realm={realm} size={18} />}
              <span className="font-title text-[10px] uppercase tracking-wider text-[var(--text-dim)]">
                {target.kind}
              </span>
            </div>
            <h3 className="font-display mt-1 text-2xl font-semibold leading-tight text-[var(--text)]">
              {target.name}
            </h3>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {rarity && (
                <span className="rounded border border-[var(--border)] px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-[var(--text-muted)]">
                  {rarity}
                </span>
              )}
              {realm && (
                <span
                  className="rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide"
                  style={{ color: REALM_COLOR[realm] ?? "var(--text-dim)" }}
                >
                  {realm}
                </span>
              )}
              {target.kind === "awakener" && target.isDivineRealm && (
                <span className="rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-[var(--silver)]">
                  Divine
                </span>
              )}
              {target.kind === "awakener" && target.isLemurian && (
                <span className="rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-[var(--silver)]">
                  Lemurian
                </span>
              )}
              {target.kind === "posse" && target.hasCharacterBonus && (
                <span className="rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-[var(--gold)]">
                  Character bonus
                </span>
              )}
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
          {target.kind === "awakener" &&
            (() => {
              const e = roster.awakeners[target.id];
              const owned = !!e?.owned;
              const slot = e?.enlightenSlot ?? "E0";
              const copies = e?.enlightenCopies ?? 0;
              return (
                <>
                  <Toggle
                    label="Owned"
                    checked={owned}
                    onChange={(v) => setAwakenerOwned(target.id, v)}
                  />

                  <Section title="Enlighten">
                    <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-2)] px-3 py-2">
                      <div className="flex flex-wrap gap-1.5">
                        {ENLIGHTEN.map((s) => (
                          <button
                            key={s}
                            onClick={() => setEnlightenLevel(target.id, s, copies)}
                            className={`rounded-md border px-3 py-1.5 text-sm transition ${
                              slot === s
                                ? "border-[var(--gold)] bg-[var(--panel-2)] text-[var(--gold-bright)]"
                                : "border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text)]"
                            }`}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                    <Stepper
                      label="Over-enlighten copies"
                      value={copies}
                      min={0}
                      max={12}
                      onChange={(v) => setEnlightenLevel(target.id, slot, v)}
                    />
                  </Section>

                  <Section title="Level">
                    <Stepper
                      label="Character level"
                      value={e?.characterLevel ?? 1}
                      min={1}
                      max={80}
                      onChange={(v) => setCharacterLevel(target.id, v)}
                    />
                  </Section>

                  <Section title="Skills">
                    {SKILLS.map(({ slot: sk, label }) => (
                      <Stepper
                        key={sk}
                        label={label}
                        value={e?.skillLevels?.[sk] ?? 1}
                        min={1}
                        max={6}
                        onChange={(v) => setSkillLevel(target.id, sk, v)}
                      />
                    ))}
                  </Section>

                  <Section title="Talents">
                    <Stepper
                      label="Madness Omen"
                      value={e?.talentLevels?.madnessOmen ?? 0}
                      min={0}
                      max={12}
                      onChange={(v) => setTalentLevel(target.id, "madnessOmen", v)}
                    />
                    <Stepper
                      label="Soulforge Aptitude"
                      value={e?.talentLevels?.soulforgeAptitude ?? 0}
                      min={0}
                      max={10}
                      onChange={(v) => setTalentLevel(target.id, "soulforgeAptitude", v)}
                    />
                    <Stepper
                      label="Gnostic Potential"
                      value={e?.talentLevels?.gnosticPotential ?? 0}
                      min={0}
                      max={5}
                      onChange={(v) => setTalentLevel(target.id, "gnosticPotential", v)}
                    />
                  </Section>
                </>
              );
            })()}

          {target.kind === "wheel" &&
            (() => {
              const e = roster.wheels[target.id];
              const owned = !!e?.owned;
              return (
                <>
                  <Toggle
                    label="Owned"
                    checked={owned}
                    onChange={(v) => setWheelOwned(target.id, v)}
                  />
                  <Section title="Enlighten">
                    <Stepper
                      label="Star level (ascension)"
                      value={e?.starLevel ?? 0}
                      min={0}
                      max={3}
                      onChange={(v) => setWheelStarLevel(target.id, v)}
                    />
                    <Stepper
                      label="Stack level"
                      value={e?.stackLevel ?? 0}
                      min={0}
                      max={12}
                      onChange={(v) => setWheelStackLevel(target.id, v)}
                    />
                    {(e?.stackLevel ?? 0) >= 12 && (
                      <p className="text-[11px] text-[var(--realm-aequor)]">
                        Stack 12 unlocks the dual-SSR exception — this wheel can be
                        assigned to two awakeners at once.
                      </p>
                    )}
                  </Section>
                </>
              );
            })()}

          {target.kind === "covenant" &&
            (() => {
              const e = roster.covenants[target.id];
              return (
                <>
                  <Toggle
                    label="Owned"
                    checked={!!e?.owned}
                    onChange={(v) => setCovenantOwned(target.id, v)}
                  />
                  <Toggle
                    label="Six-piece set complete"
                    checked={!!e?.sixPieceComplete}
                    onChange={(v) => setCovenantSixPiece(target.id, v)}
                  />
                  <Section title="Progress">
                    <Stepper
                      label="Completion %"
                      value={e?.completionPercent ?? 0}
                      min={0}
                      max={100}
                      onChange={(v) => setCovenantCompletion(target.id, v)}
                    />
                  </Section>
                </>
              );
            })()}

          {target.kind === "posse" &&
            (() => {
              const e = roster.posses[target.id];
              return (
                <Toggle
                  label="Unlocked"
                  checked={!!e?.unlocked}
                  onChange={(v) => setPosseUnlocked(target.id, v)}
                />
              );
            })()}
        </div>
      </div>
    </div>
  );
}