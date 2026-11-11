import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  AppState,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Directory, File, Paths } from 'expo-file-system';
import { DEFAULT_THEME as theme } from '@/constants/theme';
import {
  useAppActions,
  useAppData,
  useThemeBackground,
} from '@/state/app_data';
import type { ActionResult, Profile } from '@/state/types';
import { DEFAULT_FEEDBACK, LED_COLORS } from '@/features/keycap/codes';
import { Keycap } from '@/features/keycap/keycap';
import { useReducedMotion } from '@/hooks/use_reduced_motion';
import { styles } from './styles';

const ICONS = {
  pencil: 'm16 3 5 5-13 13H3v-5L16 3ZM14 5l5 5',
  check: 'm5 12 4 4L19 6',
} as const;

export function ProfileIcon({
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

export function Avatar({
  profile,
}: {
  profile: Pick<Profile, 'name' | 'photoUrl'>;
}) {
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

export function ProfileEditor({
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

export type FeedbackSetting = 'idleLedColor' | 'sentLedColor';

export function FeedbackEditor({
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

  const reducedMotion = useReducedMotion();
  useEffect(() => {
    ledOpacity.setValue(1);
    if (setting !== 'sentLedColor' || reducedMotion) return;
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
      if (AppState.currentState === 'active') pulse.start();
    }
    refresh();
    const subscription = AppState.addEventListener('change', refresh);
    return () => {
      subscription.remove();
      pulse.stop();
    };
  }, [setting, ledOpacity, reducedMotion]);

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
                  {color === value && <ProfileIcon name="check" size={18} />}
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
