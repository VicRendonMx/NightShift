import React, { useState, useMemo, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  FlatList,
  Pressable,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { useVenues } from '../../hooks/useVenues'
import { useNeighbourhoods } from '../../hooks/useNeighbourhoods'
import { VenueCard } from '../../components/VenueCard'
import type { VenueRow } from '../../hooks/useVenues'

const AMBER = '#F5A623'
const BG = '#0D0D0D'

const VIBE_OPTIONS = [
  { id: 'dancey', label: 'Dancey 🕺' },
  { id: 'chill', label: 'Chill 🌙' },
  { id: 'rooftop', label: 'Rooftop 🏙️' },
  { id: 'late-night', label: 'Late Night 🦉' },
  { id: 'first-date', label: 'First Date ✨' },
  { id: 'lgbtq', label: 'LGBTQ+ 🏳️‍🌈' },
  { id: 'live-music', label: 'Live Music 🎸' },
  { id: 'bar-crawl', label: 'Bar Crawl 🍺' },
]

const VENUE_TYPES = [
  { id: 'nightclub', label: '🕺 Nightclub' },
  { id: 'bar', label: '🍺 Bar' },
  { id: 'lounge', label: '🛋️ Lounge' },
  { id: 'rooftop', label: '🏙️ Rooftop' },
  { id: 'afterhours', label: '🦉 After Hours' },
  { id: 'live_music', label: '🎸 Live Music' },
  { id: 'comedy', label: '🎤 Comedy' },
]

// ── Filter picker modal ───────────────────────────────────────────────────────

function PickerModal<T extends string>({
  visible,
  title,
  options,
  selected,
  onSelect,
  onClose,
  multi,
}: {
  visible: boolean
  title: string
  options: { id: T; label: string }[]
  selected: T[]
  onSelect: (id: T) => void
  onClose: () => void
  multi?: boolean
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={modalStyles.backdrop} onPress={onClose} />
      <View style={modalStyles.sheet}>
        <View style={modalStyles.handle} />
        <Text style={modalStyles.title}>{title}</Text>
        <ScrollView style={modalStyles.scroll}>
          {options.map(opt => {
            const isSelected = selected.includes(opt.id)
            return (
              <Pressable
                key={opt.id}
                style={[modalStyles.option, isSelected && modalStyles.optionSelected]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                  onSelect(opt.id)
                  if (!multi) onClose()
                }}
              >
                <Text style={[modalStyles.optionText, isSelected && modalStyles.optionTextSelected]}>
                  {opt.label}
                </Text>
                {isSelected && <Text style={modalStyles.check}>✓</Text>}
              </Pressable>
            )
          })}
        </ScrollView>
        <TouchableOpacity style={modalStyles.doneBtn} onPress={onClose}>
          <Text style={modalStyles.doneBtnText}>Done</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  )
}

const modalStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    backgroundColor: '#111',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
    maxHeight: '70%',
    borderTopWidth: 1,
    borderColor: '#222',
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: '#333',
    borderRadius: 2,
    alignSelf: 'center',
    marginVertical: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: '#fff',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  scroll: { maxHeight: 360 },
  option: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
  },
  optionSelected: { backgroundColor: 'rgba(245,166,35,0.08)' },
  optionText: { fontSize: 15, color: '#888', fontWeight: '500' },
  optionTextSelected: { color: '#fff', fontWeight: '700' },
  check: { color: AMBER, fontSize: 16, fontWeight: '800' },
  doneBtn: {
    margin: 20,
    marginTop: 16,
    backgroundColor: AMBER,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  doneBtnText: { fontSize: 15, fontWeight: '800', color: '#000' },
})

// ── Filter chip ───────────────────────────────────────────────────────────────

function FilterChip({
  label,
  active,
  count,
  onPress,
}: {
  label: string
  active: boolean
  count?: number
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[chipStyles.chip, active && chipStyles.chipActive]}
    >
      <Text style={[chipStyles.text, active && chipStyles.textActive]}>
        {label}{count ? ` (${count})` : ''}
      </Text>
    </Pressable>
  )
}

const chipStyles = StyleSheet.create({
  chip: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: '#222',
  },
  chipActive: { backgroundColor: AMBER, borderColor: AMBER },
  text: { fontSize: 13, color: '#666', fontWeight: '600' },
  textActive: { color: '#000' },
})

// ── Main screen ───────────────────────────────────────────────────────────────

type ActiveModal = 'vibe' | 'type' | 'neighbourhood' | null

export default function ExploreScreen() {
  const { venues, loading } = useVenues()
  const { neighbourhoods } = useNeighbourhoods()

  const [query, setQuery] = useState('')
  const [openNowFilter, setOpenNowFilter] = useState(false)
  const [afterHoursFilter, setAfterHoursFilter] = useState(false)
  const [selectedVibes, setSelectedVibes] = useState<string[]>([])
  const [selectedTypes, setSelectedTypes] = useState<string[]>([])
  const [selectedNeighbourhood, setSelectedNeighbourhood] = useState<string[]>([])
  const [activeModal, setActiveModal] = useState<ActiveModal>(null)

  const toggleVibe = (id: string) =>
    setSelectedVibes(v => v.includes(id) ? v.filter(x => x !== id) : [...v, id])
  const toggleType = (id: string) =>
    setSelectedTypes(v => v.includes(id) ? v.filter(x => x !== id) : [...v, id])
  const toggleNeighbourhood = (id: string) =>
    setSelectedNeighbourhood(v => v.includes(id) ? v.filter(x => x !== id) : [...v, id])

  const clearAll = useCallback(() => {
    setQuery('')
    setOpenNowFilter(false)
    setAfterHoursFilter(false)
    setSelectedVibes([])
    setSelectedTypes([])
    setSelectedNeighbourhood([])
  }, [])

  const results = useMemo(() => {
    let list = venues

    if (query.trim()) {
      const q = query.toLowerCase()
      list = list.filter(v =>
        v.name.toLowerCase().includes(q) ||
        v.neighbourhood?.name.toLowerCase().includes(q) ||
        v.address?.toLowerCase().includes(q)
      )
    }

    if (openNowFilter) list = list.filter(v => v.is_open_now)
    if (afterHoursFilter) list = list.filter(v => v.is_late_night)

    if (selectedVibes.length > 0)
      list = list.filter(v => v.vibe_tags?.some(t => selectedVibes.includes(t)))

    if (selectedTypes.length > 0)
      list = list.filter(v => v.venue_type && selectedTypes.includes(v.venue_type))

    if (selectedNeighbourhood.length > 0)
      list = list.filter(v => v.neighbourhood && selectedNeighbourhood.includes(v.neighbourhood.slug))

    return list
  }, [venues, query, openNowFilter, afterHoursFilter, selectedVibes, selectedTypes, selectedNeighbourhood])

  const hasFilters = openNowFilter || afterHoursFilter || selectedVibes.length > 0 ||
    selectedTypes.length > 0 || selectedNeighbourhood.length > 0 || query.trim().length > 0

  const neighbourhoodOptions = neighbourhoods.map(n => ({ id: n.slug, label: n.name }))

  function navigateToVenue(venue: VenueRow) {
    router.push({ pathname: '/venue/[id]', params: { id: venue.id } })
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Explore</Text>
      </View>

      {/* ── Search bar ── */}
      <View style={styles.searchWrap}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search venues, neighbourhoods…"
          placeholderTextColor="#444"
          style={styles.searchInput}
          returnKeyType="search"
          clearButtonMode="while-editing"
          autoCorrect={false}
        />
      </View>

      {/* ── Filter chips ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        <FilterChip
          label="Open Now"
          active={openNowFilter}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
            setOpenNowFilter(v => !v)
          }}
        />
        <FilterChip
          label="After Hours"
          active={afterHoursFilter}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
            setAfterHoursFilter(v => !v)
          }}
        />
        <FilterChip
          label="Vibe"
          active={selectedVibes.length > 0}
          count={selectedVibes.length || undefined}
          onPress={() => setActiveModal('vibe')}
        />
        <FilterChip
          label="Type"
          active={selectedTypes.length > 0}
          count={selectedTypes.length || undefined}
          onPress={() => setActiveModal('type')}
        />
        <FilterChip
          label="Neighbourhood"
          active={selectedNeighbourhood.length > 0}
          count={selectedNeighbourhood.length || undefined}
          onPress={() => setActiveModal('neighbourhood')}
        />
        {hasFilters && (
          <Pressable onPress={clearAll} style={styles.clearBtn}>
            <Text style={styles.clearText}>✕ Clear</Text>
          </Pressable>
        )}
      </ScrollView>

      {/* ── Results header ── */}
      <View style={styles.resultsHeader}>
        {loading ? (
          <ActivityIndicator color={AMBER} size="small" />
        ) : (
          <Text style={styles.resultsCount}>
            {results.length} {results.length === 1 ? 'venue' : 'venues'}
            {hasFilters ? ' found' : ' in Toronto'}
          </Text>
        )}
      </View>

      {/* ── Results list ── */}
      {results.length === 0 && !loading ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>🔦</Text>
          <Text style={styles.emptyTitle}>Nothing matches</Text>
          <Text style={styles.emptySub}>Try fewer filters or a different search</Text>
          <TouchableOpacity onPress={clearAll} style={styles.emptyBtn}>
            <Text style={styles.emptyBtnText}>Clear all filters</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={v => v.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          renderItem={({ item }) => (
            <VenueCard variant="wide" venue={item} onPress={() => navigateToVenue(item)} />
          )}
        />
      )}

      {/* ── Filter modals ── */}
      <PickerModal
        visible={activeModal === 'vibe'}
        title="Filter by vibe"
        options={VIBE_OPTIONS as { id: string; label: string }[]}
        selected={selectedVibes}
        onSelect={toggleVibe}
        onClose={() => setActiveModal(null)}
        multi
      />
      <PickerModal
        visible={activeModal === 'type'}
        title="Filter by type"
        options={VENUE_TYPES as { id: string; label: string }[]}
        selected={selectedTypes}
        onSelect={toggleType}
        onClose={() => setActiveModal(null)}
        multi
      />
      <PickerModal
        visible={activeModal === 'neighbourhood'}
        title="Filter by neighbourhood"
        options={neighbourhoodOptions}
        selected={selectedNeighbourhood}
        onSelect={toggleNeighbourhood}
        onClose={() => setActiveModal(null)}
        multi
      />
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },

  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: -0.8,
  },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161616',
    borderRadius: 14,
    marginHorizontal: 16,
    marginTop: 10,
    marginBottom: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#222',
  },
  searchIcon: { fontSize: 15, marginRight: 8 },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 15,
    paddingVertical: 13,
    fontWeight: '500',
  },

  filterRow: { paddingHorizontal: 16, gap: 8, paddingBottom: 8 },
  clearBtn: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
  },
  clearText: { fontSize: 13, color: '#F87171', fontWeight: '600' },

  resultsHeader: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 10,
    borderTopWidth: 1,
    borderTopColor: '#141414',
  },
  resultsCount: { fontSize: 13, color: '#555', fontWeight: '500' },

  list: { paddingHorizontal: 16, paddingBottom: 20 },

  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 40,
  },
  emptyEmoji: { fontSize: 48, marginBottom: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: '#fff' },
  emptySub: { fontSize: 14, color: '#555', textAlign: 'center' },
  emptyBtn: {
    marginTop: 16,
    backgroundColor: AMBER,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  emptyBtnText: { fontSize: 14, fontWeight: '800', color: '#000' },
})
