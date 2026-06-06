// Tests the actual classifier exported from ErrorBoundary.
// Locks in the substring matching that's critical for surfacing TDZ crashes
// (especially after JS minification on web).
import { classifyError } from '@/components/ErrorBoundary'

describe('ErrorBoundary classifier (A8)', () => {
  test('matches minified TDZ messages', () => {
    expect(classifyError("Cannot access 'ae' before initialization").title).toBe('Initialisation error')
    expect(classifyError("Cannot access 'X' before initialization").title).toBe('Initialisation error')
    expect(classifyError("Cannot access 'FULL_PACK' before initialization").title).toBe('Initialisation error')
  })

  test('matches network and fetch errors', () => {
    expect(classifyError('Network request failed').title).toBe('Network error')
    expect(classifyError('fetch error: aborted').title).toBe('Network error')
    expect(classifyError('Request timeout').title).toBe('Network error')
  })

  test('matches JSON parse errors', () => {
    expect(classifyError('Unexpected token in JSON').title).toBe('Data error')
    expect(classifyError('SyntaxError: parse failed').title).toBe('Data error')
  })

  test('matches null/undefined errors as Unexpected state with canRetry=false', () => {
    const r = classifyError("Cannot read property 'foo' of undefined")
    expect(r.title).toBe('Unexpected state')
    expect(r.canRetry).toBe(false)
  })

  test('unknown errors fall through to generic with canRetry=true', () => {
    const r = classifyError('Some random thing exploded')
    expect(r.title).toBe('Something went wrong')
    expect(r.canRetry).toBe(true)
  })

  test('TDZ classification works regardless of case', () => {
    expect(classifyError('CANNOT ACCESS X BEFORE INITIALIZATION').title).toBe('Initialisation error')
  })
})
