import { DEFAULT_THEME } from '@/constants/theme';

import { isPressSequence, type LightingSequence, type PlaybackSequence } from '@/features/keycap/codes';

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

export const LED_PATHS = [
  'M109 191 L226 81',
  'M380 59 L696 59',
  'M863 83 L970 192',
  'M991 365 L991 623',
  'M969 770 L865 888',
  'M382 922 L698 922',
  'M216 888 L108 769',
  'M82 365 L82 623',
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
      const secondary = sequence.pattern === 'wave'
        ? WAVE_GROUPS[1].includes(id)
        : sequence.pattern === 'circular'
          ? Math.floor(id / 2) % 2 === 1
          : id % 2 === 1;
      return secondary ? sequence.secondaryColor ?? sequence.primaryColor : sequence.primaryColor;
    }),
  };
}

export function createPlaybackFrames(
  sequence: PlaybackSequence
): {
  frames: TimedFrame[];
  duration: number;
} {
  const frames: TimedFrame[] = [];
  const sample = createLightingSample(sequence);

  const presses = [...sequence.code].filter(
    char => char === '•' || char === '—'
  );

  // Fall back as a whole if measured timing is incomplete or malformed.
  const measured = sequence.presses;
  const useMeasuredTiming = isPressSequence(measured, presses.length);

  let elapsed = 0;

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
        sequence.pattern === 'circular'
          ? CIRCULAR_GROUPS
          : WAVE_GROUPS;

      const stepMs = sequence.pattern === 'circular' ? 90 : 110;

      for (
        let t = 0, step = 0;
        t < duration;
        t += stepMs, step++
      ) {
        frames.push({
          at: elapsed + t,
          active: groups[step % groups.length],
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
      timer = setTimeout(advance, Math.max(0, nextAt - (performance.now() - startedAt)));
    }
  }

  advance();

  return () => {
    cancelled = true;
    clearTimeout(timer);
  };
}
