/**
 * Hecate Design System Tokens
 * Terminal Brutalism for PKM
 */

export const COLORS = {
  bg: '#0a0a0a',
  surface: '#111111',
  inset: '#161616',
  border: '#222222',
  borderEmp: '#333333',
  primary: '#ffffff',
  secondary: '#888888',
  muted: '#555555',
  disabled: '#3a3a3a',
  white: '#ffffff',
  black: '#000000',

  status: {
    done: '#338833',
    danger: '#cc3333',
    warning: '#aa7722',
    accent: '#ffffff',
  },

  tags: {
    slate: '#888888',
    emerald: '#22c55e',
    amber: '#eab308',
    crimson: '#ef4444',
    indigo: '#3b82f6',
    violet: '#a855f7',
    orange: '#f97316',
  },
} as const;

export const TYPOGRAPHY = {
  weights: {
    regular: 400,
    medium: 500,
  },
} as const;
