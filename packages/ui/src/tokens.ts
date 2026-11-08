/**
 * Hecate Design System Tokens
 * Source of truth: Hecate Design System — README.md (Quiet, warm, dark)
 */

export const COLORS = {
  // Surfaces and lines (canonical warm-dark values; runtime theming uses the
  // CSS variables of the same names defined in apps/web/src/index.css)
  bg: '#121110',
  bgSide: '#161513',
  surface: '#1c1a18',
  surface2: '#1a1917',
  hover: '#181614',
  hoverNav: '#1f1d1a',
  active: '#24211e',
  active2: '#2a2723',
  border: '#2a2825',
  borderStrong: '#34312d',

  // Text
  text: '#ece8e1',
  text2: '#d8d2c8',
  text3: '#c9c3b9',
  muted: '#9a948a',
  faint: '#8a847a',

  // Accent and semantic
  accent: '#c4b2ff',
  accentBg: '#1b1726',
  accentBorder: '#4a3f6e',
  accentChip: '#262033',
  refUnderline: '#6d5aa8',
  success: '#8fd18b',
  successBg: '#1e2a1e',
  danger: '#e8856a',

  // Supertag palette
  supertags: {
    task: { text: '#8fd18b', bg: '#1e2a1e' },
    book: { text: '#e8b86a', bg: '#2c2418' },
    person: { text: '#8cc4f0', bg: '#1d2630' },
  },
} as const;

export const RADII = {
  checkbox: 5,
  chip: 6,
  field: 6,
  nav: 8,
  row: 8,
  button: 10,
  input: 10,
  card: 10,
  featuredCard: 14,
} as const;

export const LAYOUT = {
  sidebarWidth: 232,
  sidebarCollapsedWidth: 56,
  coachRailWidth: 344,
  coachRailCollapsedWidth: 40,
  topBarHeight: 56,
  statusBarHeight: 32,
  mainColumnMaxWidth: 760,
  mainColumnSidePadding: 32,
  commandPaletteWidth: 640,
} as const;

export const TYPOGRAPHY = {
  fonts: {
    ui: "'Inter', system-ui, -apple-system, sans-serif",
    mono: "'JetBrains Mono', monospace",
  },
  weights: {
    regular: 400,
    medium: 500,
    semibold: 600,
  },
} as const;
