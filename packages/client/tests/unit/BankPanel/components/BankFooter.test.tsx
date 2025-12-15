/**
 * BankFooter Component Unit Tests
 *
 * Tests for slot count display, placeholder count, Item/Note toggle,
 * and placeholder controls.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BankFooter } from "../../../../src/game/panels/BankPanel/components/BankFooter";
import type { BankItem } from "../../../../src/game/panels/BankPanel/types";
import { TAB_INDEX_ALL } from "../../../../src/game/panels/BankPanel/constants";

describe("BankFooter", () => {
  const mockOnToggleNote = vi.fn();
  const mockOnTogglePlaceholder = vi.fn();
  const mockOnReleaseAllPlaceholders = vi.fn();

  const defaultItems: BankItem[] = [
    { itemId: "bronze_sword", quantity: 10, slot: 0, tabIndex: 0 },
    { itemId: "iron_helmet", quantity: 5, slot: 1, tabIndex: 0 },
    { itemId: "oak_logs", quantity: 0, slot: 2, tabIndex: 0 }, // placeholder
    { itemId: "lobster", quantity: 100, slot: 0, tabIndex: 1 },
  ];

  const defaultProps = {
    items: defaultItems,
    filteredItems: defaultItems,
    maxSlots: 480,
    selectedTab: TAB_INDEX_ALL,
    withdrawAsNote: false,
    onToggleNote: mockOnToggleNote,
    alwaysSetPlaceholder: false,
    onTogglePlaceholder: mockOnTogglePlaceholder,
    onReleaseAllPlaceholders: mockOnReleaseAllPlaceholders,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ========================================================================
  // Slot Count Display
  // ========================================================================

  describe("slot count display", () => {
    it("shows total items count when viewing All tab", () => {
      render(<BankFooter {...defaultProps} />);

      expect(screen.getByText(/4 items/)).toBeInTheDocument();
    });

    it("shows filtered items count when viewing specific tab", () => {
      const filteredItems = defaultItems.filter((i) => i.tabIndex === 0);
      render(
        <BankFooter
          {...defaultProps}
          selectedTab={0}
          filteredItems={filteredItems}
        />,
      );

      expect(screen.getByText(/3 in tab/)).toBeInTheDocument();
    });

    it("shows total slots used out of max", () => {
      render(<BankFooter {...defaultProps} />);

      expect(screen.getByText(/4\/480 slots/)).toBeInTheDocument();
    });
  });

  // ========================================================================
  // Placeholder Count
  // ========================================================================

  describe("placeholder count", () => {
    it("shows placeholder count when placeholders exist", () => {
      render(<BankFooter {...defaultProps} />);

      expect(screen.getByText(/1 placeholder/)).toBeInTheDocument();
    });

    it("pluralizes correctly for multiple placeholders", () => {
      const itemsWithPlaceholders: BankItem[] = [
        ...defaultItems,
        { itemId: "coins", quantity: 0, slot: 3, tabIndex: 0 },
      ];
      render(<BankFooter {...defaultProps} items={itemsWithPlaceholders} />);

      expect(screen.getByText(/2 placeholders/)).toBeInTheDocument();
    });

    it("does not show placeholder count when no placeholders", () => {
      const noPlaceholders = defaultItems.filter((i) => i.quantity > 0);
      render(<BankFooter {...defaultProps} items={noPlaceholders} />);

      // The "(X placeholder)" count text should not appear
      // Note: "Always placeholder" label always shows, so we check for the count pattern
      expect(screen.queryByText(/\d+ placeholder/)).not.toBeInTheDocument();
    });
  });

  // ========================================================================
  // Item/Note Toggle
  // ========================================================================

  describe("item/note toggle", () => {
    it("renders Item and Note buttons", () => {
      render(<BankFooter {...defaultProps} />);

      expect(screen.getByText("Item")).toBeInTheDocument();
      expect(screen.getByText("Note")).toBeInTheDocument();
    });

    it("highlights Item button when withdrawAsNote is false", () => {
      render(<BankFooter {...defaultProps} withdrawAsNote={false} />);

      const itemButton = screen.getByText("Item");
      expect(itemButton.style.background).toContain("139, 69, 19");
    });

    it("highlights Note button when withdrawAsNote is true", () => {
      render(<BankFooter {...defaultProps} withdrawAsNote={true} />);

      const noteButton = screen.getByText("Note");
      expect(noteButton.style.background).toContain("139, 69, 19");
    });

    it("calls onToggleNote(false) when Item button clicked", () => {
      render(<BankFooter {...defaultProps} withdrawAsNote={true} />);

      fireEvent.click(screen.getByText("Item"));

      expect(mockOnToggleNote).toHaveBeenCalledWith(false);
    });

    it("calls onToggleNote(true) when Note button clicked", () => {
      render(<BankFooter {...defaultProps} withdrawAsNote={false} />);

      fireEvent.click(screen.getByText("Note"));

      expect(mockOnToggleNote).toHaveBeenCalledWith(true);
    });
  });

  // ========================================================================
  // Always Placeholder Checkbox
  // ========================================================================

  describe("always placeholder checkbox", () => {
    it("renders checkbox with label", () => {
      render(<BankFooter {...defaultProps} />);

      expect(screen.getByText("Always placeholder")).toBeInTheDocument();
      expect(screen.getByRole("checkbox")).toBeInTheDocument();
    });

    it("checkbox is unchecked when alwaysSetPlaceholder is false", () => {
      render(<BankFooter {...defaultProps} alwaysSetPlaceholder={false} />);

      expect(screen.getByRole("checkbox")).not.toBeChecked();
    });

    it("checkbox is checked when alwaysSetPlaceholder is true", () => {
      render(<BankFooter {...defaultProps} alwaysSetPlaceholder={true} />);

      expect(screen.getByRole("checkbox")).toBeChecked();
    });

    it("calls onTogglePlaceholder when checkbox changed", () => {
      render(<BankFooter {...defaultProps} />);

      fireEvent.click(screen.getByRole("checkbox"));

      expect(mockOnTogglePlaceholder).toHaveBeenCalled();
    });
  });

  // ========================================================================
  // Clear All Button
  // ========================================================================

  describe("clear all button", () => {
    it("shows Clear All button when placeholders exist", () => {
      render(<BankFooter {...defaultProps} />);

      expect(screen.getByText("Clear All")).toBeInTheDocument();
    });

    it("does not show Clear All button when no placeholders", () => {
      const noPlaceholders = defaultItems.filter((i) => i.quantity > 0);
      render(<BankFooter {...defaultProps} items={noPlaceholders} />);

      expect(screen.queryByText("Clear All")).not.toBeInTheDocument();
    });

    it("calls onReleaseAllPlaceholders when Clear All clicked", () => {
      render(<BankFooter {...defaultProps} />);

      fireEvent.click(screen.getByText("Clear All"));

      expect(mockOnReleaseAllPlaceholders).toHaveBeenCalled();
    });
  });

  // ========================================================================
  // Tooltips
  // ========================================================================

  describe("tooltips", () => {
    it("shows correct tooltip for Item button", () => {
      render(<BankFooter {...defaultProps} />);

      const itemButton = screen.getByTitle(/Withdraw items as-is/);
      expect(itemButton).toBeInTheDocument();
    });

    it("shows correct tooltip for Note button", () => {
      render(<BankFooter {...defaultProps} />);

      const noteButton = screen.getByTitle(/Withdraw items as bank notes/);
      expect(noteButton).toBeInTheDocument();
    });

    it("shows correct tooltip for placeholder checkbox when enabled", () => {
      render(<BankFooter {...defaultProps} alwaysSetPlaceholder={true} />);

      const label = screen.getByTitle(/Placeholders ON/);
      expect(label).toBeInTheDocument();
    });

    it("shows correct tooltip for placeholder checkbox when disabled", () => {
      render(<BankFooter {...defaultProps} alwaysSetPlaceholder={false} />);

      const label = screen.getByTitle(/Placeholders OFF/);
      expect(label).toBeInTheDocument();
    });
  });
});
