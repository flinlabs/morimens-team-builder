# Morimens Team Builder

An unofficial, fan-made team builder for [**Morimens**](https://morimens.qookkagames.com/), the gacha deck-building RPG. You record what you own — Awakeners, Wheels of Destiny, Covenants, Posses, your Keeper level — and the app builds optimized, fully-geared teams from your roster, then lets you fine-tune them on an in-game-style lineup board.

It is not affiliated with or endorsed by Qookka Games. Game data and art belong to their respective owners (see [Credits](#credits--data-sources)).

---

## What it does

- **Inventory management.** Mark which Awakeners, Wheels, Covenants, and Posses you own, with full investment detail — enlighten level (E0–E3 then +1…+12), skill and talent levels, wheel star/stack, covenant completion, and your account Keeper level.
- **Team generation.** A deterministic engine ranks and gears teams from your owned roster. Two modes: **Single Team** (a working lineup plus alternates) and **D-Tide ×5** (five teams with no unit or wheel shared between them).
- **Build-around-pins.** Place characters by hand and pin them; generation keeps your pins and builds the rest of the team — and the alternates — around them.
- **Editable lineup.** Every slot's wheel and covenant, and each team's posse, are editable directly on the board from your owned inventory.
- **Real in-game numbers.** Skill cards show the actual command-card values (ATK × skill% resolved against the character's level), not raw percentages. Wheel main stats and the Keeper HP/level-cap curves are computed from the same game-data tables.
- **BiS recommendations.** Wheel and covenant picks come from the community Mythag Compendium best-in-slot tables, with role-aware build variants (e.g. a unit slotted as a carry pulls its DPS set, as a support pulls its support set).

The generation is **AI-free**: the deterministic algorithm makes every decision. Any future AI layer would only narrate an already-decided result.

---

## Tech stack

- [Next.js 14](https://nextjs.org/) (App Router) + React + TypeScript
- [Tailwind CSS](https://tailwindcss.com/) for styling
- [Zustand](https://github.com/pmndrs/zustand) for client state, persisted to `localStorage`
- Node scripts for data sync and asset fetching

---

## Getting started

### Prerequisites

- **Node.js 18.17+** and npm

### Install and run

```bash
# 1. Install dependencies
npm install

# 2. Populate the reference data (db/*.json) from SKeyDB + curated annotations
npm run sync

# 3. Download the UI art (portraits, wheel/covenant/posse icons) into public/assets
npm run assets

# 4. Start the dev server
npm run dev
```

Then open <http://localhost:3000>.

> **Why steps 2–3?** `db/*.json` and `public/assets/` are **gitignored** and rebuilt from source, so a fresh clone won't have them until you sync. The `prebuild` hook runs both automatically before `npm run build`, so production builds self-populate.

### Build for production

```bash
npm run build   # runs sync + assets first via the prebuild hook
npm start
```

---

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Start the Next.js dev server |
| `npm run build` | Production build (prebuild syncs data + assets first) |
| `npm start` | Serve the production build |
| `npm run lint` | Run ESLint |
| `npm run sync` | Regenerate `db/*.json` from SKeyDB + `annotations/` |
| `npm run assets` | Download image assets into `public/assets/` (add `--force` to re-fetch) |

---

## Project structure

```
app/
  page.tsx              # entry — renders the Team Builder UI
  api/
    generate/route.ts   # POST: roster -> ranked, geared team recommendations
    detail/route.ts     # GET:  per-entity effect/stat detail for the modal
  admin/                # annotation editor + sync-status pages
components/
  RosterBuilder.tsx     # top-level UI: Inventory / Teams tabs, lineup, generation
  FormationBoard.tsx    # the editable in-game-style lineup board
  DetailModal.tsx       # per-character / wheel / covenant customize + detail
  realm.tsx             # realm sigils, colors, sort ranks
lib/
  generate.ts           # orchestration entry point (generateTeams)
  filter.ts             # member selection: realm legality, role coverage, class cap, D-Tide solver
  assign.ts             # gearing: wheels, covenants, posses (BiS-driven)
  viability.ts          # per-unit investment scoring (arc-aware)
  stats.ts              # stat-growth, card numbers, wheel main stat, keeper HP / level cap
  enlighten.ts          # enlighten copy math (E0–E3, +1…+12, OE/AA milestones)
  template.tsx          # scaling description renderer (resolves stat % -> real numbers)
  roster.ts / store.ts  # roster model + Zustand store (localStorage persistence)
  db.ts / types.ts      # data loaders and shared types
scripts/
  sync-skeydb.mjs       # fetch + hydrate game data from SKeyDB
  fetch-assets.mjs      # download UI art from SKeyDB's asset manifest
db/                      # generated reference data (gitignored)
annotations/             # hand-curated per-awakener roles, tiers, pairings, notes
```

---

## How it works

1. **Data layer.** `npm run sync` pulls catalogs and per-record text from [SKeyDB](https://github.com/dansa/SKeyDB), hydrates descriptions, retags Mythic wheels, flags character-bonus posses, and merges the curated `annotations/`. The result lands in `db/`: 57 awakeners, 134 wheels, 21 covenants, 51 posses, plus D-Tide season metadata. Two derived datasets accompany them — `db/bis.json` (the parsed Mythag Compendium best-in-slot tables) and `db/gameplay-math.json` (the stat-growth, Keeper, and wheel main-stat curves from SKeyDB's metadata).
2. **Algorithm layer.** `lib/` turns a roster into recommendations with no AI in the loop: viability scoring, realm legality, role coverage, a class cap (no more than two ASSAULT units), synergy, candidate combination, and a greedy five-team D-Tide solver — then deterministic wheel/covenant/posse assignment from owned inventory.
3. **UI layer.** `RosterBuilder` (Inventory + Teams tabs) binds the Zustand store to the formation board and the `/api/generate` endpoint, with full investment detail in `DetailModal`.

---

## Credits & data sources

- **Game data:** [SKeyDB](https://github.com/dansa/SKeyDB) by dansa — Awakener, Wheel, Covenant, Posse records and the gameplay-math metadata.
- **Best-in-slot tables & guides:** the **Mythag University / Mythag Compendium** community resources.
- **Art:** © Qookka Games. Portraits and icons are fetched at build time for personal, non-commercial fan use; they are gitignored and not redistributed with this project.

This is a fan project. Morimens and all related names, art, and content are the property of Qookka Games.

---

## Status & roadmap

The deterministic core and the full builder UI are in place. Known follow-ups:

- Card numbers resolve against level and enlighten but do not yet layer in ATK% from equipped wheels/covenants, so they read slightly low versus a fully-geared in-game card.
- The Keeper → character-level cap uses `min(keeper level, dupe cap)`; if the game gates the cap at specific breakpoints, those can be dropped in.
- An optional, strictly post-hoc AI narration pass over the already-decided result.
- A boss / matchup-aware generation mode.