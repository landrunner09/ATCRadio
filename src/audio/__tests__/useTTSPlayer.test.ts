import { renderHook, act } from '@testing-library/react-native'
import { useTTSPlayer } from '../useTTSPlayer'

// Mock expo-av
jest.mock('expo-av', () => ({
  Audio: {
    setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
    Sound: {
      createAsync: jest.fn(),
    },
  },
}))

// Mock fetch
global.fetch = jest.fn()

const { Audio } = require('expo-av')

describe('useTTSPlayer', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('calls TTS edge function with correct params and plays returned URL', async () => {
    const fakeUrl = 'https://storage.example.com/tts-cache/abc123.mp3'
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ url: fakeUrl }),
    })

    const mockPlay = jest.fn().mockResolvedValue({})
    const mockUnload = jest.fn().mockResolvedValue({})
    const mockSound = {
      playAsync: mockPlay,
      unloadAsync: mockUnload,
      setOnPlaybackStatusUpdate: jest.fn(),
    }
    Audio.Sound.createAsync.mockResolvedValueOnce({ sound: mockSound })

    const onEnd = jest.fn()
    const { result } = renderHook(() =>
      useTTSPlayer({ text: 'Palo Alto traffic, Cessna 172', voiceName: 'en-US-Neural2-D', languageCode: 'en-US', onEnd })
    )

    await act(async () => {
      await result.current.play()
    })

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/functions/v1/tts'),
      expect.objectContaining({ method: 'POST' })
    )
    expect(Audio.Sound.createAsync).toHaveBeenCalledWith({ uri: fakeUrl })
    expect(mockPlay).toHaveBeenCalled()
  })

  it('replay() re-uses cached URL without re-fetching', async () => {
    const fakeUrl = 'https://storage.example.com/tts-cache/abc123.mp3'
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ url: fakeUrl }),
    })

    const mockPlay = jest.fn().mockResolvedValue({})
    const mockSound = {
      playAsync: mockPlay,
      unloadAsync: jest.fn().mockResolvedValue({}),
      setOnPlaybackStatusUpdate: jest.fn(),
    }
    Audio.Sound.createAsync.mockResolvedValue({ sound: mockSound })

    const { result } = renderHook(() =>
      useTTSPlayer({ text: 'Test text', voiceName: 'en-US-Neural2-D', languageCode: 'en-US', onEnd: jest.fn() })
    )

    await act(async () => { await result.current.play() })
    await act(async () => { await result.current.replay() })

    // fetch should only be called once (replay reuses cached URL)
    expect(global.fetch).toHaveBeenCalledTimes(1)
    expect(mockPlay).toHaveBeenCalledTimes(2)
  })

  it('calls onEnd when playback finishes', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ url: 'https://example.com/audio.mp3' }),
    })

    let statusCallback: ((status: any) => void) | null = null
    const mockSound = {
      playAsync: jest.fn().mockResolvedValue({}),
      unloadAsync: jest.fn().mockResolvedValue({}),
      setOnPlaybackStatusUpdate: jest.fn((cb) => { statusCallback = cb }),
    }
    Audio.Sound.createAsync.mockResolvedValueOnce({ sound: mockSound })

    const onEnd = jest.fn()
    const { result } = renderHook(() =>
      useTTSPlayer({ text: 'Test', voiceName: 'en-US-Neural2-D', languageCode: 'en-US', onEnd })
    )

    await act(async () => { await result.current.play() })

    // Simulate playback finishing
    act(() => {
      statusCallback?.({ isLoaded: true, didJustFinish: true })
    })

    expect(onEnd).toHaveBeenCalledTimes(1)
  })
})
