/**
 * Manifest Service
 * Writes Hyperscape-compatible manifests for generated assets
 * Converts Forge metadata into game-ready item/mob/avatar definitions
 */

import fs from 'fs/promises'
import path from 'path'

export class ManifestService {
  constructor(assetsDir) {
    this.assetsDir = assetsDir
    this.manifestsDir = path.join(assetsDir, 'manifests')
  }

  /**
   * Write item manifest entry for a generated asset
   */
  async writeItemManifest(assetId, metadata, config) {
    await fs.mkdir(this.manifestsDir, { recursive: true })
    
    const manifestPath = path.join(this.manifestsDir, 'items.json')
    
    // Load existing manifest or create new
    let items = []
    try {
      const existing = await fs.readFile(manifestPath, 'utf-8')
      items = JSON.parse(existing)
    } catch (_e) {
      // File doesn't exist yet
    }
    
    // Remove existing entry for this assetId if present (update scenario)
    items = items.filter(item => item.id !== assetId)
    
    // Map Forge metadata to Hyperscape Item schema
    const itemType = this.mapTypeToItemType(config.type, config.subtype)
    const weaponType = this.mapToWeaponType(config.subtype)
    const equipSlot = this.mapToEquipSlot(config.subtype, config.type)
    const attackType = this.mapToAttackType(weaponType, config.type)
    
    // Determine model path - prefer rigged model for avatars
    const modelFileName = metadata.riggedModelPath || `${assetId}.glb`
    const modelPath = `/world-assets/forge/${assetId}/${modelFileName}`
    const iconPath = `/world-assets/forge/${assetId}/concept-art.png`
    
    const itemEntry = {
      id: assetId,
      name: config.name || assetId,
      type: itemType,
      quantity: 1,
      stackable: itemType === 'resource' || itemType === 'consumable' || itemType === 'currency',
      maxStackSize: itemType === 'currency' ? 2147483647 : (itemType === 'resource' || itemType === 'consumable' ? 100 : 1),
      value: this.estimateValue(config.subtype, metadata.materialPreset),
      weight: this.estimateWeight(config.type, config.subtype),
      equipSlot: equipSlot,
      weaponType: weaponType,
      equipable: !!equipSlot,
      attackType: attackType,
      description: config.description || `A ${config.name || assetId}`,
      examine: config.description || `A ${config.name || assetId}`,
      tradeable: true,
      rarity: metadata.materialPreset?.tier === 3 ? 'rare' : (metadata.materialPreset?.tier === 2 ? 'uncommon' : 'common'),
      modelPath: modelPath,
      iconPath: iconPath,
      healAmount: itemType === 'consumable' ? this.estimateHealAmount(config.subtype) : 0,
      stats: this.estimateStats(config.subtype, metadata.materialPreset),
      bonuses: this.estimateBonuses(config.subtype, metadata.materialPreset),
      requirements: this.estimateRequirements(metadata.materialPreset)
    }
    
    items.push(itemEntry)
    
    // Write back to manifest
    await fs.writeFile(manifestPath, JSON.stringify(items, null, 2))
    
    console.log(`[ManifestService] Added ${assetId} to items.json`)
  }

  /**
   * Write mob manifest entry for a generated character
   */
  async writeMobManifest(assetId, metadata, config) {
    await fs.mkdir(this.manifestsDir, { recursive: true })
    
    const manifestPath = path.join(this.manifestsDir, 'mobs.json')
    
    let mobs = []
    try {
      const existing = await fs.readFile(manifestPath, 'utf-8')
      mobs = JSON.parse(existing)
    } catch (_e) {}
    
    mobs = mobs.filter(mob => mob.id !== assetId)
    
    const modelPath = `/world-assets/forge/${assetId}/${metadata.riggedModelPath || `${assetId}.glb`}`
    const animations = metadata.animations?.basic || {}
    
    const mobEntry = {
      id: assetId,
      name: config.name || assetId,
      description: config.description || `A ${config.name}`,
      mobType: 'humanoid',
      type: 'humanoid',
      difficultyLevel: 1,
      stats: {
        level: 2,
        health: 10,
        attack: 1,
        strength: 1,
        defense: 1,
        ranged: 1,
        constitution: 10
      },
      behavior: {
        aggressive: true,
        aggroRange: 5,
        chaseRange: 15,
        returnToSpawn: true,
        ignoreLowLevelPlayers: false,
        levelThreshold: 1
      },
      drops: [
        { itemId: 'coins', quantity: 5, chance: 1.0, isGuaranteed: true }
      ],
      spawnBiomes: ['plains'],
      modelPath: modelPath,
      animationSet: {
        idle: animations.tpose ? `/world-assets/forge/${assetId}/${animations.tpose}` : undefined,
        walk: animations.walking ? `/world-assets/forge/${assetId}/${animations.walking}` : undefined,
        attack: animations.walking ? `/world-assets/forge/${assetId}/${animations.walking}` : undefined,
        death: animations.walking ? `/world-assets/forge/${assetId}/${animations.walking}` : undefined
      },
      respawnTime: 900000,
      xpReward: 10,
      health: 10,
      maxHealth: 10,
      level: 2
    }
    
    mobs.push(mobEntry)
    await fs.writeFile(manifestPath, JSON.stringify(mobs, null, 2))
    
    console.log(`[ManifestService] Added ${assetId} to mobs.json`)
  }

  /**
   * Write avatar manifest entry for player-usable characters
   */
  async writeAvatarManifest(assetId, metadata, config) {
    await fs.mkdir(this.manifestsDir, { recursive: true })
    
    const manifestPath = path.join(this.manifestsDir, 'avatars.json')
    
    let avatars = []
    try {
      const existing = await fs.readFile(manifestPath, 'utf-8')
      avatars = JSON.parse(existing)
    } catch (_e) {}
    
    avatars = avatars.filter(av => av.id !== assetId)
    
    const modelPath = `/world-assets/forge/${assetId}/${metadata.riggedModelPath || `${assetId}.glb`}`
    const animations = metadata.animations?.basic || {}
    
    const avatarEntry = {
      id: assetId,
      name: config.name || assetId,
      description: config.description || 'Playable character',
      type: 'character',
      isRigged: metadata.isRigged || false,
      characterHeight: metadata.characterHeight || 1.83,
      modelPath: modelPath,
      animations: {
        idle: animations.tpose ? `/world-assets/forge/${assetId}/${animations.tpose}` : undefined,
        walk: animations.walking ? `/world-assets/forge/${assetId}/${animations.walking}` : undefined,
        run: animations.running ? `/world-assets/forge/${assetId}/${animations.running}` : undefined
      }
    }
    
    avatars.push(avatarEntry)
    await fs.writeFile(manifestPath, JSON.stringify(avatars, null, 2))
    
    console.log(`[ManifestService] Added ${assetId} to avatars.json`)
  }

  // Mapping helpers (use Hyperscape enums)
  mapTypeToItemType(type, subtype) {
    if (type === 'weapon') return 'weapon'
    if (type === 'armor') return 'armor'
    if (type === 'tool') return 'tool'
    if (type === 'resource') return 'resource'
    if (type === 'consumable') return 'consumable'
    if (type === 'currency') return 'currency'
    return 'misc'
  }

  mapToWeaponType(subtype) {
    if (!subtype) return 'NONE'
    const lower = subtype.toLowerCase()
    if (lower.includes('sword')) return 'SWORD'
    if (lower.includes('bow')) return 'BOW'
    if (lower.includes('shield')) return 'SHIELD'
    if (lower.includes('axe')) return 'AXE'
    if (lower.includes('mace')) return 'MACE'
    if (lower.includes('spear')) return 'SPEAR'
    if (lower.includes('staff')) return 'STAFF'
    if (lower.includes('dagger')) return 'DAGGER'
    return 'NONE'
  }

  mapToEquipSlot(subtype, type) {
    if (!subtype) return null
    const lower = subtype.toLowerCase()
    if (type === 'weapon' && lower.includes('shield')) return 'shield'
    if (type === 'weapon') return 'weapon'
    if (lower.includes('helmet') || lower.includes('head')) return 'helmet'
    if (lower.includes('body') || lower.includes('chest') || lower.includes('torso')) return 'body'
    if (lower.includes('legs') || lower.includes('leg')) return 'legs'
    return null
  }

  mapToAttackType(weaponType, type) {
    if (type !== 'weapon' || weaponType === 'NONE') return null
    if (weaponType === 'BOW') return 'RANGED'
    return 'MELEE'
  }

  estimateValue(subtype, materialPreset) {
    const tier = materialPreset?.tier || 1
    const baseValues = { 1: 50, 2: 200, 3: 800 }
    return baseValues[tier] || 50
  }

  estimateWeight(type, subtype) {
    if (type === 'armor') return 3
    if (type === 'weapon') {
      if (subtype?.toLowerCase().includes('shield')) return 3
      return 2
    }
    return 1
  }

  estimateHealAmount(subtype) {
    return 5 // Default heal for consumables
  }

  estimateStats(subtype, materialPreset) {
    return { attack: 0, defense: 0, strength: 0 }
  }

  estimateBonuses(subtype, materialPreset) {
    const tier = materialPreset?.tier || 1
    const lower = subtype?.toLowerCase() || ''
    
    if (lower.includes('sword')) {
      const bonuses = { 1: { attack: 4, strength: 3 }, 2: { attack: 12, strength: 10 }, 3: { attack: 25, strength: 22 } }
      return { attack: bonuses[tier].attack, strength: bonuses[tier].strength, defense: 0, ranged: 0 }
    }
    if (lower.includes('bow')) {
      const bonuses = { 1: 5, 2: 15, 3: 30 }
      return { attack: 0, strength: 0, defense: 0, ranged: bonuses[tier] }
    }
    if (lower.includes('shield')) {
      const bonuses = { 1: 5, 2: 15, 3: 30 }
      return { attack: 0, strength: 0, defense: bonuses[tier], ranged: 0 }
    }
    if (lower.includes('helmet')) {
      const bonuses = { 1: 3, 2: 8, 3: 18 }
      return { attack: 0, strength: 0, defense: bonuses[tier], ranged: 0 }
    }
    if (lower.includes('body')) {
      const bonuses = { 1: 6, 2: 16, 3: 35 }
      return { attack: 0, strength: 0, defense: bonuses[tier], ranged: 0 }
    }
    if (lower.includes('legs')) {
      const bonuses = { 1: 4, 2: 12, 3: 25 }
      return { attack: 0, strength: 0, defense: bonuses[tier], ranged: 0 }
    }
    
    return { attack: 0, strength: 0, defense: 0, ranged: 0 }
  }

  estimateRequirements(materialPreset) {
    const tier = materialPreset?.tier || 1
    const levels = { 1: 1, 2: 10, 3: 20 }
    return {
      level: levels[tier] || 1,
      skills: {}
    }
  }
}


