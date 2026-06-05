import { Component, type ReactNode } from 'react'
import { View, Text, TouchableOpacity, ScrollView, Linking } from 'react-native'

interface Props { children: ReactNode }
interface State { error: Error | null; componentStack: string | null; errorCount: number }

const TDZ_HINT = 'This is usually caused by a stale cached pack. Clearing app data and re-adding your airports should fix it.'
const GENERIC_HINT = 'If this keeps happening, try refreshing the page.'

function classifyError(msg: string): { title: string; hint: string; canRetry: boolean } {
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

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, componentStack: null, errorCount: 0 }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('[ErrorBoundary]', error.message, info.componentStack)
    this.setState(s => ({
      componentStack: info.componentStack,
      errorCount: s.errorCount + 1,
    }))
  }

  handleRetry = () => {
    this.setState({ error: null, componentStack: null })
  }

  handleGoHome = () => {
    // Reload the page on web, reset error state on native
    if (typeof window !== 'undefined' && window.location) {
      window.location.href = '/'
    } else {
      this.setState({ error: null, componentStack: null })
    }
  }

  render() {
    const { error, errorCount } = this.state
    if (!error) return this.props.children

    const { title, hint, canRetry } = classifyError(error.message)
    const repeating = errorCount > 1

    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: '#06080F' }}
        contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}
      >
        {/* Icon */}
        <Text style={{ fontSize: 40, marginBottom: 16 }}>⚠️</Text>

        {/* Title */}
        <Text style={{ color: '#FF6B7A', fontSize: 18, fontWeight: '700', marginBottom: 8, textAlign: 'center' }}>
          {title}
        </Text>

        {/* Hint */}
        <Text style={{ color: '#8A9BC4', fontSize: 13, textAlign: 'center', lineHeight: 20, marginBottom: 8 }}>
          {hint}
        </Text>

        {/* Repeat warning */}
        {repeating && (
          <Text style={{ color: '#FFB85C', fontSize: 12, textAlign: 'center', marginBottom: 16 }}>
            This error has occurred {errorCount} times. Try going home.
          </Text>
        )}

        {/* Raw error — collapsed */}
        <View style={{ backgroundColor: '#0B1020', borderRadius: 8, padding: 12, marginBottom: 24, width: '100%' }}>
          <Text style={{ color: '#5A6B94', fontSize: 11, fontFamily: 'monospace' }} numberOfLines={3}>
            {error.message}
          </Text>
        </View>

        {/* Actions */}
        <View style={{ flexDirection: 'row', gap: 12 }}>
          {canRetry && !repeating && (
            <TouchableOpacity
              style={{ borderWidth: 1, borderColor: '#6FE3FF', borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12 }}
              onPress={this.handleRetry}
            >
              <Text style={{ color: '#6FE3FF', fontWeight: '600' }}>Try Again</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={{ backgroundColor: '#1C2548', borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12 }}
            onPress={this.handleGoHome}
          >
            <Text style={{ color: '#e7ecf5', fontWeight: '600' }}>← Go Home</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    )
  }
}
