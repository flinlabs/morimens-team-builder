/** One-off sync for the Pontos content drop (2026-06-29).
Appends ONLY the new records to the committed DB files:
  - awakener-0058 Pontos              → db/awakeners.json
  - wheel-0169 Compass to False North → db/wheels.json  (Pontos signature SR)
  - wheel-0170 Dreaming of Wonderland → db/wheels.json  (Lily, same drop)
  - wheel-0171 The Living Cage        → db/wheels.json  (Pontos signature SSR)
  - posse-0052 The Hollow One         → db/posses.json  (Pontos signature posse)

Existing entries are never touched — the full sync-skeydb.mjs must not be run
wholesale because it would clobber hand-applied fixes (e.g. the gnostic
defaultMaxed correction in db/awakeners.json). This mirrors only the fetch
paths needed for the new records, per the established isolation pattern.

Run: node scripts/oneoff-sync-pontos.mjs **/

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const DB_DIR = path.join(ROOT, 'db')
const ANNOTATIONS_PATH = path.join(ROOT, 'annotations', 'awakeners.json')

const SKEYDB_BASE = 'https://raw.githubusercontent.com/dansa/SKeyDB/main/src/data/public-v3'

const NEW_AWAKENER_ID = 'awakener-0058'
const NEW_WHEEL_IDS = ['wheel-0169', 'wheel-0170', 'wheel-0171']
const NEW_POSSE_IDS = ['posse-0052']

async function fetchJSON(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`)
  return res.json()
}

const readDb = (f) => JSON.parse(fs.readFileSync(path.join(DB_DIR, f), 'utf-8'))
const writeDb = (f, data) => {
  fs.writeFileSync(path.join(DB_DIR, f), JSON.stringify(data, null, 2))
  console.log(`  ✓ wrote ${f}`)
}

async function main() {
  console.log('📥 Fetching new records from SKeyDB…')

  // --- Awakener record + child records --------------------------------------
  const awakenerRecord = await fetchJSON(
    `${SKEYDB_BASE}/records/awakeners/${NEW_AWAKENER_ID}.json`
  )

  // Child ids come from the catalogs, filtered to the new owner; the record
  // files hold the description text the catalogs omit (same as the full sync).
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

  // --- Wheels + posse --------------------------------------------------------
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
    isDivineRealm: tags.some((t) => /Divine|Propagation|Singularity/i.test(String(t))),
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
    console.log(`  + ${wheel.id} ${wheel.name}`)
  }
  writeDb('wheels.json', wheels)

  const posses = readDb('posses.json')
  for (const posse of posseRecords) {
    // The full sync's character-bonus detection, applied to the one new posse.
    const desc = posse.descriptionTemplate || ''
    const names = Object.values(awakeners)
      .map((a) => a.name)
      .sort((a, b) => b.length - a.length)
    const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
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
      hasCharacterBonus: !!charBonus,
      characterBonusFor: charBonus,
    }
    console.log(`  + ${posse.id} ${posse.name}${charBonus ? ` (bonus: ${charBonus})` : ''}`)
  }
  writeDb('posses.json', posses)

  if (!annotation) {
    console.log('\n  ⚠ Pontos has no annotation yet — add one to annotations/awakeners.json')
  }
  console.log('\n✅ Done. Existing entries untouched.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
