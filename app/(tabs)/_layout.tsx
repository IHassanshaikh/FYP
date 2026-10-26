import { Tabs } from 'expo-router';
import { View, Text, Pressable, Image, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useClientOnlyValue } from '@/components/useClientOnlyValue';

const p = Colors.palette;

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: p.textSubtle,
        tabBarStyle: {
          backgroundColor: p.surface,
          borderTopColor: p.divider,
          borderTopWidth: 1,
          height: 68,
          paddingBottom: 8,
          paddingTop: 6,
          ...(Platform.OS === 'web' ? {
            boxShadow: '0 -1px 3px rgba(0,0,0,0.04)',
          } : {}),
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          letterSpacing: 0.3,
        },
        headerStyle: {
          backgroundColor: p.surface,
          borderBottomWidth: 0,
          elevation: 0,
          shadowOpacity: 0,
          height: 90,
        },
        headerTintColor: p.textPrimary,
        headerTitleAlign: 'center',
        headerShown: useClientOnlyValue(false, true),
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={22} color={color as string} />
          ),
          headerTitle: () => (
            <Image
              source={require('@/assets/images/logo.png')}
              resizeMode="contain"
              tintColor={p.textPrimary}
              style={{
                width: 120,
                height: 50,
              }}
              accessible={true}
              accessibilityLabel="VectorBat Logo"
            />
          ),
          headerRight: () => (
            <Pressable 
              style={{ marginRight: 8, padding: 12, minWidth: 48, minHeight: 48, justifyContent: 'center', alignItems: 'center' }}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Notifications"
              accessibilityHint="Opens your notifications"
            >
              <Ionicons name="notifications-outline" size={24} color={p.textSecondary} />
            </Pressable>
          ),
          headerLeft: () => (
            <Pressable 
              style={{ marginLeft: 8, padding: 12, minWidth: 48, minHeight: 48, justifyContent: 'center', alignItems: 'center' }}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Main Menu"
              accessibilityHint="Opens the main navigation menu"
            >
              <Ionicons name="menu" size={28} color={p.textSecondary} />
            </Pressable>
          ),
        }}
      />
      <Tabs.Screen
        name="live"
        options={{
          title: 'Live Swing',
          tabBarIcon: ({ color, focused }) => (
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: focused ? Colors.primary : 'transparent',
                borderWidth: focused ? 0 : 2,
                borderColor: Colors.primary,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 2,
              }}
            >
              <Ionicons name="flash" size={20} color={focused ? '#FFFFFF' : Colors.primary} />
            </View>
          ),
          headerTitle: 'LIVE SWING TRACKER',
          headerTitleStyle: { color: p.textPrimary, fontWeight: 'bold', letterSpacing: 1 },
        }}
      />
      <Tabs.Screen
        name="sessions"
        options={{
          title: 'Sessions',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'calendar' : 'calendar-outline'} size={24} color={color as string} />
          ),
          headerTitle: 'SESSIONS',
          headerTitleStyle: { color: p.textPrimary, fontWeight: 'bold', letterSpacing: 1 },
        }}
      />
      <Tabs.Screen
        name="practice"
        options={{
          title: 'Practice',
          tabBarIcon: ({ color, focused }) => (
            <View style={{
              width: 46,
              height: 46,
              borderRadius: 23,
              backgroundColor: focused ? Colors.primary : 'transparent',
              borderWidth: focused ? 0 : 2,
              borderColor: Colors.primary,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 4,
            }}>
              <Ionicons name="radio-button-on" size={20} color={focused ? '#FFFFFF' : (color as string)} />
            </View>
          ),
          headerTitle: 'LIVE PRACTICE',
          headerTitleStyle: { color: p.textPrimary, fontWeight: 'bold', letterSpacing: 1 },
        }}
      />
      <Tabs.Screen
        name="camera"
        options={{
          title: 'AI Camera',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'videocam' : 'videocam-outline'} size={24} color={focused ? '#00E676' : (color as string)} />
          ),
          headerTitle: 'AI CAMERA SHOT DETECTOR',
          headerTitleStyle: { color: p.textPrimary, fontWeight: 'bold', letterSpacing: 1 },
        }}
      />
      <Tabs.Screen
        name="compare"
        options={{
          title: 'Compare',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'stats-chart' : 'stats-chart-outline'} size={22} color={color as string} />
          ),
          headerTitle: 'COMPARE',
          headerTitleStyle: { color: p.textPrimary, fontWeight: 'bold', letterSpacing: 1 },
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={22} color={color as string} />
          ),
          headerTitle: 'PROFILE',
          headerTitleStyle: { color: p.textPrimary, fontWeight: 'bold', letterSpacing: 1 },
        }}
      />
    </Tabs>
  );
}
