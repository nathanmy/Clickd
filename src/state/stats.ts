import type { Message, SharedAppData } from './types';

export type PeriodKind = 'week' | 'month' | 'year';
export type Metric = 'sent' | 'received' | 'clicks';
export type StatsPeriod = Readonly<{
  kind: PeriodKind;
  start: Date;
  end: Date;
}>;
type Counts = Record<Metric, number>;

export type StatsBucket = Readonly<{
  start: Date;
  end: Date;
  counts: Counts;
  available: boolean;
  future: boolean;
  partial: boolean;
}>;

export type TopCodeword = Readonly<{ message: Message; count: number }>;

const emptyCounts = (): Counts => ({ sent: 0, received: 0, clicks: 0 });
const localDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

// Calendar ordinals avoid treating a DST day as a fixed 24-hour interval.
function dayNumber(date: Date): number {
  return (
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000
  );
}

export function getStatsPeriod(kind: PeriodKind, anchor: Date): StatsPeriod {
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  if (kind === 'year')
    return { kind, start: new Date(year, 0, 1), end: new Date(year + 1, 0, 1) };
  if (kind === 'month')
    return {
      kind,
      start: new Date(year, month, 1),
      end: new Date(year, month + 1, 1),
    };
  const monday = anchor.getDate() - ((anchor.getDay() + 6) % 7);
  return {
    kind,
    start: new Date(year, month, monday),
    end: new Date(year, month, monday + 7),
  };
}

export function shiftStatsPeriod(
  period: StatsPeriod,
  direction: -1 | 1,
): StatsPeriod {
  const { kind, start } = period;
  const anchor =
    kind === 'week'
      ? new Date(
          start.getFullYear(),
          start.getMonth(),
          start.getDate() + direction * 7,
        )
      : new Date(
          start.getFullYear() + (kind === 'year' ? direction : 0),
          start.getMonth() + (kind === 'month' ? direction : 0),
          1,
        );
  return getStatsPeriod(kind, anchor);
}

function topCodeword(messages: readonly Message[]): TopCodeword | null {
  const groups = new Map<
    string,
    { message: Message; count: number; latest: number; key: string }
  >();
  for (const message of messages) {
    // Lighting-only edits and library revisions do not split the same message meaning.
    const key = JSON.stringify([
      message.library.id,
      message.code,
      message.meaning,
    ]);
    const timestamp = Date.parse(message.createdAt);
    const group = groups.get(key);
    if (!group) groups.set(key, { message, count: 1, latest: timestamp, key });
    else {
      group.count++;
      if (timestamp > group.latest) {
        group.latest = timestamp;
        group.message = message;
      }
    }
  }
  const ranked = [...groups.values()].sort(
    (left, right) =>
      right.count - left.count ||
      right.latest - left.latest ||
      (left.key < right.key ? -1 : left.key > right.key ? 1 : 0),
  );
  return ranked[0] ?? null;
}

function currentStreak(messages: readonly Message[], now: Date): number {
  const days = new Set(
    messages.map((message) => dayNumber(new Date(message.createdAt))),
  );
  let day = dayNumber(now);
  if (!days.has(day)) day--;
  let streak = 0;
  while (days.has(day)) {
    streak++;
    day--;
  }
  return streak;
}

/** Derive statistics from saved message snapshots; never read the live code library. */
export function calculateStats(
  data: SharedAppData,
  period: StatsPeriod,
  now: Date,
) {
  const conversation =
    data.activeConversationId === null
      ? []
      : data.messages.filter(
          (message) =>
            message.conversationId === data.activeConversationId &&
            Date.parse(message.createdAt) <= now.getTime(),
        );
  const messages = conversation.filter((message) => {
    const timestamp = Date.parse(message.createdAt);
    return (
      timestamp >= period.start.getTime() && timestamp < period.end.getTime()
    );
  });
  const sent = messages.filter(
    (message) => message.senderId === data.currentUserId,
  );
  const received = messages.filter(
    (message) => message.senderId !== data.currentUserId,
  );
  const totals = {
    sent: sent.length,
    received: received.length,
    clicks: sent.reduce((count, message) => count + message.code.length, 0),
  };
  const coverageStart = new Date(data.history.startedAt);
  const demo = data.history.source === 'demo';
  const today = localDay(now);
  const buckets: StatsBucket[] = [];

  for (let start = period.start; start < period.end; ) {
    const end =
      period.kind === 'year'
        ? new Date(start.getFullYear(), start.getMonth() + 1, 1)
        : new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1);
    const future = start > today;
    buckets.push({
      start,
      end,
      counts: emptyCounts(),
      future,
      available:
        !future && (demo || (coverageStart < end && coverageStart <= now)),
      partial: !demo && coverageStart > start,
    });
    start = end;
  }

  for (const message of messages) {
    const date = new Date(message.createdAt);
    const index =
      period.kind === 'year'
        ? date.getMonth()
        : dayNumber(date) - dayNumber(period.start);
    const bucket = buckets[index];
    if (!bucket) continue;
    if (message.senderId === data.currentUserId) {
      bucket.counts.sent++;
      bucket.counts.clicks += message.code.length;
    } else bucket.counts.received++;
    // Backfilled messages are still useful, even if full coverage is unknown.
    if (!bucket.available) buckets[index] = { ...bucket, available: true };
  }

  const hasCoverage = buckets.some((bucket) => bucket.available);
  const partial = !demo && coverageStart > period.start;
  const averageStart = partial ? coverageStart : period.start;
  const lastDay =
    now < period.end
      ? now
      : new Date(
          period.end.getFullYear(),
          period.end.getMonth(),
          period.end.getDate() - 1,
        );
  const elapsedDays = Math.max(
    0,
    dayNumber(lastDay) - dayNumber(averageStart) + 1,
  );
  const elapsedBuckets = buckets.filter(
    (bucket) => !bucket.future && bucket.end > averageStart,
  ).length;
  const canAverage = averageStart <= now && averageStart < period.end;
  const averageCounts = messages.reduce<Counts>((counts, message) => {
    if (Date.parse(message.createdAt) < averageStart.getTime()) return counts;
    if (message.senderId === data.currentUserId) {
      counts.sent++;
      counts.clicks += message.code.length;
    } else counts.received++;
    return counts;
  }, emptyCounts());

  return {
    totals,
    buckets,
    hasCoverage,
    partial,
    dailyAverage: (metric: Metric) =>
      canAverage && elapsedDays > 0
        ? averageCounts[metric] / elapsedDays
        : null,
    bucketAverage: (metric: Metric) =>
      canAverage && elapsedBuckets > 0
        ? averageCounts[metric] / elapsedBuckets
        : null,
    topSent: topCodeword(sent),
    topReceived: topCodeword(received),
    streak: currentStreak(conversation, now),
  };
}
