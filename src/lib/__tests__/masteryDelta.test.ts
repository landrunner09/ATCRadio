// src/lib/__tests__/masteryDelta.test.ts
import { computeMasteryDelta, findWeakestSkill } from '../masteryDelta'

describe('computeMasteryDelta', () => {
  it('returns delta for skills that changed by >= 0.02', () => {
    const before = { taxi_readback: 0.5, atis_extraction: 0.8 }
    const after = [
      { skillTag: 'taxi_readback', score: 0.6, attemptsCount: 5 },
      { skillTag: 'atis_extraction', score: 0.81, attemptsCount: 3 },
    ]
    const result = computeMasteryDelta(before, after)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ skillTag: 'taxi_readback', before: 0.5, after: 0.6, delta: expect.closeTo(0.1, 2) })
  })

  it('ignores changes smaller than 0.02', () => {
    const before = { taxi_readback: 0.5 }
    const after = [{ skillTag: 'taxi_readback', score: 0.51, attemptsCount: 1 }]
    expect(computeMasteryDelta(before, after)).toHaveLength(0)
  })

  it('returns empty array when before snapshot is empty', () => {
    const after = [{ skillTag: 'taxi_readback', score: 0.6, attemptsCount: 5 }]
    expect(computeMasteryDelta({}, after)).toHaveLength(0)
  })
})

describe('findWeakestSkill', () => {
  it('returns the skill tag with the lowest score from the attempted set', () => {
    const mastery = [
      { skillTag: 'taxi_readback', score: 0.4, attemptsCount: 3 },
      { skillTag: 'atis_extraction', score: 0.9, attemptsCount: 5 },
      { skillTag: 'takeoff_readback', score: 0.3, attemptsCount: 2 },
    ]
    const attemptedSkills = ['taxi_readback', 'atis_extraction']
    expect(findWeakestSkill(mastery, attemptedSkills)).toBe('taxi_readback')
  })

  it('returns null when no mastery data intersects attempted skills', () => {
    expect(findWeakestSkill([], ['taxi_readback'])).toBeNull()
  })

  it('returns null when weakest skill score >= 0.6 (no drilling needed)', () => {
    const mastery = [{ skillTag: 'taxi_readback', score: 0.7, attemptsCount: 3 }]
    expect(findWeakestSkill(mastery, ['taxi_readback'])).toBeNull()
  })
})
