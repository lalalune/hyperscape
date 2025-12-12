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
import { ELIZAOS_API } from "@/lib/api-config";

/**
 * Helper function to generate JWT with retry logic
 * Prevents broken agents due to temporary network failures
 *
 * @param characterId - Character UUID
 * @param accountId - User account ID (Privy)
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @param retryDelay - Delay between retries in milliseconds (default: 1000)
 * @returns JWT token string
 * @throws Error if all retry attempts fail
 */
async function generateJWTWithRetry(
  characterId: string,
  accountId: string,
  maxRetries: number = 3,
  retryDelay: number = 1000,
): Promise<string> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(
        `[CharacterEditor] JWT generation attempt ${attempt}/${maxRetries}...`,
      );

      const credResponse = await fetch(
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

      if (!credResponse.ok) {
        throw new Error(`JWT generation failed: HTTP ${credResponse.status}`);
      }

      const credentials = await credResponse.json();
      if (!credentials.authToken) {
        throw new Error("JWT generation failed: No token in response");
      }

      console.log(
        `[CharacterEditor] ✅ JWT generated successfully on attempt ${attempt}`,
      );
      return credentials.authToken;
    } catch (error) {
      lastError = error as Error;
      console.warn(
        `[CharacterEditor] JWT generation attempt ${attempt} failed: ${lastError.message}`,
      );

      if (attempt < maxRetries) {
        console.log(`[CharacterEditor] Retrying in ${retryDelay / 1000}s...`);
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      }
    }
  }

  // All retries failed
  throw new Error(
    `JWT generation failed after ${maxRetries} attempts: ${lastError?.message || "Unknown error"}`,
  );
}

export const CharacterEditorScreen: React.FC = () => {
  const [activeTab, setActiveTab] = React.useState<
    "basic" | "content" | "style" | "plugins" | "secrets"
  >("basic");
  const [character, setCharacter] = React.useState<CharacterTemplate | null>(
    null,
  );
  const [saving, setSaving] = React.useState(false);
  const [errors, setErrors] = React.useState<string[]>([]);
  const [showCancelDialog, setShowCancelDialog] = React.useState(false);
  const [cancelAction, setCancelAction] = React.useState<
    "none" | "deleting" | "converting"
  >("none");

  const [characterId, setCharacterId] = React.useState<string | null>(null);
  const [agentId, setAgentId] = React.useState<string | null>(null);
  const [authChecked, setAuthChecked] = React.useState(false);

  // Check authentication on mount
  React.useEffect(() => {
    const accountId = localStorage.getItem("privy_user_id");
    if (!accountId) {
      console.error(
        "[CharacterEditor] No authentication found, redirecting to login",
      );
      window.location.href = "/";
      return;
    }
    console.log("[CharacterEditor] ✅ Authentication verified:", accountId);
    setAuthChecked(true);
  }, []);

  // Initialize character from URL params and fetch existing agent if it exists
  React.useEffect(() => {
    if (!authChecked) return; // Wait for auth check
    const params = new URLSearchParams(window.location.search);
    const characterIdParam = params.get("characterId");
    const agentIdParam = params.get("agentId");
    const name = params.get("name");
    const wallet = params.get("wallet");
    const avatar = params.get("avatar");

    if (!characterIdParam) {
      console.error("[CharacterEditor] No character ID provided");
      window.location.href = "/";
      return;
    }

    if (!name) {
      console.error("[CharacterEditor] No character name provided");
      window.location.href = "/";
      return;
    }

    setCharacterId(characterIdParam);
    if (agentIdParam) {
      setAgentId(agentIdParam);
    }

    // Fetch existing agent and credentials securely
    const fetchExistingAgent = async () => {
      const accountId = localStorage.getItem("privy_user_id");
      if (!accountId) {
        console.error("[CharacterEditor] No account ID found");
        return;
      }

      try {
        console.log(
          "[CharacterEditor] Fetching existing agent from ElizaOS...",
        );
        const response = await fetch(`${ELIZAOS_API}/agents`);

        if (response.ok) {
          const data = await response.json();
          const agents = data.data?.agents || [];

          // Find agent by character ID or agent ID
          const existingAgent = agents.find(
            (agent: {
              id?: string;
              settings?: { secrets?: { HYPERSCAPE_CHARACTER_ID?: string } };
            }) =>
              agent.id === agentIdParam ||
              agent.id === characterIdParam ||
              agent.settings?.secrets?.HYPERSCAPE_CHARACTER_ID ===
                characterIdParam,
          );

          if (existingAgent) {
            console.log(
              "[CharacterEditor] ✅ Found existing agent, loading data...",
            );

            // Store the agent's UUID for updates
            if (existingAgent.id) {
              setAgentId(existingAgent.id as string);
            }

            // Generate base template with all required fields and defaults
            const baseTemplate = generateCharacterTemplate(
              name,
              wallet || undefined,
              avatar || undefined,
              characterIdParam,
            );

            // Helper to ensure value is an array
            const ensureArray = (
              value: unknown,
              fallback: unknown[],
            ): unknown[] => {
              if (Array.isArray(value)) return value;
              if (typeof value === "string") return [value];
              return fallback;
            };

            // Merge existing agent data with template defaults (existing data takes priority)
            const loadedAgent: CharacterTemplate = {
              id: existingAgent.id, // Use ElizaOS-generated UUID (will be undefined if not set)
              name: existingAgent.name || name,
              username: existingAgent.username || baseTemplate.username,
              system: existingAgent.system || baseTemplate.system,
              bio: ensureArray(existingAgent.bio, baseTemplate.bio) as string[],
              topics: ensureArray(
                existingAgent.topics,
                baseTemplate.topics,
              ) as string[],
              adjectives: ensureArray(
                existingAgent.adjectives,
                baseTemplate.adjectives,
              ) as string[],
              plugins: ensureArray(
                existingAgent.plugins,
                baseTemplate.plugins,
              ) as string[],
              knowledge: ensureArray(
                existingAgent.knowledge,
                baseTemplate.knowledge || [],
              ) as string[],
              messageExamples: ensureArray(
                existingAgent.messageExamples,
                baseTemplate.messageExamples || [],
              ) as Array<Array<{ user: string; content: { text: string } }>>,
              postExamples: ensureArray(
                existingAgent.postExamples,
                baseTemplate.postExamples || [],
              ) as string[],
              style: existingAgent.style || baseTemplate.style,
              settings: {
                ...baseTemplate.settings,
                ...(existingAgent.settings || {}),
                secrets: {
                  ...baseTemplate.settings.secrets,
                  ...(existingAgent.settings?.secrets || {}),
                },
              },
            };

            // Fetch JWT securely from backend with retry logic (never from URL)
            try {
              const authToken = await generateJWTWithRetry(
                characterIdParam,
                accountId,
              );
              loadedAgent.settings.secrets.HYPERSCAPE_AUTH_TOKEN = authToken;
            } catch (error) {
              console.error(
                "[CharacterEditor] Failed to fetch JWT after retries:",
                error,
              );
            }

            // Pre-fill other fields from URL params (only if not already set)
            if (!loadedAgent.settings.secrets.HYPERSCAPE_CHARACTER_ID) {
              loadedAgent.settings.secrets.HYPERSCAPE_CHARACTER_ID =
                characterIdParam;
            }
            if (wallet && !loadedAgent.settings.secrets.wallet) {
              loadedAgent.settings.secrets.wallet = wallet;
            }
            if (avatar && !loadedAgent.settings.avatar) {
              loadedAgent.settings.avatar = avatar;
            }

            console.log(
              "[CharacterEditor] ✅ Merged agent with template defaults",
            );
            setCharacter(loadedAgent);
            return;
          }
        }

        console.log(
          "[CharacterEditor] No existing agent found, creating new template...",
        );
      } catch (error) {
        console.error(
          "[CharacterEditor] Failed to fetch existing agent:",
          error,
        );
      }

      // Fallback: Create new template if agent doesn't exist
      const template = generateCharacterTemplate(
        name,
        wallet || undefined,
        avatar || undefined,
        characterIdParam,
      );

      // Fetch JWT securely with retry logic (never from URL)
      try {
        const authToken = await generateJWTWithRetry(
          characterIdParam,
          accountId,
        );
        template.settings.secrets.HYPERSCAPE_AUTH_TOKEN = authToken;
        template.settings.secrets.HYPERSCAPE_CHARACTER_ID = characterIdParam;
      } catch (error) {
        console.error(
          "[CharacterEditor] Failed to generate JWT after retries:",
          error,
        );
      }

      setCharacter(template);
    };

    fetchExistingAgent();
  }, [authChecked]);

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

      // Ensure all required secrets are present (with retry logic)
      if (!character.settings?.secrets?.HYPERSCAPE_AUTH_TOKEN) {
        console.log(
          "[CharacterEditor] Missing JWT, generating credentials with retry logic...",
        );

        // Generate permanent Hyperscape JWT for agent with retry logic
        const authToken = await generateJWTWithRetry(characterId, accountId);
        character.settings.secrets.HYPERSCAPE_AUTH_TOKEN = authToken;
      }

      // Update character with complete settings
      const updatedCharacter = {
        ...character,
        settings: {
          ...character.settings,
          accountId, // CRITICAL: Link agent to user for dashboard filtering
          characterType: "ai-agent",
          secrets: {
            ...character.settings.secrets,
            HYPERSCAPE_CHARACTER_ID: characterId,
            HYPERSCAPE_ACCOUNT_ID: accountId,
            HYPERSCAPE_SERVER_URL: "ws://localhost:5555/ws",
          },
        },
      };

      // Check if agentId is valid UUID format
      const isValidUUID =
        agentId &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          agentId,
        );

      if (!agentId || !isValidUUID) {
        console.log(
          "[CharacterEditor] No valid agent ID found, creating new agent...",
        );

        // Strip 'id' field - let ElizaOS generate UUID (it expects valid UUID, we have Privy ID)
        const { id, ...characterWithoutId } = updatedCharacter;
        console.log(
          "[CharacterEditor] Removed id field from character payload (ElizaOS will generate UUID)",
        );

        // Create new agent with POST
        const createResponse = await fetch(`${ELIZAOS_API}/agents`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ characterJson: characterWithoutId }),
        });

        if (!createResponse.ok) {
          const errorData = await createResponse.json().catch(() => ({}));
          const errorMessage =
            typeof errorData.error === "string"
              ? errorData.error
              : errorData.message ||
                JSON.stringify(errorData) ||
                createResponse.statusText;
          console.error("[CharacterEditor] ElizaOS error response:", errorData);
          throw new Error(`Failed to create agent: ${errorMessage}`);
        }

        const result = await createResponse.json();
        console.log("[CharacterEditor] ✅ ElizaOS agent created:", result);

        // Extract agent ID from response - OpenAPI spec: data.character.id
        const newAgentId = result.data?.character?.id;
        if (newAgentId) {
          console.log(
            "[CharacterEditor] Saving agent mapping for:",
            newAgentId,
          );

          // Save agent mapping to Hyperscape database (CRITICAL - rollback if fails)
          try {
            const mappingResponse = await fetch(
              "http://localhost:5555/api/agents/mappings",
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  agentId: newAgentId,
                  accountId,
                  characterId,
                  agentName: character.name,
                }),
              },
            );

            if (!mappingResponse.ok) {
              throw new Error(
                `Failed to save agent mapping: HTTP ${mappingResponse.status}`,
              );
            }

            console.log(
              "[CharacterEditor] ✅ Agent mapping saved successfully",
            );
          } catch (mappingError) {
            console.error(
              "[CharacterEditor] ❌ Agent mapping save failed, rolling back agent creation:",
              mappingError,
            );

            // ROLLBACK: Delete agent from ElizaOS
            try {
              await fetch(`${ELIZAOS_API}/agents/${newAgentId}`, {
                method: "DELETE",
              });
              console.log("[CharacterEditor] ✅ Rolled back agent creation");
            } catch (rollbackError) {
              console.error(
                "[CharacterEditor] ❌ Rollback failed:",
                rollbackError,
              );
            }

            throw new Error(
              `Agent creation failed: Could not save agent mapping. ${mappingError instanceof Error ? mappingError.message : String(mappingError)}`,
            );
          }
        }

        // Redirect to dashboard
        console.log("[CharacterEditor] Redirecting to agent dashboard...");
        window.location.href = "/?page=dashboard";
        return;
      }

      console.log("[CharacterEditor] Updating existing agent:", agentId);

      const updateResponse = await fetch(`${ELIZAOS_API}/agents/${agentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: updatedCharacter.name,
          username: updatedCharacter.username,
          system: updatedCharacter.system, // ✅ System prompt (ElizaOS core field)
          bio: updatedCharacter.bio,
          messageExamples: updatedCharacter.messageExamples,
          postExamples: updatedCharacter.postExamples,
          topics: updatedCharacter.topics,
          style: updatedCharacter.style,
          adjectives: updatedCharacter.adjectives,
          knowledge: updatedCharacter.knowledge,
          plugins: updatedCharacter.plugins,
          settings: updatedCharacter.settings,
        }),
      });

      if (!updateResponse.ok) {
        const errorData = await updateResponse.json().catch(() => ({}));
        const errorMessage =
          typeof errorData.error === "string"
            ? errorData.error
            : errorData.message ||
              JSON.stringify(errorData) ||
              updateResponse.statusText;
        console.error("[CharacterEditor] ElizaOS error response:", errorData);
        throw new Error(`Failed to update agent: ${errorMessage}`);
      }

      const result = await updateResponse.json();
      console.log("[CharacterEditor] ✅ ElizaOS agent updated:", result);

      // Update agent mapping in Hyperscape database (CRITICAL)
      if (agentId) {
        console.log("[CharacterEditor] Updating agent mapping for:", agentId);

        try {
          const mappingResponse = await fetch(
            "http://localhost:5555/api/agents/mappings",
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                agentId,
                accountId,
                characterId,
                agentName: character.name,
              }),
            },
          );

          if (!mappingResponse.ok) {
            throw new Error(
              `Failed to update agent mapping: HTTP ${mappingResponse.status}`,
            );
          }

          console.log(
            "[CharacterEditor] ✅ Agent mapping updated successfully",
          );
        } catch (mappingError) {
          console.error(
            "[CharacterEditor] ❌ Agent mapping update failed:",
            mappingError,
          );

          throw new Error(
            `Agent was updated but mapping sync failed. Dashboard may show outdated info. ${mappingError instanceof Error ? mappingError.message : String(mappingError)}`,
          );
        }
      }

      // Redirect to dashboard
      console.log("[CharacterEditor] Redirecting to agent dashboard...");
      window.location.href = "/?page=dashboard";
    } catch (error) {
      console.error("[CharacterEditor] ❌ Failed to save agent:", error);

      // Check if this might be a plugin-related error
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      const missingPlugins = (character.plugins || []).filter(
        (p) => p !== "@hyperscape/plugin-hyperscape",
      );

      if (
        missingPlugins.length > 0 &&
        (errorMessage.includes("plugin") ||
          errorMessage.includes("module") ||
          errorMessage.includes("Cannot find"))
      ) {
        // Plugin installation error
        setErrors([
          `${errorMessage}`,
          "",
          "⚠️ Plugins must be installed before use. Run these commands:",
          ...missingPlugins.map(
            (plugin) => `  bunx elizaos plugins add ${plugin}`,
          ),
          "",
          "Then try saving the agent again.",
        ]);
      } else {
        setErrors([errorMessage]);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setShowCancelDialog(true);
  };

  const handleDeleteCharacter = async () => {
    if (!characterId) return;

    setCancelAction("deleting");
    console.log("[CharacterEditor] 🗑️  Deleting character:", characterId);

    try {
      const response = await fetch(
        `http://localhost:5555/api/characters/${characterId}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        throw new Error(`Failed to delete character: ${response.status}`);
      }

      console.log("[CharacterEditor] ✅ Character deleted successfully");
      window.location.href = "/";
    } catch (error) {
      console.error("[CharacterEditor] ❌ Failed to delete character:", error);
      setErrors([
        error instanceof Error ? error.message : "Failed to delete character",
      ]);
      setCancelAction("none");
      setShowCancelDialog(false);
    }
  };

  const handleConvertToHuman = async () => {
    if (!characterId) return;

    setCancelAction("converting");
    console.log(
      "[CharacterEditor] 🔄 Converting character to human player:",
      characterId,
    );

    try {
      const response = await fetch(
        `http://localhost:5555/api/characters/${characterId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isAgent: false }),
        },
      );

      if (!response.ok) {
        throw new Error(`Failed to convert character: ${response.status}`);
      }

      console.log("[CharacterEditor] ✅ Character converted to human player");
      // Redirect to character select with success message
      window.location.href = "/?converted=true";
    } catch (error) {
      console.error("[CharacterEditor] ❌ Failed to convert character:", error);
      setErrors([
        error instanceof Error ? error.message : "Failed to convert character",
      ]);
      setCancelAction("none");
      setShowCancelDialog(false);
    }
  };

  const handleContinueEditing = () => {
    setShowCancelDialog(false);
  };

  // Show loading while checking auth or character data
  if (!authChecked || !character) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0b0a15] text-[#f2d08a]">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#f2d08a]"></div>
          <div className="text-sm opacity-60">
            {!authChecked
              ? "Verifying authentication..."
              : "Loading character data..."}
          </div>
        </div>
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
                  Configure AI Agent
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
                {saving ? "Saving..." : "Save Changes"}
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

      {/* Cancel Dialog Modal */}
      {showCancelDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={
              cancelAction === "none" ? handleContinueEditing : undefined
            }
          />

          {/* Dialog */}
          <div className="relative bg-[#0b0a15] border-2 border-[#f2d08a]/40 rounded-lg shadow-2xl shadow-[#f2d08a]/20 max-w-lg w-full mx-4">
            {/* Header */}
            <div className="border-b border-[#8b4513]/30 px-6 py-4">
              <h2 className="text-xl font-bold text-[#f2d08a]">
                Cancel Agent Configuration?
              </h2>
              <p className="text-sm text-[#f2d08a]/60 mt-1">
                What would you like to do with this character?
              </p>
            </div>

            {/* Content */}
            <div className="px-6 py-6 space-y-4">
              <p className="text-[#e8ebf4]/80 text-sm leading-relaxed">
                You haven't saved your changes to this agent's configuration.
                Choose what to do next:
              </p>

              {/* Options */}
              <div className="space-y-3 pt-2">
                {/* Option 1: Delete Character */}
                <button
                  onClick={handleDeleteCharacter}
                  disabled={cancelAction !== "none"}
                  className="w-full flex items-center gap-3 p-4 rounded-lg border border-red-500/40 bg-red-900/20 text-red-300 hover:bg-red-900/30 hover:border-red-500/60 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-left"
                >
                  <span className="text-2xl">🗑️</span>
                  <div className="flex-1">
                    <div className="font-semibold">Delete Character</div>
                    <div className="text-xs text-red-400/70 mt-0.5">
                      Remove this character completely. Start fresh later.
                    </div>
                  </div>
                  {cancelAction === "deleting" && (
                    <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-red-400" />
                  )}
                </button>

                {/* Option 2: Convert to Human Player */}
                <button
                  onClick={handleConvertToHuman}
                  disabled={cancelAction !== "none"}
                  className="w-full flex items-center gap-3 p-4 rounded-lg border border-[#f2d08a]/40 bg-[#f2d08a]/10 text-[#f2d08a] hover:bg-[#f2d08a]/20 hover:border-[#f2d08a]/60 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-left"
                >
                  <span className="text-2xl">🎮</span>
                  <div className="flex-1">
                    <div className="font-semibold">Convert to Human Player</div>
                    <div className="text-xs text-[#f2d08a]/60 mt-0.5">
                      Keep the character but play it yourself instead.
                    </div>
                  </div>
                  {cancelAction === "converting" && (
                    <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-[#f2d08a]" />
                  )}
                </button>

                {/* Option 3: Continue Editing */}
                <button
                  onClick={handleContinueEditing}
                  disabled={cancelAction !== "none"}
                  className="w-full flex items-center gap-3 p-4 rounded-lg border border-[#8b4513]/40 bg-[#1a1005] text-[#e8ebf4] hover:bg-[#1a1005]/80 hover:border-[#8b4513]/60 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-left"
                >
                  <span className="text-2xl">✏️</span>
                  <div className="flex-1">
                    <div className="font-semibold">Continue Editing</div>
                    <div className="text-xs text-[#e8ebf4]/60 mt-0.5">
                      Go back and finish setting up the AI agent.
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
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
  const [showTooltip, setShowTooltip] = React.useState(false);
  const [addedPlugin, setAddedPlugin] = React.useState<string | null>(null);
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handlePluginAdd = (plugin: string) => {
    // Only show tooltip for non-hyperscape plugins
    if (plugin !== "@hyperscape/plugin-hyperscape") {
      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      setAddedPlugin(plugin);
      setShowTooltip(true);
      // Auto-hide after 10 seconds
      timeoutRef.current = setTimeout(() => {
        setShowTooltip(false);
        setAddedPlugin(null);
        timeoutRef.current = null;
      }, 10000);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-[#1a1005] border border-[#f2d08a]/20 rounded-lg p-4">
        <p className="text-sm text-[#f2d08a]/60">
          The Hyperscape plugin is required and pre-selected. You can add
          additional ElizaOS plugins if needed.
        </p>
      </div>

      {/* Plugin Installation Tooltip - Only shows when a new plugin is added */}
      {showTooltip && addedPlugin && (
        <div className="bg-orange-900/20 border border-orange-500/40 rounded-lg p-4 space-y-3 relative transition-all duration-300 ease-in-out">
          <button
            onClick={() => {
              if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
              }
              setShowTooltip(false);
              setAddedPlugin(null);
            }}
            className="absolute top-2 right-2 text-orange-400/60 hover:text-orange-400 transition-colors"
            title="Dismiss"
          >
            <X size={16} />
          </button>
          <div className="flex items-start gap-3 pr-6">
            <span className="text-orange-400 text-xl mt-0.5">⚠️</span>
            <div className="flex-1">
              <h3 className="text-orange-300 font-bold text-sm mb-2">
                Plugin Installation Required
              </h3>
              <p className="text-orange-200/80 text-sm leading-relaxed mb-3">
                Before plugins can be used, they must be installed into your
                ElizaOS project. Simply adding them to this list is not
                sufficient.
              </p>
              <div className="bg-black/40 border border-orange-500/30 rounded p-3 mb-2">
                <p className="text-orange-200/70 text-xs font-semibold mb-1.5">
                  After adding a plugin here, run this command:
                </p>
                <code className="block bg-black/60 text-orange-300 px-3 py-2 rounded text-xs font-mono">
                  bunx elizaos plugins add {addedPlugin}
                </code>
              </div>
              <p className="text-orange-200/60 text-xs leading-relaxed">
                <strong>Note:</strong> Make sure to run this command in your
                ElizaOS project directory before the agent can use this plugin.
              </p>
            </div>
          </div>
        </div>
      )}

      <ArrayInput
        label="Plugins"
        description="ElizaOS plugins to load for this character"
        value={character.plugins || []}
        onChange={(plugins) => onChange({ ...character, plugins })}
        onAdd={handlePluginAdd}
        placeholder="@elizaos/plugin-name"
        required
      />

      {/* Plugin List Help */}
      {character.plugins && character.plugins.length > 1 && (
        <div className="bg-[#1a1005] border border-[#f2d08a]/20 rounded-lg p-4">
          <p className="text-xs text-[#f2d08a]/70 font-semibold mb-2">
            📋 Installation Commands for Current Plugins:
          </p>
          <div className="space-y-1">
            {character.plugins
              .filter((p) => p !== "@hyperscape/plugin-hyperscape")
              .map((plugin, i) => (
                <code
                  key={i}
                  className="block bg-black/60 text-[#f2d08a]/80 px-3 py-1.5 rounded text-xs font-mono"
                >
                  bunx elizaos plugins add {plugin}
                </code>
              ))}
          </div>
        </div>
      )}
    </div>
  );
};

// Secrets Tab
const SecretsTab: React.FC<{
  character: CharacterTemplate;
  onChange: (character: CharacterTemplate) => void;
}> = ({ character, onChange }) => {
  const [copiedField, setCopiedField] = React.useState<string | null>(null);

  const handleCopy = async (text: string, fieldName: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldName);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4">
        <p className="text-sm text-yellow-200">
          ⚠️ These credentials are auto-generated for your agent. Keep them
          secure - they allow the agent to authenticate and connect to the game
          server.
        </p>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-medium text-[#f2d08a]/80">
          Hyperscape Auth Token (JWT)
        </label>
        <div className="relative">
          <input
            type="text"
            value={
              character.settings.secrets.HYPERSCAPE_AUTH_TOKEN ||
              "Not generated yet"
            }
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
            className="w-full bg-[#1a1005] border border-[#8b4513]/30 rounded-lg p-3 pr-24 text-[#e8ebf4] focus:border-[#f2d08a] outline-none transition-colors font-mono text-xs"
            readOnly
          />
          {character.settings.secrets.HYPERSCAPE_AUTH_TOKEN && (
            <button
              onClick={() =>
                handleCopy(
                  character.settings.secrets.HYPERSCAPE_AUTH_TOKEN || "",
                  "authToken",
                )
              }
              className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-[#f2d08a]/20 hover:bg-[#f2d08a]/30 text-[#f2d08a] rounded text-xs font-medium transition-colors"
            >
              {copiedField === "authToken" ? "✓ Copied" : "Copy"}
            </button>
          )}
        </div>
        <p className="text-xs text-[#f2d08a]/40">
          Permanent JWT token for agent authentication (auto-generated)
        </p>
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
        <div className="relative">
          <input
            type="text"
            value={character.settings.secrets.wallet || "No wallet created"}
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
            className="w-full bg-[#1a1005] border border-[#8b4513]/30 rounded-lg p-3 pr-24 text-[#e8ebf4] focus:border-[#f2d08a] outline-none transition-colors font-mono text-sm"
            placeholder="0x..."
            readOnly
          />
          {character.settings.secrets.wallet && (
            <button
              onClick={() =>
                handleCopy(character.settings.secrets.wallet || "", "wallet")
              }
              className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-[#f2d08a]/20 hover:bg-[#f2d08a]/30 text-[#f2d08a] rounded text-xs font-medium transition-colors"
            >
              {copiedField === "wallet" ? "✓ Copied" : "Copy"}
            </button>
          )}
        </div>
        <p className="text-xs text-[#f2d08a]/40">
          Character's HD wallet address derived from your main wallet
          (auto-generated)
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

      {/* LLM Provider API Keys Section */}
      <div className="border-t border-[#8b4513]/30 pt-6 mt-6">
        <h3 className="text-lg font-bold text-[#f2d08a] mb-4">
          LLM Provider API Keys
        </h3>
        <div className="bg-blue-900/20 border border-blue-500/40 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-200">
            ℹ️ These API keys are optional and depend on which plugins you're
            using. Only provide keys for the LLM providers you plan to use with
            this agent.
          </p>
        </div>

        <div className="space-y-4">
          {/* OpenAI API Key */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-[#f2d08a]/80">
              OpenAI API Key
            </label>
            <input
              type="password"
              value={character.settings.secrets.OPENAI_API_KEY || ""}
              onChange={(e) =>
                onChange({
                  ...character,
                  settings: {
                    ...character.settings,
                    secrets: {
                      ...character.settings.secrets,
                      OPENAI_API_KEY: e.target.value,
                    },
                  },
                })
              }
              className="w-full bg-[#1a1005] border border-[#8b4513]/30 rounded-lg p-3 text-[#e8ebf4] focus:border-[#f2d08a] outline-none transition-colors font-mono text-sm"
              placeholder="sk-..."
            />
            <p className="text-xs text-[#f2d08a]/40">
              Required for @elizaos/plugin-openai (GPT-4, GPT-3.5, etc.)
            </p>
          </div>

          {/* Anthropic API Key */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-[#f2d08a]/80">
              Anthropic API Key
            </label>
            <input
              type="password"
              value={character.settings.secrets.ANTHROPIC_API_KEY || ""}
              onChange={(e) =>
                onChange({
                  ...character,
                  settings: {
                    ...character.settings,
                    secrets: {
                      ...character.settings.secrets,
                      ANTHROPIC_API_KEY: e.target.value,
                    },
                  },
                })
              }
              className="w-full bg-[#1a1005] border border-[#8b4513]/30 rounded-lg p-3 text-[#e8ebf4] focus:border-[#f2d08a] outline-none transition-colors font-mono text-sm"
              placeholder="sk-ant-..."
            />
            <p className="text-xs text-[#f2d08a]/40">
              Required for @elizaos/plugin-anthropic (Claude 3, Claude 2, etc.)
            </p>
          </div>

          {/* OpenRouter API Key */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-[#f2d08a]/80">
              OpenRouter API Key
            </label>
            <input
              type="password"
              value={character.settings.secrets.OPENROUTER_API_KEY || ""}
              onChange={(e) =>
                onChange({
                  ...character,
                  settings: {
                    ...character.settings,
                    secrets: {
                      ...character.settings.secrets,
                      OPENROUTER_API_KEY: e.target.value,
                    },
                  },
                })
              }
              className="w-full bg-[#1a1005] border border-[#8b4513]/30 rounded-lg p-3 text-[#e8ebf4] focus:border-[#f2d08a] outline-none transition-colors font-mono text-sm"
              placeholder="sk-or-..."
            />
            <p className="text-xs text-[#f2d08a]/40">
              Required for @elizaos/plugin-openrouter (Access to multiple LLM
              providers)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
