import { useState, useEffect } from 'react'
import { View, Text, ScrollView, TouchableOpacity, Switch, Alert, TextInput, FlatList, Linking } from 'react-native'
import { useRouter } from 'expo-router'
import { useAuthStore } from '@/store/authStore'
import { useFlightStore } from '@/store/flightStore'
import { supabase } from '@/lib/supabase'
import { VOICES } from '@/audio/audioConstants'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { CATEGORIES, filterProducts, openProduct, type CategoryId, type GearProduct } from '@/data/gearCatalog'

const BADGE_STYLE: Record<string, { bg: string; color: string }> = {
  'TOP PICK':  { bg: '#6FE3FF22', color: '#6FE3FF' },
  'BUDGET':    { bg: '#5BE3A122', color: '#5BE3A1' },
  'ESSENTIAL': { bg: '#FFB85C22', color: '#FFB85C' },
}

function ProductCard({ product }: { product: GearProduct }) {
  const badge = product.badge ? BADGE_STYLE[product.badge] : null
  return (
    <View className="bg-surface2 rounded-2xl border border-line p-4 mb-3">
      <View className="flex-row justify-between items-start mb-1">
        <Text style={{ color: '#e7ecf5' }} className="text-sm font-bold flex-1 mr-2" numberOfLines={2}>{product.name}</Text>
        {badge && (
          <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: badge.bg }}>
            <Text style={{ color: badge.color, fontSize: 9, fontWeight: '800', letterSpacing: 1 }}>{product.badge}</Text>
          </View>
        )}
      </View>
      <Text className="text-dim text-xs mb-3" numberOfLines={1}>{product.tagline}</Text>
      <View className="flex-row justify-between items-center">
        <Text style={{ color: '#e7ecf5' }} className="text-base font-bold font-mono">{product.price}</Text>
        <TouchableOpacity className="bg-accent rounded-xl px-4 py-2" onPress={() => openProduct(product)} activeOpacity={0.8}>
          <Text className="text-bg font-bold text-xs">SHOP NOW →</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const ACCENTS = [
  { label: '🇺🇸 American', id: 'american' },
  { label: '🇬🇧 British', id: 'british' },
  { label: '🇮🇳 Indian', id: 'indian' },
  { label: '🇦🇺 Australian', id: 'australian' },
]

const RADIO_FILTER_KEY = 'audio_radio_filter'
const TAIL_RE = /^N[1-9][0-9]{0,4}[A-Z]{0,2}$/

function SectionHeader({ label }: { label: string }) {
  return (
    <Text className="text-dim text-xs font-bold uppercase tracking-widest mb-3 mt-6 px-1">{label}</Text>
  )
}

function Row({ label, right, onPress, danger }: {
  label: string
  right?: React.ReactNode
  onPress?: () => void
  danger?: boolean
}) {
  const Wrapper = onPress ? TouchableOpacity : View
  return (
    <Wrapper
      className="flex-row items-center justify-between bg-surface2 rounded-xl px-4 py-3.5 mb-2 border border-line"
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text className="text-sm font-medium" style={{ color: danger ? '#FF6B7A' : '#e7ecf5' }}>{label}</Text>
      {right}
    </Wrapper>
  )
}

export default function SettingsScreen() {
  const router = useRouter()
  const { user, isGuest, signOut } = useAuthStore()
  const [activeCategory, setActiveCategory] = useState<CategoryId | 'all'>('all')
  const { selectedAccent, setSelectedAccent, tailNumber, setTailNumber } = useFlightStore()
  const [radioFilter, setRadioFilter] = useState(true)
  const [tailInput, setTailInput] = useState(tailNumber)

  const tailValid = TAIL_RE.test(tailInput)

  async function handleTailSave() {
    if (!tailValid) return
    const upper = tailInput.toUpperCase()
    setTailNumber(upper)
    if (user?.id) {
      await supabase.auth.updateUser({ data: { tail_number: upper } }).catch(() => {})
    }
  }

  useEffect(() => {
    const tail = user?.user_metadata?.tail_number as string | undefined
    if (tail) {
      setTailNumber(tail)
      setTailInput(tail)
    }
  }, [user])

  async function handleAccentChange(key: string) {
    setSelectedAccent(key)
    if (user?.id) {
      await supabase.auth.updateUser({ data: { accent_preference: key } }).catch(() => {})
    }
  }

  async function handleToggleRadioFilter(val: boolean) {
    setRadioFilter(val)
    await AsyncStorage.setItem(RADIO_FILTER_KEY, val ? '1' : '0').catch(() => {})
  }

  function handleSignOut() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await signOut()
          router.replace('/auth')
        },
      },
    ])
  }

  return (
    <ScrollView className="flex-1 bg-bg" contentContainerStyle={{ padding: 20, paddingTop: 60, paddingBottom: 40 }}>
      <Text style={{ color: '#e7ecf5' }} className="text-2xl font-bold mb-1">Settings</Text>
      <Text className="text-dim text-sm mb-2">ATCRadio preferences</Text>

      {/* Your Aircraft */}
      <SectionHeader label="Your Aircraft" />
      <View className="bg-surface2 rounded-2xl border border-line p-4 mb-2">
        <View className="flex-row items-center gap-3">
          <TextInput
            value={tailInput}
            onChangeText={t => setTailInput(t.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
            onBlur={handleTailSave}
            onSubmitEditing={handleTailSave}
            placeholder="N12345"
            placeholderTextColor="#2A3550"
            maxLength={6}
            autoCapitalize="characters"
            returnKeyType="done"
            style={{
              flex: 1,
              color: tailValid ? '#e7ecf5' : '#FF6B7A',
              fontSize: 18,
              fontFamily: 'monospace',
              fontWeight: '700',
              letterSpacing: 2,
              borderBottomWidth: 1,
              borderBottomColor: tailValid ? '#1C2548' : '#FF6B7A',
              paddingVertical: 4,
            }}
          />
          {tailValid && (
            <Text style={{ color: '#5BE3A1', fontSize: 18 }}>✓</Text>
          )}
        </View>
        <Text className="text-dim text-xs mt-2">
          Used as your callsign in every scenario. US N-numbers only (e.g. N8472K).
        </Text>
        {isGuest && (
          <Text className="text-xs mt-1" style={{ color: '#5A6B94' }}>
            Sign in to save your tail number across sessions.
          </Text>
        )}
      </View>

      {/* ATC Voice */}
      <SectionHeader label="ATC Controller Accent" />
      <View className="bg-surface2 rounded-2xl border border-line p-4 mb-2">
        <View className="flex-row flex-wrap gap-2">
          {ACCENTS.map(a => (
            <TouchableOpacity
              key={a.id}
              className="px-4 py-2.5 rounded-full"
              style={selectedAccent === a.id
                ? { borderWidth: 1, borderColor: '#6FE3FF', backgroundColor: 'rgba(111,227,255,0.12)' }
                : { borderWidth: 1, borderColor: '#1C2548' }
              }
              onPress={() => handleAccentChange(a.id)}
            >
              <Text className="text-sm" style={{ color: selectedAccent === a.id ? '#6FE3FF' : '#8A9BC4', fontWeight: selectedAccent === a.id ? '600' : '400' }}>
                {a.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text className="text-dim text-xs mt-3">
          Voice: {VOICES[selectedAccent]?.name ?? 'Kore'} · {VOICES[selectedAccent]?.languageCode ?? 'en-US'}
        </Text>
      </View>

      {/* Audio */}
      <SectionHeader label="Audio" />
      <Row
        label="Radio Bandpass Filter"
        right={
          <Switch
            value={radioFilter}
            onValueChange={handleToggleRadioFilter}
            trackColor={{ false: '#1C2548', true: 'rgba(111,227,255,0.4)' }}
            thumbColor={radioFilter ? '#6FE3FF' : '#5A6B94'}
          />
        }
      />
      <Text className="text-dim text-xs mb-4 px-1">
        Applies 300–3400 Hz bandpass filter to ATC audio for realistic radio sound.
      </Text>

      {/* Pilot Gear */}
      <SectionHeader label="Pilot Gear" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-3 -mx-5" contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
        {CATEGORIES.map(cat => {
          const active = activeCategory === cat.id
          return (
            <TouchableOpacity key={cat.id} onPress={() => setActiveCategory(cat.id as CategoryId | 'all')} className="rounded-full px-4 py-2"
              style={{ backgroundColor: active ? '#6FE3FF' : '#1C2548', borderWidth: 1, borderColor: active ? '#6FE3FF' : '#2A3560' }}>
              <Text style={{ color: active ? '#0B0F1E' : '#8A9BC4', fontWeight: '600', fontSize: 12 }}>{cat.label}</Text>
            </TouchableOpacity>
          )
        })}
      </ScrollView>
      {filterProducts(activeCategory).map(p => <ProductCard key={p.id} product={p} />)}
      <Text className="text-dim text-xs text-center mb-4">Affiliate links — we may earn a commission at no cost to you.</Text>

      {/* Account */}
      <SectionHeader label="Account" />
      {!isGuest && user ? (
        <>
          <Row label="Email" right={<Text className="text-dim text-xs font-mono">{user.email}</Text>} />
          <Row label="Sign Out" onPress={handleSignOut} danger />
        </>
      ) : (
        <Row
          label="Sign In to save progress"
          right={<Text className="text-accent text-xs font-bold">SIGN IN →</Text>}
          onPress={() => router.push('/auth')}
        />
      )}

      {/* App info */}
      <SectionHeader label="App" />
      <Row label="Version" right={<Text className="text-dim text-xs font-mono">1.0.0</Text>} />
      <Row
        label="Reset Gear Nudge"
        right={<Text className="text-dim text-xs">→</Text>}
        onPress={async () => {
          await AsyncStorage.removeItem('gear_nudge_dismissed').catch(() => {})
          Alert.alert('Done', 'Gear nudge will show on next flight.')
        }}
      />
    </ScrollView>
  )
}
