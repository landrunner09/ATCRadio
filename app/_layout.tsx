import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { useEffect } from 'react'
import { View, ActivityIndicator } from 'react-native'
import { useAirportStore } from '@/store/airportStore'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import '../global.css'

export default function RootLayout() {
  const hydrate = useAirportStore(s => s.hydrate)
  const isHydrated = useAirportStore(s => s.isHydrated)

  useEffect(() => { hydrate() }, [])

  if (!isHydrated) {
    return (
      <View style={{ flex: 1, backgroundColor: '#06080F', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#6FE3FF" />
      </View>
    )
  }

  return (
    <ErrorBoundary>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#06080F' } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="flight/brief" options={{ presentation: 'modal' }} />
        <Stack.Screen name="flight/hud" />
        <Stack.Screen name="flight/debrief" />
        <Stack.Screen name="airport/add" options={{ presentation: 'modal' }} />
      </Stack>
    </ErrorBoundary>
  )
}
