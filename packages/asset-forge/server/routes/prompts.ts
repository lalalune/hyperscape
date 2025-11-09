/**
 * Prompts Routes
 * Serves prompt configuration files from public/prompts directory
 */

import { Elysia, t } from 'elysia'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT_DIR = path.join(__dirname, '..', '..')
const PROMPTS_DIR = path.join(ROOT_DIR, 'public', 'prompts')

export const promptRoutes = new Elysia({ prefix: '/api/prompts' })
  // Get game style prompts
  .get('/game-styles', async () => {
    try {
      const file = Bun.file(path.join(PROMPTS_DIR, 'game-style-prompts.json'))
      const data = await file.json()
      return data
    } catch (error) {
      console.error('Error loading game style prompts:', error)
      throw new Error('Failed to load game style prompts')
    }
  }, {
    detail: {
      tags: ['Prompts'],
      summary: 'Get game style prompts',
      description: 'Retrieve game style prompt templates for asset generation'
    }
  })

  // Get asset type prompts
  .get('/asset-types', async () => {
    try {
      const file = Bun.file(path.join(PROMPTS_DIR, 'asset-type-prompts.json'))
      const data = await file.json()
      return data
    } catch (error) {
      console.error('Error loading asset type prompts:', error)
      throw new Error('Failed to load asset type prompts')
    }
  }, {
    detail: {
      tags: ['Prompts'],
      summary: 'Get asset type prompts',
      description: 'Retrieve asset type prompt templates for different asset categories'
    }
  })

  // Get material prompts
  .get('/materials', async () => {
    try {
      const file = Bun.file(path.join(PROMPTS_DIR, 'material-prompts.json'))
      const data = await file.json()
      return data
    } catch (error) {
      console.error('Error loading material prompts:', error)
      throw new Error('Failed to load material prompts')
    }
  }, {
    detail: {
      tags: ['Prompts'],
      summary: 'Get material prompts',
      description: 'Retrieve material prompt templates for texturing'
    }
  })

  // Get generation prompts
  .get('/generation', async () => {
    try {
      const file = Bun.file(path.join(PROMPTS_DIR, 'generation-prompts.json'))
      const data = await file.json()
      return data
    } catch (error) {
      console.error('Error loading generation prompts:', error)
      throw new Error('Failed to load generation prompts')
    }
  }, {
    detail: {
      tags: ['Prompts'],
      summary: 'Get generation prompts',
      description: 'Retrieve generation prompt templates for the pipeline'
    }
  })

  // Get GPT-4 enhancement prompts
  .get('/gpt4-enhancement', async () => {
    try {
      const file = Bun.file(path.join(PROMPTS_DIR, 'gpt4-enhancement-prompts.json'))
      const data = await file.json()
      return data
    } catch (error) {
      console.error('Error loading GPT-4 enhancement prompts:', error)
      throw new Error('Failed to load GPT-4 enhancement prompts')
    }
  }, {
    detail: {
      tags: ['Prompts'],
      summary: 'Get GPT-4 enhancement prompts',
      description: 'Retrieve GPT-4 prompt enhancement templates'
    }
  })

  // Get material presets
  .get('/material-presets', async () => {
    try {
      const file = Bun.file(path.join(PROMPTS_DIR, 'material-presets.json'))
      const data = await file.json()
      return data
    } catch (error) {
      console.error('Error loading material presets:', error)
      throw new Error('Failed to load material presets')
    }
  }, {
    detail: {
      tags: ['Prompts'],
      summary: 'Get material presets',
      description: 'Retrieve material preset configurations'
    }
  })

  // Get weapon detection prompts
  .get('/weapon-detection', async () => {
    try {
      const file = Bun.file(path.join(PROMPTS_DIR, 'weapon-detection-prompts.json'))
      const data = await file.json()
      return data
    } catch (error) {
      console.error('Error loading weapon detection prompts:', error)
      throw new Error('Failed to load weapon detection prompts')
    }
  }, {
    detail: {
      tags: ['Prompts'],
      summary: 'Get weapon detection prompts',
      description: 'Retrieve weapon detection prompt templates for AI vision'
    }
  })
