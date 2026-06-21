/** POST /api/import-code
Decodes a Morimens in-game `@@...@@` share code (or a full pasted lineup block
containing one) into a board lineup. Thin wrapper over the codec; reads the db
on the server so no token tables ship to the client.

Request body:  { code: string }
Response:      { slots: [...], posseId?: string, warnings: [...] }

Uses the Node runtime because the codec reads db/*.json from disk. **/

import { NextResponse } from 'next/server'
import { decodeIngameTeamCode } from '@/lib/ingame-codec'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const { code } = (body ?? {}) as { code?: unknown }
  if (typeof code !== 'string' || !code.trim()) {
    return NextResponse.json({ error: 'Paste a lineup code first.' }, { status: 400 })
  }

  try {
    const decoded = decodeIngameTeamCode(code)
    return NextResponse.json(decoded)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not read that lineup code.' },
      { status: 422 }
    )
  }
}