import { View, Text, ScrollView } from 'react-native'
import { useCallback } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import { useAuthStore } from '@/store/authStore'
import { useStats } from '@/hooks/useStats'
import { useBadges } from '@/hooks/useBadges'
import { badgeDef } from '@/lib/badges'

const SKILL_LABELS: Record<string, string> = {
  atis_extraction: 'ATIS Extraction',
  taxi_request: 'Taxi Request',
  taxi_readback: 'Taxi Readback',
  runup_ready: 'Runup Ready',
  takeoff_readback: 'Takeoff Readback',
  freq_change_readback: 'Freq Change',
  position_report_norcal: 'Position Report',
  position_report_approach: 'Position Report',
  inbound_call: 'Inbound Call',
  pattern_entry_readback: 'Pattern Entry',
  landing_readback: 'Landing Readback',
  taxi_to_parking_readback: 'Taxi to Parking',
  say_again_handling: 'Say Again',
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function ScoreBar({ score, max = 100 }: { score: number; max?: number }) {
  const pct = Math.min(100, (score / max) * 100)
  const color = score >= 85 ? '#5BE3A1' : score >= 60 ? '#FFB85C' : '#FF6B7A'
  return (
    <View className="h-8 flex-row items-center gap-2">
      <View className="flex-1 h-2 bg-line rounded-full overflow-hidden">
        <View className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </View>
      <Text className="text-xs font-mono font-bold w-8 text-right" style={{ color }}>{score}</Text>
    </View>
  )
}

export default function StatsScreen() {
  const { user, isGuest } = useAuthStore()
  const { recentRuns, masteryBySkill, streak, totalFlights, avgScore, loading, refetch } = useStats(user?.id ?? null)
  const { earnedBadges, loading: badgesLoading } = useBadges(user?.id ?? null)

  useFocusEffect(useCallback(() => { refetch() }, [refetch]))

  if (isGuest) {
    return (
      <View className="flex-1 bg-bg items-center justify-center px-8">
        <Text className="text-dim text-base text-center">Sign in to track your stats and mastery over time.</Text>
      </View>
    )
  }

  const trend = recentRuns.slice(0, 10).reverse()

  return (
    <ScrollView className="flex-1 bg-bg" contentContainerStyle={{ padding: 20, paddingTop: 60, paddingBottom: 40 }}>
      <Text style={{ color: '#e7ecf5' }} className="text-2xl font-bold mb-1">Stats</Text>
      <Text className="text-dim text-sm mb-6">Your progress over time</Text>

      {/* Top stats */}
      <View className="flex-row gap-3 mb-6">
        {[
          { lbl: 'Streak', v: loading ? '—' : String(streak), unit: 'days', color: '#5BE3A1' },
          { lbl: 'Flights', v: loading ? '—' : String(totalFlights), unit: 'all-time', color: '#6FE3FF' },
          { lbl: 'Avg Score', v: loading ? '—' : `${avgScore}`, unit: 'points', color: '#FFB85C' },
        ].map(s => (
          <View key={s.lbl} className="flex-1 bg-surface2 rounded-2xl p-3 border border-line items-center">
            <Text className="text-muted text-xs uppercase tracking-widest">{s.lbl}</Text>
            <Text className="text-2xl font-bold font-mono mt-1" style={{ color: s.color }}>{s.v}</Text>
            <Text className="text-muted text-xs">{s.unit}</Text>
          </View>
        ))}
      </View>

      {/* Score trend */}
      {trend.length > 0 && (
        <>
          <Text className="text-dim text-xs font-bold uppercase tracking-widest mb-3">Score Trend (last {trend.length} flights)</Text>
          <View className="bg-surface2 rounded-2xl border border-line p-4 mb-6">
            {trend.map((run, i) => (
              <View key={run.id} className="mb-1">
                <Text className="text-dim text-xs font-mono mb-0.5">
                  {String(trend.length - i).padStart(2, '0')}
                </Text>
                <ScoreBar score={run.score} />
              </View>
            ))}
          </View>
        </>
      )}

      {/* Skill Mastery — full detail */}
      {masteryBySkill.length > 0 && (
        <>
          <Text className="text-dim text-xs font-bold uppercase tracking-widest mb-3">Skill Mastery</Text>
          <View className="bg-surface2 rounded-2xl border border-line p-4 mb-6">
            {masteryBySkill
              .slice()
              .sort((a, b) => a.score - b.score)
              .map((skill, i) => {
                const pct = Math.round(skill.score * 100)
                const weak = skill.score < 0.6
                const isLast = i === masteryBySkill.length - 1
                return (
                  <View key={skill.skillTag} className={isLast ? '' : 'mb-4'}>
                    <View className="flex-row justify-between items-center mb-1">
                      <Text style={{ color: '#e7ecf5' }} className="text-xs font-semibold">
                        {SKILL_LABELS[skill.skillTag] ?? skill.skillTag}
                      </Text>
                      <View className="flex-row items-center gap-2">
                        <Text className="text-dim text-xs font-mono">{skill.attemptsCount} attempts</Text>
                        <Text className="text-xs font-bold font-mono" style={{ color: weak ? '#FFB85C' : '#5BE3A1' }}>
                          {pct}%
                        </Text>
                      </View>
                    </View>
                    <View className="h-1.5 rounded-full bg-line overflow-hidden">
                      <View
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, backgroundColor: weak ? '#FFB85C' : '#5BE3A1' }}
                      />
                    </View>
                    {weak && (
                      <Text className="text-warm text-xs mt-0.5 uppercase tracking-widest">▾ needs work</Text>
                    )}
                  </View>
                )
              })}
          </View>
        </>
      )}

      {/* Badge showcase */}
      {!badgesLoading && earnedBadges.length > 0 && (
        <>
          <Text className="text-dim text-xs font-bold uppercase tracking-widest mb-3">Badges ({earnedBadges.length})</Text>
          <View className="flex-row flex-wrap gap-3 mb-6">
            {earnedBadges.map(({ badgeId, earnedAt }) => {
              const def = badgeDef(badgeId)
              return (
                <View key={badgeId} className="bg-surface2 rounded-2xl border border-line p-3 items-center" style={{ width: '47%' }}>
                  <Text className="text-3xl mb-1">{def.emoji}</Text>
                  <Text style={{ color: '#e7ecf5' }} className="text-xs font-semibold text-center">{def.label}</Text>
                  <Text className="text-dim text-xs mt-1">
                    {new Date(earnedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </Text>
                </View>
              )
            })}
          </View>
        </>
      )}

      {/* Full flight history */}
      {recentRuns.length > 0 && (
        <>
          <Text className="text-dim text-xs font-bold uppercase tracking-widest mb-3">Recent Flights</Text>
          {recentRuns.map((run, i) => (
            <View key={run.id} className="flex-row justify-between items-center bg-surface2 rounded-xl p-3 border border-line mb-2">
              <View>
                <Text className="text-muted text-xs uppercase tracking-widest">#{totalFlights - i}</Text>
                <Text style={{ color: '#e7ecf5' }} className="text-sm font-semibold mt-0.5">{formatDate(run.startedAt)}</Text>
              </View>
              <View className="items-end">
                <Text
                  className="text-2xl font-bold font-mono"
                  style={{ color: run.score >= 85 ? '#5BE3A1' : run.score >= 60 ? '#FFB85C' : '#FF6B7A' }}
                >
                  {run.score}
                </Text>
                <Text className="text-muted text-xs">score</Text>
              </View>
            </View>
          ))}
        </>
      )}

      {!loading && recentRuns.length === 0 && masteryBySkill.length === 0 && (
        <View className="items-center py-12">
          <Text className="text-dim text-sm text-center">No flights yet. Complete your first flight to see stats here.</Text>
        </View>
      )}
    </ScrollView>
  )
}
