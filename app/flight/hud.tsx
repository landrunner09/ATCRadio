import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { View, Text, TouchableOpacity, Platform } from 'react-native'
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
import { CueCard } from '@/components/hud/CueCard'
import { ScaffoldPanel } from '@/components/hud/ScaffoldPanel'
import { PTTBar } from '@/components/hud/PTTBar'
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

  const { startRun, endRun, addAttempt, setSessionNewBadges } = useFlightStore()
  const { mode, selectedBeatIds } = useDrillStore()
  const { user } = useAuthStore()
  const { selectedIcao, customPacks, arrivalPacks, selectedScenarioType } = useAirportStore()

  const { streak } = useStats(user?.id ?? null)
  const { checkAndAward } = useBadges(user?.id ?? null)

  // Pack and voice are derived from store state; declared after all hook calls.
  const FULL_PACK = selectedScenarioType === 'arrival'
    ? (arrivalPacks[selectedIcao] ?? getPack(selectedIcao, customPacks))
    : getPack(selectedIcao, customPacks)

  const voice = getVoiceForAirport(FULL_PACK.airport_icao)

  // PTT recording phase — separate concern from the scenario flow machine.
  // Resets to 'idle' on each PTT release; never reaches the XState machine.
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

  const { play: playTTS } = useTTSPlayer({
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

  const { startRecording, stopRecording } = useASRRecorder()
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

  // When machine enters atc_speaking sub-state, play TTS
  useEffect(() => {
    if (!state.matches({ tuning_or_speaking: 'atc_speaking' })) return
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

      {beat?.type === 'pilot_initiated'
        && (state.matches({ tuning_or_speaking: 'awaiting_response' }) || state.matches({ tuning_or_speaking: 'atc_speaking' }))
        && (
        <CueCard
          beat={beat}
          pack={FULL_PACK}
          scenarioContext={ctx.scenarioContext}
          currentFreq={currentFreq}
          awaitingResponse={state.matches({ tuning_or_speaking: 'awaiting_response' })}
        />
      )}

      <View className="mx-5 mb-4">
        {state.value === 'scaffold' && beat && (
          <ScaffoldPanel
            beat={beat}
            pack={FULL_PACK}
            scenarioContext={ctx.scenarioContext}
            onPass={handleScaffoldPass}
          />
        )}

        {state.value === 'preflight' && (
          <TouchableOpacity
            className="bg-accent rounded-2xl py-4 items-center"
            onPress={() => send({ type: 'CONFIRM' })}
          >
            <Text className="text-bg font-bold text-base">BEGIN SCENARIO →</Text>
          </TouchableOpacity>
        )}
      </View>

      <PTTBar
        enabled={isPTTEnabled}
        recording={recordingState === 'recording'}
        processing={recordingState === 'processing'}
        asrError={state.matches({ tuning_or_speaking: 'awaiting_response' }) ? asrError : null}
        onPressIn={handlePTTPress}
        onPressOut={handlePTTRelease}
        onSayAgain={handleSayAgain}
        onShowTiles={handleShowTiles}
        showSayAgain={state.matches({ tuning_or_speaking: 'awaiting_response' })}
        showTiles={state.matches({ tuning_or_speaking: 'awaiting_response' })}
      />
    </View>
  )
}
