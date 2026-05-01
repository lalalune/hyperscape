/**
 * `runAgentLoop` — drives a multi-turn tool-use conversation
 * between an LLM and a set of ElizaOS actions.
 *
 * The loop:
 *
 *   1. Send the conversation + tools to the LLM.
 *   2. If the LLM emits `tool_use` blocks: dispatch each to the
 *      matching action handler, capture the ActionResult, append a
 *      `tool_result` block to the conversation.
 *   3. Repeat until the LLM stops emitting tool calls (`stop_reason
 *      !== "tool_use"`) — that's the agent's final answer.
 *   4. Return the full transcript plus a captured `lastUIPack` if
 *      `PROPOSE_UI_PACK` was called successfully — the host's
 *      easiest way to pluck the artifact off the run.
 *
 * The LLM client is pluggable. `LLMClient.sendMessage` can be the
 * real Anthropic SDK or a `FakeLLM` that scripts responses for
 * unit tests. This lets us test the dispatcher without spending
 * API calls.
 */

import type {
  Action,
  IAgentRuntime,
  HandlerCallback,
  ActionResult,
  Memory,
  Content,
} from "@elizaos/core";
import type {
  Message,
  MessageParam,
  Tool,
  ToolUseBlock,
  TextBlockParam,
  ImageBlockParam,
  ToolUseBlockParam,
  ToolResultBlockParam,
} from "@anthropic-ai/sdk/resources/messages";
import { actionsToAnthropicTools } from "./adapter.js";

export type ContentBlockParam =
  | TextBlockParam
  | ImageBlockParam
  | ToolUseBlockParam
  | ToolResultBlockParam;

/**
 * The minimum LLM surface the loop needs. Implemented by the
 * Anthropic SDK out of the box (its `messages.create` returns a
 * `Message` matching this shape).
 */
export interface LLMClient {
  sendMessage(request: SendMessageRequest): Promise<Message>;
}

export interface SendMessageRequest {
  readonly model: string;
  readonly system?: string;
  readonly messages: ReadonlyArray<MessageParam>;
  readonly tools: ReadonlyArray<Tool>;
  readonly max_tokens: number;
}

export interface RunAgentLoopOptions {
  /** Initial conversation. Usually a single user-role message. */
  readonly messages: ReadonlyArray<MessageParam>;
  /** Available actions. Converted to tools and dispatched on call. */
  readonly actions: ReadonlyArray<Action>;
  /** Runtime the action handlers receive when dispatched. */
  readonly runtime: IAgentRuntime;
  /** LLM provider — usually a wrapped Anthropic client. */
  readonly llm: LLMClient;
  /** Model id. Defaults to "claude-sonnet-4-5". */
  readonly model?: string;
  /** Optional system prompt applied to every turn. */
  readonly system?: string;
  /** Maximum loop iterations before giving up. Default 10. */
  readonly maxTurns?: number;
  /** Per-call max tokens. Default 4096. */
  readonly maxTokens?: number;
  /**
   * Optional progress callback invoked after every assistant turn —
   * useful for streaming logs to a UI/CLI without buffering the full
   * transcript in memory.
   */
  readonly onTurn?: (turn: TurnRecord) => void;
}

/** Info about one assistant turn — what tools were called, what came back. */
export interface TurnRecord {
  readonly turn: number;
  readonly assistant: Message;
  readonly toolCalls: ReadonlyArray<{
    readonly name: string;
    readonly input: unknown;
    readonly result: ActionResult | undefined;
  }>;
}

export interface RunAgentLoopResult {
  /** Full conversation, including every assistant + tool_result turn. */
  readonly messages: ReadonlyArray<MessageParam>;
  /** One TurnRecord per assistant message. */
  readonly turns: ReadonlyArray<TurnRecord>;
  /** Plain-text concatenation of every assistant `text` block. */
  readonly finalText: string;
  /**
   * If `PROPOSE_UI_PACK` was dispatched successfully during the run,
   * the validated pack JSON; otherwise undefined.
   */
  readonly lastUIPack: unknown;
  /** True when the loop ended because the LLM stopped calling tools. */
  readonly finished: boolean;
  /** True when we hit `maxTurns` without a natural stop. */
  readonly truncated: boolean;
}

const DEFAULT_MODEL = "claude-sonnet-4-5";

export async function runAgentLoop(
  options: RunAgentLoopOptions,
): Promise<RunAgentLoopResult> {
  const tools = actionsToAnthropicTools(options.actions);
  const actionByName = new Map(options.actions.map((a) => [a.name, a]));
  const messages: MessageParam[] = options.messages.slice();
  const turns: TurnRecord[] = [];
  const maxTurns = options.maxTurns ?? 10;
  const maxTokens = options.maxTokens ?? 4096;
  const model = options.model ?? DEFAULT_MODEL;

  let lastUIPack: unknown = undefined;
  let finished = false;

  for (let turn = 0; turn < maxTurns; turn++) {
    const response = await options.llm.sendMessage({
      model,
      system: options.system,
      messages,
      tools,
      max_tokens: maxTokens,
    });

    // Append the assistant message verbatim — Anthropic requires the
    // exact tool_use blocks to be echoed back as the `assistant` turn
    // so subsequent `tool_result` blocks can refer to them by id.
    messages.push({
      role: "assistant",
      content: response.content as ContentBlockParam[],
    });

    const toolUses = response.content.filter(
      (b): b is ToolUseBlock => b.type === "tool_use",
    );

    const toolCallRecords: Array<{
      name: string;
      input: unknown;
      result: ActionResult | undefined;
    }> = [];

    if (toolUses.length === 0) {
      turns.push({ turn, assistant: response, toolCalls: [] });
      options.onTurn?.({ turn, assistant: response, toolCalls: [] });
      finished = response.stop_reason !== "tool_use";
      break;
    }

    // Dispatch every tool call; each becomes one tool_result block.
    const toolResults: ToolResultBlockParam[] = [];
    for (const use of toolUses) {
      const action = actionByName.get(use.name);
      if (!action) {
        toolResults.push({
          type: "tool_result",
          tool_use_id: use.id,
          content: `Tool not found: ${use.name}`,
          is_error: true,
        });
        toolCallRecords.push({
          name: use.name,
          input: use.input,
          result: undefined,
        });
        continue;
      }

      const result = await dispatchAction(action, use, options.runtime);
      toolCallRecords.push({
        name: use.name,
        input: use.input,
        result,
      });

      if (use.name === "PROPOSE_UI_PACK" && result?.success && result.data) {
        const pack = (result.data as { pack?: unknown }).pack;
        if (pack !== undefined) lastUIPack = pack;
      }

      toolResults.push({
        type: "tool_result",
        tool_use_id: use.id,
        content: formatActionResultForLLM(result),
        is_error: result?.success === false,
      });
    }

    messages.push({ role: "user", content: toolResults });
    turns.push({ turn, assistant: response, toolCalls: toolCallRecords });
    options.onTurn?.({ turn, assistant: response, toolCalls: toolCallRecords });

    if (response.stop_reason !== "tool_use") {
      finished = true;
      break;
    }
  }

  const finalText = lastAssistantText(messages);
  const truncated = !finished;

  return {
    messages,
    turns,
    finalText,
    lastUIPack,
    finished,
    truncated,
  };
}

async function dispatchAction(
  action: Action,
  use: ToolUseBlock,
  runtime: IAgentRuntime,
): Promise<ActionResult | undefined> {
  // The action handler reads parameters from `options.parameters`
  // (the ElizaOS convention) — wrap the LLM's tool input accordingly.
  // Cast through `unknown` because Anthropic tool inputs are arbitrary
  // JSON, but ElizaOS's HandlerOptions is narrowly typed.
  const options = {
    parameters: use.input as Record<string, unknown>,
  } as unknown as Parameters<Action["handler"]>[3];

  // Stub message; handlers don't typically inspect it once parameters
  // are extracted but the type requires a value.
  const message = {
    id: "tool-use" as unknown as Memory["id"],
    entityId: "agent" as unknown as Memory["entityId"],
    roomId: "agent" as unknown as Memory["roomId"],
    content: { text: JSON.stringify(use.input) },
    createdAt: Date.now(),
  } as unknown as Memory;

  // Discard callback chunks — the LLM doesn't consume them.
  const callback: HandlerCallback = async (_c: Content) => [];

  return action.handler(runtime, message, undefined, options, callback);
}

function formatActionResultForLLM(result: ActionResult | undefined): string {
  if (!result) {
    return "(action returned no result)";
  }
  // Prefer the `text` field — it's the human-readable summary the
  // action prepares for chat output. Fall back to JSON when text is
  // missing but data is available.
  if (typeof result.text === "string" && result.text.length > 0) {
    return result.text;
  }
  if (result.data !== undefined) {
    try {
      return JSON.stringify(result.data, null, 2);
    } catch {
      return String(result.data);
    }
  }
  if (result.error) {
    return result.error instanceof Error
      ? result.error.message
      : String(result.error);
  }
  return result.success ? "(success, empty result)" : "(failure, empty result)";
}

function lastAssistantText(messages: ReadonlyArray<MessageParam>): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i]!;
    if (m.role !== "assistant") continue;
    if (typeof m.content === "string") return m.content;
    const texts = m.content
      .filter((b): b is TextBlockParam => b.type === "text")
      .map((b) => b.text);
    if (texts.length > 0) return texts.join("\n");
  }
  return "";
}
