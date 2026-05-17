import { useCallback, useEffect, useRef, useState } from 'react'
import { Platform } from 'react-native'
import { Audio } from 'expo-av'

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? ''
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? ''

export interface ASRResult {
  transcript: string
  confidence: number
  errorReason?: string   // populated when transcript is empty, for UI debug
}

interface ASRRecorderResult {
  isRecording: boolean
  startRecording: () => Promise<void>
  stopRecording: () => Promise<ASRResult>
}

async function transcribe(blob: Blob, filename: string): Promise<ASRResult> {
  const formData = new FormData()
  formData.append('audio', blob, filename)

  let res: Response
  try {
    res = await fetch(`${SUPABASE_URL}/functions/v1/asr`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
      body: formData,
    })
  } catch (e) {
    const reason = `network error: ${e}`
    console.error('[ASR]', reason)
    return { transcript: '', confidence: 0, errorReason: reason }
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    const reason = `HTTP ${res.status}: ${body}`
    console.warn('[ASR] server error:', reason)
    return { transcript: '', confidence: 0, errorReason: reason }
  }

  const data = await res.json()
  if (!data.transcript) {
    const reason = data.error ?? 'empty transcript from ASR'
    console.warn('[ASR]', reason)
    return { transcript: '', confidence: 0, errorReason: reason }
  }
  return { transcript: data.transcript, confidence: data.confidence ?? 0 }
}

// ─── Web path: native MediaRecorder ──────────────────────────────────────

function useWebRecorder(): ASRRecorderResult {
  const [isRecording, setIsRecording] = useState(false)
  // Persistent stream — acquired once so PTT start is instant with no dialog race
  const streamRef = useRef<MediaStream | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const stopResolveRef = useRef<((blob: Blob) => void) | null>(null)

  // Warm mic permission on mount so it's ready before first PTT press
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices) return
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then(stream => { streamRef.current = stream })
      .catch(e => console.warn('[ASR] mic init failed:', e))

    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
  }, [])

  const startRecording = useCallback(async () => {
    // Acquire stream if mount-time warm-up hasn't completed yet
    if (!streamRef.current) {
      try {
        streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true })
      } catch (e) {
        console.warn('[ASR] getUserMedia failed:', e)
        return
      }
    }

    chunksRef.current = []
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm'

    const mr = new MediaRecorder(streamRef.current, { mimeType })
    mediaRecorderRef.current = mr

    // timeslice=100ms: ondataavailable fires every 100ms while recording AND on stop.
    // Without this, the event only fires once on stop — a fast tap gets 0 bytes.
    mr.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }
    mr.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType })
      stopResolveRef.current?.(blob)
      stopResolveRef.current = null
    }

    mr.start(100)
    setIsRecording(true)
  }, [])

  const stopRecording = useCallback(async (): Promise<ASRResult> => {
    const mr = mediaRecorderRef.current
    if (!mr || mr.state === 'inactive') {
      console.warn('[ASR] stopRecording called but no active recorder')
      return { transcript: '', confidence: 0, errorReason: 'no active recorder' }
    }

    const blobPromise = new Promise<Blob>((resolve) => {
      stopResolveRef.current = resolve
    })

    mr.stop()
    mediaRecorderRef.current = null
    setIsRecording(false)

    const blob = await blobPromise
    console.log('[ASR] blob size:', blob.size, 'type:', blob.type)

    if (blob.size < 1000) {
      // Under ~1 KB almost certainly means silence or a mic issue
      console.warn('[ASR] blob too small to transcribe:', blob.size, 'bytes')
      return { transcript: '', confidence: 0, errorReason: `blob too small (${blob.size}B) — check mic` }
    }

    return transcribe(blob, 'recording.webm')
  }, [])

  return { isRecording, startRecording, stopRecording }
}

// ─── Native path: expo-av ─────────────────────────────────────────────────

function useNativeRecorder(): ASRRecorderResult {
  const [isRecording, setIsRecording] = useState(false)
  const recordingRef = useRef<Audio.Recording | null>(null)

  const startRecording = useCallback(async () => {
    if (recordingRef.current) {
      try { await recordingRef.current.stopAndUnloadAsync() } catch {}
      recordingRef.current = null
    }

    const { granted } = await Audio.requestPermissionsAsync()
    if (!granted) return

    await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true })

    const recording = new Audio.Recording()
    await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY)
    await recording.startAsync()
    recordingRef.current = recording
    setIsRecording(true)
  }, [])

  const stopRecording = useCallback(async (): Promise<ASRResult> => {
    const recording = recordingRef.current
    if (!recording) return { transcript: '', confidence: 0, errorReason: 'no active recorder' }

    await recording.stopAndUnloadAsync()
    setIsRecording(false)
    recordingRef.current = null

    const uri = recording.getURI()
    if (!uri) return { transcript: '', confidence: 0, errorReason: 'no URI from recording' }

    // Native: RN FormData file-reference trick — no blob fetch needed
    const formData = new FormData()
    formData.append('audio', { uri, name: 'recording.m4a', type: 'audio/m4a' } as unknown as Blob)

    let res: Response
    try {
      res = await fetch(`${SUPABASE_URL}/functions/v1/asr`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
        body: formData,
      })
    } catch (e) {
      console.error('[ASR] network error:', e)
      return { transcript: '', confidence: 0, errorReason: `network: ${e}` }
    }

    if (!res.ok) {
      console.warn('[ASR] server error:', res.status)
      return { transcript: '', confidence: 0, errorReason: `HTTP ${res.status}` }
    }

    const data = await res.json()
    return { transcript: data.transcript ?? '', confidence: data.confidence ?? 0 }
  }, [])

  return { isRecording, startRecording, stopRecording }
}

// ─── Export ───────────────────────────────────────────────────────────────

export function useASRRecorder(): ASRRecorderResult {
  const web = useWebRecorder()
  const native = useNativeRecorder()
  return Platform.OS === 'web' ? web : native
}
