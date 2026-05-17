import { gradeResponse } from '@/grader/grader'
import type { Beat, ScenarioContext } from '@/types/content'
import KPAO from '@/content/KPAO.json'
import { loadPack } from '@/engine/loader'
const PACK = loadPack(KPAO)

const makeContext = (overrides?: Partial<ScenarioContext>): ScenarioContext => ({
  callsign: 'N12345',
  aircraft_type: 'C172',
  runway_in_use: '31',
  weather: { wind: '310@8', vis: '10SM', altimeter: '30.02' },
  atis_letter: 'Bravo',
  departure_taxiway: 'alpha',
  destination: 'practice_area_west',
  controller_voice_ids: {},
  squawk_code: '4721',
  approach_facility: 'Approach',
  ...overrides,
})

const makeBeat = (slots: Beat['expected_student_response']['required_slots']): Beat =>
  ({
    id: 'test.beat',
    phase: 'TAXI',
    skill_tag: 'taxi_readback',
    speaker: 'tower',
    voice_role: 'kpao_tower',
    line_template: 'Test line',
    expected_student_response: { type: 'readback', required_slots: slots },
    on_pass: { next: 'next.beat' },
    on_partial: { missing_critical: [], controller_correction: '', retry_same_beat: true, max_retries: 2 },
    on_fail_after_retries: { scaffold_mode: true, next_after_scaffold_pass: 'next.beat' },
    on_say_again: { replay_audio: true },
  } as Beat)

describe('gradeResponse', () => {
  test('passes when all standard slots present', () => {
    const beat = makeBeat([
      { slot: 'runway', value: '{runway}', criticality: 'standard' },
    ])
    const result = gradeResponse('taxi runway three one', beat, makeContext(), 0.95, PACK)
    expect(result.passed).toBe(true)
    expect(result.missingCritical).toHaveLength(0)
  })

  test('fails when critical slot missing', () => {
    const beat = makeBeat([
      { slot: 'hold_short_of', value: '{runway}', criticality: 'critical' },
    ])
    const result = gradeResponse('taxi runway three one alpha', beat, makeContext(), 0.95, PACK)
    expect(result.passed).toBe(false)
    expect(result.missingCritical).toContain('hold_short_of')
  })

  test('passes even with missing standard slot', () => {
    const beat = makeBeat([
      { slot: 'runway', value: '{runway}', criticality: 'standard' },
      { slot: 'hold_short_of', value: '{runway}', criticality: 'critical' },
    ])
    const result = gradeResponse('hold short three one', beat, makeContext(), 0.95, PACK)
    expect(result.passed).toBe(true)
    expect(result.missingStandard).toContain('runway')
  })

  test('matches callsign phonetically', () => {
    const beat = makeBeat([
      { slot: 'callsign', value: '{callsign}', criticality: 'standard' },
    ])
    const result = gradeResponse('november one two three four five', beat, makeContext(), 0.95, PACK)
    expect(result.passed).toBe(true)
  })

  test('resolves template vars from scenarioContext', () => {
    const beat = makeBeat([
      { slot: 'runway', value: '{runway}', criticality: 'standard' },
    ])
    const ctx = makeContext({ runway_in_use: '13' })
    const result = gradeResponse('taxi runway one three', beat, ctx, 0.95, PACK)
    expect(result.passed).toBe(true)
  })

  test('records confidence in result', () => {
    const beat = makeBeat([
      { slot: 'runway', value: '{runway}', criticality: 'standard' },
    ])
    const result = gradeResponse('taxi runway three one', beat, makeContext(), 0.60, PACK)
    expect(result.confidence).toBe(0.60)
  })

  test('fails when critical frequency slot missing', () => {
    const beat = makeBeat([
      { slot: 'frequency', value: '{approach_freq}', criticality: 'critical' },
    ])
    const result = gradeResponse('roger thank you', beat, makeContext(), 0.95, PACK)
    expect(result.passed).toBe(false)
    expect(result.missingCritical).toContain('frequency')
  })

  test('passes when frequency slot present', () => {
    const beat = makeBeat([
      { slot: 'frequency', value: '{approach_freq}', criticality: 'critical' },
    ])
    // approach_freq is 121.3
    const result = gradeResponse('one two one point three november one two three four five', beat, makeContext(), 0.95, PACK)
    expect(result.passed).toBe(true)
  })

  test('resolves {squawk_code} slot from context', () => {
    const beat = makeBeat([
      { slot: 'squawk', value: '{squawk_code}', criticality: 'critical' },
    ])
    const ctx = makeContext({ squawk_code: '4721', approach_facility: 'Approach' })
    const result = gradeResponse('squawk four seven two one', beat, ctx, 0.95, PACK)
    expect(result.passed).toBe(true)
  })

  test('resolves {airport_name} slot from pack', () => {
    const beat = makeBeat([
      { slot: 'airport_name', value: '{airport_name}', criticality: 'standard' },
    ])
    const ctx = makeContext({ squawk_code: '4721', approach_facility: 'Approach' })
    // PACK.airport_name is 'Palo Alto Airport'
    const result = gradeResponse('palo alto airport traffic', beat, ctx, 0.95, PACK)
    expect(result.passed).toBe(true)
  })

  test('fails when airport_name not in transcript', () => {
    const beat = makeBeat([
      { slot: 'airport_name', value: '{airport_name}', criticality: 'critical' },
    ])
    const ctx = makeContext({ squawk_code: '4721', approach_facility: 'Approach' })
    const result = gradeResponse('traffic in the area', beat, ctx, 0.95, PACK)
    expect(result.passed).toBe(false)
  })
})
