// Simple promise-based semaphore for limiting concurrency.
// Use: const sem = createSemaphore(3); await sem.run(() => doSomething())

export interface Semaphore {
  run<T>(fn: () => Promise<T>): Promise<T>
}

export function createSemaphore(limit: number): Semaphore {
  if (limit < 1) throw new Error('Semaphore limit must be >= 1')
  let active = 0
  const queue: Array<() => void> = []

  const acquire = (): Promise<void> => {
    if (active < limit) {
      active++
      return Promise.resolve()
    }
    return new Promise<void>(resolve => queue.push(resolve))
  }

  const release = (): void => {
    const next = queue.shift()
    if (next) {
      next()   // keep slot count constant — pass the active slot to the next waiter
    } else {
      active--
    }
  }

  return {
    async run<T>(fn: () => Promise<T>): Promise<T> {
      await acquire()
      try {
        return await fn()
      } finally {
        release()
      }
    },
  }
}
