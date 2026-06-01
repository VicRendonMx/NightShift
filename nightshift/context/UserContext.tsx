import React, { createContext, useContext, useState, ReactNode } from 'react'

export type VibeTag =
  | 'dancey'
  | 'chill'
  | 'rooftop'
  | 'late-night'
  | 'first-date'
  | 'lgbtq'
  | 'live-music'
  | 'bar-crawl'

export type GroupSize = 'solo' | 'small' | 'large'

export interface UserPreferences {
  vibes: VibeTag[]
  budget: number
  groupSize: GroupSize | null
  isAnonymous: boolean
  name: string
  onboardingComplete: boolean
}

interface UserContextType {
  preferences: UserPreferences
  setVibes: (vibes: VibeTag[]) => void
  setBudget: (budget: number) => void
  setGroupSize: (size: GroupSize) => void
  setIsAnonymous: (anon: boolean) => void
  setName: (name: string) => void
  completeOnboarding: () => void
}

const defaultPreferences: UserPreferences = {
  vibes: [],
  budget: 50,
  groupSize: null,
  isAnonymous: false,
  name: '',
  onboardingComplete: false,
}

const UserContext = createContext<UserContextType | null>(null)

export function UserProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<UserPreferences>(defaultPreferences)

  const setVibes = (vibes: VibeTag[]) =>
    setPreferences(p => ({ ...p, vibes }))
  const setBudget = (budget: number) =>
    setPreferences(p => ({ ...p, budget }))
  const setGroupSize = (groupSize: GroupSize) =>
    setPreferences(p => ({ ...p, groupSize }))
  const setIsAnonymous = (isAnonymous: boolean) =>
    setPreferences(p => ({ ...p, isAnonymous }))
  const setName = (name: string) =>
    setPreferences(p => ({ ...p, name }))
  const completeOnboarding = () =>
    setPreferences(p => ({ ...p, onboardingComplete: true }))

  return (
    <UserContext.Provider
      value={{ preferences, setVibes, setBudget, setGroupSize, setIsAnonymous, setName, completeOnboarding }}
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
