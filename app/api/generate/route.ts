/** POST /api/generate
Thin HTTP wrapper over the deterministic generation service. Validates the
request, calls generateTeams, and returns the ranked, geared recommendations.

Request body:
  {
    roster: UserRoster,            // the player's owned roster
    mode?: 'single' | 'dtide',     // default 'single'
    options?: FilterOptions        // single-mode tuning
  }

Uses the Node runtime because the DB loader reads db/*.json from disk. **/

import { NextResponse } from 'next/server'
import { generateTeams, type GenerateMode } from '@/lib/generate'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const { roster, mode, options } = (body ?? {}) as {
    roster?: unknown
    mode?: unknown
    options?: unknown
  }

  if (!roster || typeof roster !== 'object') {
    return NextResponse.json({ error: 'Missing or invalid "roster".' }, { status: 400 })
  }
  if (mode !== undefined && mode !== 'single' && mode !== 'dtide') {
    return NextResponse.json(
      { error: `Unknown mode "${String(mode)}". Use "single" or "dtide".` },
      { status: 400 }
    )
  }
  const r = roster as Record<string, unknown>
  if (!r.settings || !r.awakeners) {
    return NextResponse.json(
      { error: 'Roster is malformed (missing "settings" or "awakeners").' },
      { status: 400 }
    )
  }

  try {
    const result = generateTeams({
      // Shape validated above; the store produces well-formed rosters.
      roster: roster as Parameters<typeof generateTeams>[0]['roster'],
      mode: mode as GenerateMode | undefined,
      options: options as Parameters<typeof generateTeams>[0]['options'],
    })
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error.'
    // The most likely failure is a missing DB (db/*.json is gitignored).
    const hint = /ENOENT|no such file/i.test(message)
      ? ' The DB may not be built — run `npm run sync`.'
      : ''
    return NextResponse.json({ error: `Generation failed: ${message}${hint}` }, { status: 500 })
  }
}