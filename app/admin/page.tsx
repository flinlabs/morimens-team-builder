import { getAwakeners, getWheels, getCovenants, getPosses } from "@/lib/db";
import RosterBuilder, { type Catalog } from "@/components/RosterBuilder";
import { segmentTemplate } from "@/lib/template";

// The DB is read from disk at request time; render dynamically.
export const dynamic = "force-dynamic";

// Resolve a description template to plain text (set effects are fixed, index 0).
function plain(template?: string, args?: Record<string, unknown>): string {
  if (!template) return "";
  try {
    return segmentTemplate(template, args as never, 0)
      .map((s) => s.text)
      .join("")
      .replace(/\s+/g, " ")
      .trim();
  } catch {
    return "";
  }
}

export default function Home() {
  const awakeners = getAwakeners();
  const wheels = getWheels();
  const covenants = getCovenants();
  const posses = getPosses();

  // Lightweight projection sent to the client — no heavy descriptions/skills.
  const catalog: Catalog = {
    awakeners: Object.values(awakeners).map((a) => ({
      id: a.id,
      name: a.name,
      realm: a.realm,
      rarity: a.rarity,
      type: a.type,
      roles: a.annotation?.teamRoles ?? [],
      isDivineRealm: !!a.isDivineRealm,
      isLemurian: !!a.isLemurian,
    })),
    wheels: Object.values(wheels).map((w) => ({
      id: w.id,
      name: w.name,
      realm: w.realm,
      rarity: w.rarity,
      mainstatKey: w.mainstatKey,
      effect: w.hasCombatEffect ? plain(w.descriptionTemplate, w.descriptionArgs) : undefined,
    })),
    covenants: Object.values(covenants).map((c) => {
      // The 6-set is the build-defining bonus; fall back to the 3-set.
      const sets = c.setEffects ?? [];
      const six = sets.find((s) => s.set === 6) ?? sets[sets.length - 1];
      const three = sets.find((s) => s.set === 3);
      // The 3-set is a flat stat (e.g. "Death Resistance +16.8%") — keep just the
      // category for the tile subtitle.
      const threePlain = three ? plain(three.descriptionTemplate, three.descriptionArgs) : "";
      const cut = threePlain.split("+")[0].trim();
      const mainstat = cut && cut.length <= 28 ? cut : undefined;
      return {
        id: c.id,
        name: c.name,
        mainstat,
        effect: plain(six?.descriptionTemplate, six?.descriptionArgs),
        effect3: three ? threePlain : undefined,
      };
    }),
    posses: Object.values(posses).map((p) => ({
      id: p.id,
      name: p.name,
      realm: p.realm,
      hasCharacterBonus: p.hasCharacterBonus,
      effect: plain(p.descriptionTemplate, p.descriptionArgs),
    })),
  };

  return (
    <>
      <RosterBuilder catalog={catalog} />
      <footer className="mx-auto max-w-[1400px] px-6 pb-10 pt-4 text-center text-xs leading-relaxed text-[var(--text-dim)]">
        <div className="gold-rule mx-auto mb-4 h-px w-40" />
        Unofficial fan project, not affiliated with Qookka Games. Character art and
        in-game assets are © Qookka Games. Game data via SKeyDB.
      </footer>
    </>
  );
}