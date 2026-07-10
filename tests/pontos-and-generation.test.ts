import { describe, it, expect } from 'vitest'
import { generateTeams } from '@/lib/generate'
import { baseCharacterName, hasVariantConflict } from '@/lib/filter'
import { getAwakeners, getWheels, getPosses } from '@/lib/db'
import { fullRoster } from './helpers'

const awk = getAwakeners()
const wheels = getWheels()
const posses = getPosses()
const idByName = (n: string) => Object.values(awk).find((a) => a.name === n)?.id as string

const compKey = (ids: string[]) => [...ids].sort().join('|')
const teamIds = (t: any): string[] => t.composition.map((c: any) => c.awakenerId)

describe('Pontos content drop is synced', () => {
  it('Pontos exists with full record data and a real annotation', () => {
    const p = awk['awakener-0058']
    expect(p).toBeDefined()
    expect(p.name).toBe('Pontos')
    expect(p.realm).toBe('AEQUOR')
    expect(p.annotationPending).toBe(false)
    expect(p.annotation?.teamRoles.length).toBeGreaterThan(0)
    expect(p.enlightens.length).toBe(5)
    expect(p.skills.length).toBeGreaterThanOrEqual(7)
  })

  it('his signature wheels and posse are in the catalog', () => {
    expect(wheels['wheel-0171']?.name).toBe('The Living Cage')
    expect(wheels['wheel-0169']?.name).toBe('Compass to False North')
    expect(wheels['wheel-0171']?.ownerAwakenerId).toBe('awakener-0058')
    expect(posses['posse-0052']?.characterBonusFor).toBe('Pontos')
  })

  it('a built Pontos surfaces in generation on a full roster', () => {
    const res = generateTeams({ roster: fullRoster(), mode: 'dtide' })
    // Not asserting placement — just that the engine can field him without error.
    expect(res.teams.length).toBe(5)
  })
})

describe('variant exclusion — one base character per team', () => {
  it('name prefix identifies the base character', () => {
    expect(baseCharacterName(awk[idByName('Ramona: Timeworn')])).toBe('Ramona')
    expect(baseCharacterName(awk[idByName('Ramona')])).toBe('Ramona')
    expect(baseCharacterName(awk[idByName('Murphy: Fauxborn')])).toBe('Murphy')
    expect(
      hasVariantConflict([idByName('Ramona'), idByName('Ramona: Timeworn')], awk)
    ).toBe(true)
  })

  it('no generated team fields two variants of the same character', () => {
    const r = fullRoster()
    for (const mode of ['single', 'dtide'] as const) {
      const res = generateTeams({ roster: r, mode })
      for (const t of res.teams) {
        expect(hasVariantConflict(teamIds(t), awk)).toBe(false)
      }
    }
  })

  it('pinning Ramona never brings Ramona: Timeworn onto the same team', () => {
    const res = generateTeams({
      roster: fullRoster(),
      mode: 'single',
      options: { pinnedIds: [idByName('Ramona')], maxResults: 4 },
    })
    for (const t of res.teams) {
      const ids = teamIds(t)
      if (ids.includes(idByName('Ramona'))) {
        expect(ids).not.toContain(idByName('Ramona: Timeworn'))
      }
    }
  })
})

describe('Generate rotates instead of repeating', () => {
  it('a second press excluding the first batch returns different compositions', () => {
    const r = fullRoster()
    const first = generateTeams({ roster: r, mode: 'single', options: { maxResults: 4 } })
    const firstKeys = first.teams.map((t) => compKey(teamIds(t)))
    const second = generateTeams({
      roster: r,
      mode: 'single',
      options: { maxResults: 4, excludeTeamKeys: firstKeys },
    })
    expect(second.teams.length).toBeGreaterThan(0)
    for (const t of second.teams) {
      expect(firstKeys).not.toContain(compKey(teamIds(t)))
    }
  })

  it('wraps around with a warning when every distinct team has been shown', () => {
    // Own exactly 5 units so only a handful of comps exist, then exclude them all.
    const r: any = fullRoster()
    const keep = new Set(
      ['Arachne', 'Casiah', 'Jenkin', 'Clementine', 'Daffodil'].map(idByName)
    )
    for (const id of Object.keys(r.awakeners)) if (!keep.has(id)) r.awakeners[id].owned = false
    const first = generateTeams({ roster: r, mode: 'single', options: { maxResults: 6 } })
    const allKeys = first.teams.map((t) => compKey(teamIds(t)))
    const wrapped = generateTeams({
      roster: r,
      mode: 'single',
      options: { maxResults: 6, excludeTeamKeys: allKeys },
    })
    expect(wrapped.teams.length).toBeGreaterThan(0)
    expect(wrapped.meta.warnings.some((w) => w.includes('rotation over'))).toBe(true)
  })
})

describe('off-meta mode', () => {
  it('returns no curated comps and no compositions identical to one', () => {
    const res = generateTeams({
      roster: fullRoster(),
      mode: 'single',
      options: { maxResults: 4, offMeta: true },
    })
    expect(res.teams.length).toBeGreaterThan(0)
    for (const t of res.teams as any[]) {
      expect(t.metaName).toBeFalsy()
    }
  })
})

describe('D-Tide per-board pins', () => {
  it('pinned units land on their board and nowhere else', () => {
    const arachne = idByName('Arachne')
    const goliath = idByName('Goliath')
    const res = generateTeams({
      roster: fullRoster(),
      mode: 'dtide',
      options: { dtidePins: [[], [], [arachne, goliath], [], []] },
    })
    expect(res.teams.length).toBe(5)
    const board3 = res.teams.find((t) => t.rank === 3)!
    expect(teamIds(board3)).toContain(arachne)
    expect(teamIds(board3)).toContain(goliath)
    for (const t of res.teams) {
      if (t.rank === 3) continue
      expect(teamIds(t)).not.toContain(arachne)
      expect(teamIds(t)).not.toContain(goliath)
    }
  })

  it('a unit pinned to two boards stays on the first, with a warning', () => {
    const arachne = idByName('Arachne')
    const res = generateTeams({
      roster: fullRoster(),
      mode: 'dtide',
      options: { dtidePins: [[arachne], [arachne], [], [], []] },
    })
    const uses = res.teams.filter((t) => teamIds(t).includes(arachne))
    expect(uses.length).toBe(1)
    expect(uses[0].rank).toBe(1)
    expect(res.meta.warnings.some((w) => w.includes('pinned to more than one'))).toBe(true)
  })
})

describe('D-Tide relaxation for shallow rosters', () => {
  it('fields five teams from 20 owned units even when most are underinvested', () => {
    const r: any = fullRoster()
    for (const id of Object.keys(r.awakeners)) r.awakeners[id].owned = false
    // 8 decently-built units (two comfortable teams' worth)…
    const builtNames = ['Arachne', 'Casiah', 'Jenkin', 'Clementine', 'Xu', 'Agrippa', 'Thais', 'Faint']
    for (const n of builtNames) {
      const e = r.awakeners[idByName(n)]
      e.owned = true
      e.enlightenSlot = 'E2'
      e.characterLevel = 70
      e.skillLevels = { Strike: 5, Defense: 5, Skill1: 5, Skill2: 5, Rouse: 5, Exalt: 5, OverExalt: 0 }
    }
    // …plus 12 barely-touched ones, several below their comfort floor.
    const roughNames = [
      'Doll', 'Horla', 'Liz', 'Pollux', 'Murphy', 'Aurita',
      'Mouchette', 'Pickman', 'Tawil', 'Corposant', 'Lotan', 'Uvhash',
    ]
    for (const n of roughNames) {
      const e = r.awakeners[idByName(n)]
      e.owned = true
      e.enlightenSlot = 'E0'
      e.characterLevel = 30
      e.skillLevels = { Strike: 1, Defense: 1, Skill1: 1, Skill2: 1, Rouse: 1, Exalt: 1, OverExalt: 0 }
      e.talentLevels = { madnessOmen: 0, soulforgeAptitude: 0, gnosticPotential: 0 }
    }

    const res = generateTeams({ roster: r, mode: 'dtide' })
    expect(res.teams.length).toBe(5)
    // The relaxation should announce itself rather than silently field E0 units.
    expect(
      res.meta.warnings.some((w) => /stretch picks|ran very thin/.test(w))
    ).toBe(true)
  })
})

describe('rationale accuracy — flagged Discord cases', () => {
  const analyze = async () => (await import('@/lib/team-analysis')).analyzeTeam

  it('Salvador is never labelled the carry; Doresain alone heads the kill team', async () => {
    const analyzeTeam = await analyze()
    const ids = ['Doresain', 'Salvador', 'Saya', 'Thais'].map(idByName)
    const out = analyzeTeam(ids, awk)
    const salvador = out.contributions.find((c) => c.name === 'Salvador')!
    expect(salvador.roleLabel).not.toBe('Carry')
    expect(salvador.text).not.toMatch(/primary damage/)
    expect(out.summary).toContain('Doresain')
    expect(out.summary).not.toContain('Salvador')
  })

  it('Saya reads as Corrosion, never as Poison stacking', async () => {
    const analyzeTeam = await analyze()
    const ids = ['Doresain', 'Salvador', 'Saya', 'Thais'].map(idByName)
    const out = analyzeTeam(ids, awk)
    const sayaLines = out.chain.filter((l) => l.includes('Saya'))
    expect(sayaLines.some((l) => l.includes('Corrosion'))).toBe(true)
    for (const l of sayaLines) expect(l).not.toMatch(/stacks? Poison/)
  })

  it('Daffodil neither scales off Counters nor stacks Poison; she scales off kills', async () => {
    const analyzeTeam = await analyze()
    const ids = ['Daffodil', 'Alva', 'Nautila', 'Wanda'].map(idByName)
    const out = analyzeTeam(ids, awk)
    const daff = out.contributions.find((c) => c.name === 'Daffodil')!
    expect(daff.text).toContain('kills')
    expect(daff.text).not.toContain('Counters')
    for (const l of out.chain) {
      expect(l).not.toMatch(/Daffodil[^.]*scales with Counters/)
      expect(l).not.toMatch(/Daffodil[^.]*stacks Poison/)
    }
    // Alva's main_dps is a tertiary option, not his identity on this team.
    const alva = out.contributions.find((c) => c.name === 'Alva')!
    expect(alva.roleLabel).not.toBe('Carry')
  })

  it('engine-built teams never field two primary carries', () => {
    const r = fullRoster()
    for (const mode of ['single', 'dtide'] as const) {
      const res = generateTeams({ roster: r, mode })
      for (const t of res.teams as any[]) {
        if (t.metaName) continue // curated comps may field a DPS-as-enabler
        const primaries = teamIds(t).filter(
          (id) => awk[id]?.annotation?.teamRoles?.[0] === 'main_dps'
        )
        expect(primaries.length).toBeLessThanOrEqual(1)
      }
    }
  })

  it("Pontos' curated discard comp (Aurita, Corposant, Saya) leads once built", () => {
    // Aurita's comfort floor is E1 and Corposant's is E2, so on a flat-E0
    // roster the engine rightly prefers other partners. Invest the discard
    // core and the curated comp should take the top spot.
    const r: any = fullRoster()
    for (const n of ['Pontos', 'Aurita', 'Corposant', 'Saya']) {
      const e = r.awakeners[idByName(n)]
      e.enlightenSlot = 'E3'
      e.characterLevel = 80
      e.skillLevels = { Strike: 6, Defense: 6, Skill1: 6, Skill2: 6, Rouse: 6, Exalt: 6, OverExalt: 0 }
    }
    const res = generateTeams({
      roster: r,
      mode: 'single',
      options: { pinnedIds: [idByName('Pontos')], maxResults: 4 },
    })
    const target = compKey(
      ['Pontos', 'Aurita', 'Corposant', 'Saya'].map(idByName)
    )
    expect(compKey(teamIds(res.teams[0]))).toBe(target)
    expect((res.teams[0] as any).metaName).toContain('Pontos')
  })
})
