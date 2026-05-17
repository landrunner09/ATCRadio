import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native'
import { useRouter } from 'expo-router'
import { useAirportStore } from '@/store/airportStore'
import { supabase } from '@/lib/supabase'
import type { ContentPack } from '@/types/content'

export default function AddAirportScreen() {
  const router = useRouter()
  const { addCustomPack, setSelectedIcao } = useAirportStore()
  const [icao, setIcao] = useState('')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')

  const normalizedIcao = icao.trim().toUpperCase()
  const isValid = /^[A-Z0-9]{3,4}$/.test(normalizedIcao)

  async function handleGenerate() {
    if (!isValid || loading) return
    setLoading(true)
    setStatus('Fetching airport data…')

    try {
      const { data, error } = await supabase.functions.invoke('generate-airport', {
        body: { icao: normalizedIcao },
      })

      if (error) throw new Error(error.message)
      if (!data || !data.airport_icao) throw new Error('Invalid response from server')

      const pack = data as ContentPack
      addCustomPack(pack)
      setSelectedIcao(pack.airport_icao)
      setStatus('')
      Alert.alert(
        `${pack.airport_icao} added!`,
        `${pack.airport_name} is ready to fly.`,
        [{ text: 'Fly it →', onPress: () => router.replace('/(tabs)/fly') }],
      )
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      setStatus('')
      Alert.alert('Failed to add airport', msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <ScrollView
      className="flex-1 bg-bg"
      contentContainerStyle={{ padding: 20, paddingTop: 60, paddingBottom: 40 }}
      keyboardShouldPersistTaps="handled"
    >
      <TouchableOpacity onPress={() => router.back()} className="mb-6">
        <Text className="text-accent text-sm">← Back</Text>
      </TouchableOpacity>

      <Text style={{ color: '#e7ecf5' }} className="text-2xl font-bold mb-1">Add Airport</Text>
      <Text className="text-dim text-sm mb-8">
        Enter any FAA or ICAO airport identifier. We'll fetch real frequencies and runways from aviation databases, then generate a full ATC scenario.
      </Text>

      {/* ICAO input */}
      <View className="bg-surface2 rounded-2xl border border-line p-4 mb-4">
        <Text className="text-muted text-xs uppercase tracking-widest mb-3">Airport Identifier</Text>
        <TextInput
          className="font-mono text-3xl font-bold"
          style={{ color: '#e7ecf5', letterSpacing: 6 }}
          placeholder="KSFO"
          placeholderTextColor="#1C2548"
          value={icao}
          onChangeText={v => setIcao(v.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
          maxLength={4}
          autoCapitalize="characters"
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={handleGenerate}
        />
        {normalizedIcao.length > 0 && !isValid && (
          <Text style={{ color: '#FF6B7A' }} className="text-xs mt-2">
            Enter a 3-4 character ICAO code (e.g. KSFO, KLAX, EGLL)
          </Text>
        )}
      </View>

      {/* Examples */}
      <View className="bg-surface2 rounded-2xl border border-line p-4 mb-6">
        <Text className="text-muted text-xs uppercase tracking-widest mb-3">Try These</Text>
        <View className="flex-row flex-wrap gap-2">
          {['KSFO', 'KLAX', 'KOAK', 'KSJC', 'EGLL', 'KBOS', 'KDEN', 'KLAS'].map(ex => (
            <TouchableOpacity
              key={ex}
              className="px-3 py-1.5 rounded-full border border-line"
              onPress={() => setIcao(ex)}
            >
              <Text className="text-accent text-xs font-mono font-bold">{ex}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* What we'll generate */}
      <View className="bg-surface2 rounded-2xl border border-line p-4 mb-6">
        <Text className="text-muted text-xs uppercase tracking-widest mb-3">What Gets Generated</Text>
        {[
          '11-beat full VFR pattern scenario',
          'Real tower, approach & ATIS frequencies',
          'Airport-specific controller callsigns',
          'Correct runway & taxiway identifiers',
          'Saved locally — no internet needed to fly',
        ].map(item => (
          <View key={item} className="flex-row items-start gap-2 mb-2">
            <Text className="text-go text-xs mt-0.5">✓</Text>
            <Text className="text-dim text-xs flex-1">{item}</Text>
          </View>
        ))}
      </View>

      {loading && (
        <View className="flex-row items-center gap-3 mb-4">
          <ActivityIndicator color="#6FE3FF" />
          <Text className="text-dim text-sm">{status || 'Generating scenario…'}</Text>
        </View>
      )}

      <TouchableOpacity
        className="rounded-2xl py-4 items-center"
        style={{ backgroundColor: isValid && !loading ? '#6FE3FF' : '#1C2548' }}
        onPress={handleGenerate}
        disabled={!isValid || loading}
      >
        <Text className="font-bold text-base" style={{ color: isValid && !loading ? '#0B0F1E' : '#5A6B94' }}>
          {loading ? 'GENERATING…' : `GENERATE ${normalizedIcao || 'AIRPORT'} →`}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  )
}
