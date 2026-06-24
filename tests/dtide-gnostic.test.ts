import { describe, it, expect } from 'vitest'
import { generateTeams } from '@/lib/generate'
import { getAwakeners } from '@/lib/db'
import { effectiveGnosticLevel } from '@/lib/stats'
import { fullRoster } from './helpers'

const awk = getAwakeners()

describe('Gnostic Potential default by availability', () => {
  it('limited units come fully unlocked; permanent and welfare level it manually', () => {
    const eff = (id: string, stored = 0) => effectiveGnosticLevel(awk[id], stored)
    // Agrippa = PERMANENT, Castor = LIMITED, Aurita = WELFARE.
    expect(eff('awakener-0002')).toBe(0) // permanent → manual, starts 0
    expect(eff('awakener-0008')).toBe(5) // limited → fully unlocked on acquisition
    expect(eff('awakener-0005')).toBe(0) // welfare → manual, starts 0
    expect(eff('awakener-0002', 3)).toBe(3) // permanent respects a manual level
  })

  it('gnostic defaultMaxed is set true for limited units only', () => {
    for (const a of Object.values(awk)) {
      const g = a.talents?.find((t) => t.family === 'gnostic_potential')
      if (!g) continue
      expect(g.defaultMaxed).toBe((a.availabilityType ?? '').startsWith('LIMITED'))
    }
  })
})

describe('D-Tide posse uniqueness', () => {
  it('no posse is run by more than one of the five teams', () => {
    const res = generateTeams({ roster: fullRoster(), mode: 'dtide' } as Parameters<typeof generateTeams>[0])
    const chosen = (res.teams ?? [])
      .map((t) => t.posseRecommendations?.[0]?.posseId)
      .filter((p): p is string => !!p)
    expect(chosen.length).toBeGreaterThan(1)
    expect(new Set(chosen).size).toBe(chosen.length)
  })
})