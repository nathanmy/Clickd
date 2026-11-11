import { useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { APP_THEMES } from '@/constants/theme';
import {
  useAppActions,
  useAppData,
  useThemeBackground,
} from '@/state/app_data';
import type { Preferences } from '@/state/types';
import { Keycap } from '@/features/keycap/keycap';
import {
  Avatar,
  ProfileEditor,
  FeedbackEditor,
  ProfileIcon as Icon,
  type FeedbackSetting,
} from '@/features/profile/editors';
import { styles } from '@/features/profile/styles';

export default function ProfileScreen() {
  const { profiles, currentUserId, preferences } = useAppData();
  const profile = profiles[currentUserId];
  const backgroundColor = useThemeBackground();
  const { updateProfile, updatePreferences } = useAppActions();
  const [editing, setEditing] = useState(false);
  const [feedbackSetting, setFeedbackSetting] =
    useState<FeedbackSetting | null>(null);
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function selectTheme(id: Preferences['themeId']) {
    if (busy.current || id === preferences.themeId) return;
    busy.current = true;
    setPending(true);
    setError('');
    setNotice('');
    try {
      const result = await updatePreferences({ themeId: id });
      if (result.ok) setNotice('Theme saved.');
      else setError(result.error);
    } catch {
      setError('Could not save your theme. Please try again.');
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  return (
    <SafeAreaView
      style={[styles.screen, { backgroundColor }]}
      edges={['top', 'left', 'right']}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <Text accessibilityRole="header" style={styles.title}>
          Profile
        </Text>
        <View style={styles.identity}>
          <Avatar profile={profile} />
          <Text
            accessibilityRole="header"
            style={[styles.heading, styles.details]}
          >
            {profile.name}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Edit profile"
            onPress={() => setEditing(true)}
            style={({ pressed }) => [
              styles.iconButton,
              pressed && styles.editPressed,
            ]}
          >
            <Icon name="pencil" />
          </Pressable>
        </View>
        <Text accessibilityRole="header" style={styles.heading}>
          Appearance
        </Text>
        <View style={styles.themeGrid}>
          {(Object.keys(APP_THEMES) as Preferences['themeId'][]).map((id) => {
            const option = APP_THEMES[id];
            const selected = preferences.themeId === id;
            return (
              <Pressable
                key={id}
                accessibilityRole="button"
                accessibilityLabel={`${option.label} theme`}
                accessibilityState={{ selected, disabled: pending }}
                disabled={pending}
                onPress={() => selectTheme(id)}
                style={({ pressed }) => [
                  styles.themeOption,
                  pressed && styles.editPressed,
                ]}
              >
                <View
                  style={[
                    styles.themePreview,
                    { backgroundColor: option.color },
                    selected && styles.selected,
                  ]}
                >
                  <View pointerEvents="none" style={styles.themeSample}>
                    <Keycap size="thumbnail" appearance={option} />
                    <View style={styles.sampleConversation}>
                      <View
                        style={[
                          styles.sampleBubble,
                          {
                            width: '80%',
                            backgroundColor: option.receivedBubble,
                          },
                        ]}
                      />
                      <View
                        style={[
                          styles.sampleBubble,
                          {
                            width: '92%',
                            backgroundColor: option.sentBubble,
                            alignSelf: 'flex-end',
                          },
                        ]}
                      />
                    </View>
                  </View>
                  {selected && (
                    <View style={styles.check}>
                      <Icon name="check" size={18} />
                    </View>
                  )}
                </View>
                <Text
                  style={[styles.themeLabel, selected && styles.selectedLabel]}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {!!error && (
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        )}
        {!!notice && (
          <Text accessibilityLiveRegion="polite" style={styles.caption}>
            {notice}
          </Text>
        )}
        <Text accessibilityRole="header" style={styles.heading}>
          Device feedback
        </Text>
        <View style={styles.card}>
          {(['idleLedColor', 'sentLedColor'] as const).map((setting, index) => (
            <View
              key={setting}
              style={[styles.row, index === 0 && styles.separator]}
            >
              <Text style={[styles.rowTitle, styles.details]}>
                {index === 0 ? 'Ready to send' : 'Message sent'}
              </Text>
              <View
                style={[
                  styles.feedbackHalo,
                  index === 1 && {
                    backgroundColor: `${preferences[setting]}26`,
                  },
                ]}
              >
                <View
                  style={[
                    styles.feedbackDot,
                    { backgroundColor: preferences[setting] },
                  ]}
                />
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Edit ${index === 0 ? 'ready to send' : 'message sent'} color`}
                accessibilityState={{ disabled: pending }}
                disabled={pending}
                onPress={() => setFeedbackSetting(setting)}
                style={({ pressed }) => [
                  styles.iconButton,
                  pressed && styles.editPressed,
                ]}
              >
                <Icon name="pencil" />
              </Pressable>
            </View>
          ))}
        </View>
      </ScrollView>
      {editing && (
        <ProfileEditor
          profile={profile}
          onSave={updateProfile}
          onClose={() => setEditing(false)}
        />
      )}
      {feedbackSetting && (
        <FeedbackEditor
          setting={feedbackSetting}
          onClose={() => setFeedbackSetting(null)}
        />
      )}
    </SafeAreaView>
  );
}
