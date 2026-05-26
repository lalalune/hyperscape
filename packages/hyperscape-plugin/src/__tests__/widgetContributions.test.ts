/**
 * Phase 3.1 of PLAN_AAA_UE5_PARITY — widget contribution field
 * parity test.
 *
 * The plugin registers ~52 widgets at runtime via
 * `registerHyperiaWidgets(ctx.widgets)`. Before this phase the
 * plugin.json's `contributions.widgets` array was empty `[]`,
 * which meant the editor / agent's plugin-registry surface had
 * no idea what widgets the plugin shipped — agents couldn't
 * reference them, the editor couldn't preview them.
 *
 * Phase 3.1 populates the manifest array with every widget id
 * the plugin registers. This test pins the two sides in lock-
 * step so any future widget added to the runtime call without a
 * manifest entry (or vice versa) fails CI loudly.
 *
 * The test reads the actual widget id from each
 * `WidgetRegistration` module rather than hard-coding strings —
 * if a widget's manifest.id changes, the test follows.
 */

import { describe, expect, it } from "vitest";

import { manifest } from "../index.js";

// Mirror the import set in `onEnable/registerHyperiaWidgets.ts`.
// Touch this list when widgets are added/removed there; the
// `expect(manifest.contributions.widgets).toEqual(runtimeIds)`
// assertion below catches the manifest side automatically.
import { xpOrbRegistration } from "../widgets/XPOrbWidget.js";
import { levelUpToastRegistration } from "../widgets/LevelUpToastWidget.js";
import { kickedOverlayRegistration } from "../widgets/KickedOverlayWidget.js";
import { disconnectedOverlayRegistration } from "../widgets/DisconnectedOverlayWidget.js";
import { deathScreenRegistration } from "../widgets/DeathScreenWidget.js";
import { connectionIndicatorRegistration } from "../widgets/ConnectionIndicatorWidget.js";
import { minimapStaminaOrbRegistration } from "../widgets/MinimapStaminaOrbWidget.js";
import { minimapCompassRegistration } from "../widgets/MinimapCompassWidget.js";
import { actionProgressBarRegistration } from "../widgets/ActionProgressBarWidget.js";
import { homeTeleportButtonRegistration } from "../widgets/HomeTeleportButtonWidget.js";
import { minimapHomeTeleportOrbRegistration } from "../widgets/MinimapHomeTeleportOrbWidget.js";
import { skillSelectModalRegistration } from "../widgets/SkillSelectModalWidget.js";
import { floatingXPDropsRegistration } from "../widgets/FloatingXPDropsWidget.js";
import { unlocksSectionRegistration } from "../widgets/UnlocksSectionWidget.js";
import { coinPouchRegistration } from "../widgets/CoinPouchWidget.js";
import { selectOptionRegistration } from "../widgets/SelectOptionWidget.js";
import { confirmDialogRegistration } from "../widgets/ConfirmDialogWidget.js";
import { quantityPromptRegistration } from "../widgets/QuantityPromptWidget.js";
import { incomingRequestModalRegistration } from "../widgets/IncomingRequestModalWidget.js";
import { equipmentSlotIconRegistration } from "../widgets/EquipmentSlotIconWidget.js";
import { dialoguePanelRegistration } from "../widgets/DialoguePanelWidget.js";
import { arrayInputRegistration } from "../widgets/ArrayInputWidget.js";
import { curvePreviewRegistration } from "../widgets/CurvePreviewWidget.js";
import { contextMenuRegistration } from "../widgets/ContextMenuWidget.js";
import { keyValueListRegistration } from "../widgets/KeyValueListWidget.js";
import { cursorTooltipRegistration } from "../widgets/CursorTooltipWidget.js";
import { notificationToastListRegistration } from "../widgets/NotificationToastListWidget.js";
import { buffBarRegistration } from "../widgets/BuffBarWidget.js";
import { victoryOverlayRegistration } from "../widgets/VictoryOverlayWidget.js";
import { alignmentGuidesRegistration } from "../widgets/AlignmentGuidesWidget.js";
import { dragGhostOverlayRegistration } from "../widgets/DragGhostOverlayWidget.js";
import { progressBarRegistration } from "../widgets/ProgressBarWidget.js";
import { loadingSpinnerRegistration } from "../widgets/LoadingSpinnerWidget.js";
import { toggleSwitchRegistration } from "../widgets/ToggleSwitchWidget.js";
import { rangeSliderRegistration } from "../widgets/RangeSliderWidget.js";
import { badgeRegistration } from "../widgets/BadgeWidget.js";
import { segmentedControlRegistration } from "../widgets/SegmentedControlWidget.js";
import { textInputRegistration } from "../widgets/TextInputWidget.js";
import { avatarRegistration } from "../widgets/AvatarWidget.js";
import { emptyStateRegistration } from "../widgets/EmptyStateWidget.js";
import { chipListRegistration } from "../widgets/ChipListWidget.js";
import { paginationRegistration } from "../widgets/PaginationWidget.js";
import { skeletonRegistration } from "../widgets/SkeletonWidget.js";
import { iconButtonRegistration } from "../widgets/IconButtonWidget.js";
import { checkboxRegistration } from "../widgets/CheckboxWidget.js";
import { dividerRegistration } from "../widgets/DividerWidget.js";
import { sectionHeaderRegistration } from "../widgets/SectionHeaderWidget.js";
import { codeBlockRegistration } from "../widgets/CodeBlockWidget.js";
import { keyboardShortcutHintRegistration } from "../widgets/KeyboardShortcutHintWidget.js";
import { stepIndicatorRegistration } from "../widgets/StepIndicatorWidget.js";
import { breadcrumbsRegistration } from "../widgets/BreadcrumbsWidget.js";
import { countdownDisplayRegistration } from "../widgets/CountdownDisplayWidget.js";

/**
 * Pull the id off each WidgetRegistration. Some registrations
 * wrap a flat widget, others a hook factory; both expose the
 * widget under `.widget.manifest.id`.
 */
function widgetIdOf(reg: { widget: { manifest: { id: string } } }): string {
  return reg.widget.manifest.id;
}

const RUNTIME_WIDGET_REGISTRATIONS = [
  xpOrbRegistration,
  levelUpToastRegistration,
  kickedOverlayRegistration,
  disconnectedOverlayRegistration,
  deathScreenRegistration,
  connectionIndicatorRegistration,
  minimapStaminaOrbRegistration,
  minimapCompassRegistration,
  actionProgressBarRegistration,
  homeTeleportButtonRegistration,
  minimapHomeTeleportOrbRegistration,
  skillSelectModalRegistration,
  floatingXPDropsRegistration,
  unlocksSectionRegistration,
  coinPouchRegistration,
  selectOptionRegistration,
  confirmDialogRegistration,
  quantityPromptRegistration,
  incomingRequestModalRegistration,
  equipmentSlotIconRegistration,
  dialoguePanelRegistration,
  arrayInputRegistration,
  curvePreviewRegistration,
  contextMenuRegistration,
  keyValueListRegistration,
  cursorTooltipRegistration,
  notificationToastListRegistration,
  buffBarRegistration,
  victoryOverlayRegistration,
  alignmentGuidesRegistration,
  dragGhostOverlayRegistration,
  progressBarRegistration,
  loadingSpinnerRegistration,
  toggleSwitchRegistration,
  rangeSliderRegistration,
  badgeRegistration,
  segmentedControlRegistration,
  textInputRegistration,
  avatarRegistration,
  emptyStateRegistration,
  chipListRegistration,
  paginationRegistration,
  skeletonRegistration,
  iconButtonRegistration,
  checkboxRegistration,
  dividerRegistration,
  sectionHeaderRegistration,
  codeBlockRegistration,
  keyboardShortcutHintRegistration,
  stepIndicatorRegistration,
  breadcrumbsRegistration,
  countdownDisplayRegistration,
] as const;

describe("@hyperforge/hyperscape — widget contribution parity", () => {
  it("plugin.json contributions.widgets matches runtime registration set (no drift)", () => {
    const manifestIds = [...manifest.contributions.widgets].sort();
    const runtimeIds = RUNTIME_WIDGET_REGISTRATIONS.map(widgetIdOf).sort();
    expect(manifestIds).toEqual(runtimeIds);
  });

  it("manifest declares exactly the runtime count (52 widgets today)", () => {
    expect(manifest.contributions.widgets.length).toBe(
      RUNTIME_WIDGET_REGISTRATIONS.length,
    );
  });

  it("every widget id is namespace-prefixed under com.hyperforge.hyperscape", () => {
    for (const id of manifest.contributions.widgets) {
      expect(id.startsWith("com.hyperforge.hyperscape.")).toBe(true);
    }
  });

  it("no duplicate ids in the manifest list", () => {
    const ids = manifest.contributions.widgets;
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });
});
