// src/components/RadioTuner.tsx
// COM-radio-style frequency tuner.
// Frequencies are represented internally as integer multiples of 25 kHz above 118.000 MHz
// to avoid floating-point drift.
//
// Layout:
//   ┌────────────────────────────┐
//   │  COM 1          ████████  │   ← 7-segment style freq display
//   │  [▲ MHz ▼]  [▲ kHz ▼]   │   ← coarse / fine knobs
//   │  ── Tune to TOWER 119.800 │   ← target label
//   │  [SET  ✓]                 │   ← enabled when matched
//   └────────────────────────────┘

import { useCallback, useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, Vibration, Platform } from 'react-native'

// ─── Internal helpers ─────────────────────────────────────────────────────────
const BASE_KHZ = 118_000   // 118.000 MHz in kHz
const MAX_KHZ  = 136_975   // 136.975 MHz in kHz
const STEP_KHZ = 25        // 25 kHz per step

function freqToSteps(freqStr: string): number {
  const mhz = parseFloat(freqStr)
  return Math.round((mhz * 1000 - BASE_KHZ) / STEP_KHZ)
}

function stepsToDisplay(steps: number): string {
  const khz = BASE_KHZ + steps * STEP_KHZ
  const mhz = khz / 1000
  // Always show 3 decimal places, e.g. "119.800", "121.900", "125.350"
  return mhz.toFixed(3)
}

function clampSteps(s: number): number {
  const maxSteps = (MAX_KHZ - BASE_KHZ) / STEP_KHZ
  return Math.max(0, Math.min(maxSteps, s))
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface RadioTunerProps {
  /** The frequency the student must dial in, e.g. "119.8" or "121.35" */
  targetFreq: string
  /** Human label shown below the display, e.g. "Tower" or "Ground" */
  targetLabel: string
  /** The frequency to start from (what they were last tuned to) */
  startFreq: string
  /** Called when the student confirms the correct frequency */
  onConfirmed: (freq: string) => void
}

// ─── Component ───────────────────────────────────────────────────────────────
export function RadioTuner({ targetFreq, targetLabel, startFreq, onConfirmed }: RadioTunerProps) {
  const targetSteps = freqToSteps(targetFreq)
  const [steps, setSteps] = useState(() => freqToSteps(startFreq))

  // Reset to startFreq whenever the tuner mounts for a new beat
  useEffect(() => {
    setSteps(freqToSteps(startFreq))
  }, [startFreq, targetFreq])

  const adjust = useCallback((delta: number) => {
    setSteps(s => clampSteps(s + delta))
    if (Platform.OS !== 'web') Vibration.vibrate(8)
  }, [])

  const tuned = steps === targetSteps
  const displayFreq = stepsToDisplay(steps)
  const targetDisplay = stepsToDisplay(targetSteps)

  return (
    <View
      className="rounded-2xl p-4 mx-5"
      style={{
        backgroundColor: '#0B1020',
        borderWidth: 1.5,
        borderColor: tuned ? '#5BE3A1' : '#1C2548',
      }}
    >
      {/* Header */}
      <View className="flex-row justify-between items-center mb-3">
        <Text className="text-muted text-xs font-bold uppercase tracking-widest">COM 1</Text>
        {tuned && (
          <View className="flex-row items-center gap-1">
            <View className="w-2 h-2 rounded-full bg-go" />
            <Text className="text-go text-xs font-bold">TUNED</Text>
          </View>
        )}
      </View>

      {/* Frequency display */}
      <View
        className="rounded-xl items-center justify-center py-3 mb-4"
        style={{
          backgroundColor: '#050810',
          borderWidth: 1,
          borderColor: tuned ? '#5BE3A1' : '#0F1A35',
        }}
      >
        <Text
          style={{
            fontFamily: 'Courier',
            fontSize: 36,
            fontWeight: '700',
            letterSpacing: 2,
            color: tuned ? '#5BE3A1' : '#6FE3FF',
          }}
        >
          {displayFreq}
        </Text>
        <Text className="text-muted text-xs mt-1">MHz</Text>
      </View>

      {/* Knob row */}
      <View className="flex-row gap-3 mb-4">
        {/* Coarse — 1 MHz steps */}
        <View className="flex-1 items-center gap-2">
          <Text className="text-muted text-xs uppercase tracking-widest">MHz</Text>
          <View className="flex-row gap-2">
            <KnobButton label="▲" onPress={() => adjust(Math.round(1000 / STEP_KHZ))} />
            <KnobButton label="▼" onPress={() => adjust(-Math.round(1000 / STEP_KHZ))} />
          </View>
        </View>

        {/* Divider */}
        <View className="w-px bg-line self-stretch" />

        {/* Fine — 25 kHz steps */}
        <View className="flex-1 items-center gap-2">
          <Text className="text-muted text-xs uppercase tracking-widest">kHz</Text>
          <View className="flex-row gap-2">
            <KnobButton label="▲" onPress={() => adjust(1)} />
            <KnobButton label="▼" onPress={() => adjust(-1)} />
          </View>
        </View>
      </View>

      {/* Target label */}
      <View className="flex-row items-center gap-2 mb-4">
        <View className="w-3 h-px bg-line flex-1" />
        <Text className="text-dim text-xs text-center">
          Tune to {targetLabel.toUpperCase()} · {targetDisplay}
        </Text>
        <View className="w-3 h-px bg-line flex-1" />
      </View>

      {/* Confirm button */}
      <TouchableOpacity
        onPress={() => tuned && onConfirmed(displayFreq)}
        disabled={!tuned}
        className="rounded-xl py-3 items-center"
        style={{
          backgroundColor: tuned ? '#5BE3A1' : '#0F1A35',
          borderWidth: 1,
          borderColor: tuned ? '#5BE3A1' : '#1C2548',
        }}
      >
        <Text
          className="font-bold text-sm"
          style={{ color: tuned ? '#06080F' : '#2A3A5C' }}
        >
          {tuned ? 'SET FREQUENCY ✓' : 'ADJUST FREQUENCY'}
        </Text>
      </TouchableOpacity>
    </View>
  )
}

// ─── Sub-component ────────────────────────────────────────────────────────────
function KnobButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className="rounded-lg items-center justify-center"
      style={{
        width: 44,
        height: 44,
        backgroundColor: '#141C35',
        borderWidth: 1,
        borderColor: '#1C2548',
      }}
    >
      <Text style={{ color: '#6FE3FF', fontSize: 16, fontWeight: '700' }}>{label}</Text>
    </TouchableOpacity>
  )
}
