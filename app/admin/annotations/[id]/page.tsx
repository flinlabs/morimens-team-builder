import { getAwakeners } from '@/lib/db'
import { notFound } from 'next/navigation'
import AnnotationEditor from './AnnotationEditor'

export default function AnnotationPage({
  params,
}: {
  params: { id: string }
}) {
  const awakeners = getAwakeners()
  const awakener = awakeners[params.id]
  if (!awakener) notFound()

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <a href="/admin/annotations" className="text-gray-500 hover:text-white text-sm">
          ← Annotations
        </a>
        <span className="text-gray-700">/</span>
        <h1 className="text-xl font-bold">{awakener.name}</h1>
        <span className="text-sm text-gray-500">{awakener.realm} · {awakener.type} · {awakener.rarity}</span>
      </div>

      {/* Character data reference */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 space-y-3">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">Character Reference</h2>

        <div>
          <div className="text-xs text-gray-500 mb-1">Search Tags</div>
          <div className="flex flex-wrap gap-1">
            {awakener.searchTags.map(tag => (
              <span key={tag} className="text-xs bg-gray-800 text-gray-300 px-2 py-0.5 rounded">
                {tag}
              </span>
            ))}
          </div>
        </div>

        <div>
          <div className="text-xs text-gray-500 mb-1">Enlighten Nodes</div>
          <div className="space-y-1">
            {awakener.enlightens.map(e => (
              <div key={e.id} className="text-xs">
                <span className="text-amber-400 font-medium w-24 inline-block">{e.slot}</span>
                <span className="text-gray-400">{e.name}</span>
                {e.descriptionTemplate && (
                  <span className="text-gray-600 ml-2">— {e.descriptionTemplate.slice(0, 80)}...</span>
                )}
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="text-xs text-gray-500 mb-1">Skills</div>
          <div className="space-y-1">
            {awakener.skills.map(s => (
              <div key={s.id} className="text-xs">
                <span className="text-blue-400 font-medium w-24 inline-block">{s.slot}</span>
                <span className="text-gray-400">{s.name}</span>
                {s.cost !== null && (
                  <span className="text-gray-600 ml-2">({s.cost} arith)</span>
                )}
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="text-xs text-gray-500 mb-1">Talents</div>
          <div className="space-y-1">
            {awakener.talents.map(t => (
              <div key={t.id} className="text-xs">
                <span className="text-green-400 font-medium w-32 inline-block">{t.family}</span>
                <span className="text-gray-400">{t.name}</span>
                {t.maxLevel > 1 && (
                  <span className="text-gray-600 ml-2">(max {t.maxLevel})</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Annotation editor */}
      <AnnotationEditor awakener={awakener} />
    </div>
  )
}