/** One-off text refresh for the 2.6.x retranslation (run 2026-11-20).

SKeyDB has re-issued the descriptions of almost every card, wheel and posse
since the GOgier sync: the in-game retranslation (Caraboo, Vivian and others
were reworded), a handful of renames, and a few real number changes — Power of
the Pious StateArg3 went from 9-15% to 11-20%, and the Caecus/Leigh Soulforge
tables had typos fixed.

This touches ONLY the player-facing text fields of records that already exist:

  skills      name, descriptionTemplate, descriptionArgs, cost, cardKeywords, upgrades
  enlightens  name, descriptionTemplate, descriptionArgs
  talents     name, descriptionTemplate, descriptionArgs, maxLevel
  wheels      name, descriptionTemplate, descriptionArgs, searchTags
  posses      name, descriptionTemplate, descriptionArgs

Everything hand-applied survives: lineup tokens (the wheel dictionary stays
pinned), Mythic retags, talent `defaultMaxed`, posse character-bonus flags,
annotations. That is the reason a full sync-skeydb.mjs is still off the table.

Nine child records were re-slugged upstream with the rename (for example
skill.arachne.eternal-loom → skill.arachne.eternal-weave). Those are swapped by
owner + slot, keeping the local-only fields. Wheel renames are mirrored into
db/bis.json's wheelName so BiS lists match the wheel cards.

Run: node scripts/oneoff-refresh-text.mjs          (writes)
     node scripts/oneoff-refresh-text.mjs --dry    (report only) **/

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB_DIR = path.join(__dirname, '..', 'db')
const SKEYDB_BASE = 'https://raw.githubusercontent.com/dansa/SKeyDB/main/src/data/public-v3'
const DRY = process.argv.includes('--dry')

const FIELDS = {
  skills: ['name', 'descriptionTemplate', 'descriptionArgs', 'cost', 'cardKeywords', 'upgrades'],
  enlightens: ['name', 'descriptionTemplate', 'descriptionArgs'],
  talents: ['name', 'descriptionTemplate', 'descriptionArgs', 'maxLevel'],
  wheels: ['name', 'descriptionTemplate', 'descriptionArgs', 'searchTags'],
  posses: ['name', 'descriptionTemplate', 'descriptionArgs'],
}

async function fetchJSON(url) {
  const res = await fetch(url)
  if (!res.ok) return null
  return res.json()
}

/** Bounded concurrency, same 12-wide pattern as the full sync. */
async function pool(items, fn, width = 12) {
  const out = new Array(items.length)
  let next = 0
  await Promise.all(
    Array.from({ length: width }, async () => {
      while (next < items.length) {
        const i = next++
        out[i] = await fn(items[i])
      }
    })
  )
  return out
}

function serialize(filepath, data) {
  const escaped = /\\u[0-9a-fA-F]{4}/.test(fs.readFileSync(filepath, 'utf-8'))
  const json = JSON.stringify(data, null, 2)
  return escaped
    ? json.replace(/[\u0080-￿]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'))
    : json
}
const readDb = (f) => JSON.parse(fs.readFileSync(path.join(DB_DIR, f), 'utf-8'))
const writeDb = (f, data) => {
  const filepath = path.join(DB_DIR, f)
  const text = serialize(filepath, data)
  if (!DRY) fs.writeFileSync(filepath, text)
  console.log(`  ${DRY ? '(dry) ' : '✓ '}${f}`)
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

function patch(local, upstream, kind) {
  const changed = []
  for (const f of FIELDS[kind]) {
    if (!(f in upstream) || same(local[f], upstream[f])) continue
    local[f] = upstream[f]
    changed.push(f)
  }
  return changed
}

async function main() {
  const awakeners = readDb('awakeners.json')
  const wheels = readDb('wheels.json')
  const posses = readDb('posses.json')
  const bis = readDb('bis.json')

  const catalogs = {}
  for (const c of ['skills', 'enlightens', 'talents']) {
    catalogs[c] = (await fetchJSON(`${SKEYDB_BASE}/catalogs/${c}.json`)).records
  }

  const stats = { refreshed: 0, renamed: [], reslugged: [], missing: [] }

  // --- Awakener child records ------------------------------------------------
  const childJobs = []
  for (const a of Object.values(awakeners)) {
    for (const kind of ['skills', 'enlightens', 'talents']) {
      for (const rec of a[kind] ?? []) childJobs.push({ a, kind, rec })
    }
  }
  await pool(childJobs, async ({ a, kind, rec }) => {
    let up = await fetchJSON(`${SKEYDB_BASE}/records/${kind}/${rec.id}.json`)
    if (!up) {
      // Re-slugged with a rename: find the owner's record in the same slot.
      const key = kind === 'talents' ? 'family' : 'slot'
      const taken = new Set((a[kind] ?? []).map((r) => r.id))
      const hit = catalogs[kind].find(
        (r) => r.ownerAwakenerId === a.id && r[key] === rec[key] && !taken.has(r.id)
      )
      if (!hit) {
        stats.missing.push(`${kind} ${rec.id} (${a.name})`)
        return
      }
      up = await fetchJSON(`${SKEYDB_BASE}/records/${kind}/${hit.id}.json`)
      stats.reslugged.push(`${a.name}: ${rec.name} → ${up.name} (${rec.id} → ${up.id})`)
      rec.id = up.id
      if (up.route) rec.route = up.route
    }
    const before = rec.name
    if (patch(rec, up, kind).length) stats.refreshed++
    if (before !== rec.name) stats.renamed.push(`${kind} ${a.name}: ${before} → ${rec.name}`)
  })

  // --- Wheels and posses -----------------------------------------------------
  const wheelRenames = {}
  for (const [kind, db] of [['wheels', wheels], ['posses', posses]]) {
    await pool(Object.values(db), async (rec) => {
      const up = await fetchJSON(`${SKEYDB_BASE}/records/${kind}/${rec.id}.json`)
      if (!up) {
        stats.missing.push(`${kind} ${rec.id} ${rec.name}`)
        return
      }
      const before = rec.name
      if (patch(rec, up, kind).length) stats.refreshed++
      if (before !== rec.name) {
        stats.renamed.push(`${kind} ${before} → ${rec.name}`)
        if (kind === 'wheels') wheelRenames[rec.id] = rec.name
      }
    })
  }

  // --- Keep BiS wheel names in step -----------------------------------------
  let bisFixes = 0
  for (const entry of Object.values(bis)) {
    for (const v of entry.variants ?? []) {
      for (const w of v.wheels ?? []) {
        const name = wheelRenames[w.wheelId] ?? wheels[w.wheelId]?.name
        if (name && w.wheelName !== name) {
          w.wheelName = name
          bisFixes++
        }
      }
    }
  }

  console.log(`\n${stats.refreshed} records refreshed, ${bisFixes} BiS wheel names updated`)
  if (stats.renamed.length) console.log('\nRenamed:\n  ' + stats.renamed.sort().join('\n  '))
  if (stats.reslugged.length) console.log('\nRe-slugged:\n  ' + stats.reslugged.sort().join('\n  '))
  if (stats.missing.length) {
    console.log('\n⚠ Not found upstream, left as-is:\n  ' + stats.missing.join('\n  '))
  }

  console.log('\nWriting:')
  writeDb('awakeners.json', awakeners)
  writeDb('wheels.json', wheels)
  writeDb('posses.json', posses)
  writeDb('bis.json', bis)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
