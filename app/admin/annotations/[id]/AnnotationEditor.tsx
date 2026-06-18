'use client'

import { useState } from 'react'
import type { EnrichedAwakener, AwakenerAnnotation, TeamRole, SynergyTag, EnlightenSlot, SkillSlot } from '@/lib/types'

const TEAM_ROLES: TeamRole[] = [
  'main_dps', 'sub_dps', 'embryo_gen', 'aliemus_battery',
  'vuln_applier', 'weak_applier', 'shielder', 'healer',
  'death_resist', 'str_support', 'keyflare_support', 'card_cycler',
  'tentacle_enabler', 'leap_support', 'annihilation_support',
  'ultra_space_manager', 'sacrifice_engine', 'birth_ritual_stacker',
  'corrosion_applier', 'strike_enabler', 'relic_gen', 'poison_stacker',
]

const SYNERGY_TAGS: SynergyTag[] = [
  'leap_user', 'quasar_user', 'embryo_consumer', 'infinite_devour',
  'strike_synergy', 'lemurian_preferred', 'counter_scaling',
  'low_hp_scaling', 'kill_scaling', 'tentacle_scaling',
  'aliemus_hungry', 'keyflare_hungry', 'divine_realm',
  'high_aliemus_cost', 'sacrifice_synergy', 'bleed_stacker',
  'poison_stacker', 'creativity_engine', 'sin_stacker',
]

const ENLIGHTEN_SLOTS: EnlightenSlot[] = ['E0', 'E1', 'E2', 'E3', 'OE', 'AA']
const SKILL_SLOTS: SkillSlot[] = ['Strike', 'Defense', 'Skill1', 'Skill2', 'Rouse', 'Exalt', 'OverExalt']

function createEmptyAnnotation(id: string): AwakenerAnnotation {
  return {
    id,
    teamRoles: [],
    synergyTags: [],
    requires: [],
    synergizesWith: [],
    conflictsWith: [],
    viabilityFloor: 'E0',
    enlightenBreakpoints: [],
    keySkillSlots: [],
    keyTalents: [],
    recommendedPosses: [],
    isDivineRealm: false,
    tier: 'B',
    notes: '',
  }
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`text-xs px-2 py-1 rounded border transition-all ${
        checked
          ? 'bg-amber-500 border-amber-500 text-black font-medium'
          : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'
      }`}
    >
      {label}
    </button>
  )
}

function TagInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string[]
  onChange: (v: string[]) => void
  placeholder?: string
}) {
  const [input, setInput] = useState('')

  const add = () => {
    const trimmed = input.trim()
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed])
    }
    setInput('')
  }

  const remove = (item: string) => onChange(value.filter(v => v !== item))

  return (
    <div>
      <label className="text-xs text-gray-500 uppercase tracking-wide block mb-1">{label}</label>
      <div className="flex flex-wrap gap-1 mb-2">
        {value.map(item => (
          <span key={item} className="flex items-center gap-1 text-xs bg-gray-800 text-gray-300 px-2 py-0.5 rounded">
            {item}
            <button type="button" onClick={() => remove(item)} className="text-gray-500 hover:text-red-400 ml-1">×</button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), add())}
          placeholder={placeholder ?? 'Type and press Enter'}
          className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-amber-500"
        />
        <button
          type="button"
          onClick={add}
          className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded text-sm transition-colors"
        >
          Add
        </button>
      </div>
    </div>
  )
}

export default function AnnotationEditor({ awakener }: { awakener: EnrichedAwakener }) {
  const [annotation, setAnnotation] = useState<AwakenerAnnotation>(
    awakener.annotation ?? createEmptyAnnotation(awakener.id)
  )
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function update<K extends keyof AwakenerAnnotation>(key: K, value: AwakenerAnnotation[K]) {
    setAnnotation(prev => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  function toggleArrayItem<T>(key: keyof AwakenerAnnotation, item: T) {
    const arr = (annotation[key] as T[]) ?? []
    const next = arr.includes(item) ? arr.filter(v => v !== item) : [...arr, item]
    update(key as keyof AwakenerAnnotation, next as AwakenerAnnotation[typeof key])
  }

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/annotations/${awakener.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(annotation),
      })
      if (!res.ok) throw new Error('Save failed')
      setSaved(true)
    } catch (err) {
      setError(String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">

      {/* Tier + Viability Floor */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-gray-500 uppercase tracking-wide block mb-2">Tier</label>
          <div className="flex gap-2">
            {(['S', 'A', 'B', 'C'] as const).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => update('tier', t)}
                className={`w-10 h-10 rounded font-bold text-sm transition-all ${
                  annotation.tier === t
                    ? t === 'S' ? 'bg-amber-500 text-black'
                    : t === 'A' ? 'bg-blue-500 text-white'
                    : t === 'B' ? 'bg-green-600 text-white'
                    : 'bg-gray-600 text-white'
                    : 'bg-gray-800 text-gray-500 hover:bg-gray-700'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-500 uppercase tracking-wide block mb-2">Viability Floor</label>
          <div className="flex gap-2 flex-wrap">
            {ENLIGHTEN_SLOTS.map(slot => (
              <button
                key={slot}
                type="button"
                onClick={() => update('viabilityFloor', slot)}
                className={`px-3 py-1.5 rounded text-sm font-medium transition-all ${
                  annotation.viabilityFloor === slot
                    ? 'bg-amber-500 text-black'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                {slot}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Enlighten Breakpoints */}
      <div>
        <label className="text-xs text-gray-500 uppercase tracking-wide block mb-2">Enlighten Breakpoints</label>
        <div className="flex gap-2 flex-wrap">
          {ENLIGHTEN_SLOTS.filter(s => s !== 'E0').map(slot => (
            <Toggle
              key={slot}
              label={slot}
              checked={annotation.enlightenBreakpoints.includes(slot)}
              onChange={() => toggleArrayItem('enlightenBreakpoints', slot)}
            />
          ))}
        </div>
      </div>

      {/* Team Roles */}
      <div>
        <label className="text-xs text-gray-500 uppercase tracking-wide block mb-2">Team Roles</label>
        <div className="flex flex-wrap gap-1.5">
          {TEAM_ROLES.map(role => (
            <Toggle
              key={role}
              label={role}
              checked={annotation.teamRoles.includes(role)}
              onChange={() => toggleArrayItem('teamRoles', role)}
            />
          ))}
        </div>
      </div>

      {/* Synergy Tags */}
      <div>
        <label className="text-xs text-gray-500 uppercase tracking-wide block mb-2">Synergy Tags</label>
        <div className="flex flex-wrap gap-1.5">
          {SYNERGY_TAGS.map(tag => (
            <Toggle
              key={tag}
              label={tag}
              checked={annotation.synergyTags.includes(tag)}
              onChange={() => toggleArrayItem('synergyTags', tag)}
            />
          ))}
        </div>
      </div>

      {/* Key Skill Slots */}
      <div>
        <label className="text-xs text-gray-500 uppercase tracking-wide block mb-2">Key Skill Slots</label>
        <div className="flex flex-wrap gap-1.5">
          {SKILL_SLOTS.map(slot => (
            <Toggle
              key={slot}
              label={slot}
              checked={annotation.keySkillSlots.includes(slot)}
              onChange={() => toggleArrayItem('keySkillSlots', slot)}
            />
          ))}
        </div>
      </div>

      {/* Key Talents */}
      <div>
        <label className="text-xs text-gray-500 uppercase tracking-wide block mb-2">Key Talents</label>
        <div className="flex gap-2 flex-wrap">
          {(['madness_omen', 'soulforge_aptitude', 'gnostic_potential'] as const).map(t => (
            <Toggle
              key={t}
              label={t}
              checked={annotation.keyTalents.includes(t)}
              onChange={() => toggleArrayItem('keyTalents', t)}
            />
          ))}
        </div>
      </div>

      {/* Compatibility */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <TagInput
          label="Requires (team needs)"
          value={annotation.requires}
          onChange={v => update('requires', v)}
          placeholder="e.g. embryo_gen"
        />
        <TagInput
          label="Synergizes With (awakener IDs)"
          value={annotation.synergizesWith}
          onChange={v => update('synergizesWith', v)}
          placeholder="e.g. awakener-0048"
        />
        <TagInput
          label="Conflicts With"
          value={annotation.conflictsWith}
          onChange={v => update('conflictsWith', v)}
          placeholder="e.g. awakener-0034"
        />
      </div>

      {/* Optional fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-gray-500 uppercase tracking-wide block mb-1">Requires Condition</label>
          <input
            type="text"
            value={annotation.requiresCondition ?? ''}
            onChange={e => update('requiresCondition', e.target.value || undefined)}
            placeholder="e.g. lemurian_team_arc2"
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-amber-500"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 uppercase tracking-wide block mb-1">Anchor Posse ID</label>
          <input
            type="text"
            value={annotation.anchorPosse ?? ''}
            onChange={e => update('anchorPosse', e.target.value || undefined)}
            placeholder="e.g. posse-0012"
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-amber-500"
          />
        </div>
      </div>

      {/* Ultra fields */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="text-xs text-gray-500 uppercase tracking-wide block mb-2">Leap Priority</label>
          <div className="flex gap-2">
            {(['none', 'low', 'mid', 'high'] as const).map(p => (
              <button
                key={p}
                type="button"
                onClick={() => update('leapPriority', p)}
                className={`px-3 py-1 rounded text-xs font-medium transition-all ${
                  annotation.leapPriority === p
                    ? 'bg-amber-500 text-black'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-500 uppercase tracking-wide block mb-2">Rouse Priority</label>
          <div className="flex gap-2">
            {(['low', 'mid', 'high'] as const).map(p => (
              <button
                key={p}
                type="button"
                onClick={() => update('rousePriority', p)}
                className={`px-3 py-1 rounded text-xs font-medium transition-all ${
                  annotation.rousePriority === p
                    ? 'bg-amber-500 text-black'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-end pb-1">
          <Toggle
            label="Divine Realm"
            checked={annotation.isDivineRealm}
            onChange={v => update('isDivineRealm', v)}
          />
        </div>
      </div>

      {annotation.isDivineRealm && (
        <div>
          <label className="text-xs text-gray-500 uppercase tracking-wide block mb-1">Divine Realm Note</label>
          <input
            type="text"
            value={annotation.divineRealmNote ?? ''}
            onChange={e => update('divineRealmNote', e.target.value || undefined)}
            placeholder="e.g. Modifies Annihilation — 150 Aliemus Exalt, 300 OE"
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-amber-500"
          />
        </div>
      )}

      {/* Content notes */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {(['arc1', 'arc2', 'dtide'] as const).map(key => (
          <div key={key}>
            <label className="text-xs text-gray-500 uppercase tracking-wide block mb-1">
              {key === 'arc1' ? 'Arc 1 Note' : key === 'arc2' ? 'Arc 2 Note' : 'D-Tide Note'}
            </label>
            <textarea
              value={annotation.contentNotes?.[key] ?? ''}
              onChange={e => update('contentNotes', {
                ...annotation.contentNotes,
                [key]: e.target.value || undefined,
              })}
              rows={2}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-amber-500 resize-none"
            />
          </div>
        ))}
      </div>

      {/* Notes */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs text-gray-500 uppercase tracking-wide">
            Notes (injected into AI prompt)
          </label>
          <span className={`text-xs ${annotation.notes.length > 800 ? 'text-amber-400' : 'text-gray-600'}`}>
            {annotation.notes.length} chars
          </span>
        </div>
        <textarea
          value={annotation.notes}
          onChange={e => update('notes', e.target.value)}
          rows={6}
          placeholder="Strategic notes for the AI — team role, synergies, breakpoints, what the character needs around them..."
          className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-amber-500 resize-y"
        />
      </div>

      {/* Save */}
      <div className="flex items-center gap-4 pt-2">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="px-6 py-2 bg-amber-500 hover:bg-amber-400 disabled:bg-amber-800 text-black font-semibold rounded transition-colors"
        >
          {saving ? 'Saving...' : 'Save Annotation'}
        </button>
        {saved && <span className="text-green-400 text-sm">✓ Saved</span>}
        {error && <span className="text-red-400 text-sm">{error}</span>}
      </div>
    </div>
  )
}