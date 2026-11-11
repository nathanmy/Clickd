import { DEFAULT_THEME as theme } from '@/constants/theme';
import { Tabs } from 'expo-router';
import { Image, StyleSheet, Text } from 'react-native';
import { useAppTheme } from '@/state/app_data';

// Static require paths let Metro bundle each platform's image variants.
const TAB_SCREENS = [
  {
    name: 'index',
    title: 'Home',
    icon: require('../../../assets/images/tabIcons/home.png'),
  },
  {
    name: 'library',
    title: 'Code Library',
    icon: require('../../../assets/images/tabIcons/library.png'),
  },
  {
    name: 'stats',
    title: 'Stats',
    icon: require('../../../assets/images/tabIcons/stats.png'),
  },
  {
    name: 'profile',
    title: 'Profile',
    icon: require('../../../assets/images/tabIcons/profile.png'),
  },
] as const;

export default function TabLayout() {
  const appearance = useAppTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.text,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarActiveBackgroundColor: appearance.controlSurface,
        tabBarItemStyle: styles.tab,
        tabBarStyle: {
          backgroundColor: appearance.color,
          borderTopColor: theme.outline,
        },
      }}
    >
      {TAB_SCREENS.map(({ name, title, icon }) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title,
            tabBarLabel: ({ focused, color }) => (
              <Text
                numberOfLines={1}
                style={[styles.label, { color }, focused && styles.activeLabel]}
              >
                {title}
              </Text>
            ),
            tabBarIcon: ({ color, size }) => (
              <Image
                source={icon}
                style={{ width: size, height: size, tintColor: color }}
              />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tab: {
    borderRadius: 16,
    marginHorizontal: 4,
    marginVertical: 2,
    paddingVertical: 2,
  },
  label: { fontSize: 11, fontWeight: '500' },
  activeLabel: { fontWeight: '800' },
});
