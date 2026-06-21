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
  it('all three appear in the default single-mode recommendations on a full roster', () => {
    const res = generateTeams({ roster: fullRoster(), mode: 'single' })
    const ids = res.teams.flatMap((t) => t.composition.map((c) => c.awakenerId))
    expect(ids).toContain(VORTICE)
    expect(ids).toContain(SAYA)
    expect(ids).toContain(ARACHNE)
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
    const res = generateTeams({ roster: fullRoster(), mode: 'single' })
    const vortTeam = res.teams.find((t) =>
      t.composition.some((c) => c.awakenerId === VORTICE)
    )
    expect(vortTeam).toBeTruthy()
    const posseIds = vortTeam!.posseRecommendations.map((p) => p.posseId)
    expect(posseIds).toContain('posse-0049')
  })
})