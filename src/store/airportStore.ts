import { create } from 'zustand'
import AsyncStorage from '@react-native-async-storage/async-storage'
import type { ContentPack } from '@/types/content'

const STORAGE_KEY = 'airport_custom_packs'
const ARRIVAL_KEY = 'airport_arrival_packs'
const SELECTED_KEY = 'airport_selected_icao'

interface AirportStore {
  selectedIcao: string
  selectedScenarioType: 'departure' | 'arrival'
  customPacks: Record<string, ContentPack>
  arrivalPacks: Record<string, ContentPack>
  isHydrated: boolean
  setSelectedIcao: (icao: string) => void
  setSelectedScenarioType: (type: 'departure' | 'arrival') => void
  addCustomPack: (pack: ContentPack) => void
  removeCustomPack: (icao: string) => void
  addArrivalPack: (pack: ContentPack) => void
  removeArrivalPack: (icao: string) => void
  hydrate: () => Promise<void>
}

export const useAirportStore = create<AirportStore>((set, get) => ({
  selectedIcao: 'KPAO',
  selectedScenarioType: 'departure',
  customPacks: {},
  arrivalPacks: {},
  isHydrated: false,

  setSelectedIcao: (icao) => {
    set({ selectedIcao: icao })
    AsyncStorage.setItem(SELECTED_KEY, icao).catch(() => {})
  },

  setSelectedScenarioType: (type) => {
    set({ selectedScenarioType: type })
  },

  addCustomPack: (pack) => {
    const next = { ...get().customPacks, [pack.airport_icao]: pack }
    set({ customPacks: next })
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {})
  },

  removeCustomPack: (icao) => {
    const nextCustom = { ...get().customPacks }
    delete nextCustom[icao]
    const nextArrival = { ...get().arrivalPacks }
    delete nextArrival[icao]
    set({ customPacks: nextCustom, arrivalPacks: nextArrival })
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nextCustom)).catch(() => {})
    AsyncStorage.setItem(ARRIVAL_KEY, JSON.stringify(nextArrival)).catch(() => {})
  },

  addArrivalPack: (pack) => {
    const next = { ...get().arrivalPacks, [pack.airport_icao]: pack }
    set({ arrivalPacks: next })
    AsyncStorage.setItem(ARRIVAL_KEY, JSON.stringify(next)).catch(() => {})
  },

  removeArrivalPack: (icao) => {
    const next = { ...get().arrivalPacks }
    delete next[icao]
    set({ arrivalPacks: next })
    AsyncStorage.setItem(ARRIVAL_KEY, JSON.stringify(next)).catch(() => {})
  },

  hydrate: async () => {
    try {
      const [packsRaw, selectedRaw, arrivalRaw] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEY),
        AsyncStorage.getItem(SELECTED_KEY),
        AsyncStorage.getItem(ARRIVAL_KEY),
      ])

      const CURRENT_SCHEMA = 4

      // Filter out packs generated with an older schema — they'll be regenerated on demand
      const purgeStale = (raw: Record<string, ContentPack>) =>
        Object.fromEntries(
          Object.entries(raw).filter(([, p]) => (p.pack_schema_version ?? 0) >= CURRENT_SCHEMA)
        )

      const rawCustom: Record<string, ContentPack> = packsRaw ? JSON.parse(packsRaw) : {}
      const rawArrival: Record<string, ContentPack> = arrivalRaw ? JSON.parse(arrivalRaw) : {}

      const customPacks = purgeStale(rawCustom)
      const arrivalPacks = purgeStale(rawArrival)

      // Persist purged versions so stale packs don't re-appear on next restart
      if (Object.keys(customPacks).length !== Object.keys(rawCustom).length)
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(customPacks)).catch(() => {})
      if (Object.keys(arrivalPacks).length !== Object.keys(rawArrival).length)
        AsyncStorage.setItem(ARRIVAL_KEY, JSON.stringify(arrivalPacks)).catch(() => {})

      const selectedIcao = selectedRaw ?? 'KPAO'
      set({ customPacks, arrivalPacks, selectedIcao, isHydrated: true })
    } catch {
      set({ isHydrated: true })
    }
  },
}))
