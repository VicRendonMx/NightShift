import React, { useRef, useMemo, useState, useEffect } from 'react'
import {
  View, Text, StyleSheet, Animated, Pressable,
  TouchableOpacity, Dimensions, ScrollView,
} from 'react-native'
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { useVenues } from '../hooks/useVenues'
import { useUser } from '../context/UserContext'
import type { VenueRow } from '../hooks/useVenues'

const AMBER = '#F5A623'
const BG = '#0D0D0D'
const { height: SH } = Dimensions.get('window')

// ── Match score ───────────────────────────────────────────────────────────────

const BUDGET_PRICE_MAP: Record<number, [number, number]> = {
  0:   [0, 20],
  20:  [0, 40],
  50:  [0, 80],
  100: [0, 130],
  150: [0, 200],
  200: [0, Infinity],
}

function matchScore(venue: VenueRow, vibes: string[], budget: number): number {
  let score = 0

  // Vibe match (50% weight)
  if (vibes.length > 0 && venue.vibe_tags && venue.vibe_tags.length > 0) {
    const matches = vibes.filter(v => venue.vibe_tags!.includes(v)).length
    score += (matches / vibes.length) * 0.5
  } else if (vibes.length === 0) {
    score += 0.3 // neutral when no preference set
  }

  // Open now bonus (20% weight)
  if (venue.is_open_now) score += 0.2

  // Rating bonus (20% weight)
  if (venue.google_rating) {
    score += ((venue.google_rating - 1) / 4) * 0.2
  }

  // Cover charge vs budget fit (10% weight)
  if (!venue.has_cover_charge || budget >= 30) score += 0.1

  return Math.min(score, 1)
}

function scoreToColor(score: number): string {
  if (score >= 0.75) return '#F5A623' // gold — strong match
  if (score >= 0.5)  return '#A78BFA' // purple — decent match
  if (score >= 0.25) return '#60A5FA' // blue — weak match
  return '#374151'                     // gray — poor match
}

function scoreToSize(score: number): number {
  return 12 + Math.round(score * 28) // 12–40 px radius
}

// ── Pulsing marker ────────────────────────────────────────────────────────────

function VenueMarker({
  venue,
  score,
  selected,
  onPress,
}: {
  venue: VenueRow
  score: number
  selected: boolean
  onPress: () => void
}) {
  const pulse  = useRef(new Animated.Value(1)).current
  const pulse2 = useRef(new Animated.Value(1)).current
  const color  = scoreToColor(score)
  const size   = scoreToSize(score)

  useEffect(() => {
    const a1 = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse,  { toValue: score > 0.5 ? 1.7 : 1.3, duration: 1100, useNativeDriver: true }),
        Animated.timing(pulse,  { toValue: 1, duration: 1100, useNativeDriver: true }),
      ])
    )
    const a2 = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse2, { toValue: score > 0.5 ? 1.3 : 1.1, duration: 750,  useNativeDriver: true }),
        Animated.timing(pulse2, { toValue: 1, duration: 750,  useNativeDriver: true }),
      ])
    )
    a1.start()
    a2.start()
    return () => { a1.stop(); a2.stop() }
  }, [score])

  const outerGlowOpacity = score >= 0.75 ? 0.30 : score >= 0.5 ? 0.22 : score >= 0.25 ? 0.14 : 0.07
  const innerGlowOpacity = score >= 0.75 ? 0.50 : score >= 0.5 ? 0.36 : score >= 0.25 ? 0.22 : 0.12
  const shadowRadius     = score >= 0.75 ? 14   : score >= 0.5 ? 9    : 4
  const shadowOpacity    = score >= 0.75 ? 0.85 : score >= 0.5 ? 0.6  : 0.3

  const pad = size + 20
  return (
    <Pressable onPress={onPress} hitSlop={8}>
      <View style={{ width: pad * 2, height: pad * 2, alignItems: 'center', justifyContent: 'center' }}>
        {/* Outer glow ring */}
        <Animated.View
          style={{
            position: 'absolute',
            width: (size + 14) * 2,
            height: (size + 14) * 2,
            borderRadius: size + 14,
            backgroundColor: color,
            opacity: outerGlowOpacity,
            transform: [{ scale: pulse }],
          }}
        />
        {/* Inner glow ring */}
        <Animated.View
          style={{
            position: 'absolute',
            width: (size + 6) * 2,
            height: (size + 6) * 2,
            borderRadius: size + 6,
            backgroundColor: color,
            opacity: innerGlowOpacity,
            transform: [{ scale: pulse2 }],
          }}
        />
        {/* Core dot */}
        <View
          style={{
            width: size * 2,
            height: size * 2,
            borderRadius: size,
            backgroundColor: color,
            alignItems: 'center',
            justifyContent: 'center',
            borderWidth: selected ? 3 : 1.5,
            borderColor: selected ? '#fff' : color + 'AA',
            shadowColor: color,
            shadowOpacity,
            shadowRadius,
            shadowOffset: { width: 0, height: 0 },
          }}
        >
          {score >= 0.75 && <Text style={{ fontSize: 10, color: '#000', fontWeight: '900' }}>★</Text>}
        </View>
      </View>
    </Pressable>
  )
}

// ── Bottom venue card ─────────────────────────────────────────────────────────

function VenueCard({ venue, score, onClose }: { venue: VenueRow; score: number; onClose: () => void }) {
  const color = scoreToColor(score)
  const pct = Math.round(score * 100)

  return (
    <View style={cardStyles.wrap}>
      <View style={cardStyles.header}>
        <View style={{ flex: 1 }}>
          <Text style={cardStyles.name} numberOfLines={1}>{venue.name}</Text>
          <Text style={cardStyles.hood}>{venue.neighbourhood?.name}</Text>
        </View>
        <Pressable onPress={onClose} hitSlop={12} style={cardStyles.closeBtn}>
          <Text style={cardStyles.closeTxt}>✕</Text>
        </Pressable>
      </View>

      {/* Match bar */}
      <View style={cardStyles.matchRow}>
        <Text style={cardStyles.matchLabel}>Match</Text>
        <View style={cardStyles.barTrack}>
          <View style={[cardStyles.barFill, { width: `${pct}%`, backgroundColor: color }]} />
        </View>
        <Text style={[cardStyles.matchPct, { color }]}>{pct}%</Text>
      </View>

      {/* Tags */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={cardStyles.tags}>
        {venue.is_open_now && (
          <View style={[cardStyles.tag, { borderColor: '#34D399' }]}>
            <Text style={[cardStyles.tagText, { color: '#34D399' }]}>Open</Text>
          </View>
        )}
        {(venue.vibe_tags ?? []).slice(0, 4).map(t => (
          <View key={t} style={cardStyles.tag}>
            <Text style={cardStyles.tagText}>{t}</Text>
          </View>
        ))}
        {venue.google_rating && (
          <View style={[cardStyles.tag, { borderColor: AMBER }]}>
            <Text style={[cardStyles.tagText, { color: AMBER }]}>★ {venue.google_rating.toFixed(1)}</Text>
          </View>
        )}
      </ScrollView>

      <TouchableOpacity
        style={[cardStyles.viewBtn, { backgroundColor: color }]}
        onPress={() => router.push({ pathname: '/venue/[id]', params: { id: venue.id } })}
      >
        <Text style={cardStyles.viewBtnText}>View venue →</Text>
      </TouchableOpacity>
    </View>
  )
}

const cardStyles = StyleSheet.create({
  wrap: {
    position: 'absolute', bottom: 32, left: 16, right: 16,
    backgroundColor: '#0F0F0F', borderRadius: 20, padding: 18,
    borderWidth: 1, borderColor: '#222',
    shadowColor: '#000', shadowOpacity: 0.6, shadowRadius: 20, shadowOffset: { width: 0, height: 8 },
    gap: 12,
  },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  name: { fontSize: 18, fontWeight: '900', color: '#fff', letterSpacing: -0.4 },
  hood: { fontSize: 12, color: '#555', marginTop: 2 },
  closeBtn: { padding: 4 },
  closeTxt: { fontSize: 14, color: '#555' },

  matchRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  matchLabel: { fontSize: 11, color: '#555', fontWeight: '700', width: 40 },
  barTrack: { flex: 1, height: 6, backgroundColor: '#1E1E1E', borderRadius: 3 },
  barFill: { height: '100%', borderRadius: 3 },
  matchPct: { fontSize: 13, fontWeight: '800', width: 36, textAlign: 'right' },

  tags: { gap: 6, paddingVertical: 2 },
  tag: {
    borderWidth: 1, borderColor: '#2A2A2A', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  tagText: { fontSize: 11, color: '#888', fontWeight: '600' },

  viewBtn: { borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  viewBtnText: { fontSize: 14, fontWeight: '800', color: '#000' },
})

// ── Legend ────────────────────────────────────────────────────────────────────

function Legend() {
  const items = [
    { color: '#F5A623', label: 'Strong match' },
    { color: '#A78BFA', label: 'Good match' },
    { color: '#60A5FA', label: 'Possible' },
    { color: '#374151', label: 'Low match' },
  ]
  return (
    <View style={legendStyles.wrap}>
      {items.map(i => (
        <View key={i.label} style={legendStyles.row}>
          <View style={[legendStyles.dot, { backgroundColor: i.color }]} />
          <Text style={legendStyles.label}>{i.label}</Text>
        </View>
      ))}
    </View>
  )
}

const legendStyles = StyleSheet.create({
  wrap: {
    position: 'absolute', top: 16, right: 16,
    backgroundColor: 'rgba(0,0,0,0.82)', borderRadius: 14,
    padding: 12, gap: 8, borderWidth: 1, borderColor: '#222',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  label: { fontSize: 11, color: '#aaa', fontWeight: '600' },
})

// ── Main screen ───────────────────────────────────────────────────────────────

const TORONTO = {
  latitude: 43.6532,
  longitude: -79.3832,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
}

export default function MapScreen() {
  const { venues, loading } = useVenues()
  const { preferences } = useUser()
  const [selected, setSelected] = useState<VenueRow | null>(null)
  const mapRef = useRef<MapView>(null)

  const scored = useMemo(() =>
    venues
      .filter(v => v.lat && v.lng)
      .map(v => ({ venue: v, score: matchScore(v, preferences.vibes, preferences.budget) }))
      .sort((a, b) => b.score - a.score),
    [venues, preferences.vibes, preferences.budget]
  )

  const topMatch = scored[0]

  function handleMarkerPress(venue: VenueRow) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setSelected(venue)
    mapRef.current?.animateToRegion({
      latitude: venue.lat! - 0.01,
      longitude: venue.lng!,
      latitudeDelta: 0.04,
      longitudeDelta: 0.04,
    }, 400)
  }

  function focusTopMatch() {
    if (!topMatch) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    handleMarkerPress(topMatch.venue)
  }

  return (
    <View style={styles.root}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_DEFAULT}
        initialRegion={TORONTO}
        userInterfaceStyle="dark"
        mapType="mutedStandard"
        showsUserLocation
        showsCompass={false}
        showsScale={false}
        showsPointsOfInterest={false}
        showsTraffic={false}
        onPress={() => setSelected(null)}
      >
        {scored.map(({ venue, score }) => (
          <Marker
            key={venue.id}
            coordinate={{ latitude: venue.lat!, longitude: venue.lng! }}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
            onPress={() => handleMarkerPress(venue)}
          >
            <VenueMarker
              venue={venue}
              score={score}
              selected={selected?.id === venue.id}
              onPress={() => handleMarkerPress(venue)}
            />
          </Marker>
        ))}
      </MapView>

      {/* Neon tint overlay — gives Apple Maps a purple/neon cast */}
      <View style={styles.neonOverlay} pointerEvents="none" />

      {/* Back button */}
      <SafeAreaView edges={['top']} style={styles.topBar}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backTxt}>← Back</Text>
        </Pressable>
        <View style={styles.titleWrap}>
          <Text style={styles.title}>Taste Map</Text>
          <Text style={styles.sub}>{scored.length} venues · glowing for you</Text>
        </View>
      </SafeAreaView>

      {/* Legend */}
      <Legend />

      {/* Best match FAB */}
      {!selected && topMatch && (
        <TouchableOpacity style={styles.fab} onPress={focusTopMatch}>
          <LinearGradient colors={['#F5A623', '#E8952A']} style={styles.fabGradient}>
            <Text style={styles.fabText}>★  Best match for you</Text>
          </LinearGradient>
        </TouchableOpacity>
      )}

      {/* Venue card */}
      {selected && (
        <VenueCard
          venue={selected}
          score={scored.find(s => s.venue.id === selected.id)?.score ?? 0}
          onClose={() => setSelected(null)}
        />
      )}

      {loading && (
        <View style={styles.loadingOverlay}>
          <Text style={styles.loadingText}>Loading venues…</Text>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },

  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    paddingHorizontal: 16, paddingBottom: 12,
    flexDirection: 'row', alignItems: 'center', gap: 12,
  },
  backBtn: {
    backgroundColor: 'rgba(0,0,0,0.75)', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8,
    borderWidth: 1, borderColor: '#222',
  },
  backTxt: { fontSize: 14, color: '#fff', fontWeight: '700' },
  titleWrap: { gap: 1 },
  title: { fontSize: 16, fontWeight: '900', color: '#fff', letterSpacing: -0.3 },
  sub: { fontSize: 11, color: 'rgba(255,255,255,0.4)' },

  fab: {
    position: 'absolute', bottom: 40, alignSelf: 'center',
    shadowColor: AMBER, shadowOpacity: 0.5, shadowRadius: 16, shadowOffset: { width: 0, height: 4 },
  },
  fabGradient: {
    borderRadius: 24, paddingHorizontal: 24, paddingVertical: 14,
  },
  fabText: { fontSize: 15, fontWeight: '800', color: '#000' },

  loadingOverlay: {
    position: 'absolute', top: '50%', alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.8)', borderRadius: 14,
    paddingHorizontal: 20, paddingVertical: 10,
  },
  loadingText: { fontSize: 13, color: '#fff', fontWeight: '600' },
  neonOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(40, 0, 80, 0.18)',
  },
})
