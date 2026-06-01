import { Redirect } from 'expo-router'
import { useUser } from '../context/UserContext'

export default function Index() {
  const { preferences } = useUser()
  return preferences.onboardingComplete
    ? <Redirect href="/(tabs)" />
    : <Redirect href="/(onboarding)" />
}
