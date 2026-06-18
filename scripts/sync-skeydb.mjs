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

// ---------------------------------------------------------------------------
// Fetch catalogs
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
  console.log(`  ✓ fetched all catalogs`)
  return { awakeners, awakenersBuilds, wheels, enlightens, skills, talents, covenants, posses }
}

async function fetchDzones() {
  console.log('\n📥 Fetching D-Tide data...')
  const dzones = await fetchJSON(`${DZONE_BASE}/dzones.json`)
  const enemyCharacteristics = await fetchJSON(`${DZONE_BASE}/enemy-characteristics.json`)
  console.log(`  ✓ fetched dzone data`)
  return { dzones, enemyCharacteristics }
}

// ---------------------------------------------------------------------------
// Fetch individual records
// ---------------------------------------------------------------------------

async function fetchRecords(type, ids) {
  const BASE = `${SKEYDB_BASE}/records/${type}`
  const results = {}
  const chunks = []
  for (let i = 0; i < ids.length; i += 10) chunks.push(ids.slice(i, i + 10))
  for (const chunk of chunks) {
    await Promise.all(chunk.map(async (id) => {
      try {
        const slug = id.replace(`${type.replace(/s$/, '')}-`, `${type.replace(/s$/, '')}-`)
        results[id] = await fetchJSON(`${BASE}/${id}.json`)
      } catch (e) {
        console.warn(`  ⚠ could not fetch ${type}/${id}`)
      }
    }))
  }
  return results
}

// ---------------------------------------------------------------------------
// Build enriched awakeners
// ---------------------------------------------------------------------------

function buildAwakeners(catalog, buildsCatalog, enlightenCatalog, skillCatalog, talentCatalog, annotations) {
  console.log('\n🔨 Building awakeners.json...')

  // Group enlightens by awakener
  const enlightensByAwakener = {}
  for (const e of enlightenCatalog.records) {
    if (!enlightensByAwakener[e.ownerAwakenerId]) enlightensByAwakener[e.ownerAwakenerId] = []
    enlightensByAwakener[e.ownerAwakenerId].push(e)
  }

  // Group skills by awakener
  const skillsByAwakener = {}
  for (const s of skillCatalog.records) {
    if (!skillsByAwakener[s.ownerAwakenerId]) skillsByAwakener[s.ownerAwakenerId] = []
    skillsByAwakener[s.ownerAwakenerId].push(s)
  }

  // Group talents by awakener
  const talentsByAwakener = {}
  for (const t of talentCatalog.records) {
    if (!talentsByAwakener[t.ownerAwakenerId]) talentsByAwakener[t.ownerAwakenerId] = []
    talentsByAwakener[t.ownerAwakenerId].push(t)
  }

  // Index builds by awakener
  const buildsByAwakener = {}
  for (const b of (buildsCatalog.records || [])) {
    buildsByAwakener[b.awakenerId] = b
  }

  const result = {}
  const pendingAnnotation = []

  for (const awakener of catalog.records) {
    const annotation = annotations[awakener.id] || null
    if (!annotation) pendingAnnotation.push(awakener.name)

    result[awakener.id] = {
      // Base data from SKeyDB
      id: awakener.id,
      name: awakener.name,
      realm: awakener.realm,
      type: awakener.type,
      faction: awakener.faction,
      rarity: awakener.rarity,
      searchTags: awakener.searchTags || [],
      route: awakener.route,
      assets: awakener.assets || {},

      // Related data grouped
      enlightens: (enlightensByAwakener[awakener.id] || [])
        .sort((a, b) => {
          const order = ['E1', 'E2', 'E3', 'OverExalt', 'AbsoluteAxiom']
          return order.indexOf(a.slot) - order.indexOf(b.slot)
        }),
      skills: skillsByAwakener[awakener.id] || [],
      talents: talentsByAwakener[awakener.id] || [],
      build: buildsByAwakener[awakener.id] || null,

      // Annotation layer (null if not yet annotated)
      annotation: annotation,
      annotationPending: !annotation,
    }
  }

  if (pendingAnnotation.length > 0) {
    console.log(`\n  ⚠ ${pendingAnnotation.length} awakeners need annotation:`)
    pendingAnnotation.forEach(name => console.log(`    - ${name}`))
  }

  return result
}

// ---------------------------------------------------------------------------
// Build wheels (tag Mythic correctly)
// ---------------------------------------------------------------------------

function buildWheels(catalog) {
  console.log('\n🔨 Building wheels.json...')
  const result = {}
  for (const wheel of catalog.records) {
    // SKeyDB stores Mythic wheels as SSR with no ownerAwakenerId
    // We retag them correctly here
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
// Build covenants
// ---------------------------------------------------------------------------

function buildCovenants(catalog) {
  console.log('\n🔨 Building covenants.json...')
  const result = {}
  for (const covenant of catalog.records) {
    result[covenant.id] = { ...covenant }
  }
  return result
}

// ---------------------------------------------------------------------------
// Build posses
// ---------------------------------------------------------------------------

function buildPosses(catalog) {
  console.log('\n🔨 Building posses.json...')
  const result = {}
  for (const posse of catalog.records) {
    // Detect character-specific bonus from description text
    const desc = posse.descriptionTemplate || ''
    const charBonusMatch = desc.match(/"([^"]+)" is in (?:your team|the team|the party)/)
    result[posse.id] = {
      ...posse,
      hasCharacterBonus: !!charBonusMatch,
      characterBonusFor: charBonusMatch ? charBonusMatch[1] : null,
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
    enemyCharacteristics: enemyCharacteristics,
  }
}

// ---------------------------------------------------------------------------
// Diff report — detect changes since last sync
// ---------------------------------------------------------------------------

function generateDiffReport(newAwakeners) {
  const reportPath = path.join(DB_DIR, 'sync-report.json')
  let previousReport = {}
  try {
    previousReport = JSON.parse(fs.readFileSync(reportPath, 'utf-8'))
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

    const prev = previousReport[id]
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

  // Save snapshot for next diff
  const snapshot = {}
  for (const [id, awakener] of Object.entries(newAwakeners)) {
    snapshot[id] = { searchTags: awakener.searchTags }
  }
  fs.writeFileSync(reportPath, JSON.stringify(snapshot, null, 2))

  return report
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('🚀 Starting SKeyDB sync...')

  // Ensure db directory exists
  if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true })

  const annotations = readAnnotations()
  console.log(`  ✓ loaded ${Object.keys(annotations).length} annotations`)

  // Fetch all data
  const { awakeners, awakenersBuilds, wheels, enlightens, skills, talents, covenants, posses } = await fetchCatalogs()
  const { dzones, enemyCharacteristics } = await fetchDzones()

  // Build enriched DB files
  const enrichedAwakeners = buildAwakeners(awakeners, awakenersBuilds, enlightens, skills, talents, annotations)
  const enrichedWheels = buildWheels(wheels)
  const enrichedCovenants = buildCovenants(covenants)
  const enrichedPosses = buildPosses(posses)
  const enrichedDzones = buildDzones(dzones, enemyCharacteristics)

  // Write DB files
  console.log('\n💾 Writing DB files...')
  write('awakeners.json', enrichedAwakeners)
  write('wheels.json', enrichedWheels)
  write('covenants.json', enrichedCovenants)
  write('posses.json', enrichedPosses)
  write('dzones.json', enrichedDzones)

  // Generate diff report
  const report = generateDiffReport(enrichedAwakeners)
  write('sync-report.json', report)

  // Summary
  console.log('\n✅ Sync complete!')
  console.log(`  Awakeners: ${Object.keys(enrichedAwakeners).length}`)
  console.log(`  Wheels: ${Object.keys(enrichedWheels).length}`)
  console.log(`  Covenants: ${Object.keys(enrichedCovenants).length}`)
  console.log(`  Posses: ${Object.keys(enrichedPosses).length}`)
  console.log(`  D-Tide seasons: ${enrichedDzones.seasons.length}`)

  if (report.changes.length > 0) {
    console.log(`\n⚠ ${report.changes.length} awakeners had data changes — review annotations:`)
    report.changes.forEach(c => console.log(`  - ${c.name} (${c.type} changed)`))
  }
  if (report.pendingAnnotation.length > 0) {
    console.log(`\n📝 ${report.pendingAnnotation.length} awakeners need annotations`)
  }
}

main().catch(err => {
  console.error('❌ Sync failed:', err)
  process.exit(1)
})