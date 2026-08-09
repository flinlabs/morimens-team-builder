"use client";

/* Team score, with the arithmetic behind it one click away.

   A bare number would be worse than nothing here — nobody can tell whether
   1.08 is good, and a score with no visible derivation invites people to treat
   it as authoritative. So the chip carries calibration (what a random four
   scores versus a curated comp) and the panel shows every term that produced
   the total, in the order they are applied, with a note on what moves each one.

   The point is debuggability: when the engine ranks something strangely, the
   breakdown should make it obvious which term is responsible. */

import { useEffect, useRef, useState } from "react";
import type { ScoreComponent } from "@/lib/types";

/* Calibration measured against the current scorer: a random four scores about
   0.31-0.47, the twelve curated comps score 1.03-1.16 with every member at E0,
   and 1.23-1.37 fully invested. Bands are deliberately coarse — this is a
   relative ranking signal, not a rating anyone should optimise against. */
function band(score: number): { label: string; className: string } {
  if (score >= 1.2)
    return {
      label: "Strong",
      className: "border-[var(--gold)] bg-[var(--gold)]/15 text-[var(--gold-bright)]",
    };
  if (score >= 1.0)
    return {
      label: "Solid",
      className: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
    };
  if (score >= 0.7)
    return {
      label: "Workable",
      className: "border-[var(--border-bright)] bg-[var(--bg-3)] text-[var(--text-muted)]",
    };
  return {
    label: "Loose",
    className: "border-[var(--realm-caro)]/50 bg-[var(--realm-caro)]/10 text-[var(--realm-caro)]",
  };
}

export default function TeamScore({
  score,
  breakdown,
  memberCount,
  compact = false,
}: {
  score: number;
  breakdown?: ScoreComponent[];
  /** Below four, the score is not comparable with a full team. */
  memberCount?: number;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const tone = band(score);
  const partial = typeof memberCount === "number" && memberCount < 4;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span ref={wrapRef} className="relative inline-flex items-center gap-1.5">
      <span
        className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider tabular-nums ${tone.className}`}
      >
        {score.toFixed(2)}
        {!compact && ` · ${tone.label}`}
      </span>
      <button
        type="button"
        aria-label="How is this score calculated?"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="flex h-4 w-4 items-center justify-center rounded-full border border-[var(--border-bright)] text-[10px] font-bold leading-none text-[var(--text-dim)] transition hover:border-[var(--gold)] hover:text-[var(--gold-bright)]"
      >
        ?
      </button>

      {open && (
        <span
          role="dialog"
          aria-label="Score breakdown"
          className="absolute right-0 top-6 z-50 w-[min(22rem,80vw)] rounded-lg border border-[var(--border-bright)] bg-[var(--bg-2)] p-3 text-left shadow-2xl"
        >
          <span className="font-title mb-1 block text-[11px] uppercase tracking-wider text-[var(--gold-bright)]">
            Team score {score.toFixed(2)}
          </span>

          <span className="mb-2 block text-[11px] leading-relaxed text-[var(--text-dim)]">
            This is what the generator ranks by — the same number, not a
            recalculation. For scale: a random four lands around 0.3–0.5, the curated
            meta comps score about 1.05 with everyone at E0 and about 1.3 fully invested.
            It is a relative signal for comparing lineups, not a rating worth optimising.
          </span>

          {partial && (
            <span className="mb-2 block rounded border border-[var(--realm-caro)]/40 bg-[var(--realm-caro)]/5 p-1.5 text-[11px] text-[var(--realm-caro)]">
              Only {memberCount} slot{memberCount === 1 ? "" : "s"} filled. Investment is
              an average, so a partial team is not comparable with a full one.
            </span>
          )}

          {breakdown && breakdown.length > 0 && (
            <span className="block divide-y divide-[var(--border)]">
              {breakdown.map((c) => (
                <span key={c.label} className="block py-1.5">
                  <span className="flex items-baseline gap-2">
                    <span className="text-[11px] font-semibold text-[var(--text-muted)]">
                      {c.label}
                    </span>
                    <span
                      className={`ml-auto text-[11px] tabular-nums ${
                        c.value > 0
                          ? "text-emerald-400"
                          : c.value < 0
                            ? "text-[var(--realm-caro)]"
                            : "text-[var(--text-dim)]"
                      }`}
                    >
                      {c.value > 0 ? "+" : ""}
                      {c.value.toFixed(2)}
                    </span>
                  </span>
                  <span className="mt-0.5 block text-[10px] leading-relaxed text-[var(--text-dim)]">
                    {c.detail}
                  </span>
                </span>
              ))}
            </span>
          )}

          <span className="mt-2 block border-t border-[var(--border)] pt-2 text-[10px] leading-relaxed text-[var(--text-dim)]">
            Scoring only sees what the annotations record. If a team you know is strong
            scores poorly, the likely cause is a missing pairing or role tag rather than
            the team being wrong — that is worth reporting.
          </span>
        </span>
      )}
    </span>
  );
}
