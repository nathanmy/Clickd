export const Spacing = {
  small: 8,
  medium: 16,
  large: 24,
} as const;

export const ClassicTheme = {
  name: 'Classic',
  background: '#F7F8FB',
  text: '#2E3440',
  textSecondary: '#858B98',
  border: '#DEE1E7',

  accent: '#687180',
  accentPressed: '#454E5D',
  codeText: '#3D4655',

  receivedBubble: '#E9EBF0',
  sentBubble: '#778091',
  receivedAvatar: '#D5D9E1',
  sentAvatar: '#8992A1',
  avatarText: '#626B79',

  connectionLine: '#CFD4DD',
  connectionBackground: '#E9EBF1',
  heartBackground: '#E4E6ED',

  keycap: {
    logo: '#343C49',
    idleLed: '#DCE7F9',
  },
} as const;

export const DEFAULT_THEME = ClassicTheme;
