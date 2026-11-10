import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppDataProvider } from '@/state/app_data';
import { createDefaultState } from '@/state/defaults';
import { createDemoState } from '@/state/demo_data';
import { loadLibrarySettings } from '@/state/storage';
import type { AppDataState } from '@/state/types';
import { DEFAULT_THEME as theme } from '@/constants/theme';

// Explicit development switch. Set false to test a normal empty startup.
const ENABLE_DEMO_DATA = true;

const initialState =
  __DEV__ && ENABLE_DEMO_DATA
    ? createDemoState()
    : createDefaultState();

export default function RootLayout() {
  const [restored, setRestored] = useState<AppDataState | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoadError(false);
    loadLibrarySettings(initialState).then(
      (state) => { if (!cancelled) setRestored(state); },
      () => { if (!cancelled) setLoadError(true); },
    );
    return () => { cancelled = true; };
  }, [attempt]);

  if (!restored) {
    return (
      <View style={styles.loading}>
        {loadError ? <>
          <Text accessibilityRole="alert" style={styles.text}>Could not load your saved codes.</Text>
          <Pressable accessibilityRole="button" onPress={() => setAttempt((value) => value + 1)} style={styles.retry}>
            <Text style={styles.text}>Try Again</Text>
          </Pressable>
        </> : <ActivityIndicator accessibilityLabel="Loading saved codes" color={theme.accent} />}
      </View>
    );
  }

  return (
    <AppDataProvider initialState={restored}>
      <Stack>
        <Stack.Screen
          name="(tabs)"
          options={{ headerShown: false }}
        />
      </Stack>
    </AppDataProvider>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: theme.background, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  text: { color: theme.text, fontSize: 16, textAlign: 'center' },
  retry: { padding: 14, minHeight: 44, borderRadius: 12, backgroundColor: theme.connectionBackground },
});
