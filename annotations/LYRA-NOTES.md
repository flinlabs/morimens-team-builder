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
