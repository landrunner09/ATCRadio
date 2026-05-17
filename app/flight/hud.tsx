import { useState, useCallback, useEffect, useRef } from 'react'
import { View, Text, TouchableOpacity, Pressable, Platform } from 'react-native'
import { useRouter } from 'expo-router'
import { useMachine } from '@xstate/react'
import { scenarioMachine } from '@/engine/machine'
import { generateScenarioContext } from '@/engine/context'
import { pickLine } from '@/engine/loader'
import { useFlightStore } from '@/store/flightStore'
import { useDrillStore } from '@/store/drillStore'
import { useAuthStore } from '@/store/authStore'
import { useAirportStore } from '@/store/airportStore'
import { getPack } from '@/engine/packRegistry'
import { useTTSPlayer } from '@/audio/useTTSPlayer'
import { useASRRecorder } from '@/audio/useASRRecorder'
import { VOICES, DEFAULT_ACCENT } from '@/audio/audioConstants'
import { AirportDiagram } from '@/components/AirportDiagram'
import { useBadges } from '@/hooks/useBadges'
import { useStats } from '@/hooks/useStats'
import { createRadioAmbienceSession, type RadioAmbienceSession } from '@/audio/radioAmbience'

type LocalState = 'idle' | 'recording' | 'processing'

export default function HudScreen() {
  const router = useRouter()
  const [scenarioContext] = useState(() => {
    const { selectedIcao: icao, customPacks: cp, arrivalPacks: ap, selectedScenarioType: st } = useAirportStore.getState()
    const { tailNumber: tn } = useFlightStore.getState()
    const pack = st === 'arrival' ? (ap[icao] ?? getPack(icao, cp)) : getPack(icao, cp)
    return generateScenarioContext(pack, undefined, tn)
  })
  const [localState, setLocalState] = useState<LocalState>('idle')
  const [ttsError, setTtsError] = useState<string | null>(null)
  const [asrError, setAsrError] = useState<string | null>(null)

  const { startRun, endRun, addAttempt, selectedAccent, tailNumber, setSessionNewBadges } = useFlightStore()
  const { mode, selectedBeatIds } = useDrillStore()
  const { user } = useAuthStore()
  const { selectedIcao, customPacks, arrivalPacks, selectedScenarioType } = useAirportStore()

  const { streak } = useStats(user?.id ?? null)
  const { checkAndAward } = useBadges(user?.id ?? null)

  const accent = selectedAccent ?? DEFAULT_ACCENT
  const voice = VOICES[accent] ?? VOICES[DEFAULT_ACCENT]

  const FULL_PACK = selectedScenarioType === 'arrival'
    ? (arrivalPacks[selectedIcao] ?? getPack(selectedIcao, customPacks))
    : getPack(selectedIcao, customPacks)
  const pack = mode === 'drill'
    ? { ...FULL_PACK, beats: FULL_PACK.beats.filter(b => selectedBeatIds.includes(b.id)) }
    : FULL_PACK

  const [state, send] = useMachine(scenarioMachine)

  const ctx = state.context
  const beat = ctx.pack ? ctx.pack.beats[ctx.beatIndex] ?? null : null
  const atcLine = beat && ctx.pack && ctx.scenarioContext
    ? pickLine(beat, ctx.pack, ctx.scenarioContext)
    : ''

  // Next beat's ATC line — prefetched while the user is responding
  const nextBeat = ctx.pack ? ctx.pack.beats[(ctx.beatIndex ?? 0) + 1] ?? null : null
  const nextAtcLine = nextBeat && ctx.pack && ctx.scenarioContext
    ? pickLine(nextBeat, ctx.pack, ctx.scenarioContext)
    : ''

  const { play: playTTS, replay: replayTTS, prefetch: prefetchTTS } = useTTSPlayer({
    text: atcLine,
    voiceName: voice.name,
    languageCode: voice.languageCode,
    onEnd: useCallback(() => {
      send({ type: 'ATC_DONE' })
    }, [send]),
  })

  // Warm the TTS cache for the next beat while the user is in awaiting_response
  const { prefetch: prefetchNextTTS } = useTTSPlayer({
    text: nextAtcLine,
    voiceName: voice.name,
    languageCode: voice.languageCode,
    onEnd: useCallback(() => {}, []),
  })

  const { isRecording, startRecording, stopRecording } = useASRRecorder()
  const pttHandlingRef = useRef(false)
  const debriefFiredRef = useRef(false)
  const ambienceRef = useRef<RadioAmbienceSession | null>(null)

  // Stay in preflight until user taps BEGIN — required for browser autoplay policy
  useEffect(() => {
    startRun(pack, scenarioContext, user?.id ?? null)
    send({ type: 'START', pack, scenarioContext })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Create radio ambience session on mount (web only) — destroyed on unmount
  useEffect(() => {
    if (Platform.OS !== 'web') return
    const session = createRadioAmbienceSession()
    ambienceRef.current = session
    return () => {
      session.cleanup()
      ambienceRef.current = null
    }
  }, [])

  // Prefetch next beat's TTS while the user is responding (hides API latency)
  useEffect(() => {
    if (state.value !== 'awaiting_response' || !nextAtcLine) return
    prefetchNextTTS()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.value, nextAtcLine])

  // When machine enters atc_speaking, play TTS
  useEffect(() => {
    if (state.value !== 'atc_speaking') return
    // pilot_initiated beats have no ATC audio — skip straight to awaiting_response
    if (beat?.type === 'pilot_initiated') {
      send({ type: 'ATC_DONE' })
      return
    }
    setTtsError(null)
    playTTS().catch((err) => {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[TTS] playback failed:', msg)
      setTtsError(msg)
      send({ type: 'ATC_DONE' })
    })
    // Re-fires whenever beat changes (atcLine changes with beatIndex)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.value, atcLine])

  // Start radio static during student response window; stop when ATC speaks or recording
  useEffect(() => {
    const s = ambienceRef.current
    if (!s) return
    if (state.value === 'awaiting_response') {
      s.start()
    } else {
      s.stop()
    }
  }, [state.value])

  const handlePTTPress = useCallback(async () => {
    if (pttHandlingRef.current) return
    pttHandlingRef.current = true
    setAsrError(null)
    setLocalState('recording')
    await startRecording()
  }, [startRecording])

  const handlePTTRelease = useCallback(async () => {
    setLocalState('processing')
    const result = await stopRecording()
    setLocalState('idle')
    pttHandlingRef.current = false

    if (!result.transcript) {
      setAsrError(result.errorReason ?? 'empty transcript')
      return
    }

    send({ type: 'RESPOND', transcript: result.transcript, confidence: result.confidence })
  }, [stopRecording, send])

  const handleSayAgain = useCallback(() => {
    send({ type: 'SAY_AGAIN' })
    // TTS replay is driven by the atc_speaking useEffect below — no explicit call needed
  }, [send])

  const handleShowTiles = useCallback(() => {
    send({ type: 'SHOW_TILES' })
  }, [send])

  const handleScaffoldPass = useCallback(() => {
    send({ type: 'SCAFFOLD_PASS' })
  }, [send])

  // When machine reaches debrief, sync attempts to store then navigate
  useEffect(() => {
    if (state.value === 'debrief' && !debriefFiredRef.current) {
      debriefFiredRef.current = true
      state.context.attempts.forEach(a => addAttempt(a))
      endRun().then(async () => {
        const awarded = await checkAndAward({ attempts: state.context.attempts, streak })
        setSessionNewBadges(awarded)
        router.replace('/flight/debrief')
      }).catch((err: unknown) => {
        console.error('[HUD] debrief error:', err)
        router.replace('/flight/debrief')
      })
    }
  }, [state.value, endRun, addAttempt, router, checkAndAward, streak, setSessionNewBadges])

  const phaseIndex = beat ? pack.beats.findIndex(b => b.id === beat.id) : 0

  const isPTTEnabled = state.value === 'awaiting_response' && localState === 'idle'
  const isAtcSpeaking = state.value === 'atc_speaking'

  return (
    <View className="flex-1 bg-bg">
      {/* Status bar */}
      <View className="flex-row justify-between px-5 pt-14 pb-2 border-b border-line">
        <Text className="text-dim text-xs font-mono uppercase tracking-widest">
          {ctx.scenarioContext?.callsign ?? '—'} · {pack.airport_icao} {mode === 'drill' ? '· DRILL' : ''}
        </Text>
        <Text className="text-dim text-xs font-mono">
          {FULL_PACK.controlled === false
            ? `CTAF ${FULL_PACK.ctaf_freq ?? '122.8'}`
            : `TWR ${FULL_PACK.tower_freq}`} · {ctx.scenarioContext?.weather.wind ?? '—'}
        </Text>
      </View>

      {/* Phase pips */}
      <View className="flex-row items-center px-5 py-3 gap-3">
        <View className="flex-1 flex-row gap-1">
          {pack.beats.map((_, i) => (
            <View
              key={i}
              className={`flex-1 h-1.5 rounded-full ${
                i < phaseIndex ? 'bg-go' : i === phaseIndex ? 'bg-accent' : 'bg-line'
              }`}
            />
          ))}
        </View>
        <Text className="text-dim text-xs font-bold uppercase tracking-wider">
          {String(phaseIndex + 1).padStart(2, '0')} · {beat?.phase ?? '—'}
        </Text>
      </View>

      {/* Skill chip */}
      {beat && (
        <View className="mx-5 mb-3 px-3 py-2 bg-surface2 rounded-xl border border-line flex-row justify-between items-center">
          <Text className="text-muted text-xs uppercase tracking-widest">Now grading</Text>
          <Text className="text-accent text-xs font-semibold">{beat.skill_tag.replace(/_/g, ' ').toUpperCase()}</Text>
        </View>
      )}

      {/* Airport diagram */}
      <View className="mx-5 mb-3 h-32 bg-surface2 rounded-2xl border border-line overflow-hidden">
        <AirportDiagram pack={pack} beatId={beat?.id} />
      </View>

      {/* ATC card — for readback beats */}
      {state.value !== 'preflight' && state.value !== 'idle' && beat && beat.type !== 'pilot_initiated' && (
        <View className="mx-5 mb-3 bg-surface2 rounded-2xl border border-line p-4">
          <View className="flex-row justify-between items-center mb-2">
            <View className="flex-row items-center gap-2">
              {isAtcSpeaking && <View className="w-2 h-2 rounded-full bg-warm" />}
              <Text className="text-warm text-xs font-bold uppercase tracking-widest">
                {beat.speaker === 'approach'
                  ? (beat.voice_role === 'norcal_approach' ? 'NorCal Approach' : 'Approach')
                  : `${pack.airport_icao} Tower`}
              </Text>
              {isAtcSpeaking && <Text className="text-dim text-xs">speaking…</Text>}
            </View>
            <Text className="text-muted text-xs font-mono">
              {beat.speaker === 'approach' ? FULL_PACK.approach_freq : FULL_PACK.tower_freq}
            </Text>
          </View>
          {ttsError && (
            <Text className="text-danger text-xs mb-1">⚠ {ttsError}</Text>
          )}
          <Text style={{ color: '#e7ecf5' }} className="text-sm font-mono leading-relaxed">{atcLine}</Text>
        </View>
      )}

      {/* Cue card — for pilot_initiated beats */}
      {state.value !== 'preflight' && state.value !== 'idle' && beat?.type === 'pilot_initiated' && (
        <View
          className="mx-5 mb-3 rounded-2xl p-4"
          style={{
            borderWidth: 1,
            borderColor: state.value === 'awaiting_response' ? '#6FE3FF' : '#1C2548',
            backgroundColor: 'rgba(111,227,255,0.06)',
          }}
        >
          <Text className="text-accent text-xs font-bold uppercase tracking-widest mb-2">
            🎙 YOUR TRANSMISSION
          </Text>
          <Text style={{ color: '#e7ecf5' }} className="text-sm leading-relaxed">
            {beat.cue_text
              ? beat.cue_text
                  .replace(/{approach_facility}/g, ctx.scenarioContext?.approach_facility ?? 'Approach')
                  .replace(/{airport_icao}/g, pack.airport_icao)
                  .replace(/{weather\.altimeter}/g, ctx.scenarioContext?.weather.altimeter ?? '')
              : 'Make your radio call.'}
          </Text>
          {state.value === 'awaiting_response' && (
            <Text className="text-dim text-xs mt-2">Hold the mic button and transmit ↓</Text>
          )}
        </View>
      )}

      {/* Student response area */}
      <View className="mx-5 mb-4">
        {state.value === 'scaffold' && beat && (
          <View className="bg-surface2 rounded-2xl p-4" style={{ borderWidth: 1, borderColor: '#FFB85C' }}>
            <Text className="text-warm text-xs font-bold uppercase tracking-widest mb-3">▦ Scaffold mode</Text>
            {beat.expected_student_response.required_slots.map(slot => (
              <View key={slot.slot} className="flex-row items-center gap-2 mb-2">
                <View className={`w-2 h-2 rounded-full ${slot.criticality === 'critical' ? 'bg-danger' : 'bg-dim'}`} />
                <Text className="text-dim text-xs uppercase tracking-widest">{slot.slot}:</Text>
                <Text style={{ color: '#e7ecf5' }} className="text-xs font-mono">
                  {slot.value
                    .replace('{runway}', ctx.scenarioContext?.runway_in_use ?? '31')
                    .replace('{callsign}', ctx.scenarioContext?.callsign ?? 'N12345')
                    .replace('{taxiway}', ctx.scenarioContext?.departure_taxiway ?? 'alpha')
                    .replace('{atis_letter}', ctx.scenarioContext?.atis_letter ?? 'Bravo')
                    .replace('{altimeter}', ctx.scenarioContext?.weather.altimeter ?? '29.92')
                    .replace('{approach_freq}', FULL_PACK.approach_freq)
                    .replace('{tower_freq}', FULL_PACK.tower_freq)
                    .replace('{squawk_code}', ctx.scenarioContext?.squawk_code ?? '4523')
                    .replace('{approach_facility}', ctx.scenarioContext?.approach_facility ?? 'Approach')
                    .replace('{airport_name}', FULL_PACK.airport_name)
                  }
                </Text>
              </View>
            ))}
            <TouchableOpacity
              className="bg-warm rounded-xl py-3 mt-3 items-center"
              onPress={handleScaffoldPass}
            >
              <Text className="text-bg font-bold text-sm">I'VE GOT IT →</Text>
            </TouchableOpacity>
          </View>
        )}

        {state.value === 'preflight' && (
          <TouchableOpacity
            className="bg-accent rounded-2xl py-4 items-center"
            onPress={() => send({ type: 'CONFIRM' })}
          >
            <Text className="text-bg font-bold text-base">BEGIN SCENARIO →</Text>
          </TouchableOpacity>
        )}

        {asrError && state.value === 'awaiting_response' && (
          <Text className="text-danger text-xs text-center mb-2">⚠ {asrError}</Text>
        )}
      </View>

      {/* PTT Controls */}
      {state.value === 'awaiting_response' && (
        <View className="flex-row px-5 gap-3 items-center justify-center">
          <TouchableOpacity
            className="flex-1 bg-surface2 rounded-2xl py-4 items-center border border-line"
            onPress={handleSayAgain}
            disabled={localState !== 'idle'}
          >
            <Text className="text-accent text-xs font-bold">⟲ SAY AGAIN</Text>
          </TouchableOpacity>

          <Pressable
            onPressIn={handlePTTPress}
            onPressOut={handlePTTRelease}
            disabled={!isPTTEnabled}
            style={({ pressed }) => ({
              width: 80,
              height: 80,
              borderRadius: 40,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 4,
              backgroundColor: localState === 'recording'
                ? '#FF5C5C'
                : localState === 'processing'
                ? '#FFB85C'
                : isPTTEnabled ? '#5BE3A1' : '#1C2548',
              borderColor: localState === 'recording'
                ? 'rgba(255,92,92,0.4)'
                : localState === 'processing'
                ? 'rgba(255,184,92,0.4)'
                : isPTTEnabled ? 'rgba(91,227,161,0.4)' : '#1C2548',
            })}
          >
            <Text style={{
              color: '#0B0F1E',
              fontWeight: '800',
              fontSize: 10,
              textAlign: 'center',
            }}>
              {localState === 'recording' ? 'LISTENING\n…' : localState === 'processing' ? 'PROC\n…' : 'HOLD\nTALK'}
            </Text>
          </Pressable>

          <TouchableOpacity
            className="flex-1 bg-surface2 rounded-2xl py-4 items-center border border-line"
            onPress={handleShowTiles}
            disabled={localState !== 'idle'}
          >
            <Text className="text-warm text-xs font-bold">▦ TILES</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  )
}
