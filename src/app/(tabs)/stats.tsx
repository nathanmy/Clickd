import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  AppState,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type ViewProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, {
  Defs,
  G,
  Line,
  LinearGradient,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';

import { DEFAULT_THEME as theme } from '@/constants/theme';
import { useAppData, useAppTheme, useThemeBackground } from '@/state/app_data';
import {
  calculateStats,
  getStatsPeriod,
  shiftStatsPeriod,
  type Metric,
  type PeriodKind,
  type StatsBucket,
  type StatsPeriod,
  type TopCodeword,
} from '@/state/stats';

const PERIODS: readonly PeriodKind[] = ['week', 'month', 'year'];
const METRICS: readonly { id: Metric; label: string; shortLabel: string }[] = [
  { id: 'sent', label: 'Messages sent', shortLabel: 'Sent' },
  { id: 'received', label: 'Messages received', shortLabel: 'Received' },
  { id: 'clicks', label: 'Message clicks', shortLabel: 'Clicks' },
];
const dateFormat = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});
const dayFormat = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
});
const monthFormat = new Intl.DateTimeFormat(undefined, {
  month: 'long',
  year: 'numeric',
});
const compactMonthFormat = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  year: 'numeric',
});
const compactDateFormat = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
});
const numberFormat = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 1,
});
const integerFormat = new Intl.NumberFormat();
const titleCase = (text: string) =>
  text.charAt(0).toUpperCase() + text.slice(1);

function periodLabel(period: StatsPeriod, now: Date): string {
  if (
    period.start.getTime() === getStatsPeriod(period.kind, now).start.getTime()
  )
    return `This ${period.kind}`;
  if (period.kind === 'year') return String(period.start.getFullYear());
  if (period.kind === 'month') return compactMonthFormat.format(period.start);
  const last = new Date(
    period.end.getFullYear(),
    period.end.getMonth(),
    period.end.getDate() - 1,
  );
  return compactDateFormat.formatRange(period.start, last);
}

function periodRange(period: StatsPeriod): string {
  const last = new Date(
    period.end.getFullYear(),
    period.end.getMonth(),
    period.end.getDate() - 1,
  );
  return `${dateFormat.format(period.start)} – ${dateFormat.format(last)}`;
}

function ArrowButton({
  direction,
  label,
  disabled = false,
  onPress,
}: {
  direction: 'left' | 'right';
  label: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  const styles = useThemedStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.arrow,
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      <Text style={styles.arrowText}>{direction === 'left' ? '‹' : '›'}</Text>
    </Pressable>
  );
}

function bucketLabel(bucket: StatsBucket, kind: PeriodKind): string {
  return kind === 'year'
    ? monthFormat.format(bucket.start)
    : dayFormat.format(bucket.start);
}

function tickLabel(
  bucket: StatsBucket,
  index: number,
  length: number,
  kind: PeriodKind,
): string {
  if (kind === 'week')
    return new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(
      bucket.start,
    );
  if (kind === 'year')
    return new Intl.DateTimeFormat(undefined, { month: 'narrow' }).format(
      bucket.start,
    );
  const day = bucket.start.getDate();
  return index === 0 ||
    index === length - 1 ||
    (day % 5 === 0 && index < length - 3)
    ? String(day)
    : '';
}

function BarChart({
  buckets,
  metric,
  kind,
  average,
  hasCoverage,
}: {
  buckets: readonly StatsBucket[];
  metric: Metric;
  kind: PeriodKind;
  average: number | null;
  hasCoverage: boolean;
}) {
  const styles = useThemedStyles();
  const appearance = useAppTheme();
  const { fontScale } = useWindowDimensions();
  const [width, setWidth] = useState(300);
  const [showDetail, setShowDetail] = useState(false);
  const [selected, setSelected] = useState(() => {
    for (let index = buckets.length - 1; index >= 0; index--)
      if (buckets[index].available) return index;
    return 0;
  });
  const unit = metric === 'clicks' ? 'clicks' : 'messages';
  const bucket = buckets[selected];
  const detail = `${bucketLabel(bucket, kind)}: ${bucket.future ? 'Future date' : bucket.available ? `${integerFormat.format(bucket.counts[metric])} ${unit}${bucket.partial ? ' recorded, incomplete history' : ''}` : 'History unavailable'}`;
  const peak = Math.max(
    1,
    ...buckets.map((item) => (item.available ? item.counts[metric] : 0)),
  );
  const magnitude = 10 ** Math.floor(Math.log10(peak / 4));
  const step = Math.max(
    1,
    ([1, 2, 5, 10].find((value) => value * magnitude >= peak / 4) ?? 10) *
      magnitude,
  );
  const maximum = Math.ceil(peak / step) * step;
  const ticks = Array.from(
    { length: Math.round(maximum / step) + 1 },
    (_, index) => index * step,
  );
  const axisFontSize = 10 * fontScale;
  const left = Math.min(width * 0.4, Math.max(34, axisFontSize * 3 + 10));
  const right = 8,
    top = Math.max(12, axisFontSize),
    plotHeight = Math.max(150, axisFontSize * 5);
  const height = top + plotHeight + 32 * fontScale;
  const plotWidth = Math.max(1, width - left - right);
  const slotWidth = plotWidth / buckets.length;
  const barWidth = Math.max(1, slotWidth * 0.72);
  const labelStep = Math.max(
    1,
    Math.ceil((axisFontSize * (kind === 'week' ? 2.5 : 1.2)) / slotWidth),
  );
  const move = (direction: number) => {
    setShowDetail(true);
    setSelected((value) =>
      Math.max(0, Math.min(buckets.length - 1, value + direction)),
    );
  };

  return (
    <View>
      {peak === 1 && buckets.every((item) => item.counts[metric] === 0) && (
        <Text style={styles.chartNotice}>
          {hasCoverage
            ? 'No recorded activity in this period.'
            : 'History is unavailable for this period.'}
        </Text>
      )}
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={`${METRICS.find((item) => item.id === metric)?.label} chart`}
        accessibilityValue={{
          min: 1,
          max: buckets.length,
          now: selected + 1,
          text: detail,
        }}
        accessibilityActions={[
          { name: 'increment', label: 'Next date' },
          { name: 'decrement', label: 'Previous date' },
        ]}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'increment') move(1);
          if (event.nativeEvent.actionName === 'decrement') move(-1);
        }}
        {...(Platform.OS === 'web'
          ? {
              tabIndex: 0,
              onKeyDown: (
                event: Parameters<NonNullable<ViewProps['onKeyDown']>>[0],
              ) => {
                const key = 'key' in event ? event.key : event.nativeEvent.key;
                if (key === 'ArrowLeft' || key === 'ArrowRight') {
                  event.preventDefault();
                  move(key === 'ArrowRight' ? 1 : -1);
                }
              },
            }
          : {})}
        onLayout={(event) =>
          setWidth(Math.max(1, event.nativeEvent.layout.width))
        }
      >
        <Svg
          width="100%"
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          aria-hidden={true}
        >
          <Defs>
            <LinearGradient id="stats-bars" x1="0" y1="0" x2="0" y2="1">
              <Stop
                offset="0"
                stopColor={appearance.sentBubble}
                stopOpacity={0.95}
              />
              <Stop
                offset="1"
                stopColor={appearance.sentBubble}
                stopOpacity={0.45}
              />
            </LinearGradient>
          </Defs>
          {ticks.map((value) => {
            const y = top + plotHeight * (1 - value / maximum);
            return (
              <G key={value}>
                <Line
                  x1={left}
                  x2={width - right}
                  y1={y}
                  y2={y}
                  stroke={appearance.receivedAvatar}
                  strokeWidth={1}
                />
                <SvgText
                  x={left - 6}
                  y={y + axisFontSize * 0.35}
                  textAnchor="end"
                  fontSize={axisFontSize}
                  fill={theme.text}
                >
                  {value >= 1000
                    ? new Intl.NumberFormat(undefined, {
                        notation: 'compact',
                      }).format(value)
                    : value}
                </SvgText>
              </G>
            );
          })}
          {buckets.map((item, index) => {
            const x = left + index * slotWidth;
            const barHeight = item.available
              ? (item.counts[metric] / maximum) * plotHeight
              : 0;
            return (
              <G key={item.start.getTime()}>
                {barHeight > 0 && (
                  <Rect
                    x={x + (slotWidth - barWidth) / 2}
                    y={top + plotHeight - barHeight}
                    width={barWidth}
                    height={barHeight}
                    rx={Math.min(6, barWidth / 3)}
                    fill="url(#stats-bars)"
                    stroke={
                      showDetail && selected === index ? theme.text : 'none'
                    }
                    strokeWidth={1}
                  />
                )}
                {!item.available && (
                  <SvgText
                    x={x + slotWidth / 2}
                    y={top + plotHeight - 3}
                    textAnchor="middle"
                    fontSize={axisFontSize}
                    fill={theme.textSecondary}
                  >
                    –
                  </SvgText>
                )}
                <SvgText
                  x={x + slotWidth / 2}
                  y={top + plotHeight + axisFontSize + 8}
                  textAnchor="middle"
                  fontSize={axisFontSize}
                  fill={theme.text}
                >
                  {index % labelStep === 0
                    ? tickLabel(item, index, buckets.length, kind)
                    : ''}
                </SvgText>
              </G>
            );
          })}
          {average !== null && (
            <Line
              x1={left}
              x2={width - right}
              y1={top + plotHeight * (1 - average / maximum)}
              y2={top + plotHeight * (1 - average / maximum)}
              stroke={theme.text}
              strokeWidth={1.5}
              strokeDasharray="5 4"
              pointerEvents="none"
            />
          )}
        </Svg>
        <View
          style={{
            position: 'absolute',
            left,
            right,
            top,
            height: plotHeight,
            flexDirection: 'row',
          }}
        >
          {buckets.map((item, index) => (
            <Pressable
              key={item.start.getTime()}
              accessible={false}
              focusable={false}
              onPress={() => {
                setSelected(index);
                setShowDetail(true);
              }}
              style={{ flex: 1 }}
            />
          ))}
        </View>
      </View>
      {showDetail && (
        <View style={styles.chartDetails}>
          <Text accessibilityLiveRegion="polite" style={styles.chartDetailText}>
            {detail}
          </Text>
        </View>
      )}
    </View>
  );
}

function TopRow({
  label,
  value,
  hasCoverage,
}: {
  label: string;
  value: TopCodeword | null;
  hasCoverage: boolean;
}) {
  const styles = useThemedStyles();
  return (
    <View style={styles.topRow}>
      <View style={styles.flex}>
        <Text style={styles.muted}>{label}</Text>
        {value ? (
          <>
            <View style={styles.codewordLine}>
              <Text style={styles.code}>{value.message.code}</Text>
              <Text style={styles.body}>{value.message.meaning}</Text>
            </View>
          </>
        ) : (
          <Text style={styles.body}>
            {hasCoverage ? 'No recorded messages' : 'History unavailable'}
          </Text>
        )}
      </View>
      {value && (
        <Text style={styles.count}>{integerFormat.format(value.count)}×</Text>
      )}
    </View>
  );
}

export default function StatsScreen() {
  const backgroundColor = useThemeBackground();
  const styles = useThemedStyles();
  const data = useAppData();
  const { width, fontScale } = useWindowDimensions();
  const stackSummaryCards = (width - 52) / 2 < 128 * Math.max(1, fontScale);
  const [now, setNow] = useState(() => new Date());
  const [choice, setChoice] = useState<{
    kind: PeriodKind;
    anchor: Date | null;
  }>({ kind: 'week', anchor: null });
  const [metric, setMetric] = useState<Metric>('sent');
  const [metricMenu, setMetricMenu] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let timer: ReturnType<typeof setTimeout>;
      function refresh() {
        clearTimeout(timer);
        const current = new Date();
        setNow(current);
        const midnight = new Date(
          current.getFullYear(),
          current.getMonth(),
          current.getDate() + 1,
        );
        timer = setTimeout(
          refresh,
          midnight.getTime() - current.getTime() + 50,
        );
      }
      refresh();
      const subscription = AppState.addEventListener('change', (state) => {
        if (state === 'active') refresh();
        else clearTimeout(timer);
      });
      return () => {
        clearTimeout(timer);
        subscription.remove();
      };
    }, []),
  );

  const period = useMemo(
    () => getStatsPeriod(choice.kind, choice.anchor ?? now),
    [choice, now],
  );
  const stats = useMemo(
    () => calculateStats(data, period, now),
    [data, period, now],
  );
  const currentPeriod = getStatsPeriod(choice.kind, now);
  const canGoForward = period.start < currentPeriod.start;
  const chartAverage = stats.bucketAverage(metric);
  const selectedMetric = METRICS.find((item) => item.id === metric)!;
  const metricLabel = selectedMetric.label;
  const summaryCount = (value: number) =>
    stats.hasCoverage ? integerFormat.format(value) : '—';

  function movePeriod(direction: -1 | 1) {
    const next = shiftStatsPeriod(period, direction);
    if (next.start > currentPeriod.start) return;
    setChoice({
      kind: choice.kind,
      anchor:
        next.start.getTime() === currentPeriod.start.getTime()
          ? null
          : next.start,
    });
  }

  return (
    <SafeAreaView
      style={[styles.screen, { backgroundColor }]}
      edges={['top', 'left', 'right']}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heading}>
          <Text accessibilityRole="header" style={styles.title}>
            Stats
          </Text>
          {data.history.source === 'session' && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Recorded history</Text>
            </View>
          )}
        </View>
        {data.history.source === 'session' && stats.partial && (
          <Text style={styles.muted}>
            History begins partway through this period. Earlier activity may be
            missing.
          </Text>
        )}

        <View accessibilityRole="tablist" style={styles.periodTabs}>
          {PERIODS.map((kind) => (
            <Pressable
              key={kind}
              accessibilityRole="tab"
              accessibilityState={{ selected: choice.kind === kind }}
              onPress={() => {
                if (kind !== choice.kind) setChoice({ kind, anchor: null });
              }}
              style={({ pressed }) => [
                styles.periodTab,
                choice.kind === kind && styles.periodSelected,
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[
                  styles.periodText,
                  choice.kind === kind && styles.selectedText,
                ]}
              >
                {titleCase(kind)}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.card}>
          <View style={styles.chartHeader}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Chart metric: ${metricLabel}`}
              accessibilityState={{ expanded: metricMenu }}
              onPress={() => setMetricMenu(true)}
              style={({ pressed }) => [
                styles.metricButton,
                pressed && styles.pressed,
              ]}
            >
              <Text numberOfLines={1} style={styles.metricText}>
                {selectedMetric.shortLabel} ⌄
              </Text>
            </Pressable>
            <View style={styles.periodNavigation}>
              <ArrowButton
                direction="left"
                label={`Previous ${choice.kind}`}
                onPress={() => movePeriod(-1)}
              />
              <Text
                numberOfLines={1}
                accessibilityLabel={periodRange(period)}
                style={styles.periodLabel}
              >
                {periodLabel(period, now)}
              </Text>
              <ArrowButton
                direction="right"
                label={`Next ${choice.kind}`}
                disabled={!canGoForward}
                onPress={() => movePeriod(1)}
              />
            </View>
          </View>
          <Text style={styles.small}>{periodRange(period)}</Text>
          <Text
            accessibilityLabel={`${summaryCount(stats.totals[metric])} ${metricLabel.toLowerCase()} recorded`}
            style={styles.total}
          >
            {summaryCount(stats.totals[metric])}
          </Text>
          <Text style={styles.muted}>
            {chartAverage === null
              ? 'Average unavailable for this period'
              : `${numberFormat.format(chartAverage)} ${choice.kind === 'year' ? 'monthly' : 'daily'} average${stats.partial ? ' since tracking began' : ''}`}
          </Text>
          {metric === 'clicks' && (
            <Text style={styles.small}>
              Presses in sent messages; fidgeting and replays are excluded.
            </Text>
          )}
          <BarChart
            key={`${period.start.getTime()}-${choice.kind}-${metric}`}
            buckets={stats.buckets}
            metric={metric}
            kind={choice.kind}
            average={chartAverage}
            hasCoverage={stats.hasCoverage}
          />
        </View>

        <View
          style={[
            styles.messageCards,
            stackSummaryCards && styles.stackedCards,
          ]}
        >
          {(['sent', 'received'] as const).map((item) => (
            <Pressable
              key={item}
              accessibilityRole="button"
              accessibilityLabel={`${summaryCount(stats.totals[item])} messages ${item}. Show chart`}
              accessibilityState={{ selected: metric === item }}
              onPress={() => setMetric(item)}
              style={({ pressed }) => [
                styles.card,
                styles.messageCard,
                metric === item && styles.summarySelected,
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[styles.summaryLabel, { minHeight: 40 * fontScale }]}
              >
                Messages{'\n'}
                {item}
              </Text>
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.65}
                style={styles.cardTotal}
              >
                {summaryCount(stats.totals[item])}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text accessibilityRole="header" style={styles.sectionTitle}>
          Top codewords
        </Text>
        <View style={styles.card}>
          <TopRow
            label="Most sent"
            value={stats.topSent}
            hasCoverage={stats.hasCoverage}
          />
          <View style={styles.separator} />
          <TopRow
            label="Most received"
            value={stats.topReceived}
            hasCoverage={stats.hasCoverage}
          />
        </View>
        <View style={styles.card}>
          <View style={styles.deviceRow}>
            <Text style={[styles.label, styles.flex]}>
              Current messaging streak
            </Text>
            <Text style={styles.count}>
              {stats.streak} {stats.streak === 1 ? 'day' : 'days'}
            </Text>
          </View>
        </View>
      </ScrollView>

      <Modal
        visible={metricMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setMetricMenu(false)}
      >
        <View style={styles.backdrop}>
          <View
            accessibilityViewIsModal
            style={[styles.menu, { backgroundColor }]}
          >
            <Text accessibilityRole="header" style={styles.sectionTitle}>
              Chart metric
            </Text>
            {METRICS.map((option) => (
              <Pressable
                key={option.id}
                accessibilityRole="button"
                accessibilityState={{ selected: metric === option.id }}
                onPress={() => {
                  setMetric(option.id);
                  setMetricMenu(false);
                }}
                style={({ pressed }) => [
                  styles.menuOption,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.label}>
                  {option.label}
                  {metric === option.id ? ' ✓' : ''}
                </Text>
              </Pressable>
            ))}
            <Pressable
              accessibilityRole="button"
              onPress={() => setMetricMenu(false)}
              style={styles.menuOption}
            >
              <Text style={styles.muted}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function useThemedStyles() {
  const appearance = useAppTheme();
  return useMemo(() => createStyles(appearance), [appearance]);
}

const createStyles = (appearance: ReturnType<typeof useAppTheme>) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.background },
    content: { padding: 20, gap: 14, paddingBottom: 28 },
    heading: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    title: { fontSize: 36, fontWeight: '700', color: theme.text },
    badge: {
      backgroundColor: appearance.receivedBubble,
      borderRadius: 16,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    badgeText: { fontSize: 13, fontWeight: '600', color: theme.text },
    muted: { fontSize: 15, color: theme.text },
    small: { fontSize: 12, color: theme.text, marginTop: 4 },
    body: { fontSize: 17, color: theme.text, flexShrink: 1 },
    label: { fontSize: 16, fontWeight: '600', color: theme.text },
    flex: { flex: 1, minWidth: 0 },
    periodTabs: {
      flexDirection: 'row',
      padding: 4,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: theme.outline,
      backgroundColor: appearance.controlSurface,
    },
    periodTab: {
      flex: 1,
      minHeight: 44,
      padding: 10,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    periodSelected: { backgroundColor: appearance.controlSelected },
    periodText: { color: theme.text, fontSize: 16, fontWeight: '600' },
    selectedText: { color: '#FFFFFF' },
    card: {
      padding: 16,
      borderRadius: 20,
      backgroundColor: '#FFFFFF',
      borderWidth: 1,
      borderColor: theme.outline,
    },
    chartHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    metricButton: {
      backgroundColor: '#FFFFFF',
      maxWidth: '40%',
      flexShrink: 1,
      borderWidth: 1,
      borderColor: theme.selection,
      borderRadius: 12,
      padding: 8,
      minHeight: 44,
      justifyContent: 'center',
    },
    metricText: { fontSize: 15, fontWeight: '600', color: theme.text },
    periodNavigation: {
      flex: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
    },
    periodLabel: {
      fontSize: 15,
      fontWeight: '600',
      color: theme.text,
      flexShrink: 1,
      textAlign: 'center',
    },
    arrow: {
      width: 44,
      minHeight: 44,
      alignItems: 'center',
      justifyContent: 'center',
    },
    arrowText: { fontSize: 32, color: theme.text },
    disabled: { opacity: 0.3 },
    pressed: { opacity: 0.65 },
    total: { fontSize: 46, fontWeight: '700', color: theme.text, marginTop: 6 },
    chartNotice: {
      fontSize: 14,
      color: theme.text,
      marginTop: 12,
      textAlign: 'center',
    },
    chartDetails: { flexDirection: 'row', alignItems: 'center' },
    chartDetailText: {
      flex: 1,
      fontSize: 13,
      color: theme.text,
      textAlign: 'center',
    },
    messageCards: { flexDirection: 'row', gap: 12, alignItems: 'stretch' },
    stackedCards: { flexDirection: 'column' },
    messageCard: { flex: 1, minWidth: 0, gap: 6 },
    summaryLabel: {
      fontSize: 16,
      lineHeight: 20,
      fontWeight: '600',
      color: theme.text,
    },
    summarySelected: {
      backgroundColor: appearance.controlSurface,
      borderColor: theme.selection,
    },
    cardTotal: {
      fontSize: 36,
      fontWeight: '700',
      fontVariant: ['tabular-nums'],
      color: theme.text,
    },
    deviceRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    count: { fontSize: 23, fontWeight: '700', color: theme.text },
    separator: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: appearance.receivedAvatar,
      marginVertical: 12,
    },
    sectionTitle: { fontSize: 24, fontWeight: '700', color: theme.text },
    topRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    codewordLine: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: 10,
      marginTop: 4,
    },
    code: { fontSize: 17, color: theme.codeText, letterSpacing: 2 },
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.4)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 24,
    },
    menu: {
      width: '100%',
      maxWidth: 400,
      padding: 20,
      borderRadius: 20,
      backgroundColor: theme.background,
      gap: 8,
    },
    menuOption: {
      minHeight: 48,
      padding: 12,
      borderRadius: 12,
      justifyContent: 'center',
    },
  });
