-- Migration: Add model_configurations and system_settings tables
-- This migration adds tables for AI model configuration management

-- =====================================================
-- MODEL CONFIGURATIONS TABLE
-- =====================================================
-- Stores AI model configurations for different task types

CREATE TABLE IF NOT EXISTS model_configurations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  task_type VARCHAR(100) UNIQUE NOT NULL,
  model_id VARCHAR(255) NOT NULL,
  provider VARCHAR(100) NOT NULL,
  temperature DECIMAL(3, 2) DEFAULT 0.7,
  max_tokens INTEGER,
  display_name VARCHAR(255),
  description TEXT,
  pricing_input DECIMAL(10, 8),
  pricing_output DECIMAL(10, 8),
  is_active BOOLEAN DEFAULT true,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_model_configurations_task_type ON model_configurations(task_type);
CREATE INDEX IF NOT EXISTS idx_model_configurations_is_active ON model_configurations(is_active);

-- Add trigger for updated_at
DROP TRIGGER IF EXISTS update_model_configurations_updated_at ON model_configurations;
CREATE TRIGGER update_model_configurations_updated_at BEFORE UPDATE ON model_configurations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- SYSTEM SETTINGS TABLE
-- =====================================================
-- Stores global system settings and configuration

CREATE TABLE IF NOT EXISTS system_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  setting_key VARCHAR(255) UNIQUE NOT NULL,
  setting_value JSONB NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_system_settings_key ON system_settings(setting_key);

-- Add trigger for updated_at
DROP TRIGGER IF EXISTS update_system_settings_updated_at ON system_settings;
CREATE TRIGGER update_system_settings_updated_at BEFORE UPDATE ON system_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- DEFAULT MODEL CONFIGURATIONS
-- =====================================================
-- Insert default configurations for common task types

INSERT INTO model_configurations (task_type, model_id, provider, display_name, description, temperature)
VALUES
  ('prompt-enhancement', 'gpt-4o-mini', 'openai', 'Prompt Enhancement', 'Enhances user prompts for better AI generation', 0.7),
  ('text-generation', 'gpt-4o', 'openai', 'Text Generation', 'General text generation tasks', 0.7),
  ('quest-generation', 'gpt-4o', 'openai', 'Quest Generation', 'Generates quest narratives and objectives', 0.8),
  ('npc-dialogue', 'gpt-4o-mini', 'openai', 'NPC Dialogue', 'Generates NPC conversations and responses', 0.9),
  ('lore-writing', 'gpt-4o', 'openai', 'Lore Writing', 'Creates game world lore and backstories', 0.8)
ON CONFLICT (task_type) DO NOTHING;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE model_configurations IS 'AI model configurations for different task types';
COMMENT ON COLUMN model_configurations.task_type IS 'Unique identifier for the task type (e.g., prompt-enhancement, text-generation)';
COMMENT ON COLUMN model_configurations.model_id IS 'AI model identifier (e.g., gpt-4o, claude-3-opus)';
COMMENT ON COLUMN model_configurations.provider IS 'AI provider (e.g., openai, anthropic)';
COMMENT ON COLUMN model_configurations.temperature IS 'Model temperature parameter (0.0-2.0)';

COMMENT ON TABLE system_settings IS 'Global system settings and configuration';
COMMENT ON COLUMN system_settings.setting_key IS 'Unique setting identifier';
COMMENT ON COLUMN system_settings.setting_value IS 'Setting value stored as JSON';
