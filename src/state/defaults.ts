import {
  DEFAULT_FEEDBACK,
  LED_COLORS,
  MORSE_CODE,
} from '@/features/keycap/codes';
import type { AppDataState, CodeLibrary, Profile } from './types';

/** Fresh objects each time; these are product defaults, not demo content. */
export function createDefaultState(): AppDataState {
  const you: Profile = {
    id: 'local-user',
    name: 'You',
    photoUrl: null,
  };

  const library: CodeLibrary = {
    id: 'clikd-codes',
    name: 'Clickd Codes',
    revision: 2,
    codewords: [
      {
        id: 'love',
        code: '•—•',
        meaning: 'I love you',
        pattern: 'solid',
        primaryColor: LED_COLORS.blue,
      },
      {
        id: 'miss',
        code: '•••',
        meaning: 'I miss you',
        pattern: 'solid',
        primaryColor: LED_COLORS.blue,
        secondaryColor: LED_COLORS.yellow,
      },
      {
        id: 'thinking',
        code: '—•',
        meaning: 'Thinking of you',
        pattern: 'circular',
        primaryColor: LED_COLORS.red,
      },
      {
        id: 'good-luck',
        code: '••—',
        meaning: 'Good luck',
        pattern: 'circular',
        primaryColor: LED_COLORS.red,
        secondaryColor: LED_COLORS.green,
      },
      {
        id: 'on-my-way',
        code: '—••',
        meaning: 'On my way',
        pattern: 'wave',
        primaryColor: LED_COLORS.purple,
      },
      {
        id: 'youve-got-this',
        code: '•——',
        meaning: "You've got this",
        pattern: 'wave',
        primaryColor: LED_COLORS.purple,
        secondaryColor: LED_COLORS.pink,
      },
    ],
  };

  const morse: CodeLibrary = {
    id: 'morse-code',
    name: 'Morse Code',
    revision: 1,
    codewords: MORSE_CODE.map(([character, code]) => ({
      id: character,
      code,
      meaning: character,
      pattern: 'solid',
      primaryColor: LED_COLORS.blue,
    })),
  };

  return {
    data: {
      history: { source: 'session', startedAt: new Date().toISOString() },
      currentUserId: you.id,
      profiles: { [you.id]: you },
      partnerId: null,
      activeConversationId: null,
      libraries: { [library.id]: library, [morse.id]: morse },
      activeLibraryId: library.id,
      preferences: { themeId: 'classic', ...DEFAULT_FEEDBACK },
      messages: [],
    },
    device: { connectionStatus: 'disconnected', battery: null },
  };
}
