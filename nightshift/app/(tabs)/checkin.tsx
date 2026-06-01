import { View, Text, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

export default function CheckInScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.text}>Check In — coming next</Text>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0D', alignItems: 'center', justifyContent: 'center' },
  text: { fontSize: 16, color: '#555' },
})
