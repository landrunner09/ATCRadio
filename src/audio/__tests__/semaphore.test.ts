import { createSemaphore } from '../semaphore'

describe('semaphore (A6 prefetch backpressure)', () => {
  test('limits concurrency to N', async () => {
    const sem = createSemaphore(3)
    let active = 0
    let peak = 0

    const task = () => sem.run(async () => {
      active++
      peak = Math.max(peak, active)
      await new Promise(r => setTimeout(r, 20))
      active--
      return 'done'
    })

    const results = await Promise.all(Array.from({ length: 10 }, task))
    expect(results.every(r => r === 'done')).toBe(true)
    expect(peak).toBeLessThanOrEqual(3)
  })

  test('failed tasks release their slot', async () => {
    const sem = createSemaphore(2)
    let active = 0
    let peak = 0

    const failTask = () => sem.run(async () => {
      active++
      peak = Math.max(peak, active)
      await new Promise(r => setTimeout(r, 10))
      active--
      throw new Error('expected')
    })

    const results = await Promise.allSettled(Array.from({ length: 5 }, failTask))
    expect(results.every(r => r.status === 'rejected')).toBe(true)
    expect(peak).toBeLessThanOrEqual(2)
    expect(active).toBe(0)
  })

  test('processes all queued tasks without deadlock', async () => {
    const sem = createSemaphore(2)
    const order: number[] = []
    const tasks = [50, 10, 30, 20].map((delay, i) =>
      sem.run(async () => {
        await new Promise(r => setTimeout(r, delay))
        order.push(i)
      })
    )
    await Promise.all(tasks)
    expect(order).toHaveLength(4)
  })
})
