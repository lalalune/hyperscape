/**
 * OSRS Item Weapon Interface
 * Weapon-specific stats for equipable weapons
 * @see https://github.com/osrsbox/osrsbox-db
 */

export type WeaponType = 'axe' | 'bow' | 'crossbow' | 'gun' | 'pickaxe' | 'polearm' | 'scythe' | 'slash sword' | 'spear' | 'spiked' | 'stab sword' | 'staff' | 'thrown' | 'whip' | 'blunt' | 'bulwark' | 'chinchompa' | 'claw' | 'salamander'

export type WeaponStance = 'accurate' | 'aggressive' | 'controlled' | 'defensive' | 'longrange' | 'rapid' | 'casting' | 'defensive casting' | 'autocast' | 'manual cast' | 'punch' | 'kick' | 'block' | 'flare' | 'lash' | 'swipe' | 'pound' | 'pummel' | 'spike' | 'impale' | 'smash' | 'jab' | 'fend' | 'bash' | 'reap' | 'chop' | 'slash' | 'lunge' | 'focus' | 'short fuse' | 'medium fuse' | 'long fuse' | 'scorch' | 'flare' | 'blaze' | 'hack' | 'stab' | 'chop-chop'

export interface ItemWeapon {
  /** Attack speed in game ticks */
  attack_speed: number

  /** Weapon type/category */
  weapon_type: WeaponType

  /** Available combat stances */
  stances: WeaponStance[]
}
