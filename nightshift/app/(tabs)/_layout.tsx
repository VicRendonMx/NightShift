import { Tabs } from 'expo-router'
import { View, Text, StyleSheet } from 'react-native'

const AMBER = '#F5A623'
const BG = '#0D0D0D'

function TabIcon({ emoji, label, focused }: { emoji: string; label: string; focused: boolean }) {
  return (
    <View style={tabStyles.icon}>
      <Text style={tabStyles.emoji}>{emoji}</Text>
      <Text style={[tabStyles.label, focused && tabStyles.labelFocused]}>{label}</Text>
    </View>
  )
}

const tabStyles = StyleSheet.create({
  icon: { alignItems: 'center', gap: 2 },
  emoji: { fontSize: 20 },
  label: { fontSize: 10, fontWeight: '600', color: '#555' },
  labelFocused: { color: AMBER },
})

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#0A0A0A',
          borderTopColor: '#1A1A1A',
          borderTopWidth: 1,
          height: 84,
          paddingBottom: 20,
          paddingTop: 10,
        },
        tabBarActiveTintColor: AMBER,
        tabBarInactiveTintColor: '#555',
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" label="Home" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="🔍" label="Explore" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="plan"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="🗺️" label="Plan" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="checkin"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="📍" label="Check In" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => <TabIcon emoji="👤" label="Profile" focused={focused} />,
        }}
      />
    </Tabs>
  )
}
