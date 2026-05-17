import { create } from 'zustand'

interface DrillStore {
  mode: 'full' | 'drill'
  selectedBeatIds: string[]
  setMode: (mode: 'full' | 'drill') => void
  toggleBeat: (id: string) => void
  selectAll: (allIds: string[]) => void
  clearAll: () => void
}

export const useDrillStore = create<DrillStore>((set) => ({
  mode: 'full',
  selectedBeatIds: [],

  setMode: (mode) => set({ mode }),

  toggleBeat: (id) =>
    set((state) => ({
      selectedBeatIds: state.selectedBeatIds.includes(id)
        ? state.selectedBeatIds.filter((x) => x !== id)
        : [...state.selectedBeatIds, id],
    })),

  selectAll: (allIds) => set({ selectedBeatIds: allIds }),

  clearAll: () => set({ selectedBeatIds: [] }),
}))
