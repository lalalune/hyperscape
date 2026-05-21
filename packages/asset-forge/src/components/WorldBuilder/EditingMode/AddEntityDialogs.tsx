/**
 * AddEntityDialogs
 *
 * Modal dialogs for adding new entities (NPCs, quests, bosses, events) to the world.
 */

import {
  BookOpen,
  Building2,
  Check,
  Globe,
  Package,
  Scroll,
  Shield,
  Skull,
  User,
  X,
  Zap,
} from "lucide-react";
import React, { useState, useCallback } from "react";

import { useWorldBuilder } from "../WorldBuilderContext";
import type {
  PlacedNPC,
  PlacedQuest,
  PlacedBoss,
  PlacedEvent,
  WorldPosition,
} from "../types";

import { Button } from "@/components/common";

// ============== SHARED MODAL WRAPPER ==============

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  icon,
  children,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 " onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-bg-secondary border border-border-primary rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-primary">
          <div className="flex items-center gap-3">
            {icon}
            <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-text-muted hover:text-text-primary hover:bg-bg-tertiary rounded transition-colors ease-out"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
};

// ============== SHARED FIELD COMPONENTS ==============

interface FieldProps {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}

const Field: React.FC<FieldProps> = ({ label, required, hint, children }) => (
  <div className="space-y-1">
    <label className="text-sm text-text-secondary">
      {label}
      {required && <span className="text-red-400 ml-1">*</span>}
    </label>
    {children}
    {hint && <p className="text-xs text-text-muted">{hint}</p>}
  </div>
);

const TextInput: React.FC<{
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
}> = ({ value, onChange, placeholder, required }) => (
  <input
    type="text"
    value={value}
    onChange={(e) => onChange(e.target.value)}
    placeholder={placeholder}
    required={required}
    className="w-full px-5 py-4 bg-bg-tertiary border border-border-primary rounded text-text-primary text-sm focus:outline-none focus:ring-1 focus:ring-primary/40"
  />
);

const NumberInput: React.FC<{
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}> = ({ value, onChange, min, max, step = 1 }) => (
  <input
    type="number"
    value={value}
    onChange={(e) => onChange(Number(e.target.value))}
    min={min}
    max={max}
    step={step}
    className="w-full px-5 py-4 bg-bg-tertiary border border-border-primary rounded text-text-primary text-sm focus:outline-none focus:ring-1 focus:ring-primary/40"
  />
);

const SelectInput: React.FC<{
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder?: string;
}> = ({ value, onChange, options, placeholder }) => (
  <select
    value={value}
    onChange={(e) => onChange(e.target.value)}
    className="w-full px-5 py-4 bg-bg-tertiary border border-border-primary rounded text-text-primary text-sm focus:outline-none focus:ring-1 focus:ring-primary/40"
  >
    {placeholder && (
      <option value="" disabled>
        {placeholder}
      </option>
    )}
    {options.map((opt) => (
      <option key={opt.value} value={opt.value}>
        {opt.label}
      </option>
    ))}
  </select>
);

// ============== POSITION PICKER ==============

interface PositionPickerProps {
  value: WorldPosition;
  onChange: (pos: WorldPosition) => void;
}

const PositionPicker: React.FC<PositionPickerProps> = ({ value, onChange }) => (
  <div className="grid grid-cols-3 gap-2">
    <div className="space-y-1">
      <label className="text-xs text-text-muted">X</label>
      <NumberInput
        value={value.x}
        onChange={(x) => onChange({ ...value, x })}
        step={1}
      />
    </div>
    <div className="space-y-1">
      <label className="text-xs text-text-muted">Y</label>
      <NumberInput
        value={value.y}
        onChange={(y) => onChange({ ...value, y })}
        step={0.1}
      />
    </div>
    <div className="space-y-1">
      <label className="text-xs text-text-muted">Z</label>
      <NumberInput
        value={value.z}
        onChange={(z) => onChange({ ...value, z })}
        step={1}
      />
    </div>
  </div>
);

// ============== NPC TYPES ==============

const NPC_TYPES = [
  { value: "banker", label: "Banker" },
  { value: "shopkeeper", label: "Shopkeeper" },
  { value: "quest_giver", label: "Quest Giver" },
  { value: "trainer", label: "Trainer" },
  { value: "guard", label: "Guard" },
  { value: "villager", label: "Villager" },
  { value: "wanderer", label: "Wanderer" },
  { value: "blacksmith", label: "Blacksmith" },
  { value: "herbalist", label: "Herbalist" },
  { value: "fisherman", label: "Fisherman" },
];

// ============== ADD NPC DIALOG ==============

interface AddNPCDialogProps {
  isOpen: boolean;
  onClose: () => void;
  initialPosition?: WorldPosition;
  initialTownId?: string;
}

export const AddNPCDialog: React.FC<AddNPCDialogProps> = ({
  isOpen,
  onClose,
  initialPosition,
  initialTownId,
}) => {
  const { state, actions } = useWorldBuilder();
  const world = state.editing.world;

  const [name, setName] = useState("");
  const [npcType, setNpcType] = useState("");
  const [position, setPosition] = useState<WorldPosition>(
    initialPosition || { x: 0, y: 0, z: 0 },
  );
  const [parentType, setParentType] = useState<"world" | "town" | "building">(
    initialTownId ? "town" : "world",
  );
  const [selectedTownId, setSelectedTownId] = useState(initialTownId || "");
  const [storeId, setStoreId] = useState("");
  const [dialogId, setDialogId] = useState("");

  const towns = world?.foundation.towns || [];

  const handleSubmit = useCallback(() => {
    if (!name || !npcType) return;

    const npc: PlacedNPC = {
      id: `npc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      npcTypeId: npcType,
      name,
      position,
      rotation: 0,
      parentContext:
        parentType === "town" && selectedTownId
          ? { type: "town", townId: selectedTownId }
          : { type: "world" },
      storeId: storeId || undefined,
      dialogId: dialogId || undefined,
      properties: {},
    };

    actions.addNPC(npc);
    onClose();

    // Reset form
    setName("");
    setNpcType("");
    setPosition({ x: 0, y: 0, z: 0 });
    setStoreId("");
    setDialogId("");
  }, [
    name,
    npcType,
    position,
    parentType,
    selectedTownId,
    storeId,
    dialogId,
    actions,
    onClose,
  ]);

  const isValid = name.trim() !== "" && npcType !== "";

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add NPC"
      icon={<User className="w-5 h-5 text-cyan-400" />}
    >
      <div className="space-y-4">
        <Field label="Name" required>
          <TextInput
            value={name}
            onChange={setName}
            placeholder="Enter NPC name"
            required
          />
        </Field>

        <Field label="Type" required>
          <SelectInput
            value={npcType}
            onChange={setNpcType}
            options={NPC_TYPES}
            placeholder="Select NPC type"
          />
        </Field>

        <Field label="Parent Context">
          <div className="flex gap-2">
            <button
              onClick={() => setParentType("world")}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded text-sm ${
                parentType === "world"
                  ? "bg-primary text-white"
                  : "bg-bg-tertiary text-text-secondary hover:text-text-primary"
              }`}
            >
              <Globe className="w-4 h-4" />
              World
            </button>
            <button
              onClick={() => setParentType("town")}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded text-sm ${
                parentType === "town"
                  ? "bg-primary text-white"
                  : "bg-bg-tertiary text-text-secondary hover:text-text-primary"
              }`}
            >
              <Building2 className="w-4 h-4" />
              Town
            </button>
          </div>
        </Field>

        {parentType === "town" && (
          <Field label="Town">
            <SelectInput
              value={selectedTownId}
              onChange={setSelectedTownId}
              options={towns.map((t) => ({ value: t.id, label: t.name }))}
              placeholder="Select town"
            />
          </Field>
        )}

        <Field label="Position" hint="World coordinates">
          <PositionPicker value={position} onChange={setPosition} />
        </Field>

        {(npcType === "banker" || npcType === "shopkeeper") && (
          <Field label="Store ID" hint="ID of the store/bank this NPC manages">
            <TextInput
              value={storeId}
              onChange={setStoreId}
              placeholder="e.g., general_store_1"
            />
          </Field>
        )}

        {npcType === "quest_giver" && (
          <Field label="Dialog ID" hint="ID of the dialog tree">
            <TextInput
              value={dialogId}
              onChange={setDialogId}
              placeholder="e.g., intro_quest_dialog"
            />
          </Field>
        )}

        <div className="flex justify-end gap-2 pt-4 border-t border-border-primary">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid}>
            <Check className="w-4 h-4 mr-2" />
            Add NPC
          </Button>
        </div>
      </div>
    </Modal>
  );
};

// ============== ADD QUEST DIALOG ==============

interface AddQuestDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AddQuestDialog: React.FC<AddQuestDialogProps> = ({
  isOpen,
  onClose,
}) => {
  const { state, actions } = useWorldBuilder();
  const world = state.editing.world;

  const [name, setName] = useState("");
  const [questTemplateId, setQuestTemplateId] = useState("");
  const [questGiverNpcId, setQuestGiverNpcId] = useState("");
  const [turnInNpcId, setTurnInNpcId] = useState("");
  const [requiredLevel, setRequiredLevel] = useState(1);
  const [description, setDescription] = useState("");

  const npcs = world?.layers.npcs || [];
  const questGiverNpcs = npcs.filter(
    (n) => n.npcTypeId === "quest_giver" || n.npcTypeId === "trainer",
  );

  const handleSubmit = useCallback(() => {
    if (!name || !questGiverNpcId) return;

    const quest: PlacedQuest = {
      id: `quest-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      questTemplateId:
        questTemplateId || `quest_${name.toLowerCase().replace(/\s+/g, "_")}`,
      name,
      questGiverNpcId,
      turnInNpcId: turnInNpcId || questGiverNpcId,
      locations: [],
      requiredLevel,
      properties: {
        description,
      },
    };

    actions.addQuest(quest);
    onClose();

    // Reset form
    setName("");
    setQuestTemplateId("");
    setQuestGiverNpcId("");
    setTurnInNpcId("");
    setRequiredLevel(1);
    setDescription("");
  }, [
    name,
    questTemplateId,
    questGiverNpcId,
    turnInNpcId,
    requiredLevel,
    description,
    actions,
    onClose,
  ]);

  const isValid = name.trim() !== "" && questGiverNpcId !== "";

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Quest"
      icon={<Scroll className="w-5 h-5 text-indigo-400" />}
    >
      <div className="space-y-4">
        <Field label="Quest Name" required>
          <TextInput
            value={name}
            onChange={setName}
            placeholder="Enter quest name"
            required
          />
        </Field>

        <Field label="Template ID" hint="Unique identifier for quest logic">
          <TextInput
            value={questTemplateId}
            onChange={setQuestTemplateId}
            placeholder="Auto-generated from name if empty"
          />
        </Field>

        <Field label="Quest Giver" required hint="NPC who gives this quest">
          <SelectInput
            value={questGiverNpcId}
            onChange={setQuestGiverNpcId}
            options={
              questGiverNpcs.length > 0
                ? questGiverNpcs.map((n) => ({ value: n.id, label: n.name }))
                : npcs.map((n) => ({ value: n.id, label: n.name }))
            }
            placeholder="Select NPC"
          />
          {questGiverNpcs.length === 0 && npcs.length > 0 && (
            <p className="text-xs text-yellow-400 mt-1">
              No quest giver NPCs found. Showing all NPCs.
            </p>
          )}
          {npcs.length === 0 && (
            <p className="text-xs text-red-400 mt-1">
              No NPCs in world. Add an NPC first.
            </p>
          )}
        </Field>

        <Field
          label="Turn-in NPC"
          hint="NPC to complete quest (defaults to giver)"
        >
          <SelectInput
            value={turnInNpcId}
            onChange={setTurnInNpcId}
            options={[
              { value: "", label: "Same as quest giver" },
              ...npcs.map((n) => ({ value: n.id, label: n.name })),
            ]}
          />
        </Field>

        <Field label="Required Level">
          <NumberInput
            value={requiredLevel}
            onChange={setRequiredLevel}
            min={1}
            max={99}
          />
        </Field>

        <Field label="Description">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Quest description..."
            rows={3}
            className="w-full px-5 py-4 bg-bg-tertiary border border-border-primary rounded text-text-primary text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary/40"
          />
        </Field>

        <div className="flex justify-end gap-2 pt-4 border-t border-border-primary">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid}>
            <Check className="w-4 h-4 mr-2" />
            Add Quest
          </Button>
        </div>
      </div>
    </Modal>
  );
};

// ============== ADD BOSS DIALOG ==============

const BOSS_TEMPLATES = [
  { value: "goblin_chief", label: "Goblin Chief" },
  { value: "spider_queen", label: "Spider Queen" },
  { value: "bandit_leader", label: "Bandit Leader" },
  { value: "skeleton_lord", label: "Skeleton Lord" },
  { value: "troll_king", label: "Troll King" },
  { value: "dragon", label: "Dragon" },
  { value: "demon_lord", label: "Demon Lord" },
  { value: "lich", label: "Lich" },
  { value: "custom", label: "Custom Boss" },
];

interface AddBossDialogProps {
  isOpen: boolean;
  onClose: () => void;
  initialPosition?: WorldPosition;
}

export const AddBossDialog: React.FC<AddBossDialogProps> = ({
  isOpen,
  onClose,
  initialPosition,
}) => {
  const { actions } = useWorldBuilder();

  const [name, setName] = useState("");
  const [bossTemplateId, setBossTemplateId] = useState("");
  const [position, setPosition] = useState<WorldPosition>(
    initialPosition || { x: 0, y: 0, z: 0 },
  );
  const [arenaRadius, setArenaRadius] = useState(50);
  const [respawnTime, setRespawnTime] = useState(3600);
  const [requiredLevel, setRequiredLevel] = useState(10);
  const [lootTableId, setLootTableId] = useState("");

  const handleSubmit = useCallback(() => {
    if (!name || !bossTemplateId) return;

    const boss: PlacedBoss = {
      id: `boss-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      bossTemplateId,
      name,
      position,
      arenaBounds: {
        minX: position.x - arenaRadius,
        maxX: position.x + arenaRadius,
        minZ: position.z - arenaRadius,
        maxZ: position.z + arenaRadius,
      },
      respawnTime,
      requiredLevel,
      lootTableId: lootTableId || `loot_${bossTemplateId}`,
      isGenerated: false, // Manually placed boss
      properties: {},
    };

    actions.addBoss(boss);
    onClose();

    // Reset form
    setName("");
    setBossTemplateId("");
    setPosition({ x: 0, y: 0, z: 0 });
    setArenaRadius(50);
    setRespawnTime(3600);
    setRequiredLevel(10);
    setLootTableId("");
  }, [
    name,
    bossTemplateId,
    position,
    arenaRadius,
    respawnTime,
    requiredLevel,
    lootTableId,
    actions,
    onClose,
  ]);

  const isValid = name.trim() !== "" && bossTemplateId !== "";

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Boss"
      icon={<Skull className="w-5 h-5 text-red-400" />}
    >
      <div className="space-y-4">
        <Field label="Boss Name" required>
          <TextInput
            value={name}
            onChange={setName}
            placeholder="Enter boss name"
            required
          />
        </Field>

        <Field label="Boss Template" required>
          <SelectInput
            value={bossTemplateId}
            onChange={setBossTemplateId}
            options={BOSS_TEMPLATES}
            placeholder="Select boss type"
          />
        </Field>

        <Field label="Spawn Position">
          <PositionPicker value={position} onChange={setPosition} />
        </Field>

        <Field label="Arena Radius" hint="Combat area size in meters">
          <NumberInput
            value={arenaRadius}
            onChange={setArenaRadius}
            min={10}
            max={200}
            step={10}
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Required Level">
            <NumberInput
              value={requiredLevel}
              onChange={setRequiredLevel}
              min={1}
              max={99}
            />
          </Field>
          <Field label="Respawn Time" hint="Seconds">
            <NumberInput
              value={respawnTime}
              onChange={setRespawnTime}
              min={60}
              max={86400}
              step={60}
            />
          </Field>
        </div>

        <Field
          label="Loot Table ID"
          hint="Custom loot table (auto-generated if empty)"
        >
          <TextInput
            value={lootTableId}
            onChange={setLootTableId}
            placeholder="e.g., loot_dragon_elite"
          />
        </Field>

        <div className="flex justify-end gap-2 pt-4 border-t border-border-primary">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid}>
            <Check className="w-4 h-4 mr-2" />
            Add Boss
          </Button>
        </div>
      </div>
    </Modal>
  );
};

// ============== ADD EVENT DIALOG ==============

const EVENT_TYPES = [
  { value: "spawn_wave", label: "Spawn Wave" },
  { value: "world_boss", label: "World Boss Spawn" },
  { value: "treasure_hunt", label: "Treasure Hunt" },
  { value: "invasion", label: "Invasion" },
  { value: "festival", label: "Festival" },
  { value: "weather", label: "Weather Event" },
  { value: "discovery", label: "Discovery" },
  { value: "trigger_zone", label: "Trigger Zone" },
];

const TRIGGER_TYPES = [
  { value: "radius", label: "Radius" },
  { value: "bounds", label: "Rectangular Bounds" },
  { value: "biome", label: "Entire Biome" },
  { value: "town", label: "Town Area" },
];

interface AddEventDialogProps {
  isOpen: boolean;
  onClose: () => void;
  initialPosition?: WorldPosition;
}

export const AddEventDialog: React.FC<AddEventDialogProps> = ({
  isOpen,
  onClose,
  initialPosition,
}) => {
  const { state, actions } = useWorldBuilder();
  const world = state.editing.world;

  const [name, setName] = useState("");
  const [eventType, setEventType] = useState("");
  const [triggerType, setTriggerType] = useState<
    "radius" | "bounds" | "biome" | "town"
  >("radius");
  const [position, setPosition] = useState<WorldPosition>(
    initialPosition || { x: 0, y: 0, z: 0 },
  );
  const [radius, setRadius] = useState(100);
  const [selectedBiomeId, setSelectedBiomeId] = useState("");
  const [selectedTownId, setSelectedTownId] = useState("");

  const biomes = world?.foundation.biomes || [];
  const towns = world?.foundation.towns || [];

  const handleSubmit = useCallback(() => {
    if (!name || !eventType) return;

    let triggerArea: PlacedEvent["triggerArea"];
    switch (triggerType) {
      case "radius":
        triggerArea = { type: "radius", center: position, radius };
        break;
      case "bounds":
        triggerArea = {
          type: "bounds",
          minX: position.x - radius,
          maxX: position.x + radius,
          minZ: position.z - radius,
          maxZ: position.z + radius,
        };
        break;
      case "biome":
        triggerArea = { type: "biome", biomeId: selectedBiomeId };
        break;
      case "town":
        triggerArea = { type: "town", townId: selectedTownId };
        break;
    }

    const event: PlacedEvent = {
      id: `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      eventType,
      name,
      triggerArea,
      conditions: {},
      properties: {},
    };

    actions.addEvent(event);
    onClose();

    // Reset form
    setName("");
    setEventType("");
    setTriggerType("radius");
    setPosition({ x: 0, y: 0, z: 0 });
    setRadius(100);
    setSelectedBiomeId("");
    setSelectedTownId("");
  }, [
    name,
    eventType,
    triggerType,
    position,
    radius,
    selectedBiomeId,
    selectedTownId,
    actions,
    onClose,
  ]);

  const isValid = name.trim() !== "" && eventType !== "";

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Event"
      icon={<Zap className="w-5 h-5 text-yellow-400" />}
    >
      <div className="space-y-4">
        <Field label="Event Name" required>
          <TextInput
            value={name}
            onChange={setName}
            placeholder="Enter event name"
            required
          />
        </Field>

        <Field label="Event Type" required>
          <SelectInput
            value={eventType}
            onChange={setEventType}
            options={EVENT_TYPES}
            placeholder="Select event type"
          />
        </Field>

        <Field label="Trigger Type">
          <div className="grid grid-cols-2 gap-2">
            {TRIGGER_TYPES.map((tt) => (
              <button
                key={tt.value}
                onClick={() => setTriggerType(tt.value as typeof triggerType)}
                className={`px-3 py-2 rounded text-sm ${
                  triggerType === tt.value
                    ? "bg-primary text-white"
                    : "bg-bg-tertiary text-text-secondary hover:text-text-primary"
                }`}
              >
                {tt.label}
              </button>
            ))}
          </div>
        </Field>

        {triggerType === "radius" && (
          <>
            <Field label="Center Position">
              <PositionPicker value={position} onChange={setPosition} />
            </Field>
            <Field label="Trigger Radius" hint="Meters">
              <NumberInput
                value={radius}
                onChange={setRadius}
                min={10}
                max={1000}
                step={10}
              />
            </Field>
          </>
        )}

        {triggerType === "bounds" && (
          <>
            <Field label="Center Position">
              <PositionPicker value={position} onChange={setPosition} />
            </Field>
            <Field label="Half-Size" hint="Distance from center to edge">
              <NumberInput
                value={radius}
                onChange={setRadius}
                min={10}
                max={1000}
                step={10}
              />
            </Field>
          </>
        )}

        {triggerType === "biome" && (
          <Field label="Biome">
            <SelectInput
              value={selectedBiomeId}
              onChange={setSelectedBiomeId}
              options={biomes.map((b) => ({
                value: b.id,
                label: `${b.type} (${b.id})`,
              }))}
              placeholder="Select biome"
            />
          </Field>
        )}

        {triggerType === "town" && (
          <Field label="Town">
            <SelectInput
              value={selectedTownId}
              onChange={setSelectedTownId}
              options={towns.map((t) => ({ value: t.id, label: t.name }))}
              placeholder="Select town"
            />
          </Field>
        )}

        <div className="flex justify-end gap-2 pt-4 border-t border-border-primary">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid}>
            <Check className="w-4 h-4 mr-2" />
            Add Event
          </Button>
        </div>
      </div>
    </Modal>
  );
};

// ============== ADD LORE DIALOG ==============

const LORE_CATEGORIES = [
  { value: "history", label: "History" },
  { value: "legend", label: "Legend" },
  { value: "note", label: "Note" },
  { value: "journal", label: "Journal" },
  { value: "inscription", label: "Inscription" },
  { value: "book", label: "Book" },
  { value: "dialogue", label: "Dialogue" },
];

const DISCOVERY_METHODS = [
  { value: "automatic", label: "Automatic (enter area)" },
  { value: "interact", label: "Interact with object" },
  { value: "quest", label: "Complete quest" },
  { value: "item", label: "Obtain item" },
];

const LOCATION_TYPES = [
  { value: "coordinate", label: "Coordinate" },
  { value: "town", label: "Town" },
  { value: "building", label: "Building" },
  { value: "biome", label: "Biome" },
];

interface AddLoreDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AddLoreDialog: React.FC<AddLoreDialogProps> = ({
  isOpen,
  onClose,
}) => {
  const { state, actions } = useWorldBuilder();
  const world = state.editing.world;

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("history");
  const [content, setContent] = useState("");
  const [locationType, setLocationType] = useState<
    "coordinate" | "town" | "building" | "biome"
  >("coordinate");
  const [position, setPosition] = useState<WorldPosition>({ x: 0, y: 0, z: 0 });
  const [selectedTownId, setSelectedTownId] = useState("");
  const [selectedBuildingId, setSelectedBuildingId] = useState("");
  const [selectedBiomeId, setSelectedBiomeId] = useState("");
  const [discoveryMethod, setDiscoveryMethod] = useState<
    "automatic" | "interact" | "quest" | "item"
  >("automatic");

  const towns = world?.foundation.towns || [];
  const buildings = world?.foundation.buildings || [];
  const biomes = world?.foundation.biomes || [];

  const isValid =
    title.trim() &&
    content.trim() &&
    (locationType === "coordinate" ||
      (locationType === "town" && selectedTownId) ||
      (locationType === "building" && selectedBuildingId) ||
      (locationType === "biome" && selectedBiomeId));

  const handleSubmit = useCallback(() => {
    if (!isValid) return;

    let location: import("../types").PlacedLore["location"];
    switch (locationType) {
      case "town":
        location = { type: "town", townId: selectedTownId };
        break;
      case "building":
        location = { type: "building", buildingId: selectedBuildingId };
        break;
      case "biome":
        location = { type: "biome", biomeId: selectedBiomeId };
        break;
      default:
        location = { type: "coordinate", position };
    }

    const newLore: import("../types").PlacedLore = {
      id: `lore_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      category,
      title: title.trim(),
      content: content.trim(),
      location,
      discoveryMethod,
      properties: {},
    };

    actions.addLore(newLore);
    actions.setSelection({ type: "lore", id: newLore.id, path: [] });
    onClose();

    // Reset form
    setTitle("");
    setContent("");
    setCategory("history");
    setLocationType("coordinate");
    setDiscoveryMethod("automatic");
  }, [
    isValid,
    title,
    content,
    category,
    locationType,
    position,
    selectedTownId,
    selectedBuildingId,
    selectedBiomeId,
    discoveryMethod,
    actions,
    onClose,
  ]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Lore Entry"
      icon={<BookOpen className="w-6 h-6 text-amber-400" />}
    >
      <div className="space-y-4">
        <Field label="Title" required>
          <TextInput
            value={title}
            onChange={setTitle}
            placeholder="Lore entry title"
            required
          />
        </Field>

        <Field label="Category">
          <SelectInput
            value={category}
            onChange={setCategory}
            options={LORE_CATEGORIES}
          />
        </Field>

        <Field label="Content" required>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Enter the lore content..."
            rows={5}
            className="w-full px-5 py-4 bg-bg-tertiary border border-border-primary rounded text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-primary/40 resize-none"
          />
        </Field>

        <Field label="Location Type">
          <SelectInput
            value={locationType}
            onChange={(v) => setLocationType(v as typeof locationType)}
            options={LOCATION_TYPES}
          />
        </Field>

        {locationType === "coordinate" && (
          <Field label="Position">
            <PositionPicker value={position} onChange={setPosition} />
          </Field>
        )}

        {locationType === "town" && (
          <Field label="Town">
            <SelectInput
              value={selectedTownId}
              onChange={setSelectedTownId}
              options={towns.map((t) => ({ value: t.id, label: t.name }))}
              placeholder="Select town"
            />
          </Field>
        )}

        {locationType === "building" && (
          <Field label="Building">
            <SelectInput
              value={selectedBuildingId}
              onChange={setSelectedBuildingId}
              options={buildings.map((b) => ({ value: b.id, label: b.name }))}
              placeholder="Select building"
            />
          </Field>
        )}

        {locationType === "biome" && (
          <Field label="Biome">
            <SelectInput
              value={selectedBiomeId}
              onChange={setSelectedBiomeId}
              options={biomes.map((b) => ({ value: b.id, label: b.type }))}
              placeholder="Select biome"
            />
          </Field>
        )}

        <Field label="Discovery Method">
          <SelectInput
            value={discoveryMethod}
            onChange={(v) => setDiscoveryMethod(v as typeof discoveryMethod)}
            options={DISCOVERY_METHODS}
          />
        </Field>

        <div className="flex justify-end gap-2 pt-4 border-t border-border-primary">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid}>
            <Check className="w-4 h-4 mr-2" />
            Add Lore
          </Button>
        </div>
      </div>
    </Modal>
  );
};

// ============== ADD DIFFICULTY ZONE DIALOG ==============

const DIFFICULTY_LEVELS = [
  { value: 0, label: "Safe (Level 0)", color: "bg-green-400" },
  { value: 1, label: "Easy (Level 1)", color: "bg-cyan-400" },
  { value: 2, label: "Medium (Level 2)", color: "bg-yellow-400" },
  { value: 3, label: "Hard (Level 3)", color: "bg-orange-400" },
  { value: 4, label: "Extreme (Level 4)", color: "bg-red-400" },
];

interface AddDifficultyZoneDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AddDifficultyZoneDialog: React.FC<
  AddDifficultyZoneDialogProps
> = ({ isOpen, onClose }) => {
  const { actions } = useWorldBuilder();

  const [name, setName] = useState("");
  const [difficultyLevel, setDifficultyLevel] = useState(2);
  const [centerX, setCenterX] = useState(0);
  const [centerZ, setCenterZ] = useState(0);
  const [halfSize, setHalfSize] = useState(100);
  const [minLevel, setMinLevel] = useState(1);
  const [maxLevel, setMaxLevel] = useState(10);

  const isValid = name.trim() && halfSize > 0;

  const handleSubmit = useCallback(() => {
    if (!isValid) return;

    const newZone: import("../types").DifficultyZone = {
      id: `zone_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      name: name.trim(),
      difficultyLevel,
      zoneType: "bounds",
      bounds: {
        minX: centerX - halfSize,
        maxX: centerX + halfSize,
        minZ: centerZ - halfSize,
        maxZ: centerZ + halfSize,
      },
      isSafeZone: difficultyLevel === 0,
      mobLevelRange: [minLevel, maxLevel],
      properties: {},
    };

    actions.addDifficultyZone(newZone);
    actions.setSelection({ type: "difficultyZone", id: newZone.id, path: [] });
    onClose();

    // Reset form
    setName("");
    setDifficultyLevel(2);
    setCenterX(0);
    setCenterZ(0);
    setHalfSize(100);
    setMinLevel(1);
    setMaxLevel(10);
  }, [
    isValid,
    name,
    difficultyLevel,
    centerX,
    centerZ,
    halfSize,
    minLevel,
    maxLevel,
    actions,
    onClose,
  ]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Difficulty Zone"
      icon={<Shield className="w-6 h-6 text-rose-400" />}
    >
      <div className="space-y-4">
        <Field label="Zone Name" required>
          <TextInput
            value={name}
            onChange={setName}
            placeholder="e.g., Dark Forest, Dragon Lair..."
            required
          />
        </Field>

        <Field label="Difficulty Level">
          <div className="space-y-2">
            <input
              type="range"
              min={0}
              max={4}
              value={difficultyLevel}
              onChange={(e) => setDifficultyLevel(parseInt(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between">
              {DIFFICULTY_LEVELS.map((d) => (
                <span
                  key={d.value}
                  className={`text-xs ${
                    difficultyLevel === d.value
                      ? "text-text-primary font-medium"
                      : "text-text-muted"
                  }`}
                >
                  {d.label.split(" ")[0]}
                </span>
              ))}
            </div>
          </div>
        </Field>

        <Field label="Zone Center">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-text-muted">X</label>
              <NumberInput value={centerX} onChange={setCenterX} step={10} />
            </div>
            <div>
              <label className="text-xs text-text-muted">Z</label>
              <NumberInput value={centerZ} onChange={setCenterZ} step={10} />
            </div>
          </div>
        </Field>

        <Field label="Half Size (meters)" hint="Distance from center to edge">
          <NumberInput
            value={halfSize}
            onChange={setHalfSize}
            min={10}
            max={5000}
            step={10}
          />
        </Field>

        <Field label="Mob Level Range">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-text-muted">Min Level</label>
              <NumberInput
                value={minLevel}
                onChange={setMinLevel}
                min={1}
                max={100}
              />
            </div>
            <div>
              <label className="text-xs text-text-muted">Max Level</label>
              <NumberInput
                value={maxLevel}
                onChange={setMaxLevel}
                min={1}
                max={100}
              />
            </div>
          </div>
        </Field>

        <div className="p-2 bg-bg-tertiary rounded text-xs text-text-muted">
          Zone area: {halfSize * 2 * (halfSize * 2)}m² ({halfSize * 2}m ×{" "}
          {halfSize * 2}m)
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t border-border-primary">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid}>
            <Check className="w-4 h-4 mr-2" />
            Add Zone
          </Button>
        </div>
      </div>
    </Modal>
  );
};

// ============== ADD CUSTOM PLACEMENT DIALOG ==============

interface AddCustomPlacementDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AddCustomPlacementDialog: React.FC<
  AddCustomPlacementDialogProps
> = ({ isOpen, onClose }) => {
  const { actions } = useWorldBuilder();

  const [objectType, setObjectType] = useState("");
  const [position, setPosition] = useState<WorldPosition>({ x: 0, y: 0, z: 0 });
  const [rotationDeg, setRotationDeg] = useState(0);
  const [scale, setScale] = useState(1);

  const isValid = objectType.trim();

  const handleSubmit = useCallback(() => {
    if (!isValid) return;

    const newPlacement: import("../types").CustomPlacement = {
      id: `placement_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      objectType: objectType.trim(),
      position,
      rotation: (rotationDeg * Math.PI) / 180,
      scale,
      properties: {},
    };

    actions.addCustomPlacement(newPlacement);
    actions.setSelection({
      type: "customPlacement",
      id: newPlacement.id,
      path: [],
    });
    onClose();

    // Reset form
    setObjectType("");
    setPosition({ x: 0, y: 0, z: 0 });
    setRotationDeg(0);
    setScale(1);
  }, [isValid, objectType, position, rotationDeg, scale, actions, onClose]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Custom Placement"
      icon={<Package className="w-6 h-6 text-teal-400" />}
    >
      <div className="space-y-4">
        <Field label="Object Type" required hint="ID of the object to place">
          <TextInput
            value={objectType}
            onChange={setObjectType}
            placeholder="e.g., chest_rare, statue_hero, portal..."
            required
          />
        </Field>

        <Field label="Position">
          <PositionPicker value={position} onChange={setPosition} />
        </Field>

        <Field label="Rotation (degrees)">
          <NumberInput
            value={rotationDeg}
            onChange={setRotationDeg}
            min={0}
            max={360}
            step={15}
          />
        </Field>

        <Field label="Scale">
          <NumberInput
            value={scale}
            onChange={setScale}
            min={0.1}
            max={10}
            step={0.1}
          />
        </Field>

        <div className="flex justify-end gap-2 pt-4 border-t border-border-primary">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid}>
            <Check className="w-4 h-4 mr-2" />
            Add Placement
          </Button>
        </div>
      </div>
    </Modal>
  );
};

// ============== SAVED WORLDS DIALOG ==============

interface SavedWorldEntry {
  id: string;
  name: string;
  modifiedAt: number;
}

interface SavedWorldsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  worlds: SavedWorldEntry[];
  onLoad: (worldId: string) => void;
  onDelete: (worldId: string) => void;
  isLoading?: boolean;
}

export const SavedWorldsDialog: React.FC<SavedWorldsDialogProps> = ({
  isOpen,
  onClose,
  worlds,
  onLoad,
  onDelete,
  isLoading = false,
}) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const handleLoad = useCallback(() => {
    if (selectedId) {
      onLoad(selectedId);
      onClose();
    }
  }, [selectedId, onLoad, onClose]);

  const handleDelete = useCallback(
    (worldId: string) => {
      if (confirmDelete === worldId) {
        onDelete(worldId);
        setConfirmDelete(null);
        setSelectedId(null);
      } else {
        setConfirmDelete(worldId);
      }
    },
    [confirmDelete, onDelete],
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Saved Worlds"
      icon={<Globe className="w-5 h-5 text-cyan-400" />}
    >
      <div className="space-y-4">
        {worlds.length === 0 ? (
          <div className="text-center py-8">
            <Globe className="w-12 h-12 text-text-muted mx-auto mb-2" />
            <p className="text-sm text-text-muted">
              No saved worlds found in browser storage.
            </p>
            <p className="text-xs text-text-muted mt-1">
              Use "Save Local" to save your current world.
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {worlds.map((world) => (
              <div
                key={world.id}
                onClick={() => setSelectedId(world.id)}
                className={`p-5 rounded border cursor-pointer transition-colors ${
                  selectedId === world.id
                    ? "bg-accent-primary/20 border-accent-primary"
                    : "bg-bg-tertiary border-border-primary hover:border-border-secondary"
                } ease-out`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-text-primary">
                      {world.name}
                    </h4>
                    <p className="text-xs text-text-muted">
                      Last modified:{" "}
                      {new Date(world.modifiedAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {confirmDelete === world.id ? (
                      <>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(world.id);
                          }}
                          className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDelete(null);
                          }}
                          className="px-2 py-1 text-xs bg-bg-quaternary text-text-secondary rounded hover:bg-bg-tertiary"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(world.id);
                        }}
                        className="p-1 text-text-muted hover:text-red-400 transition-colors ease-out"
                        title="Delete world"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-4 border-t border-border-primary">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleLoad} disabled={!selectedId || isLoading}>
            {isLoading ? "Loading..." : "Load Selected"}
          </Button>
        </div>
      </div>
    </Modal>
  );
};

// ============== EXPORT ==============

export default {
  AddNPCDialog,
  AddQuestDialog,
  AddBossDialog,
  AddEventDialog,
  AddLoreDialog,
  AddDifficultyZoneDialog,
  AddCustomPlacementDialog,
  SavedWorldsDialog,
};
