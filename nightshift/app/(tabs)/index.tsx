import React, { useMemo, useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Pressable,
  RefreshControl,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useUser } from '../../context/UserContext'
import { useVenues } from '../../hooks/useVenues'
import { useNeighbourhoods } from '../../hooks/useNeighbourhoods'
import { VenueCard } from '../../components/VenueCard'
import { useTonightsDeals } from '../../hooks/useDeals'
import type { VenueRow } from '../../hooks/useVenues'
import type { Deal } from '../../hooks/useDeals'

const AMBER = '#F5A623'
const BG = '#0D0D0D'

// ── Helpers ───────────────────────────────────────────────────────────────────

function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  if (h < 22) return 'Good evening'
  return 'Good night'
}

function formatNow(): string {
  return new Date().toLocaleTimeString('en-CA', {
    hour: 'numeric',
    minute: '2-digit',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionHeader({ title, count, onSeeAll }: {
  title: string
  count?: number
  onSeeAll?: () => void
}) {
  return (
    <View style={sectionStyles.row}>
      <Text style={sectionStyles.title}>
        {title}
        {count !== undefined ? (
          <Text style={sectionStyles.count}> ({count})</Text>
        ) : null}
      </Text>
      {onSeeAll && (
        <TouchableOpacity onPress={onSeeAll} hitSlop={10}>
          <Text style={sectionStyles.seeAll}>See all →</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

const sectionStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  title: { fontSize: 18, fontWeight: '800', color: '#fff', letterSpacing: -0.4 },
  count: { fontSize: 14, fontWeight: '600', color: '#555' },
  seeAll: { fontSize: 13, color: AMBER, fontWeight: '600' },
})

// ── Neighbourhood filter pills ────────────────────────────────────────────────

function NeighbourhoodFilter({
  neighbourhoods,
  selected,
  onSelect,
}: {
  neighbourhoods: { id: string; name: string; slug: string }[]
  selected: string | null
  onSelect: (slug: string | null) => void
}) {
  const all = [{ id: 'all', name: 'All', slug: null as unknown as string }, ...neighbourhoods]

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={filterStyles.container}
    >
      {all.map(n => {
        const isSelected = selected === (n.slug ?? null)
        return (
          <Pressable
            key={n.id}
            onPress={() => onSelect(n.slug ?? null)}
            style={[filterStyles.pill, isSelected && filterStyles.pillActive]}
          >
            <Text style={[filterStyles.text, isSelected && filterStyles.textActive]}>
              {n.name}
            </Text>
          </Pressable>
        )
      })}
    </ScrollView>
  )
}

const filterStyles = StyleSheet.create({
  container: { paddingHorizontal: 20, gap: 8 },
  pill: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: '#222',
  },
  pillActive: { backgroundColor: AMBER, borderColor: AMBER },
  text: { fontSize: 13, color: '#888', fontWeight: '600' },
  textActive: { color: '#000' },
})

// ── Deal card ──────────────────────────────────────────────────────────────────

function DealCard({ deal }: { deal: Deal }) {
  const venueName = (deal.venue as any)?.name ?? ''
  const hoodName = (deal.venue as any)?.neighbourhood?.name ?? ''
  return (
    <View style={dealStyles.card}>
      <View style={dealStyles.iconWrap}>
        <Text style={dealStyles.icon}>🎟</Text>
      </View>
      <View style={dealStyles.info}>
        <Text style={dealStyles.venue}>{venueName}</Text>
        <Text style={dealStyles.desc} numberOfLines={2}>{deal.title}</Text>
        {hoodName ? <Text style={dealStyles.meta}>{hoodName}</Text> : null}
      </View>
    </View>
  )
}

const dealStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: 'rgba(245,166,35,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(245,166,35,0.2)',
    borderRadius: 14,
    padding: 14,
    gap: 12,
    marginHorizontal: 20,
    marginBottom: 10,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(245,166,35,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { fontSize: 20 },
  info: { flex: 1, gap: 2 },
  venue: { fontSize: 13, fontWeight: '800', color: '#fff' },
  desc: { fontSize: 13, color: '#bbb', lineHeight: 18 },
  meta: { fontSize: 11, color: '#555', marginTop: 2 },
})

// ── Main screen ───────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const { preferences } = useUser()
  const { venues, loading, error } = useVenues()
  const { neighbourhoods } = useNeighbourhoods()
  const { deals } = useTonightsDeals()
  const [selectedNeighbourhood, setSelectedNeighbourhood] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const isAfterMidnight = new Date().getHours() < 5

  const displayName = preferences.isAnonymous
    ? 'Ghost'
    : (preferences.name || 'Night Owl')

  const openNow = useMemo(
    () => venues.filter(v => v.is_open_now),
    [venues]
  )

  const picks = useMemo(() => {
    if (preferences.vibes.length === 0) return venues.slice(0, 8)
    return venues
      .filter(v => v.vibe_tags?.some(t => preferences.vibes.includes(t as any)))
      .slice(0, 8)
  }, [venues, preferences.vibes])

  const filteredOpen = useMemo(() => {
    const base = openNow
    if (!selectedNeighbourhood) return base
    return base.filter(v => v.neighbourhood?.slug === selectedNeighbourhood)
  }, [openNow, selectedNeighbourhood])

  const lateNight = useMemo(
    () => venues.filter(v => v.is_late_night).slice(0, 10),
    [venues]
  )

  function navigateToVenue(venue: VenueRow) {
    router.push({ pathname: '/venue/[id]', params: { id: venue.id } })
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={AMBER} size="large" />
        <Text style={styles.loadingText}>Loading Toronto…</Text>
      </View>
    )
  }

  if (error) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>⚠️  {error}</Text>
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={AMBER}
            onRefresh={() => setRefreshing(false)}
          />
        }
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={styles.headerTopRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.greeting}>
                {greeting()},{' '}
                {preferences.isAnonymous ? '👻 ' : ''}{displayName}
              </Text>
              <Text style={styles.timestamp}>{formatNow()}</Text>
            </View>
            <TouchableOpacity style={styles.mapBtn} onPress={() => router.push('/map')}>
              <Text style={styles.mapBtnText}>🗺️</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.statusRow}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>
              {openNow.length} spots open right now in Toronto
            </Text>
          </View>
        </View>

        {/* ── Tonight's picks ── */}
        {picks.length > 0 && (
          <View style={styles.section}>
            <SectionHeader
              title={preferences.vibes.length > 0 ? "Tonight's picks for you" : 'Top rated tonight'}
              count={picks.length}
            />
            <FlatList
              data={picks}
              horizontal
              keyExtractor={v => v.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
              ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
              renderItem={({ item }) => (
                <VenueCard
                  venue={item}
                  variant="compact"
                  onPress={() => navigateToVenue(item)}
                />
              )}
            />
          </View>
        )}

        {/* ── Deals tonight ── */}
        {deals.length > 0 && (
          <View style={styles.section}>
            <SectionHeader title="Deals tonight" count={deals.length} />
            {deals.slice(0, 5).map(d => <DealCard key={d.id} deal={d} />)}
          </View>
        )}

        {/* ── Neighbourhood filter ── */}
        <View style={[styles.section, { gap: 0 }]}>
          <SectionHeader
            title="By neighbourhood"
            onSeeAll={() => router.push('/neighbourhood')}
          />
          <NeighbourhoodFilter
            neighbourhoods={neighbourhoods}
            selected={selectedNeighbourhood}
            onSelect={setSelectedNeighbourhood}
          />
        </View>

        {/* ── Open right now ── */}
        <View style={styles.section}>
          <SectionHeader
            title="Open right now"
            count={filteredOpen.length}
          />
          {filteredOpen.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No venues open right now in this area</Text>
            </View>
          ) : (
            <View style={styles.wideList}>
              {filteredOpen.slice(0, 15).map(v => (
                <VenueCard
                  key={v.id}
                  venue={v}
                  variant="wide"
                  onPress={() => navigateToVenue(v)}
                />
              ))}
            </View>
          )}
        </View>

        {/* ── Late night (shown always for discovery, highlighted after midnight) ── */}
        {lateNight.length > 0 && (
          <View style={styles.section}>
            <SectionHeader
              title={isAfterMidnight ? '🦉 Still going' : 'Open past 2am'}
              count={lateNight.length}
            />
            <FlatList
              data={lateNight}
              horizontal
              keyExtractor={v => v.id}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
              ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
              renderItem={({ item }) => (
                <VenueCard
                  venue={item}
                  variant="compact"
                  onPress={() => navigateToVenue(item)}
                />
              )}
            />
          </View>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  scroll: { flex: 1 },
  scrollContent: { paddingTop: 8 },

  loadingContainer: {
    flex: 1,
    backgroundColor: BG,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: { color: '#555', fontSize: 14 },
  errorText: { color: '#F87171', fontSize: 14, textAlign: 'center', padding: 24 },

  header: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 4,
  },
  headerTopRow: { flexDirection: 'row', alignItems: 'flex-start' },
  mapBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#161616', borderWidth: 1, borderColor: '#2A2A2A',
    alignItems: 'center', justifyContent: 'center', marginTop: 4,
  },
  mapBtnText: { fontSize: 20 },
  greeting: {
    fontSize: 26,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.5,
  },
  timestamp: { fontSize: 13, color: '#555', fontWeight: '500' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 4 },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#34D399',
  },
  statusText: { fontSize: 13, color: '#888', fontWeight: '500' },

  section: { marginBottom: 28, gap: 0 },

  horizontalList: {
    paddingHorizontal: 20,
  },

  wideList: {
    paddingHorizontal: 20,
    gap: 10,
  },

  emptyState: {
    marginHorizontal: 20,
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyText: { fontSize: 14, color: '#444' },
})
