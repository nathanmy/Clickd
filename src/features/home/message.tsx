import { memo, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { DEFAULT_THEME as theme } from '@/constants/theme';
import type { Message, Profile } from '@/state/types';
import { useAppTheme } from '@/state/app_data';

type Props = {
  message: Message;
  profile: Profile | undefined;
  sent: boolean;
  playing: boolean;
  onReplay: (message: Message) => void;
};

const timeFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

function formatTime(createdAt: string): string {
  const timestamp = Date.parse(createdAt);

  return Number.isFinite(timestamp)
    ? timeFormatter.format(timestamp)
    : 'Unknown time';
}

function DefaultAvatar({ sent }: { sent: boolean }) {
  const appearance = useAppTheme();
  const color = sent ? '#FFFFFF' : appearance.accent;

  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Circle cx={12} cy={8} r={4} fill={color} />

      <Path d="M4.5 21c0-4.3 3.2-7 7.5-7s7.5 2.7 7.5 7" fill={color} />
    </Svg>
  );
}

export const MessageRow = memo(function MessageRow({
  message,
  profile,
  sent,
  playing,
  onReplay,
}: Props) {
  const appearance = useAppTheme();
  const [failedPhoto, setFailedPhoto] = useState<string | null>(null);
  const avatar = (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`${profile?.name ?? 'Unknown sender'} profile picture`}
      style={[
        styles.avatar,
        {
          backgroundColor: sent
            ? appearance.sentAvatar
            : appearance.receivedAvatar,
        },
      ]}
    >
      {profile?.photoUrl && profile.photoUrl !== failedPhoto ? (
        <Image
          source={{ uri: profile.photoUrl }}
          onError={() => setFailedPhoto(profile.photoUrl)}
          style={styles.avatarImage}
        />
      ) : (
        <DefaultAvatar sent={sent} />
      )}
    </View>
  );

  return (
    <View style={[styles.row, sent && styles.sentRow]}>
      {!sent && avatar}

      <View style={styles.content}>
        <View
          style={[
            styles.bubble,
            !sent && styles.receivedBubble,
            {
              backgroundColor: sent
                ? appearance.sentBubble
                : appearance.receivedBubble,
            },
          ]}
        >
          <View style={styles.messageText}>
            <Text style={[styles.code, sent && styles.white]}>
              {message.code}
            </Text>

            <Text style={[styles.meaning, sent && styles.white]}>
              {message.meaning}
            </Text>
          </View>

          {!sent && (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: playing }}
              accessibilityLabel={`${playing ? 'Stop' : 'Replay'} ${message.meaning}`}
              hitSlop={8}
              onPress={() => onReplay(message)}
              style={({ pressed }) => [
                styles.replay,
                { backgroundColor: appearance.accent },
                playing && styles.replaying,
                pressed && styles.pressed,
              ]}
            >
              {playing ? (
                <View style={styles.stopSquare} />
              ) : (
                <View style={styles.playTriangle} />
              )}
            </Pressable>
          )}
        </View>

        <Text style={[styles.timestamp, sent && styles.right]}>
          {formatTime(message.createdAt)}
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
    minWidth: 0,
    justifyContent: 'space-between',
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
    opacity: 0.8,
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

  stopSquare: {
    width: 12,
    height: 12,
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
  },
});
