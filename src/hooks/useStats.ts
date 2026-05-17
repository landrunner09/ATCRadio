// src/hooks/useStats.ts
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export interface RunSummary {
  id: string
  startedAt: string
  score: number
}

export interface MasteryRow {
  skillTag: string
  score: number        // 0.0–1.0
  attemptsCount: number
}

interface StatsState {
  recentRuns: RunSummary[]
  masteryBySkill: MasteryRow[]
  streak: number
  totalFlights: number
  avgScore: number
  loading: boolean
}

export interface Stats extends StatsState {
  refetch: () => void
}

function computeStreak(dates: string[]): number {
  if (dates.length === 0) return 0
  const unique = [...new Set(dates.map(d => d.slice(0, 10)))].sort().reverse()
  const today = new Date().toISOString().slice(0, 10)
  let streak = 0
  let cursor = today
  for (const day of unique) {
    if (day === cursor) {
      streak++
      const d = new Date(cursor)
      d.setDate(d.getDate() - 1)
      cursor = d.toISOString().slice(0, 10)
    } else {
      break
    }
  }
  return streak
}

export function useStats(userId: string | null): Stats {
  const [state, setState] = useState<StatsState>({
    recentRuns: [],
    masteryBySkill: [],
    streak: 0,
    totalFlights: 0,
    avgScore: 0,
    loading: true,
  })

  const load = useCallback(async () => {
    if (!userId) {
      setState(s => ({ ...s, loading: false }))
      return
    }

    setState(s => ({ ...s, loading: true }))

    const [runsRes, masteryRes, countRes] = await Promise.all([
      supabase
        .from('runs')
        .select('id, started_at, final_score')
        .eq('user_id', userId)
        .order('started_at', { ascending: false })
        .limit(50),
      supabase
        .from('mastery')
        .select('skill_tag, score, attempts_count')
        .eq('user_id', userId),
      supabase
        .from('runs')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId),
    ])

    if (runsRes.error) console.warn('[useStats] runs query failed:', runsRes.error.message)
    if (masteryRes.error) console.warn('[useStats] mastery query failed:', masteryRes.error.message)
    if (countRes.error) console.warn('[useStats] count query failed:', countRes.error.message)

    const runs: Array<{ id: string; started_at: string; final_score: number }> = runsRes.data ?? []
    const mastery: Array<{ skill_tag: string; score: number; attempts_count: number }> = masteryRes.data ?? []

    const scores = runs.map(r => r.final_score).filter(s => s != null)
    const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0

    setState({
      recentRuns: runs.slice(0, 5).map(r => ({ id: r.id, startedAt: r.started_at, score: r.final_score })),
      masteryBySkill: mastery.map(m => ({ skillTag: m.skill_tag, score: m.score, attemptsCount: m.attempts_count })),
      streak: computeStreak(runs.map(r => r.started_at)),
      totalFlights: countRes.count ?? runs.length,
      avgScore,
      loading: false,
    })
  }, [userId])

  useEffect(() => { load() }, [load])

  return { ...state, refetch: load }
}
