import { useState } from 'react'
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import { useDrillStore } from '@/store/drillStore'
import { useAirportStore } from '@/store/airportStore'
import { BUILTIN_PACKS, BUILTIN_ICAOS } from '@/engine/packRegistry'
import { supabase } from '@/lib/supabase'
import type { ContentPack } from '@/types/content'

export default function FlyScreen() {
  const router = useRouter()
  const { setMode } = useDrillStore()
  const {
    selectedIcao, selectedScenarioType,
    customPacks, arrivalPacks,
    setSelectedIcao, setSelectedScenarioType,
    addArrivalPack, removeCustomPack,
  } = useAirportStore()
  const [loadingArrival, setLoadingArrival] = useState<string | null>(null)

  const customIcaos = Object.keys(customPacks)
  const allIcaos = [...BUILTIN_ICAOS, ...customIcaos]

  function getDeparturePack(icao: string): ContentPack | undefined {
    return BUILTIN_PACKS[icao] ?? customPacks[icao]
  }

  async function handleScenarioSelect(icao: string, type: 'departure' | 'arrival') {
    setSelectedIcao(icao)
    setSelectedScenarioType(type)

    if (type === 'arrival' && !arrivalPacks[icao]) {
      setLoadingArrival(icao)
      try {
        const { data, error } = await supabase.functions.invoke('generate-airport', {
          body: { icao, scenario_type: 'arrival' },
        })
        if (!error && data?.airport_icao) {
          addArrivalPack(data as ContentPack)
        }
      } catch {
        // Silently fail — HUD will fall back to departure pack
      } finally {
        setLoadingArrival(null)
      }
    }

    setMode('full')
    router.push('/flight/brief')
  }

  return (
    <ScrollView className="flex-1 bg-bg" contentContainerStyle={{ paddingBottom: 40 }}>
      <View className="px-5 pt-14 pb-4 border-b border-line">
        <Text style={{ color: '#e7ecf5' }} className="text-2xl font-bold">Choose Airport</Text>
        <Text className="text-dim text-sm mt-1">Select a scenario to fly</Text>
      </View>

      <View className="px-5 pt-4">
        {allIcaos.map(icao => {
          const pack = getDeparturePack(icao)
          const isCustom = customIcaos.includes(icao)
          const isLoadingArrival = loadingArrival === icao
          if (!pack) return null

          return (
            <View
              key={icao}
              className="mb-4 rounded-2xl border border-line p-4"
              style={{ backgroundColor: '#141828' }}
            >
              {/* Airport header */}
              <View className="flex-row justify-between items-start mb-3">
                <View className="flex-1">
                  <View className="flex-row items-center gap-2 mb-0.5">
                    <Text className="text-xl font-bold font-mono" style={{ color: '#e7ecf5' }}>
                      {icao}
                    </Text>
                    {isCustom && (
                      <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: 'rgba(111,227,255,0.15)', borderWidth: 1, borderColor: '#6FE3FF' }}>
                        <Text className="text-xs font-bold" style={{ color: '#6FE3FF' }}>CUSTOM</Text>
                      </View>
                    )}
                  </View>
                  <Text style={{ color: '#e7ecf5' }} className="text-sm font-semibold">{pack.airport_name}</Text>
                  <Text className="text-dim text-xs">{pack.city}</Text>
                </View>
                <View className="items-end">
                  <Text className="text-dim text-xs font-mono">TWR {pack.tower_freq}</Text>
                  <Text className="text-dim text-xs font-mono">ATIS {pack.atis_freq}</Text>
                </View>
              </View>

              {/* Scenario tiles */}
              <View className="flex-row gap-2">
                <TouchableOpacity
                  className="flex-1 rounded-xl p-3 items-center"
                  style={{ backgroundColor: 'rgba(91,227,161,0.1)', borderWidth: 1, borderColor: '#5BE3A1' }}
                  onPress={() => handleScenarioSelect(icao, 'departure')}
                  activeOpacity={0.7}
                >
                  <Text style={{ color: '#5BE3A1', fontSize: 18 }}>✈</Text>
                  <Text style={{ color: '#5BE3A1' }} className="text-xs font-bold mt-1">DEPART</Text>
                  <Text className="text-dim text-xs">~15 min</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  className="flex-1 rounded-xl p-3 items-center"
                  style={{ backgroundColor: 'rgba(111,227,255,0.08)', borderWidth: 1, borderColor: '#6FE3FF' }}
                  onPress={() => handleScenarioSelect(icao, 'arrival')}
                  activeOpacity={0.7}
                  disabled={isLoadingArrival}
                >
                  {isLoadingArrival ? (
                    <ActivityIndicator color="#6FE3FF" size="small" />
                  ) : (
                    <>
                      <Text style={{ color: '#6FE3FF', fontSize: 18 }}>↓</Text>
                      <Text style={{ color: '#6FE3FF' }} className="text-xs font-bold mt-1">ARRIVE</Text>
                      <Text className="text-dim text-xs">
                        {arrivalPacks[icao] ? '~10 min' : 'generate'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              {isCustom && (
                <TouchableOpacity
                  className="mt-2 self-start"
                  onPress={() => {
                    if (selectedIcao === icao) setSelectedIcao('KPAO')
                    removeCustomPack(icao)
                  }}
                >
                  <Text style={{ color: '#FF6B7A' }} className="text-xs">Remove</Text>
                </TouchableOpacity>
              )}
            </View>
          )
        })}

        {/* Add Airport */}
        <TouchableOpacity
          className="mb-3 rounded-2xl border border-dashed p-4 items-center gap-2"
          style={{ borderColor: '#1C2548' }}
          onPress={() => router.push('/airport/add')}
          activeOpacity={0.7}
        >
          <Text className="text-accent text-2xl">+</Text>
          <Text className="text-accent text-sm font-semibold">Add Any Airport</Text>
          <Text className="text-dim text-xs text-center">Enter any ICAO code — we'll generate departure and arrival scenarios</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}
