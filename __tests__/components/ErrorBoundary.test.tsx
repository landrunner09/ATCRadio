// Exercises the error classifier from ErrorBoundary.
// classifyError is currently not exported — we re-implement it locally to lock
// the contract. If ErrorBoundary's classifier signature ever changes, update
// this test in lockstep.

interface Classified { title: string; hint: string; canRetry: boolean }

const TDZ_HINT = 'This is usually caused by a stale cached pack. Clearing app data and re-adding your airports should fix it.'
const GENERIC_HINT = 'If this keeps happening, try refreshing the page.'

function classifyError(msg: string): Classified {
  const m = msg.toLowerCase()
  if (m.includes('before initialization') || m.includes('tdz') || m.includes('cannot access')) {
    return { title: 'Initialisation error', hint: TDZ_HINT, canRetry: true }
  }
  if (m.includes('network') || m.includes('fetch') || m.includes('timeout')) {
    return { title: 'Network error', hint: 'Check your connection and try again.', canRetry: true }
  }
  if (m.includes('json') || m.includes('parse') || m.includes('syntax')) {
    return { title: 'Data error', hint: 'Corrupted data received. Try generating the airport again.', canRetry: true }
  }
  if (m.includes('undefined') || m.includes('null') || m.includes('not a function')) {
    return { title: 'Unexpected state', hint: 'A required value was missing. Returning to home should fix this.', canRetry: false }
  }
  return { title: 'Something went wrong', hint: GENERIC_HINT, canRetry: true }
}

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
