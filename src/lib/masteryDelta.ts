// src/lib/masteryDelta.ts
import type { MasteryRow } from '@/hooks/useStats'

export interface MasteryDeltaRow {
  skillTag: string
  before: number
  after: number
  delta: number
}

export function computeMasteryDelta(
  before: Record<string, number>,
  after: MasteryRow[]
): MasteryDeltaRow[] {
  if (Object.keys(before).length === 0) return []
  return after
    .filter(row => row.skillTag in before)
    .map(row => ({ skillTag: row.skillTag, before: before[row.skillTag], after: row.score, delta: row.score - before[row.skillTag] }))
    .filter(row => Math.abs(row.delta) >= 0.02)
}

export function findWeakestSkill(mastery: MasteryRow[], attemptedSkills: string[]): string | null {
  const relevant = mastery
    .filter(m => attemptedSkills.includes(m.skillTag) && m.score < 0.6)
    .sort((a, b) => a.score - b.score)
  return relevant[0]?.skillTag ?? null
}
