import { Colors } from '@/constants/theme';
import { Tabs } from 'expo-router';
import { Image } from 'react-native';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.text,
        tabBarInactiveTintColor: Colors.textSecondary,
        tabBarStyle: {
          backgroundColor: Colors.background,
          borderTopColor: Colors.border,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Image
              source={require('../../../assets/images/tabIcons/home.png')}
              style={{
                width: size,
                height: size,
                tintColor: color,
              }}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="library"
        options={{
          title: 'Code Library',
          tabBarIcon: ({ color, size }) => (
            <Image
              source={require('../../../assets/images/tabIcons/library.png')}
              style={{
                width: size,
                height: size,
                tintColor: color,
              }}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="stats"
        options={{
          title: 'Stats',
          tabBarIcon: ({ color, size }) => (
            <Image
              source={require('../../../assets/images/tabIcons/stats.png')}
              style={{
                width: size,
                height: size,
                tintColor: color,
              }}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <Image
              source={require('../../../assets/images/tabIcons/profile.png')}
              style={{
                width: size,
                height: size,
                tintColor: color,
              }}
            />
          ),
        }}
      />
    </Tabs>
  );
}