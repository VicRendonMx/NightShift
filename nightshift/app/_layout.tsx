import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { UserProvider } from '../context/UserContext'

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <UserProvider>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false, animation: 'fade' }} />
      </UserProvider>
    </SafeAreaProvider>
  )
}
