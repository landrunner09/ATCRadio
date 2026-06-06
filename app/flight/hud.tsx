import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
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
import { useTTSPlayer, prefetchTTSBatch } from '@/audio/useTTSPlayer'
import { useASRRecorder } from '@/audio/useASRRecorder'
import { getVoiceForAirport } from '@/audio/audioConstants'
import { AirportDiagram } from '@/components/AirportDiagram'
import { StatusBar as HudStatusBar } from '@/components/hud/StatusBar'
import { TunerCard } from '@/components/hud/TunerCard'
import { PhasePips } from '@/components/hud/PhasePips'
import { SkillChip, type SkillChipStatus } from '@/components/hud/SkillChip'
import { ListenCard } from '@/components/hud/ListenCard'
import { ATCCard } from '@/components/hud/ATCCard'
import { useBadges } from '@/hooks/useBadges'
import { useStats } from '@/hooks/useStats'
import { createRadioAmbienceSession, type RadioAmbienceSession } from '@/audio/radioAmbience'

export default function HudScreen() {
  const router = useRouter()
  const [scenarioContext] = useState(() => {
    const { selectedIcao: icao, customPacks: cp, arrivalPacks: ap, selectedScenarioType: st } = useAirportStore.getState()
    const { tailNumber: tn } = useFlightStore.getState()
    const pack = st === 'arrival' ? (ap[icao] ?? getPack(icao, cp)) : getPack(icao, cp)
    return generateScenarioContext(pack, undefined, tn)
  })
  const [ttsError, setTtsError] = useState<string | null>(null)
  const [asrError, setAsrError] = useState<string | null>(null)

  const { startRun, endRun, addAttempt, tailNumber, setSessionNewBadges } = useFlightStore()
  const { mode, selectedBeatIds } = useDrillStore()
  const { user } = useAuthStore()
  const { selectedIcao, customPacks, arrivalPacks, selectedScenarioType } = useAirportStore()

  const { streak } = useStats(user?.id ?? null)
  const { checkAndAward } = useBadges(user?.id ?? null)

  // ── Derived values that depend on each other — declaration ORDER matters ──
  // All must come AFTER every hook call above to avoid TDZ crashes.
  const FULL_PACK = selectedScenarioType === 'arrival'
    ? (arrivalPacks[selectedIcao] ?? getPack(selectedIcao, customPacks))
    : getPack(selectedIcao, customPacks)

  const voice = getVoiceForAirport(FULL_PACK.airport_icao)

  // PTT recording/processing state — separate concern from the scenario flow machine
  const [recordingState, setRecordingState] = useState<'idle' | 'recording' | 'processing'>('idle')

  // Initialised to a "wrong" starting freq so ATIS requires the student to tune.
  const [currentFreq, setCurrentFreq] = useState(() =>
    (FULL_PACK as { atis_freq?: string }).atis_freq ?? '121.500'
  )
  const pack = mode === 'drill'
    ? { ...FULL_PACK, beats: FULL_PACK.beats.filter(b => selectedBeatIds.includes(b.id)) }
    : FULL_PACK

  const [state, send] = useMachine(scenarioMachine)

  const ctx = state.context
  const beat = ctx.pack ? ctx.pack.beats[ctx.beatIndex] ?? null : null
  const nextBeat = ctx.pack ? ctx.pack.beats[(ctx.beatIndex ?? 0) + 1] ?? null : null

  // Memoised per beatIndex — pickLine calls Math.random() so must NOT be recomputed
  // on every render, or the dependency in the atc_speaking effect fires TTS twice.
  const atcLine = useMemo(
    () => beat && ctx.pack && ctx.scenarioContext ? pickLine(beat, ctx.pack, ctx.scenarioContext) : '',
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ctx.beatIndex, !!ctx.pack, !!ctx.scenarioContext],
  )
  const nextAtcLine = useMemo(
    () => nextBeat && ctx.pack && ctx.scenarioContext ? pickLine(nextBeat, ctx.pack, ctx.scenarioContext) : '',
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ctx.beatIndex, !!ctx.pack, !!ctx.scenarioContext],
  )

  const { play: playTTS, replay: replayTTS, prefetch: prefetchTTS } = useTTSPlayer({
    text: atcLine,
    voiceName: voice.name,
    instructions: voice.instructions,
    onEnd: useCallback(() => {
      send({ type: 'ATC_DONE' })
    }, [send]),
  })

  // Warm the TTS cache for the next beat while the user is in awaiting_response
  const { prefetch: prefetchNextTTS } = useTTSPlayer({
    text: nextAtcLine,
    voiceName: voice.name,
    instructions: voice.instructions,
    onEnd: useCallback(() => {}, []),
  })

  const { isRecording, startRecording, stopRecording } = useASRRecorder()
  const pttHandlingRef = useRef(false)
  const debriefFiredRef = useRef(false)
  const ambienceRef = useRef<RadioAmbienceSession | null>(null)

  // Prefetch TTS for every ATC beat in the scenario upfront (best-effort, silent on failure).
  // Fires all requests concurrently so Supabase Storage is warm before the user reaches each beat.
  useEffect(() => {
    const beats = pack.beats
      .filter(b => b.type !== 'pilot_initiated')
      .map(b => ({
        text: pickLine(b, pack, scenarioContext),
        voiceName: voice.name,
        instructions: voice.instructions,
      }))
      .filter(b => b.text.trim())
    prefetchTTSBatch(beats)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  // Resolve tune_to template for the current beat (e.g. "{tower_freq}" → "119.8")
  const pack_ground = (FULL_PACK as { ground_freq?: string }).ground_freq ?? ''

  const resolveTuneTo = useCallback((template: string): string => {
    return template
      .replace(/{tower_freq}/g, FULL_PACK.tower_freq ?? '')
      .replace(/{approach_freq}/g, FULL_PACK.approach_freq ?? '')
      .replace(/{ground_freq}/g, pack_ground)
      .replace(/{atis_freq}/g, FULL_PACK.atis_freq ?? '')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [FULL_PACK.tower_freq, FULL_PACK.approach_freq, FULL_PACK.atis_freq, pack_ground])

  // Prefetch next beat's TTS while the user is responding (hides API latency)
  useEffect(() => {
    if (!state.matches({ tuning_or_speaking: 'awaiting_response' }) || !nextAtcLine) return
    prefetchNextTTS()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.value, nextAtcLine])

  // listen_only beats (ATIS): auto-advance after student manually triggers playback
  // Machine enters awaiting_response → we immediately advance (no grading needed)
  useEffect(() => {
    if (!state.matches({ tuning_or_speaking: 'awaiting_response' }) || !beat?.listen_only) return
    send({ type: 'RESPOND', transcript: '__listen_only__', confidence: 1 })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.value, ctx.beatIndex])

  // When machine enters atc_speaking sub-state, play TTS
  useEffect(() => {
    if (!state.matches({ tuning_or_speaking: 'atc_speaking' })) return
    // pilot_initiated beats have no ATC audio — skip directly to advance via ATC_DONE
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.value, atcLine])

  // Start radio static during student response window; stop when ATC speaks or recording
  useEffect(() => {
    const s = ambienceRef.current
    if (!s) return
    if (state.matches({ tuning_or_speaking: 'awaiting_response' })) {
      s.start()
    } else {
      s.stop()
    }
  }, [state.value])

  const handlePTTPress = useCallback(async () => {
    if (pttHandlingRef.current) return
    pttHandlingRef.current = true
    setAsrError(null)
    setRecordingState('recording')
    await startRecording()
  }, [startRecording])

  const handlePTTRelease = useCallback(async () => {
    setRecordingState('processing')
    const result = await stopRecording()
    setRecordingState('idle')
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

  const isPTTEnabled = state.matches({ tuning_or_speaking: 'awaiting_response' }) && recordingState === 'idle'
  const isAtcSpeaking = state.matches({ tuning_or_speaking: 'atc_speaking' })

  const speakerLabel = beat
    ? beat.speaker === 'approach'
      ? (ctx.scenarioContext?.approach_facility ?? 'Approach')
      : beat.speaker === 'ground'
        ? `${pack.airport_icao} Ground`
        : `${pack.airport_icao} Tower`
    : ''
  const freqLabel = beat
    ? beat.speaker === 'approach' ? FULL_PACK.approach_freq
      : beat.speaker === 'ground' ? ((FULL_PACK as { ground_freq?: string }).ground_freq ?? '')
      : FULL_PACK.tower_freq
    : ''

  const chipStatus: SkillChipStatus =
    beat?.listen_only && state.matches({ tuning_or_speaking: 'tuning' }) ? 'tune_atis'
    : beat?.listen_only && state.matches({ tuning_or_speaking: 'awaiting_listen' }) ? 'tap_listen'
    : beat?.listen_only ? 'listening'
    : state.matches({ tuning_or_speaking: 'tuning' }) ? 'tune_radio'
    : beat?.type === 'pilot_initiated' ? 'pilot_call'
    : state.matches({ tuning_or_speaking: 'atc_speaking' }) ? 'atc_speaking'
    : 'grading'

  return (
    <View className="flex-1 bg-bg">
      <HudStatusBar
        callsign={ctx.scenarioContext?.callsign ?? ''}
        airportIcao={pack.airport_icao}
        drillMode={mode === 'drill'}
        currentFreq={currentFreq}
        wind={ctx.scenarioContext?.weather.wind ?? ''}
      />

      <PhasePips
        beatCount={pack.beats.length}
        currentIndex={phaseIndex}
        phaseLabel={beat?.phase ?? ''}
      />

      {beat && state.value !== 'preflight' && (
        <SkillChip beat={beat} status={chipStatus} />
      )}

      {/* Airport diagram */}
      <View className="mx-5 mb-3 h-32 bg-surface2 rounded-2xl border border-line overflow-hidden">
        <AirportDiagram pack={pack} beatId={beat?.id} />
      </View>

      {beat
        && beat.type !== 'pilot_initiated'
        && state.matches({ tuning_or_speaking: 'atc_speaking' }) && (
        <ATCCard
          beat={beat}
          atcLine={atcLine}
          speakerLabel={speakerLabel}
          freqLabel={freqLabel}
          isSpeaking={state.matches({ tuning_or_speaking: 'atc_speaking' })}
          ttsError={ttsError}
        />
      )}


      {state.matches({ tuning_or_speaking: 'tuning' }) && beat?.tune_to && (
        <TunerCard
          targetFreq={resolveTuneTo(beat.tune_to)}
          targetLabel={beat.tune_label ?? ''}
          startFreq={currentFreq}
          onConfirmed={(freq) => {
            setCurrentFreq(freq)
            send({ type: 'TUNED' })
          }}
        />
      )}

      {state.matches({ tuning_or_speaking: 'awaiting_listen' }) && (
        <ListenCard onTap={() => send({ type: 'LISTEN_TAPPED' })} />
      )}

      {/* Cue card — for pilot_initiated beats (shown during awaiting_response and atc_speaking) */}
      {beat?.type === 'pilot_initiated'
        && (state.matches({ tuning_or_speaking: 'awaiting_response' }) || state.matches({ tuning_or_speaking: 'atc_speaking' })) && (
        <View
          className="mx-5 mb-3 rounded-2xl p-4"
          style={{
            borderWidth: 1,
            borderColor: state.matches({ tuning_or_speaking: 'awaiting_response' }) ? '#6FE3FF' : '#1C2548',
            backgroundColor: 'rgba(111,227,255,0.06)',
          }}
        >
          {/* Show the tuned frequency */}
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
          <Text style={{ color: '#e7ecf5' }} className="text-sm leading-relaxed">
            {beat.cue_text
              ? beat.cue_text
                  .replace(/{approach_facility}/g, ctx.scenarioContext?.approach_facility ?? 'Approach')
                  .replace(/{airport_icao}/g, pack.airport_icao)
                  .replace(/{airport_name}/g, FULL_PACK.airport_name)
                  .replace(/{callsign}/g, ctx.scenarioContext?.callsign ?? '')
                  .replace(/{runway}/g, ctx.scenarioContext?.runway_in_use ?? '')
                  .replace(/{taxiway}/g, ctx.scenarioContext?.departure_taxiway ?? '')
                  .replace(/{atis_letter}/g, ctx.scenarioContext?.atis_letter ?? '')
                  .replace(/{tower_freq}/g, FULL_PACK.tower_freq)
                  .replace(/{approach_freq}/g, FULL_PACK.approach_freq)
                  .replace(/{ground_freq}/g, (FULL_PACK as { ground_freq?: string }).ground_freq ?? '')
                  .replace(/{squawk_code}/g, ctx.scenarioContext?.squawk_code ?? '')
                  .replace(/{weather\.altimeter}/g, ctx.scenarioContext?.weather.altimeter ?? '')
                  .replace(/{weather\.wind}/g, ctx.scenarioContext?.weather.wind ?? '')
              : 'Make your radio call.'}
          </Text>
          {state.matches({ tuning_or_speaking: 'awaiting_response' }) && (
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

        {asrError && state.matches({ tuning_or_speaking: 'awaiting_response' }) && (
          <Text className="text-danger text-xs text-center mb-2">⚠ {asrError}</Text>
        )}
      </View>

      {/* PTT Controls */}
      {state.matches({ tuning_or_speaking: 'awaiting_response' }) && (
        <View className="flex-row px-5 gap-3 items-center justify-center">
          <TouchableOpacity
            className="flex-1 bg-surface2 rounded-2xl py-4 items-center border border-line"
            onPress={handleSayAgain}
            disabled={recordingState !== 'idle'}
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
              backgroundColor: recordingState === 'recording'
                ? '#FF5C5C'
                : recordingState === 'processing'
                ? '#FFB85C'
                : isPTTEnabled ? '#5BE3A1' : '#1C2548',
              borderColor: recordingState === 'recording'
                ? 'rgba(255,92,92,0.4)'
                : recordingState === 'processing'
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
              {recordingState === 'recording' ? 'LISTENING\n…' : recordingState === 'processing' ? 'PROC\n…' : 'HOLD\nTALK'}
            </Text>
          </Pressable>

          <TouchableOpacity
            className="flex-1 bg-surface2 rounded-2xl py-4 items-center border border-line"
            onPress={handleShowTiles}
            disabled={recordingState !== 'idle'}
          >
            <Text className="text-warm text-xs font-bold">▦ TILES</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  )
}
