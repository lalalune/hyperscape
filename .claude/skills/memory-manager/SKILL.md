---
name: memory-manager
description: Manage elizaOS agent memory, context windows, and conversation history. Triggers on "manage memory", "optimize context", or "handle agent memory"
allowed-tools: [Read, Edit, Bash]
---

# Memory Manager Skill

Optimize agent memory usage, implement pruning strategies, and manage conversation context effectively.

## Capabilities

1. 🧠 Memory pruning and optimization
2. 📊 Context window management
3. 🗂️ Conversation history archiving
4. 🎯 Important memory consolidation
5. 🔄 Memory decay implementation
6. 📈 Memory usage monitoring

## Memory Types

### Short-term Memory
- Current conversation context
- Working memory (max 50 items default)
- Cleared per session

### Long-term Memory
- Important facts and information
- Persistent across sessions
- Decay modeling over time

### Knowledge
- Static facts from configuration
- Document-based knowledge
- Dynamically learned information

## Memory Operations

```typescript
// Create memory
await runtime.createMemory({
  entityId: userId,
  roomId: conversationId,
  content: {
    text: 'Important information',
    metadata: { importance: 'high' }
  },
  embedding: await generateEmbedding(text)
});

// Retrieve memories
const memories = await runtime.getMemories({
  roomId: conversationId,
  limit: 10,
  unique: true
});

// Search semantically
const results = await runtime.searchMemories(
  'query text',
  {
    roomId: conversationId,
    limit: 5,
    minScore: 0.7
  }
);

// Update memory
await runtime.updateMemory({
  id: memoryId,
  content: { ...updated content },
  metadata: { lastAccessed: Date.now() }
});
```

## Pruning Strategies

### Time-based Pruning
```typescript
async function pruneOldMemories(
  runtime: IAgentRuntime,
  daysToKeep: number = 30
): Promise<number> {
  const cutoffDate = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);

  const oldMemories = await runtime.getMemories({
    createdBefore: cutoffDate,
    importance: 'low'
  });

  for (const memory of oldMemories) {
    await runtime.deleteMemory(memory.id);
  }

  return oldMemories.length;
}
```

### Size-based Pruning
```typescript
async function pruneLargeMemories(
  runtime: IAgentRuntime,
  maxSize: number = 1000
): Promise<void> {
  const memories = await runtime.getMemories({ limit: 10000 });

  if (memories.length > maxSize) {
    // Keep most important and recent
    const toKeep = rankMemoriesByImportance(memories).slice(0, maxSize);
    const toDelete = memories.filter(m => !toKeep.includes(m));

    for (const memory of toDelete) {
      await runtime.deleteMemory(memory.id);
    }
  }
}
```

## Best Practices

1. Set appropriate `conversationLength` limits
2. Implement importance scoring
3. Use memory decay for temporal relevance
4. Archive important conversations
5. Monitor memory growth
6. Prune regularly
7. Use embeddings for semantic search
8. Cache frequently accessed memories
9. Batch memory operations
10. Index memories properly
