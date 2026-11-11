import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  AppState,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Directory, File, Paths } from 'expo-file-system';

import { DEFAULT_THEME as theme, APP_THEMES } from '@/constants/theme';
import {
  useAppActions,
  useAppData,
  useThemeBackground,
} from '@/state/app_data';
import type { ActionResult, Preferences, Profile } from '@/state/types';
import { DEFAULT_FEEDBACK, LED_COLORS } from '@/features/keycap/codes';
import { Keycap } from '@/features/keycap/keycap';

const ICONS = {
  pencil: 'm16 3 5 5-13 13H3v-5L16 3ZM14 5l5 5',
  camera: 'M3 7h4l2-3h6l2 3h4v13H3ZM16 13a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  shield: 'M12 3 3 7v5c0 5 5 8 9 10 4-2 9-5 9-10V7L12 3Z',
  bell: 'M5 17h14l-2-3V9a5 5 0 0 0-10 0v5l-2 3ZM10 21h4',
  check: 'm5 12 4 4L19 6',
} as const;

function Icon({
  name,
  size = 24,
}: {
  name: keyof typeof ICONS;
  size?: number;
}) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden={true}
      focusable={false}
    >
      <Path
        d={ICONS[name]}
        fill="none"
        stroke={theme.icon}
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function Avatar({ profile }: { profile: Pick<Profile, 'name' | 'photoUrl'> }) {
  const [failedUri, setFailedUri] = useState<string | null>(null);
  return profile.photoUrl && profile.photoUrl !== failedUri ? (
    <Image
      accessibilityLabel={`${profile.name || 'Your'} profile photo`}
      source={{ uri: profile.photoUrl }}
      onError={() => setFailedUri(profile.photoUrl)}
      style={styles.avatar}
    />
  ) : (
    <View
      accessibilityLabel="Profile photo placeholder"
      style={[styles.avatar, styles.initial]}
    >
      <Text style={styles.initialText}>
        {profile.name.trim().charAt(0).toUpperCase() || '?'}
      </Text>
    </View>
  );
}

function removeOwnedPhoto(uri: string | null) {
  if (Platform.OS === 'web' || !uri) return;
  const directory = new Directory(Paths.document, 'profile-photos');
  if (!uri.startsWith(`${directory.uri.replace(/\/+$/, '')}/`)) return;
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    /* Photo cleanup must not turn a successful save into an error. */
  }
}

async function pickPhoto(): Promise<string | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
  });
  if (result.canceled) return null;
  const asset = result.assets[0];
  const context = ImageManipulator.manipulate(asset.uri);
  let copied: File | undefined;
  let committed = false;
  try {
    const side = Math.min(asset.width, asset.height);
    context.crop({
      originX: (asset.width - side) / 2,
      originY: (asset.height - side) / 2,
      width: side,
      height: side,
    });
    context.resize({ width: Math.min(512, side), height: Math.min(512, side) });
    const image = await context.renderAsync();
    let resized;
    try {
      resized = await image.saveAsync({
        format: SaveFormat.JPEG,
        compress: 0.75,
        base64: Platform.OS === 'web',
      });
    } finally {
      image.release();
    }
    let photoUrl = resized.uri;
    if (Platform.OS === 'web') {
      if (!resized.base64)
        throw new Error('Could not resize this photo. Please choose another.');
      photoUrl = `data:image/jpeg;base64,${resized.base64}`;
    } else {
      const directory = new Directory(Paths.document, 'profile-photos');
      directory.create({ idempotent: true, intermediates: true });
      copied = new File(
        directory,
        `${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`,
      );
      try {
        await new File(resized.uri).copy(copied);
      } finally {
        try {
          new File(resized.uri).delete();
        } catch {
          /* Temporary cache cleanup is best effort. */
        }
      }
      photoUrl = copied.uri;
    }
    committed = true;
    return photoUrl;
  } finally {
    context.release();
    if (!committed && copied) removeOwnedPhoto(copied.uri);
    if (Platform.OS === 'web' && asset.uri.startsWith('blob:'))
      URL.revokeObjectURL(asset.uri);
  }
}

function ProfileEditor({
  profile,
  onSave,
  onClose,
}: {
  profile: Profile;
  onSave: (profile: Profile) => Promise<ActionResult>;
  onClose: () => void;
}) {
  const backgroundColor = useThemeBackground();
  const [name, setName] = useState(profile.name);
  const [photoUrl, setPhotoUrl] = useState(profile.photoUrl);
  const [busy, setBusy] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [error, setError] = useState('');
  const locked = useRef(false);
  const saving = useRef(false);
  const mounted = useRef(true);
  const draftPhoto = useRef<string | null>(null);
  const changed = name.trim() !== profile.name || photoUrl !== profile.photoUrl;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (!saving.current) removeOwnedPhoto(draftPhoto.current);
    };
  }, []);

  function close() {
    if (locked.current) return;
    Keyboard.dismiss();
    if (confirmDiscard) setConfirmDiscard(false);
    else if (changed) setConfirmDiscard(true);
    else onClose();
  }

  async function changePhoto() {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError('');
    try {
      const uri = await pickPhoto();
      if (!mounted.current) {
        removeOwnedPhoto(uri);
        return;
      }
      if (uri !== null) {
        removeOwnedPhoto(draftPhoto.current);
        draftPhoto.current = uri;
        setPhotoUrl(uri);
      }
    } catch {
      if (mounted.current)
        setError('Could not load this photo. Please try another image.');
    } finally {
      locked.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  async function save() {
    if (locked.current || !name.trim() || !changed) return;
    locked.current = true;
    saving.current = true;
    setBusy(true);
    setError('');
    try {
      const result = await onSave({ ...profile, name: name.trim(), photoUrl });
      if (result.ok) {
        draftPhoto.current = null;
        if (photoUrl !== profile.photoUrl) removeOwnedPhoto(profile.photoUrl);
        if (mounted.current) onClose();
      } else if (mounted.current) setError(result.error);
    } catch {
      if (mounted.current)
        setError('Could not save your profile. Please try again.');
    } finally {
      saving.current = false;
      locked.current = false;
      if (mounted.current) setBusy(false);
      else removeOwnedPhoto(draftPhoto.current);
    }
  }

  return (
    <Modal transparent animationType="fade" onRequestClose={close}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.backdrop}
      >
        <View
          accessibilityViewIsModal
          style={[styles.modal, { backgroundColor }]}
        >
          <ScrollView
            style={styles.formScroll}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.form}
          >
            <Text accessibilityRole="header" style={styles.heading}>
              {confirmDiscard ? 'Discard changes?' : 'Edit Profile'}
            </Text>
            {confirmDiscard ? (
              <Text style={styles.caption}>
                Your unsaved name and photo changes will be lost.
              </Text>
            ) : (
              <>
                <View style={styles.center}>
                  <Avatar profile={{ name, photoUrl }} />
                </View>
                <View style={styles.photoActions}>
                  <Pressable
                    accessibilityRole="button"
                    disabled={busy}
                    onPress={changePhoto}
                    style={styles.button}
                  >
                    <Text style={styles.buttonText}>
                      {busy ? 'Please wait...' : 'Change Photo'}
                    </Text>
                  </Pressable>
                  {photoUrl !== null && (
                    <Pressable
                      accessibilityRole="button"
                      disabled={busy}
                      onPress={() => {
                        removeOwnedPhoto(draftPhoto.current);
                        draftPhoto.current = null;
                        setPhotoUrl(null);
                        setError('');
                      }}
                      style={styles.button}
                    >
                      <Text style={styles.buttonText}>Remove Photo</Text>
                    </Pressable>
                  )}
                </View>
                <Text style={styles.label}>Name</Text>
                <TextInput
                  accessibilityLabel="Your name"
                  value={name}
                  onChangeText={(value) => {
                    setName(value);
                    setError('');
                  }}
                  maxLength={80}
                  editable={!busy}
                  autoComplete="name"
                  returnKeyType="done"
                  onSubmitEditing={save}
                  style={styles.input}
                />
              </>
            )}
            {!!error && (
              <Text accessibilityRole="alert" style={styles.error}>
                {error}
              </Text>
            )}
          </ScrollView>
          <View style={styles.footer}>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={confirmDiscard ? () => setConfirmDiscard(false) : close}
              style={styles.secondary}
            >
              <Text style={styles.buttonText}>
                {confirmDiscard ? 'Keep Editing' : 'Cancel'}
              </Text>
            </Pressable>
            {confirmDiscard ? (
              <Pressable
                accessibilityRole="button"
                onPress={onClose}
                style={[styles.primary, styles.destructive]}
              >
                <Text style={styles.primaryText}>Discard</Text>
              </Pressable>
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{
                  disabled: busy || !name.trim() || !changed,
                  busy,
                }}
                disabled={busy || !name.trim() || !changed}
                onPress={save}
                style={[
                  styles.primary,
                  (busy || !name.trim() || !changed) && styles.disabled,
                ]}
              >
                <Text style={styles.primaryText}>
                  {busy ? 'Please wait...' : 'Save Changes'}
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

type FeedbackSetting = 'idleLedColor' | 'sentLedColor';

function FeedbackEditor({
  setting,
  onClose,
}: {
  setting: FeedbackSetting;
  onClose: () => void;
}) {
  const { preferences } = useAppData();
  const { updatePreferences } = useAppActions();
  const backgroundColor = useThemeBackground();
  const [color, setColor] = useState(preferences[setting]);
  const [ledOpacity] = useState(() => new Animated.Value(1));
  const [saving, setSaving] = useState(false);
  const locked = useRef(false);
  const [error, setError] = useState('');
  const colors = {
    ...LED_COLORS,
    white: theme.keycap.idleLed,
    green: DEFAULT_FEEDBACK.sentLedColor,
  };

  useEffect(() => {
    if (setting !== 'sentLedColor') return;
    let disposed = false;
    let reduceMotion = true;
    let motionEventReceived = false;
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(ledOpacity, {
          toValue: 0.2,
          duration: 650,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(ledOpacity, {
          toValue: 1,
          duration: 650,
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.delay(350),
      ]),
    );
    function refresh() {
      pulse.stop();
      ledOpacity.setValue(1);
      if (!reduceMotion && AppState.currentState === 'active') pulse.start();
    }
    const motion = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (value) => {
        motionEventReceived = true;
        reduceMotion = value;
        refresh();
      },
    );
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (!disposed && !motionEventReceived) {
          reduceMotion = value;
          refresh();
        }
      })
      .catch(() => {});
    const app = AppState.addEventListener('change', refresh);
    return () => {
      disposed = true;
      motion.remove();
      app.remove();
      pulse.stop();
    };
  }, [setting, ledOpacity]);

  async function save() {
    if (locked.current) return;
    locked.current = true;
    setSaving(true);
    setError('');
    try {
      const result = await updatePreferences({ [setting]: color });
      if (result.ok) onClose();
      else setError(result.error);
    } catch {
      setError('Could not save this color. Please try again.');
    } finally {
      locked.current = false;
      setSaving(false);
    }
  }

  return (
    <Modal
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (!locked.current) onClose();
      }}
    >
      <View style={styles.backdrop}>
        <View
          accessibilityViewIsModal
          style={[styles.modal, { backgroundColor }]}
        >
          <ScrollView
            style={styles.formScroll}
            contentContainerStyle={styles.form}
          >
            <Text accessibilityRole="header" style={styles.heading}>
              {setting === 'idleLedColor' ? 'Ready to send' : 'Message sent'}
            </Text>
            <View style={styles.center}>
              <Keycap
                size="preview"
                idleColor={color}
                ledOpacity={ledOpacity}
              />
            </View>
            <View style={styles.colorChoices}>
              {Object.entries(colors).map(([name, value]) => (
                <Pressable
                  key={name}
                  accessibilityRole="button"
                  accessibilityLabel={name}
                  accessibilityState={{
                    selected: color === value,
                    disabled: saving,
                  }}
                  disabled={saving}
                  onPress={() => setColor(value)}
                  style={({ pressed }) => [
                    styles.colorChoice,
                    color === value && styles.selected,
                    pressed && styles.editPressed,
                  ]}
                >
                  <View
                    style={[styles.colorSwatch, { backgroundColor: value }]}
                  />
                  <Text style={styles.caption}>
                    {name.charAt(0).toUpperCase() + name.slice(1)}
                  </Text>
                  {color === value && <Icon name="check" size={18} />}
                </Pressable>
              ))}
            </View>
            {!!error && (
              <Text accessibilityRole="alert" style={styles.error}>
                {error}
              </Text>
            )}
          </ScrollView>
          <View style={styles.footer}>
            <Pressable
              accessibilityRole="button"
              disabled={saving}
              onPress={onClose}
              style={styles.secondary}
            >
              <Text style={styles.buttonText}>Cancel</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={saving || color === preferences[setting]}
              accessibilityState={{
                disabled: saving || color === preferences[setting],
                busy: saving,
              }}
              onPress={save}
              style={[
                styles.primary,
                (saving || color === preferences[setting]) && styles.disabled,
              ]}
            >
              <Text style={styles.primaryText}>
                {saving ? 'Saving...' : 'Save Color'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

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
          <View>
            <Avatar profile={profile} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Edit profile photo"
              onPress={() => setEditing(true)}
              style={({ pressed }) => [
                styles.camera,
                pressed && styles.editPressed,
              ]}
            >
              <Icon name="camera" size={21} />
            </Pressable>
          </View>
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
        <View style={styles.card}>
          {(['shield', 'bell'] as const).map((icon, index) => (
            <View
              key={icon}
              accessible
              accessibilityState={{ disabled: true }}
              accessibilityLabel={`${index === 0 ? 'Privacy' : 'Notifications'}, coming soon`}
              style={[styles.row, index === 0 && styles.separator]}
            >
              <Icon name={icon} />
              <Text
                style={[styles.rowTitle, styles.unavailable, styles.details]}
              >
                {index === 0 ? 'Privacy' : 'Notifications'}
              </Text>
              <Text style={styles.caption}>Coming soon</Text>
            </View>
          ))}
        </View>
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
        <Text accessibilityRole="header" style={styles.heading}>
          Themes
        </Text>
        <View style={styles.backgrounds}>
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
                  styles.backgroundOption,
                  pressed && styles.editPressed,
                ]}
              >
                <View
                  style={[
                    styles.backgroundPreview,
                    { backgroundColor: option.color },
                    selected && styles.selected,
                  ]}
                >
                  <Svg
                    width="100%"
                    height="100%"
                    viewBox="0 0 150 80"
                    preserveAspectRatio="none"
                    aria-hidden={true}
                    focusable={false}
                  >
                    <Path
                      d="M0 48C45 72 85 15 150 30V80H0Z"
                      fill={theme.accent}
                      opacity={0.1}
                    />
                  </Svg>
                  <View pointerEvents="none" style={styles.themeSample}>
                    <View
                      style={[
                        styles.sampleBubble,
                        { backgroundColor: option.receivedBubble },
                      ]}
                    />
                    <View
                      style={[
                        styles.sampleBubble,
                        {
                          backgroundColor: option.sentBubble,
                          alignSelf: 'flex-end',
                        },
                      ]}
                    />
                  </View>
                  {selected && (
                    <View style={styles.check}>
                      <Icon name="check" size={18} />
                    </View>
                  )}
                </View>
                <Text
                  style={[
                    styles.backgroundLabel,
                    selected && styles.selectedLabel,
                  ]}
                >
                  {option.label}
                </Text>
                <Text style={styles.selectionLabel}>
                  {selected ? 'Selected' : ' '}
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.background },
  content: { padding: 20, gap: 18, paddingBottom: 28 },
  title: { fontSize: 36, fontWeight: '700', color: theme.text },
  heading: { fontSize: 24, fontWeight: '700', color: theme.text },
  label: { fontSize: 16, fontWeight: '600', color: theme.text },
  caption: { fontSize: 14, color: theme.text, flexShrink: 1 },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 8,
  },
  details: { flex: 1, minWidth: 0 },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 1,
    borderColor: theme.swatchBorder,
  },
  initial: {
    backgroundColor: theme.connectionBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialText: { fontSize: 36, fontWeight: '600', color: theme.text },
  camera: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: theme.icon,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editPressed: { opacity: 0.65 },
  card: {
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: theme.outline,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 12,
    minHeight: 68,
    paddingVertical: 14,
  },
  rowTitle: {
    flexShrink: 1,
    fontSize: 18,
    fontWeight: '600',
    color: theme.text,
  },
  unavailable: { color: theme.text },
  separator: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
  },
  feedbackHalo: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedbackDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: theme.keycap.idleLed,
    borderWidth: 1,
    borderColor: theme.outline,
  },
  colorChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  colorChoice: {
    minWidth: 80,
    minHeight: 76,
    flexGrow: 1,
    padding: 8,
    gap: 4,
    borderWidth: 2,
    borderColor: theme.border,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorSwatch: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: theme.swatchBorder,
  },
  backgrounds: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  backgroundOption: { flexGrow: 1, flexBasis: 125, minWidth: 100, gap: 6 },
  backgroundPreview: {
    height: 74,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: theme.outline,
    overflow: 'hidden',
  },
  selected: { borderColor: theme.selection },
  themeSample: { position: 'absolute', top: 18, left: 12, right: 12, gap: 7 },
  sampleBubble: { width: '48%', height: 14, borderRadius: 7 },
  backgroundLabel: { color: theme.text, fontSize: 16, textAlign: 'center' },
  selectedLabel: { fontWeight: '700' },
  selectionLabel: { color: theme.text, fontSize: 13, textAlign: 'center' },
  check: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: { color: '#B42318', fontSize: 15 },
  backdrop: {
    flex: 1,
    padding: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '90%',
    backgroundColor: theme.background,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: theme.outline,
    overflow: 'hidden',
  },
  form: { padding: 24, gap: 16 },
  formScroll: { flexShrink: 1 },
  center: { alignItems: 'center' },
  photoActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 16,
  },
  button: { minHeight: 44, justifyContent: 'center' },
  buttonText: {
    color: theme.text,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  input: {
    minHeight: 48,
    padding: 12,
    fontSize: 17,
    color: theme.text,
    borderWidth: 1,
    borderColor: theme.outline,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  footer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: theme.border,
  },
  secondary: {
    flexGrow: 1,
    minHeight: 48,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.outline,
    justifyContent: 'center',
  },
  primary: {
    flexGrow: 1,
    minHeight: 48,
    padding: 12,
    borderRadius: 12,
    backgroundColor: theme.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  destructive: { backgroundColor: '#B42318' },
  disabled: { opacity: 0.4 },
});
