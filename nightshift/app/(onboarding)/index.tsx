import React, { useState, useRef, useCallback, useEffect } from 'react'
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Dimensions,
  TextInput,
  Animated,
  PanResponder,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import * as Haptics from 'expo-haptics'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useUser, VibeTag, GroupSize } from '../../context/UserContext'
import { VIBE_CONFIG, BUDGET_TIERS } from '../../lib/mock-data'

const { width: SW, height: SH } = Dimensions.get('window')
const CARD_W = SW * 0.76
const CARD_GAP = 14
const SIDE_INSET = (SW - CARD_W) / 2

const VIBES = Object.entries(VIBE_CONFIG).map(([id, cfg]) => ({ id: id as VibeTag, ...cfg }))
const TOTAL_STEPS = 5
const AMBER = '#F5A623'
const BG = '#0D0D0D'

// ─── Budget Slider ────────────────────────────────────────────────────────────

function BudgetSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const trackRef = useRef<View>(null)
  const trackWidth = useRef(SW - 48)
  const MAX = 200

  const pct = Math.min(value / MAX, 1)

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        const x = e.nativeEvent.locationX
        const raw = Math.round((x / trackWidth.current) * MAX)
        onChange(Math.max(0, Math.min(MAX, raw)))
      },
      onPanResponderMove: (e) => {
        const x = e.nativeEvent.locationX
        const raw = Math.round((x / trackWidth.current) * MAX)
        onChange(Math.max(0, Math.min(MAX, raw)))
      },
    })
  ).current

  const getBudgetTier = () =>
    BUDGET_TIERS.find(t => value <= t.max) ?? BUDGET_TIERS[BUDGET_TIERS.length - 1]

  const tier = getBudgetTier()

  return (
    <View style={sliderStyles.wrap}>
      <Text style={sliderStyles.amount}>
        {value >= 200 ? '$200+' : `$${value}`}
      </Text>
      <Text style={sliderStyles.tierLabel}>{tier.label}</Text>
      <Text style={sliderStyles.tierSub}>{tier.sub}</Text>

      <View style={sliderStyles.trackWrap} {...pan.panHandlers}>
        <View
          ref={trackRef}
          style={sliderStyles.track}
          onLayout={e => { trackWidth.current = e.nativeEvent.layout.width }}
        >
          <View style={[sliderStyles.fill, { width: `${pct * 100}%` }]} />
        </View>
        <View style={[sliderStyles.thumb, { left: `${pct * 100}%` }]} />
      </View>

      <View style={sliderStyles.labels}>
        <Text style={sliderStyles.rangeLabel}>Free</Text>
        <Text style={sliderStyles.rangeLabel}>$200+</Text>
      </View>
    </View>
  )
}

const sliderStyles = StyleSheet.create({
  wrap: { width: '100%', alignItems: 'center', gap: 6 },
  amount: { fontSize: 64, fontWeight: '800', color: AMBER, letterSpacing: -2, lineHeight: 72 },
  tierLabel: { fontSize: 22, fontWeight: '700', color: '#fff' },
  tierSub: { fontSize: 14, color: '#666', marginBottom: 24 },
  trackWrap: { width: '100%', height: 44, justifyContent: 'center', paddingHorizontal: 0 },
  track: {
    height: 4,
    backgroundColor: '#2A2A2A',
    borderRadius: 2,
    overflow: 'visible',
  },
  fill: {
    height: '100%',
    backgroundColor: AMBER,
    borderRadius: 2,
  },
  thumb: {
    position: 'absolute',
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: AMBER,
    top: '50%',
    marginTop: -13 + 2,
    marginLeft: -13,
    shadowColor: AMBER,
    shadowOpacity: 0.5,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  labels: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  rangeLabel: { fontSize: 12, color: '#555', fontWeight: '600' },
})

// ─── Step 1: Vibe ─────────────────────────────────────────────────────────────

function VibeStep({
  selected,
  onToggle,
}: {
  selected: VibeTag[]
  onToggle: (v: VibeTag) => void
}) {
  const flatRef = useRef<FlatList>(null)

  return (
    <View style={stepStyles.container}>
      <View style={stepStyles.header}>
        <Text style={stepStyles.title}>What's your vibe{'\n'}tonight?</Text>
        <Text style={stepStyles.subtitle}>Swipe to browse · tap to select</Text>
      </View>

      <FlatList
        ref={flatRef}
        data={VIBES}
        horizontal
        keyExtractor={item => item.id}
        showsHorizontalScrollIndicator={false}
        snapToInterval={CARD_W + CARD_GAP}
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: SIDE_INSET, gap: CARD_GAP }}
        renderItem={({ item }) => {
          const isSelected = selected.includes(item.id)
          return (
            <Pressable onPress={() => onToggle(item.id)} style={{ width: CARD_W }}>
              <LinearGradient
                colors={item.colors as [string, string]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[vibeCardStyles.card, isSelected && vibeCardStyles.cardSelected]}
              >
                {isSelected && (
                  <View style={vibeCardStyles.checkBadge}>
                    <Text style={vibeCardStyles.checkMark}>✓</Text>
                  </View>
                )}
                <Text style={vibeCardStyles.emoji}>{item.emoji}</Text>
                <Text style={vibeCardStyles.label}>{item.label}</Text>
                <Text style={vibeCardStyles.desc}>{item.desc}</Text>
              </LinearGradient>
            </Pressable>
          )
        }}
      />

      {selected.length > 0 && (
        <View style={stepStyles.selectionPills}>
          {selected.map(v => (
            <View key={v} style={stepStyles.pill}>
              <Text style={stepStyles.pillText}>{VIBE_CONFIG[v].label}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  )
}

const vibeCardStyles = StyleSheet.create({
  card: {
    width: CARD_W,
    height: SH * 0.42,
    borderRadius: 20,
    padding: 28,
    justifyContent: 'flex-end',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  cardSelected: {
    borderColor: AMBER,
    shadowColor: AMBER,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
  checkBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: AMBER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkMark: { color: '#000', fontSize: 14, fontWeight: '800' },
  emoji: { fontSize: 52, marginBottom: 16 },
  label: { fontSize: 26, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  desc: { fontSize: 14, color: 'rgba(255,255,255,0.6)', marginTop: 6, lineHeight: 20 },
})

const stepStyles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', gap: 24 },
  header: { paddingHorizontal: 28, gap: 8 },
  title: { fontSize: 32, fontWeight: '800', color: '#fff', letterSpacing: -1, lineHeight: 38 },
  subtitle: { fontSize: 14, color: '#555', fontWeight: '500' },
  selectionPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 28,
    gap: 8,
  },
  pill: {
    backgroundColor: 'rgba(245,166,35,0.15)',
    borderColor: AMBER,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  pillText: { fontSize: 12, color: AMBER, fontWeight: '600' },
})

// ─── Step 2: Budget ───────────────────────────────────────────────────────────

function BudgetStep({
  budget,
  onChange,
}: {
  budget: number
  onChange: (v: number) => void
}) {
  return (
    <View style={[stepStyles.container, { paddingHorizontal: 24 }]}>
      <View style={[stepStyles.header, { paddingHorizontal: 4 }]}>
        <Text style={stepStyles.title}>What's your{'\n'}budget tonight?</Text>
        <Text style={[stepStyles.subtitle, { marginTop: 4 }]}>
          We'll match you to venues in your range
        </Text>
      </View>
      <BudgetSlider value={budget} onChange={onChange} />
    </View>
  )
}

// ─── Step 3: Group ────────────────────────────────────────────────────────────

const GROUP_OPTIONS: {
  id: GroupSize
  emoji: string
  label: string
  sub: string
}[] = [
  { id: 'solo',  emoji: '🧍', label: 'Just me',       sub: 'Flying solo tonight' },
  { id: 'small', emoji: '👥', label: 'Small group',   sub: '2 – 4 people' },
  { id: 'large', emoji: '🎉', label: 'Big group',     sub: '5 or more' },
]

function GroupStep({
  selected,
  onSelect,
}: {
  selected: GroupSize | null
  onSelect: (s: GroupSize) => void
}) {
  return (
    <View style={[stepStyles.container, { paddingHorizontal: 24 }]}>
      <View style={[stepStyles.header, { paddingHorizontal: 0 }]}>
        <Text style={stepStyles.title}>Who are you{'\n'}going with?</Text>
      </View>
      <View style={groupStyles.options}>
        {GROUP_OPTIONS.map(opt => {
          const isSelected = selected === opt.id
          return (
            <Pressable
              key={opt.id}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                onSelect(opt.id)
              }}
              style={[groupStyles.card, isSelected && groupStyles.cardSelected]}
            >
              <Text style={groupStyles.emoji}>{opt.emoji}</Text>
              <View>
                <Text style={[groupStyles.label, isSelected && groupStyles.labelSelected]}>
                  {opt.label}
                </Text>
                <Text style={groupStyles.sub}>{opt.sub}</Text>
              </View>
              {isSelected && (
                <View style={groupStyles.check}>
                  <Text style={groupStyles.checkText}>✓</Text>
                </View>
              )}
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

const groupStyles = StyleSheet.create({
  options: { gap: 12 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#161616',
    borderRadius: 16,
    padding: 20,
    gap: 16,
    borderWidth: 1.5,
    borderColor: '#222',
  },
  cardSelected: {
    borderColor: AMBER,
    backgroundColor: 'rgba(245,166,35,0.06)',
  },
  emoji: { fontSize: 34 },
  label: { fontSize: 18, fontWeight: '700', color: '#888' },
  labelSelected: { color: '#fff' },
  sub: { fontSize: 13, color: '#555', marginTop: 2 },
  check: {
    marginLeft: 'auto',
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: AMBER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkText: { color: '#000', fontSize: 13, fontWeight: '800' },
})

// ─── Step 4: Anonymous Mode ───────────────────────────────────────────────────

function AnonStep({
  isAnonymous,
  onToggle,
}: {
  isAnonymous: boolean
  onToggle: (v: boolean) => void
}) {
  return (
    <View style={anonStyles.container}>
      <Text style={anonStyles.ghost}>👻</Text>
      <Text style={anonStyles.title}>Go out without{'\n'}leaving a trace</Text>
      <Text style={anonStyles.body}>
        Your check-ins, reviews, and safety reports are visible to no one — not even us publicly.
        You can toggle this any time from your profile.
      </Text>

      <View style={anonStyles.bullets}>
        {[
          'Your name shows as "NightShift Ghost"',
          'Check-ins post with no identifying info',
          'Reviews show as "Anonymous"',
          'All features still work exactly the same',
        ].map(line => (
          <View key={line} style={anonStyles.bulletRow}>
            <Text style={anonStyles.bulletDot}>·</Text>
            <Text style={anonStyles.bulletText}>{line}</Text>
          </View>
        ))}
      </View>

      <View style={anonStyles.buttons}>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
            onToggle(true)
          }}
          style={[anonStyles.btn, anonStyles.btnGhost, isAnonymous && anonStyles.btnActive]}
        >
          <Text style={[anonStyles.btnText, isAnonymous && anonStyles.btnTextActive]}>
            👻  Stay anonymous
          </Text>
        </Pressable>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
            onToggle(false)
          }}
          style={[anonStyles.btn, anonStyles.btnVisible, !isAnonymous && anonStyles.btnVisibleActive]}
        >
          <Text style={[anonStyles.btnText, !isAnonymous && { color: '#000' }]}>
            I'll be visible
          </Text>
        </Pressable>
      </View>
    </View>
  )
}

const anonStyles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 28, justifyContent: 'center', gap: 20 },
  ghost: { fontSize: 64, textAlign: 'center' },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -1,
    textAlign: 'center',
    lineHeight: 36,
  },
  body: {
    fontSize: 15,
    color: '#666',
    lineHeight: 22,
    textAlign: 'center',
  },
  bullets: { gap: 8, paddingHorizontal: 8 },
  bulletRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  bulletDot: { color: AMBER, fontSize: 20, lineHeight: 22 },
  bulletText: { fontSize: 14, color: '#555', flex: 1, lineHeight: 20 },
  buttons: { gap: 12, marginTop: 8 },
  btn: {
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#2A2A2A',
  },
  btnGhost: { backgroundColor: 'transparent' },
  btnActive: { borderColor: AMBER, backgroundColor: 'rgba(245,166,35,0.1)' },
  btnVisible: { backgroundColor: 'transparent' },
  btnVisibleActive: { backgroundColor: AMBER, borderColor: AMBER },
  btnText: { fontSize: 16, fontWeight: '700', color: '#666' },
  btnTextActive: { color: AMBER },
})

// ─── Step 5: Name ─────────────────────────────────────────────────────────────

function NameStep({
  name,
  isAnonymous,
  onChange,
}: {
  name: string
  isAnonymous: boolean
  onChange: (v: string) => void
}) {
  const inputRef = useRef<TextInput>(null)

  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 300)
    return () => clearTimeout(timer)
  }, [])

  if (isAnonymous) {
    return (
      <View style={nameStyles.container}>
        <Text style={nameStyles.ghostBig}>👻</Text>
        <Text style={nameStyles.anonTitle}>You're going as</Text>
        <Text style={nameStyles.ghostName}>NightShift Ghost</Text>
        <Text style={nameStyles.anonSub}>
          You can change this any time from your profile.
        </Text>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1 }}
    >
      <View style={nameStyles.container}>
        <Text style={stepStyles.title}>What should{'\n'}we call you?</Text>
        <Text style={stepStyles.subtitle}>Only visible to you and the people you share with</Text>

        <TextInput
          ref={inputRef}
          value={name}
          onChangeText={onChange}
          placeholder="Your name or nickname"
          placeholderTextColor="#444"
          style={nameStyles.input}
          returnKeyType="done"
          maxLength={32}
          autoCorrect={false}
          autoCapitalize="words"
        />
        {name.trim().length === 0 && (
          <Text style={nameStyles.skipHint}>
            Leave blank to continue as "Night Owl"
          </Text>
        )}
      </View>
    </KeyboardAvoidingView>
  )
}

const nameStyles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: 'center',
    gap: 16,
  },
  input: {
    backgroundColor: '#161616',
    borderWidth: 1.5,
    borderColor: '#2A2A2A',
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 18,
    fontSize: 18,
    color: '#fff',
    fontWeight: '600',
    marginTop: 8,
  },
  skipHint: { fontSize: 13, color: '#444', textAlign: 'center' },
  ghostBig: { fontSize: 72, textAlign: 'center' },
  anonTitle: { fontSize: 16, color: '#666', textAlign: 'center', fontWeight: '500' },
  ghostName: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  anonSub: { fontSize: 14, color: '#555', textAlign: 'center', lineHeight: 20 },
})

// ─── Root: Onboarding Container ───────────────────────────────────────────────

export default function OnboardingScreen() {
  const [step, setStep] = useState(0)
  const [selectedVibes, setSelectedVibes] = useState<VibeTag[]>([])
  const [budget, setBudget] = useState(50)
  const [groupSize, setGroupSize] = useState<GroupSize | null>(null)
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [name, setName] = useState('')

  const { setVibes, setBudget: saveBudget, setGroupSize: saveGroup, setIsAnonymous: saveAnon, setName: saveName, completeOnboarding } = useUser()

  const fadeAnim = useRef(new Animated.Value(1)).current

  const transition = useCallback((nextStep: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    Animated.timing(fadeAnim, { toValue: 0, duration: 120, useNativeDriver: true }).start(() => {
      setStep(nextStep)
      Animated.timing(fadeAnim, { toValue: 1, duration: 180, useNativeDriver: true }).start()
    })
  }, [fadeAnim])

  const canContinue = () => {
    if (step === 0) return selectedVibes.length > 0
    if (step === 2) return groupSize !== null
    return true
  }

  const handleContinue = () => {
    if (!canContinue()) return
    if (step < TOTAL_STEPS - 1) {
      transition(step + 1)
    } else {
      setVibes(selectedVibes)
      saveBudget(budget)
      if (groupSize) saveGroup(groupSize)
      saveAnon(isAnonymous)
      saveName(name.trim() || (isAnonymous ? '' : 'Night Owl'))
      completeOnboarding()
      router.replace('/(tabs)')
    }
  }

  const handleBack = () => {
    if (step > 0) transition(step - 1)
  }

  const toggleVibe = (vibe: VibeTag) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    setSelectedVibes(prev =>
      prev.includes(vibe) ? prev.filter(v => v !== vibe) : [...prev, vibe]
    )
  }

  return (
    <LinearGradient colors={[BG, '#111']} style={styles.root}>
      {/* ── Header ── */}
      <SafeAreaView edges={['top']} style={styles.topBar}>
        <View style={styles.progressRow}>
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i < step && styles.dotDone,
                i === step && styles.dotActive,
              ]}
            />
          ))}
        </View>
        {step > 0 && (
          <TouchableOpacity onPress={handleBack} style={styles.backBtn} hitSlop={12}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
        )}
      </SafeAreaView>

      {/* ── Step Content ── */}
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        {step === 0 && (
          <VibeStep selected={selectedVibes} onToggle={toggleVibe} />
        )}
        {step === 1 && (
          <BudgetStep budget={budget} onChange={setBudget} />
        )}
        {step === 2 && (
          <GroupStep selected={groupSize} onSelect={setGroupSize} />
        )}
        {step === 3 && (
          <AnonStep isAnonymous={isAnonymous} onToggle={setIsAnonymous} />
        )}
        {step === 4 && (
          <NameStep name={name} isAnonymous={isAnonymous} onChange={setName} />
        )}
      </Animated.View>

      {/* ── Footer ── */}
      <SafeAreaView edges={['bottom']} style={styles.footer}>
        {step === 0 && (
          <Text style={styles.hintText}>Pick as many vibes as you like</Text>
        )}
        <TouchableOpacity
          onPress={handleContinue}
          activeOpacity={0.85}
          style={[styles.continueBtn, !canContinue() && styles.continueBtnDisabled]}
        >
          <Text style={[styles.continueBtnText, !canContinue() && styles.continueBtnTextDisabled]}>
            {step === TOTAL_STEPS - 1 ? "Let's go  →" : 'Continue  →'}
          </Text>
        </TouchableOpacity>
      </SafeAreaView>
    </LinearGradient>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  topBar: { paddingHorizontal: 24, paddingBottom: 8 },
  progressRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    paddingTop: 12,
  },
  dot: {
    width: 28,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#2A2A2A',
  },
  dotDone: { backgroundColor: '#3D3D3D' },
  dotActive: { backgroundColor: AMBER, width: 36 },
  backBtn: { marginTop: 8 },
  backText: { fontSize: 14, color: '#555', fontWeight: '600' },
  content: { flex: 1 },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 12,
    gap: 10,
  },
  hintText: {
    fontSize: 13,
    color: '#444',
    textAlign: 'center',
    fontWeight: '500',
  },
  continueBtn: {
    backgroundColor: AMBER,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
  },
  continueBtnDisabled: {
    backgroundColor: '#1E1E1E',
  },
  continueBtnText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#000',
    letterSpacing: 0.2,
  },
  continueBtnTextDisabled: {
    color: '#3D3D3D',
  },
})
