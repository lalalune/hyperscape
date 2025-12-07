"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  SettingsSection,
  TacticalInput,
  TacticalSwitch,
  TacticalSelect,
} from "@/components/settings/settings-components";
import { useNotifications } from "@/components/providers/notification-provider";
import { Save, RefreshCw, Monitor, Shield, Server } from "lucide-react";

type SettingsTab = "general" | "server" | "security";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");
  const [loading, setLoading] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const { addNotification } = useNotifications();

  // -- Mock State --
  const [config, setConfig] = useState({
    // General
    theme: "dark",
    density: "compact",
    animations: true,
    // Server
    maintenanceMode: false,
    motd: "Welcome to Hyperscape Alpha",
    maxPlayers: "2000",
    logLevel: "info",
    // Security (Mock)
    adminKeyRotated: "2024-10-15",
    require2FA: true,
  });

  // Simulate Load
  useEffect(() => {
    const saved = localStorage.getItem("hyperscape_admin_settings");
    if (saved) {
      try {
        // eslint-disable-next-line react-hooks/exhaustive-deps
        setConfig((prev) => ({ ...prev, ...JSON.parse(saved) }));
      } catch (e) {
        console.warn("Invalid settings storage", e);
      }
    }
  }, []);

  const handleSave = () => {
    setLoading(true);
    // Simulate API call
    setTimeout(() => {
      localStorage.setItem("hyperscape_admin_settings", JSON.stringify(config));
      setLoading(false);
      setIsDirty(false);
      addNotification(
        "Settings Saved",
        "Administration panel configuration updated successfully.",
        "success",
      );
    }, 800);
  };

  const updateConfig = (key: keyof typeof config, value: string | boolean) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
    setIsDirty(true);
  };

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col md:flex-row overflow-hidden">
      {/* Sidebar Navigation */}
      <div className="w-full md:w-64 shrink-0 border-r border-(--border-primary) bg-(--bg-secondary)/20 p-4 overflow-y-auto">
        <h2 className="text-xs font-bold text-(--text-muted) uppercase tracking-wider mb-4 px-2">
          Configuration
        </h2>

        <nav className="flex flex-col gap-1">
          <NavButton
            active={activeTab === "general"}
            onClick={() => setActiveTab("general")}
            icon={<Monitor className="w-4 h-4" />}
            label="General UI"
          />
          <NavButton
            active={activeTab === "server"}
            onClick={() => setActiveTab("server")}
            icon={<Server className="w-4 h-4" />}
            label="Server Control"
          />
          <NavButton
            active={activeTab === "security"}
            onClick={() => setActiveTab("security")}
            icon={<Shield className="w-4 h-4" />}
            label="Security"
          />
        </nav>

        {/* Save Indicator */}
        {isDirty && (
          <div className="mt-8 p-4 bg-(--bg-primary) border border-(--color-warning) rounded-sm animate-pulse">
            <p className="text-xs text-(--color-warning) font-bold mb-2">
              UNSAVED CHANGES
            </p>
            <button
              onClick={handleSave}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-(--color-warning) text-black font-bold text-xs py-2 rounded-sm hover:brightness-110 active:scale-95 transition-all"
            >
              {loading ? (
                <RefreshCw className="w-3 h-3 animate-spin" />
              ) : (
                <Save className="w-3 h-3" />
              )}
              SAVE CONFIG
            </button>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-10 relative">
        {/* Background Grid Accent */}
        <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-5 pointer-events-none" />

        <div className="max-w-3xl mx-auto relative">
          {/* GENERAL TAB */}
          {activeTab === "general" && (
            <>
              <SettingsSection
                title="Interface Preferences"
                description="Customize the appearance and behavior of the Admin Command Console."
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <TacticalSelect
                    label="Theme Mode"
                    value={config.theme}
                    onChange={(v) => updateConfig("theme", v)}
                    options={[
                      { label: "Tactical Dark", value: "dark" },
                      { label: "Cyber Light (Coming Soon)", value: "light" },
                      { label: "High Contrast", value: "contrast" },
                    ]}
                  />
                  <TacticalSelect
                    label="Data Density"
                    value={config.density}
                    onChange={(v) => updateConfig("density", v)}
                    options={[
                      { label: "Compact", value: "compact" },
                      { label: "Comfortable", value: "comfortable" },
                    ]}
                  />
                </div>

                <TacticalSwitch
                  label="Reduce Motion"
                  description="Disable complex animations for better performance."
                  checked={!config.animations}
                  onCheckedChange={(checked) =>
                    updateConfig("animations", !checked)
                  }
                />
              </SettingsSection>
            </>
          )}

          {/* SERVER TAB */}
          {activeTab === "server" && (
            <>
              <SettingsSection
                title="Game Server Status"
                description="Control global server state. Warning: These actions affect all connected players."
                className="border-l-2 border-(--color-danger) pl-6"
              >
                <TacticalSwitch
                  label="Maintenance Mode"
                  description="If enabled, only Admins can connect. Players will receive a 'Under Maintenance' error."
                  checked={config.maintenanceMode}
                  onCheckedChange={(v) => updateConfig("maintenanceMode", v)}
                />
              </SettingsSection>

              <SettingsSection title="Message of the Day">
                <TacticalInput
                  label="MOTD Banner"
                  value={config.motd}
                  onChange={(e) => updateConfig("motd", e.target.value)}
                  placeholder="Enter global announcement..."
                />
              </SettingsSection>

              <SettingsSection title="Limits & Regulation">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <TacticalInput
                    label="Max Concurrent Players"
                    type="number"
                    value={config.maxPlayers}
                    onChange={(e) => updateConfig("maxPlayers", e.target.value)}
                  />
                  <TacticalSelect
                    label="Server Log Level"
                    value={config.logLevel}
                    onChange={(v) => updateConfig("logLevel", v)}
                    options={[
                      { label: "Error Only", value: "error" },
                      { label: "Info", value: "info" },
                      { label: "Debug (Verbose)", value: "debug" },
                    ]}
                  />
                </div>
              </SettingsSection>
            </>
          )}

          {/* SECURITY TAB */}
          {activeTab === "security" && (
            <>
              <SettingsSection title="Access Control">
                <TacticalSwitch
                  label="Enforce Admin 2FA"
                  description="Require Two-Factor Authentication for all sensitive admin actions."
                  checked={config.require2FA}
                  onCheckedChange={(v) => updateConfig("require2FA", v)}
                />
              </SettingsSection>

              <SettingsSection title="Encryption Keys">
                <div className="flex flex-col gap-4 p-4 border border-(--border-primary) bg-(--bg-secondary)/20 rounded-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-mono text-(--text-muted)">
                      Last Rotation
                    </span>
                    <span className="text-sm font-bold">
                      {config.adminKeyRotated}
                    </span>
                  </div>
                  <button className="btn-secondary w-fit text-xs self-end">
                    ROTATE KEYS
                  </button>
                </div>
              </SettingsSection>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function NavButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 w-full px-4 py-3 text-left transition-all duration-200 rounded-sm",
        "hover:bg-(--bg-secondary)/50",
        active
          ? "bg-(--accent-primary)/10 text-(--accent-primary) border-r-2 border-(--accent-primary)"
          : "text-(--text-muted)",
      )}
    >
      {icon}
      <span className={cn("text-sm font-medium", active && "font-bold")}>
        {label}
      </span>
    </button>
  );
}
