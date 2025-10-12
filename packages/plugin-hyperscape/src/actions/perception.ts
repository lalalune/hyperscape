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

import { HyperscapeService } from '../service'
export enum SnapshotType {
  LOOK_AROUND = 'LOOK_AROUND',
  LOOK_DIRECTION = 'LOOK_DIRECTION',
  LOOK_AT_ENTITY = 'LOOK_AT_ENTITY',
}

const sceneSnapshotSelectionTemplate = `
<task>
You are a visual reasoning module that helps an in-world agent decide **how** to capture a visual snapshot of the scene.

Based on the **recent in-world messages** and the **current Hyperscape World State**, choose the most suitable snapshot strategy.
</task>

<providers>
{{hyperscapeStatus}}
</providers>

<instructions>
Select the strategy that best matches the latest user request and the known game context:

• <snapshotType>${SnapshotType.LOOK_AROUND}</snapshotType> — choose this when the user asks for a broad view or to "look around", "scan", or "check surroundings".

• <snapshotType>${SnapshotType.LOOK_DIRECTION}</snapshotType> — choose this when the user clearly asks to look **left**, **right**, **front**, or **back**. Place that direction word in <parameter>.

• <snapshotType>${SnapshotType.LOOK_AT_ENTITY}</snapshotType> — choose this when the user refers to a specific object, character, or item that exists in the Hyperscape World State. Place the target entity's **entityId** in <parameter>.

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
You are an expert perception module inside a Hyperscape world. Carefully examine the snapshot and describe everything you can see.
</task>

<instructions>
- List every notable object, character, or feature.
- For each, state its approximate position relative to the camera (e.g. "left‑front, 3 m", "above and slightly behind").
- Mention colours, sizes, spatial relationships, lighting and motion cues.
- Conclude with a brief note that the scene takes place in a Hyperscape world.
</instructions>

<output>
Return a paragraph or bullet list. No XML tags.
</output>`

const responseGenerationTemplate = (sceneDescription: string) => `
<task>
You are {{agentName}}, a visible in-world AI character in Hyperscape — a real-time, multiplayer 3D simulation.

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

{{hyperscapeStatus}}

{{hyperscapeAnimations}}

## In-World Visual Report (what you currently see)
This is your live visual understanding of the environment based on a recent in-world snapshot. Treat it as your own sensory input — as if you're looking at the scene right now:

${sceneDescription}


</providers>

<instructions>
You are in a live, dynamic game world. Think like a character inside it.

Before responding:
1. Carefully **read the current Hyperscape World State**.
2. Think about what's happening *right now*, and what the user is asking *in this moment*.
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
- Use ONLY the provided Hyperscape World State to decide what exists now. Forget earlier messages.
- Treat the "Visual Perception" section as your direct visual input.
- You are responding live, not narrating. Always behave like you are *in* the game.
- **Nearby Interactable Objects** section lists interactive entities that are both nearby and currently interactable — like items that can be picked up or activated.
</rules>
`

/* -------------------------------------------------------------------------- */
/* HYPERSCAPE_SCENE_PERCEPTION action                                            */
/* -------------------------------------------------------------------------- */
export const hyperscapeScenePerceptionAction: Action = {
  name: 'HYPERSCAPE_SCENE_PERCEPTION',
  similes: [
    'LOOK_AROUND',
    'OBSERVE_SURROUNDINGS',
    'LOOK_AT_SCENE',
    'CHECK_VIEW',
  ],
  description:
    'Choose this when the user asks the agent to look around, look in a specific direction, or examine a visible object — it captures and interprets a scene snapshot to generate a context-aware response. Can be chained with GOTO or AMBIENT_SPEECH actions for immersive exploration sequences.',
  validate: async (runtime: IAgentRuntime): Promise<boolean> => {
    const service = runtime.getService<HyperscapeService>(
      HyperscapeService.serviceName
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
    const service = runtime.getService<HyperscapeService>(
      HyperscapeService.serviceName
    )
    const world = service?.getWorld()
    const playwrightManager = service?.getPlaywrightManager()
    const controls = world?.controls

    if (
      controls &&
      typeof (controls as { stopAllActions?: () => void }).stopAllActions ===
        'function'
    ) {
      ;(controls as unknown as { stopAllActions: () => void }).stopAllActions()
    }

    if (!world || !controls) {
      if (callback) {
        await callback({
          text: 'Unable to observe environment. Hyperscape world not available.',
          success: false,
        })
      }
      return {
        text: 'Unable to observe environment. Hyperscape world not available.',
        success: false,
        values: { success: false, error: 'world_unavailable' },
        data: { action: 'HYPERSCAPE_SCENE_PERCEPTION' },
      }
    }

    if (!playwrightManager) {
      if (callback) {
        await callback({
          text: 'Unable to capture visual. Screenshot service not available.',
          success: false,
        })
      }
      return {
        text: 'Unable to capture visual. Screenshot service not available.',
        success: false,
        values: { success: false, error: 'screenshot_service_unavailable' },
        data: { action: 'HYPERSCAPE_SCENE_PERCEPTION' },
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
          success: false,
        }
        await callback(errorResponse)
      }
      return {
        text: 'Unable to determine how to observe the scene.',
        success: false,
        values: { success: false, error: 'selector_failure' },
        data: { action: 'HYPERSCAPE_SCENE_PERCEPTION' },
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
          success: false,
        }
        await callback(clarificationResponse)
      }
      return {
        text:
          selection?.parameter ||
          'Can you clarify what you want me to observe?',
        success: false,
        values: { success: false, needsClarification: true },
        data: { action: 'HYPERSCAPE_SCENE_PERCEPTION' },
      }
    }

    const { snapshotType, parameter } = selection

    // Handle clarification requests (NONE case)
    if (snapshotType === 'NONE') {
      if (callback) {
        const clarificationResponse = {
          text: parameter || 'Can you clarify what you want me to observe?',
          thought: 'Unable to determine observation type',
          success: false,
        }
        await callback(clarificationResponse)
      }
      return {
        text: parameter || 'Can you clarify what you want me to observe?',
        success: false,
        values: { success: false, needsClarification: true },
        data: { action: 'HYPERSCAPE_SCENE_PERCEPTION' },
      }
    }

    /* Capture snapshot */
    let imgBase64: string
    try {
      switch (snapshotType) {
        case SnapshotType.LOOK_AROUND:
          imgBase64 = await playwrightManager.snapshotEquirectangular()
          break
        case SnapshotType.LOOK_DIRECTION:
          if (
            !parameter ||
            !['front', 'back', 'left', 'right'].includes(parameter)
          ) {
            throw new Error('Bad direction')
          }
          imgBase64 = await playwrightManager.snapshotFacingDirection(parameter)
          break
        case SnapshotType.LOOK_AT_ENTITY:
          if (!parameter) {
            throw new Error('Missing entityId')
          }
          const ent = world.entities.items.get(parameter)
          const pos = ent.position
          if (!pos) {
            throw new Error('No position')
          }
          if (world?.controls?.followEntity) {
            await world.controls.followEntity(parameter)
          }
          imgBase64 = await playwrightManager.snapshotViewToTarget([
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
          success: false,
        }
        await callback(snapshotErrorResponse)
      }
      return {
        text: 'Unable to capture visual snapshot.',
        success: false,
        values: { success: false, error: 'snapshot_failure', snapshotType },
        data: { action: 'HYPERSCAPE_SCENE_PERCEPTION' },
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
      sceneDescription =
        typeof res === 'string'
          ? res
          : (res as { description?: string })?.description || String(res)
    } catch (err) {
      logger.error('IMAGE_DESCRIPTION failed:', err)
      if (callback) {
        const visionErrorResponse = {
          thought: 'Cannot understand the scene.',
          metadata: { error: 'vision_failure' },
          text: 'Unable to analyze the visual scene.',
          success: false,
        }
        await callback(visionErrorResponse)
      }
      return {
        text: 'Unable to analyze the visual scene.',
        success: false,
        values: { success: false, error: 'vision_failure' },
        data: { action: 'HYPERSCAPE_SCENE_PERCEPTION' },
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
          success: false,
        }
        await callback(responseErrorResponse)
      }
      return {
        text: 'Unable to generate response to visual scene.',
        success: false,
        values: { success: false, error: 'text_large_failure' },
        data: { action: 'HYPERSCAPE_SCENE_PERCEPTION' },
      }
    }

    const parsed = parseKeyValueXml(xmlRaw)

    if (!parsed) {
      if (callback) {
        const parseErrorResponse = {
          thought: 'Malformed XML.',
          metadata: { error: 'xml_parse_failure', xmlRaw },
          text: 'Unable to process response.',
          success: false,
        }
        await callback(parseErrorResponse)
      }
      return {
        text: 'Unable to process response.',
        success: false,
        values: { success: false, error: 'xml_parse_failure' },
        data: { action: 'HYPERSCAPE_SCENE_PERCEPTION' },
      }
    }

    if (callback) {
      const finalResponse = {
        ...parsed,
        thought: parsed.thought || '',
        text: parsed.text || '',
        emote: parsed.emote || '',
        metadata: { snapshotType, sceneDescription },
        success: true,
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
        action: 'HYPERSCAPE_SCENE_PERCEPTION',
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
        name: '{{user}}',
        content: {
          text: "What's around you right now?",
        },
      },
      {
        name: '{{agent}}',
        content: {
          text: 'Looking around, I notice several players nearby and some interactive objects.',
          actions: ['HYPERSCAPE_PERCEPTION'],
        },
      },
    ],

    // Spatial direction
    [
      {
        name: '{{user}}',
        content: {
          text: 'Look to your left',
        },
      },
      {
        name: '{{agent}}',
        content: {
          text: 'Turning left, I can see a merchant stall and some players trading.',
          actions: ['HYPERSCAPE_PERCEPTION'],
        },
      },
    ],

    // Exploration or scouting
    [
      {
        name: '{{user}}',
        content: {
          text: 'Scan the area for any threats or movement.',
        },
      },
      {
        name: '{{agent}}',
        content: {
          text: 'Scanning the surroundings now, I notice a player approaching from the north.',
          actions: ['HYPERSCAPE_PERCEPTION'],
        },
      },
    ],

    // Object-centric look
    [
      {
        name: '{{user}}',
        content: {
          text: 'Look at that glowing statue over there?',
        },
      },
      {
        name: '{{agent}}',
        content: {
          text: "Inspecting the statue, I can see it's a golden statue with intricate carvings.",
          actions: ['HYPERSCAPE_PERCEPTION'],
        },
      },
    ],

    // Directional command
    [
      {
        name: '{{user}}',
        content: {
          text: "Turn to your left. What's over there?",
        },
      },
      {
        name: '{{agent}}',
        content: {
          text: 'Turning left, I can see a crafting bench and a treasure chest.',
          actions: ['HYPERSCAPE_PERCEPTION'],
        },
      },
    ],

    // Subtle curiosity
    [
      {
        name: '{{user}}',
        content: {
          text: 'Anything interesting nearby?',
        },
      },
      {
        name: '{{agent}}',
        content: {
          text: 'Let me check the surroundings, I notice a player approaching from the south.',
          actions: ['HYPERSCAPE_PERCEPTION'],
        },
      },
    ],

    // Comprehensive scan
    [
      {
        name: '{{user}}',
        content: {
          text: 'Tell me everything you perceive',
        },
      },
      {
        name: '{{agent}}',
        content: {
          text: '*scans the area thoroughly* I see 3 players nearby, various buildings, NPCs going about their routines, and a quest marker to the west.',
          actions: ['HYPERSCAPE_PERCEPTION'],
        },
      },
    ],

    // Tactical evaluation
    [
      {
        name: '{{user}}',
        content: {
          text: "Before we move forward, can you check what's up ahead?",
        },
      },
      {
        name: '{{agent}}',
        content: {
          text: 'Checking forward path, I can see a portal to the east.',
          actions: ['HYPERSCAPE_PERCEPTION'],
        },
      },
    ],

    // Emotional tone: concern
    [
      {
        name: '{{user}}',
        content: {
          text: "I feel like we're being watched. Can you look around?",
        },
      },
      {
        name: '{{agent}}',
        content: {
          text: 'Doing a quick scan, I notice a player hiding behind a crate.',
          actions: ['HYPERSCAPE_PERCEPTION'],
        },
      },
    ],

    // Humor or roleplay
    [
      {
        name: '{{user}}',
        content: {
          text: "Pretend you're a security camera and scan the area!",
        },
      },
      {
        name: '{{agent}}',
        content: {
          text: 'Activating security cam mode! Scanning... I notice a player approaching from the north.',
          actions: ['HYPERSCAPE_PERCEPTION'],
        },
      },
    ],
  ] as ActionExample[][],
}
