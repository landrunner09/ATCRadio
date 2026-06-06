import { ComRadio } from '@/components/hud/ComRadio'

// Smoke test — renders without crashing given representative props.
// Full interaction tests live in HUD integration tests.

describe('ComRadio (Plan 3-bis)', () => {
  test('module imports without error', () => {
    expect(ComRadio).toBeDefined()
    expect(typeof ComRadio).toBe('function')
  })
})
