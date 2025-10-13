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
    )!
    const world = service.getWorld()!
    const playwrightManager = service.getPlaywrightManager()!
    const controls = world.controls!

    ;(controls as unknown as { stopAllActions: () => void }).stopAllActions()

    state = await runtime.composeState(message)

    /* Decide snapshot strategy */
    const selectionPrompt = composePromptFromState({
      state,
      template: sceneSnapshotSelectionTemplate,
    })
    const selectionRaw: string = await runtime.useModel(ModelType.TEXT_LARGE, {
      prompt: selectionPrompt,
    })

    const selection = parseKeyValueXml(selectionRaw)!

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
    switch (snapshotType) {
      case SnapshotType.LOOK_AROUND:
        imgBase64 = await playwrightManager.snapshotEquirectangular()
        break
      case SnapshotType.LOOK_DIRECTION:
        imgBase64 = await playwrightManager.snapshotFacingDirection(parameter)
        break
      case SnapshotType.LOOK_AT_ENTITY:
        const ent = world.entities.items.get(parameter)!
        const pos = ent.position!
        await world.controls.followEntity(parameter)
        imgBase64 = await playwrightManager.snapshotViewToTarget([
          pos.x,
          pos.y,
          pos.z,
        ])
        break
      default:
        throw new Error('Unknown snapshotType')
    }

    /* IMAGE_DESCRIPTION – detailed scene analysis */
    const imgDescPrompt = composePromptFromState({
      state,
      template: detailedImageDescriptionTemplate,
    })
    const res = await runtime.useModel(ModelType.IMAGE_DESCRIPTION, {
      imageUrl: imgBase64,
      prompt: imgDescPrompt,
    })
    // Model returns either string directly or object with description property
    const sceneDescription: string =
      (res as { description?: string }).description || String(res)

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
    const xmlRaw: string = await runtime.useModel(ModelType.TEXT_LARGE, {
      prompt: responsePrompt,
    })

    const parsed = parseKeyValueXml(xmlRaw)!

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
