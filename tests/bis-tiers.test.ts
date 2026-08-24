import { describe, it, expect } from 'vitest'
import { BIS_TIER_ORDER, BIS_TIER_LABEL, bisTierRank } from '@/lib/bis-client'
import { getBisData, getAwakeners } from '@/lib/db'

/* ---------------------------------------------------------------------------
   BiS tier vocabulary.

   The reverse lookup ("which characters want this wheel") and the recommended
   gear panel both rank and label tiers. Those tables were written twice, by
   hand, months apart, and drifted: one copy omitted SR_SHOP and GOOD while
   inventing BIS_MYTHIC and BIS_R. These tests pin the vocabulary to the data
   so the next tier added to db/bis.json fails here instead of silently
   sorting to the bottom of a list with no label.
--------------------------------------------------------------------------- */

function tiersInData(): Set<string> {
  const out = new Set<string>()
  for (const entry of Object.values(getBisData())) {
    for (const variant of entry.variants ?? []) {
      for (const w of variant.wheels ?? []) out.add(w.tier)
    }
  }
  return out
}

describe('tier vocabulary', () => {
  it('ranks every tier that actually appears in bis.json', () => {
    for (const tier of tiersInData()) {
      expect(
        (BIS_TIER_ORDER as readonly string[]).includes(tier),
        `${tier} is in db/bis.json but not in BIS_TIER_ORDER — it would sort last`
      ).toBe(true)
    }
  })

  it('labels every tier that actually appears in bis.json', () => {
    for (const tier of tiersInData()) {
      expect(BIS_TIER_LABEL[tier], `${tier} has no display label`).toBeTruthy()
    }
  })

  it('does not carry tiers the data has never used', () => {
    // Dead entries are how the two tables diverged without anyone noticing.
    const live = tiersInData()
    for (const tier of BIS_TIER_ORDER) {
      expect(live.has(tier), `${tier} is ranked but appears nowhere in db/bis.json`).toBe(true)
    }
  })

  it('ranks strongest first and sends unknown tiers to the back', () => {
    expect(bisTierRank('BIS_SSR')).toBeLessThan(bisTierRank('ALT_SSR'))
    expect(bisTierRank('ALT_SSR')).toBeLessThan(bisTierRank('BIS_SR'))
    expect(bisTierRank('BIS_SR')).toBeLessThan(bisTierRank('SR_SHOP'))
    expect(bisTierRank('NOT_A_TIER')).toBe(BIS_TIER_ORDER.length)
  })
})

describe('reverse lookup integrity', () => {
  it('every wheel and covenant named in bis.json resolves to a real awakener', () => {
    const awakeners = getAwakeners()
    for (const [key, entry] of Object.entries(getBisData())) {
      expect(awakeners[entry.awakenerId], `${key} points at a missing awakener`).toBeTruthy()
    }
  })
})
