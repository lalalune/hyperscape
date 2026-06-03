/**
 * Settings Panel Component
 *
 * Main container for the settings UI with tabs, search, and profiles.
 *
 * @packageDocumentation
 */

import React, { useCallback, useMemo, useState } from "react";
import { useTheme } from "@/ui";
import {
  useSettings,
  type UseSettingsResult,
  type UseSettingsOptions,
  SETTING_CATEGORIES,
  searchSettings,
  type SettingCategory,
  type SettingDefinition,
} from "@/game/systems/settings";
import { SettingsCategory } from "./SettingsCategory";
import { SettingsControl } from "./SettingsControl";

/** Props for SettingsPanel */
export interface SettingsPanelProps {
  /** Optional pre-configured settings hook */
  settingsHook?: UseSettingsResult;
  /** Options for internal settings hook (if not providing settingsHook) */
  settingsOptions?: UseSettingsOptions;
  /** Initial active category */
  initialCategory?: SettingCategory;
  /** Whether to show the search bar */
  showSearch?: boolean;
  /** Whether to show profiles section */
  showProfiles?: boolean;
  /** Whether to show import/export buttons */
  showImportExport?: boolean;
  /** Compact mode */
  compact?: boolean;
  /** Callback when settings are saved */
  onSave?: () => void;
  /** Callback when settings are reset */
  onReset?: () => void;
  /** Optional className */
  className?: string;
  /** Optional style */
  style?: React.CSSProperties;
}

/**
 * Settings Panel
 *
 * Complete settings UI with category tabs, search, and profile management.
 *
 * @example
 * ```tsx
 * <SettingsPanel
 *   showSearch
 *   showProfiles
 *   onSave={() => console.log('Settings saved!')}
 * />
 * ```
 */
export function SettingsPanel({
  settingsHook,
  settingsOptions,
  initialCategory = "graphics",
  showSearch = true,
  showProfiles = true,
  showImportExport = true,
  compact = false,
  onSave,
  onReset,
  className,
  style,
}: SettingsPanelProps): React.ReactElement {
  const theme = useTheme();
  const internalSettings = useSettings(settingsOptions);
  const settings = settingsHook ?? internalSettings;

  const [activeCategory, setActiveCategory] =
    useState<SettingCategory>(initialCategory);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [newProfileName, setNewProfileName] = useState("");

  // Filter settings by search
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return null;
    return searchSettings(searchQuery);
  }, [searchQuery]);

  // Group search results by category
  const groupedSearchResults = useMemo(() => {
    if (!searchResults) return null;
    const grouped: Record<SettingCategory, SettingDefinition[]> = {
      graphics: [],
      audio: [],
      controls: [],
      interface: [],
      gameplay: [],
      accessibility: [],
    };
    for (const setting of searchResults) {
      grouped[setting.category].push(setting);
    }
    return grouped;
  }, [searchResults]);

  const handleSave = useCallback(async () => {
    await settings.save();
    onSave?.();
  }, [settings, onSave]);

  const handleReset = useCallback(() => {
    settings.resetAll();
    onReset?.();
  }, [settings, onReset]);

  const handleCreateProfile = useCallback(async () => {
    if (newProfileName.trim()) {
      await settings.createProfile(newProfileName.trim());
      setNewProfileName("");
      setShowProfileModal(false);
    }
  }, [settings, newProfileName]);

  const handleExport = useCallback(() => {
    const json = settings.exportSettings();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "hyperia-settings.json";
    a.click();
    URL.revokeObjectURL(url);
  }, [settings]);

  const handleImport = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const json = ev.target?.result as string;
          settings.importSettings(json);
        };
        reader.readAsText(file);
      }
    };
    input.click();
  }, [settings]);

  // Styles
  const containerStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    backgroundColor: theme.colors.background.primary,
    color: theme.colors.text.primary,
    fontFamily: theme.typography.fontFamily.body,
    ...style,
  };

  const headerStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: theme.spacing.md,
    borderBottom: `1px solid ${theme.colors.border.default}`,
  };

  const titleStyle: React.CSSProperties = {
    fontSize: theme.typography.fontSize.xl,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text.primary,
  };

  const searchContainerStyle: React.CSSProperties = {
    padding: `${theme.spacing.sm}px ${theme.spacing.md}px`,
    borderBottom: `1px solid ${theme.colors.border.default}`,
  };

  const searchInputStyle: React.CSSProperties = {
    width: "100%",
    padding: `${theme.spacing.sm}px ${theme.spacing.md}px`,
    backgroundColor: theme.colors.background.secondary,
    color: theme.colors.text.primary,
    border: `1px solid ${theme.colors.border.default}`,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.fontSize.sm,
    outline: "none",
  };

  const mainContentStyle: React.CSSProperties = {
    display: "flex",
    flex: 1,
    overflow: "hidden",
  };

  const sidebarStyle: React.CSSProperties = {
    width: compact ? 120 : 180,
    borderRight: `1px solid ${theme.colors.border.default}`,
    backgroundColor: theme.colors.background.secondary,
    overflowY: "auto",
  };

  const contentStyle: React.CSSProperties = {
    flex: 1,
    overflowY: "auto",
    padding: 0,
  };

  const categoryTabStyle = (isActive: boolean): React.CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: theme.spacing.sm,
    width: "100%",
    padding: `${theme.spacing.sm}px ${theme.spacing.md}px`,
    backgroundColor: isActive
      ? theme.colors.background.tertiary
      : "transparent",
    color: isActive ? theme.colors.accent.primary : theme.colors.text.secondary,
    border: "none",
    borderLeft: isActive
      ? `3px solid ${theme.colors.accent.primary}`
      : "3px solid transparent",
    fontSize: theme.typography.fontSize.sm,
    fontWeight: isActive
      ? theme.typography.fontWeight.medium
      : theme.typography.fontWeight.normal,
    textAlign: "left",
    cursor: "pointer",
    transition: theme.transitions.fast,
  });

  const footerStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: theme.spacing.md,
    borderTop: `1px solid ${theme.colors.border.default}`,
    backgroundColor: theme.colors.background.secondary,
  };

  const buttonGroupStyle: React.CSSProperties = {
    display: "flex",
    gap: theme.spacing.sm,
  };

  const buttonStyle = (
    variant: "primary" | "secondary" | "danger",
  ): React.CSSProperties => ({
    padding: `${theme.spacing.sm}px ${theme.spacing.md}px`,
    backgroundColor:
      variant === "primary"
        ? theme.colors.accent.primary
        : variant === "danger"
          ? theme.colors.state.danger
          : "transparent",
    color:
      variant === "primary" || variant === "danger"
        ? theme.colors.background.primary
        : theme.colors.text.primary,
    border:
      variant === "secondary"
        ? `1px solid ${theme.colors.border.default}`
        : "none",
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium,
    cursor: "pointer",
    transition: theme.transitions.fast,
  });

  const unsavedBadgeStyle: React.CSSProperties = {
    padding: `${theme.spacing.xs}px ${theme.spacing.sm}px`,
    backgroundColor: theme.colors.state.warning + "20",
    color: theme.colors.state.warning,
    fontSize: theme.typography.fontSize.xs,
    borderRadius: theme.borderRadius.sm,
  };

  // Loading state
  if (settings.isLoading) {
    return (
      <div className={className} style={{ ...containerStyle, ...style }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            color: theme.colors.text.muted,
          }}
        >
          Loading settings...
        </div>
      </div>
    );
  }

  return (
    <div className={className} style={containerStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <h2 style={titleStyle}>Settings</h2>
        {settings.hasUnsavedChanges && (
          <span style={unsavedBadgeStyle}>Unsaved Changes</span>
        )}
      </div>

      {/* Search */}
      {showSearch && (
        <div style={searchContainerStyle}>
          <input
            type="text"
            placeholder="Search settings..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={searchInputStyle}
            aria-label="Search settings"
          />
        </div>
      )}

      {/* Main Content */}
      <div style={mainContentStyle}>
        {/* Sidebar - Category Tabs */}
        {!searchQuery && (
          <div style={sidebarStyle}>
            {SETTING_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                style={categoryTabStyle(activeCategory === cat.id)}
              >
                {cat.label}
              </button>
            ))}
            {showProfiles && (
              <>
                <div
                  style={{
                    height: 1,
                    backgroundColor: theme.colors.border.default,
                    margin: `${theme.spacing.sm}px 0`,
                  }}
                />
                <button
                  onClick={() => setShowProfileModal(true)}
                  style={{
                    ...categoryTabStyle(false),
                    color: theme.colors.accent.primary,
                  }}
                >
                  Profiles
                </button>
              </>
            )}
          </div>
        )}

        {/* Content Area */}
        <div style={contentStyle}>
          {searchQuery && groupedSearchResults ? (
            // Search Results
            <div style={{ padding: theme.spacing.md }}>
              <h3
                style={{
                  color: theme.colors.text.muted,
                  fontSize: theme.typography.fontSize.sm,
                  marginBottom: theme.spacing.md,
                }}
              >
                Search results for "{searchQuery}"
              </h3>
              {searchResults && searchResults.length > 0 ? (
                Object.entries(groupedSearchResults).map(
                  ([cat, catSettings]) =>
                    catSettings.length > 0 && (
                      <div key={cat} style={{ marginBottom: theme.spacing.lg }}>
                        <h4
                          style={{
                            color: theme.colors.text.accent,
                            fontSize: theme.typography.fontSize.xs,
                            textTransform: "uppercase",
                            letterSpacing: "0.5px",
                            marginBottom: theme.spacing.sm,
                          }}
                        >
                          {SETTING_CATEGORIES.find((c) => c.id === cat)
                            ?.label ?? cat}
                        </h4>
                        {catSettings.map((setting) => (
                          <SettingsControl
                            key={setting.id}
                            setting={setting}
                            value={
                              settings.values[setting.id] ??
                              setting.defaultValue
                            }
                            onChange={(value) =>
                              settings.setValue(setting.id, value)
                            }
                            compact={compact}
                          />
                        ))}
                      </div>
                    ),
                )
              ) : (
                <div
                  style={{
                    textAlign: "center",
                    color: theme.colors.text.muted,
                    padding: theme.spacing.lg,
                  }}
                >
                  No settings found
                </div>
              )}
            </div>
          ) : (
            // Category View
            <SettingsCategory
              category={activeCategory}
              values={settings.values}
              onChange={(id, value) => settings.setValue(id, value)}
              showAdvanced={showAdvanced}
              onToggleAdvanced={setShowAdvanced}
              onResetCategory={() => settings.resetCategory(activeCategory)}
              compact={compact}
            />
          )}
        </div>
      </div>

      {/* Footer */}
      <div style={footerStyle}>
        <div style={buttonGroupStyle}>
          {showImportExport && (
            <>
              <button onClick={handleImport} style={buttonStyle("secondary")}>
                Import
              </button>
              <button onClick={handleExport} style={buttonStyle("secondary")}>
                Export
              </button>
            </>
          )}
        </div>
        <div style={buttonGroupStyle}>
          <button onClick={handleReset} style={buttonStyle("secondary")}>
            Reset All
          </button>
          {settings.hasUnsavedChanges && (
            <button
              onClick={() => settings.discardChanges()}
              style={buttonStyle("secondary")}
            >
              Discard
            </button>
          )}
          <button onClick={handleSave} style={buttonStyle("primary")}>
            Save
          </button>
        </div>
      </div>

      {/* Profile Modal */}
      {showProfileModal && (
        <ProfileModal
          profiles={settings.profiles}
          activeProfile={settings.activeProfile}
          newProfileName={newProfileName}
          onNewProfileNameChange={setNewProfileName}
          onCreateProfile={handleCreateProfile}
          onLoadProfile={(id) => {
            settings.loadProfile(id);
            setShowProfileModal(false);
          }}
          onDeleteProfile={settings.deleteProfile}
          onRenameProfile={settings.renameProfile}
          onClose={() => setShowProfileModal(false)}
        />
      )}
    </div>
  );
}

/** Profile management modal */
function ProfileModal({
  profiles,
  activeProfile,
  newProfileName,
  onNewProfileNameChange,
  onCreateProfile,
  onLoadProfile,
  onDeleteProfile,
  onRenameProfile,
  onClose,
}: {
  profiles: { id: string; name: string; isDefault: boolean }[];
  activeProfile: { id: string; name: string } | null;
  newProfileName: string;
  onNewProfileNameChange: (name: string) => void;
  onCreateProfile: () => void;
  onLoadProfile: (id: string) => void;
  onDeleteProfile: (id: string) => void;
  onRenameProfile: (id: string, name: string) => void;
  onClose: () => void;
}): React.ReactElement {
  const theme = useTheme();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const overlayStyle: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: theme.zIndex.modal,
  };

  const modalStyle: React.CSSProperties = {
    width: 400,
    maxHeight: "80vh",
    backgroundColor: theme.colors.background.primary,
    borderRadius: theme.borderRadius.lg,
    border: `1px solid ${theme.colors.border.default}`,
    boxShadow: theme.shadows.xl,
    overflow: "hidden",
  };

  const headerStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: theme.spacing.md,
    borderBottom: `1px solid ${theme.colors.border.default}`,
  };

  const contentStyle: React.CSSProperties = {
    padding: theme.spacing.md,
    maxHeight: 300,
    overflowY: "auto",
  };

  const profileItemStyle = (isActive: boolean): React.CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: theme.spacing.sm,
    padding: theme.spacing.sm,
    backgroundColor: isActive
      ? theme.colors.accent.primary + "10"
      : theme.colors.background.secondary,
    borderRadius: theme.borderRadius.md,
    border: isActive
      ? `1px solid ${theme.colors.accent.primary}`
      : `1px solid ${theme.colors.border.default}`,
    marginBottom: theme.spacing.sm,
  });

  const footerStyle: React.CSSProperties = {
    display: "flex",
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    borderTop: `1px solid ${theme.colors.border.default}`,
  };

  return (
    <div
      style={overlayStyle}
      onClick={onClose}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label="Settings Profiles"
    >
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <div style={headerStyle}>
          <h3
            style={{
              fontSize: theme.typography.fontSize.lg,
              fontWeight: theme.typography.fontWeight.semibold,
              color: theme.colors.text.primary,
            }}
          >
            Settings Profiles
          </h3>
          <button
            onClick={onClose}
            style={{
              backgroundColor: "transparent",
              border: "none",
              color: theme.colors.text.muted,
              cursor: "pointer",
              padding: theme.spacing.xs,
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div style={contentStyle}>
          {profiles.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                color: theme.colors.text.muted,
                padding: theme.spacing.lg,
              }}
            >
              No profiles saved. Create one to save your settings.
            </div>
          ) : (
            profiles.map((profile) => (
              <div
                key={profile.id}
                style={profileItemStyle(activeProfile?.id === profile.id)}
              >
                {editingId === profile.id ? (
                  <>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      style={{
                        flex: 1,
                        padding: `${theme.spacing.xs}px ${theme.spacing.sm}px`,
                        backgroundColor: theme.colors.background.primary,
                        border: `1px solid ${theme.colors.border.default}`,
                        borderRadius: theme.borderRadius.sm,
                        color: theme.colors.text.primary,
                        fontSize: theme.typography.fontSize.sm,
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          onRenameProfile(profile.id, editName);
                          setEditingId(null);
                        }
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      autoFocus
                    />
                    <button
                      onClick={() => {
                        onRenameProfile(profile.id, editName);
                        setEditingId(null);
                      }}
                      style={{
                        padding: theme.spacing.xs,
                        backgroundColor: theme.colors.accent.primary,
                        border: "none",
                        borderRadius: theme.borderRadius.sm,
                        color: theme.colors.background.primary,
                        cursor: "pointer",
                      }}
                    >
                      Save
                    </button>
                  </>
                ) : (
                  <>
                    <span
                      style={{
                        flex: 1,
                        color: theme.colors.text.primary,
                        fontSize: theme.typography.fontSize.sm,
                      }}
                    >
                      {profile.name}
                    </span>
                    <button
                      onClick={() => onLoadProfile(profile.id)}
                      style={{
                        padding: `${theme.spacing.xs}px ${theme.spacing.sm}px`,
                        backgroundColor: theme.colors.background.tertiary,
                        border: `1px solid ${theme.colors.border.default}`,
                        borderRadius: theme.borderRadius.sm,
                        color: theme.colors.text.primary,
                        cursor: "pointer",
                        fontSize: theme.typography.fontSize.xs,
                      }}
                    >
                      Load
                    </button>
                    <button
                      onClick={() => {
                        setEditingId(profile.id);
                        setEditName(profile.name);
                      }}
                      style={{
                        padding: theme.spacing.xs,
                        backgroundColor: "transparent",
                        border: "none",
                        color: theme.colors.text.muted,
                        cursor: "pointer",
                      }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => onDeleteProfile(profile.id)}
                      style={{
                        padding: theme.spacing.xs,
                        backgroundColor: "transparent",
                        border: "none",
                        color: theme.colors.state.danger,
                        cursor: "pointer",
                      }}
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            ))
          )}
        </div>
        <div style={footerStyle}>
          <input
            type="text"
            placeholder="New profile name"
            value={newProfileName}
            onChange={(e) => onNewProfileNameChange(e.target.value)}
            style={{
              flex: 1,
              padding: `${theme.spacing.sm}px`,
              backgroundColor: theme.colors.background.secondary,
              border: `1px solid ${theme.colors.border.default}`,
              borderRadius: theme.borderRadius.md,
              color: theme.colors.text.primary,
              fontSize: theme.typography.fontSize.sm,
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") onCreateProfile();
            }}
          />
          <button
            onClick={onCreateProfile}
            disabled={!newProfileName.trim()}
            style={{
              padding: `${theme.spacing.sm}px ${theme.spacing.md}px`,
              backgroundColor: newProfileName.trim()
                ? theme.colors.accent.primary
                : theme.colors.background.tertiary,
              border: "none",
              borderRadius: theme.borderRadius.md,
              color: newProfileName.trim()
                ? theme.colors.background.primary
                : theme.colors.text.disabled,
              cursor: newProfileName.trim() ? "pointer" : "not-allowed",
              fontSize: theme.typography.fontSize.sm,
              fontWeight: theme.typography.fontWeight.medium,
            }}
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}
