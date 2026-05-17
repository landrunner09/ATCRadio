// src/lib/badges.ts
import type { AttemptRecord } from '@/types/grader'

export type BadgeId =
  | 'first_flight'
  | 'clean_taxi'
  | 'no_stumbles'
  | 'streak_3'
  | 'streak_7'
  | 'streak_30'

export interface BadgeDefinition {
  id: BadgeId
  label: string
  description: string
  emoji: string
}

export const BADGE_DEFS: BadgeDefinition[] = [
  { id: 'first_flight',  label: 'First Flight',   description: 'Complete your first scenario',              emoji: '✈' },
  { id: 'clean_taxi',    label: 'Clean Taxi',      description: 'Taxi beats with zero corrections',          emoji: '🛬' },
  { id: 'no_stumbles',   label: 'No Stumbles',     description: 'Full scenario with zero scaffold triggers',  emoji: '🎯' },
  { id: 'streak_3',      label: '3-Day Streak',    description: 'Fly 3 days in a row',                      emoji: '🔥' },
  { id: 'streak_7',      label: '7-Day Streak',    description: 'Fly 7 days in a row',                      emoji: '🔥🔥' },
  { id: 'streak_30',     label: '30-Day Streak',   description: 'Fly 30 days in a row',                     emoji: '🔥🔥🔥' },
]

export interface RunContext {
  attempts: AttemptRecord[]
  totalRuns: number   // total completed runs for this user including this one
  streak: number      // consecutive-day streak including today
}

export function evaluateBadges(run: RunContext, alreadyEarned: Set<BadgeId>): BadgeId[] {
  const earned: BadgeId[] = []

  function award(id: BadgeId, condition: boolean) {
    if (!alreadyEarned.has(id) && condition) earned.push(id)
  }

  award('first_flight', run.totalRuns >= 1)

  const taxiBeats = run.attempts.filter(
    a => a.skillTag === 'taxi_readback' || a.skillTag === 'runup_ready',
  )
  award('clean_taxi', taxiBeats.length > 0 && taxiBeats.every(a => a.result === 'pass'))

  award(
    'no_stumbles',
    run.attempts.length > 0 && run.attempts.every(a => a.result !== 'scaffold'),
  )

  award('streak_3',  run.streak >= 3)
  award('streak_7',  run.streak >= 7)
  award('streak_30', run.streak >= 30)

  return earned
}

export function badgeDef(id: BadgeId): BadgeDefinition {
  const def = BADGE_DEFS.find(b => b.id === id)
  if (!def) throw new Error(`Unknown badge id: ${id}`)
  return def
}
