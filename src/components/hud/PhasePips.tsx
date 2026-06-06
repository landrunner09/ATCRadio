import { View, Text } from 'react-native'

interface PhasePipsProps {
  beatCount: number
  currentIndex: number
  phaseLabel: string
}

export function PhasePips({ beatCount, currentIndex, phaseLabel }: PhasePipsProps) {
  return (
    <View className="flex-row items-center px-5 py-3 gap-3">
      <View className="flex-1 flex-row gap-1">
        {Array.from({ length: beatCount }).map((_, i) => (
          <View
            key={i}
            className={`flex-1 h-1.5 rounded-full ${
              i < currentIndex ? 'bg-go' : i === currentIndex ? 'bg-accent' : 'bg-line'
            }`}
          />
        ))}
      </View>
      <Text className="text-dim text-xs font-bold uppercase tracking-wider">
        {String(currentIndex + 1).padStart(2, '0')} · {phaseLabel || '—'}
      </Text>
    </View>
  )
}
