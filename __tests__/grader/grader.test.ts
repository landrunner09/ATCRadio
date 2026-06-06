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

describe('grader tolerance — Plan 3 B13 rules', () => {
  const baseCtx: ScenarioContext = {
    callsign: 'N73324', aircraft_type: 'C172', runway_in_use: '25R',
    weather: { wind: '250 at 8', vis: '10SM', altimeter: '30.02' },
    atis_letter: 'Bravo', departure_taxiway: 'alpha', destination: '',
    controller_voice_ids: {}, squawk_code: '0421', approach_facility: 'NorCal Approach',
  }

  const makeTestBeat = (slots: Beat['expected_student_response']['required_slots']): Beat => ({
    id: 'b', phase: 'TEST', skill_tag: 'test',
    speaker: 'tower', voice_role: 'tower', line_template: '',
    expected_student_response: { type: 'readback', required_slots: slots, phraseology_hints: [] },
    on_pass: { next: '__debrief__' },
    on_partial: { missing_critical: [], controller_correction: '', retry_same_beat: true, max_retries: 2 },
    on_fail_after_retries: { scaffold_mode: true, next_after_scaffold_pass: '__debrief__' },
    on_say_again: { replay_audio: true },
  })

  test('runway: bare "25R" passes for parallel runway', () => {
    const b = makeTestBeat([{ slot: 'runway', value: '{runway}', criticality: 'critical' }])
    const r = gradeResponse('runway 25R, N73324', b, baseCtx, 0.9, PACK)
    expect(r.passed).toBe(true)
  })

  test('runway: written-out "25 right" passes for 25R', () => {
    const b = makeTestBeat([{ slot: 'runway', value: '{runway}', criticality: 'critical' }])
    const r = gradeResponse('runway 25 right, N73324', b, baseCtx, 0.9, PACK)
    expect(r.passed).toBe(true)
  })

  test('runway: bare "25" fails for parallel runway 25R (ambiguity)', () => {
    const b = makeTestBeat([{ slot: 'runway', value: '{runway}', criticality: 'critical' }])
    const r = gradeResponse('runway 25, cleared takeoff', b, baseCtx, 0.9, PACK)
    expect(r.passed).toBe(false)
  })

  test('runway: bare "12" passes when assigned runway is "12" (no parallel)', () => {
    const ctx12 = { ...baseCtx, runway_in_use: '12' }
    const b = makeTestBeat([{ slot: 'runway', value: '{runway}', criticality: 'critical' }])
    const r = gradeResponse('runway 12, N73324', b, ctx12, 0.9, PACK)
    expect(r.passed).toBe(true)
  })

  test('hold_short: literal "of" is optional', () => {
    const b = makeTestBeat([{ slot: 'hold_short_of', value: '{runway}', criticality: 'critical' }])
    const r1 = gradeResponse('hold short 25R', b, baseCtx, 0.9, PACK)
    const r2 = gradeResponse('hold short of runway 25R', b, baseCtx, 0.9, PACK)
    expect(r1.passed).toBe(true)
    expect(r2.passed).toBe(true)
  })

  test('action with adjacency: "cleared for takeoff" requires cleared+takeoff within 4 tokens', () => {
    const b = makeTestBeat([{ slot: 'action', value: 'cleared for takeoff', criticality: 'critical' }])
    const r1 = gradeResponse('cleared for takeoff runway 25R', b, baseCtx, 0.9, PACK)
    const r2 = gradeResponse('cleared to taxi to runway, will land later', b, baseCtx, 0.9, PACK)
    expect(r1.passed).toBe(true)
    expect(r2.passed).toBe(false)
  })

  test('callsign: last-3 alphanumeric passes ("324" for N73324)', () => {
    const b = makeTestBeat([{ slot: 'callsign', value: '{callsign}', criticality: 'critical' }])
    const r = gradeResponse('roger, 324 ready for departure', b, baseCtx, 0.9, PACK)
    expect(r.passed).toBe(true)
  })
})
