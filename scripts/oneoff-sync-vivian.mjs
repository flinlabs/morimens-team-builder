/** One-off sync for the Vivian content drop (Astral Reign, released 2026-10-19).
Appends ONLY the new records to the committed DB files:
  - awakener-0062 Vivian               → db/awakeners.json  (Chaos SSR Chorus, Primordia: Chaos rewriter)
  - wheel-0181 The Seer's Riddle        → db/wheels.json     (Vivian signature SSR)
  - wheel-0182 She and Her Tree Hole    → db/wheels.json     (Vivian signature SR)
  - wheel-0183 Imago's Clinic           → db/wheels.json     (ownerless SSR → Mythic retag)
  - wheel-0184 Next Time It Rains       → db/wheels.json     (ownerless SSR → Mythic retag)
  - posse-0064 Nightborn Evil           → db/posses.json     (Vivian signature posse)

Existing entries are never touched — sync-skeydb.mjs must not be run wholesale
because it would clobber hand-applied fixes. Same isolation pattern as
scripts/oneoff-sync-gogier.mjs.

Lineup tokens are deliberately BLANKED
--------------------------------------
Upstream is still on a numbering the pin does not share. Three of the four new
wheels collide with tokens the committed dictionary already assigns, and the
awakener reuses "xs", the same value upstream gave Ogier: Oathbound last drop:

    awakener-0062  "xs"   same value upstream gave awakener-0061 — suspect
    wheel-0181     "zd"   COLLIDES with wheel-0173 Undying Hungerbone
    wheel-0182     "ze"   COLLIDES with wheel-0172 Cetus Occasus
    wheel-0183     "zf"   COLLIDES with wheel-0177 Soul Synchronization
    wheel-0184     "zi"   no collision, but same suspect numbering
    posse-0064     "xb"   KEPT — the posse category is not pinned

Everything except the posse ships with no token until an in-game capture
settles the numbering.

Run: node scripts/oneoff-sync-vivian.mjs
Then: node scripts/sync-lineup-tokens.mjs --check **/

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const DB_DIR = path.join(ROOT, 'db')
const ANNOTATIONS_PATH = path.join(ROOT, 'annotations', 'awakeners.json')

const SKEYDB_BASE = 'https://raw.githubusercontent.com/dansa/SKeyDB/main/src/data/public-v3'

const NEW_AWAKENER_ID = 'awakener-0062'
const NEW_WHEEL_IDS = ['wheel-0181', 'wheel-0182', 'wheel-0183', 'wheel-0184']
const NEW_POSSE_IDS = ['posse-0064']

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

/** Refuse to write a token that another record already owns. */
function assertNoTokenCollision(db, id, token, label) {
  if (!token) return
  for (const [otherId, record] of Object.entries(db)) {
    if (otherId !== id && record.lineupToken === token) {
      throw new Error(
        `${label} ${id} token "${token}" collides with ${otherId} ${record.name}`
      )
    }
  }
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
    // See the header: upstream "xs" is on a numbering the pin does not share.
    lineupToken: null,
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
  assertNoTokenCollision(awakeners, NEW_AWAKENER_ID, entry.lineupToken, 'awakener')
  awakeners[NEW_AWAKENER_ID] = entry
  writeDb('awakeners.json', awakeners)

  const wheels = readDb('wheels.json')
  for (const wheel of wheelRecords) {
    // Same Mythic retag rule as the full sync: SSR with no owner is Mythic.
    const isMythic = wheel.rarity === 'SSR' && !wheel.ownerAwakenerId
    const isN = wheel.rarity === 'N'
    const upstreamToken = wheel.lineupToken
    wheels[wheel.id] = {
      ...wheel,
      lineupToken: null,
      rarity: isMythic ? 'MYTHIC' : wheel.rarity,
      isMythic,
      isNWheel: isN,
      hasCombatEffect: !isN,
    }
    assertNoTokenCollision(wheels, wheel.id, wheels[wheel.id].lineupToken, 'wheel')
    const held = Object.entries(wheels).find(
      ([id, w]) => id !== wheel.id && w.lineupToken === upstreamToken
    )
    console.log(
      `  + ${wheel.id} ${wheel.name}${isMythic ? ' (retagged MYTHIC)' : ''}` +
        `${held ? ` — token "${upstreamToken}" withheld, held by ${held[0]} ${held[1].name}` : ''}`
    )
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
        `\\bIf\\s+"?${esc(name)}"?\\s+is (?:in|on) (?:your |the )?(?:team|party)\\b`,
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
    assertNoTokenCollision(posses, posse.id, posses[posse.id].lineupToken, 'posse')
    const flag = posse.equippable === false ? ' [engine-internal]' : ''
    console.log(`  + ${posse.id} ${posse.name}${charBonus ? ` (bonus: ${charBonus})` : ''}${flag}`)
  }
  writeDb('posses.json', posses)

  if (!annotation) {
    console.log('\n  ⚠ Vivian has no annotation yet — add one to annotations/awakeners.json')
  }
  console.log('\n✅ Done. Existing entries untouched.')
  console.log('   The awakener and wheels ship without lineup tokens — see the header.')
  console.log('   Next: node scripts/sync-lineup-tokens.mjs --check')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
