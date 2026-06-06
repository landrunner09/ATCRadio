// In-flight request deduplication helper.
// If two callers ask for the same key while a fetch is in flight,
// both await the same promise — one network call serves both.

const pendingMap = new Map<string, Promise<string>>()

export async function dedupeFetch(
  key: string,
  fetcher: () => Promise<string>,
): Promise<string> {
  const pending = pendingMap.get(key)
  if (pending) return pending

  const promise = (async () => {
    try {
      return await fetcher()
    } finally {
      // Clear pending on both success and failure so retries are possible
      pendingMap.delete(key)
    }
  })()

  pendingMap.set(key, promise)
  return promise
}

// Exposed for tests that need to reset state
export function _clearPendingForTests(): void {
  pendingMap.clear()
}
