// src/store/__tests__/flightStore.test.ts
jest.mock('@/lib/db', () => ({
  createRun: jest.fn().mockResolvedValue('run-xyz'),
  saveAttempt: jest.fn().mockResolvedValue(undefined),
  closeRun: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve({ data: [], error: null })),
      })),
    })),
  },
}))

import { act, renderHook } from '@testing-library/react-native'
import { useFlightStore } from '../flightStore'
import { createRun, saveAttempt, closeRun } from '@/lib/db'
import type { ScenarioContext } from '@/types/content'
import type { AttemptRecord } from '@/types/grader'

const ctx: ScenarioContext = {
  callsign: 'N8472K', aircraft_type: 'C172', runway_in_use: '31',
  departure_taxiway: 'alpha', atis_letter: 'Charlie',
  destination: 'KHAF',
  controller_voice_ids: {},
  weather: { wind: '310@8', vis: '10SM', altimeter: '30.10' },
  squawk_code: '',
  approach_facility: '',
}

const mockPack = { beats: [], tower_freq: '118.6', approach_freq: '120.1' } as any

const attempt: AttemptRecord = {
  beatId: 'beat_01', skillTag: 'taxi_readback',
  result: 'pass', gradeResult: null, timestamp: 1000,
}

beforeEach(() => {
  useFlightStore.setState({
    pack: null, scenarioContext: null, attempts: [],
    isRunActive: false, selectedAccent: 'american',
    runId: null, masterySnapshot: {},
  })
  jest.clearAllMocks()
})

describe('flightStore with persistence', () => {
  it('startRun with userId calls createRun and stores runId', async () => {
    const { result } = renderHook(() => useFlightStore())
    await act(async () => { await result.current.startRun(mockPack, ctx, 'user-1') })
    expect(createRun).toHaveBeenCalledWith('user-1', ctx)
    expect(result.current.runId).toBe('run-xyz')
  })

  it('startRun without userId skips createRun (guest mode)', async () => {
    const { result } = renderHook(() => useFlightStore())
    await act(async () => { await result.current.startRun(mockPack, ctx, null) })
    expect(createRun).not.toHaveBeenCalled()
    expect(result.current.runId).toBeNull()
  })

  it('addAttempt calls saveAttempt when runId is set', async () => {
    useFlightStore.setState({ runId: 'run-xyz' })
    const { result } = renderHook(() => useFlightStore())
    act(() => result.current.addAttempt(attempt))
    expect(saveAttempt).toHaveBeenCalledWith('run-xyz', attempt)
  })

  it('addAttempt skips saveAttempt when no runId (guest)', () => {
    useFlightStore.setState({ runId: null })
    const { result } = renderHook(() => useFlightStore())
    act(() => result.current.addAttempt(attempt))
    expect(saveAttempt).not.toHaveBeenCalled()
  })

  it('endRun calls closeRun with final score when runId is set', async () => {
    useFlightStore.setState({
      runId: 'run-xyz',
      attempts: [{ ...attempt, result: 'pass' }],
    })
    const { result } = renderHook(() => useFlightStore())
    await act(async () => { await result.current.endRun() })
    expect(closeRun).toHaveBeenCalledWith('run-xyz', expect.any(Number))
  })
})
