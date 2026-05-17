// src/store/flightStore.ts
import { create } from 'zustand'
import type { ContentPack, ScenarioContext } from '@/types/content'
import type { AttemptRecord } from '@/types/grader'
import type { BadgeId } from '@/lib/badges'
import { createRun, saveAttempt, closeRun } from '@/lib/db'
import { supabase } from '@/lib/supabase'

interface FlightStore {
  pack: ContentPack | null
  scenarioContext: ScenarioContext | null
  attempts: AttemptRecord[]
  isRunActive: boolean
  selectedAccent: string
  tailNumber: string
  runId: string | null
  masterySnapshot: Record<string, number>
  sessionNewBadges: BadgeId[]

  startRun: (pack: ContentPack, ctx: ScenarioContext, userId: string | null) => Promise<void>
  addAttempt: (attempt: AttemptRecord) => void
  endRun: () => Promise<void>
  setSelectedAccent: (accent: string) => void
  setTailNumber: (n: string) => void
  setSessionNewBadges: (ids: BadgeId[]) => void

  getScore: () => number
  getPassCount: () => number
  getPartialCount: () => number
  getScaffoldCount: () => number
}

export const useFlightStore = create<FlightStore>((set, get) => ({
  pack: null,
  scenarioContext: null,
  attempts: [],
  isRunActive: false,
  selectedAccent: 'american',
  tailNumber: 'N12345',
  runId: null,
  masterySnapshot: {},

  sessionNewBadges: [],

  startRun: async (pack, ctx, userId) => {
    set({ pack, scenarioContext: ctx, attempts: [], isRunActive: true, runId: null, masterySnapshot: {}, sessionNewBadges: [] })

    if (!userId) return

    // Snapshot current mastery for debrief delta (non-blocking)
    Promise.resolve(
      supabase.from('mastery').select('skill_tag, score').eq('user_id', userId)
    ).then(({ data }) => {
      if (data) {
        const snapshot: Record<string, number> = {}
        data.forEach((row: { skill_tag: string; score: number }) => {
          snapshot[row.skill_tag] = row.score
        })
        set({ masterySnapshot: snapshot })
      }
    }).catch((e: unknown) => console.warn('[flightStore] mastery snapshot failed:', e))

    try {
      const runId = await createRun(userId, ctx)
      set({ runId })
    } catch (e) {
      console.warn('[flightStore] createRun failed:', e)
    }
  },

  addAttempt: (attempt) => {
    set(state => ({ attempts: [...state.attempts, attempt] }))
    const { runId } = get()
    if (runId) saveAttempt(runId, attempt)
  },

  endRun: async () => {
    const { runId, getScore } = get()
    set({ isRunActive: false })
    if (runId) await closeRun(runId, getScore())
  },

  setSelectedAccent: (accent) => set({ selectedAccent: accent }),
  setTailNumber: (n) => set({ tailNumber: n }),
  setSessionNewBadges: (ids) => set({ sessionNewBadges: ids }),

  getScore: () => {
    const { attempts } = get()
    if (attempts.length === 0) return 0
    const weighted = attempts.reduce((sum, a) => {
      if (a.result === 'pass') return sum + 1
      if (a.result === 'partial') return sum + 0.5
      return sum
    }, 0)
    return Math.round((weighted / attempts.length) * 100)
  },

  getPassCount: () => get().attempts.filter(a => a.result === 'pass').length,
  getPartialCount: () => get().attempts.filter(a => a.result === 'partial').length,
  getScaffoldCount: () => get().attempts.filter(a => a.result === 'scaffold').length,
}))
