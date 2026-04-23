/**
 * Semantic color tokens — mirrors tokens.css as JS constants so you can pass
 * them into Recharts, Leaflet, SVG fills, etc.
 */
export const COLORS = {
  // Status
  pos: '#047857',
  neg: '#be123c',
  warn: '#a16207',
  info: '#1d4ed8',

  // Brand
  btc: '#e85d1f',
  btcInk: '#c24a12',
  btcSoft: '#fef1e6',

  // SOTP categories
  netLiquid: '#047857',
  mining: '#b45309',
  hpc: '#0e7490',
  pipeline: '#6d28d9',
  debt: '#be123c',
  gpu: '#db2777',

  // Ink
  ink1: '#14130f',
  ink2: '#4a4842',
  ink3: '#78756a',
  ink4: '#a8a59a',

  // Hairlines
  hairline: '#efece3',
  border: '#e5e2d8',
  borderStrong: '#d6d2c5',
} as const;

export type ColorToken = keyof typeof COLORS;
