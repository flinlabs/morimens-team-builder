import { describe, it, expect } from 'vitest'
import { encodeIngameTeamCode, decodeIngameTeamCode } from '@/lib/ingame-codec'
import { getAwakeners, getWheels, getCovenants, getPosses } from '@/lib/db'

function uniqueByToken<T extends { id: string; lineupToken?: string }>(recs: T[]): T[] {
  const counts = new Map<string, number>()
  for (const r of recs) if (r.lineupToken) counts.set(r.lineupToken, (counts.get(r.lineupToken) ?? 0) + 1)
  return recs.filter((r) => r.lineupToken && counts.get(r.lineupToken) === 1)
}

describe('ingame-codec', () => {
  const aw = uniqueByToken(Object.values(getAwakeners()))
  const wh = uniqueByToken(Object.values(getWheels()))
  const cv = uniqueByToken(Object.values(getCovenants()))
  const po = uniqueByToken(Object.values(getPosses()))

  it('encodes a lineup and decodes it back unchanged', () => {
    const team = {
      slots: [
        { awakenerId: aw[0].id, wheelIds: [wh[0].id, wh[1].id], covenantId: cv[0].id },
        { awakenerId: aw[1].id, wheelIds: [wh[2].id, null], covenantId: cv[1].id },
        { awakenerId: aw[2].id, wheelIds: [null, null] },
        { awakenerId: null, wheelIds: [null, null] },
      ],
      posseId: po[0].id,
    }
    const code = encodeIngameTeamCode(team)
    expect(code).toMatch(/^@@[A-Za-z0-9]+@@$/)
    const dec = decodeIngameTeamCode(code)
    expect(dec.warnings).toEqual([])
    expect(dec.slots[0]).toEqual({ awakenerId: aw[0].id, wheelIds: [wh[0].id, wh[1].id], covenantId: cv[0].id })
    expect(dec.slots[1]).toEqual({ awakenerId: aw[1].id, wheelIds: [wh[2].id, null], covenantId: cv[1].id })
    expect(dec.slots[2].awakenerId).toBe(aw[2].id)
    expect(dec.slots[3].awakenerId).toBeUndefined()
    expect(dec.posseId).toBe(po[0].id)
  })

  it('decodes a real copied in-game lineup to the exact units, gear, and posse', () => {
    const awById = getAwakeners()
    const whById = getWheels()
    const poById = getPosses()
    // A genuine block copied out of Morimens on 2026-11-21, after the Vivian
    // drop. It settled the token dictionary: Ogier/Ramona/Doll encode as C/M/k
    // and the four new wheels as zd/ze/zf/zi, which is SKeyDB's reissued
    // numbering. The earlier "mercury child" capture (9B41yfx…) matched the
    // old pin, so the game itself renumbered in between; codes shared before
    // that change no longer decode to the same characters.
    const block = `Investigation Lineup
Keeper: Mega（102227110） Team: D4

Vivian, The Seer's Riddle, She and Her Tree Hole, 
Ogier, Imago's Clinic, -, 
Ramona, Next Time It Rains, -, 
Doll, -, -, 
A Mouse's Wisdom

@@xsCMkzdzezfaziaaaaaaac@@`
    const dec = decodeIngameTeamCode(block)
    expect(dec.warnings).toEqual([])
    const resolved = dec.slots.map((s) => ({
      awk: s.awakenerId ? awById[s.awakenerId].name : null,
      wheels: s.wheelIds.map((id) => (id ? whById[id].name : null)),
      cov: s.covenantId ?? null,
    }))
    expect(resolved[0]).toEqual({ awk: 'Vivian', wheels: ["The Seer's Riddle", 'She and Her Tree Hole'], cov: null })
    expect(resolved[1]).toEqual({ awk: 'Ogier', wheels: ["Imago's Clinic", null], cov: null })
    expect(resolved[2]).toEqual({ awk: 'Ramona', wheels: ['Next Time It Rains', null], cov: null })
    expect(resolved[3]).toEqual({ awk: 'Doll', wheels: [null, null], cov: null })
    expect(dec.posseId ? poById[dec.posseId].name : null).toBe("A Mouse's Wisdom")
  })

  it('round-trips that capture byte for byte', () => {
    const dec = decodeIngameTeamCode('@@xsCMkzdzezfaziaaaaaaac@@')
    const again = encodeIngameTeamCode({
      slots: dec.slots.map((s) => ({
        awakenerId: s.awakenerId ?? null,
        wheelIds: s.wheelIds,
        covenantId: s.covenantId,
      })),
      posseId: dec.posseId ?? null,
    })
    expect(again).toBe('@@xsCMkzdzezfaziaaaaaaac@@')
  })
})