import { MessagePayload, HandlerCallback, IAgentRuntime } from "@elizaos/core";
import { messageReceivedHandler } from "./handlers/messageReceivedHandler";

export enum hyperiaEventType {
  MESSAGE_RECEIVED = "HYPERIA_MESSAGE_RECEIVED",
  VOICE_MESSAGE_RECEIVED = "HYPERIA_VOICE_MESSAGE_RECEIVED",
  CONTENT_LOADED = "HYPERIA_CONTENT_LOADED",
  CONTENT_UNLOADED = "HYPERIA_CONTENT_UNLOADED",
}

// Alias for backward compatibility
export const EventType = hyperiaEventType;

const defaultCallback: HandlerCallback = async () => [];

export const hyperiaEvents = {
  [hyperiaEventType.MESSAGE_RECEIVED]: [
    async (payload: MessagePayload) => {
      await messageReceivedHandler({
        runtime: payload.runtime as IAgentRuntime,
        message: payload.message,
        callback: payload.callback || defaultCallback,
        onComplete: payload.onComplete,
      });
    },
  ],

  [hyperiaEventType.VOICE_MESSAGE_RECEIVED]: [
    async (payload: MessagePayload) => {
      await messageReceivedHandler({
        runtime: payload.runtime as IAgentRuntime,
        message: payload.message,
        callback: payload.callback || defaultCallback,
        onComplete: payload.onComplete,
      });
    },
  ],

  CONTROL_MESSAGE: [],
};
