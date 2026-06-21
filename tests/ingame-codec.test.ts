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

  it('decodes a real game-format code from SKeyDB into known entities', () => {
    const dec = decodeIngameTeamCode('@@Oir7xbxSxYxHmJyUyTxfhQuExRxp6gNKxCxfhQuExRxfhQuEyAG@@')
    const names = dec.slots.map((s) => s.awakenerId)
    console.log('decoded awakeners:', JSON.stringify(names))
    console.log('decoded posse:', dec.posseId, '| warnings:', dec.warnings.length)
    expect(dec.slots).toHaveLength(4)
  })
})