import { describe, it, expect } from 'vitest'
import {
  normalizeSubstats,
  resolveSubstatPriority,
  substatFit,
  toSubstatKey,
} from '@/lib/substats'
import { rankCopiesFor } from '@/lib/roster'
import { recommendCovenant, substatPriorityFor } from '@/lib/assign'
import { getAwakeners, getBisData } from '@/lib/db'
import { fullRoster, awakenerIdByName } from './helpers'
import type { CovenantEntry } from '@/lib/types'

/* ---------------------------------------------------------------------------
   Character-specific covenant substats.

   Duplicate sets roll different substats, so "which copy goes on whom" is a
   per-character question. The BiS lists say what each variant wants, in
   free text; SKeyDB says it as ordered keys. These tests pin the vocabulary
   and the copy choice.
--------------------------------------------------------------------------- */

const awakeners = getAwakeners()

// Spellings in db/bis.json that mean "no substat preference", not a stat.
const NO_PREFERENCE = new Set(['Any', 'Defense'])

describe('substat vocabulary', () => {
  it('understands every preferredStats spelling in db/bis.json', () => {
    const unknown = new Set<string>()
    for (const entry of Object.values(getBisData())) {
      for (const v of entry.variants) {
        for (const s of v.preferredStats ?? []) {
          if (!toSubstatKey(s) && !NO_PREFERENCE.has(s)) unknown.add(s)
        }
      }
    }
    expect([...unknown]).toEqual([])
  })

  it('folds the shorthand onto one key and keeps the order', () => {
    expect(normalizeSubstats(['Keyflare', 'DMG AMP', 'DR', 'AMP'])).toEqual([
      'KEYFLARE_REGEN',
      'DMG_AMP',
      'DEATH_RESISTANCE',
    ])
  })

  it('falls back to SKeyDB when the BiS list only says Any', () => {
    expect(resolveSubstatPriority(['Any'], [['CRIT_RATE'], ['CRIT_DMG']])).toEqual([
      'CRIT_RATE',
      'CRIT_DMG',
    ])
    expect(resolveSubstatPriority(['Crit DMG'], [['CRIT_RATE']])).toEqual(['CRIT_DMG'])
  })

  it('gives every awakener with build data a non-empty priority', () => {
    const empty = Object.values(awakeners)
      .filter((a) => (getBisData()[a.id]?.variants.length || a.build?.builds?.length))
      .filter((a) => substatPriorityFor(a).length === 0)
      .map((a) => a.name)
    expect(empty).toEqual([])
  })
})

describe('copy choice', () => {
  const sixPiece = { threePieceComplete: true, sixPieceComplete: true, completionPercent: 100 }
  const entry: CovenantEntry = {
    owned: true,
    threePieceComplete: true,
    sixPieceComplete: true,
    completionPercent: 100,
    copies: [
      { id: 'copy-1', ...sixPiece, substatTotals: { KEYFLARE_REGEN: 6, DMG_AMP: 4 } },
      { id: 'copy-2', ...sixPiece, substatTotals: { CRIT_RATE: 12, CRIT_DMG: 20 } },
    ],
  }
  const someone = Object.keys(awakeners)[0]

  it('hands each character the copy that rolled what they want', () => {
    expect(rankCopiesFor(entry, someone, ['CRIT_RATE', 'CRIT_DMG'])[0].id).toBe('copy-2')
    expect(rankCopiesFor(entry, someone, ['KEYFLARE_REGEN'])[0].id).toBe('copy-1')
  })

  it('still puts a finished 6-piece ahead of a better-rolled 3-piece', () => {
    const mixed: CovenantEntry = {
      ...entry,
      copies: [
        { ...entry.copies![0], sixPieceComplete: true },
        { ...entry.copies![1], sixPieceComplete: false, completionPercent: 60 },
      ],
    }
    expect(rankCopiesFor(mixed, someone, ['CRIT_RATE'])[0].id).toBe('copy-1')
  })

  it('gives Mouchette the crit-rolled copy of her covenant', () => {
    const mouchette = awakeners[awakenerIdByName('Mouchette')]
    const priority = substatPriorityFor(mouchette)
    expect(priority[0]).toBe('CRIT_RATE')

    const roster = fullRoster()
    const covenantId = getBisData()[mouchette.id].variants[0].covenants[0].covenantId
    roster.covenants[covenantId] = entry
    const rec = recommendCovenant(mouchette, roster)
    expect(rec.covenantId).toBe(covenantId)
    expect(rec.copyId).toBe('copy-2')
    expect(rec.prioritySubstats).toEqual(priority)
  })
})

describe('copy fit for the covenant view', () => {
  it('ranks a character whose top stat rolled above one who shares their last', () => {
    const totals = { CRIT_RATE: 9 }
    const carry = substatFit(totals, ['CRIT_RATE', 'CRIT_DMG'])
    const support = substatFit(totals, ['KEYFLARE_REGEN', 'DMG_AMP', 'CRIT_RATE'])
    expect(carry.score).toBeGreaterThan(support.score)
    expect(carry.matched).toEqual(['CRIT_RATE'])
  })
})
