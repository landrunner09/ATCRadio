import { View, Text, TouchableOpacity } from 'react-native'
import type { Beat, ContentPack, ScenarioContext } from '@/types/content'

interface ScaffoldPanelProps {
  beat: Beat
  pack: ContentPack
  scenarioContext: ScenarioContext | null
  onPass: () => void
}

export function ScaffoldPanel({ beat, pack, scenarioContext, onPass }: ScaffoldPanelProps) {
  return (
    <View className="bg-surface2 rounded-2xl p-4" style={{ borderWidth: 1, borderColor: '#FFB85C' }}>
      <Text className="text-warm text-xs font-bold uppercase tracking-widest mb-3">▦ Scaffold mode</Text>
      {beat.expected_student_response.required_slots.map(slot => (
        <View key={slot.slot} className="flex-row items-center gap-2 mb-2">
          <View className={`w-2 h-2 rounded-full ${slot.criticality === 'critical' ? 'bg-danger' : 'bg-dim'}`} />
          <Text className="text-dim text-xs uppercase tracking-widest">{slot.slot}:</Text>
          <Text style={{ color: '#e7ecf5' }} className="text-xs font-mono">
            {slot.value
              .replace('{runway}', scenarioContext?.runway_in_use ?? '31')
              .replace('{callsign}', scenarioContext?.callsign ?? 'N12345')
              .replace('{taxiway}', scenarioContext?.departure_taxiway ?? 'alpha')
              .replace('{atis_letter}', scenarioContext?.atis_letter ?? 'Bravo')
              .replace('{altimeter}', scenarioContext?.weather.altimeter ?? '29.92')
              .replace('{approach_freq}', pack.approach_freq)
              .replace('{tower_freq}', pack.tower_freq)
              .replace('{squawk_code}', scenarioContext?.squawk_code ?? '4523')
              .replace('{approach_facility}', scenarioContext?.approach_facility ?? 'Approach')
              .replace('{airport_name}', pack.airport_name)
            }
          </Text>
        </View>
      ))}
      <TouchableOpacity
        className="bg-warm rounded-xl py-3 mt-3 items-center"
        onPress={onPass}
      >
        <Text className="text-bg font-bold text-sm">I SAID THIS PERFECTLY</Text>
      </TouchableOpacity>
    </View>
  )
}
