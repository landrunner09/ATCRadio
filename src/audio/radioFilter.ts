// src/audio/radioFilter.ts
// Applies a radio-narrowband DSP chain (highpass 300 Hz → lowpass 3400 Hz → compressor)
// to a WAV/MP3 URL and plays it via Web Audio API.
// Returns a stop function for early cancellation.

const FETCH_TIMEOUT_MS = 12_000

async function fetchAudioBuffer(url: string): Promise<ArrayBuffer> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) throw new Error(`Audio fetch failed: HTTP ${response.status}`)
    return await response.arrayBuffer()
  } finally {
    clearTimeout(timer)
  }
}

export async function playWithRadioFilter(
  url: string,
  onEnd: () => void,
): Promise<() => void> {
  const arrayBuffer = await fetchAudioBuffer(url)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const AudioCtx = window.AudioContext ?? (window as any).webkitAudioContext
  const ctx = new AudioCtx() as AudioContext

  let buffer: AudioBuffer
  try {
    buffer = await ctx.decodeAudioData(arrayBuffer)
  } catch (err) {
    ctx.close()
    throw err
  }

  const source = ctx.createBufferSource()
  source.buffer = buffer

  const hp = ctx.createBiquadFilter()
  hp.type = 'highpass'; hp.frequency.value = 300; hp.Q.value = 0.7

  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'; lp.frequency.value = 3400; lp.Q.value = 0.7

  const comp = ctx.createDynamicsCompressor()
  comp.threshold.value = -24; comp.knee.value = 8; comp.ratio.value = 6
  comp.attack.value = 0.002; comp.release.value = 0.1

  source.connect(hp); hp.connect(lp); lp.connect(comp); comp.connect(ctx.destination)

  let ended = false
  const finish = () => {
    if (ended) return
    ended = true
    clearTimeout(fallbackTimer)
    ctx.close()
    onEnd()
  }

  source.onended = finish
  source.start()

  // Fallback timer: some browsers swallow onended after source.stop().
  // Close the context after expected duration + 200ms safety margin.
  const fallbackTimer = setTimeout(finish, (buffer.duration * 1000) + 200)

  return () => {
    if (ended) return
    try { source.stop() } catch { /* already stopped */ }
    // Don't close ctx immediately; let onended or the fallback timer close it.
    // But if neither fires within 200ms, force close.
    setTimeout(() => {
      if (!ended) {
        ended = true
        clearTimeout(fallbackTimer)
        ctx.close()
      }
    }, 200)
  }
}
