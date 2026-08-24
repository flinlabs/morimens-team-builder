import { describe, it, expect } from 'vitest'
import {
  covenantCopies,
  copiesAvailableTo,
  rankCopiesFor,
  addCovenantCopy,
  removeCovenantCopy,
  bindCovenantCopy,
  updateCovenantCopy,
  getCovenantEntry,
  migrateRoster,
  canBindCovenants,
  COVENANT_BINDING_LEVEL,
} from '@/lib/roster'
import { recommendCovenant } from '@/lib/assign'
import { getAwakeners } from '@/lib/db'
import { fullRoster } from './helpers'
import type { CovenantEntry, UserRoster } from '@/lib/types'

/* ---------------------------------------------------------------------------
   Covenant binding (patch 2.6.0).

   Two changes the engine has to absorb: a set is no longer one physical item,
   and a bound copy is exclusive to its owner. The old model enforced one set
   per team, which is wrong in both directions now — it blocked a legitimate
   duplicate and would have handed someone else's bound set to a stranger.
--------------------------------------------------------------------------- */

const awakeners = getAwakeners()
const [aliceId, bobId] = Object.keys(awakeners)

const legacy: CovenantEntry = {
  owned: true,
  threePieceComplete: true,
  sixPieceComplete: false,
  completionPercent: 55,
}

describe('copy normalisation', () => {
  it('reads a pre-2.6.0 entry as exactly one copy', () => {
    const copies = covenantCopies(legacy)
    expect(copies).toHaveLength(1)
    expect(copies[0].completionPercent).toBe(55)
    expect(copies[0].threePieceComplete).toBe(true)
    expect(copies[0].boundTo).toBeUndefined()
  })

  it('reports no copies for an unowned set', () => {
    expect(covenantCopies({ ...legacy, owned: false })).toHaveLength(0)
  })

  it('prefers the explicit array once one exists', () => {
    const entry: CovenantEntry = {
      ...legacy,
      copies: [
        { id: 'copy-1', threePieceComplete: false, sixPieceComplete: true, completionPercent: 90 },
      ],
    }
    expect(covenantCopies(entry)).toHaveLength(1)
    expect(covenantCopies(entry)[0].sixPieceComplete).toBe(true)
  })
})

describe('migration', () => {
  it('lifts legacy completion into copies and binds nothing', () => {
    const roster = migrateRoster({
      version: 2,
      covenants: { 'covenant-0001': legacy },
      awakeners: {},
      wheels: {},
      posses: {},
    } as unknown as UserRoster)
    const copies = getCovenantEntry(roster, 'covenant-0001').copies
    expect(copies).toHaveLength(1)
    expect(copies?.[0].completionPercent).toBe(55)
    expect(copies?.[0].boundTo).toBeUndefined()
  })
})

describe('binding gate', () => {
  it('unlocks at Investigation Level 60', () => {
    const r = fullRoster()
    expect(canBindCovenants({ ...r, keeperLevel: COVENANT_BINDING_LEVEL - 1 })).toBe(false)
    expect(canBindCovenants({ ...r, keeperLevel: COVENANT_BINDING_LEVEL })).toBe(true)
  })
})

describe('availability and ranking', () => {
  const twoCopies: CovenantEntry = {
    owned: true,
    threePieceComplete: false,
    sixPieceComplete: false,
    completionPercent: 0,
    copies: [
      { id: 'copy-1', threePieceComplete: true, sixPieceComplete: true, completionPercent: 100 },
      { id: 'copy-2', threePieceComplete: true, sixPieceComplete: false, completionPercent: 40 },
    ],
  }

  it('hides a copy bound to someone else', () => {
    const entry: CovenantEntry = {
      ...twoCopies,
      copies: [{ ...twoCopies.copies![0], boundTo: bobId }, twoCopies.copies![1]],
    }
    const mine = copiesAvailableTo(entry, aliceId)
    expect(mine.map((c) => c.id)).toEqual(['copy-2'])
    expect(copiesAvailableTo(entry, bobId)).toHaveLength(2)
  })

  it('ranks the better-rolled copy first when nothing is bound', () => {
    expect(rankCopiesFor(twoCopies, aliceId)[0].id).toBe('copy-1')
  })

  it('puts my bound copy ahead of a better free one', () => {
    // Prismatic is +50% main attribute and nobody else can ever take it, so a
    // worse-rolled bound copy still beats a stronger set that stays available.
    const entry: CovenantEntry = {
      ...twoCopies,
      copies: [twoCopies.copies![0], { ...twoCopies.copies![1], boundTo: aliceId }],
    }
    expect(rankCopiesFor(entry, aliceId)[0].id).toBe('copy-2')
    expect(rankCopiesFor(entry, bobId)[0].id).toBe('copy-1')
  })
})

describe('mutators', () => {
  it('adds, edits and removes copies without disturbing the others', () => {
    let r = fullRoster()
    r = addCovenantCopy(r, 'covenant-0001')
    r = addCovenantCopy(r, 'covenant-0001')
    const ids = covenantCopies(getCovenantEntry(r, 'covenant-0001')).map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)

    const last = ids[ids.length - 1]
    const before = covenantCopies(getCovenantEntry(r, 'covenant-0001'))
    r = updateCovenantCopy(r, 'covenant-0001', last, { sixPieceComplete: true })
    const edited = covenantCopies(getCovenantEntry(r, 'covenant-0001'))
    expect(edited.find((c) => c.id === last)?.sixPieceComplete).toBe(true)
    // Every copy the edit did not name is untouched — the whole point of
    // per-copy records is that they do not share state.
    for (const original of before.filter((c) => c.id !== last)) {
      expect(edited.find((c) => c.id === original.id)).toEqual(original)
    }

    r = removeCovenantCopy(r, 'covenant-0001', last)
    expect(covenantCopies(getCovenantEntry(r, 'covenant-0001')).map((c) => c.id)).not.toContain(last)
  })

  it('releases an awakener’s previous binding within the same set', () => {
    let r = fullRoster()
    r = addCovenantCopy(r, 'covenant-0002')
    const [one, two] = covenantCopies(getCovenantEntry(r, 'covenant-0002')).map((c) => c.id)
    r = bindCovenantCopy(r, 'covenant-0002', one, aliceId)
    r = bindCovenantCopy(r, 'covenant-0002', two, aliceId)
    const copies = covenantCopies(getCovenantEntry(r, 'covenant-0002'))
    expect(copies.filter((c) => c.boundTo === aliceId).map((c) => c.id)).toEqual([two])
  })

  it('unbinds when no awakener is given', () => {
    let r = fullRoster()
    const id = covenantCopies(getCovenantEntry(r, 'covenant-0001'))[0].id
    r = bindCovenantCopy(r, 'covenant-0001', id, aliceId)
    r = bindCovenantCopy(r, 'covenant-0001', id, undefined)
    expect(covenantCopies(getCovenantEntry(r, 'covenant-0001'))[0].boundTo).toBeUndefined()
  })
})

describe('assignment', () => {
  it('lets two awakeners share a set when two copies are owned', () => {
    let r = fullRoster()
    const alice = awakeners[aliceId]
    const used = new Set<string>()
    const first = recommendCovenant(alice, r, undefined, used)
    if (!first.covenantId || !first.copyId) return

    r = addCovenantCopy(r, first.covenantId)
    const used2 = new Set<string>()
    const a = recommendCovenant(alice, r, undefined, used2)
    const b = recommendCovenant(alice, r, undefined, used2)
    expect(a.covenantId).toBe(b.covenantId)
    expect(a.copyId).not.toBe(b.copyId)
  })

  it('never hands a bound copy to a different awakener', () => {
    let r = fullRoster()
    const alice = awakeners[aliceId]
    const probe = recommendCovenant(alice, r, undefined, new Set())
    if (!probe.covenantId || !probe.copyId) return

    r = bindCovenantCopy(r, probe.covenantId, probe.copyId, bobId)
    const got = recommendCovenant(alice, r, undefined, new Set())
    if (got.covenantId === probe.covenantId) {
      expect(got.copyId).not.toBe(probe.copyId)
    }
  })

  it('flags the assigned copy as Prismatic when it is bound to the wearer', () => {
    let r = fullRoster()
    const alice = awakeners[aliceId]
    const probe = recommendCovenant(alice, r, undefined, new Set())
    if (!probe.covenantId || !probe.copyId) return

    r = bindCovenantCopy(r, probe.covenantId, probe.copyId, aliceId)
    const got = recommendCovenant(alice, r, undefined, new Set())
    expect(got.copyId).toBe(probe.copyId)
    expect(got.prismatic).toBe(true)
    expect(got.note).toMatch(/Prismatic/)
  })
})
