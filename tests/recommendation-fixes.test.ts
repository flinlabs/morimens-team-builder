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
  it('borrows an idle +12 SSR over a weak SR filler when the unit owns no BiS wheel', () => {
    const r: any = fullRoster()
    for (const id of Object.keys(r.wheels)) r.wheels[id] = { owned: false, starLevel: 0, stackLevel: 0 }
    r.wheels[widByName('Light of Intellect')] = { owned: true, starLevel: 3, stackLevel: 12 } // Mouchette signature SR
    r.wheels[widByName('Celestial Beast')] = { owned: true, starLevel: 3, stackLevel: 12 }     // idle SSR
    r.wheels[widByName('Cursed Binding')] = { owned: true, starLevel: 1, stackLevel: 0 }        // weak SR filler

    const MOUCH = idByName('Mouchette')
    const CB = widByName('Celestial Beast')

    const out = assignWheels(awk[MOUCH], r, new Set(), 'sub_dps', true)
    // The idle +12 SSR is worth more than a weak SR, so it should be borrowed.
    expect(out.some((w) => w.wheelId === CB)).toBe(true)
  })
})

describe('Overlimit Causality — two SSR/MYTHIC wheels need one at +12', () => {
  // Pick a unit and two high-rarity wheels it can legally hold.
  const UNIT = idByName('Arachne')
  const ssrA = Object.values(wheels).find((w) => w.rarity === 'SSR')!.id
  const ssrB = Object.values(wheels).find((w) => w.rarity === 'SSR' && w.id !== ssrA)!.id
  const isHigh = (id?: string) => !!id && ['SSR', 'MYTHIC'].includes(wheels[id]?.rarity)

  function rosterWith(a: { stack: number }, b: { stack: number }) {
    const r: any = fullRoster()
    for (const id of Object.keys(r.wheels)) r.wheels[id] = { owned: false, starLevel: 0, stackLevel: 0 }
    r.wheels[ssrA] = { owned: true, starLevel: 3, stackLevel: a.stack }
    r.wheels[ssrB] = { owned: true, starLevel: 3, stackLevel: b.stack }
    // A couple of SR fillers so the second slot has a legal lower-rarity option.
    for (const w of Object.values(wheels)) {
      if (w.rarity === 'SR') r.wheels[w.id] = { owned: true, starLevel: 1, stackLevel: 0 }
    }
    return r
  }

  it('never equips a second SSR when neither owned SSR is +12', () => {
    const r = rosterWith({ stack: 4 }, { stack: 7 })
    const out = assignWheels(awk[UNIT], r, new Set(), 'main_dps', true)
    const owned = out.filter((w) => w.tier !== 'FALLBACK')
    const highCount = owned.filter((w) => isHigh(w.wheelId)).length
    expect(highCount).toBeLessThanOrEqual(1)
  })

  it('allows two SSRs when the FIRST equipped wheel is +12', () => {
    const r = rosterWith({ stack: 12 }, { stack: 5 })
    const out = assignWheels(awk[UNIT], r, new Set(), 'main_dps', true)
    const highCount = out.filter((w) => w.tier !== 'FALLBACK' && isHigh(w.wheelId)).length
    expect(highCount).toBe(2)
  })

  it('allows two SSRs when only the SECOND wheel is +12 (interpretation B)', () => {
    const r = rosterWith({ stack: 6 }, { stack: 12 })
    const out = assignWheels(awk[UNIT], r, new Set(), 'main_dps', true)
    const highCount = out.filter((w) => w.tier !== 'FALLBACK' && isHigh(w.wheelId)).length
    expect(highCount).toBe(2)
  })

  it('never suggests two unowned SSR FALLBACK targets together', () => {
    const r: any = fullRoster()
    for (const id of Object.keys(r.wheels)) r.wheels[id] = { owned: false, starLevel: 0, stackLevel: 0 }
    const out = assignWheels(awk[UNIT], r, new Set(), 'main_dps', true)
    const highFallbacks = out.filter((w) => w.tier === 'FALLBACK' && isHigh(w.wheelId)).length
    expect(highFallbacks).toBeLessThanOrEqual(1)
  })
})