import { DEFAULT_THEME as theme } from '@/constants/theme';
import { Tabs } from 'expo-router';
import { Image } from 'react-native';

// Static require paths let Metro bundle each platform's image variants.
const TAB_SCREENS = [
  { name: 'index', title: 'Home', icon: require('../../../assets/images/tabIcons/home.png') },
  { name: 'library', title: 'Code Library', icon: require('../../../assets/images/tabIcons/library.png') },
  { name: 'stats', title: 'Stats', icon: require('../../../assets/images/tabIcons/stats.png') },
  { name: 'profile', title: 'Profile', icon: require('../../../assets/images/tabIcons/profile.png') },
] as const;

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.text,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarStyle: {
          backgroundColor: theme.background,
          borderTopColor: theme.border,
        },
      }}
    >
      {TAB_SCREENS.map(({ name, title, icon }) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title,
            tabBarIcon: ({ color, size }) => (
              <Image source={icon} style={{ width: size, height: size, tintColor: color }} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
