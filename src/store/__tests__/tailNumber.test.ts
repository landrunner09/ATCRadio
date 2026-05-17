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

import { useFlightStore } from '@/store/flightStore'

beforeEach(() => {
  useFlightStore.setState({ tailNumber: 'N12345' })
})

test('tailNumber defaults to N12345', () => {
  const store = useFlightStore.getState()
  expect(store.tailNumber).toBe('N12345')
})

test('setTailNumber updates the store', () => {
  const store = useFlightStore.getState()
  store.setTailNumber('N8472K')
  expect(useFlightStore.getState().tailNumber).toBe('N8472K')
})
