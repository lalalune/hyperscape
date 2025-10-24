/**
 * API Validation Schemas
 *
 * Centralized validation schemas for all API endpoints.
 * Used by input-validation middleware.
 */

import {
  validateString,
  validateNumber,
  validateEnum,
  validateArray,
  validateBoolean,
  validateObject
} from './input-validation.mjs'

// ============================================================================
// AUTHENTICATION & USER SCHEMAS
// ============================================================================

export const loginSchema = {
  privyToken: (value) => validateString(value, {
    field: 'privyToken',
    minLength: 10,
    maxLength: 2000,
    required: true
  }),
  inviteCode: (value) => validateString(value, {
    field: 'inviteCode',
    minLength: 8,
    maxLength: 8,
    pattern: /^[A-Z0-9]{8}$/,
    required: false
  })
}

export const updateProfileSchema = {
  name: (value) => validateString(value, {
    field: 'name',
    minLength: 2,
    maxLength: 100,
    required: false
  }),
  avatar: (value) => validateString(value, {
    field: 'avatar',
    maxLength: 500,
    required: false,
    allowEmpty: true
  })
}

export const deleteAccountSchema = {
  confirmationCode: (value) => validateString(value, {
    field: 'confirmationCode',
    pattern: /^DELETE_MY_ACCOUNT$/,
    required: true
  })
}

// ============================================================================
// PROJECT SCHEMAS
// ============================================================================

export const createProjectSchema = {
  name: (value) => validateString(value, {
    field: 'name',
    minLength: 3,
    maxLength: 100,
    required: true
  }),
  description: (value) => validateString(value, {
    field: 'description',
    maxLength: 1000,
    required: false,
    allowEmpty: true
  }),
  type: (value) => validateEnum(value, ['character', 'weapon', 'armor', 'item', 'environment', 'mixed'], {
    field: 'type',
    required: true
  }),
  gameStyle: (value) => validateString(value, {
    field: 'gameStyle',
    maxLength: 50,
    required: false
  }),
  gameType: (value) => validateString(value, {
    field: 'gameType',
    maxLength: 50,
    required: false
  }),
  artDirection: (value) => validateString(value, {
    field: 'artDirection',
    maxLength: 500,
    required: false
  }),
  tags: (value) => validateArray(value, {
    field: 'tags',
    maxLength: 20,
    required: false,
    itemValidator: (item) => validateString(item, {
      field: 'tag',
      maxLength: 30,
      required: true
    })
  }),
  thumbnail: (value) => validateString(value, {
    field: 'thumbnail',
    maxLength: 500,
    required: false
  }),
  isPublic: (value) => validateBoolean(value, {
    field: 'isPublic',
    required: false,
    default: false
  })
}

export const updateProjectSchema = {
  name: (value) => validateString(value, {
    field: 'name',
    minLength: 3,
    maxLength: 100,
    required: false
  }),
  description: (value) => validateString(value, {
    field: 'description',
    maxLength: 1000,
    required: false,
    allowEmpty: true
  }),
  gameStyle: (value) => validateString(value, {
    field: 'gameStyle',
    maxLength: 50,
    required: false
  }),
  gameType: (value) => validateString(value, {
    field: 'gameType',
    maxLength: 50,
    required: false
  }),
  artDirection: (value) => validateString(value, {
    field: 'artDirection',
    maxLength: 500,
    required: false
  }),
  tags: (value) => validateArray(value, {
    field: 'tags',
    maxLength: 20,
    required: false
  }),
  thumbnail: (value) => validateString(value, {
    field: 'thumbnail',
    maxLength: 500,
    required: false
  }),
  isPublic: (value) => validateBoolean(value, {
    field: 'isPublic',
    required: false
  })
}

// ============================================================================
// TEAM SCHEMAS
// ============================================================================

export const createTeamSchema = {
  name: (value) => validateString(value, {
    field: 'name',
    minLength: 3,
    maxLength: 100,
    required: true
  }),
  description: (value) => validateString(value, {
    field: 'description',
    maxLength: 500,
    required: false,
    allowEmpty: true
  }),
  maxMembers: (value) => validateNumber(value, {
    field: 'maxMembers',
    min: 2,
    max: 100,
    integer: true,
    required: false,
    default: 10
  })
}

export const updateTeamSchema = {
  name: (value) => validateString(value, {
    field: 'name',
    minLength: 3,
    maxLength: 100,
    required: false
  }),
  description: (value) => validateString(value, {
    field: 'description',
    maxLength: 500,
    required: false
  }),
  maxMembers: (value) => validateNumber(value, {
    field: 'maxMembers',
    min: 2,
    max: 100,
    integer: true,
    required: false
  })
}

export const joinTeamSchema = {
  inviteCode: (value) => validateString(value, {
    field: 'inviteCode',
    minLength: 8,
    maxLength: 8,
    pattern: /^[A-Z0-9]{8}$/,
    required: true
  })
}

export const transferOwnershipSchema = {
  newOwnerId: (value) => validateString(value, {
    field: 'newOwnerId',
    pattern: /^user_[a-f0-9]{32}$/,
    required: true
  })
}

// ============================================================================
// VOICE GENERATION SCHEMAS
// ============================================================================

export const generateVoiceSchema = {
  text: (value) => validateString(value, {
    field: 'text',
    minLength: 1,
    maxLength: 5000,
    required: true
  }),
  voiceId: (value) => validateString(value, {
    field: 'voiceId',
    minLength: 1,
    maxLength: 100,
    required: true
  }),
  modelId: (value) => validateString(value, {
    field: 'modelId',
    maxLength: 100,
    required: false
  }),
  outputFormat: (value) => validateString(value, {
    field: 'outputFormat',
    maxLength: 50,
    required: false
  }),
  stability: (value) => validateNumber(value, {
    field: 'stability',
    min: 0,
    max: 1,
    required: false
  }),
  similarityBoost: (value) => validateNumber(value, {
    field: 'similarityBoost',
    min: 0,
    max: 1,
    required: false
  }),
  style: (value) => validateNumber(value, {
    field: 'style',
    min: 0,
    max: 1,
    required: false
  }),
  useSpeakerBoost: (value) => validateBoolean(value, {
    field: 'useSpeakerBoost',
    required: false
  })
}

export const batchVoiceSchema = {
  npcId: (value) => validateString(value, {
    field: 'npcId',
    minLength: 1,
    maxLength: 100,
    required: true
  }),
  dialogueNodes: (value) => validateArray(value, {
    field: 'dialogueNodes',
    minLength: 1,
    maxLength: 100,
    required: true,
    itemValidator: (node, index) => {
      if (!node.id || typeof node.id !== 'string') {
        throw new Error(`Node at index ${index} missing "id"`)
      }
      if (!node.text || typeof node.text !== 'string' || node.text.trim() === '') {
        throw new Error(`Node at index ${index} missing "text"`)
      }
      if (node.text.length > 5000) {
        throw new Error(`Node at index ${index} text too long (max 5000 characters)`)
      }
      return node
    }
  }),
  voiceId: (value) => validateString(value, {
    field: 'voiceId',
    minLength: 1,
    maxLength: 100,
    required: true
  }),
  settings: (value) => validateObject(value, {
    field: 'settings',
    required: false,
    default: {}
  })
}

export const voiceEstimateSchema = {
  characterCount: (value) => validateNumber(value, {
    field: 'characterCount',
    min: 1,
    max: 1000000,
    integer: true,
    required: true
  }),
  modelId: (value) => validateString(value, {
    field: 'modelId',
    maxLength: 100,
    required: false
  })
}

// ============================================================================
// VOICE MANIFEST SCHEMAS
// ============================================================================

export const assignVoiceSchema = {
  manifestType: (value) => validateEnum(value, ['npcs', 'mobs'], {
    field: 'manifestType',
    required: true
  }),
  entityId: (value) => validateString(value, {
    field: 'entityId',
    minLength: 1,
    maxLength: 100,
    required: true
  }),
  entityName: (value) => validateString(value, {
    field: 'entityName',
    maxLength: 200,
    required: false
  }),
  voiceId: (value) => validateString(value, {
    field: 'voiceId',
    minLength: 1,
    maxLength: 100,
    required: true
  }),
  voiceName: (value) => validateString(value, {
    field: 'voiceName',
    maxLength: 200,
    required: false
  }),
  settings: (value) => validateObject(value, {
    field: 'settings',
    required: true
  })
}

export const bulkAssignVoiceSchema = {
  assignments: (value) => validateArray(value, {
    field: 'assignments',
    minLength: 1,
    maxLength: 100,
    required: true,
    itemValidator: (assignment, index) => {
      if (!assignment.manifestType || !['npcs', 'mobs'].includes(assignment.manifestType)) {
        throw new Error(`Assignment at index ${index} has invalid manifestType`)
      }
      if (!assignment.entityId) {
        throw new Error(`Assignment at index ${index} missing entityId`)
      }
      if (!assignment.voiceId) {
        throw new Error(`Assignment at index ${index} missing voiceId`)
      }
      if (!assignment.settings) {
        throw new Error(`Assignment at index ${index} missing settings`)
      }
      return assignment
    }
  })
}

export const generateSampleDialogueSchema = {
  manifestType: (value) => validateEnum(value, ['npcs', 'mobs'], {
    field: 'manifestType',
    required: true
  }),
  entityId: (value) => validateString(value, {
    field: 'entityId',
    minLength: 1,
    maxLength: 100,
    required: true
  }),
  entityType: (value) => validateString(value, {
    field: 'entityType',
    minLength: 1,
    maxLength: 50,
    required: true
  }),
  count: (value) => validateNumber(value, {
    field: 'count',
    min: 1,
    max: 10,
    integer: true,
    required: false,
    default: 3
  })
}

// ============================================================================
// CONTENT GENERATION SCHEMAS
// ============================================================================

export const generateQuestSchema = {
  questType: (value) => validateString(value, {
    field: 'questType',
    minLength: 1,
    maxLength: 100,
    required: true
  }),
  prompt: (value) => validateString(value, {
    field: 'prompt',
    minLength: 1,
    maxLength: 5000,
    required: true
  }),
  context: (value) => validateString(value, {
    field: 'context',
    maxLength: 10000,
    required: false
  }),
  difficulty: (value) => validateString(value, {
    field: 'difficulty',
    maxLength: 50,
    required: false
  }),
  model: (value) => validateString(value, {
    field: 'model',
    maxLength: 100,
    required: false
  })
}

// ============================================================================
// ADMIN SCHEMAS
// ============================================================================

export const addToWhitelistSchema = {
  walletAddress: (value) => validateString(value, {
    field: 'walletAddress',
    pattern: /^0x[a-fA-F0-9]{40}$/,
    required: true
  }),
  reason: (value) => validateString(value, {
    field: 'reason',
    maxLength: 500,
    required: false
  }),
  expiresAt: (value) => validateString(value, {
    field: 'expiresAt',
    required: false
  })
}

export const removeFromWhitelistSchema = {
  walletAddress: (value) => validateString(value, {
    field: 'walletAddress',
    pattern: /^0x[a-fA-F0-9]{40}$/,
    required: true
  })
}

// ============================================================================
// ASSET GENERATION SCHEMAS
// ============================================================================

export const saveSpriteSchema = {
  sprites: (value) => validateArray(value, {
    field: 'sprites',
    minLength: 1,
    maxLength: 360,
    required: true,
    itemValidator: (sprite) => {
      if (typeof sprite.angle !== 'number') {
        throw new Error('Sprite missing "angle" field')
      }
      if (!sprite.imageData || typeof sprite.imageData !== 'string') {
        throw new Error('Sprite missing "imageData" field')
      }
      return sprite
    }
  }),
  config: (value) => validateObject(value, {
    field: 'config',
    required: false,
    default: {}
  })
}

export const retextureSchema = {
  baseAssetId: (value) => validateString(value, {
    field: 'baseAssetId',
    pattern: /^[a-zA-Z0-9_-]+$/,
    maxLength: 100,
    required: true
  }),
  materialPreset: (value) => validateString(value, {
    field: 'materialPreset',
    minLength: 1,
    maxLength: 100,
    required: true
  }),
  outputName: (value) => validateString(value, {
    field: 'outputName',
    maxLength: 100,
    required: false
  })
}

export const startPipelineSchema = {
  name: (value) => validateString(value, {
    field: 'name',
    minLength: 1,
    maxLength: 200,
    required: true
  }),
  type: (value) => validateString(value, {
    field: 'type',
    minLength: 1,
    maxLength: 50,
    required: true
  }),
  subtype: (value) => validateString(value, {
    field: 'subtype',
    minLength: 1,
    maxLength: 50,
    required: true
  })
}

// ============================================================================
// EXPORT ALL SCHEMAS
// ============================================================================

export default {
  // Auth & User
  loginSchema,
  updateProfileSchema,
  deleteAccountSchema,

  // Projects
  createProjectSchema,
  updateProjectSchema,

  // Teams
  createTeamSchema,
  updateTeamSchema,
  joinTeamSchema,
  transferOwnershipSchema,

  // Voice
  generateVoiceSchema,
  batchVoiceSchema,
  voiceEstimateSchema,
  assignVoiceSchema,
  bulkAssignVoiceSchema,
  generateSampleDialogueSchema,

  // Content Generation
  generateQuestSchema,

  // Admin
  addToWhitelistSchema,
  removeFromWhitelistSchema,

  // Assets
  saveSpriteSchema,
  retextureSchema,
  startPipelineSchema
}
