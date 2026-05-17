import { useCallback, useEffect, useRef } from 'react'
import { Platform } from 'react-native'
import { Audio } from 'expo-av'
import { playWithRadioFilter } from './radioFilter'

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? ''
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? ''

// Module-level cache: survives beat transitions (hook re-instantiation).
// Key: `${languageCode}:${voiceName}:${text}`
const ttsUrlCache = new Map<string, string>()

function cacheKey(text: string, voiceName: string, languageCode: string) {
  return `${languageCode}:${voiceName}:${text}`
}

async function fetchTTSUrl(text: string, voiceName: string, languageCode: string): Promise<string> {
  const key = cacheKey(text, voiceName, languageCode)
  const cached = ttsUrlCache.get(key)
  if (cached) return cached

  const ttsUrl = `${SUPABASE_URL}/functions/v1/tts`
  const body = JSON.stringify({ text, voiceName, languageCode })
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
  }

  let lastErr: unknown
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, 1500))
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 12_000)
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
    ttsUrlCache.set(key, url)
    return url
  }
  throw lastErr
}

interface TTSPlayerOptions {
  text: string
  voiceName: string
  languageCode: string
  onEnd: () => void
}

interface TTSPlayerResult {
  play: () => Promise<void>
  replay: () => Promise<void>
  prefetch: () => Promise<void>
}

export function useTTSPlayer({ text, voiceName, languageCode, onEnd }: TTSPlayerOptions): TTSPlayerResult {
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
      stopWebRef.current = await playWithRadioFilter(url, () => {
        if (mountedRef.current) onEndRef.current()
      })
      return
    }

    if (soundRef.current) {
      await soundRef.current.unloadAsync()
      soundRef.current = null
    }
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
    })
    const { sound } = await Audio.Sound.createAsync({ uri: url })
    soundRef.current = sound
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish && mountedRef.current) {
        onEndRef.current()
      }
    })
    await sound.playAsync()
  }, [])

  const play = useCallback(async () => {
    const url = await fetchTTSUrl(text, voiceName, languageCode)
    await playUrl(url)
  }, [text, voiceName, languageCode, playUrl])

  const replay = useCallback(async () => {
    const url = await fetchTTSUrl(text, voiceName, languageCode)
    await playUrl(url)
  }, [text, voiceName, languageCode, playUrl])

  const prefetch = useCallback(async () => {
    try { await fetchTTSUrl(text, voiceName, languageCode) } catch {}
  }, [text, voiceName, languageCode])

  return { play, replay, prefetch }
}
