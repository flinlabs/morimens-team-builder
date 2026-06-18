import { getAwakeners, getWheels, getCovenants, getPosses } from "@/lib/db";
import RosterBuilder, { type Catalog } from "@/components/RosterBuilder";

// The DB is read from disk at request time; render dynamically.
export const dynamic = "force-dynamic";

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
      isDivineRealm: !!a.isDivineRealm,
      isLemurian: !!a.isLemurian,
    })),
    wheels: Object.values(wheels).map((w) => ({
      id: w.id,
      name: w.name,
      rarity: w.rarity,
    })),
    covenants: Object.values(covenants).map((c) => ({
      id: c.id,
      name: c.name,
    })),
    posses: Object.values(posses).map((p) => ({
      id: p.id,
      name: p.name,
      realm: p.realm,
      hasCharacterBonus: p.hasCharacterBonus,
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