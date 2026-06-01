import React, { createContext, useContext, useState, ReactNode } from 'react'

export type VibeTag =
  | 'dancey' | 'chill' | 'rooftop' | 'late-night'
  | 'first-date' | 'lgbtq' | 'live-music' | 'bar-crawl'

export type GroupSize = 'solo' | 'small' | 'large'

export interface CheckInRecord {
  venueId: string
  venueName: string
  timestamp: string
  crowdRating: number
  vibeRating: number
}

export interface RecapRecord {
  id: string
  date: string
  overallRating: number
  totalSpent: number
  venueCount: number
  note: string
}

export interface UserPreferences {
  vibes: VibeTag[]
  budget: number
  groupSize: GroupSize | null
  isAnonymous: boolean
  name: string
  onboardingComplete: boolean
  loyaltyPoints: number
  checkInHistory: CheckInRecord[]
  recapHistory: RecapRecord[]
}

interface UserContextType {
  preferences: UserPreferences
  setVibes: (vibes: VibeTag[]) => void
  setBudget: (budget: number) => void
  setGroupSize: (size: GroupSize) => void
  setIsAnonymous: (anon: boolean) => void
  setName: (name: string) => void
  completeOnboarding: () => void
  addPoints: (pts: number) => void
  recordCheckIn: (record: CheckInRecord) => void
  addRecap: (recap: RecapRecord) => void
}

const defaultPreferences: UserPreferences = {
  vibes: [],
  budget: 50,
  groupSize: null,
  isAnonymous: false,
  name: '',
  onboardingComplete: false,
  loyaltyPoints: 0,
  checkInHistory: [],
  recapHistory: [],
}

const UserContext = createContext<UserContextType | null>(null)

export function UserProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<UserPreferences>(defaultPreferences)

  const setVibes = (vibes: VibeTag[]) => setPreferences(p => ({ ...p, vibes }))
  const setBudget = (budget: number) => setPreferences(p => ({ ...p, budget }))
  const setGroupSize = (groupSize: GroupSize) => setPreferences(p => ({ ...p, groupSize }))
  const setIsAnonymous = (isAnonymous: boolean) => setPreferences(p => ({ ...p, isAnonymous }))
  const setName = (name: string) => setPreferences(p => ({ ...p, name }))
  const completeOnboarding = () => setPreferences(p => ({ ...p, onboardingComplete: true }))
  const addPoints = (pts: number) =>
    setPreferences(p => ({ ...p, loyaltyPoints: p.loyaltyPoints + pts }))
  const recordCheckIn = (record: CheckInRecord) =>
    setPreferences(p => ({ ...p, checkInHistory: [record, ...p.checkInHistory] }))
  const addRecap = (recap: RecapRecord) =>
    setPreferences(p => ({ ...p, recapHistory: [recap, ...p.recapHistory] }))

  return (
    <UserContext.Provider
      value={{
        preferences, setVibes, setBudget, setGroupSize, setIsAnonymous,
        setName, completeOnboarding, addPoints, recordCheckIn, addRecap,
      }}
    >
      {children}
    </UserContext.Provider>
  )
}

export function useUser(): UserContextType {
  const ctx = useContext(UserContext)
  if (!ctx) throw new Error('useUser must be used inside <UserProvider>')
  return ctx
}

export function getLoyaltyTier(pts: number): { tier: string; emoji: string; next: number } {
  if (pts >= 1000) return { tier: 'VIP', emoji: '💎', next: Infinity }
  if (pts >= 500)  return { tier: 'Gold', emoji: '🥇', next: 1000 }
  if (pts >= 100)  return { tier: 'Silver', emoji: '🥈', next: 500 }
  return { tier: 'Bronze', emoji: '🥉', next: 100 }
}
