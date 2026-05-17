import { act, renderHook } from '@testing-library/react-native'

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: jest.fn().mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } }),
      signInWithPassword: jest.fn(),
      signUp: jest.fn(),
      signOut: jest.fn(),
    },
  },
}))

import { useAuthStore } from '../authStore'
const { supabase } = require('@/lib/supabase')

beforeEach(() => {
  useAuthStore.setState({ user: null, session: null, isGuest: false, loading: false })
  jest.clearAllMocks()
})

describe('authStore', () => {
  it('starts with null user and no guest flag', () => {
    const { result } = renderHook(() => useAuthStore())
    expect(result.current.user).toBeNull()
    expect(result.current.isGuest).toBe(false)
  })

  it('continueAsGuest sets isGuest true', () => {
    const { result } = renderHook(() => useAuthStore())
    act(() => result.current.continueAsGuest())
    expect(result.current.isGuest).toBe(true)
  })

  it('signIn calls supabase.auth.signInWithPassword', async () => {
    supabase.auth.signInWithPassword.mockResolvedValue({
      data: { user: { id: 'u1' }, session: { access_token: 'tok' } },
      error: null,
    })
    const { result } = renderHook(() => useAuthStore())
    await act(async () => { await result.current.signIn('a@b.com', 'pass') })
    expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'a@b.com', password: 'pass' })
  })

  it('signIn throws on error', async () => {
    supabase.auth.signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Invalid credentials' },
    })
    const { result } = renderHook(() => useAuthStore())
    await expect(
      act(async () => { await result.current.signIn('a@b.com', 'wrong') })
    ).rejects.toThrow('Invalid credentials')
  })

  it('signOut calls supabase.auth.signOut and clears state', async () => {
    useAuthStore.setState({ user: { id: 'u1' } as any, isGuest: false })
    supabase.auth.signOut.mockResolvedValue({ error: null })
    const { result } = renderHook(() => useAuthStore())
    await act(async () => { await result.current.signOut() })
    expect(result.current.user).toBeNull()
    expect(result.current.session).toBeNull()
  })
})
