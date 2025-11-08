# Railway Qdrant Manager

## Activation
When the user mentions any of these, activate this skill:
- "qdrant railway"
- "vector database railway"
- "qdrant deployment"
- "embedding storage"
- "vector search railway"
- "qdrant cluster"
- "semantic search railway"
- "qdrant collection"

## Purpose
Manages Qdrant vector database deployments on Railway for AI applications, semantic search, and RAG (Retrieval-Augmented Generation) systems. Provides comprehensive vector storage, similarity search, and collection management capabilities.

## Context
Qdrant is a high-performance vector database optimized for similarity search and AI applications. Railway offers one-click Qdrant deployment with automatic scaling and managed infrastructure. Qdrant is built in Rust for maximum performance and supports millions of vectors with sub-millisecond query times.

## Core Capabilities

### 1. Qdrant Deployment on Railway
- Deploy Qdrant using Railway templates
- Configure single-node or cluster deployments
- Set up authentication and API keys
- Configure persistent storage

### 2. Collection Management
- Create and delete collections
- Configure vector dimensions and distance metrics
- Set up collection schemas
- Manage collection aliases

### 3. Vector Operations
- Insert vectors with payloads
- Batch vector uploads
- Update vector payloads
- Delete vectors

### 4. Search & Retrieval
- Vector similarity search
- Filtered search with payloads
- Hybrid search (vector + filters)
- Batch search operations
- Recommendations

### 5. Integration Patterns
- OpenAI embeddings integration
- LangChain integration
- Custom embedding models
- RAG system implementation

## Implementation Patterns

### 1. Deploy Qdrant on Railway

```bash
# Option 1: Deploy via Railway Dashboard
# 1. Go to Railway Dashboard → New → Template
# 2. Search "Qdrant" and select template
# 3. Configure:
#    - QDRANT__SERVICE__API_KEY: Generate secure API key
#    - QDRANT__LOG_LEVEL: INFO or DEBUG

# Option 2: Deploy Qdrant cluster for high availability
# Use Qdrant Cluster template for distributed deployment

# Railway automatically provides:
# - QDRANT_URL: http://qdrant.railway.internal:6333
# - QDRANT__SERVICE__API_KEY: Your configured API key
```

### 2. Environment Configuration

```env
# Qdrant Connection
QDRANT_URL=http://${{Qdrant.RAILWAY_PRIVATE_DOMAIN}}:${{Qdrant.PORT}}
QDRANT_API_KEY=${{Qdrant.QDRANT__SERVICE__API_KEY}}

# Or for external access (development)
QDRANT_PUBLIC_URL=https://${{Qdrant.RAILWAY_STATIC_URL}}

# Qdrant Configuration
QDRANT__SERVICE__HTTP_PORT=6333
QDRANT__SERVICE__GRPC_PORT=6334
QDRANT__LOG_LEVEL=INFO
QDRANT__STORAGE__STORAGE_PATH=/qdrant/storage

# Collection settings (application-specific)
EMBEDDING_DIMENSION=1536  # OpenAI ada-002
DISTANCE_METRIC=Cosine    # Cosine, Euclid, or Dot
```

### 3. JavaScript/TypeScript Client Setup

```typescript
// lib/qdrant.ts
import { QdrantClient } from '@qdrant/js-client-rest';

// Initialize Qdrant client
export const qdrantClient = new QdrantClient({
  url: process.env.QDRANT_URL!,
  apiKey: process.env.QDRANT_API_KEY!,
});

// Health check
export async function checkQdrantHealth(): Promise<boolean> {
  try {
    const health = await qdrantClient.api('health');
    return health.status === 200;
  } catch (error) {
    console.error('Qdrant health check failed:', error);
    return false;
  }
}

// Get cluster info
export async function getClusterInfo() {
  return await qdrantClient.getCluster();
}
```

### 4. Collection Management

```typescript
// lib/qdrant-collections.ts
import { QdrantClient } from '@qdrant/js-client-rest';

const client = new QdrantClient({
  url: process.env.QDRANT_URL!,
  apiKey: process.env.QDRANT_API_KEY!,
});

// Create collection
export async function createCollection(
  collectionName: string,
  vectorSize: number = 1536, // OpenAI ada-002 dimension
  distance: 'Cosine' | 'Euclid' | 'Dot' = 'Cosine'
): Promise<void> {
  const exists = await client.collectionExists(collectionName);

  if (!exists) {
    await client.createCollection(collectionName, {
      vectors: {
        size: vectorSize,
        distance: distance,
      },
      optimizers_config: {
        default_segment_number: 2,
      },
      replication_factor: 1,
    });

    console.log(`Collection ${collectionName} created successfully`);
  } else {
    console.log(`Collection ${collectionName} already exists`);
  }
}

// Create collection with multiple vectors
export async function createMultiVectorCollection(
  collectionName: string
): Promise<void> {
  await client.createCollection(collectionName, {
    vectors: {
      title: { size: 1536, distance: 'Cosine' },
      content: { size: 1536, distance: 'Cosine' },
      summary: { size: 384, distance: 'Cosine' },
    },
  });
}

// Create collection with sparse vectors (for hybrid search)
export async function createHybridCollection(
  collectionName: string
): Promise<void> {
  await client.createCollection(collectionName, {
    vectors: {
      dense: { size: 1536, distance: 'Cosine' },
    },
    sparse_vectors: {
      text: {},
    },
  });
}

// Delete collection
export async function deleteCollection(
  collectionName: string
): Promise<void> {
  await client.deleteCollection(collectionName);
  console.log(`Collection ${collectionName} deleted`);
}

// List all collections
export async function listCollections(): Promise<string[]> {
  const response = await client.getCollections();
  return response.collections.map(c => c.name);
}

// Get collection info
export async function getCollectionInfo(collectionName: string) {
  return await client.getCollection(collectionName);
}

// Create index for payload field (for filtering)
export async function createPayloadIndex(
  collectionName: string,
  fieldName: string,
  fieldType: 'keyword' | 'integer' | 'float' | 'bool' | 'geo' = 'keyword'
): Promise<void> {
  await client.createPayloadIndex(collectionName, {
    field_name: fieldName,
    field_schema: fieldType,
  });

  console.log(`Index created for ${fieldName} in ${collectionName}`);
}
```

### 5. Vector Operations

```typescript
// lib/qdrant-vectors.ts
import { QdrantClient } from '@qdrant/js-client-rest';
import { v4 as uuidv4 } from 'uuid';

const client = new QdrantClient({
  url: process.env.QDRANT_URL!,
  apiKey: process.env.QDRANT_API_KEY!,
});

// Insert single vector
export async function insertVector(
  collectionName: string,
  vector: number[],
  payload: Record<string, any>
): Promise<string> {
  const pointId = uuidv4();

  await client.upsert(collectionName, {
    wait: true,
    points: [
      {
        id: pointId,
        vector: vector,
        payload: payload,
      },
    ],
  });

  return pointId;
}

// Batch insert vectors
export async function batchInsertVectors(
  collectionName: string,
  vectors: Array<{
    vector: number[];
    payload: Record<string, any>;
  }>
): Promise<string[]> {
  const pointIds = vectors.map(() => uuidv4());

  await client.upsert(collectionName, {
    wait: true,
    points: vectors.map((v, i) => ({
      id: pointIds[i],
      vector: v.vector,
      payload: v.payload,
    })),
  });

  return pointIds;
}

// Update vector payload
export async function updatePayload(
  collectionName: string,
  pointId: string,
  payload: Record<string, any>
): Promise<void> {
  await client.setPayload(collectionName, {
    wait: true,
    payload: payload,
    points: [pointId],
  });
}

// Delete vector
export async function deleteVector(
  collectionName: string,
  pointId: string
): Promise<void> {
  await client.delete(collectionName, {
    wait: true,
    points: [pointId],
  });
}

// Delete vectors by filter
export async function deleteVectorsByFilter(
  collectionName: string,
  filter: any
): Promise<void> {
  await client.delete(collectionName, {
    wait: true,
    filter: filter,
  });
}

// Get vector by ID
export async function getVector(
  collectionName: string,
  pointId: string
) {
  const result = await client.retrieve(collectionName, {
    ids: [pointId],
    with_payload: true,
    with_vector: true,
  });

  return result[0];
}
```

### 6. Search Operations

```typescript
// lib/qdrant-search.ts
import { QdrantClient } from '@qdrant/js-client-rest';

const client = new QdrantClient({
  url: process.env.QDRANT_URL!,
  apiKey: process.env.QDRANT_API_KEY!,
});

// Simple vector search
export async function searchVectors(
  collectionName: string,
  queryVector: number[],
  limit: number = 10
) {
  return await client.search(collectionName, {
    vector: queryVector,
    limit: limit,
    with_payload: true,
    with_vector: false,
  });
}

// Search with filters
export async function searchWithFilter(
  collectionName: string,
  queryVector: number[],
  filter: any,
  limit: number = 10
) {
  return await client.search(collectionName, {
    vector: queryVector,
    filter: filter,
    limit: limit,
    with_payload: true,
  });
}

// Example: Search with metadata filters
export async function searchDocuments(
  collectionName: string,
  queryVector: number[],
  options: {
    userId?: string;
    category?: string;
    dateAfter?: string;
    tags?: string[];
    limit?: number;
  } = {}
) {
  const filter: any = { must: [] };

  if (options.userId) {
    filter.must.push({
      key: 'userId',
      match: { value: options.userId },
    });
  }

  if (options.category) {
    filter.must.push({
      key: 'category',
      match: { value: options.category },
    });
  }

  if (options.dateAfter) {
    filter.must.push({
      key: 'timestamp',
      range: { gte: options.dateAfter },
    });
  }

  if (options.tags && options.tags.length > 0) {
    filter.must.push({
      key: 'tags',
      match: { any: options.tags },
    });
  }

  return await client.search(collectionName, {
    vector: queryVector,
    filter: filter.must.length > 0 ? filter : undefined,
    limit: options.limit || 10,
    with_payload: true,
  });
}

// Batch search
export async function batchSearch(
  collectionName: string,
  queries: Array<{
    vector: number[];
    filter?: any;
    limit?: number;
  }>
) {
  const requests = queries.map(q => ({
    vector: q.vector,
    filter: q.filter,
    limit: q.limit || 10,
    with_payload: true,
  }));

  return await client.searchBatch(collectionName, {
    searches: requests,
  });
}

// Recommend similar items (based on positive/negative examples)
export async function recommendVectors(
  collectionName: string,
  positiveIds: string[],
  negativeIds: string[] = [],
  limit: number = 10
) {
  return await client.recommend(collectionName, {
    positive: positiveIds,
    negative: negativeIds,
    limit: limit,
    with_payload: true,
  });
}

// Scroll through all vectors (pagination)
export async function scrollVectors(
  collectionName: string,
  limit: number = 100,
  offset?: string
) {
  return await client.scroll(collectionName, {
    limit: limit,
    offset: offset,
    with_payload: true,
    with_vector: false,
  });
}

// Count vectors in collection
export async function countVectors(
  collectionName: string,
  filter?: any
): Promise<number> {
  const result = await client.count(collectionName, {
    filter: filter,
    exact: true,
  });

  return result.count;
}
```

### 7. OpenAI Integration

```typescript
// lib/embeddings.ts
import OpenAI from 'openai';
import { qdrantClient } from './qdrant';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

// Generate embedding
export async function generateEmbedding(
  text: string,
  model: string = 'text-embedding-ada-002'
): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: model,
    input: text,
  });

  return response.data[0].embedding;
}

// Store document with embedding
export async function storeDocument(
  collectionName: string,
  text: string,
  metadata: Record<string, any>
): Promise<string> {
  // Generate embedding
  const embedding = await generateEmbedding(text);

  // Store in Qdrant
  const pointId = crypto.randomUUID();
  await qdrantClient.upsert(collectionName, {
    wait: true,
    points: [
      {
        id: pointId,
        vector: embedding,
        payload: {
          text: text,
          ...metadata,
          createdAt: new Date().toISOString(),
        },
      },
    ],
  });

  return pointId;
}

// Semantic search
export async function semanticSearch(
  collectionName: string,
  query: string,
  limit: number = 5,
  filter?: any
) {
  // Generate query embedding
  const queryEmbedding = await generateEmbedding(query);

  // Search in Qdrant
  return await qdrantClient.search(collectionName, {
    vector: queryEmbedding,
    filter: filter,
    limit: limit,
    with_payload: true,
  });
}
```

### 8. RAG (Retrieval-Augmented Generation) Implementation

```typescript
// lib/rag.ts
import OpenAI from 'openai';
import { semanticSearch } from './embeddings';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

export async function ragQuery(
  collectionName: string,
  userQuery: string,
  options: {
    topK?: number;
    systemPrompt?: string;
    model?: string;
  } = {}
): Promise<string> {
  // 1. Retrieve relevant documents
  const searchResults = await semanticSearch(
    collectionName,
    userQuery,
    options.topK || 5
  );

  // 2. Build context from search results
  const context = searchResults
    .map((result, i) => {
      const payload = result.payload as any;
      return `[Document ${i + 1}] ${payload.text}`;
    })
    .join('\n\n');

  // 3. Generate response with GPT
  const systemPrompt = options.systemPrompt ||
    'You are a helpful assistant. Answer the user\'s question based on the provided context. If the context doesn\'t contain relevant information, say so.';

  const completion = await openai.chat.completions.create({
    model: options.model || 'gpt-4',
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `Context:\n${context}\n\nQuestion: ${userQuery}`,
      },
    ],
    temperature: 0.7,
    max_tokens: 500,
  });

  return completion.choices[0].message.content || '';
}

// RAG with source citations
export async function ragQueryWithSources(
  collectionName: string,
  userQuery: string,
  topK: number = 5
) {
  const searchResults = await semanticSearch(collectionName, userQuery, topK);

  const context = searchResults
    .map((result, i) => {
      const payload = result.payload as any;
      return `[${i + 1}] ${payload.text}`;
    })
    .join('\n\n');

  const completion = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [
      {
        role: 'system',
        content: 'Answer based on the context. Cite sources using [1], [2], etc.',
      },
      {
        role: 'user',
        content: `Context:\n${context}\n\nQuestion: ${userQuery}`,
      },
    ],
  });

  return {
    answer: completion.choices[0].message.content,
    sources: searchResults.map((r, i) => ({
      index: i + 1,
      score: r.score,
      payload: r.payload,
    })),
  };
}
```

### 9. LangChain Integration

```typescript
// lib/langchain-qdrant.ts
import { QdrantVectorStore } from '@langchain/community/vectorstores/qdrant';
import { OpenAIEmbeddings } from '@langchain/openai';

// Initialize LangChain Qdrant store
export const vectorStore = new QdrantVectorStore(
  new OpenAIEmbeddings({
    openAIApiKey: process.env.OPENAI_API_KEY,
  }),
  {
    url: process.env.QDRANT_URL,
    apiKey: process.env.QDRANT_API_KEY,
    collectionName: 'documents',
  }
);

// Add documents to Qdrant via LangChain
export async function addDocuments(
  documents: Array<{ pageContent: string; metadata: Record<string, any> }>
) {
  await vectorStore.addDocuments(documents);
}

// Similarity search via LangChain
export async function similaritySearch(
  query: string,
  k: number = 4
) {
  return await vectorStore.similaritySearch(query, k);
}
```

## Best Practices

### 1. Collection Design
- **Plan vector dimensions** based on embedding model (OpenAI ada-002: 1536)
- **Choose appropriate distance metric**: Cosine for most cases, Dot for normalized vectors
- **Create payload indexes** for frequently filtered fields
- **Use multiple vectors per point** for multi-aspect search
- **Consider collection sharding** for large datasets

### 2. Performance Optimization
- **Batch operations** when inserting multiple vectors
- **Use payload indexes** for filtered searches
- **Configure segment optimization** for better search performance
- **Monitor collection size** and reindex when needed
- **Use quantization** for large-scale deployments

### 3. Search Quality
- **Fine-tune embedding models** for your domain
- **Combine vector search with filters** for precise results
- **Use hybrid search** (sparse + dense vectors) for better accuracy
- **Implement reranking** for top results
- **A/B test different distance metrics**

### 4. Data Management
- **Version your collections** for schema changes
- **Implement soft deletes** with payload flags
- **Regular collection cleanup** for deleted items
- **Monitor collection statistics**
- **Backup collection snapshots** regularly

### 5. Security
- **Always use API keys** in production
- **Use private networking** for Railway services
- **Never expose QDRANT_API_KEY** in client-side code
- **Implement rate limiting** in your API layer
- **Validate payloads** before insertion

### 6. Cost Optimization
- **Use appropriate collection parameters** (segment size, optimization)
- **Delete unused collections**
- **Monitor storage usage** on Railway
- **Use quantization** to reduce storage requirements
- **Consider collection compression** for historical data

## Common Workflows

### 1. Initialize Qdrant for RAG System

```typescript
// scripts/init-qdrant.ts
import { createCollection, createPayloadIndex } from './lib/qdrant-collections';

async function initializeQdrant() {
  // Create main documents collection
  await createCollection('documents', 1536, 'Cosine');

  // Create payload indexes for filtering
  await createPayloadIndex('documents', 'userId', 'keyword');
  await createPayloadIndex('documents', 'category', 'keyword');
  await createPayloadIndex('documents', 'timestamp', 'integer');
  await createPayloadIndex('documents', 'tags', 'keyword');

  console.log('Qdrant initialized successfully');
}

initializeQdrant();
```

### 2. Bulk Import Documents

```typescript
// scripts/import-documents.ts
import { generateEmbedding } from './lib/embeddings';
import { batchInsertVectors } from './lib/qdrant-vectors';

interface Document {
  text: string;
  metadata: Record<string, any>;
}

async function importDocuments(
  collectionName: string,
  documents: Document[]
) {
  const batchSize = 100;

  for (let i = 0; i < documents.length; i += batchSize) {
    const batch = documents.slice(i, i + batchSize);

    // Generate embeddings for batch
    const embeddings = await Promise.all(
      batch.map(doc => generateEmbedding(doc.text))
    );

    // Prepare vectors with payloads
    const vectors = batch.map((doc, idx) => ({
      vector: embeddings[idx],
      payload: {
        text: doc.text,
        ...doc.metadata,
        createdAt: new Date().toISOString(),
      },
    }));

    // Insert batch
    await batchInsertVectors(collectionName, vectors);

    console.log(`Imported ${Math.min(i + batchSize, documents.length)}/${documents.length} documents`);
  }
}
```

### 3. Semantic Search API Endpoint

```typescript
// app/api/search/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { semanticSearch } from '@/lib/embeddings';

export async function POST(request: NextRequest) {
  try {
    const { query, limit = 5, filter } = await request.json();

    if (!query) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }

    const results = await semanticSearch(
      'documents',
      query,
      limit,
      filter
    );

    return NextResponse.json({
      success: true,
      results: results.map(r => ({
        id: r.id,
        score: r.score,
        payload: r.payload,
      })),
    });
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json(
      { error: 'Search failed' },
      { status: 500 }
    );
  }
}
```

## Troubleshooting

### Connection Issues
- Verify QDRANT_URL uses private domain for Railway services
- Check QDRANT_API_KEY is set correctly
- Ensure Qdrant service is running in Railway
- Use http:// (not https://) for private networking

### Performance Issues
- Create indexes for filtered fields
- Use batch operations for bulk inserts
- Check collection optimization settings
- Monitor collection size and segment count
- Consider using quantization

### Search Quality Issues
- Verify embedding model matches collection dimension
- Check distance metric is appropriate
- Review payload filters for correctness
- Consider using hybrid search
- Test different embedding models

## Resources

- Qdrant Documentation: https://qdrant.tech/documentation/
- Qdrant JS Client: https://www.npmjs.com/package/@qdrant/js-client-rest
- Railway Qdrant Template: https://railway.app/template/i1tz3T
- LangChain Qdrant: https://js.langchain.com/docs/integrations/vectorstores/qdrant
- OpenAI Embeddings: https://platform.openai.com/docs/guides/embeddings

## Notes
- Qdrant on Railway includes persistent storage
- Use private networking for better performance and no egress fees
- Qdrant Console is accessible via Railway public URL
- Consider Qdrant Cloud for managed clustering at scale
- Always version your collections for production systems
