import { Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DEFAULT_THEME as theme, Spacing } from '@/constants/theme';

export default function StatsScreen() {
  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.background, padding: Spacing.large }}
      edges={['top', 'left', 'right']}
    >
      <Text style={{ fontSize: 32, fontWeight: '600', color: theme.text }}>Stats</Text>
      <Text style={{ fontSize: 16, color: theme.textSecondary, marginTop: Spacing.medium }}>
        Your click activity and messaging statistics will appear here.
      </Text>
    </SafeAreaView>
  );
}
