import { getAwakeners, getWheels, getCovenants, getPosses } from '@/lib/db'

const REALM_COLORS: Record<string, string> = {
  CHAOS: 'text-purple-400',
  CARO: 'text-red-400',
  AEQUOR: 'text-teal-400',
  ULTRA: 'text-yellow-400',
}

export default function AdminDashboard() {
  const awakeners = getAwakeners()
  const wheels = getWheels()
  const covenants = getCovenants()
  const posses = getPosses()

  const awakenerList = Object.values(awakeners)
  const annotated = awakenerList.filter(a => !a.annotationPending)
  const pending = awakenerList.filter(a => a.annotationPending)

  const realmCounts = awakenerList.reduce((acc, a) => {
    acc[a.realm] = (acc[a.realm] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const wheelsByRarity = Object.values(wheels).reduce((acc, w) => {
    acc[w.rarity] = (acc[w.rarity] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold">Admin Dashboard</h1>

      <section>
        <h2 className="text-lg font-semibold text-gray-300 mb-3">Database</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Awakeners', value: awakenerList.length },
            { label: 'Wheels', value: Object.keys(wheels).length },
            { label: 'Covenants', value: Object.keys(covenants).length },
            { label: 'Posses', value: Object.keys(posses).length },
          ].map(stat => (
            <div key={stat.label} className="bg-gray-900 rounded-lg p-4 border border-gray-800">
              <div className="text-2xl font-bold text-amber-400">{stat.value}</div>
              <div className="text-sm text-gray-400">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-300 mb-3">Annotation Progress</h2>
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex-1 bg-gray-800 rounded-full h-3">
              <div
                className="bg-amber-400 h-3 rounded-full transition-all"
                style={{ width: `${(annotated.length / awakenerList.length) * 100}%` }}
              />
            </div>
            <span className="text-sm text-gray-400 whitespace-nowrap">
              {annotated.length} / {awakenerList.length}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">Annotated</div>
              <div className="space-y-1">
                {annotated.map(a => (
                  <div key={a.id} className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                    <span className="text-sm">{a.name}</span>
                    <span className={`text-xs ${REALM_COLORS[a.realm] ?? 'text-gray-500'}`}>
                      {a.realm}
                    </span>
                  </div>
                ))}
                {annotated.length === 0 && (
                  <span className="text-xs text-gray-600">None yet</span>
                )}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-2">Pending</div>
              <div className="space-y-1">
                {pending.map(a => (
                  <div key={a.id} className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                    <a
                      href={`/admin/annotations/${a.id}`}
                      className="text-sm hover:text-amber-400 transition-colors"
                    >
                      {a.name}
                    </a>
                    <span className={`text-xs ${REALM_COLORS[a.realm] ?? 'text-gray-500'}`}>
                      {a.realm}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-300 mb-3">Realm Breakdown</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries(realmCounts).map(([realm, count]) => (
            <div key={realm} className="bg-gray-900 rounded-lg p-4 border border-gray-800">
              <div className={`text-xl font-bold ${REALM_COLORS[realm] ?? 'text-amber-400'}`}>
                {count}
              </div>
              <div className="text-sm text-gray-400">{realm}</div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-300 mb-3">Wheel Breakdown</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries(wheelsByRarity).map(([rarity, count]) => (
            <div key={rarity} className="bg-gray-900 rounded-lg p-4 border border-gray-800">
              <div className="text-xl font-bold text-amber-400">{count}</div>
              <div className="text-sm text-gray-400">{rarity}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}