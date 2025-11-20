/**
 * CharacterEditorScreen.tsx - ElizaOS Character Template Editor
 *
 * Full-featured character editor for creating AI agent personalities
 * Similar to the native ElizaOS character creation UI
 */

import React from "react";
import { Save, X, ArrowLeft } from "lucide-react";
import { ArrayInput } from "../components/character/ArrayInput";
import {
  generateCharacterTemplate,
  validateCharacter,
  type CharacterTemplate,
} from "../utils/characterTemplate";

export const CharacterEditorScreen: React.FC = () => {
  const [activeTab, setActiveTab] = React.useState<
    "basic" | "content" | "style" | "plugins" | "secrets"
  >("basic");
  const [character, setCharacter] = React.useState<CharacterTemplate | null>(
    null,
  );
  const [saving, setSaving] = React.useState(false);
  const [errors, setErrors] = React.useState<string[]>([]);

  const [characterId, setCharacterId] = React.useState<string | null>(null);

  // Initialize character from URL params
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const characterIdParam = params.get("characterId");
    const name = params.get("name");
    const wallet = params.get("wallet");
    const avatar = params.get("avatar");

    if (!characterIdParam) {
      alert("No character ID provided");
      window.location.href = "/";
      return;
    }

    if (!name) {
      alert("No character name provided");
      window.location.href = "/";
      return;
    }

    setCharacterId(characterIdParam);
    const template = generateCharacterTemplate(
      name,
      wallet || undefined,
      avatar || undefined,
    );
    setCharacter(template);
  }, []);

  const handleSave = async () => {
    if (!character || !characterId) return;

    // Validate
    const validation = validateCharacter(character);
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    setSaving(true);
    setErrors([]);

    try {
      // Get accountId from localStorage (Privy user ID)
      const accountId = localStorage.getItem("privy_user_id");
      if (!accountId) {
        throw new Error("Not authenticated - no account ID found");
      }

      console.log("[CharacterEditor] Generating agent credentials...");

      // Generate permanent Hyperscape JWT for agent
      const credentialsResponse = await fetch(
        "http://localhost:5555/api/agents/credentials",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            characterId,
            accountId,
          }),
        },
      );

      if (!credentialsResponse.ok) {
        throw new Error(
          `Failed to generate credentials: ${credentialsResponse.status}`,
        );
      }

      const credentials = await credentialsResponse.json();
      console.log("[CharacterEditor] Permanent JWT generated successfully");

      // Update character with permanent JWT and characterId
      const updatedCharacter = {
        ...character,
        settings: {
          ...character.settings,
          secrets: {
            ...character.settings.secrets,
            HYPERSCAPE_AUTH_TOKEN: credentials.authToken,
            HYPERSCAPE_CHARACTER_ID: characterId,
            HYPERSCAPE_SERVER_URL:
              credentials.serverUrl || "ws://localhost:5555/ws",
          },
        },
      };

      // Save character file with permanent JWT
      const saveResponse = await fetch("http://localhost:3000/api/characters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          character: updatedCharacter,
          filename: `${character.name.toLowerCase().replace(/\s+/g, "_")}.json`,
        }),
      });

      if (!saveResponse.ok) {
        throw new Error(`Failed to save character: ${saveResponse.status}`);
      }

      console.log(
        "[CharacterEditor] Character file saved with permanent credentials",
      );

      // Create ElizaOS agent with this character
      const createResponse = await fetch("http://localhost:3000/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: character.name,
          bio: character.bio.join("\n"),
          settings: {
            secrets: updatedCharacter.settings.secrets,
            model: "gpt-4o-mini",
            voice: { model: "en_US-male-medium" },
          },
          plugins: character.plugins,
        }),
      });

      if (!createResponse.ok) {
        throw new Error(`Failed to create agent: ${createResponse.status}`);
      }

      const result = await createResponse.json();
      console.log("[CharacterEditor] ElizaOS agent created:", result);

      // Store agent ID for dashboard
      if (result.data?.agent?.id) {
        localStorage.setItem("last_created_agent_id", result.data.agent.id);
      }

      // Redirect to dashboard
      console.log("[CharacterEditor] Redirecting to agent dashboard...");
      window.location.href = "/?page=dashboard";
    } catch (error) {
      console.error("[CharacterEditor] Failed to create agent:", error);
      setErrors([error instanceof Error ? error.message : "Unknown error"]);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (confirm("Discard changes and return to character creation?")) {
      window.location.href = "/";
    }
  };

  if (!character) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0b0a15] text-[#f2d08a]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#f2d08a]"></div>
      </div>
    );
  }

  const tabs = [
    { id: "basic" as const, label: "Basic Info" },
    { id: "content" as const, label: "Content" },
    { id: "style" as const, label: "Style" },
    { id: "plugins" as const, label: "Plugins" },
    { id: "secrets" as const, label: "Secrets" },
  ];

  return (
    <div className="min-h-screen bg-[#0b0a15] text-[#e8ebf4]">
      {/* Header */}
      <div className="border-b border-[#8b4513]/30 bg-[#0b0a15]/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={handleCancel}
                className="p-2 rounded-lg border border-[#f2d08a]/30 text-[#f2d08a] hover:bg-[#f2d08a]/10 transition-colors"
                title="Back to character creation"
              >
                <ArrowLeft size={20} />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-[#f2d08a]">
                  Create AI Agent Character
                </h1>
                <p className="text-sm text-[#f2d08a]/60 mt-1">
                  Customize your AI agent's personality and behavior
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleCancel}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#f2d08a]/30 text-[#f2d08a] hover:bg-[#f2d08a]/10 transition-colors"
              >
                <X size={16} />
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2 rounded-lg bg-[#f2d08a] text-[#0b0a15] font-bold hover:bg-[#e5c07b] transition-colors shadow-lg shadow-[#f2d08a]/20 disabled:opacity-50"
              >
                <Save size={16} />
                {saving ? "Creating Agent..." : "Create Agent"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div className="max-w-7xl mx-auto px-6 pt-4">
          <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-4">
            <h3 className="text-red-400 font-bold mb-2">Validation Errors:</h3>
            <ul className="list-disc list-inside text-red-200 text-sm space-y-1">
              {errors.map((error, i) => (
                <li key={i}>{error}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-[#8b4513]/30 bg-[#0b0a15]/50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-6">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`pb-3 pt-4 text-sm font-medium transition-colors relative ${
                  activeTab === tab.id
                    ? "text-[#f2d08a]"
                    : "text-[#f2d08a]/40 hover:text-[#f2d08a]/80"
                }`}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <div className="absolute bottom-0 left-0 w-full h-0.5 bg-[#f2d08a]" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="max-w-3xl mx-auto space-y-6">
          {activeTab === "basic" && (
            <BasicInfoTab character={character} onChange={setCharacter} />
          )}
          {activeTab === "content" && (
            <ContentTab character={character} onChange={setCharacter} />
          )}
          {activeTab === "style" && (
            <StyleTab character={character} onChange={setCharacter} />
          )}
          {activeTab === "plugins" && (
            <PluginsTab character={character} onChange={setCharacter} />
          )}
          {activeTab === "secrets" && (
            <SecretsTab character={character} onChange={setCharacter} />
          )}
        </div>
      </div>
    </div>
  );
};

// Basic Info Tab
const BasicInfoTab: React.FC<{
  character: CharacterTemplate;
  onChange: (character: CharacterTemplate) => void;
}> = ({ character, onChange }) => {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label className="block text-sm font-medium text-[#f2d08a]/80">
          Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={character.name}
          onChange={(e) => onChange({ ...character, name: e.target.value })}
          className="w-full bg-[#1a1005] border border-[#8b4513]/30 rounded-lg p-3 text-[#e8ebf4] focus:border-[#f2d08a] outline-none transition-colors"
        />
        <p className="text-xs text-[#f2d08a]/40">
          The primary identifier for this agent
        </p>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-[#f2d08a]/80">
          Username
        </label>
        <input
          type="text"
          value={character.username}
          onChange={(e) => onChange({ ...character, username: e.target.value })}
          placeholder="@username"
          className="w-full bg-[#1a1005] border border-[#8b4513]/30 rounded-lg p-3 text-[#e8ebf4] focus:border-[#f2d08a] outline-none transition-colors"
        />
        <p className="text-xs text-[#f2d08a]/40">
          Used in URLs and API endpoints
        </p>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-[#f2d08a]/80">
          System Prompt <span className="text-red-500">*</span>
        </label>
        <textarea
          rows={8}
          value={character.system}
          onChange={(e) => onChange({ ...character, system: e.target.value })}
          className="w-full bg-[#1a1005] border border-[#8b4513]/30 rounded-lg p-3 text-[#e8ebf4] focus:border-[#f2d08a] outline-none transition-colors resize-none font-mono text-sm"
        />
        <p className="text-xs text-[#f2d08a]/40">
          System prompt defining the agent's core behavior and personality
        </p>
      </div>
    </div>
  );
};

// Content Tab
const ContentTab: React.FC<{
  character: CharacterTemplate;
  onChange: (character: CharacterTemplate) => void;
}> = ({ character, onChange }) => {
  return (
    <div className="space-y-8">
      <ArrayInput
        label="Bio"
        description="Biographical details about the character (one per line)"
        value={character.bio}
        onChange={(bio) => onChange({ ...character, bio })}
        placeholder="Add a bio entry..."
        required
        inputType="textarea"
      />

      <ArrayInput
        label="Topics"
        description="Topics the character is knowledgeable about"
        value={character.topics}
        onChange={(topics) => onChange({ ...character, topics })}
        placeholder="Add a topic..."
        required
      />

      <ArrayInput
        label="Knowledge"
        description="Knowledge sources and areas of expertise"
        value={character.knowledge || []}
        onChange={(knowledge) => onChange({ ...character, knowledge })}
        placeholder="Add knowledge area..."
        inputType="textarea"
      />

      <ArrayInput
        label="Post Examples"
        description="Example social media posts in the character's voice"
        value={character.postExamples || []}
        onChange={(postExamples) => onChange({ ...character, postExamples })}
        placeholder="Add a post example..."
        inputType="textarea"
      />
    </div>
  );
};

// Style Tab
const StyleTab: React.FC<{
  character: CharacterTemplate;
  onChange: (character: CharacterTemplate) => void;
}> = ({ character, onChange }) => {
  return (
    <div className="space-y-8">
      <ArrayInput
        label="Adjectives"
        description="Words describing the character's personality"
        value={character.adjectives}
        onChange={(adjectives) => onChange({ ...character, adjectives })}
        placeholder="Add an adjective..."
        required
      />

      <ArrayInput
        label="Style - All Contexts"
        description="General style guidelines for all responses"
        value={character.style.all}
        onChange={(all) =>
          onChange({ ...character, style: { ...character.style, all } })
        }
        placeholder="Add a style guideline..."
        inputType="textarea"
      />

      <ArrayInput
        label="Style - Chat"
        description="Style guidelines specific to chat conversations"
        value={character.style.chat}
        onChange={(chat) =>
          onChange({ ...character, style: { ...character.style, chat } })
        }
        placeholder="Add a chat style guideline..."
        inputType="textarea"
      />

      <ArrayInput
        label="Style - Posts"
        description="Style guidelines for social media posts"
        value={character.style.post}
        onChange={(post) =>
          onChange({ ...character, style: { ...character.style, post } })
        }
        placeholder="Add a post style guideline..."
        inputType="textarea"
      />
    </div>
  );
};

// Plugins Tab
const PluginsTab: React.FC<{
  character: CharacterTemplate;
  onChange: (character: CharacterTemplate) => void;
}> = ({ character, onChange }) => {
  return (
    <div className="space-y-6">
      <div className="bg-[#1a1005] border border-[#f2d08a]/20 rounded-lg p-4">
        <p className="text-sm text-[#f2d08a]/60">
          The Hyperscape plugin is required and pre-selected. You can add
          additional ElizaOS plugins if needed.
        </p>
      </div>

      <ArrayInput
        label="Plugins"
        description="ElizaOS plugins to load for this character"
        value={character.plugins}
        onChange={(plugins) => onChange({ ...character, plugins })}
        placeholder="@elizaos/plugin-name"
        required
      />
    </div>
  );
};

// Secrets Tab
const SecretsTab: React.FC<{
  character: CharacterTemplate;
  onChange: (character: CharacterTemplate) => void;
}> = ({ character, onChange }) => {
  return (
    <div className="space-y-6">
      <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4">
        <p className="text-sm text-yellow-200">
          ⚠️ These secrets are auto-filled from your Hyperscape authentication.
          They allow the agent to connect to the game server.
        </p>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-[#f2d08a]/80">
          Hyperscape Auth Token
        </label>
        <input
          type="password"
          value={character.settings.secrets.HYPERSCAPE_AUTH_TOKEN || ""}
          onChange={(e) =>
            onChange({
              ...character,
              settings: {
                ...character.settings,
                secrets: {
                  ...character.settings.secrets,
                  HYPERSCAPE_AUTH_TOKEN: e.target.value,
                },
              },
            })
          }
          className="w-full bg-[#1a1005] border border-[#8b4513]/30 rounded-lg p-3 text-[#e8ebf4] focus:border-[#f2d08a] outline-none transition-colors font-mono text-sm"
          readOnly
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-[#f2d08a]/80">
          Hyperscape Character ID
        </label>
        <input
          type="text"
          value={character.settings.secrets.HYPERSCAPE_CHARACTER_ID || ""}
          onChange={(e) =>
            onChange({
              ...character,
              settings: {
                ...character.settings,
                secrets: {
                  ...character.settings.secrets,
                  HYPERSCAPE_CHARACTER_ID: e.target.value,
                },
              },
            })
          }
          className="w-full bg-[#1a1005] border border-[#8b4513]/30 rounded-lg p-3 text-[#e8ebf4] focus:border-[#f2d08a] outline-none transition-colors font-mono text-sm"
          readOnly
        />
        <p className="text-xs text-[#f2d08a]/40">
          Character's unique identifier (auto-filled)
        </p>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-[#f2d08a]/80">
          Hyperscape Server URL
        </label>
        <input
          type="text"
          value={character.settings.secrets.HYPERSCAPE_SERVER_URL || ""}
          onChange={(e) =>
            onChange({
              ...character,
              settings: {
                ...character.settings,
                secrets: {
                  ...character.settings.secrets,
                  HYPERSCAPE_SERVER_URL: e.target.value,
                },
              },
            })
          }
          className="w-full bg-[#1a1005] border border-[#8b4513]/30 rounded-lg p-3 text-[#e8ebf4] focus:border-[#f2d08a] outline-none transition-colors"
        />
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-[#f2d08a]/80">
          Wallet Address
        </label>
        <input
          type="text"
          value={character.settings.secrets.wallet || ""}
          onChange={(e) =>
            onChange({
              ...character,
              settings: {
                ...character.settings,
                secrets: {
                  ...character.settings.secrets,
                  wallet: e.target.value,
                },
              },
            })
          }
          className="w-full bg-[#1a1005] border border-[#8b4513]/30 rounded-lg p-3 text-[#e8ebf4] focus:border-[#f2d08a] outline-none transition-colors font-mono text-sm"
          placeholder="0x..."
          readOnly
        />
        <p className="text-xs text-[#f2d08a]/40">
          Character's blockchain wallet address (auto-filled from creation)
        </p>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-[#f2d08a]/80">
          Avatar (VRM Model)
        </label>
        <input
          type="text"
          value={character.settings.avatar || ""}
          onChange={(e) =>
            onChange({
              ...character,
              settings: {
                ...character.settings,
                avatar: e.target.value,
              },
            })
          }
          className="w-full bg-[#1a1005] border border-[#8b4513]/30 rounded-lg p-3 text-[#e8ebf4] focus:border-[#f2d08a] outline-none transition-colors"
          placeholder="/avatars/avatar.vrm"
        />
        <p className="text-xs text-[#f2d08a]/40">
          Path to the character's VRM 3D avatar model
        </p>
      </div>
    </div>
  );
};
