import React, { useState } from 'react'
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity, Pressable,
  ScrollView, Alert, KeyboardAvoidingView, Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, router } from 'expo-router'
import * as Haptics from 'expo-haptics'
import { supabase } from '../lib/supabase'

const AMBER = '#F5A623'
const BG = '#0D0D0D'

const FLAG_TYPES = [
  { id: 'harassment', label: 'Harassment', emoji: '⚠️' },
  { id: 'unsafe_environment', label: 'Unsafe environment', emoji: '🔴' },
  { id: 'overserving', label: 'Overserving alcohol', emoji: '🍺' },
  { id: 'discrimination', label: 'Discrimination', emoji: '🚫' },
  { id: 'other', label: 'Other', emoji: '📋' },
]

type Stage = 'form' | 'done'

export default function SafetyScreen() {
  const { venueId, venueName } = useLocalSearchParams<{ venueId?: string; venueName?: string }>()

  const [selectedType, setSelectedType] = useState<string | null>(null)
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [stage, setStage] = useState<Stage>('form')

  async function submit() {
    if (!selectedType) {
      Alert.alert('Select a concern type', 'Please choose what kind of concern you are reporting.')
      return
    }

    setLoading(true)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)

    const { error } = await supabase.from('safety_flag' as any).insert({
      venue_id: venueId ?? null,
      flag_type: selectedType,
      description: description.trim() || null,
      is_anonymous: true,
    })

    setLoading(false)

    if (error) {
      Alert.alert('Error', 'Could not submit report. Please try again.')
      return
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    setStage('done')
  }

  if (stage === 'done') {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <View style={styles.doneWrap}>
          <Text style={styles.doneEmoji}>🛡️</Text>
          <Text style={styles.doneTitle}>Report submitted</Text>
          <Text style={styles.doneSub}>
            Thank you for keeping the community safe. This report is completely anonymous.
          </Text>
          <TouchableOpacity style={styles.doneBtn} onPress={() => router.back()}>
            <Text style={styles.doneBtnText}>← Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* Header */}
          <View style={styles.header}>
            <Pressable onPress={() => router.back()} hitSlop={12}>
              <Text style={styles.back}>← Back</Text>
            </Pressable>
            <Text style={styles.title}>Report a Concern</Text>
            {venueName ? (
              <Text style={styles.venueName}>{venueName}</Text>
            ) : null}
          </View>

          {/* Anon notice */}
          <View style={styles.anonNotice}>
            <Text style={styles.anonIcon}>🔒</Text>
            <Text style={styles.anonText}>
              This report is always 100% anonymous. We never share your identity.
            </Text>
          </View>

          {/* Flag type */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>What happened?</Text>
            <View style={styles.typeGrid}>
              {FLAG_TYPES.map(t => (
                <Pressable
                  key={t.id}
                  style={[styles.typeCard, selectedType === t.id && styles.typeCardSelected]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                    setSelectedType(t.id)
                  }}
                >
                  <Text style={styles.typeEmoji}>{t.emoji}</Text>
                  <Text style={[styles.typeLabel, selectedType === t.id && styles.typeLabelSelected]}>
                    {t.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Description */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Add details (optional)</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Describe what happened. The more detail, the better we can help."
              placeholderTextColor="#333"
              style={styles.textInput}
              multiline
              maxLength={500}
            />
            <Text style={styles.charCount}>{description.length}/500</Text>
          </View>

          <TouchableOpacity
            style={[styles.submitBtn, (!selectedType || loading) && styles.submitBtnDisabled]}
            onPress={submit}
            disabled={!selectedType || loading}
          >
            <Text style={styles.submitBtnText}>
              {loading ? 'Submitting…' : 'Submit anonymous report'}
            </Text>
          </TouchableOpacity>

          <Text style={styles.disclaimer}>
            Reports are reviewed by our team within 24 hours. For emergencies, call 911.
          </Text>
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
  venueName: { fontSize: 14, color: '#555' },

  anonNotice: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: 'rgba(52,211,153,0.06)', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: 'rgba(52,211,153,0.15)',
  },
  anonIcon: { fontSize: 18 },
  anonText: { fontSize: 13, color: '#34D399', lineHeight: 18, flex: 1, fontWeight: '500' },

  section: { gap: 10 },
  sectionTitle: { fontSize: 14, color: '#888', fontWeight: '700', letterSpacing: 0.4 },

  typeGrid: { gap: 8 },
  typeCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#111', borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: '#1E1E1E',
  },
  typeCardSelected: { borderColor: '#EF4444', backgroundColor: 'rgba(239,68,68,0.06)' },
  typeEmoji: { fontSize: 20, width: 28, textAlign: 'center' },
  typeLabel: { fontSize: 15, fontWeight: '600', color: '#888' },
  typeLabelSelected: { color: '#EF4444' },

  textInput: {
    backgroundColor: '#111', borderRadius: 14, padding: 16, color: '#fff',
    fontSize: 14, minHeight: 100, textAlignVertical: 'top',
    borderWidth: 1, borderColor: '#1E1E1E',
  },
  charCount: { fontSize: 11, color: '#333', textAlign: 'right' },

  submitBtn: { backgroundColor: '#EF4444', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  submitBtnDisabled: { opacity: 0.4 },
  submitBtnText: { fontSize: 16, fontWeight: '800', color: '#fff' },

  disclaimer: { fontSize: 12, color: '#333', textAlign: 'center', lineHeight: 18 },

  doneWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32 },
  doneEmoji: { fontSize: 72 },
  doneTitle: { fontSize: 26, fontWeight: '900', color: '#fff' },
  doneSub: { fontSize: 14, color: '#555', textAlign: 'center', lineHeight: 20 },
  doneBtn: { borderWidth: 1, borderColor: '#2A2A2A', borderRadius: 14, paddingHorizontal: 24, paddingVertical: 14 },
  doneBtnText: { fontSize: 14, color: '#888', fontWeight: '700' },
})
