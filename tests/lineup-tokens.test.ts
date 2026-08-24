import { describe, it, expect } from 'vitest'
import { getAwakeners, getWheels, getCovenants, getPosses } from '@/lib/db'

/* ---------------------------------------------------------------------------
   Lineup token dictionary.

   Tokens are the alphabet the in-game share code is written in, so two records
   sharing one makes every code containing it ambiguous — the decoder resolves
   to whichever record it happened to see first. That is silent: nothing throws,
   codes just quietly decode to the wrong character.

   This is not hypothetical. SKeyDB reissued the awakener and wheel dictionaries
   alongside the 2.6.0 drop, shifting almost every token by one or two places,
   which handed Caraboo the token a real copied in-game code proves belongs to
   Arachne. These tests exist so the next reissue fails here instead of in
   somebody's shared lineup.
--------------------------------------------------------------------------- */

const CATEGORIES = {
  awakeners: getAwakeners,
  wheels: getWheels,
  covenants: getCovenants,
  posses: getPosses,
} as const

describe('token uniqueness', () => {
  for (const [label, load] of Object.entries(CATEGORIES)) {
    it(`assigns each ${label} token to at most one record`, () => {
      const byToken = new Map<string, string[]>()
      for (const rec of Object.values(load()) as { id: string; lineupToken?: string }[]) {
        if (!rec.lineupToken) continue
        byToken.set(rec.lineupToken, [...(byToken.get(rec.lineupToken) ?? []), rec.id])
      }
      const clashes = [...byToken.entries()].filter(([, ids]) => ids.length > 1)
      expect(
        clashes.map(([token, ids]) => `${token} → ${ids.join(', ')}`),
        `duplicate ${label} tokens make every share code containing them ambiguous`
      ).toEqual([])
    })
  }
})

describe('token coverage', () => {
  it('records every awakener without a token, so the gap is deliberate', () => {
    // A tokenless record cannot be encoded or decoded at all: lib/ingame-codec
    // skips it when building dictionaries, and encoding a team containing one
    // returns a 422 rather than a code. That is the right behaviour when the
    // true token is genuinely unknown, but it should never happen by accident.
    const missing = Object.values(getAwakeners())
      .filter((a) => !a.lineupToken)
      .map((a) => a.name)
      .sort()
    expect(missing).toEqual(['Caraboo'])
  })

  it('gives every equippable posse a token', () => {
    // The Primordial Memory posses are engine-internal and deliberately
    // tokenless; anything a player can actually equip must be shareable.
    const missing = Object.values(getPosses())
      .filter((p) => p.equippable !== false && !p.lineupToken)
      .map((p) => p.name)
    expect(missing).toEqual([])
  })
})
