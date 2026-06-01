import React, { useState } from 'react'
import {
  View,
  Text,
  StyleSheet,
  Image,
  Pressable,
  Dimensions,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import type { VenueRow } from '../hooks/useVenues'

const { width: SW } = Dimensions.get('window')
const AMBER = '#F5A623'

const TYPE_GRADIENT: Record<string, [string, string]> = {
  nightclub:  ['#2D0057', '#0D0D0D'],
  bar:        ['#0A1A08', '#0D0D0D'],
  lounge:     ['#071828', '#0D0D0D'],
  rooftop:    ['#051520', '#0D0D0D'],
  afterhours: ['#1A0A2E', '#0D0D0D'],
  live_music: ['#1A0D00', '#0D0D0D'],
  comedy:     ['#1A0608', '#0D0D0D'],
}

const TYPE_EMOJI: Record<string, string> = {
  nightclub:  '🕺',
  bar:        '🍺',
  lounge:     '🛋️',
  rooftop:    '🏙️',
  afterhours: '🦉',
  live_music: '🎸',
  comedy:     '🎤',
}

const VIBE_LABELS: Record<string, string> = {
  dancey:       'Dancey',
  chill:        'Chill',
  rooftop:      'Rooftop',
  'late-night': 'Late Night',
  'first-date': 'First Date',
  lgbtq:        'LGBTQ+',
  'live-music': 'Live Music',
  'bar-crawl':  'Bar Crawl',
}

function formatTime(t: string | null): string {
  if (!t) return ''
  const [hStr, mStr] = t.split(':')
  const h = parseInt(hStr, 10)
  const m = mStr
  const suffix = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return m === '00' ? `${h12}${suffix}` : `${h12}:${m}${suffix}`
}

// ── Compact card (for horizontal "picks" scroll) ────────────────────────────

const COMPACT_W = SW * 0.58
const COMPACT_H = 300

type Props = {
  venue: VenueRow
  onPress?: () => void
  variant?: 'compact' | 'wide'
}

function VibePill({ tag, small }: { tag: string; small?: boolean }) {
  return (
    <View style={[pillStyles.pill, small && pillStyles.pillSmall]}>
      <Text style={[pillStyles.text, small && pillStyles.textSmall]}>
        {VIBE_LABELS[tag] ?? tag}
      </Text>
    </View>
  )
}

const pillStyles = StyleSheet.create({
  pill: {
    borderWidth: 1,
    borderColor: 'rgba(245,166,35,0.4)',
    borderRadius: 20,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  pillSmall: {
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  text: { fontSize: 11, color: AMBER, fontWeight: '600' },
  textSmall: { fontSize: 10 },
})

function RatingBadge({ rating, count, small }: { rating: number | null; count: number | null; small?: boolean }) {
  if (!rating) return null
  return (
    <View style={ratingStyles.row}>
      <Text style={[ratingStyles.star, small && ratingStyles.starSmall]}>★</Text>
      <Text style={[ratingStyles.val, small && ratingStyles.valSmall]}>{rating.toFixed(1)}</Text>
      {count && !small ? (
        <Text style={ratingStyles.count}>({count.toLocaleString()})</Text>
      ) : null}
    </View>
  )
}

const ratingStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  star: { color: AMBER, fontSize: 13 },
  starSmall: { fontSize: 11 },
  val: { color: '#fff', fontSize: 13, fontWeight: '700' },
  valSmall: { fontSize: 11 },
  count: { color: '#666', fontSize: 11 },
})

function OpenBadge({ isOpen, opensAt, closesAt, small }: {
  isOpen: boolean; opensAt: string | null; closesAt: string | null; small?: boolean
}) {
  if (isOpen) {
    const until = closesAt ? ` · closes ${formatTime(closesAt)}` : ''
    return (
      <View style={[badgeStyles.badge, badgeStyles.open, small && badgeStyles.small]}>
        <Text style={[badgeStyles.text, small && badgeStyles.textSmall]}>
          Open{small ? '' : until}
        </Text>
      </View>
    )
  }
  const next = opensAt ? `Opens ${formatTime(opensAt)}` : 'Closed'
  return (
    <View style={[badgeStyles.badge, badgeStyles.closed, small && badgeStyles.small]}>
      <Text style={[badgeStyles.text, badgeStyles.textClosed, small && badgeStyles.textSmall]}>
        {small ? 'Closed' : next}
      </Text>
    </View>
  )
}

const badgeStyles = StyleSheet.create({
  badge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  small: { paddingHorizontal: 6, paddingVertical: 2 },
  open: { backgroundColor: 'rgba(52,211,153,0.15)', borderWidth: 1, borderColor: 'rgba(52,211,153,0.4)' },
  closed: { backgroundColor: 'rgba(239,68,68,0.1)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)' },
  text: { color: '#34D399', fontSize: 11, fontWeight: '700' },
  textSmall: { fontSize: 10 },
  textClosed: { color: '#F87171' },
})

// ── Photo with gradient fallback ─────────────────────────────────────────────

function VenuePhoto({
  url,
  venueType,
  style,
}: {
  url: string | null
  venueType: string | null
  style: object
}) {
  const [imgError, setImgError] = useState(false)
  const colors = TYPE_GRADIENT[venueType ?? 'bar']

  if (url && !imgError) {
    return (
      <View style={[style, { overflow: 'hidden' }]}>
        <Image
          source={{ uri: url }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          onError={() => setImgError(true)}
        />
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.75)']}
          style={[StyleSheet.absoluteFill, { justifyContent: 'flex-end' }]}
        />
      </View>
    )
  }

  return (
    <LinearGradient colors={colors} style={style}>
      <Text style={photoStyles.emoji}>{TYPE_EMOJI[venueType ?? 'bar'] ?? '🍸'}</Text>
    </LinearGradient>
  )
}

const photoStyles = StyleSheet.create({
  emoji: { fontSize: 40, opacity: 0.4 },
})

// ── Compact Card ──────────────────────────────────────────────────────────────

function CompactCard({ venue, onPress }: { venue: VenueRow; onPress?: () => void }) {
  const tags = (venue.vibe_tags ?? []).slice(0, 2)

  return (
    <Pressable onPress={onPress} style={compactStyles.card}>
      <VenuePhoto
        url={venue.primary_photo_url}
        venueType={venue.venue_type}
        style={compactStyles.photo}
      />
      <View style={compactStyles.footer}>
        <View style={compactStyles.topRow}>
          <OpenBadge
            isOpen={venue.is_open_now}
            opensAt={venue.opens_at}
            closesAt={venue.closes_at}
            small
          />
          <RatingBadge rating={venue.google_rating} count={null} small />
        </View>
        <Text style={compactStyles.name} numberOfLines={1}>{venue.name}</Text>
        <Text style={compactStyles.neighbourhood} numberOfLines={1}>
          {venue.neighbourhood?.name ?? ''}
        </Text>
        <View style={compactStyles.pills}>
          {tags.map(t => <VibePill key={t} tag={t} small />)}
        </View>
      </View>
    </Pressable>
  )
}

const compactStyles = StyleSheet.create({
  card: {
    width: COMPACT_W,
    backgroundColor: '#111',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1E1E1E',
  },
  photo: {
    width: '100%',
    height: COMPACT_H * 0.56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  footer: {
    padding: 12,
    gap: 5,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  name: { fontSize: 15, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  neighbourhood: { fontSize: 12, color: AMBER, fontWeight: '600' },
  pills: { flexDirection: 'row', gap: 5, flexWrap: 'wrap', marginTop: 2 },
})

// ── Wide Card ─────────────────────────────────────────────────────────────────

function WideCard({ venue, onPress }: { venue: VenueRow; onPress?: () => void }) {
  const tags = (venue.vibe_tags ?? []).slice(0, 3)

  return (
    <Pressable onPress={onPress} style={wideStyles.card}>
      <VenuePhoto
        url={venue.primary_photo_url}
        venueType={venue.venue_type}
        style={wideStyles.photo}
      />
      <View style={wideStyles.info}>
        <View style={wideStyles.topRow}>
          <Text style={wideStyles.name} numberOfLines={1}>{venue.name}</Text>
          <OpenBadge
            isOpen={venue.is_open_now}
            opensAt={venue.opens_at}
            closesAt={venue.closes_at}
            small
          />
        </View>
        <View style={wideStyles.metaRow}>
          <Text style={wideStyles.neighbourhood}>{venue.neighbourhood?.name ?? ''}</Text>
          <RatingBadge rating={venue.google_rating} count={venue.google_review_count} small />
        </View>
        <View style={wideStyles.pills}>
          {tags.map(t => <VibePill key={t} tag={t} small />)}
        </View>
        {venue.has_cover_charge && venue.cover_notes ? (
          <Text style={wideStyles.cover} numberOfLines={1}>🎟 {venue.cover_notes}</Text>
        ) : null}
      </View>
    </Pressable>
  )
}

const wideStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: '#111',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1E1E1E',
    height: 120,
  },
  photo: {
    width: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  info: {
    flex: 1,
    padding: 12,
    justifyContent: 'center',
    gap: 4,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  name: {
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.3,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  neighbourhood: { fontSize: 12, color: AMBER, fontWeight: '600' },
  pills: { flexDirection: 'row', gap: 5, flexWrap: 'wrap' },
  cover: { fontSize: 11, color: '#555', marginTop: 2 },
})

// ── Exports ───────────────────────────────────────────────────────────────────

export function VenueCard({ venue, onPress, variant = 'compact' }: Props) {
  if (variant === 'wide') return <WideCard venue={venue} onPress={onPress} />
  return <CompactCard venue={venue} onPress={onPress} />
}
