/** POST /api/meta-advice
Builds the Meta tab's investment and acquisition advice for a submitted roster.

Everything returned is deterministic — breakpoints and stopping points come from
annotations/awakeners.json, wheel targets from db/bis.json plus
annotations/wheel-floors.json, and lineup completeness from the curated
meta-teams file. No AI is involved, so a wrong answer here is a data fix.

Request body:  { roster: UserRoster }
Response:      MetaAdvice

Uses the Node runtime because the advice reads db/*.json from disk. **/

import { NextResponse } from 'next/server'
import { getAwakeners, getWheels, getBisData, getMetaTeams, getWheelStarFloors } from '@/lib/db'
import { buildMetaAdvice } from '@/lib/pull-advice'
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

  const { roster } = (body ?? {}) as { roster?: UserRoster }
  if (!roster || typeof roster !== 'object' || !roster.awakeners) {
    return NextResponse.json({ error: 'Missing roster.' }, { status: 400 })
  }

  try {
    const advice = buildMetaAdvice(
      getAwakeners(),
      getWheels(),
      getBisData(),
      getMetaTeams().teams,
      roster,
      getWheelStarFloors()
    )
    return NextResponse.json(advice)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not build advice.' },
      { status: 500 }
    )
  }
}
