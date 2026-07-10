import { describe, it, expect } from 'vitest'
import { generateTeams } from '@/lib/generate'
import { buildCandidateTeam } from '@/lib/filter'
import { getAwakeners } from '@/lib/db'
import { fullRoster } from './helpers'

const SAYA = 'awakener-0057'
const VORTICE = 'awakener-0055'
const ARACHNE = 'awakener-0056'
const HELOT_CATENA = 'awakener-0019'
const POLLUX = 'awakener-0041'

describe('Saya, Vortice & Arachne surface in appropriate teams', () => {
  it('all three are reachable within two rotations of default single-mode output', () => {
    // Since the Generate button rotates through fresh compositions, batch
    // variety is spread across presses — the promise is reachability within a
    // couple of rotations, not presence in the very first batch.
    const roster = fullRoster()
    const seenIds = new Set<string>()
    const seenKeys: string[] = []
    for (let i = 0; i < 2; i++) {
      const res = generateTeams({
        roster,
        mode: 'single',
        options: { excludeTeamKeys: seenKeys },
      })
      for (const t of res.teams) {
        const ids = t.composition.map((c) => c.awakenerId)
        seenKeys.push([...ids].sort().join('|'))
        ids.forEach((id) => seenIds.add(id))
      }
    }
    expect(seenIds).toContain(VORTICE)
    expect(seenIds).toContain(SAYA)
    expect(seenIds).toContain(ARACHNE)
  })

  it('Arachne lands in a guide-faithful comp — paired with units she synergizes with', () => {
    const res = generateTeams({ roster: fullRoster(), mode: 'single' })
    const araTeam = res.teams.find((t) =>
      t.composition.some((c) => c.awakenerId === ARACHNE)
    )
    expect(araTeam).toBeTruthy()
    const awk = getAwakeners()
    const partners = awk[ARACHNE].annotation?.synergizesWith ?? []
    const teammates = araTeam!.composition
      .map((c) => c.awakenerId)
      .filter((id) => id !== ARACHNE)
    expect(teammates.some((id) => partners.includes(id))).toBe(true)
  })

  it('the engine-built reserve gives Saya a poison/status comp, not just curated meta', () => {
    const res = generateTeams({ roster: fullRoster(), mode: 'single' })
    const sayaTeam = res.teams.find((t) =>
      t.composition.some((c) => c.awakenerId === SAYA)
    )
    expect(sayaTeam).toBeTruthy()
    // Saya's guide role is amplifying status DPS via corrosion — her team should
    // pair her with units she synergizes with, not strand her among off-kit units.
    const awk = getAwakeners()
    const partners = awk[SAYA].annotation?.synergizesWith ?? []
    const teammates = sayaTeam!.composition
      .map((c) => c.awakenerId)
      .filter((id) => id !== SAYA)
    expect(teammates.some((id) => partners.includes(id))).toBe(true)
  })

  it('anti-synergy: Saya scores lower beside Helot:Catena / Pollux than beside her poison partners', () => {
    const awk = getAwakeners()
    const roster = fullRoster()
    // Saya with a flagged conflict on the team.
    const conflicted = buildCandidateTeam(
      [SAYA, HELOT_CATENA, POLLUX, 'awakener-0048'],
      awk,
      roster
    )
    // Saya with guide-sanctioned poison partners.
    const synergized = buildCandidateTeam(
      [SAYA, 'awakener-0002', 'awakener-0048', 'awakener-0032'],
      awk,
      roster
    )
    expect(synergized.score).toBeGreaterThan(conflicted.score)
  })

  it('Vortice carries her own posse (Drowned Innocence) in her recommendation', () => {
    // Pin her so a Vortice team is guaranteed in this batch; the assertion is
    // about her posse coming along, not about batch composition.
    const res = generateTeams({
      roster: fullRoster(),
      mode: 'single',
      options: { pinnedIds: [VORTICE], maxResults: 4 },
    })
    const vortTeam = res.teams.find((t) =>
      t.composition.some((c) => c.awakenerId === VORTICE)
    )
    expect(vortTeam).toBeTruthy()
    const posseIds = vortTeam!.posseRecommendations.map((p) => p.posseId)
    expect(posseIds).toContain('posse-0049')
  })
})