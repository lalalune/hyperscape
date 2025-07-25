import { MessagePayload, HandlerCallback } from '@elizaos/core'
import { hyperfyMessageReceivedHandler } from './handlers/messageReceivedHandler'

export enum hyperfyEventType {
  MESSAGE_RECEIVED = 'HYPERFY_MESSAGE_RECEIVED',
  VOICE_MESSAGE_RECEIVED = 'HYPERFY_VOICE_MESSAGE_RECEIVED',
  CONTENT_LOADED = 'HYPERFY_CONTENT_LOADED',
  CONTENT_UNLOADED = 'HYPERFY_CONTENT_UNLOADED',
}

// Alias for backward compatibility
export const EventType = hyperfyEventType

const defaultCallback: HandlerCallback = async () => []

export const hyperfyEvents = {
  [hyperfyEventType.MESSAGE_RECEIVED]: [
    async (payload: MessagePayload) => {
      await hyperfyMessageReceivedHandler({
        // @ts-ignore - Runtime type issue
        runtime: payload.runtime,
        message: payload.message,
        callback: payload.callback || defaultCallback,
        onComplete: payload.onComplete,
      })
    },
  ],

  [hyperfyEventType.VOICE_MESSAGE_RECEIVED]: [
    async (payload: MessagePayload) => {
      await hyperfyMessageReceivedHandler({
        // @ts-ignore - Runtime type issue
        runtime: payload.runtime,
        message: payload.message,
        callback: payload.callback || defaultCallback,
        onComplete: payload.onComplete,
      })
    },
  ],

  CONTROL_MESSAGE: [],
}
