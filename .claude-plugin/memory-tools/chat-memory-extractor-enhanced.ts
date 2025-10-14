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
  importance: "high" | "medium" | "low";
  tags: string[];
}

interface ExtractedRule {
  category: string;
  rule: string;
  rationale: string;
  examples: string[];
  priority: "high" | "medium" | "low";
  enforcement: "automatic" | "manual" | "warning";
}

interface MemoryCluster {
  theme: string;
  memories: ExtractedMemory[];
  relatedRules: string[];
}

class ChatMemoryExtractorEnhanced {
  private client: Anthropic;
  private projectRoot: string;
  private memoryCache: Map<string, ExtractedMemory> = new Map();

  constructor(apiKey: string, projectRoot: string) {
    this.client = new Anthropic({ apiKey });
    this.projectRoot = projectRoot;
  }

  async extractMemoriesFromChat(
    chatHistory: ChatMessage[],
    options: {
      incremental?: boolean;
      batchSize?: number;
      enableClustering?: boolean;
    } = {}
  ): Promise<{
    memories: ExtractedMemory[];
    rules: ExtractedRule[];
    summary: string;
    clusters?: MemoryCluster[];
  }> {
    const batchSize = options.batchSize || 50;
    const allMemories: ExtractedMemory[] = [];
    const allRules: ExtractedRule[] = [];

    // Process in batches for large histories
    for (let i = 0; i < chatHistory.length; i += batchSize) {
      const batch = chatHistory.slice(i, i + batchSize);
      const result = await this.processBatch(batch);

      allMemories.push(...result.memories);
      allRules.push(...result.rules);
    }

    // Deduplicate and merge
    const uniqueMemories = this.deduplicateMemories(allMemories);
    const uniqueRules = this.deduplicateRules(allRules);

    // Generate clusters if enabled
    let clusters: MemoryCluster[] | undefined;
    if (options.enableClustering) {
      clusters = this.clusterMemories(uniqueMemories);
    }

    // Generate summary
    const summary = await this.generateSummary(uniqueMemories, uniqueRules);

    return {
      memories: uniqueMemories,
      rules: uniqueRules,
      summary,
      clusters,
    };
  }

  private async processBatch(batch: ChatMessage[]): Promise<{
    memories: ExtractedMemory[];
    rules: ExtractedRule[];
  }> {
    const chatText = this.formatChatHistory(batch);

    const prompt = `You are analyzing a development session chat history for the Hyperscape project.

HYPERSCAPE PROJECT CONTEXT:
- 3D multiplayer game engine built with Three.js
- ElizaOS AI agent framework integration (plugin-hyperscape)
- Real testing philosophy: No mocks, use real worlds with Playwright
- Strong TypeScript typing: No 'any' or 'unknown' types
- RPG features: woodcutting, fishing, cooking, banking, skills
- Visual testing with colored cube proxies (🔴 players, 🟢 goblins, 🔵 items, 🟡 trees, etc.)

CHAT HISTORY BATCH:
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
      "references": ["file paths or code references"],
      "importance": "high" | "medium" | "low",
      "tags": ["relevant", "tags", "for", "categorization"]
    }
  ],
  "rules": [
    {
      "category": "coding-standards" | "testing" | "architecture" | "workflow" | "security",
      "rule": "The rule to enforce",
      "rationale": "Why this rule matters",
      "examples": ["Example of following the rule"],
      "priority": "high" | "medium" | "low",
      "enforcement": "automatic" | "manual" | "warning"
    }
  ]
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

    let jsonText = textContent.text.trim();
    if (jsonText.startsWith("```json")) {
      jsonText = jsonText.replace(/```json\n?/, "").replace(/\n?```$/, "");
    } else if (jsonText.startsWith("```")) {
      jsonText = jsonText.replace(/```\n?/, "").replace(/\n?```$/, "");
    }

    return JSON.parse(jsonText);
  }

  private deduplicateMemories(memories: ExtractedMemory[]): ExtractedMemory[] {
    const seen = new Map<string, ExtractedMemory>();

    for (const memory of memories) {
      const key = `${memory.type}:${memory.content.substring(0, 50)}`;
      const existing = seen.get(key);

      if (!existing || memory.importance === "high") {
        seen.set(key, memory);
      }
    }

    return Array.from(seen.values()).sort((a, b) => {
      const importanceOrder = { high: 0, medium: 1, low: 2 };
      return importanceOrder[a.importance] - importanceOrder[b.importance];
    });
  }

  private deduplicateRules(rules: ExtractedRule[]): ExtractedRule[] {
    const seen = new Map<string, ExtractedRule>();

    for (const rule of rules) {
      const key = `${rule.category}:${rule.rule.substring(0, 50)}`;
      const existing = seen.get(key);

      if (!existing || rule.priority === "high") {
        seen.set(key, rule);
      }
    }

    return Array.from(seen.values()).sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  private clusterMemories(memories: ExtractedMemory[]): MemoryCluster[] {
    const clusters = new Map<string, ExtractedMemory[]>();

    // Simple clustering by tags
    for (const memory of memories) {
      for (const tag of memory.tags) {
        if (!clusters.has(tag)) {
          clusters.set(tag, []);
        }
        clusters.get(tag)!.push(memory);
      }
    }

    // Convert to cluster objects
    return Array.from(clusters.entries())
      .filter(([_, mems]) => mems.length >= 2) // Only clusters with 2+ memories
      .map(([theme, mems]) => ({
        theme,
        memories: mems,
        relatedRules: [],
      }))
      .sort((a, b) => b.memories.length - a.memories.length);
  }

  private async generateSummary(
    memories: ExtractedMemory[],
    rules: ExtractedRule[]
  ): Promise<string> {
    const highImportanceCount = memories.filter((m) => m.importance === "high").length;
    const highPriorityCount = rules.filter((r) => r.priority === "high").length;

    return `Session extracted ${memories.length} memories (${highImportanceCount} high importance) and ${rules.length} rules (${highPriorityCount} high priority). Key focus areas: ${this.getTopTags(memories, 3).join(", ")}.`;
  }

  private getTopTags(memories: ExtractedMemory[], count: number): string[] {
    const tagCounts = new Map<string, number>();

    for (const memory of memories) {
      for (const tag of memory.tags) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }
    }

    return Array.from(tagCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, count)
      .map(([tag]) => tag);
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
    summary: string,
    clusters?: MemoryCluster[]
  ) {
    const memoryDir = path.join(this.projectRoot, ".cursor/memory");
    await fs.mkdir(memoryDir, { recursive: true });

    // Generate activeContext.md
    const activeContextContent = this.generateActiveContext(memories, summary, clusters);
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

    // Generate insights.md (new: clustered insights)
    if (clusters && clusters.length > 0) {
      const insightsContent = this.generateInsights(clusters);
      await fs.writeFile(path.join(memoryDir, "insights.md"), insightsContent);
    }

    return {
      activeContext: path.join(memoryDir, "activeContext.md"),
      decisionLog: path.join(memoryDir, "decisionLog.md"),
      progress: path.join(memoryDir, "progress.md"),
      productContext: path.join(memoryDir, "productContext.md"),
      insights: clusters ? path.join(memoryDir, "insights.md") : undefined,
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

  private generateActiveContext(
    memories: ExtractedMemory[],
    summary: string,
    clusters?: MemoryCluster[]
  ): string {
    const blockers = memories.filter((m) => m.type === "blocker");
    const recentDecisions = memories.filter((m) => m.type === "decision").slice(-5);
    const highImportance = memories.filter((m) => m.importance === "high");

    let content = `# Active Context\n\n**Last Updated:** ${new Date().toISOString()}\n\n`;
    content += `## Session Summary\n\n${summary}\n\n`;

    if (highImportance.length > 0) {
      content += `## High Importance Items\n\n`;
      content += this.formatMemoriesAsList(highImportance) + "\n\n";
    }

    content += `## Current Objectives\n\n`;
    content += this.formatMemoriesAsList(memories.filter((m) => m.type === "learning")) + "\n\n";

    content += `## Active Blockers\n\n`;
    content += (blockers.length > 0 ? this.formatMemoriesAsList(blockers) : "_No active blockers_") + "\n\n";

    content += `## Recent Decisions\n\n`;
    content += this.formatMemoriesAsList(recentDecisions) + "\n\n";

    if (clusters && clusters.length > 0) {
      content += `## Key Themes\n\n`;
      clusters.slice(0, 5).forEach((cluster) => {
        content += `- **${cluster.theme}** (${cluster.memories.length} related items)\n`;
      });
    }

    return content;
  }

  private generateDecisionLog(decisions: ExtractedMemory[]): string {
    return `# Decision Log\n\n**Last Updated:** ${new Date().toISOString()}\n\n## Recent Technical Decisions\n\n${decisions
      .map(
        (d, idx) => `### ${idx + 1}. ${d.content}\n\n**Timestamp:** ${d.timestamp}\n**Importance:** ${d.importance}\n**References:** ${d.references.length > 0 ? d.references.join(", ") : "N/A"}\n**Tags:** ${d.tags.join(", ")}\n\n---\n\n`
      )
      .join("\n")}`;
  }

  private generateProgress(memories: ExtractedMemory[]): string {
    const learnings = memories.filter((m) => m.type === "learning");
    const patterns = memories.filter((m) => m.type === "pattern");

    return `# Progress Tracking\n\n**Last Updated:** ${new Date().toISOString()}\n\n## Completed Work\n\n${this.formatMemoriesAsList(learnings)}\n\n## Patterns Established\n\n${this.formatMemoriesAsList(patterns)}\n\n## Next Steps\n\n_To be determined based on current objectives_`;
  }

  private generateProductContext(memories: ExtractedMemory[]): string {
    return `# Product Context\n\n**Last Updated:** ${new Date().toISOString()}\n\n## Project Overview\n\nHyperscape is a 3D multiplayer game engine with AI agent integration through ElizaOS.\n\n## Architecture Insights\n\n${this.formatMemoriesAsList(memories.filter((m) => m.type === "pattern"))}\n\n## Key Context\n\n${this.formatMemoriesAsList(memories.filter((m) => m.type === "context"))}\n\n## Technology Stack\n\n- **Engine:** Hyperscape (Three.js-based 3D engine)\n- **AI Framework:** ElizaOS with plugin-hyperscape\n- **Testing:** Playwright with real world testing\n- **Language:** TypeScript (strict, no any/unknown)\n- **Features:** RPG skills, visual testing, multi-agent support`;
  }

  private generateInsights(clusters: MemoryCluster[]): string {
    let content = `# Insights\n\n**Last Updated:** ${new Date().toISOString()}\n\n## Clustered Themes\n\n`;

    clusters.forEach((cluster, idx) => {
      content += `### ${idx + 1}. ${cluster.theme} (${cluster.memories.length} items)\n\n`;
      content += this.formatMemoriesAsList(cluster.memories) + "\n\n";
    });

    return content;
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
    return `### ${rule.rule}\n\n**Rationale:** ${rule.rationale}\n**Enforcement:** ${rule.enforcement}\n\n${rule.examples.length > 0 ? `**Examples:**\n${rule.examples.map((e) => `- ${e}`).join("\n")}` : ""}`;
  }

  private formatMemoriesAsList(memories: ExtractedMemory[]): string {
    if (memories.length === 0) return "_None_";
    return memories
      .map((m) => {
        const refs = m.references.length > 0 ? ` (${m.references.join(", ")})` : "";
        const tags = m.tags.length > 0 ? ` [${m.tags.join(", ")}]` : "";
        return `- **${m.timestamp}:** ${m.content}${refs}${tags}`;
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

  // Incremental update support
  async loadExistingMemories(): Promise<void> {
    try {
      const memoryDir = path.join(this.projectRoot, ".cursor/memory");
      const files = await fs.readdir(memoryDir);
      // Load and parse existing memories
      // This would implement incremental updates
    } catch (error) {
      // No existing memories, starting fresh
    }
  }

  async mergeWithExisting(newMemories: ExtractedMemory[]): Promise<ExtractedMemory[]> {
    // Merge new memories with cached ones
    for (const memory of newMemories) {
      const key = `${memory.type}:${memory.timestamp}`;
      this.memoryCache.set(key, memory);
    }
    return Array.from(this.memoryCache.values());
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
  const enableClustering = process.argv.includes("--cluster");
  const incremental = process.argv.includes("--incremental");

  if (!chatHistoryPath) {
    console.error("❌ Usage: node chat-memory-extractor-enhanced.js <path-to-chat-history.json> [--cluster] [--incremental]");
    process.exit(1);
  }

  console.log("🧠 Extracting memories from chat history (Enhanced Mode)...");

  const chatHistoryFile = await fs.readFile(chatHistoryPath, "utf-8");
  const chatHistory: ChatMessage[] = JSON.parse(chatHistoryFile);

  const extractor = new ChatMemoryExtractorEnhanced(apiKey, projectRoot);

  if (incremental) {
    await extractor.loadExistingMemories();
  }

  const { memories, rules, summary, clusters } = await extractor.extractMemoriesFromChat(
    chatHistory,
    {
      incremental,
      enableClustering,
      batchSize: 50,
    }
  );

  console.log(`\n✅ Extracted ${memories.length} memories and ${rules.length} rules\n`);
  console.log(`📝 Summary: ${summary}\n`);

  if (clusters) {
    console.log(`🔍 Found ${clusters.length} thematic clusters\n`);
  }

  console.log("📄 Generating memory bank files...");
  const memoryFiles = await extractor.generateMemoryBankFiles(memories, rules, summary, clusters);

  console.log("\n✅ Generated memory bank:");
  for (const [name, file] of Object.entries(memoryFiles)) {
    if (file) {
      console.log(`  - ${name}: ${file}`);
    }
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

export { ChatMemoryExtractorEnhanced, ChatMessage, ExtractedMemory, ExtractedRule, MemoryCluster };
