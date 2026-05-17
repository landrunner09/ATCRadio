// src/audio/radioAmbience.ts
// Generates looping pink noise through a radio narrowband filter chain.
// Used for background static during student response windows (web only).

const BUFFER_SECONDS = 2

// Paul Kellett's pink noise approximation — fills a Float32Array with pink noise at given gain.
function fillPinkNoise(data: Float32Array, gain: number): void {
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0
  for (let i = 0; i < data.length; i++) {
    const w = Math.random() * 2 - 1
    b0 = 0.99886 * b0 + w * 0.0555179
    b1 = 0.99332 * b1 + w * 0.0750759
    b2 = 0.96900 * b2 + w * 0.1538520
    b3 = 0.86650 * b3 + w * 0.3104856
    b4 = 0.55000 * b4 + w * 0.5329522
    b5 = -0.7616 * b5 - w * 0.0168980
    data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * gain
    b6 = w * 0.115926
  }
}

export interface RadioAmbienceSession {
  start(): void
  stop(): void
  cleanup(): void
}

export function createRadioAmbienceSession(): RadioAmbienceSession {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const AudioCtx = window.AudioContext ?? (window as any).webkitAudioContext as typeof AudioContext
  const ctx = new AudioCtx()

  // Pre-generate 2 s of pink noise — looped, zero latency restarts
  const buf = ctx.createBuffer(1, ctx.sampleRate * BUFFER_SECONDS, ctx.sampleRate)
  fillPinkNoise(buf.getChannelData(0), 0.018)

  // Same narrowband filter chain as radioFilter.ts
  const hp = ctx.createBiquadFilter()
  hp.type = 'highpass'; hp.frequency.value = 300; hp.Q.value = 0.7

  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'; lp.frequency.value = 3400; lp.Q.value = 0.7

  // Very low gain — real squelch noise sits at ~-50 dBFS, barely perceptible
  const gainNode = ctx.createGain()
  gainNode.gain.value = 0.07

  hp.connect(lp)
  lp.connect(gainNode)
  gainNode.connect(ctx.destination)

  let source: AudioBufferSourceNode | null = null
  let active = false

  return {
    start() {
      if (active) return
      active = true
      source = ctx.createBufferSource()
      source.buffer = buf
      source.loop = true
      source.connect(hp)
      source.start()
    },
    stop() {
      if (!active) return
      active = false
      try { source?.stop() } catch { /* already stopped */ }
      source = null
    },
    cleanup() {
      try { source?.stop() } catch { /* ignore */ }
      ctx.close()
    },
  }
}
