import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  Pressable,
  FlatList,
  Linking,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Share,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { useLocalSearchParams, router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import * as Haptics from 'expo-haptics'
import { useVenue, formatHourTime, getDayLabel, isTodayOpen, getTodayDbDay } from '../../hooks/useVenue'
import { MOCK_DEALS, MOCK_CROWD_SIGNALS } from '../../lib/mock-data'
import type { VenuePhoto, Hours } from '../../types/database'

const { width: SW, height: SH } = Dimensions.get('window')
const AMBER = '#F5A623'
const BG = '#0D0D0D'

const VIBE_LABELS: Record<string, string> = {
  dancey: 'Dancey', chill: 'Chill', rooftop: 'Rooftop',
  'late-night': 'Late Night', 'first-date': 'First Date',
  lgbtq: 'LGBTQ+', 'live-music': 'Live Music', 'bar-crawl': 'Bar Crawl',
}

// ── Crowd Meter ───────────────────────────────────────────────────────────────

function CrowdMeter({ value }: { value: number }) {
  const color = value < 40 ? '#34D399' : value < 70 ? AMBER : '#EF4444'
  const label = value < 40 ? 'Quiet' : value < 70 ? 'Buzzing' : 'Packed'
  const SIZE = 88

  return (
    <View style={meterStyles.wrap}>
      <View style={[meterStyles.ring, { width: SIZE, height: SIZE, borderRadius: SIZE / 2, borderColor: color, shadowColor: color }]}>
        <Text style={[meterStyles.pct, { color }]}>{value}%</Text>
        <Text style={meterStyles.crowdLabel}>CROWD</Text>
      </View>
      <View style={meterStyles.meta}>
        <Text style={[meterStyles.level, { color }]}>{label}</Text>
        <Text style={meterStyles.sub}>Based on recent check-ins</Text>
        <Text style={meterStyles.sub}>Updates every 30 min</Text>
      </View>
    </View>
  )
}

const meterStyles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  ring: {
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.5,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  pct: { fontSize: 20, fontWeight: '800', letterSpacing: -0.5 },
  crowdLabel: { fontSize: 8, color: '#555', fontWeight: '700', letterSpacing: 1.5 },
  meta: { gap: 3 },
  level: { fontSize: 17, fontWeight: '800' },
  sub: { fontSize: 12, color: '#555' },
})

// ── Hours list ────────────────────────────────────────────────────────────────

function HoursList({ hours, expanded }: { hours: Hours[]; expanded: boolean }) {
  const todayDbDay = getTodayDbDay()
  const displayed = expanded ? hours : hours.filter(h => h.day_of_week === todayDbDay)

  return (
    <View style={hoursStyles.list}>
      {displayed.map(h => {
        const isToday = h.day_of_week === todayDbDay
        return (
          <View key={h.id} style={hoursStyles.row}>
            <Text style={[hoursStyles.day, isToday && hoursStyles.dayToday]}>
              {getDayLabel(h.day_of_week)}
            </Text>
            {h.is_closed ? (
              <Text style={hoursStyles.closed}>Closed</Text>
            ) : (
              <Text style={[hoursStyles.time, isToday && hoursStyles.timeToday]}>
                {formatHourTime(h.open_time)} – {formatHourTime(h.close_time)}
                {h.is_after_hours ? <Text style={hoursStyles.afterTag}>  after hours</Text> : null}
              </Text>
            )}
          </View>
        )
      })}
    </View>
  )
}

const hoursStyles = StyleSheet.create({
  list: { gap: 6 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  day: { fontSize: 13, color: '#555', fontWeight: '600', width: 36 },
  dayToday: { color: AMBER },
  time: { fontSize: 13, color: '#888' },
  timeToday: { color: '#fff', fontWeight: '600' },
  closed: { fontSize: 13, color: '#444' },
  afterTag: { fontSize: 11, color: AMBER },
})

// ── Photo gallery ─────────────────────────────────────────────────────────────

function PhotoGallery({ photos, heroUrl }: { photos: VenuePhoto[]; heroUrl: string | null }) {
  const allUrls = [
    heroUrl,
    ...photos.map(p => p.url).filter(u => u !== heroUrl),
  ].filter(Boolean) as string[]

  if (allUrls.length === 0) return null

  return (
    <FlatList
      data={allUrls}
      horizontal
      showsHorizontalScrollIndicator={false}
      keyExtractor={(u, i) => `${u}-${i}`}
      contentContainerStyle={galleryStyles.list}
      ItemSeparatorComponent={() => <View style={{ width: 8 }} />}
      renderItem={({ item }) => (
        <Image source={{ uri: item }} style={galleryStyles.thumb} resizeMode="cover" />
      )}
    />
  )
}

const galleryStyles = StyleSheet.create({
  list: { paddingHorizontal: 20 },
  thumb: { width: 90, height: 90, borderRadius: 10, backgroundColor: '#1A1A1A' },
})

// ── Tag pill ──────────────────────────────────────────────────────────────────

function TagPill({ label, amber }: { label: string; amber?: boolean }) {
  return (
    <View style={[tagStyles.pill, amber && tagStyles.pillAmber]}>
      <Text style={[tagStyles.text, amber && tagStyles.textAmber]}>{label}</Text>
    </View>
  )
}

const tagStyles = StyleSheet.create({
  pill: {
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  pillAmber: { borderColor: 'rgba(245,166,35,0.4)', backgroundColor: 'rgba(245,166,35,0.07)' },
  text: { fontSize: 12, color: '#888', fontWeight: '600' },
  textAmber: { color: AMBER },
})

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={secStyles.wrap}>
      <Text style={secStyles.title}>{title}</Text>
      {children}
    </View>
  )
}

const secStyles = StyleSheet.create({
  wrap: { paddingHorizontal: 20, gap: 12 },
  title: { fontSize: 16, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
})

// ── Main screen ───────────────────────────────────────────────────────────────

export default function VenueDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { venue, photos, hours, loading, error } = useVenue(id)
  const [hoursExpanded, setHoursExpanded] = useState(false)
  const [heroError, setHeroError] = useState(false)

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={AMBER} size="large" />
      </View>
    )
  }

  if (error || !venue) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>⚠️  {error ?? 'Venue not found'}</Text>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={{ color: AMBER, marginTop: 16, fontWeight: '600' }}>← Go back</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const primaryPhoto = photos.find(p => p.is_primary)?.url ?? photos[0]?.url ?? null
  const heroUrl = (!heroError && primaryPhoto) ? primaryPhoto : null
  const { open: isOpen, openTime, closeTime } = isTodayOpen(hours)
  const crowdValue = MOCK_CROWD_SIGNALS[venue.id] ?? Math.floor(Math.random() * 80 + 10)
  const venueDeal = MOCK_DEALS.find(d => d.venue_id === venue.id)

  function openStatus() {
    if (isOpen) return `Open · closes ${formatHourTime(closeTime)}`
    if (openTime) return `Opens ${formatHourTime(openTime)}`
    return 'Closed today'
  }

  async function handleShare() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    await Share.share({ message: `Check out ${venue.name} on NightShift${venue.address ? ` — ${venue.address}` : ''}` })
  }

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero ── */}
        <View style={styles.hero}>
          {heroUrl ? (
            <Image
              source={{ uri: heroUrl }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
              onError={() => setHeroError(true)}
            />
          ) : (
            <LinearGradient colors={['#1A0A2E', '#0D0D0D']} style={StyleSheet.absoluteFill} />
          )}
          <LinearGradient
            colors={['rgba(0,0,0,0.3)', 'rgba(0,0,0,0)', 'rgba(0,0,0,0.85)']}
            style={StyleSheet.absoluteFill}
          />

          {/* Back button */}
          <SafeAreaView edges={['top']} style={styles.heroTop}>
            <Pressable onPress={() => router.back()} style={styles.backBtn}>
              <Text style={styles.backText}>←</Text>
            </Pressable>
          </SafeAreaView>

          {/* Venue name overlay */}
          <View style={styles.heroBottom}>
            <View style={[styles.openBadge, isOpen ? styles.openGreen : styles.openRed]}>
              <Text style={[styles.openBadgeText, isOpen ? styles.openTextGreen : styles.openTextRed]}>
                {openStatus()}
              </Text>
            </View>
            <Text style={styles.heroName}>{venue.name}</Text>
            {venue.neighbourhood && (
              <Pressable
                onPress={() => router.push({ pathname: '/neighbourhood/[slug]', params: { slug: venue.neighbourhood!.slug } })}
                style={styles.neighbourhoodBadge}
              >
                <Text style={styles.neighbourhoodBadgeText}>
                  {venue.neighbourhood.name}  →
                </Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* ── Rating row ── */}
        <View style={styles.ratingRow}>
          {venue.google_rating && (
            <View style={styles.ratingItem}>
              <Text style={styles.ratingVal}>★ {venue.google_rating.toFixed(1)}</Text>
              {venue.google_review_count ? (
                <Text style={styles.ratingCount}>({venue.google_review_count.toLocaleString()} reviews)</Text>
              ) : null}
            </View>
          )}
          {venue.min_age > 0 && (
            <View style={styles.ageChip}>
              <Text style={styles.ageText}>{venue.min_age}+</Text>
            </View>
          )}
          {venue.dress_code && (
            <View style={styles.ageChip}>
              <Text style={styles.ageText}>{venue.dress_code}</Text>
            </View>
          )}
        </View>

        {/* ── Vibe + Genre tags ── */}
        {((venue.vibe_tags?.length ?? 0) > 0 || (venue.music_genres?.length ?? 0) > 0) && (
          <View style={styles.tagsSection}>
            <View style={styles.tagRow}>
              {(venue.vibe_tags ?? []).map(t => (
                <TagPill key={t} label={VIBE_LABELS[t] ?? t} amber />
              ))}
            </View>
            {(venue.music_genres?.length ?? 0) > 0 && (
              <View style={styles.tagRow}>
                {(venue.music_genres ?? []).map(g => (
                  <TagPill key={g} label={g} />
                ))}
              </View>
            )}
          </View>
        )}

        <View style={styles.divider} />

        {/* ── Address ── */}
        {venue.address && (
          <Pressable
            style={styles.infoRow}
            onPress={() => Linking.openURL(`maps://maps.apple.com/?q=${encodeURIComponent(venue.address!)}`)}
          >
            <Text style={styles.infoIcon}>📍</Text>
            <Text style={[styles.infoText, styles.infoLink]}>{venue.address}</Text>
          </Pressable>
        )}

        {/* ── Contact ── */}
        {venue.phone && (
          <Pressable style={styles.infoRow} onPress={() => Linking.openURL(`tel:${venue.phone}`)}>
            <Text style={styles.infoIcon}>📞</Text>
            <Text style={[styles.infoText, styles.infoLink]}>{venue.phone}</Text>
          </Pressable>
        )}

        {venue.website_url && (
          <Pressable style={styles.infoRow} onPress={() => Linking.openURL(venue.website_url!)}>
            <Text style={styles.infoIcon}>🌐</Text>
            <Text style={[styles.infoText, styles.infoLink]} numberOfLines={1}>{venue.website_url.replace(/^https?:\/\//, '')}</Text>
          </Pressable>
        )}

        {venue.instagram_handle && (
          <Pressable
            style={styles.infoRow}
            onPress={() => Linking.openURL(`https://instagram.com/${venue.instagram_handle}`)}
          >
            <Text style={styles.infoIcon}>📸</Text>
            <Text style={[styles.infoText, styles.infoLink]}>@{venue.instagram_handle}</Text>
          </Pressable>
        )}

        <View style={styles.divider} />

        {/* ── Cover ── */}
        {venue.has_cover_charge && (
          <View style={styles.infoRow}>
            <Text style={styles.infoIcon}>🎟</Text>
            <Text style={styles.infoText}>{venue.cover_notes ?? 'Cover charge applies'}</Text>
          </View>
        )}

        {/* ── Hours ── */}
        <View style={styles.section}>
          <Section title="Hours">
            <HoursList hours={hours} expanded={hoursExpanded} />
            {hours.length > 1 && (
              <TouchableOpacity onPress={() => setHoursExpanded(e => !e)} style={styles.expandBtn}>
                <Text style={styles.expandText}>
                  {hoursExpanded ? '▲ Show less' : '▼ All hours'}
                </Text>
              </TouchableOpacity>
            )}
          </Section>
        </View>

        {/* ── Photo gallery ── */}
        {photos.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Photos</Text>
              <Text style={styles.sectionCount}>{photos.length}</Text>
            </View>
            <PhotoGallery photos={photos} heroUrl={primaryPhoto} />
          </View>
        )}

        {/* ── Deals ── */}
        <View style={styles.section}>
          <Section title="Deals tonight">
            {venueDeal ? (
              <View style={styles.dealCard}>
                <Text style={styles.dealEmoji}>🎟</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.dealDesc}>{venueDeal.description}</Text>
                  <Text style={styles.dealMeta}>Valid until {venueDeal.valid_until}</Text>
                </View>
              </View>
            ) : (
              <Text style={styles.emptyText}>No deals listed tonight</Text>
            )}
          </Section>
        </View>

        {/* ── Crowd meter ── */}
        <View style={styles.section}>
          <Section title="Crowd right now">
            <CrowdMeter value={crowdValue} />
          </Section>
        </View>

        {/* ── Safety flag ── */}
        <Pressable style={styles.safetyLink} onPress={() => router.push({ pathname: '/safety', params: { venueId: venue.id, venueName: venue.name } })}>
          <Text style={styles.safetyText}>Report a concern about this venue</Text>
        </Pressable>

        <View style={{ height: 110 }} />
      </ScrollView>

      {/* ── Sticky action bar ── */}
      <SafeAreaView edges={['bottom']} style={styles.actionBar}>
        <TouchableOpacity
          style={[styles.actionBtn, styles.actionBtnPrimary]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
            router.push('/(tabs)/checkin')
          }}
        >
          <Text style={styles.actionBtnTextPrimary}>📍  Check In</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, styles.actionBtnSecondary]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
            router.push('/(tabs)/plan')
          }}
        >
          <Text style={styles.actionBtnTextSecondary}>+ Plan</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, styles.actionBtnSecondary]} onPress={handleShare}>
          <Text style={styles.actionBtnTextSecondary}>↑ Share</Text>
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  center: { flex: 1, backgroundColor: BG, alignItems: 'center', justifyContent: 'center' },
  errorText: { color: '#F87171', fontSize: 15 },
  scroll: { flex: 1 },
  content: {},

  hero: { width: SW, height: SH * 0.46, justifyContent: 'flex-end' },
  heroTop: { position: 'absolute', top: 0, left: 0, right: 0 },
  backBtn: {
    marginTop: 8,
    marginLeft: 16,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: { color: '#fff', fontSize: 20, lineHeight: 24 },
  heroBottom: { padding: 20, gap: 6 },
  heroName: { fontSize: 28, fontWeight: '900', color: '#fff', letterSpacing: -0.8, lineHeight: 32 },
  openBadge: {
    alignSelf: 'flex-start',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
  },
  openGreen: { backgroundColor: 'rgba(52,211,153,0.15)', borderColor: 'rgba(52,211,153,0.4)' },
  openRed: { backgroundColor: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.3)' },
  openBadgeText: { fontSize: 12, fontWeight: '700' },
  openTextGreen: { color: '#34D399' },
  openTextRed: { color: '#F87171' },
  neighbourhoodBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(245,166,35,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245,166,35,0.35)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  neighbourhoodBadgeText: { fontSize: 12, color: AMBER, fontWeight: '700' },

  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  ratingItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ratingVal: { fontSize: 15, color: AMBER, fontWeight: '800' },
  ratingCount: { fontSize: 13, color: '#555' },
  ageChip: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  ageText: { fontSize: 12, color: '#666', fontWeight: '600' },

  tagsSection: { paddingHorizontal: 20, gap: 8 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },

  divider: { height: 1, backgroundColor: '#1A1A1A', marginHorizontal: 20, marginVertical: 16 },

  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 20, marginBottom: 10 },
  infoIcon: { fontSize: 16, marginTop: 1 },
  infoText: { fontSize: 14, color: '#888', flex: 1, lineHeight: 20 },
  infoLink: { color: '#aaa', textDecorationLine: 'underline' },

  section: { marginTop: 8, marginBottom: 4 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#fff' },
  sectionCount: { fontSize: 13, color: '#555', fontWeight: '600' },
  expandBtn: { marginTop: 8 },
  expandText: { fontSize: 13, color: AMBER, fontWeight: '600' },

  dealCard: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    backgroundColor: 'rgba(245,166,35,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(245,166,35,0.2)',
    borderRadius: 12,
    padding: 14,
  },
  dealEmoji: { fontSize: 24 },
  dealDesc: { fontSize: 14, color: '#ddd', fontWeight: '600' },
  dealMeta: { fontSize: 12, color: '#555', marginTop: 3 },
  emptyText: { fontSize: 13, color: '#444' },

  safetyLink: { alignItems: 'center', paddingVertical: 12 },
  safetyText: { fontSize: 12, color: '#444', textDecorationLine: 'underline' },

  actionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(10,10,10,0.95)',
    borderTopWidth: 1,
    borderTopColor: '#1E1E1E',
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 10,
  },
  actionBtn: { flex: 1, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  actionBtnPrimary: { backgroundColor: AMBER, flex: 2 },
  actionBtnSecondary: { backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: '#2A2A2A' },
  actionBtnTextPrimary: { fontSize: 15, fontWeight: '800', color: '#000' },
  actionBtnTextSecondary: { fontSize: 14, fontWeight: '700', color: '#aaa' },
})
