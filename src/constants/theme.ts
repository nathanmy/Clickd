import { DEFAULT_FEEDBACK } from '@/features/keycap/codes';

export const ClassicTheme = {
  name: 'Classic',
  background: '#F7F8FB',
  text: '#000000',
  textSecondary: '#000000',
  icon: '#25252B',
  selection: '#25252B',
  swatchBorder: '#687180',
  border: '#DEE1E7',
  outline: '#454A55',

  accent: '#515967',
  codeText: '#000000',

  receivedBubble: '#E9EBF0',
  receivedAvatar: '#D5D9E1',

  connectionLine: '#CFD4DD',
  connectionBackground: '#E9EBF1',
  heartBackground: '#E4E6ED',

  keycap: {
    idleLed: DEFAULT_FEEDBACK.idleLedColor,
  },
} as const;

export type ThemeId = keyof typeof APP_THEMES;

export function isThemeId(value: unknown): value is ThemeId {
  return (
    typeof value === 'string' &&
    Object.prototype.hasOwnProperty.call(APP_THEMES, value)
  );
}

export const DEFAULT_THEME = ClassicTheme;

export const APP_THEMES = {
  classic: {
    label: 'Classic',
    color: ClassicTheme.background,
    controlSurface: '#D4DAE4',
    controlSelected: '#454F60',
    sentBubble: '#657080',
    receivedBubble: '#E9EBF0',
    sentAvatar: '#657080',
    receivedAvatar: '#D5D9E1',
    accent: '#626B79',
    keycapBody: '#DCE1EB',
    keycapCase: '#20232A',
    keycapHighlight: '#EDF0F5',
    keycapSide: '#909BAD',
  },
  lavender: {
    label: 'Lavender',
    color: '#F0EAFF',
    controlSurface: '#CFB9EB',
    controlSelected: '#5F3D96',
    sentBubble: '#7151AD',
    receivedBubble: '#E2D6F5',
    sentAvatar: '#7151AD',
    receivedAvatar: '#D9C9EF',
    accent: '#62418D',
    keycapBody: '#B799E8',
    keycapCase: '#362B46',
    keycapHighlight: '#C9ACF2',
    keycapSide: '#7854A7',
  },
  rose: {
    label: 'Rose',
    color: '#FFF0F5',
    controlSurface: '#F0BCD1',
    controlSelected: '#96385D',
    sentBubble: '#AC426A',
    receivedBubble: '#F9DCE7',
    sentAvatar: '#AC426A',
    receivedAvatar: '#F0C6D6',
    accent: '#973B5D',
    keycapBody: '#EA94B4',
    keycapCase: '#472C38',
    keycapHighlight: '#F6B1CB',
    keycapSide: '#B1587A',
  },
  sky: {
    label: 'Sky',
    color: '#EDF5FF',
    controlSurface: '#B9D9F5',
    controlSelected: '#275F9E',
    sentBubble: '#306AA9',
    receivedBubble: '#D6E9FA',
    sentAvatar: '#306AA9',
    receivedAvatar: '#C1DCF3',
    accent: '#285E95',
    keycapBody: '#7EB9EA',
    keycapCase: '#253D50',
    keycapHighlight: '#9DD0F5',
    keycapSide: '#447FAB',
  },
} as const;
