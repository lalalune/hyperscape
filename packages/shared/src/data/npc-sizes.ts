/**
 * NPC Size Manifest
 * Defines collision sizes for NPCs used in range calculations.
 * Most NPCs are 1x1 tiles. Bosses occupy larger footprints.
 */

export interface NPCSize {
  width: number;
  depth: number;
}

export const NPC_SIZES: Record<string, NPCSize> = {
  // 1x1 (default for unlisted NPCs)
  goblin: { width: 1, depth: 1 },
  cow: { width: 1, depth: 1 },
  chicken: { width: 1, depth: 1 },
  rat: { width: 1, depth: 1 },
  spider: { width: 1, depth: 1 },
  skeleton: { width: 1, depth: 1 },
  zombie: { width: 1, depth: 1 },
  imp: { width: 1, depth: 1 },

  // 2x2
  general_graardor: { width: 2, depth: 2 },
  kril_tsutsaroth: { width: 2, depth: 2 },
  commander_zilyana: { width: 2, depth: 2 },
  kreearra: { width: 2, depth: 2 },
  giant_mole: { width: 2, depth: 2 },
  kalphite_queen: { width: 2, depth: 2 },

  // 3x3
  corporeal_beast: { width: 3, depth: 3 },
  cerberus: { width: 3, depth: 3 },
  king_black_dragon: { width: 3, depth: 3 },

  // 4x4
  vorkath: { width: 4, depth: 4 },

  // 5x5
  olm_head: { width: 5, depth: 5 },
};
