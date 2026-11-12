import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { SIMULATOR_ENABLED } from '@/state/defaults';
import { DEFAULT_THEME as theme } from '@/constants/theme';
import { useAppTheme } from '@/state/app_data';
import { Keycap } from '@/features/keycap/keycap';
import { getInputCode, getInputRules } from '@/features/device_simulator/input';
import { useDeviceSimulator } from '@/features/device_simulator/use_device_simulator';

export default function DeviceSimulatorRoute() {
  return SIMULATOR_ENABLED ? (
    <DeviceSimulatorScreen />
  ) : (
    <Redirect href="/(tabs)/profile" />
  );
}

function DeviceSimulatorScreen() {
  const appearance = useAppTheme();
  const [showRules, setShowRules] = useState(false);
  const {
    library,
    morse,
    activeConversationId,
    partnerId,
    frame,
    playingId,
    replay,
    stop,
    presses,
    holding,
    lastReceived,
    saving,
    error,
    notice,
    preview,
    displayedWord,
    pauseDuration,
    pauseElapsed,
    progress,
    pausing,
    inputStatus,
    beginPress,
    endPress,
    cancelPress,
    clear,
  } = useDeviceSimulator();
  return (
    <SafeAreaView
      style={[styles.screen, { backgroundColor: appearance.color }]}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to Profile"
            disabled={saving}
            onPress={() =>
              router.canGoBack()
                ? router.back()
                : router.replace('/(tabs)/profile')
            }
            style={styles.back}
          >
            <Svg
              width={24}
              height={24}
              viewBox="0 0 24 24"
              aria-hidden={true}
              focusable={false}
            >
              <Path
                d="m14 5-7 7 7 7"
                fill="none"
                stroke={theme.icon}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </Pressable>
          <Text
            accessibilityRole="header"
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
            style={styles.title}
          >
            Device simulator
          </Text>
        </View>
        <Text style={styles.mode}>{library.name}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Simulated device button: press and hold, then release"
          accessibilityHint="Tap for a short click or hold for a long click. Pause between sequences."
          accessibilityState={{ disabled: saving }}
          disabled={saving}
          onPressIn={beginPress}
          onPressOut={cancelPress}
          onPress={endPress}
          style={styles.keycapButton}
        >
          <View pointerEvents="none" style={styles.keycap}>
            <Keycap
              size="preview"
              frame={frame}
              playing={playingId !== null}
              pressed={holding}
            />
          </View>
        </Pressable>
        <View style={styles.card}>
          <Text accessibilityLiveRegion="polite" style={styles.sequence}>
            {getInputCode(presses, morse) ||
              (lastReceived
                ? getInputCode(lastReceived.presses, morse)
                : '...')}
          </Text>
          {displayedWord && (
            <Text accessibilityLiveRegion="polite" style={styles.decoded}>
              {displayedWord.meaning}
            </Text>
          )}
          {notice ? (
            <View
              accessible
              accessibilityLabel="Message received"
              accessibilityLiveRegion="polite"
              style={styles.receivedBadge}
            >
              <Svg
                width={22}
                height={22}
                viewBox="0 0 24 24"
                aria-hidden={true}
                focusable={false}
              >
                <Path
                  d="m5 12 4 4L19 6"
                  fill="none"
                  stroke="#166534"
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
              <Text style={styles.receivedText}>{notice}</Text>
            </View>
          ) : (
            <Text accessibilityLiveRegion="polite" style={styles.body}>
              {inputStatus}
            </Text>
          )}
          {pausing && (
            <View style={styles.progressSection}>
              <View
                accessibilityRole="progressbar"
                accessibilityLabel="Time until message is received"
                accessibilityValue={{
                  min: 0,
                  max: 100,
                  now: Math.round(progress * 100),
                }}
                style={styles.progressTrack}
              >
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${progress * 100}%`,
                      backgroundColor: appearance.sentBubble,
                    },
                  ]}
                />
              </View>
              <Text style={styles.countdown}>
                Receiving in{' '}
                {Math.max(0, (pauseDuration - pauseElapsed) / 1000).toFixed(1)}s
              </Text>
            </View>
          )}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: showRules }}
          onPress={() => setShowRules((shown) => !shown)}
          style={styles.helpButton}
        >
          <Text style={styles.buttonText}>
            {showRules ? 'Hide instructions' : 'How to use'}
          </Text>
        </Pressable>
        {showRules && (
          <View style={styles.rules}>
            <Text style={styles.ruleText}>Rules</Text>
            {getInputRules(morse).map((rule) => (
              <View key={rule} style={styles.rule}>
                <Text style={styles.ruleText} aria-hidden={true}>
                  {'\u2022'}
                </Text>
                <Text style={[styles.ruleText, styles.ruleLabel]}>{rule}</Text>
              </View>
            ))}
          </View>
        )}
        {(!activeConversationId || !partnerId) && (
          <Text style={styles.caption}>
            Enable demo data to receive test messages.
          </Text>
        )}
        {!!error && (
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        )}
        <View style={styles.actions}>
          <Pressable
            accessibilityRole="button"
            disabled={saving || holding}
            onPress={clear}
            style={[styles.secondary, (saving || holding) && styles.disabled]}
          >
            <Text style={styles.buttonText}>Clear</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={!preview?.word || saving}
            onPress={() => {
              if (playingId !== null) stop();
              else if (preview?.word)
                replay({
                  ...preview.word,
                  id: 'simulator-preview',
                  presses: preview.presses,
                });
            }}
            style={[
              styles.secondary,
              (!preview?.word || saving) && styles.disabled,
            ]}
          >
            <Text style={styles.buttonText}>
              {playingId !== null ? 'Stop preview' : 'Preview'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 20, paddingBottom: 32, gap: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  back: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    flex: 1,
    minWidth: 0,
    fontSize: 28,
    fontWeight: '700',
    color: theme.text,
  },
  receivedBadge: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#15803D',
    backgroundColor: '#DCFCE7',
  },
  receivedText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#166534',
    flexShrink: 1,
  },
  helpButton: { minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  decoded: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '600',
    color: theme.text,
    textAlign: 'center',
  },
  progressSection: { gap: 8 },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E5E7EB',
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 4 },
  countdown: {
    fontSize: 14,
    color: theme.text,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  rules: { gap: 10 },
  rule: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  ruleText: { fontSize: 18, lineHeight: 26, color: theme.text },
  ruleLabel: { flex: 1 },
  caption: { fontSize: 14, lineHeight: 20, color: theme.text },
  body: {
    fontSize: 17,
    lineHeight: 24,
    color: theme.text,
    textAlign: 'center',
  },
  mode: {
    fontSize: 17,
    fontWeight: '600',
    color: theme.text,
    textAlign: 'center',
  },
  keycapButton: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    minHeight: 280,
  },
  keycap: { width: '100%', maxWidth: 240, alignItems: 'center' },
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: theme.outline,
    borderRadius: 18,
    padding: 16,
    gap: 10,
  },
  sequence: { fontSize: 24, color: theme.text, letterSpacing: 2 },
  actions: { flexDirection: 'row', gap: 12 },
  secondary: {
    flex: 1,
    minHeight: 48,
    borderWidth: 1,
    borderColor: theme.outline,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { fontSize: 16, fontWeight: '600', color: theme.text },
  error: { fontSize: 15, color: '#B42318' },
  disabled: { opacity: 0.45 },
});
