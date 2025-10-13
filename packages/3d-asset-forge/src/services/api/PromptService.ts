// Types for different prompt categories
export interface GameStylePrompt {
  name: string
  base: string
  enhanced?: string
  generation?: string
  fallback?: string
  description?: string
}

export interface AssetTypePrompt {
  name: string
  prompt: string
  placeholder: string
}

export interface AssetTypePromptsByCategory {
  avatar: {
    default: Record<string, AssetTypePrompt>
    custom: Record<string, AssetTypePrompt>
  }
  item: {
    default: Record<string, AssetTypePrompt>
    custom: Record<string, AssetTypePrompt>
  }
}

export interface MaterialPromptTemplate {
  templates: {
    runescape: string
    generic: string
    [key: string]: string
  }
  customOverrides: Record<string, string>
}

export interface GenerationPrompts {
  imageGeneration: {
    base: string
    fallbackEnhancement: string
  }
  posePrompts: {
    avatar: {
      tpose: string
    }
    armor: {
      chest: string
      generic: string
    }
  }
}

export interface GPT4EnhancementPrompts {
  systemPrompt: {
    base: string
    focusPoints: string[]
    closingInstruction: string
  }
  typeSpecific: {
    avatar: {
      critical: string
      focus: string
    }
    armor: {
      base: string
      chest: string
      positioning: string
      enhancementPrefix: string
      focus: string[]
    }
  }
}

export interface WeaponDetectionPrompts {
  basePrompt: string
  additionalGuidance: string
  restrictions: string
  responseFormat: string
}

// Response types
export interface PromptsResponse<T> {
  version: string
  default: T
  custom: T
}

class PromptServiceClass {
  private baseUrl = '/api'

  async getGameStylePrompts(): Promise<PromptsResponse<Record<string, GameStylePrompt>>> {
    const response = await fetch(`${this.baseUrl}/prompts/game-styles`)
    if (!response.ok) throw new Error('Failed to load game style prompts')
    return response.json()
  }

  async saveGameStylePrompts(prompts: PromptsResponse<Record<string, GameStylePrompt>>): Promise<void> {
    const response = await fetch(`${this.baseUrl}/prompts/game-styles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(prompts)
    })
    if (!response.ok) throw new Error('Failed to save game style prompts')
  }

  async getAssetTypePrompts(): Promise<AssetTypePromptsByCategory> {
    const response = await fetch(`${this.baseUrl}/prompts/asset-types`)
    if (!response.ok) throw new Error('Failed to load asset type prompts')
    return response.json()
  }

  async saveAssetTypePrompts(prompts: AssetTypePromptsByCategory): Promise<void> {
    const response = await fetch(`${this.baseUrl}/prompts/asset-types`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(prompts)
    })
    if (!response.ok) throw new Error('Failed to save asset type prompts')
  }

  async deleteGameStyle(styleId: string): Promise<boolean> {
    const response = await fetch(`${this.baseUrl}/prompts/game-styles/${styleId}`, {
      method: 'DELETE',
    })
    return response.ok
  }

  async deleteAssetType(typeId: string, category: 'avatar' | 'item'): Promise<boolean> {
    const response = await fetch(`${this.baseUrl}/prompts/asset-types/${typeId}?category=${category}`, {
      method: 'DELETE',
    })
    return response.ok
  }

  async getMaterialPrompts(): Promise<MaterialPromptTemplate> {
    const response = await fetch(`${this.baseUrl}/prompts/materials`)
    if (!response.ok) throw new Error('Failed to load material prompts')
    return response.json()
  }

  async saveMaterialPrompts(prompts: MaterialPromptTemplate): Promise<void> {
    const response = await fetch(`${this.baseUrl}/prompts/materials`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(prompts)
    })
    if (!response.ok) throw new Error('Failed to save material prompts')
  }

  async getGenerationPrompts(): Promise<GenerationPrompts> {
    const response = await fetch(`${this.baseUrl}/prompts/generation`)
    if (!response.ok) throw new Error('Failed to load generation prompts')
    return response.json()
  }

  async getGPT4EnhancementPrompts(): Promise<GPT4EnhancementPrompts> {
    const response = await fetch(`${this.baseUrl}/prompts/gpt4-enhancement`)
    if (!response.ok) throw new Error('Failed to load GPT-4 enhancement prompts')
    return response.json()
  }

  async getWeaponDetectionPrompts(): Promise<WeaponDetectionPrompts> {
    const response = await fetch(`${this.baseUrl}/prompts/weapon-detection`)
    if (!response.ok) throw new Error('Failed to load weapon detection prompts')
    return response.json()
  }

  // Helper to merge custom prompts with defaults
  mergePrompts<T>(defaults: T, custom: T): T {
    return { ...defaults, ...custom }
  }
}

export const PromptService = new PromptServiceClass()