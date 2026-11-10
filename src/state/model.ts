import { createDefaultState } from './defaults';
import {
  contentError, copyMessage, copyProfile, isBattery, isId, isStatus,
  isText, messageError, profileError,
} from './validation';
import type { AppDataState, CodeLibrary, ConnectionStatus, Message, Profile } from './types';

function compareMessages(left: Message, right: Message): number {
  const difference = Date.parse(left.createdAt) - Date.parse(right.createdAt);

  return difference || (left.id < right.id ? -1 : left.id > right.id ? 1 : 0);
}

/** Insert into chronological history without sorting existing messages again. */
function insertMessage(
  messages: readonly Message[],
  message: Message,
): readonly Message[] {
  if (messages.some((existing) => existing.id === message.id)) return messages;

  let start = 0;
  let end = messages.length;

  while (start < end) {
    const middle = start + Math.floor((end - start) / 2);

    if (compareMessages(messages[middle], message) < 0) {
      start = middle + 1;
    } else {
      end = middle;
    }
  }

  return [...messages.slice(0, start), message, ...messages.slice(start)];
}

/** Seeds are trusted app configuration, not an unknown storage/network payload. */
export function initialize(seed?: AppDataState): AppDataState {
  const source = seed ?? createDefaultState();
  const { data, device } = source;

  const profiles = Object.fromEntries<Profile>(
    Object.entries(data.profiles).map(([id, profile]): [string, Profile] => {
      const error = profileError(profile);

      if (error || id !== profile.id)
        throw new Error(error ?? 'Profile keys must match IDs.');

      return [id, copyProfile(profile)];
    }),
  );

  if (!Object.prototype.hasOwnProperty.call(profiles, data.currentUserId)) {
    throw new Error('Startup state needs a current-user profile.');
  }

  if (
    data.partnerId !== null &&
    (!Object.prototype.hasOwnProperty.call(profiles, data.partnerId) ||
      data.partnerId === data.currentUserId ||
      !isId(data.activeConversationId))
  ) {
    throw new Error(
      'A linked partner needs another profile and an active conversation.',
    );
  }

  if (data.activeConversationId !== null && !isId(data.activeConversationId)) {
    throw new Error('Invalid active conversation ID.');
  }

  const ids = new Set<string>();

  const messages = data.messages
    .map((message) => {
      const error = messageError(message);

      if (error || ids.has(message.id))
        throw new Error(error ?? 'Startup message IDs must be unique.');

      ids.add(message.id);
      return copyMessage(message);
    })
    .sort(compareMessages);

  if (
    !isStatus(device.connectionStatus) ||
    !isBattery(device.battery) ||
    (device.connectionStatus !== 'connected' && device.battery !== null)
  ) {
    throw new Error('Invalid startup device state.');
  }

  if (
    !Object.prototype.hasOwnProperty.call(data.libraries, data.activeLibraryId) ||
    data.preferences.themeId !== 'classic'
  ) {
    throw new Error('Invalid startup library or theme selection.');
  }

  const libraries = Object.fromEntries<CodeLibrary>(
    Object.entries(data.libraries).map(([id, library]): [string, CodeLibrary] => {
      if (
        id !== library.id ||
        !isId(id) ||
        !isText(library.name) ||
        !Number.isInteger(library.revision) ||
        library.revision < 1
      ) {
        throw new Error('Invalid startup code library.');
      }

      const wordIds = new Set<string>();
      const codes = new Set<string>();

      const codewords = library.codewords.map((word) => {
        const error = contentError(word);

        if (error || wordIds.has(word.id) || codes.has(word.code)) {
          throw new Error(
            error ?? 'Codeword IDs and sequences must be unique within a library.',
          );
        }

        wordIds.add(word.id);
        codes.add(word.code);

        return {
          ...word,
          ...(word.vibration === undefined
            ? {}
            : { vibration: { ...word.vibration } }),
        };
      });

      return [id, { ...library, codewords }];
    }),
  );

  return {
    data: {
      ...data,
      profiles,
      libraries,
      messages,
      preferences: { ...data.preferences },
    },
    device: { ...device },
  };
}

export type Action =
  | { type: 'message/add'; message: Message }
  | { type: 'profile/update'; profile: Profile }
  | { type: 'partner/link'; profile: Profile; conversationId: string }
  | { type: 'partner/unlink' }
  | { type: 'device/connection'; status: ConnectionStatus }
  | { type: 'device/battery'; battery: number | null };

/** Pure transitions: no IO, clocks, random IDs, or mutation. */
export function reducer(state: AppDataState, action: Action): AppDataState {
  const { data } = state;

  switch (action.type) {
    case 'message/add': {
      const messages = insertMessage(data.messages, action.message);
      if (messages === data.messages) return state;

      return {
        ...state,
        data: {
          ...data,
          messages,
        },
      };
    }

    case 'profile/update': {
      const previous = data.profiles[action.profile.id];

      if (
        previous?.id === action.profile.id &&
        previous.name === action.profile.name &&
        previous.photoUrl === action.profile.photoUrl
      )
        return state;

      return {
        ...state,
        data: {
          ...data,
          profiles: {
            ...data.profiles,
            [action.profile.id]: action.profile,
          },
        },
      };
    }

    case 'partner/link': {
      const previous = data.profiles[action.profile.id];

      if (
        data.partnerId === action.profile.id &&
        data.activeConversationId === action.conversationId &&
        previous?.name === action.profile.name &&
        previous?.photoUrl === action.profile.photoUrl
      )
        return state;

      return {
        ...state,
        data: {
          ...data,
          profiles: {
            ...data.profiles,
            [action.profile.id]: action.profile,
          },
          partnerId: action.profile.id,
          activeConversationId: action.conversationId,
        },
      };
    }

    case 'partner/unlink':
      if (data.partnerId === null) return state;

      // Keep the conversation and profiles available for historical messages.
      return {
        ...state,
        data: {
          ...data,
          partnerId: null,
        },
      };

    case 'device/connection':
      if (state.device.connectionStatus === action.status) return state;

      return {
        ...state,
        device: { connectionStatus: action.status, battery: null },
      };

    case 'device/battery':
      if (
        state.device.connectionStatus !== 'connected' ||
        state.device.battery === action.battery
      )
        return state;

      return {
        ...state,
        device: {
          connectionStatus: 'connected',
          battery: action.battery,
        },
      };

    default: {
      const unhandled: never = action;
      throw new Error(`Unhandled app action: ${JSON.stringify(unhandled)}`);
    }
  }
}
