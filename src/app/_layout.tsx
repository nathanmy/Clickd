// @refresh reset
// Reload the provider tree together when state modules change during development.
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { AppDataProvider } from '@/state/app_data';
import { createDefaultState, DEMO_PREVIEW_ENABLED } from '@/state/defaults';
import { createDemoState } from '@/state/demo_data';
import { AppLoadError, loadAppState, recoverAppState } from '@/state/storage';
import type { AppDataState } from '@/state/types';
import { DEFAULT_THEME as theme } from '@/constants/theme';

// Explicit development switch. Set false to test a normal empty startup.
const ENABLE_DEMO_DATA = true;

const createInitialState = () =>
  (__DEV__ && ENABLE_DEMO_DATA) || DEMO_PREVIEW_ENABLED
    ? createDemoState()
    : createDefaultState();

export default function RootLayout() {
  const [restored, setRestored] = useState<AppDataState | null>(null);
  const [loadError, setLoadError] = useState<AppLoadError | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [confirmRecovery, setConfirmRecovery] = useState(false);
  const [recovering, setRecovering] = useState(false);

  async function recover() {
    if (recovering) return;
    setRecovering(true);
    try {
      setRestored(await recoverAppState(createInitialState()));
    } catch (error) {
      setLoadError(
        new AppLoadError(
          'storage',
          error instanceof Error
            ? error.message
            : 'Recovery failed. Please try again.',
        ),
      );
      setConfirmRecovery(false);
    } finally {
      setRecovering(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    setLoadError(null);
    Promise.resolve()
      .then(() => loadAppState(createInitialState()))
      .then(
        (state) => {
          if (!cancelled) setRestored(state);
        },
        (error: unknown) => {
          if (!cancelled)
            setLoadError(
              error instanceof AppLoadError
                ? error
                : new AppLoadError(
                    'seed',
                    error instanceof Error
                      ? error.message
                      : 'Invalid startup data.',
                  ),
            );
        },
      );
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  if (!restored) {
    return (
      <View style={styles.loading}>
        {loadError ? (
          <>
            <Text accessibilityRole="alert" style={styles.text}>
              {confirmRecovery
                ? 'Back up saved data and start fresh? Your current codes, profile, and history will be replaced with defaults. A backup will remain on this device.'
                : loadError.kind === 'seed'
                  ? 'Could not start Clickd. Check the development data.'
                  : loadError.kind === 'storage'
                    ? 'Device storage is unavailable. Please try again.'
                    : 'Could not load your saved data.'}
            </Text>
            {__DEV__ && (
              <Text selectable style={styles.text}>
                Details: {loadError.message}
              </Text>
            )}
            <Pressable
              disabled={recovering}
              accessibilityRole="button"
              onPress={() => {
                setConfirmRecovery(false);
                setAttempt((value) => value + 1);
              }}
              style={styles.retry}
            >
              <Text style={styles.text}>Try Again</Text>
            </Pressable>
            {loadError.kind === 'saved' && (
              <Pressable
                disabled={recovering}
                accessibilityRole="button"
                onPress={() =>
                  confirmRecovery ? recover() : setConfirmRecovery(true)
                }
                style={styles.retry}
              >
                <Text style={styles.text}>
                  {recovering
                    ? 'Backing up…'
                    : confirmRecovery
                      ? 'Back Up and Reset'
                      : 'Recovery Options'}
                </Text>
              </Pressable>
            )}
          </>
        ) : (
          <ActivityIndicator
            accessibilityLabel="Loading saved data"
            color={theme.accent}
          />
        )}
      </View>
    );
  }

  return (
    <AppDataProvider initialState={restored}>
      <StatusBar style="dark" />
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="device-simulator"
          options={{ headerShown: false, presentation: 'card' }}
        />
      </Stack>
    </AppDataProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: theme.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 16,
  },
  text: { color: theme.text, fontSize: 16, textAlign: 'center' },
  retry: {
    padding: 14,
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: theme.connectionBackground,
  },
});
