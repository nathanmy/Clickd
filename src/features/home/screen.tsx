import { useEffect, useRef } from 'react';
import {
  Animated,
  FlatList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DEFAULT_THEME as theme } from '@/constants/theme';
import { Keycap } from '@/features/keycap/keycap';
import { useReplay } from '@/features/keycap/replay';

import { MessageRow } from './message';
import { device, messages } from './mock_data';

export function HomeScreen() {
  const { frame, playingId, replay } = useReplay();
  const heartOpacity = useRef(new Animated.Value(0.65)).current;

  // Animate connection heart.
  useEffect(() => {
    if (!device.partnerLinked) return;

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(heartOpacity, {
          toValue: 1,
          duration: 950,
          useNativeDriver: true,
        }),
        Animated.timing(heartOpacity, {
          toValue: 0.55,
          duration: 950,
          useNativeDriver: true,
        }),
      ])
    );

    pulse.start();
    return () => pulse.stop();
  }, [heartOpacity]);

  return (
    <SafeAreaView
      style={styles.screen}
      edges={['top', 'left', 'right']}
    >
      <View style={styles.headerSection}>
        <View style={styles.header}>
          <Text style={styles.title}>Home</Text>

          <View style={styles.battery}>
            <View style={styles.batteryShell}>
              <View
                style={[
                  styles.batteryLevel,
                  {
                    width: (22 * device.battery) / 100,
                  },
                ]}
              />
            </View>

            <Text style={styles.batteryText}>
              {device.battery}%
            </Text>
          </View>
        </View>

        {/* Connected keycaps */}
        <View style={styles.devices}>
          <View style={styles.connectionLine} />

          <Keycap
            frame={frame}
            playing={playingId !== null}
            faded={!device.connected}
          />

          <Animated.View
            style={[
              styles.heartCircle,
              { opacity: heartOpacity },
            ]}
          >
            <Text style={styles.heart}>♡</Text>
          </Animated.View>

          <Keycap faded={!device.partnerLinked} />
        </View>

        {/* Connection status */}
        <View style={styles.statusRow}>
          <View style={styles.statusPill}>
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor: device.partnerLinked
                    ? '#22C55E'
                    : '#9CA3AF',
                },
              ]}
            />
            <Text style={styles.statusLabel}>
              {device.partnerLinked
                ? 'Linked to partner'
                : 'Not linked'}
            </Text>
          </View>
        </View>
      </View>

      {/* Messages */}
      <View style={styles.messagesSection}>
        <Text style={styles.sectionTitle}>Messages</Text>

        <FlatList
          data={messages}
          keyExtractor={(message) => String(message.id)}
          renderItem={({ item }) => (
            <MessageRow
              message={item}
              playing={playingId === item.id}
              onReplay={replay}
            />
          )}
          extraData={playingId}
          contentContainerStyle={styles.messageList}
          showsVerticalScrollIndicator={false}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.background,
  },

  headerSection: {
    paddingHorizontal: 20,
    paddingTop: 14,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  title: {
    fontSize: 36,
    fontWeight: '700',
    color: theme.text,
  },

  battery: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  batteryShell: {
    width: 30,
    height: 17,
    borderWidth: 2,
    borderColor: theme.text,
    borderRadius: 4,
    padding: 2,
    overflow: 'hidden',
  },

  batteryLevel: {
    height: '100%',
    borderRadius: 1,
    backgroundColor: '#22C55E',
  },

  batteryText: {
    fontSize: 17,
    color: theme.text,
  },

  devices: {
    marginTop: 14,
    minHeight: 164,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  connectionLine: {
    position: 'absolute',
    top: 81,
    left: '22%',
    right: '22%',
    height: 2,
    backgroundColor: theme.connectionLine,
  },

  heartCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.heartBackground,
  },

  heart: {
    fontSize: 34,
    lineHeight: 38,
    color: theme.accent,
  },

  statusRow: {
    alignItems: 'center',
    marginTop: 1,
    marginBottom: 20,
  },

  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 25,
    backgroundColor: theme.connectionBackground,
  },

  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },

  statusLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.text,
  },

  messagesSection: {
    flex: 1,
    minHeight: 0,
    paddingHorizontal: 20,
  },

  sectionTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.text,
    marginBottom: 13,
  },

  messageList: {
    gap: 11,
    paddingBottom: 28,
  },
});