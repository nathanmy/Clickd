import { createDefaultState } from './defaults';
import { MAX_CODEWORDS } from './validation';
import type { AppDataState, Message, Profile } from './types';

/** Snapshot each default codeword, including its exact lighting and vibration. */
export function createDemoState(now = new Date()): AppDataState {
  const state = createDefaultState();
  const partner: Profile = {
    id: 'demo-partner',
    name: 'Partner',
    photoUrl: null,
  };
  const conversationId = 'demo-conversation';
  const library = state.data.libraries['clikd-codes'];
  const messages: Message[] = library.codewords.map((word, index) => ({
    ...word,
    id: `demo-v3-${word.id}`,
    conversationId,
    senderId: partner.id,
    createdAt: new Date(
      now.getTime() - (library.codewords.length - index) * 60_000,
    ).toISOString(),
    library: {
      id: library.id,
      name: library.name,
      revision: library.revision,
    },
  }));

  return addDemoReplies({
    data: {
      ...state.data,
      history: { ...state.data.history, source: 'demo' },
      profiles: { ...state.data.profiles, [partner.id]: partner },
      partnerId: partner.id,
      activeConversationId: conversationId,
      messages,
    },
    device: { connectionStatus: 'connected', battery: 78 },
  });
}

/** Replace obsolete demo messages while preserving every saved codeword. */
function refreshOldDemoMessages(
  state: AppDataState,
  seed: AppDataState,
): AppDataState {
  const library = state.data.libraries['clikd-codes'];
  if (
    state.data.history.source !== 'demo' ||
    seed.data.libraries['clikd-codes'].revision !== 2 ||
    !state.data.messages.some(
      (message) =>
        message.id === 'demo-1' &&
        message.conversationId === 'demo-conversation',
    )
  )
    return state;

  const oldIds = new Set(
    Array.from({ length: 8 }, (_, index) => `demo-${index + 1}`),
  );
  const defaults = seed.data.libraries['clikd-codes'];
  const codewords = [...library.codewords];
  const examples = defaults.codewords.map((word) => {
    const existing = codewords.find(
      (saved) => saved.id === word.id || saved.code === word.code,
    );
    if (existing) return existing;
    if (codewords.length >= MAX_CODEWORDS) return undefined;
    codewords.push(word);
    return word;
  });
  const updatedLibrary =
    codewords.length === library.codewords.length
      ? library
      : { ...library, revision: library.revision + 1, codewords };
  const messages = seed.data.messages
    .filter((message) => message.senderId !== seed.data.currentUserId)
    .flatMap((message, index): Message[] => {
      const word = examples[index];
      if (!word) return [];
      return [
        {
          ...word,
          id: message.id,
          conversationId: message.conversationId,
          senderId: message.senderId,
          createdAt: message.createdAt,
          library: {
            id: updatedLibrary.id,
            name: updatedLibrary.name,
            revision: updatedLibrary.revision,
          },
        },
      ];
    });
  return {
    ...state,
    data: {
      ...state.data,
      libraries: {
        ...state.data.libraries,
        'clikd-codes': updatedLibrary,
      },
      messages: [
        ...state.data.messages.filter(
          (message) =>
            message.conversationId !== 'demo-conversation' ||
            !oldIds.has(message.id),
        ),
        ...messages,
      ],
    },
  };
}

/** Add sent examples after every two received examples, preserving saved snapshots. */
function addDemoReplies(state: AppDataState): AppDataState {
  if (state.data.history.source !== 'demo') return state;
  const love = state.data.libraries['clikd-codes'].codewords.find(
    (word) => word.id === 'love',
  );
  if (!love) return state;
  const received = state.data.messages
    .filter(
      (message) =>
        message.conversationId === 'demo-conversation' &&
        message.senderId !== state.data.currentUserId &&
        (message.id.startsWith('demo-v2-') ||
          message.id.startsWith('demo-v3-') ||
          message.id.startsWith('demo-v4-')),
    )
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  const library = state.data.libraries['clikd-codes'];
  const additions: Message[] = [];
  for (const [index, after] of [1, 3, 5].entries()) {
    const id = `demo-v3-sent-love-${index + 1}`;
    if (
      !received[after] ||
      state.data.messages.some(
        (message) =>
          message.id === id ||
          message.id === id.replace('demo-v3-', 'demo-v2-') ||
          message.id === id.replace('demo-v3-', 'demo-v4-'),
      )
    )
      continue;
    additions.push({
      ...love,
      pattern: 'solid',
      id,
      conversationId: 'demo-conversation',
      senderId: state.data.currentUserId,
      createdAt: new Date(
        Date.parse(received[after].createdAt) + 1,
      ).toISOString(),
      library: {
        id: library.id,
        name: library.name,
        revision: library.revision,
      },
    });
  }
  return additions.length
    ? {
        ...state,
        data: {
          ...state.data,
          messages: [...state.data.messages, ...additions],
        },
      }
    : state;
}

export function refreshDemoExamples(
  state: AppDataState,
  seed: AppDataState,
): AppDataState {
  return refreshDemoLovePattern(
    refreshDemoSnapshotsOnce(
      addDemoReplies(refreshOldDemoMessages(state, seed)),
    ),
  );
}

/** One-time correction of generated examples, not a live link to the library. */
function refreshDemoSnapshotsOnce(state: AppDataState): AppDataState {
  if (state.data.history.source !== 'demo') return state;
  const library = state.data.libraries['clikd-codes'];
  const examples: Record<string, string> = {
    love: 'love',
    miss: 'miss',
    thinking: 'thinking',
    'good-luck': 'good-luck',
    'on-my-way': 'on-my-way',
    'youve-got-this': 'youve-got-this',
    'sent-love-1': 'love',
    'sent-love-2': 'love',
  };
  let changed = false;
  const messages = state.data.messages.map((message) => {
    if (
      message.conversationId !== 'demo-conversation' ||
      !message.id.startsWith('demo-v2-')
    )
      return message;
    const suffix = message.id.slice('demo-v2-'.length);
    if (!Object.prototype.hasOwnProperty.call(examples, suffix)) return message;
    const word = library.codewords.find(
      (entry) => entry.id === examples[suffix],
    );
    changed = true;
    // A deleted codeword still has a valid historical snapshot to preserve.
    if (!word) return { ...message, id: `demo-v3-${suffix}` };
    return {
      ...word,
      id: `demo-v3-${suffix}`,
      conversationId: message.conversationId,
      senderId: message.senderId,
      createdAt: message.createdAt,
      library: {
        id: library.id,
        name: library.name,
        revision: library.revision,
      },
    };
  });
  return changed ? { ...state, data: { ...state.data, messages } } : state;
}

/** Correct only generated love examples; new IDs keep immutable stored bodies intact. */
function refreshDemoLovePattern(state: AppDataState): AppDataState {
  if (state.data.history.source !== 'demo') return state;
  let changed = false;
  const messages = state.data.messages.map((message) => {
    if (
      message.conversationId !== 'demo-conversation' ||
      !/^demo-v3-(?:love|sent-love-[123])$/.test(message.id) ||
      message.pattern === 'solid'
    )
      return message;
    changed = true;
    return {
      ...message,
      id: message.id.replace('demo-v3-', 'demo-v4-'),
      pattern: 'solid' as const,
    };
  });
  return changed ? { ...state, data: { ...state.data, messages } } : state;
}
