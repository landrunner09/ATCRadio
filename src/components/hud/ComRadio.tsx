import { useCallback } from 'react'
import { View, Text, TouchableOpacity, Vibration, Platform } from 'react-native'

// Frequency math — internal integer steps of 25 kHz above 118.000 MHz
const BASE_KHZ = 118_000
const MAX_KHZ  = 136_975
const STEP_KHZ = 25

function freqToSteps(freq: string): number {
  const mhz = parseFloat(freq)
  if (!isFinite(mhz)) return 0
  return Math.round((mhz * 1000 - BASE_KHZ) / STEP_KHZ)
}

function stepsToFreq(steps: number): string {
  const khz = BASE_KHZ + steps * STEP_KHZ
  return (khz / 1000).toFixed(3)
}

function clamp(s: number): number {
  return Math.max(0, Math.min((MAX_KHZ - BASE_KHZ) / STEP_KHZ, s))
}

interface ComRadioProps {
  activeFreq: string
  standbyFreq: string
  /** Label for the active freq when it matches a known facility (e.g. "Tower"). Empty if unknown. */
  activeLabel?: string
  /** Label for the standby freq. Empty if unknown. */
  standbyLabel?: string
  /** Highlight standby with a hint when it equals this freq (the next required target). */
  targetFreq?: string
  /** Highlight standby ring when standby == targetFreq. */
  onAdjustStandby: (newFreq: string) => void
  onSwap: () => void
}

export function ComRadio({
  activeFreq, standbyFreq,
  activeLabel = '', standbyLabel = '',
  targetFreq = '',
  onAdjustStandby, onSwap,
}: ComRadioProps) {
  const stbySteps = freqToSteps(standbyFreq)
  const targetMatched = targetFreq && stepsToFreq(freqToSteps(targetFreq)) === stepsToFreq(stbySteps)

  const adjust = useCallback((delta: number) => {
    const next = stepsToFreq(clamp(stbySteps + delta))
    onAdjustStandby(next)
    if (Platform.OS !== 'web') Vibration.vibrate(6)
  }, [stbySteps, onAdjustStandby])

  return (
    <View
      className="mx-5 mb-3 rounded-2xl px-4 py-3"
      style={{
        backgroundColor: '#070C1A',
        borderWidth: 1.5,
        borderColor: targetMatched ? '#5BE3A1' : '#1C2548',
      }}
    >
      {/* Header */}
      <View className="flex-row justify-between items-center mb-2">
        <Text className="text-muted text-xs font-bold tracking-widest">COM 1</Text>
        {targetFreq && (
          <Text className="text-dim text-xs">
            Target: {targetFreq} · {standbyLabel || 'tune standby'}
          </Text>
        )}
      </View>

      {/* ACT row — green, big */}
      <View className="flex-row items-center mb-1">
        <Text className="text-go text-xs font-bold mr-2" style={{ width: 36 }}>ACT</Text>
        <Text
          style={{
            fontFamily: 'Courier',
            fontSize: 24,
            fontWeight: '700',
            letterSpacing: 1,
            color: '#5BE3A1',
            flex: 1,
          }}
        >
          {activeFreq}
        </Text>
        {activeLabel && (
          <Text className="text-go text-xs font-bold ml-2">{activeLabel.toUpperCase()}</Text>
        )}
      </View>

      {/* STBY row — smaller, muted */}
      <View className="flex-row items-center mb-3">
        <Text className="text-muted text-xs font-bold mr-2" style={{ width: 36 }}>STBY</Text>
        <Text
          style={{
            fontFamily: 'Courier',
            fontSize: 18,
            fontWeight: '600',
            color: targetMatched ? '#5BE3A1' : '#6FE3FF',
            flex: 1,
          }}
        >
          {standbyFreq}
        </Text>
        {standbyLabel && (
          <Text
            className="text-xs font-bold ml-2"
            style={{ color: targetMatched ? '#5BE3A1' : '#6FE3FF' }}
          >
            {standbyLabel.toUpperCase()}
          </Text>
        )}
      </View>

      {/* Tuning knobs + SWAP */}
      <View className="flex-row items-center gap-3">
        <View className="flex-1 flex-row gap-2 items-center">
          <Text className="text-muted text-xs" style={{ width: 32 }}>MHz</Text>
          <Knob label="▲" onPress={() => adjust(Math.round(1000 / STEP_KHZ))} />
          <Knob label="▼" onPress={() => adjust(-Math.round(1000 / STEP_KHZ))} />
        </View>

        <TouchableOpacity
          onPress={onSwap}
          className="rounded-xl py-2 px-4 items-center"
          style={{ backgroundColor: '#1C2548' }}
        >
          <Text style={{ color: '#6FE3FF', fontSize: 14, fontWeight: '700' }}>⇄ SWAP</Text>
        </TouchableOpacity>

        <View className="flex-1 flex-row gap-2 items-center justify-end">
          <Knob label="▲" onPress={() => adjust(1)} />
          <Knob label="▼" onPress={() => adjust(-1)} />
          <Text className="text-muted text-xs" style={{ width: 32, textAlign: 'right' }}>kHz</Text>
        </View>
      </View>
    </View>
  )
}

function Knob({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className="rounded-lg items-center justify-center"
      style={{ width: 32, height: 32, backgroundColor: '#141C35', borderWidth: 1, borderColor: '#1C2548' }}
    >
      <Text style={{ color: '#6FE3FF', fontSize: 12, fontWeight: '700' }}>{label}</Text>
    </TouchableOpacity>
  )
}
