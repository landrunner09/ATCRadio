// src/lib/__tests__/db.test.ts
const mockInsert = jest.fn()
const mockUpdate = jest.fn()

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn((table: string) => ({
      insert: mockInsert,
      update: mockUpdate,
    })),
  },
}))

import { createRun, saveAttempt, closeRun } from '../db'
import type { ScenarioContext } from '@/types/content'
import type { AttemptRecord } from '@/types/grader'

const ctx: ScenarioContext = {
  callsign: 'N8472K',
  aircraft_type: 'C172',
  runway_in_use: '31',
  departure_taxiway: 'alpha',
  atis_letter: 'Charlie',
  destination: 'KSFO',
  controller_voice_ids: { tower: 'voice-1' },
  weather: { wind: '310@8', vis: '10SM', altimeter: '30.10' },
  squawk_code: '',
  approach_facility: '',
}

const attempt: AttemptRecord = {
  beatId: 'beat_01',
  skillTag: 'taxi_readback',
  result: 'pass',
  gradeResult: null,
  timestamp: 1000,
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('createRun', () => {
  it('inserts a run row and returns the id', async () => {
    mockInsert.mockReturnValue({
      select: () => ({ single: () => Promise.resolve({ data: { id: 'run-123' }, error: null }) }),
    })
    const id = await createRun('user-1', ctx)
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'user-1', scenario_context: ctx })
    )
    expect(id).toBe('run-123')
  })

  it('throws on Supabase error', async () => {
    mockInsert.mockReturnValue({
      select: () => ({ single: () => Promise.resolve({ data: null, error: { message: 'DB error' } }) }),
    })
    await expect(createRun('user-1', ctx)).rejects.toThrow('DB error')
  })
})

describe('saveAttempt', () => {
  it('inserts attempt row without throwing', async () => {
    mockInsert.mockResolvedValue({ error: null })
    await expect(saveAttempt('run-123', attempt)).resolves.toBeUndefined()
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ run_id: 'run-123', beat_id: 'beat_01', skill_tag: 'taxi_readback', result: 'pass' })
    )
  })

  it('does not throw on Supabase error (fire-and-forget)', async () => {
    mockInsert.mockResolvedValue({ error: { message: 'fail' } })
    await expect(saveAttempt('run-123', attempt)).resolves.toBeUndefined()
  })
})

describe('closeRun', () => {
  it('updates ended_at and final_score', async () => {
    mockUpdate.mockReturnValue({
      eq: () => Promise.resolve({ error: null }),
    })
    await expect(closeRun('run-123', 87)).resolves.toBeUndefined()
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ final_score: 87 })
    )
  })

  it('does not throw on closeRun Supabase error', async () => {
    mockUpdate.mockReturnValue({
      eq: () => Promise.resolve({ error: { message: 'update failed' } }),
    })
    await expect(closeRun('run-123', 87)).resolves.toBeUndefined()
  })
})
