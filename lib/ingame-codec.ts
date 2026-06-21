// Morimens in-game lineup codec — produces and reads the `@@...@@` share codes
// the game itself imports/exports. Ported from SKeyDB's `src/domain/ingame-codec.ts`
// and `ingame-token-dictionaries.ts` (MIT-licensed; © SKeyDB contributors), adapted
// to this project's db loaders and lineup shape. The single-character (awakeners,
// covenants, posses) and two-character (wheels) `lineupToken` values come straight
// from the SKeyDB-sourced db, so the codes round-trip with the live game.
//
// Server-only: reads the db via lib/db.ts. The payload layout is, in order:
// 4 awakener tokens, 8 wheel tokens (two per slot), 4 covenant tokens, 1 posse
// token. Anything empty encodes as the placeholder `a`.
import { getAwakeners, getWheels, getCovenants, getPosses } from './db'

const INGAME_WRAPPER = '@@'
const TEAM_SLOT_COUNT = 4
const EMPTY_TOKEN = 'a'
const POSSE_TOKEN_LENGTH = 1
const WHEEL_TOKENS_PER_SLOT = 2
const WARNING_TOKEN_PREVIEW_LIMIT = 32

export interface IngameSlotInput {
  awakenerId?: string | null
  wheelIds?: (string | null | undefined)[] // up to two
  covenantId?: string | null
}

export interface IngameTeamInput {
  slots: (IngameSlotInput | null | undefined)[] // up to four
  posseId?: string | null
}

export interface IngameImportWarning {
  section: 'awakener' | 'wheel' | 'covenant' | 'posse'
  slotIndex?: number
  field?: 'wheelOne' | 'wheelTwo'
  token: string
  reason: 'unknown_token' | 'ambiguous_parse'
  candidateIds?: string[]
}

export interface DecodedIngameTeamCode {
  slots: {
    awakenerId?: string
    wheelIds: [string | null, string | null]
    covenantId?: string
  }[]
  posseId?: string
  warnings: IngameImportWarning[]
}

interface CategoryDict {
  byIdToken: Map<string, string>
  byTokenIds: Map<string, string[]>
}

interface Dictionaries {
  awakeners: CategoryDict
  wheels: CategoryDict
  covenants: CategoryDict
  posses: CategoryDict
}

function dictFrom(records: { id: string; lineupToken?: string }[]): CategoryDict {
  const byIdToken = new Map<string, string>()
  const byTokenIds = new Map<string, string[]>()
  for (const rec of records) {
    if (!rec.id || !rec.lineupToken) continue
    byIdToken.set(rec.id, rec.lineupToken)
    const ids = byTokenIds.get(rec.lineupToken) ?? []
    ids.push(rec.id)
    byTokenIds.set(rec.lineupToken, ids)
  }
  return { byIdToken, byTokenIds }
}

let cachedDictionaries: Dictionaries | null = null

function buildDictionaries(): Dictionaries {
  if (cachedDictionaries) return cachedDictionaries
  cachedDictionaries = {
    awakeners: dictFrom(Object.values(getAwakeners())),
    wheels: dictFrom(Object.values(getWheels())),
    covenants: dictFrom(Object.values(getCovenants())),
    posses: dictFrom(Object.values(getPosses())),
  }
  return cachedDictionaries
}

// ---------------------------------------------------------------------------
// Encode (app lineup -> in-game @@...@@ code)
// ---------------------------------------------------------------------------

function encodeAwakenerToken(awakenerId: string | null | undefined, dict: CategoryDict, slotIndex: number): string {
  if (!awakenerId) return EMPTY_TOKEN
  const token = dict.byIdToken.get(awakenerId)
  if (!token) {
    throw new Error(`Slot ${slotIndex + 1} awakener "${awakenerId}" has no in-game token.`)
  }
  return token
}

function encodeWheelToken(
  wheelId: string | null | undefined,
  dict: CategoryDict,
  slotIndex: number,
  field: 'wheelOne' | 'wheelTwo'
): string {
  if (!wheelId) return EMPTY_TOKEN
  const token = dict.byIdToken.get(wheelId)
  if (!token) {
    throw new Error(`Slot ${slotIndex + 1} ${field} "${wheelId}" has no in-game token.`)
  }
  return token
}

function encodeCovenantToken(
  awakenerId: string | null | undefined,
  covenantId: string | null | undefined,
  dict: CategoryDict,
  slotIndex: number
): string {
  if (!awakenerId || !covenantId) return EMPTY_TOKEN
  const token = dict.byIdToken.get(covenantId)
  if (!token) {
    throw new Error(`Slot ${slotIndex + 1} covenant "${covenantId}" has no in-game token.`)
  }
  return token
}

export function encodeIngameTeamCode(team: IngameTeamInput): string {
  const dict = buildDictionaries()
  const tokens: string[] = []

  for (let i = 0; i < TEAM_SLOT_COUNT; i += 1) {
    const slot = team.slots[i] ?? null
    tokens.push(encodeAwakenerToken(slot?.awakenerId, dict.awakeners, i))
  }
  for (let i = 0; i < TEAM_SLOT_COUNT; i += 1) {
    const slot = team.slots[i] ?? null
    tokens.push(encodeWheelToken(slot?.wheelIds?.[0], dict.wheels, i, 'wheelOne'))
    tokens.push(encodeWheelToken(slot?.wheelIds?.[1], dict.wheels, i, 'wheelTwo'))
  }
  for (let i = 0; i < TEAM_SLOT_COUNT; i += 1) {
    const slot = team.slots[i] ?? null
    tokens.push(encodeCovenantToken(slot?.awakenerId, slot?.covenantId, dict.covenants, i))
  }

  const posseToken = team.posseId ? dict.posses.byIdToken.get(team.posseId) : EMPTY_TOKEN
  if (!posseToken) {
    throw new Error(`Posse "${team.posseId ?? ''}" has no in-game token.`)
  }
  tokens.push(posseToken)

  return `${INGAME_WRAPPER}${tokens.join('')}${INGAME_WRAPPER}`
}

// ---------------------------------------------------------------------------
// Decode (in-game @@...@@ code -> app lineup) — used by the import flow.
// ---------------------------------------------------------------------------

function truncate(token: string): string {
  return token.length > WARNING_TOKEN_PREVIEW_LIMIT ? token.slice(0, WARNING_TOKEN_PREVIEW_LIMIT) : token
}

function normalizeWrappedPayload(code: string): string {
  const trimmed = code.trim()
  const match = /@@[A-Za-z0-9]+@@/.exec(trimmed)
  const wrapped = match ? match[0] : trimmed
  if (!wrapped.startsWith(INGAME_WRAPPER) || !wrapped.endsWith(INGAME_WRAPPER)) {
    throw new Error('Invalid in-game code. Expected a @@...@@ wrapper.')
  }
  const payload = wrapped.slice(INGAME_WRAPPER.length, -INGAME_WRAPPER.length)
  if (!payload) throw new Error('In-game code payload is empty.')
  return payload
}

function longestTokenList(tokens: Iterable<string>): string[] {
  return Array.from(tokens).sort((a, b) => (b.length !== a.length ? b.length - a.length : a.localeCompare(b)))
}

function findLongestTokenAt(payload: string, cursor: number, tokenList: string[]): string | null {
  for (const token of tokenList) {
    if (payload.startsWith(token, cursor)) return token
  }
  return null
}

function resolveSingle(
  token: string,
  dict: CategoryDict,
  section: IngameImportWarning['section'],
  warnings: IngameImportWarning[],
  opts: { slotIndex?: number; field?: 'wheelOne' | 'wheelTwo' } = {}
): string | undefined {
  if (token === EMPTY_TOKEN) return undefined
  const ids = dict.byTokenIds.get(token) ?? []
  if (ids.length > 1) {
    warnings.push({ section, ...opts, token: truncate(token), reason: 'ambiguous_parse', candidateIds: ids })
    return undefined
  }
  if (ids.length === 0) {
    warnings.push({ section, ...opts, token: truncate(token), reason: 'unknown_token' })
    return undefined
  }
  return ids[0]
}

export function decodeIngameTeamCode(code: string): DecodedIngameTeamCode {
  const payload = normalizeWrappedPayload(code)
  const dict = buildDictionaries()
  const warnings: IngameImportWarning[] = []

  const slots: DecodedIngameTeamCode['slots'] = Array.from({ length: TEAM_SLOT_COUNT }, () => ({
    wheelIds: [null, null] as [string | null, string | null],
  }))

  // Awakeners: four tokens, longest-match.
  const awkTokens = longestTokenList(dict.awakeners.byTokenIds.keys())
  let cursor = 0
  for (let i = 0; i < TEAM_SLOT_COUNT; i += 1) {
    if (cursor >= payload.length) throw new Error('Corrupted in-game code: missing awakener tokens.')
    if (payload[cursor] === EMPTY_TOKEN) {
      cursor += 1
      continue
    }
    const token = findLongestTokenAt(payload, cursor, awkTokens)
    if (!token) {
      warnings.push({ section: 'awakener', slotIndex: i, token: truncate(payload[cursor]), reason: 'unknown_token' })
      cursor += 1
      continue
    }
    slots[i].awakenerId = resolveSingle(token, dict.awakeners, 'awakener', warnings, { slotIndex: i })
    cursor += token.length
  }

  // Wheels: eight tokens (two per slot).
  const wheelTokens = longestTokenList(dict.wheels.byTokenIds.keys())
  const wheelResolved: (string | undefined)[] = []
  for (let i = 0; i < TEAM_SLOT_COUNT * WHEEL_TOKENS_PER_SLOT; i += 1) {
    if (cursor >= payload.length - POSSE_TOKEN_LENGTH) {
      throw new Error('Corrupted in-game code: missing wheel block.')
    }
    const field: 'wheelOne' | 'wheelTwo' = i % 2 === 0 ? 'wheelOne' : 'wheelTwo'
    const slotIndex = Math.floor(i / 2)
    if (payload[cursor] === EMPTY_TOKEN) {
      wheelResolved.push(undefined)
      cursor += 1
      continue
    }
    const token = findLongestTokenAt(payload, cursor, wheelTokens)
    if (!token) {
      warnings.push({ section: 'wheel', slotIndex, field, token: truncate(payload[cursor]), reason: 'unknown_token' })
      wheelResolved.push(undefined)
      cursor += 1
      continue
    }
    wheelResolved.push(resolveSingle(token, dict.wheels, 'wheel', warnings, { slotIndex, field }))
    cursor += token.length
  }
  for (let i = 0; i < TEAM_SLOT_COUNT; i += 1) {
    slots[i].wheelIds = [wheelResolved[i * 2] ?? null, wheelResolved[i * 2 + 1] ?? null]
  }

  // Covenants: the block between the wheels and the trailing posse token.
  const covBlock = payload.slice(cursor, payload.length - POSSE_TOKEN_LENGTH)
  const covTokens = longestTokenList(dict.covenants.byTokenIds.keys())
  let covCursor = 0
  for (let i = 0; i < TEAM_SLOT_COUNT; i += 1) {
    if (covCursor >= covBlock.length) throw new Error('Corrupted in-game code: incomplete covenant block.')
    if (covBlock[covCursor] === EMPTY_TOKEN) {
      covCursor += 1
      continue
    }
    const token = findLongestTokenAt(covBlock, covCursor, covTokens)
    if (!token) {
      warnings.push({ section: 'covenant', slotIndex: i, token: truncate(covBlock[covCursor]), reason: 'unknown_token' })
      covCursor += 1
      continue
    }
    slots[i].covenantId = resolveSingle(token, dict.covenants, 'covenant', warnings, { slotIndex: i })
    covCursor += token.length
  }

  // Posse: the final character.
  const posseToken = payload[payload.length - 1]
  const posseId = resolveSingle(posseToken, dict.posses, 'posse', warnings)

  return { slots, posseId, warnings }
}