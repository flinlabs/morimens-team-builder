/** POST /api/score-team
Scores an arbitrary lineup with the same function the generator ranks by.

Exists so a player can build a team by hand and see what the engine makes of
it — both to sanity-check their own comp and to catch the algorithm evaluating
something strangely. Deliberately the SAME code path as generation rather than
a parallel implementation, because a scorer that agreed with the generator only
most of the time would be worse than none: the whole point is to expose what
the ranking actually does.

Request body:  { awakenerIds: (string|null)[], roster: UserRoster }
Response:      { score, scoreBreakdown, coverageGaps, realmComposition, mixingNote }

Empty slots are dropped rather than rejected, so a partially built board still
returns a score — that is how it behaves during generation too. **/

import { NextResponse } from 'next/server'
import { getAwakeners } from '@/lib/db'
import { buildCandidateTeam } from '@/lib/filter'
import type { UserRoster } from '@/lib/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const { awakenerIds, roster } = (body ?? {}) as {
    awakenerIds?: (string | null)[]
    roster?: UserRoster
  }
  if (!Array.isArray(awakenerIds) || !roster?.awakeners) {
    return NextResponse.json({ error: 'Missing awakenerIds or roster.' }, { status: 400 })
  }

  const awakeners = getAwakeners()
  const ids = awakenerIds.filter((id): id is string => !!id && !!awakeners[id])
  if (ids.length === 0) {
    return NextResponse.json({ error: 'No characters on the board.' }, { status: 400 })
  }

  try {
    const candidate = buildCandidateTeam(ids, awakeners, roster)
    return NextResponse.json({
      score: candidate.score,
      scoreBreakdown: candidate.scoreBreakdown ?? [],
      coverageGaps: candidate.coverageGaps,
      realmComposition: candidate.realmComposition,
      mixingNote: candidate.mixingNote,
      memberCount: ids.length,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not score this team.' },
      { status: 500 }
    )
  }
}
