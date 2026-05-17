import { useEffect } from 'react'
import { View, Text, ScrollView, TouchableOpacity } from 'react-native'
import { useRouter } from 'expo-router'
import { useFlightStore } from '@/store/flightStore'
import { useAuthStore } from '@/store/authStore'
import { useAirportStore } from '@/store/airportStore'
import { getPack } from '@/engine/packRegistry'
import { supabase } from '@/lib/supabase'

const ACCENTS = [
  { label: '🇺🇸 American', id: 'american' },
  { label: '🇬🇧 British', id: 'british' },
  { label: '🇮🇳 Indian', id: 'indian' },
  { label: '🇦🇺 Australian', id: 'australian' },
]

export default function BriefScreen() {
  const router = useRouter()
  const { selectedAccent, setSelectedAccent, tailNumber, setTailNumber } = useFlightStore()
  const { user } = useAuthStore()
  const { selectedIcao, customPacks, arrivalPacks, selectedScenarioType } = useAirportStore()

  const pack = selectedScenarioType === 'arrival'
    ? (arrivalPacks[selectedIcao] ?? getPack(selectedIcao, customPacks))
    : getPack(selectedIcao, customPacks)
  const uniqueSkills = [...new Set(pack.beats.map(b => b.skill_tag))]

  useEffect(() => {
    const accent = user?.user_metadata?.accent_preference as string | undefined
    if (accent) setSelectedAccent(accent)
  }, [user])

  useEffect(() => {
    const tail = user?.user_metadata?.tail_number as string | undefined
    if (tail) setTailNumber(tail)
  }, [user])

  async function handleAccentChange(key: string) {
    setSelectedAccent(key)
    if (user?.id) {
      await supabase.auth.updateUser({ data: { accent_preference: key } })
    }
  }

  return (
    <ScrollView className="flex-1 bg-bg" contentContainerStyle={{ padding: 20, paddingTop: 60, paddingBottom: 40 }}>
      <TouchableOpacity onPress={() => router.back()} className="mb-4">
        <Text className="text-accent text-sm">← Back</Text>
      </TouchableOpacity>

      <Text style={{ color: '#e7ecf5' }} className="text-2xl font-bold mb-1">{pack.scenario_name}</Text>
      <Text className="text-dim text-sm mb-6">{pack.scenario_description}</Text>

      {pack.scenario_type === 'arrival' && (
        <View className="flex-row items-center gap-2 mb-3">
          <View className="rounded-full px-3 py-1" style={{ backgroundColor: 'rgba(111,227,255,0.12)', borderWidth: 1, borderColor: '#6FE3FF' }}>
            <Text style={{ color: '#6FE3FF', fontSize: 11, fontWeight: '700' }}>
              {pack.controlled !== false ? '↓ INBOUND ARRIVAL' : '📻 CTAF PATTERN'}
            </Text>
          </View>
        </View>
      )}

      {/* Scenario card */}
      <View className="bg-surface2 rounded-2xl border border-line p-4 mb-4">
        <View className="h-28 bg-bg rounded-xl items-start justify-end p-3 mb-4 border border-line">
          <Text className="text-accent text-2xl font-bold font-mono">{pack.airport_icao}</Text>
          <Text className="text-muted text-xs uppercase tracking-widest">{pack.city}</Text>
        </View>

        <View className="flex-row flex-wrap gap-2">
          {[
            { l: 'Aircraft', v: `C172 · ${tailNumber}`, tap: () => router.push('/(tabs)/settings') },
            { l: 'Runways', v: pack.runways?.join(' / ') ?? '31' },
            ...(pack.controlled !== false ? [
              { l: 'ATIS', v: pack.atis_freq },
              { l: 'Tower', v: pack.tower_freq },
              { l: 'Approach', v: pack.approach_freq },
            ] : [
              { l: 'CTAF', v: pack.ctaf_freq ?? '122.8' },
              { l: 'ATIS/ASOS', v: pack.atis_freq },
            ]),
            { l: 'Duration', v: `~${pack.estimated_duration_min} min` },
          ].map(p => (
            <TouchableOpacity key={p.l} className="bg-bg rounded-xl p-3 border border-line" style={{ width: '47%' }}
              onPress={p.tap} activeOpacity={p.tap ? 0.7 : 1} disabled={!p.tap}>
              <Text className="text-muted text-xs uppercase tracking-widest">{p.l}</Text>
              <Text style={{ color: '#e7ecf5' }} className="text-sm font-semibold font-mono mt-1">{p.v}</Text>
              {p.tap && <Text className="text-accent text-xs mt-0.5">tap to edit ›</Text>}
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Accent picker */}
      <View className="bg-surface2 rounded-2xl border border-line p-4 mb-4">
        <Text className="text-muted text-xs uppercase tracking-widest mb-3">Controller Accent</Text>
        <View className="flex-row flex-wrap gap-2">
          {ACCENTS.map(a => (
            <TouchableOpacity
              key={a.id}
              className="px-4 py-2 rounded-full"
              style={selectedAccent === a.id
                ? { borderWidth: 1, borderColor: '#6FE3FF', backgroundColor: 'rgba(111,227,255,0.1)' }
                : { borderWidth: 1, borderColor: '#1C2548' }
              }
              onPress={() => handleAccentChange(a.id)}
            >
              <Text
                className="text-sm"
                style={{ color: selectedAccent === a.id ? '#6FE3FF' : '#8A9BC4', fontWeight: selectedAccent === a.id ? '600' : '400' }}
              >{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* You'll practice */}
      <View className="bg-surface2 rounded-2xl border border-line p-4 mb-6">
        <Text className="text-muted text-xs uppercase tracking-widest mb-3">You'll Practice</Text>
        {uniqueSkills.map(skill => (
          <View key={skill} className="flex-row items-center gap-3 py-1.5">
            <View className="w-4 h-4 rounded items-center justify-center" style={{ borderWidth: 1, borderColor: '#5BE3A1', backgroundColor: 'rgba(91,227,161,0.1)' }}>
              <Text className="text-go text-xs">✓</Text>
            </View>
            <Text className="text-dim text-sm">{skill.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity
        className="bg-accent rounded-2xl py-4 items-center"
        onPress={() => router.replace('/flight/hud')}
      >
        <Text className="text-bg font-bold text-base">START FLIGHT ✈</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}
