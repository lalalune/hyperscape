import { describe, expect, it, vi } from "vitest";
import { messageReceivedHandler } from "../handlers/messageReceivedHandler";
import { messageRoute } from "../routes/message";

function createRuntime(evaluateResult: boolean | unknown[]) {
  return {
    agentId: "agent-1",
    evaluate: vi.fn().mockResolvedValue(evaluateResult),
    composeState: vi.fn(),
    createMemory: vi.fn().mockResolvedValue(undefined),
  };
}

function createResponseRecorder() {
  return {
    payload: undefined as unknown,
    statusCode: 200,
    json(payload: unknown) {
      this.payload = payload;
      return payload;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
  };
}

describe("message response gating", () => {
  it("skips composeState in messageReceivedHandler when evaluators do not request a response", async () => {
    const runtime = createRuntime([]);
    const onComplete = vi.fn();

    await messageReceivedHandler({
      runtime: runtime as never,
      message: {
        id: "message-1",
        content: { text: "hello" },
      } as never,
      onComplete,
    });

    expect(runtime.evaluate).toHaveBeenCalled();
    expect(runtime.composeState).not.toHaveBeenCalled();
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("skips composeState in messageRoute but still stores ignored messages", async () => {
    const runtime = createRuntime(false);
    const response = createResponseRecorder();

    await messageRoute.handler(
      {
        body: {
          content: "hello",
        },
      } as never,
      response as never,
      runtime as never,
    );

    expect(runtime.evaluate).toHaveBeenCalled();
    expect(runtime.composeState).not.toHaveBeenCalled();
    expect(runtime.createMemory).toHaveBeenCalledTimes(1);
    expect(response.statusCode).toBe(200);
    expect(response.payload).toEqual({
      text: "I received your message but don't have anything to say right now.",
    });
  });
});
