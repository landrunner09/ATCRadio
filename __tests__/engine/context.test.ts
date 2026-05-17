import { generateScenarioContext } from '@/engine/context'

test('uses provided tailNumber as callsign', () => {
  const ctx = generateScenarioContext(undefined, undefined, 'N8472K')
  expect(ctx.callsign).toBe('N8472K')
})

test('falls back to random callsign when tailNumber is empty string', () => {
  const ctx = generateScenarioContext(undefined, undefined, '')
  expect(ctx.callsign).toMatch(/^N\d/)
})

test('falls back to random callsign when tailNumber is undefined', () => {
  const ctx = generateScenarioContext(undefined, undefined, undefined)
  expect(ctx.callsign).toMatch(/^N\d/)
})

test('squawk_code is a 4-digit string with digits 0-7', () => {
  for (let i = 0; i < 20; i++) {
    const ctx = generateScenarioContext()
    expect(ctx.squawk_code).toMatch(/^[0-7]{4}$/)
    expect(['7500', '7600', '7700']).not.toContain(ctx.squawk_code)
  }
})

test('approach_facility defaults to "Approach"', () => {
  const ctx = generateScenarioContext()
  expect(ctx.approach_facility).toBe('Approach')
})

test('approach_facility uses override when provided', () => {
  const ctx = generateScenarioContext(undefined, { approach_facility: 'NorCal Approach' })
  expect(ctx.approach_facility).toBe('NorCal Approach')
})
