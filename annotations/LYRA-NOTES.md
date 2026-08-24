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

3. ~~**Does the equipped Posse still function with her on the team?**~~
   **RESOLVED 2026-08-03** by both community guides, and my reading was right.
   The Posse *button* becomes Primordia: Dual Recurrence / Triad Revelation,
   while the chosen Posse still fires — specifically it triggers whenever you
   Rouse a unit via Keyflare. She keeps a normal `anchorPosse` and posse
   recommendation stays enabled on her teams. Note the Posse button costs
   double, and the three-Posse set is almost always better than the double.

4. ~~**Falling Upward (wheel-0174) — Saya BiS candidate?**~~
   **RESOLVED 2026-08-03.** Leaving it out of `NICHE_MYTHIC_WHEEL_IDS` was
   correct, but for a reason I had not guessed: the in-depth guide lists it
   under Cetarchon's *own* support wheels, not Saya's. Her high ATK pushes it
   past 8000 Corrosion for 0 cost, which accelerates her Exalt. It is now a
   Support-variant row on her BiS entry.

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

8. ~~**Utility ranks are not modelled.**~~ **RESOLVED 2026-08-03** — the
   community DPS and Support tier lists arrived, so the split is now built from
   transcribed data rather than inferred. See the 2026-08-03 entry below.


## 2026-07-28 — curated comp list re-picked

### Applied

- **Meta Lineups now render fully built, always.** The section previously built
  each comp against the player's own roster, so every card carried a block of
  "X is not owned / X is missing recommended wheels" bullets that buried the
  team itself. It now builds against an ideal roster — everything owned, wheels
  at E3/+12, covenants complete, every posse unlocked — with each unit pushed to
  its own recorded stopping point rather than blanket-maxed, so the gearing
  shown is the build the guides describe. What the player actually owns is
  reported once in the header instead.

- **`meta-teams.json` cut from 35 comps to 12**, per Felix's curation. Note this
  feeds `lib/generate.ts` as well as the Meta tab: curated comps carry a scaled
  bonus in generation, so shrinking the list narrows what the generator treats
  as known-good. That is the intended effect, but it is a generator change, not
  just a display one.

  Ten of the twelve already existed and kept their original notes and sources
  verbatim. Two are new and are attributed to Felix rather than to a guide:
  Mouchette / Helot / Aigis / Thais, and Sorel / Thais / Pickman / Faint.

- **Regression rewritten from a name to a rule.** The Saya-Sorel adjudication
  was pinned to a comp called "Saya — Propagation Caro", which no longer exists.
  It now asserts the invariant across the whole list — no curated comp pairs
  Saya with Sorel — which is what actually has to survive a re-pick. Added a
  companion test that every curated comp is legal: four unique units, at most
  two realms, no two variants of one character.

  Worth noting the new list already respects the adjudication on its own: Saya
  appears with Doresain and with Pontos, Sorel appears with Faint, and the two
  never share a team.

### Needs your call

9. **Helot: Catena / Thais / Aigis / Helot was dropped.** You listed thirteen
   comps; twelve are encoded. That one fields Helot alongside Helot: Catena,
   and SKeyDB gives them the same in-game slot (`B05` and `B05EX`), the same
   relationship as Doll / Doll: Inferno and Lotan / Lotan: Cetarchon. The engine
   already treats that as impossible in `hasVariantConflict`, and a passing test
   depends on it, so encoding the comp would have put a team in the list that
   the generator refuses to build.

   If the fourth slot was meant to be someone else, say who and I will add it.
   If Morimens does in fact allow both Helot forms on one team, then
   `hasVariantConflict` is wrong for every EX pair and that is a much larger
   correction than one comp.



## 2026-08-03 — Cetarchon re-annotated from community guides

Two guides arrived (an in-depth English community guide and the Russian
"Experimental log: Lotan:Cetarchon"), and they overturned several things I had
guessed at from the pre-release infographic. Everything below replaces the
provisional 2026-07-28 entry.

### Corrected

- **Role: subDPS/support first, not main DPS.** Both guides converge here. The
  in-depth guide: "despite everything about her visual design (and cards)
  screaming carry, G.Lotan actually provides a lot of invisible support" and
  "IMO she isn't designed to be Main DPS." `teamRoles` is now
  `sub_dps, main_dps, keyflare_support, str_support` — carry retained as a real
  second role, since it is a supported playstyle, just not her best one.

- **Breakpoints were wrong.** I had E1/E3/OE. The guide gives an explicit
  priority order — **E0 > E2 > E3 > OE > E1 > AA** — and the Russian log agrees
  that "functionally e2 is the only one that counts." E1 is explicitly
  skippable and AA explicitly not recommended, so neither is a breakpoint.
  Now `E2, E3, OE`, floor unchanged at E0.

- **Her signature is not best-in-slot.** "Lotan's WoDs can be substituted with
  a bunch of others to pretty much no difference in performance." Cetus Occasus
  is BiS only *at E1*, where Sigil Yield begins converting into Strike crit via
  Rotting Remains. Below E1 the guides say ignore Sigil Yield entirely and
  build crit rate. Celestial Beast now leads the Carry variant.

  This also softens the Sigil Yield finding from 2026-07-28: it is a live
  combat stat, but only from E1, and it is a *preference* rather than a
  requirement. The wheel purpose overrides in `annotations/wheels.json` stay
  correct either way.

- **Her own Posse is not her anchor.** "Cetus-Devouring Storm... it is better
  to Discover this than to actually run it IMO." `anchorPosse` is now A Mouse's
  Wisdom (posse-0004), which makes all Rouses free — and since the chosen Posse
  fires on every Keyflare Rouse under Primordia: Chaos, that is a large tempo
  swing. Cetus-Devouring Storm stays in `recommendedPosses`.

- **Ogier was wrong as a key pairing.** I had inferred him from the 1500% STR
  bonus. The guide names him explicitly as a non-synergy: "Certain units (e.g.
  Ogier, Nautila) can serve a function on the team, but they do not
  particularly have standout synergies." STR support is "not so much a must but
  a strong want." Key pairings are now Hameln, Castor, Arachne, Aigis, Faint.

- **All-Chaos was overstated.** Mono doubles two bonuses, but both guides field
  her mixed far more often, and the in-depth guide says she "can be slotted as
  splash support nearly anywhere." The real constraint is different: she needs
  a team that does not depend on a specific chosen Posse.

- **New BiS shape: two variants, Carry and Support.** Support gets Heart of
  Silver, Sever and Scar, Falling Upward, Manikin of Oblivion. Twisted Twins:
  Black is arguably her best covenant at E2+, and Dream of Medicine is
  explicitly counterproductive on her — copied Short Blades do not advance the
  stack counter, which is a mechanic worth remembering generally.

- **Test rewritten, not restored.** `tests/lineup-tokens.test.ts` asserted
  Cetus Occasus was her first BiS wheel. That assertion encoded my guess, and
  the guides contradict it, so it now checks that both role variants exist and
  that Celestial Beast leads the Carry list with the signature present further
  down.

### Still open

10. **Teams from the guides are NOT in `meta-teams.json`.** The curated list is
    Felix's hand-picked twelve and I did not touch it. The guides supply
    several candidates that pass the legality sweep — Cetarchon / Hameln /
    Ryker / Castor (Chaos+Ultra), Cetarchon / Arachne / Daffodil / Karen
    (Chaos+Ultra), Cetarchon / Doresain / Pickman / Leigh (Chaos+Caro), and the
    Russian log's Cetarchon / Jenkin / Ogier / Clementine. Say which, if any,
    should join the twelve.

11. ~~**Tier stays S, but the flattening problem is now sharper.**~~
    **RESOLVED 2026-08-03.** She is now graded A as a DPS and A as a support,
    which captures what a single `tier` could not — see question 12 below for
    the one judgement call inside that.



## 2026-08-03 — per-role tier lists

### Applied

- **`annotations/tier-lists.json`** (new). Verbatim transcription of the
  community Newbie DPS and Newbie Support tier lists, keyed by awakener id,
  with both published scales included so a future reader can check a grade
  against the definition it was awarded under. All 59 awakeners are covered;
  every name resolved against the db on the first pass.

  Kept as its own file rather than folded into `annotations/awakeners.json`
  because the community republishes these lists as a unit. A re-transcription
  can overwrite the whole file without touching a single hand-written note,
  pairing, or breakpoint — the same isolation principle the sync scripts use.

- **`dpsRank` / `supportRank` / `dpsFloor` / `supportFloor`** on
  `AwakenerAnnotation`, merged in at `getAwakeners()` load time. The legacy
  `tier` field stays, since generation and older UI read it, but it is now
  documented as the thing to migrate away from.

- **Meta tab shows both grades** as separate chips instead of one "Tier X".

  Three cases prove the split earns its place: Kathigu-Ra is A as a carry and
  C as a support, Clementine is C and S, and Castor — the character that
  prompted the question — is B+ and A. A single grade was hiding all three.

- **Role-specific floors are recorded separately from `viabilityFloor`.** The
  source prints an investment level next to some portraits, and it differs by
  role: Murphy: Fauxborn is E2 as a DPS but unqualified as a support, Helot:
  Catena is E3 on both lists yet A as a carry and C+ as a support. These are
  answers to a different question than "when is this character worth fielding
  at all", so they are stored alongside rather than overwriting.

### Deliberate choice worth knowing

- **An unranked role is stored as absent, not as a low grade.** Both lists
  state that an unlisted character would need "a crazy reason" to be used in
  that role — which is stronger than a C, and different in kind. Backfilling a
  C would have made Aigis read as a usable DPS. There is a test pinning this.

### Needs your call

12. **Cetarchon is encoded A/A; you said "S/A" for DPS.** I read that as
    uncertainty between the two and took the lower one, for a specific reason:
    these are explicitly *newbie* lists, where S means "needs very little
    investment to steamroll story mode." Both of her guides say she is the most
    gimmick-vulnerable unit in the game, that she needs the player to read
    enemy intent patterns to time Whalefall, and that she "scales with player
    knowledge." That is close to the opposite of what S is measuring, even
    though her ceiling clearly reaches it.

    If you meant S outright, it is a one-word change in
    `annotations/tier-lists.json` and one assertion in `tests/tier-lists.test.ts`.

    Note also this is the one grade in the file that is not from the community
    lists — she released after they were published — so her entry carries a
    `source` field crediting you. Worth keeping that convention if more
    post-list characters get graded.

13. **Where should the ranks feed decisions, beyond display?** Right now they
    are shown and used in the pull-target reason text, but ranking itself is
    still the marginal-team-value delta, and generation still reads the legacy
    `tier`. Wiring `supportRank` into the generator's support scoring is a real
    behavioural change and I did not want to make it silently. Say the word.


## 2026-08-03 — onboarding for undiscovered features

### Applied

- **Pinning had no UI at all.** This was the root cause of nobody knowing about
  it, and no tooltip could have fixed it: the feature was implicit (place a
  character by hand and they're pinned, clear the slot and they're unpinned),
  `FormationBoard` never received the pin state, and `Slot` had no way to show
  it. There was nothing to hover.

  Slots now take `pinnedSlots` / `onTogglePin` and render a pin badge — always
  visible when active, revealed on hover or focus when not — that toggles on
  click. Wired into both the single board and all five D-Tide boards. A one-line
  explainer sits above the grid.

- **`components/Hint.tsx`** (new). Opens on click as well as hover, because
  hover does not exist on touch and a large share of this tool's traffic is
  players checking builds on a phone. A hover-only tooltip would have been
  invisible to exactly the people who need it. Closes on outside click and
  Escape, and carries the usual `aria-expanded` / `role="tooltip"` wiring.

- **`components/QuickStart.tsx`** (new). Three-step first-visit guide covering
  the inventory expectation, pinning, and the lineup codes, then reachable
  afterwards from a "Quick guide" link beside the tabs. A tooltip only fires
  once you hover the control, which requires already knowing the control
  matters — so the guide shows itself unprompted the first time instead.

  Its dismissal flag lives in its own localStorage key rather than in the
  roster store, so exporting an inventory never carries UI state with it and
  importing someone else's file cannot re-trigger or suppress the guide.

- **Set the expectation that inventory is manual.** The Backup hint now says
  plainly that no tool can read a Morimens account — there is no public API —
  and that Import inventory only reads a file this app exported.

- **`vitest.config.ts` testTimeout raised to 30s.** The suite started failing a
  different test on each run, which looked like a logic regression and was not:
  Vitest's 5s per-test default was being tripped under parallel load now that
  the D-Tide five-board solve and the pull-advice beam search both legitimately
  run for seconds. Raised rather than worked around; the assertions are sound.
  Confirmed stable across repeated full runs.

### Needs your call

14. **The guide fires for existing users too.** Everyone who has already used
    the tool will see it once on their next visit, since the flag starts unset.
    That seemed right — they are precisely the people who did not know about
    these features — but it is a one-line change if you would rather it only
    reached genuinely new visitors.

15. **Analytics would answer this properly.** You asked about Google Analytics
    earlier and the conclusion was that a single-route app needs a custom event
    layer to learn anything. This is the case that makes it worth building:
    events on guide completion versus skip, pin toggles, and export/import
    would tell you whether the onboarding actually worked rather than leaving
    it to guesswork.


## 2026-08-03 — investment recommendations and acquisition routing

### Applied

- **Recommendations now cover enlightening, not just acquiring.** The engine
  previously skipped every owned character, which silently assumed a copy is
  always better spent on someone new. It often is not — on a test roster,
  taking an owned Kathigu-Ra from E0 to his E3 floor scored 0.49, roughly two
  and a half times the best acquisition available. Both routes are now measured
  identically (best fieldable team today vs best fieldable team with the single
  change applied) and returned in one list ranked by the difference, because
  both spend the same copies and that is the actual decision.

  Enlighten candidates step to the next *breakpoint*, not the next rung — the
  rungs in between are precisely the ones the annotations say change nothing.
  An enlighten that does not move the best team at all is dropped rather than
  listed at zero.

- **`annotations/acquisition.json` + `lib/acquisition.ts`** (new). Every route
  by which a copy or wheel can be obtained, described declaratively: what it
  grants, whether the player picks or it rolls, and whether it is locked by arc,
  by realm, or to things already owned. Constraints compose, so adding an item
  is a data edit.

- **Wheel availability is derived from the owning awakener.** `db/wheels.json`
  has no `availabilityType` at all. Signature wheels inherit their owner's
  exactly — each limited awakener's SSR and SR sit in that awakener's arc — and
  the derivation was checked across the whole catalogue before relying on it.
  Ownerless Mythic, R and N wheels have nothing to inherit and are treated as
  outside these items rather than guessed at.

  Realm is taken from the owner too, not from the wheel's own `realm` field,
  which is NEUTRAL for 82 of 140 records and would have defeated every
  realm-locked selector.

- **`components/CurrencyInventory.tsx`** (new). Optional mini-inventory on the
  Inventory tab. Counts are stored under item slug in `roster.currencies`,
  zeroes dropped rather than persisted, and the field is optional so rosters
  exported before today still import cleanly.

- **Recommendations say how to act on themselves.** Each one now carries a
  route line — "You hold 2× Chaos Echo" or "Obtainable with Ultra Mapping:
  Faded Legacy" — preferring an item the player holds, and a guaranteed pick
  over a random one.

### Bug found while building this

- **Thin rosters got no advice at all.** `bestTeamFrom` returned null unless
  four *fieldable* units existed, so a player with two or three characters —
  exactly the person these recommendations are for — saw an empty list. It now
  builds up to four and settles for what the roster has; `buildCandidateTeam`
  scores partial lineups fine, and baseline and hypothetical are built the same
  way so the comparison stays like-for-like. Test pinned.

- **A test fixture of mine was wrong, not the code.** I wrote an assertion
  assuming Kathigu-Ra was a Faded Legacy Chaos unit. He is Chaos but
  `LIMITED_ASTRAL_REIGN`, so no Arc 1 selector can produce him and the engine
  correctly refused to offer one. Fixture moved to "24", and a second test added
  pinning the Astral Reign behaviour that caught it.

### Assumptions to confirm

16. **Are the four realm packs actually realm-locked?** Ultra Prophecy, Caro
    Whisper, Aequor Codex and Chaos Experiment are modelled as restricted to
    their realm, on the strength of arriving as a symmetric set of eight — an
    awakener and a wheel selector per realm. If the realm word is only branding
    and any of them can pick any limited reward, delete the `realm` key from
    those eight entries in `annotations/acquisition.json` and nothing else
    changes.

17. **Can a Prototype Horizon grant a character you do not own?** Modelled as
    `ownedOnly`, i.e. a pure duplicate, from the word "duplicates". If it can
    also acquire, remove `ownedOnly` and it will start appearing on acquisition
    recommendations too. Timeloop Copy is unambiguous — you said outright it
    cannot select new ones — so that one is not in question.

18. **Do the Rewind Cores draw from the whole catalogue?** Modelled as
    unrestricted selectors, since you described them as free selectors without
    qualification. If they are limited-pool or arc-locked, they need an `arc`
    key like the packs.

19. **Shard counts are not tracked.** You can record Cores but not the Shards
    they synthesise from. Adding them is easy, but I would want to know whether
    the 10:1 conversion is worth modelling — showing "you are 3 shards from a
    Soul Rewind Core" is a different and possibly more useful message than a
    Core count alone.


## 2026-08-03 — team score surfaced

### Applied

- **The score is now shown on every team card**, with a "?" that opens a full
  breakdown of the six terms that produced it.

  It is the same number the generator ranks by, passed through on the
  recommendation rather than recalculated for display. A parallel calculation
  would have been free to drift, which is the one thing this feature must not
  do — a displayed score that disagreed with the ranking would make debugging
  harder, not easier. Pinned by a test asserting `rec.score === candidate.score`.

- **`ScoreComponent[]` on `CandidateTeam`**, one entry per additive term:
  Investment, Synergy, Chaos splash, Realm mixing, Unmet conditions, Isolated
  carry. Each carries a note on what moves it. A test asserts the components
  sum to the reported total, so no term can be silently dropped or double
  counted.

- **`POST /api/score-team`** (new) scores an arbitrary lineup, and the manual
  Formation board now shows a live score as you build. That was the second half
  of the request: the board was already the "plug in your own team" surface, it
  just never said what the engine made of it. Debounced at 250ms with stale
  responses discarded, since the requests can return out of order.

### Calibration, and why the panel quotes it

A bare number tells nobody anything, so the panel states the scale measured
against the current scorer:

- an arbitrary four scores about **0.31–0.47**
- the twelve curated comps score **1.03–1.16** with every member at E0
- the same comps score **1.23–1.37** fully invested

The chip bands on those figures (Loose / Workable / Solid / Strong). If the
scoring weights change, those numbers go stale — there is a test asserting a
curated comp beats an arbitrary four and clears 0.9, which will fail if the
relationship inverts, but the specific band thresholds in `TeamScore.tsx` are
not otherwise defended and would need a re-measure.

The panel says outright that the score is a relative ranking signal rather than
a rating worth optimising, and that a strong team scoring badly most likely
means a missing annotation rather than a bad team. That framing matters more
than the number: Investment is by far the largest term, so the score mostly
reflects how built your characters are, and someone reading it as a pure "is
this comp good" measure will be misled.

### Needs your call

20. **Should the score appear on the Meta tab's curated lineups?** Those render
    through the same `TeamFormation` component, so they already show one — but
    it is computed against the ideal roster used to display them fully geared,
    which means every curated comp shows a high score regardless of what the
    player owns. That is consistent with the rest of that section, though it may
    read as a rating of the comp rather than of their build. Easy to suppress
    there if it is confusing.

21. **Band thresholds are mine, not measured against player expectation.** Solid
    starts at 1.0 because that is roughly where a curated comp lands at E0. If
    the community reads "Solid" as higher praise than that deserves, the
    thresholds are four numbers in one function.


## 2026-08-03 — popover positioning fix

The score breakdown panel was rendering off the left edge of the screen, clipped
and unreadable.

The cause was not the score panel specifically. Both it and `Hint` positioned a
fixed-width panel with plain `position: absolute` against their trigger, which
has no way to know where the viewport edge is — any trigger near an edge, or
anywhere at all once the page is scrolled horizontally, pushes the panel off the
side. The score chip sits `ml-auto` at the right of a team card, which is
exactly the worst case for a right-aligned panel.

`components/Popover.tsx` (new) now handles positioning for both. It portals to
`document.body`, measures the trigger's bounding rect, positions fixed, clamps
to the viewport with an 8px margin, and flips above the trigger when there is
genuinely more room there. Portalling also removes any dependency on ancestor
overflow and stacking contexts, which the card layouts have plenty of.

Details worth keeping:

- Placement runs in a `useLayoutEffect` and the panel stays `visibility: hidden`
  until measured, so it never flashes at the top-left corner before settling.
- A second measure on the next animation frame, once the panel has real height,
  so the flip decision is made against its actual size rather than zero.
- Recomputed on scroll and resize while open, since a fixed panel would
  otherwise drift away from a trigger that moves.
- `Hint` gained a 180ms grace period on mouse-out so the pointer can travel from
  the trigger into the panel to read or select text without it vanishing.
- The `align` prop on `Hint` is gone — the clamp makes manual side-picking
  redundant, and the three call sites that passed `align="left"` were working
  around this bug rather than expressing a preference.

Not verified visually — the test environment is Node with no DOM, so there is no
automated coverage of the positioning itself. The arithmetic is straightforward
and the failure mode is visible immediately, but a second pair of eyes on a
narrow phone viewport would be worth having before this is considered settled.


## 2026-08-20 — realm rewrites generalised; Caraboo staged

### Applied

- **Realm-rewrite coverage notes no longer match on character name.** Two
  branches in `filter.ts` were keyed to the literal strings `'Saya'` and
  `'Lotan: Cetarchon'`, which meant every future rewriter would silently get no
  note until someone remembered to add a branch. This is the same
  data-without-wiring shape as the Arc 1 R-wheel preference.

  There is now a `realmRewrite` field on `AwakenerAnnotation`
  (`PROPAGATION_CARO` | `DIVINE_AEQUOR` | `SINGULARITY_ULTRA` |
  `PRIMORDIA_CHAOS`) driving a `REALM_REWRITE_NOTES` table. Populated on the
  four existing rewriters. Caraboo will inherit the Propagation: Caro note the
  moment she is annotated, with no code change.

  A test pins that all four are declared, that every rewriter is also flagged
  `isDivineRealm`, and that only Primordia: Chaos emits the pure-realm dilution
  warning.

- **`annotations/pending-characters.json`** (new). Caraboo is announced but not
  yet in SKeyDB, so there is nothing to sync. Her full kit is transcribed there
  — attributes, talents, all skills, the Gift/Price table, five Enlightens, the
  Honeyed Deceit wheel — along with both official corrections. Not loaded by the
  app; `db/awakeners.json` remains the only source the engine reads. A test
  asserts nothing in the pending file has quietly gone live.

  Both corrections matter and neither is in the infographic:
  1. Blessing cards also carry **[Exhaust]** — once played they leave the deck
     for the rest of combat. Omitted from the skill preview graphic.
  2. Soulforge's English text "Satiety increases Max HP by 10~100%" is **wrong**.
     The correct reading is that the Max HP bonus from Satiety stacks is
     increased by +100%. Do not encode the infographic wording.

### Found while doing this — needs your attention

22. **`annotations/awakeners.json` is STALE relative to `db/awakeners.json`.**
    The sync bakes the annotations file into an embedded `annotation` object on
    each db record, and `getAwakeners()` reads the db copy — so editing the
    annotations file alone changes nothing the engine sees. I hit this
    immediately: my `realmRewrite` edit had no effect until it also went into
    the db.

    Re-baking the annotations file over the db turned out to be the wrong fix
    and broke a D-Tide test, because the db is the NEWER of the two. The drift,
    counted by field:

    - `combatTheme` differs on **47** records
    - `synergizesWith` on 10
    - `keyPairings` on 4
    - `tier`, `requiresThemeLock`, `conflictsWith`, `keySkillSlots`,
      `divineRealmNote`, `enlightenBreakpoints`, `notes`, `contentNotes`,
      `recommendedPosses`, `anchorPosse`, `requiresCondition`, `teamRoles` on 1
      each

    `combatTheme` and `requiresThemeLock` do not appear in
    `annotations/awakeners.json` at all, so work has been going into the db
    directly without flowing back. That is fine as a one-off but dangerous as a
    standing state: the next full `sync-skeydb.mjs` run rebuilds the db from the
    annotations file and would erase all of it.

    I applied `realmRewrite` surgically to both files rather than reconciling
    them, because deciding which side wins per field is your call, not mine. But
    this wants resolving before the next sync — either backfill the annotations
    file from the db, or make the db the source of truth and stop treating the
    annotations file as an input.

23. **Uncommitted starter-roster work was in the working tree.** `lib/roster.ts`,
    `lib/store.ts` and `tests/starter-roster.test.ts` carry a
    `STARTER_AWAKENER_IDS` / `migrateRoster` feature that is not in HEAD. Its
    tests pass. I have left it untouched and included it in the delivery so it
    is not lost, but I did not write it this session and have not reviewed it —
    check whether it is meant to ship.


## 2026-08-03 — starter characters owned by default

Doll, Lotan, Ogier and Ramona are handed out through the story, so a fresh
roster starting with them unowned made every new player's first job to tick four
boxes they could never not have.

- `STARTER_AWAKENER_IDS` in `lib/roster.ts`, seeded by `createEmptyRoster()`.
  Hardcoded by id because that module runs on the client and cannot read
  `db/awakeners.json`; `tests/starter-roster.test.ts` asserts the list is
  identical to the SR set, so a fifth SR fails the suite rather than silently
  going missing. The four happen to be exactly the SR rarity tier and exactly
  the WELFARE availability tier, which is a stronger guarantee than a list
  someone typed.

- **Applied to existing rosters too**, via a v1 → v2 migration. Roster entries
  are sparse — a key exists only once the player has touched that character — so
  `withStarters` fills only ids with no entry at all. An explicit `owned: false`
  can only have got there by the player setting it, and is left alone. Anyone
  who has already recorded investment on a starter keeps it.

- **The migration runs on import as well as load.** `importRoster` previously
  bypassed it, which would have let an old backup file come back in a state the
  app no longer produces. Both paths now share `migrateRoster`.

Only the base forms are seeded. Doll: Inferno, Lotan: Cetarchon and Ramona:
Timeworn are separate limited characters, and handing those out free would
distort every score in the tool — there is a test pinning that the starter list
contains no EX variant.

### Note on a transient test failure

A full-suite run during this change reported three failures in
`tests/realm-rewrite.test.ts` claiming no character declares a `realmRewrite`,
which is plainly false — the field is present on four annotations. The same file
passed in isolation, no pairing with any other file reproduced it, and five
consecutive full runs since have been clean at 142/142.

Not diagnosed. Recording it because an unexplained failure that stops
reproducing is worth knowing about rather than forgetting: if it resurfaces, the
likely area is module-level `getAwakeners()` caching interacting with the
in-place annotation merge added for the tier lists, since that is the one place
a shared cached object is mutated after read.


## 2026-08-03 — pull recommendations verified end to end

Ran the advice engine against three real roster shapes — a brand-new account
with only the four starters, the same account holding a Chaos Echo and two
Prototype Horizons, and a twelve-character mid-game roster — and read the actual
output rather than only checking it did not throw. Two defects surfaced that no
existing test covered.

- **Every recommendation routed to a Soul Rewind Core.** The Core is a `choose`
  selector with no arc or realm restriction, so it satisfied every target and
  won the tie-break for all of them. Technically true, useless as advice: it
  said the same thing about everyone, and it pointed at the most expensive
  option first — Cores cost ten shards, earned only by pulling something already
  at +12. `routeSummary` now breaks ties on pool specificity, so a realm-and-arc
  pack beats an arc-only pack beats the catch-all Core. Mid-game output went
  from six identical "Soul Rewind Core" lines to Chaos Echo: Astral Reign and
  Caro Birth: Faded Legacy.

- **Wheel targets repeated a character per BiS variant.** Castor names the same
  wheel in more than one variant, which rendered as "Sever and Scar
  (Castor/Castor)". Deduped by awakener id.

Both pinned by tests. Currency routing was already correct — held items win over
unheld ones, and the enlighten recommendations correctly routed to the held
Prototype Horizons.

### Worth knowing about new accounts

With only the four starters owned, the fieldable pool is a single character:
Doll, Lotan and Ogier all sit below their viability floors at E0, so only Ramona
qualifies. Team previews for a new player are consequently two units, and the
reasons read "Slots straight into a team with Ramona".

That is accurate rather than broken — their starters genuinely are not built
yet, and the advice correctly surfaces "Doll, at E0, below the E1 they need" as
one of the top recommendations. But it does mean the strongest early signal the
tool gives is about investment rather than acquisition, which is worth being
deliberate about if the onboarding copy ever describes this tab.

## 2026-08-24 — Caraboo synced live; Propagation: Caro synergy adjudicated

### Applied

- **Caraboo is live** (`awakener-0060`, Caro SSR Warden, Astral Reign). Synced
  from SKeyDB via `scripts/oneoff-sync-caraboo.mjs` alongside `wheel-0175`
  Honeyed Deceit, `wheel-0176` Serene Truth, `wheel-0177` Soul Synchronization
  (ownerless SSR, retagged MYTHIC) and `posse-0062` That Which is No Lie. The
  staged entry in `pending-characters.json` has been folded in and removed.

- **The staged Saya/Sorel anti-synergy claim was wrong and has been dropped.**
  The pending entry, written from the pre-release infographics, asserted that
  Propagation: Caro is bad for Sorel because his Infinite Devour scales with
  embryo count, and that Caraboo would inherit the same problem. Saya's own
  adjudicated annotation says the opposite — Sorel is her single recorded
  `keyPairing`, described there as "an Exalt carry that doesn't need specific
  cards."

  The mechanics documents settle it. Under the rewrite, embryos and Realm
  Mastery stop granting Crit Rate, Shield and temporary STR and instead grant
  Propagation Fiesta, where each stack adds 1% to the **base values of an
  exalt** — damage, STR, poison and shield alike. Consuming a Propagule Embryo
  gives 40 stacks per awakener per turn on top of the default 20. Sorel is a
  multihit Exalt DPS, so the trade is strongly in his favour. Community
  adjudication beats a pre-release infographic reading, as usual.

  Consequently Caraboo ships with an empty `conflictsWith`. Saya is redundant
  beside her rather than harmful — two sources of one rewrite waste a slot but
  break nothing — and marking it a hard conflict would have made the engine
  forbid a legal team.

- **Synergy edges are keyed to exalt amplification, not to Weakness.** Weakness
  reduces enemy Active DMG by 25%; it is a survivability debuff, and Vulnerable
  is the offensive one. Snowy Hex deals Fixed DMG, which Vulnerable does not
  affect either. So her edges are exalt-centric carries (Sorel, Lotan,
  Mouchette, Helot: Catena, Uvhash, "24") plus the embryo generators that feed
  Fiesta stacks (Thais, Aigis, Agrippa, Salvador, Pickman, Leigh). The Mastery
  effect doubles on an all-Caro or all-Chaos team, which is why the list leans
  that way rather than spreading across realms.

### Outstanding

- **Lineup token unknown.** SKeyDB reissued the awakener and wheel dictionaries
  with 2.6.0, and the new values contradict a real in-game code — see the note
  in `scripts/sync-lineup-tokens.mjs`, where both categories are now pinned.
  Caraboo's upstream token collides with Arachne's verified one, so she ships
  with none and cannot appear in a share code until a real block containing her
  is captured.
- **BiS is provisional**, flagged in `db/bis.json`. Replace when Mythag
  publishes.
- **Soul Synchronization** is currently eligible as generic filler. It is paid
  archive content, unlike the other two paid-archive wheels which sit in
  `NICHE_MYTHIC_WHEEL_IDS`. Undecided.
