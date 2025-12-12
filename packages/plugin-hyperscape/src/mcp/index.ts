/**
 * MCP Integration for Hyperscape Plugin
 *
 * Exports MCP server and related utilities for enabling
 * Model Context Protocol access to Hyperscape gameplay.
 */

export { HyperscapeMCPServer } from "./server.js";
export type {
  MCPTool,
  MCPResource,
  MCPPrompt,
  MCPToolResult,
  MCPResourceContent,
} from "./server.js";
