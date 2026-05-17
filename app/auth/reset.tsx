// app/auth/reset.tsx
import { useEffect, useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '@/lib/supabase'

export default function ResetPasswordScreen() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [ready, setReady] = useState(false)

  // Supabase embeds the recovery token in the URL hash.
  // onAuthStateChange fires with event='PASSWORD_RECOVERY' once it's parsed.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function handleSubmit() {
    setError(null)
    if (!password) { setError('Enter a new password'); return }
    if (password !== confirm) { setError('Passwords do not match'); return }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return }
    setLoading(true)
    try {
      const { error: err } = await supabase.auth.updateUser({ password })
      if (err) throw err
      setDone(true)
      setTimeout(() => router.replace('/auth'), 2000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
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
          Set new password
        </Text>

        {done ? (
          <>
            <Text style={{ color: '#5BE3A1' }} className="text-sm text-center mb-4">
              Password updated! Redirecting to sign in…
            </Text>
            <ActivityIndicator color="#6FE3FF" />
          </>
        ) : !ready ? (
          <>
            <Text className="text-dim text-sm text-center mb-4">
              Verifying your reset link…
            </Text>
            <ActivityIndicator color="#6FE3FF" />
          </>
        ) : (
          <>
            <TextInput
              className="bg-surface2 border border-line rounded-2xl px-4 py-3 mb-3 font-mono"
              style={{ color: '#e7ecf5' }}
              placeholder="New password"
              placeholderTextColor="#5A6B94"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
            <TextInput
              className="bg-surface2 border border-line rounded-2xl px-4 py-3 mb-4 font-mono"
              style={{ color: '#e7ecf5' }}
              placeholder="Confirm new password"
              placeholderTextColor="#5A6B94"
              secureTextEntry
              value={confirm}
              onChangeText={setConfirm}
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
                : <Text className="text-bg font-bold text-base">UPDATE PASSWORD →</Text>
              }
            </TouchableOpacity>

            <TouchableOpacity className="items-center" onPress={() => router.replace('/auth')}>
              <Text className="text-accent text-sm">← Back to sign in</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  )
}
