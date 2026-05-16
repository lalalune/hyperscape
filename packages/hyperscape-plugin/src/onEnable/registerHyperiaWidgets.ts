/**
 * `registerHyperiaWidgets` — UI widget registration for the
 * Hyperia plugin.
 *
 * Extracted from `index.ts`'s `onEnable` per PLAN_AAA_MASTER_AUDIT
 * debt #3 (the hyperscape-plugin onEnable monolith was 2,353 lines).
 * The widget set itself is plugin-internal — moving it here keeps
 * index.ts focused on the lifecycle hook structure rather than the
 * widget catalog.
 *
 * Always called unconditionally on plugin onEnable (widgets are
 * available for studio / editor introspection regardless of whether
 * content packs spawn instances). Content-emitting systems (towns,
 * NPCs, items) gate on the Hyperia content pack; widgets do not.
 */

import type { HyperscapeContext } from "../index.js";

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
import { sectionHeaderRegistration } from "../widgets/SectionHeaderWidget.js";
import { countdownDisplayRegistration } from "../widgets/CountdownDisplayWidget.js";
import { breadcrumbsRegistration } from "../widgets/BreadcrumbsWidget.js";
import { checkboxRegistration } from "../widgets/CheckboxWidget.js";
import { keyboardShortcutHintRegistration } from "../widgets/KeyboardShortcutHintWidget.js";
import { paginationRegistration } from "../widgets/PaginationWidget.js";
import { iconButtonRegistration } from "../widgets/IconButtonWidget.js";
import { dividerRegistration } from "../widgets/DividerWidget.js";
import { skeletonRegistration } from "../widgets/SkeletonWidget.js";
import { stepIndicatorRegistration } from "../widgets/StepIndicatorWidget.js";
import { codeBlockRegistration } from "../widgets/CodeBlockWidget.js";

/**
 * Register every Hyperia UI widget on the host's widget registry.
 * Order doesn't matter; lookup is by string key on each
 * registration. New widgets get added here.
 */
export function registerHyperiaWidgets(
  widgets: NonNullable<HyperscapeContext["widgets"]>,
): void {
  widgets.register(xpOrbRegistration);
  widgets.register(levelUpToastRegistration);
  widgets.register(kickedOverlayRegistration);
  widgets.register(disconnectedOverlayRegistration);
  widgets.register(deathScreenRegistration);
  widgets.register(connectionIndicatorRegistration);
  widgets.register(minimapStaminaOrbRegistration);
  widgets.register(minimapCompassRegistration);
  widgets.register(actionProgressBarRegistration);
  widgets.register(homeTeleportButtonRegistration);
  widgets.register(minimapHomeTeleportOrbRegistration);
  widgets.register(skillSelectModalRegistration);
  widgets.register(floatingXPDropsRegistration);
  widgets.register(unlocksSectionRegistration);
  widgets.register(coinPouchRegistration);
  widgets.register(selectOptionRegistration);
  widgets.register(confirmDialogRegistration);
  widgets.register(quantityPromptRegistration);
  widgets.register(incomingRequestModalRegistration);
  widgets.register(equipmentSlotIconRegistration);
  widgets.register(dialoguePanelRegistration);
  widgets.register(arrayInputRegistration);
  widgets.register(curvePreviewRegistration);
  widgets.register(contextMenuRegistration);
  widgets.register(keyValueListRegistration);
  widgets.register(cursorTooltipRegistration);
  widgets.register(notificationToastListRegistration);
  widgets.register(buffBarRegistration);
  widgets.register(victoryOverlayRegistration);
  widgets.register(alignmentGuidesRegistration);
  widgets.register(dragGhostOverlayRegistration);
  widgets.register(progressBarRegistration);
  widgets.register(loadingSpinnerRegistration);
  widgets.register(toggleSwitchRegistration);
  widgets.register(rangeSliderRegistration);
  widgets.register(badgeRegistration);
  widgets.register(segmentedControlRegistration);
  widgets.register(textInputRegistration);
  widgets.register(avatarRegistration);
  widgets.register(emptyStateRegistration);
  widgets.register(chipListRegistration);
  widgets.register(sectionHeaderRegistration);
  widgets.register(countdownDisplayRegistration);
  widgets.register(breadcrumbsRegistration);
  widgets.register(checkboxRegistration);
  widgets.register(keyboardShortcutHintRegistration);
  widgets.register(paginationRegistration);
  widgets.register(iconButtonRegistration);
  widgets.register(dividerRegistration);
  widgets.register(skeletonRegistration);
  widgets.register(stepIndicatorRegistration);
  widgets.register(codeBlockRegistration);
}
