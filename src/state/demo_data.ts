import { LED_COLORS } from '@/features/keycap/sequence';
import { createDefaultState } from './defaults';
import type { AppDataState, Message, Profile } from './types';

/** The original animation examples are demo messages, not codeword definitions. */
export function createDemoState(): AppDataState {
  const state = createDefaultState();

  const partner: Profile = {
    id: 'demo-partner',
    name: 'Partner',
    photoUrl: null,
  };

  const conversationId = 'demo-conversation';

  const messages: Message[] = [
    {
      id: 'demo-1',
      conversationId,
      senderId: partner.id,
      createdAt: '2026-11-09T08:00:00.000Z',
      code: '•••',
      meaning: 'Solid: Primary Color',
      pattern: 'solid',
      primaryColor: LED_COLORS.blue,
    },
    {
      id: 'demo-2',
      conversationId,
      senderId: partner.id,
      createdAt: '2026-11-09T08:01:00.000Z',
      code: '•—•',
      meaning: 'Solid: Primary + Secondary Color',
      pattern: 'solid',
      primaryColor: LED_COLORS.blue,
      secondaryColor: LED_COLORS.yellow,
    },
    {
      id: 'demo-3',
      conversationId,
      senderId: state.data.currentUserId,
      createdAt: '2026-11-09T08:02:00.000Z',
      code: '•—•—',
      meaning: 'I Love you!',
      pattern: 'solid',
      primaryColor: LED_COLORS.blue,
    },
    {
      id: 'demo-4',
      conversationId,
      senderId: partner.id,
      createdAt: '2026-11-09T08:03:00.000Z',
      code: '•••',
      meaning: 'Circular: Primary Color',
      pattern: 'circular',
      primaryColor: LED_COLORS.red,
    },
    {
      id: 'demo-5',
      conversationId,
      senderId: partner.id,
      createdAt: '2026-11-09T08:04:00.000Z',
      code: '•—•',
      meaning: 'Circular: Primary + Secondary Color',
      pattern: 'circular',
      primaryColor: LED_COLORS.red,
      secondaryColor: LED_COLORS.green,
    },
    {
      id: 'demo-6',
      conversationId,
      senderId: state.data.currentUserId,
      createdAt: '2026-11-09T08:05:00.000Z',
      code: '•—•—',
      meaning: 'I Love you!',
      pattern: 'circular',
      primaryColor: LED_COLORS.red,
    },
    {
      id: 'demo-7',
      conversationId,
      senderId: partner.id,
      createdAt: '2026-11-09T08:06:00.000Z',
      code: '•••',
      meaning: 'Wave: Primary Color',
      pattern: 'wave',
      primaryColor: LED_COLORS.purple,
    },
    {
      id: 'demo-8',
      conversationId,
      senderId: partner.id,
      createdAt: '2026-11-09T08:07:00.000Z',
      code: '•—•',
      meaning: 'Wave: Primary + Secondary Color',
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
      messages,
    },
    device: { connectionStatus: 'connected', battery: 78 },
  };
}
