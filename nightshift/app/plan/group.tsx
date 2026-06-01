import React, { useState, useRef, useMemo } from 'react'
import {
  View, Text, StyleSheet, Animated, PanResponder,
  Dimensions, TouchableOpacity, Pressable, Share,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { useVenues } from '../../hooks/useVenues'
import type { VenueRow } from '../../hooks/useVenues'

const AMBER = '#F5A623'
const BG = '#0D0D0D'
const { width: SW, height: SH } = Dimensions.get('window')
const SWIPE_THRESHOLD = 100

function generateCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

// ── Confetti ──────────────────────────────────────────────────────────────────

function Confetti({ visible }: { visible: boolean }) {
  const particles = useRef(
    Array.from({ length: 24 }, (_, i) => ({
      x: new Animated.Value(0),
      y: new Animated.Value(0),
      opacity: new Animated.Value(0),
      rotate: new Animated.Value(0),
      color: ['#F5A623', '#34D399', '#F87171', '#60A5FA', '#A78BFA', '#FBBF24'][i % 6],
    }))
  ).current

  React.useEffect(() => {
    if (!visible) return
    particles.forEach((p, i) => {
      p.x.setValue(0)
      p.y.setValue(0)
      p.opacity.setValue(0)
      p.rotate.setValue(0)
      Animated.sequence([
        Animated.delay(i * 40),
        Animated.parallel([
          Animated.timing(p.opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
          Animated.spring(p.y, { toValue: -(100 + Math.random() * 200), useNativeDriver: true }),
          Animated.timing(p.x, {
            toValue: (Math.random() - 0.5) * SW * 0.8,
            duration: 800, useNativeDriver: true,
          }),
          Animated.timing(p.rotate, { toValue: 720, duration: 800, useNativeDriver: true }),
        ]),
        Animated.timing(p.opacity, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]).start()
    })
  }, [visible])

  if (!visible) return null

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {particles.map((p, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            bottom: '30%',
            left: SW / 2 - 6,
            width: 12,
            height: 12,
            borderRadius: 3,
            backgroundColor: p.color,
            opacity: p.opacity,
            transform: [
              { translateX: p.x },
              { translateY: p.y },
              { rotate: p.rotate.interpolate({ inputRange: [0, 720], outputRange: ['0deg', '720deg'] }) },
            ],
          }}
        />
      ))}
    </View>
  )
}

// ── Swipe card ────────────────────────────────────────────────────────────────

function SwipeCard({
  venue,
  onSwipe,
}: {
  venue: VenueRow
  onSwipe: (yes: boolean) => void
}) {
  const position = useRef(new Animated.ValueXY()).current
  const [decision, setDecision] = useState<'yes' | 'no' | null>(null)

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: Animated.event([null, { dx: position.x, dy: position.y }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dx > SWIPE_THRESHOLD) {
          setDecision('yes')
          Animated.timing(position, {
            toValue: { x: SW + 100, y: gesture.dy },
            duration: 300, useNativeDriver: false,
          }).start(() => onSwipe(true))
        } else if (gesture.dx < -SWIPE_THRESHOLD) {
          setDecision('no')
          Animated.timing(position, {
            toValue: { x: -SW - 100, y: gesture.dy },
            duration: 300, useNativeDriver: false,
          }).start(() => onSwipe(false))
        } else {
          Animated.spring(position, {
            toValue: { x: 0, y: 0 }, useNativeDriver: false,
          }).start(() => setDecision(null))
        }
      },
    })
  ).current

  const rotate = position.x.interpolate({
    inputRange: [-SW, 0, SW],
    outputRange: ['-15deg', '0deg', '15deg'],
  })

  const yesOpacity = position.x.interpolate({ inputRange: [0, SWIPE_THRESHOLD], outputRange: [0, 1] })
  const noOpacity = position.x.interpolate({ inputRange: [-SWIPE_THRESHOLD, 0], outputRange: [1, 0] })

  return (
    <Animated.View
      style={[
        cardStyles.card,
        { transform: [...position.getTranslateTransform(), { rotate }] },
      ]}
      {...pan.panHandlers}
    >
      <LinearGradient colors={['#2D0057', '#0D0D0D']} style={cardStyles.gradient}>
        <Animated.View style={[cardStyles.yesLabel, { opacity: yesOpacity }]}>
          <Text style={cardStyles.yesText}>YES 👍</Text>
        </Animated.View>
        <Animated.View style={[cardStyles.noLabel, { opacity: noOpacity }]}>
          <Text style={cardStyles.noText}>NOPE 👎</Text>
        </Animated.View>

        <View style={cardStyles.content}>
          <Text style={cardStyles.name}>{venue.name}</Text>
          <Text style={cardStyles.neighbourhood}>{venue.neighbourhood?.name}</Text>
          {venue.google_rating && (
            <Text style={cardStyles.rating}>★ {venue.google_rating.toFixed(1)}</Text>
          )}
          <View style={cardStyles.tags}>
            {(venue.vibe_tags ?? []).slice(0, 3).map(t => (
              <View key={t} style={cardStyles.tag}>
                <Text style={cardStyles.tagText}>{t}</Text>
              </View>
            ))}
          </View>
        </View>
        <Text style={cardStyles.hint}>Swipe right to vote yes · left to skip</Text>
      </LinearGradient>
    </Animated.View>
  )
}

const cardStyles = StyleSheet.create({
  card: {
    width: SW - 48,
    height: SH * 0.5,
    borderRadius: 20,
    overflow: 'hidden',
    position: 'absolute',
  },
  gradient: { flex: 1, padding: 28, justifyContent: 'flex-end' },
  yesLabel: {
    position: 'absolute', top: 32, left: 28, borderWidth: 3,
    borderColor: '#34D399', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 4,
  },
  yesText: { color: '#34D399', fontWeight: '900', fontSize: 22 },
  noLabel: {
    position: 'absolute', top: 32, right: 28, borderWidth: 3,
    borderColor: '#F87171', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 4,
  },
  noText: { color: '#F87171', fontWeight: '900', fontSize: 22 },
  content: { gap: 8 },
  name: { fontSize: 26, fontWeight: '900', color: '#fff', letterSpacing: -0.5 },
  neighbourhood: { fontSize: 14, color: AMBER, fontWeight: '600' },
  rating: { fontSize: 14, color: AMBER },
  tags: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  tag: {
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
  },
  tagText: { fontSize: 11, color: 'rgba(255,255,255,0.6)' },
  hint: { textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: 12, marginTop: 16 },
})

// ── Main screen ───────────────────────────────────────────────────────────────

type Stage = 'setup' | 'waiting' | 'voting' | 'results'

export default function GroupDecisionScreen() {
  const { venues } = useVenues()
  const [stage, setStage] = useState<Stage>('setup')
  const [code] = useState(generateCode)
  const [currentIdx, setCurrentIdx] = useState(0)
  const [votes, setVotes] = useState<Record<string, number>>({})
  const [showConfetti, setShowConfetti] = useState(false)

  const options = useMemo(() =>
    [...venues].sort(() => Math.random() - 0.5).slice(0, 6),
    [venues]
  )

  const currentVenue = options[currentIdx]

  function handleSwipe(yes: boolean) {
    if (!currentVenue) return
    Haptics.impactAsync(yes ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light)
    if (yes) {
      setVotes(v => ({ ...v, [currentVenue.id]: (v[currentVenue.id] ?? 0) + 1 }))
    }
    const next = currentIdx + 1
    if (next >= options.length) {
      setStage('results')
      setShowConfetti(true)
      setTimeout(() => setShowConfetti(false), 2000)
    } else {
      setCurrentIdx(next)
    }
  }

  const winner = useMemo(() => {
    if (stage !== 'results') return null
    const entries = Object.entries(votes)
    if (entries.length === 0) return options[0]
    const [winnerId] = entries.sort((a, b) => b[1] - a[1])[0]
    return options.find(v => v.id === winnerId) ?? options[0]
  }, [stage, votes, options])

  async function shareCode() {
    await Share.share({ message: `Join my NightShift group session! Code: ${code}` })
  }

  // Setup screen
  if (stage === 'setup') {
    return (
      <SafeAreaView style={styles.root} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.back}>← Back</Text>
          </Pressable>
          <Text style={styles.title}>Decide with friends</Text>
        </View>
        <View style={styles.centerContent}>
          <Text style={styles.codeLabel}>Your group code</Text>
          <Text style={styles.code}>{code}</Text>
          <Text style={styles.codeSub}>Share this with your crew</Text>
          <TouchableOpacity style={styles.shareCodeBtn} onPress={shareCode}>
            <Text style={styles.shareCodeBtnText}>↑  Share code</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.startBtn} onPress={() => setStage('voting')}>
            <Text style={styles.startBtnText}>Start voting →</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  // Voting screen
  if (stage === 'voting' && currentVenue) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Text style={styles.title}>Vote</Text>
          <Text style={styles.voteProg}>
            {currentIdx + 1} of {options.length}
          </Text>
        </View>

        <View style={styles.deck}>
          {options.slice(currentIdx, currentIdx + 2).reverse().map((v, i, arr) => (
            <View
              key={v.id}
              style={[
                styles.deckLayer,
                { top: i === 0 ? 8 : 0, transform: [{ scale: i === 0 ? 0.96 : 1 }] }
              ]}
            >
              {i === arr.length - 1 ? (
                <SwipeCard venue={v} onSwipe={handleSwipe} />
              ) : (
                <View style={[cardStyles.card, { backgroundColor: '#111' }]} />
              )}
            </View>
          ))}
        </View>

        <View style={styles.swipeBtns}>
          <TouchableOpacity style={styles.swipeNo} onPress={() => handleSwipe(false)}>
            <Text style={styles.swipeNoText}>✕</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.swipeYes} onPress={() => handleSwipe(true)}>
            <Text style={styles.swipeYesText}>✓</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  // Results screen
  if (stage === 'results' && winner) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <Confetti visible={showConfetti} />
        <View style={styles.resultsContent}>
          <Text style={styles.resultsEmoji}>🎉</Text>
          <Text style={styles.resultsTitle}>The group picked…</Text>
          <View style={styles.winnerCard}>
            <Text style={styles.winnerName}>{winner.name}</Text>
            <Text style={styles.winnerNeighbourhood}>{winner.neighbourhood?.name}</Text>
            {winner.google_rating && (
              <Text style={styles.winnerRating}>★ {winner.google_rating.toFixed(1)}</Text>
            )}
          </View>
          <TouchableOpacity
            style={styles.viewBtn}
            onPress={() => router.push({ pathname: '/venue/[id]', params: { id: winner.id } })}
          >
            <Text style={styles.viewBtnText}>View venue →</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => {
            setCurrentIdx(0)
            setVotes({})
            setStage('setup')
          }}>
            <Text style={styles.restartText}>Start over</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  return null
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16, gap: 4 },
  back: { fontSize: 14, color: AMBER, fontWeight: '600', marginBottom: 4 },
  title: { fontSize: 24, fontWeight: '900', color: '#fff', letterSpacing: -0.5 },
  voteProg: { fontSize: 13, color: '#555' },

  centerContent: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  codeLabel: { fontSize: 14, color: '#555', fontWeight: '600' },
  code: { fontSize: 52, fontWeight: '900', color: '#fff', letterSpacing: 6 },
  codeSub: { fontSize: 13, color: '#555', marginBottom: 8 },
  shareCodeBtn: {
    borderWidth: 1, borderColor: '#2A2A2A', borderRadius: 14,
    paddingHorizontal: 24, paddingVertical: 14,
  },
  shareCodeBtnText: { fontSize: 15, color: '#888', fontWeight: '700' },
  startBtn: {
    backgroundColor: AMBER, borderRadius: 14, paddingHorizontal: 40,
    paddingVertical: 16, marginTop: 8,
  },
  startBtnText: { fontSize: 17, fontWeight: '800', color: '#000' },

  deck: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  deckLayer: { position: 'absolute' },

  swipeBtns: {
    flexDirection: 'row', justifyContent: 'center', gap: 32,
    paddingBottom: 32, paddingTop: 16,
  },
  swipeNo: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: '#1A0A0A',
    borderWidth: 2, borderColor: '#F87171', alignItems: 'center', justifyContent: 'center',
  },
  swipeNoText: { fontSize: 24, color: '#F87171' },
  swipeYes: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: '#0A1A0A',
    borderWidth: 2, borderColor: '#34D399', alignItems: 'center', justifyContent: 'center',
  },
  swipeYesText: { fontSize: 24, color: '#34D399' },

  resultsContent: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32 },
  resultsEmoji: { fontSize: 64 },
  resultsTitle: { fontSize: 18, color: '#888', fontWeight: '600' },
  winnerCard: {
    width: '100%', backgroundColor: '#111', borderRadius: 20, padding: 28,
    alignItems: 'center', gap: 8, borderWidth: 2, borderColor: AMBER,
  },
  winnerName: { fontSize: 26, fontWeight: '900', color: '#fff', textAlign: 'center' },
  winnerNeighbourhood: { fontSize: 14, color: AMBER, fontWeight: '600' },
  winnerRating: { fontSize: 14, color: AMBER },
  viewBtn: { backgroundColor: AMBER, borderRadius: 14, paddingHorizontal: 32, paddingVertical: 16 },
  viewBtnText: { fontSize: 16, fontWeight: '800', color: '#000' },
  restartText: { fontSize: 13, color: '#555', textDecorationLine: 'underline' },
})
