import { useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { DEFAULT_THEME as theme } from '@/constants/theme';
import {
  useAppActions,
  useAppData,
  useThemeBackground,
} from '@/state/app_data';
import { MAX_CODEWORDS } from '@/state/validation';
import type { Codeword } from '@/state/types';
import { getLedColorName } from '@/features/keycap/codes';
import { CodewordEditor } from '@/features/library/codeword_editor';
import {
  DragContext,
  DragHandle,
  ReorderCell,
  useCodewordReorder,
  type ReorderControls,
} from '@/features/library/reorder';
import { useLibraryStyles } from '@/features/library/styles';

const TABS = [
  { id: 'clickd', label: 'Clickd Codes' },
  { id: 'morse', label: 'Morse Code' },
] as const;

function EntryRow({
  item,
  showDetails,
  onEdit,
  reorder,
}: {
  item: Codeword;
  showDetails: boolean;
  onEdit?: () => void;
  reorder?: ReorderControls;
}) {
  const styles = useLibraryStyles();
  const spokenCode = [...item.code]
    .map((symbol) => (symbol === '•' ? 'dot' : 'dash'))
    .join(', ');
  const patternName =
    item.pattern.charAt(0).toUpperCase() + item.pattern.slice(1);
  const colors = showDetails
    ? [item.primaryColor, ...(item.secondaryColor ? [item.secondaryColor] : [])]
    : [];
  const detailsLabel = showDetails
    ? `, ${patternName}, primary ${getLedColorName(item.primaryColor)}${item.secondaryColor ? `, secondary ${getLedColorName(item.secondaryColor)}` : ''}`
    : '';
  return (
    <View
      onLayout={(event) =>
        reorder?.onMeasure(item.id, event.nativeEvent.layout.height)
      }
      style={styles.row}
    >
      <View
        accessible
        accessibilityLabel={`${item.meaning}: ${spokenCode}${detailsLabel}`}
        style={styles.rowContent}
      >
        <View style={styles.entryHeading}>
          <Text style={styles.code}>{item.code}</Text>
          <Text style={[styles.meaning, styles.column, styles.meaningColumn]}>
            {item.meaning}
          </Text>
        </View>
        {showDetails && (
          <View style={styles.codewordDetails}>
            <Text style={styles.detailText}>{patternName}</Text>
            {colors.map((color, index) => (
              <View key={index} style={styles.colorDetail}>
                <Text style={styles.detailText}>·</Text>
                <View style={[styles.colorDot, { backgroundColor: color }]} />
                <Text style={styles.detailText}>{getLedColorName(color)}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
      {(onEdit || reorder) && (
        <View style={styles.rowActions}>
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
          {reorder && <DragHandle item={item} controls={reorder} />}
        </View>
      )}
    </View>
  );
}

const entryKey = (entry: Codeword) => entry.id;
function EntrySeparator() {
  const styles = useLibraryStyles();
  return <View style={styles.separator} />;
}

export default function LibraryScreen() {
  const backgroundColor = useThemeBackground();
  const styles = useLibraryStyles();
  const { libraries, activeLibraryId } = useAppData();
  const { saveCodeword, deleteCodeword, setActiveLibrary } = useAppActions();
  const [editor, setEditor] = useState<{ word: Codeword | null } | null>(null);
  const [organizing, setOrganizing] = useState(false);
  const [selectionPending, setSelectionPending] = useState<string | null>(null);
  const [selectionError, setSelectionError] = useState('');
  const [selectedTab, setSelectedTab] = useState<(typeof TABS)[number]['id']>(
    () => (activeLibraryId === 'morse-code' ? 'morse' : 'clickd'),
  );
  const showingClickd = selectedTab === 'clickd';
  const viewedLibraryId = showingClickd ? 'clikd-codes' : 'morse-code';
  const library = libraries[viewedLibraryId];
  const entries = library?.codewords ?? [];
  const atCodewordLimit = entries.length >= MAX_CODEWORDS;
  const title =
    library?.name ?? (showingClickd ? 'Clickd Codes' : 'Morse Code');
  const inUse = library?.id === activeLibraryId;
  const statusLabel = inUse ? 'In Use' : 'Not In Use';
  const reorder = useCodewordReorder(
    entries,
    setSelectionError,
    viewedLibraryId,
  );
  const { draggingId, saving: reorderSaving, cancel: cancelDrag } = reorder;

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
            disabled={draggingId !== null || reorderSaving}
            accessibilityState={{
              selected: selectedTab === tab.id,
              disabled: draggingId !== null || reorderSaving,
            }}
            onPress={() => {
              setOrganizing(false);
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
      <DragContext.Provider value={reorder.visuals}>
        <View
          ref={reorder.viewportRef}
          onLayout={reorder.measureViewport}
          style={styles.tableViewport}
        >
          <FlatList<Codeword>
            ref={reorder.list}
            onScroll={reorder.onScroll}
            onContentSizeChange={reorder.onContentSizeChange}
            scrollEventThrottle={16}
            CellRendererComponent={ReorderCell}
            removeClippedSubviews={false}
            key={selectedTab}
            data={entries}
            scrollEnabled={draggingId === null}
            extraData={{ organizing, reorderSaving }}
            keyExtractor={entryKey}
            renderItem={({ item }) => (
              <EntryRow
                item={item}
                showDetails={showingClickd}
                reorder={
                  showingClickd && organizing ? reorder.controls : undefined
                }
                onEdit={
                  showingClickd && !organizing
                    ? () => setEditor({ word: item })
                    : undefined
                }
              />
            )}
            ItemSeparatorComponent={EntrySeparator}
            ListHeaderComponent={
              <View style={styles.tableHeader}>
                <Text style={[styles.columnLabel, styles.column]}>
                  CODEWORD
                </Text>
                <Text
                  style={[
                    styles.columnLabel,
                    styles.column,
                    styles.meaningColumn,
                  ]}
                >
                  {showingClickd ? 'MEANING' : 'CHARACTER'}
                </Text>
                {showingClickd && library && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      organizing
                        ? 'Finish organizing codewords'
                        : 'Organize codewords'
                    }
                    accessibilityState={{
                      disabled:
                        reorderSaving ||
                        draggingId !== null ||
                        (!organizing && entries.length < 2),
                      busy: reorderSaving,
                    }}
                    disabled={
                      reorderSaving ||
                      draggingId !== null ||
                      (!organizing && entries.length < 2)
                    }
                    onPress={() => {
                      cancelDrag();
                      setOrganizing((value) => !value);
                    }}
                    style={({ pressed }) => [
                      styles.organizeButton,
                      pressed && styles.pressed,
                      organizing && styles.organizeActive,
                      (reorderSaving ||
                        draggingId !== null ||
                        (!organizing && entries.length < 2)) &&
                        styles.disabled,
                    ]}
                  >
                    <Svg
                      width={24}
                      height={24}
                      viewBox="0 0 24 24"
                      aria-hidden={true}
                      focusable={false}
                    >
                      <Path
                        d={
                          organizing
                            ? 'M5 12l4 4L19 6'
                            : 'M3 6h10M3 12h7M3 18h10M18 4v16m-3-13 3-3 3 3m-6 10 3 3 3-3'
                        }
                        fill="none"
                        stroke={theme.icon}
                        strokeWidth={1.8}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </Svg>
                  </Pressable>
                )}
              </View>
            }
            ListEmptyComponent={
              <Text style={styles.empty}>No codewords yet.</Text>
            }
            stickyHeaderIndices={[0]}
            style={styles.table}
            contentContainerStyle={styles.tableContent}
          />
        </View>
      </DragContext.Provider>
      {showingClickd && library && !organizing && (
        <Pressable
          accessibilityRole="button"
          disabled={atCodewordLimit}
          accessibilityState={{ disabled: atCodewordLimit }}
          accessibilityHint={
            atCodewordLimit
              ? 'Delete a codeword before adding another.'
              : undefined
          }
          onPress={() => setEditor({ word: null })}
          style={({ pressed }) => [
            styles.addButton,
            atCodewordLimit && styles.disabled,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.saveButtonText}>
            {atCodewordLimit
              ? `${MAX_CODEWORDS} codeword limit reached`
              : `＋ Add Codeword (${entries.length}/${MAX_CODEWORDS})`}
          </Text>
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
