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
} from '@elizaos/core';

import { HyperfyService } from '../service';
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
</output>`;

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
</output>`;

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
This is your live visual understanding of the environment based on a recent in-world snapshot. Treat it as your own sensory input — as if you're looking at the scene right now:

${sceneDescription}


</providers>

<instructions>
You are in a live, dynamic game world. Think like a character inside it.

Before responding:
1. Carefully **read the current Hyperfy World State**.
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
- Use ONLY the provided Hyperfy World State to decide what exists now. Forget earlier messages.
- Treat the "Visual Perception" section as your direct visual input.
- You are responding live, not narrating. Always behave like you are *in* the game.
- **Nearby Interactable Objects** section lists interactive entities that are both nearby and currently interactable — like items that can be picked up or activated.
</rules>
`;

/* -------------------------------------------------------------------------- */
/* HYPERFY_SCENE_PERCEPTION action                                            */
/* -------------------------------------------------------------------------- */
export const hyperfyScenePerceptionAction: Action = {
  name: 'HYPERFY_SCENE_PERCEPTION',
  similes: ['LOOK_AROUND', 'OBSERVE_SURROUNDINGS', 'LOOK_AT_SCENE', 'CHECK_VIEW'],
  description:
    'Choose this when the user asks the agent to look around, look in a specific direction, or examine a visible object — it captures and interprets a scene snapshot to generate a context-aware response. Can be chained with GOTO or AMBIENT_SPEECH actions for immersive exploration sequences.',
  validate: async (runtime: IAgentRuntime): Promise<boolean> => {
    const service = runtime.getService<HyperfyService>(HyperfyService.serviceName);
    return !!service && service.isConnected() && !!service.getWorld();
  },

  handler: async (runtime: IAgentRuntime, message: Memory, state?: State, _options?: {}, callback?: HandlerCallback): Promise<ActionResult> => {
    const service = runtime.getService<HyperfyService>(HyperfyService.serviceName);
    const world = service?.getWorld();
    const puppeteerManager = service?.getPuppeteerManager();
    const controls = world?.controls;

    if (controls && controls.stopAllActions) {
      controls.stopAllActions();
    }

    if (!world || !controls) {
      if (callback) {
        await callback({ text: 'Unable to observe environment. Hyperfy world not available.' });
      }
      return {
        text: 'Unable to observe environment. Hyperfy world not available.',
        values: { success: false, error: 'world_unavailable' },
        data: { action: 'HYPERFY_SCENE_PERCEPTION' },
      };
    }

    if (!puppeteerManager) {
      if (callback) {
        await callback({ text: 'Unable to capture visual. Screenshot service not available.' });
      }
      return {
        text: 'Unable to capture visual. Screenshot service not available.',
        values: { success: false, error: 'screenshot_service_unavailable' },
        data: { action: 'HYPERFY_SCENE_PERCEPTION' },
      };
    }

    state = await runtime.composeState(message);

    /* Decide snapshot strategy */
    const selectionPrompt = composePromptFromState({
      state,
      template: sceneSnapshotSelectionTemplate,
    });
    let selectionRaw: string;
    try {
      selectionRaw = await runtime.useModel(ModelType.TEXT_LARGE, { prompt: selectionPrompt });
    } catch (err) {
      logger.error('Snapshot‑selector model failed:', err);
      if (callback) {
        const errorResponse = {
          thought: 'Cannot decide how to look.',
          metadata: { error: 'selector_failure' },
        };
        await callback(errorResponse);
      }
      return {
        text: 'Unable to determine how to observe the scene.',
        values: { success: false, error: 'selector_failure' },
        data: { action: 'HYPERFY_SCENE_PERCEPTION' },
      };
    }

    const selection = parseKeyValueXml(selectionRaw);
    if (!selection || !selection.snapshotType) {
      logger.error('[PERCEPTION] No valid selection from model');
      if (callback) {
        const clarificationResponse = {
          text: selection?.parameter || 'Can you clarify what you want me to observe?',
          thought: 'Unable to determine observation type',
        };
        await callback(clarificationResponse);
      }
      return {
        text: selection?.parameter || 'Can you clarify what you want me to observe?',
        values: { success: false, needsClarification: true },
        data: { action: 'HYPERFY_SCENE_PERCEPTION' },
      };
    }

    const { snapshotType, parameter } = selection;

    // Handle clarification requests (NONE case)
    if (snapshotType === 'NONE') {
      if (callback) {
        const clarificationResponse = {
          text: parameter || 'Can you clarify what you want me to observe?',
          thought: 'Unable to determine observation type',
        };
        await callback(clarificationResponse);
      }
      return {
        text: parameter || 'Can you clarify what you want me to observe?',
        values: { success: false, needsClarification: true },
        data: { action: 'HYPERFY_SCENE_PERCEPTION' },
      };
    }

    /* Capture snapshot */
    let imgBase64: string;
    try {
      switch (snapshotType) {
        case SnapshotType.LOOK_AROUND:
          imgBase64 = await puppeteerManager.snapshotEquirectangular();
          break;
        case SnapshotType.LOOK_DIRECTION:
          if (!parameter || !['front', 'back', 'left', 'right'].includes(parameter)) {
            throw new Error('Bad direction');
          }
          imgBase64 = await puppeteerManager.snapshotFacingDirection(parameter);
          break;
        case SnapshotType.LOOK_AT_ENTITY:
          if (!parameter) {
            throw new Error('Missing entityId');
          }
          const ent = world.entities.items.get(parameter);
          const pos = ent?.base?.position || ent?.root?.position;
          if (!pos) {
            throw new Error('No position');
          }
          if (world?.controls?.followEntity) {
            await world.controls.followEntity(parameter);
          }
          imgBase64 = await puppeteerManager.snapshotViewToTarget([pos.x, pos.y, pos.z]);
          break;
        default:
          throw new Error('Unknown snapshotType');
      }
    } catch (err) {
      logger.error('Snapshot failed:', err);
      if (callback) {
        const snapshotErrorResponse = {
          thought: 'Snapshot failed.',
          metadata: { error: 'snapshot_failure', snapshotType },
        };
        await callback(snapshotErrorResponse);
      }
      return {
        text: 'Unable to capture visual snapshot.',
        values: { success: false, error: 'snapshot_failure', snapshotType },
        data: { action: 'HYPERFY_SCENE_PERCEPTION' },
      };
    }

    /* IMAGE_DESCRIPTION – detailed scene analysis */
    const imgDescPrompt = composePromptFromState({
      state,
      template: detailedImageDescriptionTemplate,
    });
    let sceneDescription: string;
    try {
      const res = await runtime.useModel(ModelType.IMAGE_DESCRIPTION, {
        imageUrl: imgBase64,
        prompt: imgDescPrompt,
      });
      // @ts-ignore - Response type is unknown
      sceneDescription = typeof res === 'string' ? res : res.description;
    } catch (err) {
      logger.error('IMAGE_DESCRIPTION failed:', err);
      if (callback) {
        const visionErrorResponse = {
          thought: 'Cannot understand the scene.',
          metadata: { error: 'vision_failure' },
        };
        await callback(visionErrorResponse);
      }
      return {
        text: 'Unable to analyze the visual scene.',
        values: { success: false, error: 'vision_failure' },
        data: { action: 'HYPERFY_SCENE_PERCEPTION' },
      };
    }

    //  Add dynamic header for scene perception
    let scenePerceptionHeader: string;

    switch (snapshotType) {
      case SnapshotType.LOOK_AROUND:
        scenePerceptionHeader =
          'Here is a broad visual capture of the area as seen from the {{agentName}} current position. The following is a detailed description of what the {{agentName}} can observe all around:';
        break;
      case SnapshotType.LOOK_DIRECTION:
        scenePerceptionHeader = `Here is the visual capture looking toward the **${parameter}** side. The following is a detailed description of what the {{agentName}} sees in that direction:`;
        break;
      case SnapshotType.LOOK_AT_ENTITY:
        scenePerceptionHeader = `Here is the visual capture focused on the target entity ("${parameter}"). The following is a detailed description of what the {{agentName}} observes when looking at it:`;
        break;
      default:
        scenePerceptionHeader = 'Here is a scene snapshot for contextual understanding:';
    }

    const fullSceneDescription = `${scenePerceptionHeader}\n\n${sceneDescription}`;

    /* generate final XML response */
    const responsePrompt = composePromptFromState({
      state,
      template: responseGenerationTemplate(fullSceneDescription),
    });
    let xmlRaw: string;
    try {
      xmlRaw = await runtime.useModel(ModelType.TEXT_LARGE, { prompt: responsePrompt });
    } catch (err) {
      logger.error('Response generator failed:', err);
      if (callback) {
        const responseErrorResponse = {
          thought: 'No response generated.',
          metadata: { error: 'text_large_failure' },
        };
        await callback(responseErrorResponse);
      }
      return {
        text: 'Unable to generate response to visual scene.',
        values: { success: false, error: 'text_large_failure' },
        data: { action: 'HYPERFY_SCENE_PERCEPTION' },
      };
    }

    const parsed = parseKeyValueXml(xmlRaw);

    if (!parsed) {
      if (callback) {
        const parseErrorResponse = {
          thought: 'Malformed XML.',
          metadata: { error: 'xml_parse_failure', xmlRaw },
        };
        await callback(parseErrorResponse);
      }
      return {
        text: 'Unable to process response.',
        values: { success: false, error: 'xml_parse_failure' },
        data: { action: 'HYPERFY_SCENE_PERCEPTION' },
      };
    }

    if (callback) {
      const finalResponse = {
        ...parsed,
        thought: parsed.thought || '',
        text: parsed.text || '',
        emote: parsed.emote || '',
        metadata: { snapshotType, sceneDescription },
      };
      await callback(finalResponse);
    }

    return {
      text: parsed.text || '',
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
    };
  },

  examples: [
    // General observation
    [
      { name: '{{user}}', content: { text: "What's around you right now?" } },
      {
        name: '{{agent}}',
        content: {
          thought:
            'User wants me to observe my current surroundings - I should take a comprehensive look around',
          text: 'Looking around...',
          actions: ['HYPERFY_SCENE_PERCEPTION'],
          source: 'hyperfy',
        },
      },
    ],

    // Spatial direction
    [
      { name: '{{user}}', content: { text: "Can you see what's behind you?" } },
      {
        name: '{{agent}}',
        content: {
          thought: 'User wants me to look in a specific direction - behind me',
          text: 'Checking behind me...',
          actions: ['HYPERFY_SCENE_PERCEPTION'],
          source: 'hyperfy',
        },
      },
    ],

    // Exploration or scouting
    [
      { name: '{{user}}', content: { text: 'Scan the area for any threats or movement.' } },
      {
        name: '{{agent}}',
        content: {
          thought:
            'User wants me to do a tactical scan - I should look around carefully for potential dangers',
          text: 'Scanning the surroundings now...',
          actions: ['HYPERFY_SCENE_PERCEPTION'],
          source: 'hyperfy',
        },
      },
    ],

    // Object-centric look
    [
      {
        name: '{{user}}',
        content: { text: 'Can you take a look at that glowing statue over there?' },
      },
      {
        name: '{{agent}}',
        content: {
          thought:
            'User wants me to examine a specific object - I should focus my vision on the glowing statue',
          text: 'Inspecting the statue...',
          actions: ['HYPERFY_SCENE_PERCEPTION'],
          source: 'hyperfy',
        },
      },
    ],

    // Directional command
    [
      { name: '{{user}}', content: { text: "Look to your left. What's over there?" } },
      {
        name: '{{agent}}',
        content: {
          thought: 'User wants me to look in a specific direction - to my left',
          text: 'Turning left...',
          actions: ['HYPERFY_SCENE_PERCEPTION'],
          source: 'hyperfy',
        },
      },
    ],

    // Subtle curiosity
    [
      { name: '{{user}}', content: { text: 'Anything interesting nearby?' } },
      {
        name: '{{agent}}',
        content: {
          thought:
            'User is asking about interesting things nearby - I should do a general observation',
          text: 'Let me check the surroundings...',
          actions: ['HYPERFY_SCENE_PERCEPTION'],
          source: 'hyperfy',
        },
      },
    ],

    // Tactical evaluation
    [
      {
        name: '{{name1}}',
        content: { text: "Before we move forward, can you check what's up ahead?" },
      },
      {
        name: '{{agent}}',
        content: {
          thought: 'User wants me to scout ahead before we proceed - I should look forward',
          text: 'Checking forward path...',
          actions: ['HYPERFY_SCENE_PERCEPTION'],
          source: 'hyperfy',
        },
      },
    ],

    // Emotional tone: concern
    [
      {
        name: '{{name1}}',
        content: { text: "I feel like we're being watched. Can you look around?" },
      },
      {
        name: '{{agent}}',
        content: {
          thought:
            'User feels unsafe and wants me to check for threats - I should do a careful scan',
          text: 'Doing a quick scan...',
          actions: ['HYPERFY_SCENE_PERCEPTION'],
          source: 'hyperfy',
        },
      },
    ],

    // Humor or roleplay
    [
      {
        name: '{{name1}}',
        content: { text: "Pretend you're a security camera and scan the area!" },
      },
      {
        name: '{{agent}}',
        content: {
          thought: 'User wants me to roleplay as a security camera - I should scan systematically',
          text: 'Activating security cam mode! Scanning...',
          actions: ['HYPERFY_SCENE_PERCEPTION'],
          source: 'hyperfy',
        },
      },
    ],

    // Checking behind an object
    [
      { name: '{{user}}', content: { text: 'Is there anything behind that large crate?' } },
      {
        name: '{{agent}}',
        content: {
          thought:
            "User wants me to check what's hidden behind a specific object - I should focus on that area",
          text: "I'll take a look behind it...",
          actions: ['HYPERFY_SCENE_PERCEPTION'],
          source: 'hyperfy',
        },
      },
    ],
  ],
};
