import React from "react";
import { Save, RefreshCw } from "lucide-react";
import { Agent } from "../../screens/DashboardScreen";

interface AgentSettingsProps {
  agent: Agent;
}

export const AgentSettings: React.FC<AgentSettingsProps> = ({ agent }) => {
  const [settings, setSettings] = React.useState<any>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch(
          `http://localhost:3000/hyperscape/settings/${agent.id}`,
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
      const response = await fetch(
        `http://localhost:3000/hyperscape/settings/${agent.id}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(settings),
        },
      );
      if (response.ok) {
        alert("Settings saved successfully!");
      } else {
        alert("Failed to save settings.");
      }
    } catch (error) {
      console.error("Failed to save settings:", error);
      alert("Error saving settings.");
    } finally {
      setSaving(false);
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
          <div className="pt-6 flex items-center justify-end gap-4 border-t border-[#8b4513]/30">
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
  );
};
