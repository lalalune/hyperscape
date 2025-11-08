---
name: knowledge-base-builder
description: Create and optimize elizaOS knowledge bases with RAG, embeddings, and semantic search. Triggers on "create knowledge base", "build RAG system", or "setup agent knowledge"
allowed-tools: [Write, Read, Edit, Grep, Glob, Bash]
---

# Knowledge Base Builder Skill

Build production-ready knowledge bases for elizaOS agents with document ingestion, embeddings, and semantic retrieval.

## When to Use

- "Create a knowledge base for [domain]"
- "Build RAG system with [documents]"
- "Setup agent knowledge from [sources]"
- "Implement semantic search for agent"

## Capabilities

1. 📚 Document ingestion (markdown, PDF, text)
2. ✂️ Smart chunking strategies
3. 🔍 Embedding generation
4. 🗄️ Vector storage configuration
5. 🎯 Semantic search optimization
6. 🔄 Knowledge updates and versioning
7. 📊 Knowledge quality metrics

## Workflow

### Phase 1: Knowledge Requirements

**Questions to ask:**
1. What domain expertise is needed?
2. What document sources exist?
3. How often does knowledge change?
4. What query patterns expected?

### Phase 2: Knowledge Structure

```
knowledge/
├── {domain}/
│   ├── README.md           # Overview
│   ├── core-concepts.md    # Fundamental knowledge
│   ├── procedures.md       # Step-by-step guides
│   ├── faq.md             # Common questions
│   ├── examples.md        # Use case examples
│   └── glossary.md        # Terminology
└── embeddings/
    └── {domain}.json       # Pre-computed embeddings
```

### Phase 3: Document Format

```markdown
# {Topic Title}

## Summary
{Brief overview for quick reference}

## Key Concepts
- {Concept 1}: {Definition}
- {Concept 2}: {Definition}

## Detailed Explanation
{Comprehensive information}

## Examples
```{language}
{Code or usage examples}
```

## Related Topics
- [{Topic}](./related-topic.md)

## Last Updated
{Date}
```

### Phase 4: Character Integration

```typescript
export const character: Character = {
  // ... other config

  knowledge: [
    // Simple facts
    "Core fact about {domain}",
    "Important principle in {domain}",

    // File references
    {
      path: "./knowledge/{domain}/core-concepts.md",
      shared: true  // Available to all agents
    },

    // Directory loading
    {
      directory: "./knowledge/{domain}",
      shared: false  // Agent-specific
    }
  ],

  // Configure knowledge plugin
  plugins: [
    '@elizaos/plugin-knowledge',
    // ... other plugins
  ],

  settings: {
    // Embedding configuration
    embeddingModel: 'text-embedding-3-small',
    embeddingDimensions: 1536,

    // Retrieval settings
    knowledgeTopK: 5,            // Top results to return
    knowledgeMinScore: 0.7,       // Minimum similarity
    knowledgeDecay: 0.95,         // Time decay factor

    // Chunking strategy
    chunkSize: 1000,              // Characters per chunk
    chunkOverlap: 200,            // Overlap between chunks
  }
};
```

### Phase 5: Chunking Strategies

**Strategy 1: Fixed Size** (simple, balanced)
```typescript
function chunkFixedSize(text: string, size: number, overlap: number): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + size, text.length);
    chunks.push(text.slice(start, end));
    start += size - overlap;
  }

  return chunks;
}
```

**Strategy 2: Semantic** (intelligent, context-aware)
```typescript
function chunkSemantic(text: string): string[] {
  // Split on headers and sections
  const sections = text.split(/\n#{1,6}\s/);

  // Further split large sections
  return sections.flatMap(section => {
    if (section.length > 1000) {
      return chunkByParagraph(section);
    }
    return [section];
  });
}
```

**Strategy 3: Sliding Window** (comprehensive, overlapping)
```typescript
function chunkSlidingWindow(text: string, windowSize: number, step: number): string[] {
  const chunks: string[] = [];

  for (let i = 0; i < text.length; i += step) {
    const chunk = text.slice(i, i + windowSize);
    if (chunk.trim().length > 0) {
      chunks.push(chunk);
    }
  }

  return chunks;
}
```

### Phase 6: Embedding Optimization

```typescript
// Batch embedding generation
async function generateEmbeddings(
  chunks: string[],
  model: string = 'text-embedding-3-small'
): Promise<number[][]> {
  const batchSize = 100;
  const embeddings: number[][] = [];

  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);

    const response = await openai.embeddings.create({
      model,
      input: batch,
    });

    embeddings.push(...response.data.map(d => d.embedding));
  }

  return embeddings;
}
```

### Phase 7: Search Implementation

```typescript
// Semantic search with hybrid ranking
async function searchKnowledge(
  query: string,
  runtime: IAgentRuntime,
  topK: number = 5
): Promise<Memory[]> {
  // Generate query embedding
  const queryEmbedding = await generateEmbedding(query);

  // Semantic search
  const semanticResults = await runtime.searchMemories({
    embedding: queryEmbedding,
    limit: topK * 2,
    minScore: 0.7
  });

  // Keyword search
  const keywordResults = await runtime.searchMemories({
    query,
    limit: topK * 2
  });

  // Merge and rank results
  return mergeAndRank(semanticResults, keywordResults, topK);
}
```

### Phase 8: Quality Metrics

```typescript
interface KnowledgeMetrics {
  totalDocuments: number;
  totalChunks: number;
  avgChunkSize: number;
  embeddingCoverage: number;
  queryPerformance: {
    avgLatency: number;
    avgRelevance: number;
  };
}

async function assessKnowledgeQuality(
  runtime: IAgentRuntime
): Promise<KnowledgeMetrics> {
  // Implementation
  return {
    totalDocuments: 50,
    totalChunks: 500,
    avgChunkSize: 800,
    embeddingCoverage: 0.98,
    queryPerformance: {
      avgLatency: 150, // ms
      avgRelevance: 0.85
    }
  };
}
```

## Best Practices

1. **Document Structure**: Use clear headers and sections
2. **Chunk Size**: Balance between context and precision (500-1500 chars)
3. **Overlap**: Include 10-20% overlap for context preservation
4. **Updates**: Version knowledge files with dates
5. **Quality**: Regular review and refinement
6. **Performance**: Pre-compute embeddings when possible
7. **Privacy**: Never include sensitive data in knowledge base
8. **Organization**: Group related documents in directories
9. **Testing**: Validate retrieval quality with test queries
10. **Monitoring**: Track usage patterns and relevance scores
