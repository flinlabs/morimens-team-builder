/** Settle the pinned lineup-token dictionaries against a real in-game capture.

Why this exists
---------------
`sync-lineup-tokens.mjs` holds the awakener and wheel dictionaries at their
pre-2.6.0 values because SKeyDB's reissue contradicts a real code copied out of
the game. That pin is a judgement call, and the only thing that can settle it is
another capture. This script turns that capture into an answer.

Give it a lineup you can see in the game — the plaintext names of the four
awakeners, their wheels and covenants, and the posse — plus the `@@...@@` code
the game produced for it. It re-encodes those names against the committed
dictionaries, trying a whole-category offset from -4 to +4 independently per
category, and reports which combination reproduces the captured payload
character for character.

  offset 0 everywhere  -> the pin is correct, nothing to do
  a uniform non-zero   -> the dictionary has shifted by that many places
  no combination fits  -> the shift is not uniform; the capture still narrows
                          it down, because the report says which category the
                          mismatch is in

A capture is only decisive if it contains a record on the disputed side of the
shift. Include Arachne or Soul Synchronization if you can — those sit past the
deletion points, so they are where the pinned and upstream numberings disagree.

Run: node scripts/verify-lineup-tokens.mjs capture.txt
     node scripts/verify-lineup-tokens.mjs capture.txt --write

Paste the lineup block exactly as the game copies it, code line and all:

  Investigation Lineup
  Keeper: mercury child(101242880) Team: Team7
  Clementine, Veiled Anguish, Elevated Focus, Life Drain
  Horla, The Last Verse, Poetic Bygone Days, Dream of Medicine
  Arachne, Eternal Weave, Amidst the Downpour, Steppenwolf
  Kathigu-Ra, Amber-Tinted Death, Blade of the Titan, April Tribute
  Undying Sun
  @@9B41yfxDkxRyivyn1nowbR@@

Each lineup row is `Awakener, Wheel, Wheel, Covenant`; drop the entries a slot
does not have. The line before the code is the posse. Header lines are ignored.
**/

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const DB_DIR = path.join(ROOT, 'db')

const WRAPPER = '@@'
const EMPTY_TOKEN = 'a'
const TEAM_SLOT_COUNT = 4
const WHEELS_PER_SLOT = 2
const OFFSET_RANGE = 4

const write = process.argv.includes('--write')
const capturePath = process.argv.find((a) => !a.startsWith('-') && a.endsWith('.txt'))

if (!capturePath) {
  console.error('Usage: node scripts/verify-lineup-tokens.mjs <capture.txt> [--write]')
  process.exit(1)
}

// ---------------------------------------------------------------------------
// Token alphabet
// ---------------------------------------------------------------------------

/**
 * The dictionary's ordered token alphabet: the empty marker, then b–w, A–Z,
 * 1–9, 0, then that same run prefixed with x, y and z. Shifting a category by
 * one place means every record moves one step along this sequence, so the
 * alphabet is what an offset is measured in.
 */
function buildAlphabet() {
  const base = []
  for (let c = 'b'.charCodeAt(0); c <= 'w'.charCodeAt(0); c++) base.push(String.fromCharCode(c))
  for (let c = 'A'.charCodeAt(0); c <= 'Z'.charCodeAt(0); c++) base.push(String.fromCharCode(c))
  for (const d of '1234567890') base.push(d)
  const all = [EMPTY_TOKEN]
  for (const prefix of ['', 'x', 'y', 'z']) for (const b of base) all.push(prefix + b)
  return all
}

const ALPHABET = buildAlphabet()
const ALPHABET_INDEX = new Map(ALPHABET.map((t, i) => [t, i]))

function shiftToken(token, offset) {
  if (!token || token === EMPTY_TOKEN) return token
  const i = ALPHABET_INDEX.get(token)
  if (i === undefined) return null
  const j = i + offset
  if (j < 1 || j >= ALPHABET.length) return null
  return ALPHABET[j]
}

// ---------------------------------------------------------------------------
// Catalogs
// ---------------------------------------------------------------------------

// Match the on-disk escaping style — awakeners.json carries \uXXXX escapes
// while the others hold raw characters, and re-encoding wholesale would bury
// the real change under hundreds of noise lines.
function serialize(filepath, data) {
  let escaped = false
  try {
    escaped = /\\u[0-9a-fA-F]{4}/.test(fs.readFileSync(filepath, 'utf-8'))
  } catch { /* new file */ }
  const json = JSON.stringify(data, null, 2)
  return escaped
    ? json.replace(/[\u0080-\uFFFF]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'))
    : json
}

const readDb = (f) => JSON.parse(fs.readFileSync(path.join(DB_DIR, f), 'utf-8'))

const CATALOGS = {
  awakeners: readDb('awakeners.json'),
  wheels: readDb('wheels.json'),
  covenants: readDb('covenants.json'),
  posses: readDb('posses.json'),
}

const normalize = (s) => (s ?? '').trim().toLowerCase().replace(/\s+/g, ' ')

/** Whether a name resolves in a category, used to tell wheels from covenants. */
function isName(category, name) {
  try {
    return !!lookup(category, name)
  } catch {
    return false
  }
}

function lookup(category, name) {
  if (!name) return null
  const target = normalize(name)
  const records = Object.values(CATALOGS[category])
  const exact = records.filter((r) => normalize(r.name) === target)
  if (exact.length === 1) return exact[0]
  if (exact.length > 1) {
    throw new Error(`"${name}" matches ${exact.length} ${category} records — disambiguate by id.`)
  }
  const byId = records.find((r) => r.id === name)
  if (byId) return byId
  const partial = records.filter((r) => normalize(r.name).includes(target))
  if (partial.length === 1) return partial[0]
  if (partial.length > 1) {
    throw new Error(
      `"${name}" is ambiguous in ${category}: ${partial.map((r) => r.name).join(', ')}`
    )
  }
  throw new Error(`"${name}" is not in db/${category}.json`)
}

// ---------------------------------------------------------------------------
// Capture parsing
// ---------------------------------------------------------------------------

function parseCapture(text) {
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .filter((l) => !/^Investigation Lineup$/i.test(l) && !/^Keeper:/i.test(l))

  const codeLine = lines.find((l) => l.includes(WRAPPER))
  if (!codeLine) throw new Error('Capture has no @@...@@ code line.')
  const body = lines.filter((l) => l !== codeLine)
  if (body.length < 2) throw new Error('Capture needs lineup rows and a posse line.')

  const posse = body[body.length - 1] || null
  const rows = body.slice(0, -1)
  if (rows.length > TEAM_SLOT_COUNT) {
    throw new Error(`Capture has ${rows.length} lineup rows; the game shows at most 4.`)
  }

  // `Awakener, Wheel, Wheel, Covenant`, with the wheels and covenant optional.
  // The game omits what a slot does not have rather than leaving a blank field,
  // so a short row is normal and every trailing entry is identified by lookup
  // rather than by position: a three-part row could be one wheel and a covenant
  // or two wheels and none.
  const slots = rows.map((row) => {
    const [name, ...rest] = row.split(',').map((p) => p.trim()).filter(Boolean)
    const wheels = []
    let covenant = null
    for (const entry of rest) {
      if (covenant) throw new Error(`Row "${row}" has entries after the covenant.`)
      if (isName('wheels', entry)) wheels.push(entry)
      else if (isName('covenants', entry)) covenant = entry
      else throw new Error(`"${entry}" in row "${row}" is neither a wheel nor a covenant.`)
    }
    if (wheels.length > WHEELS_PER_SLOT) {
      throw new Error(`Row "${row}" lists ${wheels.length} wheels; the game allows 2.`)
    }
    return { name: name || null, wheels, covenant }
  })
  while (slots.length < TEAM_SLOT_COUNT) slots.push({ name: null, wheels: [], covenant: null })

  const match = codeLine.match(/@@([A-Za-z0-9]+)@@/)
  if (!match) throw new Error(`Cannot read a payload out of "${codeLine}".`)
  return { payload: match[1], slots, posse }
}

// ---------------------------------------------------------------------------
// Re-encode under a set of offsets
// ---------------------------------------------------------------------------

/** Resolve every name once, so offsets are applied to tokens rather than re-looked-up. */
function resolveCapture(capture) {
  const resolved = {
    awakeners: [],
    wheels: [],
    covenants: [],
    posse: capture.posse ? lookup('posses', capture.posse) : null,
  }
  for (const slot of capture.slots) {
    resolved.awakeners.push(slot.name ? lookup('awakeners', slot.name) : null)
    const wheels = slot.wheels.map((w) => lookup('wheels', w))
    while (wheels.length < WHEELS_PER_SLOT) wheels.push(null)
    resolved.wheels.push(wheels)
    resolved.covenants.push(slot.covenant ? lookup('covenants', slot.covenant) : null)
  }
  return resolved
}

function tokenOf(record, offset) {
  if (!record) return EMPTY_TOKEN
  if (!record.lineupToken) {
    throw new Error(`${record.name} (${record.id}) has no lineupToken in the committed db.`)
  }
  const shifted = shiftToken(record.lineupToken, offset)
  if (shifted === null) {
    throw new Error(`${record.name} cannot shift by ${offset} — it falls off the alphabet.`)
  }
  return shifted
}

/** Payload layout: 4 awakeners, 8 wheels (two per slot), 4 covenants, 1 posse. */
function encodeWith(resolved, offsets) {
  const parts = []
  for (const a of resolved.awakeners) parts.push(tokenOf(a, offsets.awakeners))
  for (const pair of resolved.wheels) for (const w of pair) parts.push(tokenOf(w, offsets.wheels))
  for (const c of resolved.covenants) parts.push(tokenOf(c, offsets.covenants))
  parts.push(tokenOf(resolved.posse, offsets.posses))
  return parts.join('')
}

/** The captured payload split back into its four positional sections. */
function sectionsOf(payload, resolved, offsets) {
  const lengths = []
  for (const a of resolved.awakeners) lengths.push(['awakeners', tokenOf(a, offsets.awakeners).length])
  for (const pair of resolved.wheels)
    for (const w of pair) lengths.push(['wheels', tokenOf(w, offsets.wheels).length])
  for (const c of resolved.covenants) lengths.push(['covenants', tokenOf(c, offsets.covenants).length])
  lengths.push(['posses', tokenOf(resolved.posse, offsets.posses).length])

  const out = { awakeners: '', wheels: '', covenants: '', posses: '' }
  let at = 0
  for (const [section, len] of lengths) {
    out[section] += payload.slice(at, at + len)
    at += len
  }
  return out
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const capture = parseCapture(fs.readFileSync(capturePath, 'utf-8'))
const resolved = resolveCapture(capture)

/**
 * Records in this capture that the committed db has no token for.
 *
 * A newly released character arrives before SKeyDB tokenises them, and until
 * then any lineup containing them cannot be exported at all — `encodeIngameTeamCode`
 * refuses rather than guessing. But a capture of that very lineup gives the
 * answer away: every other position in the payload is known, so whatever is
 * left over at the unknown record's position IS its token. That only works
 * with exactly one unknown, since two would leave the split between them
 * undetermined.
 */
function unknownRecords(resolved) {
  const out = []
  resolved.awakeners.forEach((a, slot) => {
    if (a && !a.lineupToken) out.push({ record: a, category: 'awakeners', where: `slot ${slot + 1}` })
  })
  resolved.wheels.forEach((pair, slot) => {
    pair.forEach((w, i) => {
      if (w && !w.lineupToken) {
        out.push({ record: w, category: 'wheels', where: `slot ${slot + 1} wheel ${i + 1}` })
      }
    })
  })
  resolved.covenants.forEach((c, slot) => {
    if (c && !c.lineupToken) out.push({ record: c, category: 'covenants', where: `slot ${slot + 1}` })
  })
  if (resolved.posse && !resolved.posse.lineupToken) {
    out.push({ record: resolved.posse, category: 'posses', where: 'posse' })
  }
  return out
}

/** The payload positions, in order, as [record-or-null, category] pairs. */
function payloadPositions(resolved) {
  const out = []
  for (const a of resolved.awakeners) out.push([a, 'awakeners'])
  for (const pair of resolved.wheels) for (const w of pair) out.push([w, 'wheels'])
  for (const c of resolved.covenants) out.push([c, 'covenants'])
  out.push([resolved.posse, 'posses'])
  return out
}

function solveUnknownToken(resolved, payload, unknown) {
  const positions = payloadPositions(resolved)
  let before = 0
  let seen = false
  let after = 0
  for (const [record] of positions) {
    if (record === unknown.record) {
      seen = true
      continue
    }
    const len = record ? (record.lineupToken ?? '').length : EMPTY_TOKEN.length
    if (!len) throw new Error('More than one record in this capture has no token.')
    if (seen) after += len
    else before += len
  }
  const token = payload.slice(before, payload.length - after)
  if (!token) throw new Error('The payload is shorter than the known tokens in this lineup.')
  if (token.length > 2) {
    throw new Error(
      `Solved token "${token}" is ${token.length} characters; real tokens are 1 or 2. ` +
        'Either the lineup rows do not match the code, or a committed token is wrong.'
    )
  }
  return token
}

console.log(`Captured payload: ${capture.payload}`)
console.log(
  'Lineup:',
  resolved.awakeners.filter(Boolean).map((a) => a.name).join(', ') || '(none)'
)
console.log('')

const unknowns = unknownRecords(resolved)
if (unknowns.length > 1) {
  console.error('This capture contains more than one record with no committed token:')
  for (const u of unknowns) console.error(`  ${u.record.name} (${u.where})`)
  console.error('')
  console.error('Capture a lineup with only one new record in it — with two unknowns the')
  console.error('payload cannot say where one token ends and the next begins.')
  process.exit(1)
}

if (unknowns.length === 1) {
  const unknown = unknowns[0]
  const token = solveUnknownToken(resolved, capture.payload, unknown)
  const clash = Object.values(CATALOGS[unknown.category]).find((r) => r.lineupToken === token)
  console.log(`${unknown.record.name} has no committed token; this capture gives it: "${token}"`)
  if (clash) {
    console.error('')
    console.error(`But "${token}" is already held by ${clash.name} in db/${unknown.category}.json.`)
    console.error('Two records on one token make every code containing it decode to whichever')
    console.error('the loader saw first. Resolve the collision before writing.')
    process.exit(1)
  }
  if (!write) {
    console.log('Re-run with --write to record it.')
    process.exit(1)
  }
  const data = CATALOGS[unknown.category]
  data[unknown.record.id].lineupToken = token
  const filepath = path.join(DB_DIR, `${unknown.category}.json`)
  fs.writeFileSync(filepath, serialize(filepath, data))
  console.log(`Written to db/${unknown.category}.json.`)
  console.log('Run `npm test` — tests/lineup-tokens.test.ts asserts token uniqueness and')
  console.log('lists which records are deliberately tokenless; update that list.')
  process.exit(0)
}

const range = []
for (let o = -OFFSET_RANGE; o <= OFFSET_RANGE; o++) range.push(o)

const matches = []
for (const awakeners of range) {
  for (const wheels of range) {
    for (const covenants of range) {
      for (const posses of range) {
        const offsets = { awakeners, wheels, covenants, posses }
        let encoded
        try {
          encoded = encodeWith(resolved, offsets)
        } catch {
          continue
        }
        if (encoded === capture.payload) matches.push(offsets)
      }
    }
  }
}

const describe = (o) =>
  `awakeners ${o.awakeners >= 0 ? '+' : ''}${o.awakeners}, ` +
  `wheels ${o.wheels >= 0 ? '+' : ''}${o.wheels}, ` +
  `covenants ${o.covenants >= 0 ? '+' : ''}${o.covenants}, ` +
  `posses ${o.posses >= 0 ? '+' : ''}${o.posses}`

if (!matches.length) {
  console.log('No uniform offset reproduces the capture.')
  console.log('')
  console.log('That rules out a whole-category shift, which is the useful half of the answer:')
  console.log('the dictionary has changed in a way that moves some records and not others,')
  console.log('so the fix is a re-sync of the affected category rather than an offset.')
  console.log('')
  const zero = { awakeners: 0, wheels: 0, covenants: 0, posses: 0 }
  const got = sectionsOf(capture.payload, resolved, zero)
  const want = {
    awakeners: resolved.awakeners.map((a) => tokenOf(a, 0)).join(''),
    wheels: resolved.wheels.flat().map((w) => tokenOf(w, 0)).join(''),
    covenants: resolved.covenants.map((c) => tokenOf(c, 0)).join(''),
    posses: tokenOf(resolved.posse, 0),
  }
  console.log('Section-by-section against the committed dictionaries:')
  for (const section of ['awakeners', 'wheels', 'covenants', 'posses']) {
    const ok = got[section] === want[section]
    console.log(
      `  ${ok ? 'match  ' : 'DIFFERS'} ${section.padEnd(10)} committed=${want[section]}  captured=${got[section]}`
    )
  }
  process.exit(1)
}

const exact = matches.find(
  (m) => !m.awakeners && !m.wheels && !m.covenants && !m.posses
)

if (exact) {
  console.log('The committed dictionaries reproduce the capture exactly.')
  console.log('The pin in scripts/sync-lineup-tokens.mjs is correct — no change needed.')
  if (matches.length > 1) {
    console.log('')
    console.log('Other offsets also fit, which means this capture does not discriminate')
    console.log('between them. Capture a lineup containing Arachne or Soul Synchronization')
    console.log('to get a decisive answer.')
    for (const m of matches) console.log(`  ${describe(m)}`)
  }
  process.exit(0)
}

console.log(`${matches.length} offset combination${matches.length === 1 ? '' : 's'} reproduce the capture:`)
for (const m of matches) console.log(`  ${describe(m)}`)

if (matches.length > 1) {
  console.log('')
  console.log('Ambiguous. Every one of these fits the capture, so it cannot settle the')
  console.log('question on its own — capture a second lineup that includes records from')
  console.log('the disputed part of each dictionary (Arachne, Soul Synchronization).')
  process.exit(1)
}

const winner = matches[0]
console.log('')
console.log('The committed dictionaries are shifted. Applying this offset would realign them.')

if (!write) {
  console.log('Re-run with --write to apply it to db/*.json.')
  process.exit(1)
}

const FILES = {
  awakeners: 'awakeners.json',
  wheels: 'wheels.json',
  covenants: 'covenants.json',
  posses: 'posses.json',
}

for (const [category, file] of Object.entries(FILES)) {
  const offset = winner[category]
  if (!offset) continue
  const data = CATALOGS[category]
  let changed = 0
  for (const record of Object.values(data)) {
    if (!record.lineupToken) continue
    const next = shiftToken(record.lineupToken, offset)
    if (next && next !== record.lineupToken) {
      record.lineupToken = next
      changed++
    }
  }
  const filepath = path.join(DB_DIR, file)
  fs.writeFileSync(filepath, serialize(filepath, data))
  console.log(`  ${file}: ${changed} tokens shifted by ${offset > 0 ? '+' : ''}${offset}`)
}

console.log('')
console.log('Written. Run `npm test` — tests/ingame-codec.test.ts decodes a known-good')
console.log('capture and will catch it if this made things worse. Then clear the matching')
console.log('entry from PINNED in scripts/sync-lineup-tokens.mjs.')
