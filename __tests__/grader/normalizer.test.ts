import { normalizePhonetic } from '@/grader/normalizer'

describe('normalizePhonetic', () => {
  test('maps spoken digits to numerals', () => {
    expect(normalizePhonetic('niner')).toContain('9')
    expect(normalizePhonetic('tree')).toContain('3')
    expect(normalizePhonetic('fife')).toContain('5')
  })

  test('maps ICAO phonetic alphabet to letters', () => {
    const result = normalizePhonetic('november one two three four five')
    expect(result).toContain('n')
    expect(result).toContain('1')
    expect(result).toContain('2')
    expect(result).toContain('3')
    expect(result).toContain('4')
    expect(result).toContain('5')
  })

  test('normalizes "runway three one" to contain digits', () => {
    const result = normalizePhonetic('runway three one')
    expect(result).toContain('3')
    expect(result).toContain('1')
  })

  test('lowercases output', () => {
    expect(normalizePhonetic('NOVEMBER')).toBe('n')
  })

  test('strips extra whitespace', () => {
    expect(normalizePhonetic('  niner  ')).toBe('9')
  })

  test('handles frequency "one twenty one point three"', () => {
    const result = normalizePhonetic('one twenty one point three')
    expect(result).toContain('121')
    expect(result).toContain('3')
  })

  test('handles empty string', () => {
    expect(normalizePhonetic('')).toBe('')
  })
})
