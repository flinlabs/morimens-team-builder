/** Refresh ONLY the `lineupToken` field on every committed db record.

Why this exists
---------------
The in-game `@@...@@` share code is a positional string of dictionary tokens.
SKeyDB reassigns those tokens when the game's internal ordering shifts, so a db
snapshot that was only ever partially synced drifts out of alignment with the
live game: the app keeps exporting a stale character for a token the game has
since handed to someone else. That is how Saya (`xl` locally, `xk` upstream)
stopped surviving a round-trip through the game — and because `xk` was Xu's old
token, the two silently swapped.

The full `sync-skeydb.mjs` would fix the tokens, but it rewrites db/awakeners.json
wholesale and clobbers the hand-applied gnostic `defaultMaxed` correction. This
script follows the established isolation pattern instead: it reads the four
catalogs, and writes back a single scalar field per record. Everything else on
every record is left byte-identical.

It is idempotent and safe to re-run after any content drop.

Run: node scripts/sync-lineup-tokens.mjs
     node scripts/sync-lineup-tokens.mjs --check   (exit 1 on drift, write nothing)
**/

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const DB_DIR = path.join(ROOT, 'db')

const SKEYDB_BASE = 'https://raw.githubusercontent.com/dansa/SKeyDB/main/src/data/public-v3'

const CATEGORIES = [
  { catalog: 'awakeners', file: 'awakeners.json' },
  { catalog: 'wheels', file: 'wheels.json' },
  { catalog: 'covenants', file: 'covenants.json' },
  { catalog: 'posses', file: 'posses.json' },
]

const checkOnly = process.argv.includes('--check')

async function fetchJSON(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`)
  return res.json()
}

// The committed db files differ in how they store non-ASCII: awakeners.json
// carries \uXXXX escapes while the others hold raw characters. Re-encoding a
// file wholesale buries the real change under hundreds of noise lines, so match
// whatever style the file on disk already uses.
function serialize(filepath, data) {
  let escaped = false
  try {
    escaped = /\\u[0-9a-fA-F]{4}/.test(fs.readFileSync(filepath, 'utf-8'))
  } catch { /* new file — default to raw */ }
  const json = JSON.stringify(data, null, 2)
  return escaped
    ? json.replace(/[\u0080-\uFFFF]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'))
    : json
}

const readDb = (f) => JSON.parse(fs.readFileSync(path.join(DB_DIR, f), 'utf-8'))
const writeDb = (f, data) => {
  const filepath = path.join(DB_DIR, f)
  fs.writeFileSync(filepath, serialize(filepath, data))
}

async function main() {
  console.log(`🔑 Refreshing lineup tokens${checkOnly ? ' (check only)' : ''}…\n`)

  let drift = 0
  let missing = 0

  for (const { catalog, file } of CATEGORIES) {
    const upstream = await fetchJSON(`${SKEYDB_BASE}/catalogs/${catalog}.json`)
    const tokenById = new Map()
    for (const rec of upstream.records || []) {
      if (rec.lineupToken) tokenById.set(rec.id, rec.lineupToken)
    }

    const local = readDb(file)
    const changes = []
    const absent = []

    for (const [id, rec] of Object.entries(local)) {
      const next = tokenById.get(id)
      if (!next) {
        // Upstream has no token for this record. Non-equippable records
        // (Primordial Memory posses) legitimately have none; anything else is
        // worth surfacing because it cannot appear in a share code.
        if (rec.lineupToken) absent.push(`${id} ${rec.name}`)
        continue
      }
      if (rec.lineupToken !== next) {
        changes.push(`${id} ${rec.name}: ${rec.lineupToken ?? '—'} → ${next}`)
        rec.lineupToken = next
      }
    }

    // A token that maps to two records makes both of them unresolvable on
    // import, so report collisions even when nothing drifted this run.
    const byToken = new Map()
    for (const [id, rec] of Object.entries(local)) {
      if (!rec.lineupToken) continue
      byToken.set(rec.lineupToken, [...(byToken.get(rec.lineupToken) ?? []), id])
    }
    const collisions = [...byToken.entries()].filter(([, ids]) => ids.length > 1)

    console.log(`  ${catalog}: ${changes.length} token(s) drifted`)
    changes.forEach((c) => console.log(`    ~ ${c}`))
    absent.forEach((a) => console.log(`    ⚠ no upstream token: ${a}`))
    collisions.forEach(([tok, ids]) =>
      console.log(`    ✖ collision on "${tok}": ${ids.join(', ')}`)
    )

    drift += changes.length
    missing += absent.length
    if (collisions.length) drift += collisions.length

    if (changes.length && !checkOnly) {
      writeDb(file, local)
      console.log(`    ✓ wrote db/${file}`)
    }
  }

  console.log('')
  if (checkOnly && drift > 0) {
    console.error(`✖ ${drift} token problem(s) found. Run without --check to fix.`)
    process.exit(1)
  }
  console.log(
    drift === 0
      ? '✅ All lineup tokens match SKeyDB.'
      : `✅ Fixed ${drift} token(s).${missing ? ` ${missing} record(s) have no upstream token.` : ''}`
  )
}

main().catch((e) => {
  console.error('⚠ Token refresh failed:', e)
  process.exit(1)
})
