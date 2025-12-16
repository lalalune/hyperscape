import React from "react";
import { Save, RefreshCw, Trash2 } from "lucide-react";
import { Agent } from "../../screens/DashboardScreen";
import { ELIZAOS_URL, ELIZAOS_API } from "../../lib/api-config";

interface AgentSettingsData {
  name?: string;
  username?: string;
  bio?: string;
  lore?: string;
  topics?: string[];
  style?: { all?: string[]; chat?: string[]; post?: string[] };
  adjectives?: string[];
}

interface AgentSettingsData {
  name?: string;
  username?: string;
  bio?: string;
  lore?: string;
  topics?: string[];
  style?: { all?: string[]; chat?: string[]; post?: string[] };
  adjectives?: string[];
}

interface AgentSettingsProps {
  agent: Agent;
  onDelete?: (agentId: string) => Promise<void>;
}

export const AgentSettings: React.FC<AgentSettingsProps> = ({
  agent,
  onDelete,
}) => {
  const [settings, setSettings] = React.useState<AgentSettingsData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [statusMessage, setStatusMessage] = React.useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  React.useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch(
          `${ELIZAOS_URL}/hyperscape/settings/${agent.id}`,
        );
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setSettings(data.settings);
          }
        }
      } catch (error) {
        console.error("Failed to fetch settings:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, [agent.id]);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      // Use official ElizaOS API to update agent configuration
      const response = await fetch(`${ELIZAOS_API}/agents/${agent.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: settings.name,
          username: settings.username,
          bio: settings.bio,
          lore: settings.lore,
          topics: settings.topics,
          style: settings.style,
          adjectives: settings.adjectives,
        }),
      });
      if (response.ok) {
        console.log("[AgentSettings] ✅ Settings updated successfully");
        setStatusMessage({
          type: "success",
          text: "Settings saved successfully!",
        });
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error("[AgentSettings] ❌ Failed to save settings:", errorData);
        setStatusMessage({
          type: "error",
          text: `Failed to save settings: ${errorData.error || response.statusText}`,
        });
      }
    } catch (error) {
      console.error("[AgentSettings] ❌ Error saving settings:", error);
      setStatusMessage({ type: "error", text: "Error saving settings." });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    setDeleting(true);
    try {
      await onDelete(agent.id);
      console.log("[AgentSettings] ✅ Agent deleted successfully");
      // Navigation will happen automatically when agent is removed from list
    } catch (error) {
      console.error("[AgentSettings] ❌ Error deleting agent:", error);
      setStatusMessage({
        type: "error",
        text: "Failed to delete agent. Please try again.",
      });
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  if (loading)
    return <div className="p-6 text-[#f2d08a]">Loading settings...</div>;
  if (!settings)
    return <div className="p-6 text-red-400">Failed to load settings.</div>;

  return (
    <div className="flex flex-col h-full bg-[#0b0a15]/50 backdrop-blur-sm overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-[#8b4513]/30 bg-[#0b0a15]/80">
        <h2 className="font-bold text-[#f2d08a] text-2xl mb-2">
          Agent Settings
        </h2>
        <p className="text-[#f2d08a]/60 text-sm">
          Configure your AI agent's behaviour and capabilities.
        </p>
      </div>

      {/* Status Message */}
      {statusMessage && (
        <div
          className={`mx-6 mt-4 p-3 rounded-lg flex items-center justify-between ${
            statusMessage.type === "success"
              ? "bg-green-900/50 border border-green-500/30 text-green-300"
              : "bg-red-900/50 border border-red-500/30 text-red-300"
          }`}
        >
          <span>{statusMessage.text}</span>
          <button
            onClick={() => setStatusMessage(null)}
            className="ml-4 text-current opacity-60 hover:opacity-100"
          >
            ✕
          </button>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto space-y-8">
          {/* Template Selector */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-[#f2d08a]/80">
              Start with a template
            </label>
            <select className="w-full bg-[#1a1005] border border-[#8b4513]/30 rounded-lg p-3 text-[#e8ebf4] focus:border-[#f2d08a] outline-none transition-colors">
              <option>None (Start Blank)</option>
              <option>Hyperscape Adventurer</option>
              <option>Merchant Bot</option>
              <option>Lore Keeper</option>
            </select>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-[#8b4513]/30 gap-6">
            {["Basic", "Content", "Style", "Plugins", "Secret", "Avatar"].map(
              (tab, i) => (
                <button
                  key={tab}
                  className={`pb-3 text-sm font-medium transition-colors relative ${
                    i === 0
                      ? "text-[#f2d08a]"
                      : "text-[#f2d08a]/40 hover:text-[#f2d08a]/80"
                  }`}
                >
                  {tab}
                  {i === 0 && (
                    <div className="absolute bottom-0 left-0 w-full h-0.5 bg-[#f2d08a]" />
                  )}
                </button>
              ),
            )}
          </div>

          {/* Form Fields */}
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-[#f2d08a]/80">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={settings.name || ""}
                onChange={(e) =>
                  setSettings({ ...settings, name: e.target.value })
                }
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
                value={settings.username || ""}
                onChange={(e) =>
                  setSettings({ ...settings, username: e.target.value })
                }
                placeholder="@username"
                className="w-full bg-[#1a1005] border border-[#8b4513]/30 rounded-lg p-3 text-[#e8ebf4] focus:border-[#f2d08a] outline-none transition-colors"
              />
              <p className="text-xs text-[#f2d08a]/40">
                Used in URLs and API endpoints
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-[#f2d08a]/80">
                System <span className="text-red-500">*</span>
              </label>
              <textarea
                rows={6}
                value={settings.bio || ""}
                onChange={(e) =>
                  setSettings({ ...settings, bio: e.target.value })
                }
                className="w-full bg-[#1a1005] border border-[#8b4513]/30 rounded-lg p-3 text-[#e8ebf4] focus:border-[#f2d08a] outline-none transition-colors resize-none font-mono text-sm"
              />
              <p className="text-xs text-[#f2d08a]/40">
                System prompt defining agent behavior
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-[#f2d08a]/80">
                Voice Model
              </label>
              <select className="w-full bg-[#1a1005] border border-[#8b4513]/30 rounded-lg p-3 text-[#e8ebf4] focus:border-[#f2d08a] outline-none transition-colors">
                <option>Select a voice model</option>
                <option>ElevenLabs - Rachel</option>
                <option>ElevenLabs - Drew</option>
              </select>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-6 flex items-center justify-between gap-4 border-t border-[#8b4513]/30">
            <div>
              {onDelete && (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={deleting}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                >
                  <Trash2 size={16} />
                  Delete Agent
                </button>
              )}
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => window.location.reload()}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#f2d08a]/30 text-[#f2d08a] hover:bg-[#f2d08a]/10 transition-colors"
              >
                <RefreshCw size={16} />
                Reset
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

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#0b0a15] border-2 border-red-500/30 rounded-lg p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                <Trash2 className="text-red-400" size={24} />
              </div>
              <div>
                <h3 className="font-bold text-[#f2d08a] text-lg">
                  Delete Agent
                </h3>
                <p className="text-[#f2d08a]/60 text-sm">
                  This action cannot be undone
                </p>
              </div>
            </div>

            <p className="text-[#e8ebf4]/80 mb-6">
              Are you sure you want to delete{" "}
              <span className="font-bold text-[#f2d08a]">{agent.name}</span>?
              This will permanently remove the agent and all its data.
            </p>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="flex-1 px-4 py-2 rounded-lg border border-[#f2d08a]/30 text-[#f2d08a] hover:bg-[#f2d08a]/10 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 px-4 py-2 rounded-lg bg-red-500 text-white font-bold hover:bg-red-600 transition-colors disabled:opacity-50 shadow-lg shadow-red-500/20"
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
