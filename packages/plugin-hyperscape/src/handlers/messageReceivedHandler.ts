import {
  parseKeyValueXml,
  HandlerCallback,
  IAgentRuntime,
  Memory,
  State,
  Content,
  elizaLogger,
  createUniqueUuid,
  ModelType,
} from '@elizaos/core'
import {
  composeContext,
  generateMessageResponse,
  shouldRespond,
} from '../utils/ai-helpers'
import type { ChatMessage } from '../types/core-types'

interface MessageContext {
  userId: string
  roomId: string
  content: string
}

interface MessageHandlerOptions {
  runtime: IAgentRuntime
  message: Memory
  callback?: HandlerCallback
  onComplete?: () => void
}

interface ResponseData {
  text?: string
  action?: string
  emote?: string
  message?: string
}

export async function messageReceivedHandler({
  runtime,
  message,
  callback,
  onComplete,
}: MessageHandlerOptions): Promise<void> {
  elizaLogger.info(`[MessageHandler] Processing message: ${message.id}`)

  // Check if we should respond to this message
  const state = await runtime.composeState(message as Memory)
  const shouldRespondToMessage = await shouldRespond(
    runtime,
    message as Memory,
    state
  )

  if (!shouldRespondToMessage) {
    elizaLogger.debug('[MessageHandler] Determined not to respond to message')
    onComplete!()
    return
  }

  // Generate response using proper context
  const context = await composeContext({
    state,
    template: `
# Message Response Instructions

You are responding to a message in a virtual world. Generate an appropriate response.

## Message Context
    Sender: {{message.userId}}
Content: "{{message.content.text}}"
World: {{message.metadata?.hyperscape?.worldId || 'unknown'}}

## Response Guidelines
- Be conversational and helpful
- Reference the virtual world context when relevant  
- Keep responses natural and engaging
- Use emotes when appropriate

Generate your response with any of these optional elements:
<text>Your verbal response</text>
<emote>name_of_emote</emote>
<action>specific_action_to_take</action>
      `,
  })

  const response = await generateMessageResponse({
    runtime,
    context,
    modelType: ModelType.TEXT_LARGE,
  })

  // Parse response for actions
  const parsedResponse = parseKeyValueXml(response.text) as ResponseData

  const responseContent: Content = {
    text: parsedResponse.text || response.text,
    action: parsedResponse.action,
    metadata: {
      emote: parsedResponse.emote,
      originalMessage: message.id,
    },
  }

  await callback!(responseContent)

  elizaLogger.info(
    `[MessageHandler] Successfully processed message: ${message.id}`
  )
  onComplete!()
}
