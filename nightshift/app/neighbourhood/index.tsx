import React from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import { useNeighbourhoods } from '../../hooks/useNeighbourhoods'
import { useVenues } from '../../hooks/useVenues'

const AMBER = '#F5A623'
const BG = '#0D0D0D'

const HOOD_COLORS: Record<string, [string, string]> = {
  'king-west':              ['#2D0057', '#1A0030'],
  'entertainment-district': ['#071828', '#040D14'],
  'kensington-market':      ['#0A1A08', '#050D04'],
  'ossington':              ['#1A1408', '#0D0A04'],
  'little-italy':           ['#1A0808', '#0D0404'],
  'church-wellesley':       ['#1A0818', '#0D040C'],
  'distillery-district':    ['#1A0D00', '#0D0600'],
  'leslieville':            ['#051A1A', '#020D0D'],
  'annex':                  ['#0D081A', '#07040D'],
  'yorkville':              ['#1A0810', '#0D0408'],
  'north-york':             ['#081418', '#04090C'],
  'scarborough':            ['#0E1A08', '#070D04'],
}

export default function NeighbourhoodGuideScreen() {
  const { neighbourhoods, loading } = useNeighbourhoods()
  const { venues } = useVenues()

  const venueCountMap = React.useMemo(() => {
    const map: Record<string, number> = {}
    venues.forEach(v => {
      const slug = v.neighbourhood?.slug
      if (slug) map[slug] = (map[slug] ?? 0) + 1
    })
    return map
  }, [venues])

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={AMBER} />
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
          <Text style={styles.backText}>←</Text>
        </Pressable>
        <View>
          <Text style={styles.title}>Neighbourhood Guide</Text>
          <Text style={styles.sub}>Toronto's nightlife districts</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      >
        {neighbourhoods.map(n => {
          const colors = HOOD_COLORS[n.slug] ?? ['#1A1A1A', '#0D0D0D']
          const count = venueCountMap[n.slug] ?? 0

          return (
            <Pressable
              key={n.id}
              onPress={() => router.push({ pathname: '/neighbourhood/[slug]', params: { slug: n.slug } })}
            >
              <LinearGradient colors={colors} style={styles.card} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                <View style={styles.cardTop}>
                  <Text style={styles.cardName}>{n.name}</Text>
                  <View style={styles.countBadge}>
                    <Text style={styles.countText}>{count} venues</Text>
                  </View>
                </View>
                {n.vibe_summary ? (
                  <Text style={styles.cardVibe} numberOfLines={2}>{n.vibe_summary}</Text>
                ) : null}
                <Text style={styles.cardArrow}>Explore →</Text>
              </LinearGradient>
            </Pressable>
          )
        })}
        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  center: { flex: 1, backgroundColor: BG, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1A1A1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: { color: '#fff', fontSize: 18 },
  title: { fontSize: 20, fontWeight: '800', color: '#fff', letterSpacing: -0.4 },
  sub: { fontSize: 13, color: '#555', fontWeight: '500' },

  list: { paddingHorizontal: 16, gap: 12 },

  card: {
    borderRadius: 18,
    padding: 20,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.4,
    flex: 1,
  },
  countBadge: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  countText: { fontSize: 11, color: '#aaa', fontWeight: '600' },
  cardVibe: { fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 19 },
  cardArrow: { fontSize: 13, color: AMBER, fontWeight: '700', marginTop: 4 },
})
