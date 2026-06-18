/** GET /api/detail?kind=awakener&id=awakener-0001

Lazy-loads the full effect text for a single entity so the roster grid can stay
light (it only ships names + realm + rarity) while the detail modal gets the
rich, scaling descriptions on demand. Node runtime — reads db/*.json from disk. */

import { NextResponse } from "next/server";
import { getAwakener, getWheel, getCovenant, getPosse } from "@/lib/db";
import { RECORD_SLOT_TO_ROSTER } from "@/lib/enlighten";
import type { EnlightenSlot } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SKILL_ORDER: Record<string, number> = {
  Strike: 0,
  Defense: 1,
  Skill1: 2,
  Skill2: 3,
  Rouse: 4,
  Exalt: 5,
  OverExalt: 6,
};

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const kind = searchParams.get("kind");
  const id = searchParams.get("id");

  if (!kind || !id) {
    return NextResponse.json({ error: "kind and id are required." }, { status: 400 });
  }

  try {
    if (kind === "awakener") {
      const a = getAwakener(id);
      if (!a) return NextResponse.json({ error: "Not found." }, { status: 404 });

      const enlightens = (a.enlightens ?? [])
        .map((e) => ({
          id: e.id,
          name: e.name,
          slot: (RECORD_SLOT_TO_ROSTER[e.slot] ?? e.slot) as EnlightenSlot,
          descriptionTemplate: e.descriptionTemplate,
          descriptionArgs: e.descriptionArgs ?? {},
        }))
        .sort(
          (x, y) =>
            (["E1", "E2", "E3", "OE", "AA"].indexOf(x.slot) ?? 9) -
            (["E1", "E2", "E3", "OE", "AA"].indexOf(y.slot) ?? 9)
        );

      const skills = (a.skills ?? [])
        .map((s) => ({
          id: s.id,
          name: s.name,
          slot: s.slot,
          cost: s.cost ?? null,
          cardKeywords: s.cardKeywords ?? [],
          descriptionTemplate: s.descriptionTemplate,
          descriptionArgs: s.descriptionArgs ?? {},
        }))
        .sort((x, y) => (SKILL_ORDER[x.slot] ?? 9) - (SKILL_ORDER[y.slot] ?? 9));

      const talents = (a.talents ?? []).map((t) => ({
        id: t.id,
        name: t.name,
        family: t.family,
        maxLevel: t.maxLevel,
        defaultMaxed: !!t.defaultMaxed,
        descriptionTemplate: t.descriptionTemplate,
        descriptionArgs: t.descriptionArgs ?? {},
      }));

      return NextResponse.json({
        kind,
        id: a.id,
        name: a.name,
        realm: a.realm,
        type: a.type,
        faction: a.faction,
        rarity: a.rarity,
        isDivineRealm: !!a.isDivineRealm,
        isLemurian: !!a.isLemurian,
        searchTags: a.searchTags ?? [],
        annotationNotes: a.annotation?.notes ?? null,
        teamRoles: a.annotation?.teamRoles ?? [],
        enlightens,
        skills,
        talents,
      });
    }

    if (kind === "wheel") {
      const w = getWheel(id);
      if (!w) return NextResponse.json({ error: "Not found." }, { status: 404 });
      return NextResponse.json({
        kind,
        id: w.id,
        name: w.name,
        rarity: w.rarity,
        realm: w.realm,
        mainstatKey: w.mainstatKey,
        ownerAwakenerName: w.ownerAwakenerName ?? null,
        isMythic: !!w.isMythic,
        isNWheel: !!w.isNWheel,
        hasCombatEffect: !!w.hasCombatEffect,
        descriptionTemplate: w.descriptionTemplate ?? "",
        descriptionArgs: w.descriptionArgs ?? {},
        lore: w.lore ?? null,
      });
    }

    if (kind === "covenant") {
      const c = getCovenant(id);
      if (!c) return NextResponse.json({ error: "Not found." }, { status: 404 });
      return NextResponse.json({
        kind,
        id: c.id,
        name: c.name,
        acquisitionSource: c.acquisitionSource ?? null,
        lore: c.lore ?? null,
        setEffects: (c.setEffects ?? []).map((e) => ({
          set: e.set,
          descriptionTemplate: e.descriptionTemplate,
          descriptionArgs: e.descriptionArgs ?? {},
        })),
      });
    }

    if (kind === "posse") {
      const p = getPosse(id);
      if (!p) return NextResponse.json({ error: "Not found." }, { status: 404 });
      return NextResponse.json({
        kind,
        id: p.id,
        name: p.name,
        realm: p.realm,
        acquisitionSource: p.acquisitionSource ?? null,
        lore: p.lore ?? null,
        hasCharacterBonus: !!p.hasCharacterBonus,
        characterBonusFor: p.characterBonusFor ?? null,
        descriptionTemplate: p.descriptionTemplate ?? "",
        descriptionArgs: p.descriptionArgs ?? {},
      });
    }

    return NextResponse.json({ error: `Unknown kind "${kind}".` }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Failed to load detail." }, { status: 500 });
  }
}