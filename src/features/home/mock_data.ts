
import { LED_COLORS } from '@/features/keycap/colors';
import type { ReplayableCode } from '@/features/keycap/lighting';

export type Message = ReplayableCode & {
  id: number;
  meaning: string;
  direction: 'sent' | 'received';
  time: string;
};

type Profile = {
  name: string;
  photoUrl: string | null;
};

export const device = {
  connected: true,
  battery: 78,
  partnerLinked: true,
};

export const profiles: {
  you: Profile;
  partner: Profile;
} = {
  you: { name: 'You', photoUrl: null },
  partner: { name: 'Partner', photoUrl: null },
};

export const messages: Message[] = [
  // Solid
  {
    id: 1, code: '•••', meaning: 'Solid: Primary Color',
    direction: 'received', time: '12:00 AM',
    pattern: 'solid',
    primaryColor: LED_COLORS.blue,
  },
  {
    id: 2, code: '•—•', meaning: 'Solid: Primary + Secondary Color',
    direction: 'received', time: '12:01 AM',
    pattern: 'solid',
    primaryColor: LED_COLORS.blue,
    secondaryColor: LED_COLORS.yellow,
  },
  {
    id: 3, code: '•—•—', meaning: 'I Love you!',
    direction: 'sent', time: '12:02 AM',
    pattern: 'solid',
    primaryColor: LED_COLORS.blue,
  },

  // Circular
  {
    id: 4, code: '•••', meaning: 'Circular: Primary Color',
    direction: 'received', time: '12:03 AM',
    pattern: 'circular',
    primaryColor: LED_COLORS.red,
  },
  {
    id: 5, code: '•—•', meaning: 'Circular: Primary + Secondary Color',
    direction: 'received', time: '12:04 AM',
    pattern: 'circular',
    primaryColor: LED_COLORS.red,
    secondaryColor: LED_COLORS.green,
  },
  {
    id: 6, code: '•—•—', meaning: 'I Love you!',
    direction: 'sent', time: '12:05 AM',
    pattern: 'circular',
    primaryColor: LED_COLORS.red,
  },

  // Wave
  {
    id: 7, code: '•••', meaning: 'Wave: Primary Color',
    direction: 'received', time: '12:06 AM',
    pattern: 'wave',
    primaryColor: LED_COLORS.purple,
  },
  {
    id: 8, code: '•—•', meaning: 'Wave: Primary + Secondary Color',
    direction: 'received', time: '12:07 AM',
    pattern: 'wave',
    primaryColor: LED_COLORS.purple,
    secondaryColor: LED_COLORS.pink,
  },
];