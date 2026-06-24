import { describe, it, expect } from 'vitest'
import { generateTeams } from '@/lib/generate'
import { assignWheels } from '@/lib/assign'
import { getAwakeners, getWheels } from '@/lib/db'
import { fullRoster } from './helpers'

const awk = getAwakeners()
const wheels = getWheels()
const idByName = (n: string) => Object.values(awk).find((a) => a.name === n)?.id as string
const widByName = (frag: string) =>
  Object.values(wheels).find((w) => w.name && w.name.includes(frag))!.id

function built(r: any, id: string, slot: string, sk: number) {
  const e = r.awakeners[id]
  e.owned = true
  e.enlightenSlot = slot
  e.characterLevel = 90
  e.skillLevels = { Strike: sk, Defense: sk, Skill1: sk, Skill2: sk, Rouse: sk, Exalt: sk, OverExalt: sk > 6 ? 1 : 0 }
}

describe('meta teams no longer monopolised by one carry', () => {
  it('a multi-meta carry (Tawil) fills at most one meta slot, leaving room for a built unit', () => {
    const r: any = fullRoster()
    for (const id of Object.keys(r.awakeners)) r.awakeners[id].owned = false
    ;['Tawil', 'Hameln', 'Ryker', 'Karen', 'Doll: Inferno', 'Caecus', 'Lotan', 'Nautila'].forEach((n) => {
      const id = idByName(n); if (id) built(r, id, 'E1', 3) // barely invested
    })
    ;['Xu', 'Agrippa', 'Faros', 'Liz', 'Thais', 'Clementine'].forEach((n) => {
      const id = idByName(n); if (id) built(r, id, 'E3', 8) // well invested
    })

    const res = generateTeams({ roster: r, mode: 'single' })
    // No single unit may appear in more than one curated (meta-named) team.
    const metaUses: Record<string, number> = {}
    for (const t of res.teams as any[]) {
      if (!t.metaName) continue
      for (const c of t.composition) metaUses[c.awakenerId] = (metaUses[c.awakenerId] ?? 0) + 1
    }
    expect(Math.max(0, ...Object.values(metaUses))).toBeLessThanOrEqual(1)
    // The well-built Xu should surface rather than being buried under meta.
    const flat = (res.teams as any[]).flatMap((t) => t.composition.map((c: any) => c.awakenerId))
    expect(flat).toContain(idByName('Xu'))
  })
})

describe('wheel assignment substitutes a strong idle SSR', () => {
  it('borrows an idle +12 SSR over a weak filler, but never poaches a teammate\u2019s signature', () => {
    const r: any = fullRoster()
    for (const id of Object.keys(r.wheels)) r.wheels[id] = { owned: false, starLevel: 0, stackLevel: 0 }
    r.wheels[widByName('Light of Intellect')] = { owned: true, starLevel: 3, stackLevel: 12 } // Mouchette signature SR
    r.wheels[widByName('Celestial Beast')] = { owned: true, starLevel: 3, stackLevel: 12 }     // Lotan signature SSR, idle
    r.wheels[widByName('Cursed Binding')] = { owned: true, starLevel: 1, stackLevel: 0 }        // weak SR filler

    const MOUCH = idByName('Mouchette')
    const LOTAN = idByName('Lotan')
    const CB = widByName('Celestial Beast')

    const offTeam = [MOUCH, idByName('Clementine'), idByName('Thais'), idByName('Casiah')]
    const onTeam = [MOUCH, LOTAN, idByName('Thais'), idByName('Casiah')]

    const off = assignWheels(awk[MOUCH], r, new Set(), 'sub_dps', true, offTeam)
    const on = assignWheels(awk[MOUCH], r, new Set(), 'sub_dps', true, onTeam)

    expect(off.some((w) => w.wheelId === CB)).toBe(true)  // Lotan absent -> borrow the idle SSR
    expect(on.some((w) => w.wheelId === CB)).toBe(false)  // Lotan present -> leave it for him
  })
})