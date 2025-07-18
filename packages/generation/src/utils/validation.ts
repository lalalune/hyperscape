/**
 * Validation and Testing Framework for Generated Content
 */

import { GenerationResult, GenerationRequest, AssetType } from '../types'

export interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
  score: number // 0-100 quality score
  metadata: {
    polycount?: number
    textureResolution?: string
    fileSize?: number
    hasHardpoints?: boolean
    hasMetadata?: boolean
  }
}

export interface TestScenario {
  id: string
  name: string
  description: string
  assetType: AssetType
  requirements: ValidationRequirement[]
  expectedOutputs: string[]
}

export interface ValidationRequirement {
  type: 'polycount' | 'hardpoints' | 'texture' | 'metadata' | 'file_format' | 'dimensions'
  condition: 'less_than' | 'greater_than' | 'equals' | 'contains' | 'exists'
  value: number | string | boolean
  critical: boolean // If true, failure blocks entire validation
}

/**
 * Main validation class for generated assets
 */
export class AssetValidator {
  private requirements: Map<AssetType, ValidationRequirement[]> = new Map()

  constructor() {
    this.initializeRequirements()
  }

  /**
   * Initialize validation requirements for each asset type
   */
  private initializeRequirements(): void {
    // Weapon requirements
    this.requirements.set('weapon', [
      { type: 'polycount', condition: 'less_than', value: 5000, critical: true },
      { type: 'polycount', condition: 'greater_than', value: 500, critical: true },
      { type: 'hardpoints', condition: 'exists', value: true, critical: true },
      { type: 'file_format', condition: 'equals', value: 'glb', critical: true },
      { type: 'metadata', condition: 'exists', value: true, critical: false }
    ])

    // Armor requirements
    this.requirements.set('armor', [
      { type: 'polycount', condition: 'less_than', value: 8000, critical: true },
      { type: 'polycount', condition: 'greater_than', value: 500, critical: true },
      { type: 'file_format', condition: 'equals', value: 'glb', critical: true },
      { type: 'metadata', condition: 'exists', value: true, critical: false }
    ])

    // Character requirements
    this.requirements.set('character', [
      { type: 'polycount', condition: 'less_than', value: 15000, critical: true },
      { type: 'polycount', condition: 'greater_than', value: 2000, critical: true },
      { type: 'file_format', condition: 'equals', value: 'glb', critical: true },
      { type: 'metadata', condition: 'exists', value: true, critical: false }
    ])

    // Building requirements
    this.requirements.set('building', [
      { type: 'polycount', condition: 'less_than', value: 30000, critical: true },
      { type: 'polycount', condition: 'greater_than', value: 5000, critical: true },
      { type: 'file_format', condition: 'equals', value: 'glb', critical: true },
      { type: 'metadata', condition: 'exists', value: true, critical: false }
    ])

    // Tool requirements
    this.requirements.set('tool', [
      { type: 'polycount', condition: 'less_than', value: 3000, critical: true },
      { type: 'polycount', condition: 'greater_than', value: 200, critical: true },
      { type: 'file_format', condition: 'equals', value: 'glb', critical: true },
      { type: 'metadata', condition: 'exists', value: true, critical: false }
    ])

    // Consumable requirements
    this.requirements.set('consumable', [
      { type: 'polycount', condition: 'less_than', value: 2000, critical: true },
      { type: 'polycount', condition: 'greater_than', value: 100, critical: true },
      { type: 'file_format', condition: 'equals', value: 'glb', critical: true }
    ])

    // Resource requirements
    this.requirements.set('resource', [
      { type: 'polycount', condition: 'less_than', value: 4000, critical: true },
      { type: 'polycount', condition: 'greater_than', value: 200, critical: true },
      { type: 'file_format', condition: 'equals', value: 'glb', critical: true }
    ])

    // Misc requirements
    this.requirements.set('misc', [
      { type: 'polycount', condition: 'less_than', value: 3000, critical: true },
      { type: 'polycount', condition: 'greater_than', value: 100, critical: true },
      { type: 'file_format', condition: 'equals', value: 'glb', critical: true }
    ])
  }

  /**
   * Validate a generation result
   */
  async validateGeneration(result: GenerationResult): Promise<ValidationResult> {
    const errors: string[] = []
    const warnings: string[] = []
    let score = 100
    const metadata: ValidationResult['metadata'] = {}

    // Check if generation completed successfully
    if (!result.finalAsset) {
      errors.push('Generation did not complete successfully')
      return {
        isValid: false,
        errors,
        warnings,
        score: 0,
        metadata
      }
    }

    // Get requirements for this asset type
    const requirements = this.requirements.get(result.request.type) || []

    // Validate each requirement
    for (const req of requirements) {
      const reqResult = await this.validateRequirement(result, req)
      
      if (!reqResult.passed) {
        if (req.critical) {
          errors.push(reqResult.message)
          score -= 20
        } else {
          warnings.push(reqResult.message)
          score -= 5
        }
      }
    }

    // Add metadata from validation
    if (result.remeshResult) {
      metadata.polycount = result.remeshResult.remeshedPolycount
    } else if (result.modelResult) {
      metadata.polycount = result.modelResult.polycount
    }

    metadata.hasMetadata = !!result.finalAsset.metadata
    metadata.hasHardpoints = !!result.analysisResult

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      score: Math.max(0, score),
      metadata
    }
  }

  /**
   * Validate a specific requirement
   */
  private async validateRequirement(
    result: GenerationResult, 
    requirement: ValidationRequirement
  ): Promise<{ passed: boolean; message: string }> {
    
    switch (requirement.type) {
      case 'polycount':
        const polycount = result.remeshResult?.remeshedPolycount || result.modelResult?.polycount
        if (polycount === undefined) {
          return { passed: false, message: 'No polycount information available' }
        }
        
        return this.validateCondition(
          polycount,
          requirement.condition,
          requirement.value as number,
          `Polycount ${polycount} ${requirement.condition} ${requirement.value}`
        )

      case 'hardpoints':
        const hasHardpoints = !!result.analysisResult
        return this.validateCondition(
          hasHardpoints,
          requirement.condition,
          requirement.value as boolean,
          'Hardpoint analysis'
        )

      case 'file_format':
        const format = result.finalAsset?.modelUrl.split('.').pop()?.toLowerCase()
        return this.validateCondition(
          format,
          requirement.condition,
          requirement.value as string,
          `File format ${format}`
        )

      case 'metadata':
        const hasMetadata = !!result.finalAsset?.metadata
        return this.validateCondition(
          hasMetadata,
          requirement.condition,
          requirement.value as boolean,
          'Metadata availability'
        )

      default:
        return { passed: true, message: 'Unknown requirement type' }
    }
  }

  /**
   * Validate a condition
   */
  private validateCondition(
    actual: any,
    condition: ValidationRequirement['condition'],
    expected: any,
    description: string
  ): { passed: boolean; message: string } {
    
    let passed = false
    
    switch (condition) {
      case 'less_than':
        passed = actual < expected
        break
      case 'greater_than':
        passed = actual > expected
        break
      case 'equals':
        passed = actual === expected
        break
      case 'contains':
        passed = actual && actual.includes && actual.includes(expected)
        break
      case 'exists':
        passed = expected ? !!actual : !actual
        break
    }

    const message = passed 
      ? `✓ ${description}: ${actual}`
      : `✗ ${description}: ${actual} (expected ${condition} ${expected})`

    return { passed, message }
  }
}

/**
 * Test scenarios for comprehensive validation
 */
export const TEST_SCENARIOS: TestScenario[] = [
  {
    id: 'weapon_sword_basic',
    name: 'Basic Sword Generation',
    description: 'Test generation of a simple sword with hardpoints',
    assetType: 'weapon',
    requirements: [
      { type: 'polycount', condition: 'less_than', value: 5000, critical: true },
      { type: 'hardpoints', condition: 'exists', value: true, critical: true }
    ],
    expectedOutputs: ['model.glb', 'metadata.json']
  },
  {
    id: 'armor_helmet_basic',
    name: 'Basic Helmet Generation',
    description: 'Test generation of a helmet with placement data',
    assetType: 'armor',
    requirements: [
      { type: 'polycount', condition: 'less_than', value: 8000, critical: true },
      { type: 'metadata', condition: 'exists', value: true, critical: false }
    ],
    expectedOutputs: ['model.glb', 'metadata.json']
  },
  {
    id: 'building_bank_basic',
    name: 'Basic Bank Generation',
    description: 'Test generation of a bank with functional areas',
    assetType: 'building',
    requirements: [
      { type: 'polycount', condition: 'less_than', value: 30000, critical: true },
      { type: 'metadata', condition: 'exists', value: true, critical: false }
    ],
    expectedOutputs: ['model.glb', 'metadata.json']
  },
  {
    id: 'character_goblin_basic',
    name: 'Basic Goblin Generation',
    description: 'Test generation of a goblin character with rigging',
    assetType: 'character',
    requirements: [
      { type: 'polycount', condition: 'less_than', value: 15000, critical: true },
      { type: 'metadata', condition: 'exists', value: true, critical: false }
    ],
    expectedOutputs: ['model.glb', 'metadata.json']
  }
]

/**
 * Test runner for validation scenarios
 */
export class ValidationTestRunner {
  private validator: AssetValidator

  constructor() {
    this.validator = new AssetValidator()
  }

  /**
   * Run all test scenarios
   */
  async runAllTests(
    generateFunction: (request: GenerationRequest) => Promise<GenerationResult>
  ): Promise<{ passed: number; failed: number; results: any[] }> {
    const results = []
    let passed = 0
    let failed = 0

    for (const scenario of TEST_SCENARIOS) {
      console.log(`Running test: ${scenario.name}`)
      
      try {
        // Create test request
        const request: GenerationRequest = {
          id: `test-${scenario.id}`,
          name: scenario.name,
          description: scenario.description,
          type: scenario.assetType,
          style: 'realistic'
        }

        // Generate asset
        const result = await generateFunction(request)
        
        // Validate result
        const validation = await this.validator.validateGeneration(result)
        
        if (validation.isValid) {
          passed++
          console.log(`✓ ${scenario.name} - PASSED (Score: ${validation.score})`)
        } else {
          failed++
          console.log(`✗ ${scenario.name} - FAILED`)
          console.log(`  Errors: ${validation.errors.join(', ')}`)
        }

        results.push({
          scenario: scenario.name,
          passed: validation.isValid,
          score: validation.score,
          errors: validation.errors,
          warnings: validation.warnings
        })

      } catch (error) {
        failed++
        console.log(`✗ ${scenario.name} - ERROR: ${error}`)
        results.push({
          scenario: scenario.name,
          passed: false,
          score: 0,
          errors: [error instanceof Error ? error.message : String(error)],
          warnings: []
        })
      }
    }

    return { passed, failed, results }
  }
}

/**
 * Human review checklist generator
 */
export class HumanReviewGenerator {
  /**
   * Generate review checklist for an asset
   */
  generateChecklist(result: GenerationResult): string[] {
    const checklist = []
    const assetType = result.request.type

    // Common checks
    checklist.push('□ Model loads correctly in 3D viewer')
    checklist.push('□ Textures are applied and display properly')
    checklist.push('□ Overall visual quality meets game standards')
    checklist.push('□ Polycount is appropriate for game performance')

    // Asset-specific checks
    switch (assetType) {
      case 'weapon':
        checklist.push('□ Weapon grip position is correct')
        checklist.push('□ Weapon orientation matches expected usage')
        checklist.push('□ Blade/head is properly aligned')
        checklist.push('□ Scale is appropriate for character hands')
        break
        
      case 'armor':
        checklist.push('□ Armor piece fits expected body part')
        checklist.push('□ Attachment points are logical')
        checklist.push('□ No clipping issues with character model')
        checklist.push('□ Material looks appropriate for armor type')
        break
        
      case 'building':
        checklist.push('□ Entry points are clearly defined')
        checklist.push('□ Interior space is functional')
        checklist.push('□ NPC placement positions make sense')
        checklist.push('□ Building style fits game aesthetic')
        break
        
      case 'character':
        checklist.push('□ Character proportions are correct')
        checklist.push('□ Rigging points are positioned properly')
        checklist.push('□ Facial features are appropriate')
        checklist.push('□ Equipment attachment points exist')
        break
    }

    // Tier-specific checks
    if (result.request.metadata?.tier) {
      checklist.push(`□ Material tier (${result.request.metadata.tier}) is visually distinct`)
      checklist.push('□ Tier progression feels logical')
    }

    return checklist
  }

  /**
   * Generate review questions for quality assessment
   */
  generateReviewQuestions(result: GenerationResult): string[] {
    return [
      'Does this asset look like it belongs in a RuneScape-style RPG?',
      'Would players immediately understand what this item is?',
      'Is the visual quality consistent with other game assets?',
      'Are there any obvious visual artifacts or errors?',
      'Does the material tier feel appropriately valuable?',
      'Would you be excited to obtain this item in-game?'
    ]
  }
}