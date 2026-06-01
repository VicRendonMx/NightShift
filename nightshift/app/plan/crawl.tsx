import React, { useState, useMemo } from 'react'
import {
  View, Text, StyleSheet, TextInput, FlatList, Pressable,
  TouchableOpacity, Share, Alert, ScrollView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { useVenues } from '../../hooks/useVenues'
import type { VenueRow } from '../../hooks/useVenues'

const AMBER = '#F5A623'
const BG = '#0D0D0D'

interface CrawlStop {
  venue: VenueRow
  arrivalTime: string
  durationHours: number
}

function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function formatTime(h: number, m: number): string {
  const suffix = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`
}

export default function CrawlBuilderScreen() {
  const { venues } = useVenues()
  const [query, setQuery] = useState('')
  const [stops, setStops] = useState<CrawlStop[]>([])

  const START_HOUR = 21
  const START_MIN = 0

  const suggestions = useMemo(() => {
    if (!query.trim()) return []
    const q = query.toLowerCase()
    const stopIds = new Set(stops.map(s => s.venue.id))
    return venues
      .filter(v => !stopIds.has(v.id) && (
        v.name.toLowerCase().includes(q) ||
        v.neighbourhood?.name.toLowerCase().includes(q)
      ))
      .slice(0, 6)
  }, [query, venues, stops])

  function addStop(venue: VenueRow) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    let h = START_HOUR
    let m = START_MIN
    stops.forEach(s => {
      const totalMins = h * 60 + m + s.durationHours * 60 + 30
      h = Math.floor(totalMins / 60) % 24
      m = totalMins % 60
    })
    setStops(prev => [...prev, { venue, arrivalTime: formatTime(h, m), durationHours: 2 }])
    setQuery('')
  }

  function removeStop(idx: number) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setStops(prev => prev.filter((_, i) => i !== idx))
  }

  function moveStop(idx: number, dir: -1 | 1) {
    const next = idx + dir
    if (next < 0 || next >= stops.length) return
    setStops(prev => {
      const arr = [...prev]
      ;[arr[idx], arr[next]] = [arr[next], arr[idx]]
      return arr
    })
  }

  const totalDistanceKm = useMemo(() => {
    let dist = 0
    for (let i = 1; i < stops.length; i++) {
      const a = stops[i - 1].venue
      const b = stops[i].venue
      if (a.lat && a.lng && b.lat && b.lng) {
        dist += distanceKm(a.lat, a.lng, b.lat, b.lng)
      }
    }
    return dist
  }, [stops])

  const totalCover = stops.reduce((sum, s) =>
    sum + (s.venue.has_cover_charge ? 15 : 0), 0)

  async function shareCrawl() {
    const lines = stops.map((s, i) =>
      `${i + 1}. ${s.venue.name} (${s.arrivalTime}) — ${s.venue.neighbourhood?.name ?? ''}`
    )
    await Share.share({
      message: `My NightShift crawl for tonight:\n\n${lines.join('\n')}\n\nTotal: ${stops.length} stops · ${totalDistanceKm.toFixed(1)} km`,
    })
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.back}>← Back</Text>
        </Pressable>
        <Text style={styles.title}>Bar Crawl Builder</Text>
      </View>

      <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Search */}
        <View style={styles.searchWrap}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Add a venue to your crawl…"
            placeholderTextColor="#444"
            style={styles.searchInput}
          />
        </View>

        {/* Suggestions */}
        {suggestions.map(v => (
          <Pressable key={v.id} style={styles.suggestion} onPress={() => addStop(v)}>
            <View style={styles.suggestionInfo}>
              <Text style={styles.suggestionName}>{v.name}</Text>
              <Text style={styles.suggestionSub}>{v.neighbourhood?.name}</Text>
            </View>
            <Text style={styles.addBtn}>+ Add</Text>
          </Pressable>
        ))}

        {/* Crawl stops */}
        {stops.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>🗺️</Text>
            <Text style={styles.emptyTitle}>Your crawl is empty</Text>
            <Text style={styles.emptySub}>Search for a venue above to add your first stop</Text>
          </View>
        ) : (
          <View style={styles.stopsList}>
            <Text style={styles.stopsHeader}>Your crawl ({stops.length} stops)</Text>
            {stops.map((stop, idx) => (
              <View key={stop.venue.id} style={styles.stopCard}>
                <View style={styles.stopNum}>
                  <Text style={styles.stopNumText}>{idx + 1}</Text>
                </View>
                <View style={styles.stopInfo}>
                  <Text style={styles.stopName}>{stop.venue.name}</Text>
                  <Text style={styles.stopMeta}>
                    {stop.venue.neighbourhood?.name} · Arrive {stop.arrivalTime}
                  </Text>
                  <Text style={styles.stopDuration}>{stop.durationHours}h stay</Text>
                </View>
                <View style={styles.stopActions}>
                  <TouchableOpacity onPress={() => moveStop(idx, -1)} disabled={idx === 0}>
                    <Text style={[styles.moveBtn, idx === 0 && styles.moveBtnDisabled]}>↑</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => moveStop(idx, 1)} disabled={idx === stops.length - 1}>
                    <Text style={[styles.moveBtn, idx === stops.length - 1 && styles.moveBtnDisabled]}>↓</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => removeStop(idx)}>
                    <Text style={styles.removeBtn}>✕</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}

            {/* Summary */}
            <View style={styles.summary}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Total distance</Text>
                <Text style={styles.summaryVal}>{totalDistanceKm.toFixed(1)} km</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Estimated cover total</Text>
                <Text style={styles.summaryVal}>${totalCover}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Estimated time</Text>
                <Text style={styles.summaryVal}>{stops.reduce((s, x) => s + x.durationHours, 0)}h</Text>
              </View>
            </View>

            <TouchableOpacity style={styles.shareBtn} onPress={shareCrawl}>
              <Text style={styles.shareBtnText}>↑  Share crawl</Text>
            </TouchableOpacity>
          </View>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16, gap: 8 },
  back: { fontSize: 14, color: AMBER, fontWeight: '600' },
  title: { fontSize: 24, fontWeight: '900', color: '#fff', letterSpacing: -0.5 },
  scroll: { flex: 1 },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#161616',
    borderRadius: 14, marginHorizontal: 16, marginBottom: 4,
    paddingHorizontal: 14, borderWidth: 1, borderColor: '#222',
  },
  searchIcon: { fontSize: 14, marginRight: 8 },
  searchInput: { flex: 1, color: '#fff', fontSize: 15, paddingVertical: 13, fontWeight: '500' },

  suggestion: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1A1A1A',
  },
  suggestionInfo: { flex: 1 },
  suggestionName: { fontSize: 14, fontWeight: '700', color: '#fff' },
  suggestionSub: { fontSize: 12, color: '#555', marginTop: 2 },
  addBtn: { fontSize: 13, color: AMBER, fontWeight: '700' },

  emptyState: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: '#fff' },
  emptySub: { fontSize: 13, color: '#555', textAlign: 'center', paddingHorizontal: 40 },

  stopsList: { padding: 16, gap: 10 },
  stopsHeader: { fontSize: 13, color: '#555', fontWeight: '600', marginBottom: 4 },
  stopCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#111',
    borderRadius: 14, padding: 14, gap: 12, borderWidth: 1, borderColor: '#1E1E1E',
  },
  stopNum: {
    width: 30, height: 30, borderRadius: 15, backgroundColor: AMBER,
    alignItems: 'center', justifyContent: 'center',
  },
  stopNumText: { fontSize: 14, fontWeight: '800', color: '#000' },
  stopInfo: { flex: 1, gap: 2 },
  stopName: { fontSize: 14, fontWeight: '800', color: '#fff' },
  stopMeta: { fontSize: 12, color: '#555' },
  stopDuration: { fontSize: 11, color: AMBER, fontWeight: '600' },
  stopActions: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  moveBtn: { fontSize: 18, color: '#555', fontWeight: '700' },
  moveBtnDisabled: { color: '#2A2A2A' },
  removeBtn: { fontSize: 14, color: '#555' },

  summary: {
    backgroundColor: '#111', borderRadius: 14, padding: 16,
    gap: 10, borderWidth: 1, borderColor: '#1E1E1E', marginTop: 8,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryLabel: { fontSize: 13, color: '#555' },
  summaryVal: { fontSize: 13, color: '#fff', fontWeight: '700' },

  shareBtn: {
    backgroundColor: AMBER, borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', marginTop: 8,
  },
  shareBtnText: { fontSize: 16, fontWeight: '800', color: '#000' },
})
