import { create } from 'zustand'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

interface AuthStore {
  user: User | null
  session: Session | null
  isGuest: boolean
  loading: boolean
  init: () => void
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  continueAsGuest: () => void
  signOut: () => Promise<void>
}

let initialized = false

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  session: null,
  isGuest: false,
  loading: true,

  init: () => {
    if (initialized) return
    initialized = true

    supabase.auth.getSession().then(({ data }) => {
      set({ user: data.session?.user ?? null, session: data.session, loading: false })
    })
    supabase.auth.onAuthStateChange((_event, session) => {
      set({ user: session?.user ?? null, session, loading: false })
    })
  },

  signIn: async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw new Error(error.message)
    set({ user: data.user, session: data.session, isGuest: false })
  },

  signUp: async (email, password) => {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) throw new Error(error.message)
    set({ user: data.user ?? null, session: data.session ?? null, isGuest: false })
  },

  continueAsGuest: () => set({ isGuest: true }),

  signOut: async () => {
    await supabase.auth.signOut()
    set({ user: null, session: null, isGuest: false })
  },
}))
