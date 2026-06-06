import { View, Text } from 'react-native'
import type { Beat, ContentPack, ScenarioContext } from '@/types/content'

interface CueCardProps {
  beat: Beat
  pack: ContentPack
  scenarioContext: ScenarioContext | null
  currentFreq: string
  awaitingResponse: boolean
}

export function CueCard({ beat, pack, scenarioContext, currentFreq, awaitingResponse }: CueCardProps) {
  const text = beat.cue_text
    ? beat.cue_text
        .replace(/{approach_facility}/g, scenarioContext?.approach_facility ?? 'Approach')
        .replace(/{airport_icao}/g, pack.airport_icao)
        .replace(/{airport_name}/g, pack.airport_name)
        .replace(/{callsign}/g, scenarioContext?.callsign ?? '')
        .replace(/{runway}/g, scenarioContext?.runway_in_use ?? '')
        .replace(/{taxiway}/g, scenarioContext?.departure_taxiway ?? '')
        .replace(/{atis_letter}/g, scenarioContext?.atis_letter ?? '')
        .replace(/{tower_freq}/g, pack.tower_freq)
        .replace(/{approach_freq}/g, pack.approach_freq)
        .replace(/{ground_freq}/g, (pack as { ground_freq?: string }).ground_freq ?? '')
        .replace(/{squawk_code}/g, scenarioContext?.squawk_code ?? '')
        .replace(/{weather\.altimeter}/g, scenarioContext?.weather.altimeter ?? '')
        .replace(/{weather\.wind}/g, scenarioContext?.weather.wind ?? '')
    : 'Make your radio call.'

  return (
    <View
      className="mx-5 mb-3 rounded-2xl p-4"
      style={{
        borderWidth: 1,
        borderColor: awaitingResponse ? '#6FE3FF' : '#1C2548',
        backgroundColor: 'rgba(111,227,255,0.06)',
      }}
    >
      {beat.tune_to && (
        <View className="flex-row items-center gap-2 mb-3 pb-2" style={{ borderBottomWidth: 1, borderColor: '#1C2548' }}>
          <View className="w-2 h-2 rounded-full bg-go" />
          <Text className="text-go text-xs font-mono font-bold">{currentFreq} MHz</Text>
          <Text className="text-muted text-xs">· {beat.tune_label}</Text>
        </View>
      )}
      <Text className="text-accent text-xs font-bold uppercase tracking-widest mb-2">
        🎙 YOUR TRANSMISSION
      </Text>
      <Text style={{ color: '#e7ecf5' }} className="text-sm leading-relaxed">{text}</Text>
      {awaitingResponse && (
        <Text className="text-dim text-xs mt-2">Hold the mic button and transmit ↓</Text>
      )}
    </View>
  )
}
