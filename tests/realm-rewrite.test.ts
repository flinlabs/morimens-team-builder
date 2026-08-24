import { describe, it, expect } from 'vitest'
import { buildCandidateTeam } from '@/lib/filter'
import { getAwakeners, getWheels, getAllPosses } from '@/lib/db'
import { fullRoster, awakenerIdByName } from './helpers'
import fs from 'fs'
import path from 'path'

/* ---------------------------------------------------------------------------
   Realm rewrites.

   A handful of characters replace their realm's rules for the whole team. The
   coverage notes for these used to match on character name, so every new
   rewriter silently got no note until someone added a branch — the same
   data-without-wiring pattern that hid the Arc 1 R-wheel preference. The notes
   are now keyed on the declared `realmRewrite`, and these tests pin that.
--------------------------------------------------------------------------- */

const awakeners = getAwakeners()
const roster = fullRoster()

const gapsFor = (names: string[]) =>
  buildCandidateTeam(names.map(awakenerIdByName), awakeners, roster).coverageGaps

describe('realm rewrites', () => {
  it('declares the rewrite on every character that brings one', () => {
    const declared = Object.values(awakeners)
      .filter((a) => a.annotation?.realmRewrite)
      .map((a) => a.name)
      .sort()
    // Caraboo joined in 2.6.0 and is the first case of two characters sharing
    // one rewrite — she and Saya both bring Propagation: Caro.
    expect(declared).toEqual(['Arachne', 'Caraboo', 'Lotan: Cetarchon', 'Saya', 'Vortice'])
  })

  it('treats every rewriter as a Divine Realm character', () => {
    for (const a of Object.values(awakeners)) {
      if (!a.annotation?.realmRewrite) continue
      expect(a.annotation.isDivineRealm, `${a.name} rewrites a realm but is not flagged`).toBe(
        true
      )
    }
  })

  it('notes Propagation: Caro without naming Saya in the code', () => {
    const gaps = gapsFor(['Saya', 'Thais', 'Pickman', 'Faint'])
    expect(gaps.some((g) => /Propagation: Caro/.test(g))).toBe(true)
    // The warning has to name the embryo interaction, since that is the whole
    // reason Sorel is kept off Propagation teams.
    expect(gaps.some((g) => /Embryo Fusion threshold/.test(g))).toBe(true)
  })

  it('still flags a diluted Primordia: Chaos lineup and its sustain need', () => {
    const gaps = gapsFor(['Lotan: Cetarchon', 'Thais', 'Pickman', 'Sorel'])
    expect(gaps.some((g) => /non-CHAOS teammates/.test(g))).toBe(true)
    expect(gaps.some((g) => /Whalefall/.test(g))).toBe(true)
  })

  it('says nothing about pure-realm dilution for rewrites that do not care', () => {
    // Only Primordia: Chaos gates its bonuses on a mono lineup. A mixed Caro
    // team with Saya should not inherit that warning.
    const gaps = gapsFor(['Saya', 'Clementine', 'Horla', 'Tinct'])
    expect(gaps.some((g) => /halves both the team DMG Amplification/.test(g))).toBe(false)
  })

  it('produces no rewrite note for a team without one', () => {
    const gaps = gapsFor(['Thais', 'Pickman', 'Faint', 'Doresain'])
    expect(gaps.some((g) => /Propagation: Caro|Primordia: Chaos|Divine Aequor/.test(g))).toBe(
      false
    )
  })
})

describe('pending character intel', () => {
  const pending = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), 'annotations', 'pending-characters.json'), 'utf-8')
  ) as {
    pending: {
      name: string
      realmRewrite?: string
      signatureWheels?: { name: string }[]
      posse?: { name: string }
    }[]
    pendingWheels?: { name: string }[]
  }

  it('is staged only — nothing pending has leaked into the live db', () => {
    // The file is reference material until SKeyDB publishes the record. If a
    // name here also exists in db/awakeners.json, the entry should have been
    // folded into annotations/awakeners.json and deleted.
    const live = new Set(Object.values(awakeners).map((a) => a.name))
    for (const p of pending.pending) {
      expect(live.has(p.name), `${p.name} is live now — fold in and remove from pending`).toBe(
        false
      )
    }
  })

  it('staged wheels and posses have not leaked into the live db either', () => {
    // Same guard as the character check, one level down. A staged wheel or
    // posse showing up live means the sync ran and the entry was never folded
    // in, which is how a record ends up with no annotation behind it.
    const liveWheels = new Set(Object.values(getWheels()).map((w) => w.name))
    const livePosses = new Set(Object.values(getAllPosses()).map((p) => p.name))
    const staged = [
      ...(pending.pendingWheels ?? []).map((w) => w.name),
      ...pending.pending.flatMap((p) => (p.signatureWheels ?? []).map((w) => w.name)),
    ]
    for (const name of staged) {
      expect(liveWheels.has(name), `${name} is live now -- fold in and remove from pending`).toBe(
        false
      )
    }
    for (const p of pending.pending) {
      if (p.posse) {
        expect(
          livePosses.has(p.posse.name),
          `${p.posse.name} is live now -- fold in and remove from pending`
        ).toBe(false)
      }
    }
  })

  it('only stages rewrites the engine already understands', () => {
    const known = ['PROPAGATION_CARO', 'DIVINE_AEQUOR', 'SINGULARITY_ULTRA', 'PRIMORDIA_CHAOS']
    for (const p of pending.pending) {
      if (p.realmRewrite) expect(known).toContain(p.realmRewrite)
    }
  })
})
