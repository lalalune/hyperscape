/**
 * ConfirmModal Component Unit Tests
 *
 * Tests for the generic confirmation modal.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ConfirmModal } from "../../../../../src/game/panels/BankPanel/components/modals/ConfirmModal";
import type { ConfirmModalState } from "../../../../../src/game/panels/BankPanel/types";

describe("ConfirmModal", () => {
  const mockOnConfirm = vi.fn();
  const mockOnClose = vi.fn();

  const defaultModal: ConfirmModalState = {
    visible: true,
    title: "Delete Tab",
    message: "Are you sure you want to delete this tab?",
    onConfirm: mockOnConfirm,
  };

  const defaultProps = {
    modal: defaultModal,
    onClose: mockOnClose,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ========================================================================
  // Visibility
  // ========================================================================

  describe("visibility", () => {
    it("renders nothing when not visible", () => {
      const modal = { ...defaultModal, visible: false };
      const { container } = render(
        <ConfirmModal {...defaultProps} modal={modal} />,
      );

      expect(container.firstChild).toBeNull();
    });

    it("renders modal when visible", () => {
      render(<ConfirmModal {...defaultProps} />);

      expect(screen.getByText("Delete Tab")).toBeInTheDocument();
    });
  });

  // ========================================================================
  // Title and Message Display
  // ========================================================================

  describe("title and message display", () => {
    it("displays the title", () => {
      render(<ConfirmModal {...defaultProps} />);

      expect(screen.getByText("Delete Tab")).toBeInTheDocument();
    });

    it("displays the message", () => {
      render(<ConfirmModal {...defaultProps} />);

      expect(
        screen.getByText("Are you sure you want to delete this tab?"),
      ).toBeInTheDocument();
    });

    it("displays custom title", () => {
      const modal = { ...defaultModal, title: "Confirm Action" };
      render(<ConfirmModal {...defaultProps} modal={modal} />);

      expect(screen.getByText("Confirm Action")).toBeInTheDocument();
    });

    it("displays custom message", () => {
      const modal = { ...defaultModal, message: "This cannot be undone." };
      render(<ConfirmModal {...defaultProps} modal={modal} />);

      expect(screen.getByText("This cannot be undone.")).toBeInTheDocument();
    });
  });

  // ========================================================================
  // Confirm Action
  // ========================================================================

  describe("confirm action", () => {
    it("renders Delete button", () => {
      render(<ConfirmModal {...defaultProps} />);

      expect(screen.getByText("Delete")).toBeInTheDocument();
    });

    it("calls onConfirm when Delete clicked", () => {
      render(<ConfirmModal {...defaultProps} />);

      fireEvent.click(screen.getByText("Delete"));

      expect(mockOnConfirm).toHaveBeenCalled();
    });

    it("calls onClose after confirm", () => {
      render(<ConfirmModal {...defaultProps} />);

      fireEvent.click(screen.getByText("Delete"));

      expect(mockOnClose).toHaveBeenCalled();
    });

    it("calls onConfirm before onClose", () => {
      const callOrder: string[] = [];
      const trackingOnConfirm = vi.fn(() => callOrder.push("confirm"));
      const trackingOnClose = vi.fn(() => callOrder.push("close"));

      const modal = { ...defaultModal, onConfirm: trackingOnConfirm };
      render(<ConfirmModal modal={modal} onClose={trackingOnClose} />);

      fireEvent.click(screen.getByText("Delete"));

      expect(callOrder).toEqual(["confirm", "close"]);
    });
  });

  // ========================================================================
  // Cancel Action
  // ========================================================================

  describe("cancel action", () => {
    it("renders Cancel button", () => {
      render(<ConfirmModal {...defaultProps} />);

      expect(screen.getByText("Cancel")).toBeInTheDocument();
    });

    it("calls onClose when Cancel clicked", () => {
      render(<ConfirmModal {...defaultProps} />);

      fireEvent.click(screen.getByText("Cancel"));

      expect(mockOnClose).toHaveBeenCalled();
    });

    it("does not call onConfirm when Cancel clicked", () => {
      render(<ConfirmModal {...defaultProps} />);

      fireEvent.click(screen.getByText("Cancel"));

      expect(mockOnConfirm).not.toHaveBeenCalled();
    });
  });

  // ========================================================================
  // Backdrop Click
  // ========================================================================

  describe("backdrop click", () => {
    it("closes modal on backdrop click", () => {
      const { container } = render(<ConfirmModal {...defaultProps} />);

      // The backdrop is the outermost div with the onClick
      const backdrop = container.firstChild as HTMLElement;
      fireEvent.click(backdrop);

      expect(mockOnClose).toHaveBeenCalled();
    });

    it("does not close on modal content click", () => {
      render(<ConfirmModal {...defaultProps} />);

      // Click on the modal title (inside the modal)
      fireEvent.click(screen.getByText("Delete Tab"));

      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });
});
