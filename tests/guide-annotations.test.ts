import { describe, it, expect } from 'vitest'
import { getAwakeners } from '@/lib/db'
import { awakenerIdByName } from './helpers'

/* ---------------------------------------------------------------------------
   Guide-sourced annotation facts.

   Annotations are hand-maintained from community guides, so these tests are how
   a guide claim stops being something someone remembered and starts being
   something the engine is held to. Sources: the Caraboo experimental log
   (moriexplog, 28.08.2026) and the Lotan: Cetarchon investment guide.
--------------------------------------------------------------------------- */

const awakeners = getAwakeners()
const annotationOf = (name: string) => awakeners[awakenerIdByName(name)].annotation!

describe('Caraboo', () => {
  const caraboo = annotationOf('Caraboo')

  it('is a Corrosion source, alongside the only two others', () => {
    // Devour applies Corrosion on every hit of her Exalt. Before her that role
    // belonged to Castor and Saya alone, which is exactly why she matters to
    // Corrosion payoff teams.
    expect(caraboo.teamRoles).toContain('corrosion_applier')
    const appliers = Object.values(awakeners)
      .filter((a) => a.annotation?.teamRoles?.includes('corrosion_applier'))
      .map((a) => a.name)
      .sort()
    expect(appliers).toEqual(['Caraboo', 'Castor', 'Saya'])
  })

  it('stops at E1 and E3, skipping the E2 scam rung', () => {
    // E1 turns her second skill into a battery and scales it off Realm Mastery;
    // E2 fires once every seven Strikes or Defences and is not worth pulling
    // for; E3 is where Corrosion and Satiety stop feeling thin.
    expect(caraboo.enlightenBreakpoints).toEqual(['E1', 'E3'])
    expect(caraboo.enlightenBreakpoints).not.toContain('E2')
  })

  it('is recorded as redundant with Saya rather than in conflict', () => {
    // Their kits overlap on shield and Corrosion, so they are better on
    // separate teams — but a conflictsWith entry costs a team 0.25 of score,
    // which would actively demote a pairing the guide calls merely unnecessary.
    const saya = awakenerIdByName('Saya')
    expect(caraboo.conflictsWith).not.toContain(saya)
    expect(caraboo.notes).toMatch(/redundancy, not a conflict/i)
  })
})

describe('Lotan: Cetarchon', () => {
  const cetarchon = annotationOf('Lotan: Cetarchon')

  it('keeps OE as a breakpoint', () => {
    // The investment guide argues against pulling for OE because the Aliemus
    // requirement is prohibitive. That is an argument about priority, not about
    // whether the rung changes how she plays — so it stays recorded, with the
    // caveat in the notes.
    expect(cetarchon.enlightenBreakpoints).toEqual(['E2', 'E3', 'OE'])
    expect(cetarchon.notes).toMatch(/E2 > E3 > E0/)
    expect(cetarchon.notes).toMatch(/luxury/i)
  })

  it('anchors on A Mouse\'s Wisdom', () => {
    const posse = cetarchon.anchorPosse
    expect(posse).toBe('posse-0004')
  })
})
