"use client";

/* Rendered team card — the canonical way a composition is shown anywhere in the
   app. Extracted from RosterBuilder so the Meta tab can render curated and
   projected comps in exactly the same shape as generated ones (portraits, gear,
   posse, archetype chips, and the "How this team works" breakdown) rather than
   inventing a second, thinner format for the same thing. */

import { useMemo, useState } from "react";
import type { CharacterAssignment, TeamRecommendation } from "@/lib/types";
import type { Catalog } from "./RosterBuilder";
import FormationBoard, {
  type SlotPlan,
  type PosseInfo,
} from "./FormationBoard";
import { KeywordText } from "@/lib/template";
import TeamScore from "./TeamScore";

export default function TeamFormation({
  team,
  awakeners,
  planFor,
  wheelMeta,
  covenantMeta,
  posseMeta,
}: {
  team: TeamRecommendation;
  awakeners: Catalog["awakeners"];
  planFor: (c: CharacterAssignment) => SlotPlan;
  wheelMeta?: Record<string, { name: string }>;
  covenantMeta?: Record<string, { name: string }>;
  posseMeta?: Record<string, PosseInfo>;
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
  const altPosseId = team.posseRecommendations?.[0]?.posseId;

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--panel)]/40 p-3 sm:p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h3 className="font-title text-sm text-[var(--gold-bright)]">Team {team.rank}</h3>
        {team.realmNote && (
          <span className="text-xs text-[var(--realm-caro)]">{team.realmNote}</span>
        )}
        {typeof team.score === "number" && (
          <span className="ml-auto">
            <TeamScore
              score={team.score}
              breakdown={team.scoreBreakdown}
              memberCount={team.composition.length}
            />
          </span>
        )}
      </div>
      <p className="font-display mb-2 text-[15px] leading-snug text-[var(--text)]">
        {team.compositionNote}
      </p>

      {team.analysis && team.analysis.archetypes.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {team.analysis.archetypes.map((label) => (
            <span
              key={label}
              className="rounded-full border border-[var(--gold)]/30 bg-[var(--gold)]/10 px-2 py-0.5 text-[11px] font-medium text-[var(--gold-bright)]"
            >
              {label}
            </span>
          ))}
        </div>
      )}

      {team.analysis &&
        (team.analysis.chain.length > 0 || team.analysis.contributions.length > 0) && (
          <details className="mb-3">
            <summary className="cursor-pointer select-none text-[12.5px] text-[var(--text-dim)] transition hover:text-[var(--text-muted)]">
              How this team works
            </summary>
            <div className="mt-2 space-y-2">
              {team.analysis.chain.length > 0 && (
                <ul className="space-y-1 text-[13px] leading-snug text-[var(--text-muted)]">
                  {team.analysis.chain.map((line, i) => (
                    <li key={i} className="flex gap-1.5">
                      <span className="shrink-0 text-[var(--gold)]/60">→</span>
                      <span>
                        <KeywordText text={line} />
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {team.analysis.contributions.length > 0 && (
                <div className="space-y-1 border-t border-[var(--border)] pt-2">
                  {team.analysis.contributions.map((c) => (
                    <div
                      key={c.awakenerId}
                      className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[12.5px] leading-snug"
                    >
                      <span className="shrink-0 font-semibold text-[var(--text)]">{c.name}</span>
                      <span className="shrink-0 rounded bg-[var(--panel-2)] px-1.5 text-[11px] text-[var(--text-dim)]">
                        {c.roleLabel}
                      </span>
                      <span className="text-[var(--text-muted)]">
                        <KeywordText text={c.text} />
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </details>
        )}

      <FormationBoard
        awakeners={awakeners}
        slots={slots}
        plans={initialPlans}
        posseId={altPosseId}
        onChangeSlots={setSlots}
        wheelMeta={wheelMeta}
        covenantMeta={covenantMeta}
        posseMeta={posseMeta}
      />

      {team.investmentWarnings.length > 0 && (
        <ul className="mt-2.5 space-y-0.5 text-[12.5px] text-[var(--realm-chaos)]">
          {team.investmentWarnings.map((w, i) => (
            <li key={i}>• {w}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
