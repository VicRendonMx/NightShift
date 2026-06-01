import React from 'react'
import {
  View, Text, StyleSheet, ScrollView, Switch,
  TouchableOpacity, Pressable,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { useUser, getLoyaltyTier } from '../../context/UserContext'

const AMBER = '#F5A623'
const BG = '#0D0D0D'

// ── Avatar ─────────────────────────────────────────────────────────────────────

function Avatar({ name, isAnon }: { name: string; isAnon: boolean }) {
  if (isAnon) {
    return (
      <LinearGradient colors={['#2A2A2A', '#1A1A1A']} style={avatarStyles.wrap}>
        <Text style={avatarStyles.ghost}>👻</Text>
      </LinearGradient>
    )
  }
  const initials = name
    ? name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : 'NO'
  return (
    <LinearGradient colors={['#F5A623', '#E8952A']} style={avatarStyles.wrap}>
      <Text style={avatarStyles.initials}>{initials}</Text>
    </LinearGradient>
  )
}

const avatarStyles = StyleSheet.create({
  wrap: {
    width: 80, height: 80, borderRadius: 40,
    alignItems: 'center', justifyContent: 'center',
  },
  ghost: { fontSize: 36 },
  initials: { fontSize: 28, fontWeight: '900', color: '#000' },
})

// ── Tier progress bar ──────────────────────────────────────────────────────────

function TierProgress({ points, next }: { points: number; next: number }) {
  if (next === Infinity) return <Text style={tierStyles.maxed}>Max tier reached 💎</Text>
  const prev = points >= 500 ? 500 : points >= 100 ? 100 : 0
  const pct = Math.min((points - prev) / (next - prev), 1)
  return (
    <View style={tierStyles.wrap}>
      <View style={tierStyles.track}>
        <View style={[tierStyles.fill, { width: `${pct * 100}%` }]} />
      </View>
      <Text style={tierStyles.label}>{points} / {next} pts to next tier</Text>
    </View>
  )
}

const tierStyles = StyleSheet.create({
  wrap: { gap: 6 },
  track: { height: 6, backgroundColor: '#1E1E1E', borderRadius: 3 },
  fill: { height: '100%', backgroundColor: AMBER, borderRadius: 3 },
  label: { fontSize: 11, color: '#555', fontWeight: '600' },
  maxed: { fontSize: 13, color: AMBER, fontWeight: '700' },
})

// ── Section wrapper ────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={secStyles.wrap}>
      <Text style={secStyles.title}>{title}</Text>
      {children}
    </View>
  )
}

const secStyles = StyleSheet.create({
  wrap: { gap: 10 },
  title: { fontSize: 12, color: '#555', fontWeight: '700', letterSpacing: 0.8, paddingHorizontal: 4 },
})

// ── Settings row ──────────────────────────────────────────────────────────────

function SettingsRow({
  icon, label, onPress, danger, rightText,
}: {
  icon: string
  label: string
  onPress?: () => void
  danger?: boolean
  rightText?: string
}) {
  return (
    <TouchableOpacity style={rowStyles.row} onPress={onPress} activeOpacity={0.7}>
      <Text style={rowStyles.icon}>{icon}</Text>
      <Text style={[rowStyles.label, danger && rowStyles.danger]}>{label}</Text>
      {rightText ? (
        <Text style={rowStyles.right}>{rightText}</Text>
      ) : (
        <Text style={rowStyles.chevron}>›</Text>
      )}
    </TouchableOpacity>
  )
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#111', borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: '#1A1A1A',
  },
  icon: { fontSize: 18, width: 24, textAlign: 'center' },
  label: { flex: 1, fontSize: 15, fontWeight: '600', color: '#fff' },
  danger: { color: '#EF4444' },
  chevron: { fontSize: 20, color: '#333' },
  right: { fontSize: 13, color: '#555' },
})

// ── Main screen ───────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const { preferences, setIsAnonymous } = useUser()
  const {
    name, isAnonymous, loyaltyPoints, checkInHistory, recapHistory, vibes,
  } = preferences

  const { tier, emoji, next } = getLoyaltyTier(loyaltyPoints)
  const displayName = isAnonymous ? 'Ghost Mode' : (name || 'Night Owl')

  const todayISO = new Date().toISOString().slice(0, 10)
  const todaysCheckIns = checkInHistory.filter(c => c.timestamp.startsWith(todayISO))

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* ── Header ── */}
        <View style={styles.headerRow}>
          <Avatar name={name} isAnon={isAnonymous} />
          <View style={styles.headerInfo}>
            <Text style={styles.name}>{displayName}</Text>
            {vibes.length > 0 && (
              <Text style={styles.vibeList}>{vibes.slice(0, 3).join(' · ')}</Text>
            )}
          </View>
        </View>

        {/* ── Anonymous toggle (prominent) ── */}
        <View style={styles.anonBanner}>
          <View style={styles.anonLeft}>
            <Text style={styles.anonIcon}>👻</Text>
            <View>
              <Text style={styles.anonTitle}>Ghost Mode</Text>
              <Text style={styles.anonSub}>
                {isAnonymous ? 'Your name is hidden from all activity' : 'Check-ins are posted with your name'}
              </Text>
            </View>
          </View>
          <Switch
            value={isAnonymous}
            onValueChange={v => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              setIsAnonymous(v)
            }}
            trackColor={{ false: '#2A2A2A', true: AMBER }}
            thumbColor="#fff"
          />
        </View>

        {/* ── Loyalty card ── */}
        <LinearGradient
          colors={isAnonymous ? ['#1A1A1A', '#111'] : ['#1A0D00', '#0D0D0D']}
          style={styles.loyaltyCard}
        >
          <View style={styles.loyaltyHeader}>
            <View>
              <Text style={styles.loyaltyTier}>{emoji} {tier}</Text>
              <Text style={styles.loyaltyPts}>{loyaltyPoints} pts</Text>
            </View>
            <View style={styles.loyaltyBadge}>
              <Text style={styles.loyaltyBadgeText}>Loyalty</Text>
            </View>
          </View>
          <TierProgress points={loyaltyPoints} next={next} />
          <View style={styles.loyaltyStatsRow}>
            <View style={styles.loyaltyStat}>
              <Text style={styles.loyaltyStatVal}>{checkInHistory.length}</Text>
              <Text style={styles.loyaltyStatLabel}>Check-ins</Text>
            </View>
            <View style={styles.loyaltyStat}>
              <Text style={styles.loyaltyStatVal}>{recapHistory.length}</Text>
              <Text style={styles.loyaltyStatLabel}>Recaps</Text>
            </View>
            <View style={styles.loyaltyStat}>
              <Text style={styles.loyaltyStatVal}>{todaysCheckIns.length}</Text>
              <Text style={styles.loyaltyStatLabel}>Tonight</Text>
            </View>
          </View>
        </LinearGradient>

        {/* ── Tonight's activity ── */}
        {todaysCheckIns.length > 0 && (
          <Section title="TONIGHT">
            <View style={styles.activityList}>
              {todaysCheckIns.map((c, i) => (
                <View key={c.timestamp} style={styles.activityRow}>
                  <View style={styles.activityDot} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.activityVenue}>{c.venueName}</Text>
                    <Text style={styles.activityMeta}>
                      Crowd {c.crowdRating}/5 · Vibe {c.vibeRating}/5 ·{' '}
                      {new Date(c.timestamp).toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' })}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
            <TouchableOpacity style={styles.recapBtn} onPress={() => router.push('/recap')}>
              <Text style={styles.recapBtnText}>Save tonight's recap →</Text>
            </TouchableOpacity>
          </Section>
        )}

        {/* ── My recaps ── */}
        {recapHistory.length > 0 && (
          <Section title="MY RECAPS">
            <View style={styles.recapList}>
              {recapHistory.slice(0, 5).map(r => (
                <View key={r.id} style={styles.recapCard}>
                  <View>
                    <Text style={styles.recapDate}>{r.date}</Text>
                    <Text style={styles.recapRating}>{'★'.repeat(r.overallRating)}{'☆'.repeat(5 - r.overallRating)}</Text>
                  </View>
                  <View style={styles.recapMeta}>
                    <Text style={styles.recapMetaText}>{r.venueCount} stops</Text>
                    {r.totalSpent > 0 && <Text style={styles.recapMetaText}>${r.totalSpent} spent</Text>}
                  </View>
                </View>
              ))}
            </View>
          </Section>
        )}

        {/* ── Settings ── */}
        <Section title="SETTINGS">
          <SettingsRow
            icon="🌙"
            label="Tonight's recap"
            onPress={() => router.push('/recap')}
          />
          <SettingsRow
            icon="🛡️"
            label="Report a safety concern"
            onPress={() => router.push('/safety')}
          />
          <SettingsRow
            icon="🏙️"
            label="Neighbourhood guide"
            onPress={() => router.push('/neighbourhood')}
          />
          <SettingsRow
            icon="🔔"
            label="Notifications"
            rightText="Coming soon"
          />
        </Section>

        <View style={styles.footer}>
          <Text style={styles.footerText}>NightShift · Toronto nightlife</Text>
          <Text style={styles.footerSub}>Built for the night crowd 🌙</Text>
        </View>

        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  content: { padding: 20, gap: 24 },

  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  headerInfo: { flex: 1, gap: 4 },
  name: { fontSize: 22, fontWeight: '900', color: '#fff', letterSpacing: -0.5 },
  vibeList: { fontSize: 13, color: '#555' },

  anonBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#111', borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: '#222',
  },
  anonLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  anonIcon: { fontSize: 24 },
  anonTitle: { fontSize: 15, fontWeight: '800', color: '#fff' },
  anonSub: { fontSize: 12, color: '#555', marginTop: 2, maxWidth: 220 },

  loyaltyCard: {
    borderRadius: 20, padding: 20, gap: 16,
    borderWidth: 1, borderColor: 'rgba(245,166,35,0.15)',
  },
  loyaltyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  loyaltyTier: { fontSize: 16, fontWeight: '800', color: AMBER },
  loyaltyPts: { fontSize: 32, fontWeight: '900', color: '#fff', letterSpacing: -1 },
  loyaltyBadge: {
    backgroundColor: 'rgba(245,166,35,0.1)', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(245,166,35,0.2)',
  },
  loyaltyBadgeText: { fontSize: 11, color: AMBER, fontWeight: '700' },
  loyaltyStatsRow: { flexDirection: 'row', justifyContent: 'space-around' },
  loyaltyStat: { alignItems: 'center', gap: 4 },
  loyaltyStatVal: { fontSize: 22, fontWeight: '900', color: '#fff' },
  loyaltyStatLabel: { fontSize: 11, color: '#555', fontWeight: '600' },

  activityList: { gap: 8 },
  activityRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: '#111', borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: '#1A1A1A',
  },
  activityDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: AMBER, marginTop: 4 },
  activityVenue: { fontSize: 14, fontWeight: '700', color: '#fff' },
  activityMeta: { fontSize: 11, color: '#555', marginTop: 2 },
  recapBtn: {
    borderWidth: 1, borderColor: AMBER, borderRadius: 12,
    paddingVertical: 12, alignItems: 'center',
  },
  recapBtnText: { fontSize: 14, color: AMBER, fontWeight: '700' },

  recapList: { gap: 8 },
  recapCard: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#111', borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: '#1A1A1A',
  },
  recapDate: { fontSize: 13, color: '#888', fontWeight: '600' },
  recapRating: { fontSize: 14, color: AMBER, marginTop: 2 },
  recapMeta: { alignItems: 'flex-end', gap: 2 },
  recapMetaText: { fontSize: 12, color: '#555' },

  footer: { alignItems: 'center', gap: 4, paddingTop: 8 },
  footerText: { fontSize: 12, color: '#333', fontWeight: '600' },
  footerSub: { fontSize: 11, color: '#222' },
})
