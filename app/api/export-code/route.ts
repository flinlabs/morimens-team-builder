/** POST /api/export-code
Encodes a board lineup into a Morimens in-game `@@...@@` share code that the
player can paste directly into the game. Thin wrapper over the deterministic
codec; reads the db on the server so no token tables ship to the client.

Request body (IngameTeamInput):
  {
    slots: Array<{ awakenerId?: string|null; wheelIds?: (string|null)[]; covenantId?: string|null }>,
    posseId?: string | null
  }

Uses the Node runtime because the codec reads db/*.json from disk. **/

import { NextResponse } from 'next/server'
import { encodeIngameTeamCode, type IngameTeamInput } from '@/lib/ingame-codec'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const team = (body ?? {}) as IngameTeamInput
  if (!team || !Array.isArray(team.slots)) {
    return NextResponse.json({ error: 'Missing team slots.' }, { status: 400 })
  }

  try {
    const code = encodeIngameTeamCode(team)
    return NextResponse.json({ code })
  } catch (err) {
    // A slot/wheel/covenant/posse with no in-game token surfaces here as a
    // readable message rather than a 500.
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not build the in-game code.' },
      { status: 422 }
    )
  }
}