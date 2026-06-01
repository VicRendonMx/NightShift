import { View, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'

export default function SafetyScreen() {
  return (
    <SafeAreaView style={styles.root}>
      <Text style={styles.title}>Report a Concern</Text>
      <Text style={styles.sub}>Safety flag flow — coming in Phase 3</Text>
      <TouchableOpacity onPress={() => router.back()} style={styles.btn}>
        <Text style={styles.btnText}>← Go back</Text>
      </TouchableOpacity>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0D0D0D', alignItems: 'center', justifyContent: 'center', gap: 12 },
  title: { fontSize: 20, fontWeight: '800', color: '#fff' },
  sub: { fontSize: 14, color: '#555' },
  btn: { marginTop: 16 },
  btnText: { fontSize: 15, color: '#F5A623', fontWeight: '600' },
})
