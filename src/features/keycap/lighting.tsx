import { DEFAULT_THEME } from '@/constants/theme';

export type LightingPattern = 'solid' | 'circular' | 'wave';

export type LightingSequence = {
  code: string;
  pattern: LightingPattern;
  primaryColor: string;
  secondaryColor?: string;
};

export type ReplayableCode = LightingSequence & {
  id: string | number;
};

export type LedFrame = {
  active: number[];
  colors: string[];
};

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

export function createPlaybackFrames(
  sequence: LightingSequence
): {
  frames: TimedFrame[];
  duration: number;
} {
  const frames: TimedFrame[] = [];

  const presses = [...sequence.code].filter(
    char => char === '•' || char === '—'
  );

  let elapsed = 0;

  presses.forEach((symbol, index) => {
    const duration =
      symbol === '•' ? DOT_MS : DASH_MS;

    if (sequence.pattern === 'solid') {
      // All LEDs are lit simultaneously.
      // Adjacent LEDs alternate colors if a second exists.
      frames.push({
        at: elapsed,
        active: LED_IDS,
        colors: LED_IDS.map(id =>
          id % 2
            ? sequence.secondaryColor ?? sequence.primaryColor
            : sequence.primaryColor
        ),
      });
    } else {
      const groups =
        sequence.pattern === 'circular'
          ? CIRCULAR_GROUPS
          : WAVE_GROUPS;

      const stepMs =
        sequence.pattern === 'circular' ? 90 : 110;

      for (
        let t = 0, step = 0;
        t < duration;
        t += stepMs, step++
      ) {
        const color =
          step % 2
            ? sequence.secondaryColor ?? sequence.primaryColor
            : sequence.primaryColor;

        frames.push({
          at: elapsed + t,
          active: groups[step % groups.length],
          colors: LED_IDS.map(() => color),
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