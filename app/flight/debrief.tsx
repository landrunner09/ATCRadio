// app/flight/debrief.tsx
import { useState } from 'react'
import { View, Text, ScrollView, TouchableOpacity } from 'react-native'
import { useRouter } from 'expo-router'
import { useCoaching, type CoachingResult } from '@/hooks/useCoaching'
import { useFlightStore } from '@/store/flightStore'
import { useAuthStore } from '@/store/authStore'
import { useStats } from '@/hooks/useStats'
import { useDrillStore } from '@/store/drillStore'
import { useAirportStore } from '@/store/airportStore'
import { getPack } from '@/engine/packRegistry'
import { computeMasteryDelta, findWeakestSkill } from '@/lib/masteryDelta'
import { badgeDef } from '@/lib/badges'

const SKILL_LABELS: Record<string, string> = {
  atis_extraction: 'ATIS EXTRACTION', taxi_request: 'TAXI REQUEST',
  taxi_readback: 'TAXI READBACK', runup_ready: 'RUNUP READY',
  takeoff_readback: 'TAKEOFF READBACK', freq_change_readback: 'FREQ CHANGE',
  position_report_norcal: 'POSITION REPORT', position_report_approach: 'POSITION REPORT', inbound_call: 'INBOUND CALL',
  pattern_entry_readback: 'PATTERN ENTRY', landing_readback: 'LANDING READBACK',
  taxi_to_parking_readback: 'TAXI TO PARKING', say_again_handling: 'SAY AGAIN',
}

const RESULT_BORDER: Record<string, string> = {
  pass: '#5BE3A1', partial: '#FFB85C', fail: '#FF6B7A', scaffold: '#6FE3FF',
}
const RESULT_COLOR: Record<string, string> = {
  pass: '#5BE3A1', partial: '#FFB85C', fail: '#FF6B7A', scaffold: '#6FE3FF',
}
const RESULT_LABEL: Record<string, string> = {
  pass: '✓ PASS', partial: '⚠ PARTIAL', fail: '✕ FAIL', scaffold: '▦ SCAFFOLD',
}

export default function DebriefScreen() {
  const router = useRouter()
  const { pack, attempts, getScore, getPassCount, getPartialCount, getScaffoldCount, masterySnapshot, sessionNewBadges } = useFlightStore()
  const { user } = useAuthStore()
  const { masteryBySkill } = useStats(user?.id ?? null)
  const { selectAll, setMode } = useDrillStore()
  const { selectedIcao, customPacks } = useAirportStore()
  const { loadCoaching, getCoaching } = useCoaching()
  const [expandedBeat, setExpandedBeat] = useState<string | null>(null)

  // Use the pack that was actually flown (from flightStore), falling back to current selection
  const flownPack = pack ?? getPack(selectedIcao, customPacks)

  const score = getScore()
  const passes = getPassCount()
  const partials = getPartialCount()
  const scaffolds = getScaffoldCount()

  const attemptedSkills = [...new Set(attempts.map(a => a.skillTag))]
  const masteryDeltas = computeMasteryDelta(masterySnapshot, masteryBySkill)
  const weakestSkill = findWeakestSkill(masteryBySkill, attemptedSkills)

  function getHeadline(): string {
    if (score >= 90) return 'Excellent flight — clean comms!'
    if (score >= 75) return 'Good flight — a few corrections needed'
    if (score >= 60) return 'Decent run — keep drilling weak spots'
    return 'Rough flight — review the beats below'
  }

  function handleDrillWeakness() {
    if (!weakestSkill) return
    const beatIds = flownPack.beats.filter(b => b.skill_tag === weakestSkill).map(b => b.id)
    setMode('drill')
    selectAll(beatIds)
    router.replace('/(tabs)/drill')
  }

  return (
    <ScrollView className="flex-1 bg-bg" contentContainerStyle={{ padding: 20, paddingTop: 60, paddingBottom: 40 }}>
      {/* Score ring */}
      <View className="items-center mb-6">
        <View
          className="w-36 h-36 rounded-full items-center justify-center mb-3"
          style={{ borderWidth: 4, borderColor: score >= 75 ? '#5BE3A1' : '#FFB85C' }}
        >
          <Text className="text-4xl font-bold font-mono" style={{ color: score >= 75 ? '#5BE3A1' : '#FFB85C' }}>{score}</Text>
          <Text className="text-muted text-xs">SCORE</Text>
        </View>
        <Text style={{ color: '#e7ecf5' }} className="text-base font-semibold text-center">{getHeadline()}</Text>
        <Text className="text-dim text-xs mt-1">{pack?.airport_icao ?? 'KPAO'} · {attempts.length} beats attempted</Text>
      </View>

      {/* Mini stats */}
      <View className="flex-row gap-3 mb-4">
        {[
          { lbl: 'Passes', v: passes, color: '#5BE3A1' },
          { lbl: 'Partials', v: partials, color: '#FFB85C' },
          { lbl: 'Scaffold', v: scaffolds, color: '#6FE3FF' },
        ].map(s => (
          <View key={s.lbl} className="flex-1 bg-surface2 rounded-xl p-3 border border-line items-center">
            <Text className="text-muted text-xs uppercase tracking-widest">{s.lbl}</Text>
            <Text className="text-2xl font-bold font-mono mt-1" style={{ color: s.color }}>{s.v}</Text>
          </View>
        ))}
      </View>

      {/* Mastery delta */}
      {masteryDeltas.length > 0 && (
        <View className="bg-surface2 rounded-2xl border border-line p-4 mb-4">
          <Text className="text-dim text-xs font-bold uppercase tracking-widest mb-3">Mastery moved</Text>
          {masteryDeltas.map(d => (
            <View key={d.skillTag} className="flex-row justify-between items-center mb-2">
              <Text style={{ color: '#e7ecf5' }} className="text-xs font-mono">
                {SKILL_LABELS[d.skillTag] ?? d.skillTag}
              </Text>
              <Text
                className="text-xs font-bold font-mono"
                style={{ color: d.delta > 0 ? '#5BE3A1' : '#FF6B7A' }}
              >
                {d.delta > 0 ? '↑' : '↓'} {d.delta > 0 ? '+' : ''}{Math.round(d.delta * 100)}%
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Badges earned */}
      {sessionNewBadges.length > 0 && (
        <View className="bg-surface2 rounded-2xl border border-line p-4 mb-4">
          <Text className="text-dim text-xs font-bold uppercase tracking-widest mb-3">Badges Earned</Text>
          {sessionNewBadges.map(id => {
            const def = badgeDef(id)
            return (
              <View key={id} className="flex-row items-center gap-3 mb-2">
                <Text className="text-2xl">{def.emoji}</Text>
                <View>
                  <Text style={{ color: '#e7ecf5' }} className="text-sm font-semibold">{def.label}</Text>
                  <Text className="text-dim text-xs">{def.description}</Text>
                </View>
              </View>
            )
          })}
        </View>
      )}

      {/* Beat list */}
      <Text className="text-dim text-xs font-bold uppercase tracking-widest mb-3">Beat by Beat</Text>
      {attempts.map((attempt, i) => {
        const key = `${attempt.beatId}-${attempt.timestamp}`
        const isExpanded = expandedBeat === key
        const coaching = getCoaching(attempt)
        const canCoach = attempt.result !== 'pass'

        return (
          <View
            key={key}
            className="bg-surface2 rounded-xl mb-2"
            style={{ borderWidth: 1, borderColor: RESULT_BORDER[attempt.result] ?? '#1C2548' }}
          >
            <TouchableOpacity
              className="flex-row items-start gap-3 p-3"
              onPress={() => {
                const next = isExpanded ? null : key
                setExpandedBeat(next)
                if (next && canCoach && !coaching) loadCoaching(attempt)
              }}
              activeOpacity={canCoach ? 0.7 : 1}
            >
              <View
                className="w-8 h-8 rounded-full items-center justify-center"
                style={{ borderWidth: 1, borderColor: RESULT_BORDER[attempt.result] ?? '#1C2548' }}
              >
                <Text className="text-xs font-bold font-mono" style={{ color: RESULT_COLOR[attempt.result] ?? '#8A9BC4' }}>{i + 1}</Text>
              </View>
              <View className="flex-1">
                <Text style={{ color: '#e7ecf5' }} className="text-sm font-semibold">
                  {attempt.skillTag.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}
                </Text>
                <Text className="text-dim text-xs mt-0.5">{RESULT_LABEL[attempt.result] ?? attempt.result}</Text>
                {attempt.gradeResult && attempt.gradeResult.missingCritical.length > 0 && (
                  <Text className="text-xs mt-1" style={{ color: '#FF6B7A' }}>
                    Missing: {attempt.gradeResult.missingCritical.join(', ')}
                  </Text>
                )}
              </View>
              {canCoach && (
                <Text className="text-dim text-xs">{isExpanded ? '▲' : '▼'}</Text>
              )}
            </TouchableOpacity>

            {isExpanded && canCoach && (
              <View className="px-3 pb-3 pt-1" style={{ borderTopWidth: 1, borderTopColor: '#1C2548' }}>
                {coaching === 'loading' && (
                  <Text className="text-dim text-xs">Loading coaching…</Text>
                )}
                {coaching === 'error' && (
                  <Text style={{ color: '#FF6B7A' }} className="text-xs">Coaching unavailable</Text>
                )}
                {coaching && coaching !== 'loading' && coaching !== 'error' && (
                  <View>
                    <Text style={{ color: '#C4B5FD' }} className="text-xs font-bold uppercase tracking-widest mb-1">▸ AI Coaching</Text>
                    <Text style={{ color: '#e7ecf5' }} className="text-xs mb-2">{(coaching as CoachingResult).explanation}</Text>
                    {(coaching as CoachingResult).aimCitation ? (
                      <Text className="text-dim text-xs mb-2 font-mono">{(coaching as CoachingResult).aimCitation}</Text>
                    ) : null}
                    {(coaching as CoachingResult).tip ? (
                      <View className="bg-bg rounded-lg p-2 mt-1">
                        <Text style={{ color: '#C4B5FD' }} className="text-xs">💡 {(coaching as CoachingResult).tip}</Text>
                      </View>
                    ) : null}
                  </View>
                )}
              </View>
            )}
          </View>
        )
      })}

      {attempts.length === 0 && (
        <Text className="text-dim text-sm text-center py-6">No attempts recorded.</Text>
      )}

      {/* CTAs */}
      <View className="gap-3 mt-6">
        {weakestSkill ? (
          <TouchableOpacity
            className="bg-warm rounded-2xl py-4 items-center"
            onPress={handleDrillWeakness}
          >
            <Text className="text-bg font-bold text-base">
              DRILL {SKILL_LABELS[weakestSkill] ?? weakestSkill} →
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            className="bg-accent rounded-2xl py-4 items-center"
            onPress={() => router.replace('/flight/hud')}
          >
            <Text className="text-bg font-bold text-base">FLY AGAIN ✈</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          className="bg-surface2 rounded-2xl py-4 items-center border border-line"
          onPress={() => router.replace('/(tabs)')}
        >
          <Text className="text-dim font-semibold">← Back to Dashboard</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  )
}
