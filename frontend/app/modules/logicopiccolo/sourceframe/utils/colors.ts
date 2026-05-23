// src/utils/colors.ts

import { ButtonIdentity, ColorType } from '../types';

export const COLOR_MAP: Record<ColorType, string> = {
  red: '#FF3B30',
  blue: '#007AFF',
  green: '#34C759',
  yellow: '#FFCC00',
  orange: '#FF9500',
  purple: '#AF52DE',
  pink: '#FF2D55',
  brown: '#A2845E',
  black: '#1C1C1E',
  white: '#F2F2F7'
};

export const COLOR_NAMES: ColorType[] = [
  'red', 'blue', 'green', 'yellow', 'orange',
  'purple', 'pink', 'brown', 'black', 'white'
];

/** Core 5 puzzle colors used to generate 10 buttons (solid + ring). */
export const LOGICO_BUTTON_COLORS: ColorType[] = [
  'red',
  'blue',
  'green',
  'yellow',
  'orange',
];

export const LOGICO_BUTTON_SET: ButtonIdentity[] = LOGICO_BUTTON_COLORS.flatMap((color) => [
  { color, variant: 'ring' as const },
  { color, variant: 'solid' as const },
]);

export const DIFFICULTY_COLORS = {
  easy: '#34C759',
  medium: '#FF9500',
  hard: '#FF3B30'
};