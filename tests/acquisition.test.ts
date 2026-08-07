import { describe, it, expect } from 'vitest'
import {
  itemsForAwakener,
  itemsForWheel,
  limitedArcOf,
  wheelLimitedArc,
  routeSummary,
} from '@/lib/acquisition'
import { buildPullTargets } from '@/lib/pull-advice'
import { getAwakeners, getWheels, getAcquisitionCatalog } from '@/lib/db'
import { fullRoster, awakenerIdByName } from './helpers'
import type { UserRoster } from '@/lib/types'

const awakeners = getAwakeners()
const wheels = getWheels()
const catalog = getAcquisitionCatalog()

function emptyRoster(): UserRoster {
  const r = fullRoster()
  const aw: UserRoster['awakeners'] = {}
  for (const [id, e] of Object.entries(r.awakeners)) aw[id] = { ...e, owned: false }
  const wh: UserRoster['wheels'] = {}
  for (const [id, e] of Object.entries(r.wheels)) wh[id] = { ...e, owned: false }
  return { ...r, awakeners: aw, wheels: wh, currencies: {} }
}

describe('acquisition catalog', () => {
  it('loads every item with a usable shape', () => {
    expect(catalog.items.length).toBeGreaterThan(20)
    const slugs = new Set<string>()
    for (const item of catalog.items) {
      expect(item.slug, `${item.name} has no slug`).toBeTruthy()
      expect(slugs.has(item.slug), `duplicate slug ${item.slug}`).toBe(false)
      slugs.add(item.slug)
      expect(['awakener', 'wheel']).toContain(item.grants)
      expect(['choose', 'random']).toContain(item.selection)
    }
  })

  it('covers both arcs symmetrically, with Fated Captures renamed in Arc 2', () => {
    const fl = catalog.items.filter((i) => i.arc === 'FADED_LEGACY')
    const ar = catalog.items.filter((i) => i.arc === 'ASTRAL_REIGN')
    expect(fl.length).toBe(ar.length)
    expect(catalog.items.find((i) => i.slug === 'fated-captures-fl')?.arc).toBe('FADED_LEGACY')
    expect(catalog.items.find((i) => i.slug === 'suspended-fate-ar')?.arc).toBe('ASTRAL_REIGN')
  })
})

describe('arc derivation', () => {
  it('reads limited arc off availabilityType, and leaves permanents unlimited', () => {
    expect(limitedArcOf('LIMITED_FADED_LEGACY')).toBe('FADED_LEGACY')
    expect(limitedArcOf('LIMITED_ASTRAL_REIGN')).toBe('ASTRAL_REIGN')
    expect(limitedArcOf('PERMANENT')).toBeNull()
    expect(limitedArcOf('WELFARE')).toBeNull()
  })

  it('inherits a signature wheel arc from its owner', () => {
    // db/wheels.json carries no availability data of its own, so this
    // derivation is the only thing standing between the arc-locked selectors
    // and recommending an unobtainable wheel.
    const cetus = wheels['wheel-0172']
    expect(cetus.ownerAwakenerId).toBe('awakener-0059')
    expect(wheelLimitedArc(cetus, awakeners)).toBe('ASTRAL_REIGN')

    // Ownerless Mythic wheels have nothing to inherit from and are treated as
    // outside these items entirely rather than guessed at.
    const mythic = Object.values(wheels).find((w) => w.rarity === 'MYTHIC')!
    expect(wheelLimitedArc(mythic, awakeners)).toBeNull()
  })
})

describe('routing a recommendation to an item', () => {
  const roster = emptyRoster()

  it('offers only realm-matching selectors for a limited character', () => {
    // "24" is Chaos and Faded Legacy, so the Chaos Arc 1 selector applies and
    // the Ultra one does not. Kathigu-Ra is deliberately NOT used here: he is
    // Chaos but LIMITED_ASTRAL_REIGN, so no Arc 1 selector can produce him.
    const unit = awakeners[awakenerIdByName('"24"')]
    expect(unit.realm).toBe('CHAOS')
    expect(unit.availabilityType).toBe('LIMITED_FADED_LEGACY')
    const slugs = itemsForAwakener(unit, catalog, roster).map((i) => i.slug)
    expect(slugs).toContain('chaos-echo-fl')
    expect(slugs).toContain('sepirot-captures-fl')
    expect(slugs).not.toContain('ultra-mapping-fl')
    expect(slugs).not.toContain('chaos-echo-ar')
  })

  it('will not route an Astral Reign character through an Arc 1 selector', () => {
    const kath = awakeners[awakenerIdByName('Kathigu-Ra')]
    expect(kath.availabilityType).toBe('LIMITED_ASTRAL_REIGN')
    const slugs = itemsForAwakener(kath, catalog, roster).map((i) => i.slug)
    expect(slugs).toContain('chaos-echo-ar')
    expect(slugs).not.toContain('chaos-echo-fl')
  })

  it('never offers an arc-locked selector for a permanent character', () => {
    const permanent = Object.values(awakeners).find(
      (a) => a.availabilityType === 'PERMANENT'
    )!
    const items = itemsForAwakener(permanent, catalog, roster)
    expect(items.every((i) => !i.arc)).toBe(true)
  })

  it('withholds owned-only items until the thing is actually owned', () => {
    const kath = awakeners[awakenerIdByName('"24"')]
    const unowned = itemsForAwakener(kath, catalog, roster).map((i) => i.slug)
    expect(unowned).not.toContain('prototype-horizon')

    const owning = { ...roster, awakeners: { ...roster.awakeners } }
    owning.awakeners[kath.id] = { ...owning.awakeners[kath.id], owned: true }
    expect(itemsForAwakener(kath, catalog, owning).map((i) => i.slug)).toContain(
      'prototype-horizon'
    )
  })

  it('will not offer a Timeloop Copy for a wheel the player does not have', () => {
    // The one hard constraint stated on the item: it duplicates, it cannot
    // acquire.
    const wheel = wheels['wheel-0172']
    expect(itemsForWheel(wheel, catalog, roster, awakeners).map((i) => i.slug)).not.toContain(
      'timeloop-copy'
    )
  })

  it('prefers something held, and a guaranteed pick over a random one', () => {
    const unit = awakeners[awakenerIdByName('"24"')]
    const items = itemsForAwakener(unit, catalog, roster)

    const holdingRandom = { ...roster, currencies: { 'sepirot-captures-fl': 2 } }
    expect(routeSummary(items, holdingRandom)).toMatch(/2× Sepirot Captures/)
    expect(routeSummary(items, holdingRandom)).toMatch(/random/)

    // A choose item the player holds beats a random one they also hold.
    const holdingBoth = {
      ...roster,
      currencies: { 'sepirot-captures-fl': 2, 'chaos-echo-fl': 1 },
    }
    expect(routeSummary(items, holdingBoth)).toMatch(/Chaos Echo/)

    // Holding nothing still names the best route rather than going silent.
    expect(routeSummary(items, roster)).toMatch(/Obtainable with/)
  })
})

describe('advice uses the routes', () => {
  it('tells the player how to act on each recommendation', () => {
    const roster = { ...emptyRoster(), currencies: { 'chaos-echo-fl': 1 } }
    for (const n of ['Clementine', 'Tinct']) {
      roster.awakeners[awakenerIdByName(n)] = {
        ...roster.awakeners[awakenerIdByName(n)],
        owned: true,
        enlightenSlot: 'E0',
      }
    }
    const targets = buildPullTargets(awakeners, roster, 30, catalog)
    expect(targets.length).toBeGreaterThan(0)
    expect(targets.some((t) => !!t.route)).toBe(true)

    const held = targets.find((t) => t.route?.startsWith('You hold'))
    expect(held, 'a held item should be surfaced on at least one target').toBeDefined()
  })

  it('still produces advice for a roster too small to field a full team', () => {
    // The case that matters most: a brand new player with two characters. An
    // earlier version required four fieldable units before it would score
    // anything, so this returned nothing at all.
    const roster = emptyRoster()
    for (const n of ['Clementine', 'Tinct']) {
      roster.awakeners[awakenerIdByName(n)] = {
        ...roster.awakeners[awakenerIdByName(n)],
        owned: true,
        enlightenSlot: 'E0',
      }
    }
    const targets = buildPullTargets(awakeners, roster, 10, catalog)
    expect(targets.length).toBeGreaterThan(0)
  })
})
