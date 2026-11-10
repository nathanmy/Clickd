import { isLightingPattern, isPressSequence } from '@/features/keycap/codes';
import type {
  Codeword,
  CodeLibrary,
  ConnectionStatus,
  Message,
  Profile,
  VibrationSettings,
} from './types';

const ISO_TIME = /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/u;

export const isId = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value === value.trim();

export const isText = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const isColor = (value: unknown): value is string =>
  typeof value === 'string' && /^#[0-9a-f]{6}$/iu.test(value);

export const isStatus = (value: unknown): value is ConnectionStatus =>
  value === 'disconnected' || value === 'connecting' || value === 'connected';

export const isBattery = (value: unknown): value is number | null =>
  value === null ||
  (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100);

function isTimestamp(value: unknown): value is string {
  if (typeof value !== 'string' || !ISO_TIME.test(value)) return false;

  const day = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);

  return (
    Number.isFinite(Date.parse(value)) &&
    Number.isFinite(day.getTime()) &&
    day.toISOString().slice(0, 10) === value.slice(0, 10)
  );
}

function validVibration(value: VibrationSettings): boolean {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof value.enabled === 'boolean' &&
    Number.isFinite(value.strength) &&
    value.strength >= 0 &&
    value.strength <= 1 &&
    Number.isFinite(value.durationScale) &&
    value.durationScale >= 0.5 &&
    value.durationScale <= 2
  );
}

export function profileError(profile: Profile): string | null {
  if (!profile || !isId(profile.id) || !isText(profile.name)) {
    return 'A profile needs a stable ID and a nonempty name.';
  }

  if (profile.photoUrl !== null && !isText(profile.photoUrl)) {
    return 'A profile photo must be a nonempty URI or null.';
  }

  return null;
}

export function contentError(value: Codeword): string | null {
  if (
    !value ||
    !isId(value.id) ||
    !isText(value.meaning) ||
    typeof value.code !== 'string' ||
    !/^[•—]+$/u.test(value.code)
  ) {
    return 'A completed message needs a meaning and a sequence of • and —.';
  }

  if (
    !isLightingPattern(value.pattern) ||
    !isColor(value.primaryColor) ||
    (value.secondaryColor !== undefined && !isColor(value.secondaryColor))
  ) {
    return 'Lighting needs a supported pattern and six-digit hex colors.';
  }

  if (value.vibration !== undefined && !validVibration(value.vibration)) {
    return 'Vibration strength must be 0–1 and duration scale must be 0.5–2.';
  }

  return null;
}

export function codewordSaveError(
  library: CodeLibrary | undefined,
  word: Codeword,
  creating: boolean,
): string | null {
  if (!library) return 'This library is no longer available.';
  if (library.id === 'morse-code') return 'Standard Morse code entries cannot be edited.';
  const error = contentError(word);
  if (error) return error;

  const exists = library.codewords.some((entry) => entry.id === word.id);
  if (creating && exists) return 'This codeword already exists.';
  if (!creating && !exists) return 'This codeword is no longer available.';
  if (library.codewords.some((entry) => entry.id !== word.id && entry.code === word.code)) {
    return 'That click sequence is already used by another codeword.';
  }
  return null;
}

export function messageError(message: Message): string | null {
  if (
    !message ||
    !isId(message.id) ||
    !isId(message.senderId) ||
    !isId(message.conversationId)
  ) {
    return 'A message needs stable message, sender, and conversation IDs.';
  }

  if (!isTimestamp(message.createdAt))
    return 'createdAt must be a valid ISO timestamp with a time zone.';

  // Historical libraries may be renamed or removed; validate the saved metadata only.
  if (
    !message.library ||
    !isId(message.library.id) ||
    !isText(message.library.name) ||
    !Number.isInteger(message.library.revision) ||
    message.library.revision < 1
  ) return 'A message needs its original library ID, name, and revision.';

  const error = contentError(message);
  if (error) return error;

  if (message.presses !== undefined) {
    if (
      !Array.isArray(message.presses) ||
      message.presses.length !== message.code.length
    ) {
      return 'Measured timings must contain one entry per completed press.';
    }

    if (!isPressSequence(message.presses, message.code.length)) {
      return 'Measured presses need finite, positive durations and ordered, nonoverlapping offsets starting at zero.';
    }
  }

  return null;
}

export function copyProfile(profile: Profile): Profile {
  return {
    id: profile.id,
    name: profile.name.trim(),
    photoUrl: profile.photoUrl,
  };
}

/** Copy nested values before dispatch so the producer cannot mutate history. */
export function copyMessage(message: Message): Message {
  return {
    id: message.id,
    library: {
      id: message.library.id,
      name: message.library.name,
      revision: message.library.revision,
    },
    conversationId: message.conversationId,
    senderId: message.senderId,
    createdAt: new Date(message.createdAt).toISOString(),
    code: message.code,
    meaning: message.meaning,
    pattern: message.pattern,
    primaryColor: message.primaryColor,

    ...(message.secondaryColor === undefined
      ? {}
      : { secondaryColor: message.secondaryColor }),

    ...(message.vibration === undefined
      ? {}
      : { vibration: { ...message.vibration } }),

    ...(message.presses === undefined
      ? {}
      : {
          presses: message.presses.map((press) => ({
            offsetMs: press.offsetMs,
            durationMs: press.durationMs,
          })),
        }),
  };
}
