import { createActor } from 'xstate'
import { scenarioMachine } from '@/engine/machine'
import { generateScenarioContext } from '@/engine/context'
import type { ContentPack, ScenarioContext, Beat } from '@/types/content'

// Controlled test fixtures — do NOT use real KPAO pack because the structural
// tests below assume the first beat is a plain readback. Built-in packs now
// start with a listen_only ATIS beat which routes through tuning+awaiting_listen.

const ctx = generateScenarioContext(undefined, {
  callsign: 'N12345',
  runway_in_use: '31',
  atis_letter: 'Bravo',
  departure_taxiway: 'alpha',
})

const simpleReadback: Beat = {
  id: 'b0', phase: 'TAXI', skill_tag: 'taxi_readback',
  speaker: 'tower', voice_role: 'test_tower',
  line_template: '{callsign}, taxi.',
  line_variants: [],
  expected_student_response: {
    type: 'readback',
    required_slots: [
      { slot: 'callsign', value: '{callsign}', criticality: 'critical' },
      { slot: 'runway', value: '{runway}', criticality: 'standard' },
    ],
    phraseology_hints: [],
  },
  on_pass: { next: 'b1' },
  on_partial: { missing_critical: [], controller_correction: '', retry_same_beat: true, max_retries: 2 },
  on_fail_after_retries: { scaffold_mode: true, next_after_scaffold_pass: 'b1' },
  on_say_again: { replay_audio: true },
}

const lastBeat: Beat = { ...simpleReadback, id: 'b1', on_pass: { next: '__debrief__' } }

const pack: ContentPack = {
  airport_icao: 'TEST',
  airport_name: 'Test',
  city: '',
  tower_freq: '120.0',
  approach_freq: '121.0',
  atis_freq: '125.0',
  scenario_type: 'departure',
  controlled: true,
  pattern_altitude_ft: 1000,
  scenario_name: 'Test',
  scenario_description: '',
  estimated_duration_min: 0,
  beats: [simpleReadback, lastBeat],
}

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
    expect(actor.getSnapshot().matches({ tuning_or_speaking: 'atc_speaking' })).toBe(true)
    actor.stop()
  })

  test('transitions to awaiting_response on ATC_DONE', () => {
    const actor = startActor()
    actor.send({ type: 'START', pack, scenarioContext: ctx })
    actor.send({ type: 'CONFIRM' })
    actor.send({ type: 'ATC_DONE' })
    expect(actor.getSnapshot().matches({ tuning_or_speaking: 'awaiting_response' })).toBe(true)
    actor.stop()
  })

  test('advances beat on correct RESPOND', () => {
    const actor = startActor()
    actor.send({ type: 'START', pack, scenarioContext: ctx })
    actor.send({ type: 'CONFIRM' })
    actor.send({ type: 'ATC_DONE' })
    // Test pack first beat requires callsign + runway slots
    actor.send({
      type: 'RESPOND',
      transcript: 'runway thirty one, N12345',
      confidence: 0.95,
    })
    expect(actor.getSnapshot().matches({ tuning_or_speaking: 'atc_speaking' })).toBe(true)
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
    expect(actor.getSnapshot().matches({ tuning_or_speaking: 'atc_speaking' })).toBe(true)
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
    expect(actor.getSnapshot().matches({ tuning_or_speaking: 'atc_speaking' })).toBe(true)
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

// ── Plan 2 Phase C: compound tuning_or_speaking contract tests ────────────────
import type { Beat } from '@/types/content'

const makeBeat = (overrides: Partial<Beat>): Beat => ({
  id: 'b1', phase: 'TEST', skill_tag: 'test',
  speaker: 'tower', voice_role: 'test_tower', line_template: 'Hello',
  expected_student_response: { type: 'readback', required_slots: [], phraseology_hints: [] },
  on_pass: { next: '__debrief__' },
  on_partial: { missing_critical: [], controller_correction: '', retry_same_beat: true, max_retries: 2 },
  on_fail_after_retries: { scaffold_mode: true, next_after_scaffold_pass: '__debrief__' },
  on_say_again: { replay_audio: true },
  ...overrides,
})

function makePack(beats: Beat[]) {
  return { ...emptyPack, beats }
}

describe('new machine: tuning_or_speaking compound state (Plan 2)', () => {
  test('beat with tune_to enters tuning sub-state on CONFIRM', () => {
    const beat = makeBeat({ tune_to: '{tower_freq}', tune_label: 'Tower' })
    const actor = createActor(scenarioMachine).start()
    actor.send({ type: 'START', pack: makePack([beat]), scenarioContext: emptyCtx })
    actor.send({ type: 'CONFIRM' })
    expect(actor.getSnapshot().matches({ tuning_or_speaking: 'tuning' })).toBe(true)
    actor.stop()
  })

  test('beat with listen_only + tune_to: TUNED → awaiting_listen', () => {
    const beat = makeBeat({ listen_only: true, tune_to: '{atis_freq}', tune_label: 'ATIS' })
    const actor = createActor(scenarioMachine).start()
    actor.send({ type: 'START', pack: makePack([beat]), scenarioContext: emptyCtx })
    actor.send({ type: 'CONFIRM' })
    actor.send({ type: 'TUNED' })
    expect(actor.getSnapshot().matches({ tuning_or_speaking: 'awaiting_listen' })).toBe(true)
    actor.stop()
  })

  test('listen_only beat: LISTEN_TAPPED → atc_speaking → ATC_DONE → next beat', () => {
    const atis = makeBeat({ id: 'atis', listen_only: true, tune_to: '{atis_freq}', on_pass: { next: 'next' } })
    const next = makeBeat({ id: 'next' })
    const actor = createActor(scenarioMachine).start()
    actor.send({ type: 'START', pack: makePack([atis, next]), scenarioContext: emptyCtx })
    actor.send({ type: 'CONFIRM' })
    actor.send({ type: 'TUNED' })
    actor.send({ type: 'LISTEN_TAPPED' })
    expect(actor.getSnapshot().matches({ tuning_or_speaking: 'atc_speaking' })).toBe(true)
    actor.send({ type: 'ATC_DONE' })
    expect(actor.getSnapshot().context.beatIndex).toBe(1)
    actor.stop()
  })

  test('pilot_initiated beat with tune_to: TUNED → awaiting_response (no ATC speech)', () => {
    const beat = makeBeat({ type: 'pilot_initiated', tune_to: '{tower_freq}', tune_label: 'Tower' })
    const actor = createActor(scenarioMachine).start()
    actor.send({ type: 'START', pack: makePack([beat]), scenarioContext: emptyCtx })
    actor.send({ type: 'CONFIRM' })
    actor.send({ type: 'TUNED' })
    expect(actor.getSnapshot().matches({ tuning_or_speaking: 'awaiting_response' })).toBe(true)
    actor.stop()
  })

  test('readback beat without tune_to: skips tuning, goes straight to atc_speaking', () => {
    const beat = makeBeat({})  // default: readback, no tune_to
    const actor = createActor(scenarioMachine).start()
    actor.send({ type: 'START', pack: makePack([beat]), scenarioContext: emptyCtx })
    actor.send({ type: 'CONFIRM' })
    expect(actor.getSnapshot().matches({ tuning_or_speaking: 'atc_speaking' })).toBe(true)
    actor.stop()
  })

  test('readback beat: ATC_DONE → awaiting_response → RESPOND with empty transcript stays in awaiting_response', () => {
    const beat = makeBeat({})
    const actor = createActor(scenarioMachine).start()
    actor.send({ type: 'START', pack: makePack([beat]), scenarioContext: emptyCtx })
    actor.send({ type: 'CONFIRM' })
    actor.send({ type: 'ATC_DONE' })
    expect(actor.getSnapshot().matches({ tuning_or_speaking: 'awaiting_response' })).toBe(true)
    const beatIndexBefore = actor.getSnapshot().context.beatIndex
    const retriesBefore = actor.getSnapshot().context.retryCount
    actor.send({ type: 'RESPOND', transcript: '', confidence: 0 })
    expect(actor.getSnapshot().matches({ tuning_or_speaking: 'awaiting_response' })).toBe(true)
    expect(actor.getSnapshot().context.beatIndex).toBe(beatIndexBefore)
    expect(actor.getSnapshot().context.retryCount).toBe(retriesBefore)
    actor.stop()
  })

  test('SAY_AGAIN from awaiting_response returns to atc_speaking', () => {
    const beat = makeBeat({})
    const actor = createActor(scenarioMachine).start()
    actor.send({ type: 'START', pack: makePack([beat]), scenarioContext: emptyCtx })
    actor.send({ type: 'CONFIRM' })
    actor.send({ type: 'ATC_DONE' })
    actor.send({ type: 'SAY_AGAIN' })
    expect(actor.getSnapshot().matches({ tuning_or_speaking: 'atc_speaking' })).toBe(true)
    actor.stop()
  })

  test('SHOW_TILES from awaiting_response enters scaffold', () => {
    const beat = makeBeat({})
    const actor = createActor(scenarioMachine).start()
    actor.send({ type: 'START', pack: makePack([beat]), scenarioContext: emptyCtx })
    actor.send({ type: 'CONFIRM' })
    actor.send({ type: 'ATC_DONE' })
    actor.send({ type: 'SHOW_TILES' })
    expect(actor.getSnapshot().value).toBe('scaffold')
    actor.stop()
  })
})
