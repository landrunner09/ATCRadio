import { Text, TouchableOpacity } from 'react-native'

interface ListenCardProps {
  onTap: () => void
}

export function ListenCard({ onTap }: ListenCardProps) {
  return (
    <TouchableOpacity
      className="mx-5 mb-3 rounded-2xl py-5 items-center"
      style={{ backgroundColor: 'rgba(111,227,255,0.08)', borderWidth: 1.5, borderColor: '#6FE3FF' }}
      onPress={onTap}
    >
      <Text style={{ color: '#6FE3FF', fontSize: 22, marginBottom: 6 }}>📻</Text>
      <Text style={{ color: '#6FE3FF' }} className="font-bold text-base tracking-wide">
        TAP TO LISTEN TO ATIS
      </Text>
      <Text className="text-dim text-xs mt-1">
        Listen carefully — note the ATIS letter, runway and altimeter
      </Text>
    </TouchableOpacity>
  )
}
