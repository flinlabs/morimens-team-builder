import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

/**
 * Downloads the image assets used by the UI (awakener portraits, covenant /
 * posse / wheel icons) from the SKeyDB repository into public/assets, so the app
 * serves them from its own domain instead of hotlinking GitHub.
 *
 * Assets are resolved through SKeyDB's asset manifest (indexes/assets.json),
 * which maps each entity + slot to a real file path — necessary because the
 * filenames don't always match the in-game name (e.g. "24" is filed as
 * mason.webp). Downloads are idempotent: existing files are skipped unless
 * --force is passed.
 *
 * NOTE: Morimens art is © Qookka Games and is not licensed by SKeyDB. This
 * fetches it for an unofficial, non-commercial fan tool. public/assets is
 * gitignored so the art is not redistributed via this repo.
 *
 * Usage:
 *   node scripts/fetch-assets.mjs                  # all categories
 *   node scripts/fetch-assets.mjs --only=awakeners # subset
 *   node scripts/fetch-assets.mjs --force          # re-download everything
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const ASSETS_DIR = path.join(ROOT, 'public', 'assets')

const REPO_BASE = 'https://raw.githubusercontent.com/dansa/SKeyDB/main'
const MANIFEST_URL = `${REPO_BASE}/src/data/public-v3/indexes/assets.json`

// entity-id prefix → { slot to pull, output subfolder }
const CATEGORIES = {
  awakeners: { prefix: 'awakener-', slot: 'icon', dir: 'portraits' },
  covenants: { prefix: 'covenant-', slot: 'icon', dir: 'covenants' },
  posses: { prefix: 'posse-', slot: 'icon', dir: 'posses' },
  wheels: { prefix: 'wheel-', slot: 'icon', dir: 'wheels' },
}

const args = process.argv.slice(2)
const FORCE = args.includes('--force')
const onlyArg = args.find(a => a.startsWith('--only='))
const ONLY = onlyArg ? onlyArg.slice('--only='.length).split(',') : Object.keys(CATEGORIES)

async function fetchJSON(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`)
  return res.json()
}

// Download one file to disk. Returns 'saved' | 'skipped' | 'failed'.
async function download(url, dest) {
  if (!FORCE && fs.existsSync(dest)) return 'skipped'
  try {
    const res = await fetch(url)
    if (!res.ok) {
      console.warn(`  ! ${res.status} ${url}`)
      return 'failed'
    }
    const buf = Buffer.from(await res.arrayBuffer())
    fs.writeFileSync(dest, buf)
    return 'saved'
  } catch (err) {
    console.warn(`  ! error ${url}: ${err.message}`)
    return 'failed'
  }
}

// Run tasks with bounded concurrency.
async function inBatches(items, worker, concurrency = 16) {
  const results = []
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency)
    results.push(...(await Promise.all(batch.map(worker))))
  }
  return results
}

async function main() {
  console.log('📥 Fetching SKeyDB asset manifest...')
  const manifest = await fetchJSON(MANIFEST_URL)
  const { assets, entities } = manifest

  fs.mkdirSync(ASSETS_DIR, { recursive: true })

  let totalSaved = 0
  let totalSkipped = 0
  let totalFailed = 0

  for (const name of ONLY) {
    const cat = CATEGORIES[name]
    if (!cat) {
      console.warn(`  ! unknown category "${name}" — skipping`)
      continue
    }

    const outDir = path.join(ASSETS_DIR, cat.dir)
    fs.mkdirSync(outDir, { recursive: true })

    // Resolve every entity of this category to a downloadable file.
    const tasks = []
    for (const [entityId, slots] of Object.entries(entities)) {
      if (!entityId.startsWith(cat.prefix)) continue
      const assetId = slots[cat.slot]
      if (!assetId) continue
      const availability = assets[assetId]?.availability
      if (!availability || availability.status !== 'available' || !availability.path) continue
      tasks.push({
        url: `${REPO_BASE}/${availability.path}`,
        dest: path.join(outDir, `${entityId}.webp`),
      })
    }

    const outcomes = await inBatches(tasks, t => download(t.url, t.dest))
    const saved = outcomes.filter(o => o === 'saved').length
    const skipped = outcomes.filter(o => o === 'skipped').length
    const failed = outcomes.filter(o => o === 'failed').length
    totalSaved += saved
    totalSkipped += skipped
    totalFailed += failed
    console.log(`  ✓ ${name}: ${saved} saved, ${skipped} skipped, ${failed} failed → public/assets/${cat.dir}/`)
  }

  console.log(`\n✅ Assets done — ${totalSaved} saved, ${totalSkipped} skipped, ${totalFailed} failed.`)
  if (totalFailed > 0) process.exitCode = 0 // non-fatal; UI falls back to a placeholder
}

main().catch(err => {
  console.error('❌ Asset fetch failed:', err.message)
  process.exit(1)
})
