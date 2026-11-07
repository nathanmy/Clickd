import { Colors, Spacing } from '@/constants/theme';
import { StyleSheet, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function LibraryScreen() {
  return (
    <SafeAreaView
      style={styles.container}
      edges={['top', 'left', 'right']}
    >
      <Text style={styles.title}>Code Library</Text>

      <Text style={styles.description}>
        Your preset and custom click patterns will appear here.
      </Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: Spacing.large,
  },
  title: {
    fontSize: 32,
    fontWeight: '600',
    color: Colors.text,
  },
  description: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginTop: Spacing.medium,
  },
});