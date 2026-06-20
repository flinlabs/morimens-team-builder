import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const DB_DIR = path.join(ROOT, 'db')
const ANNOTATIONS_PATH = path.join(ROOT, 'annotations', 'awakeners.json')

const SKEYDB_BASE = 'https://raw.githubusercontent.com/dansa/SKeyDB/main/src/data/public-v3'
const DZONE_BASE = 'https://raw.githubusercontent.com/dansa/SKeyDB/main/src/data/dzone'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function fetchJSON(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`)
  return res.json()
}

function write(filename, data) {
  const filepath = path.join(DB_DIR, filename)
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2))
  console.log(`  ✓ wrote ${filename}`)
}

function readAnnotations() {
  try {
    return JSON.parse(fs.readFileSync(ANNOTATIONS_PATH, 'utf-8'))
  } catch {
    return {}
  }
}

// Fetch every per-record file for a record type, given the list of ids from the
// catalog. Records hold the description text the catalogs omit. Chunked to keep
// concurrency bounded; failures are logged and skipped (never silently dropped).
async function fetchRecordsByIds(type, ids, concurrency = 25) {
  const results = {}
  let done = 0
  let failed = 0
  for (let i = 0; i < ids.length; i += concurrency) {
    const chunk = ids.slice(i, i + concurrency)
    await Promise.all(
      chunk.map(async (id) => {
        try {
          results[id] = await fetchJSON(`${SKEYDB_BASE}/records/${type}/${id}.json`)
        } catch {
          failed++
          console.warn(`    ⚠ could not fetch ${type}/${id}`)
        }
        done++
      })
    )
    process.stdout.write(`\r  …${type}: ${done}/${ids.length}`)
  }
  process.stdout.write(`\r  ✓ ${type}: ${done}/${ids.length}${failed ? ` (${failed} failed)` : ''}\n`)
  return results
}

const idsOf = (catalog) => (catalog.records || []).map((r) => r.id)

// ---------------------------------------------------------------------------
// Fetch catalogs (index + the build records, which are already complete)
// ---------------------------------------------------------------------------

async function fetchCatalogs() {
  console.log('\n📥 Fetching SKeyDB catalogs...')
  const [
    awakeners,
    awakenersBuilds,
    wheels,
    enlightens,
    skills,
    talents,
    covenants,
    posses,
  ] = await Promise.all([
    fetchJSON(`${SKEYDB_BASE}/catalogs/awakeners.json`),
    fetchJSON(`${SKEYDB_BASE}/catalogs/awakener-builds.json`),
    fetchJSON(`${SKEYDB_BASE}/catalogs/wheels.json`),
    fetchJSON(`${SKEYDB_BASE}/catalogs/enlightens.json`),
    fetchJSON(`${SKEYDB_BASE}/catalogs/skills.json`),
    fetchJSON(`${SKEYDB_BASE}/catalogs/talents.json`),
    fetchJSON(`${SKEYDB_BASE}/catalogs/covenants.json`),
    fetchJSON(`${SKEYDB_BASE}/catalogs/posses.json`),
  ])
  console.log('  ✓ fetched all catalogs')
  return { awakeners, awakenersBuilds, wheels, enlightens, skills, talents, covenants, posses }
}

async function fetchDzones() {
  console.log('\n📥 Fetching D-Tide data...')
  const dzones = await fetchJSON(`${DZONE_BASE}/dzones.json`)
  const enemyCharacteristics = await fetchJSON(`${DZONE_BASE}/enemy-characteristics.json`)
  console.log('  ✓ fetched dzone data')
  return { dzones, enemyCharacteristics }
}

// ---------------------------------------------------------------------------
// Build enriched awakeners (merges full records + grouped child records)
// ---------------------------------------------------------------------------

function buildAwakeners(
  awakenerRecords,
  buildsCatalog,
  enlightenRecords,
  skillRecords,
  talentRecords,
  annotations
) {
  console.log('\n🔨 Building awakeners.json...')

  const groupByOwner = (records) => {
    const by = {}
    for (const r of Object.values(records)) {
      if (!r || !r.ownerAwakenerId) continue
      ;(by[r.ownerAwakenerId] ??= []).push(r)
    }
    return by
  }

  const enlightensByAwakener = groupByOwner(enlightenRecords)
  const skillsByAwakener = groupByOwner(skillRecords)
  const talentsByAwakener = groupByOwner(talentRecords)

  // builds catalog records already contain the full nested `builds` structure
  const buildsByAwakener = {}
  for (const b of buildsCatalog.records || []) buildsByAwakener[b.awakenerId] = b

  const enlightenOrder = ['E1', 'E2', 'E3', 'OverExalt', 'AbsoluteAxiom']

  const result = {}
  const pendingAnnotation = []

  for (const a of Object.values(awakenerRecords)) {
    const annotation = annotations[a.id] || null
    if (!annotation) pendingAnnotation.push(a.name)

    // Derive realm-identity flags from searchTags (authoritative, not hand-set).
    const tags = a.searchTags || []
    const isLemurian = tags.includes('Lemurian')
    const isDivineRealm = tags.some((t) =>
      /Divine|Propagation|Singularity/i.test(String(t))
    )

    result[a.id] = {
      id: a.id,
      name: a.name,
      realm: a.realm,
      type: a.type,
      faction: a.faction,
      rarity: a.rarity,
      searchTags: a.searchTags || [],
      route: a.route,
      assets: a.assets || {},

      isDivineRealm,
      isLemurian,

      // Richer descriptive fields for the AI prompt
      availabilityType: a.availabilityType,
      aliases: a.aliases || [],
      ingameId: a.ingameId,
      numericId: a.numericId,
      lineupToken: a.lineupToken,
      primaryScalingBase: a.primaryScalingBase,
      baseStatsLv1: a.baseStatsLv1,
      substatsLv1: a.substatsLv1,

      enlightens: (enlightensByAwakener[a.id] || []).sort(
        (x, y) => enlightenOrder.indexOf(x.slot) - enlightenOrder.indexOf(y.slot)
      ),
      skills: skillsByAwakener[a.id] || [],
      talents: talentsByAwakener[a.id] || [],
      build: buildsByAwakener[a.id] || null,

      annotation,
      annotationPending: !annotation,
    }
  }

  if (pendingAnnotation.length > 0) {
    console.log(`\n  ⚠ ${pendingAnnotation.length} awakeners need annotation:`)
    pendingAnnotation.forEach((name) => console.log(`    - ${name}`))
  }

  return result
}

// ---------------------------------------------------------------------------
// Build wheels (retag Mythic; carry description text)
// ---------------------------------------------------------------------------

function buildWheels(wheelRecords) {
  console.log('\n🔨 Building wheels.json...')
  const result = {}
  for (const wheel of Object.values(wheelRecords)) {
    // Mythic wheels (campaign / battlepass / Sediment, black border) are stored
    // by SKeyDB as SSR with no ownerAwakenerId. Verified: this recovers exactly
    // the 15 known Mythic wheels.
    const isMythic = wheel.rarity === 'SSR' && !wheel.ownerAwakenerId
    const isN = wheel.rarity === 'N'

    result[wheel.id] = {
      ...wheel,
      rarity: isMythic ? 'MYTHIC' : wheel.rarity,
      isMythic,
      isNWheel: isN, // Ramona affinity wheels — no combat use
      hasCombatEffect: !isN,
    }
  }
  return result
}

// ---------------------------------------------------------------------------
// Build covenants (setEffects come from the per-record file, not the catalog)
// ---------------------------------------------------------------------------

function buildCovenants(covenantRecords, covenantCatalog) {
  console.log('\n🔨 Building covenants.json...')
  const catalogById = {}
  for (const c of covenantCatalog.records || []) catalogById[c.id] = c

  const result = {}
  for (const covenant of Object.values(covenantRecords)) {
    result[covenant.id] = {
      ...covenant,
      setEffects: covenant.setEffects || [],
      setBonuses: covenant.setBonuses || catalogById[covenant.id]?.setBonuses || [],
    }
  }
  return result
}

// ---------------------------------------------------------------------------
// Build posses (detect character-specific bonus from real phrasing)
// ---------------------------------------------------------------------------

function buildPosses(posseRecords, awakenerNames) {
  console.log('\n🔨 Building posses.json...')

  // Longest names first so e.g. "Doll: Inferno" wins over "Doll".
  const names = [...awakenerNames].sort((a, b) => b.length - a.length)
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  function detectCharacterBonus(desc) {
    if (!desc) return null
    // Pattern A: "If <name> is in your/the team/party, ..."
    for (const name of names) {
      const re = new RegExp(`\\bIf\\s+"?${esc(name)}"?\\s+is in (?:your |the )?(?:team|party)\\b`, 'i')
      if (re.test(desc)) return name
    }
    // Pattern B: a sentence-initial "<name>: <effect>" clause granting that
    // awakener a personal bonus (e.g. Vortice's Drowned Innocence, Saya's For
    // the New World). Sentence-boundary anchor prevents a short name from
    // matching inside a longer one (e.g. "Doll" inside "Doll: Inferno").
    for (const name of names) {
      const re = new RegExp(`(?:^|[.;!?]\\s+)${esc(name)}:\\s`)
      if (re.test(desc)) return name
    }
    return null
  }

  const result = {}
  for (const posse of Object.values(posseRecords)) {
    const charBonus = detectCharacterBonus(posse.descriptionTemplate || '')
    result[posse.id] = {
      ...posse,
      hasCharacterBonus: !!charBonus,
      characterBonusFor: charBonus,
    }
  }
  return result
}

// ---------------------------------------------------------------------------
// Build dzones
// ---------------------------------------------------------------------------

function buildDzones(dzones, enemyCharacteristics) {
  console.log('\n🔨 Building dzones.json...')
  return {
    seasons: dzones.records || [],
    enemyCharacteristics,
  }
}

// ---------------------------------------------------------------------------
// Diff report — detect changes since last sync
// ---------------------------------------------------------------------------

function generateDiffReport(newAwakeners) {
  const snapshotPath = path.join(DB_DIR, 'sync-snapshot.json')
  let previous = {}
  try {
    previous = JSON.parse(fs.readFileSync(snapshotPath, 'utf-8'))
  } catch { /* first run */ }

  const report = {
    syncedAt: new Date().toISOString(),
    changes: [],
    pendingAnnotation: [],
  }

  for (const [id, awakener] of Object.entries(newAwakeners)) {
    if (awakener.annotationPending) {
      report.pendingAnnotation.push({ id, name: awakener.name })
    }
    const prev = previous[id]
    if (prev) {
      const prevTags = JSON.stringify(prev.searchTags || [])
      const newTags = JSON.stringify(awakener.searchTags || [])
      if (prevTags !== newTags) {
        report.changes.push({
          id,
          name: awakener.name,
          type: 'searchTags',
          from: prev.searchTags,
          to: awakener.searchTags,
        })
      }
    }
  }

  // Save snapshot for next diff (kept separate from the human-readable report)
  const snapshot = {}
  for (const [id, awakener] of Object.entries(newAwakeners)) {
    snapshot[id] = { searchTags: awakener.searchTags }
  }
  fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2))

  return report
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('🚀 Starting SKeyDB sync...')

  if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true })

  const annotations = readAnnotations()
  console.log(`  ✓ loaded ${Object.keys(annotations).length} annotations`)

  const catalogs = await fetchCatalogs()
  const { dzones, enemyCharacteristics } = await fetchDzones()

  // Fetch the per-record files that carry description text.
  console.log('\n📥 Fetching per-record details (this is the slow part)...')
  const awakenerRecords = await fetchRecordsByIds('awakeners', idsOf(catalogs.awakeners))
  const enlightenRecords = await fetchRecordsByIds('enlightens', idsOf(catalogs.enlightens))
  const skillRecords = await fetchRecordsByIds('skills', idsOf(catalogs.skills))
  const talentRecords = await fetchRecordsByIds('talents', idsOf(catalogs.talents))
  const wheelRecords = await fetchRecordsByIds('wheels', idsOf(catalogs.wheels))
  const posseRecords = await fetchRecordsByIds('posses', idsOf(catalogs.posses))
  const covenantRecords = await fetchRecordsByIds('covenants', idsOf(catalogs.covenants))

  const awakenerNames = Object.values(awakenerRecords).map((a) => a.name)

  // Build enriched DB files
  const enrichedAwakeners = buildAwakeners(
    awakenerRecords,
    catalogs.awakenersBuilds,
    enlightenRecords,
    skillRecords,
    talentRecords,
    annotations
  )
  const enrichedWheels = buildWheels(wheelRecords)
  const enrichedCovenants = buildCovenants(covenantRecords, catalogs.covenants)
  const enrichedPosses = buildPosses(posseRecords, awakenerNames)
  const enrichedDzones = buildDzones(dzones, enemyCharacteristics)

  // Write DB files
  console.log('\n💾 Writing DB files...')
  write('awakeners.json', enrichedAwakeners)
  write('wheels.json', enrichedWheels)
  write('covenants.json', enrichedCovenants)
  write('posses.json', enrichedPosses)
  write('dzones.json', enrichedDzones)

  const report = generateDiffReport(enrichedAwakeners)
  write('sync-report.json', report)

  // Sanity checks — surface silent data gaps instead of shipping empty text
  const wheelsMissingDesc = Object.values(enrichedWheels).filter((w) => !w.descriptionTemplate).length
  const possesWithBonus = Object.values(enrichedPosses).filter((p) => p.hasCharacterBonus).length
  const covsMissingEffects = Object.values(enrichedCovenants).filter((c) => !c.setEffects.length).length

  console.log('\n✅ Sync complete!')
  console.log(`  Awakeners: ${Object.keys(enrichedAwakeners).length}`)
  const divineCount = Object.values(enrichedAwakeners).filter((a) => a.isDivineRealm).length
  const lemurianCount = Object.values(enrichedAwakeners).filter((a) => a.isLemurian).length
  console.log(`    (${divineCount} Divine, ${lemurianCount} Lemurian — derived from searchTags)`)
  console.log(`  Wheels: ${Object.keys(enrichedWheels).length} (${Object.values(enrichedWheels).filter((w) => w.isMythic).length} Mythic, ${wheelsMissingDesc} missing description)`)
  console.log(`  Covenants: ${Object.keys(enrichedCovenants).length} (${covsMissingEffects} missing setEffects)`)
  console.log(`  Posses: ${Object.keys(enrichedPosses).length} (${possesWithBonus} with character bonus)`)
  console.log(`  D-Tide seasons: ${enrichedDzones.seasons.length}`)

  if (report.changes.length > 0) {
    console.log(`\n⚠ ${report.changes.length} awakeners had data changes — review annotations:`)
    report.changes.forEach((c) => console.log(`  - ${c.name} (${c.type} changed)`))
  }
  if (report.pendingAnnotation.length > 0) {
    console.log(`\n📝 ${report.pendingAnnotation.length} awakeners need annotations`)
  }
}

main().catch((err) => {
  console.error('⚠ SKeyDB sync failed:', err)
  // A sync failure (network blip, upstream moved/renamed) must not break the
  // build when a committed db/ snapshot already exists — fall back to it and
  // continue. Only hard-fail when there is no local data at all to build on.
  const required = ['awakeners.json', 'wheels.json', 'covenants.json', 'posses.json']
  const haveSnapshot = required.every((f) => fs.existsSync(path.join(DB_DIR, f)))
  if (haveSnapshot) {
    console.warn('↪ Falling back to the committed db/ snapshot. Build continues.')
    process.exit(0)
  }
  console.error('✖ No committed db/ snapshot to fall back to — cannot build.')
  process.exit(1)
})
