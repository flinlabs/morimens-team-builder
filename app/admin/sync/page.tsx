import fs from 'fs'
import path from 'path'

interface SyncReport {
  syncedAt: string
  changes: Array<{ id: string; name: string; type: string; from: unknown; to: unknown }>
  pendingAnnotation: Array<{ id: string; name: string }>
}

export default function SyncReportPage() {
  let report: SyncReport | null = null
  try {
    const raw = fs.readFileSync(path.join(process.cwd(), 'db', 'sync-report.json'), 'utf-8')
    report = JSON.parse(raw)
  } catch {
    // no report yet
  }

  if (!report) {
    return (
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Sync Report</h1>
        <p className="text-gray-400">No sync report found. Run <code className="bg-gray-800 px-2 py-0.5 rounded text-amber-400">npm run sync</code> first.</p>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Sync Report</h1>
        <span className="text-sm text-gray-500">
          Last synced: {new Date(report.syncedAt).toLocaleString()}
        </span>
      </div>

      {report.changes.length === 0 && report.pendingAnnotation.length === 0 ? (
        <div className="bg-green-900/30 border border-green-800 rounded-lg p-4 text-green-400">
          ✓ All annotations are up to date. No changes detected since last sync.
        </div>
      ) : null}

      {report.changes.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-amber-400 mb-3">
            ⚠ {report.changes.length} awakener{report.changes.length !== 1 ? 's' : ''} changed since last annotation review
          </h2>
          <div className="space-y-2">
            {report.changes.map(change => (
              <div key={change.id} className="bg-gray-900 border border-amber-800 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">{change.name}</span>
                  <a
                    href={`/admin/annotations/${change.id}`}
                    className="text-xs text-amber-400 hover:text-amber-300"
                  >
                    Review annotation →
                  </a>
                </div>
                <div className="text-xs text-gray-500">
                  <span className="text-gray-400">{change.type} changed</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {report.pendingAnnotation.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-red-400 mb-3">
            📝 {report.pendingAnnotation.length} awakener{report.pendingAnnotation.length !== 1 ? 's' : ''} need annotations
          </h2>
          <div className="grid grid-cols-2 gap-2">
            {report.pendingAnnotation.map(a => (
              <a
                key={a.id}
                href={`/admin/annotations/${a.id}`}
                className="flex items-center gap-2 bg-gray-900 border border-gray-800 hover:border-red-800 rounded-lg px-3 py-2 transition-colors"
              >
                <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                <span className="text-sm">{a.name}</span>
              </a>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}