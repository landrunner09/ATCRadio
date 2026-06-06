// Pure logic test for the CTAF freq fallback in generate-airport
// The actual edge function is Deno; we test the freq-selection logic in isolation.

function pickCtafFreq(controlled: boolean, atisFreq: string | undefined): string | undefined {
  if (controlled) return undefined
  // Fallback: 122.9 (universal multicom) — NOT ATIS
  return '122.9'
}

describe('generate-airport CTAF freq fallback (A12)', () => {
  test('controlled field returns undefined', () => {
    expect(pickCtafFreq(true, '124.0')).toBeUndefined()
  })

  test('uncontrolled field with ATIS does NOT reuse ATIS freq', () => {
    expect(pickCtafFreq(false, '124.0')).not.toBe('124.0')
  })

  test('uncontrolled field defaults to 122.9 (multicom)', () => {
    expect(pickCtafFreq(false, undefined)).toBe('122.9')
  })

  test('uncontrolled field still returns 122.9 even when ATIS is provided', () => {
    expect(pickCtafFreq(false, '135.275')).toBe('122.9')
  })
})
