import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  Animated,
  AppState,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ListRenderItemInfo,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DEFAULT_THEME as theme } from '@/constants/theme';
import { Keycap } from '@/features/keycap/keycap';
import { useReplay } from '@/features/keycap/replay';
import { useAppData, useDeviceData } from '@/state/app_data';
import type { Message } from '@/state/types';

import { MessageRow } from './message';
import { useMessageScroll } from './use_message_scroll';

const messageKey = (message: Message) => message.id;

export function HomeScreen() {
  const {
    messages,
    profiles,
    currentUserId,
    partnerId,
    activeConversationId,
  } = useAppData();

  const device = useDeviceData();

  const { frame, playingId, replay, stop } = useReplay();

  const [heartOpacity] = useState(() => new Animated.Value(0.65));

  // Preserve chronological order:
  // oldest messages at the top, newest messages below.
  const conversationMessages = useMemo(
    () => messages.filter((message) => message.conversationId === activeConversationId),
    [activeConversationId, messages],
  );

  const { list, newMessageCount, showLatest, onContentSizeChange, onScroll } =
    useMessageScroll(conversationMessages, activeConversationId, currentUserId);

  const newMessageLabel = `${newMessageCount} new ${newMessageCount === 1 ? 'message' : 'messages'}`;

  const partnerLinked = partnerId !== null;

  const connected = device.connectionStatus === 'connected';

  const batteryLabel =
    device.battery === null
      ? '—'
      : `${Math.round(device.battery)}%`;

  useFocusEffect(
    useCallback(() => {
      heartOpacity.setValue(0.65);

      const pulse = partnerLinked
        ? Animated.loop(
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
            ]),
          )
        : null;

      if (AppState.currentState === 'active') {
        pulse?.start();
      }

      const subscription = AppState.addEventListener(
        'change',
        (status) => {
          if (status === 'active') {
            pulse?.start();
          } else {
            pulse?.stop();
            stop();
          }
        },
      );

      // Also reset playback when the linked partner or conversation changes.
      return () => {
        subscription.remove();
        pulse?.stop();
        stop();
      };
    }, [
      activeConversationId,
      partnerId,
      heartOpacity,
      partnerLinked,
      stop,
    ]),
  );

  const renderMessage = useCallback(
    ({ item }: ListRenderItemInfo<Message>) => (
      <MessageRow
        message={item}
        profile={
          Object.prototype.hasOwnProperty.call(
            profiles,
            item.senderId,
          )
            ? profiles[item.senderId]
            : undefined
        }
        sent={item.senderId === currentUserId}
        playing={playingId === item.id}
        onReplay={replay}
      />
    ),
    [
      currentUserId,
      playingId,
      profiles,
      replay,
    ],
  );

  return (
    <SafeAreaView
      style={styles.screen}
      edges={['top', 'left', 'right']}
    >
      <View style={styles.headerSection}>
        <View style={styles.header}>
          <Text style={styles.title}>Home</Text>

          <View
            accessible
            accessibilityLabel={
              device.battery === null
                ? 'Device battery unavailable'
                : `Device battery ${batteryLabel}`
            }
            style={styles.battery}
          >
            <View style={styles.batteryShell}>
              <View
                style={[
                  styles.batteryLevel,
                  {
                    width:
                      (22 * (device.battery ?? 0)) / 100,
                  },
                ]}
              />
            </View>

            <Text style={styles.batteryText}>
              {batteryLabel}
            </Text>
          </View>
        </View>

        <View style={styles.devices}>
          <View style={styles.connectionLine} />

          <Keycap
            frame={frame}
            playing={playingId !== null}
            faded={!connected}
          />

          <Animated.View
            style={[styles.heartCircle, { opacity: heartOpacity }]}
          >
            <Text style={styles.heart}>♡</Text>
          </Animated.View>

          <Keycap faded={!partnerLinked} />
        </View>

        <View style={styles.statusRow}>
          <View style={styles.statusPill}>
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor: partnerLinked
                    ? '#22C55E'
                    : '#9CA3AF',
                },
              ]}
            />

            <Text style={styles.statusLabel}>
              {partnerLinked
                ? 'Linked to partner'
                : 'Not linked'}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.messagesSection}>
        <Text style={styles.sectionTitle}>
          Messages
        </Text>

        {conversationMessages.length === 0 ? (
          <Text style={styles.emptyText}>
            Your messages will appear here.
          </Text>
        ) : (
          <FlatList
            key={activeConversationId}
            testID="message-list"
            ref={list}
            data={conversationMessages}
            keyExtractor={messageKey}
            renderItem={renderMessage}
            extraData={playingId}
            onScroll={onScroll}
            onContentSizeChange={onContentSizeChange}
            scrollEventThrottle={16}
            contentContainerStyle={styles.messageList}
            showsVerticalScrollIndicator={false}
          />
        )}

        {newMessageCount > 0 && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Show ${newMessageLabel}`}
            onPress={() => showLatest(true)}
            style={styles.newMessages}
          >
            <Text style={styles.newMessagesText}>
              {newMessageLabel} ↓
            </Text>
          </Pressable>
        )}
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
    paddingVertical: 16,
  },

  emptyText: {
    fontSize: 16,
    color: theme.textSecondary,
    paddingVertical: 16,
  },

  newMessages: {
    position: 'absolute',
    bottom: 12,
    alignSelf: 'center',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: theme.connectionBackground,
  },

  newMessagesText: {
    color: theme.text,
    fontSize: 14,
    fontWeight: '600',
  },
});
