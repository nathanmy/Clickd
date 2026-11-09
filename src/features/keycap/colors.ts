export const LED_COLORS = {
  red: '#FF5A64',
  orange: '#FFAA4D',
  yellow: '#FFD84D',
  green: '#4ADE80',
  cyan: '#52DAF2',
  blue: '#64A8FF',
  purple: '#AD8BFF',
  pink: '#FF75B5',
  white: '#FFFFFF',
} as const;

export type LedColorId = keyof typeof LED_COLORS;

// Reusable options for primary and secondary color pickers.
export const LED_COLOR_OPTIONS = Object.entries(LED_COLORS).map(
  ([id, value]) => ({
    id: id as LedColorId,
    label: id.charAt(0).toUpperCase() + id.slice(1),
    value,
  })
);