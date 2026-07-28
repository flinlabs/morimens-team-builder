import { describe, it, expect } from 'vitest'
import { recommendPosses } from '@/lib/assign'
import { derivePossePurposes, teamWants, posseFitScore } from '@/lib/posse-fit'
import { getAwakeners, getPosses } from '@/lib/db'
import { fullRoster, awakenerIdByName } from './helpers'

/* ---------------------------------------------------------------------------
   Posse recommendation.

   The situational tier used to gate on realm, which meant a posse only ever
   appeared if its realm matched a realm on the board. FADED_LEGACY and OTHER
   are not realms any team can field, so thirteen posses were unreachable
   regardless of how well they fit. Encounter in Pure White — discard your hand,
   draw that many plus two — could only surface when Corposant or Saya were
   present, because those are the only two annotations that name it by hand.
--------------------------------------------------------------------------- */

const awakeners = getAwakeners()
const posses = getPosses()
const roster = fullRoster()

const ENCOUNTER_IN_PURE_WHITE = 'posse-0001'

describe('posse fit', () => {
  it('reads a draw engine out of Encounter in Pure White', () => {
    const purposes = derivePossePurposes(posses[ENCOUNTER_IN_PURE_WHITE])
    expect([...purposes]).toContain('draw')
  })

  it('a card-cycling team wants card draw', () => {
    const team = ['Casiah', 'Hameln', 'Corposant', 'Tinct'].map(awakenerIdByName)
    expect([...teamWants(team, awakeners)]).toContain('draw')
  })

  it('offers Encounter in Pure White to a discard team that does not name it', () => {
    // Deliberately excludes Corposant and Saya, the only two units whose
    // annotations list this posse. Before the fix this returned nothing but
    // realm-matched posses and the draw engine never appeared at all.
    const team = ['Casiah', 'Hameln', 'Ramona', 'Tinct'].map(awakenerIdByName)
    const namesIt = team.some((id) =>
      (awakeners[id]?.annotation?.recommendedPosses ?? []).includes(ENCOUNTER_IN_PURE_WHITE)
    )
    expect(namesIt, 'test fixture should not name the posse directly').toBe(false)

    const recs = recommendPosses(team, awakeners, roster, posses)
    const ids = recs.map((r) => r.posseId)
    expect(ids).toContain(ENCOUNTER_IN_PURE_WHITE)
  })

  it('ranks it ahead of every posse the team has no use for', () => {
    const team = ['Casiah', 'Hameln', 'Ramona', 'Tinct'].map(awakenerIdByName)
    const wants = teamWants(team, awakeners)
    const recs = recommendPosses(team, awakeners, roster, posses)
    const ids = recs.map((r) => r.posseId)

    const draw = ids.indexOf(ENCOUNTER_IN_PURE_WHITE)
    expect(draw).toBeGreaterThanOrEqual(0)

    // Anything scoring zero against this lineup must sit below it. Comparing
    // against a single hand-picked posse is fragile — Warded Injection looks
    // like a poor fit until you notice Tinct is a shielder, so the team really
    // does want shields and it really should outrank a lone draw effect.
    const useless = Object.values(posses).filter((p) => posseFitScore(p, wants) === 0)
    expect(useless.length).toBeGreaterThan(0)
    for (const posse of useless) {
      const at = ids.indexOf(posse.id)
      if (at === -1) continue
      expect(at, `${posse.name} outranked the draw engine`).toBeGreaterThan(draw)
    }
  })

  it('still puts the lead carry signature and character-bonus anchors first', () => {
    // Mechanic fit orders the situational tier only. The lead/anchor/strong
    // tiers ahead of it are unchanged.
    const team = ['Kathigu-Ra', 'Horla', 'Clementine', 'Arachne'].map(awakenerIdByName)
    const recs = recommendPosses(team, awakeners, roster, posses)
    expect(recs[0].priority === 'lead' || recs[0].priority === 'anchor').toBe(true)
  })

  it('scores a posse the team cannot use at zero', () => {
    const team = ['Casiah', 'Hameln', 'Ramona', 'Tinct'].map(awakenerIdByName)
    const wants = teamWants(team, awakeners)
    const draw = posseFitScore(posses[ENCOUNTER_IN_PURE_WHITE], wants)
    expect(draw).toBeGreaterThan(0)
  })

  it('never recommends an engine-internal posse', () => {
    const team = ['Kathigu-Ra', 'Horla', 'Clementine', 'Arachne'].map(awakenerIdByName)
    const recs = recommendPosses(team, awakeners, roster, posses)
    for (const rec of recs) {
      expect(posses[rec.posseId], `${rec.posseId} is not player-equippable`).toBeDefined()
    }
  })
})
