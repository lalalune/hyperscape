-- Add model configuration table for admin-managed AI models
-- This allows admins to configure which models are used for different tasks

CREATE TABLE IF NOT EXISTS model_configurations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_type VARCHAR(100) NOT NULL UNIQUE, -- 'prompt-enhancement', 'image-generation', 'text-generation', etc.
  model_id VARCHAR(255) NOT NULL, -- e.g., 'openai/gpt-4', 'anthropic/claude-sonnet-4'
  provider VARCHAR(100) NOT NULL, -- 'openai', 'anthropic', 'google', etc.

  -- Model settings
  temperature FLOAT DEFAULT 0.7,
  max_tokens INTEGER,

  -- Metadata
  display_name VARCHAR(255),
  description TEXT,

  -- Pricing (cached from gateway)
  pricing_input DECIMAL(10, 8), -- Cost per 1M input tokens
  pricing_output DECIMAL(10, 8), -- Cost per 1M output tokens

  -- Status
  is_active BOOLEAN DEFAULT true,

  -- Audit
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_model_config_task ON model_configurations(task_type);
CREATE INDEX IF NOT EXISTS idx_model_config_active ON model_configurations(is_active);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_model_config_updated_at ON model_configurations;
CREATE TRIGGER update_model_config_updated_at BEFORE UPDATE ON model_configurations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default configurations
INSERT INTO model_configurations (task_type, model_id, provider, display_name, description, temperature, max_tokens) VALUES
  ('prompt-enhancement', 'openai/gpt-4', 'openai', 'GPT-4', 'Prompt optimization for 3D asset generation', 0.7, 200),
  ('image-generation', 'openai/gpt-image-1', 'openai', 'GPT Image 1', 'High-quality image generation', 0.7, NULL),
  ('text-generation', 'anthropic/claude-sonnet-4', 'anthropic', 'Claude Sonnet 4', 'General text generation (lore, dialogue)', 0.7, 1000),
  ('quest-generation', 'anthropic/claude-sonnet-4', 'anthropic', 'Claude Sonnet 4', 'Quest and content generation', 0.7, 2000),
  ('npc-dialogue', 'openai/gpt-4o', 'openai', 'GPT-4o', 'NPC dialogue generation', 0.8, 1000),
  ('lore-writing', 'anthropic/claude-opus-4', 'anthropic', 'Claude Opus 4', 'High-quality lore writing', 0.7, 2000)
ON CONFLICT (task_type) DO NOTHING;

-- Add system_settings table for global configuration
CREATE TABLE IF NOT EXISTS system_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  setting_key VARCHAR(100) NOT NULL UNIQUE,
  setting_value JSONB NOT NULL,
  description TEXT,

  -- Audit
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_system_settings_key ON system_settings(setting_key);

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_system_settings_updated_at ON system_settings;
CREATE TRIGGER update_system_settings_updated_at BEFORE UPDATE ON system_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default settings
INSERT INTO system_settings (setting_key, setting_value, description) VALUES
  ('ai_gateway_enabled', 'false', 'Whether to use Vercel AI Gateway'),
  ('default_quality', '"standard"', 'Default generation quality (standard, high, ultra)'),
  ('enable_gpt4_enhancement', 'true', 'Enable GPT-4 prompt enhancement'),
  ('enable_retexturing', 'true', 'Enable material variant generation'),
  ('enable_rigging', 'true', 'Enable auto-rigging for avatars')
ON CONFLICT (setting_key) DO NOTHING;
