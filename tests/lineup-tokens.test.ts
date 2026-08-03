import { describe, it, expect } from 'vitest'
import {
  encodeIngameTeamCode,
  decodeIngameTeamCode,
  findTokenCollisions,
} from '@/lib/ingame-codec'
import {
  getAwakeners,
  getWheels,
  getCovenants,
  getPosses,
  getAllPosses,
  getBisData,
} from '@/lib/db'

/* ---------------------------------------------------------------------------
   Lineup-token integrity.

   The in-game share code is a positional string of dictionary tokens, so a
   token that has drifted from SKeyDB silently exports the wrong record rather
   than failing loudly. That is what put Saya on `xl` while the live game had
   moved her to `xk` — Xu's old token — so the two swapped on every round-trip
   and neither the type checker nor the existing suite noticed.

   These tests fail if db/*.json drifts again. The fix is
   `node scripts/sync-lineup-tokens.mjs`.
--------------------------------------------------------------------------- */

describe('lineup tokens', () => {
  it('no two records in a category share a token', () => {
    // A shared token makes both records unresolvable on import and makes any
    // export containing either of them ambiguous.
    expect(findTokenCollisions()).toEqual([])
  })

  it('every awakener round-trips through a share code', () => {
    // The multi-character (`x`-prefixed) tokens are the fragile ones: they only
    // decode correctly while longest-match has an unambiguous table to work
    // against. Saya, Xu, and Vortice all live in that space.
    const awakeners = Object.values(getAwakeners())
    const posseId = Object.values(getPosses())[0].id

    for (const awakener of awakeners) {
      const code = encodeIngameTeamCode({
        slots: [
          { awakenerId: awakener.id, wheelIds: [null, null] },
          { awakenerId: null, wheelIds: [null, null] },
          { awakenerId: null, wheelIds: [null, null] },
          { awakenerId: null, wheelIds: [null, null] },
        ],
        posseId,
      })
      const decoded = decodeIngameTeamCode(code)
      expect(decoded.warnings, `${awakener.name} produced import warnings`).toEqual([])
      expect(decoded.slots[0].awakenerId, `${awakener.name} did not survive the round-trip`).toBe(
        awakener.id
      )
    }
  })

  it('Saya survives a share code alongside the units she used to collide with', () => {
    const byName = (name: string) =>
      Object.values(getAwakeners()).find((a) => a.name === name)!
    const saya = byName('Saya')
    const xu = byName('Xu')
    const vortice = byName('Vortice')

    const code = encodeIngameTeamCode({
      slots: [
        { awakenerId: saya.id, wheelIds: [null, null] },
        { awakenerId: xu.id, wheelIds: [null, null] },
        { awakenerId: vortice.id, wheelIds: [null, null] },
        { awakenerId: null, wheelIds: [null, null] },
      ],
      posseId: Object.values(getPosses())[0].id,
    })
    const decoded = decodeIngameTeamCode(code)
    expect(decoded.warnings).toEqual([])
    expect(decoded.slots.map((s) => s.awakenerId)).toEqual([
      saya.id,
      xu.id,
      vortice.id,
      undefined,
    ])
  })

  it('every wheel and covenant the app can equip has a token', () => {
    // A record with no token throws on export, which surfaces to the player as
    // a failed "copy to game" on an otherwise valid lineup.
    for (const wheel of Object.values(getWheels())) {
      expect(wheel.lineupToken, `${wheel.name} has no lineup token`).toBeTruthy()
    }
    for (const covenant of Object.values(getCovenants())) {
      expect(covenant.lineupToken, `${covenant.name} has no lineup token`).toBeTruthy()
    }
  })
})

/* ---------------------------------------------------------------------------
   Lotan: Cetarchon content drop (2026-07-27).
--------------------------------------------------------------------------- */

describe('Lotan: Cetarchon drop', () => {
  const awakeners = getAwakeners()
  const cetarchon = awakeners['awakener-0059']

  it('is present, annotated, and flagged as a realm rewriter', () => {
    expect(cetarchon).toBeDefined()
    expect(cetarchon.name).toBe('Lotan: Cetarchon')
    expect(cetarchon.realm).toBe('CHAOS')
    expect(cetarchon.rarity).toBe('Genesis')
    expect(cetarchon.annotationPending).toBe(false)
    // Primordial Breath reforges Chaos into Primordia: Chaos. SKeyDB's
    // searchTags do not carry the marker yet, so the annotation sets the flag
    // the generator actually reads.
    expect(cetarchon.annotation?.isDivineRealm).toBe(true)
  })

  it('keeps its Gnostic Potential fully unlocked, like every other limited unit', () => {
    // The correction a wholesale sync-skeydb.mjs run would clobber.
    const gnostic = cetarchon.talents?.find(
      (t: { family?: string }) => t.family === 'gnostic_potential'
    ) as { defaultMaxed?: boolean } | undefined
    expect(gnostic?.defaultMaxed).toBe(true)
  })

  it('has a hand-authored BiS entry despite SKeyDB carrying no build for her', () => {
    // recommendedWheelsFor falls back to the build record, which is null here,
    // so without db/bis.json she would gear entirely from generic filler.
    expect(cetarchon.build).toBeNull()

    const entry = getBisData()['awakener-0059']!
    // Both community guides split her by role — she is played as often as a
    // support as a carry — so the entry has to carry both variants.
    const variants = entry.variants.map((v) => v.variant)
    expect(variants).toContain('Carry')
    expect(variants).toContain('Support')

    // Deliberately NOT her signature. The guides are explicit that Cetus
    // Occasus is only best-in-slot at E1, where Sigil Yield starts converting
    // into Strike crit via Rotting Remains, and that generic crit wheels
    // perform near-identically otherwise. Celestial Beast leads because both
    // her Skills count as Strikes.
    const carry = entry.variants.find((v) => v.variant === 'Carry')!
    expect(carry.wheels[0].wheelId).toBe('wheel-0018')
    expect(carry.wheels.some((w) => w.wheelId === 'wheel-0172')).toBe(true)
  })

  it('ships her three new wheels and her signature posse', () => {
    const wheels = getWheels()
    expect(wheels['wheel-0172']?.name).toBe('Cetus Occasus')
    expect(wheels['wheel-0173']?.name).toBe('Undying Hungerbone')
    expect(wheels['wheel-0174']?.name).toBe('Falling Upward')
    // Ownerless SSR, so the Mythic retag rule applies.
    expect(wheels['wheel-0174']?.rarity).toBe('MYTHIC')

    const posse = getPosses()['posse-0053']
    expect(posse?.name).toBe('Cetus-Devouring Storm')
    expect(posse?.characterBonusFor).toBe('Lotan: Cetarchon')
  })

  it('hides the engine-internal Primordial Memory posses from every player-facing list', () => {
    // These are discovered by Primordia: Dual Recurrence / Triad Revelation.
    // They are not unlockable, not equippable, and carry no lineupToken — so
    // reaching the picker or the encoder would throw on export.
    const internal = [
      'posse-0054',
      'posse-0055',
      'posse-0056',
      'posse-0057',
      'posse-0058',
      'posse-0059',
      'posse-0060',
      'posse-0061',
    ]
    const equippable = getPosses()
    const all = getAllPosses()
    for (const id of internal) {
      expect(all[id], `${id} should still exist for reference views`).toBeDefined()
      expect(equippable[id], `${id} must not be player-selectable`).toBeUndefined()
    }
    // Every posse that survives the filter can actually be shared in a code.
    for (const posse of Object.values(equippable)) {
      expect(posse.lineupToken, `${posse.name} has no lineup token`).toBeTruthy()
    }
  })
})
