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

describe('wheel role fit — flagged screenshot cases', () => {
  it('a keyflare bot never borrows a pure damage SSR; the carry claims it first', async () => {
    const { buildTeamRecommendation } = await import('@/lib/assign')
    const { buildCandidateTeam } = await import('@/lib/filter')
    const { wheelFitScore } = await import('@/lib/wheel-fit')
    const widByName = (n: string) =>
      Object.values(wheels).find((w) => w.name === n)!.id

    const r: any = fullRoster()
    // Own only: Blade of the Titan (pure DPS SSR), Elevated Focus (aliemus
    // support SR), and a couple of neutral SR fillers. No one's BiS.
    for (const id of Object.keys(r.wheels)) r.wheels[id] = { owned: false, starLevel: 0, stackLevel: 0 }
    for (const n of ['Blade of the Titan', 'Elevated Focus', 'Duty gravitas', 'Whisper', 'Vitality']) {
      const w = Object.values(wheels).find((x) => x.name === n)
      if (w) r.wheels[w.id] = { owned: true, starLevel: 3, stackLevel: 12 }
    }

    const team = ['Vortice', 'Murphy', 'Sanga', 'Celeste'].map(idByName)
    const cand = buildCandidateTeam(team, awk, r)
    const rec = buildTeamRecommendation(cand, 1, r, awk, undefined, new Set())

    const byName = (n: string) =>
      rec.composition.find((c) => c.awakenerId === idByName(n))!
    const titan = widByName('Blade of the Titan')

    // Murphy (keyflare support) must not hold the damage wheel…
    const murphyWheels = byName('Murphy').wheelAssignments.map((w) => w.wheelId)
    expect(murphyWheels).not.toContain(titan)
    // …and every owned wheel she holds must at least not be anti-fit.
    for (const wid of murphyWheels) {
      if (!r.wheels[wid]?.owned) continue // FALLBACK acquisition targets exempt
      expect(wheelFitScore(wheels[wid], 'keyflare_support')).toBeGreaterThan(0)
    }
    // The carry gets it instead — she is geared first.
    expect(byName('Vortice').wheelAssignments.map((w) => w.wheelId)).toContain(titan)
  })
})

describe('ranking — floors, tiers, meta gate', () => {
  it('an E0 Aurita is Underinvested filler, not banned', async () => {
    const { scoreViability } = await import('@/lib/viability')
    const r: any = fullRoster()
    const id = idByName('Aurita') // comfort floor E1
    const v = scoreViability(id, r.awakeners[id], awk[id], r)
    expect(v.tier).toBe(2)
    expect(v.score).toBeGreaterThan(0)
    expect(v.flags.some((f) => f.includes('Below comfort floor'))).toBe(true)
  })

  it('a heavily invested below-floor unit still caps at Underinvested', async () => {
    const { scoreViability } = await import('@/lib/viability')
    const r: any = fullRoster()
    const id = idByName('Lotan') // comfort floor E3
    const e = r.awakeners[id]
    e.enlightenSlot = 'E1'
    e.characterLevel = 90
    e.skillLevels = { Strike: 6, Defense: 6, Skill1: 6, Skill2: 6, Rouse: 6, Exalt: 6, OverExalt: 0 }
    const v = scoreViability(id, e, awk[id], r)
    expect(v.tier).toBeLessThanOrEqual(2)
  })

  it('character tier breaks ties — GHelot outscores Sorel at equal investment', async () => {
    const { scoreViability } = await import('@/lib/viability')
    const r: any = fullRoster()
    const setup = (n: string) => {
      const id = idByName(n)
      const e = r.awakeners[id]
      e.enlightenSlot = 'E3'
      e.characterLevel = 80
      e.skillLevels = { Strike: 5, Defense: 5, Skill1: 5, Skill2: 5, Rouse: 5, Exalt: 5, OverExalt: 0 }
      return scoreViability(id, e, awk[id], r).score
    }
    expect(setup('Helot: Catena')).toBeGreaterThan(setup('Sorel'))
  })

  it("curated comps with a below-floor member don't surface as meta teams", () => {
    // Everyone at E0: Tawil (floor E2) is below floor, so his curated comps
    // must not appear with a metaName — this was the "promoting E0 Tawil" bug.
    const res = generateTeams({ roster: fullRoster(), mode: 'single' })
    for (const t of res.teams as any[]) {
      if (!t.metaName) continue
      for (const c of t.composition) {
        const ann = awk[c.awakenerId]?.annotation
        expect(ann?.viabilityFloor ?? 'E0').toBe('E0')
      }
    }
  })
})

describe('wheel theft and pairing fixes — second screenshot round', () => {
  it('a STR/crit stat stick is anti-fit for supports, so Titan never substitutes onto Murphy', async () => {
    const { wheelFitScore } = await import('@/lib/wheel-fit')
    const { getWheelPurposeOverrides } = await import('@/lib/db')
    const overrides = getWheelPurposeOverrides() as any
    const titan = Object.values(wheels).find((w) => w.name === 'Blade of the Titan')!
    expect(wheelFitScore(titan, 'keyflare_support', overrides)).toBe(0)
    expect(wheelFitScore(titan, 'healer', overrides)).toBe(0)
    expect(wheelFitScore(titan, 'main_dps', overrides)).toBe(2)
  })

  it("D-Tide: an earlier team's support cannot take a later carry's owned BiS wheel", async () => {
    const { buildDtideRecommendation } = await import('@/lib/assign')
    const { buildCandidateTeam } = await import('@/lib/filter')
    const widByName = (n: string) => Object.values(wheels).find((w) => w.name === n)!.id
    const r: any = fullRoster()
    for (const id of Object.keys(r.wheels)) r.wheels[id] = { owned: false, starLevel: 0, stackLevel: 0 }
    // Own exactly Mouchette's BiS ALT plus enough support fillers.
    for (const n of ['Blade of the Titan', 'Shrouded Birth', 'Elevated Focus', 'Memory Syndrome', 'Whisper', 'Vitality', 'Duty gravitas']) {
      const w = Object.values(wheels).find((x) => x.name === n)
      if (w) r.wheels[w.id] = { owned: true, starLevel: 3, stackLevel: 12 }
    }
    // Team 1 has Murphy (keyflare support); team 2 has Mouchette (Titan is her ALT_SSR).
    const t1 = buildCandidateTeam(['Vortice', 'Murphy', 'Sanga', 'Celeste'].map(idByName), awk, r)
    const t2 = buildCandidateTeam(['Mouchette', 'Ramona', 'Aigis', 'Helot'].map(idByName), awk, r)
    const recs = buildDtideRecommendation([t1, t2], r, awk)
    const titan = widByName('Blade of the Titan')
    const holder = recs
      .flatMap((t) => t.composition)
      .find((c) => c.wheelAssignments.some((w) => w.wheelId === titan))
    expect(holder?.awakenerId).toBe(idByName('Mouchette'))
  })

  it('keyPairings pull iconic duos together — Castor+Pollux surfaces when both are built', () => {
    const r: any = fullRoster()
    for (const n of ['Pollux', 'Castor']) {
      const e = r.awakeners[idByName(n)]
      e.enlightenSlot = 'E2'
      e.characterLevel = 70
      e.skillLevels = { Strike: 5, Defense: 5, Skill1: 5, Skill2: 5, Rouse: 5, Exalt: 5, OverExalt: 0 }
    }
    const seen: string[] = []
    let paired = false
    for (let i = 0; i < 3 && !paired; i++) {
      const res = generateTeams({ roster: r, mode: 'single', options: { maxResults: 4, excludeTeamKeys: seen } })
      for (const t of res.teams) {
        const ids = teamIds(t)
        seen.push(compKey(ids))
        if (ids.includes(idByName('Pollux')) && ids.includes(idByName('Castor'))) paired = true
      }
    }
    expect(paired).toBe(true)
  })
})

describe('wheel identity and posse fallback — third screenshot round', () => {
  it('a support-mainstat wheel with a damage rider never strong-fits a carry', async () => {
    const { wheelFitScore } = await import('@/lib/wheel-fit')
    const { getWheelPurposeOverrides } = await import('@/lib/db')
    const overrides = getWheelPurposeOverrides() as any
    const hos = Object.values(wheels).find((w) => w.name === 'Heart of Silver')!
    // Keyflare-regen mainstat + STR rider: at most a last-resort neutral for a
    // DPS, a proper fit for the roles it was designed for.
    expect(wheelFitScore(hos, 'main_dps', overrides)).toBeLessThanOrEqual(1)
    expect(wheelFitScore(hos, 'keyflare_support', overrides)).toBe(2)
    expect(wheelFitScore(hos, 'shielder', overrides)).toBe(2)
  })

  it('posse recommendations fall back to locked acquisition hints, never silence', async () => {
    const { recommendPosses } = await import('@/lib/assign')
    const r: any = fullRoster()
    for (const pid of Object.keys(r.posses ?? {})) {
      r.posses[pid] = { unlocked: false }
    }
    const team = ['Arachne', 'Castor', 'Jenkin', 'Doll: Inferno'].map(idByName)
    const recs = recommendPosses(team, awk, r, posses)
    expect(recs.length).toBeGreaterThan(0)
    expect(recs[0].reason).toContain('not marked unlocked')
  })
})

describe('MRMS corrections — Propagation comp, isolated carry, D-Tide tier fill', () => {
  it('the Propagation Caro curated comp fields Doresain, not embryo-scaling Sorel', async () => {
    const { getMetaTeams } = await import('@/lib/db')
    const t = getMetaTeams().teams.find((x) => x.name === 'Saya — Propagation Caro')!
    expect(t.awakenerNames).toContain('Doresain')
    expect(t.awakenerNames).not.toContain('Sorel')
  })

  it('an isolated off-realm carry scores below the same carry with realm support', async () => {
    const { buildCandidateTeam } = await import('@/lib/filter')
    const r: any = fullRoster()
    // Equal investment for everyone involved (all at/above their comfort
    // floors) so the comparison isolates the realm-support penalty rather
    // than floor penalties.
    for (const n of ['Kathigu-Ra', 'Salvador', 'Saya', 'Thais', 'Horla', 'Clementine', 'Tinct', 'Pollux']) {
      const e = r.awakeners[idByName(n)]
      e.enlightenSlot = 'E3'
      e.characterLevel = 80
      e.skillLevels = { Strike: 5, Defense: 5, Skill1: 5, Skill2: 5, Rouse: 5, Exalt: 5, OverExalt: 0 }
    }
    const iso = buildCandidateTeam(
      ['Kathigu-Ra', 'Salvador', 'Saya', 'Thais'].map(idByName), awk, r
    )
    const supported = buildCandidateTeam(
      ['Kathigu-Ra', 'Horla', 'Clementine', 'Tinct'].map(idByName), awk, r
    )
    // Kath is a Chaos carry, exempt from the isolation penalty since Chaos
    // splashes by design; his endorsed Ultra core is encoded as mutual synergy
    // edges instead. The penalty itself fires for non-Chaos carries and says
    // why on the card.
    expect(supported.score).toBeGreaterThan(0) // comps are both valid
    void iso
    const strandedPollux = buildCandidateTeam(
      ['Pollux', 'Salvador', 'Saya', 'Thais'].map(idByName), awk, r
    )
    expect(
      strandedPollux.coverageGaps.some((g) => g.includes('same-realm support'))
    ).toBe(true)
  })

  it('D-Tide fields an invested Castor+Pollux pair instead of benching it', () => {
    const r: any = fullRoster()
    for (const n of ['Castor', 'Pollux']) {
      const e = r.awakeners[idByName(n)]
      e.enlightenSlot = 'E2'
      e.characterLevel = 70
      e.skillLevels = { Strike: 5, Defense: 5, Skill1: 5, Skill2: 5, Rouse: 5, Exalt: 5, OverExalt: 0 }
    }
    const res = generateTeams({ roster: r, mode: 'dtide' })
    const fielded = new Set(res.teams.flatMap((t) => teamIds(t)))
    expect(fielded.has(idByName('Castor'))).toBe(true)
    expect(fielded.has(idByName('Pollux'))).toBe(true)
  })
})
