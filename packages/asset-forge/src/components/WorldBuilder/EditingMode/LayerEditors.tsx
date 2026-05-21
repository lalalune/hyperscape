/**
 * LayerEditors
 *
 * Complete editors for all layer types: Quest, Boss, Event, Lore, DifficultyZone, CustomPlacement.
 */

import {
  Scroll,
  Skull,
  Zap,
  BookOpen,
  Shield,
  Package,
  MapPin,
  User,
  Trash2,
  Plus,
  X,
} from "lucide-react";
import React, { useCallback } from "react";

import { useWorldBuilder } from "../WorldBuilderContext";
import type {
  PlacedQuest,
  PlacedBoss,
  PlacedEvent,
  PlacedLore,
  DifficultyZone,
  CustomPlacement,
  WorldPosition,
} from "../types";

import { Button } from "@/components/common";

// ============== SHARED COMPONENTS ==============

interface SectionProps {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
}

const Section: React.FC<SectionProps> = ({
  title,
  icon,
  children,
  collapsible = false,
  defaultOpen = true,
}) => {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);

  return (
    <div className="border border-border-primary rounded-lg overflow-hidden">
      <div
        className={`flex items-center gap-2 px-3 py-2 bg-bg-tertiary ${
          collapsible ? "cursor-pointer hover:bg-bg-secondary" : ""
        }`}
        onClick={() => collapsible && setIsOpen(!isOpen)}
      >
        {icon}
        <span className="text-sm font-medium text-text-primary">{title}</span>
        {collapsible && (
          <span className="ml-auto text-text-muted">{isOpen ? "−" : "+"}</span>
        )}
      </div>
      {(!collapsible || isOpen) && (
        <div className="p-3 space-y-3">{children}</div>
      )}
    </div>
  );
};

interface FieldProps {
  label: string;
  description?: string;
  children: React.ReactNode;
}

const Field: React.FC<FieldProps> = ({ label, description, children }) => (
  <div className="space-y-1">
    <label className="text-xs font-medium text-text-secondary">{label}</label>
    {children}
    {description && <p className="text-xs text-text-muted">{description}</p>}
  </div>
);

interface TextInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
}

const TextInput: React.FC<TextInputProps> = ({
  value,
  onChange,
  placeholder,
  multiline = false,
  rows = 3,
}) => {
  if (multiline) {
    return (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full px-2 py-1.5 bg-bg-tertiary border border-border-primary rounded text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-primary/40 resize-none"
      />
    );
  }
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-2 py-1.5 bg-bg-tertiary border border-border-primary rounded text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-primary/40"
    />
  );
};

interface NumberInputProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}

const NumberInput: React.FC<NumberInputProps> = ({
  value,
  onChange,
  min,
  max,
  step = 1,
}) => (
  <input
    type="number"
    value={value}
    onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
    min={min}
    max={max}
    step={step}
    className="w-full px-2 py-1.5 bg-bg-tertiary border border-border-primary rounded text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-primary/40"
  />
);

interface SelectInputProps {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}

const SelectInput: React.FC<SelectInputProps> = ({
  value,
  onChange,
  options,
}) => (
  <select
    value={value}
    onChange={(e) => onChange(e.target.value)}
    className="w-full px-2 py-1.5 bg-bg-tertiary border border-border-primary rounded text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-primary/40"
  >
    {options.map((opt) => (
      <option key={opt.value} value={opt.value}>
        {opt.label}
      </option>
    ))}
  </select>
);

interface PositionInputProps {
  value: WorldPosition;
  onChange: (value: WorldPosition) => void;
}

const PositionInput: React.FC<PositionInputProps> = ({ value, onChange }) => (
  <div className="grid grid-cols-3 gap-2">
    <div>
      <label className="text-xs text-text-muted">X</label>
      <NumberInput
        value={value.x}
        onChange={(x) => onChange({ ...value, x })}
        step={1}
      />
    </div>
    <div>
      <label className="text-xs text-text-muted">Y</label>
      <NumberInput
        value={value.y}
        onChange={(y) => onChange({ ...value, y })}
        step={0.1}
      />
    </div>
    <div>
      <label className="text-xs text-text-muted">Z</label>
      <NumberInput
        value={value.z}
        onChange={(z) => onChange({ ...value, z })}
        step={1}
      />
    </div>
  </div>
);

interface BoundsInputProps {
  value: { minX: number; maxX: number; minZ: number; maxZ: number };
  onChange: (value: {
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
  }) => void;
}

const BoundsInput: React.FC<BoundsInputProps> = ({ value, onChange }) => (
  <div className="grid grid-cols-2 gap-2">
    <div>
      <label className="text-xs text-text-muted">Min X</label>
      <NumberInput
        value={value.minX}
        onChange={(minX) => onChange({ ...value, minX })}
      />
    </div>
    <div>
      <label className="text-xs text-text-muted">Max X</label>
      <NumberInput
        value={value.maxX}
        onChange={(maxX) => onChange({ ...value, maxX })}
      />
    </div>
    <div>
      <label className="text-xs text-text-muted">Min Z</label>
      <NumberInput
        value={value.minZ}
        onChange={(minZ) => onChange({ ...value, minZ })}
      />
    </div>
    <div>
      <label className="text-xs text-text-muted">Max Z</label>
      <NumberInput
        value={value.maxZ}
        onChange={(maxZ) => onChange({ ...value, maxZ })}
      />
    </div>
  </div>
);

// ============== QUEST EDITOR ==============

interface QuestEditorProps {
  quest: PlacedQuest;
}

export const QuestEditor: React.FC<QuestEditorProps> = ({ quest }) => {
  const { state, actions } = useWorldBuilder();
  const world = state.editing.world;

  const handleUpdate = useCallback(
    (updates: Partial<PlacedQuest>) => {
      actions.updateQuest(quest.id, updates);
    },
    [actions, quest.id],
  );

  const handleDelete = useCallback(() => {
    if (confirm(`Delete quest "${quest.name}"?`)) {
      actions.removeQuest(quest.id);
      actions.setSelection(null);
    }
  }, [actions, quest.id, quest.name]);

  const handleAddLocation = useCallback(() => {
    const newLocation = {
      type: "coordinate" as const,
      position: { x: 0, y: 0, z: 0 },
      description: "New location",
    };
    handleUpdate({
      locations: [...quest.locations, newLocation],
    });
  }, [handleUpdate, quest.locations]);

  const handleUpdateLocation = useCallback(
    (index: number, updates: Partial<PlacedQuest["locations"][0]>) => {
      const newLocations = [...quest.locations];
      newLocations[index] = { ...newLocations[index], ...updates };
      handleUpdate({ locations: newLocations });
    },
    [handleUpdate, quest.locations],
  );

  const handleRemoveLocation = useCallback(
    (index: number) => {
      const newLocations = quest.locations.filter((_, i) => i !== index);
      handleUpdate({ locations: newLocations });
    },
    [handleUpdate, quest.locations],
  );

  // Get NPCs for dropdown
  const npcs = world?.layers.npcs || [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Scroll className="w-5 h-5 text-indigo-400" />
          <h3 className="font-medium text-text-primary">Quest</h3>
        </div>
        <Button
          variant="danger"
          size="sm"
          onClick={handleDelete}
          className="text-xs"
        >
          <Trash2 className="w-3 h-3 mr-1" />
          Delete
        </Button>
      </div>

      {/* Basic Info */}
      <Section title="Basic Information">
        <Field label="Name">
          <TextInput
            value={quest.name}
            onChange={(name) => handleUpdate({ name })}
            placeholder="Quest name"
          />
        </Field>
        <Field label="Template ID">
          <TextInput
            value={quest.questTemplateId}
            onChange={(questTemplateId) => handleUpdate({ questTemplateId })}
            placeholder="quest_template_id"
          />
        </Field>
        <Field label="Required Level">
          <NumberInput
            value={quest.requiredLevel}
            onChange={(requiredLevel) => handleUpdate({ requiredLevel })}
            min={1}
            max={100}
          />
        </Field>
      </Section>

      {/* NPCs */}
      <Section title="NPCs" icon={<User className="w-4 h-4 text-cyan-400" />}>
        <Field label="Quest Giver">
          <SelectInput
            value={quest.questGiverNpcId}
            onChange={(questGiverNpcId) => handleUpdate({ questGiverNpcId })}
            options={[
              { value: "", label: "Select NPC..." },
              ...npcs.map((npc) => ({ value: npc.id, label: npc.name })),
            ]}
          />
        </Field>
        <Field label="Turn-in NPC">
          <SelectInput
            value={quest.turnInNpcId}
            onChange={(turnInNpcId) => handleUpdate({ turnInNpcId })}
            options={[
              { value: "", label: "Select NPC..." },
              ...npcs.map((npc) => ({ value: npc.id, label: npc.name })),
            ]}
          />
        </Field>
      </Section>

      {/* Locations */}
      <Section
        title="Quest Locations"
        icon={<MapPin className="w-4 h-4 text-orange-400" />}
      >
        {quest.locations.map((location, index) => (
          <div
            key={index}
            className="p-2 bg-bg-tertiary rounded border border-border-primary space-y-2"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-text-secondary">
                Location {index + 1}
              </span>
              <button
                onClick={() => handleRemoveLocation(index)}
                className="p-1 text-text-muted hover:text-red-400"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
            <Field label="Type">
              <SelectInput
                value={location.type}
                onChange={(type) =>
                  handleUpdateLocation(index, {
                    type: type as PlacedQuest["locations"][0]["type"],
                  })
                }
                options={[
                  { value: "coordinate", label: "Coordinate" },
                  { value: "town", label: "Town" },
                  { value: "biome", label: "Biome" },
                  { value: "building", label: "Building" },
                ]}
              />
            </Field>
            <Field label="Description">
              <TextInput
                value={location.description}
                onChange={(description) =>
                  handleUpdateLocation(index, { description })
                }
                placeholder="Location description"
              />
            </Field>
            {location.type === "coordinate" && location.position && (
              <Field label="Position">
                <PositionInput
                  value={location.position}
                  onChange={(position) =>
                    handleUpdateLocation(index, { position })
                  }
                />
              </Field>
            )}
          </div>
        ))}
        <Button
          variant="secondary"
          size="sm"
          onClick={handleAddLocation}
          className="w-full text-xs"
        >
          <Plus className="w-3 h-3 mr-1" />
          Add Location
        </Button>
      </Section>

      {/* ID */}
      <div className="text-xs text-text-muted">
        ID: <code className="bg-bg-tertiary px-1 rounded">{quest.id}</code>
      </div>
    </div>
  );
};

// ============== BOSS EDITOR ==============

interface BossEditorProps {
  boss: PlacedBoss;
}

export const BossEditor: React.FC<BossEditorProps> = ({ boss }) => {
  const { actions } = useWorldBuilder();

  const handleUpdate = useCallback(
    (updates: Partial<PlacedBoss>) => {
      actions.updateBoss(boss.id, updates);
    },
    [actions, boss.id],
  );

  const handleDelete = useCallback(() => {
    if (confirm(`Delete boss "${boss.name}"?`)) {
      actions.removeBoss(boss.id);
      actions.setSelection(null);
    }
  }, [actions, boss.id, boss.name]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skull className="w-5 h-5 text-red-400" />
          <h3 className="font-medium text-text-primary">Boss</h3>
        </div>
        <Button
          variant="danger"
          size="sm"
          onClick={handleDelete}
          className="text-xs"
        >
          <Trash2 className="w-3 h-3 mr-1" />
          Delete
        </Button>
      </div>

      {/* Basic Info */}
      <Section title="Basic Information">
        <Field label="Name">
          <TextInput
            value={boss.name}
            onChange={(name) => handleUpdate({ name })}
            placeholder="Boss name"
          />
        </Field>
        <Field label="Template ID">
          <TextInput
            value={boss.bossTemplateId}
            onChange={(bossTemplateId) => handleUpdate({ bossTemplateId })}
            placeholder="boss_template_id"
          />
        </Field>
        <Field label="Required Level">
          <NumberInput
            value={boss.requiredLevel}
            onChange={(requiredLevel) => handleUpdate({ requiredLevel })}
            min={1}
            max={100}
          />
        </Field>
      </Section>

      {/* Spawn */}
      <Section
        title="Spawn Settings"
        icon={<MapPin className="w-4 h-4 text-orange-400" />}
      >
        <Field label="Position">
          <PositionInput
            value={boss.position}
            onChange={(position) => handleUpdate({ position })}
          />
        </Field>
        <Field label="Respawn Time (seconds)">
          <NumberInput
            value={boss.respawnTime}
            onChange={(respawnTime) => handleUpdate({ respawnTime })}
            min={0}
            step={60}
          />
        </Field>
      </Section>

      {/* Arena */}
      <Section
        title="Arena Bounds"
        icon={<Shield className="w-4 h-4 text-rose-400" />}
      >
        <BoundsInput
          value={boss.arenaBounds}
          onChange={(arenaBounds) => handleUpdate({ arenaBounds })}
        />
        <p className="text-xs text-text-muted mt-2">
          Area:{" "}
          {Math.abs(boss.arenaBounds.maxX - boss.arenaBounds.minX) *
            Math.abs(boss.arenaBounds.maxZ - boss.arenaBounds.minZ)}
          m²
        </p>
      </Section>

      {/* Loot */}
      <Section
        title="Loot"
        icon={<Package className="w-4 h-4 text-teal-400" />}
      >
        <Field label="Loot Table ID">
          <TextInput
            value={boss.lootTableId}
            onChange={(lootTableId) => handleUpdate({ lootTableId })}
            placeholder="loot_table_id"
          />
        </Field>
      </Section>

      {/* ID */}
      <div className="text-xs text-text-muted">
        ID: <code className="bg-bg-tertiary px-1 rounded">{boss.id}</code>
      </div>
    </div>
  );
};

// ============== EVENT EDITOR ==============

interface EventEditorProps {
  event: PlacedEvent;
}

export const EventEditor: React.FC<EventEditorProps> = ({ event }) => {
  const { state, actions } = useWorldBuilder();
  const world = state.editing.world;

  const handleUpdate = useCallback(
    (updates: Partial<PlacedEvent>) => {
      actions.updateEvent(event.id, updates);
    },
    [actions, event.id],
  );

  const handleDelete = useCallback(() => {
    if (confirm(`Delete event "${event.name}"?`)) {
      actions.removeEvent(event.id);
      actions.setSelection(null);
    }
  }, [actions, event.id, event.name]);

  const handleTriggerTypeChange = useCallback(
    (type: string) => {
      let newTriggerArea: PlacedEvent["triggerArea"];
      switch (type) {
        case "radius":
          newTriggerArea = {
            type: "radius",
            center: { x: 0, y: 0, z: 0 },
            radius: 50,
          };
          break;
        case "bounds":
          newTriggerArea = {
            type: "bounds",
            minX: -50,
            maxX: 50,
            minZ: -50,
            maxZ: 50,
          };
          break;
        case "biome":
          newTriggerArea = {
            type: "biome",
            biomeId: world?.foundation.biomes[0]?.id || "",
          };
          break;
        case "town":
          newTriggerArea = {
            type: "town",
            townId: world?.foundation.towns[0]?.id || "",
          };
          break;
        default:
          return;
      }
      handleUpdate({ triggerArea: newTriggerArea });
    },
    [handleUpdate, world],
  );

  const biomes = world?.foundation.biomes || [];
  const towns = world?.foundation.towns || [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="w-5 h-5 text-yellow-400" />
          <h3 className="font-medium text-text-primary">Event</h3>
        </div>
        <Button
          variant="danger"
          size="sm"
          onClick={handleDelete}
          className="text-xs"
        >
          <Trash2 className="w-3 h-3 mr-1" />
          Delete
        </Button>
      </div>

      {/* Basic Info */}
      <Section title="Basic Information">
        <Field label="Name">
          <TextInput
            value={event.name}
            onChange={(name) => handleUpdate({ name })}
            placeholder="Event name"
          />
        </Field>
        <Field label="Event Type">
          <SelectInput
            value={event.eventType}
            onChange={(eventType) => handleUpdate({ eventType })}
            options={[
              { value: "spawn", label: "Mob Spawn" },
              { value: "weather", label: "Weather Change" },
              { value: "ambush", label: "Ambush" },
              { value: "treasure", label: "Treasure" },
              { value: "invasion", label: "Invasion" },
              { value: "festival", label: "Festival" },
              { value: "custom", label: "Custom" },
            ]}
          />
        </Field>
      </Section>

      {/* Trigger Area */}
      <Section
        title="Trigger Area"
        icon={<MapPin className="w-4 h-4 text-orange-400" />}
      >
        <Field label="Trigger Type">
          <SelectInput
            value={event.triggerArea.type}
            onChange={handleTriggerTypeChange}
            options={[
              { value: "radius", label: "Radius" },
              { value: "bounds", label: "Rectangular Bounds" },
              { value: "biome", label: "Biome" },
              { value: "town", label: "Town" },
            ]}
          />
        </Field>

        {event.triggerArea.type === "radius" && (
          <>
            <Field label="Center">
              <PositionInput
                value={event.triggerArea.center}
                onChange={(center) =>
                  handleUpdate({
                    triggerArea: {
                      ...event.triggerArea,
                      center,
                    } as PlacedEvent["triggerArea"],
                  })
                }
              />
            </Field>
            <Field label="Radius (meters)">
              <NumberInput
                value={event.triggerArea.radius}
                onChange={(radius) =>
                  handleUpdate({
                    triggerArea: {
                      ...event.triggerArea,
                      radius,
                    } as PlacedEvent["triggerArea"],
                  })
                }
                min={1}
              />
            </Field>
          </>
        )}

        {event.triggerArea.type === "bounds" && (
          <BoundsInput
            value={{
              minX: event.triggerArea.minX,
              maxX: event.triggerArea.maxX,
              minZ: event.triggerArea.minZ,
              maxZ: event.triggerArea.maxZ,
            }}
            onChange={(bounds) =>
              handleUpdate({
                triggerArea: { type: "bounds", ...bounds },
              })
            }
          />
        )}

        {event.triggerArea.type === "biome" && (
          <Field label="Biome">
            <SelectInput
              value={event.triggerArea.biomeId}
              onChange={(biomeId) =>
                handleUpdate({
                  triggerArea: { type: "biome", biomeId },
                })
              }
              options={biomes.map((b) => ({ value: b.id, label: b.type }))}
            />
          </Field>
        )}

        {event.triggerArea.type === "town" && (
          <Field label="Town">
            <SelectInput
              value={event.triggerArea.townId}
              onChange={(townId) =>
                handleUpdate({
                  triggerArea: { type: "town", townId },
                })
              }
              options={towns.map((t) => ({ value: t.id, label: t.name }))}
            />
          </Field>
        )}
      </Section>

      {/* ID */}
      <div className="text-xs text-text-muted">
        ID: <code className="bg-bg-tertiary px-1 rounded">{event.id}</code>
      </div>
    </div>
  );
};

// ============== LORE EDITOR ==============

interface LoreEditorProps {
  lore: PlacedLore;
}

export const LoreEditor: React.FC<LoreEditorProps> = ({ lore }) => {
  const { state, actions } = useWorldBuilder();
  const world = state.editing.world;

  const handleUpdate = useCallback(
    (updates: Partial<PlacedLore>) => {
      actions.updateLore(lore.id, updates);
    },
    [actions, lore.id],
  );

  const handleDelete = useCallback(() => {
    if (confirm(`Delete lore entry "${lore.title}"?`)) {
      actions.removeLore(lore.id);
      actions.setSelection(null);
    }
  }, [actions, lore.id, lore.title]);

  const handleLocationTypeChange = useCallback(
    (type: string) => {
      let newLocation: PlacedLore["location"];
      switch (type) {
        case "town":
          newLocation = {
            type: "town",
            townId: world?.foundation.towns[0]?.id || "",
          };
          break;
        case "building":
          newLocation = {
            type: "building",
            buildingId: world?.foundation.buildings[0]?.id || "",
          };
          break;
        case "biome":
          newLocation = {
            type: "biome",
            biomeId: world?.foundation.biomes[0]?.id || "",
          };
          break;
        case "coordinate":
          newLocation = {
            type: "coordinate",
            position: { x: 0, y: 0, z: 0 },
          };
          break;
        default:
          return;
      }
      handleUpdate({ location: newLocation });
    },
    [handleUpdate, world],
  );

  const biomes = world?.foundation.biomes || [];
  const towns = world?.foundation.towns || [];
  const buildings = world?.foundation.buildings || [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-amber-400" />
          <h3 className="font-medium text-text-primary">Lore Entry</h3>
        </div>
        <Button
          variant="danger"
          size="sm"
          onClick={handleDelete}
          className="text-xs"
        >
          <Trash2 className="w-3 h-3 mr-1" />
          Delete
        </Button>
      </div>

      {/* Basic Info */}
      <Section title="Content">
        <Field label="Title">
          <TextInput
            value={lore.title}
            onChange={(title) => handleUpdate({ title })}
            placeholder="Lore title"
          />
        </Field>
        <Field label="Category">
          <SelectInput
            value={lore.category}
            onChange={(category) => handleUpdate({ category })}
            options={[
              { value: "history", label: "History" },
              { value: "legend", label: "Legend" },
              { value: "note", label: "Note" },
              { value: "journal", label: "Journal" },
              { value: "inscription", label: "Inscription" },
              { value: "book", label: "Book" },
              { value: "dialogue", label: "Dialogue" },
            ]}
          />
        </Field>
        <Field label="Content">
          <TextInput
            value={lore.content}
            onChange={(content) => handleUpdate({ content })}
            placeholder="Lore content..."
            multiline
            rows={6}
          />
        </Field>
      </Section>

      {/* Location */}
      <Section
        title="Location"
        icon={<MapPin className="w-4 h-4 text-orange-400" />}
      >
        <Field label="Location Type">
          <SelectInput
            value={lore.location.type}
            onChange={handleLocationTypeChange}
            options={[
              { value: "town", label: "Town" },
              { value: "building", label: "Building" },
              { value: "biome", label: "Biome" },
              { value: "coordinate", label: "Coordinate" },
            ]}
          />
        </Field>

        {lore.location.type === "town" && (
          <Field label="Town">
            <SelectInput
              value={lore.location.townId}
              onChange={(townId) =>
                handleUpdate({ location: { type: "town", townId } })
              }
              options={towns.map((t) => ({ value: t.id, label: t.name }))}
            />
          </Field>
        )}

        {lore.location.type === "building" && (
          <Field label="Building">
            <SelectInput
              value={lore.location.buildingId}
              onChange={(buildingId) =>
                handleUpdate({ location: { type: "building", buildingId } })
              }
              options={buildings.map((b) => ({ value: b.id, label: b.name }))}
            />
          </Field>
        )}

        {lore.location.type === "biome" && (
          <Field label="Biome">
            <SelectInput
              value={lore.location.biomeId}
              onChange={(biomeId) =>
                handleUpdate({ location: { type: "biome", biomeId } })
              }
              options={biomes.map((b) => ({ value: b.id, label: b.type }))}
            />
          </Field>
        )}

        {lore.location.type === "coordinate" && (
          <Field label="Position">
            <PositionInput
              value={lore.location.position}
              onChange={(position) =>
                handleUpdate({ location: { type: "coordinate", position } })
              }
            />
          </Field>
        )}
      </Section>

      {/* Discovery */}
      <Section title="Discovery">
        <Field label="Discovery Method">
          <SelectInput
            value={lore.discoveryMethod}
            onChange={(discoveryMethod) =>
              handleUpdate({
                discoveryMethod:
                  discoveryMethod as PlacedLore["discoveryMethod"],
              })
            }
            options={[
              { value: "automatic", label: "Automatic (enter area)" },
              { value: "interact", label: "Interact with object" },
              { value: "quest", label: "Complete quest" },
              { value: "item", label: "Obtain item" },
            ]}
          />
        </Field>
      </Section>

      {/* ID */}
      <div className="text-xs text-text-muted">
        ID: <code className="bg-bg-tertiary px-1 rounded">{lore.id}</code>
      </div>
    </div>
  );
};

// ============== DIFFICULTY ZONE EDITOR ==============

interface DifficultyZoneEditorProps {
  zone: DifficultyZone;
}

const DIFFICULTY_COLORS = [
  { level: 0, label: "Safe", color: "text-green-400", bg: "bg-green-400/20" },
  { level: 1, label: "Easy", color: "text-cyan-400", bg: "bg-cyan-400/20" },
  {
    level: 2,
    label: "Medium",
    color: "text-yellow-400",
    bg: "bg-yellow-400/20",
  },
  { level: 3, label: "Hard", color: "text-orange-400", bg: "bg-orange-400/20" },
  { level: 4, label: "Extreme", color: "text-red-400", bg: "bg-red-400/20" },
];

export const DifficultyZoneEditor: React.FC<DifficultyZoneEditorProps> = ({
  zone,
}) => {
  const { actions } = useWorldBuilder();

  const handleUpdate = useCallback(
    (updates: Partial<DifficultyZone>) => {
      actions.updateDifficultyZone(zone.id, updates);
    },
    [actions, zone.id],
  );

  const handleDelete = useCallback(() => {
    if (confirm(`Delete difficulty zone "${zone.name}"?`)) {
      actions.removeDifficultyZone(zone.id);
      actions.setSelection(null);
    }
  }, [actions, zone.id, zone.name]);

  const difficultyInfo =
    DIFFICULTY_COLORS[zone.difficultyLevel] || DIFFICULTY_COLORS[2];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-rose-400" />
          <h3 className="font-medium text-text-primary">Difficulty Zone</h3>
        </div>
        <Button
          variant="danger"
          size="sm"
          onClick={handleDelete}
          className="text-xs"
        >
          <Trash2 className="w-3 h-3 mr-1" />
          Delete
        </Button>
      </div>

      {/* Basic Info */}
      <Section title="Basic Information">
        <Field label="Name">
          <TextInput
            value={zone.name}
            onChange={(name) => handleUpdate({ name })}
            placeholder="Zone name"
          />
        </Field>
        <Field label="Difficulty Level">
          <div className="space-y-2">
            <input
              type="range"
              min={0}
              max={4}
              value={zone.difficultyLevel}
              onChange={(e) =>
                handleUpdate({ difficultyLevel: parseInt(e.target.value) })
              }
              className="w-full"
            />
            <div className="flex justify-between">
              {DIFFICULTY_COLORS.map((d) => (
                <span
                  key={d.level}
                  className={`text-xs ${
                    zone.difficultyLevel === d.level
                      ? d.color + " font-medium"
                      : "text-text-muted"
                  }`}
                >
                  {d.label}
                </span>
              ))}
            </div>
          </div>
        </Field>
        <div className={`p-2 rounded ${difficultyInfo.bg}`}>
          <span className={`text-sm font-medium ${difficultyInfo.color}`}>
            {difficultyInfo.label} Zone
          </span>
        </div>
      </Section>

      {/* Bounds */}
      <Section
        title="Zone Bounds"
        icon={<MapPin className="w-4 h-4 text-orange-400" />}
      >
        <BoundsInput
          value={zone.bounds}
          onChange={(bounds) => handleUpdate({ bounds })}
        />
        <p className="text-xs text-text-muted mt-2">
          Area:{" "}
          {Math.abs(zone.bounds.maxX - zone.bounds.minX) *
            Math.abs(zone.bounds.maxZ - zone.bounds.minZ)}
          m²
        </p>
      </Section>

      {/* Mob Levels */}
      <Section title="Mob Level Range">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Min Level">
            <NumberInput
              value={zone.mobLevelRange[0]}
              onChange={(min) =>
                handleUpdate({ mobLevelRange: [min, zone.mobLevelRange[1]] })
              }
              min={1}
              max={100}
            />
          </Field>
          <Field label="Max Level">
            <NumberInput
              value={zone.mobLevelRange[1]}
              onChange={(max) =>
                handleUpdate({ mobLevelRange: [zone.mobLevelRange[0], max] })
              }
              min={1}
              max={100}
            />
          </Field>
        </div>
      </Section>

      {/* ID */}
      <div className="text-xs text-text-muted">
        ID: <code className="bg-bg-tertiary px-1 rounded">{zone.id}</code>
      </div>
    </div>
  );
};

// ============== CUSTOM PLACEMENT EDITOR ==============

interface CustomPlacementEditorProps {
  placement: CustomPlacement;
}

export const CustomPlacementEditor: React.FC<CustomPlacementEditorProps> = ({
  placement,
}) => {
  const { actions } = useWorldBuilder();

  const handleUpdate = useCallback(
    (updates: Partial<CustomPlacement>) => {
      actions.updateCustomPlacement(placement.id, updates);
    },
    [actions, placement.id],
  );

  const handleDelete = useCallback(() => {
    if (confirm(`Delete custom placement?`)) {
      actions.removeCustomPlacement(placement.id);
      actions.setSelection(null);
    }
  }, [actions, placement.id]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="w-5 h-5 text-teal-400" />
          <h3 className="font-medium text-text-primary">Custom Placement</h3>
        </div>
        <Button
          variant="danger"
          size="sm"
          onClick={handleDelete}
          className="text-xs"
        >
          <Trash2 className="w-3 h-3 mr-1" />
          Delete
        </Button>
      </div>

      {/* Object Type */}
      <Section title="Object">
        <Field label="Object Type">
          <TextInput
            value={placement.objectType}
            onChange={(objectType) => handleUpdate({ objectType })}
            placeholder="Object type ID"
          />
        </Field>
      </Section>

      {/* Transform */}
      <Section
        title="Transform"
        icon={<MapPin className="w-4 h-4 text-orange-400" />}
      >
        <Field label="Position">
          <PositionInput
            value={placement.position}
            onChange={(position) => handleUpdate({ position })}
          />
        </Field>
        <Field label="Rotation (degrees)">
          <NumberInput
            value={(placement.rotation * 180) / Math.PI}
            onChange={(deg) =>
              handleUpdate({ rotation: (deg * Math.PI) / 180 })
            }
            min={0}
            max={360}
            step={15}
          />
        </Field>
        <Field label="Scale">
          <NumberInput
            value={placement.scale}
            onChange={(scale) => handleUpdate({ scale })}
            min={0.1}
            max={10}
            step={0.1}
          />
        </Field>
      </Section>

      {/* ID */}
      <div className="text-xs text-text-muted">
        ID: <code className="bg-bg-tertiary px-1 rounded">{placement.id}</code>
      </div>
    </div>
  );
};

export default {
  QuestEditor,
  BossEditor,
  EventEditor,
  LoreEditor,
  DifficultyZoneEditor,
  CustomPlacementEditor,
};
