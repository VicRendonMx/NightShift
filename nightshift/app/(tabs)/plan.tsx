import { View, Text, StyleSheet, Pressable } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import * as Haptics from 'expo-haptics'

const AMBER = '#F5A623'
const BG = '#0D0D0D'

const OPTIONS = [
  {
    id: 'crawl',
    emoji: '🗺️',
    title: 'Build a crawl',
    sub: 'Plan your stops, times, and route',
    href: '/plan/crawl',
    color: '#1A0D2E',
  },
  {
    id: 'budget',
    emoji: '💰',
    title: 'Set a budget',
    sub: 'Find venues that fit what you want to spend',
    href: '/plan/budget',
    color: '#0A1A08',
  },
  {
    id: 'group',
    emoji: '🗳️',
    title: 'Decide with friends',
    sub: 'Share a code, vote on venues, app picks the winner',
    href: '/plan/group',
    color: '#071828',
  },
] as const

export default function PlanScreen() {
  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Plan your night</Text>
        <Text style={styles.sub}>What are you trying to figure out?</Text>
      </View>

      <View style={styles.options}>
        {OPTIONS.map(opt => (
          <Pressable
            key={opt.id}
            style={[styles.card, { backgroundColor: opt.color }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              router.push(opt.href as any)
            }}
          >
            <Text style={styles.emoji}>{opt.emoji}</Text>
            <View style={styles.cardText}>
              <Text style={styles.cardTitle}>{opt.title}</Text>
              <Text style={styles.cardSub}>{opt.sub}</Text>
            </View>
            <Text style={styles.arrow}>→</Text>
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  header: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 28, gap: 6 },
  title: { fontSize: 28, fontWeight: '900', color: '#fff', letterSpacing: -0.8 },
  sub: { fontSize: 14, color: '#555' },
  options: { paddingHorizontal: 16, gap: 12 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    padding: 20,
    gap: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  emoji: { fontSize: 32 },
  cardText: { flex: 1, gap: 4 },
  cardTitle: { fontSize: 18, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  cardSub: { fontSize: 13, color: 'rgba(255,255,255,0.4)', lineHeight: 18 },
  arrow: { fontSize: 18, color: AMBER, fontWeight: '700' },
})
