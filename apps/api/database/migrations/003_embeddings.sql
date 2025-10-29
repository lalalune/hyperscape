-- Migration 003: Embeddings System
-- Created: 2025-10-26
-- Description: Add vector embeddings for game content (lore, quests, items, characters, manifests)

-- Enable pgvector extension (idempotent)
CREATE EXTENSION IF NOT EXISTS vector;

-- Content embeddings table (unified for all content types)
CREATE TABLE IF NOT EXISTS content_embeddings (
  id SERIAL PRIMARY KEY,

  -- Content reference
  content_type VARCHAR(50) NOT NULL, -- 'lore', 'quest', 'item', 'character', 'manifest', 'npc'
  content_id VARCHAR(255) NOT NULL, -- ID of the content in its source system

  -- Embedding data
  content TEXT NOT NULL, -- The actual text that was embedded
  embedding vector(1536), -- OpenAI text-embedding-3-small dimension

  -- Metadata
  metadata JSONB DEFAULT '{}', -- Flexible metadata (tags, categories, etc.)

  -- Tracking
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  UNIQUE(content_type, content_id)
);

-- Create index for vector similarity search using HNSW (Hierarchical Navigable Small World)
-- This is the most efficient index for nearest neighbor search
CREATE INDEX IF NOT EXISTS content_embeddings_embedding_idx
  ON content_embeddings
  USING hnsw (embedding vector_cosine_ops);

-- Create index for content type filtering
CREATE INDEX IF NOT EXISTS content_embeddings_content_type_idx
  ON content_embeddings(content_type);

-- Create index for metadata queries
CREATE INDEX IF NOT EXISTS content_embeddings_metadata_idx
  ON content_embeddings
  USING gin(metadata);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_content_embeddings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS content_embeddings_updated_at ON content_embeddings;
CREATE TRIGGER content_embeddings_updated_at
  BEFORE UPDATE ON content_embeddings
  FOR EACH ROW
  EXECUTE FUNCTION update_content_embeddings_updated_at();

-- Create a view for embedding statistics
CREATE OR REPLACE VIEW embedding_stats AS
SELECT
  content_type,
  COUNT(*) as total_embeddings,
  MAX(created_at) as last_embedded,
  COUNT(DISTINCT content_id) as unique_content
FROM content_embeddings
GROUP BY content_type;

-- Comments
COMMENT ON TABLE content_embeddings IS 'Stores vector embeddings for all game content types';
COMMENT ON COLUMN content_embeddings.content_type IS 'Type of content: lore, quest, item, character, manifest, npc';
COMMENT ON COLUMN content_embeddings.content_id IS 'Reference ID to the source content';
COMMENT ON COLUMN content_embeddings.embedding IS 'Vector embedding (1536 dimensions for text-embedding-3-small)';
COMMENT ON COLUMN content_embeddings.metadata IS 'Flexible JSON metadata for filtering and context';
