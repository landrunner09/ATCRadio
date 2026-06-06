import { View, Text, Pressable, TouchableOpacity } from 'react-native'

interface PTTBarProps {
  enabled: boolean
  recording: boolean
  processing: boolean
  asrError: string | null
  onPressIn: () => void
  onPressOut: () => void
  onSayAgain: () => void
  onShowTiles: () => void
  showSayAgain: boolean
  showTiles: boolean
}

export function PTTBar({
  enabled, recording, processing, asrError,
  onPressIn, onPressOut, onSayAgain, onShowTiles,
  showSayAgain, showTiles,
}: PTTBarProps) {
  return (
    <View>
      {asrError && (
        <Text className="text-danger text-xs text-center mb-2">⚠ {asrError}</Text>
      )}

      {(showSayAgain || showTiles) && (
        <View className="flex-row px-5 gap-3 items-center justify-center">
          {showSayAgain && (
            <TouchableOpacity
              className="flex-1 bg-surface2 rounded-2xl py-4 items-center border border-line"
              onPress={onSayAgain}
              disabled={!enabled}
            >
              <Text className="text-accent text-xs font-bold">⟲ SAY AGAIN</Text>
            </TouchableOpacity>
          )}

          <Pressable
            onPressIn={onPressIn}
            onPressOut={onPressOut}
            disabled={!enabled}
            style={() => ({
              width: 80,
              height: 80,
              borderRadius: 40,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 4,
              backgroundColor: recording
                ? '#FF5C5C'
                : processing
                ? '#FFB85C'
                : enabled ? '#5BE3A1' : '#1C2548',
              borderColor: recording
                ? 'rgba(255,92,92,0.4)'
                : processing
                ? 'rgba(255,184,92,0.4)'
                : enabled ? 'rgba(91,227,161,0.4)' : '#1C2548',
            })}
          >
            <Text style={{
              color: '#0B0F1E',
              fontWeight: '800',
              fontSize: 10,
              textAlign: 'center',
            }}>
              {recording ? 'LISTENING\n…' : processing ? 'PROC\n…' : 'HOLD\nTALK'}
            </Text>
          </Pressable>

          {showTiles && (
            <TouchableOpacity
              className="flex-1 bg-surface2 rounded-2xl py-4 items-center border border-line"
              onPress={onShowTiles}
              disabled={!enabled}
            >
              <Text className="text-warm text-xs font-bold">▦ TILES</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  )
}
