import React, { useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
  Pressable, Alert, KeyboardAvoidingView, Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { useUser } from '../context/UserContext'
import type { RecapRecord } from '../context/UserContext'

const AMBER = '#F5A623'
const BG = '#0D0D0D'
const RECAP_POINTS = 5

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <Pressable key={n} onPress={() => onChange(n)} hitSlop={8}>
          <Text style={{ fontSize: 32, color: n <= value ? AMBER : '#2A2A2A' }}>★</Text>
        </Pressable>
      ))}
    </View>
  )
}

function SpendInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <View style={spendStyles.wrap}>
      <Text style={spendStyles.dollar}>$</Text>
      <TextInput
        value={value}
        onChangeText={t => onChange(t.replace(/[^0-9]/g, ''))}
        placeholder="0"
        placeholderTextColor="#333"
        keyboardType="numeric"
        style={spendStyles.input}
        maxLength={6}
      />
    </View>
  )
}

const spendStyles = StyleSheet.create({
  wrap: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#111',
    borderRadius: 14, paddingHorizontal: 16, borderWidth: 1, borderColor: '#1E1E1E',
  },
  dollar: { fontSize: 24, color: AMBER, fontWeight: '800', marginRight: 4 },
  input: { flex: 1, fontSize: 28, color: '#fff', fontWeight: '800', paddingVertical: 14 },
})

export default function RecapScreen() {
  const { preferences, addPoints, addRecap } = useUser()
  const { checkInHistory } = preferences

  const todayISO = new Date().toISOString().slice(0, 10)
  const todaysCheckIns = checkInHistory.filter(c => c.timestamp.startsWith(todayISO))

  const [overallRating, setOverallRating] = useState(4)
  const [totalSpent, setTotalSpent] = useState('')
  const [note, setNote] = useState('')
  const [saved, setSaved] = useState(false)

  function save() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    const recap: RecapRecord = {
      id: Date.now().toString(),
      date: todayISO,
      overallRating,
      totalSpent: Number(totalSpent) || 0,
      venueCount: todaysCheckIns.length,
      note: note.trim(),
    }

    addRecap(recap)
    addPoints(RECAP_POINTS)
    setSaved(true)
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
  }

  if (saved) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.savedWrap}>
          <Text style={styles.savedEmoji}>🌙</Text>
          <Text style={styles.savedTitle}>Night saved!</Text>
          <Text style={styles.savedSub}>+{RECAP_POINTS} points for the memories</Text>
          <View style={styles.savedStats}>
            <View style={styles.savedStat}>
              <Text style={styles.savedStatVal}>{'★'.repeat(overallRating)}</Text>
              <Text style={styles.savedStatLabel}>Rating</Text>
            </View>
            <View style={styles.savedStat}>
              <Text style={styles.savedStatVal}>{todaysCheckIns.length}</Text>
              <Text style={styles.savedStatLabel}>Spots</Text>
            </View>
            <View style={styles.savedStat}>
              <Text style={styles.savedStatVal}>${totalSpent || '0'}</Text>
              <Text style={styles.savedStatLabel}>Spent</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.doneBtn} onPress={() => router.replace('/(tabs)')}>
            <Text style={styles.doneBtnText}>Back to home →</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Pressable onPress={() => router.back()} hitSlop={12}>
              <Text style={styles.back}>← Back</Text>
            </Pressable>
            <Text style={styles.title}>Post-Night Recap</Text>
            <Text style={styles.sub}>Lock in the memory before the night ends</Text>
          </View>

          {/* Tonight's stops from check-ins */}
          {todaysCheckIns.length > 0 ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Tonight's stops</Text>
              <View style={styles.stopsList}>
                {todaysCheckIns.map((c, i) => (
                  <View key={c.timestamp} style={styles.stopRow}>
                    <View style={styles.stopBullet}>
                      <Text style={styles.stopBulletText}>{i + 1}</Text>
                    </View>
                    <View style={styles.stopInfo}>
                      <Text style={styles.stopName}>{c.venueName}</Text>
                      <Text style={styles.stopMeta}>
                        Crowd {c.crowdRating}/5 · Vibe {c.vibeRating}/5
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ) : (
            <View style={styles.noCheckIns}>
              <Text style={styles.noCheckInsText}>
                No check-ins tonight yet. You can still save a recap.
              </Text>
            </View>
          )}

          {/* Overall rating */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>How was the night overall?</Text>
            <StarRating value={overallRating} onChange={setOverallRating} />
          </View>

          {/* Total spent */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Total spent tonight</Text>
            <SpendInput value={totalSpent} onChange={setTotalSpent} />
          </View>

          {/* Note */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Memory note (optional)</Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Best moment of the night…"
              placeholderTextColor="#333"
              style={styles.noteInput}
              multiline
              maxLength={300}
            />
          </View>

          <TouchableOpacity style={styles.saveBtn} onPress={save}>
            <Text style={styles.saveBtnText}>Save recap · +{RECAP_POINTS} pts</Text>
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  content: { padding: 20, gap: 24 },

  header: { gap: 6 },
  back: { fontSize: 14, color: AMBER, fontWeight: '600' },
  title: { fontSize: 26, fontWeight: '900', color: '#fff', letterSpacing: -0.5 },
  sub: { fontSize: 13, color: '#555' },

  section: { gap: 12 },
  sectionTitle: { fontSize: 14, color: '#888', fontWeight: '700', letterSpacing: 0.4 },

  stopsList: { gap: 10 },
  stopRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#111', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: '#1E1E1E',
  },
  stopBullet: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: AMBER,
    alignItems: 'center', justifyContent: 'center',
  },
  stopBulletText: { fontSize: 13, fontWeight: '800', color: '#000' },
  stopInfo: { flex: 1 },
  stopName: { fontSize: 14, fontWeight: '800', color: '#fff' },
  stopMeta: { fontSize: 12, color: '#555', marginTop: 2 },

  noCheckIns: {
    backgroundColor: '#111', borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: '#1E1E1E', borderStyle: 'dashed',
  },
  noCheckInsText: { fontSize: 13, color: '#555', textAlign: 'center' },

  noteInput: {
    backgroundColor: '#111', borderRadius: 14, padding: 16, color: '#fff',
    fontSize: 14, minHeight: 90, textAlignVertical: 'top',
    borderWidth: 1, borderColor: '#1E1E1E',
  },

  saveBtn: { backgroundColor: AMBER, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  saveBtnText: { fontSize: 16, fontWeight: '800', color: '#000' },

  // Saved state
  savedWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  savedEmoji: { fontSize: 72 },
  savedTitle: { fontSize: 28, fontWeight: '900', color: '#fff' },
  savedSub: { fontSize: 14, color: AMBER, fontWeight: '600' },
  savedStats: {
    flexDirection: 'row', gap: 0, backgroundColor: '#111', borderRadius: 14,
    padding: 20, width: '100%', justifyContent: 'space-around',
    borderWidth: 1, borderColor: '#1E1E1E',
  },
  savedStat: { alignItems: 'center', gap: 6 },
  savedStatVal: { fontSize: 20, fontWeight: '900', color: AMBER },
  savedStatLabel: { fontSize: 11, color: '#555', fontWeight: '600' },
  doneBtn: { backgroundColor: AMBER, borderRadius: 14, paddingHorizontal: 32, paddingVertical: 14 },
  doneBtnText: { fontSize: 16, fontWeight: '800', color: '#000' },
})
