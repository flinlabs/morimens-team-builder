import { describe, it, expect } from 'vitest'
import { getAwakeners, getWheelStarFloors } from '@/lib/db'
import { publicNote, hasInternalSource } from '@/lib/public-text'

/* ---------------------------------------------------------------------------
   Public annotation prose.

   annotation.notes and the wheel star-floor notes are rendered verbatim in the
   detail modal. They kept picking up working-notebook provenance ("Felix's
   call", "per Lyra", "Flagged in LYRA-NOTES", "the guides stress"), which is
   fine in the repo and wrong on the site. Write them as plain statements about
   the character; keep sources in annotations/LYRA-NOTES.md.
--------------------------------------------------------------------------- */

// Broader than the runtime filter on purpose: the filter only drops sentences
// that name a source outright, while this also catches the softer hearsay
// framing that should be rewritten rather than deleted.
const HEARSAY =
  /\b(?:the guides?|guides? (?:say|stress|advise|call|rate|note)|the community|players report|reported working|per [A-Z][a-z]+:)/i

describe('public annotation prose', () => {
  const awakeners = getAwakeners()

  it('no awakener note names an internal source or relays hearsay', () => {
    const offenders = Object.values(awakeners)
      .filter((a) => {
        const n = a.annotation?.notes ?? ''
        return hasInternalSource(n) || HEARSAY.test(n)
      })
      .map((a) => a.name)
    expect(offenders).toEqual([])
  })

  it('no wheel star-floor note names an internal source', () => {
    const offenders = Object.entries(getWheelStarFloors())
      .filter(([, f]) => hasInternalSource(f?.note) || HEARSAY.test(f?.note ?? ''))
      .map(([id]) => id)
    expect(offenders).toEqual([])
  })
})

describe('publicNote', () => {
  it('drops sentences that name who made a call', () => {
    expect(
      publicNote("Floor is E2. Felix's call from in-game use. Flagged in LYRA-NOTES.")
    ).toBe('Floor is E2.')
  })

  it('drops an internal parenthetical but keeps the sentence around it', () => {
    expect(publicNote('E1 first (per Lyra), then E3.')).toBe('E1 first, then E3.')
  })

  it('leaves clean text and paragraph breaks alone', () => {
    const clean = 'Shields the team.\n\nAt E3 she also heals.'
    expect(publicNote(clean)).toBe(clean)
  })

  it('returns null when nothing public is left', () => {
    expect(publicNote('Transcribed from the Mythag Compendium.')).toBeNull()
    expect(publicNote(null)).toBeNull()
  })
})

