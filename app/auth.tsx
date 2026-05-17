// app/auth.tsx
import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'

export default function AuthScreen() {
  const { signIn, signUp, continueAsGuest } = useAuthStore()
  const [mode, setMode] = useState<'signin' | 'signup' | 'reset'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit() {
    setError(null)
    setInfo(null)

    if (mode === 'reset') {
      if (!email.trim()) { setError('Enter your email address'); return }
      setLoading(true)
      try {
        const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${typeof window !== 'undefined' ? window.location.origin : 'atcradio://'}/auth/reset`,
        })
        if (err) throw err
        setInfo('Check your email — a password reset link is on its way.')
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Something went wrong')
      } finally {
        setLoading(false)
      }
      return
    }

    if (!email.trim() || !password) {
      setError('Email and password are required')
      return
    }
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

  function switchMode(next: 'signin' | 'signup' | 'reset') {
    setMode(next)
    setError(null)
    setInfo(null)
    setPassword('')
  }

  const title = mode === 'signin' ? 'Welcome back' : mode === 'signup' ? 'Create account' : 'Reset password'
  const buttonLabel = mode === 'signin' ? 'SIGN IN →' : mode === 'signup' ? 'CREATE ACCOUNT →' : 'SEND RESET LINK →'

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
          {title}
        </Text>

        {mode === 'reset' && (
          <Text className="text-dim text-sm mb-5">
            Enter your email and we'll send you a link to reset your password.
          </Text>
        )}

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

        {mode !== 'reset' && (
          <TextInput
            className="bg-surface2 border border-line rounded-2xl px-4 py-3 mb-1 font-mono"
            style={{ color: '#e7ecf5' }}
            placeholder="Password"
            placeholderTextColor="#5A6B94"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
        )}

        {mode === 'signin' && (
          <TouchableOpacity className="items-end mb-4 py-1" onPress={() => switchMode('reset')}>
            <Text className="text-accent text-xs">Forgot password?</Text>
          </TouchableOpacity>
        )}

        {mode !== 'signin' && <View className="mb-4" />}

        {error && (
          <Text className="text-danger text-xs mb-3 text-center">{error}</Text>
        )}
        {info && (
          <Text style={{ color: '#5BE3A1' }} className="text-xs mb-3 text-center">{info}</Text>
        )}

        <TouchableOpacity
          className="bg-accent rounded-2xl py-4 items-center mb-4"
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#0B0F1E" />
            : <Text className="text-bg font-bold text-base">{buttonLabel}</Text>
          }
        </TouchableOpacity>

        {mode === 'reset' ? (
          <TouchableOpacity className="items-center mb-6" onPress={() => switchMode('signin')}>
            <Text className="text-accent text-sm">← Back to sign in</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            className="items-center mb-6"
            onPress={() => switchMode(mode === 'signin' ? 'signup' : 'signin')}
          >
            <Text className="text-accent text-sm">
              {mode === 'signin' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
            </Text>
          </TouchableOpacity>
        )}

        {mode !== 'reset' && (
          <TouchableOpacity className="items-center" onPress={continueAsGuest}>
            <Text className="text-dim text-xs">Continue as guest (progress not saved)</Text>
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  )
}
