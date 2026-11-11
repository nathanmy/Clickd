import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import Slider from '@react-native-community/slider';

import { DEFAULT_THEME as theme } from '@/constants/theme';
import {
  useAppActions,
  useAppData,
  useAppTheme,
  useThemeBackground,
} from '@/state/app_data';
import { MAX_CODE_CLICKS, MAX_CODEWORD_MEANING } from '@/state/validation';
import type { ActionResult, Codeword } from '@/state/types';
import {
  DEFAULT_VIBRATION,
  LED_COLORS,
  LIGHTING_PATTERNS,
} from '@/features/keycap/codes';
import { Keycap } from '@/features/keycap/keycap';
import { useReplay } from '@/features/keycap/replay';
import { createLightingSample } from '@/features/keycap/lighting';

const SWITCH_APPEARANCE = {
  trackColor: { false: '#94A3B8', true: '#111111' },
  thumbColor: '#FFFFFF',
  ios_backgroundColor: '#94A3B8',
  // React Native Web has a separate active-thumb color with a green default.
  ...(Platform.OS === 'web' ? { activeThumbColor: '#FFFFFF' } : {}),
};

const TABS = [
  { id: 'clickd', label: 'Clickd Codes' },
  { id: 'morse', label: 'Morse Code' },
] as const;

function EntryRow({
  item,
  showDetails,
  onEdit,
}: {
  item: Codeword;
  showDetails: boolean;
  onEdit?: () => void;
}) {
  const styles = useThemedStyles();
  const spokenCode = [...item.code]
    .map((symbol) => (symbol === '•' ? 'dot' : 'dash'))
    .join(', ');
  const patternName =
    item.pattern.charAt(0).toUpperCase() + item.pattern.slice(1);
  const colors = showDetails
    ? [item.primaryColor, ...(item.secondaryColor ? [item.secondaryColor] : [])]
    : [];
  const detailsLabel = showDetails
    ? `, ${patternName}, primary ${colorName(item.primaryColor)}${item.secondaryColor ? `, secondary ${colorName(item.secondaryColor)}` : ''}`
    : '';
  return (
    <View style={styles.row}>
      <View
        accessible
        accessibilityLabel={`${item.meaning}: ${spokenCode}${detailsLabel}`}
        style={styles.rowContent}
      >
        <View style={styles.entryHeading}>
          <Text style={styles.code}>{item.code}</Text>
          <Text style={[styles.meaning, styles.column]}>{item.meaning}</Text>
        </View>
        {showDetails && (
          <View style={styles.codewordDetails}>
            <Text style={styles.detailText}>{patternName}</Text>
            {colors.map((color, index) => (
              <View key={index} style={styles.colorDetail}>
                <Text style={styles.detailText}>·</Text>
                <View style={[styles.colorDot, { backgroundColor: color }]} />
                <Text style={styles.detailText}>{colorName(color)}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
      {onEdit && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Edit ${item.meaning}`}
          onPress={onEdit}
          style={({ pressed }) => [
            styles.editButton,
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
              d="m16 3 5 5-13 13H3v-5L16 3Z M14 5l5 5"
              fill="none"
              stroke={theme.icon}
              strokeWidth={1.7}
              strokeLinejoin="round"
            />
          </Svg>
        </Pressable>
      )}
    </View>
  );
}

const entryKey = (entry: Codeword) => entry.id;
function EntrySeparator() {
  const styles = useThemedStyles();
  return <View style={styles.separator} />;
}

function colorName(value: string): string {
  const name = Object.entries(LED_COLORS).find(
    ([, color]) => color === value,
  )?.[0];
  return name
    ? name.charAt(0).toUpperCase() + name.slice(1)
    : value.toUpperCase();
}

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
  const styles = useThemedStyles();
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

function CodewordEditor({
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
  const styles = useThemedStyles();
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
  const [vibration, setVibration] = useState(
    word?.vibration ?? DEFAULT_VIBRATION,
  );
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
    vibration.strength !== initialVibration.strength ||
    vibration.durationScale !== initialVibration.durationScale;
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
            <Text style={styles.label}>Primary: {colorName(primaryColor)}</Text>
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
                  Secondary: {colorName(secondaryColor)}
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
            <View style={styles.settingHeading}>
              <Text style={styles.label}>Duration</Text>
              <Text style={styles.hint}>
                {vibration.durationScale.toFixed(1)}× message length
              </Text>
            </View>
            <Slider
              accessibilityLabel="Vibration duration multiplier"
              accessibilityValue={{
                min: 0.5,
                max: 2,
                now: vibration.durationScale,
                text: `${vibration.durationScale.toFixed(1)} times message length`,
              }}
              // Linear scale: 1x is one-third of the way from 0.5x to 2x.
              minimumValue={0.5}
              maximumValue={2}
              step={0.1}
              value={vibration.durationScale}
              disabled={!vibration.enabled || saving}
              onValueChange={(durationScale) =>
                setVibration((current) => ({
                  ...current,
                  durationScale: Number(durationScale.toFixed(1)),
                }))
              }
              minimumTrackTintColor="#111111"
              maximumTrackTintColor={theme.border}
              thumbTintColor="#111111"
              style={styles.slider}
            />
            <View style={styles.settingHeading}>
              <Text style={styles.hint}>0.5×</Text>
              <Text style={styles.hint}>2×</Text>
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

export default function LibraryScreen() {
  const backgroundColor = useThemeBackground();
  const styles = useThemedStyles();
  const { libraries, activeLibraryId } = useAppData();
  const { saveCodeword, deleteCodeword, setActiveLibrary } = useAppActions();
  const [editor, setEditor] = useState<{ word: Codeword | null } | null>(null);
  const [selectionPending, setSelectionPending] = useState<string | null>(null);
  const [selectionError, setSelectionError] = useState('');
  const [selectedTab, setSelectedTab] =
    useState<(typeof TABS)[number]['id']>('clickd');
  const showingClickd = selectedTab === 'clickd';
  const viewedLibraryId = showingClickd ? 'clikd-codes' : 'morse-code';
  const library = libraries[viewedLibraryId];
  const entries = library?.codewords ?? [];
  const title = library?.name ?? (showingClickd ? 'Clickd Codes' : 'Morse Code');
  const inUse = library?.id === activeLibraryId;
  const statusLabel = inUse ? 'In Use' : 'Not In Use';

  async function selectLibrary() {
    if (selectionPending) return;
    setSelectionPending(viewedLibraryId);
    setSelectionError('');
    try {
      const result = await setActiveLibrary(viewedLibraryId);
      if (!result.ok) setSelectionError(result.error);
    } catch {
      setSelectionError(
        'Could not save your library selection. Please try again.',
      );
    } finally {
      setSelectionPending(null);
    }
  }

  return (
    <SafeAreaView
      style={[styles.screen, { backgroundColor }]}
      edges={['top', 'left', 'right']}
    >
      <Text accessibilityRole="header" style={styles.title}>
        Code Library
      </Text>
      <View accessibilityRole="tablist" style={styles.tabs}>
        {TABS.map((tab) => (
          <Pressable
            key={tab.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: selectedTab === tab.id }}
            onPress={() => {
              setSelectedTab(tab.id);
              setSelectionError('');
            }}
            style={({ pressed }) => [
              styles.tab,
              selectedTab === tab.id && styles.selectedTab,
              pressed && styles.pressed,
            ]}
          >
            <Text
              style={[
                styles.tabText,
                selectedTab === tab.id && styles.selectedTabText,
              ]}
            >
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.libraryHeading}>
        <View style={styles.headingDetails}>
          <Text accessibilityRole="header" style={styles.libraryTitle}>
            {title}
          </Text>
          <View
            accessible
            accessibilityLabel={`${title}: ${statusLabel}`}
            style={[styles.statusBadge, !inUse && styles.inactiveBadge]}
          >
            <View style={[styles.statusDot, !inUse && styles.inactiveDot]} />
            <Text style={[styles.statusText, !inUse && styles.inactiveText]}>
              {statusLabel}
            </Text>
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={inUse ? `${title} selected` : `Use ${title}`}
          accessibilityState={{
            selected: inUse,
            disabled: inUse || !library || !!selectionPending,
            busy: selectionPending === viewedLibraryId,
          }}
          disabled={inUse || !library || !!selectionPending}
          onPress={selectLibrary}
          style={({ pressed }) => [
            styles.activeLibraryButton,
            !inUse && styles.availableLibraryButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.activeLibraryText}>
            {selectionPending === viewedLibraryId
              ? 'Selecting…'
              : inUse
                ? '✓ Selected'
                : 'Use Code'}
          </Text>
        </Pressable>
      </View>
      {!!selectionError && (
        <Text accessibilityRole="alert" style={styles.error}>
          {selectionError}
        </Text>
      )}
      {!showingClickd && <Text style={styles.reference}>A–Z · 0–9</Text>}
      <FlatList<Codeword>
        key={selectedTab}
        data={entries}
        keyExtractor={entryKey}
        renderItem={({ item }) => (
          <EntryRow
            item={item}
            showDetails={showingClickd}
            onEdit={showingClickd ? () => setEditor({ word: item }) : undefined}
          />
        )}
        ItemSeparatorComponent={EntrySeparator}
        ListHeaderComponent={
          <View style={styles.tableHeader}>
            <Text style={[styles.columnLabel, styles.column]}>CODEWORD</Text>
            <Text style={[styles.columnLabel, styles.column]}>
              {showingClickd ? 'MEANING' : 'CHARACTER'}
            </Text>
            {showingClickd && <View style={styles.editColumn} />}
          </View>
        }
        ListEmptyComponent={<Text style={styles.empty}>No codewords yet.</Text>}
        stickyHeaderIndices={[0]}
        style={styles.table}
        contentContainerStyle={styles.tableContent}
      />
      {showingClickd && library && (
        <Pressable
          accessibilityRole="button"
          onPress={() => setEditor({ word: null })}
          style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}
        >
          <Text style={styles.saveButtonText}>＋ Add Codeword</Text>
        </Pressable>
      )}
      {editor && (
        <CodewordEditor
          word={editor.word}
          onSave={(input) =>
            saveCodeword('clikd-codes', input, editor.word?.id)
          }
          onDelete={(codewordId) => deleteCodeword('clikd-codes', codewordId)}
          onClose={() => setEditor(null)}
        />
      )}
    </SafeAreaView>
  );
}

function useThemedStyles() {
  const appearance = useAppTheme();
  return useMemo(() => createStyles(appearance), [appearance]);
}

const createStyles = (appearance: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: theme.background,
      paddingHorizontal: 20,
      paddingTop: 14,
      paddingBottom: 16,
    },
    title: {
      fontSize: 36,
      fontWeight: '700',
      color: theme.text,
      marginBottom: 20,
    },
    tabs: { flexDirection: 'row', gap: 12, marginBottom: 20 },
    tab: {
      backgroundColor: '#FFFFFF',
      flex: 1,
      minHeight: 52,
      padding: 12,
      borderWidth: 1,
      borderColor: theme.selection,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    selectedTab: {
      backgroundColor: appearance.controlSurface,
      borderColor: theme.selection,
    },
    tabText: {
      fontSize: 17,
      fontWeight: '600',
      color: theme.textSecondary,
      textAlign: 'center',
    },
    selectedTabText: { color: theme.text },
    pressed: { opacity: 0.7 },
    libraryHeading: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      marginBottom: 16,
    },
    headingDetails: { flexShrink: 1, gap: 8 },
    libraryTitle: {
      fontSize: 26,
      fontWeight: '700',
      color: theme.text,
      flexShrink: 1,
    },
    statusBadge: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: '#DCFCE7',
      borderRadius: 16,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    statusDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: '#16A34A',
    },
    statusText: { fontSize: 14, fontWeight: '600', color: '#15803D' },
    inactiveBadge: { backgroundColor: appearance.receivedBubble },
    inactiveDot: { backgroundColor: theme.textSecondary },
    inactiveText: { color: theme.textSecondary },
    activeLibraryButton: {
      minHeight: 44,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: appearance.controlSurface,
      borderWidth: 1,
      borderColor: theme.selection,
      borderRadius: 16,
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    availableLibraryButton: { backgroundColor: '#FFFFFF' },
    activeLibraryText: { fontSize: 16, fontWeight: '600', color: theme.text },
    reference: { fontSize: 14, color: theme.textSecondary, marginBottom: 12 },
    table: {
      flexGrow: 0,
      flexShrink: 1,
      borderWidth: 1,
      borderColor: theme.outline,
      borderRadius: 20,
      backgroundColor: '#FFFFFF',
    },
    tableContent: { paddingBottom: 6 },
    tableHeader: {
      flexDirection: 'row',
      paddingHorizontal: 16,
      paddingVertical: 14,
      backgroundColor: appearance.controlSurface,
      gap: 16,
    },
    columnLabel: { fontSize: 13, fontWeight: '700', color: theme.text },
    column: { flex: 1 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: 60,
      paddingHorizontal: 16,
      paddingVertical: 14,
      gap: 16,
    },
    rowContent: { flex: 1, minWidth: 0, gap: 5 },
    entryHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: 16 },
    editButton: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    editColumn: { width: 44 },
    code: {
      flex: 1,
      fontSize: 21,
      lineHeight: 25,
      letterSpacing: 2,
      color: theme.codeText,
    },
    meaning: { fontSize: 17, lineHeight: 25, color: theme.text },
    codewordDetails: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      columnGap: 5,
      rowGap: 3,
    },
    detailText: { fontSize: 13, color: theme.text },
    colorDetail: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    colorDot: {
      width: 9,
      height: 9,
      borderRadius: 5,
      borderWidth: 1,
      borderColor: appearance.receivedAvatar,
    },
    separator: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: appearance.receivedAvatar,
      marginHorizontal: 16,
    },
    empty: { padding: 20, fontSize: 16, color: theme.textSecondary },
    addButton: {
      backgroundColor: appearance.sentBubble,
      borderRadius: 16,
      padding: 16,
      alignItems: 'center',
      marginTop: 20,
    },
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.4)',
      padding: 20,
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalCard: {
      width: '100%',
      maxWidth: 480,
      maxHeight: '90%',
      borderRadius: 24,
      borderWidth: 1,
      borderColor: theme.outline,
      overflow: 'hidden',
      backgroundColor: theme.background,
    },
    formScroll: { flexShrink: 1 },
    hidden: { display: 'none' },
    form: { padding: 24, gap: 16 },
    formFooter: {
      flexShrink: 0,
      padding: 20,
      gap: 12,
      borderTopWidth: 1,
      borderTopColor: theme.border,
      backgroundColor: theme.background,
    },
    sectionTitle: { fontSize: 21, fontWeight: '700', color: theme.text },
    preview: { alignItems: 'center', justifyContent: 'center', minHeight: 140 },
    colorChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    colorButton: {
      width: 44,
      height: 44,
      borderWidth: 2,
      borderColor: 'transparent',
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
    },
    colorSelected: { borderColor: theme.selection },
    swatch: {
      width: 30,
      height: 30,
      borderWidth: 1,
      borderColor: theme.swatchBorder,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
    },
    swatchCheck: {
      color: theme.selection,
      backgroundColor: '#FFFFFF',
      width: 20,
      height: 20,
      lineHeight: 20,
      textAlign: 'center',
      borderRadius: 10,
      fontSize: 15,
      fontWeight: '700',
    },
    settingHeading: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    switchControl: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    switchState: { fontSize: 15, fontWeight: '600', color: theme.text },
    chosenOption: { backgroundColor: appearance.sentBubble },
    chosenOptionText: { color: '#FFFFFF' },
    previewButton: {
      minHeight: 52,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 10,
      padding: 14,
      borderWidth: 2,
      borderColor: theme.accent,
      borderRadius: 14,
      backgroundColor: appearance.receivedBubble,
    },
    previewButtonText: { fontSize: 17, fontWeight: '700', color: theme.text },
    slider: { width: '100%', height: 44 },
    label: { fontSize: 16, fontWeight: '600', color: theme.text },
    sequenceBox: {
      minHeight: 56,
      padding: 14,
      borderWidth: 1,
      borderColor: theme.outline,
      borderRadius: 12,
      backgroundColor: '#FFFFFF',
      justifyContent: 'center',
    },
    sequence: { fontSize: 24, letterSpacing: 3, color: theme.codeText },
    hint: { fontSize: 16, color: theme.textSecondary },
    clickButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    clickButton: {
      flexGrow: 1,
      minHeight: 44,
      padding: 12,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: appearance.receivedBubble,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.outline,
    },
    clickButtonText: { fontSize: 16, fontWeight: '600', color: theme.text },
    disabled: { opacity: 0.4 },
    meaningInput: {
      minHeight: 56,
      padding: 14,
      fontSize: 17,
      color: theme.text,
      borderWidth: 1,
      borderColor: theme.outline,
      borderRadius: 12,
      backgroundColor: '#FFFFFF',
      textAlignVertical: 'top',
    },
    error: { color: '#B42318', fontSize: 15 },
    invalidField: { borderColor: '#B42318' },
    formActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
    cancelButton: {
      flexGrow: 1,
      padding: 16,
      minHeight: 48,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.outline,
    },
    saveButton: {
      flexGrow: 1,
      padding: 16,
      minHeight: 48,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 12,
      backgroundColor: appearance.sentBubble,
    },
    saveButtonText: {
      fontSize: 17,
      fontWeight: '600',
      color: '#FFFFFF',
      textAlign: 'center',
    },
    deleteButton: {
      minHeight: 44,
      padding: 12,
      alignItems: 'center',
      justifyContent: 'center',
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    deleteText: { color: '#B42318', fontSize: 16, fontWeight: '600' },
    destructiveButton: { backgroundColor: '#B42318' },
  });
