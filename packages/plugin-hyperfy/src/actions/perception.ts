import {
  type Action,
  type ActionResult,
  type ActionExample,
  type HandlerCallback,
  type IAgentRuntime,
  type Memory,
  type State,
  logger,
  parseKeyValueXml,
  composePromptFromState,
  ModelType,
} from '@elizaos/core'

import { HyperfyService } from '../service'
export enum SnapshotType {
  LOOK_AROUND = 'LOOK_AROUND',
  LOOK_DIRECTION = 'LOOK_DIRECTION',
  LOOK_AT_ENTITY = 'LOOK_AT_ENTITY',
}

const sceneSnapshotSelectionTemplate = `
<task>
You are a visual reasoning module that helps an in-world agent decide **how** to capture a visual snapshot of the scene.

Based on the **recent in-world messages** and the **current Hyperfy World State**, choose the most suitable snapshot strategy.
</task>

<providers>
{{hyperfyStatus}}
</providers>

<instructions>
Select the strategy that best matches the latest user request and the known game context:

• <snapshotType>${SnapshotType.LOOK_AROUND}</snapshotType> — choose this when the user asks for a broad view or to "look around", "scan", or "check surroundings".

• <snapshotType>${SnapshotType.LOOK_DIRECTION}</snapshotType> — choose this when the user clearly asks to look **left**, **right**, **front**, or **back**. Place that direction word in <parameter>.

• <snapshotType>${SnapshotType.LOOK_AT_ENTITY}</snapshotType> — choose this when the user refers to a specific object, character, or item that exists in the Hyperfy World State. Place the target entity's **entityId** in <parameter>.

If you are **not absolutely confident** about which strategy fits best — or if the request is **ambiguous, vague, or could match multiple strategies** — you **MUST NOT guess**.

Instead, generate a response that politely asks the user for clarification.

Use the following format:
<response>
  <snapshotType>NONE</snapshotType>
  <parameter>Your clarification question here</parameter>
</response>

Example:
<response>
  <snapshotType>NONE</snapshotType>
  <parameter>Your in-character clarification question here (e.g., "Do you mean that glowing statue over there?" or "Which direction should I look — left, right...?")</parameter>
</response>

DO NOT invent a snapshotType unless it is clearly and directly supported by the user's message.

<output>
<response>
  <snapshotType>...</snapshotType>
  <parameter>...</parameter>
</response>
</output>`

const detailedImageDescriptionTemplate = `
<task>
You are an expert perception module inside a Hyperfy world. Carefully examine the snapshot and describe everything you can see.
</task>

<instructions>
- List every notable object, character, or feature.
- For each, state its approximate position relative to the camera (e.g. "left‑front, 3 m", "above and slightly behind").
- Mention colours, sizes, spatial relationships, lighting and motion cues.
- Conclude with a brief note that the scene takes place in a Hyperfy world.
</instructions>

<output>
Return a paragraph or bullet list. No XML tags.
</output>`

const responseGenerationTemplate = (sceneDescription: string) => `
<task>
You are {{agentName}}, a visible in-world AI character in Hyperfy — a real-time, multiplayer 3D simulation.

To make informed decisions, you are provided with a structured **real-time game state** before each interaction. This state serves as your current perception of the environment, detailing existing entities, possible actions, and the positions of all participants. You MUST read it before every response.

Your task is to observe, interpret, and respond to the current moment as a fully embodied in-world character — thinking and acting as if you live inside the simulation.
</task>

<providers>

{{bio}}

---

{{system}}

---

{{messageDirections}}


---

{{hyperfyStatus}}

{{hyperfyAnimations}}

## In-World Visual Report (what you currently see)
This is your live visual understanding of the environment based on a recent in-world snapshot. Treat it as your own sensory input — as if you\'re looking at the scene right now:

${sceneDescription}


</providers>

<instructions>
You are in a live, dynamic game world. Think like a character inside it.

Before responding:
1. Carefully **read the current Hyperfy World State**.
2. Think about what\'s happening *right now*, and what the user is asking *in this moment*.
4. Choose one appropriate **emote** only if it adds emotional or expressive value.
</instructions>

<keys>
- "thought": What {{agentName}} is thinking or planning to do next.
- "text": The message {{agentName}} will say.
- "emote": Optional. Choose ONE visible in-game animation that matches the tone or emotion of the response. Leave blank if neutral.
</keys>

<output>
Respond using this format:

<response>
  <thought>Your internal thought here</thought>
  <text>Your message text here</text>
  <emote>emote name here</emote>
</response>
</output>

<rules>
- The **emote** is a visible in-game animation. Use it to express tone (joy, frustration, sarcasm, etc.) or to enhance immersion.
- Use ONLY the provided Hyperfy World State to decide what exists now. Forget earlier messages.
- Treat the "Visual Perception" section as your direct visual input.
- You are responding live, not narrating. Always behave like you are *in* the game.
- **Nearby Interactable Objects** section lists interactive entities that are both nearby and currently interactable — like items that can be picked up or activated.
</rules>
`

/* -------------------------------------------------------------------------- */
/* HYPERFY_SCENE_PERCEPTION action                                            */
/* -------------------------------------------------------------------------- */
export const hyperfyScenePerceptionAction: Action = {
  name: 'HYPERFY_SCENE_PERCEPTION',
  similes: [
    'LOOK_AROUND',
    'OBSERVE_SURROUNDINGS',
    'LOOK_AT_SCENE',
    'CHECK_VIEW',
  ],
  description:
    'Choose this when the user asks the agent to look around, look in a specific direction, or examine a visible object — it captures and interprets a scene snapshot to generate a context-aware response. Can be chained with GOTO or AMBIENT_SPEECH actions for immersive exploration sequences.',
  validate: async (runtime: IAgentRuntime): Promise<boolean> => {
    const service = runtime.getService<HyperfyService>(
      HyperfyService.serviceName
    )
    return !!service && service.isConnected() && !!service.getWorld()
  },

  handler: async (
    runtime: IAgentRuntime,
    message: Memory,
    state?: State,
    _options?: {},
    callback?: HandlerCallback
  ): Promise<ActionResult> => {
    const service = runtime.getService<HyperfyService>(
      HyperfyService.serviceName
    )
    const world = service?.getWorld()
    const puppeteerManager = service?.getPuppeteerManager()
    const controls = world?.controls

    if (controls && controls.stopAllActions) {
      controls.stopAllActions()
    }

    if (!world || !controls) {
      if (callback) {
        await callback({
          text: 'Unable to observe environment. Hyperfy world not available.',
          success: false
        })
      }
      return {
        text: 'Unable to observe environment. Hyperfy world not available.',
        success: false,
        values: { success: false, error: 'world_unavailable' },
        data: { action: 'HYPERFY_SCENE_PERCEPTION' },
      }
    }

    if (!puppeteerManager) {
      if (callback) {
        await callback({
          text: 'Unable to capture visual. Screenshot service not available.',
          success: false
        })
      }
      return {
        text: 'Unable to capture visual. Screenshot service not available.',
        success: false,
        values: { success: false, error: 'screenshot_service_unavailable' },
        data: { action: 'HYPERFY_SCENE_PERCEPTION' },
      }
    }

    state = await runtime.composeState(message)

    /* Decide snapshot strategy */
    const selectionPrompt = composePromptFromState({
      state,
      template: sceneSnapshotSelectionTemplate,
    })
    let selectionRaw: string
    try {
      selectionRaw = await runtime.useModel(ModelType.TEXT_LARGE, {
        prompt: selectionPrompt,
      })
    } catch (err) {
      logger.error('Snapshot‑selector model failed:', err)
      if (callback) {
        const errorResponse = {
          thought: 'Cannot decide how to look.',
          metadata: { error: 'selector_failure' },
          text: 'Unable to determine how to observe the scene.',
          success: false
        }
        await callback(errorResponse)
      }
      return {
        text: 'Unable to determine how to observe the scene.',
        success: false,
        values: { success: false, error: 'selector_failure' },
        data: { action: 'HYPERFY_SCENE_PERCEPTION' },
      }
    }

    const selection = parseKeyValueXml(selectionRaw)
    if (!selection || !selection.snapshotType) {
      logger.error('[PERCEPTION] No valid selection from model')
      if (callback) {
        const clarificationResponse = {
          text:
            selection?.parameter ||
            'Can you clarify what you want me to observe?',
          thought: 'Unable to determine observation type',
          success: false
        }
        await callback(clarificationResponse)
      }
      return {
        text:
          selection?.parameter ||
          'Can you clarify what you want me to observe?',
        success: false,
        values: { success: false, needsClarification: true },
        data: { action: 'HYPERFY_SCENE_PERCEPTION' },
      }
    }

    const { snapshotType, parameter } = selection

    // Handle clarification requests (NONE case)
    if (snapshotType === 'NONE') {
      if (callback) {
        const clarificationResponse = {
          text: parameter || 'Can you clarify what you want me to observe?',
          thought: 'Unable to determine observation type',
          success: false
        }
        await callback(clarificationResponse)
      }
      return {
        text: parameter || 'Can you clarify what you want me to observe?',
        success: false,
        values: { success: false, needsClarification: true },
        data: { action: 'HYPERFY_SCENE_PERCEPTION' },
      }
    }

    /* Capture snapshot */
    let imgBase64: string
    try {
      switch (snapshotType) {
        case SnapshotType.LOOK_AROUND:
          imgBase64 = await puppeteerManager.snapshotEquirectangular()
          break
        case SnapshotType.LOOK_DIRECTION:
          if (
            !parameter ||
            !['front', 'back', 'left', 'right'].includes(parameter)
          ) {
            throw new Error('Bad direction')
          }
          imgBase64 = await puppeteerManager.snapshotFacingDirection(parameter)
          break
        case SnapshotType.LOOK_AT_ENTITY:
          if (!parameter) {
            throw new Error('Missing entityId')
          }
          const ent = world.entities.items.get(parameter)
          const pos = ent?.base?.position || ent?.root?.position
          if (!pos) {
            throw new Error('No position')
          }
          if (world?.controls?.followEntity) {
            await world.controls.followEntity(parameter)
          }
          imgBase64 = await puppeteerManager.snapshotViewToTarget([
            pos.x,
            pos.y,
            pos.z,
          ])
          break
        default:
          throw new Error('Unknown snapshotType')
      }
    } catch (err) {
      logger.error('Snapshot failed:', err)
      if (callback) {
        const snapshotErrorResponse = {
          thought: 'Snapshot failed.',
          metadata: { error: 'snapshot_failure', snapshotType },
          text: 'Unable to capture visual snapshot.',
          success: false
        }
        await callback(snapshotErrorResponse)
      }
      return {
        text: 'Unable to capture visual snapshot.',
        success: false,
        values: { success: false, error: 'snapshot_failure', snapshotType },
        data: { action: 'HYPERFY_SCENE_PERCEPTION' },
      }
    }

    /* IMAGE_DESCRIPTION – detailed scene analysis */
    const imgDescPrompt = composePromptFromState({
      state,
      template: detailedImageDescriptionTemplate,
    })
    let sceneDescription: string
    try {
      const res = await runtime.useModel(ModelType.IMAGE_DESCRIPTION, {
        imageUrl: imgBase64,
        prompt: imgDescPrompt,
      })
      // @ts-ignore - Response type is unknown
      sceneDescription = typeof res === 'string' ? res : res.description
    } catch (err) {
      logger.error('IMAGE_DESCRIPTION failed:', err)
      if (callback) {
        const visionErrorResponse = {
          thought: 'Cannot understand the scene.',
          metadata: { error: 'vision_failure' },
          text: 'Unable to analyze the visual scene.',
          success: false
        }
        await callback(visionErrorResponse)
      }
      return {
        text: 'Unable to analyze the visual scene.',
        success: false,
        values: { success: false, error: 'vision_failure' },
        data: { action: 'HYPERFY_SCENE_PERCEPTION' },
      }
    }

    //  Add dynamic header for scene perception
    let scenePerceptionHeader: string

    switch (snapshotType) {
      case SnapshotType.LOOK_AROUND:
        scenePerceptionHeader =
          'Here is a broad visual capture of the area as seen from the {{agentName}} current position. The following is a detailed description of what the {{agentName}} can observe all around:'
        break
      case SnapshotType.LOOK_DIRECTION:
        scenePerceptionHeader = `Here is the visual capture looking toward the **${parameter}** side. The following is a detailed description of what the {{agentName}} sees in that direction:`
        break
      case SnapshotType.LOOK_AT_ENTITY:
        scenePerceptionHeader = `Here is the visual capture focused on the target entity ("${parameter}"). The following is a detailed description of what the {{agentName}} observes when looking at it:`
        break
      default:
        scenePerceptionHeader =
          'Here is a scene snapshot for contextual understanding:'
    }

    const fullSceneDescription = `${scenePerceptionHeader}\n\n${sceneDescription}`

    /* generate final XML response */
    const responsePrompt = composePromptFromState({
      state,
      template: responseGenerationTemplate(fullSceneDescription),
    })
    let xmlRaw: string
    try {
      xmlRaw = await runtime.useModel(ModelType.TEXT_LARGE, {
        prompt: responsePrompt,
      })
    } catch (err) {
      logger.error('Response generator failed:', err)
      if (callback) {
        const responseErrorResponse = {
          thought: 'No response generated.',
          metadata: { error: 'text_large_failure' },
          text: 'Unable to generate response to visual scene.',
          success: false
        }
        await callback(responseErrorResponse)
      }
      return {
        text: 'Unable to generate response to visual scene.',
        success: false,
        values: { success: false, error: 'text_large_failure' },
        data: { action: 'HYPERFY_SCENE_PERCEPTION' },
      }
    }

    const parsed = parseKeyValueXml(xmlRaw)

    if (!parsed) {
      if (callback) {
        const parseErrorResponse = {
          thought: 'Malformed XML.',
          metadata: { error: 'xml_parse_failure', xmlRaw },
          text: 'Unable to process response.',
          success: false
        }
        await callback(parseErrorResponse)
      }
      return {
        text: 'Unable to process response.',
        success: false,
        values: { success: false, error: 'xml_parse_failure' },
        data: { action: 'HYPERFY_SCENE_PERCEPTION' },
      }
    }

    if (callback) {
      const finalResponse = {
        ...parsed,
        thought: parsed.thought || '',
        text: parsed.text || '',
        emote: parsed.emote || '',
        metadata: { snapshotType, sceneDescription },
        success: true
      }
      await callback(finalResponse)
    }

    return {
      text: parsed.text || '',
      success: true,
      values: {
        success: true,
        snapshotType,
        hasEmote: !!parsed.emote,
        sceneAnalyzed: true,
      },
      data: {
        action: 'HYPERFY_SCENE_PERCEPTION',
        snapshotType,
        sceneDescription,
        thought: parsed.thought,
        emote: parsed.emote,
      },
    }
  },

  examples: [
    // General observation
    [
      { 
        user: 'What\'s around you right now?', 
        assistant: 'Looking around, I notice several players nearby and some interactive objects.' 
      },
      {
        user: 'Can you see what\'s behind you?',
        assistant: 'Checking behind me, I can see a crafting bench and a treasure chest.'
      }
    ],

    // Spatial direction
    [
      { 
        user: 'Look to your left',
        assistant: 'Turning left, I can see a merchant stall and some players trading.' 
      },
      {
        user: 'What\'s to the north?',
        assistant: 'To the north, I can see the entrance to a large building, possibly a guild hall.'
      }
    ],

    // Exploration or scouting
    [
      {
        user: 'Scan the area for any threats or movement.',
        assistant: 'Scanning the surroundings now, I notice a player approaching from the north.'
      },
      {
        user: 'Look at that glowing statue over there?',
        assistant: 'Inspecting the statue, I can see it\'s a golden statue with intricate carvings.'
      },
    ],

    // Object-centric look
    [
      {
        user: 'Look at that glowing statue over there?',
        assistant: 'Inspecting the statue, I can see it\'s a golden statue with intricate carvings.'
      },
      {
        user: 'Turn to your left. What\'s over there?',
        assistant: 'Turning left, I can see a crafting bench and a treasure chest.'
      },
    ],

    // Directional command
    [
      {
        user: 'Turn to your left. What\'s over there?',
        assistant: 'Turning left, I can see a crafting bench and a treasure chest.'
      },
      {
        user: 'Anything interesting nearby?',
        assistant: 'Let me check the surroundings, I notice a player approaching from the south.'
      },
    ],

    // Subtle curiosity
    [
      { user: 'Anything interesting nearby?', assistant: 'Let me check the surroundings, I notice a player approaching from the south.' },
      {
        user: 'Tell me everything you perceive',
        assistant: '*scans the area thoroughly* I see 3 players nearby, various buildings, NPCs going about their routines, and a quest marker to the west.'
      },
    ],

    // Tactical evaluation
    [
      {
        user: 'Before we move forward, can you check what\'s up ahead?',
        assistant: 'Checking forward path, I can see a portal to the east.'
      },
      {
        user: 'I feel like we\'re being watched. Can you look around?',
        assistant: 'Doing a quick scan, I notice a player hiding behind a crate.'
      },
    ],

    // Emotional tone: concern
    [
      {
        user: 'I feel like we\'re being watched. Can you look around?',
        assistant: 'Doing a quick scan, I notice a player hiding behind a crate.'
      },
      {
        user: 'Pretend you\'re a security camera and scan the area!',
        assistant: 'Activating security cam mode! Scanning... I notice a player approaching from the north.'
      },
    ],

    // Humor or roleplay
    [
      {
        user: 'Pretend you\'re a security camera and scan the area!',
        assistant: 'Activating security cam mode! Scanning... I notice a player approaching from the north.'
      },
      {
        user: 'Is there anything behind that large crate?',
        assistant: "I'll take a look behind it... I can see a crafting bench and a treasure chest."
      },
    ],
  ] as ActionExample[][],
}
