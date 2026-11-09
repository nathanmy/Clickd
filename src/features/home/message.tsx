
import { memo } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { DEFAULT_THEME as theme } from '@/constants/theme';
import { profiles, type Message } from './mock_data';

type Props = {
  message: Message;
  playing: boolean;
  onReplay: (message: Message) => void;
};

// Default profile picture when no photo is available.
function DefaultAvatar({ sent }: { sent: boolean }) {
  const color = sent ? '#FFFFFF' : theme.avatarText;

  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Circle
        cx={12}
        cy={8}
        r={4}
        fill={color}
      />
      <Path
        d="M4.5 21c0-4.3 3.2-7 7.5-7s7.5 2.7 7.5 7"
        fill={color}
      />
    </Svg>
  );
}

export const MessageRow = memo(function MessageRow({
  message,
  playing,
  onReplay,
}: Props) {
  const sent = message.direction === 'sent';
  const profile = sent ? profiles.you : profiles.partner;

  const avatar = (
    <View
      accessibilityLabel={`${profile.name} profile picture`}
      style={[
        styles.avatar,
        sent && styles.sentAvatar,
      ]}
    >
      {profile.photoUrl ? (
        <Image
          source={{ uri: profile.photoUrl }}
          style={styles.avatarImage}
        />
      ) : (
        <DefaultAvatar sent={sent} />
      )}
    </View>
  );

  return (
    <View
      style={[
        styles.row,
        sent && styles.sentRow,
      ]}
    >
      {!sent && avatar}

      <View style={styles.content}>
        <View
          style={[
            styles.bubble,
            sent ? styles.sentBubble : styles.receivedBubble,
          ]}
        >
          <View style={styles.messageText}>
            <Text
              style={[
                styles.code,
                sent && styles.white,
              ]}
            >
              {message.code}
            </Text>

            <Text
              style={[
                styles.meaning,
                sent && styles.white,
              ]}
            >
              {message.meaning}
            </Text>
          </View>

          {!sent && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                `${playing ? 'Stop' : 'Replay'} ${message.meaning}`
              }
              hitSlop={8}
              onPress={() => onReplay(message)}
              style={({ pressed }) => [
                styles.replay,
                playing && styles.replaying,
                pressed && styles.pressed,
              ]}
            >
              {playing ? (
                <View style={styles.pause}>
                  <View style={styles.pauseBar} />
                  <View style={styles.pauseBar} />
                </View>
              ) : (
                <View style={styles.playTriangle} />
              )}
            </Pressable>
          )}
        </View>

        <Text
          style={[
            styles.timestamp,
            sent && styles.right,
          ]}
        >
          {message.time}
        </Text>
      </View>

      {sent && avatar}
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 7,
  },

  sentRow: {
    justifyContent: 'flex-end',
  },

  content: {
    maxWidth: '81%',
    flexShrink: 1,
  },

  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 17,
  },

  receivedBubble: {
    backgroundColor: theme.receivedBubble,
    minWidth: 207,
    justifyContent: 'space-between',
  },

  sentBubble: {
    backgroundColor: theme.sentBubble,
  },

  messageText: {
    flexShrink: 1,
    gap: 1,
  },

  code: {
    fontSize: 15,
    lineHeight: 18,
    fontWeight: '600',
    color: theme.codeText,
  },

  meaning: {
    fontSize: 14,
    lineHeight: 18,
    color: theme.text,
  },

  white: {
    color: '#FFFFFF',
  },

  timestamp: {
    fontSize: 10,
    lineHeight: 13,
    marginTop: 3,
    marginHorizontal: 4,
    color: theme.textSecondary,
  },

  right: {
    textAlign: 'right',
  },

  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: theme.receivedAvatar,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: 17,
  },

  sentAvatar: {
    backgroundColor: theme.sentAvatar,
  },

  avatarImage: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },

  replay: {
    width: 33,
    height: 33,
    borderRadius: 17,
    backgroundColor: theme.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },

  replaying: {
    backgroundColor: theme.accentPressed,
  },

  pressed: {
    opacity: 0.8,
  },

  playTriangle: {
    width: 0,
    height: 0,
    marginLeft: 3,
    borderTopWidth: 7,
    borderBottomWidth: 7,
    borderLeftWidth: 11,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: '#FFFFFF',
  },

  pause: {
    flexDirection: 'row',
    gap: 4,
  },

  pauseBar: {
    width: 4,
    height: 14,
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
  },
});