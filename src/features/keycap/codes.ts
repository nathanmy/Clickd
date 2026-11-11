export const LIGHTING_PATTERNS = ['solid', 'circular', 'wave'] as const;

export const DEFAULT_FEEDBACK = {
  idleLedColor: '#DCE7F9',
  sentLedColor: '#22C55E',
} as const;
export const DEFAULT_VIBRATION = {
  enabled: true,
  strength: 0.65,
  durationScale: 1,
} as const;
export const MAX_PLAYBACK_PRESSES = 64;
export const MAX_PLAYBACK_DURATION_MS = 60_000;
export const MAX_PRESS_DURATION_MS = 10_000;

export type LightingPattern = (typeof LIGHTING_PATTERNS)[number];

export function isLightingPattern(value: unknown): value is LightingPattern {
  return LIGHTING_PATTERNS.some((pattern) => pattern === value);
}

export type LightingSequence = Readonly<{
  code: string;
  pattern: LightingPattern;
  primaryColor: string;
  secondaryColor?: string;
}>;

export type PlaybackSequence = LightingSequence & {
  /** Recorded press timings take precedence over standard dot/dash timing. */
  presses?: readonly PressTiming[];
};

export type PressTiming = Readonly<{
  /** Milliseconds from the first press in the completed sequence. */
  offsetMs: number;
  durationMs: number;
}>;

export type ReplayableCode = PlaybackSequence & {
  id: string | number;
};

/** A complete recording starts at zero and contains ordered, nonoverlapping presses. */
export function isPressSequence(
  value: unknown,
  expectedLength: number,
): value is readonly PressTiming[] {
  if (!Array.isArray(value) || value.length !== expectedLength) return false;

  let previousEnd = 0;
  for (const [index, press] of value.entries()) {
    // Iteration visits sparse entries too; Array.every would skip missing presses.
    if (
      press === null ||
      typeof press !== 'object' ||
      !Number.isFinite(press.offsetMs) ||
      !Number.isFinite(press.durationMs) ||
      press.durationMs <= 0 ||
      press.offsetMs < previousEnd ||
      (index === 0 && press.offsetMs !== 0) ||
      !Number.isFinite(press.offsetMs + press.durationMs)
    )
      return false;

    previousEnd = press.offsetMs + press.durationMs;
  }

  return true;
}

export const LED_COLORS = {
  red: '#FF5A64',
  orange: '#FFAA4D',
  yellow: '#FFD84D',
  green: '#4ADE80',
  cyan: '#52DAF2',
  blue: '#64A8FF',
  purple: '#AD8BFF',
  pink: '#FF75B5',
  white: '#FFFFFF',
} as const;

/** International Morse reference; independent of the active messaging library. */
export const MORSE_CODE = [
  ['A', '•—'],
  ['B', '—•••'],
  ['C', '—•—•'],
  ['D', '—••'],
  ['E', '•'],
  ['F', '••—•'],
  ['G', '——•'],
  ['H', '••••'],
  ['I', '••'],
  ['J', '•———'],
  ['K', '—•—'],
  ['L', '•—••'],
  ['M', '——'],
  ['N', '—•'],
  ['O', '———'],
  ['P', '•——•'],
  ['Q', '——•—'],
  ['R', '•—•'],
  ['S', '•••'],
  ['T', '—'],
  ['U', '••—'],
  ['V', '•••—'],
  ['W', '•——'],
  ['X', '—••—'],
  ['Y', '—•——'],
  ['Z', '——••'],
  ['0', '—————'],
  ['1', '•————'],
  ['2', '••———'],
  ['3', '•••——'],
  ['4', '••••—'],
  ['5', '•••••'],
  ['6', '—••••'],
  ['7', '——•••'],
  ['8', '———••'],
  ['9', '————•'],
] as const;
