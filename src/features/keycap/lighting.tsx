import { DEFAULT_THEME } from '@/constants/theme';

import {
  isPressSequence,
  MAX_PLAYBACK_DURATION_MS,
  MAX_PLAYBACK_PRESSES,
  MAX_PRESS_DURATION_MS,
  type LightingSequence,
  type PlaybackSequence,
} from '@/features/keycap/codes';

export type LedFrame = Readonly<{
  active: readonly number[];
  colors: readonly string[];
}>;

export type TimedFrame = LedFrame & {
  at: number;
};

// Physical LED layout:
//
//  0 --- 1 --- 2
//  |           |
//  7           3
//  |           |
//  6 --- 5 --- 4

// Shared endpoints form one continuous rounded ring; indices still address eight LEDs.
export const LED_PATHS = [
  'M82 300 Q82 59 300 59',
  'M300 59 L773 59',
  'M773 59 Q991 59 991 300',
  'M991 300 L991 681',
  'M991 681 Q991 922 773 922',
  'M773 922 L300 922',
  'M300 922 Q82 922 82 681',
  'M82 681 L82 300',
];

const LED_IDS = [0, 1, 2, 3, 4, 5, 6, 7];

const CIRCULAR_GROUPS = [
  [0, 1],
  [2, 3],
  [4, 5],
  [6, 7],
];

const WAVE_GROUPS = [
  [0, 7, 6],
  [1, 5],
  [2, 3, 4],
];

const DOT_MS = 250;
const DASH_MS = 750;
const GAP_MS = 180;

export function idleFrame(): LedFrame {
  return {
    active: [],
    colors: LED_IDS.map(() => DEFAULT_THEME.keycap.idleLed),
  };
}

/** Show each pattern's color placement without starting an animation. */
export function createLightingSample(sequence: LightingSequence): LedFrame {
  return {
    active: LED_IDS,
    colors: LED_IDS.map((id) => {
      const secondary =
        sequence.pattern === 'wave'
          ? WAVE_GROUPS[1].includes(id)
          : sequence.pattern === 'circular'
            ? Math.floor(id / 2) % 2 === 1
            : id % 2 === 1;
      return secondary
        ? (sequence.secondaryColor ?? sequence.primaryColor)
        : sequence.primaryColor;
    }),
  };
}

export function createPlaybackFrames(sequence: PlaybackSequence): {
  frames: TimedFrame[];
  duration: number;
} {
  const frames: TimedFrame[] = [];
  if (sequence.code.length > MAX_PLAYBACK_PRESSES)
    return { frames, duration: 0 };
  const sample = createLightingSample(sequence);

  const presses = [...sequence.code].filter(
    (char) => char === '•' || char === '—',
  );

  // Fall back as a whole if measured timing is incomplete or malformed.
  const measured = sequence.presses;
  // Keep old snapshots readable, but never allocate an unbounded recording's frames.
  const useMeasuredTiming =
    isPressSequence(measured, presses.length) &&
    measured.every(
      (press) =>
        press.durationMs <= MAX_PRESS_DURATION_MS &&
        press.offsetMs + press.durationMs <= MAX_PLAYBACK_DURATION_MS,
    );

  let elapsed = 0;
  let circularStep = 0;

  presses.forEach((symbol, index) => {
    const timing = useMeasuredTiming ? measured[index] : undefined;
    const duration = timing?.durationMs ?? (symbol === '•' ? DOT_MS : DASH_MS);
    elapsed = timing?.offsetMs ?? elapsed;

    if (sequence.pattern === 'solid') {
      // All LEDs are lit simultaneously.
      // Adjacent LEDs alternate colors if a second exists.
      frames.push({
        at: elapsed,
        ...sample,
      });
    } else {
      const groups =
        sequence.pattern === 'circular' ? CIRCULAR_GROUPS : WAVE_GROUPS;

      const stepMs = sequence.pattern === 'circular' ? 90 : 110;

      for (let t = 0, step = 0; t < duration; t += stepMs, step++) {
        frames.push({
          at: elapsed + t,
          active:
            groups[
              (sequence.pattern === 'circular' ? circularStep++ : step) %
                groups.length
            ],
          colors: sample.colors,
        });
      }
    }

    // Turn LEDs off after each press.
    elapsed += duration;

    frames.push({
      at: elapsed,
      ...idleFrame(),
    });

    // Delay before the next press.
    if (index < presses.length - 1) {
      elapsed += GAP_MS;
    }
  });

  return { frames, duration: elapsed };
}

/** Schedule one frame at a time and catch up if the JS thread runs late. */
export function schedulePlayback(
  frames: readonly TimedFrame[],
  duration: number,
  onFrame: (frame: LedFrame) => void,
  onComplete: () => void,
): () => void {
  const startedAt = performance.now();
  let index = 0;
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  function advance() {
    if (cancelled) return;
    const elapsed = performance.now() - startedAt;
    let latest: TimedFrame | undefined;

    while (index < frames.length && frames[index].at <= elapsed) {
      latest = frames[index++];
    }
    if (latest) onFrame(latest);

    // Preserve the existing short pause before clearing the playing indicator.
    const nextAt = index < frames.length ? frames[index].at : duration + 20;
    if (elapsed >= duration + 20) {
      onComplete();
    } else {
      timer = setTimeout(
        advance,
        Math.max(0, nextAt - (performance.now() - startedAt)),
      );
    }
  }

  advance();

  return () => {
    cancelled = true;
    clearTimeout(timer);
  };
}
