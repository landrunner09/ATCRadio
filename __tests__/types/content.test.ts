import type { Beat, ContentPack, ScenarioContext } from '@/types/content'
import { pickLine, loadPack } from '@/engine/loader'
import KPAO from '@/content/KPAO.json'

test('Beat accepts pilot_initiated type', () => {
  const beat: Beat = {
    id: 'test.cue',
    phase: 'APPROACH_CALL',
    skill_tag: 'approach_call',
    type: 'pilot_initiated',
    cue_text: 'Call approach inbound',
    speaker: 'tower',
    voice_role: '',
    line_template: '',
    expected_student_response: {
      type: 'readback',
      required_slots: [{ slot: 'callsign', value: '{callsign}', criticality: 'critical' }],
    },
    on_pass: { next: 'next' },
    on_partial: { missing_critical: [], controller_correction: '', retry_same_beat: true, max_retries: 2 },
    on_fail_after_retries: { scaffold_mode: true, next_after_scaffold_pass: 'next' },
    on_say_again: { replay_audio: true },
  }
  expect(beat.type).toBe('pilot_initiated')
  expect(beat.cue_text).toBe('Call approach inbound')
})

test('ContentPack accepts scenario_type and controlled', () => {
  const pack: Partial<ContentPack> = {
    scenario_type: 'arrival',
    controlled: false,
    ctaf_freq: '122.8',
  }
  expect(pack.scenario_type).toBe('arrival')
  expect(pack.controlled).toBe(false)
})

test('ScenarioContext accepts squawk_code and approach_facility', () => {
  const ctx: ScenarioContext = {
    callsign: 'N12345',
    aircraft_type: 'C172',
    runway_in_use: '31',
    weather: { wind: '310@8', vis: '10SM', altimeter: '30.02' },
    atis_letter: 'Bravo',
    departure_taxiway: 'alpha',
    destination: 'practice_area_west',
    controller_voice_ids: {},
    squawk_code: '4721',
    approach_facility: 'NorCal Approach',
  }
  expect(ctx.squawk_code).toBe('4721')
  expect(ctx.approach_facility).toBe('NorCal Approach')
})

test('pickLine returns empty string for pilot_initiated beats', () => {
  const pack = loadPack(KPAO)
  const ctx = {
    callsign: 'N12345', aircraft_type: 'C172', runway_in_use: '31',
    weather: { wind: '310@8', vis: '10SM', altimeter: '30.02' },
    atis_letter: 'Bravo', departure_taxiway: 'alpha', destination: 'practice_area_west',
    controller_voice_ids: {}, squawk_code: '4721', approach_facility: 'Approach',
  }
  const beat = pack.beats[0]  // any existing beat
  // pilot_initiated override
  const pilotBeat = { ...beat, type: 'pilot_initiated' as const }
  expect(pickLine(pilotBeat, pack, ctx)).toBe('')
  // readback still returns non-empty
  expect(pickLine(beat, pack, ctx).length).toBeGreaterThan(0)
})
