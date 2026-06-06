import { dedupeFetch } from '../ttsDedup'

describe('TTS in-flight dedup (A5)', () => {
  test('two concurrent calls for the same key share one underlying fetch', async () => {
    let invocations = 0
    const fetcher = async () => {
      invocations++
      await new Promise(r => setTimeout(r, 50))
      return 'https://cache/result.mp3'
    }

    const [a, b] = await Promise.all([
      dedupeFetch('key-1', fetcher),
      dedupeFetch('key-1', fetcher),
    ])

    expect(a).toBe('https://cache/result.mp3')
    expect(b).toBe('https://cache/result.mp3')
    expect(invocations).toBe(1)
  })

  test('different keys do not dedupe', async () => {
    let invocations = 0
    const fetcher = async () => {
      invocations++
      return `url-${invocations}`
    }

    const [a, b] = await Promise.all([
      dedupeFetch('key-A', fetcher),
      dedupeFetch('key-B', fetcher),
    ])

    expect(a).not.toBe(b)
    expect(invocations).toBe(2)
  })

  test('pending entry clears on success so subsequent calls re-run', async () => {
    let invocations = 0
    const fetcher = async () => {
      invocations++
      return `url-${invocations}`
    }

    const first = await dedupeFetch('key-X', fetcher)
    const second = await dedupeFetch('key-X', fetcher)

    expect(first).toBe('url-1')
    expect(second).toBe('url-2')   // not deduped — first completed before second started
    expect(invocations).toBe(2)
  })

  test('pending entry clears on error so retries are possible', async () => {
    let invocations = 0
    const fetcher = async () => {
      invocations++
      throw new Error('boom')
    }

    await expect(dedupeFetch('key-err', fetcher)).rejects.toThrow('boom')
    await expect(dedupeFetch('key-err', fetcher)).rejects.toThrow('boom')

    expect(invocations).toBe(2)   // retry happened
  })
})
