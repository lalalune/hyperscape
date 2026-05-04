/**
 * @hyperforge/hyperscape — meta-plugin for the Hyperia game.
 *
 * Phase I4 of PLAN_WORLD_STUDIO_AAA_COMPLETION.md. The "all of
 * Hyperia" loadable: depends on every constituent gameplay plugin
 * (combat first; skills, gathering, prayer, banking, …) and
 * exposes them as a single composed surface so a host can load
 * one entry point to get the full game.
 *
 * Acceptance criterion (Plan §I4):
 *   "Engine core has zero Hyperia-specific imports — everything
 *    game-specific is contributed through this package."
 *
 * Today's surface (cut #1):
 *   - Re-export the constituent plugin's public API so callers can
 *     work with one import (`import { combatPluginFactory } from
 *     "@hyperforge/hyperscape"`)
 *   - Provide a default factory that, when the host instantiates it,
 *     opt-ins to the same lifecycle hooks the constituent plugins
 *     declare. The default is intentionally a no-op for now —
 *     constituent plugins are loaded directly by the host via the
 *     dependency graph (manifest declares `dependencies: [combat]`).
 *
 * Future cuts will compose more plugins (skills, gathering, prayer,
 * banking, etc.) as those packages land. Each addition is a
 * dependency add to plugin.json + a re-export here.
 */

import type {
  HyperforgePlugin,
  PluginContextBase,
  PluginFactory,
} from "@hyperforge/gameplay-framework";
import {
  lootTablesProvider,
  mobLootTableMappingsProvider,
  registerEntityType,
  type World,
  writePacket,
} from "@hyperforge/shared";
import { createDropConditionDispatcher } from "./systems/economy/DropConditionDispatcher.js";
import { installWorldDropConditions } from "./systems/economy/WorldDropConditionEvaluators.js";
import { loadHyperiaManifestsSync } from "./onEnable/loadHyperiaManifests.js";
import { MobEntity } from "./entities/npc/MobEntity.js";
import { PlayerEntity } from "./entities/player/PlayerEntity.js";
import { PlayerLocal } from "./entities/player/PlayerLocal.js";
import { PlayerRemote } from "./entities/player/PlayerRemote.js";
// Entity classes that migrated to plugin (2026-04-26 follow-up to
// the Entities decoupling refactor).
import { AltarEntity } from "./entities/world/AltarEntity.js";
import { AnvilEntity } from "./entities/world/AnvilEntity.js";
import { BankEntity } from "./entities/world/BankEntity.js";
import { FurnaceEntity } from "./entities/world/FurnaceEntity.js";
import { HeadstoneEntity } from "./entities/world/HeadstoneEntity.js";
import { ItemEntity } from "./entities/world/ItemEntity.js";
import { NPCEntity } from "./entities/npc/NPCEntity.js";
import { RangeEntity } from "./entities/world/RangeEntity.js";
import { ResourceEntity } from "./entities/world/ResourceEntity.js";
import { RunecraftingAltarEntity } from "./entities/world/RunecraftingAltarEntity.js";

import { AggroSystem } from "./systems/AggroSystem.js";
import { BankingSystem } from "./systems/BankingSystem.js";
import { BFSPathDebugSystem } from "./systems/BFSPathDebugSystem.js";
import { ClientTeleportEffectsSystem } from "./systems/ClientTeleportEffectsSystem.js";
import { CoinPouchSystem } from "./systems/CoinPouchSystem.js";
import { DialogueSystem } from "./systems/DialogueSystem.js";
import { CraftingSystem } from "./systems/CraftingSystem.js";
import { DamageSplatSystem } from "./systems/DamageSplatSystem.js";
import { DuelArenaVisualsSystem } from "./systems/DuelArenaVisualsSystem.js";
import { DuelCountdownSplatSystem } from "./systems/DuelCountdownSplatSystem.js";
import { EquipmentVisualSystem } from "./systems/EquipmentVisualSystem.js";
import { FletchingSystem } from "./systems/FletchingSystem.js";
import { GravestoneLootSystem } from "./systems/GravestoneLootSystem.js";
import { GroundItemSystem } from "./systems/GroundItemSystem.js";
import { ZoneDetectionSystem } from "./systems/ZoneDetectionSystem.js";
import { PlayerDeathSystem } from "./systems/PlayerDeathSystem.js";
import { SkillsSystem } from "./systems/SkillsSystem.js";
import { EquipmentSystem } from "./systems/EquipmentSystem.js";
import { InventorySystem } from "./systems/InventorySystem.js";
import { PlayerSystem } from "./systems/PlayerSystem.js";
import { CombatSystem } from "./systems/combat/CombatSystem.js";
import { PathfindingDebugSystem } from "./systems/PathfindingDebugSystem.js";
import { PrayerSystem } from "./systems/PrayerSystem.js";
import { ProcessingSystem } from "./systems/ProcessingSystem.js";
import { StationSpawnerSystem } from "./systems/StationSpawnerSystem.js";
import { HealthBars } from "./systems/HealthBars.js";
import { HealthRegenSystem } from "./systems/HealthRegenSystem.js";
import { ItemSpawnerSystem } from "./systems/ItemSpawnerSystem.js";
import { BridgeSystem } from "./systems/BridgeSystem.js";
import { BuildingRenderingSystem } from "./systems/BuildingRenderingSystem.js";
import { POISystem } from "./systems/POISystem.js";
import { ProceduralDocks } from "./systems/ProceduralDocks.js";
import { ProceduralGrassSystem } from "./systems/ProceduralGrass.js";
import { ResourceSystem } from "./systems/ResourceSystem.js";
import { TownSystem } from "./systems/TownSystem.js";
import { VegetationSystem } from "./systems/VegetationSystem.js";
import { ScriptingSystem } from "./systems/ScriptingSystem.js";
import { LootSystem } from "./systems/LootSystem.js";
import { InventoryInteractionSystem } from "./systems/InventoryInteractionSystem.js";
import { MusicSystem } from "./systems/MusicSystem.js";
import { MobDeathSystem } from "./systems/MobDeathSystem.js";
import { MobNPCSpawnerSystem } from "./systems/MobNPCSpawnerSystem.js";
import { MobNPCSystem } from "./systems/MobNPCSystem.js";
import { NPCSystem } from "./systems/NPCSystem.js";
import { ProjectileRenderer } from "./systems/ProjectileRenderer.js";
import { QuestSystem } from "./systems/QuestSystem.js";
import { ResourceTileDebugSystem } from "./systems/ResourceTileDebugSystem.js";
import { StoreSystem } from "./systems/StoreSystem.js";
import { RunecraftingSystem } from "./systems/RunecraftingSystem.js";
import { SmeltingSystem } from "./systems/SmeltingSystem.js";
import { SmithingSystem } from "./systems/SmithingSystem.js";
import { TanningSystem } from "./systems/TanningSystem.js";
import { TradingSystem } from "./systems/TradingSystem/index.js";
import { DuelSystem } from "./systems/DuelSystem/index.js";
import { PendingTradeManager } from "./systems/PendingTradeManager.js";
import { PendingDuelChallengeManager } from "./systems/PendingDuelChallengeManager.js";
import { PendingAttackManager } from "./systems/PendingAttackManager.js";
import { PendingCookManager } from "./systems/PendingCookManager.js";
import { PendingGatherManager } from "./systems/PendingGatherManager.js";
import { FollowManager } from "./systems/FollowManager.js";
import { FaceDirectionManager } from "./systems/FaceDirectionManager.js";
import { TileMovementManager } from "./systems/tile-movement.js";
import { MobTileMovementManager } from "./systems/mob-tile-movement.js";
import { handleChatAdded } from "./systems/network-handlers/chat.js";
import {
  handleDialogueResponse,
  handleDialogueContinue,
  handleDialogueClose,
} from "./systems/network-handlers/dialogue.js";
import {
  handleEntityEvent,
  handleEntityRemoved,
  handleEntityModified,
  handleSettings,
} from "./systems/network-handlers/entities.js";
import { handleSetAutocast } from "./systems/network-handlers/magic.js";
import { handleResourceGather } from "./systems/network-handlers/resources.js";
import {
  handleAttackPlayer as handleAttackPlayerImpl,
  handleAttackMob as handleAttackMobImpl,
} from "./systems/network-handlers/combat.js";
import {
  handleFollowPlayer,
  handleChangePlayerName,
} from "./systems/network-handlers/player.js";
import {
  handlePrayerToggle,
  handleAltarPray,
  handlePrayerDeactivateAll,
} from "./systems/network-handlers/prayer.js";
import {
  handleGetQuestList,
  handleGetQuestDetail,
  handleQuestAccept,
  handleQuestAbandon,
  handleQuestComplete,
} from "./systems/network-handlers/quest.js";
import {
  createHomeTeleportFactory,
  handleHomeTeleport,
  handleHomeTeleportCancel,
} from "./systems/network-handlers/home-teleport.js";
import type {
  HomeTeleportFactory,
  IHomeTeleportManager,
  IFriendsService,
  ICombatAttackService,
  IPlayerSpawnService,
} from "@hyperforge/shared";
import {
  loadCharacterList,
  handleCharacterListRequest,
  handleCharacterCreate,
  handleCharacterSelected,
  collectInitialSyncEntities,
  handleEnterWorld,
} from "./systems/network-handlers/character-selection.js";
import {
  sendFriendsListSync,
  notifyFriendsOfStatusChange,
  handleFriendRequest,
  handleFriendAccept,
  handleFriendDecline,
  handleFriendRemove,
  handleIgnoreAdd,
  handleIgnoreRemove,
  handlePrivateMessage,
} from "./systems/network-handlers/friends.js";
import { WalkableTileDebugSystem } from "./systems/WalkableTileDebugSystem.js";
import { xpOrbRegistration } from "./widgets/XPOrbWidget.js";
import { levelUpToastRegistration } from "./widgets/LevelUpToastWidget.js";
import { kickedOverlayRegistration } from "./widgets/KickedOverlayWidget.js";
import { disconnectedOverlayRegistration } from "./widgets/DisconnectedOverlayWidget.js";
import { deathScreenRegistration } from "./widgets/DeathScreenWidget.js";
import { connectionIndicatorRegistration } from "./widgets/ConnectionIndicatorWidget.js";
import { minimapStaminaOrbRegistration } from "./widgets/MinimapStaminaOrbWidget.js";
import { minimapCompassRegistration } from "./widgets/MinimapCompassWidget.js";
import { actionProgressBarRegistration } from "./widgets/ActionProgressBarWidget.js";
import { homeTeleportButtonRegistration } from "./widgets/HomeTeleportButtonWidget.js";
import { minimapHomeTeleportOrbRegistration } from "./widgets/MinimapHomeTeleportOrbWidget.js";
import { skillSelectModalRegistration } from "./widgets/SkillSelectModalWidget.js";
import { floatingXPDropsRegistration } from "./widgets/FloatingXPDropsWidget.js";
import { unlocksSectionRegistration } from "./widgets/UnlocksSectionWidget.js";
import { coinPouchRegistration } from "./widgets/CoinPouchWidget.js";
import { selectOptionRegistration } from "./widgets/SelectOptionWidget.js";
import { confirmDialogRegistration } from "./widgets/ConfirmDialogWidget.js";
import { quantityPromptRegistration } from "./widgets/QuantityPromptWidget.js";
import { incomingRequestModalRegistration } from "./widgets/IncomingRequestModalWidget.js";
import { equipmentSlotIconRegistration } from "./widgets/EquipmentSlotIconWidget.js";
import { dialoguePanelRegistration } from "./widgets/DialoguePanelWidget.js";
import { arrayInputRegistration } from "./widgets/ArrayInputWidget.js";
import { curvePreviewRegistration } from "./widgets/CurvePreviewWidget.js";
import { contextMenuRegistration } from "./widgets/ContextMenuWidget.js";
import { keyValueListRegistration } from "./widgets/KeyValueListWidget.js";
import { cursorTooltipRegistration } from "./widgets/CursorTooltipWidget.js";
import { notificationToastListRegistration } from "./widgets/NotificationToastListWidget.js";
import { buffBarRegistration } from "./widgets/BuffBarWidget.js";
import { victoryOverlayRegistration } from "./widgets/VictoryOverlayWidget.js";
import { alignmentGuidesRegistration } from "./widgets/AlignmentGuidesWidget.js";
import { dragGhostOverlayRegistration } from "./widgets/DragGhostOverlayWidget.js";
import { progressBarRegistration } from "./widgets/ProgressBarWidget.js";
import { loadingSpinnerRegistration } from "./widgets/LoadingSpinnerWidget.js";
import { toggleSwitchRegistration } from "./widgets/ToggleSwitchWidget.js";
import { rangeSliderRegistration } from "./widgets/RangeSliderWidget.js";
import { badgeRegistration } from "./widgets/BadgeWidget.js";
import { segmentedControlRegistration } from "./widgets/SegmentedControlWidget.js";
import { textInputRegistration } from "./widgets/TextInputWidget.js";
import { avatarRegistration } from "./widgets/AvatarWidget.js";
import { emptyStateRegistration } from "./widgets/EmptyStateWidget.js";
import { chipListRegistration } from "./widgets/ChipListWidget.js";
import { sectionHeaderRegistration } from "./widgets/SectionHeaderWidget.js";
import { countdownDisplayRegistration } from "./widgets/CountdownDisplayWidget.js";
import { breadcrumbsRegistration } from "./widgets/BreadcrumbsWidget.js";
import { checkboxRegistration } from "./widgets/CheckboxWidget.js";
import { keyboardShortcutHintRegistration } from "./widgets/KeyboardShortcutHintWidget.js";
import { paginationRegistration } from "./widgets/PaginationWidget.js";
import { iconButtonRegistration } from "./widgets/IconButtonWidget.js";
import { dividerRegistration } from "./widgets/DividerWidget.js";
import { skeletonRegistration } from "./widgets/SkeletonWidget.js";
import { stepIndicatorRegistration } from "./widgets/StepIndicatorWidget.js";
import { codeBlockRegistration } from "./widgets/CodeBlockWidget.js";
import { WaterfallVisualsSystem } from "./systems/WaterfallVisualsSystem.js";
import { ZoneVisualsSystem } from "./systems/ZoneVisualsSystem.js";

// Re-export combat surface so callers have one import path.
export {
  type CombatAbility,
  type CombatAbilityKind,
  type CombatAbilityService,
  type CombatContext,
  combatPluginFactory,
  createCombatAbilityService,
  DEFAULT_COMBAT_ABILITIES,
} from "@hyperforge/combat";

// Re-export skills surface so callers have one import path.
export {
  type SkillCategory,
  type SkillDefinition,
  type SkillsContext,
  type SkillsService,
  createSkillsService,
  DEFAULT_SKILLS,
  skillsPluginFactory,
} from "@hyperforge/skills";

export { manifest } from "./manifest.js";

// SpellService — singleton + class for the magic spellbook. Migrated
// from @hyperforge/shared on 2026-04-26 (Wave 6). Re-exported here so
// the React spellbook panel and any other client-side consumers can
// keep importing through the plugin's public surface.
export { SpellService, spellService } from "./systems/combat/SpellService.js";

// Phase B0'.F — default HUD layout the plugin contributes. PIE
// Play of a Hyperia project renders this layout; the production
// client at localhost:3333 will re-export from this module in
// B0'.F.2 (dedupe).
export {
  HYPERSCAPE_DEFAULT_HUD_LAYOUT,
  HYPERSCAPE_DEFAULT_HUD_LAYOUT_ID,
} from "./contributions/defaultHud.js";

// Plugin-contributed widgets — re-exported so hosts that pre-register
// widgets at boot (e.g. the asset-forge editor's UI Layout Editor)
// can access the same registrations the plugin's onEnable installs.
// Phase D6.c.1 / Session 4 (XP orb) + D6.c.A / Session 5 (LevelUp).
export {
  xpOrbWidget,
  xpOrbRegistration,
  XPOrb,
  type XPDropEntry,
} from "./widgets/XPOrbWidget.js";
export {
  levelUpToastWidget,
  levelUpToastRegistration,
  LevelUpToast,
  type LevelUpEntry,
} from "./widgets/LevelUpToastWidget.js";
// Phase D6.c.2 (overlay HUDs) — slices 31 + 32, 2026-04-27.
export {
  kickedOverlayWidget,
  kickedOverlayRegistration,
  KickedOverlay,
  DEFAULT_KICK_MESSAGES,
  type KickedOverlayProps,
} from "./widgets/KickedOverlayWidget.js";
export {
  disconnectedOverlayWidget,
  disconnectedOverlayRegistration,
  DisconnectedOverlay,
  type DisconnectedOverlayProps,
  type DisconnectedOverlayRuntimeProps,
} from "./widgets/DisconnectedOverlayWidget.js";
export {
  deathScreenWidget,
  deathScreenRegistration,
  DeathScreen,
  type DeathScreenProps,
  type DeathScreenRuntimeProps,
} from "./widgets/DeathScreenWidget.js";
export {
  connectionIndicatorWidget,
  connectionIndicatorRegistration,
  ConnectionIndicator,
  CONNECTION_STATUSES,
  type ConnectionIndicatorProps,
  type ConnectionStatus,
} from "./widgets/ConnectionIndicatorWidget.js";
export {
  minimapStaminaOrbWidget,
  minimapStaminaOrbRegistration,
  MinimapStaminaOrb,
  type MinimapStaminaOrbProps,
  type MinimapStaminaOrbRuntimeProps,
} from "./widgets/MinimapStaminaOrbWidget.js";
export {
  minimapCompassWidget,
  minimapCompassRegistration,
  MinimapCompass,
  COMPASS_SIZES,
  type MinimapCompassProps,
  type MinimapCompassRuntimeProps,
  type CompassSize,
} from "./widgets/MinimapCompassWidget.js";
export {
  actionProgressBarWidget,
  actionProgressBarRegistration,
  ActionProgressBar,
  type ActionProgressBarProps,
} from "./widgets/ActionProgressBarWidget.js";
export {
  homeTeleportButtonWidget,
  homeTeleportButtonRegistration,
  HomeTeleportButton,
  HOME_TELEPORT_STATUSES,
  type HomeTeleportButtonProps,
  type HomeTeleportButtonRuntimeProps,
  type HomeTeleportStatus,
} from "./widgets/HomeTeleportButtonWidget.js";
export {
  minimapHomeTeleportOrbWidget,
  minimapHomeTeleportOrbRegistration,
  MinimapHomeTeleportOrb,
  type MinimapHomeTeleportOrbProps,
  type MinimapHomeTeleportOrbRuntimeProps,
} from "./widgets/MinimapHomeTeleportOrbWidget.js";
export {
  skillSelectModalWidget,
  skillSelectModalRegistration,
  SkillSelectModal,
  DEFAULT_SKILL_CATALOG,
  type SkillCatalogEntry,
  type SkillSelectModalProps,
  type SkillSelectModalRuntimeProps,
} from "./widgets/SkillSelectModalWidget.js";
export {
  floatingXPDropsWidget,
  floatingXPDropsRegistration,
  FloatingXPDrops,
  type FloatingXPDrop,
  type FloatingXPDropsProps,
} from "./widgets/FloatingXPDropsWidget.js";
export {
  unlocksSectionWidget,
  unlocksSectionRegistration,
  UnlocksSection,
  UNLOCK_TYPES,
  DEFAULT_UNLOCK_TYPE_ICONS,
  type UnlockType,
  type UnlockEntry,
  type UnlocksSectionProps,
} from "./widgets/UnlocksSectionWidget.js";
export {
  coinPouchWidget,
  coinPouchRegistration,
  CoinPouch,
  type CoinPouchProps,
  type CoinPouchRuntimeProps,
} from "./widgets/CoinPouchWidget.js";
export {
  selectOptionWidget,
  selectOptionRegistration,
  SelectOption,
  type SelectOptionEntry,
  type SelectOptionProps,
  type SelectOptionRuntimeProps,
} from "./widgets/SelectOptionWidget.js";
export {
  confirmDialogWidget,
  confirmDialogRegistration,
  ConfirmDialog,
  CONFIRM_DIALOG_VARIANTS,
  type ConfirmDialogVariant,
  type ConfirmDialogProps,
  type ConfirmDialogRuntimeProps,
} from "./widgets/ConfirmDialogWidget.js";
export {
  quantityPromptWidget,
  quantityPromptRegistration,
  QuantityPrompt,
  parseQuantityInput,
  type QuantityPromptProps,
  type QuantityPromptRuntimeProps,
} from "./widgets/QuantityPromptWidget.js";
export {
  incomingRequestModalWidget,
  incomingRequestModalRegistration,
  IncomingRequestModal,
  type IncomingRequestModalProps,
  type IncomingRequestModalRuntimeProps,
} from "./widgets/IncomingRequestModalWidget.js";
export {
  equipmentSlotIconWidget,
  equipmentSlotIconRegistration,
  EquipmentSlotIcon,
  EQUIPMENT_SLOT_KEYS,
  type EquipmentSlotKey,
  type EquipmentSlotIconProps,
} from "./widgets/EquipmentSlotIconWidget.js";
export {
  dialoguePanelWidget,
  dialoguePanelRegistration,
  DialoguePanel,
  type DialogueResponse,
  type DialoguePanelProps,
  type DialoguePanelRuntimeProps,
} from "./widgets/DialoguePanelWidget.js";
export {
  arrayInputWidget,
  arrayInputRegistration,
  ArrayInput,
  ARRAY_INPUT_TYPES,
  type ArrayInputType,
  type ArrayInputProps,
  type ArrayInputRuntimeProps,
} from "./widgets/ArrayInputWidget.js";
export {
  curvePreviewWidget,
  curvePreviewRegistration,
  CurvePreview,
  type CurvePreviewProps,
} from "./widgets/CurvePreviewWidget.js";
export {
  contextMenuWidget,
  contextMenuRegistration,
  ContextMenu,
  type ContextMenuItem,
  type ContextMenuProps,
  type ContextMenuRuntimeProps,
} from "./widgets/ContextMenuWidget.js";
export {
  keyValueListWidget,
  keyValueListRegistration,
  KeyValueList,
  type KeyValueRow,
  type KeyValueListProps,
} from "./widgets/KeyValueListWidget.js";
export {
  cursorTooltipWidget,
  cursorTooltipRegistration,
  CursorTooltip,
  calculateCursorTooltipPosition,
  type CursorTooltipProps,
} from "./widgets/CursorTooltipWidget.js";
export {
  notificationToastListWidget,
  notificationToastListRegistration,
  NotificationToastList,
  NOTIFICATION_TYPES,
  NOTIFICATION_ANCHORS,
  DEFAULT_NOTIFICATION_TYPE_STYLES,
  type NotificationType,
  type NotificationAnchor,
  type NotificationToast,
  type NotificationTypeStyle,
  type NotificationToastListProps,
  type NotificationToastListRuntimeProps,
} from "./widgets/NotificationToastListWidget.js";
export {
  buffBarWidget,
  buffBarRegistration,
  BuffBar,
  BUFF_KINDS,
  BUFF_BAR_ORIENTATIONS,
  type BuffKind,
  type BuffBarOrientation,
  type BuffEntry,
  type BuffBarProps,
  type BuffBarRuntimeProps,
} from "./widgets/BuffBarWidget.js";
export {
  victoryOverlayWidget,
  victoryOverlayRegistration,
  VictoryOverlay,
  type VictoryOverlayProps,
} from "./widgets/VictoryOverlayWidget.js";
export {
  alignmentGuidesWidget,
  alignmentGuidesRegistration,
  AlignmentGuides,
  ALIGNMENT_GUIDE_AXES,
  type AlignmentGuideAxis,
  type AlignmentGuide,
  type AlignmentGuidesProps,
} from "./widgets/AlignmentGuidesWidget.js";
export {
  dragGhostOverlayWidget,
  dragGhostOverlayRegistration,
  DragGhostOverlay,
  DRAG_GHOST_KINDS,
  type DragGhostKind,
  type DragGhostOverlayProps,
} from "./widgets/DragGhostOverlayWidget.js";
export {
  progressBarWidget,
  progressBarRegistration,
  ProgressBar,
  PROGRESS_BAR_ORIENTATIONS,
  type ProgressBarOrientation,
  type ProgressBarProps,
} from "./widgets/ProgressBarWidget.js";
export {
  loadingSpinnerWidget,
  loadingSpinnerRegistration,
  LoadingSpinner,
  LOADING_SPINNER_KINDS,
  type LoadingSpinnerKind,
  type LoadingSpinnerProps,
} from "./widgets/LoadingSpinnerWidget.js";
export {
  toggleSwitchWidget,
  toggleSwitchRegistration,
  ToggleSwitch,
  type ToggleSwitchProps,
  type ToggleSwitchRuntimeProps,
} from "./widgets/ToggleSwitchWidget.js";
export {
  rangeSliderWidget,
  rangeSliderRegistration,
  RangeSlider,
  computeRangeFillPercent,
  type RangeSliderProps,
  type RangeSliderRuntimeProps,
} from "./widgets/RangeSliderWidget.js";
export {
  badgeWidget,
  badgeRegistration,
  Badge,
  BADGE_VARIANTS,
  DEFAULT_BADGE_VARIANT_COLORS,
  type BadgeVariant,
  type BadgeProps,
} from "./widgets/BadgeWidget.js";
export {
  segmentedControlWidget,
  segmentedControlRegistration,
  SegmentedControl,
  SEGMENTED_CONTROL_ORIENTATIONS,
  nextEnabledIndex,
  type SegmentedControlOrientation,
  type SegmentedOption,
  type SegmentedControlProps,
  type SegmentedControlRuntimeProps,
} from "./widgets/SegmentedControlWidget.js";
export {
  textInputWidget,
  textInputRegistration,
  TextInput,
  TEXT_INPUT_TYPES,
  type TextInputType,
  type TextInputProps,
  type TextInputRuntimeProps,
} from "./widgets/TextInputWidget.js";
export {
  avatarWidget,
  avatarRegistration,
  Avatar,
  AVATAR_SHAPES,
  AVATAR_STATUSES,
  DEFAULT_AVATAR_INITIAL_COLORS,
  DEFAULT_AVATAR_STATUS_COLORS,
  computeInitials,
  pickPaletteIndex,
  type AvatarShape,
  type AvatarStatus,
  type AvatarProps,
} from "./widgets/AvatarWidget.js";
export {
  emptyStateWidget,
  emptyStateRegistration,
  EmptyState,
  type EmptyStateProps,
  type EmptyStateRuntimeProps,
} from "./widgets/EmptyStateWidget.js";
export {
  chipListWidget,
  chipListRegistration,
  ChipList,
  CHIP_VARIANTS,
  CHIP_LIST_ORIENTATIONS,
  DEFAULT_CHIP_VARIANT_COLORS,
  type ChipVariant,
  type ChipListOrientation,
  type ChipItem,
  type ChipListProps,
  type ChipListRuntimeProps,
} from "./widgets/ChipListWidget.js";
export {
  sectionHeaderWidget,
  sectionHeaderRegistration,
  SectionHeader,
  SECTION_HEADER_LEVELS,
  type SectionHeaderLevel,
  type SectionHeaderProps,
  type SectionHeaderRuntimeProps,
} from "./widgets/SectionHeaderWidget.js";
export {
  countdownDisplayWidget,
  countdownDisplayRegistration,
  CountdownDisplay,
  COUNTDOWN_FORMATS,
  formatCountdown,
  type CountdownFormat,
  type CountdownDisplayProps,
} from "./widgets/CountdownDisplayWidget.js";
export {
  breadcrumbsWidget,
  breadcrumbsRegistration,
  Breadcrumbs,
  type BreadcrumbItem,
  type BreadcrumbsProps,
  type BreadcrumbsRuntimeProps,
} from "./widgets/BreadcrumbsWidget.js";
export {
  checkboxWidget,
  checkboxRegistration,
  Checkbox,
  type CheckboxProps,
  type CheckboxRuntimeProps,
} from "./widgets/CheckboxWidget.js";
export {
  keyboardShortcutHintWidget,
  keyboardShortcutHintRegistration,
  KeyboardShortcutHint,
  HINT_ORIENTATIONS,
  formatHintLabel,
  type HintOrientation,
  type KeyboardShortcutHintProps,
} from "./widgets/KeyboardShortcutHintWidget.js";
export {
  paginationWidget,
  paginationRegistration,
  Pagination,
  computePageWindow,
  type PageWindowEntry,
  type PaginationProps,
  type PaginationRuntimeProps,
} from "./widgets/PaginationWidget.js";
export {
  iconButtonWidget,
  iconButtonRegistration,
  IconButton,
  ICON_BUTTON_SIZES,
  ICON_BUTTON_VARIANTS,
  ICON_BUTTON_SIZE_TABLE,
  DEFAULT_ICON_BUTTON_VARIANT_COLORS,
  type IconButtonSize,
  type IconButtonVariant,
  type IconButtonProps,
  type IconButtonRuntimeProps,
} from "./widgets/IconButtonWidget.js";
export {
  dividerWidget,
  dividerRegistration,
  Divider,
  DIVIDER_ORIENTATIONS,
  DIVIDER_STYLES,
  type DividerOrientation,
  type DividerStyle,
  type DividerProps,
} from "./widgets/DividerWidget.js";
export {
  skeletonWidget,
  skeletonRegistration,
  Skeleton,
  SKELETON_ANIMATIONS,
  SKELETON_SHAPES,
  type SkeletonAnimation,
  type SkeletonShape,
  type SkeletonProps,
} from "./widgets/SkeletonWidget.js";
export {
  stepIndicatorWidget,
  stepIndicatorRegistration,
  StepIndicator,
  STEP_STATES,
  STEP_INDICATOR_ORIENTATIONS,
  type StepState,
  type StepIndicatorOrientation,
  type StepIndicatorItem,
  type StepIndicatorProps,
  type StepIndicatorRuntimeProps,
} from "./widgets/StepIndicatorWidget.js";
export {
  codeBlockWidget,
  codeBlockRegistration,
  CodeBlock,
  type CodeBlockProps,
  type CodeBlockRuntimeProps,
} from "./widgets/CodeBlockWidget.js";

// TradingSystem + DuelSystem — consumed by `@hyperforge/server` via
// re-export shims (and DuelSystem also by integration tests).
// Migrated from `@hyperforge/shared` (2026-04-26).
export { TradingSystem } from "./systems/TradingSystem/index.js";
export { DuelSystem } from "./systems/DuelSystem/index.js";
// DuelSystem duck-type interface relocated to plugin/types/
// duel-system-interface 2026-04-27 (top-10 #8, slice 29). The
// DuelSystem name resolves to the class export above; companion
// types are re-exported here for cross-package consumers.
export type {
  DuelOperationResult,
  DuelSessionInfo,
} from "./types/duel-system-interface.js";

// Resource / processing / death game types — migrated from
// `@hyperforge/shared/types/game/resource-processing-types`
// 2026-04-27 (top-10 #8, slice 30). Footprint primitives stay in
// shared (engine substrate); game types live here.
export type {
  Resource,
  ResourceDrop,
  Fire,
  ProcessingAction,
  DeathData,
} from "./types/resource-game-types.js";

// ScriptQueue — tile-based action priority queue, consumed by
// `@hyperforge/server`'s GameTickProcessor. Migrated from
// `@hyperforge/shared` (2026-04-26).
export {
  PlayerScriptQueue,
  NPCScriptQueue,
  ScriptPriority,
  ScriptType,
  type QueuedScript,
  type ModalState,
} from "./systems/ScriptQueue.js";

// Pending- and Follow-managers — consumed by `@hyperforge/server`'s
// re-export shims. Migrated from `@hyperforge/shared`
// (Phases D1-D6, 2026-04-26).
export { PendingTradeManager } from "./systems/PendingTradeManager.js";
export { PendingDuelChallengeManager } from "./systems/PendingDuelChallengeManager.js";
export { PendingAttackManager } from "./systems/PendingAttackManager.js";
export { PendingCookManager } from "./systems/PendingCookManager.js";
export { PendingGatherManager } from "./systems/PendingGatherManager.js";
export { FollowManager } from "./systems/FollowManager.js";
export { FaceDirectionManager } from "./systems/FaceDirectionManager.js";
export { TileMovementManager } from "./systems/tile-movement.js";
export { MobTileMovementManager } from "./systems/mob-tile-movement.js";

// QuestSystem + quest-types — re-exported for server integration tests
// + cross-package consumers. quest-types migrated from shared
// 2026-04-27 (top-10 #8 cleanup).
export { QuestSystem } from "./systems/QuestSystem.js";
export {
  isValidQuestId,
  validateQuestDefinition,
  type QuestDefinition,
  type QuestStatus,
  type QuestDbStatus,
  type QuestStage,
  type StageProgress,
  type QuestProgress,
  type PlayerQuestState,
  type QuestManifest,
  type QuestDifficulty,
  type QuestStageType,
  type QuestRequirements,
  type QuestRewards,
  type QuestOnStart,
  type QuestDialogueOverrides,
  type QuestAwareDialogue,
  type QuestValidationResult,
} from "./types/quest-types.js";

// social-types — migrated from shared 2026-04-27 (top-10 #8 cleanup).
// Re-exported here for cross-package consumers (client FriendsPanel, etc.)
export type {
  Friend,
  FriendRequest,
  FriendStatus,
  FriendStatusUpdateData,
  FriendsListSyncData,
  IgnoredPlayer,
  PrivateMessage,
  PrivateChatFailReason,
  SocialError,
  SocialErrorCode,
} from "./types/social-types.js";

// trade-types — migrated from shared 2026-04-27 (top-10 #8 cleanup).
// TradingSystem + TradeOperationResult also live here now (was in
// shared/types/systems/system-interfaces). Re-exported here for
// cross-package consumers (server's swap.ts, etc.)
export type {
  TradeStatus,
  TradeCancelReason,
  TradeOfferItem,
  TradeParticipant,
  TradeSession,
  TradeRequestPayload,
  TradeRequestRespondPayload,
  TradeAddItemPayload,
  TradeRemoveItemPayload,
  TradeSetQuantityPayload,
  TradeAcceptPayload,
  TradeCancelAcceptPayload,
  TradeCancelPayload,
  TradeIncomingPayload,
  TradeStartedPayload,
  TradeOfferView,
  TradeUpdatedPayload,
  TradeCompletedPayload,
  TradeCancelledPayload,
  TradeErrorPayload,
  TradeWindowState,
  TradeRequestModalState,
  TradeOperationResult,
  // TradingSystem name is already exported above as a class (from
  // ./systems/TradingSystem/index.js). The class structurally
  // satisfies the duck-type interface, so consumers needing the
  // interface should import the class as a type.
} from "./types/trade-types.js";

// Network packet handlers — Phase F3 (2026-04-26). Each handler is
// also registered automatically by plugin onEnable via
// `world.connectionRegistry`; these re-exports are for direct
// importers in `@hyperforge/server` or tests.
export { handleChatAdded } from "./systems/network-handlers/chat.js";
export {
  handleDialogueResponse,
  handleDialogueContinue,
  handleDialogueClose,
} from "./systems/network-handlers/dialogue.js";
export {
  handleEntityEvent,
  handleEntityRemoved,
  handleEntityModified,
  handleSettings,
} from "./systems/network-handlers/entities.js";
export { handleSetAutocast } from "./systems/network-handlers/magic.js";
export { handleResourceGather } from "./systems/network-handlers/resources.js";
export {
  handleFollowPlayer,
  handleChangePlayerName,
} from "./systems/network-handlers/player.js";
export {
  handlePrayerToggle,
  handleAltarPray,
  handlePrayerDeactivateAll,
} from "./systems/network-handlers/prayer.js";
export {
  handleGetQuestList,
  handleGetQuestDetail,
  handleQuestAccept,
  handleQuestAbandon,
  handleQuestComplete,
} from "./systems/network-handlers/quest.js";
export {
  handleResourceInteract,
  handleCookingSourceInteract,
  handleFiremakingRequest,
  handleCookingRequest,
  handleSmeltingSourceInteract,
  handleProcessingSmelting,
  handleSmithingSourceInteract,
  handleProcessingSmithing,
  handleCraftingSourceInteract,
  handleProcessingCrafting,
  handleFletchingSourceInteract,
  handleProcessingFletching,
  handleProcessingTanning,
  handleRunecraftingAltarInteract,
  type ProcessingHandlerContext,
} from "./systems/network-handlers/processing.js";
export {
  handleDuelChallenge,
  handleDuelChallengeRespond,
} from "./systems/network-handlers/duel/challenge.js";
export { handleDuelForfeit } from "./systems/network-handlers/duel/combat.js";
export { handleDuelAcceptFinal } from "./systems/network-handlers/duel/confirmation.js";
export {
  handleDuelToggleRule,
  handleDuelToggleEquipment,
  handleDuelAcceptRules,
  handleDuelCancel,
} from "./systems/network-handlers/duel/rules.js";
export {
  rateLimiter,
  getDuelSystem,
  getPendingDuelChallengeManager,
  getPlayerName as getPlayerNameForDuel,
  getPlayerCombatLevel as getPlayerCombatLevelForDuel,
  isPlayerOnline,
  getSocketByPlayerId,
  sendDuelError,
  sendSuccessToast,
  withDuelAuth,
  DUEL_PACKETS,
  assertDuelState,
  sendToSocket,
  getPlayerId,
  isInDuelArenaZone,
  isInsideCombatArena,
  isInDuelArenaLobby,
  arePlayersInChallengeRange,
  arePlayersAdjacent,
} from "./systems/network-handlers/duel/helpers.js";
export {
  TRADE_PROXIMITY_TILES,
  getTradingSystem,
  getPendingTradeManager,
  getPlayerName,
  getPlayerCombatLevel,
  chebyshevDistance,
  arePlayersInTradeRange,
  sendTradeError,
  calculateOfferValue,
  calculateFreeSlots,
  sendTradeUpdate,
  sendTradeConfirmScreen,
} from "./systems/network-handlers/trade/helpers.js";
export {
  handleTradeRequest,
  handleTradeRequestRespond,
} from "./systems/network-handlers/trade/request.js";
export {
  handleChangeAttackStyle,
  handleSetAutoRetaliate,
  handleAttackPlayer,
  handleAttackMob,
} from "./systems/network-handlers/combat.js";
export {
  HomeTeleportManager,
  createHomeTeleportFactory,
  formatCooldownRemaining,
  handleHomeTeleport,
  handleHomeTeleportCancel,
} from "./systems/network-handlers/home-teleport.js";
export {
  handleFriendRequest,
  handleFriendAccept,
  handleFriendDecline,
  handleFriendRemove,
  handleIgnoreAdd,
  handleIgnoreRemove,
  handlePrivateMessage,
  sendFriendsListSync,
  notifyFriendsOfStatusChange,
} from "./systems/network-handlers/friends.js";
export {
  loadCharacterList,
  handleCharacterListRequest,
  handleCharacterCreate,
  handleCharacterSelected,
  collectInitialSyncEntities,
  handleEnterWorld,
} from "./systems/network-handlers/character-selection.js";
// Duel-food helpers (migrated from shared during DuelSystem session,
// 2026-04-26). Consumed by server-side duel handlers + agent
// integration tests via the deprecated shim.
export {
  DUEL_FOOD_ITEM_IDS,
  getDuelFoodItemForLevels,
  isDuelFoodItemId,
} from "./systems/duelFood.js";

// PlayerEntity / PlayerLocal / PlayerRemote — needed by server-side
// DuelScheduler and other consumers that previously imported from
// `@hyperforge/shared` (where these classes used to live before the
// player-entity migration session).
export { PlayerEntity } from "./entities/player/PlayerEntity.js";
export { PlayerLocal } from "./entities/player/PlayerLocal.js";
export { PlayerRemote } from "./entities/player/PlayerRemote.js";

// StoreSystem — needed by server-side store handler (store.ts) which
// resolves it via `world.getSystem("store") as StoreSystem` and used
// to import the type from `@hyperforge/shared`.
export { StoreSystem } from "./systems/StoreSystem.js";

// DuelSystem internals — re-exported so the server-side
// `packages/server/src/systems/DuelSystem/*` shims can resolve via
// `@hyperforge/hyperscape` instead of dangling `@hyperforge/shared`
// paths that no longer exist post-migration.
export { ArenaPoolManager } from "./systems/DuelSystem/ArenaPoolManager.js";
export {
  CHALLENGE_TIMEOUT_TICKS,
  DISCONNECT_TIMEOUT_TICKS,
  SETUP_DISCONNECT_GRACE_TICKS,
  SESSION_MAX_AGE_TICKS,
  DEATH_RESOLUTION_DELAY_TICKS,
  CLEANUP_INTERVAL_TICKS,
  CHALLENGE_CLEANUP_INTERVAL_TICKS,
  ticksToMs,
  TICK_DURATION_MS,
  CHALLENGE_DISTANCE_TILES,
  LOBBY_SPAWN_WINNER,
  LOBBY_SPAWN_LOSER,
} from "./systems/DuelSystem/config.js";
export {
  DuelCombatResolver,
  type DuelResolutionReason,
  type DuelResolutionResult,
} from "./systems/DuelSystem/DuelCombatResolver.js";
export {
  DuelSessionManager,
  getParticipantRole,
  getSessionOpponentId,
  type ServerDuelSession,
  type EquipmentRestrictions,
} from "./systems/DuelSystem/DuelSessionManager.js";
export { DUEL_ERRORS } from "./systems/DuelSystem/error-messages.js";
export { PendingDuelManager } from "./systems/DuelSystem/PendingDuelManager.js";
export {
  isPlayerDisconnectPayload,
  isEntityDeathPayload,
  isPlayerDeath,
  type PlayerDisconnectPayload,
  type EntityDeathPayload,
} from "./systems/DuelSystem/validation.js";

/**
 * Per-plugin context for the meta-plugin. Empty today — the
 * meta-plugin's lifecycle hooks don't need any handles, since the
 * constituent plugins (loaded by the host via the dependency graph)
 * own their own context shapes. Extends `PluginContextBase` to keep
 * the lifecycle-typing contract consistent.
 */
export interface HyperscapeContext extends PluginContextBase {
  /**
   * The host's world instance. Required so the plugin's `onEnable`
   * can `world.register(...)` the gameplay systems migrated out of
   * `@hyperforge/shared` (first cut: MobDeathSystem). Hosts that
   * don't have a world (e.g. some unit tests) can pass a stub.
   */
  readonly world: World;
  /**
   * Content pack ids the host project has installed. The plugin's
   * `onEnable` checks for `@hyperforge/content-pack-hyperia-v1` to
   * decide whether to register Hyperia-specific CONTENT-emitting
   * systems (towns, POIs, NPC populations, quests, banks, station
   * spawns) and load the Hyperia world-areas manifests.
   *
   * SYSTEMS that implement gameplay MECHANICS (combat, skills,
   * prayer, equipment, inventory, gathering, processing, etc.)
   * register unconditionally — they're game logic, not content.
   *
   * Empty / undefined = no Hyperia content. The plugin still
   * provides combat / skills / banking-mechanics for any project
   * that installs it, but doesn't auto-spawn Hyperia towns or
   * populate the world with banker NPCs unless the Hyperia
   * content pack is also installed.
   */
  readonly projectContentPackIds?: ReadonlyArray<string>;
}

/** Manifest id of the Hyperia content pack. */
export const HYPERIA_CONTENT_PACK_ID =
  "@hyperforge/content-pack-hyperia-v1" as const;

/**
 * Default plugin factory. Today this is intentionally a no-op
 * lifecycle:
 *   - The constituent plugins (combat for now) are declared as
 *     `dependencies` in plugin.json. The host's load-order resolver
 *     loads them BEFORE this meta-plugin and runs THEIR lifecycle
 *     hooks against THEIR contexts.
 *   - The meta-plugin's onEnable does NOT re-register the
 *     constituent contributions — that would double-register and
 *     conflict with the host's normal lifecycle. The meta-plugin
 *     exists primarily to bundle the dependency graph + provide a
 *     single import surface for callers.
 *
 * Future cuts may add cross-plugin orchestration (e.g. a quest
 * system that references combat abilities + gathering resources +
 * dialogue trees in one bound expression).
 */
const defaultFactory: PluginFactory<HyperscapeContext> = () => {
  const plugin: HyperforgePlugin<HyperscapeContext> = {
    onLoad(_ctx) {
      // No-op. Composition is via dependency graph, not lifecycle.
    },
    onEnable(ctx) {
      // Register migrated gameplay systems on the host world. Each
      // `world.register(name, Ctor)` is mirrored by a scope disposer
      // so `session.stop()` cleanly tears the registration down.
      //
      // The end-state has EVERY Hyperscape-specific system registered
      // through this hook — `@hyperforge/shared` then contains zero
      // Hyperscape-specific identifiers (master plan criterion #2).
      const w = ctx.world as { unregister?: (name: string) => void };
      const register = (name: string, Ctor: unknown) => {
        ctx.world.register(name, Ctor as never);
        ctx.scope.register(() => w.unregister?.(name));
      };

      // Strict-catalog gate: emit Hyperia CONTENT (towns, POIs,
      // NPC populations, station/item/mob spawns from the Hyperia
      // world-areas manifest, hardcoded starter banks, the
      // built-in quest catalog) only when the host project has
      // installed `@hyperforge/content-pack-hyperia-v1`. The
      // SYSTEMS that implement gameplay MECHANICS register
      // unconditionally below — combat, skills, prayer,
      // equipment, inventory, gathering, processing, etc. — so a
      // project that picks the hyperscape plugin for combat-only
      // (e.g. an arctic survival game with melee mechanics) gets
      // those mechanics without the Hyperia world content
      // baking in.
      const hasHyperiaContent =
        ctx.projectContentPackIds?.includes(HYPERIA_CONTENT_PACK_ID) ?? false;
      const registerHyperiaContent = (name: string, Ctor: unknown) => {
        if (hasHyperiaContent) register(name, Ctor);
      };
      if (!hasHyperiaContent) {
        // eslint-disable-next-line no-console
        console.info(
          "[hyperscape-plugin] Hyperia content pack not installed — registering MECHANICS only (no town/POI/NPC/quest content emission).",
        );
      }

      // Plugin-contributed HUD widgets — Phase D6.c.1 / Session 4.
      // `ctx.widgets` is host-supplied: the live browser client
      // (via `bootClientPlugins`) provides a real registry; the
      // dedicated server, tests, and asset-forge dedicated-server
      // contexts pass `undefined` and the widget registration is a
      // silent no-op. Disposers attached to `ctx.scope` so
      // `session.stop()` removes the widget from the host registry.
      if (ctx.widgets) {
        ctx.widgets.register(xpOrbRegistration);
        ctx.widgets.register(levelUpToastRegistration);
        ctx.widgets.register(kickedOverlayRegistration);
        ctx.widgets.register(disconnectedOverlayRegistration);
        ctx.widgets.register(deathScreenRegistration);
        ctx.widgets.register(connectionIndicatorRegistration);
        ctx.widgets.register(minimapStaminaOrbRegistration);
        ctx.widgets.register(minimapCompassRegistration);
        ctx.widgets.register(actionProgressBarRegistration);
        ctx.widgets.register(homeTeleportButtonRegistration);
        ctx.widgets.register(minimapHomeTeleportOrbRegistration);
        ctx.widgets.register(skillSelectModalRegistration);
        ctx.widgets.register(floatingXPDropsRegistration);
        ctx.widgets.register(unlocksSectionRegistration);
        ctx.widgets.register(coinPouchRegistration);
        ctx.widgets.register(selectOptionRegistration);
        ctx.widgets.register(confirmDialogRegistration);
        ctx.widgets.register(quantityPromptRegistration);
        ctx.widgets.register(incomingRequestModalRegistration);
        ctx.widgets.register(equipmentSlotIconRegistration);
        ctx.widgets.register(dialoguePanelRegistration);
        ctx.widgets.register(arrayInputRegistration);
        ctx.widgets.register(curvePreviewRegistration);
        ctx.widgets.register(contextMenuRegistration);
        ctx.widgets.register(keyValueListRegistration);
        ctx.widgets.register(cursorTooltipRegistration);
        ctx.widgets.register(notificationToastListRegistration);
        ctx.widgets.register(buffBarRegistration);
        ctx.widgets.register(victoryOverlayRegistration);
        ctx.widgets.register(alignmentGuidesRegistration);
        ctx.widgets.register(dragGhostOverlayRegistration);
        ctx.widgets.register(progressBarRegistration);
        ctx.widgets.register(loadingSpinnerRegistration);
        ctx.widgets.register(toggleSwitchRegistration);
        ctx.widgets.register(rangeSliderRegistration);
        ctx.widgets.register(badgeRegistration);
        ctx.widgets.register(segmentedControlRegistration);
        ctx.widgets.register(textInputRegistration);
        ctx.widgets.register(avatarRegistration);
        ctx.widgets.register(emptyStateRegistration);
        ctx.widgets.register(chipListRegistration);
        ctx.widgets.register(sectionHeaderRegistration);
        ctx.widgets.register(countdownDisplayRegistration);
        ctx.widgets.register(breadcrumbsRegistration);
        ctx.widgets.register(checkboxRegistration);
        ctx.widgets.register(keyboardShortcutHintRegistration);
        ctx.widgets.register(paginationRegistration);
        ctx.widgets.register(iconButtonRegistration);
        ctx.widgets.register(dividerRegistration);
        ctx.widgets.register(skeletonRegistration);
        ctx.widgets.register(stepIndicatorRegistration);
        ctx.widgets.register(codeBlockRegistration);
      }

      // Register Hyperia entity types with the engine ECS. Pre-2026-04-26
      // the registry hardcoded these in shared `Entities.ts` —
      // decoupled so the engine no longer imports game classes.
      // Order doesn't matter; lookup is by string key.
      registerEntityType("player", PlayerEntity as never);
      registerEntityType("playerLocal", PlayerLocal as never);
      registerEntityType("playerRemote", PlayerRemote as never);
      registerEntityType("item", ItemEntity as never);
      registerEntityType("mob", MobEntity as never);
      registerEntityType("npc", NPCEntity as never);
      registerEntityType("resource", ResourceEntity as never);
      registerEntityType("headstone", HeadstoneEntity as never);
      registerEntityType("bank", BankEntity as never);
      registerEntityType("furnace", FurnaceEntity as never);
      registerEntityType("anvil", AnvilEntity as never);
      registerEntityType("altar", AltarEntity as never);
      registerEntityType("range", RangeEntity as never);
      registerEntityType(
        "runecrafting_altar",
        RunecraftingAltarEntity as never,
      );

      // Cross-cutting systems that run on both server + client.
      register("mob-death", MobDeathSystem);
      register("gravestone-loot", GravestoneLootSystem);

      // Coin pouch — OSRS-style separate-from-inventory currency.
      // Lazy-looked-up by InventorySystem (in shared) at
      // PLAYER_REGISTERED time, so plugin onEnable's later
      // registration order is fine.
      register("coin-pouch", CoinPouchSystem);

      // Prayer — OSRS prayer points / drain / bonus calculations.
      // CombatSystem (in shared) duck-types the surface it needs
      // and looks up via getSystem at runtime. Self-gates internally
      // on world.isServer for server-only branches.
      register("prayer", PrayerSystem);

      // Banking — one bank per starter town, unlimited slots,
      // drag-to-store interface. No in-shared callers reference the
      // class type; SystemMap downgraded to `unknown`.
      // Hyperia-content-gated: BankingSystem.init() seeds 5 hardcoded
      // STARTER_TOWN_BANKS at fixed Hyperia-world coords. For projects
      // without the Hyperia content pack the banking UI mechanics
      // aren't useful in isolation (no banks exist), so the
      // registration moves under the gate.
      registerHyperiaContent("banking", BankingSystem);

      // Stores — OSRS general stores. Per-player open/close session
      // handler; reads catalog from `storesRegistry` + `GENERAL_STORES`.
      register("store", StoreSystem);

      // NPC dialogue — tree processor + authored-dialogue runner.
      // PIE + WorldDialogueConditionEvaluators (in shared) duck-type
      // the surface they need.
      register("dialogue", DialogueSystem);

      // Quests — manifest-driven quest tracking with kill objectives,
      // stage progression, item rewards. PIE + dialogue + drop-condition
      // evaluators + the server quest handler all duck-type the surface
      // they need from this system.
      // Hyperia-content-gated: the quest catalog (`quests.json`) ships
      // with the Hyperia content pack. Without it, QuestSystem would
      // register but track zero quests.
      registerHyperiaContent("quest", QuestSystem);

      // Aggro — mob aggression detection + chase + tile-based 21x21
      // region spatial index. Only MobEntity touches it directly (via
      // a duck-typed `getPlayersInNearbyRegions` call).
      register("aggro", AggroSystem);

      // Processing — firemaking + cooking interaction handler.
      // Per-skill processing systems already registered above.
      register("processing", ProcessingSystem);

      // Mob NPC core — owns mob lifecycle (spawn, despawn, leash,
      // respawn timer). Migrated 2026-04-25 (Wave 3a). Must register
      // before "mob-npc-spawner" so the spawner's lookup hits.
      register("mob-npc", MobNPCSystem);

      // NPC interactions — banker + shopkeeper handlers. Server-only
      // logically (it answers PLAYER_INTERACT events) but registered
      // cross-cutting so client-side `getSystem("npc")` lookups don't
      // null-out in the legacy code paths still expecting it.
      register("npc", NPCSystem);

      // Station spawner — places banks/furnaces/anvils/altars/ranges
      // from world-areas.json + stations.json. Static spawn at boot.
      // Hyperia-content-gated: data source is the Hyperia world-areas
      // manifest.
      registerHyperiaContent("station-spawner", StationSpawnerSystem);

      // Mob spawner — reads world-areas.json + npcs.json, spawns
      // MobEntity instances via EntityManager + handles respawn after
      // death.
      // Hyperia-content-gated: data sources are the Hyperia
      // world-areas + npcs manifests.
      registerHyperiaContent("mob-npc-spawner", MobNPCSpawnerSystem);

      // Item spawner — places ground items from world-areas.json.
      // Same EntityManager-driven pattern as mob spawner.
      // Hyperia-content-gated: data source is the Hyperia world-areas
      // manifest.
      registerHyperiaContent("item-spawner", ItemSpawnerSystem);

      // Ground items — tile-based pile manager for dropped items.
      // Migrated 2026-04-25 (Wave 1 follow-up). LootSystem +
      // PlayerDeathSystem + InventorySystem all reach this via
      // `world.getSystem("ground-items")` so it must register before
      // `loot`.
      register("ground-items", GroundItemSystem);

      // Zone detection — single source of truth for safe / pvp /
      // wilderness lookups. Migrated 2026-04-25. CombatSystem
      // (still in shared) looks it up via
      // `world.getSystem("zone-detection")`, so it must register
      // before SystemLoader runs.
      register("zone-detection", ZoneDetectionSystem);

      // Player — central player lifecycle, stats, health, attack
      // styles, persistence. Migrated 2026-04-26 (Wave 5d) with
      // EatDelayManager + BuryDelayManager helpers. Many plugin and
      // shared systems look this up via `world.getSystem("player")`,
      // so it registers FIRST in the cluster.
      register("player", PlayerSystem);

      // Inventory — slot-based item storage with stack management
      // + DB persistence. Migrated 2026-04-26 (Wave 5c). Many
      // plugin systems (PlayerDeathSystem, EquipmentSystem,
      // QuestSystem, LootSystem, …) depend on it, so it registers
      // before player-death.
      register("inventory", InventorySystem);

      // Combat — full melee/ranged/magic engine + handlers + state
      // services + anti-cheat. Migrated 2026-04-26 (Wave 6) — last
      // big migration. ~9000 LOC across 25 files
      // (CombatSystem, AmmunitionService, RuneService, SpellService,
      // CombatAnimationManager, CombatAntiCheat, CombatStateService,
      // PidManager, etc.).
      register("combat", CombatSystem);

      // Player death — handles inventory drop, gravestone spawn,
      // respawn timer. Migrated 2026-04-26 with its 3 internal
      // helpers (DeathStateManager, SafeAreaDeathHandler,
      // WildernessDeathHandler). Depends on zone-detection +
      // ground-items + inventory so registers after them.
      register("player-death", PlayerDeathSystem);

      // Skills — XP table + skill data + combat-level calculation.
      // Migrated 2026-04-26 (Wave 5a). CombatSystem +
      // WorldDropConditionEvaluators + WorldDialogueConditionEvaluators
      // (still in shared) all duck-type-lookup `world.getSystem("skills")`.
      register("skills", SkillsSystem);

      // Equipment — slot-based wear / unequip + stat bonus
      // computation + DB persistence. Migrated 2026-04-26 (Wave 5b).
      // CombatSystem + AttackContext (still in shared) duck-type
      // lookup `world.getSystem("equipment")`. Depends on
      // InventorySystem (still in shared).
      register("equipment", EquipmentSystem);

      // Loot system — drops mob loot to the ground via
      // GroundItemSystem on `NPC_DIED`. Boot-time DropCondition
      // dispatcher install + authored manifest seeding lives below
      // in the server-only `if (ctx.world.isServer)` branch.
      register("loot", LootSystem);

      // Resource system — gathering nodes (trees, rocks, fishing
      // spots). Wave 1 of the heavy-cluster migration; the
      // gathering/ subdirectory co-migrated.
      register("resource", ResourceSystem);

      // Town system — procedural town generation, building layout,
      // safe-zone resolution, and building collision. Wave 2 of
      // the heavy-cluster migration. Cross-cutting: TerrainSystem,
      // GrassExclusionGrid, ZoneDetectionSystem, and mob tile
      // movement all duck-type-lookup `world.getSystem("towns")`.
      // Hyperia-content-gated: TownSystem.start() generates Hyperia
      // towns via `loadManifestTowns()` + `generateTowns()` — both
      // emit Hyperia-shaped buildings that don't belong in non-Hyperia
      // themed projects. The duck-type lookups in TerrainSystem etc.
      // soft-fall-through when the system isn't registered (no
      // safe-zones / no grass-exclusion blocks; that's correct for a
      // non-Hyperia world).
      registerHyperiaContent("towns", TownSystem);

      // Bridges — collision + procedural deck/fence geometry.
      // Both client and server register it: server computes
      // walkable bridge tiles + WATER overrides; client adds the
      // procedural mesh.
      register("bridges", BridgeSystem);

      // Docks — same shape as bridges (collision + procedural
      // deck/fence). Server computes walkable dock tiles +
      // WATER overrides; client adds the procedural mesh.
      register("docks", ProceduralDocks);

      // POIs — procedural points-of-interest (dungeons, shrines,
      // landmarks). Read by RoadNetworkSystem (still in shared)
      // via duck-typed `getConfig()` lookup.
      // Hyperia-content-gated: POISystem.start() generates ~100+
      // Hyperia POIs from a hardcoded category catalog (8 dungeons /
      // 12 shrines / 15 landmarks / etc.). Themed projects bring
      // their own POIs through PROPOSE_POI plan slots.
      registerHyperiaContent("pois", POISystem);

      // Scripting — visual scripting runtime. Subscribes to
      // trigger events, auto-loads entity behaviorGraphs on spawn,
      // processes delayed continuations. Interpreter engine +
      // sibling helpers stay in shared so PIEScriptRunner can
      // consume them directly at PIE-bundle time.
      register("scripting", ScriptingSystem);

      // Duel arena visuals — procedural arena geometry + PhysX wall
      // collision. System self-gates mesh logic on `world.isClient`;
      // server-side stays headless. Original env-gating on
      // DUEL_ARENA_VISUALS_ENABLED preserved (SystemLoader → here,
      // 2026-04-26).
      if (process.env.DUEL_ARENA_VISUALS_ENABLED !== "false") {
        try {
          register("duel-arena-visuals", DuelArenaVisualsSystem);
        } catch (err) {
          console.error(
            "[hyperscape-plugin] Failed to register DuelArenaVisualsSystem:",
            err,
          );
        }
      }

      // Tile-based skill processing systems — all self-gate their
      // init() on world.isServer. Safe to register on both sides.
      register("tanning", TanningSystem);
      register("smithing", SmithingSystem);
      register("smelting", SmeltingSystem);
      register("crafting", CraftingSystem);
      register("fletching", FletchingSystem);
      register("runecrafting", RunecraftingSystem);

      // Server-only systems — original SystemLoader gated registration
      // itself on `isServerEnvironment`. Preserve that behavior so
      // client builds don't pay the registration cost.
      if (ctx.world.isServer) {
        // Phase B0'.E — load Hyperia's authored manifest files
        // (world-areas.json, etc.) directly from the plugin's
        // onEnable so a project that doesn't install
        // `@hyperforge/hyperscape` doesn't end up with Hyperia
        // content populated in `worldAreasRegistry`.
        //
        // Strict-catalog gate: only load when the project has the
        // Hyperia content pack installed. Without the pack the
        // manifests would still load into `worldAreasRegistry`,
        // surfacing Hyperia NPCs/mobs/stations to the agent's
        // `LIST_*` actions and through to spawners — exactly the
        // leak we're closing. With the gate, a non-Hyperia themed
        // project sees an empty `worldAreasRegistry` and the
        // spawner systems have nothing to spawn (and aren't
        // registered above either).
        if (hasHyperiaContent) {
          loadHyperiaManifestsSync();
        }

        register("health-regen", HealthRegenSystem);

        // TileMovementManager — migrated to plugin (Phase E1,
        // 2026-04-26). MUST construct first in this server-only
        // branch because Pending-/Follow-managers' constructors
        // (Phase D) throw if `world.tileMovement` isn't set. The
        // broadcast callback closes over `world.broadcast` /
        // `world.spatialIndex` / `world.regionSubscriptions` —
        // all pinned by ServerNetwork's constructor (Phase B) at
        // register-time, before either host's onEnable phase. The
        // anti-cheat kick callback uses `world.broadcast.getPlayerSocket`
        // (Phase A2 substrate) instead of iterating ServerNetwork's
        // private `sockets` map.
        const tmmBroadcast = (
          ctx.world as {
            broadcast?: {
              sendToNearby(
                name: string,
                data: unknown,
                worldX: number,
                worldZ: number,
                ignoreSocketId?: string,
              ): void;
              sendToAll(
                name: string,
                data: unknown,
                ignoreSocketId?: string,
              ): void;
              getPlayerSocket(playerId: string):
                | {
                    id: string;
                    ws?: {
                      send?: (data: unknown) => void;
                      close?: (code: number, reason: string) => void;
                    };
                  }
                | undefined;
            };
          }
        ).broadcast;
        const tmmSpatial = (
          ctx.world as {
            spatialIndex?: {
              updatePlayerPosition(
                playerId: string,
                worldX: number,
                worldZ: number,
              ): { oldKey: number; newKey: number } | null;
            };
          }
        ).spatialIndex;
        const tmmRegionSubscriptions = (
          ctx.world as {
            regionSubscriptions?: {
              updatePlayerRegionSubscriptions(
                playerId: string,
                oldKey: number,
                newKey: number,
              ): void;
            };
          }
        ).regionSubscriptions;
        const tileMovementManager = new TileMovementManager(
          ctx.world,
          (name: string, data: unknown, ignoreSocketId?: string) => {
            const payload = data as { id?: string };
            const entity = payload?.id
              ? (ctx.world.entities?.get(payload.id) as {
                  position?: { x: number; y: number; z: number };
                } | null)
              : null;
            if (entity?.position) {
              if (payload.id && tmmSpatial && tmmRegionSubscriptions) {
                const moveRegionChange = tmmSpatial.updatePlayerPosition(
                  payload.id,
                  entity.position.x,
                  entity.position.z,
                );
                if (moveRegionChange) {
                  tmmRegionSubscriptions.updatePlayerRegionSubscriptions(
                    payload.id,
                    moveRegionChange.oldKey,
                    moveRegionChange.newKey,
                  );
                }
              }
              tmmBroadcast?.sendToNearby(
                name,
                data,
                entity.position.x,
                entity.position.z,
                ignoreSocketId,
              );
            } else {
              tmmBroadcast?.sendToAll(name, data, ignoreSocketId);
            }
          },
        );
        tileMovementManager.setAntiCheatKickCallback(
          (playerId: string, reason: string) => {
            const socket = tmmBroadcast?.getPlayerSocket(playerId);
            if (!socket) return;
            const kickPacket = writePacket("kick", reason);
            socket.ws?.send?.(kickPacket);
            socket.ws?.close?.(4002, "Anti-cheat kick");
          },
        );
        (ctx.world as { tileMovement?: TileMovementManager }).tileMovement =
          tileMovementManager;
        ctx.scope.register(() => {
          delete (ctx.world as { tileMovement?: TileMovementManager })
            .tileMovement;
        });

        // MobTileMovementManager — Phase E2 (2026-04-26). Same
        // broadcast-callback pattern as TMM but simpler (no
        // region-subscription updates — mobs don't get their own
        // pubsub topic). Pinned to `world.mobTileMovement`.
        const mobTileMovementManager = new MobTileMovementManager(
          ctx.world,
          (name: string, data: unknown, ignoreSocketId?: string) => {
            const payload = data as { id?: string };
            const entity = payload?.id
              ? (ctx.world.entities?.get(payload.id) as {
                  position?: { x: number; y: number; z: number };
                } | null)
              : null;
            if (entity?.position) {
              tmmBroadcast?.sendToNearby(
                name,
                data,
                entity.position.x,
                entity.position.z,
                ignoreSocketId,
              );
            } else {
              tmmBroadcast?.sendToAll(name, data, ignoreSocketId);
            }
          },
        );
        (
          ctx.world as { mobTileMovement?: MobTileMovementManager }
        ).mobTileMovement = mobTileMovementManager;
        ctx.scope.register(() => {
          delete (ctx.world as { mobTileMovement?: MobTileMovementManager })
            .mobTileMovement;
        });

        // Network packet handlers — Phase F3 (2026-04-26). Register
        // each migrated handler family via the substrate
        // `world.connectionRegistry` (Phase F2 pinning). The
        // dispatcher in ServerNetwork.onMessage prefers registry
        // handlers over its legacy static dict.
        const connectionRegistry = (
          ctx.world as {
            connectionRegistry?: import("@hyperforge/shared").IConnectionRegistry;
          }
        ).connectionRegistry;
        if (connectionRegistry) {
          const sendToAll = (name: string, payload: unknown, ignore?: string) =>
            tmmBroadcast?.sendToAll(name, payload, ignore);

          // Chat — F3 first cut.
          connectionRegistry.register("onChatAdded", (socket, data) => {
            handleChatAdded(socket, data, ctx.world, sendToAll);
          });
          ctx.scope.register(() =>
            connectionRegistry.unregister("onChatAdded"),
          );

          // Entity lifecycle — F3 batch-1.
          connectionRegistry.register("onEntityEvent", (socket, data) => {
            handleEntityEvent(socket, data, ctx.world);
          });
          ctx.scope.register(() =>
            connectionRegistry.unregister("onEntityEvent"),
          );
          connectionRegistry.register("onEntityRemoved", (socket, data) => {
            handleEntityRemoved(socket, data, ctx.world);
          });
          ctx.scope.register(() =>
            connectionRegistry.unregister("onEntityRemoved"),
          );
          connectionRegistry.register("onEntityModified", (socket, data) => {
            handleEntityModified(socket, data, ctx.world, sendToAll);
          });
          ctx.scope.register(() =>
            connectionRegistry.unregister("onEntityModified"),
          );
          connectionRegistry.register("onSettingsModified", (socket, data) => {
            handleSettings(socket, data, ctx.world, sendToAll);
          });
          ctx.scope.register(() =>
            connectionRegistry.unregister("onSettingsModified"),
          );

          // Resources — F3 batch-1.
          connectionRegistry.register("onResourceGather", (socket, data) => {
            handleResourceGather(socket, data, ctx.world);
          });
          ctx.scope.register(() =>
            connectionRegistry.unregister("onResourceGather"),
          );

          // Dialogue — F3 batch-1.
          connectionRegistry.register("onDialogueResponse", (socket, data) => {
            handleDialogueResponse(
              socket,
              data as Parameters<typeof handleDialogueResponse>[1],
              ctx.world,
            );
          });
          ctx.scope.register(() =>
            connectionRegistry.unregister("onDialogueResponse"),
          );
          connectionRegistry.register("onDialogueContinue", (socket, data) => {
            handleDialogueContinue(
              socket,
              data as Parameters<typeof handleDialogueContinue>[1],
              ctx.world,
            );
          });
          ctx.scope.register(() =>
            connectionRegistry.unregister("onDialogueContinue"),
          );
          connectionRegistry.register("onDialogueClose", (socket, data) => {
            handleDialogueClose(
              socket,
              data as Parameters<typeof handleDialogueClose>[1],
              ctx.world,
            );
          });
          ctx.scope.register(() =>
            connectionRegistry.unregister("onDialogueClose"),
          );

          // Magic: autocast — F3 batch-1. Server registers under
          // both "onSetAutocast" and "setAutocast" (alias).
          const setAutocast = (
            socket: Parameters<typeof handleSetAutocast>[0],
            data: unknown,
          ) => handleSetAutocast(socket, data, ctx.world);
          connectionRegistry.register("onSetAutocast", setAutocast);
          ctx.scope.register(() =>
            connectionRegistry.unregister("onSetAutocast"),
          );
          connectionRegistry.register("setAutocast", setAutocast);
          ctx.scope.register(() =>
            connectionRegistry.unregister("setAutocast"),
          );

          // Player follow + name change — F3 batch-2.
          // The follow handler ports inline the pre-handler logic from
          // ServerNetwork (cancel pending attack, look up follow manager).
          connectionRegistry.register("onFollowPlayer", (socket, data) => {
            const playerEntity = socket.player;
            if (!playerEntity) return;

            const pendingAttackManager = (
              ctx.world as {
                pendingAttackManager?: PendingAttackManager;
              }
            ).pendingAttackManager;
            pendingAttackManager?.cancelPendingAttack(playerEntity.id);

            const fm = (ctx.world as { followManager?: FollowManager })
              .followManager;
            if (fm) {
              handleFollowPlayer(socket, data, ctx.world, fm);
            }
          });
          ctx.scope.register(() =>
            connectionRegistry.unregister("onFollowPlayer"),
          );

          const changePlayerName = (
            socket: Parameters<typeof handleChangePlayerName>[0],
            data: unknown,
          ) => handleChangePlayerName(socket, data, ctx.world, sendToAll);
          connectionRegistry.register("changePlayerName", changePlayerName);
          ctx.scope.register(() =>
            connectionRegistry.unregister("changePlayerName"),
          );

          // Prayer — F3 batch-2. Each has `onX` primary + legacy `x` alias.
          const prayerToggle = (
            socket: Parameters<typeof handlePrayerToggle>[0],
            data: unknown,
          ) => handlePrayerToggle(socket, data, ctx.world);
          connectionRegistry.register("onPrayerToggle", prayerToggle);
          ctx.scope.register(() =>
            connectionRegistry.unregister("onPrayerToggle"),
          );
          connectionRegistry.register("prayerToggle", prayerToggle);
          ctx.scope.register(() =>
            connectionRegistry.unregister("prayerToggle"),
          );

          const prayerDeactivateAll = (
            socket: Parameters<typeof handlePrayerDeactivateAll>[0],
            data: unknown,
          ) => handlePrayerDeactivateAll(socket, data, ctx.world);
          connectionRegistry.register(
            "onPrayerDeactivateAll",
            prayerDeactivateAll,
          );
          ctx.scope.register(() =>
            connectionRegistry.unregister("onPrayerDeactivateAll"),
          );
          connectionRegistry.register(
            "prayerDeactivateAll",
            prayerDeactivateAll,
          );
          ctx.scope.register(() =>
            connectionRegistry.unregister("prayerDeactivateAll"),
          );

          const altarPray = (
            socket: Parameters<typeof handleAltarPray>[0],
            data: unknown,
          ) => handleAltarPray(socket, data, ctx.world);
          connectionRegistry.register("onAltarPray", altarPray);
          ctx.scope.register(() =>
            connectionRegistry.unregister("onAltarPray"),
          );
          connectionRegistry.register("altarPray", altarPray);
          ctx.scope.register(() => connectionRegistry.unregister("altarPray"));

          // Quest — F3 batch-2.
          const getQuestList = (
            socket: Parameters<typeof handleGetQuestList>[0],
            data: unknown,
          ) =>
            handleGetQuestList(
              socket,
              data as Record<string, unknown>,
              ctx.world,
            );
          connectionRegistry.register("onGetQuestList", getQuestList);
          ctx.scope.register(() =>
            connectionRegistry.unregister("onGetQuestList"),
          );
          connectionRegistry.register("getQuestList", getQuestList);
          ctx.scope.register(() =>
            connectionRegistry.unregister("getQuestList"),
          );

          const getQuestDetail = (
            socket: Parameters<typeof handleGetQuestDetail>[0],
            data: unknown,
          ) =>
            handleGetQuestDetail(
              socket,
              data as { questId: string },
              ctx.world,
            );
          connectionRegistry.register("onGetQuestDetail", getQuestDetail);
          ctx.scope.register(() =>
            connectionRegistry.unregister("onGetQuestDetail"),
          );
          connectionRegistry.register("getQuestDetail", getQuestDetail);
          ctx.scope.register(() =>
            connectionRegistry.unregister("getQuestDetail"),
          );

          const questAccept = (
            socket: Parameters<typeof handleQuestAccept>[0],
            data: unknown,
          ) => {
            void handleQuestAccept(
              socket,
              data as { questId: string },
              ctx.world,
            );
          };
          connectionRegistry.register("onQuestAccept", questAccept);
          ctx.scope.register(() =>
            connectionRegistry.unregister("onQuestAccept"),
          );
          connectionRegistry.register("questAccept", questAccept);
          ctx.scope.register(() =>
            connectionRegistry.unregister("questAccept"),
          );

          const questAbandon = (
            socket: Parameters<typeof handleQuestAbandon>[0],
            data: unknown,
          ) => {
            void handleQuestAbandon(
              socket,
              data as { questId: string },
              ctx.world,
            );
          };
          connectionRegistry.register("onQuestAbandon", questAbandon);
          ctx.scope.register(() =>
            connectionRegistry.unregister("onQuestAbandon"),
          );
          connectionRegistry.register("questAbandon", questAbandon);
          ctx.scope.register(() =>
            connectionRegistry.unregister("questAbandon"),
          );

          const questComplete = (
            socket: Parameters<typeof handleQuestComplete>[0],
            data: unknown,
          ) => {
            void handleQuestComplete(
              socket,
              data as { questId: string },
              ctx.world,
            );
          };
          connectionRegistry.register("onQuestComplete", questComplete);
          ctx.scope.register(() =>
            connectionRegistry.unregister("onQuestComplete"),
          );
          connectionRegistry.register("questComplete", questComplete);
          ctx.scope.register(() =>
            connectionRegistry.unregister("questComplete"),
          );

          // Home teleport — F3 batch-7. The handlers read the manager
          // from `world.homeTeleportManager`, which is pinned by
          // ServerNetwork.start() once it has constructed it via the
          // factory installed below. Current tick is read from
          // `world.currentTick` (engine-updated each tick at INPUT
          // priority).
          const homeTeleport = (
            socket: Parameters<typeof handleHomeTeleport>[0],
            data: unknown,
          ) =>
            handleHomeTeleport(socket, data, ctx.world, ctx.world.currentTick);
          connectionRegistry.register("onHomeTeleport", homeTeleport);
          ctx.scope.register(() =>
            connectionRegistry.unregister("onHomeTeleport"),
          );
          connectionRegistry.register("homeTeleport", homeTeleport);
          ctx.scope.register(() =>
            connectionRegistry.unregister("homeTeleport"),
          );

          const homeTeleportCancel = (
            socket: Parameters<typeof handleHomeTeleportCancel>[0],
            data: unknown,
          ) => handleHomeTeleportCancel(socket, data, ctx.world);
          connectionRegistry.register(
            "onHomeTeleportCancel",
            homeTeleportCancel,
          );
          ctx.scope.register(() =>
            connectionRegistry.unregister("onHomeTeleportCancel"),
          );
          connectionRegistry.register("homeTeleportCancel", homeTeleportCancel);
          ctx.scope.register(() =>
            connectionRegistry.unregister("homeTeleportCancel"),
          );
        }

        // Wire pluggable DropCondition evaluator + boot-time
        // authored loot-tables / mob→table mappings seed.
        // Originally lived in shared SystemLoader.init(); migrated
        // here 2026-04-26 alongside DropConditionDispatcher /
        // WorldDropConditionEvaluators / LootTableService /
        // LootPermissionService.
        const lootSystem = ctx.world.getSystem("loot") as unknown as {
          setDropConditionEvaluator(evaluator: unknown): void;
          setAuthoredLootTables(manifest: unknown): void;
          setMobLootTableMappings(
            mappings: ReadonlyMap<string, string> | Record<string, string>,
          ): void;
        } | null;
        if (lootSystem) {
          const dispatcher = createDropConditionDispatcher();
          installWorldDropConditions(dispatcher, ctx.world);
          lootSystem.setDropConditionEvaluator(dispatcher.evaluate);

          if (lootTablesProvider.isLoaded()) {
            lootSystem.setAuthoredLootTables(lootTablesProvider.getManifest());
          }
          if (mobLootTableMappingsProvider.isLoaded()) {
            lootSystem.setMobLootTableMappings(
              mobLootTableMappingsProvider.getMappings(),
            );
          }
        }

        // Trading system — instantiation + init + destroy lifecycle
        // owned by the plugin (migrated from `ServerNetwork.start()` /
        // `.destroy()` 2026-04-26). The instance is pinned to
        // `world.tradingSystem` so the existing
        // `getTradingSystem(world)` lookup helper used by trade
        // network handlers resolves unchanged.
        const tradingSystem = new TradingSystem(ctx.world);
        tradingSystem.init();
        (ctx.world as { tradingSystem?: TradingSystem }).tradingSystem =
          tradingSystem;
        ctx.scope.register(() => {
          tradingSystem.destroy();
          delete (ctx.world as { tradingSystem?: TradingSystem }).tradingSystem;
        });

        // PendingTradeManager — server-authoritative
        // "walk to player and trade" state machine. Migrated to plugin
        // 2026-04-26 (PLAN_ENGINE_API_EXTRACTION.md Phase D1) once
        // the substrate ITileMovementService was pinned to
        // `world.tileMovement` from ServerNetwork's constructor
        // (Phase B4). Constructor reads `world.tileMovement` directly
        // — by the time onEnable runs, it's populated in both server
        // and PIE boot orders. ServerNetwork resolves
        // `world.pendingTradeManager` lazily in its tick callback +
        // disconnect handler.
        const pendingTradeManager = new PendingTradeManager(ctx.world);
        (
          ctx.world as { pendingTradeManager?: PendingTradeManager }
        ).pendingTradeManager = pendingTradeManager;
        ctx.scope.register(() => {
          delete (ctx.world as { pendingTradeManager?: PendingTradeManager })
            .pendingTradeManager;
        });

        // PendingDuelChallengeManager — same pattern as
        // PendingTradeManager (Phase D2, 2026-04-26).
        const pendingDuelChallengeManager = new PendingDuelChallengeManager(
          ctx.world,
        );
        (
          ctx.world as {
            pendingDuelChallengeManager?: PendingDuelChallengeManager;
          }
        ).pendingDuelChallengeManager = pendingDuelChallengeManager;
        ctx.scope.register(() => {
          delete (
            ctx.world as {
              pendingDuelChallengeManager?: PendingDuelChallengeManager;
            }
          ).pendingDuelChallengeManager;
        });

        // PendingAttackManager — server-authoritative
        // "walk to mob/player and attack" state machine. Phase D3
        // (2026-04-26). Constructor takes 2 closures
        // (`getMobPosition`, `isMobAlive`) that close over
        // `world.entities` only — no ServerNetwork-internal state —
        // so they move to plugin onEnable cleanly.
        const pendingAttackManager = new PendingAttackManager(
          ctx.world,
          (mobId: string) => {
            const mobEntity = ctx.world.entities.get(mobId) as {
              position?: { x: number; y: number; z: number };
              getPosition?: () => { x: number; y: number; z: number };
              data?: { position?: unknown };
            } | null;
            if (!mobEntity) return null;
            const p = mobEntity.position;
            if (
              p &&
              typeof p.x === "number" &&
              typeof p.y === "number" &&
              typeof p.z === "number"
            ) {
              return { x: p.x, y: p.y, z: p.z };
            }
            if (typeof mobEntity.getPosition === "function") {
              return mobEntity.getPosition();
            }
            const raw = mobEntity.data?.position;
            if (Array.isArray(raw) && raw.length >= 3) {
              const [x, y, z] = raw as number[];
              if (
                [x, y, z].every(
                  (n) => typeof n === "number" && Number.isFinite(n),
                )
              ) {
                return { x, y, z };
              }
            }
            return null;
          },
          (mobId: string) => {
            const mobEntity = ctx.world.entities.get(mobId) as {
              getHealth?: () => number;
              data?: { health?: number };
              config?: { currentHealth?: number };
            } | null;
            if (!mobEntity) return false;
            if (typeof mobEntity.getHealth === "function") {
              return mobEntity.getHealth() > 0;
            }
            if (typeof mobEntity.data?.health === "number") {
              return mobEntity.data.health > 0;
            }
            if (typeof mobEntity.config?.currentHealth === "number") {
              return mobEntity.config.currentHealth > 0;
            }
            return false;
          },
        );
        (
          ctx.world as { pendingAttackManager?: PendingAttackManager }
        ).pendingAttackManager = pendingAttackManager;
        ctx.scope.register(() => {
          delete (ctx.world as { pendingAttackManager?: PendingAttackManager })
            .pendingAttackManager;
        });

        // PendingCookManager — Phase D4 (2026-04-26). FireRegistry
        // dep is the ProcessingSystem (registered earlier in this
        // same onEnable; resolves via getSystem).
        const processingSystem = ctx.world.getSystem(
          "processing",
        ) as unknown as {
          getActiveFires: () => Map<
            string,
            {
              id: string;
              position: { x: number; y: number; z: number };
              isActive: boolean;
              playerId: string;
              createdAt: number;
              duration: number;
              mesh?: unknown;
            }
          >;
        };
        const pendingCookManager = new PendingCookManager(
          ctx.world,
          processingSystem,
        );
        (
          ctx.world as { pendingCookManager?: PendingCookManager }
        ).pendingCookManager = pendingCookManager;
        ctx.scope.register(() => {
          delete (ctx.world as { pendingCookManager?: PendingCookManager })
            .pendingCookManager;
        });

        // PendingGatherManager — Phase D5 (2026-04-26). The
        // broadcast-callback closes over `world.broadcast` (pinned
        // in ServerNetwork constructor, Phase B2).
        const broadcast = (
          ctx.world as {
            broadcast?: {
              sendToAll(name: string, data: unknown): void;
            };
          }
        ).broadcast;
        const pendingGatherManager = new PendingGatherManager(
          ctx.world,
          (name, data) => broadcast?.sendToAll(name, data),
        );
        (
          ctx.world as { pendingGatherManager?: PendingGatherManager }
        ).pendingGatherManager = pendingGatherManager;
        ctx.scope.register(() => {
          delete (ctx.world as { pendingGatherManager?: PendingGatherManager })
            .pendingGatherManager;
        });

        // FollowManager — Phase D6 (2026-04-26). Vanilla pattern,
        // constructor reads `world.tileMovement` only.
        const followManager = new FollowManager(ctx.world);
        (ctx.world as { followManager?: FollowManager }).followManager =
          followManager;
        ctx.scope.register(() => {
          delete (ctx.world as { followManager?: FollowManager }).followManager;
        });

        // HomeTeleport — Phase F3 batch-7 (2026-04-26). Manager
        // construction is deferred: ServerNetwork.start() calls
        // `world.homeTeleportFactory(spawn, sendFn)` after the spawn
        // point loads, then pins the result to
        // `world.homeTeleportManager`. We just install the factory
        // here.
        const homeTeleportFactory = createHomeTeleportFactory(ctx.world);
        (
          ctx.world as { homeTeleportFactory?: HomeTeleportFactory }
        ).homeTeleportFactory = homeTeleportFactory;
        ctx.scope.register(() => {
          delete (ctx.world as { homeTeleportFactory?: HomeTeleportFactory })
            .homeTeleportFactory;
          delete (ctx.world as { homeTeleportManager?: IHomeTeleportManager })
            .homeTeleportManager;
        });

        // FriendsService — Phase F3 batch-8 (2026-04-26). Engine-side
        // shared code (character-selection.ts, socket-management.ts)
        // calls `world.friendsService?.sendFriendsListSync(...)` and
        // `world.friendsService?.notifyFriendsOfStatusChange(...)` on
        // login/logout/reconnect, so the plugin installs the service
        // here.
        const friendsService: IFriendsService = {
          sendFriendsListSync,
          notifyFriendsOfStatusChange,
        };
        (ctx.world as { friendsService?: IFriendsService }).friendsService =
          friendsService;
        ctx.scope.register(() => {
          delete (ctx.world as { friendsService?: IFriendsService })
            .friendsService;
        });

        // CombatAttackService — Phase F3 batch-9 (2026-04-26). The
        // engine `ServerNetwork.onAttackPlayer` inline block calls
        // `world.combatAttackService?.attackPlayer(socket, data, world)`
        // after its own preprocessing (target lookup, range check,
        // pending-attack queueing). The plugin installs the service
        // here so the in-range PvP/duel branch reaches the validating
        // handler.
        const combatAttackService: ICombatAttackService = {
          attackPlayer: handleAttackPlayerImpl,
          attackMob: handleAttackMobImpl,
        };
        (
          ctx.world as { combatAttackService?: ICombatAttackService }
        ).combatAttackService = combatAttackService;
        ctx.scope.register(() => {
          delete (ctx.world as { combatAttackService?: ICombatAttackService })
            .combatAttackService;
        });

        // PlayerSpawnService — Phase G-1 (2026-04-26). The engine
        // `ServerNetwork.handleEnterWorldWithReconnect` resolves
        // `world.playerSpawnService?.enterWorld(...)` for the normal
        // spawn flow and `collectInitialSyncEntities(...)` on the
        // reconnect path.
        const playerSpawnService: IPlayerSpawnService = {
          enterWorld: handleEnterWorld,
          collectInitialSyncEntities,
        };
        (
          ctx.world as { playerSpawnService?: IPlayerSpawnService }
        ).playerSpawnService = playerSpawnService;
        ctx.scope.register(() => {
          delete (ctx.world as { playerSpawnService?: IPlayerSpawnService })
            .playerSpawnService;
        });

        // FaceDirectionManager — Phase D7 (2026-04-26). Plugin owns
        // construction + setSendFunction wiring. The send-function
        // closes over `world.broadcast` (Phase B2 substrate) +
        // `world.entities`.
        const fdmBroadcast = (
          ctx.world as {
            broadcast?: {
              sendToNearby(
                name: string,
                data: unknown,
                worldX: number,
                worldZ: number,
              ): void;
              sendToAll(name: string, data: unknown): void;
            };
          }
        ).broadcast;
        const faceDirectionManager = new FaceDirectionManager(ctx.world);
        faceDirectionManager.setSendFunction((name, data) => {
          const payload = data as { id?: string };
          const entity = payload?.id
            ? (ctx.world.entities?.get(payload.id) as {
                position?: { x: number; y: number; z: number };
              } | null)
            : null;
          if (entity?.position) {
            fdmBroadcast?.sendToNearby(
              name,
              data,
              entity.position.x,
              entity.position.z,
            );
          } else {
            fdmBroadcast?.sendToAll(name, data);
          }
        });
        (
          ctx.world as { faceDirectionManager?: FaceDirectionManager }
        ).faceDirectionManager = faceDirectionManager;
        ctx.scope.register(() => {
          delete (ctx.world as { faceDirectionManager?: FaceDirectionManager })
            .faceDirectionManager;
        });

        // Duel system — same manual-lifecycle pattern as
        // TradingSystem (migrated 2026-04-26). MUST register BEFORE
        // ServerNetwork.init() since ServerNetwork now resolves the
        // instance via `world.duelSystem` at start time and throws if
        // missing. ServerNetwork's tick processor + onPlayerDisconnect
        // / onPlayerReconnect handlers also resolve via this property.
        // The `systemsByName.set("duel", ...)` registration mirrors
        // the previous ServerNetwork.start() behavior so combat.ts
        // can `world.getSystem("duel")` to detect duel combat.
        const duelSystem = new DuelSystem(ctx.world);
        (ctx.world as { duelSystem?: DuelSystem }).duelSystem = duelSystem;
        (
          ctx.world as { systemsByName: Map<string, unknown> }
        ).systemsByName.set("duel", duelSystem);
        duelSystem.init();
        ctx.scope.register(() => {
          duelSystem.destroy();
          delete (ctx.world as { duelSystem?: DuelSystem }).duelSystem;
          (
            ctx.world as { systemsByName: Map<string, unknown> }
          ).systemsByName.delete("duel");
        });
      }

      // Client-only visual feedback systems. Original SystemLoader
      // gated these on `if (world.isClient)`. Mirror that here so the
      // server boot doesn't try to instantiate THREE.Sprite-based
      // visual systems.
      if (!ctx.world.isServer) {
        register("damage-splat", DamageSplatSystem);
        register("duel-countdown-splat", DuelCountdownSplatSystem);
        // VRM bone-attached weapons / armor / accessories. Helpers
        // (`attachEquipmentVisualToVRM` etc.) stay in shared because
        // asset-forge consumes them as part of the public API.
        register("equipment-visual", EquipmentVisualSystem);
        register("projectile-renderer", ProjectileRenderer);
        // Procedural-river TSL waterfall renderer — purely visual,
        // self-no-op when there are no river-derived definitions.
        register("waterfall-visuals", WaterfallVisualsSystem);
        // Per-entity HP bars — single instanced TSL mesh keyed by
        // entity id. OSRS pattern (right-click menus carry names;
        // bars carry HP percent).
        register("healthbars", HealthBars);
        // Zone overlays (skull / home / swords) + chat warnings on
        // wilderness/town/arena boundary crossings. Reads
        // ZoneDetectionSystem live from world (which still lives
        // in shared because combat consumes it).
        register("zone-visuals", ZoneVisualsSystem);
        // Home-teleport blue-helix VFX. Driven by `home_teleport:start`
        // / `:cancel` events from PlayerSystem. OSRS teleport feel.
        register("teleport-effects", ClientTeleportEffectsSystem);
        // Debug overlays — toggled via F5 panel keys (B / W) and 'P'.
        register("bfsPathDebug", BFSPathDebugSystem);
        register("walkableDebug", WalkableTileDebugSystem);
        // Building-pathfinding debug overlay (P key). Opt-in via
        // world.pathfindingDebug.setEnabled(true).
        register("pathfindingDebug", PathfindingDebugSystem);
        // Resource tile occupancy debug — opt-in via
        // world.resourceTileDebug.setEnabled(true).
        register("resource-tile-debug", ResourceTileDebugSystem);
        // Background music with combat-aware crossfade. Web Audio
        // API + ClientAudio + ClientLoader — strictly client-side.
        register("music", MusicSystem);
        // GPU-instanced vegetation rendering (trees/bushes/grass/
        // flowers/rocks). Uses biome vegetation config and listens
        // to TerrainSystem tile events for generation triggers.
        // Strictly client-side (purely visual).
        register("vegetation", VegetationSystem);
        // Procedural town buildings — LOD batching, dynamic
        // impostor atlas, lazy collision. Reads building placement
        // data from TownSystem (still in shared).
        register("building-rendering", BuildingRenderingSystem);
        // Procedural grass — disabled. `GrassVisualManager` (the
        // quad-tree instanced clump renderer in TerrainSystem) is
        // the canonical grass system; `ProceduralGrassSystem` here
        // was the parallel implementation that produced the
        // "everywhere" look-worse coverage when both ran together.
        // Kept the import so re-enabling is one-line if we ever
        // resume the procedural path.
        // register("grass", ProceduralGrassSystem);
        // Drag-and-drop + right-click context menus. Originally
        // registered inside `if (world.isClient)` in SystemLoader.
        // Stats reader (`getSystemInfo`) is duck-typed at the
        // SystemLoader callsite.
        register("inventory-interaction", InventoryInteractionSystem);
      }
    },
    onDisable(_ctx) {
      // Scope disposers (registered in onEnable) handle teardown.
    },
  };
  return plugin;
};

export default defaultFactory;
