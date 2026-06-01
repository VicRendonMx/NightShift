import React, { useState, useMemo, useRef } from 'react'
import {
  View, Text, StyleSheet, FlatList, Pressable,
  PanResponder, Dimensions,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useVenues } from '../../hooks/useVenues'
import { VenueCard } from '../../components/VenueCard'
import type { VenueRow } from '../../hooks/useVenues'

const AMBER = '#F5A623'
const BG = '#0D0D0D'
const { width: SW } = Dimensions.get('window')

const COVER_ESTIMATE = 15
const DRINK_COST = 14
const DRINKS_PP = 2

function estimateCostPerPerson(venue: VenueRow): number {
  const cover = venue.has_cover_charge ? COVER_ESTIMATE : 0
  return cover + DRINKS_PP * DRINK_COST
}

function Slider({ value, max, onChange, label }: {
  value: number; max: number; onChange: (v: number) => void; label: string
}) {
  const trackWidth = useRef(SW - 48)
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: e => {
        const x = e.nativeEvent.locationX
        onChange(Math.max(1, Math.min(max, Math.round((x / trackWidth.current) * max))))
      },
      onPanResponderMove: e => {
        const x = e.nativeEvent.locationX
        onChange(Math.max(1, Math.min(max, Math.round((x / trackWidth.current) * max))))
      },
    })
  ).current

  const pct = value / max

  return (
    <View style={sliderStyles.wrap}>
      <View style={sliderStyles.labelRow}>
        <Text style={sliderStyles.label}>{label}</Text>
        <Text style={sliderStyles.val}>{value}</Text>
      </View>
      <View style={sliderStyles.trackWrap} {...pan.panHandlers}>
        <View style={sliderStyles.track} onLayout={e => { trackWidth.current = e.nativeEvent.layout.width }}>
          <View style={[sliderStyles.fill, { width: `${pct * 100}%` }]} />
        </View>
        <View style={[sliderStyles.thumb, { left: `${pct * 100}%` }]} />
      </View>
    </View>
  )
}

const sliderStyles = StyleSheet.create({
  wrap: { gap: 8 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between' },
  label: { fontSize: 14, color: '#888', fontWeight: '600' },
  val: { fontSize: 14, color: AMBER, fontWeight: '800' },
  trackWrap: { height: 40, justifyContent: 'center' },
  track: { height: 4, backgroundColor: '#2A2A2A', borderRadius: 2 },
  fill: { height: '100%', backgroundColor: AMBER, borderRadius: 2 },
  thumb: {
    position: 'absolute', width: 24, height: 24, borderRadius: 12,
    backgroundColor: AMBER, top: '50%', marginTop: -12 + 2, marginLeft: -12,
    shadowColor: AMBER, shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 0 },
  },
})

export default function BudgetPlannerScreen() {
  const { venues } = useVenues()
  const [totalBudget, setTotalBudget] = useState(100)
  const [people, setPeople] = useState(2)

  const perPerson = Math.floor(totalBudget / Math.max(people, 1))

  const matching = useMemo(() =>
    venues.filter(v => estimateCostPerPerson(v) <= perPerson)
      .sort((a, b) => (b.google_rating ?? 0) - (a.google_rating ?? 0)),
    [venues, perPerson]
  )

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={styles.back}>← Back</Text>
        </Pressable>
        <Text style={styles.title}>Budget Planner</Text>
        <Text style={styles.sub}>Set your budget and we'll find the right venues</Text>
      </View>

      <View style={styles.controls}>
        <Slider value={totalBudget} max={300} onChange={setTotalBudget} label="Total budget ($)" />
        <Slider value={people} max={12} onChange={setPeople} label="Number of people" />

        <View style={styles.summary}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Per person</Text>
            <Text style={styles.summaryVal}>${perPerson}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Venues in range</Text>
            <Text style={[styles.summaryVal, { color: '#34D399' }]}>{matching.length}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Estimate includes</Text>
            <Text style={styles.summaryNote}>Cover + 2 drinks</Text>
          </View>
        </View>
      </View>

      {matching.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No venues fit this budget. Try increasing it.</Text>
        </View>
      ) : (
        <FlatList
          data={matching}
          keyExtractor={v => v.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          renderItem={({ item }) => (
            <View>
              <VenueCard
                venue={item}
                variant="wide"
                onPress={() => router.push({ pathname: '/venue/[id]', params: { id: item.id } })}
              />
              <View style={styles.costBadge}>
                <Text style={styles.costText}>
                  ~${estimateCostPerPerson(item)}/person
                </Text>
              </View>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16, gap: 4 },
  back: { fontSize: 14, color: AMBER, fontWeight: '600', marginBottom: 4 },
  title: { fontSize: 24, fontWeight: '900', color: '#fff', letterSpacing: -0.5 },
  sub: { fontSize: 13, color: '#555' },

  controls: { paddingHorizontal: 24, gap: 20, marginBottom: 20 },

  summary: {
    flexDirection: 'row', backgroundColor: '#111', borderRadius: 14,
    padding: 16, borderWidth: 1, borderColor: '#1E1E1E',
    alignItems: 'center', marginTop: 4,
  },
  summaryItem: { flex: 1, alignItems: 'center', gap: 4 },
  summaryLabel: { fontSize: 11, color: '#555', fontWeight: '600' },
  summaryVal: { fontSize: 18, fontWeight: '800', color: '#fff' },
  summaryNote: { fontSize: 11, color: '#444', textAlign: 'center' },
  summaryDivider: { width: 1, height: 32, backgroundColor: '#222' },

  list: { paddingHorizontal: 16, paddingBottom: 30 },
  costBadge: { alignSelf: 'flex-end', marginTop: 4, marginRight: 4 },
  costText: { fontSize: 11, color: AMBER, fontWeight: '600' },

  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { fontSize: 14, color: '#555' },
})
