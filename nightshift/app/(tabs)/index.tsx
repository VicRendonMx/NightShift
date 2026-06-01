import { View, Text, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useUser } from '../../context/UserContext'

export default function HomeScreen() {
  const { preferences } = useUser()
  const displayName = preferences.isAnonymous ? 'NightShift Ghost' : (preferences.name || 'Night Owl')

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.greeting}>Good evening, {displayName} 👋</Text>
      <Text style={styles.sub}>Home feed coming next</Text>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0D0D',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  greeting: { fontSize: 22, fontWeight: '800', color: '#fff', textAlign: 'center' },
  sub: { fontSize: 14, color: '#555' },
})
