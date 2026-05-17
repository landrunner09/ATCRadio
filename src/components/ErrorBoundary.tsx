import { Component, type ReactNode } from 'react'
import { View, Text, TouchableOpacity } from 'react-native'

interface Props { children: ReactNode }
interface State { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('[ErrorBoundary]', error.message, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <View style={{ flex: 1, backgroundColor: '#06080F', alignItems: 'center', justifyContent: 'center', padding: 32 }}>
          <Text style={{ color: '#FF6B7A', fontSize: 16, fontWeight: '700', marginBottom: 8 }}>Something went wrong</Text>
          <Text style={{ color: '#5A6B94', fontSize: 12, fontFamily: 'monospace', textAlign: 'center', marginBottom: 24 }}>
            {this.state.error.message}
          </Text>
          <TouchableOpacity
            style={{ borderWidth: 1, borderColor: '#6FE3FF', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 }}
            onPress={() => this.setState({ error: null })}
          >
            <Text style={{ color: '#6FE3FF', fontWeight: '600' }}>Try Again</Text>
          </TouchableOpacity>
        </View>
      )
    }
    return this.props.children
  }
}
