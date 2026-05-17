// app/(tabs)/index.tsx
import { View, Text, ScrollView, TouchableOpacity } from 'react-native'
import { useRouter } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import { useAuthStore } from '@/store/authStore'
import { useStats } from '@/hooks/useStats'
import { useBadges } from '@/hooks/useBadges'
import { badgeDef } from '@/lib/badges'
import AsyncStorage from '@react-native-async-storage/async-storage'

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

export default function DashboardScreen() {
  const router = useRouter()
  const { user, isGuest } = useAuthStore()
  const { recentRuns, masteryBySkill, streak, totalFlights, avgScore, loading, refetch } = useStats(user?.id ?? null)
  const { earnedBadges, loading: badgesLoading } = useBadges(user?.id ?? null)

  useFocusEffect(useCallback(() => { refetch() }, [refetch]))

  const [showGearNudge, setShowGearNudge] = useState(false)

  useEffect(() => {
    AsyncStorage.getItem('gear_nudge_dismissed')
      .then(val => { if (!val && totalFlights >= 1) setShowGearNudge(true) })
      .catch(() => {})
  }, [totalFlights])

  function dismissGearNudge() {
    AsyncStorage.setItem('gear_nudge_dismissed', '1')
    setShowGearNudge(false)
  }

  return (
    <ScrollView className="flex-1 bg-bg" contentContainerStyle={{ padding: 20, paddingTop: 60 }}>
      {/* Greeting */}
      <Text className="text-muted text-sm mb-1">
        {isGuest ? 'Flying as guest' : `Welcome back`}
      </Text>
      <Text style={{ color: '#e7ecf5' }} className="text-3xl font-bold mb-6">Ready to fly?</Text>

      {showGearNudge && (
        <View className="bg-surface2 border border-line rounded-2xl p-3 mb-4 flex-row items-center gap-3">
          <Text style={{ fontSize: 20 }}>♦</Text>
          <View className="flex-1">
            <Text style={{ color: '#e7ecf5' }} className="text-xs font-semibold">
              Ready for real comms?
            </Text>
            <Text className="text-dim text-xs">Check out the gear pilots actually use →</Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/gear')}
            className="bg-accent rounded-lg px-3 py-2 mr-1"
          >
            <Text className="text-bg font-bold text-xs">GEAR</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={dismissGearNudge}>
            <Text className="text-dim text-sm">✕</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Hero CTA */}
      <View className="bg-surface2 rounded-3xl p-5 mb-4 border border-line">
        <Text className="text-accent text-xs font-bold tracking-widest mb-2 uppercase">▸ Next flight</Text>
        <Text style={{ color: '#e7ecf5' }} className="text-xl font-bold mb-1">KPAO — Full Pattern</Text>
        <Text className="text-dim text-sm mb-4">VFR · C172 · ~15 min</Text>
        <TouchableOpacity
          className="bg-accent self-start px-6 py-3 rounded-full"
          onPress={() => router.push('/flight/brief')}
        >
          <Text className="text-bg font-bold text-sm">START FLIGHT →</Text>
        </TouchableOpacity>
      </View>

      {/* Guest banner */}
      {isGuest && (
        <View className="bg-surface2 border border-warm rounded-2xl p-3 mb-4 flex-row justify-between items-center">
          <Text className="text-dim text-xs flex-1">Sign in to save your progress and track mastery</Text>
          <TouchableOpacity onPress={() => router.push('/auth')}>
            <Text className="text-accent text-xs font-bold ml-3">SIGN IN →</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Stats strip */}
      {!isGuest && (
        <View className="flex-row gap-3 mb-6">
          {[
            { lbl: 'Streak', v: loading ? '—' : String(streak), unit: 'days', color: 'text-go' },
            { lbl: 'Flights', v: loading ? '—' : String(totalFlights), unit: 'all-time', color: 'text-accent' },
            { lbl: 'Accuracy', v: loading ? '—' : `${avgScore}%`, unit: 'avg score', color: 'text-warm' },
          ].map(s => (
            <View key={s.lbl} className="flex-1 bg-surface2 rounded-2xl p-3 border border-line">
              <Text className="text-muted text-xs uppercase tracking-widest">{s.lbl}</Text>
              <Text className={`${s.color} text-2xl font-bold font-mono mt-1`}>{s.v}</Text>
              <Text className="text-muted text-xs">{s.unit}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Skill Mastery */}
      {!isGuest && masteryBySkill.length > 0 && (
        <>
          <Text className="text-dim text-xs font-bold uppercase tracking-widest mb-3">Skill Mastery</Text>
          <View className="flex-row flex-wrap gap-3 mb-6">
            {masteryBySkill.map(skill => {
              const pct = Math.round(skill.score * 100)
              const weak = skill.score < 0.6
              return (
                <View key={skill.skillTag} className="bg-surface2 rounded-xl p-3 border border-line" style={{ width: '47%' }}>
                  <View className="flex-row justify-between items-center mb-2">
                    <Text style={{ color: '#e7ecf5' }} className="text-xs font-semibold" numberOfLines={1}>
                      {SKILL_LABELS[skill.skillTag] ?? skill.skillTag}
                    </Text>
                    <Text className={`text-xs font-mono ${weak ? 'text-warm' : 'text-dim'}`}>{pct}%</Text>
                  </View>
                  <View className="h-1 rounded-full bg-line overflow-hidden">
                    <View
                      className={`h-full rounded-full ${weak ? 'bg-warm' : 'bg-go'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </View>
                  {weak && <Text className="text-warm text-xs mt-1 uppercase tracking-widest">▾ needs work</Text>}
                </View>
              )
            })}
          </View>
        </>
      )}

      {/* Badge carousel */}
      {!isGuest && !badgesLoading && earnedBadges.length > 0 && (
        <>
          <Text className="text-dim text-xs font-bold uppercase tracking-widest mb-3">Badges</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="mb-6"
            contentContainerStyle={{ gap: 12 }}
          >
            {earnedBadges.map(({ badgeId }) => {
              const def = badgeDef(badgeId)
              return (
                <View
                  key={badgeId}
                  className="bg-surface2 rounded-2xl border border-line p-3 items-center"
                  style={{ width: 88 }}
                >
                  <Text className="text-3xl mb-1">{def.emoji}</Text>
                  <Text style={{ color: '#e7ecf5' }} className="text-xs font-semibold text-center" numberOfLines={2}>
                    {def.label}
                  </Text>
                </View>
              )
            })}
          </ScrollView>
        </>
      )}

      {/* Recent Flights */}
      {!isGuest && recentRuns.length > 0 && (
        <>
          <Text className="text-dim text-xs font-bold uppercase tracking-widest mb-3">Recent Flights</Text>
          {recentRuns.map(run => (
            <View key={run.id} className="flex-row justify-between items-center bg-surface2 rounded-xl p-3 border border-line mb-2">
              <View>
                <Text className="text-muted text-xs uppercase tracking-widest">{formatDate(run.startedAt)}</Text>
                <Text style={{ color: '#e7ecf5' }} className="text-sm font-semibold mt-1">KPAO · Full Pattern</Text>
              </View>
              <View className="items-end">
                <Text className={`text-2xl font-bold font-mono ${run.score >= 85 ? 'text-go' : 'text-warm'}`}>{run.score}</Text>
                <Text className="text-muted text-xs">score</Text>
              </View>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  )
}
