import { View, Text } from 'react-native'

interface StatusBarProps {
  callsign: string
  airportIcao: string
  drillMode: boolean
  wind: string
}

export function StatusBar({ callsign, airportIcao, drillMode, wind }: StatusBarProps) {
  return (
    <View className="flex-row justify-between px-5 pt-14 pb-2 border-b border-line">
      <Text className="text-dim text-xs font-mono uppercase tracking-widest">
        {callsign || '—'} · {airportIcao}{drillMode ? ' · DRILL' : ''}
      </Text>
      <Text className="text-dim text-xs font-mono">
        {wind || '—'}
      </Text>
    </View>
  )
}
