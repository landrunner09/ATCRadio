// src/lib/__tests__/badges.test.ts
import { evaluateBadges, type RunContext } from '../badges'
import type { AttemptRecord } from '@/types/grader'

function attempt(skillTag: string, result: AttemptRecord['result']): AttemptRecord {
  return { beatId: skillTag, skillTag, result, gradeResult: null, timestamp: Date.now() }
}

describe('evaluateBadges', () => {
  const none = new Set<'first_flight' | 'clean_taxi' | 'no_stumbles' | 'streak_3' | 'streak_7' | 'streak_30'>()

  it('awards first_flight when totalRuns >= 1', () => {
    const run: RunContext = { attempts: [], totalRuns: 1, streak: 1 }
    expect(evaluateBadges(run, none)).toContain('first_flight')
  })

  it('does not award first_flight if already earned', () => {
    const run: RunContext = { attempts: [], totalRuns: 5, streak: 1 }
    const already = new Set(['first_flight'] as const)
    expect(evaluateBadges(run, already)).not.toContain('first_flight')
  })

  it('awards clean_taxi when all taxi/runup beats pass', () => {
    const run: RunContext = {
      attempts: [attempt('taxi_readback', 'pass'), attempt('runup_ready', 'pass')],
      totalRuns: 1,
      streak: 1,
    }
    expect(evaluateBadges(run, none)).toContain('clean_taxi')
  })

  it('does not award clean_taxi when a taxi beat is partial', () => {
    const run: RunContext = {
      attempts: [attempt('taxi_readback', 'partial'), attempt('runup_ready', 'pass')],
      totalRuns: 1,
      streak: 1,
    }
    expect(evaluateBadges(run, none)).not.toContain('clean_taxi')
  })

  it('does not award clean_taxi when no taxi beats exist', () => {
    const run: RunContext = {
      attempts: [attempt('landing_readback', 'pass')],
      totalRuns: 1,
      streak: 1,
    }
    expect(evaluateBadges(run, none)).not.toContain('clean_taxi')
  })

  it('awards no_stumbles when zero scaffold results', () => {
    const run: RunContext = {
      attempts: [attempt('taxi_readback', 'pass'), attempt('takeoff_readback', 'partial')],
      totalRuns: 1,
      streak: 1,
    }
    expect(evaluateBadges(run, none)).toContain('no_stumbles')
  })

  it('does not award no_stumbles when scaffold exists', () => {
    const run: RunContext = {
      attempts: [attempt('taxi_readback', 'scaffold')],
      totalRuns: 1,
      streak: 1,
    }
    expect(evaluateBadges(run, none)).not.toContain('no_stumbles')
  })

  it('awards streak badges at correct thresholds', () => {
    const run: RunContext = { attempts: [], totalRuns: 7, streak: 7 }
    const badges = evaluateBadges(run, none)
    expect(badges).toContain('streak_3')
    expect(badges).toContain('streak_7')
    expect(badges).not.toContain('streak_30')
  })

  it('awards no badges when attempts array is empty and totalRuns is 0', () => {
    const run: RunContext = { attempts: [], totalRuns: 0, streak: 0 }
    expect(evaluateBadges(run, none)).toEqual([])
  })
})
