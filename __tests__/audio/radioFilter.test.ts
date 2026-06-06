/**
 * AudioContext leak test — verifies that abrupt-stop scenarios close
 * the underlying AudioContext within a bounded time window.
 *
 * We mock `window.AudioContext` to count open instances. The real Web
 * Audio API is not available in Jest.
 */

// Mock factory tracks all created contexts and exposes a count of open ones.
const openContexts = new Set<MockContext>()

class MockContext {
  state: 'running' | 'closed' = 'running'
  destination = { connect: jest.fn() }
  constructor() { openContexts.add(this) }
  close = jest.fn(() => { this.state = 'closed'; openContexts.delete(this); return Promise.resolve() })
  createBufferSource = jest.fn(() => {
    const onended = { fn: null as null | (() => void) }
    return {
      buffer: null,
      connect: jest.fn(),
      start: jest.fn(),
      stop: jest.fn(),
      get onended() { return onended.fn },
      set onended(fn: (() => void) | null) { onended.fn = fn },
    }
  })
  createBiquadFilter = jest.fn(() => ({ type: '', frequency: { value: 0 }, Q: { value: 0 }, connect: jest.fn() }))
  createDynamicsCompressor = jest.fn(() => ({
    threshold: { value: 0 }, knee: { value: 0 }, ratio: { value: 0 },
    attack: { value: 0 }, release: { value: 0 }, connect: jest.fn(),
  }))
  decodeAudioData = jest.fn().mockResolvedValue({ duration: 1.5 })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
;(global as any).window = { AudioContext: MockContext }

// Mock fetch to return a small ArrayBuffer
global.fetch = jest.fn().mockResolvedValue({
  ok: true,
  arrayBuffer: () => Promise.resolve(new ArrayBuffer(64)),
}) as unknown as typeof fetch

// Static import — works with Babel/jest-expo (no --experimental-vm-modules needed).
// window.AudioContext is set above at module scope before the module is evaluated.
import { playWithRadioFilter } from '@/audio/radioFilter'

beforeEach(() => {
  openContexts.clear()
})

afterEach(() => {
  jest.useRealTimers()
})

describe('radioFilter AudioContext leak fix (A4)', () => {
  test('AudioContext is closed when stop() is called before onended fires', async () => {
    jest.useFakeTimers()

    const onEnd = jest.fn()
    const stop = await playWithRadioFilter('http://test/audio.mp3', onEnd)

    expect(openContexts.size).toBe(1)
    stop()
    jest.advanceTimersByTime(2500)
    expect(openContexts.size).toBe(0)
  })

  test('multiple rapid play/stop cycles do not leak contexts', async () => {
    jest.useFakeTimers()

    for (let i = 0; i < 10; i++) {
      const stop = await playWithRadioFilter(`http://test/${i}.mp3`, jest.fn())
      stop()
    }
    jest.advanceTimersByTime(2500)
    expect(openContexts.size).toBe(0)
  })
})
