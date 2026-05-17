import { View, Text, ScrollView, TouchableOpacity } from 'react-native'
import { useRouter } from 'expo-router'
import { useDrillStore } from '@/store/drillStore'
import { useAirportStore } from '@/store/airportStore'
import { getPack } from '@/engine/packRegistry'

const PHASE_ORDER = [
  'LISTEN_ATIS',
  'TAXI_REQUEST',
  'TAXI',
  'RUNUP_HOLD',
  'TAKEOFF_CLEARANCE',
  'DEPARTURE',
  'PRACTICE_AREA',
  'RETURN_INBOUND',
  'PATTERN_ENTRY',
  'LANDING_CLEARANCE',
  'TAXI_TO_PARKING',
]

const PHASE_LABELS: Record<string, string> = {
  LISTEN_ATIS: 'PREFLIGHT',
  TAXI_REQUEST: 'TAXI',
  TAXI: 'TAXI',
  RUNUP_HOLD: 'TAXI',
  TAKEOFF_CLEARANCE: 'DEPARTURE',
  DEPARTURE: 'DEPARTURE',
  PRACTICE_AREA: 'CRUISE',
  RETURN_INBOUND: 'CRUISE',
  PATTERN_ENTRY: 'ARRIVAL',
  LANDING_CLEARANCE: 'ARRIVAL',
  TAXI_TO_PARKING: 'ARRIVAL',
}

const SKILL_DISPLAY: Record<string, string> = {
  atis_extraction: 'ATIS Extraction',
  taxi_request: 'Taxi Request',
  taxi_readback: 'Taxi Readback',
  runup_ready: 'Runup Hold Short',
  takeoff_readback: 'Takeoff Readback',
  freq_change_readback: 'Freq Change',
  position_report_norcal: 'NorCal Check-In',
  position_report_approach: 'Approach Check-In',
  inbound_call: 'Return Inbound',
  pattern_entry_readback: 'Pattern Entry',
  landing_readback: 'Landing Readback',
  taxi_to_parking_readback: 'Taxi to Parking',
}

export default function DrillScreen() {
  const router = useRouter()
  const { selectedBeatIds, toggleBeat, selectAll, clearAll, setMode } = useDrillStore()
  const { selectedIcao, customPacks } = useAirportStore()

  const pack = getPack(selectedIcao, customPacks)
  const beats = pack.beats
  const allIds = beats.map(b => b.id)

  const criticalIds = new Set(
    beats.filter(b => b.expected_student_response.required_slots.some(s => s.criticality === 'critical')).map(b => b.id)
  )

  // Group beats by section label, preserving PHASE_ORDER
  const sections: { label: string; beats: typeof beats }[] = []
  const seenLabels = new Set<string>()
  for (const phase of PHASE_ORDER) {
    const sectionLabel = PHASE_LABELS[phase] ?? phase
    const phaseBeats = beats.filter(b => b.phase === phase)
    if (phaseBeats.length === 0) continue
    if (!seenLabels.has(sectionLabel)) {
      seenLabels.add(sectionLabel)
      sections.push({ label: sectionLabel, beats: [] })
    }
    sections[sections.length - 1].beats.push(...phaseBeats)
  }
  // Any beats with phases not in PHASE_ORDER
  const knownPhases = new Set(PHASE_ORDER)
  const remainder = beats.filter(b => !knownPhases.has(b.phase))
  if (remainder.length > 0) sections.push({ label: 'OTHER', beats: remainder })

  const count = selectedBeatIds.length

  function handleStart() {
    setMode('drill')
    router.push('/flight/brief')
  }

  return (
    <View className="flex-1 bg-bg">
      {/* Header */}
      <View className="px-5 pt-14 pb-3 border-b border-line flex-row justify-between items-center">
        <View>
          <Text style={{ color: '#e7ecf5' }} className="text-lg font-bold">DRILL MODE</Text>
          <Text className="text-dim text-xs mt-0.5">{selectedIcao} · {pack.airport_name}</Text>
        </View>
        <View className="flex-row gap-2">
          <TouchableOpacity
            className="px-3 py-1.5 rounded-full border border-line"
            onPress={() => selectAll(allIds)}
          >
            <Text className="text-accent text-xs font-semibold">Select All</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="px-3 py-1.5 rounded-full border border-line"
            onPress={() => clearAll()}
          >
            <Text className="text-muted text-xs font-semibold">Clear</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 120 }}>
        {sections.map(section => (
          <View key={section.label}>
            <View className="flex-row items-center px-5 py-3 gap-3">
              <View className="flex-1 h-px bg-line" />
              <Text className="text-dim text-xs font-bold uppercase tracking-widest">{section.label}</Text>
              <View className="flex-1 h-px bg-line" />
            </View>

            {section.beats.map(beat => {
              const isSelected = selectedBeatIds.includes(beat.id)
              const isCritical = criticalIds.has(beat.id)
              return (
                <TouchableOpacity
                  key={beat.id}
                  className="mx-5 mb-2 flex-row items-center gap-3 bg-surface2 rounded-xl px-4 py-3 border border-line"
                  onPress={() => toggleBeat(beat.id)}
                  activeOpacity={0.7}
                >
                  <View
                    className="w-5 h-5 rounded items-center justify-center"
                    style={{
                      borderWidth: 1,
                      borderColor: isSelected ? '#5BE3A1' : '#1C2548',
                      backgroundColor: isSelected ? 'rgba(91,227,161,0.15)' : 'transparent',
                    }}
                  >
                    {isSelected && <Text className="text-go text-xs font-bold">✓</Text>}
                  </View>
                  <Text
                    className="flex-1 text-sm font-medium"
                    style={{ color: isSelected ? '#e7ecf5' : '#5A6B94' }}
                  >
                    {SKILL_DISPLAY[beat.skill_tag] ?? beat.skill_tag.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                  </Text>
                  {isCritical && <View className="w-2 h-2 rounded-full bg-danger" />}
                </TouchableOpacity>
              )
            })}
          </View>
        ))}
      </ScrollView>

      <View className="absolute bottom-0 left-0 right-0 px-5 pb-8 pt-4 border-t border-line bg-bg">
        <TouchableOpacity
          className="rounded-2xl py-4 items-center"
          style={{ backgroundColor: count > 0 ? '#6FE3FF' : '#1C2548' }}
          onPress={handleStart}
          disabled={count === 0}
        >
          <Text className="font-bold text-base" style={{ color: count > 0 ? '#0B0F1E' : '#5A6B94' }}>
            START DRILL ({count} beat{count !== 1 ? 's' : ''} selected)
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}
