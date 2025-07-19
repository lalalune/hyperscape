import { GDDAsset } from '../types'

interface PromptTemplate {
  base: string
  tiers: Record<string, string>
}

export class AssetPrompts {
  private static prompts: Record<string, PromptTemplate> = {
    // Weapons - specific orientations
    sword: {
      base: "A medieval {tier} sword, blade pointing straight up, handle at bottom, centered on white background, clean simple design, no extras, game asset style",
      tiers: {
        bronze: "bronze metal with worn leather grip, rustic patina finish",
        steel: "polished steel blade with dark leather wrapped handle, professional craftsmanship",
        mithril: "gleaming silver-white mithril blade with ornate crossguard, magical shimmer"
      }
    },
    
    bow: {
      base: "A {tier} bow, positioned vertically with string on the right side, bow grip in center, clean white background, no arrows, game asset style",
      tiers: {
        wood: "simple wooden longbow with natural wood grain, basic string",
        oak: "sturdy oak longbow with darker wood grain, reinforced with metal bands",
        willow: "elegant willow longbow with smooth finish, silver-wrapped grip"
      }
    },
    
    shield: {
      base: "A {tier} shield viewed straight on, centered, round or kite shape, clean white background, no straps visible, game asset style",
      tiers: {
        bronze: "bronze shield with simple boss, weathered surface with patina",
        steel: "polished steel shield with reinforced rim, professional craftsmanship",
        mithril: "gleaming mithril shield with intricate boss, magical shimmer"
      }
    },
    
    // Armor - clean pieces only
    helmet: {
      base: "A {tier} {armor_type} helmet, front view, clean white background, no head or mannequin, just the helmet, game asset style",
      tiers: {
        leather: "brown leather helmet with simple stitching",
        'hard-leather': "dark brown hardened leather helmet with metal studs",
        'studded-leather': "leather helmet reinforced with metal studs and bands",
        bronze: "bronze helmet with simple design and ventilation holes",
        steel: "polished steel helmet with face guard and reinforced design",
        mithril: "gleaming mithril helmet with intricate engravings"
      }
    },
    
    body: {
      base: "A {tier} {armor_type} body armor, front view, clean white background, no mannequin or stand, just the armor piece, game asset style",
      tiers: {
        leather: "brown leather vest with simple stitching and lacing",
        'hard-leather': "dark brown hardened leather cuirass with metal reinforcement",
        'studded-leather': "leather armor reinforced with metal studs in patterns",
        bronze: "bronze plate armor with simple design and leather straps",
        steel: "polished steel plate armor with articulated joints",
        mithril: "gleaming mithril plate armor with intricate magical engravings"
      }
    },
    
    legs: {
      base: "A {tier} {armor_type} leg armor, front view, clean white background, no mannequin or stand, just the leg pieces, game asset style",
      tiers: {
        leather: "brown leather leg guards with simple stitching",
        'hard-leather': "dark brown hardened leather leg armor with metal buckles",
        'studded-leather': "leather leg armor reinforced with metal studs",
        bronze: "bronze leg plates with simple design and leather straps",
        steel: "polished steel leg armor with articulated knee guards",
        mithril: "gleaming mithril leg armor with intricate magical patterns"
      }
    },
    
    // Tools
    hatchet: {
      base: "A bronze hatchet, handle pointing down, axe head at top, centered on white background, simple woodcutting tool, game asset style",
      tiers: {
        bronze: "bronze axe head with wooden handle, utilitarian design"
      }
    },
    
    'fishing-rod': {
      base: "A fishing rod, positioned vertically with handle at bottom, line guides visible, clean white background, simple design, game asset style",
      tiers: {
        basic: "simple wooden fishing rod with basic reel and line guides"
      }
    },
    
    'fishing_rod': {
      base: "A fishing rod, positioned vertically with handle at bottom, line guides visible, clean white background, simple design, game asset style",
      tiers: {
        basic: "simple wooden fishing rod with basic reel and line guides"
      }
    },
    
    tinderbox: {
      base: "A small tinderbox, rectangular metal container, viewed from slight angle, clean white background, medieval fire-starting tool, game asset style",
      tiers: {
        basic: "simple metal tinderbox with flint and steel, weathered surface"
      }
    },
    
    // Characters - clean references
    goblin: {
      base: "A small green goblin, standing upright, arms at sides, front view, clean white background, simple medieval fantasy design, game character style",
      tiers: {
        basic: "small green-skinned goblin with simple clothing and fierce expression"
      }
    },
    
    'desperate-bandit': {
      base: "A human bandit, standing upright, arms at sides, front view, clean white background, medieval fantasy design, game character style",
      tiers: {
        basic: "desperate human bandit with tattered clothing and crude weapons"
      }
    },
    
    barbarian: {
      base: "A barbarian warrior, standing upright, arms at sides, front view, clean white background, primitive warrior design, game character style",
      tiers: {
        basic: "wild barbarian with fur clothing and tribal weapons"
      }
    },
    
    hobgoblin: {
      base: "A hobgoblin warrior, standing upright, arms at sides, front view, clean white background, militaristic goblin design, game character style",
      tiers: {
        basic: "large hobgoblin with military gear and disciplined stance"
      }
    },
    
    'corrupted-guard': {
      base: "A corrupted guard, standing upright, arms at sides, front view, clean white background, fallen soldier design, game character style",
      tiers: {
        basic: "corrupted soldier with tarnished armor and dark aura"
      }
    },
    
    'dark-warrior': {
      base: "A dark warrior, standing upright, arms at sides, front view, clean white background, shadow knight design, game character style",
      tiers: {
        basic: "dark warrior with blackened armor and menacing presence"
      }
    },
    
    'black-knight': {
      base: "A black knight, standing upright, arms at sides, front view, clean white background, elite dark warrior design, game character style",
      tiers: {
        basic: "imposing black knight with pitch-black armor and commanding presence"
      }
    },
    
    'ice-warrior': {
      base: "An ice warrior, standing upright, arms at sides, front view, clean white background, frozen champion design, game character style",
      tiers: {
        basic: "frozen warrior with ice-covered armor and frost effects"
      }
    },
    
    'dark-ranger': {
      base: "A dark ranger, standing upright, arms at sides, front view, clean white background, shadow archer design, game character style",
      tiers: {
        basic: "dark ranger with longbow and shadowy cloak"
      }
    },
    
    biped: {
      base: "A generic humanoid character, standing upright, arms at sides, front view, clean white background, simple medieval fantasy design, game character style",
      tiers: {
        basic: "basic humanoid character with simple medieval clothing"
      }
    },
    
    // Resources
    logs: {
      base: "A bundle of wooden logs, stacked neatly, brown wood texture, clean white background, simple resource item, game asset style",
      tiers: {
        wood: "bundle of fresh cut logs with bark texture"
      }
    },
    
    'raw-fish': {
      base: "A raw fish, lying flat, silver scales, clean white background, simple food item, game asset style",
      tiers: {
        basic: "fresh raw fish with silver scales and simple design"
      }
    },
    
    'cooked-fish': {
      base: "A cooked fish, lying flat, golden-brown color, clean white background, simple food item, game asset style",
      tiers: {
        basic: "cooked fish with golden-brown finish and appetizing appearance"
      }
    },
    
    arrows: {
      base: "A bundle of arrows, tips pointing up, clean white background, simple medieval arrows, game asset style",
      tiers: {
        basic: "bundle of wooden arrows with simple metal tips and feather fletching"
      }
    },
    
    coins: {
      base: "A pile of gold coins, clean white background, simple currency item, game asset style",
      tiers: {
        basic: "small pile of golden coins with simple design"
      }
    },
    
    currency: {
      base: "A pile of gold coins, clean white background, simple currency item, game asset style",
      tiers: {
        basic: "small pile of golden coins with simple design"
      }
    },
    
    // Buildings
    bank: {
      base: "A medieval bank building, front view, clean white background, stone construction, game building style",
      tiers: {
        basic: "stone bank building with secure vault doors and medieval architecture"
      }
    },
    
    'general-store': {
      base: "A medieval general store, front view, clean white background, wooden construction, game building style",
      tiers: {
        basic: "wooden general store with merchant signs and medieval shop design"
      }
    }
  }
  
  static getPrompt(asset: GDDAsset): string | null {
    // Try multiple lookup strategies
    const gameId = asset.metadata?.gameId
    const subtype = asset.subtype
    const type = asset.type
    const tier = asset.metadata?.tier || 'basic'
    
    // Strategy 1: Try gameId as-is (with underscore to hyphen conversion)
    let baseType = gameId ? gameId.toLowerCase().replace(/_/g, '-') : null
    let template = baseType ? this.prompts[baseType] : null
    
    // Strategy 2: Try subtype
    if (!template && subtype) {
      baseType = subtype.toLowerCase().replace(/\s+/g, '-')
      template = this.prompts[baseType]
    }
    
    // Strategy 3: Try type
    if (!template && type) {
      baseType = type.toLowerCase().replace(/\s+/g, '-')
      template = this.prompts[baseType]
    }
    
    // Strategy 4: Try extracting base type from gameId (e.g., steel_sword -> sword)
    if (!template && gameId) {
      const parts = gameId.split('_')
      if (parts.length > 1) {
        baseType = parts[parts.length - 1].toLowerCase() // Use last part (e.g., sword from steel_sword)
        template = this.prompts[baseType]
      }
    }
    
    if (!template) {
      return null
    }
    
    // Build the prompt
    const armorType = tier.includes('leather') ? 'leather' : 'metal'
    let prompt = template.base
      .replace('{tier}', tier)
      .replace('{armor_type}', armorType)
    
    // Add tier-specific details
    if (template.tiers[tier]) {
      prompt += `, ${template.tiers[tier]}`
    }
    
    return prompt
  }
  
  static getSupportedTypes(): string[] {
    return Object.keys(this.prompts)
  }
  
  static hasSupportFor(assetType: string): boolean {
    const baseType = assetType.toLowerCase().replace(/\s+/g, '-')
    return baseType in this.prompts
  }
}