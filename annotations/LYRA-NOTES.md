# Lyra Spreadsheet — cross-check notes (2026-07-09)

Source: Lyra Spreadsheet (@Shu_Lyr4), guide sheets extracted to PDFs + OCR text.
Applied changes are listed first; everything under "Needs your call" was left
untouched because sources disagree or my read of the image wasn't certain
enough to encode.

## Applied

Synergy edges added (each named in the guide's own synergy sections, confirmed
in OCR body text or clearly legible banner labels):

- Pontos += Murphy: Fauxborn, Tulu, Tawil, Celeste, Vortice, Miryam, Hameln
- Vortice += Pontos, Corposant, Tawil, Tulu, Caecus, Miryam, Doll: Inferno, Murphy: Fauxborn
- Castor += Clementine, Hameln, Horla, Winkle
- Pollux += Hameln, Thais, Erica
- Mouchette += Lotan, Hameln
- Arachne += Hameln, Kathigu-Ra, Casiah
- Hameln += Pontos, Corposant, Kathigu-Ra, Ryker, Tulu

Pontos corrections (his data previously came from a single source):

- enlightenBreakpoints: E2/E3 → E1/E3. Lyra's priority is E1 > signature WoD >
  E3 > OE, with E2 "largely alleviated at E3". The Experimental log said E2+E3;
  both views are now noted in his annotation text.
- BiS: Treasured Rarity removed as ALT_SSR, replaced with Aberrant Devour
  (aliemus regen + crit DMG). Lyra explicitly rates Treasured Rarity's
  kill-stacking as impractical for him. Power of the Pious stays.

## Needs your call

1. **Saya ↔ Helot: Catena — synergy or conflict?** Our annotations mark them
   as a conflict (Saya's cycling kicks away Catena's hoarded cards). Lyra's
   Saya guide has a positive Helot: Catena synergy section (her copy
   generation and self cost-reduction reportedly work with Saya, especially
   with Saya OE). I left the conflict in place — flipping it changes team
   demotion into a bonus, which deserves an in-game check.

2. **Pollux top supports.** The guide's ratings table shows very large deltas
   (one shield/weakness support at ~+331%, Thais E2 at +200–350%). I added the
   textually confirmed trio (Hameln, Thais, Erica) but could not confirm the
   +331% unit's identity from OCR (visually it resembled Alva). If it is Alva,
   he belongs in Pollux's synergy list ahead of everyone.

3. **Existing BiS rows vs Lyra wheel lists.** All 14 covered characters
   already have Compendium-sourced BiS entries. Lyra's per-guide wheel lists
   (OCR-confirmed names below) sometimes rank differently — I did not churn
   the existing rows on OCR authority alone. Worth a pass when you have time:

   - Pollux: Special Training appears as a genuinely tested option for him —
     note it's on our NICHE_MYTHIC exclusion list for auto-substitution, which
     stays correct (it only merits assignment via an explicit BiS row).
   - Vortice: Bloody Feast, Hymn of the Sovereign, Stakes of Wisdom tested;
     Elevated Focus called out as usable on her.
   - Mouchette: Doomsday Rampage clearly best; Celestial Beast / Will
     Unyielding / Chains Unbound close behind with numbers.
   - Hameln: Merciful Nurturing (Thais sig) tested as strong on him alongside
     his own Eternal Requiem; Moment of Reunion leads the SR side.
   - Murphy: Fauxborn: Uteri Somnia dominant; Rewinding Time / Incalculable
     Factor / Heart of Silver / Memory Spiral all tested with ~37–43%
     practical deficits vs signature.

4. **Wheel purpose overrides.** Candidates for annotations/wheels.json from
   these guides once verified: Merciful Nurturing (support/keyflare on
   non-Thais wielders), Moment of Reunion (keyflare), Gateway of Truth
   (keyflare), Blue Ringed Toxin.

## Files

- Per-guide PDFs in docs/lyra/ — drop into project knowledge alongside the
  other guides.
- OCR text per guide in docs/lyra/ocr/ — searchable, best-effort quality.


## 2026-07-12 — MRMS corrections round

Applied:

- **Saya — Propagation Caro curated comp: Sorel → Doresain.** Propagation
  raises the Embryo Fusion threshold to 200%, and Sorel's Infinite Devour
  scales with embryo count — she wants embryos as fast as possible, so the
  divine realm actively fights her. Doresain's kill-scaling doesn't care and
  the Lyra guide rates him her best pairing. No Saya↔Sorel synergy edges
  existed in annotations, so nothing else changed; outside Propagation
  contexts the Lyra guide still speaks well of the pair (open question
  whether Saya's presence always implies Propagation in practice — if so,
  say the word and I'll add a conflict edge).
- **Isolated-carry penalty (engine).** A primary carry with zero same-realm
  teammates is discounted 0.1 (Chaos carries exempt) — kills the Kath + three
  Caro supports pattern the D-Tide leftover pass was assembling.
- **D-Tide board fill is tier-aware within score bands** like single mode, so
  an owned Castor+Pollux pair gets fielded instead of benched for the lineup.


## 2026-07-28 — Cetarchon drop, token drift, arc + posse fixes

### Applied

- **Lineup-token drift (export codes).** `db/*.json` had fallen out of step
  with SKeyDB's share-code dictionary. Saya was on `xl` while the live game
  had moved her to `xk` — Xu's old token — so the two silently swapped on
  every round-trip. Xu (`xk`→`xj`) and Vortice (`xo`→`xm`) had shifted too,
  along with eleven wheels, three of which (`y8`, `y9`, `y0`) had collided
  into duplicate tokens and were unresolvable on import.

  Cause is the isolation pattern itself: the one-off syncs correctly protect
  the gnostic `defaultMaxed` fix, but they never pick up upstream token
  reassignments for records they aren't touching. `scripts/sync-lineup-tokens.mjs`
  closes that hole — token-only, idempotent, `--check` mode for CI. Run it
  after every content drop. `tests/lineup-tokens.test.ts` fails loudly if it
  drifts again.

- **Lotan: Cetarchon (awakener-0059), rarity `Genesis`.** Synced via
  `scripts/oneoff-sync-cetarchon.mjs` with wheels 0172/0173/0174 and posses
  0053–0061.

  Two things the standard pipeline got wrong and now handles:

  1. *Divine derivation misses her.* Primordial Breath reforges Chaos into
     Primordia: Chaos, structurally identical to Divine Aequor / Propagation:
     Caro / Singularity: Ultra. Her upstream `searchTags` are still just
     `["STR Up"]`, so the tag-based derivation returns false. `isDivineRealm`
     is set by hand in her annotation (which is what `filter.ts` actually
     reads) and the sync regex now also matches `Primordia` for when SKeyDB
     catches up.
  2. *The Primordial Memory posses are not posses.* posse-0054 through 0061
     are the pool her Memory Fragments talent discovers from. SKeyDB marks
     them `equippable: false` with no `lineupToken`, so reaching the picker or
     the encoder would have thrown on export. `getPosses()` now filters them;
     `getAllPosses()` exists for reference views.

- **Sigil Yield is a combat stat on her.** Rotting Remains converts each 1%
  of Sigil Yield from her, her Wheels, and her Covenant into Strike crit rate
  and base damage, and both signature Wheels carry a Sigil Yield mainstat by
  design. `wheel-fit.ts` treats `SIGIL_YIELD` as a support identity and caps
  it at neutral fit on a carry, so wheels 0172/0173/0174 have purpose
  overrides in `annotations/wheels.json`.

- **Arc 1 R wheels ("Costco").** `arc-rules.ts` has always carried
  `rWheelsFullPower: true` and the correct prose, but the flag never reached
  `assignWheels` — Pass 2 ranked SR above R unconditionally and Pass 1.5
  handed out idle SSRs first, so the wheels the Compendium and Cheri both call
  mandatory for Arc 1 exploration were the last thing the engine would equip.

  The R pass had to go *before* the BiS passes, not after: `db/bis.json` is
  parsed from Compendium tables written for Astral Reign, so on a full roster
  BiS claimed both slots with Arc-2 stat sticks and an R wheel was never
  considered. Cheri splits the same advice into separate "Early Game" and
  "Astral Reign" columns for exactly this reason.

- **Posse realm gate removed.** The situational tier only offered a posse
  whose realm matched a realm on the board. FADED_LEGACY and OTHER are not
  realms any team can field, so thirteen posses were unreachable regardless of
  fit. Encounter in Pure White — the best draw engine available to a discard
  team — could only surface when Corposant or Saya were present, since theirs
  are the only two annotations naming it. Realm is now a tiebreak; the primary
  sort is mechanical overlap with the lineup (`lib/posse-fit.ts`).

### Needs your call

1. **Cetarchon tier and breakpoints are provisional.** Set `S`, floor `E0`,
   breakpoints E1/E3/OE — my read, one day after release, from the pre-release
   infographic, which itself says internal test server at Lv. 60 with all
   skills at Lv. 6 and warns numbers may shift. Tier feeds the generation
   tiebreak, so override once the Discord has a consensus.

2. **Her BiS is hand-authored.** SKeyDB carries no build for her, so
   `db/bis.json` has an entry I wrote from her scaling rather than from the
   Compendium: Cetus Occasus, then Celestial Beast (Perish and Devour both
   count as Strikes, so its Exalt-and-Strike base damage reads almost as a
   second signature), Amber-Tinted Death for the STR line, Undying Hungerbone
   as the SR floor. Replace wholesale when the Compendium publishes.

3. **Does the equipped Posse still function with her on the team?** Primordial
   Echo says the currently equipped Posse is automatically unleashed the first
   time Rouse Cards are played each turn. Memory Fragments says the carried
   Posse can no longer be unleashed. Read together these look contradictory —
   my assumption is that the Posse *button* becomes Primordia: Dual Recurrence
   / Triad Revelation while the equipped Posse still fires passively off
   Rouses, which is why she keeps a normal `anchorPosse`. If that's wrong,
   posse recommendation should be suppressed entirely on her teams. Needs
   in-game verification.

4. **Falling Upward (wheel-0174) — Saya BiS candidate?** Ownerless SSR, so the
   Mythic retag applies. Team Unique, adds a 0-cost card dealing AOE
   Corrosion and applying Perception Warp to other Awakeners' Command Cards.
   I left it *out* of `NICHE_MYTHIC_WHEEL_IDS`, so it is available as generic
   filler — it reads as broadly useful rather than event-locked like School
   Day. But Corrosion plus Warp points straight at Saya, whose Rouse already
   grants Warp. If it's a real Saya BiS row rather than filler, say so and
   I'll move it.

5. **One R wheel per support, or two?** Pass 0.5 takes a single slot and lets
   the second fall through to the normal BiS cascade, so supports that need a
   specific stat or effect keep it (Faint's death resistance, Tawil's Gateway
   of Truth). Cheri's phrasing — "put R wheels on all your supports" — could
   justify taking both. Two would strip those functional wheels, so I chose
   the conservative read. Easy to flip if the community builds harder.

6. **Cetarchon's Aliemus theft vs teammates.** Deadly Duel steals up to 10
   Aliemus from every other Awakener each play, and she plays it a lot. "24"
   is Chaos, tagged `aliemus_hungry`, and therefore both a natural teammate
   and a direct competitor for the same pool. Left out of `conflictsWith`
   pending testing rather than encoded on inference.


## 2026-07-28 — Meta tab

### Applied

- **`lib/pull-advice.ts` + Meta tab.** Four sections, all deterministic and all
  reading fields someone wrote down deliberately: Who to Pull, Stopping Points,
  Wheels to Chase, Meta Lineups. A wrong number in the tab is an annotation fix,
  not a UI one.

  Reading conventions the tab now depends on, so they need to stay true:
  `viabilityFloor` is the cheapest point a unit is worth fielding at, and the
  **last** entry in `enlightenBreakpoints` is the stopping point past which
  further copies stop changing how they play. Horla's `E1` floor and Thais's
  `E2` rung already read correctly under that convention.

  Pull ranking weighs a roster hole above raw power — a B-tier Keyflare bot
  outranks a second S-tier carry when nothing you own generates Keyflare —
  and discounts units whose floor is E3 or higher, because a new player cannot
  spend three copies on one character.

- **`annotations/wheel-floors.json`** (new). Minimum useful ascension level per
  wheel, keyed by wheel id, as a `starFloor` in the roster's 0–3 star scale
  (community "E0–E3"). Deliberately sparse: absent means no claim, so the tab
  never invents a floor it has no source for.

### Needs your call

7. **Thais's Merciful Nurturing floor — E2 vs E0.** Seeded `wheel-0001` at
   `starFloor: 2` from your note that it wants E2–E3 minimum. The Caro guide
   says the opposite in as many words: "E0 is already excellent, but the
   bonuses from going to E3 are also fantastic." I encoded your read over the
   guide's because you verify in-game and the guide may be describing the
   pull decision rather than the practical build floor, but the two genuinely
   disagree and it is the only seeded entry in the file. Worth settling before
   more wheels get floors on the same basis.

8. **Utility ranks are not modelled.** Your framing — Castor and Arachne are
   "super useful", Pollux is "a really good DPS" — maps to Cheri's separate
   DPS Rank and Support Rank, which our annotations flatten into one `tier`.
   Castor sits at `A` and Arachne at `S` today, which does not capture that
   Castor's value is almost entirely support utility. If you want that split,
   it wants two new optional annotation fields (`dpsRank`, `supportRank`) and
   a pass over the roster; the advice engine would pick them up as a better
   signal than `tier` for the pull ranking. Left alone rather than inferring
   58 ranks from role lists.
