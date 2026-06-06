/**
 * Verifies that flightStore.endRun() awaits all in-flight saveAttempt
 * calls before resolving (and before closeRun fires).
 */

// Mock @/lib/db — control saveAttempt's resolution timing
const saveAttemptResolvers: Array<() => void> = []
let closeRunCalled = false

jest.mock('@/lib/db', () => ({
  createRun: jest.fn().mockResolvedValue('test-run-id'),
  saveAttempt: jest.fn(() => new Promise<void>(resolve => {
    saveAttemptResolvers.push(resolve)
  })),
  closeRun: jest.fn(() => {
    closeRunCalled = true
    return Promise.resolve()
  }),
}))

// Mock supabase + badges so they don't blow up
jest.mock('@/lib/supabase', () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => Promise.resolve({ data: [] }) }) }) },
}))
jest.mock('@/lib/badges', () => ({}))

import { useFlightStore } from '@/store/flightStore'

beforeEach(() => {
  saveAttemptResolvers.length = 0
  closeRunCalled = false
  useFlightStore.setState({
    pack: null, scenarioContext: null, attempts: [],
    isRunActive: false, runId: null, masterySnapshot: {}, sessionNewBadges: [],
    pendingAttempts: [],
  })
})

describe('flightStore.endRun awaits pending attempts (A9)', () => {
  test('closeRun is not called until all saveAttempt promises resolve', async () => {
    const minimalPack = { airport_icao: 'TEST', airport_name: '', city: '',
      tower_freq: '', approach_freq: '', atis_freq: '',
      scenario_type: 'departure' as const, controlled: true,
      pattern_altitude_ft: 0, scenario_name: '', scenario_description: '',
      estimated_duration_min: 0, beats: [] }
    const ctx = { callsign: 'N12345', aircraft_type: 'C172', runway_in_use: '31',
      weather: { wind: '', vis: '', altimeter: '' }, atis_letter: 'A',
      departure_taxiway: 'a', destination: '', controller_voice_ids: {},
      squawk_code: '4523', approach_facility: 'Approach' }

    await useFlightStore.getState().startRun(minimalPack, ctx, 'user-1')
    // Add 3 attempts — each triggers a saveAttempt that doesn't resolve yet
    for (let i = 0; i < 3; i++) {
      useFlightStore.getState().addAttempt({
        beat_id: `b${i}`, skill_tag: 'taxi', result: 'pass',
        transcript: '', confidence: 1, missing_slots: [], created_at: new Date().toISOString(),
      })
    }
    expect(saveAttemptResolvers).toHaveLength(3)

    // Fire endRun but don't await yet
    const endRunPromise = useFlightStore.getState().endRun()
    // Give microtasks a tick
    await new Promise(r => setTimeout(r, 10))
    expect(closeRunCalled).toBe(false)   // <-- KEY assertion

    // Resolve all pending attempts
    saveAttemptResolvers.forEach(r => r())
    await endRunPromise

    expect(closeRunCalled).toBe(true)
  })
})
