/**
 * Bank Panel Components
 *
 * Barrel export for all BankPanel sub-components.
 */

// Memoized slot component (CRITICAL for performance)
export { BankSlotItem } from "./BankSlotItem";
export type { BankSlotItemProps } from "./BankSlotItem";

// Tab bar component
export { BankTabBar } from "./BankTabBar";
export type { BankTabBarProps } from "./BankTabBar";

// Footer component
export { BankFooter } from "./BankFooter";
export type { BankFooterProps } from "./BankFooter";

// Right panel (inventory/equipment)
export { RightPanel } from "./RightPanel";
export type { RightPanelProps } from "./RightPanel";

// Modal components
export { ContextMenu, CoinAmountModal, ConfirmModal } from "./modals";
