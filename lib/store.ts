import { create } from 'zustand'
import type {
  UserRoster,
  EnlightenSlot,
  SkillSlot,
  ArcRuleset,
  Realm,
} from './types'
import {
  loadRoster,
  saveRoster,
  createEmptyRoster,
  setAwakenerOwned,
  setAwakenerEntry,
  setEnlightenLevel,
  setSkillLevel,
  setTalentLevel,
  setWheelOwned,
  setWheelEntry,
  setCovenantEntry,
  setPosseUnlocked,
  setArcRuleset,
  setKeeperLevel,
  getOwnedAwakenerIds,
  getOwnedWheelIds,
  getUnlockedPosseCount,
  setAllAwakenersOwned,
  setAllWheelsOwned,
  setAllCovenantsOwned,
  setAllPossesUnlocked,
} from './roster'

// ---------------------------------------------------------------------------
// Store shape
// ---------------------------------------------------------------------------

interface RosterStore {
  roster: UserRoster
  isHydrated: boolean

  // Lifecycle
  hydrate: () => void
  reset: () => void

  // Awakener actions
  setAwakenerOwned: (id: string, owned: boolean) => void
  setEnlightenLevel: (id: string, slot: EnlightenSlot, copies: number) => void
  setCharacterLevel: (id: string, level: number) => void
  setSkillLevel: (id: string, slot: SkillSlot, level: number) => void
  setTalentLevel: (
    id: string,
    talent: 'madnessOmen' | 'soulforgeAptitude' | 'gnosticPotential',
    level: number
  ) => void

  // Wheel actions
  setWheelOwned: (id: string, owned: boolean) => void
  setWheelStarLevel: (id: string, starLevel: number) => void
  setWheelStackLevel: (id: string, stackLevel: number) => void

  // Covenant actions
  setCovenantOwned: (id: string, owned: boolean) => void
  setCovenantThreePiece: (id: string, complete: boolean) => void
  setCovenantSixPiece: (id: string, complete: boolean) => void
  setCovenantCompletion: (id: string, percent: number) => void

  // Posse actions
  setPosseUnlocked: (id: string, unlocked: boolean) => void

  // Bulk ownership (own all / own none)
  setAllAwakenersOwned: (ids: string[], owned: boolean) => void
  setAllWheelsOwned: (ids: string[], owned: boolean) => void
  setAllCovenantsOwned: (ids: string[], owned: boolean) => void
  setAllPossesUnlocked: (ids: string[], unlocked: boolean) => void

  // Settings actions
  setArcRuleset: (ruleset: ArcRuleset) => void
  setKeeperLevel: (level: number) => void
  setPreferredRealm: (realm: Realm | undefined) => void

  // Derived
  ownedAwakenerCount: () => number
  ownedWheelCount: () => number
  unlockedPosseCount: () => number
}

// ---------------------------------------------------------------------------
// Helper: update roster and persist
// ---------------------------------------------------------------------------

function updateAndSave(
  set: (fn: (state: RosterStore) => Partial<RosterStore>) => void,
  updater: (roster: UserRoster) => UserRoster
) {
  set((state) => {
    const updated = updater(state.roster)
    saveRoster(updated)
    return { roster: updated }
  })
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useRosterStore = create<RosterStore>((set, get) => ({
  roster: createEmptyRoster(),
  isHydrated: false,

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  hydrate: () => {
    const roster = loadRoster()
    set({ roster, isHydrated: true })
  },

  reset: () => {
    const fresh = createEmptyRoster()
    saveRoster(fresh)
    set({ roster: fresh })
  },

  // ---------------------------------------------------------------------------
  // Awakener actions
  // ---------------------------------------------------------------------------

  setAwakenerOwned: (id, owned) =>
    updateAndSave(set, (r) => setAwakenerOwned(r, id, owned)),

  setEnlightenLevel: (id, slot, copies) =>
    updateAndSave(set, (r) => setEnlightenLevel(r, id, slot, copies)),

  setCharacterLevel: (id, level) =>
    updateAndSave(set, (r) => setAwakenerEntry(r, id, { characterLevel: level })),

  setSkillLevel: (id, slot, level) =>
    updateAndSave(set, (r) => setSkillLevel(r, id, slot, level)),

  setTalentLevel: (id, talent, level) =>
    updateAndSave(set, (r) => setTalentLevel(r, id, talent, level)),

  // ---------------------------------------------------------------------------
  // Wheel actions
  // ---------------------------------------------------------------------------

  setWheelOwned: (id, owned) =>
    updateAndSave(set, (r) => setWheelOwned(r, id, owned)),

  setWheelStarLevel: (id, starLevel) =>
    updateAndSave(set, (r) => setWheelEntry(r, id, { starLevel })),

  setWheelStackLevel: (id, stackLevel) =>
    updateAndSave(set, (r) => setWheelEntry(r, id, { stackLevel })),

  // ---------------------------------------------------------------------------
  // Covenant actions
  // ---------------------------------------------------------------------------

  setCovenantOwned: (id, owned) =>
    updateAndSave(set, (r) => setCovenantEntry(r, id, { owned })),

  setCovenantThreePiece: (id, complete) =>
    updateAndSave(set, (r) =>
      setCovenantEntry(r, id, { threePieceComplete: complete })
    ),

  setCovenantSixPiece: (id, complete) =>
    updateAndSave(set, (r) =>
      setCovenantEntry(r, id, { sixPieceComplete: complete })
    ),

  setCovenantCompletion: (id, percent) =>
    updateAndSave(set, (r) =>
      setCovenantEntry(r, id, { completionPercent: percent })
    ),

  // ---------------------------------------------------------------------------
  // Posse actions
  // ---------------------------------------------------------------------------

  setPosseUnlocked: (id, unlocked) =>
    updateAndSave(set, (r) => setPosseUnlocked(r, id, unlocked)),

  // ---------------------------------------------------------------------------
  // Bulk ownership
  // ---------------------------------------------------------------------------

  setAllAwakenersOwned: (ids, owned) =>
    updateAndSave(set, (r) => setAllAwakenersOwned(r, ids, owned)),

  setAllWheelsOwned: (ids, owned) =>
    updateAndSave(set, (r) => setAllWheelsOwned(r, ids, owned)),

  setAllCovenantsOwned: (ids, owned) =>
    updateAndSave(set, (r) => setAllCovenantsOwned(r, ids, owned)),

  setAllPossesUnlocked: (ids, unlocked) =>
    updateAndSave(set, (r) => setAllPossesUnlocked(r, ids, unlocked)),

  // ---------------------------------------------------------------------------
  // Settings actions
  // ---------------------------------------------------------------------------

  setArcRuleset: (ruleset) =>
    updateAndSave(set, (r) => setArcRuleset(r, ruleset)),

  setKeeperLevel: (level) =>
    updateAndSave(set, (r) => setKeeperLevel(r, level)),

  setPreferredRealm: (realm) =>
    updateAndSave(set, (r) => ({
      ...r,
      settings: { ...r.settings, preferredRealm: realm },
    })),

  // ---------------------------------------------------------------------------
  // Derived
  // ---------------------------------------------------------------------------

  ownedAwakenerCount: () => getOwnedAwakenerIds(get().roster).length,
  ownedWheelCount: () => getOwnedWheelIds(get().roster).length,
  unlockedPosseCount: () => getUnlockedPosseCount(get().roster),
}))