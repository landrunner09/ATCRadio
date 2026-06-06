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

describe('frequency trailing-zero normalization (A13)', () => {
  test('strips trailing zeros after decimal', () => {
    expect(normalizePhonetic('119.800')).toBe('119.8')
    expect(normalizePhonetic('118.10')).toBe('118.1')
    expect(normalizePhonetic('125.350')).toBe('125.35')
  })

  test('preserves significant trailing zero before final non-zero digit', () => {
    expect(normalizePhonetic('120.05')).toBe('120.05')
    expect(normalizePhonetic('121.30')).toBe('121.3')
  })

  test('leaves non-frequency numbers untouched', () => {
    expect(normalizePhonetic('4523')).toBe('4523')
    expect(normalizePhonetic('runway 31')).toBe('runway 31')
  })

  test('handles spoken frequency variants identically', () => {
    expect(normalizePhonetic('one one nine point eight zero zero')).toBe(normalizePhonetic('119.800'))
    expect(normalizePhonetic('one one nine point eight')).toBe(normalizePhonetic('119.800'))
  })
})
