// src/components/RadioTuner.tsx
// Compact COM-radio tuner — fits comfortably above the cue card on mobile.
// Frequencies represented as integer steps of 25 kHz above 118.000 MHz.

import { useCallback, useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, Vibration, Platform } from 'react-native'

const BASE_KHZ = 118_000
const MAX_KHZ  = 136_975
const STEP_KHZ = 25

function freqToSteps(freqStr: string): number {
  const mhz = parseFloat(freqStr)
  if (!isFinite(mhz)) return 0
  return Math.round((mhz * 1000 - BASE_KHZ) / STEP_KHZ)
}

function stepsToDisplay(steps: number): string {
  const khz = BASE_KHZ + steps * STEP_KHZ
  return (khz / 1000).toFixed(3) // e.g. "119.800"
}

function clamp(s: number): number {
  return Math.max(0, Math.min((MAX_KHZ - BASE_KHZ) / STEP_KHZ, s))
}

interface RadioTunerProps {
  targetFreq: string
  targetLabel: string
  startFreq: string
  onConfirmed: (freq: string) => void
}

export function RadioTuner({ targetFreq, targetLabel, startFreq, onConfirmed }: RadioTunerProps) {
  const targetValid = isFinite(parseFloat(targetFreq)) && parseFloat(targetFreq) >= 118
  const targetSteps = targetValid ? freqToSteps(targetFreq) : 0

  const [steps, setSteps] = useState(() => freqToSteps(startFreq))

  useEffect(() => {
    setSteps(freqToSteps(startFreq))
  }, [startFreq, targetFreq])

  const adjust = useCallback((delta: number) => {
    setSteps(s => clamp(s + delta))
    if (Platform.OS !== 'web') Vibration.vibrate(6)
  }, [])

  const tuned = targetValid && steps === targetSteps
  const display = stepsToDisplay(steps)
  const targetDisplay = targetValid ? stepsToDisplay(targetSteps) : '???'

  return (
    <View
      className="mx-5 mb-3 rounded-2xl px-4 py-3"
      style={{
        backgroundColor: '#070C1A',
        borderWidth: 1.5,
        borderColor: tuned ? '#5BE3A1' : '#1C2548',
      }}
    >
      {/* Header row */}
      <View className="flex-row justify-between items-center mb-2">
        <Text className="text-muted text-xs font-bold tracking-widest">COM 1</Text>
        {tuned
          ? <Text className="text-go text-xs font-bold">✓ TUNED</Text>
          : <Text className="text-dim text-xs">Tune to {targetLabel.toUpperCase()} · {targetDisplay}</Text>
        }
      </View>

      {/* Frequency + knobs in one row */}
      <View className="flex-row items-center gap-3">
        {/* MHz knobs */}
        <View className="flex-row gap-1">
          <Knob label="▲" onPress={() => adjust(Math.round(1000 / STEP_KHZ))} />
          <Knob label="▼" onPress={() => adjust(-Math.round(1000 / STEP_KHZ))} />
        </View>

        {/* Frequency display */}
        <View className="flex-1 items-center">
          <Text
            style={{
              fontFamily: 'Courier',
              fontSize: 28,
              fontWeight: '700',
              letterSpacing: 1,
              color: tuned ? '#5BE3A1' : '#6FE3FF',
            }}
          >
            {display}
          </Text>
        </View>

        {/* kHz knobs */}
        <View className="flex-row gap-1">
          <Knob label="▲" onPress={() => adjust(1)} />
          <Knob label="▼" onPress={() => adjust(-1)} />
        </View>
      </View>

      {/* MHz / kHz labels */}
      <View className="flex-row justify-between mt-1 mb-2 px-1">
        <Text className="text-muted" style={{ fontSize: 9 }}>← MHz</Text>
        <Text className="text-muted" style={{ fontSize: 9, textAlign: 'center' }}>MHz</Text>
        <Text className="text-muted" style={{ fontSize: 9 }}>kHz →</Text>
      </View>

      {/* Set button */}
      <TouchableOpacity
        onPress={() => tuned && onConfirmed(display)}
        disabled={!tuned}
        className="rounded-xl py-2 items-center"
        style={{ backgroundColor: tuned ? '#5BE3A1' : '#0F1A35' }}
      >
        <Text
          className="font-bold text-sm"
          style={{ color: tuned ? '#06080F' : '#2A3A5C' }}
        >
          {tuned ? 'SET ✓' : 'ADJUST FREQUENCY'}
        </Text>
      </TouchableOpacity>
    </View>
  )
}

function Knob({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className="rounded-lg items-center justify-center"
      style={{ width: 36, height: 36, backgroundColor: '#141C35', borderWidth: 1, borderColor: '#1C2548' }}
    >
      <Text style={{ color: '#6FE3FF', fontSize: 14, fontWeight: '700' }}>{label}</Text>
    </TouchableOpacity>
  )
}
