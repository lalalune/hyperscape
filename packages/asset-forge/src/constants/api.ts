// API endpoints
export const API_ENDPOINTS = {
  // Assets
  ASSETS: '/api/assets',
  ASSET_BY_ID: (id: string) => `/api/assets/${id}`,
  ASSET_MODEL: (id: string) => `/api/assets/${id}/model`,
  ASSET_FILE: (id: string, filename: string) => `/api/assets/${id}/${filename}`,
  ASSET_SPRITES: (id: string) => `/api/assets/${id}/sprites`,
  
  // Generation
  GENERATION: '/api/generation',
  GENERATION_STATUS: '/api/generation/status',
  
  // Materials
  MATERIAL_PRESETS: '/api/material-presets',
  
  // Equipment
  EQUIPMENT_CONFIG: '/api/equipment/config',
} as const

// API response status codes
export const API_STATUS = {
  SUCCESS: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  SERVER_ERROR: 500,
} as const

// Pagination defaults
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
} as const 