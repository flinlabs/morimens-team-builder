/** One-off sync for the Caraboo content drop (2026-08-24, patch 2.6.0).
Appends ONLY the new records to the committed DB files:
  - awakener-0060 Caraboo             → db/awakeners.json  (Caro SSR Warden, Astral Reign)
  - wheel-0175 Honeyed Deceit         → db/wheels.json     (Caraboo signature SSR)
  - wheel-0176 Serene Truth           → db/wheels.json     (Caraboo signature SR, event-free)
  - wheel-0177 Soul Synchronization   → db/wheels.json     (ownerless SSR → Mythic retag)
  - posse-0062 That Which is No Lie   → db/posses.json     (Caraboo signature posse)

Existing entries are never touched — the full sync-skeydb.mjs must not be run
wholesale because it would clobber hand-applied fixes (e.g. the gnostic
defaultMaxed correction in db/awakeners.json). This mirrors only the fetch
paths needed for the new records, per the established isolation pattern.

Why this waited
---------------
Caraboo was staged in annotations/pending-characters.json from the pre-release
infographics for two weeks before SKeyDB published. Hand-authoring the records
in the meantime would have meant inventing lineup tokens, which is the exact
cause of the export-code drift fixed in August. The real tokens are "4" for
Caraboo, "yj"/"yA"/"zf" for the wheels and "8" for the posse.

Run: node scripts/oneoff-sync-caraboo.mjs **/

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const DB_DIR = path.join(ROOT, 'db')
const ANNOTATIONS_PATH = path.join(ROOT, 'annotations', 'awakeners.json')

const SKEYDB_BASE = 'https://raw.githubusercontent.com/dansa/SKeyDB/main/src/data/public-v3'

const NEW_AWAKENER_ID = 'awakener-0060'
const NEW_WHEEL_IDS = ['wheel-0175', 'wheel-0176', 'wheel-0177']
const NEW_POSSE_IDS = ['posse-0062']

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
  console.log(`  ✓ wrote ${f}`)
}

async function main() {
  console.log('📥 Fetching new records from SKeyDB…')

  const awakenerRecord = await fetchJSON(
    `${SKEYDB_BASE}/records/awakeners/${NEW_AWAKENER_ID}.json`
  )

  const [enlCat, skillCat, talentCat, buildsCat] = await Promise.all([
    fetchJSON(`${SKEYDB_BASE}/catalogs/enlightens.json`),
    fetchJSON(`${SKEYDB_BASE}/catalogs/skills.json`),
    fetchJSON(`${SKEYDB_BASE}/catalogs/talents.json`),
    fetchJSON(`${SKEYDB_BASE}/catalogs/awakener-builds.json`),
  ])
  const childIds = (cat) =>
    (cat.records || [])
      .filter((r) => r.ownerAwakenerId === NEW_AWAKENER_ID)
      .map((r) => r.id)
  const fetchRecords = (type, ids) =>
    Promise.all(ids.map((id) => fetchJSON(`${SKEYDB_BASE}/records/${type}/${id}.json`)))

  const [enlightens, skills, talents] = await Promise.all([
    fetchRecords('enlightens', childIds(enlCat)),
    fetchRecords('skills', childIds(skillCat)),
    fetchRecords('talents', childIds(talentCat)),
  ])
  const build =
    (buildsCat.records || []).find((b) => b.awakenerId === NEW_AWAKENER_ID) ?? null

  if (!build) {
    console.log('  • no upstream BiS build yet — db/bis.json carries the hand-authored one')
  }

  // Gnostic Potential is fully unlocked on ownership for limited units. SKeyDB
  // does not carry that flag, so the full sync derives it and we mirror the
  // same derivation here rather than shipping a talent the UI treats as
  // levellable. (This is the correction a wholesale sync would clobber.)
  const isLimited = (awakenerRecord.availabilityType ?? '').startsWith('LIMITED')
  for (const t of talents) {
    if (t.family === 'gnostic_potential') t.defaultMaxed = isLimited
  }

  const wheelRecords = await fetchRecords('wheels', NEW_WHEEL_IDS)
  const posseRecords = await fetchRecords('posses', NEW_POSSE_IDS)

  // --- Assemble the awakener entry (mirrors sync-skeydb.mjs buildAwakeners) --
  const annotations = JSON.parse(fs.readFileSync(ANNOTATIONS_PATH, 'utf-8'))
  const annotation = annotations[NEW_AWAKENER_ID] || null
  const tags = awakenerRecord.searchTags || []
  const enlightenOrder = ['E1', 'E2', 'E3', 'OverExalt', 'AbsoluteAxiom']

  const entry = {
    id: awakenerRecord.id,
    name: awakenerRecord.name,
    realm: awakenerRecord.realm,
    type: awakenerRecord.type,
    faction: awakenerRecord.faction,
    rarity: awakenerRecord.rarity,
    searchTags: tags,
    route: awakenerRecord.route,
    assets: awakenerRecord.assets || {},
    isDivineRealm: tags.some((t) => /Divine|Propagation|Singularity|Primordia/i.test(String(t))),
    isLemurian: tags.includes('Lemurian'),
    availabilityType: awakenerRecord.availabilityType,
    aliases: awakenerRecord.aliases || [],
    ingameId: awakenerRecord.ingameId,
    numericId: awakenerRecord.numericId,
    lineupToken: awakenerRecord.lineupToken,
    primaryScalingBase: awakenerRecord.primaryScalingBase,
    baseStatsLv1: awakenerRecord.baseStatsLv1,
    substatsLv1: awakenerRecord.substatsLv1,
    enlightens: enlightens.sort(
      (x, y) => enlightenOrder.indexOf(x.slot) - enlightenOrder.indexOf(y.slot)
    ),
    skills,
    talents,
    build,
    annotation,
    annotationPending: !annotation,
  }

  // --- Append-only writes -----------------------------------------------------
  console.log('\n🔨 Appending to db/…')

  const awakeners = readDb('awakeners.json')
  if (awakeners[NEW_AWAKENER_ID]) {
    console.log(`  • ${NEW_AWAKENER_ID} already present — replacing that entry only`)
  }
  awakeners[NEW_AWAKENER_ID] = entry
  writeDb('awakeners.json', awakeners)

  const wheels = readDb('wheels.json')
  for (const wheel of wheelRecords) {
    // Same Mythic retag rule as the full sync: SSR with no owner is Mythic.
    const isMythic = wheel.rarity === 'SSR' && !wheel.ownerAwakenerId
    const isN = wheel.rarity === 'N'
    wheels[wheel.id] = {
      ...wheel,
      rarity: isMythic ? 'MYTHIC' : wheel.rarity,
      isMythic,
      isNWheel: isN,
      hasCombatEffect: !isN,
    }
    console.log(`  + ${wheel.id} ${wheel.name}${isMythic ? ' (retagged MYTHIC)' : ''}`)
  }
  writeDb('wheels.json', wheels)

  const posses = readDb('posses.json')
  const names = Object.values(awakeners)
    .map((a) => a.name)
    .sort((a, b) => b.length - a.length)
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  for (const posse of posseRecords) {
    const desc = posse.descriptionTemplate || ''
    let charBonus = null
    for (const name of names) {
      const reA = new RegExp(
        `\\bIf\\s+"?${esc(name)}"?\\s+is in (?:your |the )?(?:team|party)\\b`,
        'i'
      )
      const reB = new RegExp(`(?:^|[.;!?]\\s+)${esc(name)}:\\s`)
      if (reA.test(desc) || reB.test(desc)) {
        charBonus = name
        break
      }
    }
    posses[posse.id] = {
      ...posse,
      equippable: posse.equippable !== false,
      collectible: posse.collectible !== false,
      hasCharacterBonus: !!charBonus,
      characterBonusFor: charBonus,
    }
    const flag = posse.equippable === false ? ' [engine-internal]' : ''
    console.log(`  + ${posse.id} ${posse.name}${charBonus ? ` (bonus: ${charBonus})` : ''}${flag}`)
  }
  writeDb('posses.json', posses)

  if (!annotation) {
    console.log('\n  ⚠ Caraboo has no annotation yet — add one to annotations/awakeners.json')
  }
  console.log('\n✅ Done. Existing entries untouched.')
  console.log('   Next: node scripts/sync-lineup-tokens.mjs --check')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
