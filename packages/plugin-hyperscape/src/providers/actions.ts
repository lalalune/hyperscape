import type {
  Action,
  IAgentRuntime,
  Memory,
  Provider,
  State,
} from "@elizaos/core";
import {
  addHeader,
  composeActionExamples,
  formatActionNames,
} from "@elizaos/core";
import { getHyperscapeActions, formatActions } from "../utils";

/**
 * A provider object that fetches possible response actions based on the provided runtime, message, and state.
 * @type {Provider}
 * @property {string} name - The name of the provider ("ACTIONS").
 * @property {string} description - The description of the provider ("Possible response actions").
 * @property {number} position - The position of the provider (-1).
 * @property {Function} get - Asynchronous function that retrieves actions that validate for the given message.
 * @param {IAgentRuntime} runtime - The runtime object.
 * @param {Memory} message - The message memory.
 * @param {State} state - The state object.
 * @returns {Object} An object containing the actions data, values, and combined text sections.
 */
/**
 * Provider for ACTIONS
 *
 * @typedef {import('./Provider').Provider} Provider
 * @typedef {import('./Runtime').IAgentRuntime} IAgentRuntime
 * @typedef {import('./Memory').Memory} Memory
 * @typedef {import('./State').State} State
 * @typedef {import('./Action').Action} Action
 *
 * @type {Provider}
 * @property {string} name - The name of the provider
 * @property {string} description - Description of the provider
 * @property {number} position - The position of the provider
 * @property {Function} get - Asynchronous function to get actions that validate for a given message
 *
 * @param {IAgentRuntime} runtime - The agent runtime
 * @param {Memory} message - The message memory
 * @param {State} state - The state of the agent
 * @returns {Object} Object containing data, values, and text related to actions
 */
export const hyperscapeActionsProvider: Provider = {
  name: "ACTIONS",
  description: "Possible response actions",
  position: -1,
  get: async (runtime: IAgentRuntime, message: Memory, state: State) => {
    const actionsData = await getHyperscapeActions(runtime, message, state); // ← no includeList passed here

    const actionNames = `Possible response actions: ${formatActionNames(actionsData)}`;
    const actions =
      actionsData.length > 0
        ? addHeader("# Available Actions", formatActions(actionsData))
        : "";
    const actionExamples =
      actionsData.length > 0
        ? addHeader("# Action Examples", composeActionExamples(actionsData as Action[], 10))
        : "";

    const data = { actionsData };
    const values = { actions, actionNames, actionExamples };
    const text = [actionNames, actionExamples, actions]
      .filter(Boolean)
      .join("\n\n");

    return { data, values, text };
  },
};
