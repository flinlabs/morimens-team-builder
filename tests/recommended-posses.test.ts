import { describe, it, expect } from 'vitest'
import { generateTeams } from '@/lib/generate'
import { getAwakeners } from '@/lib/db'
import { fullRoster } from './helpers'

const awk = getAwakeners()
const idByName = (n: string) => Object.values(awk).find((a) => a.name === n)?.id as string

function built(r: any, id: string, slot: string, sk: number) {
  const e = r.awakeners[id]
  e.owned = true
  e.enlightenSlot = slot
  e.characterLevel = 90
  e.skillLevels = { Strike: sk, Defense: sk, Skill1: sk, Skill2: sk, Rouse: sk, Exalt: sk, OverExalt: sk > 6 ? 1 : 0 }
}

describe('built characters rank ahead of curated meta', () => {
  it('a well-built unit leads while a barely-built meta carry sinks down the list', () => {
    const r: any = fullRoster()
    for (const id of Object.keys(r.awakeners)) r.awakeners[id].owned = false
    ;['Tawil', 'Hameln', 'Ryker', 'Karen', 'Doll: Inferno', 'Caecus', 'Lotan', 'Nautila'].forEach((n) => {
      const id = idByName(n); if (id) built(r, id, 'E1', 3) // barely invested
    })
    ;['Xu', 'Agrippa', 'Faros', 'Liz', 'Thais', 'Clementine'].forEach((n) => {
      const id = idByName(n); if (id) built(r, id, 'E3', 8) // well invested
    })

    const res = generateTeams({ roster: r, mode: 'single' })
    const teamIds = (t: any) => t.composition.map((c: any) => c.awakenerId)

    // The top team is built around the well-invested Xu, not the barely-built
    // Tawil meta comps.
    expect(teamIds(res.teams[0])).toContain(idByName('Xu'))

    // Any Tawil meta team that does appear ranks below at least one built team.
    const firstXu = (res.teams as any[]).findIndex((t) => teamIds(t).includes(idByName('Xu')))
    const firstTawil = (res.teams as any[]).findIndex((t) => teamIds(t).includes(idByName('Tawil')))
    expect(firstXu).toBeGreaterThanOrEqual(0)
    if (firstTawil >= 0) expect(firstXu).toBeLessThan(firstTawil)
  })
})