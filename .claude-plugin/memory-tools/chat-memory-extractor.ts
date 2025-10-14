#!/usr/bin/env node

import Anthropic from "@anthropic-ai/sdk";
import fs from "fs/promises";
import path from "path";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
}

interface ExtractedMemory {
  type: "decision" | "pattern" | "context" | "blocker" | "learning";
  content: string;
  timestamp: string;
  references: string[];
}

interface ExtractedRule {
  category: string;
  rule: string;
  rationale: string;
  examples: string[];
  priority: "high" | "medium" | "low";
}

class ChatMemoryExtractor {
  private client: Anthropic;
  private projectRoot: string;

  constructor(apiKey: string, projectRoot: string) {
    this.client = new Anthropic({ apiKey });
    this.projectRoot = projectRoot;
  }

  async extractMemoriesFromChat(chatHistory: ChatMessage[]): Promise<{
    memories: ExtractedMemory[];
    rules: ExtractedRule[];
    summary: string;
  }> {
    const chatText = this.formatChatHistory(chatHistory);

    const prompt = `You are analyzing a development session chat history for the Hyperscape project.

HYPERSCAPE PROJECT CONTEXT:
- 3D multiplayer game engine built with Three.js
- ElizaOS AI agent framework integration (plugin-hyperscape)
- Real testing philosophy: No mocks, use real worlds with Playwright
- Strong TypeScript typing: No 'any' or 'unknown' types
- RPG features: woodcutting, fishing, cooking, banking, skills
- Visual testing with colored cube proxies (🔴 players, 🟢 goblins, 🔵 items, 🟡 trees, etc.)

CHAT HISTORY:
${chatText}

Extract the following from this chat session:

1. MEMORIES - Important decisions, context, blockers, and learnings:
   - Technical decisions made and why
   - Architecture patterns discovered or chosen
   - Problems encountered and solutions
   - Important context about the codebase
   - Blockers and their resolution status

2. RULES - Development patterns and practices to codify:
   - Coding standards discovered
   - Testing patterns established
   - File organization conventions
   - Architecture decisions to enforce
   - Workflows to automate

Format your response as JSON:
{
  "memories": [
    {
      "type": "decision" | "pattern" | "context" | "blocker" | "learning",
      "content": "Description of the memory",
      "timestamp": "When it occurred",
      "references": ["file paths or code references"]
    }
  ],
  "rules": [
    {
      "category": "coding-standards" | "testing" | "architecture" | "workflow" | "security",
      "rule": "The rule to enforce",
      "rationale": "Why this rule matters",
      "examples": ["Example of following the rule"],
      "priority": "high" | "medium" | "low"
    }
  ],
  "summary": "2-3 sentence summary of the session's key outcomes"
}

Focus on actionable insights and concrete patterns. Ignore casual conversation.`;

    const response = await this.client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 16000,
      messages: [{ role: "user", content: prompt }],
    });

    const textContent = response.content.find((c) => c.type === "text");
    if (!textContent || textContent.type !== "text") {
      throw new Error("No text response from Claude");
    }

    // Extract JSON from potential markdown code blocks
    let jsonText = textContent.text.trim();
    if (jsonText.startsWith("```json")) {
      jsonText = jsonText.replace(/```json\n?/, "").replace(/\n?```$/, "");
    } else if (jsonText.startsWith("```")) {
      jsonText = jsonText.replace(/```\n?/, "").replace(/\n?```$/, "");
    }

    return JSON.parse(jsonText);
  }

  private formatChatHistory(chatHistory: ChatMessage[]): string {
    return chatHistory
      .map((msg, idx) => {
        const role = msg.role === "user" ? "USER" : "ASSISTANT";
        const timestamp = msg.timestamp || `Message ${idx + 1}`;
        return `[${timestamp}] ${role}:\n${msg.content}\n`;
      })
      .join("\n---\n\n");
  }

  async generateMemoryBankFiles(
    memories: ExtractedMemory[],
    rules: ExtractedRule[],
    summary: string
  ) {
    const memoryDir = path.join(this.projectRoot, ".cursor/memory");
    await fs.mkdir(memoryDir, { recursive: true });

    // Generate activeContext.md
    const activeContextContent = this.generateActiveContext(memories, summary);
    await fs.writeFile(path.join(memoryDir, "activeContext.md"), activeContextContent);

    // Generate decisionLog.md
    const decisionLogContent = this.generateDecisionLog(
      memories.filter((m) => m.type === "decision")
    );
    await fs.writeFile(path.join(memoryDir, "decisionLog.md"), decisionLogContent);

    // Generate progress.md
    const progressContent = this.generateProgress(memories);
    await fs.writeFile(path.join(memoryDir, "progress.md"), progressContent);

    // Generate productContext.md
    const productContextContent = this.generateProductContext(
      memories.filter((m) => m.type === "context" || m.type === "pattern")
    );
    await fs.writeFile(path.join(memoryDir, "productContext.md"), productContextContent);

    return {
      activeContext: path.join(memoryDir, "activeContext.md"),
      decisionLog: path.join(memoryDir, "decisionLog.md"),
      progress: path.join(memoryDir, "progress.md"),
      productContext: path.join(memoryDir, "productContext.md"),
    };
  }

  async generateRuleFiles(rules: ExtractedRule[]) {
    const rulesDir = path.join(this.projectRoot, ".cursor/rules");
    await fs.mkdir(rulesDir, { recursive: true });

    const rulesByCategory = this.groupBy(rules, (r) => r.category);
    const generatedFiles: string[] = [];

    for (const [category, categoryRules] of Object.entries(rulesByCategory)) {
      const filename = `${category}.mdc`;
      const content = this.generateRuleFile(category, categoryRules);
      const filePath = path.join(rulesDir, filename);
      await fs.writeFile(filePath, content);
      generatedFiles.push(filePath);
    }

    return generatedFiles;
  }

  private generateActiveContext(memories: ExtractedMemory[], summary: string): string {
    const blockers = memories.filter((m) => m.type === "blocker");
    const recentDecisions = memories.filter((m) => m.type === "decision").slice(-5);

    return `# Active Context

**Last Updated:** ${new Date().toISOString()}

## Session Summary

${summary}

## Current Objectives

${this.formatMemoriesAsList(memories.filter((m) => m.type === "learning"))}

## Active Blockers

${blockers.length > 0 ? this.formatMemoriesAsList(blockers) : "_No active blockers_"}

## Recent Decisions

${this.formatMemoriesAsList(recentDecisions)}

## Key Context

${this.formatMemoriesAsList(memories.filter((m) => m.type === "context").slice(-10))}
`;
  }

  private generateDecisionLog(decisions: ExtractedMemory[]): string {
    return `# Decision Log

**Last Updated:** ${new Date().toISOString()}

## Recent Technical Decisions

${decisions.map((d, idx) => `### ${idx + 1}. ${d.content}

**Timestamp:** ${d.timestamp}
**References:** ${d.references.length > 0 ? d.references.join(", ") : "N/A"}

---

`).join("\n")}
`;
  }

  private generateProgress(memories: ExtractedMemory[]): string {
    const learnings = memories.filter((m) => m.type === "learning");
    const patterns = memories.filter((m) => m.type === "pattern");

    return `# Progress Tracking

**Last Updated:** ${new Date().toISOString()}

## Completed Work

${this.formatMemoriesAsList(learnings)}

## Patterns Established

${this.formatMemoriesAsList(patterns)}

## Next Steps

_To be determined based on current objectives_
`;
  }

  private generateProductContext(memories: ExtractedMemory[]): string {
    return `# Product Context

**Last Updated:** ${new Date().toISOString()}

## Project Overview

Hyperscape is a 3D multiplayer game engine with AI agent integration through ElizaOS.

## Architecture Insights

${this.formatMemoriesAsList(memories.filter((m) => m.type === "pattern"))}

## Key Context

${this.formatMemoriesAsList(memories.filter((m) => m.type === "context"))}

## Technology Stack

- **Engine:** Hyperscape (Three.js-based 3D engine)
- **AI Framework:** ElizaOS with plugin-hyperscape
- **Testing:** Playwright with real world testing
- **Language:** TypeScript (strict, no any/unknown)
- **Features:** RPG skills, visual testing, multi-agent support
`;
  }

  private generateRuleFile(category: string, rules: ExtractedRule[]): string {
    const highPriority = rules.filter((r) => r.priority === "high");
    const mediumPriority = rules.filter((r) => r.priority === "medium");
    const lowPriority = rules.filter((r) => r.priority === "low");

    const categoryTitle = category
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");

    return `---
alwaysApply: ${highPriority.length > 0 ? "true" : "false"}
description: ${categoryTitle} for Hyperscape development
---

# ${categoryTitle}

## High Priority Rules

${highPriority.map((r) => this.formatRule(r)).join("\n\n")}

${mediumPriority.length > 0 ? `## Medium Priority Rules\n\n${mediumPriority.map((r) => this.formatRule(r)).join("\n\n")}` : ""}

${lowPriority.length > 0 ? `## Low Priority Rules\n\n${lowPriority.map((r) => this.formatRule(r)).join("\n\n")}` : ""}
`;
  }

  private formatRule(rule: ExtractedRule): string {
    return `### ${rule.rule}

**Rationale:** ${rule.rationale}

${rule.examples.length > 0 ? `**Examples:**\n${rule.examples.map((e) => `- ${e}`).join("\n")}` : ""}`;
  }

  private formatMemoriesAsList(memories: ExtractedMemory[]): string {
    if (memories.length === 0) return "_None_";
    return memories
      .map((m) => {
        const refs = m.references.length > 0 ? ` (${m.references.join(", ")})` : "";
        return `- **${m.timestamp}:** ${m.content}${refs}`;
      })
      .join("\n");
  }

  private groupBy<T>(array: T[], keyFn: (item: T) => string): Record<string, T[]> {
    return array.reduce(
      (result, item) => {
        const key = keyFn(item);
        if (!result[key]) result[key] = [];
        result[key].push(item);
        return result;
      },
      {} as Record<string, T[]>
    );
  }
}

// CLI Interface
async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("❌ ANTHROPIC_API_KEY environment variable not set");
    process.exit(1);
  }

  const projectRoot = process.env.HYPERSCAPE_PROJECT_ROOT || process.cwd();
  const chatHistoryPath = process.argv[2];

  if (!chatHistoryPath) {
    console.error("❌ Usage: node chat-memory-extractor.js <path-to-chat-history.json>");
    console.error("\nChat history format:");
    console.error(JSON.stringify([
      {
        role: "user",
        content: "message content",
        timestamp: "2025-01-15T10:30:00Z"
      }
    ], null, 2));
    process.exit(1);
  }

  console.log("🧠 Extracting memories from chat history...");

  const chatHistoryFile = await fs.readFile(chatHistoryPath, "utf-8");
  const chatHistory: ChatMessage[] = JSON.parse(chatHistoryFile);

  const extractor = new ChatMemoryExtractor(apiKey, projectRoot);

  const { memories, rules, summary } = await extractor.extractMemoriesFromChat(chatHistory);

  console.log(`\n✅ Extracted ${memories.length} memories and ${rules.length} rules\n`);
  console.log(`📝 Summary: ${summary}\n`);

  console.log("📄 Generating memory bank files...");
  const memoryFiles = await extractor.generateMemoryBankFiles(memories, rules, summary);

  console.log("\n✅ Generated memory bank:");
  for (const [name, file] of Object.entries(memoryFiles)) {
    console.log(`  - ${name}: ${file}`);
  }

  console.log("\n📋 Generating rule files...");
  const ruleFiles = await extractor.generateRuleFiles(rules);

  console.log("\n✅ Generated rules:");
  for (const file of ruleFiles) {
    console.log(`  - ${file}`);
  }

  console.log("\n✨ Memory extraction complete!");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { ChatMemoryExtractor, ChatMessage, ExtractedMemory, ExtractedRule };
