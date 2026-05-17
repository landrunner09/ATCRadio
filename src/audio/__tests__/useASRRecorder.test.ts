import { renderHook, act } from '@testing-library/react-native'
import { useASRRecorder } from '../useASRRecorder'

jest.mock('expo-av', () => ({
  Audio: {
    requestPermissionsAsync: jest.fn(),
    setAudioModeAsync: jest.fn(),
    Recording: jest.fn().mockImplementation(() => ({
      prepareToRecordAsync: jest.fn().mockResolvedValue(undefined),
      startAsync: jest.fn().mockResolvedValue(undefined),
      stopAndUnloadAsync: jest.fn().mockResolvedValue(undefined),
      getURI: jest.fn().mockReturnValue('file:///tmp/recording.m4a'),
    })),
    RecordingOptionsPresets: {
      HIGH_QUALITY: {},
    },
  },
}))

global.fetch = jest.fn()
global.FormData = class {
  private data: Record<string, unknown> = {}
  append(key: string, value: unknown) { this.data[key] = value }
  get(key: string) { return this.data[key] }
} as unknown as typeof FormData

const { Audio } = require('expo-av')

describe('useASRRecorder', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(Audio.requestPermissionsAsync as jest.Mock).mockResolvedValue({ granted: true })
    ;(Audio.setAudioModeAsync as jest.Mock).mockResolvedValue(undefined)
  })

  it('startRecording sets isRecording to true', async () => {
    const { result } = renderHook(() => useASRRecorder())
    await act(async () => {
      await result.current.startRecording()
    })
    expect(result.current.isRecording).toBe(true)
  })

  it('stopRecording returns transcript and confidence from ASR edge function', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ transcript: 'Palo Alto Ground, Cessna niner', confidence: 0.92 }),
    })

    const { result } = renderHook(() => useASRRecorder())

    await act(async () => { await result.current.startRecording() })

    let asrResult: { transcript: string; confidence: number } | undefined
    await act(async () => {
      asrResult = await result.current.stopRecording()
    })

    expect(asrResult?.transcript).toBe('Palo Alto Ground, Cessna niner')
    expect(asrResult?.confidence).toBe(0.92)
    expect(result.current.isRecording).toBe(false)
  })

  it('returns empty transcript on fetch failure', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 500 })

    const { result } = renderHook(() => useASRRecorder())
    await act(async () => { await result.current.startRecording() })

    let asrResult: { transcript: string; confidence: number } | undefined
    await act(async () => {
      asrResult = await result.current.stopRecording()
    })

    expect(asrResult?.transcript).toBe('')
    expect(asrResult?.confidence).toBe(0)
  })
})
