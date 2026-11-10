import { LED_COLORS } from '@/features/keycap/codes';
import { createDefaultState } from './defaults';
import type { AppDataState, Message, Profile } from './types';

/** Demo messages reuse Clikd meanings and sequences while demonstrating lighting variations. */
export function createDemoState(): AppDataState {
  const state = createDefaultState();

  const partner: Profile = {
    id: 'demo-partner',
    name: 'Partner',
    photoUrl: null,
  };

  const conversationId = 'demo-conversation';
  const library = state.data.libraries['clikd-codes'];

  function messageContent(codewordId: string): Pick<Message, 'code' | 'meaning'> {
    const word = library.codewords.find((entry) => entry.id === codewordId);
    if (!word) throw new Error(`Demo codeword not found: ${codewordId}`);
    return { code: word.code, meaning: word.meaning };
  }

  const messages: Omit<Message, 'library'>[] = [
    {
      id: 'demo-1',
      conversationId,
      senderId: partner.id,
      createdAt: '2026-11-09T08:00:00.000Z',
      ...messageContent('miss'),
      pattern: 'solid',
      primaryColor: LED_COLORS.blue,
    },
    {
      id: 'demo-2',
      conversationId,
      senderId: partner.id,
      createdAt: '2026-11-09T08:01:00.000Z',
      ...messageContent('love'),
      pattern: 'solid',
      primaryColor: LED_COLORS.blue,
      secondaryColor: LED_COLORS.yellow,
    },
    {
      id: 'demo-3',
      conversationId,
      senderId: state.data.currentUserId,
      createdAt: '2026-11-09T08:02:00.000Z',
      ...messageContent('love'),
      pattern: 'solid',
      primaryColor: LED_COLORS.blue,
    },
    {
      id: 'demo-4',
      conversationId,
      senderId: partner.id,
      createdAt: '2026-11-09T08:03:00.000Z',
      ...messageContent('miss'),
      pattern: 'circular',
      primaryColor: LED_COLORS.red,
    },
    {
      id: 'demo-5',
      conversationId,
      senderId: partner.id,
      createdAt: '2026-11-09T08:04:00.000Z',
      ...messageContent('love'),
      pattern: 'circular',
      primaryColor: LED_COLORS.red,
      secondaryColor: LED_COLORS.green,
    },
    {
      id: 'demo-6',
      conversationId,
      senderId: state.data.currentUserId,
      createdAt: '2026-11-09T08:05:00.000Z',
      ...messageContent('love'),
      pattern: 'circular',
      primaryColor: LED_COLORS.red,
    },
    {
      id: 'demo-7',
      conversationId,
      senderId: partner.id,
      createdAt: '2026-11-09T08:06:00.000Z',
      ...messageContent('miss'),
      pattern: 'wave',
      primaryColor: LED_COLORS.purple,
    },
    {
      id: 'demo-8',
      conversationId,
      senderId: partner.id,
      createdAt: '2026-11-09T08:07:00.000Z',
      ...messageContent('love'),
      pattern: 'wave',
      primaryColor: LED_COLORS.purple,
      secondaryColor: LED_COLORS.pink,
    },
  ];

  return {
    data: {
      ...state.data,
      profiles: { ...state.data.profiles, [partner.id]: partner },
      partnerId: partner.id,
      activeConversationId: conversationId,
      messages: messages.map((message) => ({
        ...message,
        library: { id: library.id, name: library.name, revision: library.revision },
      })),
    },
    device: { connectionStatus: 'connected', battery: 78 },
  };
}
