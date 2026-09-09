import { describe, it, expect } from 'vitest'
import { getAwakeners, getTierLists } from '@/lib/db'
import { bestRankFor, buildPullTargets, buildBreakpointAdvice } from '@/lib/pull-advice'
import { fullRoster, awakenerIdByName } from './helpers'
import type { UserRoster } from '@/lib/types'

/* ---------------------------------------------------------------------------
   Per-role tier lists.

   The community publishes two separate newbie lists — carry ability and
   support value — because the answers diverge. A single `tier` field could not
   express that, which is why the Meta tab used to report Castor as a flat "A"
   when his actual value is almost entirely support utility.

   Since the September 2026 D-Effect Zone rework there is a second pair of
   lists for Nightmare and Madness, kept on separate fields. Those assume a
   maxed account and disagree with the newbie grades on purpose, so the tests
   below pin a few of the disagreements: if they ever line up, someone has
   copied one list over the other.
--------------------------------------------------------------------------- */

const awakeners = getAwakeners()
const tiers = getTierLists()

describe('tier list data', () => {
  it('covers every awakener in the db', () => {
    for (const [id, awakener] of Object.entries(awakeners)) {
      expect(tiers[id], `${awakener.name} has no tier-list entry`).toBeDefined()
    }
  })

  it('names match the db, so a rename cannot silently mis-file a grade', () => {
    for (const [id, entry] of Object.entries(tiers)) {
      expect(awakeners[id], `${entry.name} references unknown ${id}`).toBeDefined()
      expect(entry.name).toBe(awakeners[id].name)
    }
  })

  it('only uses grades from the published scales', () => {
    for (const entry of Object.values(tiers)) {
      if (entry.dpsRank) expect(['S', 'A', 'B+', 'B', 'C']).toContain(entry.dpsRank)
      if (entry.supportRank) expect(['S', 'A', 'B', 'C+', 'C']).toContain(entry.supportRank)
      // The endgame lists publish their own scales: no S or B+ on the DPS
      // side, and an X band for units that only contribute as secondary
      // damage. Reusing the newbie enum here would let a mis-transcription
      // through.
      if (entry.endgameDpsRank) {
        expect(['A', 'B', 'C', 'X']).toContain(entry.endgameDpsRank)
      }
      if (entry.endgameSupportRank) {
        expect(['S', 'A', 'B', 'C']).toContain(entry.endgameSupportRank)
      }
      // Every entry has to say something, or it should not be in the file.
      expect(
        entry.dpsRank ||
          entry.supportRank ||
          entry.endgameDpsRank ||
          entry.endgameSupportRank
      ).toBeTruthy()
    }
  })

  it('keeps the two axes genuinely independent', () => {
    // The whole reason for the split. Kathigu-Ra carries hard and supports
    // badly; Clementine is the reverse. If these ever collapse to equal, the
    // transcription has flattened and the split is doing nothing.
    const kath = tiers[awakenerIdByName('Kathigu-Ra')]
    expect(kath.dpsRank).toBe('A')
    expect(kath.supportRank).toBe('C')

    const clem = tiers[awakenerIdByName('Clementine')]
    expect(clem.dpsRank).toBe('C')
    expect(clem.supportRank).toBe('S')

    // Castor — the case that prompted the split.
    const castor = tiers[awakenerIdByName('Castor')]
    expect(castor.dpsRank).toBe('B+')
    expect(castor.supportRank).toBe('A')
  })

  it('records role-specific investment floors where the source stated one', () => {
    expect(tiers[awakenerIdByName('Mouchette')].dpsFloor).toBe('E2')
    expect(tiers[awakenerIdByName('Horla')].supportFloor).toBe('E1')
    // Helot: Catena is graded at E3 on both lists but very differently:
    // A as a carry, C+ as a support.
    const catena = tiers[awakenerIdByName('Helot: Catena')]
    expect(catena.dpsRank).toBe('A')
    expect(catena.supportRank).toBe('C+')
  })

  it('leaves an unranked role absent rather than backfilling a low grade', () => {
    // Both lists say an unlisted character would need "a crazy reason" to be
    // used in that role. That is real information and must not be flattened
    // into a C, which would read as "usable".
    const unrankedAsDps = Object.values(tiers).filter((t) => !t.dpsRank)
    expect(unrankedAsDps.length).toBeGreaterThan(0)
    expect(unrankedAsDps.map((t) => t.name)).toContain('Aigis')
  })
})

describe('rank integration', () => {
  it('merges both grades onto the annotation', () => {
    const castor = awakeners[awakenerIdByName('Castor')]
    expect(castor.annotation?.dpsRank).toBe('B+')
    expect(castor.annotation?.supportRank).toBe('A')
  })

  it('picks the role a character is actually better at', () => {
    expect(bestRankFor({ dpsRank: 'A', supportRank: 'C' })).toMatchObject({
      role: 'DPS',
      rank: 'A',
    })
    expect(bestRankFor({ dpsRank: 'C', supportRank: 'S' })).toMatchObject({
      role: 'Support',
      rank: 'S',
    })
    // A character ranked in only one role uses that one.
    expect(bestRankFor({ supportRank: 'S' })).toMatchObject({ role: 'Support' })
    expect(bestRankFor({})).toBeNull()
  })

  it('reports the grade on pull targets and breakpoints', () => {
    const roster = ((): UserRoster => {
      const r = fullRoster()
      const cleared: UserRoster['awakeners'] = {}
      for (const [id, e] of Object.entries(r.awakeners)) cleared[id] = { ...e, owned: false }
      for (const n of ['Thais', 'Clementine', 'Tinct', 'Horla']) {
        cleared[awakenerIdByName(n)] = {
          ...cleared[awakenerIdByName(n)],
          owned: true,
          enlightenSlot: 'E1',
        }
      }
      return { ...r, awakeners: cleared }
    })()

    const targets = buildPullTargets(awakeners, roster, 5)
    expect(targets.length).toBeGreaterThan(0)
    expect(targets.some((t) => t.dpsRank || t.supportRank)).toBe(true)
    expect(
      targets.some((t) => t.reasons.some((r) => /Community rank/.test(r)))
    ).toBe(true)

    const advice = buildBreakpointAdvice(awakeners, roster)
    const castor = advice.find((a) => a.name === 'Castor')!
    expect(castor.supportRank).toBe('A')
  })
})

describe('Lotan: Cetarchon grading', () => {
  it('uses the community grades now that the lists have caught up to her', () => {
    // She was carried on a local grade (A/A, sourced to Felix) while the
    // published lists predated her release. They now rank her, and they
    // disagree in both directions: a harder carry, a weaker support.
    const entry = tiers['awakener-0059']
    expect(entry.dpsRank).toBe('S')
    expect(entry.dpsFloor).toBe('E2')
    expect(entry.supportRank).toBe('B')
    expect(entry.source).toBeUndefined()
  })
})

describe('endgame tier lists', () => {
  it('ranks the units the endgame lists actually cover, and no others', () => {
    // Absence is data on these lists too, and the endgame lists are much
    // shorter than the newbie ones — a fresh account's roster is mostly
    // unranked for Nightmare and Madness.
    const graded = Object.values(tiers).filter(
      (t) => t.endgameDpsRank || t.endgameSupportRank
    )
    expect(graded.length).toBe(49)

    const caecus = tiers[awakenerIdByName('Caecus')]
    expect(caecus.supportRank).toBe('B')
    expect(caecus.endgameDpsRank).toBeUndefined()
    expect(caecus.endgameSupportRank).toBeUndefined()
  })

  it('disagrees with the newbie lists rather than mirroring them', () => {
    // Clementine is a newbie's worst carry and an endgame Madness carry.
    const clem = tiers[awakenerIdByName('Clementine')]
    expect(clem.dpsRank).toBe('C')
    expect(clem.endgameDpsRank).toBe('A')

    // Helot: Catena runs the other way: a newbie A carry, and at endgame a
    // C-tier niche support.
    const catena = tiers[awakenerIdByName('Helot: Catena')]
    expect(catena.dpsRank).toBe('A')
    expect(catena.endgameSupportRank).toBe('C')
  })

  it('records the much higher investment floors the endgame lists assume', () => {
    // Newbie floors top out at E3; endgame grades routinely sit behind OE or
    // AA, which is the single biggest reason the two lists must not be mixed.
    const mouchette = tiers[awakenerIdByName('Mouchette')]
    expect(mouchette.dpsFloor).toBe('E2')
    expect(mouchette.endgameDpsFloor).toBe('AA')

    const lotan = tiers[awakenerIdByName('Lotan')]
    expect(lotan.endgameDpsRank).toBe('A')
    expect(lotan.endgameDpsFloor).toBe('OE')
  })

  it('merges the endgame grades onto the annotation', () => {
    const xu = awakeners[awakenerIdByName('Xu')]
    expect(xu.annotation?.endgameDpsRank).toBe('A')
    expect(xu.annotation?.endgameDpsFloor).toBe('AA')
    expect(xu.annotation?.endgameSupportRank).toBe('A')
  })
})
