import { useCallback, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { AttemptRecord } from '@/types/grader'

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? ''
const FETCH_TIMEOUT_MS = 15_000

export interface CoachingResult {
  explanation: string
  aimCitation: string
  tip: string
}

type CoachingState = CoachingResult | 'loading' | 'error'

async function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

export function useCoaching() {
  const [coachingMap, setCoachingMap] = useState<Record<string, CoachingState>>({})
  const loadedKeys = useRef<Set<string>>(new Set())

  const loadCoaching = useCallback(async (attempt: AttemptRecord) => {
    const key = `${attempt.beatId}-${attempt.timestamp}`
    if (loadedKeys.current.has(key)) return
    loadedKeys.current.add(key)

    setCoachingMap(m => ({ ...m, [key]: 'loading' }))

    try {
      // Use the user's session token so the edge function can verify auth
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? ''

      const res = await fetchWithTimeout(
        `${SUPABASE_URL}/functions/v1/grade-explain`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            skillTag: attempt.skillTag,
            result: attempt.result,
            missingSlots: attempt.gradeResult?.missingCritical ?? [],
            missingStandard: attempt.gradeResult?.missingStandard ?? [],
            transcript: attempt.gradeResult?.rawTranscript ?? '',
          }),
        },
        FETCH_TIMEOUT_MS,
      )

      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: unknown = await res.json()
      if (typeof data !== 'object' || data === null) throw new Error('Bad response shape')

      const d = data as Record<string, unknown>
      const coaching: CoachingResult = {
        explanation: typeof d.explanation === 'string' ? d.explanation : '',
        aimCitation: typeof d.aimCitation === 'string' ? d.aimCitation : '',
        tip: typeof d.tip === 'string' ? d.tip : '',
      }
      setCoachingMap(m => ({ ...m, [key]: coaching }))
    } catch (e: unknown) {
      console.warn('[useCoaching] failed:', e instanceof Error ? e.message : e)
      setCoachingMap(m => ({ ...m, [key]: 'error' }))
    }
  }, [])

  function getCoaching(attempt: AttemptRecord): CoachingState | null {
    return coachingMap[`${attempt.beatId}-${attempt.timestamp}`] ?? null
  }

  return { loadCoaching, getCoaching }
}
