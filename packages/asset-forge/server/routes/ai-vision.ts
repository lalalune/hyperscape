
/**
 * AI Vision Routes
 * GPT-4 Vision powered weapon detection endpoints
 */

import { Elysia } from 'elysia'
import fetch from 'node-fetch'
import { getWeaponDetectionPrompts } from '../utils/promptLoader'
import * as Models from '../models'

export const aiVisionRoutes = new Elysia({ prefix: '/api', name: 'ai-vision' })
  .guard({
    beforeHandle: ({ set }) => {
      if (!process.env.OPENAI_API_KEY) {
        set.status = 500
        return { success: false, error: 'OpenAI API key not configured' }
      }
    }
  }, (app) => app
    // Weapon handle detection with GPT-4 Vision
    .post('/weapon-handle-detect', async ({ body }) => {
      const { image, angle, promptHint } = body

      // Load weapon detection prompts
      const weaponPrompts = await getWeaponDetectionPrompts()

      // Build the prompt with optional hint
      const basePromptTemplate = weaponPrompts?.basePrompt ||
        `You are analyzing a 3D weapon rendered from the \${angle || 'side'} in a 512x512 pixel image.
The weapon is oriented vertically with the blade/head pointing UP and handle pointing DOWN.

YOUR TASK: Identify ONLY the HANDLE/GRIP area where a human hand would hold this weapon.

CRITICAL DISTINCTIONS:
- HANDLE/GRIP: The narrow cylindrical part designed for holding (usually wrapped, textured, or darker)
- BLADE: The wide, flat, sharp part used for cutting (usually metallic, reflective, lighter)
- GUARD/CROSSGUARD: The horizontal piece between blade and handle
- POMMEL: The weighted end piece at the very bottom of the handle

For a SWORD specifically:
- The HANDLE is the wrapped/textured section BELOW the guard/crossguard
- It's typically 15-25% of the total weapon length
- It's narrower than the blade
- It often has visible wrapping, leather, or grip texture
- The grip is NEVER on the blade itself

VISUAL CUES for the handle:
1. Look for texture changes (wrapped vs smooth metal)
2. Look for width changes (handle is narrower than blade)
3. Look for the crossguard/guard that separates blade from handle
4. The handle is typically in the LOWER portion of the weapon
5. If you see a wide, flat, metallic surface - that's the BLADE, not the handle!`

      // Replace template variables
      let promptText = basePromptTemplate.replace('${angle || \'side\'}', angle || 'side')

      if (promptHint) {
        const additionalGuidance = weaponPrompts?.additionalGuidance || '\n\nAdditional guidance: ${promptHint}'
        promptText += additionalGuidance.replace('${promptHint}', promptHint)
      }

      // Add restrictions
      const restrictions = weaponPrompts?.restrictions ||
        `\n\nDO NOT select:
- The blade (wide, flat, sharp part)
- The guard/crossguard
- Decorative elements
- The pommel alone

ONLY select the cylindrical grip area where fingers would wrap around.`

      promptText += restrictions

      // Add response format
      const responseFormat = weaponPrompts?.responseFormat ||
        `\n\nRespond with ONLY a JSON object in this exact format:
{
  "gripBounds": {
    "minX": <pixel coordinate 0-512>,
    "minY": <pixel coordinate 0-512>,
    "maxX": <pixel coordinate 0-512>,
    "maxY": <pixel coordinate 0-512>
  },
  "confidence": <number 0-1>,
  "weaponType": "<sword|axe|mace|staff|bow|dagger|spear|etc>",
  "gripDescription": "<brief description of grip location>",
  "detectedParts": {
    "blade": "<describe what you identified as the blade>",
    "handle": "<describe what you identified as the handle>",
    "guard": "<describe if you see a guard/crossguard>"
  }
}`

      promptText += responseFormat

      // Use GPT-4 Vision to analyze the weapon and identify grip location
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: promptText
                },
                { type: "image_url", image_url: { url: image, detail: "high" } }
              ]
            }
          ],
          max_tokens: 300,
          temperature: 0.3,
          response_format: { type: "json_object" }
        })
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`OpenAI API error: ${response.status} - ${error}`)
      }

      const data = await response.json() as { choices: Array<{ message: { content: string } }> }
      let gripData

      try {
        gripData = JSON.parse(data.choices[0].message.content)
      } catch (parseError) {
        // If parsing fails, return default values
        gripData = {
          gripBounds: { minX: 200, minY: 350, maxX: 300, maxY: 450 },
          confidence: 0.5,
          weaponType: "unknown",
          gripDescription: "Unable to parse AI response",
          orientation: "vertical"
        }
      }

      return {
        success: true,
        gripData,
        originalImage: image
      }
    }, {
      body: Models.WeaponHandleDetectRequest,
      response: Models.WeaponHandleDetectResponse,
      detail: {
        tags: ['AI Vision'],
        summary: 'Detect weapon handle/grip area',
        description: 'Uses GPT-4 Vision to identify the handle/grip area of a weapon image. (Auth optional)'
      }
    })

    // Weapon orientation detection with GPT-4 Vision
    .post('/weapon-orientation-detect', async ({ body }) => {
      const { image } = body

      const promptText = `You are analyzing a 3D weapon that should be oriented vertically.

CRITICAL TASK: Determine if this weapon is upside down and needs to be flipped 180 degrees.

CORRECT ORIENTATION:
- The HANDLE/GRIP should be at the BOTTOM
- The BLADE/HEAD/BUSINESS END should be at the TOP

For different weapons:
- SWORD: Blade should point UP, handle/grip DOWN
- AXE: Axe head UP, wooden handle DOWN
- MACE: Heavy spiked head UP, shaft/handle DOWN
- HAMMER: Hammer head UP, handle DOWN
- STAFF: Usually symmetrical but decorative end UP
- SPEAR: Pointed tip UP, shaft DOWN
- DAGGER: Blade UP, handle DOWN

Look for these visual cues:
1. Handles are usually narrower, wrapped, or textured
2. Blades/heads are usually wider, metallic, or decorative
3. The "heavy" or "dangerous" end should be UP
4. The "holding" end should be DOWN

Respond with ONLY a JSON object:
{
  "needsFlip": <true if weapon is upside down, false if correctly oriented>,
  "currentOrientation": "<describe what you see at top and bottom>",
  "reason": "<brief explanation of your decision>"
}`

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: promptText },
                { type: "image_url", image_url: { url: image, detail: "high" } }
              ]
            }
          ],
          max_tokens: 200,
          temperature: 0.2,
          response_format: { type: "json_object" }
        })
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`OpenAI API error: ${response.status} - ${error}`)
      }

      const data = await response.json() as { choices: Array<{ message: { content: string } }> }
      let orientationData

      try {
        orientationData = JSON.parse(data.choices[0].message.content)
      } catch (parseError) {
        orientationData = {
          needsFlip: false,
          currentOrientation: "Unable to parse AI response",
          reason: "Parse error - assuming correct orientation"
        }
      }

      return {
        success: true,
        ...orientationData
      }
    }, {
      body: Models.WeaponOrientationDetectRequest,
      response: Models.WeaponOrientationDetectResponse,
      detail: {
        tags: ['AI Vision'],
        summary: 'Detect weapon orientation',
        description: 'Uses GPT-4 Vision to determine if weapon needs to be flipped 180 degrees. (Auth optional)'
      }
    })
  )
