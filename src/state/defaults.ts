import { LED_COLORS, MORSE_CODE } from '@/features/keycap/codes';
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
    name: 'Clikd Codes',
    revision: 1,
    codewords: [
      {
        id: 'love',
        code: '•—•',
        meaning: 'I love you',
        pattern: 'circular',
        primaryColor: LED_COLORS.blue,
      },
      {
        id: 'miss',
        code: '•••',
        meaning: 'I miss you',
        pattern: 'solid',
        primaryColor: LED_COLORS.pink,
      },
      {
        id: 'thinking',
        code: '—•',
        meaning: 'Thinking of you',
        pattern: 'wave',
        primaryColor: LED_COLORS.purple,
      },
      {
        id: 'good-luck',
        code: '••—',
        meaning: 'Good luck',
        pattern: 'solid',
        primaryColor: LED_COLORS.green,
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
      currentUserId: you.id,
      profiles: { [you.id]: you },
      partnerId: null,
      activeConversationId: null,
      libraries: { [library.id]: library, [morse.id]: morse },
      activeLibraryId: library.id,
      preferences: { themeId: 'classic' },
      messages: [],
    },
    device: { connectionStatus: 'disconnected', battery: null },
  };
}
