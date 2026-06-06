import { useCallback, useEffect, useRef } from 'react'
import { Platform } from 'react-native'
import { Audio } from 'expo-av'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { playWithRadioFilter } from './radioFilter'
import { dedupeFetch } from './ttsDedup'
import { createSemaphore } from './semaphore'

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? ''
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? ''

// ─── URL cache ────────────────────────────────────────────────────────────────
// Two-tier: module-level Map (instant) + AsyncStorage (survives restarts, 30-day TTL)

const STORAGE_KEY = 'atcradio_tts_url_cache_v6'
const TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

const urlCache = new Map<string, string>()

// Lazy cache load — deferred until first TTS fetch to avoid module-init TDZ issues
// on web where AsyncStorage may not be fully initialised when the bundle first runs.
let cacheLoadPromise: Promise<void> | null = null

function ensureCacheLoaded(): Promise<void> {
  if (cacheLoadPromise) return cacheLoadPromise
  cacheLoadPromise = (async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const data = JSON.parse(raw) as Record<string, { url: string; ts: number }>
      const now = Date.now()
      for (const [k, { url, ts }] of Object.entries(data)) {
        if (now - ts < TTL_MS) urlCache.set(k, url)
      }
    } catch {}
  })()
  return cacheLoadPromise
}

async function persistCache() {
  try {
    const now = Date.now()
    const data: Record<string, { url: string; ts: number }> = {}
    for (const [k, url] of urlCache.entries()) {
      data[k] = { url, ts: now }
    }
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {}
}

// ─── Text normalization ───────────────────────────────────────────────────────
// Normalize before hashing so whitespace differences don't produce different keys.
function normalizeText(text: string): string {
  return text.trim().replace(/\s+/g, ' ')
}

function cacheKey(text: string, voiceName: string, instructions: string): string {
  // Simple hash of instructions to keep key short
  const instKey = instructions.slice(0, 40).replace(/\s+/g, '_')
  return `${voiceName}:${instKey}:${normalizeText(text)}`
}

// ─── TTS fetch ────────────────────────────────────────────────────────────────
async function fetchTTSUrl(text: string, voiceName: string, instructions: string): Promise<string> {
  await ensureCacheLoaded()
  const key = cacheKey(text, voiceName, instructions)
  const cached = urlCache.get(key)
  if (cached) return cached

  // Dedup concurrent network calls for the same key
  return dedupeFetch(key, async () => {
    const ttsUrl = `${SUPABASE_URL}/functions/v1/tts`
    const body = JSON.stringify({ text: normalizeText(text), voiceName, instructions })
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    }

    let lastErr: unknown
    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt > 0) await new Promise(r => setTimeout(r, 1500))
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 30_000)
      let res: Response
      try {
        res = await fetch(ttsUrl, { method: 'POST', headers, body, signal: controller.signal })
      } catch (fetchErr) {
        lastErr = new Error(`fetch→${ttsUrl}: ${fetchErr}`)
        continue
      } finally {
        clearTimeout(timer)
      }
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}))
        lastErr = new Error(errBody.error ?? `TTS ${res.status}`)
        continue
      }
      const { url } = await res.json()
      urlCache.set(key, url)
      persistCache()
      return url
    }
    throw lastErr instanceof Error ? lastErr : new Error('TTS fetch failed')
  })
}

// ─── Batch prefetch ───────────────────────────────────────────────────────────
// Module-level — one shared semaphore across all prefetch batches
const prefetchSemaphore = createSemaphore(3)

// Fire requests through a shared semaphore (max 3 concurrent OpenAI calls).
// Failures are silently swallowed (best-effort warm).
export async function prefetchTTSBatch(
  beats: Array<{ text: string; voiceName: string; instructions: string }>
): Promise<void> {
  await Promise.allSettled(
    beats
      .filter(b => b.text.trim())
      .map(b => prefetchSemaphore.run(() => fetchTTSUrl(b.text, b.voiceName, b.instructions)))
  )
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

interface TTSPlayerOptions {
  text: string
  voiceName: string
  instructions: string
  onEnd: () => void
}

interface TTSPlayerResult {
  play: () => Promise<void>
  replay: () => Promise<void>
  prefetch: () => Promise<void>
}

export function useTTSPlayer({ text, voiceName, instructions, onEnd }: TTSPlayerOptions): TTSPlayerResult {
  const soundRef = useRef<Audio.Sound | null>(null)
  const stopWebRef = useRef<(() => void) | null>(null)
  const mountedRef = useRef(true)
  const onEndRef = useRef(onEnd)
  useEffect(() => { onEndRef.current = onEnd }, [onEnd])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      soundRef.current?.unloadAsync()
      stopWebRef.current?.()
    }
  }, [])

  const playUrl = useCallback(async (url: string) => {
    if (Platform.OS === 'web') {
      stopWebRef.current?.()
      // Bail if component unmounted while we were awaiting upstream
      if (!mountedRef.current) return
      stopWebRef.current = await playWithRadioFilter(url, () => {
        if (mountedRef.current) onEndRef.current()
      })
      // Double-check after the await — playWithRadioFilter fetches audio
      if (!mountedRef.current) {
        stopWebRef.current?.()
        stopWebRef.current = null
      }
      return
    }

    if (soundRef.current) {
      await soundRef.current.unloadAsync()
      soundRef.current = null
    }
    if (!mountedRef.current) return

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
    })
    if (!mountedRef.current) return

    const { sound } = await Audio.Sound.createAsync({ uri: url })
    if (!mountedRef.current) {
      // Component unmounted while we were creating the sound — unload immediately
      sound.unloadAsync().catch(() => {})
      return
    }
    soundRef.current = sound
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish && mountedRef.current) {
        onEndRef.current()
      }
    })
    await sound.playAsync()
  }, [])

  const play = useCallback(async () => {
    const url = await fetchTTSUrl(text, voiceName, instructions)
    await playUrl(url)
  }, [text, voiceName, instructions, playUrl])

  const replay = useCallback(async () => {
    const url = await fetchTTSUrl(text, voiceName, instructions)
    await playUrl(url)
  }, [text, voiceName, instructions, playUrl])

  const prefetch = useCallback(async () => {
    try { await fetchTTSUrl(text, voiceName, instructions) } catch {}
  }, [text, voiceName, instructions])

  return { play, replay, prefetch }
}
