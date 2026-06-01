import React, { useState, useMemo } from 'react'
import {
  View, Text, StyleSheet, TextInput, FlatList,
  TouchableOpacity, Pressable, Switch, ScrollView, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import { supabase } from '../../lib/supabase'
import { useVenues } from '../../hooks/useVenues'
import { useUser } from '../../context/UserContext'
import type { VenueRow } from '../../hooks/useVenues'

const AMBER = '#F5A623'
const BG = '#0D0D0D'
const POINTS_PER_CHECKIN = 10

type Stage = 'search' | 'rate' | 'done'

function DotRating({
  label, value, onChange,
}: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <View style={ratingStyles.row}>
      <Text style={ratingStyles.label}>{label}</Text>
      <View style={ratingStyles.dots}>
        {[1, 2, 3, 4, 5].map(n => (
          <Pressable key={n} onPress={() => onChange(n)} hitSlop={8}>
            <View style={[ratingStyles.dot, n <= value && ratingStyles.dotFilled]} />
          </Pressable>
        ))}
      </View>
    </View>
  )
}

const ratingStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  label: { fontSize: 14, color: '#888', fontWeight: '600', width: 90 },
  dots: { flexDirection: 'row', gap: 10, flex: 1 },
  dot: {
    width: 24, height: 24, borderRadius: 12,
    borderWidth: 2, borderColor: '#2A2A2A',
  },
  dotFilled: { backgroundColor: AMBER, borderColor: AMBER },
})

export default function CheckInScreen() {
  const { venues } = useVenues()
  const { preferences, addPoints, recordCheckIn } = useUser()

  const [stage, setStage] = useState<Stage>('search')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<VenueRow | null>(null)

  const [crowdRating, setCrowdRating] = useState(3)
  const [vibeRating, setVibeRating] = useState(3)
  const [waitTime, setWaitTime] = useState(0)
  const [note, setNote] = useState('')
  const [isAnonLocal, setIsAnonLocal] = useState(preferences.isAnonymous)
  const [loading, setLoading] = useState(false)

  const suggestions = useMemo(() => {
    if (!query.trim()) return []
    const q = query.toLowerCase()
    return venues
      .filter(v => v.name.toLowerCase().includes(q) || v.neighbourhood?.name.toLowerCase().includes(q))
      .slice(0, 8)
  }, [query, venues])

  function pickVenue(venue: VenueRow) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setSelected(venue)
    setQuery('')
    setStage('rate')
  }

  async function submit() {
    if (!selected) return
    setLoading(true)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    const { error } = await supabase.from('checkin').insert({
      venue_id: selected.id,
      crowd_rating: crowdRating,
      vibe_rating: vibeRating,
      wait_time_min: waitTime,
      note: note.trim() || null,
      is_anonymous: isAnonLocal,
    } as any)

    setLoading(false)

    if (error) {
      Alert.alert('Error', 'Could not save check-in. Please try again.')
      return
    }

    addPoints(POINTS_PER_CHECKIN)
    recordCheckIn({
      venueId: selected.id,
      venueName: selected.name,
      timestamp: new Date().toISOString(),
      crowdRating,
      vibeRating,
    })
    setStage('done')
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
  }

  function reset() {
    setStage('search')
    setSelected(null)
    setQuery('')
    setCrowdRating(3)
    setVibeRating(3)
    setWaitTime(0)
    setNote('')
  }

  // ── Done ───────────────────────────────────────────────────────────────────
  if (stage === 'done') {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <View style={styles.doneWrap}>
          <Text style={styles.doneEmoji}>✅</Text>
          <Text style={styles.doneTitle}>Checked in!</Text>
          <Text style={styles.doneSub}>You earned +{POINTS_PER_CHECKIN} loyalty points</Text>
          <View style={styles.doneVenueCard}>
            <Text style={styles.doneVenueName}>{selected?.name}</Text>
            <Text style={styles.doneVenueMeta}>{selected?.neighbourhood?.name}</Text>
          </View>
          <View style={styles.doneStats}>
            <View style={styles.doneStat}>
              <Text style={styles.doneStatLabel}>Crowd</Text>
              <Text style={styles.doneStatVal}>{crowdRating}/5</Text>
            </View>
            <View style={styles.doneStat}>
              <Text style={styles.doneStatLabel}>Vibe</Text>
              <Text style={styles.doneStatVal}>{vibeRating}/5</Text>
            </View>
            <View style={styles.doneStat}>
              <Text style={styles.doneStatLabel}>Wait</Text>
              <Text style={styles.doneStatVal}>{waitTime} min</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.doneBtn} onPress={reset}>
            <Text style={styles.doneBtnText}>Check in somewhere else</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  // ── Rating ─────────────────────────────────────────────────────────────────
  if (stage === 'rate' && selected) {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.rateContent} keyboardShouldPersistTaps="handled">
            <View style={styles.header}>
              <Pressable onPress={() => setStage('search')} hitSlop={12}>
                <Text style={styles.back}>← Back</Text>
              </Pressable>
              <Text style={styles.title}>Check In</Text>
            </View>

            <View style={styles.selectedCard}>
              <Text style={styles.selectedName}>{selected.name}</Text>
              <Text style={styles.selectedMeta}>{selected.neighbourhood?.name}</Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>How's it going?</Text>
              <View style={styles.ratingCard}>
                <DotRating label="Crowd" value={crowdRating} onChange={setCrowdRating} />
                <DotRating label="Vibe" value={vibeRating} onChange={setVibeRating} />
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Wait time at the door</Text>
              <View style={styles.waitRow}>
                {[0, 5, 10, 15, 20, 30, 45, 60].map(t => (
                  <Pressable
                    key={t}
                    style={[styles.waitChip, waitTime === t && styles.waitChipActive]}
                    onPress={() => setWaitTime(t)}
                  >
                    <Text style={[styles.waitChipText, waitTime === t && styles.waitChipTextActive]}>
                      {t === 0 ? 'None' : `${t}m`}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Add a note (optional)</Text>
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder="What's the vibe like…"
                placeholderTextColor="#333"
                style={styles.noteInput}
                multiline
                maxLength={200}
              />
            </View>

            <View style={styles.anonRow}>
              <View>
                <Text style={styles.anonLabel}>Post anonymously</Text>
                <Text style={styles.anonSub}>Your name won't be shown</Text>
              </View>
              <Switch
                value={isAnonLocal}
                onValueChange={setIsAnonLocal}
                trackColor={{ false: '#2A2A2A', true: AMBER }}
                thumbColor="#fff"
              />
            </View>

            <TouchableOpacity
              style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
              onPress={submit}
              disabled={loading}
            >
              <Text style={styles.submitBtnText}>
                {loading ? 'Saving…' : `Check in · +${POINTS_PER_CHECKIN} pts`}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    )
  }

  // ── Search ─────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Check In</Text>
        <Text style={styles.sub}>Where are you right now?</Text>
      </View>

      <View style={styles.searchWrap}>
        <Text style={styles.searchIcon}>📍</Text>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search for a venue…"
          placeholderTextColor="#444"
          style={styles.searchInput}
          autoFocus
        />
      </View>

      {query.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>📍</Text>
          <Text style={styles.emptyTitle}>Find where you are</Text>
          <Text style={styles.emptySub}>
            Search for the venue you're at. Your check-in helps others know the vibe tonight.
          </Text>
        </View>
      ) : (
        <FlatList
          data={suggestions}
          keyExtractor={v => v.id}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <Pressable style={styles.suggestion} onPress={() => pickVenue(item)}>
              <View style={styles.suggestionDot} />
              <View style={styles.suggestionInfo}>
                <Text style={styles.suggestionName}>{item.name}</Text>
                <Text style={styles.suggestionMeta}>{item.neighbourhood?.name}</Text>
              </View>
              <Text style={styles.chevron}>›</Text>
            </Pressable>
          )}
          ListEmptyComponent={
            <View style={styles.noResults}>
              <Text style={styles.noResultsText}>No venues found for "{query}"</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },

  header: { paddingHorizontal: 24, paddingTop: 16, paddingBottom: 12, gap: 4 },
  back: { fontSize: 14, color: AMBER, fontWeight: '600', marginBottom: 4 },
  title: { fontSize: 28, fontWeight: '900', color: '#fff', letterSpacing: -0.8 },
  sub: { fontSize: 14, color: '#555' },

  searchWrap: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#161616',
    borderRadius: 14, marginHorizontal: 16, marginBottom: 8,
    paddingHorizontal: 14, borderWidth: 1, borderColor: '#222',
  },
  searchIcon: { fontSize: 14, marginRight: 8 },
  searchInput: { flex: 1, color: '#fff', fontSize: 15, paddingVertical: 14, fontWeight: '500' },

  suggestion: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20,
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#131313', gap: 12,
  },
  suggestionDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: AMBER },
  suggestionInfo: { flex: 1 },
  suggestionName: { fontSize: 15, fontWeight: '700', color: '#fff' },
  suggestionMeta: { fontSize: 12, color: '#555', marginTop: 2 },
  chevron: { fontSize: 20, color: '#333' },

  noResults: { padding: 32, alignItems: 'center' },
  noResultsText: { fontSize: 14, color: '#555' },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 40 },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: '#fff' },
  emptySub: { fontSize: 14, color: '#555', textAlign: 'center', lineHeight: 20 },

  // Rate stage
  rateContent: { padding: 20, gap: 20, paddingBottom: 40 },
  selectedCard: {
    backgroundColor: '#111', borderRadius: 16, padding: 18,
    borderWidth: 1, borderColor: '#2A2A2A',
  },
  selectedName: { fontSize: 20, fontWeight: '900', color: '#fff' },
  selectedMeta: { fontSize: 13, color: AMBER, fontWeight: '600', marginTop: 4 },

  section: { gap: 10 },
  sectionTitle: { fontSize: 14, color: '#555', fontWeight: '700', letterSpacing: 0.5 },
  ratingCard: {
    backgroundColor: '#111', borderRadius: 16, padding: 20,
    gap: 16, borderWidth: 1, borderColor: '#1E1E1E',
  },

  waitRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  waitChip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1, borderColor: '#2A2A2A',
  },
  waitChipActive: { backgroundColor: AMBER, borderColor: AMBER },
  waitChipText: { fontSize: 13, color: '#555', fontWeight: '600' },
  waitChipTextActive: { color: '#000' },

  noteInput: {
    backgroundColor: '#111', borderRadius: 14, padding: 16, color: '#fff',
    fontSize: 14, minHeight: 80, textAlignVertical: 'top',
    borderWidth: 1, borderColor: '#1E1E1E',
  },

  anonRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#111', borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: '#1E1E1E',
  },
  anonLabel: { fontSize: 15, fontWeight: '700', color: '#fff' },
  anonSub: { fontSize: 12, color: '#555', marginTop: 2 },

  submitBtn: { backgroundColor: AMBER, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { fontSize: 16, fontWeight: '800', color: '#000' },

  // Done stage
  doneWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  doneEmoji: { fontSize: 64 },
  doneTitle: { fontSize: 28, fontWeight: '900', color: '#fff' },
  doneSub: { fontSize: 14, color: AMBER, fontWeight: '600' },
  doneVenueCard: {
    width: '100%', backgroundColor: '#111', borderRadius: 16, padding: 20,
    alignItems: 'center', gap: 4, borderWidth: 1, borderColor: '#2A2A2A',
  },
  doneVenueName: { fontSize: 20, fontWeight: '900', color: '#fff' },
  doneVenueMeta: { fontSize: 13, color: '#555' },
  doneStats: {
    flexDirection: 'row', gap: 16, backgroundColor: '#111',
    borderRadius: 14, padding: 16, width: '100%', justifyContent: 'space-around',
    borderWidth: 1, borderColor: '#1E1E1E',
  },
  doneStat: { alignItems: 'center', gap: 4 },
  doneStatLabel: { fontSize: 11, color: '#555', fontWeight: '600' },
  doneStatVal: { fontSize: 18, fontWeight: '800', color: '#fff' },
  doneBtn: {
    borderWidth: 1, borderColor: '#2A2A2A', borderRadius: 14,
    paddingHorizontal: 24, paddingVertical: 14,
  },
  doneBtnText: { fontSize: 14, color: '#888', fontWeight: '700' },
})
