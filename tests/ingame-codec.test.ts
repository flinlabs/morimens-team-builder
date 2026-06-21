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
    const cvById = getCovenants()
    const poById = getPosses()
    // A genuine block copied out of Morimens, header and all.
    const block = `Investigation Lineup
Keeper: mercury child（101242880） Team: Team7
Clementine, Veiled Anguish, Elevated Focus, Life Drain
Horla, The Last Verse, Poetic Bygone Days, Dream of Medicine
Arachne, Eternal Weave, Amidst the Downpour, Steppenwolf
Kathigu-Ra, Amber-Tinted Death, Blade of the Titan, April Tribute
Undying Sun
@@9B41yfxDkxRyivyn1nowbR@@`
    const dec = decodeIngameTeamCode(block)
    expect(dec.warnings).toEqual([])
    const resolved = dec.slots.map((s) => ({
      awk: s.awakenerId ? awById[s.awakenerId].name : null,
      wheels: s.wheelIds.map((id) => (id ? whById[id].name : null)),
      cov: s.covenantId ? cvById[s.covenantId].name : null,
    }))
    expect(resolved[0]).toEqual({ awk: 'Clementine', wheels: ['Veiled Anguish', 'Elevated Focus'], cov: 'Life Drain' })
    expect(resolved[1]).toEqual({ awk: 'Horla', wheels: ['The Last Verse', 'Poetic Bygone Days'], cov: 'Dream of Medicine' })
    expect(resolved[2]).toEqual({ awk: 'Arachne', wheels: ['Eternal Weave', 'Amidst the Downpour'], cov: 'Steppenwolf' })
    expect(resolved[3]).toEqual({ awk: 'Kathigu-Ra', wheels: ['Amber-Tinted Death', 'Blade of the Titan'], cov: 'April Tribute' })
    expect(dec.posseId ? poById[dec.posseId].name : null).toBe('Undying Sun')
  })
})