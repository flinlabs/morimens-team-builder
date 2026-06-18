import { getAwakeners } from '@/lib/db'

const REALM_COLORS: Record<string, string> = {
  CHAOS: 'text-purple-400',
  CARO: 'text-red-400',
  AEQUOR: 'text-teal-400',
  ULTRA: 'text-yellow-400',
}

const TIER_COLORS: Record<string, string> = {
  S: 'bg-amber-500 text-black',
  A: 'bg-blue-500 text-white',
  B: 'bg-green-600 text-white',
  C: 'bg-gray-600 text-white',
}

export default function AnnotationsPage() {
  const awakeners = getAwakeners()
  const awakenerList = Object.values(awakeners).sort((a, b) =>
    a.realm.localeCompare(b.realm) || a.name.localeCompare(b.name)
  )

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Annotations</h1>
        <span className="text-sm text-gray-400">
          {awakenerList.filter(a => !a.annotationPending).length} / {awakenerList.length} annotated
        </span>
      </div>

      <div className="grid gap-2">
        {awakenerList.map(awakener => {
          const ann = awakener.annotation
          const isPending = awakener.annotationPending

          return (
            <a
              key={awakener.id}
              href={`/admin/annotations/${awakener.id}`}
              className="flex items-center gap-4 bg-gray-900 hover:bg-gray-800 border border-gray-800 hover:border-gray-700 rounded-lg px-4 py-3 transition-all"
            >
              {/* Status dot */}
              <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${isPending ? 'bg-red-500' : 'bg-green-500'}`} />

              {/* Name + realm */}
              <div className="flex-1 min-w-0">
                <span className="font-medium">{awakener.name}</span>
                <span className={`ml-2 text-xs ${REALM_COLORS[awakener.realm] ?? 'text-gray-400'}`}>
                  {awakener.realm}
                </span>
                <span className="ml-2 text-xs text-gray-500">{awakener.type}</span>
                <span className="ml-2 text-xs text-gray-600">{awakener.rarity}</span>
              </div>

              {/* Annotation summary */}
              {ann ? (
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${TIER_COLORS[ann.tier] ?? ''}`}>
                    {ann.tier}
                  </span>
                  <span className="text-xs text-gray-500">
                    {ann.teamRoles.length} roles
                  </span>
                  <span className="text-xs text-gray-500">
                    floor: {ann.viabilityFloor}
                  </span>
                  <span className="text-xs text-gray-600">→</span>
                </div>
              ) : (
                <span className="text-xs text-red-400 flex-shrink-0">needs annotation →</span>
              )}
            </a>
          )
        })}
      </div>
    </div>
  )
}