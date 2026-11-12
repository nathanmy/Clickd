import {
  isPressSequence,
  MAX_PLAYBACK_DURATION_MS,
  MAX_PLAYBACK_PRESSES,
  MAX_PRESS_DURATION_MS,
  type PressTiming,
} from '@/features/keycap/codes';
import { MAX_CODE_CLICKS } from '@/state/validation';
import type { CodeLibrary, Codeword } from '@/state/types';

// Initial simulator settings, not a firmware protocol.
export const HOLD_THRESHOLD_MS = 400;
export const SEQUENCE_PAUSE_MS = 900;
export const MORSE_LETTER_PAUSE_MS = SEQUENCE_PAUSE_MS;
export const MORSE_SEND_PAUSE_MS = 2000;
export { MAX_PLAYBACK_PRESSES };
export { MAX_CODE_CLICKS, MAX_PRESS_DURATION_MS };
export type ResolvedInput = Readonly<{
  code: string;
  presses: readonly PressTiming[];
  word: Codeword | null;
  library: Readonly<Pick<CodeLibrary, 'id' | 'name' | 'revision'>>;
}>;

export function getInputCode(
  presses: readonly PressTiming[],
  separateLetters = false,
): string {
  return presses
    .map((press, index) => {
      const previous = presses[index - 1];
      const boundary =
        separateLetters &&
        previous &&
        press.offsetMs - previous.offsetMs - previous.durationMs >=
          MORSE_LETTER_PAUSE_MS;
      const symbol =
        press.durationMs >= HOLD_THRESHOLD_MS ? '\u2014' : '\u2022';
      return (boundary ? ' / ' : '') + symbol;
    })
    .join('');
}

/** This boundary can also accept a completed press recording from a future device. */
export function resolveInput(
  presses: readonly PressTiming[],
  library: CodeLibrary,
): ResolvedInput {
  const morse = library.id === 'morse-code';
  const limit = morse ? MAX_PLAYBACK_PRESSES : MAX_CODE_CLICKS;
  if (
    !presses.length ||
    presses.length > limit ||
    !isPressSequence(presses, presses.length)
  )
    throw new Error(`Record between 1 and ${limit} ordered presses.`);
  if (
    presses.some(
      (press) =>
        press.durationMs > MAX_PRESS_DURATION_MS ||
        press.offsetMs + press.durationMs > MAX_PLAYBACK_DURATION_MS,
    )
  )
    throw new Error(
      'This recording is too long. Clear it and try a shorter sequence.',
    );
  const code = getInputCode(presses);
  let word = library.codewords.find((entry) => entry.code === code);
  if (morse) {
    let meaning = '';
    let start = 0;
    for (let index = 1; index <= presses.length; index++) {
      const previous = presses[index - 1];
      const gap =
        index === presses.length
          ? Infinity
          : presses[index].offsetMs - previous.offsetMs - previous.durationMs;
      if (index < presses.length && gap >= MORSE_SEND_PAUSE_MS)
        throw new Error('Record one Morse word at a time.');
      if (gap < MORSE_LETTER_PAUSE_MS) continue;
      const character = library.codewords.find(
        (entry) => entry.code === code.slice(start, index),
      );
      if (!character)
        throw new Error('Unknown Morse character. Clear and try again.');
      meaning += character.meaning;
      start = index;
    }
    word = { ...library.codewords[0], id: 'morse-message', code, meaning };
  }
  return {
    code,
    presses: presses.map((press) => ({ ...press })),
    word: word
      ? {
          ...word,
          ...(word.vibration ? { vibration: { ...word.vibration } } : {}),
        }
      : null,
    library: { id: library.id, name: library.name, revision: library.revision },
  };
}

/** Keep visible rules synchronized with the actual recording thresholds. */
export function getInputRules(morse: boolean): readonly string[] {
  const hold = HOLD_THRESHOLD_MS / 1000;
  const pause = SEQUENCE_PAUSE_MS / 1000;
  const letter = MORSE_LETTER_PAUSE_MS / 1000;
  const receive = MORSE_SEND_PAUSE_MS / 1000;
  return morse
    ? [
        `Click: dot (under ${hold}s)`,
        `Hold: dash (${hold}s+)`,
        `Pause under ${letter}s: same letter`,
        `Pause ${letter}s to under ${receive}s: next letter`,
        `Pause ${receive}s: receive word`,
      ]
    : [
        `Click: short (under ${hold}s)`,
        `Hold: long (${hold}s+)`,
        `Pause under ${pause}s: continue code`,
        `Pause ${pause}s: receive code`,
      ];
}
