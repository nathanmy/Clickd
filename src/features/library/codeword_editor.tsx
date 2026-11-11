import { useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Slider from '@react-native-community/slider';
import { DEFAULT_THEME as theme } from '@/constants/theme';
import { useAppData, useThemeBackground } from '@/state/app_data';
import { MAX_CODE_CLICKS, MAX_CODEWORD_MEANING } from '@/state/validation';
import type { ActionResult, Codeword } from '@/state/types';
import {
  DEFAULT_VIBRATION,
  LED_COLORS,
  LIGHTING_PATTERNS,
  getLedColorName,
} from '@/features/keycap/codes';
import { Keycap } from '@/features/keycap/keycap';
import { useReplay } from '@/features/keycap/replay';
import { createLightingSample } from '@/features/keycap/lighting';
import { useLibraryStyles } from './styles';

const SWITCH_APPEARANCE = {
  trackColor: { false: '#94A3B8', true: '#111111' },
  thumbColor: '#FFFFFF',
  ios_backgroundColor: '#94A3B8',
  // React Native Web has a separate active-thumb color with a green default.
  ...(Platform.OS === 'web' ? { activeThumbColor: '#FFFFFF' } : {}),
};

function ColorChoices({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (color: string) => void;
  disabled: boolean;
}) {
  const styles = useLibraryStyles();
  return (
    <View style={styles.colorChoices}>
      {Object.entries(LED_COLORS).map(([name, color]) => (
        <Pressable
          key={name}
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${name}`}
          accessibilityState={{ selected: value === color, disabled }}
          disabled={disabled}
          onPress={() => onChange(color)}
          style={({ pressed }) => [
            styles.colorButton,
            value === color && styles.colorSelected,
            pressed && styles.pressed,
          ]}
        >
          <View style={[styles.swatch, { backgroundColor: color }]}>
            {value === color && <Text style={styles.swatchCheck}>✓</Text>}
          </View>
        </Pressable>
      ))}
    </View>
  );
}

export function CodewordEditor({
  word,
  onSave,
  onDelete,
  onClose,
}: {
  word: Codeword | null;
  onSave: (input: Omit<Codeword, 'id'>) => Promise<ActionResult>;
  onDelete: (codewordId: string) => Promise<ActionResult>;
  onClose: () => void;
}) {
  const backgroundColor = useThemeBackground();
  const styles = useLibraryStyles();
  const [code, setCode] = useState(word?.code ?? '');
  const { libraries } = useAppData();
  const duplicate = libraries['clikd-codes']?.codewords.find(
    (entry) => entry.id !== word?.id && entry.code === code,
  );
  const [meaning, setMeaning] = useState(word?.meaning ?? '');
  const [error, setError] = useState('');
  const [pattern, setPattern] = useState(word?.pattern ?? 'solid');
  const [primaryColor, setPrimaryColor] = useState(
    word?.primaryColor ?? LED_COLORS.blue,
  );
  const [secondaryColor, setSecondaryColor] = useState(word?.secondaryColor);
  const lastSecondaryColor = useRef(word?.secondaryColor ?? LED_COLORS.pink);
  const [vibration, setVibration] = useState({
    enabled: word?.vibration?.enabled ?? DEFAULT_VIBRATION.enabled,
    strength: word?.vibration?.strength ?? DEFAULT_VIBRATION.strength,
  });
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const savingRef = useRef(false);
  const { frame, playingId, replay, stop } = useReplay();
  const sampleFrame = createLightingSample({
    code,
    pattern,
    primaryColor,
    secondaryColor,
  });
  const initialVibration = word?.vibration ?? DEFAULT_VIBRATION;
  const changed =
    code !== (word?.code ?? '') ||
    meaning !== (word?.meaning ?? '') ||
    pattern !== (word?.pattern ?? 'solid') ||
    primaryColor !== (word?.primaryColor ?? LED_COLORS.blue) ||
    secondaryColor !== word?.secondaryColor ||
    vibration.enabled !== initialVibration.enabled ||
    vibration.strength !== initialVibration.strength;
  const saveDisabled =
    saving ||
    !code ||
    !meaning.trim() ||
    !!duplicate ||
    code.length > MAX_CODE_CLICKS ||
    meaning.trim().length > MAX_CODEWORD_MEANING ||
    (word !== null && !changed);

  useEffect(() => {
    stop();
  }, [code, pattern, primaryColor, secondaryColor, stop]);

  function close() {
    if (savingRef.current) return;
    if (confirmDelete) {
      setConfirmDelete(false);
      setError('');
    } else if (confirmDiscard) setConfirmDiscard(false);
    else if (changed) {
      stop();
      Keyboard.dismiss();
      setConfirmDiscard(true);
    } else onClose();
  }

  function changeCode(next: string) {
    if (next.length > MAX_CODE_CLICKS && next.length > code.length) return;
    setCode(next);
    setError('');
  }

  async function commit(
    operation: () => Promise<ActionResult>,
    failureMessage: string,
  ) {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError('');
    try {
      const result = await operation();
      if (result.ok) onClose();
      else setError(result.error);
    } catch {
      setError(failureMessage);
    } finally {
      savingRef.current = false;
      setSaving(false);
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
          pointerEvents={saving ? 'none' : 'auto'}
          style={[styles.modalCard, { backgroundColor }]}
        >
          <ScrollView
            style={[
              styles.formScroll,
              (confirmDelete || confirmDiscard) && styles.hidden,
            ]}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.form}
          >
            <Text accessibilityRole="header" style={styles.libraryTitle}>
              {word ? 'Edit Codeword' : 'Add Codeword'}
            </Text>
            <Text style={styles.label}>Click sequence</Text>
            <View
              style={[styles.sequenceBox, duplicate && styles.invalidField]}
            >
              <Text
                accessibilityLiveRegion="polite"
                style={code ? styles.sequence : styles.hint}
              >
                {code || 'Add clicks below'}
              </Text>
            </View>
            {!!duplicate && (
              <Text accessibilityLiveRegion="polite" style={styles.error}>
                This sequence is already used by “{duplicate.meaning}.”
              </Text>
            )}
            <View style={styles.clickButtons}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add short click"
                disabled={saving || code.length >= MAX_CODE_CLICKS}
                accessibilityState={{
                  disabled: saving || code.length >= MAX_CODE_CLICKS,
                }}
                onPress={() => changeCode(code + '•')}
                style={[
                  styles.clickButton,
                  code.length >= MAX_CODE_CLICKS && styles.disabled,
                ]}
              >
                <Text style={styles.clickButtonText}>• Short</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add long click"
                disabled={saving || code.length >= MAX_CODE_CLICKS}
                accessibilityState={{
                  disabled: saving || code.length >= MAX_CODE_CLICKS,
                }}
                onPress={() => changeCode(code + '—')}
                style={[
                  styles.clickButton,
                  code.length >= MAX_CODE_CLICKS && styles.disabled,
                ]}
              >
                <Text style={styles.clickButtonText}>— Long</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Undo last click"
                disabled={!code || saving}
                accessibilityState={{ disabled: !code || saving }}
                onPress={() => changeCode(code.slice(0, -1))}
                style={[styles.clickButton, !code && styles.disabled]}
              >
                <Text style={styles.clickButtonText}>Undo</Text>
              </Pressable>
            </View>
            <Text style={styles.hint}>
              {code.length}/{MAX_CODE_CLICKS} clicks
            </Text>
            <Text style={styles.label}>Meaning</Text>
            <TextInput
              accessibilityLabel="Codeword meaning"
              value={meaning}
              onChangeText={(text) => {
                setMeaning(text);
                setError('');
              }}
              placeholder="e.g. Thinking of you"
              placeholderTextColor={theme.textSecondary}
              multiline
              maxLength={Math.max(
                MAX_CODEWORD_MEANING,
                word?.meaning.length ?? 0,
              )}
              editable={!saving}
              style={styles.meaningInput}
            />
            <Text style={styles.hint}>
              {meaning.length}/{MAX_CODEWORD_MEANING} characters
            </Text>

            <Text accessibilityRole="header" style={styles.sectionTitle}>
              Lighting
            </Text>
            <View
              accessible
              accessibilityLabel={
                playingId !== null
                  ? `Playing ${pattern} lighting preview`
                  : `${pattern} lighting color placement`
              }
              style={styles.preview}
            >
              <Keycap
                size="preview"
                frame={playingId !== null ? frame : sampleFrame}
                playing
              />
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                playingId !== null ? 'Stop preview' : 'Play preview'
              }
              accessibilityState={{ disabled: !code || saving }}
              disabled={!code || saving}
              onPress={() =>
                replay({
                  id: 'editor-preview',
                  code,
                  pattern,
                  primaryColor,
                  secondaryColor,
                })
              }
              style={({ pressed }) => [
                styles.previewButton,
                !code && styles.disabled,
                pressed && styles.pressed,
              ]}
            >
              <Svg
                width={22}
                height={22}
                viewBox="0 0 24 24"
                aria-hidden={true}
                focusable={false}
              >
                <Path
                  d={playingId !== null ? 'M5 5h14v14H5Z' : 'M7 3l15 9-15 9Z'}
                  fill={theme.icon}
                />
              </Svg>
              <Text style={styles.previewButtonText}>
                {playingId !== null ? 'Stop Preview' : 'Play Preview'}
              </Text>
            </Pressable>
            <Text style={styles.hint}>
              {code
                ? 'Play to see the pattern and click rhythm. Lighting only.'
                : 'Add a click sequence to play its lighting preview.'}
            </Text>
            <Text style={styles.label}>
              Primary: {getLedColorName(primaryColor)}
            </Text>
            <ColorChoices
              label="Primary color"
              value={primaryColor}
              onChange={setPrimaryColor}
              disabled={saving}
            />
            <View style={styles.settingHeading}>
              <Text style={styles.label}>Use secondary color</Text>
              <View style={styles.switchControl}>
                <Text style={styles.switchState}>
                  {secondaryColor !== undefined ? 'On' : 'Off'}
                </Text>
                <Switch
                  accessibilityLabel="Use secondary color"
                  value={secondaryColor !== undefined}
                  disabled={saving}
                  onValueChange={(enabled) =>
                    setSecondaryColor(
                      enabled ? lastSecondaryColor.current : undefined,
                    )
                  }
                  {...SWITCH_APPEARANCE}
                />
              </View>
            </View>
            {secondaryColor !== undefined && (
              <>
                <Text style={styles.label}>
                  Secondary: {getLedColorName(secondaryColor)}
                </Text>
                <ColorChoices
                  label="Secondary color"
                  value={secondaryColor}
                  disabled={saving}
                  onChange={(color) => {
                    lastSecondaryColor.current = color;
                    setSecondaryColor(color);
                  }}
                />
              </>
            )}
            <Text style={styles.label}>Pattern</Text>
            <View style={styles.clickButtons}>
              {LIGHTING_PATTERNS.map((option) => (
                <Pressable
                  key={option}
                  accessibilityRole="button"
                  disabled={saving}
                  accessibilityState={{
                    selected: pattern === option,
                    disabled: saving,
                  }}
                  onPress={() => setPattern(option)}
                  style={[
                    styles.clickButton,
                    pattern === option && styles.chosenOption,
                  ]}
                >
                  <Text
                    style={[
                      styles.clickButtonText,
                      pattern === option && styles.chosenOptionText,
                    ]}
                  >
                    {pattern === option ? '✓ ' : ''}
                    {option.charAt(0).toUpperCase() + option.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.settingHeading}>
              <Text accessibilityRole="header" style={styles.sectionTitle}>
                Vibration
              </Text>
              <View style={styles.switchControl}>
                <Text style={styles.switchState}>
                  {vibration.enabled ? 'On' : 'Off'}
                </Text>
                <Switch
                  accessibilityLabel="Enable vibration"
                  disabled={saving}
                  value={vibration.enabled}
                  onValueChange={(enabled) =>
                    setVibration({ ...vibration, enabled })
                  }
                  {...SWITCH_APPEARANCE}
                />
              </View>
            </View>
            <View style={styles.settingHeading}>
              <Text style={styles.label}>Strength</Text>
              <Text style={styles.hint}>
                {Math.round(vibration.strength * 100)}%
              </Text>
            </View>
            <Slider
              accessibilityLabel="Vibration strength"
              accessibilityValue={{
                min: 0,
                max: 100,
                now: Math.round(vibration.strength * 100),
                text: `${Math.round(vibration.strength * 100)} percent`,
              }}
              minimumValue={0}
              maximumValue={1}
              step={0.01}
              value={vibration.strength}
              disabled={!vibration.enabled || saving}
              onValueChange={(strength) =>
                setVibration((current) => ({
                  ...current,
                  strength: Number(strength.toFixed(2)),
                }))
              }
              minimumTrackTintColor="#111111"
              maximumTrackTintColor={theme.border}
              thumbTintColor="#111111"
              style={styles.slider}
            />
            <View style={styles.settingHeading}>
              <Text style={styles.hint}>0%</Text>
              <Text style={styles.hint}>100%</Text>
            </View>
          </ScrollView>
          <View style={[styles.formFooter, { backgroundColor }]}>
            {!!error && (
              <Text
                accessibilityRole="alert"
                accessibilityLiveRegion="assertive"
                style={styles.error}
              >
                {error}
              </Text>
            )}
            {confirmDiscard ? (
              <>
                <Text accessibilityRole="header" style={styles.sectionTitle}>
                  Discard changes?
                </Text>
                <Text style={styles.hint}>
                  Your unsaved codeword changes will be lost.
                </Text>
                <View style={styles.formActions}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setConfirmDiscard(false)}
                    style={styles.cancelButton}
                  >
                    <Text style={styles.clickButtonText}>Keep Editing</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    onPress={onClose}
                    style={[styles.saveButton, styles.destructiveButton]}
                  >
                    <Text style={styles.saveButtonText}>Discard</Text>
                  </Pressable>
                </View>
              </>
            ) : confirmDelete && word ? (
              <>
                <Text accessibilityRole="header" style={styles.sectionTitle}>
                  Delete Codeword?
                </Text>
                <Text style={styles.label}>
                  Delete “{word.meaning}” from Clickd Codes?
                </Text>
                <Text style={styles.hint}>
                  Past messages will be kept. This cannot be undone.
                </Text>
                <View style={styles.formActions}>
                  <Pressable
                    accessibilityRole="button"
                    disabled={saving}
                    onPress={() => {
                      setConfirmDelete(false);
                      setError('');
                    }}
                    style={styles.cancelButton}
                  >
                    <Text style={styles.clickButtonText}>Keep Codeword</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    disabled={saving}
                    accessibilityState={{ disabled: saving, busy: saving }}
                    onPress={() =>
                      commit(
                        () => onDelete(word.id),
                        'Could not delete your codeword. Please try again.',
                      )
                    }
                    style={[styles.saveButton, styles.destructiveButton]}
                  >
                    <Text style={styles.saveButtonText}>
                      {saving ? 'Deleting…' : 'Delete'}
                    </Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <>
                <View style={styles.formActions}>
                  <Pressable
                    accessibilityRole="button"
                    disabled={saving}
                    onPress={close}
                    style={styles.cancelButton}
                  >
                    <Text style={styles.clickButtonText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    disabled={saveDisabled}
                    accessibilityState={{
                      disabled: saveDisabled,
                      busy: saving,
                    }}
                    onPress={() =>
                      commit(
                        () =>
                          onSave({
                            code,
                            meaning,
                            pattern,
                            primaryColor,
                            secondaryColor,
                            vibration,
                          }),
                        'Could not save your codeword. Please try again.',
                      )
                    }
                    style={[styles.saveButton, saveDisabled && styles.disabled]}
                  >
                    <Text style={styles.saveButtonText}>
                      {saving
                        ? 'Saving…'
                        : word
                          ? 'Save Changes'
                          : 'Add Codeword'}
                    </Text>
                  </Pressable>
                </View>
                {word && (
                  <Pressable
                    accessibilityRole="button"
                    disabled={saving}
                    onPress={() => {
                      Keyboard.dismiss();
                      stop();
                      setError('');
                      setConfirmDelete(true);
                    }}
                    style={({ pressed }) => [
                      styles.deleteButton,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.deleteText}>Delete Codeword</Text>
                  </Pressable>
                )}
              </>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
