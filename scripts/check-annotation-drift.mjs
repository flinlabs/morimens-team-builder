/** Report where annotations/awakeners.json and db/awakeners.json disagree.

Why this exists
---------------
There are two copies of every awakener annotation:

  db/awakeners.json         — an `annotation` object embedded on each record.
                              This is the ONLY one lib/db.ts reads, so it is
                              what the engine actually scores teams with.
  annotations/awakeners.json — the hand-maintained layer. The admin editor at
                              /admin/annotations reads and writes this file.

Nothing folds the second into the first. That means an edit made through the
admin UI, or any correction applied to the annotations layer, changes a file the
engine never opens — it looks applied and has no effect. Corrections have been
landing in the wrong copy for a while: at the time this script was written 49 of
60 records disagreed, including a Caraboo `conflictsWith` entry naming Sorel,
whose own guide calls the pairing good.

This script does not fix that. Which copy is right is a per-record judgement —
db/ holds fields the annotations layer never had (`combatTheme`, some
`keyPairings`), and annotations/ holds later corrections that never reached the
engine. It prints the disagreement so the merge can be worked through
deliberately, and exits non-zero when there is any, so CI can hold the line once
the backlog is cleared.

Run: node scripts/check-annotation-drift.mjs
     node scripts/check-annotation-drift.mjs --verbose   (show field values)
**/

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

const verbose = process.argv.includes('--verbose')

const db = JSON.parse(fs.readFileSync(path.join(ROOT, 'db', 'awakeners.json'), 'utf-8'))
const layer = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'annotations', 'awakeners.json'), 'utf-8')
)

// Merged onto the annotation at read time by lib/db.ts rather than stored, so a
// difference in these four is expected and means nothing.
const READ_TIME_FIELDS = new Set(['dpsRank', 'supportRank', 'dpsFloor', 'supportFloor'])

const stable = (v) => JSON.stringify(v ?? null)
const truncate = (s, n = 100) => (s.length > n ? `${s.slice(0, n)}…` : s)

const drifted = []
const onlyInDb = []
const onlyInLayer = []

for (const [id, record] of Object.entries(db)) {
  const embedded = record.annotation
  const reviewed = layer[id]
  if (!reviewed) {
    if (embedded) onlyInDb.push({ id, name: record.name })
    continue
  }
  if (!embedded) {
    onlyInLayer.push({ id, name: record.name })
    continue
  }
  const fields = new Set([...Object.keys(embedded), ...Object.keys(reviewed)])
  const differing = [...fields]
    .filter((f) => !READ_TIME_FIELDS.has(f))
    .filter((f) => stable(embedded[f]) !== stable(reviewed[f]))
  if (differing.length) {
    drifted.push({ id, name: record.name, fields: differing, embedded, reviewed })
  }
}

for (const id of Object.keys(layer)) {
  if (!db[id]) onlyInLayer.push({ id, name: layer[id]?.id ?? id })
}

const total = Object.keys(db).length
console.log(`${total} awakeners; ${drifted.length} disagree between the two copies.`)
console.log('')

for (const entry of drifted) {
  console.log(`${entry.id}  ${entry.name}`)
  for (const field of entry.fields) {
    if (verbose) {
      console.log(`    ${field}`)
      console.log(`      db/        ${truncate(stable(entry.embedded[field]), 160)}`)
      console.log(`      annotations/ ${truncate(stable(entry.reviewed[field]), 160)}`)
    } else {
      console.log(`    ${field}`)
    }
  }
}

if (onlyInDb.length) {
  console.log('')
  console.log('Embedded in db/ with no entry in the annotations layer:')
  for (const e of onlyInDb) console.log(`  ${e.id}  ${e.name}`)
}

if (onlyInLayer.length) {
  console.log('')
  console.log('In the annotations layer with nothing embedded in db/ — these are invisible')
  console.log('to the engine entirely:')
  for (const e of onlyInLayer) console.log(`  ${e.id}  ${e.name}`)
}

if (drifted.length || onlyInDb.length || onlyInLayer.length) {
  console.log('')
  console.log('Remember which way round it matters: db/awakeners.json is what the engine')
  console.log('scores with. Anything only in annotations/awakeners.json is not live.')
  process.exit(1)
}

console.log('The two copies agree.')
