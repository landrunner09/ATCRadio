// src/hooks/__tests__/useStats.test.ts
const mockSelect = jest.fn()
const mockEq = jest.fn()
const mockOrder = jest.fn()
const mockLimit = jest.fn()

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: mockSelect,
    })),
  },
}))

import { renderHook, waitFor } from '@testing-library/react-native'
import { useStats } from '../useStats'

function mockChain(data: any) {
  const chain: any = { data, error: null }
  mockLimit.mockResolvedValue(chain)
  mockOrder.mockReturnValue({ limit: mockLimit })
  mockEq.mockReturnValue({ order: mockOrder, limit: mockLimit })
  mockSelect.mockReturnValue({ eq: mockEq, order: mockOrder })
}

describe('useStats', () => {
  beforeEach(() => jest.clearAllMocks())

  it('returns loading true initially', () => {
    mockChain([])
    const { result } = renderHook(() => useStats('user-1'))
    expect(result.current.loading).toBe(true)
  })

  it('computes totalFlights from runs data', async () => {
    const runs = [
      { id: 'r1', started_at: '2026-05-10T10:00:00Z', final_score: 90 },
      { id: 'r2', started_at: '2026-05-11T10:00:00Z', final_score: 80 },
    ]
    mockChain(runs)
    const { result } = renderHook(() => useStats('user-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.totalFlights).toBe(2)
  })

  it('computes avgScore correctly', async () => {
    const runs = [
      { id: 'r1', started_at: '2026-05-10T10:00:00Z', final_score: 90 },
      { id: 'r2', started_at: '2026-05-11T10:00:00Z', final_score: 80 },
    ]
    mockChain(runs)
    const { result } = renderHook(() => useStats('user-1'))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.avgScore).toBe(85)
  })

  it('returns empty stats for guest (null userId)', async () => {
    const { result } = renderHook(() => useStats(null))
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.totalFlights).toBe(0)
    expect(mockSelect).not.toHaveBeenCalled()
  })
})
