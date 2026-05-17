// src/hooks/useBadges.ts
import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { evaluateBadges, type BadgeId } from '@/lib/badges'
import type { AttemptRecord } from '@/types/grader'

export interface EarnedBadge {
  badgeId: BadgeId
  earnedAt: string
}

interface UseBadgesResult {
  earnedBadges: EarnedBadge[]
  newBadges: BadgeId[]
  clearNewBadges: () => void
  checkAndAward: (params: {
    attempts: AttemptRecord[]
    streak: number
  }) => Promise<BadgeId[]>
  loading: boolean
}

export function useBadges(userId: string | null): UseBadgesResult {
  const [earnedBadges, setEarnedBadges] = useState<EarnedBadge[]>([])
  const [newBadges, setNewBadges] = useState<BadgeId[]>([])
  const [loading, setLoading] = useState(true)
  const earnedIdsRef = useRef<Set<BadgeId>>(new Set())

  useEffect(() => {
    if (!userId) { setLoading(false); return }
    Promise.resolve(
      supabase
        .from('badges_earned')
        .select('badge_id, earned_at')
        .eq('user_id', userId)
    ).then(({ data }) => {
      if (data) {
        const badges = data.map(r => ({ badgeId: r.badge_id as BadgeId, earnedAt: r.earned_at }))
        setEarnedBadges(badges)
        earnedIdsRef.current = new Set(badges.map(b => b.badgeId))
      }
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [userId])

  const checkAndAward = useCallback(async ({
    attempts,
    streak,
  }: { attempts: AttemptRecord[]; streak: number }) => {
    if (!userId) return []

    const { count } = await supabase
      .from('runs')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)

    const totalRuns = count ?? 0
    const toAward = evaluateBadges({ attempts, totalRuns, streak }, earnedIdsRef.current)
    if (toAward.length === 0) return []

    const now = new Date().toISOString()
    const rows = toAward.map(badgeId => ({ user_id: userId, badge_id: badgeId, earned_at: now }))

    const { error } = await supabase.from('badges_earned').upsert(rows, { onConflict: 'user_id,badge_id' })
    if (error) { console.warn('[useBadges] upsert failed:', error.message); return [] }

    toAward.forEach(id => earnedIdsRef.current.add(id))
    setEarnedBadges(prev => [...prev, ...toAward.map(id => ({ badgeId: id, earnedAt: now }))])
    setNewBadges(toAward)
    return toAward
  }, [userId])

  const clearNewBadges = useCallback(() => setNewBadges([]), [])

  return { earnedBadges, newBadges, clearNewBadges, checkAndAward, loading }
}
