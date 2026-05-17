// app/auth.tsx
import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native'
import { useAuthStore } from '@/store/authStore'

export default function AuthScreen() {
  const { signIn, signUp, continueAsGuest } = useAuthStore()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit() {
    if (!email.trim() || !password) {
      setError('Email and password are required')
      return
    }
    setError(null)
    setLoading(true)
    try {
      if (mode === 'signin') {
        await signIn(email.trim(), password)
      } else {
        await signUp(email.trim(), password)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  function handleGuest() {
    continueAsGuest()
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-bg"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View className="flex-1 justify-center px-6">
        <Text style={{ color: '#6FE3FF' }} className="text-xs font-bold uppercase tracking-widest mb-2">
          ATC RADIO
        </Text>
        <Text style={{ color: '#e7ecf5' }} className="text-3xl font-bold mb-8">
          {mode === 'signin' ? 'Welcome back' : 'Create account'}
        </Text>

        <TextInput
          className="bg-surface2 border border-line rounded-2xl px-4 py-3 mb-3 font-mono"
          style={{ color: '#e7ecf5' }}
          placeholder="Email"
          placeholderTextColor="#5A6B94"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <TextInput
          className="bg-surface2 border border-line rounded-2xl px-4 py-3 mb-4 font-mono"
          style={{ color: '#e7ecf5' }}
          placeholder="Password"
          placeholderTextColor="#5A6B94"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        {error && (
          <Text className="text-danger text-xs mb-3 text-center">{error}</Text>
        )}

        <TouchableOpacity
          className="bg-accent rounded-2xl py-4 items-center mb-4"
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#0B0F1E" />
            : <Text className="text-bg font-bold text-base">
                {mode === 'signin' ? 'SIGN IN →' : 'CREATE ACCOUNT →'}
              </Text>
          }
        </TouchableOpacity>

        <TouchableOpacity
          className="items-center mb-6"
          onPress={() => { setMode(m => m === 'signin' ? 'signup' : 'signin'); setError(null); setPassword('') }}
        >
          <Text className="text-accent text-sm">
            {mode === 'signin' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity className="items-center" onPress={handleGuest}>
          <Text className="text-dim text-xs">Continue as guest (progress not saved)</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  )
}
