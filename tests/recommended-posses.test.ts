// Regression test for the posse-assignment fix: the team's posse should be the
// lead DPS's own posse, not a teammate's character-bonus posse. Covers the two
// cases reported in-app (Sorel → Victory of Roses, Daffodil → Truth Behind Grey
// Mist) using the real db snapshot.
import { describe, it, expect } from 'vitest'
import { recommendPosses } from '@/lib/assign'
import { getAwakeners, getPosses } from '@/lib/db'
import { fullRoster, awakenerIdByName } from './helpers'

const awakeners = getAwakeners()
const posses = getPosses()
const roster = fullRoster()

function topPosseName(memberNames: string[]): string {
  const teamIds = memberNames.map(awakenerIdByName)
  const recs = recommendPosses(teamIds, awakeners, roster, posses)
  return posses[recs[0].posseId]?.name
}

describe('lead-DPS posse selection', () => {
  it('picks Sorel’s Victory of Roses over Pickman’s bonus posse', () => {
    expect(topPosseName(['Sorel', 'Pickman', 'Thais', 'Leigh'])).toBe(
      'Victory of Roses'
    )
  })

  it('picks Daffodil’s Truth Behind Grey Mist, skipping the posseless carry', () => {
    // Arachne is also main_dps but owns no posse, so the pass should fall
    // through to Daffodil.
    expect(topPosseName(['Arachne', 'Daffodil', 'Castor'])).toBe(
      'Truth Behind Grey Mist'
    )
  })

  it('labels the lead posse with the "lead" priority', () => {
    const ids = ['Sorel', 'Pickman'].map(awakenerIdByName)
    const recs = recommendPosses(ids, awakeners, roster, posses)
    expect(recs[0].priority).toBe('lead')
  })
})