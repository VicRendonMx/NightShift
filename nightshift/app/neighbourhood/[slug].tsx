import React, { useMemo } from 'react'
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, router } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import { useVenues } from '../../hooks/useVenues'
import { useNeighbourhoods } from '../../hooks/useNeighbourhoods'
import { VenueCard } from '../../components/VenueCard'
import type { VenueRow } from '../../hooks/useVenues'

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

export default function NeighbourhoodDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>()
  const { venues, loading: venuesLoading } = useVenues()
  const { neighbourhoods, loading: hoodsLoading } = useNeighbourhoods()

  const neighbourhood = useMemo(
    () => neighbourhoods.find(n => n.slug === slug) ?? null,
    [neighbourhoods, slug]
  )

  const filtered = useMemo(
    () => venues.filter(v => v.neighbourhood?.slug === slug),
    [venues, slug]
  )

  const openNow = filtered.filter(v => v.is_open_now)
  const colors = HOOD_COLORS[slug] ?? ['#1A1A1A', '#111']

  function navigateToVenue(venue: VenueRow) {
    router.push({ pathname: '/venue/[id]', params: { id: venue.id } })
  }

  if (venuesLoading || hoodsLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={AMBER} />
      </View>
    )
  }

  const ListHeader = () => (
    <View>
      {/* ── Hero header ── */}
      <LinearGradient colors={colors} style={styles.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <SafeAreaView edges={['top']}>
          <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
            <Text style={styles.backText}>←</Text>
          </Pressable>
        </SafeAreaView>
        <View style={styles.heroContent}>
          <Text style={styles.heroName}>{neighbourhood?.name ?? slug}</Text>
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statVal}>{filtered.length}</Text>
              <Text style={styles.statLabel}>venues</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.stat}>
              <Text style={[styles.statVal, { color: '#34D399' }]}>{openNow.length}</Text>
              <Text style={styles.statLabel}>open now</Text>
            </View>
          </View>
          {neighbourhood?.vibe_summary ? (
            <Text style={styles.vibeSum}>{neighbourhood.vibe_summary}</Text>
          ) : null}
        </View>
      </LinearGradient>

      {/* ── Open now strip ── */}
      {openNow.length > 0 && (
        <View style={styles.openSection}>
          <Text style={styles.sectionTitle}>Open right now</Text>
        </View>
      )}
    </View>
  )

  return (
    <View style={styles.root}>
      <FlatList
        data={filtered}
        keyExtractor={v => v.id}
        ListHeaderComponent={ListHeader}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        renderItem={({ item }) => (
          <VenueCard variant="wide" venue={item} onPress={() => navigateToVenue(item)} />
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No venues found in this neighbourhood</Text>
          </View>
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  center: { flex: 1, backgroundColor: BG, alignItems: 'center', justifyContent: 'center' },

  hero: { paddingBottom: 28 },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 16,
    marginTop: 8,
  },
  backText: { color: '#fff', fontSize: 18 },
  heroContent: { paddingHorizontal: 20, paddingTop: 12, gap: 10 },
  heroName: {
    fontSize: 32,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: -1,
    lineHeight: 36,
  },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  stat: { alignItems: 'center', gap: 1 },
  statVal: { fontSize: 22, fontWeight: '800', color: '#fff' },
  statLabel: { fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: '600', letterSpacing: 0.5 },
  statDivider: { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.1)' },
  vibeSum: { fontSize: 14, color: 'rgba(255,255,255,0.5)', lineHeight: 20 },

  openSection: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#fff' },

  list: { paddingHorizontal: 16, paddingBottom: 30 },
  emptyState: { padding: 40, alignItems: 'center' },
  emptyText: { fontSize: 14, color: '#444' },
})
