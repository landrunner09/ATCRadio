import { View, Text } from 'react-native'
import type { Beat } from '@/types/content'

interface ATCCardProps {
  beat: Beat
  atcLine: string
  speakerLabel: string
  freqLabel: string
  isSpeaking: boolean
  ttsError: string | null
}

export function ATCCard({ atcLine, speakerLabel, freqLabel, isSpeaking, ttsError }: ATCCardProps) {
  return (
    <View className="mx-5 mb-3 bg-surface2 rounded-2xl border border-line p-4">
      <View className="flex-row justify-between items-center mb-2">
        <View className="flex-row items-center gap-2">
          {isSpeaking && <View className="w-2 h-2 rounded-full bg-warm" />}
          <Text className="text-warm text-xs font-bold uppercase tracking-widest">
            {speakerLabel}
          </Text>
          {isSpeaking && <Text className="text-dim text-xs">speaking…</Text>}
        </View>
        <Text className="text-muted text-xs font-mono">{freqLabel}</Text>
      </View>
      {ttsError && (
        <Text className="text-danger text-xs mb-1">⚠ {ttsError}</Text>
      )}
      <Text style={{ color: '#e7ecf5' }} className="text-sm font-mono leading-relaxed">{atcLine}</Text>
    </View>
  )
}
