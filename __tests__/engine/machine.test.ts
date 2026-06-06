import { createActor } from 'xstate'
import { scenarioMachine } from '@/engine/machine'
import KPAO from '@/content/KPAO.json'
import { generateScenarioContext } from '@/engine/context'
import { loadPack } from '@/engine/loader'
import type { ContentPack, ScenarioContext } from '@/types/content'

const pack = loadPack(KPAO)
const ctx = generateScenarioContext(undefined, {
  callsign: 'N12345',
  runway_in_use: '31',
  atis_letter: 'Bravo',
  departure_taxiway: 'alpha',
})

function startActor() {
  const actor = createActor(scenarioMachine)
  actor.start()
  return actor
}

describe('scenarioMachine', () => {
  test('starts in idle state', () => {
    const actor = startActor()
    expect(actor.getSnapshot().value).toBe('idle')
    actor.stop()
  })

  test('transitions to preflight on START', () => {
    const actor = startActor()
    actor.send({ type: 'START', pack, scenarioContext: ctx })
    expect(actor.getSnapshot().value).toBe('preflight')
    actor.stop()
  })

  test('transitions to atc_speaking on CONFIRM', () => {
    const actor = startActor()
    actor.send({ type: 'START', pack, scenarioContext: ctx })
    actor.send({ type: 'CONFIRM' })
    expect(actor.getSnapshot().value).toBe('atc_speaking')
    actor.stop()
  })

  test('transitions to awaiting_response on ATC_DONE', () => {
    const actor = startActor()
    actor.send({ type: 'START', pack, scenarioContext: ctx })
    actor.send({ type: 'CONFIRM' })
    actor.send({ type: 'ATC_DONE' })
    expect(actor.getSnapshot().value).toBe('awaiting_response')
    actor.stop()
  })

  test('advances beat on correct RESPOND', () => {
    const actor = startActor()
    actor.send({ type: 'START', pack, scenarioContext: ctx })
    actor.send({ type: 'CONFIRM' })
    actor.send({ type: 'ATC_DONE' })
    // ATIS beat: respond with atis letter, runway, altimeter (all standard slots)
    actor.send({
      type: 'RESPOND',
      transcript: 'information bravo runway thirty one altimeter thirty zero two',
      confidence: 0.95,
    })
    expect(actor.getSnapshot().value).toBe('atc_speaking')
    expect(actor.getSnapshot().context.beatIndex).toBe(1)
    actor.stop()
  })

  test('goes to scaffold after max retries', () => {
    const actor = startActor()
    actor.send({ type: 'START', pack, scenarioContext: ctx })
    actor.send({ type: 'CONFIRM' })
    actor.send({ type: 'ATC_DONE' })
    // Send wrong response 3 times (max_retries is 2, so 3rd fail = scaffold)
    for (let i = 0; i < 3; i++) {
      if (actor.getSnapshot().value === 'scaffold') break
      actor.send({ type: 'RESPOND', transcript: 'uh...', confidence: 0.95 })
      if (actor.getSnapshot().value !== 'scaffold') {
        actor.send({ type: 'ATC_DONE' })
      }
    }
    expect(actor.getSnapshot().value).toBe('scaffold')
    actor.stop()
  })

  test('SAY_AGAIN goes back to atc_speaking', () => {
    const actor = startActor()
    actor.send({ type: 'START', pack, scenarioContext: ctx })
    actor.send({ type: 'CONFIRM' })
    actor.send({ type: 'ATC_DONE' })
    actor.send({ type: 'SAY_AGAIN' })
    expect(actor.getSnapshot().value).toBe('atc_speaking')
    actor.stop()
  })

  test('SCAFFOLD_PASS advances beat', () => {
    const actor = startActor()
    actor.send({ type: 'START', pack, scenarioContext: ctx })
    actor.send({ type: 'CONFIRM' })
    actor.send({ type: 'ATC_DONE' })
    actor.send({ type: 'SHOW_TILES' })
    expect(actor.getSnapshot().value).toBe('scaffold')
    actor.send({ type: 'SCAFFOLD_PASS' })
    expect(actor.getSnapshot().value).toBe('atc_speaking')
    expect(actor.getSnapshot().context.beatIndex).toBe(1)
    actor.stop()
  })

  test('reaches debrief after last beat passes', () => {
    const actor = startActor()
    actor.send({ type: 'START', pack, scenarioContext: ctx })
    actor.send({ type: 'CONFIRM' })
    // Use scaffold to fast-forward through all beats
    for (let i = 0; i < pack.beats.length; i++) {
      actor.send({ type: 'ATC_DONE' })
      actor.send({ type: 'SHOW_TILES' })
      actor.send({ type: 'SCAFFOLD_PASS' })
    }
    expect(actor.getSnapshot().value).toBe('debrief')
    actor.stop()
  })
})

// ── A3: Empty beats guard ──────────────────────────────────────────────────

const emptyPack: ContentPack = {
  airport_icao: 'TEST',
  airport_name: 'Test',
  city: '',
  tower_freq: '120.0',
  approach_freq: '121.0',
  atis_freq: '125.0',
  scenario_type: 'departure',
  controlled: true,
  pattern_altitude_ft: 1000,
  scenario_name: 'Empty',
  scenario_description: '',
  estimated_duration_min: 0,
  beats: [],   // <-- the test case
}

const emptyCtx: ScenarioContext = {
  callsign: 'N12345', aircraft_type: 'C172', runway_in_use: '31',
  weather: { wind: '310 at 8', vis: '10SM', altimeter: '30.02' },
  atis_letter: 'Bravo', departure_taxiway: 'alpha', destination: 'practice_area_west',
  controller_voice_ids: {}, squawk_code: '4523', approach_facility: 'Approach',
}

describe('scenarioMachine empty beats guard (A3)', () => {
  test('START with empty pack.beats transitions directly to debrief (no deadlock)', () => {
    const actor = createActor(scenarioMachine).start()
    actor.send({ type: 'START', pack: emptyPack, scenarioContext: emptyCtx })
    expect(actor.getSnapshot().value).toBe('debrief')
    actor.stop()
  })

  test('START with non-empty pack.beats still transitions to preflight (existing behavior)', () => {
    const oneBeatPack: ContentPack = {
      ...emptyPack,
      beats: [{
        id: 'test.beat', phase: 'TAXI', skill_tag: 'taxi_readback',
        speaker: 'tower' as const, voice_role: 'test_tower', line_template: 'Test',
        expected_student_response: { type: 'readback', required_slots: [], phraseology_hints: [] },
        on_pass: { next: '__debrief__' },
        on_partial: { missing_critical: [], controller_correction: '', retry_same_beat: true, max_retries: 2 },
        on_fail_after_retries: { scaffold_mode: true, next_after_scaffold_pass: '__debrief__' },
        on_say_again: { replay_audio: true },
      }],
    }
    const actor = createActor(scenarioMachine).start()
    actor.send({ type: 'START', pack: oneBeatPack, scenarioContext: emptyCtx })
    expect(actor.getSnapshot().value).toBe('preflight')
    actor.stop()
  })
})
