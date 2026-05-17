// app/(tabs)/_layout.tsx
import { useEffect } from 'react'
import { Tabs, useRouter } from 'expo-router'
import { Text } from 'react-native'
import { useAuthStore } from '@/store/authStore'

const TAB_ICON: Record<string, string> = {
  index: '⌂', fly: '✈', drill: '▦', stats: '◐', settings: '⚙',
}

export default function TabLayout() {
  const router = useRouter()
  const { user, isGuest, loading, init } = useAuthStore()

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { init() }, [])

  useEffect(() => {
    if (!loading && !user && !isGuest) {
      router.replace('/auth')
    }
  }, [loading, user, isGuest, router])

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: { backgroundColor: '#0B1020', borderTopColor: '#1C2548' },
        tabBarActiveTintColor: '#6FE3FF',
        tabBarInactiveTintColor: '#5A6B94',
        tabBarIcon: ({ color }) => (
          <Text style={{ fontSize: 18, color }}>{TAB_ICON[route.name] ?? '•'}</Text>
        ),
      })}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="fly" options={{ title: 'Fly' }} />
      <Tabs.Screen name="drill" options={{ title: 'Drill' }} />
      <Tabs.Screen name="stats" options={{ title: 'Stats' }} />
      <Tabs.Screen name="gear" options={{ href: null }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
    </Tabs>
  )
}
