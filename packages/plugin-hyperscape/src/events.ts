import { MessagePayload, HandlerCallback } from "@elizaos/core";
import { handleMessage } from "./handlers/native-message-handler";

export enum hyperscapeEventType {
  MESSAGE_RECEIVED = "HYPERSCAPE_MESSAGE_RECEIVED",
  VOICE_MESSAGE_RECEIVED = "HYPERSCAPE_VOICE_MESSAGE_RECEIVED",
  CONTENT_LOADED = "HYPERSCAPE_CONTENT_LOADED",
  CONTENT_UNLOADED = "HYPERSCAPE_CONTENT_UNLOADED",
}

// Alias for backward compatibility
export const EventType = hyperscapeEventType;

const defaultCallback: HandlerCallback = async () => [];

/**
 * Native event handlers - process messages internally without bootstrap
 */
export const hyperscapeEvents = {
  [hyperscapeEventType.MESSAGE_RECEIVED]: [
    async (payload: MessagePayload) => {
      await handleMessage({
        runtime: payload.runtime,
        message: payload.message,
        callback: payload.callback || defaultCallback,
        onComplete: payload.onComplete,
      });
    },
  ],

  [hyperscapeEventType.VOICE_MESSAGE_RECEIVED]: [
    async (payload: MessagePayload) => {
        await handleMessage({
        runtime: payload.runtime,
        message: payload.message,
        callback: payload.callback || defaultCallback,
        onComplete: payload.onComplete,
      });
    },
  ],

  CONTROL_MESSAGE: [],
};
