// Material tier colors used throughout the application
export const TIER_COLORS: Record<string, string> = {
  // Metals
  bronze: '#CD7F32',
  iron: '#434B4D',
  steel: '#71797E',
  mithril: '#26619C',
  adamant: '#2D5016',
  rune: '#00FFFF',
  
  // Woods
  wood: '#8B4513',
  oak: '#654321',
  willow: '#7C4E3E',
  
  // Leathers
  leather: '#8B4513',
  'hard-leather': '#654321',
  'studded-leather': '#434B4D',
} as const

export const getTierColor = (tier?: string): string => {
  if (!tier) return 'var(--color-primary)'
  return TIER_COLORS[tier] || 'var(--color-primary)'
}

// Lighter colors for material display overlays
export const TIER_DISPLAY_COLORS: Record<string, string> = {
  // Metals
  bronze: '#CD7F32',
  iron: '#B0B0B0',
  steel: '#C0C0C0',
  mithril: '#3D5D8F',
  adamant: '#2F4F2F',
  rune: '#4682B4',
  
  // Woods
  wood: '#DEB887',
  oak: '#BC9A6A',
  willow: '#F5DEB3',
  
  // Leathers
  leather: '#8B4513',
  'hard-leather': '#654321',
  'studded-leather': '#4A4A4A',
  
  // Special
  dragon: '#fa0000'
} as const 